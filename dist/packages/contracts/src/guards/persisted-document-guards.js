"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMission = isMission;
exports.validateMission = validateMission;
exports.isTicket = isTicket;
exports.validateTicket = validateTicket;
exports.isExecutionAttempt = isExecutionAttempt;
exports.validateExecutionAttempt = validateExecutionAttempt;
exports.isArtifact = isArtifact;
exports.isApprovalRequest = isApprovalRequest;
exports.isWorkspaceIsolationMetadata = isWorkspaceIsolationMetadata;
exports.isApprovalDecision = isApprovalDecision;
exports.isCapabilityInvocationDetails = isCapabilityInvocationDetails;
exports.validateArtifact = validateArtifact;
exports.isRegisteredCapability = isRegisteredCapability;
exports.validateRegisteredCapability = validateRegisteredCapability;
exports.isRegisteredSkillPack = isRegisteredSkillPack;
exports.validateRegisteredSkillPack = validateRegisteredSkillPack;
exports.attachStructuralValidationWarnings = attachStructuralValidationWarnings;
exports.getStructuralValidationWarnings = getStructuralValidationWarnings;
const extension_registration_1 = require("../extension/extension-registration");
/**
 * Les guards runtime partages vivent dans `packages/contracts/src/guards` pour
 * rester co-localises aux types metier qu'ils valident. Les lecteurs/projections
 * cross-package importent ces definitions canoniques au lieu de les recopier.
 */
