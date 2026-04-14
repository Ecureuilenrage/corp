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
async function readJson(filePath) {
    return JSON.parse(await (0, promises_1.readFile)(filePath, "utf8"));
}
function getFixtureRoot() {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
}
function getFixturePath(fileName) {
    return node_path_1.default.join(getFixtureRoot(), fileName);
}
async function bootstrapWorkspace(rootDir) {
    const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 0);
}
(0, node_test_1.default)("corp extension capability register exige un workspace initialise et preserve validate en lecture seule", { concurrency: false }, async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-cli-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const registerResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 1);
    strict_1.default.match(registerResult.lines.join("\n"), /Workspace mission non initialise/i);
    await strict_1.default.rejects((0, promises_1.stat)(node_path_1.default.join(rootDir, ".corp")), /ENOENT/);
    const validateResult = await runCommand([
        "extension",
        "validate",
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(validateResult.exitCode, 0);
    strict_1.default.match(validateResult.lines.join("\n"), /Validation extension: ok/);
    await strict_1.default.rejects((0, promises_1.stat)(node_path_1.default.join(rootDir, ".corp")), /ENOENT/);
});
(0, node_test_1.default)("corp extension capability register distingue un workspace ancien sans repertoire capabilities", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-cli-legacy-workspace-"));
    const corpDir = node_path_1.default.join(rootDir, ".corp");
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "journal"), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "projections"), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "missions"), { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(corpDir, "journal", "events.jsonl"), "", "utf8");
    const registerResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 1);
    strict_1.default.match(registerResult.lines.join("\n"), /repertoire capabilities n'est pas initialise/i);
    strict_1.default.match(registerResult.lines.join("\n"), /corp mission bootstrap --root/i);
    await bootstrapWorkspace(rootDir);
    const retryResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(retryResult.exitCode, 0);
    strict_1.default.match(retryResult.lines.join("\n"), /Capability enregistree: shell\.exec/);
});
(0, node_test_1.default)("corp extension capability register enregistre les providers local et mcp de facon deterministe", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-cli-register-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const localResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    const localOutput = localResult.lines.join("\n");
    const localStored = await readJson(node_path_1.default.join(rootDir, ".corp", "capabilities", "shell.exec", "capability.json"));
    strict_1.default.equal(localResult.exitCode, 0);
    strict_1.default.match(localOutput, /Capability enregistree: shell\.exec/);
    strict_1.default.match(localOutput, /Statut: registered/);
    strict_1.default.equal(localStored.capabilityId, "shell.exec");
    strict_1.default.equal(localStored.provider, "local");
    const secondLocalResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(secondLocalResult.exitCode, 0);
    strict_1.default.match(secondLocalResult.lines.join("\n"), /Statut: unchanged/);
    const mcpResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-mcp.json"),
    ]);
    const mcpOutput = mcpResult.lines.join("\n");
    const mcpStored = await readJson(node_path_1.default.join(rootDir, ".corp", "capabilities", "docs.search", "capability.json"));
    strict_1.default.equal(mcpResult.exitCode, 0);
    strict_1.default.match(mcpOutput, /Capability enregistree: docs\.search/);
    strict_1.default.equal(mcpStored.capabilityId, "docs.search");
    strict_1.default.deepEqual(mcpStored.mcp, {
        serverName: "corp-mcp",
        toolName: "search_local_docs",
    });
    strict_1.default.doesNotMatch(JSON.stringify(mcpStored), /enabled_tools|disabled_tools|tool_timeout_sec|token|secret|apiKey/i);
});
(0, node_test_1.default)("corp extension capability register rejette un seam hors scope et une collision ambigue", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-cli-collision-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const rootDir = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "valid-capability-local-conflict.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "capability",
        id: "ext.capability.shell.exec.alt",
        displayName: "Shell exec local alt",
        version: "0.1.0",
        permissions: ["shell.exec"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Manifeste de test pour collision.",
            owner: "core-platform",
            tags: ["capability", "local"],
        },
        localRefs: {
            rootDir: ".",
            entrypoint: "./capabilities/shell-exec.ts",
            references: ["./docs/capability-local.md"],
            scripts: [],
        },
        capability: {
            capabilityId: "shell.exec",
            provider: "local",
            approvalSensitive: false,
            requiredEnvNames: [],
        },
    }, null, 2)}\n`, "utf8");
    await bootstrapWorkspace(rootDir);
    const seamResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-skill-pack.json"),
    ]);
    strict_1.default.equal(seamResult.exitCode, 1);
    strict_1.default.match(seamResult.lines.join("\n"), /Seam non supporte.*skill_pack/i);
    const firstRegister = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        node_path_1.default.join(copiedFixturesDir, "valid-capability-local.json"),
    ]);
    const conflictRegister = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        node_path_1.default.join(copiedFixturesDir, "valid-capability-local-conflict.json"),
    ]);
    strict_1.default.equal(firstRegister.exitCode, 0);
    strict_1.default.equal(conflictRegister.exitCode, 1);
    strict_1.default.match(conflictRegister.lines.join("\n"), /Collision ambigue.*shell\.exec/i);
});
(0, node_test_1.default)("corp extension capability affiche l'aide et retourne 1 pour une sous-commande inconnue", async () => {
    const result = await runCommand([
        "extension",
        "capability",
        "list",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.match(result.lines.join("\n"), /Commande extension capability inconnue: list/i);
    strict_1.default.match(result.lines.join("\n"), /corp extension <commande>/i);
});
