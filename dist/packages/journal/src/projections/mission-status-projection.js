"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMissionStatusProjection = createMissionStatusProjection;
function createMissionStatusProjection(mission) {
    return {
        schemaVersion: 1,
        mission,
    };
}
