import { randomUUID } from "node:crypto";

import type { ApprovalRequest } from "../../../contracts/src/approval/approval-request";
import type { RegisteredCapability } from "../../../contracts/src/extension/registered-capability";
import type {
  ResolvedSkillPackSummary,
  SkillPackUsageDetails,
} from "../../../contracts/src/extension/registered-skill-pack";
import {
  ACTIVE_EXECUTION_ATTEMPT_STATUSES,
  type ExecutionAttempt,
  type ExecutionAttemptStatus,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { invokeRegisteredCapability } from "../../../capability-registry/src/registry/invoke-registered-capability";
import { readRegisteredCapability } from "../../../capability-registry/src/registry/read-registered-capability";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readMissionResume } from "../../../mission-kernel/src/resume-service/read-mission-resume";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileCapabilityRegistryRepository } from "../../../storage/src/repositories/file-capability-registry-repository";
import { createFileSkillPackRegistryRepository } from "../../../storage/src/repositories/file-skill-pack-registry-repository";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileExecutionAttemptRepository } from "../../../storage/src/repositories/file-execution-attempt-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import {
  createCodexResponsesAdapterFromEnvironment,
  type ExecutionAdapter,
  type ExecutionAdapterApprovalRequest,
  type ExecutionAdapterLaunchResult,
} from "../../../execution-adapters/codex-responses/src/codex-responses-adapter";
import { resolveTicketSkillPacks } from "../../../skill-pack/src/loader/resolve-ticket-skill-packs";
import { readRegisteredSkillPack } from "../../../skill-pack/src/loader/read-registered-skill-pack";
import { buildSkillPackUsageDetails } from "../../../skill-pack/src/metadata/build-skill-pack-summary";
import {
  createWorkspaceIsolation,
  type WorkspaceIsolationMetadata,
} from "../../../workspace-isolation/src/workspace-isolation";
import { detectTicketArtifacts } from "../artifact-service/detect-ticket-artifacts";
import { registerArtifacts } from "../artifact-service/register-artifacts";
import { buildTicketBoardProjection } from "../planner/build-ticket-board";
import {
  applyExecutionHandleSnapshot,
  buildApprovalGuardrailsSnapshot,
  ensureTicketExtensionsAllowedByMission,
  ensureMissionWorkspaceInitialized,
  isBuiltInAllowedCapability,
  missionHasOtherActiveAttempts,
  normalizeOpaqueReferences,
  requireText,
  requireTicketInMission,
  rewriteMissionReadModels,
} from "./ticket-service-support";

export interface RunTicketOptions {
  rootDir: string;
  missionId?: string;
  ticketId?: string;
  background?: boolean;
  allowBlockedTicketRetry?: boolean;
}

export interface RunTicketResult {
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  isolation: WorkspaceIsolationMetadata;
  events: JournalEventRecord[];
  resume: MissionResume;
}

interface RunTicketDependencies {
  createAdapter(): ExecutionAdapter;
  createWorkspaceIsolation(options: {
    rootDir: string;
    workspaceIsolationId: string;
    layout: ReturnType<typeof resolveWorkspaceLayout>;
  }): Promise<WorkspaceIsolationMetadata>;
  createEventId(): string;
  createAttemptId(): string;
  createIsolationId(): string;
  createApprovalId(): string;
}

type RunTicketDependencyOverrides = Partial<RunTicketDependencies> | null;

let runTicketDependencyOverrides: RunTicketDependencyOverrides = null;

export function setRunTicketDependenciesForTesting(
  overrides: RunTicketDependencyOverrides,
): void {
  runTicketDependencyOverrides = overrides;
}

