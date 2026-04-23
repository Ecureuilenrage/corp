"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMissionAudit = readMissionAudit;
exports.readMissionAuditEventDetail = readMissionAuditEventDetail;
const promises_1 = require("node:fs/promises");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const event_log_errors_1 = require("../../../journal/src/event-log/event-log-errors");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const mission_reconstruction_1 = require("../../../journal/src/reconstruction/mission-reconstruction");
const audit_log_projection_1 = require("../../../journal/src/projections/audit-log-projection");
const artifact_index_projection_1 = require("../../../journal/src/projections/artifact-index-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const file_artifact_repository_1 = require("../../../storage/src/repositories/file-artifact-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const persisted_document_errors_1 = require("../../../storage/src/repositories/persisted-document-errors");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
async function readMissionAudit(options) {
    const context = await loadMissionAuditContext({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName: "audit",
    });
    if (options.ticketId && !context.mission.ticketIds.includes(options.ticketId)) {
        throw new Error(`Ticket introuvable dans la mission \`${context.mission.id}\`: \`${options.ticketId}\`.`);
    }
    const filteredEntries = options.ticketId
        ? context.projection.entries.filter((entry) => entry.ticketId === options.ticketId)
        : context.projection.entries;
    const limitedEntries = typeof options.limit === "number" && options.limit > 0
        ? filteredEntries.slice(-options.limit)
        : filteredEntries;
    return {
        mission: context.mission,
        entries: limitedEntries,
        reconstructed: context.reconstructed,
        projectionPath: context.projectionPath,
    };
}
async function readMissionAuditEventDetail(options) {
    const context = await loadMissionAuditContext({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName: "audit show",
    });
    const entry = context.projection.entries.find((candidate) => candidate.eventId === options.eventId);
    const event = context.events.find((candidate) => candidate.eventId === options.eventId);
    if (!entry || !event) {
        throw new Error(`Evenement introuvable dans la mission \`${options.missionId}\`: \`${options.eventId}\`.`);
    }
    return {
        mission: context.mission,
        entry,
        fields: buildMissionAuditDetailFields(event),
        reconstructed: context.reconstructed,
        projectionPath: context.projectionPath,
    };
}
async function loadMissionAuditContext(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureMissionAuditWorkspaceInitialized(layout, options.commandName);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const artifactRepository = (0, file_artifact_repository_1.createFileArtifactRepository)(layout);
    const mission = await readMissionSnapshotForAudit(layout, missionRepository, options.missionId);
    const events = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
        .filter((event) => event.missionId === mission.id);
    const tickets = await readTicketsForAudit(ticketRepository, mission.id, events);
    const artifacts = await readArtifactsForAudit(artifactRepository, mission.id);
    const rebuiltProjection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets,
        artifacts,
        events,
    });
    const storedProjection = await readStoredAuditLog(layout.projectionsDir);
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "audit-log");
    if (!storedProjection || !(0, structural_compare_1.deepStrictEqualForComparison)(storedProjection, rebuiltProjection)) {
        await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "audit-log", rebuiltProjection);
        return {
            mission,
            events,
            projection: rebuiltProjection,
            reconstructed: true,
            projectionPath,
        };
    }
    return {
        mission,
        events,
        projection: storedProjection,
        reconstructed: false,
        projectionPath,
    };
}
async function ensureMissionAuditWorkspaceInitialized(layout, commandName) {
    const journalError = await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.journalPath));
    const projectionsError = await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.projectionsDir));
    const missionsError = await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.missionsDir));
    const fileSystemError = [
        { error: journalError, filePath: layout.journalPath, label: "journal append-only" },
        { error: projectionsError, filePath: layout.projectionsDir, label: "repertoire projections" },
        { error: missionsError, filePath: layout.missionsDir, label: "repertoire missions" },
    ].find((entry) => entry.error && entry.error.code !== "ENOENT" && (0, file_system_read_errors_1.isFileSystemReadError)(entry.error));
    if (fileSystemError?.error) {
        if (fileSystemError.filePath === layout.journalPath) {
            throw event_log_errors_1.EventLogReadError.fileSystem(layout.journalPath, fileSystemError.error);
        }
        throw (0, file_system_read_errors_1.createFileSystemReadError)(fileSystemError.error, fileSystemError.filePath, fileSystemError.label);
    }
    if (journalError?.code === "ENOENT" && !projectionsError && !missionsError) {
        throw event_log_errors_1.EventLogReadError.missing(layout.journalPath, journalError);
    }
    if (journalError || projectionsError || missionsError) {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`);
    }
}
async function readStoredAuditLog(projectionsDir) {
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(projectionsDir, "audit-log");
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "audit-log"));
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error) || error instanceof SyntaxError) {
            return null;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw (0, file_system_read_errors_1.createFileSystemReadError)(error, projectionPath, "projection audit-log");
        }
        throw error;
    }
}
function buildMissionAuditDetailFields(event) {
    const fields = [];
    const ticket = readTicketFromPayload(event.payload);
    const attempt = readAttemptFromPayload(event.payload);
    const artifact = readArtifactFromPayload(event.payload);
    const approval = readApprovalFromPayload(event.payload);
    const decision = readDecisionFromPayload(event.payload);
    const isolation = readIsolationFromPayload(event.payload);
    const capability = readCapabilityFromPayload(event.payload);
    const skillPack = readSkillPackFromPayload(event.payload);
    const sourceReferences = (0, artifact_index_projection_1.readSourceReferences)(event.payload);
    if (event.type.startsWith("mission.")) {
        const previousStatus = readOptionalString(event.payload, "previousStatus");
        const nextStatus = readOptionalString(event.payload, "nextStatus");
        const reason = readOptionalString(event.payload, "reason");
        if (previousStatus) {
            fields.push({ label: "Statut precedent", value: previousStatus });
        }
        if (nextStatus) {
            fields.push({ label: "Statut suivant", value: nextStatus });
        }
        if (reason) {
            fields.push({ label: "Raison", value: reason });
        }
    }
    if (event.type === "mission.extensions_selected") {
        const previousAuthorizedExtensions = readAuthorizedExtensionsFromPayload(event.payload, "previousAuthorizedExtensions");
        const authorizedExtensions = readAuthorizedExtensionsFromPayload(event.payload, "authorizedExtensions");
        const changedFields = readStringArray(event.payload, "changedFields");
        const trigger = readOptionalString(event.payload, "trigger");
        if (previousAuthorizedExtensions) {
            fields.push({
                label: "Selection precedente capabilities",
                value: formatList(previousAuthorizedExtensions.allowedCapabilities, "aucune"),
            });
            fields.push({
                label: "Selection precedente skill packs",
                value: formatList(previousAuthorizedExtensions.skillPackRefs, "aucun"),
            });
        }
        if (authorizedExtensions) {
            fields.push({
                label: "Capabilities mission",
                value: formatList(authorizedExtensions.allowedCapabilities, "aucune"),
            });
            fields.push({
                label: "Skill packs mission",
                value: formatList(authorizedExtensions.skillPackRefs, "aucun"),
            });
        }
        if (changedFields.length > 0) {
            fields.push({ label: "Champs modifies", value: changedFields.join(", ") });
        }
        if (trigger) {
            fields.push({ label: "Trigger", value: trigger });
        }
    }
    if (event.type === "ticket.created" || event.type === "ticket.claimed" || event.type === "ticket.in_progress") {
        if (ticket?.goal) {
            fields.push({ label: "Objectif ticket", value: ticket.goal });
        }
        if (ticket?.owner) {
            fields.push({ label: "Owner ticket", value: ticket.owner });
        }
        if (ticket?.kind) {
            fields.push({ label: "Type ticket", value: ticket.kind });
        }
    }
    if (event.type === "ticket.updated") {
        const changedFields = readStringArray(event.payload, "changedFields");
        if (changedFields.length > 0) {
            fields.push({ label: "Champs modifies", value: changedFields.join(", ") });
        }
    }
    if (event.type === "ticket.reprioritized") {
        const previousOrder = readOptionalNumber(event.payload, "previousOrder");
        const nextOrder = readOptionalNumber(event.payload, "nextOrder");
        if (previousOrder !== undefined) {
            fields.push({ label: "Position precedente", value: String(previousOrder + 1) });
        }
        if (nextOrder !== undefined) {
            fields.push({ label: "Position suivante", value: String(nextOrder + 1) });
        }
    }
    if (event.type === "ticket.cancelled") {
        const reason = readOptionalString(event.payload, "reason");
        if (reason) {
            fields.push({ label: "Raison", value: reason });
        }
    }
    if (event.type.startsWith("execution.")) {
        if (attempt?.status) {
            fields.push({ label: "Statut tentative", value: attempt.status });
        }
        if (attempt?.workspaceIsolationId) {
            fields.push({ label: "Isolation", value: attempt.workspaceIsolationId });
        }
        if (typeof attempt?.backgroundRequested === "boolean") {
            fields.push({
                label: "Mode",
                value: attempt.backgroundRequested ? "background" : "foreground",
            });
        }
    }
    if (event.type.startsWith("approval.")) {
        if (approval?.actionType) {
            fields.push({ label: "Action", value: approval.actionType });
        }
        if (approval?.actionSummary) {
            fields.push({ label: "Resume action", value: approval.actionSummary });
        }
        if (approval?.guardrails.length) {
            fields.push({ label: "Garde-fous", value: approval.guardrails.join(" ; ") });
        }
        if (decision?.outcome) {
            fields.push({ label: "Decision", value: decision.outcome });
        }
        if (decision?.reason) {
            fields.push({ label: "Raison decision", value: decision.reason });
        }
        if (decision?.budgetObservations?.length) {
            fields.push({
                label: "Observations budget",
                value: decision.budgetObservations.join(" ; "),
            });
        }
    }
    if (event.type.startsWith("artifact.")) {
        if (artifact?.title) {
            fields.push({ label: "Titre artefact", value: artifact.title });
        }
        if (artifact?.kind) {
            fields.push({ label: "Type artefact", value: artifact.kind });
        }
        const artifactReference = artifact?.path ?? artifact?.label;
        if (artifactReference) {
            fields.push({ label: "Reference artefact", value: artifactReference });
        }
        const producingEventId = readOptionalString(event.payload, "producingEventId");
        if (producingEventId) {
            fields.push({ label: "Evenement producteur", value: producingEventId });
        }
    }
    if (event.type === "workspace.isolation_created" && isolation) {
        fields.push({ label: "Isolation", value: isolation.workspaceIsolationId });
        fields.push({ label: "Type isolation", value: isolation.kind });
    }
    if (event.type === "capability.invoked" && capability) {
        fields.push({ label: "Capability", value: capability.capabilityId });
        fields.push({ label: "Registration", value: capability.registrationId });
        fields.push({ label: "Provider", value: capability.provider });
        fields.push({
            label: "Approval sensitive",
            value: capability.approvalSensitive ? "oui" : "non",
        });
        if (capability.permissions.length > 0) {
            fields.push({
                label: "Permissions",
                value: capability.permissions.join(" ; "),
            });
        }
        if (capability.constraints.length > 0) {
            fields.push({
                label: "Contraintes",
                value: capability.constraints.join(" ; "),
            });
        }
        if (capability.requiredEnvNames.length > 0) {
            fields.push({
                label: "Env requis",
                value: capability.requiredEnvNames.join(" ; "),
            });
        }
        const guardrails = readStringArray(event.payload, "guardrails");
        if (guardrails.length > 0) {
            fields.push({
                label: "Garde-fous",
                value: guardrails.join(" ; "),
            });
        }
        const trigger = readOptionalString(event.payload, "trigger");
        if (trigger) {
            fields.push({ label: "Trigger", value: trigger });
        }
    }
    if (event.type === "skill_pack.used" && skillPack) {
        fields.push({ label: "Skill pack", value: skillPack.packRef });
        fields.push({ label: "Registration", value: skillPack.registrationId });
        fields.push({ label: "Nom", value: skillPack.displayName });
        if (skillPack.permissions.length > 0) {
            fields.push({
                label: "Permissions",
                value: skillPack.permissions.join(" ; "),
            });
        }
        if (skillPack.constraints.length > 0) {
            fields.push({
                label: "Contraintes",
                value: skillPack.constraints.join(" ; "),
            });
        }
        fields.push({ label: "Owner", value: skillPack.owner });
        if (skillPack.tags.length > 0) {
            fields.push({
                label: "Tags",
                value: skillPack.tags.join(" ; "),
            });
        }
        const trigger = readOptionalString(event.payload, "trigger");
        if (trigger) {
            fields.push({ label: "Trigger", value: trigger });
        }
    }
    if (ticket?.goal && !fields.some((field) => field.label === "Objectif ticket")) {
        fields.push({ label: "Objectif ticket", value: ticket.goal });
    }
    if (sourceReferences.decisionRef) {
        fields.push({ label: "Decision liee", value: sourceReferences.decisionRef });
    }
    return fields;
}
async function readMissionSnapshotForAudit(layout, missionRepository, missionId) {
    try {
        const mission = await missionRepository.findById(missionId);
        if (mission) {
            return mission;
        }
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
    }
    return (0, mission_reconstruction_1.readMissionSnapshotFromJournalOrThrow)(layout.journalPath, missionId);
}
async function readTicketsForAudit(ticketRepository, missionId, events) {
    try {
        return await ticketRepository.listByMissionId(missionId);
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return (0, mission_reconstruction_1.reconstructTicketsFromJournal)(events, missionId);
    }
}
async function readArtifactsForAudit(artifactRepository, missionId) {
    try {
        return await artifactRepository.listByMissionId(missionId);
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return [];
    }
}
function readApprovalFromPayload(payload) {
    const candidate = payload.approval ?? payload.approvalRequest;
    return (0, persisted_document_guards_1.isApprovalRequest)(candidate) ? candidate : null;
}
function readArtifactFromPayload(payload) {
    const candidate = payload.artifact;
    return (0, persisted_document_guards_1.isArtifact)(candidate) ? candidate : null;
}
function readTicketFromPayload(payload) {
    const candidate = payload.ticket;
    return (0, persisted_document_guards_1.isTicket)(candidate) ? candidate : null;
}
function readAuthorizedExtensionsFromPayload(payload, key) {
    const candidate = payload[key];
    return isAuthorizedExtensions(candidate)
        ? {
            allowedCapabilities: [...candidate.allowedCapabilities],
            skillPackRefs: [...candidate.skillPackRefs],
        }
        : null;
}
function readAttemptFromPayload(payload) {
    const candidate = payload.attempt;
    return (0, persisted_document_guards_1.isExecutionAttempt)(candidate) ? candidate : null;
}
function readIsolationFromPayload(payload) {
    const candidate = payload.isolation;
    return (0, persisted_document_guards_1.isWorkspaceIsolationMetadata)(candidate) ? candidate : null;
}
// Extraction tolerante pour l'audit : on preserve l'outcome et les champs
// optionnels bien formes, on ignore ceux qui sont malformes sans laisser
// tomber toute la decision. Le guard canonique `isApprovalDecision`
// (packages/contracts) reste strict pour les reads repository.
function readDecisionFromPayload(payload) {
    const candidate = payload.decision;
    if (typeof candidate !== "object" || candidate === null) {
        return null;
    }
    const record = candidate;
    const outcome = record.outcome;
    if (outcome !== "approved" && outcome !== "rejected" && outcome !== "deferred") {
        return null;
    }
    const decision = { outcome };
    if (typeof record.reason === "string") {
        decision.reason = record.reason;
    }
    const missionPolicyChange = record.missionPolicyChange;
    if (isStringChange(missionPolicyChange)) {
        decision.missionPolicyChange = { ...missionPolicyChange };
    }
    const ticketCapabilityChange = record.ticketCapabilityChange;
    if (isStringArrayChange(ticketCapabilityChange)) {
        decision.ticketCapabilityChange = {
            previous: [...ticketCapabilityChange.previous],
            next: [...ticketCapabilityChange.next],
        };
    }
    const ticketSkillPackChange = record.ticketSkillPackChange;
    if (isStringArrayChange(ticketSkillPackChange)) {
        decision.ticketSkillPackChange = {
            previous: [...ticketSkillPackChange.previous],
            next: [...ticketSkillPackChange.next],
        };
    }
    const budgetObservations = record.budgetObservations;
    if (Array.isArray(budgetObservations) && budgetObservations.every((entry) => typeof entry === "string")) {
        decision.budgetObservations = [...budgetObservations];
    }
    return decision;
}
function isStringChange(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return typeof candidate.previous === "string" && typeof candidate.next === "string";
}
function isStringArrayChange(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return Array.isArray(candidate.previous)
        && candidate.previous.every((entry) => typeof entry === "string")
        && Array.isArray(candidate.next)
        && candidate.next.every((entry) => typeof entry === "string");
}
function readCapabilityFromPayload(payload) {
    const candidate = payload.capability;
    return (0, persisted_document_guards_1.isCapabilityInvocationDetails)(candidate) ? candidate : null;
}
function readSkillPackFromPayload(payload) {
    const candidate = payload.skillPack;
    return isSkillPackUsageDetails(candidate) ? candidate : null;
}
function readStringArray(payload, key) {
    const candidate = payload[key];
    return Array.isArray(candidate)
        ? candidate.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [];
}
function readOptionalString(payload, key) {
    const candidate = payload[key];
    return typeof candidate === "string" && candidate.trim().length > 0
        ? candidate
        : undefined;
}
function readOptionalNumber(payload, key) {
    const candidate = payload[key];
    return typeof candidate === "number" && Number.isFinite(candidate)
        ? candidate
        : undefined;
}
function formatList(values, emptyValue) {
    return values.length > 0 ? values.join(", ") : emptyValue;
}
function isAuthorizedExtensions(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return Array.isArray(candidate.allowedCapabilities)
        && candidate.allowedCapabilities.every((entry) => typeof entry === "string")
        && Array.isArray(candidate.skillPackRefs)
        && candidate.skillPackRefs.every((entry) => typeof entry === "string");
}
function isSkillPackUsageDetails(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return typeof candidate.packRef === "string"
        && typeof candidate.registrationId === "string"
        && typeof candidate.displayName === "string"
        && Array.isArray(candidate.permissions)
        && Array.isArray(candidate.constraints)
        && typeof candidate.owner === "string"
        && Array.isArray(candidate.tags);
}
