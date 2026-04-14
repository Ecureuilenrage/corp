"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMissionExtensionSelection = formatMissionExtensionSelection;
function formatMissionExtensionSelection(mission) {
    return [
        `Mission: ${mission.id}`,
        "Extensions mission mises a jour.",
        `Capabilities mission: ${formatList(mission.authorizedExtensions.allowedCapabilities, "aucune")}`,
        `Skill packs mission: ${formatList(mission.authorizedExtensions.skillPackRefs, "aucun")}`,
    ];
}
function formatList(values, emptyValue) {
    return values.length > 0 ? values.join(", ") : emptyValue;
}
