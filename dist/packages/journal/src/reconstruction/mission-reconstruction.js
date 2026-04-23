"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATTEMPT_AUTHORITATIVE_EVENT_TYPES = exports.TICKET_AUTHORITATIVE_EVENT_TYPES = exports.MISSION_AUTHORITATIVE_EVENT_TYPES = void 0;
exports.readMissionEvents = readMissionEvents;
exports.readMissionFromJournal = readMissionFromJournal;
exports.readMissionSnapshotFromJournalOrThrow = readMissionSnapshotFromJournalOrThrow;
exports.reconstructMissionFromJournal = reconstructMissionFromJournal;
exports.reconstructTicketsFromJournal = reconstructTicketsFromJournal;
exports.reconstructAttemptsFromJournal = reconstructAttemptsFromJournal;
exports.getLastAuthoritativeMissionCursor = getLastAuthoritativeMissionCursor;
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
exports.MISSION_AUTHORITATIVE_EVENT_TYPES = new Set([
    "mission.created",
    "mission.paused",
    "mission.relaunched",
    "mission.completed",
    "mission.cancelled",
    "mission.extensions_selected",
    "ticket.created",
    "ticket.updated",
    "ticket.reprioritized",
    "ticket.cancelled",
    "ticket.claimed",
    "ticket.in_progress",
    "workspace.isolation_created",
    "execution.requested",
    "execution.background_started",
    "execution.completed",
    "execution.failed",
    "execution.cancelled",
    "skill_pack.used",
    "approval.requested",
    "approval.approved",
    "approval.rejected",
    "approval.deferred",
    "artifact.detected",
    "artifact.registered",
]);
exports.TICKET_AUTHORITATIVE_EVENT_TYPES = new Set([
    "ticket.created",
    "ticket.updated",
    "ticket.reprioritized",
    "ticket.cancelled",
    "ticket.claimed",
    "ticket.in_progress",
    "execution.requested",
    "execution.background_started",
    "execution.completed",
    "execution.failed",
    "execution.cancelled",
    "approval.requested",
    "approval.approved",
    "approval.rejected",
    "approval.deferred",
]);
exports.ATTEMPT_AUTHORITATIVE_EVENT_TYPES = new Set([
    "execution.requested",
    "ticket.in_progress",
    "execution.background_started",
    "approval.requested",
    "approval.approved",
    "approval.rejected",
    "approval.deferred",
    "execution.completed",
    "execution.failed",
    "execution.cancelled",
]);
function reconstructMissionFromJournal(missionEvents, missionId, options = {}) {
    let reconstructedMission = null;
    for (const event of missionEvents) {
        if (!exports.MISSION_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
            continue;
        }
        const payloadMission = readPayloadRecord(event.payload, "mission");
        const nextMission = payloadMission
            ? tryReadMissionSnapshot(payloadMission, missionId)
            : null;
        if (nextMission) {
            reconstructedMission = nextMission;
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
        if (event.missionId !== missionId || !exports.TICKET_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
            continue;
        }
        const payloadTicket = readPayloadRecord(event.payload, "ticket");
        const nextTicket = payloadTicket
            ? tryReadTicketSnapshot(payloadTicket, missionId)
            : null;
        if (nextTicket) {
            ticketsById.set(nextTicket.id, nextTicket);
        }
    }
    return [...ticketsById.values()];
}
function reconstructAttemptsFromJournal(missionEvents, missionId) {
    const attemptsById = new Map();
    for (const event of missionEvents) {
        if (event.missionId !== missionId || !exports.ATTEMPT_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
            continue;
        }
        const payloadAttempt = readPayloadRecord(event.payload, "attempt");
        const nextAttempt = payloadAttempt ? tryReadAttemptSnapshot(payloadAttempt) : null;
        if (nextAttempt) {
            attemptsById.set(nextAttempt.id, nextAttempt);
        }
    }
    return [...attemptsById.values()];
}
function getLastAuthoritativeMissionCursor(missionEvents) {
    for (let index = missionEvents.length - 1; index >= 0; index -= 1) {
        const event = missionEvents[index];
        if (!event || !exports.MISSION_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
            continue;
        }
        const payloadMission = readPayloadRecord(event.payload, "mission");
        if (!payloadMission) {
            continue;
        }
        const warnings = [];
        const validation = (0, persisted_document_guards_1.validateMission)(payloadMission, {
            strict: false,
            warnings,
        });
        if (!validation.ok) {
            continue;
        }
        return {
            occurredAt: event.occurredAt,
            eventId: event.eventId,
        };
    }
    return null;
}
function tryReadMissionSnapshot(candidate, missionId) {
    const warnings = [];
    const validation = (0, persisted_document_guards_1.validateMission)(candidate, { strict: false, warnings });
    if (!validation.ok || candidate.id !== missionId) {
        return null;
    }
    return (0, persisted_document_guards_1.attachStructuralValidationWarnings)((0, mission_1.hydrateMission)(candidate), warnings);
}
function tryReadTicketSnapshot(candidate, missionId) {
    const warnings = [];
    const validation = (0, persisted_document_guards_1.validateTicket)(candidate, { strict: false, warnings });
    if (!validation.ok || candidate.missionId !== missionId) {
        return null;
    }
    return (0, persisted_document_guards_1.attachStructuralValidationWarnings)(candidate, warnings);
}
function tryReadAttemptSnapshot(candidate) {
    const warnings = [];
    const validation = (0, persisted_document_guards_1.validateExecutionAttempt)(candidate, { strict: false, warnings });
    if (!validation.ok) {
        return null;
    }
    return (0, persisted_document_guards_1.attachStructuralValidationWarnings)(candidate, warnings);
}
function readPayloadRecord(payload, key) {
    const candidate = payload[key];
    return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)
        ? candidate
        : null;
}
