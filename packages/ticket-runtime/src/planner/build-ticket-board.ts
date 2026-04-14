import {
  ACTIVE_EXECUTION_ATTEMPT_STATUSES,
  type ExecutionAttempt,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../../../journal/src/event-log/append-event";
import {
  createTicketBoardEntry,
  type TicketBoardAttemptSummary,
  type TicketBoardDependencyStatus,
  type TicketBoardPlanningMetadata,
  type TicketBoardProjection,
} from "../../../journal/src/projections/ticket-board-projection";

export function buildTicketBoardProjection(
  mission: Mission,
  missionTickets: Ticket[],
  missionAttempts: ExecutionAttempt[] = [],
  missionEvents: JournalEventRecord[] = [],
): TicketBoardProjection {
  const ticketsById = new Map(
    missionTickets.map((ticket) => [ticket.id, ticket] as const),
  );
  const attemptsByTicketId = groupAttemptsByTicketId(missionAttempts);
  const extensionUsageByTicketId = collectExtensionUsageByTicketId(
    missionEvents,
    mission.id,
  );

  return {
    schemaVersion: 1,
    tickets: mission.ticketIds.flatMap((ticketId, planOrder) => {
      const ticket = ticketsById.get(ticketId);

      if (!ticket) {
        return [];
      }

      const attempts = attemptsByTicketId.get(ticket.id) ?? [];
      const extensionUsage = extensionUsageByTicketId.get(ticket.id) ?? {
        usedCapabilities: [],
        usedSkillPacks: [],
      };

      return [
        createTicketBoardEntry(
          ticket,
          resolvePlanningMetadata(ticket, ticketsById, attempts, planOrder, extensionUsage),
        ),
      ];
    }),
  };
}

function resolvePlanningMetadata(
  ticket: Ticket,
  ticketsById: Map<string, Ticket>,
  attempts: ExecutionAttempt[],
  planOrder: number,
  extensionUsage: {
    usedCapabilities: string[];
    usedSkillPacks: string[];
  },
): TicketBoardPlanningMetadata {
  const dependencyStatuses = resolveDependencyStatuses(ticket, ticketsById);
  const blockedByMissingDependencyIds = dependencyStatuses
    .filter((dependencyStatus) => dependencyStatus.status === "missing")
    .map((dependencyStatus) => dependencyStatus.ticketId);
  const blockedByCancelledDependencyIds = dependencyStatuses
    .filter((dependencyStatus) => dependencyStatus.status === "cancelled")
    .map((dependencyStatus) => dependencyStatus.ticketId);
  const blockedByFailedDependencyIds = dependencyStatuses
    .filter((dependencyStatus) => dependencyStatus.status === "failed")
    .map((dependencyStatus) => dependencyStatus.ticketId);
  const blockedByPendingDependencyIds = dependencyStatuses
    .filter((dependencyStatus) =>
      dependencyStatus.status !== "done"
      && dependencyStatus.status !== "cancelled"
      && dependencyStatus.status !== "failed"
      && dependencyStatus.status !== "missing"
    )
    .map((dependencyStatus) => dependencyStatus.ticketId);
  const blockedByTicketIds = dedupeIds(dependencyStatuses
    .filter((dependencyStatus) => dependencyStatus.blocksRunnable)
    .map((dependencyStatus) => dependencyStatus.ticketId));
  const activeAttempt = resolveActiveAttempt(attempts);
  const lastAttempt = resolveLastAttempt(attempts);

  if (ticket.status === "claimed") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "active",
      statusReasonCode: "ticket_claimed",
      blockingReasonCode: null,
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (ticket.status === "in_progress") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "active",
      statusReasonCode: "ticket_in_progress",
      blockingReasonCode: null,
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (ticket.status === "blocked") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "blocked",
      statusReasonCode: "ticket_blocked",
      blockingReasonCode: "ticket_blocked",
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (ticket.status === "awaiting_approval") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "awaiting_approval",
      statusReasonCode: "ticket_awaiting_approval",
      blockingReasonCode: null,
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (ticket.status === "done") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "done",
      statusReasonCode: "ticket_done",
      blockingReasonCode: null,
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (ticket.status === "cancelled") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "cancelled",
      statusReasonCode: "ticket_cancelled",
      blockingReasonCode: null,
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (blockedByMissingDependencyIds.length > 0) {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds: dedupeIds([
        ...blockedByMissingDependencyIds,
        ...blockedByCancelledDependencyIds,
        ...blockedByFailedDependencyIds,
        ...blockedByPendingDependencyIds,
      ]),
      planningState: "blocked_by_missing_dependency",
      dependencyStatuses,
      trackingState: "blocked",
      statusReasonCode: "dependency_missing",
      blockingReasonCode: "dependency_missing",
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (blockedByCancelledDependencyIds.length > 0) {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds: dedupeIds([
        ...blockedByCancelledDependencyIds,
        ...blockedByFailedDependencyIds,
        ...blockedByPendingDependencyIds,
      ]),
      planningState: "blocked_by_cancelled_dependency",
      dependencyStatuses,
      trackingState: "blocked",
      statusReasonCode: "dependency_cancelled",
      blockingReasonCode: "dependency_cancelled",
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (blockedByFailedDependencyIds.length > 0) {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds: dedupeIds([
        ...blockedByFailedDependencyIds,
        ...blockedByPendingDependencyIds,
      ]),
      planningState: "blocked_by_failed_dependency",
      dependencyStatuses,
      trackingState: "blocked",
      statusReasonCode: "dependency_failed",
      blockingReasonCode: "dependency_failed",
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (blockedByPendingDependencyIds.length > 0) {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds: dedupeIds(blockedByPendingDependencyIds),
      planningState: "waiting_on_dependencies",
      dependencyStatuses,
      trackingState: "blocked",
      statusReasonCode: "dependency_pending",
      blockingReasonCode: "dependency_pending",
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  if (ticket.status !== "todo" && ticket.status !== "failed") {
    return {
      planOrder,
      runnable: false,
      blockedByTicketIds,
      planningState: "not_runnable_status",
      dependencyStatuses,
      trackingState: "blocked",
      statusReasonCode: "ticket_blocked",
      blockingReasonCode: null,
      activeAttempt,
      lastAttempt,
      usedCapabilities: [...extensionUsage.usedCapabilities],
      usedSkillPacks: [...extensionUsage.usedSkillPacks],
    };
  }

  return {
    planOrder,
    runnable: true,
    blockedByTicketIds: [],
    planningState: "runnable",
    dependencyStatuses,
    trackingState: ticket.status === "failed" ? "failed" : "runnable",
    statusReasonCode: ticket.status === "failed" ? "ticket_failed" : "runnable",
    blockingReasonCode: null,
    activeAttempt,
    lastAttempt,
    usedCapabilities: [...extensionUsage.usedCapabilities],
    usedSkillPacks: [...extensionUsage.usedSkillPacks],
  };
}

function dedupeIds(values: string[]): string[] {
  return [...new Set(values)];
}

function resolveDependencyStatuses(
  ticket: Ticket,
  ticketsById: Map<string, Ticket>,
): TicketBoardDependencyStatus[] {
  return ticket.dependsOn.map((dependencyId) => {
    const dependency = ticketsById.get(dependencyId);

    if (!dependency) {
      return {
        ticketId: dependencyId,
        status: "missing",
        blocksRunnable: true,
      };
    }

    return {
      ticketId: dependencyId,
      status: dependency.status,
      blocksRunnable: dependency.status !== "done",
    };
  });
}

function groupAttemptsByTicketId(
  missionAttempts: ExecutionAttempt[],
): Map<string, ExecutionAttempt[]> {
  const attemptsByTicketId = new Map<string, ExecutionAttempt[]>();

  for (const attempt of missionAttempts) {
    const existingAttempts = attemptsByTicketId.get(attempt.ticketId) ?? [];
    existingAttempts.push(attempt);
    attemptsByTicketId.set(attempt.ticketId, existingAttempts);
  }

  for (const [ticketId, attempts] of attemptsByTicketId.entries()) {
    attemptsByTicketId.set(ticketId, sortAttempts(attempts));
  }

  return attemptsByTicketId;
}

function sortAttempts(attempts: ExecutionAttempt[]): ExecutionAttempt[] {
  return [...attempts].sort((left, right) => {
    const leftKey = `${left.startedAt}|${left.id}`;
    const rightKey = `${right.startedAt}|${right.id}`;

    return leftKey.localeCompare(rightKey);
  });
}

function resolveActiveAttempt(
  attempts: ExecutionAttempt[],
): TicketBoardAttemptSummary | null {
  const activeAttempt = [...attempts]
    .reverse()
    .find((attempt) => ACTIVE_EXECUTION_ATTEMPT_STATUSES.includes(attempt.status));

  return activeAttempt ? toAttemptSummary(activeAttempt) : null;
}

function resolveLastAttempt(
  attempts: ExecutionAttempt[],
): TicketBoardAttemptSummary | null {
  const lastAttempt = attempts.at(-1);
  return lastAttempt ? toAttemptSummary(lastAttempt) : null;
}

function toAttemptSummary(attempt: ExecutionAttempt): TicketBoardAttemptSummary {
  return {
    attemptId: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    endedAt: attempt.endedAt,
    backgroundRequested: attempt.backgroundRequested,
    workspaceIsolationId: attempt.workspaceIsolationId,
  };
}

function collectExtensionUsageByTicketId(
  missionEvents: JournalEventRecord[],
  missionId: string,
): Map<string, { usedCapabilities: string[]; usedSkillPacks: string[] }> {
  const usageByTicketId = new Map<string, {
    usedCapabilities: string[];
    usedSkillPacks: string[];
  }>();

  for (const event of missionEvents) {
    if (event.missionId !== missionId || !event.ticketId) {
      continue;
    }

    const currentUsage = usageByTicketId.get(event.ticketId) ?? {
      usedCapabilities: [],
      usedSkillPacks: [],
    };

    if (event.type === "capability.invoked") {
      const capabilityId = readNestedString(
        event.payload,
        "capability",
        "capabilityId",
      );

      if (capabilityId) {
        currentUsage.usedCapabilities = dedupeIds([
          ...currentUsage.usedCapabilities,
          capabilityId,
        ]);
      }
    }

    if (event.type === "skill_pack.used") {
      const packRef = readNestedString(
        event.payload,
        "skillPack",
        "packRef",
      );

      if (packRef) {
        currentUsage.usedSkillPacks = dedupeIds([
          ...currentUsage.usedSkillPacks,
          packRef,
        ]);
      }
    }

    usageByTicketId.set(event.ticketId, currentUsage);
  }

  return usageByTicketId;
}

function readNestedString(
  payload: Record<string, unknown>,
  parentKey: string,
  childKey: string,
): string | null {
  const parent = payload[parentKey];

  if (typeof parent !== "object" || parent === null) {
    return null;
  }

  const candidate = (parent as Record<string, unknown>)[childKey];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : null;
}
