import type {
  MissionAuthorizedExtensions,
  MissionStatus,
} from "./mission";

export const DEFAULT_NEXT_OPERATOR_ACTION =
  "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.";

export interface MissionResumeTicket {
  ticketId?: string;
  title?: string;
  status?: string;
  missionId?: string;
  [key: string]: unknown;
}

export interface MissionResumeApproval {
  approvalId?: string;
  title?: string;
  status?: string;
  missionId?: string;
  [key: string]: unknown;
}

export interface MissionResumeArtifact {
  artifactId?: string;
  ticketId?: string;
  title?: string;
  label?: string;
  kind?: string;
  path?: string;
  missionId?: string;
  producingEventId?: string;
  sourceEventType?: string;
  attemptId?: string | null;
  workspaceIsolationId?: string | null;
  [key: string]: unknown;
}

export type MissionResumeBlockageKind =
  | "approval_pending"
  | "ticket_failed"
  | "ticket_blocked"
  | "mission_lifecycle";

export type MissionResumeBlockageReasonCode =
  | "approval_requested"
  | "approval_rejected"
  | "approval_deferred"
  | "ticket_failed"
  | "ticket_blocked"
  | "dependency_pending"
  | "dependency_cancelled"
  | "dependency_failed"
  | "dependency_missing"
  | "mission_paused"
  | "mission_failed";

export interface MissionResumeBlockage {
  kind: MissionResumeBlockageKind;
  summary: string;
  missionStatus: MissionStatus;
  occurredAt: string;
  reasonCode?: MissionResumeBlockageReasonCode;
  ticketId?: string;
  attemptId?: string;
  approvalId?: string;
  sourceEventId?: string | null;
}

export interface MissionResume {
  missionId: string;
  title: string;
  objective: string;
  status: MissionStatus;
  successCriteria: string[];
  authorizedExtensions: MissionAuthorizedExtensions;
  openTickets: MissionResumeTicket[];
  pendingApprovals: MissionResumeApproval[];
  lastRelevantArtifact: MissionResumeArtifact | null;
  lastKnownBlockage: MissionResumeBlockage | null;
  lastEventId: string;
  updatedAt: string;
  nextOperatorAction: string;
}