export async function runTicket(
  options: RunTicketOptions,
): Promise<RunTicketResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, "ticket run");

  const missionId = requireText(
    options.missionId,
    "L'option --mission-id est obligatoire pour `corp mission ticket run`.",
  );
  const ticketId = requireText(
    options.ticketId,
    "L'option --ticket-id est obligatoire pour `corp mission ticket run`.",
  );
  const backgroundRequested = options.background === true;
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  const storedTicket = await ticketRepository.findById(mission.id, ticketId);
  const ticket = requireTicketInMission(storedTicket, mission, ticketId);

  ensureMissionCanRunTicket(mission, ticket);
  ensureTicketHasOwner(ticket);
  ensureTicketExtensionsAllowedByMission({
    mission,
    allowedCapabilities: ticket.allowedCapabilities,
    skillPackRefs: ticket.skillPackRefs,
  });

  const activeAttempt = await attemptRepository.findActiveByTicketId(mission.id, ticket.id);

  if (activeAttempt) {
    throw new Error(`Une tentative active existe deja pour le ticket \`${ticket.id}\`.`);
  }

  ensureTicketStatusRunnable(ticket, options.allowBlockedTicketRetry === true);

  const missionTickets = await ticketRepository.listByMissionId(mission.id);
  const ticketBoard = buildTicketBoardProjection(mission, missionTickets);
  const boardEntry = ticketBoard.tickets.find((entry) => entry.ticketId === ticket.id);

  const blockedRetryAllowed = options.allowBlockedTicketRetry === true
    && ticket.status === "blocked"
    && !!boardEntry
    && boardEntry.statusReasonCode === "ticket_blocked"
    && boardEntry.blockedByTicketIds.length === 0;

  if ((!boardEntry || !boardEntry.runnable) && !blockedRetryAllowed) {
    throw new Error(
      `Le ticket \`${ticket.id}\` n'est pas runnable: dependances non resolues.`,
    );
  }

  const capabilityRegistryRepository = createFileCapabilityRegistryRepository(layout);
  const skillPackRegistryRepository = createFileSkillPackRegistryRepository(layout);
  const dependencies = resolveRunTicketDependencies();
  const adapter = dependencies.createAdapter();
  const attemptId = dependencies.createAttemptId();
  const capabilityInvocations = await buildCapabilityInvocationEvents({
    repository: capabilityRegistryRepository,
    mission,
    ticket,
    attemptId,
    dependencies,
  });
  const resolvedSkillPacks = await resolveTicketSkillPacks({
    repository: skillPackRegistryRepository,
    mission,
    ticket,
  });
  const skillPackUsageEvents = await buildSkillPackUsageEvents({
    repository: skillPackRegistryRepository,
    mission,
    ticket,
    attemptId,
    dependencies,
  });
  const workspaceIsolationId = dependencies.createIsolationId();
  const events: JournalEventRecord[] = [];

  let isolation: WorkspaceIsolationMetadata;

  try {
    isolation = await dependencies.createWorkspaceIsolation({
      rootDir: layout.rootDir,
      workspaceIsolationId,
      layout,
    });
  } catch {
    throw new Error(
      `Creation d'isolation impossible pour le ticket \`${ticket.id}\`.`,
    );
  }

  let currentMission = withMissionEvent(mission, {
    eventId: dependencies.createEventId(),
    occurredAt: new Date().toISOString(),
  });
  let currentTicket = withTicketEvent(ticket, {
    eventId: currentMission.resumeCursor,
    occurredAt: currentMission.updatedAt,
  });
  const workspaceEvent: JournalEventRecord = {
    eventId: currentMission.resumeCursor,
    type: "workspace.isolation_created",
    missionId: mission.id,
    ticketId: ticket.id,
    attemptId,
    occurredAt: currentMission.updatedAt,
    actor: "system",
    source: "workspace-isolation",
    payload: {
      mission: currentMission,
      ticket: currentTicket,
      isolation,
      trigger: "system",
    },
  };
  await persistRunTransition({
    layout,
    event: workspaceEvent,
    mission: currentMission,
    ticket: currentTicket,
    ticketRepository,
    missionRepository,
    skipProjectionRewrite: true,
  });
  events.push(workspaceEvent);

  const claimedAt = new Date().toISOString();
  currentMission = withMissionEvent(currentMission, {
    eventId: dependencies.createEventId(),
    occurredAt: claimedAt,
  });
  currentTicket = withTicketEvent(currentTicket, {
    eventId: currentMission.resumeCursor,
    occurredAt: claimedAt,
    status: "claimed",
    workspaceIsolationId,
  });
  const claimEvent: JournalEventRecord = {
    eventId: currentMission.resumeCursor,
    type: "ticket.claimed",
    missionId: mission.id,
    ticketId: ticket.id,
    attemptId,
    occurredAt: claimedAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: currentMission,
      ticket: currentTicket,
      previousStatus: ticket.status,
      trigger: "operator",
    },
  };
  await persistRunTransition({
    layout,
    event: claimEvent,
    mission: currentMission,
    ticket: currentTicket,
    ticketRepository,
    missionRepository,
    skipProjectionRewrite: true,
  });
  events.push(claimEvent);

  const requestedAt = new Date().toISOString();
  currentMission = withMissionEvent(currentMission, {
    eventId: dependencies.createEventId(),
    occurredAt: requestedAt,
    status: "running",
  });
  currentTicket = applyExecutionHandleSnapshot(
    withTicketEvent(currentTicket, {
      eventId: currentMission.resumeCursor,
      occurredAt: requestedAt,
    }),
    adapter.id,
    {},
  );
  let currentAttempt: ExecutionAttempt = {
    id: attemptId,
    ticketId: ticket.id,
    adapter: adapter.id,
    status: "requested",
    workspaceIsolationId,
    backgroundRequested,
    adapterState: {},
    startedAt: requestedAt,
    endedAt: null,
  };
  const requestedEvent: JournalEventRecord = {
    eventId: currentMission.resumeCursor,
    type: "execution.requested",
    missionId: mission.id,
    ticketId: ticket.id,
    attemptId,
    occurredAt: requestedAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      trigger: "operator",
      backgroundRequested,
    },
  };
  await persistRunTransition({
    layout,
    event: requestedEvent,
    mission: currentMission,
    ticket: currentTicket,
    attempt: currentAttempt,
    ticketRepository,
    missionRepository,
    attemptRepository,
    skipProjectionRewrite: true,
  });
  events.push(requestedEvent);

  for (const capabilityInvocation of capabilityInvocations) {
    currentMission = withMissionEvent(currentMission, {
      eventId: capabilityInvocation.event.eventId,
      occurredAt: capabilityInvocation.event.occurredAt,
    });
    currentTicket = withTicketEvent(currentTicket, {
      eventId: currentMission.resumeCursor,
      occurredAt: capabilityInvocation.event.occurredAt,
    });

    const capabilityEvent: JournalEventRecord = {
      ...capabilityInvocation.event,
      missionId: mission.id,
      ticketId: ticket.id,
      attemptId,
    };

    await persistRunTransition({
      layout,
      event: capabilityEvent,
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      ticketRepository,
      missionRepository,
      attemptRepository,
      skipProjectionRewrite: true,
    });
    events.push(capabilityEvent);
  }

  for (const skillPackUsageEventDetails of skillPackUsageEvents) {
    currentMission = withMissionEvent(currentMission, {
      eventId: skillPackUsageEventDetails.event.eventId,
      occurredAt: skillPackUsageEventDetails.event.occurredAt,
    });
    currentTicket = withTicketEvent(currentTicket, {
      eventId: currentMission.resumeCursor,
      occurredAt: skillPackUsageEventDetails.event.occurredAt,
    });

    const skillPackEvent: JournalEventRecord = {
      ...skillPackUsageEventDetails.event,
      missionId: mission.id,
      ticketId: ticket.id,
      attemptId,
      payload: {
        mission: currentMission,
        ticket: currentTicket,
        skillPack: skillPackUsageEventDetails.skillPack,
        trigger: "ticket_run_launch",
      },
    };

    await persistRunTransition({
      layout,
      event: skillPackEvent,
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      ticketRepository,
      missionRepository,
      attemptRepository,
      skipProjectionRewrite: true,
    });
    events.push(skillPackEvent);
  }

  if (!backgroundRequested) {
    const inProgressTransition = buildTicketInProgressTransition({
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      missionId: mission.id,
      ticketId: ticket.id,
      adapterId: adapter.id,
      adapterState: currentAttempt.adapterState,
      attemptStatus: "running",
      dependencies,
      actor: "system",
      source: "ticket-runtime",
      trigger: "system",
    });
    currentMission = inProgressTransition.mission;
    currentTicket = inProgressTransition.ticket;
    currentAttempt = inProgressTransition.attempt;
    await persistRunTransition({
      layout,
      event: inProgressTransition.event,
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      ticketRepository,
      missionRepository,
      attemptRepository,
    });
    events.push(inProgressTransition.event);
  }

  let transitionResult: {
    mission: Mission;
    ticket: Ticket;
    attempt: ExecutionAttempt;
    event: JournalEventRecord;
  };
  let adapterResult: ExecutionAdapterLaunchResult | null = null;

  try {
    const latestMission = await missionRepository.findById(mission.id);

    if (!latestMission) {
      throw new Error(`Mission introuvable: ${mission.id}.`);
    }

    ensureTicketExtensionsAllowedByMission({
      mission: latestMission,
      allowedCapabilities: currentTicket.allowedCapabilities,
      skillPackRefs: currentTicket.skillPackRefs,
    });

    adapterResult = await adapter.launch({
      mission: currentMission,
      ticket: currentTicket,
      attemptId,
      workspacePath: isolation.workspacePath,
      background: backgroundRequested,
      resolvedSkillPacks,
    });

    if (
      backgroundRequested
      && isActiveAttemptStatus(adapterResult.status)
      && adapterResult.status !== "awaiting_approval"
    ) {
      const inProgressTransition = buildTicketInProgressTransition({
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        missionId: mission.id,
        ticketId: ticket.id,
        adapterId: adapter.id,
        adapterState: adapterResult.adapterState,
        attemptStatus: adapterResult.status,
        dependencies,
        actor: "adapter",
        source: adapter.id,
        trigger: "adapter",
      });
      currentMission = inProgressTransition.mission;
      currentTicket = inProgressTransition.ticket;
      currentAttempt = inProgressTransition.attempt;
      await persistRunTransition({
        layout,
        event: inProgressTransition.event,
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        ticketRepository,
        missionRepository,
        attemptRepository,
      });
      events.push(inProgressTransition.event);
    }

    transitionResult = await finalizeAdapterOutcome({
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      missionTicketIds: mission.ticketIds,
      missionId: mission.id,
      ticketId: ticket.id,
      adapterId: adapter.id,
      adapterResult,
      dependencies,
      backgroundRequested,
      attemptRepository,
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const hasOtherActiveAttempts = await missionHasOtherActiveAttempts(
      mission.id,
      ticket.id,
      mission.ticketIds,
      attemptRepository,
    );
    currentMission = withMissionEvent(currentMission, {
      eventId: dependencies.createEventId(),
      occurredAt: failedAt,
      status: hasOtherActiveAttempts ? "running" : "failed",
    });
    currentTicket = applyExecutionHandleSnapshot(
      withTicketEvent(currentTicket, {
        eventId: currentMission.resumeCursor,
        occurredAt: failedAt,
        status: "failed",
      }),
      adapter.id,
      currentAttempt.adapterState,
    );
    currentAttempt = {
      ...currentAttempt,
      status: "failed",
      endedAt: failedAt,
    };
    const failedEvent: JournalEventRecord = {
      eventId: currentMission.resumeCursor,
      type: "execution.failed",
      missionId: mission.id,
      ticketId: ticket.id,
      attemptId,
      occurredAt: failedAt,
      actor: "adapter",
      source: adapter.id,
      payload: {
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        trigger: "adapter",
      },
    };
    await persistRunTransition({
      layout,
      event: failedEvent,
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      ticketRepository,
      missionRepository,
      attemptRepository,
    });
    events.push(failedEvent);

    try {
      const artifactRegistrationResult = await detectAndRegisterTerminalArtifacts({
        layout,
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        producingEvent: failedEvent,
        trigger: "execution-terminal-output",
        isolation,
      });

      currentMission = artifactRegistrationResult.mission;
      currentTicket = artifactRegistrationResult.ticket;
      events.push(...artifactRegistrationResult.events);
    } catch (artifactDetectionError) {
      console.warn(
        `Avertissement: impossible de detecter/enregistrer les artefacts apres l'echec du ticket \`${ticket.id}\`: ${artifactDetectionError instanceof Error ? artifactDetectionError.message : String(artifactDetectionError)}`,
      );
    }

    throw error;
  }

  currentMission = transitionResult.mission;
  currentTicket = transitionResult.ticket;
  currentAttempt = transitionResult.attempt;

  await persistRunTransition({
    layout,
    event: transitionResult.event,
    mission: currentMission,
    ticket: currentTicket,
    attempt: currentAttempt,
    ticketRepository,
    missionRepository,
    attemptRepository,
  });
  events.push(transitionResult.event);

  if (adapterResult && isTerminalExecutionEventType(transitionResult.event.type)) {
    const artifactRegistrationResult = await detectAndRegisterTerminalArtifacts({
      layout,
      mission: currentMission,
      ticket: currentTicket,
      attempt: currentAttempt,
      producingEvent: transitionResult.event,
      trigger: "execution-terminal-output",
      isolation,
      adapterOutputs: adapterResult.outputs,
    });

    currentMission = artifactRegistrationResult.mission;
    currentTicket = artifactRegistrationResult.ticket;
    events.push(...artifactRegistrationResult.events);
  }

  const resumeResult = await readMissionResume({
    rootDir: layout.rootDir,
    missionId: currentMission.id,
    commandName: "resume",
  });

  return {
    mission: currentMission,
    ticket: currentTicket,
    attempt: currentAttempt,
    isolation,
    events,
    resume: resumeResult.resume,
  };
}

function resolveRunTicketDependencies(): RunTicketDependencies {
  return {
    createAdapter: runTicketDependencyOverrides?.createAdapter
      ?? (() => createCodexResponsesAdapterFromEnvironment()),
    createWorkspaceIsolation: runTicketDependencyOverrides?.createWorkspaceIsolation
      ?? ((options) => createWorkspaceIsolation(options)),
    createEventId: runTicketDependencyOverrides?.createEventId
      ?? (() => `event_${randomUUID()}`),
    createAttemptId: runTicketDependencyOverrides?.createAttemptId
      ?? (() => `attempt_${randomUUID()}`),
    createIsolationId: runTicketDependencyOverrides?.createIsolationId
      ?? (() => `iso_${randomUUID()}`),
    createApprovalId: runTicketDependencyOverrides?.createApprovalId
      ?? (() => `approval_${randomUUID()}`),
  };
}

async function finalizeAdapterOutcome(options: {
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  missionTicketIds: string[];
  missionId: string;
  ticketId: string;
  adapterId: ExecutionAttempt["adapter"];
  adapterResult: ExecutionAdapterLaunchResult;
  dependencies: RunTicketDependencies;
  backgroundRequested: boolean;
  attemptRepository: ReturnType<typeof createFileExecutionAttemptRepository>;
}): Promise<{
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  event: JournalEventRecord;
}> {
  const occurredAt = new Date().toISOString();
  const adapterState = { ...options.adapterResult.adapterState };

  if (options.adapterResult.status === "awaiting_approval") {
    const approval = materializeApprovalRequest({
      approvalRequest: options.adapterResult.approvalRequest,
      mission: options.mission,
      ticket: options.ticket,
      attempt: options.attempt,
      approvalId: options.dependencies.createApprovalId(),
      occurredAt,
      fallbackRelatedEventIds: [options.mission.resumeCursor],
    });
    const mission = withMissionEvent(options.mission, {
      eventId: options.dependencies.createEventId(),
      occurredAt,
      status: "awaiting_approval",
    });
    const ticket = applyExecutionHandleSnapshot(
      withTicketEvent(options.ticket, {
        eventId: mission.resumeCursor,
        occurredAt,
        status: "awaiting_approval",
      }),
      options.adapterId,
      adapterState,
    );
    const attempt: ExecutionAttempt = {
      ...options.attempt,
      status: "awaiting_approval",
      adapterState,
    };

    return {
      mission,
      ticket,
      attempt,
      event: {
        eventId: mission.resumeCursor,
        type: "approval.requested",
        missionId: options.missionId,
        ticketId: options.ticketId,
        attemptId: attempt.id,
        occurredAt,
        actor: "adapter",
        source: options.adapterId,
        payload: {
          mission,
          ticket,
          attempt,
          approvalId: approval.approvalId,
          approval,
          trigger: "adapter",
        },
      },
    };
  }

  if (isActiveAttemptStatus(options.adapterResult.status)) {
    const mission = withMissionEvent(options.mission, {
      eventId: options.dependencies.createEventId(),
      occurredAt,
      status: "running",
    });
    const ticket = applyExecutionHandleSnapshot(
      withTicketEvent(options.ticket, {
        eventId: mission.resumeCursor,
        occurredAt,
      }),
      options.adapterId,
      adapterState,
    );
    const attempt: ExecutionAttempt = {
      ...options.attempt,
      status: options.adapterResult.status,
      adapterState,
    };

    return {
      mission,
      ticket,
      attempt,
      event: {
        eventId: mission.resumeCursor,
        type: "execution.background_started",
        missionId: options.missionId,
        ticketId: options.ticketId,
        attemptId: attempt.id,
        occurredAt,
        actor: "adapter",
        source: options.adapterId,
        payload: {
          mission,
          ticket,
          attempt,
          trigger: "adapter",
        },
      },
    };
  }

  if (options.adapterResult.status === "completed") {
    const hasOtherActiveAttempts = await missionHasOtherActiveAttempts(
      options.missionId,
      options.ticketId,
      options.missionTicketIds,
      options.attemptRepository,
    );
    const mission = withMissionEvent(options.mission, {
      eventId: options.dependencies.createEventId(),
      occurredAt,
      status: hasOtherActiveAttempts ? "running" : "ready",
    });
    const ticket = applyExecutionHandleSnapshot(
      withTicketEvent(options.ticket, {
        eventId: mission.resumeCursor,
        occurredAt,
        status: "done",
      }),
      options.adapterId,
      adapterState,
    );
    const attempt: ExecutionAttempt = {
      ...options.attempt,
      status: "completed",
      adapterState,
      endedAt: occurredAt,
    };

    return {
      mission,
      ticket,
      attempt,
      event: {
        eventId: mission.resumeCursor,
        type: "execution.completed",
        missionId: options.missionId,
        ticketId: options.ticketId,
        attemptId: attempt.id,
        occurredAt,
        actor: "adapter",
        source: options.adapterId,
        payload: {
          mission,
          ticket,
          attempt,
          trigger: "adapter",
        },
      },
    };
  }

  const hasOtherActiveAttempts = await missionHasOtherActiveAttempts(
    options.missionId,
    options.ticketId,
    options.missionTicketIds,
    options.attemptRepository,
  );
  const isCancelled = options.adapterResult.status === "cancelled";
  const mission = withMissionEvent(options.mission, {
    eventId: options.dependencies.createEventId(),
    occurredAt,
    status: isCancelled
      ? (hasOtherActiveAttempts ? "running" : "ready")
      : (hasOtherActiveAttempts ? "running" : "failed"),
  });
  const ticket = applyExecutionHandleSnapshot(
    withTicketEvent(options.ticket, {
      eventId: mission.resumeCursor,
      occurredAt,
      status: isCancelled ? "cancelled" : "failed",
    }),
    options.adapterId,
    adapterState,
  );
  const attempt: ExecutionAttempt = {
    ...options.attempt,
    status: isCancelled ? "cancelled" : "failed",
    adapterState,
    endedAt: occurredAt,
  };

  return {
    mission,
    ticket,
    attempt,
    event: {
      eventId: mission.resumeCursor,
      type: isCancelled ? "execution.cancelled" : "execution.failed",
      missionId: options.missionId,
      ticketId: options.ticketId,
      attemptId: attempt.id,
      occurredAt,
      actor: "adapter",
      source: options.adapterId,
      payload: {
        mission,
        ticket,
        attempt,
        trigger: "adapter",
      },
    },
  };
}

function buildTicketInProgressTransition(options: {
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  missionId: string;
  ticketId: string;
  adapterId: ExecutionAttempt["adapter"];
  adapterState: Record<string, unknown>;
  attemptStatus: ExecutionAttemptStatus;
  dependencies: RunTicketDependencies;
  actor: JournalEventRecord["actor"];
  source: string;
  trigger: string;
}): {
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  event: JournalEventRecord;
} {
  const occurredAt = new Date().toISOString();
  const mission = withMissionEvent(options.mission, {
    eventId: options.dependencies.createEventId(),
    occurredAt,
    status: "running",
  });
  const ticket = applyExecutionHandleSnapshot(
    withTicketEvent(options.ticket, {
      eventId: mission.resumeCursor,
      occurredAt,
      status: "in_progress",
    }),
    options.adapterId,
    options.adapterState,
  );
  const attempt: ExecutionAttempt = {
    ...options.attempt,
    status: options.attemptStatus,
    adapterState: { ...options.adapterState },
  };

  return {
    mission,
    ticket,
    attempt,
    event: {
      eventId: mission.resumeCursor,
      type: "ticket.in_progress",
      missionId: options.missionId,
      ticketId: options.ticketId,
      attemptId: attempt.id,
      occurredAt,
      actor: options.actor,
      source: options.source,
      payload: {
        mission,
        ticket,
        attempt,
        previousStatus: options.ticket.status,
        trigger: options.trigger,
      },
    },
  };
}

async function detectAndRegisterTerminalArtifacts(options: {
  layout: ReturnType<typeof resolveWorkspaceLayout>;
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  producingEvent: JournalEventRecord;
  trigger: string;
  isolation: WorkspaceIsolationMetadata;
  adapterOutputs?: ExecutionAdapterLaunchResult["outputs"];
}): Promise<{
  mission: Mission;
  ticket: Ticket;
  events: JournalEventRecord[];
}> {
  const detectedArtifacts = await detectTicketArtifacts({
    adapterOutputs: options.adapterOutputs,
    isolation: options.isolation,
    producingEvent: options.producingEvent,
  });

  const artifactRegistrationResult = await registerArtifacts({
    layout: options.layout,
    mission: options.mission,
    ticket: options.ticket,
    attempt: options.attempt,
    producingEvent: options.producingEvent,
    trigger: options.trigger,
    detectedArtifacts,
  });

  return {
    mission: artifactRegistrationResult.mission,
    ticket: artifactRegistrationResult.ticket,
    events: artifactRegistrationResult.events,
  };
}

async function persistRunTransition(options: {
  layout: ReturnType<typeof resolveWorkspaceLayout>;
  event: JournalEventRecord;
  mission: Mission;
  ticket: Ticket;
  attempt?: ExecutionAttempt;
  ticketRepository: ReturnType<typeof createFileTicketRepository>;
  missionRepository: ReturnType<typeof createFileMissionRepository>;
  attemptRepository?: ReturnType<typeof createFileExecutionAttemptRepository>;
  skipProjectionRewrite?: boolean;
}): Promise<void> {
  await appendEvent(options.layout.journalPath, options.event);
  await options.ticketRepository.save(options.ticket);
  await options.missionRepository.save(options.mission);

  if (options.attempt && options.attemptRepository) {
    await options.attemptRepository.save(options.mission.id, options.attempt);
  }

  if (!options.skipProjectionRewrite) {
    await rewriteMissionReadModels(options.layout, options.mission, options.ticketRepository);
  }
}

function withMissionEvent(
  mission: Mission,
  options: {
    eventId: string;
    occurredAt: string;
    status?: Mission["status"];
  },
): Mission {
  return {
    ...mission,
    ...(options.status ? { status: options.status } : {}),
    eventIds: [...mission.eventIds, options.eventId],
    resumeCursor: options.eventId,
    updatedAt: options.occurredAt,
  };
}

function withTicketEvent(
  ticket: Ticket,
  options: {
    eventId: string;
    occurredAt: string;
    status?: Ticket["status"];
    workspaceIsolationId?: string;
  },
): Ticket {
  return {
    ...ticket,
    ...(options.status ? { status: options.status } : {}),
    ...(options.workspaceIsolationId
      ? { workspaceIsolationId: options.workspaceIsolationId }
      : {}),
    eventIds: [...ticket.eventIds, options.eventId],
    updatedAt: options.occurredAt,
  };
}

function ensureMissionCanRunTicket(mission: Mission, ticket: Ticket): void {
  if (mission.status === "ready" || mission.status === "running") {
    return;
  }

  if (mission.status === "failed" && ticket.status === "failed") {
    return;
  }

  throw new Error(
    `La mission \`${mission.id}\` ne peut pas lancer de tentative depuis le statut \`${mission.status}\`.`,
  );
}

function ensureTicketHasOwner(ticket: Ticket): void {
  if (ticket.owner.trim().length > 0) {
    return;
  }

  throw new Error(
    `Le ticket \`${ticket.id}\` doit avoir un owner renseigne avant \`corp mission ticket run\`.`,
  );
}

function ensureTicketStatusRunnable(
  ticket: Ticket,
  allowBlockedTicketRetry: boolean,
): void {
  if (
    ticket.status === "todo"
    || ticket.status === "failed"
    || (allowBlockedTicketRetry && ticket.status === "blocked")
  ) {
    return;
  }

  throw new Error(
    `Le ticket \`${ticket.id}\` n'est pas runnable car son statut actuel est \`${ticket.status}\`.`,
  );
}

function isActiveAttemptStatus(status: ExecutionAttemptStatus): boolean {
  return ACTIVE_EXECUTION_ATTEMPT_STATUSES.includes(status);
}

function materializeApprovalRequest(options: {
  approvalRequest: ExecutionAdapterApprovalRequest;
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  approvalId: string;
  occurredAt: string;
  fallbackRelatedEventIds: string[];
}): ApprovalRequest {
  return {
    approvalId: options.approvalId,
    missionId: options.mission.id,
    ticketId: options.ticket.id,
    attemptId: options.attempt.id,
    status: "requested",
    title: requireText(
      options.approvalRequest.title,
      "L'adaptateur doit fournir un `approvalRequest.title` non vide pour `awaiting_approval`.",
    ),
    actionType: requireText(
      options.approvalRequest.actionType,
      "L'adaptateur doit fournir un `approvalRequest.actionType` non vide pour `awaiting_approval`.",
    ),
    actionSummary: requireText(
      options.approvalRequest.actionSummary,
      "L'adaptateur doit fournir un `approvalRequest.actionSummary` non vide pour `awaiting_approval`.",
    ),
    guardrails: buildApprovalGuardrails(options.mission, options.ticket, options.approvalRequest),
    relatedEventIds: normalizeOpaqueReferences([
      ...(options.approvalRequest.relatedEventIds ?? []),
      ...options.fallbackRelatedEventIds,
    ]),
    relatedArtifactIds: normalizeOpaqueReferences(
      options.approvalRequest.relatedArtifactIds ?? [],
    ),
    createdAt: options.occurredAt,
    updatedAt: options.occurredAt,
  };
}

function buildApprovalGuardrails(
  mission: Mission,
  ticket: Ticket,
  approvalRequest: ExecutionAdapterApprovalRequest,
): string[] {
  return buildApprovalGuardrailsSnapshot({
    baseGuardrails: approvalRequest.guardrails ?? [],
    policyProfileId: mission.policyProfileId,
    allowedCapabilities: ticket.allowedCapabilities,
    skillPackRefs: ticket.skillPackRefs,
  });
}

function isTerminalExecutionEventType(eventType: string): boolean {
  return eventType === "execution.completed"
    || eventType === "execution.failed"
    || eventType === "execution.cancelled";
}

async function buildCapabilityInvocationEvents(options: {
  repository: ReturnType<typeof createFileCapabilityRegistryRepository>;
  mission: Mission;
  ticket: Ticket;
  attemptId: string;
  dependencies: RunTicketDependencies;
}): Promise<Array<Awaited<ReturnType<typeof invokeRegisteredCapability>>>> {
  const invocations: Array<Awaited<ReturnType<typeof invokeRegisteredCapability>>> = [];

  for (const capabilityId of options.ticket.allowedCapabilities) {
    if (isBuiltInAllowedCapability(capabilityId)) {
      continue;
    }

    const capability: RegisteredCapability = await readRegisteredCapability({
      repository: options.repository,
      capabilityId,
    });

    invocations.push(
      await invokeRegisteredCapability({
        capability,
        mission: options.mission,
        ticket: options.ticket,
        attemptId: options.attemptId,
        eventId: options.dependencies.createEventId(),
        occurredAt: new Date().toISOString(),
        actor: "system",
        source: "ticket-runtime",
        trigger: "ticket_run_preflight",
      }),
    );
  }

  return invocations;
}

async function buildSkillPackUsageEvents(options: {
  repository: ReturnType<typeof createFileSkillPackRegistryRepository>;
  mission: Mission;
  ticket: Ticket;
  attemptId: string;
  dependencies: RunTicketDependencies;
}): Promise<Array<{
  event: JournalEventRecord;
  skillPack: SkillPackUsageDetails;
}>> {
  const usageEvents: Array<{
    event: JournalEventRecord;
    skillPack: SkillPackUsageDetails;
  }> = [];

  for (const packRef of [...new Set(options.ticket.skillPackRefs)]) {
    const registeredSkillPack = await readRegisteredSkillPack({
      repository: options.repository,
      packRef,
    });
    const skillPack = buildSkillPackUsageDetails(registeredSkillPack);

    usageEvents.push({
      skillPack,
      event: {
        eventId: options.dependencies.createEventId(),
        type: "skill_pack.used",
        missionId: options.mission.id,
        ticketId: options.ticket.id,
        attemptId: options.attemptId,
        occurredAt: new Date().toISOString(),
        actor: "system",
        source: "ticket-runtime",
        payload: {},
      },
    });
  }

  return usageEvents;
}
