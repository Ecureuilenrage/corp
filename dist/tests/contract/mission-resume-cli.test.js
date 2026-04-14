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
(0, node_test_1.default)("l'aide mission expose status, resume et ticket board en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission status --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /corp mission resume --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /corp mission ticket board --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /status = vue mission detaillee/i);
    strict_1.default.match(output, /resume = vue de reprise compacte/i);
    strict_1.default.match(output, /ticket board = supervision ticket par ticket/i);
    strict_1.default.doesNotMatch(output, /codex|openai|response_id|vendorStatus/i);
});
(0, node_test_1.default)("mission status et mission resume exigent un mission-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-resume-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const statusResult = await runCommand(["mission", "status", "--root", rootDir]);
    const resumeResult = await runCommand(["mission", "resume", "--root", rootDir]);
    strict_1.default.equal(statusResult.exitCode, 1);
    strict_1.default.equal(statusResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission status`.");
    strict_1.default.equal(resumeResult.exitCode, 1);
    strict_1.default.equal(resumeResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission resume`.");
});
(0, node_test_1.default)("mission status echoue proprement si la mission est inconnue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-status-unknown-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        "mission_inconnue",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});
(0, node_test_1.default)("mission resume echoue proprement si le workspace n'est pas initialise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-resume-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission resume\`.`);
});
(0, node_test_1.default)("mission resume affiche explicitement l'absence de blocage connu en francais", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-resume-blockage-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const createResult = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission reprise CLI",
        "--objective",
        "Afficher un resume de reprise lisible",
        "--success-criterion",
        "Le blocage connu est explicite",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const missionId = String(createResult.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length));
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const output = resumeResult.lines.join("\n");
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(output, /Dernier blocage connu: aucun/);
    strict_1.default.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_action/i);
});
