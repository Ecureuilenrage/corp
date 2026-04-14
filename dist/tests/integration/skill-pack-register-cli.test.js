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
function getFixturePath(fileName) {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
}
async function bootstrapWorkspace(rootDir) {
    const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 0);
}
(0, node_test_1.default)("corp extension skill-pack register exige un workspace initialise", { concurrency: false }, async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-cli-uninitialized-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const registerResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-skill-pack.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 1);
    strict_1.default.match(registerResult.lines.join("\n"), /Workspace mission non initialise/i);
    await strict_1.default.rejects((0, promises_1.stat)(node_path_1.default.join(rootDir, ".corp")), /ENOENT/);
});
(0, node_test_1.default)("corp extension skill-pack register distingue un workspace ancien sans repertoire skill-packs", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-cli-legacy-"));
    const corpDir = node_path_1.default.join(rootDir, ".corp");
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "journal"), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "projections"), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "missions"), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "isolations"), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(corpDir, "capabilities"), { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(corpDir, "journal", "events.jsonl"), "", "utf8");
    const registerResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-skill-pack.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 1);
    strict_1.default.match(registerResult.lines.join("\n"), /repertoire skill-packs n'est pas initialise/i);
    strict_1.default.match(registerResult.lines.join("\n"), /corp mission bootstrap --root/i);
});
(0, node_test_1.default)("corp extension skill-pack register puis show restent metadata-first", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-cli-show-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const registerResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-skill-pack.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 0);
    strict_1.default.match(registerResult.lines.join("\n"), /Skill pack enregistre: pack\.triage\.local/);
    strict_1.default.match(registerResult.lines.join("\n"), /Statut: registered/);
    const storedSkillPack = await readJson(node_path_1.default.join(rootDir, ".corp", "skill-packs", "pack.triage.local", "skill-pack.json"));
    strict_1.default.equal(storedSkillPack.packRef, "pack.triage.local");
    strict_1.default.equal(storedSkillPack.displayName, "Pack de triage local");
    const showResult = await runCommand([
        "extension",
        "skill-pack",
        "show",
        "--root",
        rootDir,
        "--pack-ref",
        "pack.triage.local",
    ]);
    const showOutput = showResult.lines.join("\n");
    strict_1.default.equal(showResult.exitCode, 0);
    strict_1.default.match(showOutput, /Skill pack: pack\.triage\.local/);
    strict_1.default.match(showOutput, /Display name: Pack de triage local/);
    strict_1.default.match(showOutput, /Description: Declare un skill pack local pret a etre charge plus tard par le runtime\./);
    strict_1.default.match(showOutput, /Owner: core-platform/);
    strict_1.default.match(showOutput, /Tags: skill-pack, local/);
    strict_1.default.match(showOutput, /Root dir: .*triage-pack/i);
    strict_1.default.match(showOutput, /References: .*README\.md/i);
    strict_1.default.match(showOutput, /Metadata file: .*pack\.json/i);
    strict_1.default.match(showOutput, /Scripts: .*preflight\.sh/i);
    strict_1.default.match(showOutput, /Source manifest: .*valid-skill-pack\.json/i);
    strict_1.default.match(showOutput, /Registered at: /i);
    strict_1.default.doesNotMatch(showOutput, /Pack de triage local\./);
    strict_1.default.doesNotMatch(showOutput, /echo "preflight"/);
    const secondRegisterResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-skill-pack.json"),
    ]);
    strict_1.default.equal(secondRegisterResult.exitCode, 0);
    strict_1.default.match(secondRegisterResult.lines.join("\n"), /Statut: unchanged/);
});
(0, node_test_1.default)("corp extension skill-pack register rejette un seam hors scope et show echoue sur un pack inconnu", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-cli-errors-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const seamResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(seamResult.exitCode, 1);
    strict_1.default.match(seamResult.lines.join("\n"), /Seam non supporte.*capability/i);
    const showResult = await runCommand([
        "extension",
        "skill-pack",
        "show",
        "--root",
        rootDir,
        "--pack-ref",
        "pack.unknown",
    ]);
    strict_1.default.equal(showResult.exitCode, 1);
    strict_1.default.match(showResult.lines.join("\n"), /Skill pack introuvable.*pack\.unknown/i);
});
(0, node_test_1.default)("corp extension skill-pack register rejette une ref locale hors du rootDir du pack", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-cli-boundary-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const rootDir = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions"), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "skill-packs", "outside.md"), "outside\n", "utf8");
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "skill_pack",
        id: "ext.skill-pack.outside-root",
        displayName: "Pack hors frontiere",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Fixture de test hors frontiere.",
            owner: "core-platform",
            tags: ["skill-pack", "invalid"],
        },
        localRefs: {
            rootDir: "./skill-packs/triage-pack",
            references: ["./skill-packs/triage-pack/../outside.md"],
            metadataFile: "./skill-packs/triage-pack/pack.json",
            scripts: [],
        },
        skillPack: {
            packRef: "pack.outside.root",
        },
    }, null, 2)}\n`, "utf8");
    await bootstrapWorkspace(rootDir);
    const registerResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        node_path_1.default.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 1);
    strict_1.default.match(registerResult.lines.join("\n"), /frontiere locale/i);
});
