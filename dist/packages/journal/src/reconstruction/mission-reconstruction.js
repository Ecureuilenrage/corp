"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMissionEvents = readMissionEvents;
exports.readMissionFromJournal = readMissionFromJournal;
exports.readMissionSnapshotFromJournalOrThrow = readMissionSnapshotFromJournalOrThrow;
exports.reconstructMissionFromJournal = reconstructMissionFromJournal;
exports.reconstructTicketsFromJournal = reconstructTicketsFromJournal;
exports.reconstructAttemptsFromJournal = reconstructAttemptsFromJournal;
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const mission_1 = require("../../../contracts/src/mission/mission");
const event_log_errors_1 = require("../event-log/event-log-errors");
const file_event_log_1 = require("../event-log/file-event-log");
async function readMissionEvents(journalPath, missionId) {
    return (await (0, file_event_log_1.readEventLog)(journalPath)).filter((event) => event.missionId === missionId);
}
async function readMissionFromJournal(journalPath, missionId, options = {}) {
    return reconstructMissionFromJournal(await readMissionEvents(journalPath, missionId), missionId, options);
}
async function readMissionSnapshotFromJournalOrThrow(journalPath, missionId) {
    try {
        return await readMissionFromJournal(journalPath, missionId);
    }
    catch (error) {
        if ((0, event_log_errors_1.isEventLogReadError)(error)) {
            throw error;
        }
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
}
// Allow-list exhaustive des types d'event dont `payload.mission` porte l'etat mission
// autoritaire post-transition. Tout nouveau type d'event qui embarque une mission mise
// a jour DOIT etre ajoute ici, sinon l'etat reconstruit sera obsolete. Les payloads
// qui embarquent une mission a des fins historiques (ex. champ `previousMission`) ne
// doivent PAS etre inclus : seul `payload.mission` est lu.
const MISSION_AUTHORITATIVE_EVENT_TYPES = new Set([
    // Cycle de vie mission
    "mission.created",
    "mission.paused",
    "mission.relaunched",
    "mission.completed",
    "mission.cancelled",
    "mission.extensions_selected",
    // Cycle de vie ticket (mettent a jour mission.ticketIds / updatedAt)
    "ticket.created",
    "ticket.updated",
    "ticket.reprioritized",
    "ticket.cancelled",
    "ticket.claimed",
    "ticket.in_progress",
    // Execution (mettent a jour mission.updatedAt, compteurs attempts)
    "workspace.isolation_created",
    "execution.requested",
    "execution.background_started",
    "execution.completed",
    "execution.failed",
    "execution.cancelled",
    // Usage d'extensions (mettent a jour mission.eventIds / resumeCursor)
    "skill_pack.used",
    // File d'approbation
    "approval.requested",
    "approval.approved",
    "approval.rejected",
    "approval.deferred",
    // Artefacts (mettent a jour mission.artifactIds / updatedAt)
    "artifact.detected",
    "artifact.registered",
]);
function reconstructMissionFromJournal(missionEvents, missionId, options = {}) {
    let reconstructedMission = null;
    for (const event of missionEvents) {
        if (!MISSION_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
            continue;
        }
        const payloadMission = event.payload.mission;
        if ((0, persisted_document_guards_1.isMission)(payloadMission) && payloadMission.id === missionId) {
            reconstructedMission = (0, mission_1.hydrateMission)(payloadMission);
        }
    }
    if (!reconstructedMission) {
        const errorContextNoun = options.errorContextNoun ?? "la mission";
        throw new Error(`Journal mission irreconciliable pour ${missionId}. Impossible de reconstruire ${errorContextNoun}.`);
    }
    return reconstructedMission;
}
function reconstructTicketsFromJournal(missionEvents, missionId) {
    const ticketsById = new Map();
    for (const event of missionEvents) {
        const payloadTicket = event.payload.ticket;
        if ((0, persisted_document_guards_1.isTicket)(payloadTicket) && payloadTicket.missionId === missionId) {
            ticketsById.set(payloadTicket.id, payloadTicket);
        }
    }
    return [...ticketsById.values()];
}
function reconstructAttemptsFromJournal(missionEvents) {
    const attemptsById = new Map();
    for (const event of missionEvents) {
        const payloadAttempt = event.payload.attempt;
        if ((0, persisted_document_guards_1.isExecutionAttempt)(payloadAttempt)) {
            attemptsById.set(payloadAttempt.id, payloadAttempt);
        }
    }
    return [...attemptsById.values()];
}
