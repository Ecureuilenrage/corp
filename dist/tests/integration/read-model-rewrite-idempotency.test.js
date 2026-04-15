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
const file_mission_repository_1 = require("../../packages/storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../packages/storage/src/repositories/file-ticket-repository");
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
        "Mission rewrite",
        "--objective",
        "Verifier la reconstruction centralisee",
        "--success-criterion",
        "Les read-models sont idempotents",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const missionLine = result.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionLine);
    return missionLine.slice("Mission creee: ".length);
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
        "Verifier la reconstruction d'un ticket",
        "--owner",
        "agent_recovery",
        "--success-criterion",
        "Le ticket est reconstructible",
        "--allow-capability",
        "fs.read",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const ticketLine = result.lines.find((line) => line.startsWith("Ticket cree: "));
    strict_1.default.ok(ticketLine);
    return ticketLine.slice("Ticket cree: ".length);
}
async function readJson(filePath) {
    return JSON.parse(await (0, promises_1.readFile)(filePath, "utf8"));
}
async function removeProjectionFiles(rootDir, projectionNames) {
    await Promise.all(projectionNames.map((projectionName) => (0, promises_1.rm)(node_path_1.default.join(rootDir, ".corp", "projections", `${projectionName}.json`), {
        force: true,
    })));
}
async function readJournalEvents(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
function patchProjectionWrites(t) {
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
    return projectionWrites;
}
function assertCoreReadModelsWereRewritten(projectionWrites) {
    for (const projectionName of [
        "mission-status",
        "ticket-board",
        "artifact-index",
        "audit-log",
        "resume-view",
    ]) {
        strict_1.default.ok(projectionWrites.includes(projectionName), `projection attendue manquante: ${projectionName}`);
    }
}
(0, node_test_1.default)("mission create declenche la reconstruction centralisee des read-models apres persist", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-rewrite-read-models-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const projectionWrites = patchProjectionWrites(t);
    await createMission(rootDir);
    assertCoreReadModelsWereRewritten(projectionWrites);
});
(0, node_test_1.default)("mission lifecycle declenche la reconstruction centralisee des read-models apres persist", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-lifecycle-rewrite-read-models-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const projectionWrites = patchProjectionWrites(t);
    const result = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    assertCoreReadModelsWereRewritten(projectionWrites);
});
(0, node_test_1.default)("mission resume reconstruit les read-models mission et ticket apres perte post-persist", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-resume-crash-recovery-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    await removeProjectionFiles(rootDir, [
        "resume-view",
        "ticket-board",
        "approval-queue",
        "artifact-index",
    ]);
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const ticketBoard = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    strict_1.default.ok(ticketBoard.tickets.some((ticket) => ticket.ticketId === ticketId));
});
(0, node_test_1.default)("approval queue reconstruit une ApprovalRequest apres perte des read-models", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-crash-recovery-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_crash_recovery",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation crash recovery",
                    actionType: "workspace_write",
                    actionSummary: "Verifier la reconstruction de la queue",
                    guardrails: ["manual_review: workspace_write"],
                },
            }),
        }),
    });
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
    await removeProjectionFiles(rootDir, ["approval-queue", "resume-view"]);
    const queueResult = await runCommand([
        "mission",
        "approval",
        "queue",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(queueResult.exitCode, 0);
    const approvalQueue = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    strict_1.default.equal(approvalQueue.approvals.length, 1);
    strict_1.default.equal(approvalQueue.approvals[0]?.ticketId, ticketId);
    strict_1.default.equal(approvalQueue.approvals[0]?.status, "requested");
});
(0, node_test_1.default)("mission resume reconstruit une mission creee si le crash survient apres appendEvent avant save", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-append-crash-recovery-"));
    const originalSave = file_mission_repository_1.FileMissionRepository.prototype.save;
    let shouldCrashAfterAppend = true;
    t.after(async () => {
        file_mission_repository_1.FileMissionRepository.prototype.save = originalSave;
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    file_mission_repository_1.FileMissionRepository.prototype.save = async function patchedSave(...args) {
        if (shouldCrashAfterAppend) {
            shouldCrashAfterAppend = false;
            throw new Error("crash simule apres appendEvent");
        }
        return originalSave.apply(this, args);
    };
    const createResult = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission crash append",
        "--objective",
        "Reconstruire sans snapshot mission",
        "--success-criterion",
        "Le journal suffit",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 1);
    strict_1.default.equal(createResult.lines.at(-1), "crash simule apres appendEvent");
    const missionCreatedEvent = (await readJournalEvents(rootDir))
        .find((event) => event.type === "mission.created");
    strict_1.default.ok(missionCreatedEvent);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionCreatedEvent.missionId,
    ]);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(resumeResult.lines.join("\n"), /Mission crash append/);
});
(0, node_test_1.default)("mission resume reconstruit une mission pausee si le crash survient apres appendEvent avant save", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-lifecycle-append-crash-recovery-"));
    const originalSave = file_mission_repository_1.FileMissionRepository.prototype.save;
    let shouldCrashAfterAppend = false;
    t.after(async () => {
        file_mission_repository_1.FileMissionRepository.prototype.save = originalSave;
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    file_mission_repository_1.FileMissionRepository.prototype.save = async function patchedSave(...args) {
        if (shouldCrashAfterAppend) {
            shouldCrashAfterAppend = false;
            throw new Error("crash simule apres appendEvent pause");
        }
        return originalSave.apply(this, args);
    };
    shouldCrashAfterAppend = true;
    const pauseResult = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(pauseResult.exitCode, 1);
    strict_1.default.equal(pauseResult.lines.at(-1), "crash simule apres appendEvent pause");
    const pausedEvent = (await readJournalEvents(rootDir)).find((event) => event.type === "mission.paused");
    strict_1.default.ok(pausedEvent);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(resumeResult.lines.join("\n"), /blocked/i, "La reconstruction doit exposer le statut pause (blocked) meme sans snapshot mission.json a jour.");
});
(0, node_test_1.default)("ticket board reconstruit un ticket en execution si le crash survient apres appendEvent avant save", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-append-crash-recovery-"));
    const originalSave = file_ticket_repository_1.FileTicketRepository.prototype.save;
    let runTicketSaveCount = 0;
    const crashOnExecutionRequestedSave = 3;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        file_ticket_repository_1.FileTicketRepository.prototype.save = originalSave;
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "completed",
                adapterState: { responseId: "resp_run_crash", vendorStatus: "completed" },
            }),
        }),
    });
    file_ticket_repository_1.FileTicketRepository.prototype.save = async function patchedTicketSave(...args) {
        runTicketSaveCount += 1;
        if (runTicketSaveCount === crashOnExecutionRequestedSave) {
            throw new Error("crash simule apres appendEvent run");
        }
        return originalSave.apply(this, args);
    };
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
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(runResult.lines.at(-1), "crash simule apres appendEvent run");
    const journalEventTypes = (await readJournalEvents(rootDir)).map((event) => event.type);
    strict_1.default.ok(journalEventTypes.includes("execution.requested"), `Le journal doit contenir un event d'execution (${journalEventTypes.join(", ")}).`);
    await removeProjectionFiles(rootDir, ["ticket-board", "resume-view"]);
    const boardResult = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(boardResult.exitCode, 0);
    const ticketBoard = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    const reconstructedTicket = ticketBoard.tickets.find((ticket) => ticket.ticketId === ticketId);
    strict_1.default.ok(reconstructedTicket, "Le ticket reconstruit doit apparaitre dans la projection ticket-board.");
    strict_1.default.equal(reconstructedTicket.status, "claimed");
    strict_1.default.equal(reconstructedTicket.trackingState, "active");
    strict_1.default.equal(reconstructedTicket.activeAttemptStatus, "requested");
});
(0, node_test_1.default)("approval queue reconstruit la transition si le crash survient apres appendEvent avant save", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-approval-transition-append-crash-recovery-"));
    const originalSave = file_mission_repository_1.FileMissionRepository.prototype.save;
    let shouldCrashAfterAppend = false;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        file_mission_repository_1.FileMissionRepository.prototype.save = originalSave;
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_approval_transition_crash",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation crash recovery transition",
                    actionType: "workspace_write",
                    actionSummary: "Reconstruire apres crash approval resolve",
                    guardrails: ["manual_review: workspace_write"],
                },
            }),
        }),
    });
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
    const approvalQueueBeforeCrash = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    const approvalId = approvalQueueBeforeCrash.approvals[0]?.approvalId;
    strict_1.default.ok(approvalId);
    file_mission_repository_1.FileMissionRepository.prototype.save = async function patchedMissionSave(...args) {
        if (shouldCrashAfterAppend) {
            shouldCrashAfterAppend = false;
            throw new Error("crash simule apres appendEvent approval");
        }
        return originalSave.apply(this, args);
    };
    shouldCrashAfterAppend = true;
    const approveResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--approval-id",
        approvalId,
    ]);
    strict_1.default.equal(approveResult.exitCode, 1);
    strict_1.default.equal(approveResult.lines.at(-1), "crash simule apres appendEvent approval");
    const approvalEvent = (await readJournalEvents(rootDir)).find((event) => event.type === "approval.approved");
    strict_1.default.ok(approvalEvent, "Le journal doit contenir l'event approval.approved.");
    await removeProjectionFiles(rootDir, ["approval-queue", "resume-view", "ticket-board"]);
    const queueResult = await runCommand([
        "mission",
        "approval",
        "queue",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(queueResult.exitCode, 0);
    const approvalQueueAfter = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    strict_1.default.equal(approvalQueueAfter.approvals.length, 0, "La queue reconstruite depuis le journal ne doit plus contenir d'approval requested apres la transition.");
});
