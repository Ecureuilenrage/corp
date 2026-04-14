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
const bootstrap_mission_workspace_1 = require("../../packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace");
(0, node_test_1.default)("le bootstrap cree un journal local et les projections V1 minimales de facon deterministe", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-bootstrap-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const result = await (0, bootstrap_mission_workspace_1.bootstrapMissionWorkspace)({ rootDir });
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const missionsDir = node_path_1.default.join(rootDir, ".corp", "missions");
    const isolationsDir = node_path_1.default.join(rootDir, ".corp", "isolations");
    const capabilitiesDir = node_path_1.default.join(rootDir, ".corp", "capabilities");
    const skillPacksDir = node_path_1.default.join(rootDir, ".corp", "skill-packs");
    strict_1.default.equal(result.rootDir, rootDir);
    strict_1.default.equal(result.journalPath, journalPath);
    strict_1.default.equal(result.missionsDir, missionsDir);
    strict_1.default.equal(result.isolationsDir, isolationsDir);
    strict_1.default.equal(result.capabilitiesDir, capabilitiesDir);
    strict_1.default.equal(result.skillPacksDir, skillPacksDir);
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), "");
    await (0, promises_1.access)(missionsDir);
    await (0, promises_1.access)(isolationsDir);
    await (0, promises_1.access)(capabilitiesDir);
    await (0, promises_1.access)(skillPacksDir);
    for (const [projectionName, expectedState] of Object.entries(bootstrap_mission_workspace_1.DEFAULT_PROJECTIONS)) {
        const projectionPath = node_path_1.default.join(rootDir, ".corp", "projections", `${projectionName}.json`);
        strict_1.default.deepEqual(JSON.parse(await (0, promises_1.readFile)(projectionPath, "utf8")), expectedState, `projection ${projectionName} should match the canonical bootstrap state`);
    }
});
(0, node_test_1.default)("le bootstrap reste idempotent avec l'extension du layout missions", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-bootstrap-idempotent-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const firstRun = await (0, bootstrap_mission_workspace_1.bootstrapMissionWorkspace)({ rootDir });
    const secondRun = await (0, bootstrap_mission_workspace_1.bootstrapMissionWorkspace)({ rootDir });
    strict_1.default.ok(firstRun.createdPaths.length > 0);
    strict_1.default.deepEqual(secondRun.createdPaths, []);
    await (0, promises_1.access)(node_path_1.default.join(rootDir, ".corp", "missions"));
    await (0, promises_1.access)(node_path_1.default.join(rootDir, ".corp", "isolations"));
    await (0, promises_1.access)(node_path_1.default.join(rootDir, ".corp", "capabilities"));
    await (0, promises_1.access)(node_path_1.default.join(rootDir, ".corp", "skill-packs"));
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"), "");
});
