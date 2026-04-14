"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyMissionAuthorizedExtensions = createEmptyMissionAuthorizedExtensions;
exports.normalizeMissionAuthorizedExtensions = normalizeMissionAuthorizedExtensions;
exports.hydrateMission = hydrateMission;
function createEmptyMissionAuthorizedExtensions() {
    return {
        allowedCapabilities: [],
        skillPackRefs: [],
    };
}
function normalizeMissionAuthorizedExtensions(value) {
    return {
        allowedCapabilities: normalizeMissionReferenceList(value?.allowedCapabilities),
        skillPackRefs: normalizeMissionReferenceList(value?.skillPackRefs),
    };
}
function hydrateMission(mission) {
    return {
        ...mission,
        authorizedExtensions: normalizeMissionAuthorizedExtensions(mission.authorizedExtensions),
    };
}
function normalizeMissionReferenceList(values) {
    if (!Array.isArray(values)) {
        return [];
    }
    const normalizedValues = [];
    const seenValues = new Set();
    for (const value of values) {
        if (typeof value !== "string") {
            continue;
        }
        const normalizedValue = value.trim();
        if (!normalizedValue || seenValues.has(normalizedValue)) {
            continue;
        }
        seenValues.add(normalizedValue);
        normalizedValues.push(normalizedValue);
    }
    return normalizedValues;
}
