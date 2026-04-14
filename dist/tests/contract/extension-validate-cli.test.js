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
function getFixtureRoot() {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
}
(0, node_test_1.default)("la CLI racine expose la surface extension en plus du flux mission", async () => {
    const lines = [];
    const exitCode = await (0, index_1.runCli)([], {
        writeLine: (line) => lines.push(line),
    });
    const output = lines.join("\n");
    strict_1.default.equal(exitCode, 0);
    strict_1.default.match(output, /corp mission bootstrap/);
    strict_1.default.match(output, /corp extension validate --file <path>/);
    strict_1.default.match(output, /corp extension capability register --root <workspace> --file <path>/);
    strict_1.default.match(output, /corp extension skill-pack register --root <workspace> --file <path>/);
    strict_1.default.match(output, /corp extension skill-pack show --root <workspace> --pack-ref <ref>/);
    strict_1.default.doesNotMatch(output, /codex|openai|responseId|pollCursor|vendorStatus|apiKey/i);
});
(0, node_test_1.default)("corp extension validate fonctionne offline sans bootstrap mission ni creation de .corp", { concurrency: false }, async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-extension-cli-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const previousCwd = process.cwd();
    t.after(async () => {
        process.chdir(previousCwd);
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    process.chdir(tempDir);
    const lines = [];
    const exitCode = await (0, index_1.runCli)(["extension", "validate", "--file", node_path_1.default.join("fixtures", "extensions", "valid-skill-pack.json")], {
        writeLine: (line) => lines.push(line),
    });
    const output = lines.join("\n");
    strict_1.default.equal(exitCode, 0);
    strict_1.default.match(output, /Validation extension: ok/);
    strict_1.default.match(output, /Type de seam: skill_pack/);
    strict_1.default.match(output, /Pack public: pack\.triage\.local/);
    await strict_1.default.rejects((0, promises_1.stat)(node_path_1.default.join(tempDir, ".corp")), /ENOENT/);
});
(0, node_test_1.default)("corp extension validate rend des diagnostics lisibles sur un manifeste invalide", async () => {
    const lines = [];
    const exitCode = await (0, index_1.runCli)(["extension", "validate", "--file", node_path_1.default.join(getFixtureRoot(), "invalid-marketplace.json")], {
        writeLine: (line) => lines.push(line),
    });
    const output = lines.join("\n");
    strict_1.default.equal(exitCode, 1);
    strict_1.default.match(output, /Validation extension: echec/);
    strict_1.default.match(output, /out_of_scope_field/);
    strict_1.default.match(output, /marketplace/);
    strict_1.default.doesNotMatch(output, /responseId|threadId|pollCursor|vendorStatus|apiKey|token/i);
});
