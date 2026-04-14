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
async function createMission(rootDir, title = "Mission board") {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Suivre l'etat detaille des tickets",
        "--success-criterion",
        "Le board mission est lisible",
        "--success-criterion",
        "Les blocages restent explicites",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return readMission(rootDir, line.slice("Mission creee: ".length));
}
async function createTicket(rootDir, missionId, input) {
    const args = [
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
        input.goal,
        "--owner",
        input.owner,
        "--success-criterion",
        "Le ticket existe",
    ];
    for (const dependencyId of input.dependsOn ?? []) {
        args.push("--depends-on", dependencyId);
    }
    const result = await runCommand(args);
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
async function writeTicketSnapshot(rootDir, missionId, ticketId, update) {
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const currentTicket = await readTicket(rootDir, missionId, ticketId);
    const nextTicket = update(currentTicket);
    await (0, promises_1.writeFile)(ticketPath, `${JSON.stringify(nextTicket, null, 2)}\n`, "utf8");
    return nextTicket;
}
async function writeAttemptSnapshot(rootDir, missionId, ticketId, input) {
    const attemptDir = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "attempts", input.attemptId);
    const attemptPath = node_path_1.default.join(attemptDir, "attempt.json");
    const attempt = {
        id: input.attemptId,
        ticketId,
        adapter: "codex_responses",
        status: input.status,
        workspaceIsolationId: input.workspaceIsolationId ?? `iso_${input.attemptId}`,
        backgroundRequested: input.backgroundRequested ?? true,
        adapterState: {
            responseId: `resp_${input.attemptId}`,
            pollCursor: `cursor_${input.attemptId}`,
            model: "gpt-5-codex",
            vendorStatus: "opaque",
            ...input.adapterState,
        },
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? null,
    };
    await (0, promises_1.mkdir)(attemptDir, { recursive: true });
    await (0, promises_1.writeFile)(attemptPath, `${JSON.stringify(attempt, null, 2)}\n`, "utf8");
    return attempt;
}
function ticketBoardPath(rootDir) {
    return node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
}
(0, node_test_1.default)("mission ticket board reconstruit une projection absente, expose les statuts coeur et masque adapterState", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-statuses-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission supervision");
    const ticketIds = [
        await createTicket(rootDir, mission.id, { goal: "Ticket runnable", owner: "agent_todo" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket claimed", owner: "agent_claimed" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket actif", owner: "agent_run" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket bloque", owner: "agent_blocked" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket approval", owner: "agent_approval" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket done", owner: "agent_done" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket failed", owner: "agent_failed" }),
        await createTicket(rootDir, mission.id, { goal: "Ticket cancelled", owner: "agent_cancel" }),
    ];
    const [todoTicketId, claimedTicketId, runningTicketId, blockedTicketId, approvalTicketId, doneTicketId, failedTicketId, cancelledTicketId,] = ticketIds;
    const statusByTicketId = new Map([
        [todoTicketId, "todo"],
        [claimedTicketId, "claimed"],
        [runningTicketId, "in_progress"],
        [blockedTicketId, "blocked"],
        [approvalTicketId, "awaiting_approval"],
        [doneTicketId, "done"],
        [failedTicketId, "failed"],
        [cancelledTicketId, "cancelled"],
    ]);
    for (const ticketId of ticketIds) {
        await writeTicketSnapshot(rootDir, mission.id, ticketId, (ticket) => ({
            ...ticket,
            status: statusByTicketId.get(ticketId) ?? ticket.status,
            updatedAt: `2026-04-09T12:${String(ticketIds.indexOf(ticketId)).padStart(2, "0")}:00.000Z`,
        }));
    }
    await writeAttemptSnapshot(rootDir, mission.id, claimedTicketId, {
        attemptId: "attempt_claimed_board",
        status: "requested",
        startedAt: "2026-04-09T12:01:00.000Z",
    });
    await writeAttemptSnapshot(rootDir, mission.id, runningTicketId, {
        attemptId: "attempt_running_board",
        status: "running",
        startedAt: "2026-04-09T12:02:00.000Z",
    });
    await writeAttemptSnapshot(rootDir, mission.id, approvalTicketId, {
        attemptId: "attempt_approval_board",
        status: "awaiting_approval",
        startedAt: "2026-04-09T12:04:00.000Z",
    });
    await writeAttemptSnapshot(rootDir, mission.id, doneTicketId, {
        attemptId: "attempt_done_board",
        status: "completed",
        startedAt: "2026-04-09T12:05:00.000Z",
        endedAt: "2026-04-09T12:06:00.000Z",
    });
    await writeAttemptSnapshot(rootDir, mission.id, failedTicketId, {
        attemptId: "attempt_failed_board",
        status: "failed",
        startedAt: "2026-04-09T12:06:00.000Z",
        endedAt: "2026-04-09T12:07:00.000Z",
    });
    await (0, promises_1.rm)(ticketBoardPath(rootDir), { force: true });
    const boardResult = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
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
    strict_1.default.equal(boardResult.exitCode, 0);
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.equal(resumeResult.exitCode, 0);
    const projection = await readJson(ticketBoardPath(rootDir));
    const projectionJson = JSON.stringify(projection);
    const boardOutput = boardResult.lines.join("\n");
    const statusOutput = statusResult.lines.join("\n");
    const resumeOutput = resumeResult.lines.join("\n");
    strict_1.default.deepEqual(projection.tickets.map((ticket) => ticket.ticketId), ticketIds);
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === todoTicketId)?.trackingState, "runnable");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === todoTicketId)?.statusReasonCode, "runnable");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === claimedTicketId)?.trackingState, "active");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === claimedTicketId)?.activeAttemptStatus, "requested");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === runningTicketId)?.trackingState, "active");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === runningTicketId)?.activeAttemptStatus, "running");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === blockedTicketId)?.blockingReasonCode, "ticket_blocked");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === approvalTicketId)?.trackingState, "awaiting_approval");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === approvalTicketId)?.activeAttemptStatus, "awaiting_approval");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === doneTicketId)?.lastAttemptStatus, "completed");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === failedTicketId)?.lastAttemptStatus, "failed");
    strict_1.default.equal(projection.tickets.find((ticket) => ticket.ticketId === cancelledTicketId)?.trackingState, "cancelled");
    strict_1.default.match(boardOutput, new RegExp(`Mission: ${mission.id}`));
    strict_1.default.match(boardOutput, /Etat des tickets:/);
    strict_1.default.match(boardOutput, new RegExp(`${todoTicketId} \\| statut=todo \\| owner=agent_todo`));
    strict_1.default.match(boardOutput, new RegExp(`${claimedTicketId} \\| statut=claimed \\| owner=agent_claimed`));
    strict_1.default.match(boardOutput, new RegExp(`${runningTicketId} \\| statut=in_progress \\| owner=agent_run`));
    strict_1.default.match(boardOutput, new RegExp(`${blockedTicketId} \\| statut=blocked \\| owner=agent_blocked`));
    strict_1.default.match(boardOutput, new RegExp(`${approvalTicketId} \\| statut=awaiting_approval \\| owner=agent_approval`));
    strict_1.default.match(boardOutput, new RegExp(`${doneTicketId} \\| statut=done \\| owner=agent_done`));
    strict_1.default.match(boardOutput, new RegExp(`${failedTicketId} \\| statut=failed \\| owner=agent_failed`));
    strict_1.default.match(boardOutput, new RegExp(`${cancelledTicketId} \\| statut=cancelled \\| owner=agent_cancel`));
    strict_1.default.match(statusOutput, /Etat des tickets:/);
    strict_1.default.doesNotMatch(resumeOutput, /Etat des tickets:/);
    strict_1.default.doesNotMatch(resumeOutput, new RegExp(`${todoTicketId} \\| statut=todo`));
    for (const hiddenValue of [
        "resp_attempt_claimed_board",
        "cursor_attempt_running_board",
        "gpt-5-codex",
        "opaque",
    ]) {
        strict_1.default.doesNotMatch(boardOutput, new RegExp(hiddenValue));
        strict_1.default.doesNotMatch(statusOutput, new RegExp(hiddenValue));
        strict_1.default.doesNotMatch(resumeOutput, new RegExp(hiddenValue));
        strict_1.default.doesNotMatch(projectionJson, new RegExp(hiddenValue));
    }
});
(0, node_test_1.default)("mission ticket board distingue les prerequis en attente, resolus, annules et en echec sans casser l'ordre canonique", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-dependencies-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission dependances");
    const prerequisiteTicketId = await createTicket(rootDir, mission.id, {
        goal: "Prerequis canonique",
        owner: "agent_pre",
    });
    const dependentTicketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket dependant",
        owner: "agent_dep",
        dependsOn: [prerequisiteTicketId],
    });
    const readBoardProjection = async () => {
        const command = await runCommand([
            "mission",
            "ticket",
            "board",
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
        ]);
        return {
            command,
            projection: await readJson(ticketBoardPath(rootDir)),
        };
    };
    let result = await readBoardProjection();
    strict_1.default.equal(result.command.exitCode, 0);
    strict_1.default.deepEqual(result.projection.tickets.map((ticket) => ticket.ticketId), [prerequisiteTicketId, dependentTicketId]);
    strict_1.default.equal(result.projection.tickets[1]?.runnable, false);
    strict_1.default.equal(result.projection.tickets[1]?.planningState, "waiting_on_dependencies");
    strict_1.default.equal(result.projection.tickets[1]?.blockingReasonCode, "dependency_pending");
    strict_1.default.deepEqual(result.projection.tickets[1]?.blockedByTicketIds, [prerequisiteTicketId]);
    strict_1.default.deepEqual(result.projection.tickets[1]?.dependencyStatuses, [
        {
            ticketId: prerequisiteTicketId,
            status: "todo",
            blocksRunnable: true,
        },
    ]);
    strict_1.default.match(result.command.lines.join("\n"), /motif=prerequis en attente/);
    await writeTicketSnapshot(rootDir, mission.id, prerequisiteTicketId, (ticket) => ({
        ...ticket,
        status: "done",
        updatedAt: "2026-04-09T13:00:00.000Z",
    }));
    result = await readBoardProjection();
    strict_1.default.equal(result.projection.tickets[1]?.runnable, true);
    strict_1.default.equal(result.projection.tickets[1]?.planningState, "runnable");
    strict_1.default.equal(result.projection.tickets[1]?.blockingReasonCode, null);
    strict_1.default.equal(result.projection.tickets[1]?.statusReasonCode, "runnable");
    strict_1.default.match(result.command.lines.join("\n"), /motif=pret a lancer/);
    await writeTicketSnapshot(rootDir, mission.id, prerequisiteTicketId, (ticket) => ({
        ...ticket,
        status: "cancelled",
        updatedAt: "2026-04-09T13:01:00.000Z",
    }));
    result = await readBoardProjection();
    strict_1.default.equal(result.projection.tickets[1]?.runnable, false);
    strict_1.default.equal(result.projection.tickets[1]?.planningState, "blocked_by_cancelled_dependency");
    strict_1.default.equal(result.projection.tickets[1]?.blockingReasonCode, "dependency_cancelled");
    strict_1.default.match(result.command.lines.join("\n"), /motif=prerequis annule/);
    await writeTicketSnapshot(rootDir, mission.id, prerequisiteTicketId, (ticket) => ({
        ...ticket,
        status: "failed",
        updatedAt: "2026-04-09T13:02:00.000Z",
    }));
    result = await readBoardProjection();
    strict_1.default.equal(result.projection.tickets[1]?.runnable, false);
    strict_1.default.equal(result.projection.tickets[1]?.planningState, "blocked_by_failed_dependency");
    strict_1.default.equal(result.projection.tickets[1]?.blockingReasonCode, "dependency_failed");
    strict_1.default.match(result.command.lines.join("\n"), /motif=prerequis en echec/);
});
(0, node_test_1.default)("mission ticket board garde la chaine de blocages explicite quand un prerequis intermediaire est bloque", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-blocked-chain-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission blocages en chaine");
    const ticketC = await createTicket(rootDir, mission.id, {
        goal: "Ticket C runnable",
        owner: "agent_c",
    });
    const ticketB = await createTicket(rootDir, mission.id, {
        goal: "Ticket B bloque",
        owner: "agent_b",
        dependsOn: [ticketC],
    });
    const ticketA = await createTicket(rootDir, mission.id, {
        goal: "Ticket A attend B",
        owner: "agent_a",
        dependsOn: [ticketB],
    });
    await writeTicketSnapshot(rootDir, mission.id, ticketB, (ticket) => ({
        ...ticket,
        status: "blocked",
        updatedAt: "2026-04-10T12:00:00.000Z",
    }));
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const projection = await readJson(ticketBoardPath(rootDir));
    const entryA = projection.tickets.find((ticket) => ticket.ticketId === ticketA);
    const entryB = projection.tickets.find((ticket) => ticket.ticketId === ticketB);
    const entryC = projection.tickets.find((ticket) => ticket.ticketId === ticketC);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.ok(entryA);
    strict_1.default.ok(entryB);
    strict_1.default.ok(entryC);
    strict_1.default.equal(entryA.planningState, "waiting_on_dependencies");
    strict_1.default.equal(entryA.trackingState, "blocked");
    strict_1.default.deepEqual(entryA.blockedByTicketIds, [ticketB]);
    strict_1.default.equal(entryB.trackingState, "blocked");
    strict_1.default.equal(entryB.statusReasonCode, "ticket_blocked");
    strict_1.default.equal(entryC.runnable, true);
    strict_1.default.equal(entryC.trackingState, "runnable");
});
(0, node_test_1.default)("mission ticket board ne reecrit pas une projection equivalente quand seules les cles JSON changent d'ordre", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-equivalent-projection-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission projection equivalente");
    await createTicket(rootDir, mission.id, {
        goal: "Ticket projection stable",
        owner: "agent_projection",
    });
    const originalProjection = await readJson(ticketBoardPath(rootDir));
    const reorderedProjection = {
        tickets: originalProjection.tickets.map((ticket) => ({
            updatedAt: ticket.updatedAt,
            lastAttemptWorkspaceIsolationId: ticket.lastAttemptWorkspaceIsolationId,
            lastAttemptBackgroundRequested: ticket.lastAttemptBackgroundRequested,
            lastAttemptEndedAt: ticket.lastAttemptEndedAt,
            lastAttemptStartedAt: ticket.lastAttemptStartedAt,
            lastAttemptStatus: ticket.lastAttemptStatus,
            lastAttemptId: ticket.lastAttemptId,
            activeAttemptStatus: ticket.activeAttemptStatus,
            activeAttemptId: ticket.activeAttemptId,
            blockingReasonCode: ticket.blockingReasonCode,
            statusReasonCode: ticket.statusReasonCode,
            trackingState: ticket.trackingState,
            dependencyStatuses: ticket.dependencyStatuses.map((dependencyStatus) => ({
                blocksRunnable: dependencyStatus.blocksRunnable,
                status: dependencyStatus.status,
                ticketId: dependencyStatus.ticketId,
            })),
            planningState: ticket.planningState,
            blockedByTicketIds: [...ticket.blockedByTicketIds],
            runnable: ticket.runnable,
            planOrder: ticket.planOrder,
            skillPackRefs: [...ticket.skillPackRefs],
            allowedCapabilities: [...ticket.allowedCapabilities],
            usedSkillPacks: [...ticket.usedSkillPacks],
            usedCapabilities: [...ticket.usedCapabilities],
            dependsOn: [...ticket.dependsOn],
            kind: ticket.kind,
            owner: ticket.owner,
            status: ticket.status,
            title: ticket.title,
            missionId: ticket.missionId,
            ticketId: ticket.ticketId,
        })),
        schemaVersion: 1,
    };
    const reorderedProjectionJson = `${JSON.stringify(reorderedProjection, null, 2)}\n`;
    await (0, promises_1.writeFile)(ticketBoardPath(rootDir), reorderedProjectionJson, "utf8");
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath(rootDir), "utf8"), reorderedProjectionJson);
});
(0, node_test_1.default)("mission ticket board echoue proprement si la projection est irreconciliable sans snapshots exploitables", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-irreconcilable-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission irreconciliable");
    await createTicket(rootDir, mission.id, {
        goal: "Ticket a corrompre",
        owner: "agent_break",
    });
    const buildTicketBoardModule = require("../../packages/ticket-runtime/src/planner/build-ticket-board");
    const originalBuildTicketBoardProjection = buildTicketBoardModule.buildTicketBoardProjection;
    buildTicketBoardModule.buildTicketBoardProjection = () => {
        throw new Error("incoherence logique entre journal et snapshots");
    };
    t.after(() => {
        buildTicketBoardModule.buildTicketBoardProjection = originalBuildTicketBoardProjection;
    });
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Projection ticket-board irreconciliable pour ${mission.id}. Impossible d'afficher le board des tickets.`);
});
(0, node_test_1.default)("mission ticket board remonte une erreur fichier explicite sur EPERM", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-fs-error-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission erreur fichier");
    await createTicket(rootDir, mission.id, {
        goal: "Ticket lecture projection",
        owner: "agent_fs",
    });
    const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store");
    const originalReadProjectionFile = projectionStoreModule.readProjectionFile;
    projectionStoreModule.readProjectionFile = async (...args) => {
        if (args[1] === "ticket-board") {
            const error = new Error("EPERM: permission denied, open ticket-board.json");
            error.code = "EPERM";
            throw error;
        }
        return originalReadProjectionFile(...args);
    };
    t.after(() => {
        projectionStoreModule.readProjectionFile = originalReadProjectionFile;
    });
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.match(result.lines.at(-1) ?? "", /Erreur fichier: EPERM: permission denied, open ticket-board\.json/);
    strict_1.default.doesNotMatch(result.lines.at(-1) ?? "", /irreconciliable/);
});
(0, node_test_1.default)("mission ticket board signale une projection corrompue au lieu de la masquer", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-corrupted-projection-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission projection corrompue");
    await createTicket(rootDir, mission.id, {
        goal: "Ticket json corrompu",
        owner: "agent_json",
    });
    await (0, promises_1.writeFile)(ticketBoardPath(rootDir), "{corrupted", "utf8");
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.match(result.lines.at(-1) ?? "", /Projection ticket-board corrompue:/);
    strict_1.default.match(result.lines.at(-1) ?? "", /ticket-board\.json/);
});
(0, node_test_1.default)("mission ticket board traite un statut inconnu comme non runnable par defaut", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ticket-board-unknown-status-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission statut inconnu");
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket forge avec statut inconnu",
        owner: "agent_unknown",
    });
    await writeTicketSnapshot(rootDir, mission.id, ticketId, (ticket) => ({
        ...ticket,
        status: "on_hold",
        updatedAt: "2026-04-10T11:11:11.000Z",
    }));
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const projection = await readJson(ticketBoardPath(rootDir));
    const entry = projection.tickets.find((ticket) => ticket.ticketId === ticketId);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.ok(entry);
    strict_1.default.equal(entry.runnable, false);
    strict_1.default.equal(entry.planningState, "not_runnable_status");
    strict_1.default.equal(entry.trackingState, "blocked");
    strict_1.default.match(result.lines.join("\n"), new RegExp(`${ticketId} \\| statut=on_hold \\| owner=agent_unknown`));
    strict_1.default.doesNotMatch(result.lines.join("\n"), /motif=pret a lancer/);
});
