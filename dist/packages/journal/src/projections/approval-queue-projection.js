"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApprovalQueueProjection = createApprovalQueueProjection;
const approval_request_1 = require("../../../contracts/src/approval/approval-request");
const TERMINAL_APPROVAL_STATUSES = new Set(approval_request_1.TERMINAL_APPROVAL_REQUEST_STATUSES);
const APPROVAL_EVENT_PREFIX = "approval.";
const APPROVAL_EVENT_STATUS_BY_TYPE = {
    "approval.requested": "requested",
    "approval.approved": "approved",
    "approval.rejected": "rejected",
    "approval.deferred": "deferred",
    "approval.cancelled": "cancelled",
    "approval.expired": "expired",
};
function createApprovalQueueProjection(options) {
    const approvalsById = new Map();
    for (const event of options.events) {
        if (event.missionId !== options.missionId || !event.type.startsWith(APPROVAL_EVENT_PREFIX)) {
            continue;
        }
        const approval = readApprovalFromPayload(event.payload, event.type);
        if (!approval || approval.missionId !== options.missionId) {
            continue;
        }
        if (TERMINAL_APPROVAL_STATUSES.has(approval.status)) {
            approvalsById.delete(approval.approvalId);
            continue;
        }
        approvalsById.set(approval.approvalId, approval);
    }
    return {
        schemaVersion: 1,
        approvals: [...approvalsById.values()].sort(compareApprovals),
    };
}
function compareApprovals(left, right) {
    return `${left.createdAt}|${left.approvalId}`.localeCompare(`${right.createdAt}|${right.approvalId}`);
}
function readApprovalFromPayload(payload, eventType) {
    const candidate = payload.approval ?? payload.approvalRequest;
    if (!isApprovalRequest(candidate)) {
        return null;
    }
    return {
        ...candidate,
        status: APPROVAL_EVENT_STATUS_BY_TYPE[eventType] ?? candidate.status,
        guardrails: [...candidate.guardrails],
        relatedEventIds: [...candidate.relatedEventIds],
        relatedArtifactIds: [...candidate.relatedArtifactIds],
    };
}
function isApprovalRequest(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return typeof candidate.approvalId === "string"
        && typeof candidate.missionId === "string"
        && typeof candidate.ticketId === "string"
        && typeof candidate.attemptId === "string"
        && typeof candidate.status === "string"
        && typeof candidate.title === "string"
        && typeof candidate.actionType === "string"
        && typeof candidate.actionSummary === "string"
        && isStringArray(candidate.guardrails)
        && isStringArray(candidate.relatedEventIds)
        && isStringArray(candidate.relatedArtifactIds)
        && typeof candidate.createdAt === "string"
        && typeof candidate.updatedAt === "string";
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
