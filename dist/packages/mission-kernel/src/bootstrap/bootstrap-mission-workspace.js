"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROJECTIONS = void 0;
exports.bootstrapMissionWorkspace = bootstrapMissionWorkspace;
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const default_projections_1 = require("../../../journal/src/projections/default-projections");
Object.defineProperty(exports, "DEFAULT_PROJECTIONS", { enumerable: true, get: function () { return default_projections_1.DEFAULT_PROJECTIONS; } });
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
async function bootstrapMissionWorkspace(options) {
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(options.rootDir);
    const createdPaths = [];
    await (0, file_mission_repository_1.cleanupStaleMissionLocks)(layout);
    const createdJournal = await (0, file_event_log_1.ensureAppendOnlyEventLog)(layout.journalPath);
    if (createdJournal) {
        createdPaths.push(layout.journalPath);
    }
    const projectionSeedResult = await (0, default_projections_1.ensureDefaultProjections)(layout.projectionsDir);
    createdPaths.push(...projectionSeedResult.createdPaths);
    return {
        ...layout,
        createdPaths,
    };
}
