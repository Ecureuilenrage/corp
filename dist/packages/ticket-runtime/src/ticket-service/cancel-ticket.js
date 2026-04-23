"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTicket = cancelTicket;
const node_crypto_1 = require("node:crypto");
const ticket_1 = require("../../../contracts/src/ticket/ticket");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const read_mission_resume_1 = require("../../../mission-kernel/src/resume-service/read-mission-resume");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const file_execution_attempt_repository_1 = require("../../../storage/src/repositories/file-execution-attempt-repository");
const ensure_mission_workspace_1 = require("../../../mission-kernel/src/mission-service/ensure-mission-workspace");
const ticket_service_support_1 = require("./ticket-service-support");
const TERMINAL_TICKET_STATUS_SET = new Set(ticket_1.TERMINAL_TICKET_STATUSES);
async function cancelTicket(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: "ticket cancel",
        cleanupLocks: true,
    });
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, "L'option --mission-id est obligatoire pour `corp mission ticket cancel`.");
    const ticketId = (0, ticket_service_support_1.requireText)(options.ticketId, "L'option --ticket-id est obligatoire pour `corp mission ticket cancel`.");
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    const storedTicket = await ticketRepository.findById(mission.id, ticketId);
    const ticket = (0, ticket_service_support_1.requireTicketInMission)(storedTicket, mission, ticketId);
    if (TERMINAL_TICKET_STATUS_SET.has(ticket.status)) {
        throw new Error(formatTerminalCancelError(ticket));
    }
    if (ticket.status === "in_progress") {
        const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
        const activeAttempt = await attemptRepository.findActiveByTicketId(mission.id, ticket.id);
        if (activeAttempt) {
            throw new Error(`Le ticket \`${ticket.id}\` est en cours d'execution (attempt: \`${activeAttempt.id}\`). Annulation refusee.`);
        }
    }
    const occurredAt = new Date().toISOString();
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const normalizedReason = options.reason?.trim() || undefined;
    const updatedTicket = {
        ...ticket,
        status: "cancelled",
        eventIds: [...ticket.eventIds, eventId],
        updatedAt: occurredAt,
    };
    const updatedMission = {
        ...mission,
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: "ticket.cancelled",
        missionId: mission.id,
        ticketId: ticket.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            ticket: updatedTicket,
            previousStatus: ticket.status,
            trigger: "operator",
            ...(normalizedReason ? { reason: normalizedReason } : {}),
        },
    };
    await (0, append_event_1.appendEvent)(layout.journalPath, event);
    await ticketRepository.save(updatedTicket);
    await missionRepository.save(updatedMission);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, updatedMission, ticketRepository);
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
        rootDir: layout.rootDir,
        missionId: updatedMission.id,
        commandName: "resume",
    });
    return {
        mission: updatedMission,
        ticket: updatedTicket,
        event,
        resume: resumeResult.resume,
    };
}
function formatTerminalCancelError(ticket) {
    if (ticket.status === "done") {
        return `Le ticket ${ticket.id} est deja termine (statut: done).`;
    }
    if (ticket.status === "failed") {
        return `Le ticket ${ticket.id} est deja en echec (statut: failed).`;
    }
    return `Le ticket ${ticket.id} est deja annule.`;
}
