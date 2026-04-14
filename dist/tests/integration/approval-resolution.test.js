"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = require("node:os");
const node_test_1 = __importDefault(require("node:test"));
const index_1 = require("../../apps/corp-cli/src/index");
const append_event_1 = require("../../packages/journal/src/event-log/append-event");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const file_execution_attempt_repository_1 = require("../../packages/storage/src/repositories/file-execution-attempt-repository");
const file_mission_repository_1 = require("../../packages/storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../packages/storage/src/repositories/file-ticket-repository");
const ticket_service_support_1 = require("../../packages/ticket-runtime/src/ticket-service/ticket-service-support");
const run_ticket_1 = require("../../packages/ticket-runtime/src/ticket-service/run-ticket");
async function runCommand(args) {
    const lines = [];
    const exitCode = await (0, index_1.runCli)(args, {
        writeLine: (line) => lines.push(line),
    });
    return {
        exitCode,
        lines,
    };
}
async function readJson(filePath) {
    return JSON.parse(await (0, promises_1.readFile)(filePath, "utf8"));
}
async function bootstrapWorkspace(rootDir) {
    const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 0);
}
async function createMission(rootDir, title = "Mission approval resolution") {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Resoudre une validation en attente sans fuite vendor",
        "--success-criterion",
        "La decision est journalisee",
        "--success-criterion",
        "Les projections restent coherentes",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    const mission = await readMission(rootDir, line.slice("Mission creee: ".length));
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({
        ...mission,
        authorizedExtensions: {
            allowedCapabilities: ["shell.exec"],
            skillPackRefs: ["pack.audit", "pack.review"],
        },
    }, null, 2)}\n`, "utf8");
    return readMission(rootDir, mission.id);
}
async function createTicket(rootDir, missionId, overrides = {}) {
    const result = await runCommand([
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--kind",
        "implement",
        "--goal",
        overrides.goal ?? "Executer une action sensible",
        "--owner",
        overrides.owner ?? "agent_sensitive",
        ...buildRepeatedOptionArgs("--success-criterion", overrides.successCriteria ?? ["L'action sensible est decrite"]),
        ...buildRepeatedOptionArgs("--allow-capability", overrides.allowedCapabilities ?? ["fs.read", "cli.run"]),
        ...buildRepeatedOptionArgs("--skill-pack", overrides.skillPackRefs ?? ["pack.audit"]),
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return line.slice("Ticket cree: ".length);
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function readTicket(rootDir, missionId, ticketId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"));
}
async function readAttempt(rootDir, missionId, ticketId, attemptId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "attempts", attemptId, "attempt.json"));
}
async function readApprovalQueueProjection(rootDir) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
async function registerTestSkillPack(rootDir, packRef = "pack.audit") {
    const sourceFixtureRoot = node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
    const sourceManifestPath = node_path_1.default.join(sourceFixtureRoot, "valid-skill-pack.json");
    const fixtureRoot = node_path_1.default.join(rootDir, ".skill-pack-fixtures");
    const manifestPath = node_path_1.default.join(fixtureRoot, `${packRef.replace(/\./g, "-")}.skill-pack.json`);
    const manifest = JSON.parse(await (0, promises_1.readFile)(sourceManifestPath, "utf8"));
    const skillPack = manifest.skillPack;
    await (0, promises_1.cp)(node_path_1.default.join(sourceFixtureRoot, "skill-packs"), node_path_1.default.join(fixtureRoot, "skill-packs"), { recursive: true });
    manifest.id = `ext.skill-pack.${packRef}.test`;
    manifest.displayName = `Pack ${packRef}`;
    manifest.skillPack = {
        ...skillPack,
        packRef,
    };
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const registerResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        manifestPath,
    ]);
    strict_1.default.equal(registerResult.exitCode, 0);
}
async function openApprovalForTicket(rootDir, missionId, ticketId, overrides = {}) {
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_approval_resolution",
                    pollCursor: "cursor_approval_resolution",
                    vendorStatus: "requires_approval",
                    ...overrides.adapterState,
                },
                approvalRequest: {
                    title: overrides.title ?? "Validation requise pour une action sensible",
                    actionType: overrides.actionType ?? "workspace_write",
                    actionSummary: overrides.actionSummary ?? "Modification sensible dans le workspace isole",
                    guardrails: overrides.guardrails ?? ["manual_review: workspace_write"],
                    relatedArtifactIds: overrides.relatedArtifactIds,
                },
            }),
        }),
    });
    await registerTestSkillPack(rootDir, "pack.audit");
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
        "--background",
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
    strict_1.default.ok(attemptLine, "la commande doit annoncer l'attempt ouverte");
    const queueProjection = await readApprovalQueueProjection(rootDir);
    const approval = queueProjection.approvals.find((entry) => entry.ticketId === ticketId);
    strict_1.default.ok(approval, "la queue doit contenir la validation ouverte pour le ticket");
    return {
        approval,
        attemptId: attemptLine.slice("Tentative ouverte: ".length),
    };
}
function buildRepeatedOptionArgs(optionName, values) {
    return values.flatMap((value) => [optionName, value]);
}
async function seedPendingApproval(rootDir, missionId, ticketId, suffix) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    const ticket = await ticketRepository.findById(missionId, ticketId);
    strict_1.default.ok(mission);
    strict_1.default.ok(ticket);
    const occurredAt = new Date().toISOString();
    const approvalId = `approval_seed_${suffix}`;
    const attemptId = `attempt_seed_${suffix}`;
    const eventId = `event_seed_${suffix}`;
    const adapterState = {
        responseId: `resp_seed_${suffix}`,
        vendorStatus: "requires_approval",
    };
    const workspaceIsolationId = `iso_seed_${suffix}`;
    const updatedMission = {
        ...mission,
        status: "awaiting_approval",
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const updatedTicket = {
        ...ticket,
        status: "awaiting_approval",
        workspaceIsolationId,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: { ...adapterState },
        },
        eventIds: [...ticket.eventIds, eventId],
        updatedAt: occurredAt,
    };
    const attempt = {
        id: attemptId,
        ticketId: ticket.id,
        adapter: "codex_responses",
        status: "awaiting_approval",
        workspaceIsolationId,
        backgroundRequested: true,
        adapterState: { ...adapterState },
        startedAt: occurredAt,
        endedAt: null,
    };
    const approval = {
        approvalId,
        missionId,
        ticketId: ticket.id,
        attemptId,
        status: "requested",
        title: `Validation secondaire ${suffix}`,
        actionType: "workspace_write",
        actionSummary: `Modification secondaire ${suffix}`,
        guardrails: buildSeedGuardrails(["manual_review: workspace_write"], updatedMission.policyProfileId, updatedTicket.allowedCapabilities, updatedTicket.skillPackRefs),
        relatedEventIds: [mission.resumeCursor],
        relatedArtifactIds: [],
        createdAt: occurredAt,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: "approval.requested",
        missionId,
        ticketId: ticket.id,
        attemptId,
        occurredAt,
        actor: "adapter",
        source: "codex_responses",
        payload: {
            mission: updatedMission,
            ticket: updatedTicket,
            attempt,
            approvalId,
            approval,
            trigger: "adapter",
        },
    };
    await (0, append_event_1.appendEvent)(layout.journalPath, event);
    await missionRepository.save(updatedMission);
    await ticketRepository.save(updatedTicket);
    await attemptRepository.save(missionId, attempt);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, updatedMission, ticketRepository);
    return approval;
}
async function seedActiveAttempt(rootDir, missionId, ticketId, suffix) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    const ticket = await ticketRepository.findById(missionId, ticketId);
    strict_1.default.ok(mission);
    strict_1.default.ok(ticket);
    const occurredAt = new Date().toISOString();
    const attemptId = `attempt_running_${suffix}`;
    const eventId = `event_running_${suffix}`;
    const adapterState = {
        responseId: `resp_running_${suffix}`,
        pollCursor: `cursor_running_${suffix}`,
        vendorStatus: "in_progress",
    };
    const workspaceIsolationId = `iso_running_${suffix}`;
    const updatedMission = {
        ...mission,
        status: mission.status === "awaiting_approval" ? "awaiting_approval" : "running",
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const updatedTicket = {
        ...ticket,
        status: "claimed",
        workspaceIsolationId,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: { ...adapterState },
        },
        eventIds: [...ticket.eventIds, eventId],
        updatedAt: occurredAt,
    };
    const attempt = {
        id: attemptId,
        ticketId: ticket.id,
        adapter: "codex_responses",
        status: "running",
        workspaceIsolationId,
        backgroundRequested: true,
        adapterState: { ...adapterState },
        startedAt: occurredAt,
        endedAt: null,
    };
    const event = {
        eventId,
        type: "execution.background_started",
        missionId,
        ticketId: ticket.id,
        attemptId,
        occurredAt,
        actor: "adapter",
        source: "codex_responses",
        payload: {
            mission: updatedMission,
            ticket: updatedTicket,
            attempt,
            trigger: "adapter",
        },
    };
    await (0, append_event_1.appendEvent)(layout.journalPath, event);
    await missionRepository.save(updatedMission);
    await ticketRepository.save(updatedTicket);
    await attemptRepository.save(missionId, attempt);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, updatedMission, ticketRepository);
    return attempt;
}
function buildSeedGuardrails(baseGuardrails, policyProfileId, allowedCapabilities, skillPackRefs) {
    const values = [
        ...baseGuardrails.filter((guardrail) => !guardrail.startsWith("policy_profile:")
            && !guardrail.startsWith("allowed_capabilities:")
            && !guardrail.startsWith("skill_packs:")),
        `policy_profile: ${policyProfileId}`,
        ...(allowedCapabilities.length > 0
            ? [`allowed_capabilities: ${allowedCapabilities.join(", ")}`]
            : []),
        ...(skillPackRefs.length > 0
            ? [`skill_packs: ${skillPackRefs.join(", ")}`]
            : []),
    ];
    return values.filter((value, index) => value.trim().length > 0 && values.indexOf(value) === index);
}
async function assertNoVendorLeak(rootDir, outputs) {
    const approvalQueueText = await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"), "utf8");
    const resumeViewText = await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"), "utf8");
    for (const output of [...outputs, approvalQueueText, resumeViewText]) {
        strict_1.default.doesNotMatch(output, /resp_|cursor_|responseId|pollCursor|vendorStatus|requires_approval|requires_action/i);
    }
}
(0, node_test_1.default)("mission approval approve journalise la decision, ferme l'attempt et applique les garde-fous persistants", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-approve-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId, {
        relatedArtifactIds: ["artifact_hint_approve"],
    });
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
        "--reason",
        "Validation manuelle de l'operateur",
        "--policy-profile",
        "policy_profile_strict",
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        "cli.run",
        "--allow-capability",
        "shell.exec",
        "--skill-pack",
        "pack.audit",
        "--skill-pack",
        "pack.review",
        "--budget-observation",
        "openai.responses.tokens=1200",
        "--budget-observation",
        "workspace_write=approved",
    ]);
    const missionAfter = await readMission(rootDir, mission.id);
    const ticketAfter = await readTicket(rootDir, mission.id, ticketId);
    const attemptAfter = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const queueAfter = await readApprovalQueueProjection(rootDir);
    const journal = await readJournal(rootDir);
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const queueResult = await runCommand([
        "mission",
        "approval",
        "queue",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const approvedEvent = journal.find((event) => event.type === "approval.approved");
    strict_1.default.equal(approveResult.exitCode, 0);
    strict_1.default.equal(approveResult.lines[0], `Approval resolue: ${approval.approvalId} (approved)`);
    strict_1.default.ok(approvedEvent, "la resolution doit produire approval.approved");
    strict_1.default.ok(journal.findIndex((event) => event.type === "approval.requested")
        < journal.findIndex((event) => event.type === "approval.approved"));
    const payload = approvedEvent.payload;
    strict_1.default.equal(missionAfter.status, "ready");
    strict_1.default.equal(missionAfter.policyProfileId, "policy_profile_strict");
    strict_1.default.equal(ticketAfter.status, "todo");
    strict_1.default.deepEqual(ticketAfter.allowedCapabilities, ["fs.read", "cli.run", "shell.exec"]);
    strict_1.default.deepEqual(ticketAfter.skillPackRefs, ["pack.audit", "pack.review"]);
    strict_1.default.equal(attemptAfter.status, "cancelled");
    strict_1.default.ok(attemptAfter.endedAt);
    strict_1.default.deepEqual(attemptAfter.adapterState, {
        responseId: "resp_approval_resolution",
        pollCursor: "cursor_approval_resolution",
        vendorStatus: "requires_approval",
    });
    strict_1.default.deepEqual(queueAfter.approvals, []);
    strict_1.default.equal(payload.approvalId, approval.approvalId);
    strict_1.default.equal(payload.previousApproval.status, "requested");
    strict_1.default.equal(payload.approval.status, "approved");
    strict_1.default.deepEqual(payload.approval.relatedArtifactIds, ["artifact_hint_approve"]);
    strict_1.default.deepEqual(payload.approval.guardrails, [
        "manual_review: workspace_write",
        "policy_profile: policy_profile_strict",
        "allowed_capabilities: fs.read, cli.run, shell.exec",
        "skill_packs: pack.audit, pack.review",
    ]);
    strict_1.default.deepEqual(payload.decision, {
        outcome: "approved",
        reason: "Validation manuelle de l'operateur",
        missionPolicyChange: {
            previous: "policy_profile_local",
            next: "policy_profile_strict",
        },
        ticketCapabilityChange: {
            previous: ["fs.read", "cli.run"],
            next: ["fs.read", "cli.run", "shell.exec"],
        },
        ticketSkillPackChange: {
            previous: ["pack.audit"],
            next: ["pack.audit", "pack.review"],
        },
        budgetObservations: [
            "openai.responses.tokens=1200",
            "workspace_write=approved",
        ],
    });
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.equal(queueResult.exitCode, 0);
    strict_1.default.match(statusResult.lines.join("\n"), /Statut: ready/);
    strict_1.default.match(statusResult.lines.join("\n"), /Validations en attente: aucune/);
    strict_1.default.match(resumeResult.lines.join("\n"), /Validations en attente: aucune/);
    strict_1.default.match(queueResult.lines.join("\n"), /Aucune validation en attente\./);
    strict_1.default.equal(Object.prototype.hasOwnProperty.call(missionAfter, "resource_budget"), false);
    strict_1.default.equal(Object.prototype.hasOwnProperty.call(ticketAfter, "resource_budget"), false);
    await assertNoVendorLeak(rootDir, [
        approveResult.lines.join("\n"),
        statusResult.lines.join("\n"),
        resumeResult.lines.join("\n"),
        queueResult.lines.join("\n"),
    ]);
});
(0, node_test_1.default)("mission approval reject vide la queue, passe le ticket en failed et garde la surface operateur sans fuite vendor", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-reject-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
    const rejectResult = await runCommand([
        "mission",
        "approval",
        "reject",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
        "--reason",
        "Refus operateur",
        "--budget-observation",
        "openai.responses.tokens=2200",
    ]);
    const missionAfter = await readMission(rootDir, mission.id);
    const ticketAfter = await readTicket(rootDir, mission.id, ticketId);
    const attemptAfter = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const queueAfter = await readApprovalQueueProjection(rootDir);
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const rejectEvent = (await readJournal(rootDir)).find((event) => event.type === "approval.rejected");
    strict_1.default.equal(rejectResult.exitCode, 0);
    strict_1.default.equal(rejectResult.lines[0], `Approval resolue: ${approval.approvalId} (rejected)`);
    strict_1.default.ok(rejectEvent);
    strict_1.default.equal(missionAfter.status, "ready");
    strict_1.default.equal(ticketAfter.status, "failed");
    strict_1.default.equal(attemptAfter.status, "cancelled");
    strict_1.default.ok(attemptAfter.endedAt);
    strict_1.default.deepEqual(queueAfter.approvals, []);
    strict_1.default.match(statusResult.lines.join("\n"), /Validations en attente: aucune/);
    strict_1.default.match(resumeResult.lines.join("\n"), /Aucun ticket n'est runnable pour le moment\./);
    await assertNoVendorLeak(rootDir, [
        rejectResult.lines.join("\n"),
        statusResult.lines.join("\n"),
        resumeResult.lines.join("\n"),
    ]);
});
(0, node_test_1.default)("mission approval defer peut nettoyer capabilities et skill packs sans ajouter de schema coeur", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-defer-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
    const deferResult = await runCommand([
        "mission",
        "approval",
        "defer",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
        "--reason",
        "Report operateur",
        "--clear-allow-capability",
        "--clear-skill-pack",
        "--budget-observation",
        "budget.observe=manual_review",
    ]);
    const ticketAfter = await readTicket(rootDir, mission.id, ticketId);
    const attemptAfter = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const deferEvent = (await readJournal(rootDir)).find((event) => event.type === "approval.deferred");
    strict_1.default.equal(deferResult.exitCode, 0);
    strict_1.default.equal(deferResult.lines[0], `Approval resolue: ${approval.approvalId} (deferred)`);
    strict_1.default.ok(deferEvent);
    strict_1.default.equal(ticketAfter.status, "failed");
    strict_1.default.deepEqual(ticketAfter.allowedCapabilities, []);
    strict_1.default.deepEqual(ticketAfter.skillPackRefs, []);
    strict_1.default.equal(attemptAfter.status, "cancelled");
    const payload = deferEvent.payload;
    strict_1.default.deepEqual(payload.approval.guardrails, [
        "manual_review: workspace_write",
        "policy_profile: policy_profile_local",
    ]);
    strict_1.default.deepEqual(payload.decision, {
        outcome: "deferred",
        reason: "Report operateur",
        ticketCapabilityChange: {
            previous: ["fs.read", "cli.run"],
            next: [],
        },
        ticketSkillPackChange: {
            previous: ["pack.audit"],
            next: [],
        },
        budgetObservations: [
            "budget.observe=manual_review",
        ],
    });
});
(0, node_test_1.default)("mission approval approve reconstruit la queue depuis le journal quand les projections sont corrompues", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-rebuild-before-resolve-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval } = await openApprovalForTicket(rootDir, mission.id, ticketId);
    const approvalQueuePath = node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.writeFile)(approvalQueuePath, "{corrupted", "utf8");
    await (0, promises_1.writeFile)(resumeViewPath, "{corrupted", "utf8");
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
    ]);
    const queueAfter = await readApprovalQueueProjection(rootDir);
    const resumeViewAfter = await readJson(resumeViewPath);
    strict_1.default.equal(approveResult.exitCode, 0);
    strict_1.default.deepEqual(queueAfter.approvals, []);
    strict_1.default.deepEqual(resumeViewAfter.resume?.pendingApprovals, []);
    strict_1.default.equal(resumeViewAfter.resume?.status, "ready");
});
(0, node_test_1.default)("mission approval detecte deterministiquement approval inconnue puis deja resolue sans muter mission, ticket ou attempt", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-deterministic-errors-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
    const missionBefore = await readMission(rootDir, mission.id);
    const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
    const attemptBefore = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const journalBefore = await readJournal(rootDir);
    const unknownResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        "approval_unknown",
    ]);
    strict_1.default.equal(unknownResult.exitCode, 1);
    strict_1.default.equal(unknownResult.lines.at(-1), `Validation introuvable dans la mission \`${mission.id}\`: \`approval_unknown\`.`);
    strict_1.default.deepEqual(await readMission(rootDir, mission.id), missionBefore);
    strict_1.default.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
    strict_1.default.deepEqual(await readAttempt(rootDir, mission.id, ticketId, attemptId), attemptBefore);
    strict_1.default.equal((await readJournal(rootDir)).length, journalBefore.length);
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
    ]);
    strict_1.default.equal(approveResult.exitCode, 0);
    const journalAfterApprove = await readJournal(rootDir);
    const missionAfterApprove = await readMission(rootDir, mission.id);
    const ticketAfterApprove = await readTicket(rootDir, mission.id, ticketId);
    const attemptAfterApprove = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const terminalResult = await runCommand([
        "mission",
        "approval",
        "defer",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
    ]);
    strict_1.default.equal(terminalResult.exitCode, 1);
    strict_1.default.equal(terminalResult.lines.at(-1), `La validation \`${approval.approvalId}\` est deja resolue (statut: approved).`);
    strict_1.default.deepEqual(await readMission(rootDir, mission.id), missionAfterApprove);
    strict_1.default.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketAfterApprove);
    strict_1.default.deepEqual(await readAttempt(rootDir, mission.id, ticketId, attemptId), attemptAfterApprove);
    strict_1.default.equal((await readJournal(rootDir)).length, journalAfterApprove.length);
});
(0, node_test_1.default)("mission approval conserve les autres approvals pending et laisse la mission en awaiting_approval", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-multi-approval-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const firstTicketId = await createTicket(rootDir, mission.id, {
        goal: "Premiere action sensible",
        owner: "agent_alpha",
    });
    const secondTicketId = await createTicket(rootDir, mission.id, {
        goal: "Seconde action sensible",
        owner: "agent_beta",
    });
    const firstApproval = await openApprovalForTicket(rootDir, mission.id, firstTicketId);
    const secondApproval = await seedPendingApproval(rootDir, mission.id, secondTicketId, "secondary");
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        firstApproval.approval.approvalId,
    ]);
    const missionAfter = await readMission(rootDir, mission.id);
    const queueAfter = await readApprovalQueueProjection(rootDir);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(approveResult.exitCode, 0);
    strict_1.default.equal(missionAfter.status, "awaiting_approval");
    strict_1.default.deepEqual(queueAfter.approvals.map((entry) => entry.approvalId), [secondApproval.approvalId]);
    strict_1.default.doesNotMatch(resumeResult.lines.join("\n"), new RegExp(firstApproval.approval.approvalId));
    strict_1.default.match(resumeResult.lines.join("\n"), new RegExp(secondApproval.approvalId));
});
(0, node_test_1.default)("mission approval passe la mission en running s'il reste une autre tentative active sans approval pending", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-running-after-resolve-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const approvalTicketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket avec approval",
        owner: "agent_alpha",
    });
    const runningTicketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket deja relance",
        owner: "agent_beta",
        allowedCapabilities: ["fs.read"],
        skillPackRefs: [],
    });
    const openedApproval = await openApprovalForTicket(rootDir, mission.id, approvalTicketId);
    await seedActiveAttempt(rootDir, mission.id, runningTicketId, "parallel");
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        openedApproval.approval.approvalId,
    ]);
    const missionAfter = await readMission(rootDir, mission.id);
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(approveResult.exitCode, 0);
    strict_1.default.equal(missionAfter.status, "running");
    strict_1.default.match(statusResult.lines.join("\n"), /Statut: running/);
});
(0, node_test_1.default)("mission approval detecte deterministiquement une tentative introuvable sans mutation", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-attempt-not-found-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
    const missionBefore = await readMission(rootDir, mission.id);
    const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
    const journalBefore = await readJournal(rootDir);
    const attemptPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "attempts", attemptId, "attempt.json");
    await (0, promises_1.rm)(attemptPath);
    const result = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Tentative introuvable pour la validation \`${approval.approvalId}\`: \`${attemptId}\`.`);
    strict_1.default.deepEqual(await readMission(rootDir, mission.id), missionBefore);
    strict_1.default.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
    strict_1.default.equal((await readJournal(rootDir)).length, journalBefore.length);
});
(0, node_test_1.default)("mission approval detecte deterministiquement une tentative non en attente d'approbation sans mutation", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-attempt-wrong-status-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
    const missionBefore = await readMission(rootDir, mission.id);
    const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
    const journalBefore = await readJournal(rootDir);
    const attemptPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "attempts", attemptId, "attempt.json");
    const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    await (0, promises_1.writeFile)(attemptPath, JSON.stringify({ ...attempt, status: "running" }), "utf8");
    const result = await runCommand([
        "mission",
        "approval",
        "reject",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `La validation \`${approval.approvalId}\` ne peut pas etre resolue car la tentative \`${attemptId}\` n'est plus en attente d'approbation.`);
    strict_1.default.deepEqual(await readMission(rootDir, mission.id), missionBefore);
    strict_1.default.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
    strict_1.default.equal((await readJournal(rootDir)).length, journalBefore.length);
});
