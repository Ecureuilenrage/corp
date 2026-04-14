export const EXTENSION_REGISTRATION_SCHEMA_VERSION = "corp.extension.v1";

export const EXTENSION_REGISTRATION_SEAM_TYPES = [
  "execution_adapter",
  "capability",
  "skill_pack",
] as const;

export type ExtensionRegistrationSchemaVersion =
  typeof EXTENSION_REGISTRATION_SCHEMA_VERSION;

export type ExtensionRegistrationSeamType =
  typeof EXTENSION_REGISTRATION_SEAM_TYPES[number];

export type ExtensionAdapterLaunchMode =
  | "foreground_only"
  | "background_only"
  | "foreground_or_background";

export interface ExtensionRegistrationDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface ExtensionRegistrationMetadata {
  description: string;
  owner: string;
  tags: string[];
  [key: string]: unknown;
}

export interface ExtensionRegistrationLocalRefs {
  rootDir: string;
  entrypoint?: string;
  references: string[];
  metadataFile?: string;
  scripts: string[];
}

export interface ExtensionAdapterRegistrationDetails {
  adapterRuntimeId: string;
  launchMode: ExtensionAdapterLaunchMode;
  supportsBackground: boolean;
  requiredEnvNames: string[];
}

export interface ExtensionCapabilityRegistrationDetails {
  capabilityId: string;
  provider: "local" | "mcp";
  approvalSensitive: boolean;
  requiredEnvNames: string[];
  mcpServerName?: string;
  mcpToolName?: string;
}

export interface ExtensionSkillPackRegistrationDetails {
  packRef: string;
}

export interface ExtensionRegistrationBase {
  schemaVersion: ExtensionRegistrationSchemaVersion;
  seamType: ExtensionRegistrationSeamType;
  id: string;
  displayName: string;
  version: string;
  permissions: string[];
  constraints: string[];
  metadata: ExtensionRegistrationMetadata;
  localRefs: ExtensionRegistrationLocalRefs;
  executionAdapter?: ExtensionAdapterRegistrationDetails;
  capability?: ExtensionCapabilityRegistrationDetails;
  skillPack?: ExtensionSkillPackRegistrationDetails;
}

export interface ExecutionAdapterRegistration extends ExtensionRegistrationBase {
  seamType: "execution_adapter";
  executionAdapter: ExtensionAdapterRegistrationDetails;
  capability?: undefined;
  skillPack?: undefined;
}

export interface CapabilityRegistration extends ExtensionRegistrationBase {
  seamType: "capability";
  executionAdapter?: undefined;
  capability: ExtensionCapabilityRegistrationDetails;
  skillPack?: undefined;
}

export interface SkillPackRegistration extends ExtensionRegistrationBase {
  seamType: "skill_pack";
  executionAdapter?: undefined;
  capability?: undefined;
  skillPack: ExtensionSkillPackRegistrationDetails;
}

export type ExtensionRegistration =
  | ExecutionAdapterRegistration
  | CapabilityRegistration
  | SkillPackRegistration;

export function normalizeOpaqueExtensionReference(value: string): string {
  return value.trim();
}

export function normalizeOpaqueExtensionReferences(values: string[]): string[] {
  const normalizedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const rawValue of values) {
    const normalizedValue = normalizeOpaqueExtensionReference(rawValue);

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
}
