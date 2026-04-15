"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMissionLifecycle = updateMissionLifecycle;
const node_crypto_1 = require("node:crypto");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const read_mission_resume_1 = require("../resume-service/read-mission-resume");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const ticket_service_support_1 = require("../../../ticket-runtime/src/ticket-service/ticket-service-support");
const ensure_mission_workspace_1 = require("./ensure-mission-workspace");
const LIFECYCLE_SKIP_PROJECTIONS = new Set(["resume-view"]);
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
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: options.action,
        skipProjections: LIFECYCLE_SKIP_PROJECTIONS,
    });
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
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, updatedMission, ticketRepository);
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
