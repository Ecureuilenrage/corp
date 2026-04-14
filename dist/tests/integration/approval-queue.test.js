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
async function createMission(rootDir, title = "Mission approvals") {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Ouvrir une file d'approbation durable",
        "--success-criterion",
        "La file est journalisee",
        "--success-criterion",
        "Le resume reste coherent",
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
            allowedCapabilities: [],
            skillPackRefs: ["pack.audit"],
        },
    }, null, 2)}\n`, "utf8");
    return readMission(rootDir, mission.id);
}
async function createTicket(rootDir, missionId) {
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
        "Executer une action sensible",
        "--owner",
        "agent_sensitive",
        "--success-criterion",
        "L'action sensible est decrite",
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        "cli.run",
        "--skill-pack",
        "pack.audit",
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
async function openApprovalFlow(rootDir) {
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_approval_123",
                    pollCursor: "cursor_approval_1",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation requise pour une action sensible",
                    actionType: "workspace_write",
                    actionSummary: "Modification de README.md dans le workspace isole",
                    guardrails: ["manual_review: workspace_write"],
                    relatedArtifactIds: ["artifact_hint_1"],
                },
            }),
        }),
    });
    await registerTestSkillPack(rootDir, "pack.audit");
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
        "--background",
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
    strict_1.default.ok(attemptLine, "la commande doit annoncer l'attempt ouverte");
    return {
        mission,
        ticketId,
        attemptId: attemptLine.slice("Tentative ouverte: ".length),
    };
}
(0, node_test_1.default)("mission ticket run materialise approval.requested, persiste la queue et alimente les vues operateur", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-queue-flow-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const { mission, ticketId, attemptId } = await openApprovalFlow(rootDir);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const journal = await readJournal(rootDir);
    const approvalQueueProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    const approvalEvent = journal.at(-1);
    const relatedRuntimeEvent = journal.at(-2);
    const approval = (approvalEvent?.payload).approval;
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
    const approvalQueueRaw = await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"), "utf8");
    strict_1.default.equal(updatedMission.status, "awaiting_approval");
    strict_1.default.equal(updatedTicket.status, "awaiting_approval");
    strict_1.default.equal(attempt.status, "awaiting_approval");
    strict_1.default.equal(attempt.backgroundRequested, true);
    strict_1.default.deepEqual(updatedTicket.executionHandle.adapterState, {
        responseId: "resp_approval_123",
        pollCursor: "cursor_approval_1",
        vendorStatus: "requires_approval",
    });
    strict_1.default.deepEqual(attempt.adapterState, updatedTicket.executionHandle.adapterState);
    strict_1.default.deepEqual(journal.map((event) => event.type), [
        "mission.created",
        "ticket.created",
        "workspace.isolation_created",
        "ticket.claimed",
        "execution.requested",
        "skill_pack.used",
        "approval.requested",
    ]);
    strict_1.default.equal(approvalEvent?.type, "approval.requested");
    strict_1.default.ok(approval);
    strict_1.default.match(approval.approvalId, /^approval_/);
    strict_1.default.equal(approval.missionId, mission.id);
    strict_1.default.equal(approval.ticketId, ticketId);
    strict_1.default.equal(approval.attemptId, attemptId);
    strict_1.default.equal(approval.status, "requested");
    strict_1.default.equal(approval.title, "Validation requise pour une action sensible");
    strict_1.default.equal(approval.actionType, "workspace_write");
    strict_1.default.equal(approval.actionSummary, "Modification de README.md dans le workspace isole");
    strict_1.default.deepEqual(approval.guardrails, [
        "manual_review: workspace_write",
        "policy_profile: policy_profile_local",
        "allowed_capabilities: fs.read, cli.run",
        "skill_packs: pack.audit",
    ]);
    strict_1.default.ok(relatedRuntimeEvent);
    strict_1.default.deepEqual(approval.relatedEventIds, [relatedRuntimeEvent.eventId]);
    strict_1.default.deepEqual(approval.relatedArtifactIds, ["artifact_hint_1"]);
    strict_1.default.equal(approval.createdAt, approval.updatedAt);
    strict_1.default.deepEqual(approvalQueueProjection, {
        schemaVersion: 1,
        approvals: [approval],
    });
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.equal(queueResult.exitCode, 0);
    strict_1.default.match(statusResult.lines.join("\n"), new RegExp(`Validations en attente: ${approval.approvalId}`));
    strict_1.default.match(resumeResult.lines.join("\n"), /Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation requise pour une action sensible\./);
    strict_1.default.match(queueResult.lines.join("\n"), new RegExp(`Mission: ${mission.id}`));
    strict_1.default.match(queueResult.lines.join("\n"), new RegExp(`${approval.approvalId} \\| ticket=${ticketId} \\| attempt=${attemptId} \\| statut=requested`));
    strict_1.default.match(queueResult.lines.join("\n"), /action=workspace_write \| resume=Modification de README\.md dans le workspace isole/);
    strict_1.default.match(queueResult.lines.join("\n"), /garde-fous=manual_review: workspace_write ; policy_profile: policy_profile_local ; allowed_capabilities: fs\.read, cli\.run ; skill_packs: pack\.audit/);
    strict_1.default.match(queueResult.lines.join("\n"), /evenements=event_/);
    strict_1.default.match(queueResult.lines.join("\n"), /artefacts=artifact_hint_1/);
    for (const output of [
        statusResult.lines.join("\n"),
        resumeResult.lines.join("\n"),
        queueResult.lines.join("\n"),
        approvalQueueRaw,
    ]) {
        strict_1.default.doesNotMatch(output, /resp_approval_123|cursor_approval_1|vendorStatus|requires_approval/i);
    }
});
(0, node_test_1.default)("mission approval queue reconstruit approval-queue et resynchronise resume-view si la projection manque ou est corrompue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-queue-rebuild-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const { mission } = await openApprovalFlow(rootDir);
    const approvalQueuePath = node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const initialQueue = await readJson(approvalQueuePath);
    const approvalId = initialQueue.approvals[0]?.approvalId;
    strict_1.default.ok(approvalId, "une approbation doit etre disponible pour la reconstruction");
    for (const scenario of ["missing", "corrupted"]) {
        await (0, promises_1.writeFile)(resumeViewPath, JSON.stringify({
            schemaVersion: 1,
            resume: {
                missionId: mission.id,
                title: mission.title,
                objective: mission.objective,
                status: "awaiting_approval",
                successCriteria: [...mission.successCriteria],
                openTickets: [],
                pendingApprovals: [],
                lastRelevantArtifact: null,
                lastEventId: mission.resumeCursor,
                updatedAt: mission.updatedAt,
                nextOperatorAction: "Obsolete",
            },
        }, null, 2), "utf8");
        if (scenario === "missing") {
            await (0, promises_1.unlink)(approvalQueuePath);
        }
        else {
            await (0, promises_1.writeFile)(approvalQueuePath, "{corrupted", "utf8");
        }
        await (0, promises_1.writeFile)(missionStatusPath, "{corrupted", "utf8");
        const queueResult = await runCommand([
            "mission",
            "approval",
            "queue",
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
        ]);
        const rebuiltQueue = await readJson(approvalQueuePath);
        const rebuiltResumeViewAfterQueue = await readJson(resumeViewPath);
        strict_1.default.equal(queueResult.exitCode, 0);
        strict_1.default.equal(rebuiltQueue.approvals[0]?.approvalId, approvalId);
        strict_1.default.equal(rebuiltResumeViewAfterQueue.resume.pendingApprovals[0]?.approvalId, approvalId, `resume-view.json doit etre resynchronise par approval queue seul (scenario=${scenario})`);
        strict_1.default.equal(rebuiltResumeViewAfterQueue.resume.nextOperatorAction, "Arbitrez la prochaine validation en attente: Validation requise pour une action sensible.");
        strict_1.default.match(queueResult.lines.join("\n"), new RegExp(approvalId));
        const resumeResult = await runCommand([
            "mission",
            "resume",
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
        ]);
        strict_1.default.equal(resumeResult.exitCode, 0);
        strict_1.default.match(resumeResult.lines.join("\n"), /Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation requise pour une action sensible\./);
    }
});
(0, node_test_1.default)("mission ticket run foreground avec awaiting_approval emet ticket.in_progress avant approval.requested", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-queue-foreground-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_fg_approval",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation foreground",
                    actionType: "workspace_write",
                    actionSummary: "Ecriture sensible en mode foreground",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    await registerTestSkillPack(rootDir, "pack.audit");
    const mission = await createMission(rootDir, "Mission foreground approval");
    const ticketId = await createTicket(rootDir, mission.id);
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    const journal = await readJournal(rootDir);
    const eventTypes = journal.map((event) => event.type);
    strict_1.default.deepEqual(eventTypes, [
        "mission.created",
        "ticket.created",
        "workspace.isolation_created",
        "ticket.claimed",
        "execution.requested",
        "skill_pack.used",
        "ticket.in_progress",
        "approval.requested",
    ]);
    const approvalEvent = journal.at(-1);
    const approval = (approvalEvent?.payload).approval;
    strict_1.default.ok(approval);
    strict_1.default.equal(approval.status, "requested");
    strict_1.default.equal(approval.title, "Validation foreground");
    strict_1.default.equal(approval.missionId, mission.id);
    strict_1.default.equal(approval.ticketId, ticketId);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
    strict_1.default.ok(attemptLine);
    const attemptId = attemptLine.slice("Tentative ouverte: ".length);
    const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    strict_1.default.equal(updatedMission.status, "awaiting_approval");
    strict_1.default.equal(updatedTicket.status, "awaiting_approval");
    strict_1.default.equal(attempt.status, "awaiting_approval");
    strict_1.default.equal(attempt.backgroundRequested, false);
    for (const output of [
        runResult.lines.join("\n"),
    ]) {
        strict_1.default.doesNotMatch(output, /resp_fg_approval|vendorStatus|requires_approval/i);
    }
});
(0, node_test_1.default)("mission status et mission resume ignorent un mission-status.json stale quand le journal indique awaiting_approval", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-queue-stale-status-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const { mission } = await openApprovalFlow(rootDir);
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const staleMissionStatus = await readJson(missionStatusPath);
    staleMissionStatus.mission.status = "ready";
    await (0, promises_1.writeFile)(missionStatusPath, JSON.stringify(staleMissionStatus, null, 2), "utf8");
    for (const commandName of ["status", "resume"]) {
        const result = await runCommand([
            "mission",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
        ]);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, /Statut: awaiting_approval/);
        strict_1.default.doesNotMatch(output, /Statut: ready/);
        strict_1.default.match(output, /Prochain arbitrage utile: Arbitrez la prochaine validation en attente/);
    }
});
