import type { Artifact } from "../artifact/artifact";
import type { RegisteredCapability } from "../extension/registered-capability";
import type { RegisteredSkillPack } from "../extension/registered-skill-pack";
import { EXTENSION_REGISTRATION_SCHEMA_VERSION } from "../extension/extension-registration";
import type { ExecutionAttempt } from "../execution-attempt/execution-attempt";
import type { Mission } from "../mission/mission";
import type { Ticket } from "../ticket/ticket";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

const valid: ValidationResult = { ok: true };

const MISSION_STATUSES = new Set([
  "draft",
  "ready",
  "running",
  "blocked",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

const TICKET_KINDS = new Set([
  "research",
  "plan",
  "implement",
  "review",
  "operate",
]);

const TICKET_STATUSES = new Set([
  "todo",
  "claimed",
  "in_progress",
  "blocked",
  "awaiting_approval",
  "done",
  "failed",
  "cancelled",
]);

const EXECUTION_ADAPTER_IDS = new Set([
  "codex_responses",
  "codex_exec",
  "codex_sdk",
]);

const EXECUTION_ATTEMPT_STATUSES = new Set([
  "requested",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

const ARTIFACT_KINDS = new Set([
  "workspace_file",
  "report_text",
  "structured_output",
  "diagnostic_pointer",
]);

export function isMission(value: unknown): value is Mission {
  return validateMission(value).ok;
}

export function validateMission(value: unknown): ValidationResult {
  const recordResult = validateRecord(value, "Mission");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "title"),
    validateString(candidate, "objective"),
    validateStringUnion(candidate, "status", MISSION_STATUSES, "statut inconnu"),
    validateStringArray(candidate, "successCriteria"),
    validateString(candidate, "policyProfileId"),
    validateOptionalAuthorizedExtensions(candidate, "authorizedExtensions"),
    validateStringArray(candidate, "ticketIds"),
    validateStringArray(candidate, "artifactIds"),
    validateStringArray(candidate, "eventIds"),
    validateString(candidate, "resumeCursor"),
    validateString(candidate, "createdAt"),
    validateString(candidate, "updatedAt"),
  ]);
}

export function isTicket(value: unknown): value is Ticket {
  return validateTicket(value).ok;
}

export function validateTicket(value: unknown): ValidationResult {
  const recordResult = validateRecord(value, "Ticket");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "missionId"),
    validateStringUnion(candidate, "kind", TICKET_KINDS, "discriminant invalide"),
    validateString(candidate, "goal"),
    validateStringUnion(candidate, "status", TICKET_STATUSES, "statut inconnu"),
    validateString(candidate, "owner"),
    validateStringArray(candidate, "dependsOn"),
    validateStringArray(candidate, "successCriteria"),
    validateStringArray(candidate, "allowedCapabilities"),
    validateStringArray(candidate, "skillPackRefs"),
    validateNullableString(candidate, "workspaceIsolationId"),
    validateExecutionHandle(candidate.executionHandle, "executionHandle"),
    validateStringArray(candidate, "artifactIds"),
    validateStringArray(candidate, "eventIds"),
    validateString(candidate, "createdAt"),
    validateString(candidate, "updatedAt"),
  ]);
}

export function isExecutionAttempt(value: unknown): value is ExecutionAttempt {
  return validateExecutionAttempt(value).ok;
}

export function validateExecutionAttempt(value: unknown): ValidationResult {
  const recordResult = validateRecord(value, "ExecutionAttempt");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "ticketId"),
    validateStringUnion(candidate, "adapter", EXECUTION_ADAPTER_IDS, "discriminant invalide"),
    validateStringUnion(candidate, "status", EXECUTION_ATTEMPT_STATUSES, "statut inconnu"),
    validateString(candidate, "workspaceIsolationId"),
    validateBoolean(candidate, "backgroundRequested"),
    validateRecordField(candidate, "adapterState"),
    validateString(candidate, "startedAt"),
    validateNullableString(candidate, "endedAt"),
  ]);
}

export function isArtifact(value: unknown): value is Artifact {
  return validateArtifact(value).ok;
}

