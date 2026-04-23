"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMissionResume = readMissionResume;
exports.readStoredResumeView = readStoredResumeView;
const approval_request_1 = require("../../../contracts/src/approval/approval-request");
const ticket_1 = require("../../../contracts/src/ticket/ticket");
const event_log_errors_1 = require("../../../journal/src/event-log/event-log-errors");
const mission_reconstruction_1 = require("../../../journal/src/reconstruction/mission-reconstruction");
const resume_view_projection_1 = require("../../../journal/src/projections/resume-view-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const persisted_document_errors_1 = require("../../../storage/src/repositories/persisted-document-errors");
const read_ticket_board_1 = require("../../../ticket-runtime/src/planner/read-ticket-board");
const ensure_mission_workspace_1 = require("../mission-service/ensure-mission-workspace");
const read_approval_queue_1 = require("./read-approval-queue");
const read_mission_artifacts_1 = require("./read-mission-artifacts");
const CLOSED_OPEN_TICKET_STATUSES = new Set([
    ...ticket_1.TERMINAL_TICKET_STATUSES,
]);
const TERMINAL_APPROVAL_STATUS_SET = new Set(approval_request_1.TERMINAL_APPROVAL_REQUEST_STATUSES);
async function readMissionResume(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: options.commandName,
        initializeJournal: false,
    });
    const repository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const storedMissionResult = await readStoredMissionSnapshot(repository, options.missionId);
    const storedMission = storedMissionResult.mission;
    let missionEvents;
    try {
        missionEvents = await (0, mission_reconstruction_1.readMissionEvents)(layout.journalPath, options.missionId);
    }
    catch (error) {
        if ((0, event_log_errors_1.isEventLogReadError)(error)) {
            throw error;
        }
        throw new Error(`Journal mission irreconciliable pour ${options.missionId}. Impossible de reconstruire la reprise.`, { cause: error });
    }
    const missionFromJournal = missionEvents.length > 0
        ? (0, mission_reconstruction_1.reconstructMissionFromJournal)(missionEvents, options.missionId, {
            errorContextNoun: "la reprise",
        })
        : null;
    const baseMission = storedMission ?? missionFromJournal;
    if (!baseMission && missionEvents.length === 0 && storedMissionResult.readError) {
        throw storedMissionResult.readError;
    }
    if (!baseMission) {
        throw new Error(`Mission introuvable: ${options.missionId}.`);
    }
    const ticketBoardResult = await (0, read_ticket_board_1.readTicketBoard)({
        rootDir: layout.rootDir,
        missionId: options.missionId,
        commandName: options.commandName,
    });
    const approvalQueueResult = await (0, read_approval_queue_1.readApprovalQueue)({
        rootDir: layout.rootDir,
        missionId: options.missionId,
        commandName: options.commandName,
    });
    const artifactIndexResult = await (0, read_mission_artifacts_1.readMissionArtifacts)({
        rootDir: layout.rootDir,
        missionId: options.missionId,
        commandName: options.commandName,
    });
    const lastMissionEvent = missionEvents.at(-1);
    if (!lastMissionEvent) {
        throw new Error(`Journal mission irreconciliable pour ${options.missionId}. Impossible de reconstruire la reprise.`);
    }
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "resume-view");
    const rawResumeViewResult = await readStoredResumeView(layout.projectionsDir);
    const rawResumeView = rawResumeViewResult.projection;
    const shouldReconstruct = !storedMission
        || isMissionSnapshotSuspicious(storedMission, lastMissionEvent.eventId)
        || approvalQueueResult.reconstructed
        || ticketBoardResult.reconstructed
        || artifactIndexResult.reconstructed
        || rawResumeViewResult.readError !== null
        || isResumeViewSuspicious(rawResumeView, options.missionId, lastMissionEvent.eventId);
    const mission = shouldReconstruct
        ? (0, mission_reconstruction_1.reconstructMissionFromJournal)(missionEvents, options.missionId, {
            errorContextNoun: "la reprise",
        })
        : baseMission;
    const resume = buildMissionResume({
        mission,
        missionEvents,
        ticketBoardProjection: ticketBoardResult.board,
        pendingApprovals: approvalQueueResult.approvals,
        artifactIndexArtifacts: artifactIndexResult.artifacts,
        lastMissionEvent,
    });
    if (shouldReconstruct) {
        await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "resume-view", (0, resume_view_projection_1.createResumeViewProjection)(mission, {
            openTickets: resume.openTickets,
            pendingApprovals: resume.pendingApprovals,
            lastRelevantArtifact: resume.lastRelevantArtifact,
            lastKnownBlockage: resume.lastKnownBlockage,
            lastEventId: resume.lastEventId,
            updatedAt: resume.updatedAt,
            nextOperatorAction: resume.nextOperatorAction,
        }));
        return {
            resume,
            reconstructed: true,
            resumeProjectionPath: projectionPath,
            ticketBoard: ticketBoardResult.board,
            ticketBoardReconstructed: ticketBoardResult.reconstructed,
        };
    }
    return {
        resume,
        reconstructed: false,
        resumeProjectionPath: projectionPath,
        ticketBoard: ticketBoardResult.board,
        ticketBoardReconstructed: ticketBoardResult.reconstructed,
    };
}
async function readStoredResumeView(projectionsDir) {
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(projectionsDir, "resume-view");
    try {
        return {
            projection: JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "resume-view")),
            readError: null,
        };
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            return {
                projection: null,
                readError: null,
            };
        }
        if (error instanceof SyntaxError) {
            return {
                projection: null,
                readError: new persisted_document_errors_1.CorruptedPersistedDocumentError({
                    filePath: projectionPath,
                    entityLabel: "Projection resume-view",
                    corruptionLabel: "projection resume-view",
                }, error),
            };
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw (0, file_system_read_errors_1.createFileSystemReadError)(error, projectionPath, "projection resume-view");
        }
        throw error;
    }
}
function isResumeViewSuspicious(projection, missionId, lastEventId) {
    if (!projection) {
        return true;
    }
    if (projection.schemaVersion !== 1) {
        return true;
    }
    if (!projection.resume) {
        return true;
    }
    if (!isMissionResume(projection.resume)) {
        return true;
    }
    return projection.resume.missionId !== missionId
        || projection.resume.lastEventId !== lastEventId;
}
function buildMissionResume(options) {
    const openTickets = filterMissionEntities(options.ticketBoardProjection.tickets, options.mission.id, (ticketStatus) => !CLOSED_OPEN_TICKET_STATUSES.has(ticketStatus));
    const pendingApprovals = filterMissionEntities(options.pendingApprovals, options.mission.id, (approvalStatus) => !TERMINAL_APPROVAL_STATUS_SET.has(approvalStatus));
    const lastRelevantArtifact = selectLastArtifact(options.artifactIndexArtifacts, options.mission.id);
    return (0, resume_view_projection_1.createMissionResume)(options.mission, {
        openTickets,
        pendingApprovals,
        lastRelevantArtifact,
        ticketBoardEntries: options.ticketBoardProjection.tickets,
        missionEvents: options.missionEvents,
        lastEventId: options.lastMissionEvent.eventId,
        updatedAt: pickLatestTimestamp([
            options.mission.updatedAt,
            options.lastMissionEvent.occurredAt,
        ]),
        hasFailedTickets: options.ticketBoardProjection.tickets.some((ticket) => ticket.status === "failed"),
    });
}
function isMissionSnapshotSuspicious(mission, lastEventId) {
    return mission.resumeCursor !== lastEventId;
}
async function readStoredMissionSnapshot(repository, missionId) {
    try {
        return {
            mission: await repository.findById(missionId),
            readError: null,
        };
    }
    catch (error) {
        if ((0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            return {
                mission: null,
                readError: error,
            };
        }
        throw error;
    }
}
function filterMissionEntities(entities, missionId, isPendingStatus) {
    return entities.filter((entity) => {
        const entityRecord = entity;
        const entityMissionId = readOptionalString(entityRecord, "missionId");
        if (entityMissionId && entityMissionId !== missionId) {
            return false;
        }
        const status = readOptionalString(entityRecord, "status");
        return !status || isPendingStatus(status);
    });
}
function selectLastArtifact(artifacts, missionId) {
    const missionArtifacts = artifacts.filter((artifact) => {
        const entityMissionId = readOptionalString(artifact, "missionId");
        return entityMissionId === missionId;
    });
    return missionArtifacts.at(-1) ?? null;
}
function pickLatestTimestamp(timestamps) {
    return [...timestamps].sort((left, right) => left.localeCompare(right)).at(-1)
        ?? timestamps[0]
        ?? new Date(0).toISOString();
}
function readOptionalString(value, key) {
    const candidate = value[key];
    return typeof candidate === "string" && candidate.trim().length > 0
        ? candidate
        : undefined;
}
function isMissionResume(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return typeof candidate.missionId === "string"
        && typeof candidate.title === "string"
        && typeof candidate.objective === "string"
        && typeof candidate.status === "string"
        && Array.isArray(candidate.successCriteria)
        && candidate.successCriteria.every((criterion) => typeof criterion === "string")
        && isAuthorizedExtensions(candidate.authorizedExtensions)
        && Array.isArray(candidate.openTickets)
        && Array.isArray(candidate.pendingApprovals)
        && (candidate.lastRelevantArtifact === null || isRecord(candidate.lastRelevantArtifact))
        && (!("lastKnownBlockage" in candidate)
            || candidate.lastKnownBlockage === undefined
            || candidate.lastKnownBlockage === null
            || isMissionResumeBlockage(candidate.lastKnownBlockage))
        && typeof candidate.lastEventId === "string"
        && typeof candidate.updatedAt === "string"
        && typeof candidate.nextOperatorAction === "string";
}
function isMissionResumeBlockage(value) {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.kind === "string"
        && typeof value.summary === "string"
        && typeof value.missionStatus === "string"
        && typeof value.occurredAt === "string"
        && isOptionalString(value.reasonCode)
        && isOptionalString(value.ticketId)
        && isOptionalString(value.attemptId)
        && isOptionalString(value.approvalId)
        && (value.sourceEventId === undefined
            || value.sourceEventId === null
            || typeof value.sourceEventId === "string");
}
function isAuthorizedExtensions(value) {
    if (!isRecord(value)) {
        return false;
    }
    return Array.isArray(value.allowedCapabilities)
        && value.allowedCapabilities.every((entry) => typeof entry === "string")
        && Array.isArray(value.skillPackRefs)
        && value.skillPackRefs.every((entry) => typeof entry === "string");
}
function isOptionalString(value) {
    return value === undefined || typeof value === "string";
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
