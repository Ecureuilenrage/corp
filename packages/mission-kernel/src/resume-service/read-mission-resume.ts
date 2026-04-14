import { access } from "node:fs/promises";

import { TERMINAL_APPROVAL_REQUEST_STATUSES } from "../../../contracts/src/approval/approval-request";
import {
  hydrateMission,
  type Mission,
} from "../../../contracts/src/mission/mission";
import type {
  MissionResume,
  MissionResumeArtifact,
  MissionResumeBlockage,
} from "../../../contracts/src/mission/mission-resume";
import { TERMINAL_TICKET_STATUSES } from "../../../contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import type { TicketBoardProjection } from "../../../journal/src/projections/ticket-board-projection";
import {
  createMissionResume,
  createResumeViewProjection,
  type ResumeViewProjection,
} from "../../../journal/src/projections/resume-view-projection";
import {
  readProjectionFile,
  resolveProjectionPath,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import {
  resolveWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { readTicketBoard } from "../../../ticket-runtime/src/planner/read-ticket-board";
import { readApprovalQueue } from "./read-approval-queue";
import { readMissionArtifacts } from "./read-mission-artifacts";

export interface ReadMissionResumeOptions {
  rootDir: string;
  missionId: string;
  commandName: "status" | "resume" | "compare" | "compare relaunch";
}

export interface ReadMissionResumeResult {
  resume: MissionResume;
  reconstructed: boolean;
  resumeProjectionPath: string;
  ticketBoard: TicketBoardProjection;
  ticketBoardReconstructed: boolean;
}

const CLOSED_OPEN_TICKET_STATUSES = new Set<string>([
  ...TERMINAL_TICKET_STATUSES,
]);

const TERMINAL_APPROVAL_STATUS_SET = new Set<string>(
  TERMINAL_APPROVAL_REQUEST_STATUSES,
);

export async function readMissionResume(
  options: ReadMissionResumeOptions,
): Promise<ReadMissionResumeResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, options.commandName);

  const repository = createFileMissionRepository(layout);
  const storedMission = await repository.findById(options.missionId);

  if (!storedMission) {
    throw new Error(`Mission introuvable: ${options.missionId}.`);
  }
  const ticketBoardResult = await readTicketBoard({
    rootDir: layout.rootDir,
    missionId: options.missionId,
    commandName: options.commandName,
  });
  const approvalQueueResult = await readApprovalQueue({
    rootDir: layout.rootDir,
    missionId: options.missionId,
    commandName: options.commandName,
  });
  const artifactIndexResult = await readMissionArtifacts({
    rootDir: layout.rootDir,
    missionId: options.missionId,
    commandName: options.commandName,
  });

  const missionEvents = await readMissionEvents(layout.journalPath, options.missionId);
  const lastMissionEvent = missionEvents.at(-1);

  if (!lastMissionEvent) {
    throw new Error(
      `Journal mission irreconciliable pour ${options.missionId}. Impossible de reconstruire la reprise.`,
    );
  }

  const projectionPath = resolveProjectionPath(layout.projectionsDir, "resume-view");
  const rawResumeView = await readStoredResumeView(layout.projectionsDir);
  const shouldReconstruct = isMissionSnapshotSuspicious(storedMission, lastMissionEvent.eventId)
    || approvalQueueResult.reconstructed
    || ticketBoardResult.reconstructed
    || artifactIndexResult.reconstructed
    || isResumeViewSuspicious(
      rawResumeView,
      options.missionId,
      lastMissionEvent.eventId,
    );
  const mission = shouldReconstruct
    ? reconstructMissionFromJournal(missionEvents, options.missionId)
    : storedMission;
  const resume = buildMissionResume({
    mission,
    missionEvents,
    ticketBoardProjection: ticketBoardResult.board,
    pendingApprovals: approvalQueueResult.approvals,
    artifactIndexArtifacts: artifactIndexResult.artifacts,
    lastMissionEvent,
  });

  if (shouldReconstruct) {
    await writeProjectionSnapshot(
      layout.projectionsDir,
      "resume-view",
      createResumeViewProjection(mission, {
        openTickets: resume.openTickets,
        pendingApprovals: resume.pendingApprovals,
        lastRelevantArtifact: resume.lastRelevantArtifact,
        lastKnownBlockage: resume.lastKnownBlockage,
        lastEventId: resume.lastEventId,
        updatedAt: resume.updatedAt,
        nextOperatorAction: resume.nextOperatorAction,
      }),
    );

    return {
      resume,
      reconstructed: true,
      resumeProjectionPath: projectionPath,
      ticketBoard: ticketBoardResult.board,
      ticketBoardReconstructed: ticketBoardResult.reconstructed,
    };
  }

  return {
    resume,
    reconstructed: false,
    resumeProjectionPath: projectionPath,
    ticketBoard: ticketBoardResult.board,
    ticketBoardReconstructed: ticketBoardResult.reconstructed,
  };
}

