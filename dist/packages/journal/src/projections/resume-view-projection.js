"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMissionResume = createMissionResume;
exports.createResumeViewProjection = createResumeViewProjection;
exports.buildResumeViewProjection = buildResumeViewProjection;
exports.deriveLastKnownBlockage = deriveLastKnownBlockage;
exports.deriveNextOperatorAction = deriveNextOperatorAction;
const mission_resume_1 = require("../../../contracts/src/mission/mission-resume");
const ticket_1 = require("../../../contracts/src/ticket/ticket");
const TERMINAL_TICKET_STATUS_SET = new Set(ticket_1.TERMINAL_TICKET_STATUSES);
function createMissionResume(mission, options = {}) {
    const openTickets = options.openTickets ?? [];
    const pendingApprovals = options.pendingApprovals ?? [];
    return {
        missionId: mission.id,
        title: mission.title,
        objective: mission.objective,
        status: mission.status,
        successCriteria: [...mission.successCriteria],
        authorizedExtensions: {
            allowedCapabilities: [...mission.authorizedExtensions.allowedCapabilities],
            skillPackRefs: [...mission.authorizedExtensions.skillPackRefs],
        },
        openTickets: [...openTickets],
        pendingApprovals: [...pendingApprovals],
        lastRelevantArtifact: options.lastRelevantArtifact ?? null,
        lastKnownBlockage: options.lastKnownBlockage !== undefined
            ? cloneMissionResumeBlockage(options.lastKnownBlockage)
            : deriveLastKnownBlockage({
                mission,
                missionEvents: options.missionEvents ?? [],
                ticketBoardEntries: options.ticketBoardEntries ?? [],
                pendingApprovals,
            }),
        lastEventId: options.lastEventId ?? mission.resumeCursor,
        updatedAt: options.updatedAt ?? mission.updatedAt,
        nextOperatorAction: options.nextOperatorAction
            ?? deriveNextOperatorAction({
                missionStatus: mission.status,
                openTickets,
                pendingApprovals,
                hasFailedTickets: options.hasFailedTickets ?? false,
            }),
    };
}
function createResumeViewProjection(mission, options = {}) {
    return {
        schemaVersion: 1,
        resume: createMissionResume(mission, options),
    };
}
function buildResumeViewProjection(options) {
    const lastMissionEvent = options.missionEvents.at(-1);
    return createResumeViewProjection(options.mission, {
        openTickets: options.openTickets,
        pendingApprovals: options.pendingApprovals,
        lastRelevantArtifact: options.lastRelevantArtifact,
        ticketBoardEntries: options.ticketBoardEntries,
        missionEvents: options.missionEvents,
        lastEventId: lastMissionEvent?.eventId ?? options.mission.resumeCursor,
        updatedAt: pickLatestTimestamp([
            options.mission.updatedAt,
            lastMissionEvent?.occurredAt,
        ]),
        hasFailedTickets: options.hasFailedTickets,
    });
}
function deriveLastKnownBlockage(options) {
    const latestPendingApproval = selectLatestPendingApproval(options.pendingApprovals);
    if (latestPendingApproval) {
        return buildApprovalPendingBlockage(options.mission, options.missionEvents, latestPendingApproval);
    }
    const latestFailedTicket = selectLatestTicketByPriority(options.ticketBoardEntries, (ticket) => ticket.trackingState === "failed");
    if (latestFailedTicket) {
        return buildTicketFailedBlockage(options.mission, options.missionEvents, latestFailedTicket);
    }
    const latestBlockedTicket = selectLatestTicketByPriority(options.ticketBoardEntries, (ticket) => ticket.trackingState === "blocked" || ticket.blockingReasonCode !== null);
    if (latestBlockedTicket) {
        return buildTicketBlockedBlockage(options.mission, latestBlockedTicket);
    }
    return buildMissionLifecycleBlockage(options.mission, options.missionEvents);
}
function deriveNextOperatorAction(options) {
    const lifecycleAction = deriveLifecycleNextOperatorAction(options.missionStatus);
    const actionableOpenTickets = options.openTickets.filter((ticket) => {
        const status = readOptionalString(ticket, "status");
        return status === undefined
            || !TERMINAL_TICKET_STATUS_SET.has(status);
    });
    if (lifecycleAction) {
        return lifecycleAction;
    }
    if (options.pendingApprovals.length > 0) {
        return `Arbitrez la prochaine validation en attente${formatEntitySuffix(options.pendingApprovals[0], [
            "title",
            "approvalId",
        ])}.`;
    }
    const approvalTicket = actionableOpenTickets.find((ticket) => readOptionalString(ticket, "status") === "awaiting_approval");
    if (approvalTicket) {
        return `Un ticket attend une approbation${formatEntitySuffix(approvalTicket, [
            "title",
            "ticketId",
        ])}.`;
    }
    const activeTicket = actionableOpenTickets.find((ticket) => {
        const status = readOptionalString(ticket, "status");
        return status === "claimed" || status === "in_progress";
    });
    if (activeTicket) {
        return `Suivez le ticket en cours${formatEntitySuffix(activeTicket, [
            "title",
            "ticketId",
        ])}.`;
    }
    const nextRunnableTicket = actionableOpenTickets.find((ticket) => readOptionalBoolean(ticket, "runnable") === true);
    if (nextRunnableTicket) {
        return `Traitez le prochain ticket runnable${formatEntitySuffix(nextRunnableTicket, [
            "title",
            "ticketId",
        ])}.`;
    }
    if (actionableOpenTickets.length > 0 || options.hasFailedTickets) {
        return "Aucun ticket n'est runnable pour le moment. Replanifiez ou debloquez la mission avant de poursuivre.";
    }
    return mission_resume_1.DEFAULT_NEXT_OPERATOR_ACTION;
}
function deriveLifecycleNextOperatorAction(missionStatus) {
    if (missionStatus === "blocked") {
        return "Mission bloquee. Relancez-la quand les conditions de reprise sont reunies.";
    }
    if (missionStatus === "failed") {
        return "Mission en echec. Diagnostiquez la cause puis relancez ou cloturez.";
    }
    if (missionStatus === "completed") {
        return "Mission terminee. Aucun arbitrage supplementaire n'est requis.";
    }
    if (missionStatus === "cancelled") {
        return "Mission annulee. Aucun arbitrage supplementaire n'est requis.";
    }
    return null;
}
function buildApprovalPendingBlockage(mission, missionEvents, approval) {
    const approvalId = readOptionalString(approval, "approvalId");
    const ticketId = readOptionalString(approval, "ticketId");
    const attemptId = readOptionalString(approval, "attemptId");
    const approvalEvent = findLatestEvent(missionEvents, (event) => {
        if (event.type !== "approval.requested") {
            return false;
        }
        const payload = event.payload;
        const payloadApproval = readOptionalRecord(payload, "approval");
        return Boolean((approvalId && readOptionalString(payload, "approvalId") === approvalId)
            || (approvalId && payloadApproval && readOptionalString(payloadApproval, "approvalId") === approvalId));
    });
    const actionSummary = readOptionalString(approval, "actionSummary");
    const title = readOptionalString(approval, "title");
    const summaryDetail = actionSummary ?? title;
    const summarySuffix = ticketId ? ` pour le ticket ${ticketId}` : "";
    return {
        kind: "approval_pending",
        summary: summaryDetail
            ? `Validation en attente${summarySuffix}: ${summaryDetail}`
            : `Validation en attente${summarySuffix}`,
        missionStatus: mission.status,
        occurredAt: approvalEvent?.occurredAt
            ?? readOptionalString(approval, "updatedAt")
            ?? readOptionalString(approval, "createdAt")
            ?? mission.updatedAt,
        reasonCode: "approval_requested",
        ...(ticketId ? { ticketId } : {}),
        ...(attemptId ? { attemptId } : {}),
        ...(approvalId ? { approvalId } : {}),
        sourceEventId: approvalEvent?.eventId ?? null,
    };
}
function buildTicketFailedBlockage(mission, missionEvents, ticket) {
    const failureEvent = findLatestEvent(missionEvents, (event) => event.ticketId === ticket.ticketId
        && (ticket.lastAttemptId === null || event.attemptId === ticket.lastAttemptId)
        && (event.type === "approval.rejected"
            || event.type === "approval.deferred"
            || event.type === "execution.failed"));
    const reasonCode = mapTicketFailureReasonCode(failureEvent?.type);
    return {
        kind: "ticket_failed",
        summary: `Ticket ${ticket.ticketId} en echec`,
        missionStatus: mission.status,
        occurredAt: failureEvent?.occurredAt
            ?? ticket.lastAttemptEndedAt
            ?? ticket.updatedAt,
        ...(reasonCode ? { reasonCode } : {}),
        ticketId: ticket.ticketId,
        ...(ticket.lastAttemptId ? { attemptId: ticket.lastAttemptId } : {}),
        sourceEventId: failureEvent?.eventId ?? null,
    };
}
function buildTicketBlockedBlockage(mission, ticket) {
    const reasonCode = mapTicketBlockedReasonCode(ticket);
    return {
        kind: "ticket_blocked",
        summary: `Ticket ${ticket.ticketId} bloque`,
        missionStatus: mission.status,
        occurredAt: ticket.updatedAt,
        ...(reasonCode ? { reasonCode } : {}),
        ticketId: ticket.ticketId,
        ...(ticket.activeAttemptId ? { attemptId: ticket.activeAttemptId } : {}),
        sourceEventId: null,
    };
}
function buildMissionLifecycleBlockage(mission, missionEvents) {
    if (mission.status !== "blocked" && mission.status !== "failed") {
        return null;
    }
    const lifecycleEvent = findLatestEvent(missionEvents, (event) => {
        const payloadMission = readOptionalRecord(event.payload, "mission");
        return Boolean(payloadMission)
            && readOptionalString(payloadMission, "id") === mission.id
            && readOptionalString(payloadMission, "status") === mission.status;
    });
    return {
        kind: "mission_lifecycle",
        summary: mission.status === "blocked"
            ? "Mission mise en pause"
            : "Mission en echec",
        missionStatus: mission.status,
        occurredAt: lifecycleEvent?.occurredAt ?? mission.updatedAt,
        reasonCode: mission.status === "blocked"
            ? "mission_paused"
            : "mission_failed",
        sourceEventId: lifecycleEvent?.eventId ?? null,
    };
}
function selectLatestPendingApproval(pendingApprovals) {
    return [...pendingApprovals]
        .map((approval, index) => ({ record: approval, index }))
        .sort((left, right) => {
        const comparison = buildChronologyKey(readOptionalString(left.record, "updatedAt")
            ?? readOptionalString(left.record, "createdAt"), readOptionalString(left.record, "approvalId")).localeCompare(buildChronologyKey(readOptionalString(right.record, "updatedAt")
            ?? readOptionalString(right.record, "createdAt"), readOptionalString(right.record, "approvalId")));
        return comparison !== 0 ? comparison : left.index - right.index;
    })
        .at(-1)
        ?.record
        ?? null;
}
function selectLatestTicketByPriority(ticketBoardEntries, predicate) {
    return [...ticketBoardEntries]
        .filter(predicate)
        .sort((left, right) => buildChronologyKey(resolveTicketChronology(left), left.ticketId).localeCompare(buildChronologyKey(resolveTicketChronology(right), right.ticketId)))
        .at(-1)
        ?? null;
}
function resolveTicketChronology(ticket) {
    return ticket.lastAttemptEndedAt
        ?? ticket.lastAttemptStartedAt
        ?? ticket.updatedAt;
}
function buildChronologyKey(occurredAt, stableId) {
    return `${occurredAt ?? ""}|${stableId ?? ""}`;
}
function findLatestEvent(events, predicate) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event && predicate(event)) {
            return event;
        }
    }
    return null;
}
function mapTicketFailureReasonCode(eventType) {
    if (eventType === "approval.rejected") {
        return "approval_rejected";
    }
    if (eventType === "approval.deferred") {
        return "approval_deferred";
    }
    if (eventType === "execution.failed") {
        return "ticket_failed";
    }
    return undefined;
}
function mapTicketBlockedReasonCode(ticket) {
    if (ticket.blockingReasonCode === "dependency_pending") {
        return "dependency_pending";
    }
    if (ticket.blockingReasonCode === "dependency_cancelled") {
        return "dependency_cancelled";
    }
    if (ticket.blockingReasonCode === "dependency_failed") {
        return "dependency_failed";
    }
    if (ticket.blockingReasonCode === "dependency_missing") {
        return "dependency_missing";
    }
    if (ticket.blockingReasonCode === "ticket_blocked" || ticket.statusReasonCode === "ticket_blocked") {
        return "ticket_blocked";
    }
    return undefined;
}
function cloneMissionResumeBlockage(blockage) {
    return blockage ? { ...blockage } : null;
}
function formatEntitySuffix(entity, keys) {
    for (const key of keys) {
        const value = entity[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return `: ${value}`;
        }
    }
    return "";
}
function readOptionalBoolean(value, key) {
    const candidate = value[key];
    return typeof candidate === "boolean" ? candidate : undefined;
}
function readOptionalString(value, key) {
    const candidate = value[key];
    return typeof candidate === "string" && candidate.trim().length > 0
        ? candidate
        : undefined;
}
function readOptionalRecord(value, key) {
    const candidate = value[key];
    return typeof candidate === "object" && candidate !== null
        ? candidate
        : null;
}
function pickLatestTimestamp(timestamps) {
    const normalizedTimestamps = timestamps.filter((timestamp) => typeof timestamp === "string" && timestamp.trim().length > 0);
    return [...normalizedTimestamps].sort((left, right) => left.localeCompare(right)).at(-1)
        ?? new Date(0).toISOString();
}
