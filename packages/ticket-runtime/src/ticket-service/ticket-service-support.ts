import type { Mission } from "../../../contracts/src/mission/mission";
import {
  TERMINAL_TICKET_STATUSES,
  TICKET_KINDS,
  type ExecutionAdapterId,
  type Ticket,
  type TicketKind,
} from "../../../contracts/src/ticket/ticket";
import { DEFAULT_PROJECTIONS } from "../../../journal/src/projections/default-projections";
import {
  createArtifactIndexProjection,
  type ArtifactIndexProjection,
} from "../../../journal/src/projections/artifact-index-projection";
import {
  createAuditLogProjection,
} from "../../../journal/src/projections/audit-log-projection";
import {
  createApprovalQueueProjection,
  type ApprovalQueueProjection,
} from "../../../journal/src/projections/approval-queue-projection";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import { createMissionStatusProjection } from "../../../journal/src/projections/mission-status-projection";
import { buildResumeViewProjection } from "../../../journal/src/projections/resume-view-projection";
import {
  readProjectionFile,
  readProjectionSnapshot,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import type { WorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import { createFileExecutionAttemptRepository } from "../../../storage/src/repositories/file-execution-attempt-repository";
import { createFileArtifactRepository } from "../../../storage/src/repositories/file-artifact-repository";
import type { FileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { buildTicketBoardProjection } from "../planner/build-ticket-board";
import { deepStrictEqualForComparison } from "../utils/structural-compare";

export { normalizeOpaqueReferences } from "../../../contracts/src/extension/extension-registration";
import { normalizeOpaqueReferenceKey } from "../../../contracts/src/extension/extension-registration";

export interface RewriteMissionReadModelsOptions {
  skipArtifactIndex?: boolean;
}

export const BUILT_IN_ALLOWED_CAPABILITIES = new Set<string>([
  "fs.read",
  "cli.run",
]);

const CLOSED_OPEN_TICKET_STATUSES = new Set<string>([
  ...TERMINAL_TICKET_STATUSES,
]);

export function requireText(value: string | undefined, errorMessage: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
}

export function requireTicketKind(value: string | undefined): TicketKind {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error("L'option --kind est obligatoire pour `corp mission ticket create`.");
  }

  if (TICKET_KINDS.includes(normalizedValue as TicketKind)) {
    return normalizedValue as TicketKind;
  }

  throw new Error(
    "L'option --kind doit valoir `research`, `plan`, `implement`, `review` ou `operate` pour `corp mission ticket create`.",
  );
}

export function normalizeTrimmedList(
  values: string[],
  options: { dedupe?: boolean } = {},
): string[] {
  const normalizedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const rawValue of values) {
    const normalizedValue = rawValue.trim();

    if (!normalizedValue) {
      continue;
    }

    if (options.dedupe) {
      if (seenValues.has(normalizedValue)) {
        continue;
      }

      seenValues.add(normalizedValue);
    }

    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
}

export function isBuiltInAllowedCapability(capabilityId: string): boolean {
  return BUILT_IN_ALLOWED_CAPABILITIES.has(
    normalizeOpaqueReferenceKey(capabilityId),
  );
}

export function ensureTicketExtensionsAllowedByMission(options: {
  mission: Mission;
  allowedCapabilities: string[];
  skillPackRefs: string[];
}): void {
  const allowedCapabilities = new Set(
    options.mission.authorizedExtensions.allowedCapabilities.map(normalizeOpaqueReferenceKey),
  );
  const skillPackRefs = new Set(
    options.mission.authorizedExtensions.skillPackRefs.map(normalizeOpaqueReferenceKey),
  );

  for (const capabilityId of options.allowedCapabilities) {
    if (isBuiltInAllowedCapability(capabilityId)) {
      continue;
    }

    if (!allowedCapabilities.has(normalizeOpaqueReferenceKey(capabilityId))) {
      throw new Error(
        `La capability \`${normalizeOpaqueReferenceKey(capabilityId)}\` n'est pas autorisee par la mission \`${options.mission.id}\`.`,
      );
    }
  }

  for (const packRef of options.skillPackRefs) {
    if (!skillPackRefs.has(normalizeOpaqueReferenceKey(packRef))) {
      throw new Error(
        `Le skill pack \`${normalizeOpaqueReferenceKey(packRef)}\` n'est pas autorise par la mission \`${options.mission.id}\`.`,
      );
    }
  }
}

export function buildApprovalGuardrailsSnapshot(options: {
  baseGuardrails: string[];
  policyProfileId: string;
  allowedCapabilities: string[];
  skillPackRefs: string[];
}): string[] {
  return normalizeTrimmedList(
    [
      ...options.baseGuardrails.filter((guardrail) =>
        !guardrail.startsWith("policy_profile:")
        && !guardrail.startsWith("allowed_capabilities:")
        && !guardrail.startsWith("skill_packs:")
      ),
      `policy_profile: ${options.policyProfileId}`,
      ...(options.allowedCapabilities.length > 0
        ? [`allowed_capabilities: ${options.allowedCapabilities.join(", ")}`]
        : []),
      ...(options.skillPackRefs.length > 0
        ? [`skill_packs: ${options.skillPackRefs.join(", ")}`]
        : []),
    ],
    { dedupe: true },
  );
}

export function requireCreateSuccessCriteria(successCriteria: string[]): string[] {
  const normalizedCriteria = normalizeTrimmedList(successCriteria);

  if (normalizedCriteria.length === 0) {
    throw new Error(
      "Au moins un `--success-criterion` est obligatoire pour `corp mission ticket create`.",
    );
  }

  return normalizedCriteria;
}

export function normalizeUpdatedSuccessCriteria(successCriteria: string[]): string[] {
  const normalizedCriteria = normalizeTrimmedList(successCriteria, { dedupe: true });

  if (normalizedCriteria.length === 0) {
    throw new Error(
      "Au moins un `--success-criterion` est requis pour `corp mission ticket update`.",
    );
  }

  return normalizedCriteria;
}

export function requireTicketInMission(
  ticket: Ticket | null,
  mission: Mission,
  ticketId: string,
): Ticket {
  if (!ticket || !mission.ticketIds.includes(ticketId)) {
    throw new Error(`Ticket introuvable dans la mission \`${mission.id}\`: \`${ticketId}\`.`);
  }

  return ticket;
}

export function applyExecutionHandleSnapshot(
  ticket: Ticket,
  adapterId: ExecutionAdapterId,
  adapterState: Record<string, unknown>,
): Ticket {
  return {
    ...ticket,
    executionHandle: {
      adapter: adapterId,
      adapterState: { ...adapterState },
    },
  };
}

export async function rewriteMissionReadModels(
  layout: WorkspaceLayout,
  mission: Mission,
  ticketRepository: FileTicketRepository,
  options: RewriteMissionReadModelsOptions = {},
): Promise<void> {
  const missionTickets = await ticketRepository.listByMissionId(mission.id);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const artifactRepository = createFileArtifactRepository(layout);
  const missionAttempts: ExecutionAttempt[] = [];

  for (const ticketId of mission.ticketIds) {
    missionAttempts.push(
      ...(await attemptRepository.listByTicketId(mission.id, ticketId)),
    );
  }

  const missionArtifacts = await artifactRepository.listByMissionId(mission.id);
  const missionEvents = (await readEventLog(layout.journalPath))
    .filter((event) => event.missionId === mission.id);
  const ticketBoardProjection = buildTicketBoardProjection(
    mission,
    missionTickets,
    missionAttempts,
    missionEvents,
  );
  const approvalQueueProjection = createApprovalQueueProjection({
    missionId: mission.id,
    events: missionEvents,
  });
  const storedApprovalQueueProjection = await readProjectionSnapshotOrNull<ApprovalQueueProjection>(
    layout.projectionsDir,
    "approval-queue",
  );
  const artifactIndexProjection = options.skipArtifactIndex
    ? await readProjectionSnapshotOrDefault<ArtifactIndexProjection>(
      layout.projectionsDir,
      "artifact-index",
      DEFAULT_PROJECTIONS["artifact-index"] as ArtifactIndexProjection,
    )
    : createArtifactIndexProjection({
      mission,
      tickets: missionTickets,
      artifacts: missionArtifacts,
      events: missionEvents,
    });
  const auditLogProjection = createAuditLogProjection({
    mission,
    tickets: missionTickets,
    artifacts: missionArtifacts,
    events: missionEvents,
  });

  await writeProjectionSnapshot(
    layout.projectionsDir,
    "mission-status",
    createMissionStatusProjection(mission),
  );
  await writeProjectionSnapshot(
    layout.projectionsDir,
    "ticket-board",
    ticketBoardProjection,
  );
  if (
    !storedApprovalQueueProjection
    || !deepStrictEqualForComparison(storedApprovalQueueProjection, approvalQueueProjection)
  ) {
    await writeProjectionSnapshot(
      layout.projectionsDir,
      "approval-queue",
      approvalQueueProjection,
    );
  }

  if (!options.skipArtifactIndex) {
    await writeProjectionSnapshot(
      layout.projectionsDir,
      "artifact-index",
      artifactIndexProjection,
    );
  }

  await writeProjectionSnapshot(
    layout.projectionsDir,
    "audit-log",
    auditLogProjection,
  );

  await writeProjectionSnapshot(
    layout.projectionsDir,
    "resume-view",
    buildResumeViewProjection({
      mission,
      missionEvents,
      ticketBoardEntries: ticketBoardProjection.tickets,
      openTickets: ticketBoardProjection.tickets.filter((ticket) =>
        !CLOSED_OPEN_TICKET_STATUSES.has(ticket.status)
      ),
      pendingApprovals: approvalQueueProjection.approvals,
      lastRelevantArtifact: artifactIndexProjection.artifacts.at(-1) ?? null,
      hasFailedTickets: ticketBoardProjection.tickets.some((ticket) => ticket.status === "failed"),
    }),
  );
}

export async function missionHasOtherActiveAttempts(
  missionId: string,
  currentTicketId: string,
  missionTicketIds: string[],
  attemptRepository: ReturnType<typeof createFileExecutionAttemptRepository>,
): Promise<boolean> {
  for (const ticketId of missionTicketIds) {
    if (ticketId === currentTicketId) {
      continue;
    }

    const activeAttempt = await attemptRepository.findActiveByTicketId(missionId, ticketId);

    if (activeAttempt) {
      return true;
    }
  }

  return false;
}

async function readProjectionSnapshotOrNull<T>(
  projectionsDir: string,
  projectionName: string,
): Promise<T | null> {
  try {
    return JSON.parse(
      await readProjectionFile(projectionsDir, projectionName),
    ) as T;
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

async function readProjectionSnapshotOrDefault<T>(
  projectionsDir: string,
  projectionName: string,
  fallback: T,
): Promise<T> {
  try {
    return await readProjectionSnapshot<T>(projectionsDir, projectionName);
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return fallback;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
