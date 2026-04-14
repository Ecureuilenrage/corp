"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatExtensionSkillPackShow = formatExtensionSkillPackShow;
function formatExtensionSkillPackShow(skillPack) {
    return [
        `Skill pack: ${skillPack.packRef}`,
        `Display name: ${skillPack.displayName}`,
        `Description: ${skillPack.metadata.description}`,
        `Owner: ${skillPack.metadata.owner}`,
        `Tags: ${formatList(skillPack.metadata.tags, "aucun")}`,
        `Root dir: ${skillPack.localRefs.rootDir}`,
        `References: ${formatList(skillPack.localRefs.references, "aucune")}`,
        `Metadata file: ${skillPack.localRefs.metadataFile ?? "aucun"}`,
        `Scripts: ${formatList(skillPack.localRefs.scripts, "aucun")}`,
        `Source manifest: ${skillPack.sourceManifestPath}`,
        `Registered at: ${skillPack.registeredAt}`,
    ];
}
function formatList(values, fallback) {
    return values.length > 0 ? values.join(", ") : fallback;
}
