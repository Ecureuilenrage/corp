import type { MissionResumeApproval } from "../mission/mission-resume";

export type ApprovalRequestStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "deferred"
  | "cancelled"
  | "expired";

export interface ApprovalRequest extends MissionResumeApproval {
  approvalId: string;
  missionId: string;
  ticketId: string;
  attemptId: string;
  status: ApprovalRequestStatus;
  title: string;
  actionType: string;
  actionSummary: string;
  guardrails: string[];
  relatedEventIds: string[];
  relatedArtifactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ApprovalQueueEntry = ApprovalRequest;

export const APPROVAL_REQUEST_STATUSES: ApprovalRequestStatus[] = [
  "requested",
  "approved",
  "rejected",
  "deferred",
  "cancelled",
  "expired",
];

export const ACTIVE_APPROVAL_REQUEST_STATUSES: ApprovalRequestStatus[] = [
  "requested",
];

export const TERMINAL_APPROVAL_REQUEST_STATUSES: ApprovalRequestStatus[] = [
  "approved",
  "rejected",
  "deferred",
  "cancelled",
  "expired",
];
