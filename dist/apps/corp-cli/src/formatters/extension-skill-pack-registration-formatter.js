"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatExtensionSkillPackRegistration = formatExtensionSkillPackRegistration;
function formatExtensionSkillPackRegistration(result) {
    return [
        `Skill pack enregistre: ${result.registeredSkillPack.packRef}`,
        `Statut: ${result.status}`,
        `Workspace entry: ${result.skillPackPath}`,
        `Fichier: ${result.registeredSkillPack.sourceManifestPath}`,
        `Display name: ${result.registeredSkillPack.displayName}`,
        `Permissions: ${formatList(result.registeredSkillPack.permissions, "aucune")}`,
        `Contraintes: ${formatList(result.registeredSkillPack.constraints, "aucune")}`,
    ];
}
function formatList(values, fallback) {
    return values.length > 0 ? values.join(", ") : fallback;
}
