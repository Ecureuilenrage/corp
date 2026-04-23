"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveTicket = moveTicket;
const node_crypto_1 = require("node:crypto");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const read_mission_resume_1 = require("../../../mission-kernel/src/resume-service/read-mission-resume");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const ensure_mission_workspace_1 = require("../../../mission-kernel/src/mission-service/ensure-mission-workspace");
const ticket_service_support_1 = require("./ticket-service-support");
async function moveTicket(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: "ticket move",
        cleanupLocks: true,
    });
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, "L'option --mission-id est obligatoire pour `corp mission ticket move`.");
    const ticketId = (0, ticket_service_support_1.requireText)(options.ticketId, "L'option --ticket-id est obligatoire pour `corp mission ticket move`.");
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    const storedTicket = await ticketRepository.findById(mission.id, ticketId);
    const ticket = (0, ticket_service_support_1.requireTicketInMission)(storedTicket, mission, ticketId);
    const previousOrder = [...mission.ticketIds];
    const nextOrder = await computeNextOrder(mission, ticket.id, options.strategy, ticketRepository);
    if (arraysEqual(previousOrder, nextOrder)) {
        throw new Error(`Le ticket \`${ticket.id}\` est deja a cette position.`);
    }
    const occurredAt = new Date().toISOString();
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const updatedTicket = {
        ...ticket,
        eventIds: [...ticket.eventIds, eventId],
        updatedAt: occurredAt,
    };
    const updatedMission = {
        ...mission,
        ticketIds: nextOrder,
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: "ticket.reprioritized",
        missionId: mission.id,
        ticketId: ticket.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            ticket: updatedTicket,
            previousOrder: previousOrder.indexOf(ticket.id),
            nextOrder: nextOrder.indexOf(ticket.id),
            orderedTicketIds: [...nextOrder],
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
async function computeNextOrder(mission, ticketId, strategy, ticketRepository) {
    const currentOrder = [...mission.ticketIds];
    const currentIndex = currentOrder.indexOf(ticketId);
    if (currentIndex < 0) {
        throw new Error(`Ticket introuvable dans la mission \`${mission.id}\`: \`${ticketId}\`.`);
    }
    if ((strategy.type === "before-ticket" || strategy.type === "after-ticket")
        && strategy.referenceTicketId === ticketId) {
        throw new Error(`Le ticket \`${ticketId}\` ne peut pas etre deplace par rapport a lui-meme.`);
    }
    const orderWithoutTarget = currentOrder.filter((currentTicketId) => currentTicketId !== ticketId);
    if (strategy.type === "to-front") {
        return [ticketId, ...orderWithoutTarget];
    }
    if (strategy.type === "to-back") {
        return [...orderWithoutTarget, ticketId];
    }
    const referenceTicketId = strategy.referenceTicketId;
    const referenceIndex = orderWithoutTarget.indexOf(referenceTicketId);
    if (referenceIndex < 0) {
        const referenceMissionId = await ticketRepository.findOwningMissionId(referenceTicketId);
        if (referenceMissionId && referenceMissionId !== mission.id) {
            throw new Error(`Le ticket de reference \`${referenceTicketId}\` n'appartient pas a la mission \`${mission.id}\`.`);
        }
        throw new Error(`Le ticket de reference \`${referenceTicketId}\` est introuvable dans la mission \`${mission.id}\`.`);
    }
    const insertionIndex = strategy.type === "before-ticket"
        ? referenceIndex
        : referenceIndex + 1;
    return [
        ...orderWithoutTarget.slice(0, insertionIndex),
        ticketId,
        ...orderWithoutTarget.slice(insertionIndex),
    ];
}
function arraysEqual(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}
