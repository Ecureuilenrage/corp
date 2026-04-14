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
        "Mission approval queue",
        "--objective",
        "Afficher une file d'approbation mission-centrique",
        "--success-criterion",
        "La file est lisible",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return line.slice("Mission creee: ".length);
}
(0, node_test_1.default)("l'aide mission expose approval queue et les decisions sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission approval queue --root <workspace> --mission-id <mission_id>/);
    strict_1.default.match(output, /approval queue = file detaillee des validations en attente/i);
    strict_1.default.match(output, /corp mission approval approve --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/);
    strict_1.default.match(output, /corp mission approval reject --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/);
    strict_1.default.match(output, /corp mission approval defer --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/);
    strict_1.default.doesNotMatch(output, /codex|openai|response_id|vendorStatus/i);
});
(0, node_test_1.default)("mission approval queue exige un mission-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-approval-queue-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand([
        "mission",
        "approval",
        "queue",
        "--root",
        rootDir,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission approval queue`.");
});
(0, node_test_1.default)("mission approval queue affiche explicitement une file vide", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-approval-queue-empty-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const result = await runCommand([
        "mission",
        "approval",
        "queue",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, new RegExp(`Mission: ${missionId}`));
    strict_1.default.match(output, /File d'approbation:/);
    strict_1.default.match(output, /Aucune validation en attente\./);
    strict_1.default.doesNotMatch(output, /codex|openai|response_id|vendorStatus/i);
});
(0, node_test_1.default)("mission approval approve|reject|defer exigent un mission-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-approval-decision-mission-id-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    for (const commandName of ["approve", "reject", "defer"]) {
        const result = await runCommand([
            "mission",
            "approval",
            commandName,
            "--root",
            rootDir,
            "--approval-id",
            "approval_demo",
        ]);
        strict_1.default.equal(result.exitCode, 1);
        strict_1.default.equal(result.lines.at(-1), `L'option --mission-id est obligatoire pour \`corp mission approval ${commandName}\`.`);
    }
});
(0, node_test_1.default)("mission approval approve|reject|defer exigent un approval-id explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-approval-decision-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    for (const commandName of ["approve", "reject", "defer"]) {
        const result = await runCommand([
            "mission",
            "approval",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
        ]);
        strict_1.default.equal(result.exitCode, 1);
        strict_1.default.equal(result.lines.at(-1), `L'option --approval-id est obligatoire pour \`corp mission approval ${commandName}\`.`);
    }
});
(0, node_test_1.default)("mission approval approve|reject|defer conservent les incompatibilites explicites sur les garde-fous", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-approval-decision-conflicts-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const scenarios = [
        {
            commandName: "approve",
            extraArgs: ["--allow-capability", "fs.read", "--clear-allow-capability"],
            expected: "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission approval approve`.",
        },
        {
            commandName: "reject",
            extraArgs: ["--skill-pack", "pack.audit", "--clear-skill-pack"],
            expected: "Les options `--skill-pack` et `--clear-skill-pack` sont incompatibles pour `corp mission approval reject`.",
        },
        {
            commandName: "defer",
            extraArgs: ["--allow-capability", "cli.run", "--clear-allow-capability"],
            expected: "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission approval defer`.",
        },
    ];
    for (const scenario of scenarios) {
        const result = await runCommand([
            "mission",
            "approval",
            scenario.commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
            "--approval-id",
            "approval_demo",
            ...scenario.extraArgs,
        ]);
        strict_1.default.equal(result.exitCode, 1);
        strict_1.default.equal(result.lines.at(-1), scenario.expected);
    }
});
