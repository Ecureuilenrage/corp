"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSkillPackSummary = buildSkillPackSummary;
exports.buildSkillPackUsageDetails = buildSkillPackUsageDetails;
function buildSkillPackSummary(registeredSkillPack) {
    return {
        packRef: registeredSkillPack.packRef,
        displayName: registeredSkillPack.displayName,
        description: registeredSkillPack.metadata.description,
        owner: registeredSkillPack.metadata.owner,
        tags: [...registeredSkillPack.metadata.tags],
        rootDir: registeredSkillPack.localRefs.rootDir,
        references: [...registeredSkillPack.localRefs.references],
        ...(registeredSkillPack.localRefs.metadataFile
            ? { metadataFile: registeredSkillPack.localRefs.metadataFile }
            : {}),
        scripts: [...registeredSkillPack.localRefs.scripts],
    };
}
function buildSkillPackUsageDetails(registeredSkillPack) {
    return {
        packRef: registeredSkillPack.packRef,
        registrationId: registeredSkillPack.registrationId,
        displayName: registeredSkillPack.displayName,
        permissions: [...registeredSkillPack.permissions],
        constraints: [...registeredSkillPack.constraints],
        owner: registeredSkillPack.metadata.owner,
        tags: [...registeredSkillPack.metadata.tags],
    };
}
