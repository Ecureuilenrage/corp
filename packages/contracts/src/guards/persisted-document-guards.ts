import type { ApprovalDecision } from "../approval/approval-decision";
import type { ApprovalRequest } from "../approval/approval-request";
import type { Artifact } from "../artifact/artifact";
import type {
  CapabilityInvocationDetails,
  RegisteredCapability,
} from "../extension/registered-capability";
import type { RegisteredSkillPack } from "../extension/registered-skill-pack";
import { EXTENSION_REGISTRATION_SCHEMA_VERSION } from "../extension/extension-registration";
import type { ExecutionAttempt } from "../execution-attempt/execution-attempt";
import type { Mission } from "../mission/mission";
import type { Ticket } from "../ticket/ticket";
import type { WorkspaceIsolationMetadata } from "../../../workspace-isolation/src/workspace-isolation";

export type ValidationResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export interface StructuralValidationWarning {
  code: "open_discriminant_unknown";
  path: string;
  value: string;
  message: string;
}

export interface ValidationOptions {
  strict?: boolean;
  warnings?: StructuralValidationWarning[];
}

/**
 * Les guards runtime partages vivent dans `packages/contracts/src/guards` pour
 * rester co-localises aux types metier qu'ils valident. Les lecteurs/projections
 * cross-package importent ces definitions canoniques au lieu de les recopier.
 */
const valid: ValidationResult = { ok: true, value: undefined };
const STRUCTURAL_VALIDATION_WARNINGS = Symbol("corp.structural_validation_warnings");

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

export function validateMission(
  value: unknown,
  options: ValidationOptions = {},
): ValidationResult<Mission> {
  const recordResult = validateRecord(value, "Mission");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  const validation = firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "title"),
    validateString(candidate, "objective"),
    validateOpenStringUnion(
      candidate,
      "status",
      MISSION_STATUSES,
      "statut inconnu",
      options,
    ),
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

  return validation.ok
    ? success(candidate as unknown as Mission)
    : validation;
}

export function isTicket(value: unknown): value is Ticket {
  return validateTicket(value).ok;
}

export function validateTicket(
  value: unknown,
  options: ValidationOptions = {},
): ValidationResult<Ticket> {
  const recordResult = validateRecord(value, "Ticket");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  const validation = firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "missionId"),
    validateStringUnion(candidate, "kind", TICKET_KINDS, "discriminant invalide"),
    validateString(candidate, "goal"),
    validateOpenStringUnion(
      candidate,
      "status",
      TICKET_STATUSES,
      "statut inconnu",
      options,
    ),
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

  return validation.ok
    ? success(candidate as unknown as Ticket)
    : validation;
}

export function isExecutionAttempt(value: unknown): value is ExecutionAttempt {
  return validateExecutionAttempt(value).ok;
}

export function validateExecutionAttempt(
  value: unknown,
  options: ValidationOptions = {},
): ValidationResult<ExecutionAttempt> {
  const recordResult = validateRecord(value, "ExecutionAttempt");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  const validation = firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "ticketId"),
    validateOpenStringUnion(
      candidate,
      "adapter",
      EXECUTION_ADAPTER_IDS,
      "discriminant invalide",
      options,
    ),
    validateOpenStringUnion(
      candidate,
      "status",
      EXECUTION_ATTEMPT_STATUSES,
      "statut inconnu",
      options,
    ),
    validateString(candidate, "workspaceIsolationId"),
    validateBoolean(candidate, "backgroundRequested"),
    validateRecordField(candidate, "adapterState"),
    validateString(candidate, "startedAt"),
    validateNullableString(candidate, "endedAt"),
  ]);

  return validation.ok
    ? success(candidate as unknown as ExecutionAttempt)
    : validation;
}

export function isArtifact(value: unknown): value is Artifact {
  return validateArtifact(value).ok;
}

