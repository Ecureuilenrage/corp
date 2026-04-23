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
(0, node_test_1.default)("la CLI expose la commande mission extension select dans l'aide globale", async () => {
    const lines = [];
    const exitCode = await (0, index_1.runCli)([], {
        writeLine: (line) => lines.push(line),
    });
    const output = lines.join("\n");
    strict_1.default.equal(exitCode, 0);
    strict_1.default.match(output, /corp mission extension select --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /corp extension skill-pack list --root <workspace>/);
});
(0, node_test_1.default)("mission extension select rejette les combinaisons incompatibles avant execution", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-cli-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const lines = [];
    const exitCode = await (0, index_1.runCli)([
        "mission",
        "extension",
        "select",
        "--root",
        rootDir,
        "--mission-id",
        "mission_demo",
        "--allow-capability",
        "shell.exec",
        "--clear-allow-capability",
    ], {
        writeLine: (line) => lines.push(line),
    });
    strict_1.default.equal(exitCode, 1);
    strict_1.default.equal(lines.at(-1), "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission extension select`.");
});
