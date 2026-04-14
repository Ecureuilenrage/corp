"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMissionLifecycle = updateMissionLifecycle;
const promises_1 = require("node:fs/promises");
const node_crypto_1 = require("node:crypto");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const audit_log_projection_1 = require("../../../journal/src/projections/audit-log-projection");
const default_projections_1 = require("../../../journal/src/projections/default-projections");
const mission_status_projection_1 = require("../../../journal/src/projections/mission-status-projection");
const read_mission_resume_1 = require("../resume-service/read-mission-resume");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_artifact_repository_1 = require("../../../storage/src/repositories/file-artifact-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const CLOSEABLE_STATUSES = [
    "ready",
    "running",
    "blocked",
    "awaiting_approval",
    "failed",
];
const LIFECYCLE_TRANSITIONS = {
    pause: {
        allowedStatuses: ["ready", "running", "awaiting_approval", "failed"],
        nextStatus: "blocked",
        eventType: "mission.paused",
    },
    relaunch: {
        allowedStatuses: ["blocked", "failed", "awaiting_approval"],
        nextStatus: "ready",
        eventType: "mission.relaunched",
    },
};
const CLOSE_TRANSITIONS = {
    completed: {
        allowedStatuses: CLOSEABLE_STATUSES,
        nextStatus: "completed",
        eventType: "mission.completed",
    },
    cancelled: {
        allowedStatuses: CLOSEABLE_STATUSES,
        nextStatus: "cancelled",
        eventType: "mission.cancelled",
    },
};
async function updateMissionLifecycle(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureMissionWorkspaceInitialized(layout, options.action);
    const repository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const mission = await repository.findById(options.missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${options.missionId}.`);
    }
    const transition = resolveLifecycleTransition(mission.status, options.action, options.outcome);
    const occurredAt = new Date().toISOString();
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const updatedMission = {
        ...mission,
        status: transition.nextStatus,
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: transition.eventType,
        missionId: mission.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            previousStatus: mission.status,
            nextStatus: updatedMission.status,
            trigger: "operator",
            ...(options.reason ? { reason: options.reason } : {}),
        },
    };
    await (0, append_event_1.appendEvent)(layout.journalPath, event);
    const missionLocation = await repository.save(updatedMission);
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "mission-status", (0, mission_status_projection_1.createMissionStatusProjection)(updatedMission));
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const artifactRepository = (0, file_artifact_repository_1.createFileArtifactRepository)(layout);
    const missionEvents = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
        .filter((journalEvent) => journalEvent.missionId === updatedMission.id);
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "audit-log", (0, audit_log_projection_1.createAuditLogProjection)({
        mission: updatedMission,
        tickets: await ticketRepository.listByMissionId(updatedMission.id),
        artifacts: await artifactRepository.listByMissionId(updatedMission.id),
        events: missionEvents,
    }));
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
        rootDir: layout.rootDir,
        missionId: updatedMission.id,
        commandName: "resume",
    });
    return {
        mission: updatedMission,
        event,
        missionDir: missionLocation.missionDir,
        missionPath: missionLocation.missionPath,
        resume: resumeResult.resume,
    };
}
function resolveLifecycleTransition(currentStatus, action, outcome) {
    if (action === "close") {
        if (!outcome) {
            throw new Error("L'option --outcome est obligatoire pour `corp mission close`.");
        }
        const transition = CLOSE_TRANSITIONS[outcome];
        return ensureAllowedTransition(currentStatus, action, transition);
    }
    return ensureAllowedTransition(currentStatus, action, LIFECYCLE_TRANSITIONS[action]);
}
function ensureAllowedTransition(currentStatus, action, transition) {
    if (!transition.allowedStatuses.includes(currentStatus)) {
        throw new Error(`La transition \`${action}\` est interdite depuis le statut \`${currentStatus}\`.`);
    }
    return transition;
}
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
