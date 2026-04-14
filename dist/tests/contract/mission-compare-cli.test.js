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
(0, node_test_1.default)("l'aide mission expose compare et compare relaunch sans detourner la relance globale", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission compare --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /corp mission compare relaunch --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id> \[--background\]/);
    strict_1.default.match(output, /compare = diagnostic attendu \/ observe et branche impactee/i);
    strict_1.default.match(output, /compare relaunch = relance ciblee de la racine selectionnee/i);
    strict_1.default.match(output, /relaunch = relance globale du cycle de vie mission/i);
    strict_1.default.doesNotMatch(output, /codex|openai|responseId|pollCursor|vendorStatus|requires_action/i);
});
(0, node_test_1.default)("mission compare et mission compare relaunch exigent les options requises", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-compare-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const compareResult = await runCommand(["mission", "compare", "--root", rootDir]);
    const compareRelaunchWithoutMission = await runCommand([
        "mission",
        "compare",
        "relaunch",
        "--root",
        rootDir,
    ]);
    const compareRelaunchWithoutTicket = await runCommand([
        "mission",
        "compare",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        "mission_demo",
    ]);
    strict_1.default.equal(compareResult.exitCode, 1);
    strict_1.default.equal(compareResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission compare`.");
    strict_1.default.equal(compareRelaunchWithoutMission.exitCode, 1);
    strict_1.default.equal(compareRelaunchWithoutMission.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission compare relaunch`.");
    strict_1.default.equal(compareRelaunchWithoutTicket.exitCode, 1);
    strict_1.default.equal(compareRelaunchWithoutTicket.lines.at(-1), "L'option --ticket-id est obligatoire pour `corp mission compare relaunch`.");
});
(0, node_test_1.default)("mission compare relaunch echoue proprement si le workspace n'est pas initialise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-compare-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await runCommand([
        "mission",
        "compare",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        "mission_demo",
        "--ticket-id",
        "ticket_demo",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission compare relaunch\`.`);
});
