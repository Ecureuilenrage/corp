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
const register_skill_pack_1 = require("../../packages/skill-pack/src/loader/register-skill-pack");
const run_ticket_1 = require("../../packages/ticket-runtime/src/ticket-service/run-ticket");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const file_skill_pack_registry_repository_1 = require("../../packages/storage/src/repositories/file-skill-pack-registry-repository");
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
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
function getFixturePath(fileName) {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
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
        "Mission skill pack runtime",
        "--objective",
        "Verifier le chargement runtime d'un skill pack local",
        "--success-criterion",
        "Le ticket recoit un resume de skill pack",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const missionId = String(result.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length));
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    const mission = await readJson(missionPath);
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({
        ...mission,
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: ["pack.triage.local"],
        },
    }, null, 2)}\n`, "utf8");
    return readJson(missionPath);
}
async function createTicket(rootDir, missionId, extraArgs = []) {
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
        "Executer un ticket avec skill pack",
        "--owner",
        "agent_skill_pack",
        "--success-criterion",
        "Le skill pack est resolu",
        ...extraArgs,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    return String(result.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
}
(0, node_test_1.default)("mission ticket run echoue avant execution externe quand un skill pack reference est absent du registre", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-skill-pack-missing-"));
    let launchCount = 0;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, [
        "--skill-pack",
        "pack.triage.local",
    ]);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async () => {
                launchCount += 1;
                return {
                    status: "completed",
                    adapterState: {},
                };
            },
        }),
    });
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
    ]);
    const journal = await readJournal(rootDir);
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(launchCount, 0);
    strict_1.default.match(runResult.lines.join("\n"), /Skill pack introuvable.*pack\.triage\.local/i);
    strict_1.default.deepEqual(journal.map((event) => event.type), ["mission.created", "ticket.created"]);
});
(0, node_test_1.default)("mission ticket run transmet un resume de skill pack resolu a l'adaptateur sans charger le contenu des fichiers", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-skill-pack-summary-"));
    let capturedSkillPacks = null;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    await (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-13T20:40:00.000Z",
    });
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, [
        "--skill-pack",
        "pack.triage.local",
    ]);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async (options) => {
                capturedSkillPacks = options.resolvedSkillPacks;
                return {
                    status: "completed",
                    adapterState: {},
                };
            },
        }),
    });
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    strict_1.default.deepEqual(capturedSkillPacks, [
        {
            packRef: "pack.triage.local",
            displayName: "Pack de triage local",
            description: "Declare un skill pack local pret a etre charge plus tard par le runtime.",
            owner: "core-platform",
            tags: ["skill-pack", "local"],
            rootDir: node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack"),
            references: [
                node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack", "README.md"),
            ],
            metadataFile: node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack", "pack.json"),
            scripts: [
                node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack", "scripts", "preflight.sh"),
            ],
        },
    ]);
    strict_1.default.doesNotMatch(JSON.stringify(capturedSkillPacks), /Pack de triage local\.|echo "preflight"/);
});
(0, node_test_1.default)("mission ticket run conserve un contexte vide quand aucun skill pack n'est reference", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-run-ticket-skill-pack-empty-"));
    let capturedSkillPacks = null;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async (options) => {
                capturedSkillPacks = options.resolvedSkillPacks;
                return {
                    status: "completed",
                    adapterState: {},
                };
            },
        }),
    });
    const runResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    strict_1.default.deepEqual(capturedSkillPacks, []);
});
