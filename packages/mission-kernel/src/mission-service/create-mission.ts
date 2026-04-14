import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import {
  createEmptyMissionAuthorizedExtensions,
  type Mission,
} from "../../../contracts/src/mission/mission";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { createAuditLogProjection } from "../../../journal/src/projections/audit-log-projection";
import { DEFAULT_PROJECTIONS } from "../../../journal/src/projections/default-projections";
import { createMissionStatusProjection } from "../../../journal/src/projections/mission-status-projection";
import { createResumeViewProjection } from "../../../journal/src/projections/resume-view-projection";
import {
  resolveProjectionPath,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import {
  resolveWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";

export interface CreateMissionOptions {
  rootDir: string;
  title?: string;
  objective?: string;
  successCriteria: string[];
  policyProfileId?: string;
}

export interface CreateMissionResult {
  mission: Mission;
  missionDir: string;
  missionPath: string;
  event: JournalEventRecord;
}

export async function createMission(
  options: CreateMissionOptions,
): Promise<CreateMissionResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout);

  const title = requireText(options.title, "Le titre de mission est obligatoire.");
  const objective = requireText(
    options.objective,
    "L'objectif de mission est obligatoire.",
  );
  const successCriteria = requireSuccessCriteria(options.successCriteria);
  const policyProfileId = requireText(
    options.policyProfileId,
    "Le policy profile initial est obligatoire.",
  );

  const occurredAt = new Date().toISOString();
  const missionId = `mission_${randomUUID()}`;
  const eventId = `event_${randomUUID()}`;

  const mission: Mission = {
    id: missionId,
    title,
    objective,
    status: "ready",
    successCriteria,
    policyProfileId,
    authorizedExtensions: createEmptyMissionAuthorizedExtensions(),
    ticketIds: [],
    artifactIds: [],
    eventIds: [eventId],
    resumeCursor: eventId,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  const event: JournalEventRecord = {
    eventId,
    type: "mission.created",
    missionId,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission,
    },
  };

  await appendEvent(layout.journalPath, event);

  const repository = createFileMissionRepository(layout);
  const missionLocation = await repository.save(mission);

  await writeProjectionSnapshot(
    layout.projectionsDir,
    "mission-status",
    createMissionStatusProjection(mission),
  );
  await writeProjectionSnapshot(
    layout.projectionsDir,
    "resume-view",
    createResumeViewProjection(mission),
  );
  await writeProjectionSnapshot(
    layout.projectionsDir,
    "audit-log",
    createAuditLogProjection({
      mission,
      tickets: [],
      artifacts: [],
      events: [event],
    }),
  );

  return {
    mission,
    missionDir: missionLocation.missionDir,
    missionPath: missionLocation.missionPath,
    event,
  };
}

async function ensureMissionWorkspaceInitialized(layout: WorkspaceLayout): Promise<void> {
  try {
    await access(layout.journalPath);

    for (const projectionName of Object.keys(DEFAULT_PROJECTIONS)) {
      await access(resolveProjectionPath(layout.projectionsDir, projectionName));
    }
  } catch {
    throw new Error(
      `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission create\`.`,
    );
  }
}

function requireText(value: string | undefined, errorMessage: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
}

function requireSuccessCriteria(successCriteria: string[]): string[] {
  const normalizedCriteria = successCriteria
    .map((criterion) => criterion.trim())
    .filter((criterion) => criterion.length > 0);

  if (normalizedCriteria.length === 0) {
    throw new Error("Au moins un critere de succes est obligatoire.");
  }

  return normalizedCriteria;
}
