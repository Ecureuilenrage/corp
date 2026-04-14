import type {
  ExtensionRegistrationMetadata,
  ExtensionRegistrationSchemaVersion,
} from "./extension-registration";

export interface RegisteredSkillPackLocalRefs {
  rootDir: string;
  references: string[];
  metadataFile?: string;
  scripts: string[];
}

export interface RegisteredSkillPack {
  packRef: string;
  registrationId: string;
  schemaVersion: ExtensionRegistrationSchemaVersion;
  displayName: string;
  version: string;
  permissions: string[];
  constraints: string[];
  metadata: ExtensionRegistrationMetadata;
  localRefs: RegisteredSkillPackLocalRefs;
  registeredAt: string;
  sourceManifestPath: string;
}

export interface ResolvedSkillPackSummary {
  packRef: RegisteredSkillPack["packRef"];
  displayName: RegisteredSkillPack["displayName"];
  description: RegisteredSkillPack["metadata"]["description"];
  owner: RegisteredSkillPack["metadata"]["owner"];
  tags: RegisteredSkillPack["metadata"]["tags"];
  rootDir: RegisteredSkillPackLocalRefs["rootDir"];
  references: RegisteredSkillPackLocalRefs["references"];
  metadataFile?: RegisteredSkillPackLocalRefs["metadataFile"];
  scripts: RegisteredSkillPackLocalRefs["scripts"];
}

export interface SkillPackUsageDetails {
  packRef: RegisteredSkillPack["packRef"];
  registrationId: RegisteredSkillPack["registrationId"];
  displayName: RegisteredSkillPack["displayName"];
  permissions: RegisteredSkillPack["permissions"];
  constraints: RegisteredSkillPack["constraints"];
  owner: RegisteredSkillPack["metadata"]["owner"];
  tags: RegisteredSkillPack["metadata"]["tags"];
}
