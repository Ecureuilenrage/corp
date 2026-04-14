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
(0, node_test_1.default)("l'aide mission expose audit et audit show en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission audit --root <workspace> --mission-id <mission_id> \[--ticket-id <ticket_id>\] \[--limit <n>\]/);
    strict_1.default.match(output, /corp mission audit show --root <workspace> --mission-id <mission_id> --event-id <event_id>/);
    strict_1.default.match(output, /audit = chronologie structuree mission-centrique/i);
    strict_1.default.match(output, /audit show = detail d'un evenement et de ses correlations/i);
    strict_1.default.doesNotMatch(output, /openai|response_id|responseId|vendorStatus|threadId|pollCursor/i);
});
(0, node_test_1.default)("mission audit et mission audit show exigent les identifiants obligatoires et valident --limit", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-audit-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const auditWithoutMission = await runCommand([
        "mission",
        "audit",
        "--root",
        rootDir,
    ]);
    const auditWithInvalidLimit = await runCommand([
        "mission",
        "audit",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--limit",
        "0",
    ]);
    const auditShowWithoutMission = await runCommand([
        "mission",
        "audit",
        "show",
        "--root",
        rootDir,
    ]);
    const auditShowWithoutEvent = await runCommand([
        "mission",
        "audit",
        "show",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
    ]);
    strict_1.default.equal(auditWithoutMission.exitCode, 1);
    strict_1.default.equal(auditWithoutMission.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission audit`.");
    strict_1.default.equal(auditWithInvalidLimit.exitCode, 1);
    strict_1.default.equal(auditWithInvalidLimit.lines.at(-1), "L'option --limit doit etre un entier strictement positif pour `corp mission audit`.");
    strict_1.default.equal(auditShowWithoutMission.exitCode, 1);
    strict_1.default.equal(auditShowWithoutMission.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission audit show`.");
    strict_1.default.equal(auditShowWithoutEvent.exitCode, 1);
    strict_1.default.equal(auditShowWithoutEvent.lines.at(-1), "L'option --event-id est obligatoire pour `corp mission audit show`.");
});
