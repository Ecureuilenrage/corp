import type {
  ApprovalQueueEntry,
  ApprovalRequest,
  ApprovalRequestStatus,
} from "../../../contracts/src/approval/approval-request";
import { TERMINAL_APPROVAL_REQUEST_STATUSES } from "../../../contracts/src/approval/approval-request";
import { isApprovalRequest } from "../../../contracts/src/guards/persisted-document-guards";
import type { JournalEventRecord } from "../event-log/append-event";

export interface ApprovalQueueProjection {
  schemaVersion: 1;
  approvals: ApprovalQueueEntry[];
}

const TERMINAL_APPROVAL_STATUSES = new Set<ApprovalRequestStatus>(
  TERMINAL_APPROVAL_REQUEST_STATUSES,
);

const APPROVAL_EVENT_PREFIX = "approval.";

const APPROVAL_EVENT_STATUS_BY_TYPE: Record<string, ApprovalRequestStatus> = {
  "approval.requested": "requested",
  "approval.approved": "approved",
  "approval.rejected": "rejected",
  "approval.deferred": "deferred",
  "approval.cancelled": "cancelled",
  "approval.expired": "expired",
};

export function createApprovalQueueProjection(options: {
  missionId: string;
  events: JournalEventRecord[];
}): ApprovalQueueProjection {
  const approvalsById = new Map<string, ApprovalQueueEntry>();

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

function compareApprovals(left: ApprovalQueueEntry, right: ApprovalQueueEntry): number {
  return `${left.createdAt}|${left.approvalId}`.localeCompare(
    `${right.createdAt}|${right.approvalId}`,
  );
}

function readApprovalFromPayload(
  payload: Record<string, unknown>,
  eventType: string,
): ApprovalQueueEntry | null {
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