async function ensureMissionWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: "status" | "resume" | "compare" | "compare relaunch",
): Promise<void> {
  try {
    await access(layout.journalPath);
    await access(layout.projectionsDir);
    await access(layout.missionsDir);
  } catch {
    throw new Error(
      `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`,
    );
  }
}

async function readMissionEvents(
  journalPath: string,
  missionId: string,
): Promise<JournalEventRecord[]> {
  try {
    return (await readEventLog(journalPath)).filter((event) => event.missionId === missionId);
  } catch {
    throw new Error(
      `Journal mission irreconciliable pour ${missionId}. Impossible de reconstruire la reprise.`,
    );
  }
}

async function readStoredResumeView(
  projectionsDir: string,
): Promise<ResumeViewProjection | null> {
  try {
    return JSON.parse(await readProjectionFile(projectionsDir, "resume-view")) as ResumeViewProjection;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

function isResumeViewSuspicious(
  projection: ResumeViewProjection | null,
  missionId: string,
  lastEventId: string,
): boolean {
  if (!projection) {
    return true;
  }

  if (projection.schemaVersion !== 1) {
    return true;
  }

  if (!projection.resume) {
    return true;
  }

  if (!isMissionResume(projection.resume)) {
    return true;
  }

  return projection.resume.missionId !== missionId
    || projection.resume.lastEventId !== lastEventId;
}

function buildMissionResume(options: {
  mission: Mission;
  missionEvents: JournalEventRecord[];
  ticketBoardProjection: TicketBoardProjection;
  pendingApprovals: MissionResume["pendingApprovals"];
  artifactIndexArtifacts: MissionResumeArtifact[];
  lastMissionEvent: JournalEventRecord;
}): MissionResume {
  const openTickets = filterMissionEntities(
    options.ticketBoardProjection.tickets,
    options.mission.id,
    (ticketStatus) =>
      !CLOSED_OPEN_TICKET_STATUSES.has(ticketStatus),
  );
  const pendingApprovals = filterMissionEntities(
    options.pendingApprovals,
    options.mission.id,
    (approvalStatus) => !TERMINAL_APPROVAL_STATUS_SET.has(approvalStatus),
  );
  const lastRelevantArtifact = selectLastArtifact(
    options.artifactIndexArtifacts,
    options.mission.id,
  );

  return createMissionResume(options.mission, {
    openTickets,
    pendingApprovals,
    lastRelevantArtifact,
    ticketBoardEntries: options.ticketBoardProjection.tickets,
    missionEvents: options.missionEvents,
    lastEventId: options.lastMissionEvent.eventId,
    updatedAt: pickLatestTimestamp([
      options.mission.updatedAt,
      options.lastMissionEvent.occurredAt,
    ]),
    hasFailedTickets: options.ticketBoardProjection.tickets.some((ticket) => ticket.status === "failed"),
  });
}

function isMissionSnapshotSuspicious(mission: Mission, lastEventId: string): boolean {
  return mission.resumeCursor !== lastEventId;
}

function reconstructMissionFromJournal(
  missionEvents: JournalEventRecord[],
  missionId: string,
): Mission {
  let reconstructedMission: Mission | null = null;

  for (const event of missionEvents) {
    const payloadMission = (event.payload as Record<string, unknown>).mission;

    if (isMission(payloadMission) && payloadMission.id === missionId) {
      reconstructedMission = hydrateMission(payloadMission);
    }
  }

  if (!reconstructedMission) {
    throw new Error(
      `Journal mission irreconciliable pour ${missionId}. Impossible de reconstruire la reprise.`,
    );
  }

  return reconstructedMission;
}

function filterMissionEntities<T extends object>(
  entities: T[],
  missionId: string,
  isPendingStatus: (status: string) => boolean,
): T[] {
  return entities.filter((entity) => {
    const entityRecord = entity as Record<string, unknown>;
    const entityMissionId = readOptionalString(entityRecord, "missionId");

    if (entityMissionId && entityMissionId !== missionId) {
      return false;
    }

    const status = readOptionalString(entityRecord, "status");

    return !status || isPendingStatus(status);
  });
}

function selectLastArtifact(
  artifacts: MissionResumeArtifact[],
  missionId: string,
): MissionResumeArtifact | null {
  const missionArtifacts = artifacts.filter((artifact) => {
    const entityMissionId = readOptionalString(artifact, "missionId");
    return entityMissionId === missionId;
  });

  return missionArtifacts.at(-1) ?? null;
}

function pickLatestTimestamp(timestamps: string[]): string {
  return [...timestamps].sort((left, right) => left.localeCompare(right)).at(-1)
    ?? timestamps[0]
    ?? new Date(0).toISOString();
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : undefined;
}

function isMissionResume(value: unknown): value is MissionResume {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.missionId === "string"
    && typeof candidate.title === "string"
    && typeof candidate.objective === "string"
    && typeof candidate.status === "string"
    && Array.isArray(candidate.successCriteria)
    && candidate.successCriteria.every((criterion) => typeof criterion === "string")
    && isAuthorizedExtensions(candidate.authorizedExtensions)
    && Array.isArray(candidate.openTickets)
    && Array.isArray(candidate.pendingApprovals)
    && (candidate.lastRelevantArtifact === null || isRecord(candidate.lastRelevantArtifact))
    && (
      !("lastKnownBlockage" in candidate)
      || candidate.lastKnownBlockage === undefined
      || candidate.lastKnownBlockage === null
      || isMissionResumeBlockage(candidate.lastKnownBlockage)
    )
    && typeof candidate.lastEventId === "string"
    && typeof candidate.updatedAt === "string"
    && typeof candidate.nextOperatorAction === "string";
}

function isMissionResumeBlockage(
  value: unknown,
): value is MissionResumeBlockage {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.kind === "string"
    && typeof value.summary === "string"
    && typeof value.missionStatus === "string"
    && typeof value.occurredAt === "string"
    && isOptionalString(value.reasonCode)
    && isOptionalString(value.ticketId)
    && isOptionalString(value.attemptId)
    && isOptionalString(value.approvalId)
    && (
      value.sourceEventId === undefined
      || value.sourceEventId === null
      || typeof value.sourceEventId === "string"
    );
}

function isMission(value: unknown): value is Mission {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && typeof candidate.objective === "string"
    && typeof candidate.status === "string"
    && Array.isArray(candidate.successCriteria)
    && candidate.successCriteria.every((criterion) => typeof criterion === "string")
    && typeof candidate.policyProfileId === "string"
    && (
      candidate.authorizedExtensions === undefined
      || isAuthorizedExtensions(candidate.authorizedExtensions)
    )
    && Array.isArray(candidate.ticketIds)
    && Array.isArray(candidate.artifactIds)
    && Array.isArray(candidate.eventIds)
    && typeof candidate.resumeCursor === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string";
}

function isAuthorizedExtensions(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.allowedCapabilities)
    && value.allowedCapabilities.every((entry) => typeof entry === "string")
    && Array.isArray(value.skillPackRefs)
    && value.skillPackRefs.every((entry) => typeof entry === "string");
}

function isOptionalString(
  value: unknown,
): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
