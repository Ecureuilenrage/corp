"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileMissionRepository = void 0;
exports.createFileMissionRepository = createFileMissionRepository;
const promises_1 = require("node:fs/promises");
const mission_1 = require("../../../contracts/src/mission/mission");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
class FileMissionRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(mission) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, mission.id);
        await (0, promises_1.mkdir)(missionStoragePaths.missionDir, { recursive: true });
        await (0, promises_1.writeFile)(missionStoragePaths.missionPath, `${JSON.stringify(mission, null, 2)}\n`, "utf8");
        return missionStoragePaths;
    }
    async findById(missionId) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, missionId);
        try {
            const storedMission = await (0, promises_1.readFile)(missionStoragePaths.missionPath, "utf8");
            return (0, mission_1.hydrateMission)(JSON.parse(storedMission));
        }
        catch (error) {
            if (isMissingFileError(error)) {
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
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
