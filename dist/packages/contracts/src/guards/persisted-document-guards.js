"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMission = isMission;
exports.validateMission = validateMission;
exports.isTicket = isTicket;
exports.validateTicket = validateTicket;
exports.isExecutionAttempt = isExecutionAttempt;
exports.validateExecutionAttempt = validateExecutionAttempt;
exports.isArtifact = isArtifact;
exports.validateArtifact = validateArtifact;
exports.isRegisteredCapability = isRegisteredCapability;
exports.validateRegisteredCapability = validateRegisteredCapability;
exports.isRegisteredSkillPack = isRegisteredSkillPack;
exports.validateRegisteredSkillPack = validateRegisteredSkillPack;
const extension_registration_1 = require("../extension/extension-registration");
const valid = { ok: true };
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
function validateMission(value) {
    const recordResult = validateRecord(value, "Mission");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
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
function isTicket(value) {
    return validateTicket(value).ok;
}
function validateTicket(value) {
    const recordResult = validateRecord(value, "Ticket");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
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
function isExecutionAttempt(value) {
    return validateExecutionAttempt(value).ok;
}
function validateExecutionAttempt(value) {
    const recordResult = validateRecord(value, "ExecutionAttempt");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
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
function isArtifact(value) {
    return validateArtifact(value).ok;
}
function validateArtifact(value) {
    const recordResult = validateRecord(value, "Artifact");
    if (!recordResult.ok) {
        return recordResult;
    }
    const candidate = value;
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
            ? valid
            : invalid("type incorrect `mcp`: attendu null pour provider local.");
    }
    if (!("mcp" in candidate) || candidate.mcp === undefined || candidate.mcp === null) {
        return invalid("champ manquant `mcp`.");
    }
    return validateMcpBinding(candidate.mcp, "mcp");
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
    return firstInvalid([
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
}
function validateExecutionHandle(value, fieldPath) {
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
    if (!(fieldName in record) || record[fieldName] === undefined || record[fieldName] === null) {
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
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return typeof record[fieldName] === "string"
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu string.`);
}
function validateOptionalString(record, fieldPath, fieldName = fieldPath) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return valid;
    }
    return typeof record[fieldName] === "string"
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu string optionnel.`);
}
function validateNullableString(record, fieldPath, fieldName = fieldPath) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return typeof record[fieldName] === "string" || record[fieldName] === null
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu string ou null.`);
}
function validateBoolean(record, fieldPath, fieldName = fieldPath) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return invalid(`champ manquant \`${fieldPath}\`.`);
    }
    return typeof record[fieldName] === "boolean"
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu boolean.`);
}
function validateOptionalNumber(record, fieldPath, fieldName = fieldPath) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return valid;
    }
    return typeof record[fieldName] === "number" && Number.isFinite(record[fieldName])
        ? valid
        : invalid(`type incorrect \`${fieldPath}\`: attendu number optionnel.`);
}
function validateStringArray(record, fieldPath, fieldName = fieldPath) {
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
function validateRecordField(record, fieldPath, fieldName = fieldPath) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
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
function invalid(reason) {
    return { ok: false, reason };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
