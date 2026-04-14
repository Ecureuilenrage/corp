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
        "Mission ticket",
        "--objective",
        "Rendre la delegation explicite",
        "--success-criterion",
        "Les tickets sont persistants",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return line.slice("Mission creee: ".length);
}
(0, node_test_1.default)("l'aide mission expose mission ticket create en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission ticket create --root <workspace> --mission-id <mission_id> --kind <research\|plan\|implement\|review\|operate>/);
    strict_1.default.match(output, /cree un ticket delegable borne/i);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("mission ticket create rejette les parametres manquants avec des messages deterministes", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-create-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const cases = [
        {
            name: "mission-id manquant",
            args: [
                "mission",
                "ticket",
                "create",
                "--root",
                rootDir,
                "--kind",
                "implement",
                "--goal",
                "Livrer la delegation",
                "--owner",
                "agent_dev",
                "--success-criterion",
                "Le ticket est persiste",
            ],
            expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket create`.",
        },
        {
            name: "kind manquant",
            args: [
                "mission",
                "ticket",
                "create",
                "--root",
                rootDir,
                "--mission-id",
                "mission_123",
                "--goal",
                "Livrer la delegation",
                "--owner",
                "agent_dev",
                "--success-criterion",
                "Le ticket est persiste",
            ],
            expectedMessage: "L'option --kind est obligatoire pour `corp mission ticket create`.",
        },
        {
            name: "kind invalide",
            args: [
                "mission",
                "ticket",
                "create",
                "--root",
                rootDir,
                "--mission-id",
                "mission_123",
                "--kind",
                "ship",
                "--goal",
                "Livrer la delegation",
                "--owner",
                "agent_dev",
                "--success-criterion",
                "Le ticket est persiste",
            ],
            expectedMessage: "L'option --kind doit valoir `research`, `plan`, `implement`, `review` ou `operate` pour `corp mission ticket create`.",
        },
        {
            name: "goal manquant",
            args: [
                "mission",
                "ticket",
                "create",
                "--root",
                rootDir,
                "--mission-id",
                "mission_123",
                "--kind",
                "implement",
                "--owner",
                "agent_dev",
                "--success-criterion",
                "Le ticket est persiste",
            ],
            expectedMessage: "L'option --goal est obligatoire pour `corp mission ticket create`.",
        },
        {
            name: "owner manquant",
            args: [
                "mission",
                "ticket",
                "create",
                "--root",
                rootDir,
                "--mission-id",
                "mission_123",
                "--kind",
                "implement",
                "--goal",
                "Livrer la delegation",
                "--success-criterion",
                "Le ticket est persiste",
            ],
            expectedMessage: "L'option --owner est obligatoire pour `corp mission ticket create`.",
        },
        {
            name: "aucun critere de succes",
            args: [
                "mission",
                "ticket",
                "create",
                "--root",
                rootDir,
                "--mission-id",
                "mission_123",
                "--kind",
                "implement",
                "--goal",
                "Livrer la delegation",
                "--owner",
                "agent_dev",
            ],
            expectedMessage: "Au moins un `--success-criterion` est obligatoire pour `corp mission ticket create`.",
        },
    ];
    for (const testCase of cases) {
        const result = await runCommand(testCase.args);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.name}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.name}`);
    }
});
(0, node_test_1.default)("mission ticket create echoue proprement si le workspace n'est pas initialise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-create-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await runCommand([
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--kind",
        "implement",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission ticket create\`.`);
});
(0, node_test_1.default)("mission ticket create echoue proprement si la mission est inconnue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-create-unknown-mission-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_inconnue",
        "--kind",
        "implement",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});
(0, node_test_1.default)("mission ticket create refuse une mission terminale avec un message stable", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-create-terminal-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const closeResult = await runCommand([
        "mission",
        "close",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--outcome",
        "completed",
    ]);
    strict_1.default.equal(closeResult.exitCode, 0);
    const result = await runCommand([
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--kind",
        "implement",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Impossible de creer un ticket dans la mission \`${missionId}\` car son statut est terminal (\`completed\`).`);
});
