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
        "Mission move standalone",
        "--objective",
        "Tester les deplacements de tickets",
        "--success-criterion",
        "Le plan canonique reste coherent",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return readMission(rootDir, line.slice("Mission creee: ".length));
}
async function createTicket(rootDir, missionId, goal) {
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
        goal,
        "--owner",
        "agent_move",
        "--success-criterion",
        "Le ticket existe",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return line.slice("Ticket cree: ".length);
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
function ticketBoardPath(rootDir) {
    return node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
}
(0, node_test_1.default)("mission ticket move applique les strategies standalone en gardant mission, board et journal synchronises", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-move-ticket-standalone-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketA = await createTicket(rootDir, mission.id, "Ticket A");
    const ticketB = await createTicket(rootDir, mission.id, "Ticket B");
    const ticketC = await createTicket(rootDir, mission.id, "Ticket C");
    const ticketD = await createTicket(rootDir, mission.id, "Ticket D");
    const assertMoveState = async (args, movedTicketId, expectedOrder) => {
        const result = await runCommand(args);
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.equal(result.lines[0], `Ticket deplace: ${movedTicketId}`);
        const updatedMission = await readMission(rootDir, mission.id);
        const ticketBoard = await readJson(ticketBoardPath(rootDir));
        const lastEvent = (await readJournal(rootDir)).at(-1);
        strict_1.default.ok(lastEvent);
        strict_1.default.deepEqual(updatedMission.ticketIds, expectedOrder);
        strict_1.default.deepEqual(ticketBoard.tickets.map((ticket) => ticket.ticketId), expectedOrder);
        strict_1.default.deepEqual(ticketBoard.tickets.map((ticket) => ticket.planOrder), expectedOrder.map((_, index) => index));
        strict_1.default.equal(lastEvent.type, "ticket.reprioritized");
        strict_1.default.equal(lastEvent.ticketId, movedTicketId);
        strict_1.default.deepEqual(lastEvent.payload.orderedTicketIds, expectedOrder);
    };
    await assertMoveState([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketD,
        "--to-front",
    ], ticketD, [ticketD, ticketA, ticketB, ticketC]);
    await assertMoveState([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketD,
        "--to-back",
    ], ticketD, [ticketA, ticketB, ticketC, ticketD]);
    await assertMoveState([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketA,
        "--after-ticket",
        ticketC,
    ], ticketA, [ticketB, ticketC, ticketA, ticketD]);
    await assertMoveState([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketD,
        "--before-ticket",
        ticketB,
    ], ticketD, [ticketD, ticketB, ticketC, ticketA]);
});
(0, node_test_1.default)("mission ticket move rejette auto-reference et reference inconnue sans muter mission ni board", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-move-ticket-guards-integration-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketA = await createTicket(rootDir, mission.id, "Ticket A");
    const ticketB = await createTicket(rootDir, mission.id, "Ticket B");
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
    const beforeBoard = await (0, promises_1.readFile)(ticketBoardPath(rootDir), "utf8");
    const beforeJournal = await readJournal(rootDir);
    const selfReferenceResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketA,
        "--after-ticket",
        ticketA,
    ]);
    strict_1.default.equal(selfReferenceResult.exitCode, 1);
    strict_1.default.equal(selfReferenceResult.lines.at(-1), `Le ticket \`${ticketA}\` ne peut pas etre deplace par rapport a lui-meme.`);
    strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath(rootDir), "utf8"), beforeBoard);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
    const unknownReferenceResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketB,
        "--before-ticket",
        "ticket_inconnu",
    ]);
    strict_1.default.equal(unknownReferenceResult.exitCode, 1);
    strict_1.default.equal(unknownReferenceResult.lines.at(-1), `Le ticket de reference \`ticket_inconnu\` est introuvable dans la mission \`${mission.id}\`.`);
    strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath(rootDir), "utf8"), beforeBoard);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
});
