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
const codex_responses_adapter_1 = require("../../packages/execution-adapters/codex-responses/src/codex-responses-adapter");
const run_ticket_1 = require("../../packages/ticket-runtime/src/ticket-service/run-ticket");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const workspace_isolation_1 = require("../../packages/workspace-isolation/src/workspace-isolation");
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
async function createMission(rootDir, title = "Mission execution") {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Orchestrer une execution isolee",
        "--success-criterion",
        "Le ticket est executable",
        "--success-criterion",
        "Le resume reste fiable",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return readMission(rootDir, line.slice("Mission creee: ".length));
}
async function createTicket(rootDir, missionId, extraArgs = []) {
    return runCommand([
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
        "Livrer le ticket runnable",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est executable",
        ...extraArgs,
    ]);
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
(0, node_test_1.default)("mission ticket run foreground cree une isolation dediee, persiste l'attempt et termine le ticket", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-foreground-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async () => ({
                status: "completed",
                adapterState: {
                    responseId: "resp_foreground_123",
                    pollCursor: "cursor_foreground_1",
                    sequenceNumber: 7,
                    vendorStatus: "completed",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    await (0, promises_1.writeFile)(node_path_1.default.join(rootDir, "workspace.txt"), "workspace racine\n", "utf8");
    const mission = await createMission(rootDir);
    const ticketCreateResult = await createTicket(rootDir, mission.id);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store");
    const originalWriteProjectionSnapshot = projectionStoreModule.writeProjectionSnapshot;
    const projectionWrites = [];
    projectionStoreModule.writeProjectionSnapshot = async (...args) => {
        projectionWrites.push(args[1]);
        return originalWriteProjectionSnapshot(...args);
    };
    t.after(() => {
        projectionStoreModule.writeProjectionSnapshot = originalWriteProjectionSnapshot;
    });
    const approvalQueueBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "approval-queue.json"), "utf8");
    const artifactIndexBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "artifact-index.json"), "utf8");
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
    const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
    strict_1.default.ok(attemptLine, "la commande doit annoncer l'attempt ouverte");
    const attemptId = attemptLine.slice("Tentative ouverte: ".length);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const journal = await readJournal(rootDir);
    const missionStatusProjection = await readJson(node_path_1.default.join(layout.projectionsDir, "mission-status.json"));
    const ticketBoardProjection = await readJson(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"));
    const isolationPath = node_path_1.default.join(layout.isolationsDir, updatedTicket.workspaceIsolationId ?? "missing", "isolation.json");
    const isolation = await readJson(isolationPath);
    strict_1.default.equal(updatedMission.status, "ready");
    strict_1.default.equal(updatedTicket.status, "done");
    strict_1.default.equal(updatedTicket.executionHandle.adapter, "codex_exec");
    strict_1.default.deepEqual(updatedTicket.executionHandle.adapterState, {
        responseId: "resp_foreground_123",
        pollCursor: "cursor_foreground_1",
        sequenceNumber: 7,
        vendorStatus: "completed",
    });
    strict_1.default.ok(updatedTicket.workspaceIsolationId);
    strict_1.default.equal(updatedTicket.workspaceIsolationId, attempt.workspaceIsolationId);
    strict_1.default.equal(attempt.id, attemptId);
    strict_1.default.equal(attempt.ticketId, ticketId);
    strict_1.default.equal(attempt.adapter, "codex_exec");
    strict_1.default.equal(attempt.status, "completed");
    strict_1.default.equal(attempt.backgroundRequested, false);
    strict_1.default.equal(attempt.workspaceIsolationId, updatedTicket.workspaceIsolationId);
    strict_1.default.deepEqual(attempt.adapterState, updatedTicket.executionHandle.adapterState);
    strict_1.default.equal(typeof attempt.startedAt, "string");
    strict_1.default.equal(typeof attempt.endedAt, "string");
    strict_1.default.equal(isolation.workspaceIsolationId, updatedTicket.workspaceIsolationId);
    strict_1.default.equal(isolation.kind, "workspace_copy");
    strict_1.default.equal(isolation.sourceRoot, rootDir);
    strict_1.default.equal(isolation.retained, true);
    await (0, promises_1.access)(node_path_1.default.join(isolation.workspacePath, "workspace.txt"));
    await strict_1.default.rejects((0, promises_1.access)(node_path_1.default.join(isolation.workspacePath, ".corp")), /ENOENT/);
    strict_1.default.deepEqual(journal.map((event) => event.type), [
        "mission.created",
        "ticket.created",
        "workspace.isolation_created",
        "ticket.claimed",
        "execution.requested",
        "ticket.in_progress",
        "execution.completed",
    ]);
    strict_1.default.equal(journal.at(-1)?.attemptId, attemptId);
    strict_1.default.deepEqual(updatedMission.eventIds, journal.map((event) => event.eventId));
    strict_1.default.deepEqual(updatedTicket.eventIds, journal.filter((event) => event.ticketId === ticketId).map((event) => event.eventId));
    strict_1.default.equal(updatedMission.resumeCursor, journal.at(-1)?.eventId);
    strict_1.default.equal(updatedMission.updatedAt, journal.at(-1)?.occurredAt);
    strict_1.default.equal(updatedTicket.updatedAt, journal.at(-1)?.occurredAt);
    strict_1.default.deepEqual(missionStatusProjection, {
        schemaVersion: 1,
        mission: updatedMission,
    });
    strict_1.default.deepEqual(ticketBoardProjection, {
        schemaVersion: 1,
        tickets: [
            {
                ticketId,
                missionId: mission.id,
                title: "Livrer le ticket runnable",
                status: "done",
                owner: "agent_dev",
                kind: "implement",
                dependsOn: [],
                allowedCapabilities: [],
                skillPackRefs: [],
                usedCapabilities: [],
                usedSkillPacks: [],
                planOrder: 0,
                runnable: false,
                blockedByTicketIds: [],
                planningState: "not_runnable_status",
                dependencyStatuses: [],
                trackingState: "done",
                statusReasonCode: "ticket_done",
                blockingReasonCode: null,
                activeAttemptId: null,
                activeAttemptStatus: null,
                lastAttemptId: attemptId,
                lastAttemptStatus: "completed",
                lastAttemptStartedAt: attempt.startedAt,
                lastAttemptEndedAt: attempt.endedAt,
                lastAttemptBackgroundRequested: false,
                lastAttemptWorkspaceIsolationId: updatedTicket.workspaceIsolationId,
                updatedAt: updatedTicket.updatedAt,
            },
        ],
    });
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "approval-queue.json"), "utf8"), approvalQueueBefore);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "artifact-index.json"), "utf8"), artifactIndexBefore);
    strict_1.default.deepEqual(projectionWrites, [
        "mission-status",
        "ticket-board",
        "artifact-index",
        "audit-log",
        "resume-view",
        "mission-status",
        "ticket-board",
        "artifact-index",
        "audit-log",
        "resume-view",
    ]);
    const output = runResult.lines.join("\n");
    strict_1.default.match(output, new RegExp(`Tentative ouverte: ${attemptId}`));
    strict_1.default.match(output, /Tickets ouverts: aucun/);
    strict_1.default.doesNotMatch(output, /resp_foreground_123|cursor_foreground_1|vendorStatus/i);
});
(0, node_test_1.default)("mission ticket run foreground avec trois artefacts ne reecrit les projections qu'en fin de run puis une seule fois pour le batch artefacts", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-artifact-batch-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "completed",
                adapterState: {
                    responseId: "resp_batching_123",
                    pollCursor: "cursor_batching_1",
                    sequenceNumber: 4,
                    vendorStatus: "completed",
                },
                outputs: [
                    {
                        kind: "text",
                        title: "Synthese run",
                        label: "resume",
                        mediaType: "text/plain",
                        text: "Une sortie texte utile pour le diagnostic.",
                        summary: "Sortie texte foreground.",
                    },
                    {
                        kind: "structured",
                        title: "Rapport run",
                        label: "rapport",
                        mediaType: "application/json",
                        data: {
                            result: "ok",
                            produced: ["report.txt", "report.json"],
                        },
                        summary: "Sortie JSON foreground.",
                    },
                    {
                        kind: "reference",
                        title: "Pointeur diagnostic",
                        label: "trace",
                        mediaType: "text/plain",
                        path: "logs/run.log",
                        summary: "Pointeur de diagnostic foreground.",
                    },
                ],
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission batching");
    const ticketCreateResult = await createTicket(rootDir, mission.id);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store");
    const originalWriteProjectionSnapshot = projectionStoreModule.writeProjectionSnapshot;
    const projectionWrites = [];
    projectionStoreModule.writeProjectionSnapshot = async (...args) => {
        projectionWrites.push(args[1]);
        return originalWriteProjectionSnapshot(...args);
    };
    t.after(() => {
        projectionStoreModule.writeProjectionSnapshot = originalWriteProjectionSnapshot;
    });
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
    const artifactIndexProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"));
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    strict_1.default.equal(runResult.exitCode, 0);
    strict_1.default.deepEqual(projectionWrites, [
        "mission-status",
        "ticket-board",
        "artifact-index",
        "audit-log",
        "resume-view",
        "mission-status",
        "ticket-board",
        "artifact-index",
        "audit-log",
        "resume-view",
        "mission-status",
        "ticket-board",
        "artifact-index",
        "audit-log",
        "resume-view",
    ]);
    strict_1.default.equal(Array.isArray(artifactIndexProjection.artifacts)
        ? artifactIndexProjection.artifacts.length
        : 0, 3);
    strict_1.default.equal(updatedMission.artifactIds.length, 3);
    strict_1.default.equal(updatedTicket.artifactIds.length, 3);
});
(0, node_test_1.default)("mission ticket run background normalise l'etat vendor sans fuite hors adapterState", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-background-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "requested",
                adapterState: {
                    responseId: "resp_background_123",
                    pollCursor: "cursor_background_1",
                    sequenceNumber: 3,
                    vendorStatus: "queued",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketCreateResult = await createTicket(rootDir, mission.id);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
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
    const attemptId = String(runResult.lines.find((line) => line.startsWith("Tentative ouverte: "))?.slice("Tentative ouverte: ".length));
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const journal = await readJournal(rootDir);
    const ticketBoardProjection = await readJson(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"));
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(updatedMission.status, "running");
    strict_1.default.equal(updatedTicket.status, "in_progress");
    strict_1.default.equal(attempt.status, "requested");
    strict_1.default.equal(attempt.backgroundRequested, true);
    strict_1.default.deepEqual(attempt.adapterState, {
        responseId: "resp_background_123",
        pollCursor: "cursor_background_1",
        sequenceNumber: 3,
        vendorStatus: "queued",
    });
    strict_1.default.deepEqual(updatedTicket.executionHandle.adapterState, attempt.adapterState);
    strict_1.default.deepEqual(journal.map((event) => event.type), [
        "mission.created",
        "ticket.created",
        "workspace.isolation_created",
        "ticket.claimed",
        "execution.requested",
        "ticket.in_progress",
        "execution.background_started",
    ]);
    strict_1.default.equal(journal.at(-1)?.attemptId, attemptId);
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.status, "in_progress");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.planningState, "not_runnable_status");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.trackingState, "active");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.statusReasonCode, "ticket_in_progress");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.activeAttemptId, attemptId);
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.activeAttemptStatus, "requested");
    strict_1.default.match(statusResult.lines.join("\n"), /Statut: running/);
    strict_1.default.match(statusResult.lines.join("\n"), /Prochain arbitrage utile: Suivez le ticket en cours: Livrer le ticket runnable\./);
    strict_1.default.doesNotMatch(JSON.stringify(updatedMission), /resp_background_123|queued/);
    strict_1.default.doesNotMatch(JSON.stringify(ticketBoardProjection), /resp_background_123|queued/);
    strict_1.default.doesNotMatch(runResult.lines.join("\n"), /resp_background_123|queued/);
});
(0, node_test_1.default)("mission ticket run foreground distingue une annulation adapteur d'un echec", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-cancelled-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "cancelled",
                adapterState: {
                    responseId: "resp_cancelled_123",
                    vendorStatus: "cancelled",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission cancelled");
    const ticketCreateResult = await createTicket(rootDir, mission.id);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
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
    const attemptId = String(runResult.lines.find((line) => line.startsWith("Tentative ouverte: "))?.slice("Tentative ouverte: ".length));
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
    const journal = await readJournal(rootDir);
    const ticketBoardProjection = await readJson(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"));
    strict_1.default.equal(updatedMission.status, "ready");
    strict_1.default.equal(updatedTicket.status, "cancelled");
    strict_1.default.equal(attempt.status, "cancelled");
    strict_1.default.deepEqual(journal.map((event) => event.type), [
        "mission.created",
        "ticket.created",
        "workspace.isolation_created",
        "ticket.claimed",
        "execution.requested",
        "ticket.in_progress",
        "execution.cancelled",
    ]);
    strict_1.default.equal(journal.at(-1)?.attemptId, attemptId);
    strict_1.default.equal(journal.at(-1)?.type, "execution.cancelled");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.status, "cancelled");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.trackingState, "cancelled");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.lastAttemptStatus, "cancelled");
    strict_1.default.equal(ticketBoardProjection.tickets[0]?.activeAttemptId, null);
});
(0, node_test_1.default)("mission ticket run garde la mission en running si une autre tentative reste active lors d'un echec adapteur", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-failed-with-active-peer-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async ({ background }) => {
                if (background) {
                    return {
                        status: "running",
                        adapterState: {
                            responseId: "resp_other_active",
                            pollCursor: "cursor_other_active",
                            vendorStatus: "in_progress",
                        },
                    };
                }
                throw new Error("adapter boom");
            },
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission active peer");
    const firstTicketCreateResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Ticket deja actif",
    ]);
    const secondTicketCreateResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Ticket qui echoue",
        "--owner",
        "agent_second",
    ]);
    strict_1.default.equal(firstTicketCreateResult.exitCode, 0);
    strict_1.default.equal(secondTicketCreateResult.exitCode, 0);
    const firstTicketId = String(firstTicketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const secondTicketId = String(secondTicketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const firstRun = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        firstTicketId,
        "--background",
    ]);
    strict_1.default.equal(firstRun.exitCode, 0);
    const secondRun = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        secondTicketId,
    ]);
    strict_1.default.equal(secondRun.exitCode, 1);
    strict_1.default.equal(secondRun.lines.at(-1), "adapter boom");
    const updatedMission = await readMission(rootDir, mission.id);
    const activeTicket = await readTicket(rootDir, mission.id, firstTicketId);
    const failedTicket = await readTicket(rootDir, mission.id, secondTicketId);
    const secondTicketAttemptsDir = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", secondTicketId, "attempts");
    const failedAttemptIds = await (0, promises_1.readdir)(secondTicketAttemptsDir);
    const failedAttemptId = failedAttemptIds[0];
    strict_1.default.ok(failedAttemptId, "une tentative failed doit etre persistee");
    const failedAttempt = await readAttempt(rootDir, mission.id, secondTicketId, failedAttemptId);
    const journal = await readJournal(rootDir);
    const ticketBoardProjection = await readJson(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"));
    strict_1.default.equal(updatedMission.status, "running");
    strict_1.default.equal(activeTicket.status, "in_progress");
    strict_1.default.equal(failedTicket.status, "failed");
    strict_1.default.equal(failedAttempt.status, "failed");
    strict_1.default.equal(journal.at(-1)?.type, "execution.failed");
    strict_1.default.equal((journal.at(-1)?.payload).mission?.status, "running");
    strict_1.default.equal(ticketBoardProjection.tickets.find((entry) => entry.ticketId === firstTicketId)?.activeAttemptStatus, "running");
    strict_1.default.equal(ticketBoardProjection.tickets.find((entry) => entry.ticketId === secondTicketId)?.trackingState, "failed");
});
(0, node_test_1.default)("mission ticket run autorise la relance d'un ticket failed quand la mission est en echec", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-retry-failed-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    let launchCount = 0;
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => {
                launchCount += 1;
                if (launchCount === 1) {
                    throw new Error("adapter boom");
                }
                return {
                    status: "completed",
                    adapterState: {
                        responseId: "resp_retry_failed_ok",
                        pollCursor: "cursor_retry_failed_ok",
                        vendorStatus: "completed",
                    },
                };
            },
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission retry failed");
    const ticketCreateResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Ticket a relancer",
        "--owner",
        "agent_retry",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const firstRun = await runCommand([
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
    strict_1.default.equal(firstRun.exitCode, 1);
    strict_1.default.equal(firstRun.lines.at(-1), "adapter boom");
    const failedMission = await readMission(rootDir, mission.id);
    const failedTicket = await readTicket(rootDir, mission.id, ticketId);
    const boardAfterFailure = await readJson(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"));
    strict_1.default.equal(failedMission.status, "failed");
    strict_1.default.equal(failedTicket.status, "failed");
    strict_1.default.equal(boardAfterFailure.tickets[0]?.ticketId, ticketId);
    strict_1.default.equal(boardAfterFailure.tickets[0]?.trackingState, "failed");
    strict_1.default.equal(boardAfterFailure.tickets[0]?.planningState, "runnable");
    strict_1.default.equal(boardAfterFailure.tickets[0]?.runnable, true);
    const secondRun = await runCommand([
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
    strict_1.default.equal(secondRun.exitCode, 0);
    const secondAttemptLine = secondRun.lines.find((line) => line.startsWith("Tentative ouverte: "));
    strict_1.default.ok(secondAttemptLine, "la relance doit ouvrir une nouvelle tentative");
    const retriedMission = await readMission(rootDir, mission.id);
    const retriedTicket = await readTicket(rootDir, mission.id, ticketId);
    const retriedAttempt = await readAttempt(rootDir, mission.id, ticketId, secondAttemptLine.slice("Tentative ouverte: ".length));
    const attemptsDir = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "attempts");
    const boardAfterRetry = await readJson(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"));
    strict_1.default.equal(launchCount, 2);
    strict_1.default.equal((await (0, promises_1.readdir)(attemptsDir)).length, 2);
    strict_1.default.equal(retriedMission.status, "ready");
    strict_1.default.equal(retriedTicket.status, "done");
    strict_1.default.equal(retriedAttempt.status, "completed");
    strict_1.default.equal(boardAfterRetry.tickets[0]?.status, "done");
    strict_1.default.equal(boardAfterRetry.tickets[0]?.runnable, false);
});
(0, node_test_1.default)("mission ticket run foreground detecte et enregistre les artefacts du workspace avant de propager l'erreur adapteur originale", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-throw-artifacts-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await (0, promises_1.writeFile)(node_path_1.default.join(rootDir, "README.md"), "README initial\n", "utf8");
    const mission = await createMission(rootDir, "Mission artefacts sur throw");
    const ticketCreateResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Ticket qui produit puis throw",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async ({ workspacePath }) => {
                await (0, promises_1.writeFile)(node_path_1.default.join(workspacePath, "README.md"), "README crash\n", "utf8");
                throw new Error("adapter boom");
            },
        }),
    });
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
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(runResult.lines.at(-1), "adapter boom");
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
    const journal = await readJournal(rootDir);
    const artifactIndexProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"));
    strict_1.default.equal(updatedMission.status, "failed");
    strict_1.default.equal(updatedTicket.status, "failed");
    strict_1.default.equal(updatedMission.artifactIds.length, 1);
    strict_1.default.deepEqual(updatedMission.artifactIds, updatedTicket.artifactIds);
    strict_1.default.deepEqual(journal.slice(-3).map((event) => event.type), ["execution.failed", "artifact.detected", "artifact.registered"]);
    strict_1.default.equal(journal.at(-1)?.type, "artifact.registered");
    strict_1.default.equal(artifactIndexProjection.artifacts.length, 1);
    strict_1.default.deepEqual(artifactIndexProjection.artifacts.map((artifact) => ({
        kind: artifact.kind,
        path: artifact.path,
        sourceEventType: artifact.sourceEventType,
    })), [
        {
            kind: "workspace_file",
            path: "README.md",
            sourceEventType: "execution.failed",
        },
    ]);
});
(0, node_test_1.default)("mission ticket run background ne declenche pas la detection d'artefacts avant completion terminale", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-background-artifacts-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const artifactServiceModule = require("../../packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts");
    const originalDetectTicketArtifacts = artifactServiceModule.detectTicketArtifacts;
    let detectCalls = 0;
    artifactServiceModule.detectTicketArtifacts = async (...args) => {
        detectCalls += 1;
        return originalDetectTicketArtifacts(...args);
    };
    t.after(() => {
        artifactServiceModule.detectTicketArtifacts = originalDetectTicketArtifacts;
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "requested",
                adapterState: {
                    responseId: "resp_background_no_artifacts",
                    pollCursor: "cursor_background_no_artifacts",
                    vendorStatus: "queued",
                },
                outputs: [
                    {
                        kind: "text",
                        title: "Sortie qui ne doit pas etre scannee",
                        text: "Le polling terminal decidera plus tard.",
                        mediaType: "text/plain",
                    },
                ],
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission background artifacts");
    const ticketCreateResult = await createTicket(rootDir, mission.id);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const artifactIndexBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "artifact-index.json"), "utf8");
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
    strict_1.default.equal(detectCalls, 0);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "artifact-index.json"), "utf8"), artifactIndexBefore);
});
(0, node_test_1.default)("mission ticket run refuse une seconde execution tant qu'une tentative active existe deja", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-active-guard-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "running",
                adapterState: {
                    responseId: "resp_active_guard",
                    pollCursor: "cursor_active_guard",
                    vendorStatus: "in_progress",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketCreateResult = await createTicket(rootDir, mission.id);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const firstRun = await runCommand([
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
    strict_1.default.equal(firstRun.exitCode, 0);
    const journalBefore = await (0, promises_1.readFile)(layout.journalPath, "utf8");
    const attemptsDir = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "attempts");
    const attemptsBefore = await (0, promises_1.readdir)(attemptsDir);
    const missionBefore = await readMission(rootDir, mission.id);
    const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
    const secondRun = await runCommand([
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
    strict_1.default.equal(secondRun.exitCode, 1);
    strict_1.default.equal(secondRun.lines.at(-1), `Une tentative active existe deja pour le ticket \`${ticketId}\`.`);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.journalPath), "utf8"), journalBefore);
    strict_1.default.deepEqual(await (0, promises_1.readdir)(attemptsDir), attemptsBefore);
    strict_1.default.deepEqual(await readMission(rootDir, mission.id), missionBefore);
    strict_1.default.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
});
(0, node_test_1.default)("mission ticket run refuse un ticket non runnable sans muter journal, projections, snapshots ni isolations", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-non-runnable-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "completed",
                adapterState: {
                    responseId: "resp_should_not_run",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const prerequisiteResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Prerequis non termine",
        "--owner",
        "agent_pre",
    ]);
    const prerequisiteTicketId = String(prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const dependentResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Ticket dependant",
        "--owner",
        "agent_dep",
        "--depends-on",
        prerequisiteTicketId,
    ]);
    strict_1.default.equal(prerequisiteResult.exitCode, 0);
    strict_1.default.equal(dependentResult.exitCode, 0);
    const dependentTicketId = String(dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const journalBefore = await (0, promises_1.readFile)(layout.journalPath, "utf8");
    const missionBefore = await readMission(rootDir, mission.id);
    const ticketBefore = await readTicket(rootDir, mission.id, dependentTicketId);
    const ticketBoardBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"), "utf8");
    const missionStatusBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "mission-status.json"), "utf8");
    const approvalQueueBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "approval-queue.json"), "utf8");
    const artifactIndexBefore = await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "artifact-index.json"), "utf8");
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        dependentTicketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(runResult.lines.at(-1), `Le ticket \`${dependentTicketId}\` n'est pas runnable: dependances non resolues.`);
    strict_1.default.equal(await (0, promises_1.readFile)(layout.journalPath, "utf8"), journalBefore);
    strict_1.default.deepEqual(await readMission(rootDir, mission.id), missionBefore);
    strict_1.default.deepEqual(await readTicket(rootDir, mission.id, dependentTicketId), ticketBefore);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "ticket-board.json"), "utf8"), ticketBoardBefore);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "mission-status.json"), "utf8"), missionStatusBefore);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "approval-queue.json"), "utf8"), approvalQueueBefore);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(layout.projectionsDir, "artifact-index.json"), "utf8"), artifactIndexBefore);
    strict_1.default.deepEqual(await (0, promises_1.readdir)(layout.isolationsDir), []);
});
(0, node_test_1.default)("resolvePreferredIsolationKind prefere le worktree git seulement pour un workspace git exploitable", async () => {
    const gitCommands = async (args) => {
        if (args.includes("--show-toplevel")) {
            return {
                exitCode: 0,
                stdout: "C:/workspace/git-root\n",
                stderr: "",
            };
        }
        if (args.includes("--verify")) {
            return {
                exitCode: 0,
                stdout: "abc123\n",
                stderr: "",
            };
        }
        return {
            exitCode: 1,
            stdout: "",
            stderr: "unsupported",
        };
    };
    strict_1.default.equal(await (0, workspace_isolation_1.resolvePreferredIsolationKind)("C:/workspace/git-root", { runGitCommand: gitCommands }), "git_worktree");
    strict_1.default.equal(await (0, workspace_isolation_1.resolvePreferredIsolationKind)("C:/workspace/non-git", {
        runGitCommand: async () => ({
            exitCode: 1,
            stdout: "",
            stderr: "fatal",
        }),
    }), "workspace_copy");
    strict_1.default.equal(await (0, workspace_isolation_1.resolvePreferredIsolationKind)("C:/workspace/subdir", { runGitCommand: gitCommands }), "workspace_copy");
    if (process.platform === "win32") {
        strict_1.default.equal(await (0, workspace_isolation_1.resolvePreferredIsolationKind)("C:/workspace/git-root", {
            runGitCommand: async (args) => {
                if (args.includes("--show-toplevel")) {
                    return {
                        exitCode: 0,
                        stdout: "/c/workspace/git-root\n",
                        stderr: "",
                    };
                }
                if (args.includes("--verify")) {
                    return {
                        exitCode: 0,
                        stdout: "abc123\n",
                        stderr: "",
                    };
                }
                return {
                    exitCode: 1,
                    stdout: "",
                    stderr: "unsupported",
                };
            },
        }), "git_worktree");
    }
});
(0, node_test_1.default)("createCodexResponsesAdapterFromEnvironment applique un timeout AbortController configurable", async () => {
    const adapter = (0, codex_responses_adapter_1.createCodexResponsesAdapterFromEnvironment)({
        OPENAI_API_KEY: "sk-test",
        CORP_CODEX_RESPONSES_TIMEOUT_MS: "1",
    }, {
        model: "gpt-5-codex",
        fetchImpl: async (_input, init) => {
            const signal = init?.signal;
            if (!signal) {
                throw new Error("signal missing");
            }
            return await new Promise((_resolve, reject) => {
                const abortError = new Error("aborted");
                abortError.name = "AbortError";
                signal.addEventListener("abort", () => reject(abortError), { once: true });
            });
        },
    });
    const now = "2026-04-10T00:00:00.000Z";
    const mission = {
        id: "mission_timeout",
        title: "Mission timeout",
        objective: "Verifier le timeout adapteur",
        status: "running",
        successCriteria: ["Le timeout est remonte proprement"],
        policyProfileId: "policy_profile_local",
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: [],
        },
        ticketIds: ["ticket_timeout"],
        artifactIds: [],
        eventIds: ["event_timeout"],
        resumeCursor: "event_timeout",
        createdAt: now,
        updatedAt: now,
    };
    const ticket = {
        id: "ticket_timeout",
        missionId: mission.id,
        kind: "implement",
        goal: "Verifier le timeout adapteur",
        status: "claimed",
        owner: "agent_timeout",
        dependsOn: [],
        successCriteria: ["Un timeout clair est emis"],
        allowedCapabilities: [],
        skillPackRefs: [],
        workspaceIsolationId: "iso_timeout",
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: ["event_timeout"],
        createdAt: now,
        updatedAt: now,
    };
    await strict_1.default.rejects(adapter.launch({
        mission,
        ticket,
        attemptId: "attempt_timeout",
        workspacePath: "C:/workspace/timeout",
        background: false,
        resolvedSkillPacks: [],
    }), /timed out after 1ms/i);
});
