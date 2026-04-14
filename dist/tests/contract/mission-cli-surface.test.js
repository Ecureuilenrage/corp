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
const package_json_1 = __importDefault(require("../../package.json"));
const index_1 = require("../../apps/corp-cli/src/index");
(0, node_test_1.default)("le binaire corp pointe vers l'entree CLI dediee", () => {
    strict_1.default.equal(package_json_1.default.bin.corp, "dist/apps/corp-cli/src/index.js");
});
(0, node_test_1.default)("la CLI expose une entree mission-centrique sans fuite vendor", async () => {
    const lines = [];
    const exitCode = await (0, index_1.runCli)([], {
        writeLine: (line) => lines.push(line),
    });
    const output = lines.join("\n");
    strict_1.default.equal(exitCode, 0);
    strict_1.default.match(output, /corp mission bootstrap/);
    strict_1.default.match(output, /corp mission create/);
    strict_1.default.match(output, /corp mission ticket create/);
    strict_1.default.match(output, /corp mission ticket run/);
    strict_1.default.match(output, /corp mission audit/);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("la commande mission bootstrap initialise le socle local-first", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-bootstrap-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const lines = [];
    const exitCode = await (0, index_1.runCli)(["mission", "bootstrap", "--root", rootDir], {
        writeLine: (line) => lines.push(line),
    });
    strict_1.default.equal(exitCode, 0);
    strict_1.default.match(lines.join("\n"), /socle mission/i);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"), "");
});
