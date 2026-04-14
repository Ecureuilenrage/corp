import type {
  ExecutionAttemptStatus,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import type { MissionResumeTicket } from "../../../contracts/src/mission/mission-resume";
import type { Ticket, TicketKind, TicketStatus } from "../../../contracts/src/ticket/ticket";

export type TicketPlanningState =
  | "runnable"
  | "waiting_on_dependencies"
  | "blocked_by_cancelled_dependency"
  | "blocked_by_failed_dependency"
  | "blocked_by_missing_dependency"
  | "not_runnable_status";

export type TicketTrackingState =
  | "runnable"
  | "active"
  | "blocked"
  | "awaiting_approval"
  | "done"
  | "failed"
  | "cancelled";

export type TicketStatusReasonCode =
  | "runnable"
  | "dependency_pending"
  | "dependency_cancelled"
  | "dependency_failed"
  | "dependency_missing"
  | "ticket_claimed"
  | "ticket_in_progress"
  | "ticket_blocked"
  | "ticket_awaiting_approval"
  | "ticket_done"
  | "ticket_failed"
  | "ticket_cancelled";

export type TicketBlockingReasonCode =
  | "dependency_pending"
  | "dependency_cancelled"
  | "dependency_failed"
  | "dependency_missing"
  | "ticket_blocked";

export interface TicketBoardDependencyStatus {
  ticketId: string;
  status: TicketStatus | "missing";
  blocksRunnable: boolean;
}

export interface TicketBoardAttemptSummary {
  attemptId: string;
  status: ExecutionAttemptStatus;
  startedAt: string;
  endedAt: string | null;
  backgroundRequested: boolean;
  workspaceIsolationId: string;
}

export interface TicketBoardPlanningMetadata {
  planOrder: number;
  runnable: boolean;
  blockedByTicketIds: string[];
  planningState: TicketPlanningState;
  dependencyStatuses: TicketBoardDependencyStatus[];
  trackingState: TicketTrackingState;
  statusReasonCode: TicketStatusReasonCode;
  blockingReasonCode: TicketBlockingReasonCode | null;
  activeAttempt: TicketBoardAttemptSummary | null;
  lastAttempt: TicketBoardAttemptSummary | null;
  usedCapabilities: string[];
  usedSkillPacks: string[];
}

export interface TicketBoardEntry extends MissionResumeTicket {
  ticketId: string;
  missionId: string;
  title: string;
  status: TicketStatus;
  owner: string;
  kind: TicketKind;
  dependsOn: string[];
  allowedCapabilities: string[];
  skillPackRefs: string[];
  usedCapabilities: string[];
  usedSkillPacks: string[];
  planOrder: number;
  runnable: boolean;
  blockedByTicketIds: string[];
  planningState: TicketPlanningState;
  dependencyStatuses: TicketBoardDependencyStatus[];
  trackingState: TicketTrackingState;
  statusReasonCode: TicketStatusReasonCode;
  blockingReasonCode: TicketBlockingReasonCode | null;
  activeAttemptId: string | null;
  activeAttemptStatus: ExecutionAttemptStatus | null;
  lastAttemptId: string | null;
  lastAttemptStatus: ExecutionAttemptStatus | null;
  lastAttemptStartedAt: string | null;
  lastAttemptEndedAt: string | null;
  lastAttemptBackgroundRequested: boolean | null;
  lastAttemptWorkspaceIsolationId: string | null;
  updatedAt: string;
}

export interface TicketBoardProjection {
  schemaVersion: 1;
  tickets: TicketBoardEntry[];
}

export function createTicketBoardEntry(
  ticket: Ticket,
  metadata: TicketBoardPlanningMetadata,
): TicketBoardEntry {
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
