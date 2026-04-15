import { randomUUID } from "node:crypto";

import {
  createEmptyMissionAuthorizedExtensions,
  type Mission,
} from "../../../contracts/src/mission/mission";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import {
  resolveWorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { rewriteMissionReadModels } from "../../../ticket-runtime/src/ticket-service/ticket-service-support";
import { ensureMissionWorkspaceInitialized } from "./ensure-mission-workspace";

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
  await ensureMissionWorkspaceInitialized(layout, { commandLabel: "create" });

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
  const ticketRepository = createFileTicketRepository(layout);

  await rewriteMissionReadModels(layout, mission, ticketRepository);

  return {
    mission,
    missionDir: missionLocation.missionDir,
    missionPath: missionLocation.missionPath,
    event,
  };
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
