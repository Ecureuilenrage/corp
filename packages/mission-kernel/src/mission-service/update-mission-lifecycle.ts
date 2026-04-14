import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import type { Mission, MissionStatus } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import { createAuditLogProjection } from "../../../journal/src/projections/audit-log-projection";
import { DEFAULT_PROJECTIONS } from "../../../journal/src/projections/default-projections";
import { createMissionStatusProjection } from "../../../journal/src/projections/mission-status-projection";
import { readMissionResume } from "../resume-service/read-mission-resume";
import {
  resolveProjectionPath,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import {
  resolveWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import { createFileArtifactRepository } from "../../../storage/src/repositories/file-artifact-repository";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";

export type MissionLifecycleAction = "pause" | "relaunch" | "close";
export type MissionCloseOutcome = "completed" | "cancelled";

export interface UpdateMissionLifecycleOptions {
  rootDir: string;
  missionId: string;
  action: MissionLifecycleAction;
  outcome?: MissionCloseOutcome;
  reason?: string;
}

export interface UpdateMissionLifecycleResult {
  mission: Mission;
  event: JournalEventRecord;
  missionDir: string;
  missionPath: string;
  resume: MissionResume;
}

interface LifecycleTransitionDefinition {
  allowedStatuses: MissionStatus[];
  nextStatus: MissionStatus;
  eventType: string;
}

const CLOSEABLE_STATUSES: MissionStatus[] = [
  "ready",
  "running",
  "blocked",
  "awaiting_approval",
  "failed",
];

const LIFECYCLE_TRANSITIONS: Record<
  "pause" | "relaunch",
  LifecycleTransitionDefinition
> = {
  pause: {
    allowedStatuses: ["ready", "running", "awaiting_approval", "failed"],
    nextStatus: "blocked",
    eventType: "mission.paused",
  },
  relaunch: {
    allowedStatuses: ["blocked", "failed", "awaiting_approval"],
    nextStatus: "ready",
    eventType: "mission.relaunched",
  },
};

const CLOSE_TRANSITIONS: Record<MissionCloseOutcome, LifecycleTransitionDefinition> = {
  completed: {
    allowedStatuses: CLOSEABLE_STATUSES,
    nextStatus: "completed",
    eventType: "mission.completed",
  },
  cancelled: {
    allowedStatuses: CLOSEABLE_STATUSES,
    nextStatus: "cancelled",
    eventType: "mission.cancelled",
  },
};

export async function updateMissionLifecycle(
  options: UpdateMissionLifecycleOptions,
): Promise<UpdateMissionLifecycleResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, options.action);

  const repository = createFileMissionRepository(layout);
  const mission = await repository.findById(options.missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${options.missionId}.`);
  }

  const transition = resolveLifecycleTransition(
    mission.status,
    options.action,
    options.outcome,
  );
  const occurredAt = new Date().toISOString();
  const eventId = `event_${randomUUID()}`;
  const updatedMission: Mission = {
    ...mission,
    status: transition.nextStatus,
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const event: JournalEventRecord = {
    eventId,
    type: transition.eventType,
    missionId: mission.id,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: updatedMission,
      previousStatus: mission.status,
      nextStatus: updatedMission.status,
      trigger: "operator",
      ...(options.reason ? { reason: options.reason } : {}),
    },
  };

  await appendEvent(layout.journalPath, event);

  const missionLocation = await repository.save(updatedMission);

  await writeProjectionSnapshot(
    layout.projectionsDir,
    "mission-status",
    createMissionStatusProjection(updatedMission),
  );
  const ticketRepository = createFileTicketRepository(layout);
  const artifactRepository = createFileArtifactRepository(layout);
  const missionEvents = (await readEventLog(layout.journalPath))
    .filter((journalEvent) => journalEvent.missionId === updatedMission.id);

  await writeProjectionSnapshot(
    layout.projectionsDir,
    "audit-log",
    createAuditLogProjection({
      mission: updatedMission,
      tickets: await ticketRepository.listByMissionId(updatedMission.id),
      artifacts: await artifactRepository.listByMissionId(updatedMission.id),
      events: missionEvents,
    }),
  );

  const resumeResult = await readMissionResume({
    rootDir: layout.rootDir,
    missionId: updatedMission.id,
    commandName: "resume",
  });

  return {
    mission: updatedMission,
    event,
    missionDir: missionLocation.missionDir,
    missionPath: missionLocation.missionPath,
    resume: resumeResult.resume,
  };
}

function resolveLifecycleTransition(
  currentStatus: MissionStatus,
  action: MissionLifecycleAction,
  outcome?: MissionCloseOutcome,
): LifecycleTransitionDefinition {
  if (action === "close") {
    if (!outcome) {
      throw new Error("L'option --outcome est obligatoire pour `corp mission close`.");
    }

    const transition = CLOSE_TRANSITIONS[outcome];

    return ensureAllowedTransition(currentStatus, action, transition);
  }

  return ensureAllowedTransition(currentStatus, action, LIFECYCLE_TRANSITIONS[action]);
}

function ensureAllowedTransition(
  currentStatus: MissionStatus,
  action: MissionLifecycleAction,
  transition: LifecycleTransitionDefinition,
): LifecycleTransitionDefinition {
  if (!transition.allowedStatuses.includes(currentStatus)) {
    throw new Error(
      `La transition \`${action}\` est interdite depuis le statut \`${currentStatus}\`.`,
    );
  }

  return transition;
}

async function ensureMissionWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: MissionLifecycleAction,
): Promise<void> {
  try {
    await access(layout.journalPath);

    for (const projectionName of Object.keys(DEFAULT_PROJECTIONS)) {
      if (projectionName === "resume-view") {
        continue;
      }

      await access(resolveProjectionPath(layout.projectionsDir, projectionName));
    }
  } catch {
    throw new Error(
      `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`,
    );
  }
}
