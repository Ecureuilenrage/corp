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
async function createMission(rootDir) {
    const bootstrap = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(bootstrap.exitCode, 0);
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission defensive CLI",
        "--objective",
        "Verifier les diagnostics de lecture",
        "--success-criterion",
        "Le journal manquant reste explicite",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const missionLine = result.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionLine);
    return missionLine.slice("Mission creee: ".length);
}
(0, node_test_1.default)("les commandes mission-centriques diagnostiquent events.jsonl manquant sans fallback trompeur", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-defensive-cli-missing-journal-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const missionId = await createMission(rootDir);
    await (0, promises_1.unlink)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"));
    const commands = [
        ["mission", "status", "--root", rootDir, "--mission-id", missionId],
        ["mission", "resume", "--root", rootDir, "--mission-id", missionId],
        ["mission", "audit", "--root", rootDir, "--mission-id", missionId],
        ["mission", "approval", "queue", "--root", rootDir, "--mission-id", missionId],
        ["mission", "artifact", "list", "--root", rootDir, "--mission-id", missionId],
        ["mission", "ticket", "board", "--root", rootDir, "--mission-id", missionId],
    ];
    for (const args of commands) {
        const result = await runCommand(args);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 1, args.join(" "));
        strict_1.default.match(output, /journal_manquant|journal append-only manquant/i);
        strict_1.default.match(output, /relancez.*bootstrap|restaurez le journal/i);
        strict_1.default.doesNotMatch(output, /Workspace mission non initialise/i);
        strict_1.default.doesNotMatch(output, /Projection .*irreconciliable/i);
        strict_1.default.doesNotMatch(output, /Mission introuvable/i);
        strict_1.default.doesNotMatch(output, /SyntaxError|^\s*at\s/m);
    }
});
