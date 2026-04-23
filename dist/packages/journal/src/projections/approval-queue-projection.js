"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApprovalQueueProjection = createApprovalQueueProjection;
const approval_request_1 = require("../../../contracts/src/approval/approval-request");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
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
    if (!(0, persisted_document_guards_1.isApprovalRequest)(candidate)) {
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
