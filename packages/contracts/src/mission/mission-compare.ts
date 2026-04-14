import type { MissionStatus } from "./mission";
import type {
  MissionResumeArtifact,
  MissionResumeBlockage,
} from "./mission-resume";
import type { TicketStatus } from "../ticket/ticket";

export interface MissionCompareExpected {
  objective: string;
  successCriteria: string[];
}

export interface MissionCompareObservedApproval {
  approvalId: string;
  ticketId: string;
  title: string;
  status: string;
}

export interface MissionCompareObservedTicket {
  ticketId: string;
  title: string;
  status: TicketStatus;
  trackingState: string;
  statusReasonCode: string;
  blockingReasonCode: string | null;
  planOrder: number;
}

export interface MissionCompareObserved {
  missionStatus: MissionStatus;
  openTicketIds: string[];
  pendingApprovalCount: number;
  pendingApprovals: MissionCompareObservedApproval[];
  lastKnownBlockage: MissionResumeBlockage | null;
  lastRelevantArtifact: MissionResumeArtifact | null;
  nextOperatorAction: string;
  tickets: MissionCompareObservedTicket[];
}

export interface MissionCompareGap {
  code: string;
  summary: string;
  ticketId?: string;
  approvalId?: string;
}

export interface MissionCompareBlockingReason {
  code: string;
  summary: string;
  ticketId?: string;
  approvalId?: string;
  relatedTicketId?: string;
}

export interface MissionCompareImpactedBranch {
  rootTicketId: string | null;
  impactedTicketIds: string[];
  relaunchable: boolean;
  blockingReasons: MissionCompareBlockingReason[];
}

export interface MissionCompare {
  missionId: string;
  expected: MissionCompareExpected;
  observed: MissionCompareObserved;
  gaps: MissionCompareGap[];
  impactedBranch: MissionCompareImpactedBranch;
  operatorValidationRequired: boolean;
}
