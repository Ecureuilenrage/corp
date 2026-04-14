"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTicket = updateTicket;
const node_crypto_1 = require("node:crypto");
const ticket_1 = require("../../../contracts/src/ticket/ticket");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const read_mission_resume_1 = require("../../../mission-kernel/src/resume-service/read-mission-resume");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const validate_ticket_dependencies_1 = require("../dependency-graph/validate-ticket-dependencies");
const structural_compare_1 = require("../utils/structural-compare");
const ticket_service_support_1 = require("./ticket-service-support");
const NON_UPDATABLE_TICKET_STATUS_SET = new Set(ticket_1.NON_UPDATABLE_TICKET_STATUSES);
const UPDATABLE_TICKET_FIELDS = [
    "goal",
    "owner",
    "successCriteria",
    "dependsOn",
    "allowedCapabilities",
    "skillPackRefs",
];
async function updateTicket(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ticket_service_support_1.ensureMissionWorkspaceInitialized)(layout, "ticket update");
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, "L'option --mission-id est obligatoire pour `corp mission ticket update`.");
    const ticketId = (0, ticket_service_support_1.requireText)(options.ticketId, "L'option --ticket-id est obligatoire pour `corp mission ticket update`.");
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    const storedTicket = await ticketRepository.findById(mission.id, ticketId);
    const ticket = (0, ticket_service_support_1.requireTicketInMission)(storedTicket, mission, ticketId);
    if (options.status !== undefined && options.status !== ticket.status) {
        throw new Error(`Le statut du ticket ${ticket.id} ne peut pas etre modifie via \`corp mission ticket update\`. `
            + "Utilisez les commandes de transition dediees.");
    }
    if (NON_UPDATABLE_TICKET_STATUS_SET.has(ticket.status)) {
        throw new Error(formatNonUpdatableStatusError(ticket));
    }
    const missionTickets = await ticketRepository.listByMissionId(mission.id);
    const nextGoal = options.goal !== undefined
        ? (0, ticket_service_support_1.requireText)(options.goal, "L'option --goal ne peut pas etre vide pour `corp mission ticket update`.")
        : ticket.goal;
    const nextOwner = options.owner !== undefined
        ? (0, ticket_service_support_1.requireText)(options.owner, "L'option --owner ne peut pas etre vide pour `corp mission ticket update`.")
        : ticket.owner;
    const nextSuccessCriteria = options.successCriteria.length > 0
        ? (0, ticket_service_support_1.normalizeUpdatedSuccessCriteria)(options.successCriteria)
        : ticket.successCriteria;
    const nextDependsOn = options.clearDependsOn
        ? []
        : options.dependsOn.length > 0
            ? await (0, validate_ticket_dependencies_1.validateAndNormalizeTicketDependencies)({
                missionId: mission.id,
                ticketRepository,
                missionTickets,
                dependsOn: options.dependsOn,
                targetTicketId: ticket.id,
            })
            : ticket.dependsOn;
    const nextAllowedCapabilities = options.clearAllowedCapabilities
        ? []
        : options.allowedCapabilities.length > 0
            ? (0, ticket_service_support_1.normalizeOpaqueReferences)(options.allowedCapabilities)
            : ticket.allowedCapabilities;
    const nextSkillPackRefs = options.clearSkillPackRefs
        ? []
        : options.skillPackRefs.length > 0
            ? (0, ticket_service_support_1.normalizeOpaqueReferences)(options.skillPackRefs)
            : ticket.skillPackRefs;
    const normalizedTicket = {
        ...ticket,
        goal: nextGoal,
        owner: nextOwner,
        successCriteria: nextSuccessCriteria,
        dependsOn: nextDependsOn,
        allowedCapabilities: nextAllowedCapabilities,
        skillPackRefs: nextSkillPackRefs,
    };
    (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
        mission,
        allowedCapabilities: normalizedTicket.allowedCapabilities,
        skillPackRefs: normalizedTicket.skillPackRefs,
    });
    if (!hasEffectiveTicketMutation(ticket, normalizedTicket)) {
        throw new Error(`Aucune mutation effective detectee pour le ticket \`${ticket.id}\`.`);
    }
    const changedFields = collectChangedFields(ticket, normalizedTicket);
    const occurredAt = new Date().toISOString();
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const updatedTicket = {
        ...normalizedTicket,
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
        type: "ticket.updated",
        missionId: mission.id,
        ticketId: ticket.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            ticket: updatedTicket,
            previousTicket: ticket,
            changedFields,
            trigger: "operator",
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
function formatNonUpdatableStatusError(ticket) {
    return `Le ticket ${ticket.id} ne peut pas etre modifie dans son statut actuel (statut: ${ticket.status}). `
        + "Seuls les tickets en statut todo peuvent etre mis a jour via \`ticket update\`.";
}
function collectChangedFields(previousTicket, nextTicket) {
    const changedFields = [];
    for (const field of UPDATABLE_TICKET_FIELDS) {
        if (!areTicketFieldValuesEquivalent(field, previousTicket[field], nextTicket[field])) {
            changedFields.push(field);
        }
    }
    return changedFields;
}
function hasEffectiveTicketMutation(previousTicket, nextTicket) {
    return UPDATABLE_TICKET_FIELDS.some((field) => !areTicketFieldValuesEquivalent(field, previousTicket[field], nextTicket[field]));
}
function areTicketFieldValuesEquivalent(field, previousValue, nextValue) {
    if (field === "allowedCapabilities" || field === "skillPackRefs") {
        return (0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(previousValue, nextValue);
    }
    return (0, structural_compare_1.deepStrictEqualForComparison)(previousValue, nextValue);
}