export function validateArtifact(value: unknown): ValidationResult {
  const recordResult = validateRecord(value, "Artifact");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "missionId"),
    validateString(candidate, "ticketId"),
    validateString(candidate, "producingEventId"),
    validateNullableString(candidate, "attemptId"),
    validateNullableString(candidate, "workspaceIsolationId"),
    validateStringUnion(candidate, "kind", ARTIFACT_KINDS, "discriminant invalide"),
    validateString(candidate, "title"),
    validateString(candidate, "createdAt"),
    validateOptionalString(candidate, "label"),
    validateOptionalString(candidate, "path"),
    validateOptionalString(candidate, "mediaType"),
    validateOptionalString(candidate, "summary"),
    validateOptionalString(candidate, "payloadPath"),
    validateOptionalString(candidate, "sha256"),
    validateOptionalNumber(candidate, "sizeBytes"),
    validateOptionalString(candidate, "sourceEventType"),
    validateOptionalString(candidate, "sourceEventOccurredAt"),
  ]);
}

export function isRegisteredCapability(value: unknown): value is RegisteredCapability {
  return validateRegisteredCapability(value).ok;
}

export function validateRegisteredCapability(value: unknown): ValidationResult {
  const recordResult = validateRecord(value, "RegisteredCapability");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  const baseResult = firstInvalid([
    validateString(candidate, "capabilityId"),
    validateString(candidate, "registrationId"),
    validateLiteral(
      candidate,
      "schemaVersion",
      EXTENSION_REGISTRATION_SCHEMA_VERSION,
      "discriminant invalide",
    ),
    validateStringUnion(candidate, "provider", new Set(["local", "mcp"]), "discriminant invalide"),
    validateString(candidate, "displayName"),
    validateString(candidate, "version"),
    validateStringArray(candidate, "permissions"),
    validateStringArray(candidate, "constraints"),
    validateBoolean(candidate, "approvalSensitive"),
    validateStringArray(candidate, "requiredEnvNames"),
    validateExtensionMetadata(candidate.metadata, "metadata"),
    validateCapabilityLocalRefs(candidate.localRefs, "localRefs"),
    validateString(candidate, "registeredAt"),
    validateString(candidate, "sourceManifestPath"),
  ]);

  if (!baseResult.ok) {
    return baseResult;
  }

  if (candidate.provider === "local") {
    return candidate.mcp === null
      ? valid
      : invalid("type incorrect `mcp`: attendu null pour provider local.");
  }

  if (!("mcp" in candidate) || candidate.mcp === undefined || candidate.mcp === null) {
    return invalid("champ manquant `mcp`.");
  }

  return validateMcpBinding(candidate.mcp, "mcp");
}

export function isRegisteredSkillPack(value: unknown): value is RegisteredSkillPack {
  return validateRegisteredSkillPack(value).ok;
}

export function validateRegisteredSkillPack(value: unknown): ValidationResult {
  const recordResult = validateRecord(value, "RegisteredSkillPack");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, "packRef"),
    validateString(candidate, "registrationId"),
    validateLiteral(
      candidate,
      "schemaVersion",
      EXTENSION_REGISTRATION_SCHEMA_VERSION,
      "discriminant invalide",
    ),
    validateString(candidate, "displayName"),
    validateString(candidate, "version"),
    validateStringArray(candidate, "permissions"),
    validateStringArray(candidate, "constraints"),
    validateExtensionMetadata(candidate.metadata, "metadata"),
    validateSkillPackLocalRefs(candidate.localRefs, "localRefs"),
    validateString(candidate, "registeredAt"),
    validateString(candidate, "sourceManifestPath"),
  ]);
}

function validateExecutionHandle(value: unknown, fieldPath: string): ValidationResult {
  const recordResult = validateRecord(value, fieldPath);
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateStringUnion(
      candidate,
      `${fieldPath}.adapter`,
      EXECUTION_ADAPTER_IDS,
      "discriminant invalide",
      "adapter",
    ),
    validateRecordField(candidate, `${fieldPath}.adapterState`, "adapterState"),
  ]);
}

function validateOptionalAuthorizedExtensions(
  record: Record<string, unknown>,
  fieldName: string,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined || record[fieldName] === null) {
    return valid;
  }

  const value = record[fieldName];
  const recordResult = validateRecord(value, fieldName);
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateStringArray(candidate, `${fieldName}.allowedCapabilities`, "allowedCapabilities"),
    validateStringArray(candidate, `${fieldName}.skillPackRefs`, "skillPackRefs"),
  ]);
}

function validateExtensionMetadata(value: unknown, fieldPath: string): ValidationResult {
  const recordResult = validateRecord(value, fieldPath);
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, `${fieldPath}.description`, "description"),
    validateString(candidate, `${fieldPath}.owner`, "owner"),
    validateStringArray(candidate, `${fieldPath}.tags`, "tags"),
  ]);
}

