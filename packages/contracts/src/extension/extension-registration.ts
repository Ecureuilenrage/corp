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

export interface NormalizeOpaqueReferenceOptions {
  caseInsensitive?: boolean;
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

const INVISIBLE_TRIM_PATTERN = /^[\s\uFEFF\u00A0\u200B-\u200F\u2028\u2029]+|[\s\uFEFF\u00A0\u200B-\u200F\u2028\u2029]+$/g;

export function normalizeOpaqueExtensionReference(value: string): string {
  return value.replace(INVISIBLE_TRIM_PATTERN, "");
}

/**
 * Cle canonique utilisee pour la comparaison case-insensitive des references
 * opaques entre registre, mission et ticket. La chaine est:
 *  1. debarrasee des blancs invisibles (espaces ASCII, BOM U+FEFF, NBSP U+00A0,
 *     ZWSP/ZWJ/ZWNJ U+200B-U+200F, separateurs de ligne U+2028/U+2029) en tete/queue;
 *  2. normalisee en NFC pour eviter les divergences entre formes decomposees et composees;
 *  3. abaissee via `toLocaleLowerCase("en-US")`: la locale `en-US` est choisie pour offrir
 *     un casefold ASCII deterministe independant de la locale systeme (notamment pour eviter
 *     la transformation `I` -> `ı` d'une locale `tr-TR`).
 */
export function normalizeOpaqueReferenceKey(value: string): string {
  return normalizeOpaqueExtensionReference(value)
    .normalize("NFC")
    .toLocaleLowerCase("en-US");
}

/**
 * Contrat canonique des references opaques partagees entre registre et runtime:
 * trim etendu (blancs Unicode invisibles inclus), normalisation Unicode NFC, suppression
 * des vides, deduplication stable et preservation de l'ordre. Les refs capability / skill
 * pack peuvent activer `caseInsensitive` pour obtenir une cle canonique comparable entre
 * Windows et POSIX; dans ce mode la valeur retournee est la cle canonique (lowercase).
 */
export function normalizeOpaqueReferences(
  values: string[],
  options: NormalizeOpaqueReferenceOptions = {},
): string[] {
  const normalizedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const rawValue of values) {
    const normalizedValue = normalizeOpaqueExtensionReference(rawValue).normalize("NFC");
    const comparisonKey = options.caseInsensitive
      ? normalizeOpaqueReferenceKey(normalizedValue)
      : normalizedValue;

    if (!comparisonKey || seenValues.has(comparisonKey)) {
      continue;
    }

    seenValues.add(comparisonKey);
    normalizedValues.push(comparisonKey);
  }

  return normalizedValues;
}

export function normalizeOpaqueExtensionReferences(
  values: string[],
  options: NormalizeOpaqueReferenceOptions = {},
): string[] {
  return normalizeOpaqueReferences(values, options);
}
