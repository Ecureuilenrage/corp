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
(0, node_test_1.default)("l'aide mission expose pause relaunch et close sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission pause --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /corp mission relaunch --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /corp mission close --root <workspace> --mission-id <mission_id> --outcome <completed\|cancelled>/);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("mission pause et mission relaunch exigent un mission-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-lifecycle-mission-id-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const pauseResult = await runCommand(["mission", "pause", "--root", rootDir]);
    const relaunchResult = await runCommand(["mission", "relaunch", "--root", rootDir]);
    strict_1.default.equal(pauseResult.exitCode, 1);
    strict_1.default.equal(pauseResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission pause`.");
    strict_1.default.equal(relaunchResult.exitCode, 1);
    strict_1.default.equal(relaunchResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission relaunch`.");
});
(0, node_test_1.default)("mission close exige un outcome explicite et valide", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-lifecycle-close-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missingOutcomeResult = await runCommand([
        "mission",
        "close",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
    ]);
    const invalidOutcomeResult = await runCommand([
        "mission",
        "close",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--outcome",
        "closed",
    ]);
    strict_1.default.equal(missingOutcomeResult.exitCode, 1);
    strict_1.default.equal(missingOutcomeResult.lines.at(-1), "L'option --outcome est obligatoire pour `corp mission close`.");
    strict_1.default.equal(invalidOutcomeResult.exitCode, 1);
    strict_1.default.equal(invalidOutcomeResult.lines.at(-1), "L'option --outcome doit valoir `completed` ou `cancelled` pour `corp mission close`.");
});
(0, node_test_1.default)("mission pause echoue proprement si le workspace n'est pas initialise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-lifecycle-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission pause\`.`);
});
(0, node_test_1.default)("mission close exige un mission-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-lifecycle-close-mission-id-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand([
        "mission",
        "close",
        "--root",
        rootDir,
        "--outcome",
        "completed",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission close`.");
});
(0, node_test_1.default)("mission relaunch echoue proprement si la mission est inconnue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-lifecycle-unknown-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand([
        "mission",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        "mission_inconnue",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});
