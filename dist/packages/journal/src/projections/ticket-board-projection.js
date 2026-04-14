"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicketBoardEntry = createTicketBoardEntry;
function createTicketBoardEntry(ticket, metadata) {
    return {
        ticketId: ticket.id,
        missionId: ticket.missionId,
        title: ticket.goal,
        status: ticket.status,
        owner: ticket.owner,
        kind: ticket.kind,
        dependsOn: [...ticket.dependsOn],
        allowedCapabilities: [...ticket.allowedCapabilities],
        skillPackRefs: [...ticket.skillPackRefs],
        usedCapabilities: [...metadata.usedCapabilities],
        usedSkillPacks: [...metadata.usedSkillPacks],
        planOrder: metadata.planOrder,
        runnable: metadata.runnable,
        blockedByTicketIds: [...metadata.blockedByTicketIds],
        planningState: metadata.planningState,
        dependencyStatuses: metadata.dependencyStatuses.map((dependencyStatus) => ({
            ...dependencyStatus,
        })),
        trackingState: metadata.trackingState,
        statusReasonCode: metadata.statusReasonCode,
        blockingReasonCode: metadata.blockingReasonCode,
        activeAttemptId: metadata.activeAttempt?.attemptId ?? null,
        activeAttemptStatus: metadata.activeAttempt?.status ?? null,
        lastAttemptId: metadata.lastAttempt?.attemptId ?? null,
        lastAttemptStatus: metadata.lastAttempt?.status ?? null,
        lastAttemptStartedAt: metadata.lastAttempt?.startedAt ?? null,
        lastAttemptEndedAt: metadata.lastAttempt?.endedAt ?? null,
        lastAttemptBackgroundRequested: metadata.lastAttempt?.backgroundRequested ?? null,
        lastAttemptWorkspaceIsolationId: metadata.lastAttempt?.workspaceIsolationId ?? null,
        updatedAt: ticket.updatedAt,
    };
}
