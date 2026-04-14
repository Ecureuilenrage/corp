"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndNormalizeTicketDependencies = validateAndNormalizeTicketDependencies;
const ticket_service_support_1 = require("../ticket-service/ticket-service-support");
async function validateAndNormalizeTicketDependencies(options) {
    const normalizedDependencies = (0, ticket_service_support_1.normalizeOpaqueReferences)(options.dependsOn);
    const missionTicketsById = new Map(options.missionTickets.map((ticket) => [ticket.id, ticket]));
    for (const dependencyId of normalizedDependencies) {
        if (options.targetTicketId && dependencyId === options.targetTicketId) {
            throw new Error(`Le ticket \`${options.targetTicketId}\` ne peut pas dependre de lui-meme.`);
        }
        const dependencyTicket = missionTicketsById.get(dependencyId);
        if (dependencyTicket) {
            if (dependencyTicket.status === "cancelled") {
                // A cancelled prerequisite can never become `done`, so accepting it here would
                // permanently deadlock the dependent ticket. We still accept `failed` tickets
                // because they may be retried later and eventually unblock the graph.
                throw new Error(`La dependance \`${dependencyId}\` est deja \`cancelled\` dans la mission \`${options.missionId}\`.`);
            }
            continue;
        }
        const dependencyMissionId = await options.ticketRepository.findOwningMissionId(dependencyId);
        if (dependencyMissionId && dependencyMissionId !== options.missionId) {
            throw new Error(`La dependance \`${dependencyId}\` n'appartient pas a la mission \`${options.missionId}\`.`);
        }
        throw new Error(`La dependance \`${dependencyId}\` est introuvable dans la mission \`${options.missionId}\`.`);
    }
    if (options.targetTicketId
        && introducesDependencyCycle(missionTicketsById, options.targetTicketId, normalizedDependencies)) {
        throw new Error(`La mise a jour du ticket \`${options.targetTicketId}\` introduit un cycle de dependances.`);
    }
    return normalizedDependencies;
}
function introducesDependencyCycle(missionTicketsById, targetTicketId, targetDependencies) {
    const visited = new Set();
    const inStack = new Set();
    function visit(ticketId) {
        if (inStack.has(ticketId)) {
            return true;
        }
        if (visited.has(ticketId)) {
            return false;
        }
        visited.add(ticketId);
        inStack.add(ticketId);
        const dependencies = ticketId === targetTicketId
            ? targetDependencies
            : missionTicketsById.get(ticketId)?.dependsOn ?? [];
        for (const dependencyId of dependencies) {
            if (!missionTicketsById.has(dependencyId) && dependencyId !== targetTicketId) {
                continue;
            }
            if (visit(dependencyId)) {
                return true;
            }
        }
        inStack.delete(ticketId);
        return false;
    }
    return visit(targetTicketId);
}