function validateCapabilityLocalRefs(value: unknown, fieldPath: string): ValidationResult {
  const refsResult = validateLocalRefsBase(value, fieldPath);
  if (!refsResult.ok) {
    return refsResult;
  }

  return validateOptionalString(value as Record<string, unknown>, `${fieldPath}.entrypoint`, "entrypoint");
}

function validateSkillPackLocalRefs(value: unknown, fieldPath: string): ValidationResult {
  return validateLocalRefsBase(value, fieldPath);
}

function validateLocalRefsBase(value: unknown, fieldPath: string): ValidationResult {
  const recordResult = validateRecord(value, fieldPath);
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, `${fieldPath}.rootDir`, "rootDir"),
    validateStringArray(candidate, `${fieldPath}.references`, "references"),
    validateOptionalString(candidate, `${fieldPath}.metadataFile`, "metadataFile"),
    validateStringArray(candidate, `${fieldPath}.scripts`, "scripts"),
  ]);
}

function validateMcpBinding(value: unknown, fieldPath: string): ValidationResult {
  const recordResult = validateRecord(value, fieldPath);
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  return firstInvalid([
    validateString(candidate, `${fieldPath}.serverName`, "serverName"),
    validateString(candidate, `${fieldPath}.toolName`, "toolName"),
  ]);
}

function validateRecord(value: unknown, label: string): ValidationResult {
  if (!isRecord(value)) {
    return invalid(`type incorrect \`${label}\`: attendu objet.`);
  }

  return valid;
}

function validateString(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return invalid(`champ manquant \`${fieldPath}\`.`);
  }

  return typeof record[fieldName] === "string"
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: attendu string.`);
}

function validateOptionalString(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return valid;
  }

  return typeof record[fieldName] === "string"
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: attendu string optionnel.`);
}

function validateNullableString(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return invalid(`champ manquant \`${fieldPath}\`.`);
  }

  return typeof record[fieldName] === "string" || record[fieldName] === null
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: attendu string ou null.`);
}

function validateBoolean(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return invalid(`champ manquant \`${fieldPath}\`.`);
  }

  return typeof record[fieldName] === "boolean"
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: attendu boolean.`);
}

function validateOptionalNumber(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return valid;
  }

  return typeof record[fieldName] === "number" && Number.isFinite(record[fieldName])
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: attendu number optionnel.`);
}

function validateStringArray(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return invalid(`champ manquant \`${fieldPath}\`.`);
  }

  const value = record[fieldName];
  if (!Array.isArray(value)) {
    return invalid(`type incorrect \`${fieldPath}\`: attendu string[].`);
  }

  return value.every((entry) => typeof entry === "string")
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: toutes les entrees doivent etre string.`);
}

function validateRecordField(
  record: Record<string, unknown>,
  fieldPath: string,
  fieldName = fieldPath,
): ValidationResult {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return invalid(`champ manquant \`${fieldPath}\`.`);
  }

  return isRecord(record[fieldName])
    ? valid
    : invalid(`type incorrect \`${fieldPath}\`: attendu objet.`);
}

function validateStringUnion(
  record: Record<string, unknown>,
  fieldPath: string,
  allowedValues: ReadonlySet<string>,
  invalidKind: "statut inconnu" | "discriminant invalide",
  fieldName = fieldPath,
): ValidationResult {
  const stringResult = validateString(record, fieldPath, fieldName);
  if (!stringResult.ok) {
    return stringResult;
  }

  const value = record[fieldName] as string;
  return allowedValues.has(value)
    ? valid
    : invalid(`${invalidKind} \`${fieldPath}\`: \`${value}\`.`);
}

function validateLiteral(
  record: Record<string, unknown>,
  fieldName: string,
  expectedValue: string,
  invalidKind: "discriminant invalide",
): ValidationResult {
  const stringResult = validateString(record, fieldName);
  if (!stringResult.ok) {
    return stringResult;
  }

  return record[fieldName] === expectedValue
    ? valid
    : invalid(`${invalidKind} \`${fieldName}\`: \`${String(record[fieldName])}\`.`);
}

function firstInvalid(results: ValidationResult[]): ValidationResult {
  return results.find((result) => !result.ok) ?? valid;
}

function invalid(reason: string): ValidationResult {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
