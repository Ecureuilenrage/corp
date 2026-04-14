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
(0, node_test_1.default)("l'aide mission expose create en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission create/);
    strict_1.default.match(output, /cree une mission persistante/i);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("mission create rejette les parametres manquants avec des messages deterministes", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-create-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const cases = [
        {
            name: "titre manquant",
            args: [
                "mission",
                "create",
                "--root",
                rootDir,
                "--objective",
                "Poser une mission persistante",
                "--success-criterion",
                "Critere 1",
                "--policy-profile",
                "policy_profile_local",
            ],
            expectedMessage: "Le titre de mission est obligatoire.",
        },
        {
            name: "objectif manquant",
            args: [
                "mission",
                "create",
                "--root",
                rootDir,
                "--title",
                "Mission V1",
                "--success-criterion",
                "Critere 1",
                "--policy-profile",
                "policy_profile_local",
            ],
            expectedMessage: "L'objectif de mission est obligatoire.",
        },
        {
            name: "aucun critere de succes",
            args: [
                "mission",
                "create",
                "--root",
                rootDir,
                "--title",
                "Mission V1",
                "--objective",
                "Poser une mission persistante",
                "--policy-profile",
                "policy_profile_local",
            ],
            expectedMessage: "Au moins un critere de succes est obligatoire.",
        },
        {
            name: "policy profile vide",
            args: [
                "mission",
                "create",
                "--root",
                rootDir,
                "--title",
                "Mission V1",
                "--objective",
                "Poser une mission persistante",
                "--success-criterion",
                "Critere 1",
                "--policy-profile",
                "",
            ],
            expectedMessage: "Le policy profile initial est obligatoire.",
        },
    ];
    for (const testCase of cases) {
        const result = await runCommand(testCase.args);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.name}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.name}`);
    }
});
(0, node_test_1.default)("mission create echoue proprement si le workspace n'est pas initialise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-create-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission V1",
        "--objective",
        "Poser une mission persistante",
        "--success-criterion",
        "Critere 1",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission create\`.`);
});
