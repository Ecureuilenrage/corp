"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMissionRepository = void 0;
exports.createFileMissionRepository = createFileMissionRepository;
exports.areMissionSnapshotsEqual = areMissionSnapshotsEqual;
const promises_1 = require("node:fs/promises");
const node_util_1 = require("node:util");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const mission_1 = require("../../../contracts/src/mission/mission");
const atomic_json_1 = require("../fs-layout/atomic-json");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const persisted_document_errors_1 = require("./persisted-document-errors");
class FileMissionRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(mission) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, mission.id);
        await (0, promises_1.mkdir)(missionStoragePaths.missionDir, { recursive: true });
        await (0, atomic_json_1.writeJsonAtomic)(missionStoragePaths.missionPath, mission);
        return missionStoragePaths;
    }
    async saveIfUnchanged(mission, expectedMission, beforeSave) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, mission.id);
        const lockPath = `${missionStoragePaths.missionPath}.lock`;
        await (0, promises_1.mkdir)(missionStoragePaths.missionDir, { recursive: true });
        try {
            await (0, promises_1.writeFile)(lockPath, "", { encoding: "utf8", flag: "wx" });
        }
        catch (error) {
            if ((0, atomic_json_1.isAlreadyExistsError)(error)) {
                throw new Error(`Conflit d'ecriture concurrente detecte pour la mission \`${mission.id}\`.`);
            }
            throw error;
        }
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
            await (0, atomic_json_1.writeJsonAtomic)(missionStoragePaths.missionPath, mission);
            return missionStoragePaths;
        }
        finally {
            try {
                await (0, promises_1.unlink)(lockPath);
            }
            catch (error) {
                if (!(0, file_system_read_errors_1.isMissingFileError)(error)) {
                    throw error;
                }
            }
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
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedMission, persisted_document_guards_1.validateMission, context);
            return (0, mission_1.hydrateMission)(storedMission);
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
function areMissionSnapshotsEqual(left, right) {
    // Compare sous forme canonique (cles triees recursivement) pour que deux missions
    // logiquement egales mais hydratees par des chemins distincts (lecture disque vs
    // reconstruction programmatique) soient considerees egales. Voir Story 5.1.1 AC4.
    return (0, node_util_1.isDeepStrictEqual)(canonicalize(left), canonicalize(right));
}
function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map((item) => canonicalize(item));
    }
    if (typeof value !== "object" || value === null) {
        return value;
    }
    const sortedRecord = {};
    const sortedKeys = Object.keys(value).sort();
    for (const key of sortedKeys) {
        sortedRecord[key] = canonicalize(value[key]);
    }
    return sortedRecord;
}
