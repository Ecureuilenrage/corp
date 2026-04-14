"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROJECTIONS = void 0;
exports.ensureDefaultProjections = ensureDefaultProjections;
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
exports.DEFAULT_PROJECTIONS = {
    "mission-status": {
        schemaVersion: 1,
        mission: null,
    },
    "ticket-board": {
        schemaVersion: 1,
        tickets: [],
    },
    "approval-queue": {
        schemaVersion: 1,
        approvals: [],
    },
    "artifact-index": {
        schemaVersion: 1,
        artifacts: [],
    },
    "audit-log": {
        schemaVersion: 1,
        entries: [],
    },
    "resume-view": {
        schemaVersion: 1,
        resume: null,
    },
};
async function ensureDefaultProjections(projectionsDir) {
    return (0, file_projection_store_1.seedProjectionStore)(projectionsDir, exports.DEFAULT_PROJECTIONS);
}
