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
async function createMission(rootDir) {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission cancel",
        "--objective",
        "Annuler un prerequis sans perdre l'audit",
        "--success-criterion",
        "Le ticket annule reste visible au board",
        "--success-criterion",
        "Le dependent devient non runnable",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return readMission(rootDir, line.slice("Mission creee: ".length));
}
async function createTicket(rootDir, missionId, options) {
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
        options.goal,
        "--owner",
        options.owner,
        "--success-criterion",
        "Le ticket existe",
    ];
    for (const dependencyId of options.dependsOn ?? []) {
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
async function writeTicketStatus(rootDir, missionId, ticketId, status) {
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const ticket = await readTicket(rootDir, missionId, ticketId);
    await (0, promises_1.writeFile)(ticketPath, `${JSON.stringify({ ...ticket, status }, null, 2)}\n`, "utf8");
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
(0, node_test_1.default)("mission ticket cancel garde le snapshot historique et bloque les dependants en projection", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cancel-ticket-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const prerequisiteTicketId = await createTicket(rootDir, mission.id, {
        goal: "Verifier le prerequis",
        owner: "agent_pre",
    });
    const dependentTicketId = await createTicket(rootDir, mission.id, {
        goal: "Executer le ticket dependant",
        owner: "agent_dep",
        dependsOn: [prerequisiteTicketId],
    });
    const cancelResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        prerequisiteTicketId,
        "--reason",
        "prerequis obsolete",
    ]);
    strict_1.default.equal(cancelResult.exitCode, 0);
    strict_1.default.equal(cancelResult.lines[0], `Ticket annule: ${prerequisiteTicketId}`);
    const updatedMission = await readMission(rootDir, mission.id);
    const cancelledTicket = await readTicket(rootDir, mission.id, prerequisiteTicketId);
    const dependentTicket = await readTicket(rootDir, mission.id, dependentTicketId);
    const journal = await readJournal(rootDir);
    const cancelledEvent = journal.at(-1);
    const ticketBoardProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    const resumeViewProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", prerequisiteTicketId, "ticket.json");
    strict_1.default.ok(cancelledEvent);
    await (0, promises_1.access)(ticketPath);
    strict_1.default.equal(updatedMission.status, "ready");
    strict_1.default.deepEqual(updatedMission.ticketIds, [prerequisiteTicketId, dependentTicketId]);
    strict_1.default.equal(updatedMission.resumeCursor, cancelledEvent.eventId);
    strict_1.default.equal(cancelledTicket.status, "cancelled");
    strict_1.default.equal(cancelledTicket.goal, "Verifier le prerequis");
    strict_1.default.equal(dependentTicket.status, "todo");
    strict_1.default.deepEqual(dependentTicket.dependsOn, [prerequisiteTicketId]);
    strict_1.default.equal(cancelledEvent.type, "ticket.cancelled");
    strict_1.default.equal(cancelledEvent.ticketId, prerequisiteTicketId);
    strict_1.default.equal(cancelledEvent.payload.previousStatus, "todo");
    strict_1.default.equal(cancelledEvent.payload.reason, "prerequis obsolete");
    strict_1.default.equal(cancelledEvent.payload.trigger, "operator");
    strict_1.default.deepEqual(ticketBoardProjection, {
        schemaVersion: 1,
        tickets: [
            {
                ticketId: prerequisiteTicketId,
                missionId: mission.id,
                title: "Verifier le prerequis",
                status: "cancelled",
                owner: "agent_pre",
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
                trackingState: "cancelled",
                statusReasonCode: "ticket_cancelled",
                blockingReasonCode: null,
                activeAttemptId: null,
                activeAttemptStatus: null,
                lastAttemptId: null,
                lastAttemptStatus: null,
                lastAttemptStartedAt: null,
                lastAttemptEndedAt: null,
                lastAttemptBackgroundRequested: null,
                lastAttemptWorkspaceIsolationId: null,
                updatedAt: cancelledTicket.updatedAt,
            },
            {
                ticketId: dependentTicketId,
                missionId: mission.id,
                title: "Executer le ticket dependant",
                status: "todo",
                owner: "agent_dep",
                kind: "implement",
                dependsOn: [prerequisiteTicketId],
                allowedCapabilities: [],
                skillPackRefs: [],
                usedCapabilities: [],
                usedSkillPacks: [],
                planOrder: 1,
                runnable: false,
                blockedByTicketIds: [prerequisiteTicketId],
                planningState: "blocked_by_cancelled_dependency",
                dependencyStatuses: [
                    {
                        ticketId: prerequisiteTicketId,
                        status: "cancelled",
                        blocksRunnable: true,
                    },
                ],
                trackingState: "blocked",
                statusReasonCode: "dependency_cancelled",
                blockingReasonCode: "dependency_cancelled",
                activeAttemptId: null,
                activeAttemptStatus: null,
                lastAttemptId: null,
                lastAttemptStatus: null,
                lastAttemptStartedAt: null,
                lastAttemptEndedAt: null,
                lastAttemptBackgroundRequested: null,
                lastAttemptWorkspaceIsolationId: null,
                updatedAt: dependentTicket.updatedAt,
            },
        ],
    });
    strict_1.default.deepEqual(resumeViewProjection.resume?.openTickets, [
        ticketBoardProjection.tickets[1],
    ]);
    strict_1.default.equal(resumeViewProjection.resume?.nextOperatorAction, "Aucun ticket n'est runnable pour le moment. Replanifiez ou debloquez la mission avant de poursuivre.");
    const output = statusResult.lines.join("\n");
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.match(output, new RegExp(`Tickets ouverts: ${dependentTicketId}`));
    strict_1.default.doesNotMatch(output, new RegExp(`Tickets ouverts: .*${prerequisiteTicketId}`));
    strict_1.default.match(output, /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./);
});
(0, node_test_1.default)("mission ticket cancel rejette done et failed sans muter journal ni projections", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cancel-ticket-terminal-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket terminal",
        owner: "agent_terminal",
    });
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const cases = [
        {
            status: "done",
            expectedMessage: `Le ticket ${ticketId} est deja termine (statut: done).`,
        },
        {
            status: "failed",
            expectedMessage: `Le ticket ${ticketId} est deja en echec (statut: failed).`,
        },
    ];
    for (const testCase of cases) {
        await writeTicketStatus(rootDir, mission.id, ticketId, testCase.status);
        const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
        const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
        const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
        const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
        const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
        const beforeJournal = await readJournal(rootDir);
        const result = await runCommand([
            "mission",
            "ticket",
            "cancel",
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
            "--ticket-id",
            ticketId,
        ]);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.status}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.status}`);
        strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
        strict_1.default.equal(await (0, promises_1.readFile)(ticketPath, "utf8"), beforeTicket);
        strict_1.default.equal(await (0, promises_1.readFile)(missionStatusPath, "utf8"), beforeMissionStatus);
        strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath, "utf8"), beforeTicketBoard);
        strict_1.default.equal(await (0, promises_1.readFile)(resumeViewPath, "utf8"), beforeResumeView);
        strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
    }
});
