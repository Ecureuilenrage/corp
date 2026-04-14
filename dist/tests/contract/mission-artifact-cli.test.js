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
async function createMission(rootDir) {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission artefacts",
        "--objective",
        "Rendre les sorties consultables",
        "--success-criterion",
        "Les artefacts sont visibles",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return line.slice("Mission creee: ".length);
}
(0, node_test_1.default)("l'aide mission expose artifact list et artifact show en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission artifact list --root <workspace> --mission-id <mission_id> \[--ticket-id <ticket_id>\]/);
    strict_1.default.match(output, /corp mission artifact show --root <workspace> --mission-id <mission_id> --artifact-id <artifact_id>/);
    strict_1.default.match(output, /artifact list = navigation mission-centrique des sorties/i);
    strict_1.default.match(output, /artifact show = detail d'un artefact et de sa provenance/i);
    strict_1.default.doesNotMatch(output, /openai|response_id|responseId|vendorStatus|sequenceNumber/i);
});
(0, node_test_1.default)("mission artifact list et mission artifact show exigent les identifiants obligatoires", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-artifact-guards-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const listResult = await runCommand([
        "mission",
        "artifact",
        "list",
        "--root",
        rootDir,
    ]);
    const showWithoutMissionResult = await runCommand([
        "mission",
        "artifact",
        "show",
        "--root",
        rootDir,
    ]);
    const showWithoutArtifactResult = await runCommand([
        "mission",
        "artifact",
        "show",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
    ]);
    strict_1.default.equal(listResult.exitCode, 1);
    strict_1.default.equal(listResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission artifact list`.");
    strict_1.default.equal(showWithoutMissionResult.exitCode, 1);
    strict_1.default.equal(showWithoutMissionResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission artifact show`.");
    strict_1.default.equal(showWithoutArtifactResult.exitCode, 1);
    strict_1.default.equal(showWithoutArtifactResult.lines.at(-1), "L'option --artifact-id est obligatoire pour `corp mission artifact show`.");
});
(0, node_test_1.default)("mission artifact list rejette un filtre ticket inconnu et mission artifact show echoue proprement si l'artefact manque", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-artifact-errors-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const listResult = await runCommand([
        "mission",
        "artifact",
        "list",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        "ticket_inconnu",
    ]);
    const showResult = await runCommand([
        "mission",
        "artifact",
        "show",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--artifact-id",
        "artifact_inconnu",
    ]);
    strict_1.default.equal(listResult.exitCode, 1);
    strict_1.default.equal(listResult.lines.at(-1), `Ticket introuvable dans la mission \`${missionId}\`: \`ticket_inconnu\`.`);
    strict_1.default.equal(showResult.exitCode, 1);
    strict_1.default.equal(showResult.lines.at(-1), `Artefact introuvable dans la mission \`${missionId}\`: \`artifact_inconnu\`.`);
});