const valid = { ok: true, value: undefined };
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
function isMission(value) {
    return validateMission(value).ok;
}
function validateMission(value, options = {}) {
    const recordResult = validateRecord(value, "Mission");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    const validation = firstInvalid([
        validateString(candidate, "id"),
        validateString(candidate, "title"),
        validateString(candidate, "objective"),
        validateOpenStringUnion(candidate, "status", MISSION_STATUSES, "statut inconnu", options),
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
        ? success(candidate)
        : validation;
}
function isTicket(value) {
    return validateTicket(value).ok;
}
function validateTicket(value, options = {}) {
    const recordResult = validateRecord(value, "Ticket");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    const validation = firstInvalid([
        validateString(candidate, "id"),
        validateString(candidate, "missionId"),
        validateStringUnion(candidate, "kind", TICKET_KINDS, "discriminant invalide"),
        validateString(candidate, "goal"),
        validateOpenStringUnion(candidate, "status", TICKET_STATUSES, "statut inconnu", options),
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
        ? success(candidate)
        : validation;
}
function isExecutionAttempt(value) {
    return validateExecutionAttempt(value).ok;
}
function validateExecutionAttempt(value, options = {}) {
    const recordResult = validateRecord(value, "ExecutionAttempt");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    const validation = firstInvalid([
        validateString(candidate, "id"),
        validateString(candidate, "ticketId"),
        validateOpenStringUnion(candidate, "adapter", EXECUTION_ADAPTER_IDS, "discriminant invalide", options),
        validateOpenStringUnion(candidate, "status", EXECUTION_ATTEMPT_STATUSES, "statut inconnu", options),
        validateString(candidate, "workspaceIsolationId"),
        validateBoolean(candidate, "backgroundRequested"),
        validateRecordField(candidate, "adapterState"),
        validateString(candidate, "startedAt"),
        validateNullableString(candidate, "endedAt"),
    ]);
    return validation.ok
        ? success(candidate)
        : validation;
}
function isArtifact(value) {
    return validateArtifact(value).ok;
}
function isApprovalRequest(value) {
    if (!isRecord(value)) {
        return false;
    }
    const candidate = value;
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
function isWorkspaceIsolationMetadata(value) {
    if (!isRecord(value)) {
        return false;
    }
    const candidate = value;
    return typeof candidate.workspaceIsolationId === "string"
        && typeof candidate.kind === "string"
        && typeof candidate.sourceRoot === "string"
        && typeof candidate.workspacePath === "string"
        && typeof candidate.createdAt === "string"
        && typeof candidate.retained === "boolean";
}
function isApprovalDecision(value) {
    if (!isRecord(value)) {
        return false;
    }
    const candidate = value;
    return isApprovalDecisionOutcome(candidate.outcome)
        && isOptionalStringValue(candidate.reason)
        && isOptionalStringChange(candidate.missionPolicyChange)
        && isOptionalStringArrayChange(candidate.ticketCapabilityChange)
        && isOptionalStringArrayChange(candidate.ticketSkillPackChange)
        && isOptionalStringArrayValue(candidate.budgetObservations);
}
function isCapabilityInvocationDetails(value) {
    if (!isRecord(value)) {
        return false;
    }
    const candidate = value;
    return typeof candidate.capabilityId === "string"
        && typeof candidate.registrationId === "string"
        && (candidate.provider === "local" || candidate.provider === "mcp")
        && typeof candidate.approvalSensitive === "boolean"
        && isStringArrayValue(candidate.permissions)
        && isStringArrayValue(candidate.constraints)
        && isStringArrayValue(candidate.requiredEnvNames);
}
function validateArtifact(value, options = {}) {
    const recordResult = validateRecord(value, "Artifact");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    const validation = firstInvalid([
        validateString(candidate, "id"),
        validateString(candidate, "missionId"),
        validateString(candidate, "ticketId"),
        validateString(candidate, "producingEventId"),
        validateNullableString(candidate, "attemptId"),
        validateNullableString(candidate, "workspaceIsolationId"),
        validateOpenStringUnion(candidate, "kind", ARTIFACT_KINDS, "discriminant invalide", options),
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
        ? success(candidate)
        : validation;
}
function isRegisteredCapability(value) {
    return validateRegisteredCapability(value).ok;
}
function validateRegisteredCapability(value) {
    const recordResult = validateRecord(value, "RegisteredCapability");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    const baseResult = firstInvalid([
        validateString(candidate, "capabilityId"),
        validateString(candidate, "registrationId"),
        validateLiteral(candidate, "schemaVersion", extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION, "discriminant invalide"),
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
            ? success(candidate)
            : invalid("type incorrect `mcp`: attendu null pour provider local.");
    }
    if (!hasOwnField(candidate, "mcp") || candidate.mcp === undefined || candidate.mcp === null) {
        return invalid("champ manquant `mcp`.");
    }
    const validation = validateMcpBinding(candidate.mcp, "mcp");
    return validation.ok
        ? success(candidate)
        : validation;
}
function isRegisteredSkillPack(value) {
    return validateRegisteredSkillPack(value).ok;
}
function validateRegisteredSkillPack(value) {
    const recordResult = validateRecord(value, "RegisteredSkillPack");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    const validation = firstInvalid([
        validateString(candidate, "packRef"),
        validateString(candidate, "registrationId"),
        validateLiteral(candidate, "schemaVersion", extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION, "discriminant invalide"),
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
        ? success(candidate)
        : validation;
}
function attachStructuralValidationWarnings(value, warnings) {
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
function getStructuralValidationWarnings(value) {
    if (typeof value !== "object" || value === null) {
        return [];
    }
    const warnings = value[STRUCTURAL_VALIDATION_WARNINGS];
    return Array.isArray(warnings)
        ? warnings.filter(isStructuralValidationWarning)
        : [];
}
function validateExecutionHandle(value, fieldPath) {
    if (value === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    const recordResult = validateRecord(value, fieldPath);
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    return firstInvalid([
        validateStringUnion(candidate, `${fieldPath}.adapter`, EXECUTION_ADAPTER_IDS, "discriminant invalide", "adapter"),
        validateRecordField(candidate, `${fieldPath}.adapterState`, "adapterState"),
    ]);
}
function validateOptionalAuthorizedExtensions(record, fieldName) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined || record[fieldName] === null) {
        return valid;
    }
    const value = record[fieldName];
    const recordResult = validateRecord(value, fieldName);
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    return firstInvalid([
        validateStringArray(candidate, `${fieldName}.allowedCapabilities`, "allowedCapabilities"),
        validateStringArray(candidate, `${fieldName}.skillPackRefs`, "skillPackRefs"),
    ]);
}
function validateExtensionMetadata(value, fieldPath) {
    const recordResult = validateRecord(value, fieldPath);
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    return firstInvalid([
        validateString(candidate, `${fieldPath}.description`, "description"),
        validateString(candidate, `${fieldPath}.owner`, "owner"),
        validateStringArray(candidate, `${fieldPath}.tags`, "tags"),
    ]);
}
function validateCapabilityLocalRefs(value, fieldPath) {
    const refsResult = validateLocalRefsBase(value, fieldPath);
    if (!refsResult.ok) {
        return refsResult;
    }
    return validateOptionalString(value, `${fieldPath}.entrypoint`, "entrypoint");
}
function validateSkillPackLocalRefs(value, fieldPath) {
    return validateLocalRefsBase(value, fieldPath);
}
function validateLocalRefsBase(value, fieldPath) {
    const recordResult = validateRecord(value, fieldPath);
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    return firstInvalid([
        validateString(candidate, `${fieldPath}.rootDir`, "rootDir"),
        validateStringArray(candidate, `${fieldPath}.references`, "references"),
        validateOptionalString(candidate, `${fieldPath}.metadataFile`, "metadataFile"),
        validateStringArray(candidate, `${fieldPath}.scripts`, "scripts"),
    ]);
}
function validateMcpBinding(value, fieldPath) {
    const recordResult = validateRecord(value, fieldPath);
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
    return firstInvalid([
        validateString(candidate, `${fieldPath}.serverName`, "serverName"),
        validateString(candidate, `${fieldPath}.toolName`, "toolName"),
    ]);
}
function validateRecord(value, label) {
    if (!isRecord(value)) {
        return invalid(`type incorrect \`${label}\`: attendu objet.`);
    }
    return valid;
}
function validateString(record, fieldPath, fieldName = fieldPath) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return typeof record[fieldName] === "string"
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu string.`);
}
function validateOptionalString(record, fieldPath, fieldName = fieldPath) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
        return valid;
    }
    return typeof record[fieldName] === "string"
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu string optionnel.`);
}
function validateNullableString(record, fieldPath, fieldName = fieldPath) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return typeof record[fieldName] === "string" || record[fieldName] === null
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu string ou null.`);
}
function validateBoolean(record, fieldPath, fieldName = fieldPath) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return typeof record[fieldName] === "boolean"
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu boolean.`);
}
function validateOptionalNumber(record, fieldPath, fieldName = fieldPath) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
        return valid;
    }
    return typeof record[fieldName] === "number" && Number.isFinite(record[fieldName])
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu number optionnel.`);
}
function validateStringArray(record, fieldPath, fieldName = fieldPath) {
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
function validateRecordField(record, fieldPath, fieldName = fieldPath) {
    if (!hasOwnField(record, fieldName) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return isRecord(record[fieldName])
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu objet.`);
}
function validateStringUnion(record, fieldPath, allowedValues, invalidKind, fieldName = fieldPath) {
    const stringResult = validateString(record, fieldPath, fieldName);
    if (!stringResult.ok) {
        return stringResult;
    }
    const value = record[fieldName];
    return allowedValues.has(value)
        ? valid
        : invalid(`${invalidKind} \`${fieldPath}\`: \`${value}\`.`);
}
function validateOpenStringUnion(record, fieldPath, allowedValues, invalidKind, options, fieldName = fieldPath) {
    const stringResult = validateString(record, fieldPath, fieldName);
    if (!stringResult.ok) {
        return stringResult;
    }
    const value = record[fieldName];
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
function validateLiteral(record, fieldName, expectedValue, invalidKind) {
    const stringResult = validateString(record, fieldName);
    if (!stringResult.ok) {
        return stringResult;
    }
    return record[fieldName] === expectedValue
        ? valid
        : invalid(`${invalidKind} \`${fieldName}\`: \`${String(record[fieldName])}\`.`);
}
function firstInvalid(results) {
    return results.find((result) => !result.ok) ?? valid;
}
function success(value) {
    return { ok: true, value };
}
function invalid(reason) {
    return { ok: false, reason };
}
function hasOwnField(record, fieldName) {
    return Object.prototype.hasOwnProperty.call(record, fieldName);
}
function isStringArrayValue(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isOptionalStringValue(value) {
    return value === undefined || typeof value === "string";
}
function isApprovalDecisionOutcome(value) {
    return value === "approved" || value === "rejected" || value === "deferred";
}
function isOptionalStringChange(value) {
    if (value === undefined) {
        return true;
    }
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.previous === "string" && typeof value.next === "string";
}
function isOptionalStringArrayChange(value) {
    if (value === undefined) {
        return true;
    }
    if (!isRecord(value)) {
        return false;
    }
    return isStringArrayValue(value.previous) && isStringArrayValue(value.next);
}
function isOptionalStringArrayValue(value) {
    return value === undefined || isStringArrayValue(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStructuralValidationWarning(value) {
    if (!isRecord(value)) {
        return false;
    }
    return value.code === "open_discriminant_unknown"
        && typeof value.path === "string"
        && typeof value.value === "string"
        && typeof value.message === "string";
}
