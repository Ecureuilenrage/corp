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
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
async function bootstrapWorkspace(rootDir) {
    const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 0);
}
async function createMission(rootDir) {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission audit",
        "--objective",
        "Lire le journal comme une chronologie structuree",
        "--success-criterion",
        "La timeline reste lisible",
        "--success-criterion",
        "Les corrrelations restent auditables",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", line.slice("Mission creee: ".length), "mission.json"));
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
        "Produire une sortie et passer par une validation",
        "--owner",
        "agent_audit",
        "--success-criterion",
        "Une sortie est disponible",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return line.slice("Ticket cree: ".length);
}
async function prepareMissionWithAuditTimeline(rootDir) {
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_audit_approval",
                    pollCursor: "cursor_audit_approval",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation critique",
                    actionType: "workspace_write",
                    actionSummary: "Modifier README.md",
                    guardrails: ["manual_review: workspace_write"],
                },
            }),
        }),
    });
    const firstRunResult = await runCommand([
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
    strict_1.default.equal(firstRunResult.exitCode, 0);
    const approvalQueue = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    const approvalId = approvalQueue.approvals[0]?.approvalId;
    strict_1.default.ok(approvalId, "une approbation doit exister");
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approvalId,
        "--reason",
        "Validation operateur",
    ]);
    strict_1.default.equal(approveResult.exitCode, 0);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "completed",
                adapterState: {
                    responseId: "resp_audit_completed",
                    pollCursor: "cursor_audit_completed",
                    vendorStatus: "completed",
                },
                outputs: [
                    {
                        kind: "text",
                        title: "Synthese operateur",
                        label: "synthese",
                        mediaType: "text/plain",
                        text: "Une synthese borne pour l'operateur.",
                        summary: "Synthese finale du run.",
                    },
                ],
            }),
        }),
    });
    const secondRunResult = await runCommand([
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
    strict_1.default.equal(secondRunResult.exitCode, 0);
    const pauseResult = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const relaunchResult = await runCommand([
        "mission",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(pauseResult.exitCode, 0);
    strict_1.default.equal(relaunchResult.exitCode, 0);
    const journal = await readJournal(rootDir);
    const approvalEvent = journal.find((event) => event.type === "approval.requested");
    const artifactEvent = [...journal].reverse().find((event) => event.type === "artifact.registered");
    const artifactIndex = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"));
    const artifactId = artifactIndex.artifacts.at(-1)?.artifactId;
    strict_1.default.ok(approvalEvent, "approval.requested doit exister");
    strict_1.default.ok(artifactEvent, "artifact.registered doit exister");
    strict_1.default.ok(artifactId, "un artefact doit etre disponible");
    return {
        missionId: mission.id,
        ticketId,
        approvalId,
        approvalEventId: approvalEvent.eventId,
        artifactId,
        artifactEventId: artifactEvent.eventId,
    };
}
(0, node_test_1.default)("mission audit expose une timeline mission-centrique structuree, filtrable et sans fuite vendor", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-audit-flow-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const prepared = await prepareMissionWithAuditTimeline(rootDir);
    const result = await runCommand([
        "mission",
        "audit",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
    ]);
    const output = result.lines.join("\n");
    const auditLogRaw = await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "projections", "audit-log.json"), "utf8");
    const auditLog = JSON.parse(auditLogRaw);
    const executionCompletedEntry = auditLog.entries.find((entry) => entry.eventType === "execution.completed");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, new RegExp(`Mission: ${prepared.missionId}`));
    strict_1.default.match(output, /Journal d'audit:/);
    strict_1.default.match(output, /Mission creee/);
    strict_1.default.match(output, /Ticket cree/);
    strict_1.default.match(output, /Isolation creee/);
    strict_1.default.match(output, /Execution demandee/);
    strict_1.default.match(output, /Ticket en cours/);
    strict_1.default.match(output, /Validation critique/);
    strict_1.default.match(output, /Validation approuvee/);
    strict_1.default.match(output, /Artefact enregistre/);
    strict_1.default.match(output, /Mission mise en pause/);
    strict_1.default.match(output, /Mission relancee/);
    strict_1.default.ok(executionCompletedEntry);
    strict_1.default.equal(executionCompletedEntry.ticketId, prepared.ticketId);
    strict_1.default.equal(executionCompletedEntry.ticketOwner, "agent_audit");
    strict_1.default.equal(executionCompletedEntry.source, "execution-adapter");
    strict_1.default.deepEqual(executionCompletedEntry.relatedArtifactIds, [prepared.artifactId]);
    strict_1.default.deepEqual(auditLog.entries.map((entry) => `${entry.occurredAt}|${entry.eventId}`), [...auditLog.entries.map((entry) => `${entry.occurredAt}|${entry.eventId}`)].sort((left, right) => left.localeCompare(right)));
    for (const candidate of [output, auditLogRaw]) {
        strict_1.default.doesNotMatch(candidate, /resp_audit_approval|cursor_audit_approval|resp_audit_completed|cursor_audit_completed|vendorStatus|pollCursor|threadId|adapterState/i);
    }
    const filteredResult = await runCommand([
        "mission",
        "audit",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
        "--ticket-id",
        prepared.ticketId,
        "--limit",
        "2",
    ]);
    const filteredOutput = filteredResult.lines.join("\n");
    strict_1.default.equal(filteredResult.exitCode, 0);
    strict_1.default.match(filteredOutput, /Artefact detecte/);
    strict_1.default.match(filteredOutput, /Artefact enregistre/);
    strict_1.default.doesNotMatch(filteredOutput, /Mission creee/);
});
(0, node_test_1.default)("mission audit reconstruit audit-log quand la projection manque ou est corrompue sans muter le journal", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-audit-rebuild-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const prepared = await prepareMissionWithAuditTimeline(rootDir);
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const auditLogPath = node_path_1.default.join(rootDir, ".corp", "projections", "audit-log.json");
    const journalBeforeRead = await (0, promises_1.readFile)(journalPath, "utf8");
    await (0, promises_1.unlink)(auditLogPath);
    const listAfterDelete = await runCommand([
        "mission",
        "audit",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
    ]);
    strict_1.default.equal(listAfterDelete.exitCode, 0);
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), journalBeforeRead);
    await (0, promises_1.writeFile)(auditLogPath, "{corrupted", "utf8");
    const showAfterCorruption = await runCommand([
        "mission",
        "audit",
        "show",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
        "--event-id",
        prepared.approvalEventId,
    ]);
    const rebuiltProjection = await readJson(auditLogPath);
    strict_1.default.equal(showAfterCorruption.exitCode, 0);
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), journalBeforeRead);
    strict_1.default.ok(rebuiltProjection.entries.some((entry) => entry.eventId === prepared.approvalEventId));
    strict_1.default.ok(rebuiltProjection.entries.some((entry) => entry.eventId === prepared.artifactEventId));
});
(0, node_test_1.default)("mission audit show renvoie un detail lisible et correle pour un evenement precis", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-audit-show-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const prepared = await prepareMissionWithAuditTimeline(rootDir);
    const result = await runCommand([
        "mission",
        "audit",
        "show",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
        "--event-id",
        prepared.approvalEventId,
    ]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, new RegExp(`Mission: ${prepared.missionId}`));
    strict_1.default.match(output, new RegExp(`Evenement: ${prepared.approvalEventId}`));
    strict_1.default.match(output, /Type: approval.requested/);
    strict_1.default.match(output, new RegExp(`Ticket: ${prepared.ticketId}`));
    strict_1.default.match(output, /Owner ticket: agent_audit/);
    strict_1.default.match(output, new RegExp(`Tentative: attempt_`));
    strict_1.default.match(output, new RegExp(`Approval: ${prepared.approvalId}`));
    strict_1.default.match(output, /Acteur: adapter/);
    strict_1.default.match(output, /Source: execution-adapter/);
    strict_1.default.match(output, /Details:/);
    strict_1.default.match(output, /Action: workspace_write/);
    strict_1.default.match(output, /Resume action: Modifier README\.md/);
    strict_1.default.match(output, /Garde-fous: manual_review: workspace_write/);
    strict_1.default.doesNotMatch(output, /resp_audit_approval|cursor_audit_approval|resp_audit_completed|cursor_audit_completed|vendorStatus|pollCursor|threadId|adapterState/i);
});
