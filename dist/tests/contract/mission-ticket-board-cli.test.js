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
const read_ticket_board_1 = require("../../packages/ticket-runtime/src/planner/read-ticket-board");
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
        "Mission board vide",
        "--objective",
        "Verifier le message board vide",
        "--success-criterion",
        "Le board reste lisible sans ticket",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return line.slice("Mission creee: ".length);
}
(0, node_test_1.default)("mission ticket board exige un mission-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-board-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand(["mission", "ticket", "board", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission ticket board`.");
});
(0, node_test_1.default)("mission ticket board echoue proprement si le workspace n'est pas initialise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-board-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission ticket board\`.`);
});
(0, node_test_1.default)("mission ticket board echoue proprement si la mission est inconnue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-board-unknown-mission-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        "mission_inconnue",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});
(0, node_test_1.default)("mission ticket board annonce explicitement un board vide", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-board-empty-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), /Aucun ticket n'existe encore\./);
});
(0, node_test_1.default)("mission ticket board classe une erreur OS issue de readMissionEvents sans fuite EACCES brute", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-board-journal-eacces-"));
    t.after(async () => {
        (0, read_ticket_board_1.setReadTicketBoardDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    (0, read_ticket_board_1.setReadTicketBoardDependenciesForTesting)({
        readMissionEvents: async () => {
            const error = new Error("EACCES: permission denied, open events.jsonl");
            error.code = "EACCES";
            throw error;
        },
    });
    const result = await runCommand([
        "mission",
        "ticket",
        "board",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.match(result.lines.at(-1) ?? "", /erreur_fichier: erreur de lecture journal append-only \(EACCES\)/i);
    strict_1.default.doesNotMatch(result.lines.at(-1) ?? "", /^EACCES:/);
});
