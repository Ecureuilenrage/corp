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
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const persisted_document_errors_1 = require("../../packages/storage/src/repositories/persisted-document-errors");
const file_mission_repository_1 = require("../../packages/storage/src/repositories/file-mission-repository");
function createMission(overrides = {}) {
    return {
        id: "mission_lock_test",
        title: "Mission lock test",
        objective: "Durcir saveIfUnchanged",
        status: "ready",
        successCriteria: ["Les locks sont sains"],
        policyProfileId: "policy_profile_local",
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: [],
        },
        ticketIds: [],
        artifactIds: [],
        eventIds: ["event_lock_1"],
        resumeCursor: "event_lock_1",
        createdAt: "2026-04-16T10:00:00.000Z",
        updatedAt: "2026-04-16T10:00:00.000Z",
        ...overrides,
    };
}
(0, node_test_1.default)("cleanupStaleMissionLocks supprime seulement les locks depassant le TTL", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lock-cleanup-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const staleLockPath = node_path_1.default.join(layout.missionsDir, "mission_stale", "mission.json.lock");
    const freshLockPath = node_path_1.default.join(layout.missionsDir, "mission_fresh", "mission.json.lock");
    const now = new Date("2026-04-16T12:00:00.000Z");
    const warnings = [];
    await (0, promises_1.mkdir)(node_path_1.default.dirname(staleLockPath), { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.dirname(freshLockPath), { recursive: true });
    await (0, promises_1.writeFile)(staleLockPath, "", "utf8");
    await (0, promises_1.writeFile)(freshLockPath, "", "utf8");
    await (0, promises_1.utimes)(staleLockPath, new Date("2026-04-16T11:00:00.000Z"), new Date("2026-04-16T11:00:00.000Z"));
    await (0, promises_1.utimes)(freshLockPath, new Date("2026-04-16T11:58:00.000Z"), new Date("2026-04-16T11:58:00.000Z"));
    const removedLockPaths = await (0, file_mission_repository_1.cleanupStaleMissionLocks)(layout, {
        lockStaleTtlMs: file_mission_repository_1.DEFAULT_MISSION_LOCK_STALE_TTL_MS,
        now: () => now,
        warn: (message) => warnings.push(message),
    });
    strict_1.default.deepEqual(removedLockPaths, [staleLockPath]);
    await strict_1.default.rejects(() => (0, promises_1.access)(staleLockPath), /ENOENT/);
    await (0, promises_1.access)(freshLockPath);
    strict_1.default.match(warnings.join("\n"), /Lock stale supprime pour la mission `mission_stale`/);
});
(0, node_test_1.default)("saveIfUnchanged preserve l'erreur primaire et ne laisse pas le lock en place si unlink echoue ensuite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lock-primary-error-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const initialMission = createMission();
    const updatedMission = createMission({
        title: "Mission mise a jour",
        resumeCursor: "event_lock_2",
        eventIds: ["event_lock_1", "event_lock_2"],
        updatedAt: "2026-04-16T10:05:00.000Z",
    });
    const missionPath = node_path_1.default.join(layout.missionsDir, initialMission.id, "mission.json");
    const lockPath = `${missionPath}.lock`;
    const warnings = [];
    const primaryError = Object.assign(new Error("ENOSPC: disk full"), { code: "ENOSPC" });
    await (0, file_mission_repository_1.createFileMissionRepository)(layout).save(initialMission);
    const repository = new file_mission_repository_1.FileMissionRepository(layout, {
        writeMissionJson: (async (..._args) => {
            throw primaryError;
        }),
        removeLockFile: (async (target) => {
            await (0, promises_1.unlink)(target);
            const secondaryError = new Error("EACCES: permission denied while releasing lock");
            secondaryError.code = "EACCES";
            throw secondaryError;
        }),
        warn: (message) => warnings.push(message),
    });
    await strict_1.default.rejects(() => repository.saveIfUnchanged(updatedMission, initialMission), (error) => error === primaryError);
    await strict_1.default.rejects(() => (0, promises_1.access)(lockPath), /ENOENT/);
    strict_1.default.match(warnings.join("\n"), /Liberation du lock mission echouee apres une erreur primaire/);
});
(0, node_test_1.default)("saveIfUnchanged propage une mission corrompue lue sous lock puis libere le lock", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lock-corrupted-read-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const mission = createMission({ id: "mission_corrupted_lock" });
    const missionPath = node_path_1.default.join(layout.missionsDir, mission.id, "mission.json");
    const lockPath = `${missionPath}.lock`;
    await (0, promises_1.mkdir)(node_path_1.default.dirname(missionPath), { recursive: true });
    await (0, promises_1.writeFile)(missionPath, "{json invalide\n", "utf8");
    await strict_1.default.rejects(() => (0, file_mission_repository_1.createFileMissionRepository)(layout).saveIfUnchanged(mission, mission), (error) => {
        strict_1.default.ok(error instanceof persisted_document_errors_1.CorruptedPersistedDocumentError);
        strict_1.default.equal(error.filePath, missionPath);
        return true;
    });
    await strict_1.default.rejects(() => (0, promises_1.access)(lockPath), /ENOENT/);
});