export function isApprovalRequest(value: unknown): value is ApprovalRequest {
  if (!isRecord(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.approvalId === "string"
    && typeof candidate.missionId === "string"
    && typeof candidate.ticketId === "string"
    && typeof candidate.attemptId === "string"
    && typeof candidate.status === "string"
    && typeof candidate.title === "string"
    && typeof candidate.actionType === "string"
    && typeof candidate.actionSummary === "string"
    && isStringArrayValue(candidate.guardrails)
    && isStringArrayValue(candidate.relatedEventIds)
    && isStringArrayValue(candidate.relatedArtifactIds)
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string";
}

export function isWorkspaceIsolationMetadata(value: unknown): value is WorkspaceIsolationMetadata {
  if (!isRecord(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.workspaceIsolationId === "string"
    && typeof candidate.kind === "string"
    && typeof candidate.sourceRoot === "string"
    && typeof candidate.workspacePath === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.retained === "boolean";
}

export function isApprovalDecision(value: unknown): value is ApprovalDecision {
  if (!isRecord(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return isApprovalDecisionOutcome(candidate.outcome)
    && isOptionalStringValue(candidate.reason)
    && isOptionalStringChange(candidate.missionPolicyChange)
    && isOptionalStringArrayChange(candidate.ticketCapabilityChange)
    && isOptionalStringArrayChange(candidate.ticketSkillPackChange)
    && isOptionalStringArrayValue(candidate.budgetObservations);
}

export function isCapabilityInvocationDetails(value: unknown): value is CapabilityInvocationDetails {
  if (!isRecord(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.capabilityId === "string"
    && typeof candidate.registrationId === "string"
    && (candidate.provider === "local" || candidate.provider === "mcp")
    && typeof candidate.approvalSensitive === "boolean"
    && isStringArrayValue(candidate.permissions)
    && isStringArrayValue(candidate.constraints)
    && isStringArrayValue(candidate.requiredEnvNames);
}

export function validateArtifact(
  value: unknown,
  options: ValidationOptions = {},
): ValidationResult<Artifact> {
  const recordResult = validateRecord(value, "Artifact");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  const validation = firstInvalid([
    validateString(candidate, "id"),
    validateString(candidate, "missionId"),
    validateString(candidate, "ticketId"),
    validateString(candidate, "producingEventId"),
    validateNullableString(candidate, "attemptId"),
    validateNullableString(candidate, "workspaceIsolationId"),
    validateOpenStringUnion(
      candidate,
      "kind",
      ARTIFACT_KINDS,
      "discriminant invalide",
      options,
    ),
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

  return validation.ok
    ? success(candidate as unknown as Artifact)
    : validation;
}

export function isRegisteredCapability(value: unknown): value is RegisteredCapability {
  return validateRegisteredCapability(value).ok;
}

export function validateRegisteredCapability(value: unknown): ValidationResult<RegisteredCapability> {
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
      ? success(candidate as unknown as RegisteredCapability)
      : invalid("type incorrect `mcp`: attendu null pour provider local.");
  }

  if (!hasOwnField(candidate, "mcp") || candidate.mcp === undefined || candidate.mcp === null) {
    return invalid("champ manquant `mcp`.");
  }

  const validation = validateMcpBinding(candidate.mcp, "mcp");
  return validation.ok
    ? success(candidate as unknown as RegisteredCapability)
    : validation;
}

export function isRegisteredSkillPack(value: unknown): value is RegisteredSkillPack {
  return validateRegisteredSkillPack(value).ok;
}

export function validateRegisteredSkillPack(value: unknown): ValidationResult<RegisteredSkillPack> {
  const recordResult = validateRecord(value, "RegisteredSkillPack");
  if (!recordResult.ok) {
    return recordResult;
  }

  const candidate = value as Record<string, unknown>;
  const validation = firstInvalid([
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

  return validation.ok
    ? success(candidate as unknown as RegisteredSkillPack)
    : validation;
}

export function attachStructuralValidationWarnings<T>(
  value: T,
  warnings: StructuralValidationWarning[],
): T {
  if (warnings.length === 0 || typeof value !== "object" || value === null) {
    return value;
  }

  if (!Object.isExtensible(value)) {
    return value;
  }

  Object.defineProperty(value, STRUCTURAL_VALIDATION_WARNINGS, {
    value: warnings.map((warning) => ({ ...warning })),
    enumerable: false,
    configurable: true,
    writable: false,
  });

  return value;
}

export function getStructuralValidationWarnings(
  value: unknown,
): StructuralValidationWarning[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const warnings = (value as Record<PropertyKey, unknown>)[STRUCTURAL_VALIDATION_WARNINGS];

  return Array.isArray(warnings)
    ? warnings.filter(isStructuralValidationWarning)
    : [];
}

function validateExecutionHandle(value: unknown, fieldPath: string): ValidationResult {
  if (value === undefined) {
    return invalid(`champ manquant \`${fieldPath}\`.`);
  }

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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined || record[fieldName] === null) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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
  if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
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

function validateOpenStringUnion(
  record: Record<string, unknown>,
  fieldPath: string,
  allowedValues: ReadonlySet<string>,
  invalidKind: "statut inconnu" | "discriminant invalide",
  options: ValidationOptions,
  fieldName = fieldPath,
): ValidationResult {
  const stringResult = validateString(record, fieldPath, fieldName);
  if (!stringResult.ok) {
    return stringResult;
  }

  const value = record[fieldName] as string;
  if (allowedValues.has(value)) {
    return valid;
  }

  if (options.strict !== false) {
    return invalid(`${invalidKind} \`${fieldPath}\`: \`${value}\`.`);
  }

  options.warnings?.push({
    code: "open_discriminant_unknown",
    path: fieldPath,
    value,
    message: `Valeur future toleree pour \`${fieldPath}\`: \`${value}\`.`,
  });

  return valid;
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

function firstInvalid(results: ValidationResult<unknown>[]): ValidationResult {
  return results.find((result) => !result.ok) ?? valid;
}

function success<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

function invalid(reason: string): ValidationResult<never> {
  return { ok: false, reason };
}

function hasOwnField(record: Record<string, unknown>, fieldName: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, fieldName);
}

function isStringArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isOptionalStringValue(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isApprovalDecisionOutcome(value: unknown): value is ApprovalDecision["outcome"] {
  return value === "approved" || value === "rejected" || value === "deferred";
}

function isOptionalStringChange(
  value: unknown,
): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return typeof value.previous === "string" && typeof value.next === "string";
}

function isOptionalStringArrayChange(
  value: unknown,
): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return isStringArrayValue(value.previous) && isStringArrayValue(value.next);
}

function isOptionalStringArrayValue(
  value: unknown,
): value is string[] | undefined {
  return value === undefined || isStringArrayValue(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStructuralValidationWarning(
  value: unknown,
): value is StructuralValidationWarning {
  if (!isRecord(value)) {
    return false;
  }

  return value.code === "open_discriminant_unknown"
    && typeof value.path === "string"
    && typeof value.value === "string"
    && typeof value.message === "string";
}
