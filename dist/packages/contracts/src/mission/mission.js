"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyMissionAuthorizedExtensions = createEmptyMissionAuthorizedExtensions;
exports.normalizeMissionAuthorizedExtensions = normalizeMissionAuthorizedExtensions;
exports.hydrateMission = hydrateMission;
const extension_registration_1 = require("../extension/extension-registration");
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
    return (0, extension_registration_1.normalizeOpaqueReferences)(values.filter((value) => typeof value === "string"), { caseInsensitive: true });
}
