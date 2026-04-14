import type {
  RegisteredSkillPack,
  ResolvedSkillPackSummary,
  SkillPackUsageDetails,
} from "../../../contracts/src/extension/registered-skill-pack";

export function buildSkillPackSummary(
  registeredSkillPack: RegisteredSkillPack,
): ResolvedSkillPackSummary {
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

export function buildSkillPackUsageDetails(
  registeredSkillPack: RegisteredSkillPack,
): SkillPackUsageDetails {
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
