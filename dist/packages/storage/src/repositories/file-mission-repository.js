"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMissionRepository = exports.DEFAULT_MISSION_LOCK_STALE_TTL_MS = void 0;
exports.createFileMissionRepository = createFileMissionRepository;
exports.cleanupStaleMissionLocks = cleanupStaleMissionLocks;
exports.areMissionSnapshotsEqual = areMissionSnapshotsEqual;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const mission_1 = require("../../../contracts/src/mission/mission");
const atomic_json_1 = require("../fs-layout/atomic-json");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const persisted_document_errors_1 = require("./persisted-document-errors");
exports.DEFAULT_MISSION_LOCK_STALE_TTL_MS = 5 * 60 * 1000;
const MISSION_LOCK_STALE_TTL_ENV_VAR = "CORP_MISSION_LOCK_STALE_TTL_MS";
class FileMissionRepository {
    layout;
    dependencies;
    constructor(layout, dependencies = {}) {
        this.layout = layout;
        this.dependencies = resolveRepositoryDependencies(dependencies);
    }
    async save(mission) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, mission.id);
        await this.dependencies.mkdir(missionStoragePaths.missionDir, { recursive: true });
        await this.dependencies.writeMissionJson(missionStoragePaths.missionPath, mission);
        return missionStoragePaths;
    }
    async saveIfUnchanged(mission, expectedMission, beforeSave) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, mission.id);
        const lockPath = resolveMissionLockPath(missionStoragePaths.missionPath);
        await this.dependencies.mkdir(missionStoragePaths.missionDir, { recursive: true });
        await removeStaleMissionLockIfNeeded(lockPath, mission.id, this.dependencies);
        try {
            await this.dependencies.createLockFile(lockPath, "", {
                encoding: "utf8",
                flag: "wx",
            });
        }
        catch (error) {
            if ((0, atomic_json_1.isAlreadyExistsError)(error)) {
                throw new Error(`Conflit d'ecriture concurrente detecte pour la mission \`${mission.id}\`.`);
            }
            throw error;
        }
        let primaryError;
        try {
            const currentMission = await this.findById(mission.id);
            if (!currentMission || !areMissionSnapshotsEqual(currentMission, expectedMission)) {
                throw new Error(`Conflit d'ecriture concurrente detecte pour la mission \`${mission.id}\`.`);
            }
            // journal-as-source-of-truth : la callback beforeSave execute l'append au journal
            // (et, le cas echeant, la reconstruction des read-models sous lock). Si le
            // writeJsonAtomic suivant echoue, le journal contient deja la decision et le
            // prochain reader reconstruira l'etat via reconstructMissionFromJournal.
            // Voir docs/architecture/journal-as-source-of-truth.md.
            await beforeSave?.();
            await this.dependencies.writeMissionJson(missionStoragePaths.missionPath, mission);
            return missionStoragePaths;
        }
        catch (error) {
            primaryError = error;
            throw error;
        }
        finally {
            await releaseMissionLock(lockPath, mission.id, primaryError, this.dependencies);
        }
    }
    async findById(missionId) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, missionId);
        const context = {
            filePath: missionStoragePaths.missionPath,
            entityLabel: "Mission",
            documentId: missionId,
        };
        try {
            const storedMission = await (0, persisted_document_errors_1.readPersistedJsonDocument)(context);
            const warnings = [];
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedMission, (value) => (0, persisted_document_guards_1.validateMission)(value, { strict: false, warnings }), context);
            return (0, persisted_document_guards_1.attachStructuralValidationWarnings)((0, mission_1.hydrateMission)(storedMission), warnings);
        }
        catch (error) {
            if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
                return null;
            }
            throw error;
        }
    }
}
exports.FileMissionRepository = FileMissionRepository;
function createFileMissionRepository(layout) {
    return new FileMissionRepository(layout);
}
async function cleanupStaleMissionLocks(layout, options = {}) {
    const removedLockPaths = [];
    const missionEntries = await readDirectoryEntries(layout.missionsDir);
    const dependencies = resolveRepositoryDependencies(options);
    for (const missionEntry of missionEntries) {
        if (!missionEntry.isDirectory()) {
            continue;
        }
        const lockPath = node_path_1.default.join(layout.missionsDir, missionEntry.name, "mission.json.lock");
        if (await removeStaleMissionLockIfNeeded(lockPath, missionEntry.name, dependencies)) {
            removedLockPaths.push(lockPath);
        }
    }
    return removedLockPaths;
}
function areMissionSnapshotsEqual(left, right) {
    // Compare sous forme canonique (cles triees recursivement) pour que deux missions
    // logiquement egales mais hydratees par des chemins distincts (lecture disque vs
    // reconstruction programmatique) restent equivalentes sans changer le contrat persiste.
    return (0, node_util_1.isDeepStrictEqual)(canonicalize(left), canonicalize(right));
}
function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map((item) => canonicalize(item));
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (value instanceof Map || value instanceof Set) {
        throw new TypeError("Map/Set non supportes dans les snapshots mission.");
    }
    if (typeof value !== "object" || value === null) {
        return value;
    }
    const sortedRecord = {};
    const sortedKeys = Object.keys(value).sort();
    for (const key of sortedKeys) {
        const nextValue = value[key];
        if (nextValue === undefined) {
            continue;
        }
        sortedRecord[key] = canonicalize(nextValue);
    }
    return sortedRecord;
}
function resolveRepositoryDependencies(dependencies) {
    const repositoryDependencies = dependencies;
    return {
        mkdir: repositoryDependencies.mkdir ?? promises_1.mkdir,
        createLockFile: repositoryDependencies.createLockFile ?? promises_1.writeFile,
        removeLockFile: repositoryDependencies.removeLockFile ?? promises_1.unlink,
        readLockStat: repositoryDependencies.readLockStat ?? promises_1.stat,
        writeMissionJson: repositoryDependencies.writeMissionJson ?? atomic_json_1.writeJsonAtomic,
        warn: dependencies.warn ?? ((message) => console.warn(message)),
        now: dependencies.now ?? (() => new Date()),
        lockStaleTtlMs: resolveMissionLockStaleTtlMs(dependencies.lockStaleTtlMs),
    };
}
function resolveMissionLockPath(missionPath) {
    return `${missionPath}.lock`;
}
function resolveMissionLockStaleTtlMs(override) {
    if (typeof override === "number" && Number.isFinite(override) && override > 0) {
        return override;
    }
    const rawValue = process.env[MISSION_LOCK_STALE_TTL_ENV_VAR];
    const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;
    return Number.isFinite(parsedValue) && parsedValue > 0
        ? parsedValue
        : exports.DEFAULT_MISSION_LOCK_STALE_TTL_MS;
}
async function removeStaleMissionLockIfNeeded(lockPath, missionId, dependencies) {
    try {
        const lockStats = await dependencies.readLockStat(lockPath);
        if (!isMissionLockStale(lockStats.mtimeMs, dependencies)) {
            return false;
        }
        await dependencies.removeLockFile(lockPath);
        dependencies.warn(`Lock stale supprime pour la mission \`${missionId}\`: ${lockPath}.`);
        return true;
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            return false;
        }
        throw error;
    }
}
function isMissionLockStale(mtimeMs, dependencies) {
    return dependencies.now().getTime() - mtimeMs >= dependencies.lockStaleTtlMs;
}
async function releaseMissionLock(lockPath, missionId, primaryError, dependencies) {
    try {
        await dependencies.removeLockFile(lockPath);
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            return;
        }
        if (primaryError !== undefined) {
            dependencies.warn(`Liberation du lock mission echouee apres une erreur primaire pour \`${missionId}\`: ${String(error)}.`);
            return;
        }
        throw error;
    }
}
async function readDirectoryEntries(directoryPath) {
    try {
        return await (0, promises_1.readdir)(directoryPath, { withFileTypes: true, encoding: "utf8" });
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            return [];
        }
        throw error;
    }
}
