"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILT_IN_ALLOWED_CAPABILITIES = void 0;
exports.ensureMissionWorkspaceInitialized = ensureMissionWorkspaceInitialized;
exports.requireText = requireText;
exports.requireTicketKind = requireTicketKind;
exports.normalizeTrimmedList = normalizeTrimmedList;
exports.normalizeOpaqueReferences = normalizeOpaqueReferences;
exports.isBuiltInAllowedCapability = isBuiltInAllowedCapability;
exports.ensureTicketExtensionsAllowedByMission = ensureTicketExtensionsAllowedByMission;
exports.buildApprovalGuardrailsSnapshot = buildApprovalGuardrailsSnapshot;
exports.requireCreateSuccessCriteria = requireCreateSuccessCriteria;
exports.normalizeUpdatedSuccessCriteria = normalizeUpdatedSuccessCriteria;
exports.requireTicketInMission = requireTicketInMission;
exports.applyExecutionHandleSnapshot = applyExecutionHandleSnapshot;
exports.rewriteMissionReadModels = rewriteMissionReadModels;
exports.missionHasOtherActiveAttempts = missionHasOtherActiveAttempts;
const promises_1 = require("node:fs/promises");
const ticket_1 = require("../../../contracts/src/ticket/ticket");
const default_projections_1 = require("../../../journal/src/projections/default-projections");
const artifact_index_projection_1 = require("../../../journal/src/projections/artifact-index-projection");
const audit_log_projection_1 = require("../../../journal/src/projections/audit-log-projection");
const approval_queue_projection_1 = require("../../../journal/src/projections/approval-queue-projection");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const mission_status_projection_1 = require("../../../journal/src/projections/mission-status-projection");
const resume_view_projection_1 = require("../../../journal/src/projections/resume-view-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const file_execution_attempt_repository_1 = require("../../../storage/src/repositories/file-execution-attempt-repository");
const file_artifact_repository_1 = require("../../../storage/src/repositories/file-artifact-repository");
const build_ticket_board_1 = require("../planner/build-ticket-board");
const structural_compare_1 = require("../utils/structural-compare");
exports.BUILT_IN_ALLOWED_CAPABILITIES = new Set([
    "fs.read",
    "cli.run",
]);
const CLOSED_OPEN_TICKET_STATUSES = new Set([
    ...ticket_1.TERMINAL_TICKET_STATUSES,
]);
async function ensureMissionWorkspaceInitialized(layout, commandName) {
    try {
        await (0, promises_1.access)(layout.journalPath);
        for (const projectionName of Object.keys(default_projections_1.DEFAULT_PROJECTIONS)) {
            if (projectionName === "resume-view") {
                continue;
            }
            await (0, promises_1.access)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName));
        }
    }
    catch {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`);
    }
}
function requireText(value, errorMessage) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
        throw new Error(errorMessage);
    }
    return normalizedValue;
}
function requireTicketKind(value) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
        throw new Error("L'option --kind est obligatoire pour `corp mission ticket create`.");
    }
    if (ticket_1.TICKET_KINDS.includes(normalizedValue)) {
        return normalizedValue;
    }
    throw new Error("L'option --kind doit valoir `research`, `plan`, `implement`, `review` ou `operate` pour `corp mission ticket create`.");
}
function normalizeTrimmedList(values, options = {}) {
    const normalizedValues = [];
    const seenValues = new Set();
    for (const rawValue of values) {
        const normalizedValue = rawValue.trim();
        if (!normalizedValue) {
            continue;
        }
        if (options.dedupe) {
            if (seenValues.has(normalizedValue)) {
                continue;
            }
            seenValues.add(normalizedValue);
        }
        normalizedValues.push(normalizedValue);
    }
    return normalizedValues;
}
function normalizeOpaqueReferences(values) {
    return normalizeTrimmedList(values, { dedupe: true });
}
function isBuiltInAllowedCapability(capabilityId) {
    return exports.BUILT_IN_ALLOWED_CAPABILITIES.has(capabilityId);
}
function ensureTicketExtensionsAllowedByMission(options) {
    const allowedCapabilities = new Set(options.mission.authorizedExtensions.allowedCapabilities);
    const skillPackRefs = new Set(options.mission.authorizedExtensions.skillPackRefs);
    for (const capabilityId of options.allowedCapabilities) {
        if (isBuiltInAllowedCapability(capabilityId)) {
            continue;
        }
        if (!allowedCapabilities.has(capabilityId)) {
            throw new Error(`La capability \`${capabilityId}\` n'est pas autorisee par la mission \`${options.mission.id}\`.`);
        }
    }
    for (const packRef of options.skillPackRefs) {
        if (!skillPackRefs.has(packRef)) {
            throw new Error(`Le skill pack \`${packRef}\` n'est pas autorise par la mission \`${options.mission.id}\`.`);
        }
    }
}
function buildApprovalGuardrailsSnapshot(options) {
    return normalizeTrimmedList([
        ...options.baseGuardrails.filter((guardrail) => !guardrail.startsWith("policy_profile:")
            && !guardrail.startsWith("allowed_capabilities:")
            && !guardrail.startsWith("skill_packs:")),
        `policy_profile: ${options.policyProfileId}`,
        ...(options.allowedCapabilities.length > 0
            ? [`allowed_capabilities: ${options.allowedCapabilities.join(", ")}`]
            : []),
        ...(options.skillPackRefs.length > 0
            ? [`skill_packs: ${options.skillPackRefs.join(", ")}`]
            : []),
    ], { dedupe: true });
}
function requireCreateSuccessCriteria(successCriteria) {
    const normalizedCriteria = normalizeTrimmedList(successCriteria);
    if (normalizedCriteria.length === 0) {
        throw new Error("Au moins un `--success-criterion` est obligatoire pour `corp mission ticket create`.");
    }
    return normalizedCriteria;
}
function normalizeUpdatedSuccessCriteria(successCriteria) {
    const normalizedCriteria = normalizeTrimmedList(successCriteria, { dedupe: true });
    if (normalizedCriteria.length === 0) {
        throw new Error("Au moins un `--success-criterion` est requis pour `corp mission ticket update`.");
    }
    return normalizedCriteria;
}
function requireTicketInMission(ticket, mission, ticketId) {
    if (!ticket || !mission.ticketIds.includes(ticketId)) {
        throw new Error(`Ticket introuvable dans la mission \`${mission.id}\`: \`${ticketId}\`.`);
    }
    return ticket;
}
function applyExecutionHandleSnapshot(ticket, adapterId, adapterState) {
    return {
        ...ticket,
        executionHandle: {
            adapter: adapterId,
            adapterState: { ...adapterState },
        },
    };
}
async function rewriteMissionReadModels(layout, mission, ticketRepository, options = {}) {
    const missionTickets = await ticketRepository.listByMissionId(mission.id);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const artifactRepository = (0, file_artifact_repository_1.createFileArtifactRepository)(layout);
    const missionAttempts = [];
    for (const ticketId of mission.ticketIds) {
        missionAttempts.push(...(await attemptRepository.listByTicketId(mission.id, ticketId)));
    }
    const missionArtifacts = await artifactRepository.listByMissionId(mission.id);
    const missionEvents = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
        .filter((event) => event.missionId === mission.id);
    const ticketBoardProjection = (0, build_ticket_board_1.buildTicketBoardProjection)(mission, missionTickets, missionAttempts, missionEvents);
    const approvalQueueProjection = (0, approval_queue_projection_1.createApprovalQueueProjection)({
        missionId: mission.id,
        events: missionEvents,
    });
    const storedApprovalQueueProjection = await readProjectionSnapshotOrNull(layout.projectionsDir, "approval-queue");
    const artifactIndexProjection = options.skipArtifactIndex
        ? await readProjectionSnapshotOrDefault(layout.projectionsDir, "artifact-index", default_projections_1.DEFAULT_PROJECTIONS["artifact-index"])
        : (0, artifact_index_projection_1.createArtifactIndexProjection)({
            mission,
            tickets: missionTickets,
            artifacts: missionArtifacts,
            events: missionEvents,
        });
    const auditLogProjection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: missionTickets,
        artifacts: missionArtifacts,
        events: missionEvents,
    });
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "mission-status", (0, mission_status_projection_1.createMissionStatusProjection)(mission));
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "ticket-board", ticketBoardProjection);
    if (!storedApprovalQueueProjection
        || !(0, structural_compare_1.deepStrictEqualForComparison)(storedApprovalQueueProjection, approvalQueueProjection)) {
        await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "approval-queue", approvalQueueProjection);
    }
    if (!options.skipArtifactIndex) {
        await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "artifact-index", artifactIndexProjection);
    }
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "audit-log", auditLogProjection);
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "resume-view", (0, resume_view_projection_1.buildResumeViewProjection)({
        mission,
        missionEvents,
        ticketBoardEntries: ticketBoardProjection.tickets,
        openTickets: ticketBoardProjection.tickets.filter((ticket) => !CLOSED_OPEN_TICKET_STATUSES.has(ticket.status)),
        pendingApprovals: approvalQueueProjection.approvals,
        lastRelevantArtifact: artifactIndexProjection.artifacts.at(-1) ?? null,
        hasFailedTickets: ticketBoardProjection.tickets.some((ticket) => ticket.status === "failed"),
    }));
}
async function missionHasOtherActiveAttempts(missionId, currentTicketId, missionTicketIds, attemptRepository) {
    for (const ticketId of missionTicketIds) {
        if (ticketId === currentTicketId) {
            continue;
        }
        const activeAttempt = await attemptRepository.findActiveByTicketId(missionId, ticketId);
        if (activeAttempt) {
            return true;
        }
    }
    return false;
}
async function readProjectionSnapshotOrNull(projectionsDir, projectionName) {
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, projectionName));
    }
    catch (error) {
        if (isMissingFileError(error) || error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
}
async function readProjectionSnapshotOrDefault(projectionsDir, projectionName, fallback) {
    try {
        return await (0, file_projection_store_1.readProjectionSnapshot)(projectionsDir, projectionName);
    }
    catch (error) {
        if (isMissingFileError(error) || error instanceof SyntaxError) {
            return fallback;
        }
        throw error;
    }
}
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
