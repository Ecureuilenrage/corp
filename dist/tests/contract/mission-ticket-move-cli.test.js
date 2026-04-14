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
async function bootstrapWorkspace(rootDir) {
    const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 0);
}
async function createMission(rootDir, title) {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Faire evoluer l'ordre canonique du plan",
        "--success-criterion",
        "Les deplacements restent audites",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return line.slice("Mission creee: ".length);
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
        "agent_dev",
        "--success-criterion",
        "Le ticket existe",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return line.slice("Ticket cree: ".length);
}
(0, node_test_1.default)("l'aide mission expose mission ticket move en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission ticket move --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id>/);
    strict_1.default.match(output, /deplace un ticket/i);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("mission ticket move valide mission-id, ticket-id et la strategie de deplacement", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-move-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir, "Mission move");
    const ticketId = await createTicket(rootDir, missionId, "Ticket move");
    const cases = [
        {
            name: "mission-id manquant",
            args: [
                "mission",
                "ticket",
                "move",
                "--root",
                rootDir,
                "--ticket-id",
                ticketId,
                "--to-front",
            ],
            expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket move`.",
        },
        {
            name: "ticket-id manquant",
            args: [
                "mission",
                "ticket",
                "move",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--to-front",
            ],
            expectedMessage: "L'option --ticket-id est obligatoire pour `corp mission ticket move`.",
        },
        {
            name: "strategie absente",
            args: [
                "mission",
                "ticket",
                "move",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--ticket-id",
                ticketId,
            ],
            expectedMessage: "Choisissez exactement une strategie de deplacement pour `corp mission ticket move`.",
        },
        {
            name: "plusieurs strategies",
            args: [
                "mission",
                "ticket",
                "move",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--ticket-id",
                ticketId,
                "--to-front",
                "--to-back",
            ],
            expectedMessage: "Choisissez exactement une strategie de deplacement pour `corp mission ticket move`.",
        },
    ];
    for (const testCase of cases) {
        const result = await runCommand(testCase.args);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.name}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.name}`);
    }
});
(0, node_test_1.default)("mission ticket move rejette les references inconnues, cross-mission, self-target et no-op", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-move-guards-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionA = await createMission(rootDir, "Mission A");
    const missionB = await createMission(rootDir, "Mission B");
    const ticketA1 = await createTicket(rootDir, missionA, "Ticket A1");
    const ticketA2 = await createTicket(rootDir, missionA, "Ticket A2");
    const ticketB1 = await createTicket(rootDir, missionB, "Ticket B1");
    const unknownReferenceResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionA,
        "--ticket-id",
        ticketA2,
        "--before-ticket",
        "ticket_inconnu",
    ]);
    strict_1.default.equal(unknownReferenceResult.exitCode, 1);
    strict_1.default.equal(unknownReferenceResult.lines.at(-1), `Le ticket de reference \`ticket_inconnu\` est introuvable dans la mission \`${missionA}\`.`);
    const selfTargetResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionA,
        "--ticket-id",
        ticketA1,
        "--after-ticket",
        ticketA1,
    ]);
    strict_1.default.equal(selfTargetResult.exitCode, 1);
    strict_1.default.equal(selfTargetResult.lines.at(-1), `Le ticket \`${ticketA1}\` ne peut pas etre deplace par rapport a lui-meme.`);
    const crossMissionReferenceResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionA,
        "--ticket-id",
        ticketA2,
        "--before-ticket",
        ticketB1,
    ]);
    strict_1.default.equal(crossMissionReferenceResult.exitCode, 1);
    strict_1.default.equal(crossMissionReferenceResult.lines.at(-1), `Le ticket de reference \`${ticketB1}\` n'appartient pas a la mission \`${missionA}\`.`);
    const noOpResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionA,
        "--ticket-id",
        ticketA1,
        "--to-front",
    ]);
    strict_1.default.equal(noOpResult.exitCode, 1);
    strict_1.default.equal(noOpResult.lines.at(-1), `Le ticket \`${ticketA1}\` est deja a cette position.`);
});
