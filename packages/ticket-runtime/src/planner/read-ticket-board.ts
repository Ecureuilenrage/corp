import { access } from "node:fs/promises";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { EventLogReadError, isEventLogReadError } from "../../../journal/src/event-log/event-log-errors";
import {
  readMissionEvents,
  reconstructAttemptsFromJournal,
  reconstructMissionFromJournal,
  reconstructTicketsFromJournal,
} from "../../../journal/src/reconstruction/mission-reconstruction";
import type { TicketBoardProjection } from "../../../journal/src/projections/ticket-board-projection";
import {
  readProjectionFile,
  resolveProjectionPath,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import {
  resolveWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import {
  createFileSystemReadError,
  isFileSystemReadError,
  isMissingFileError,
  readAccessError,
} from "../../../storage/src/fs-layout/file-system-read-errors";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileExecutionAttemptRepository } from "../../../storage/src/repositories/file-execution-attempt-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import {
  isPersistedDocumentReadError,
  isRecoverablePersistedDocumentError,
} from "../../../storage/src/repositories/persisted-document-errors";
import { buildTicketBoardProjection } from "./build-ticket-board";
import { deepStrictEqualForComparison } from "../utils/structural-compare";

export interface ReadTicketBoardOptions {
  rootDir: string;
  missionId: string;
  commandName: "status" | "resume" | "ticket board" | "compare" | "compare relaunch";
}

export interface ReadTicketBoardResult {
  mission: Mission;
  board: TicketBoardProjection;
  reconstructed: boolean;
  projectionPath: string;
}

export async function readTicketBoard(
  options: ReadTicketBoardOptions,
): Promise<ReadTicketBoardResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureTicketBoardWorkspaceInitialized(layout, options.commandName);

  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const storedMissionResult = await readStoredMissionSnapshot(
    missionRepository,
    options.missionId,
  );
  const storedMission = storedMissionResult.mission;
  const missionEvents = await readMissionEvents(layout.journalPath, options.missionId);
  const missionFromJournal = missionEvents.length > 0
    ? reconstructMissionFromJournal(missionEvents, options.missionId)
    : null;

  if (!storedMission && !missionFromJournal) {
    throw new Error(`Mission introuvable: ${options.missionId}.`);
  }

  const missionSnapshot = selectFreshMissionSnapshot(
    storedMission,
    missionFromJournal,
    missionEvents.at(-1)?.eventId,
  );

  const projectionPath = resolveProjectionPath(layout.projectionsDir, "ticket-board");

  try {
    const storedTickets = await readStoredTicketsForBoard(
      ticketRepository,
      missionSnapshot.id,
    );
    const journalTickets = reconstructTicketsFromJournal(missionEvents, missionSnapshot.id);
    const mergedTickets = mergeTicketsById(
      storedTickets.tickets,
      journalTickets,
    );
    const missionTickets = mergedTickets.tickets;
    const storedAttempts = await readStoredAttemptsForBoard(
      missionSnapshot,
      attemptRepository,
    );
    const missionAttempts = mergeAttemptsById(
      storedAttempts.attempts,
      reconstructAttemptsFromJournal(missionEvents),
      mergedTickets.usedJournalSnapshot
        || missionSnapshot === missionFromJournal
        || storedMissionResult.recovered
        || storedTickets.recovered
        || storedAttempts.recovered,
    );
    const rebuiltBoard = buildTicketBoardProjection(
      missionSnapshot,
      missionTickets,
      missionAttempts,
      missionEvents,
    );
    const storedBoard = await readStoredTicketBoard(
      layout.projectionsDir,
      projectionPath,
      options.commandName === "compare" || options.commandName === "compare relaunch",
    );

    if (!storedBoard || !isProjectionUpToDate(storedBoard, rebuiltBoard)) {
      await writeProjectionSnapshot(layout.projectionsDir, "ticket-board", rebuiltBoard);

      return {
        mission: missionSnapshot,
        board: rebuiltBoard,
        reconstructed: true,
        projectionPath,
      };
    }

    return {
      mission: missionSnapshot,
      board: storedBoard,
      reconstructed: storedMissionResult.recovered
        || storedTickets.recovered
        || storedAttempts.recovered,
      projectionPath,
    };
  } catch (error) {
    throw normalizeTicketBoardReadError(error, {
      missionId: options.missionId,
      commandName: options.commandName,
      projectionPath,
    });
  }
}

function selectFreshMissionSnapshot(
  storedMission: Mission | null,
  missionFromJournal: Mission | null,
  lastEventId: string | undefined,
): Mission {
  if (!storedMission) {
    if (!missionFromJournal) {
      throw new Error("Mission introuvable.");
    }

    return missionFromJournal;
  }

  if (missionFromJournal && lastEventId && storedMission.resumeCursor !== lastEventId) {
    return missionFromJournal;
  }

  return storedMission;
}

function mergeTicketsById(
  storedTickets: Ticket[],
  journalTickets: Ticket[],
): { tickets: Ticket[]; usedJournalSnapshot: boolean } {
  const ticketsById = new Map(storedTickets.map((ticket) => [ticket.id, ticket] as const));
  let usedJournalSnapshot = false;

  for (const ticket of journalTickets) {
    const storedTicket = ticketsById.get(ticket.id);

    if (!storedTicket || isJournalTicketNewer(storedTicket, ticket)) {
      ticketsById.set(ticket.id, ticket);
      usedJournalSnapshot = true;
    }
  }

  return {
    tickets: [...ticketsById.values()],
    usedJournalSnapshot,
  };
}

function isJournalTicketNewer(storedTicket: Ticket, journalTicket: Ticket): boolean {
  const storedEventIds = new Set(storedTicket.eventIds);

  return journalTicket.eventIds.some((eventId) => !storedEventIds.has(eventId));
}

function mergeAttemptsById(
  storedAttempts: ExecutionAttempt[],
  journalAttempts: ExecutionAttempt[],
  preferJournalSnapshots: boolean,
): ExecutionAttempt[] {
  const attemptsById = new Map(storedAttempts.map((attempt) => [attempt.id, attempt] as const));

  for (const attempt of journalAttempts) {
    if (preferJournalSnapshots || !attemptsById.has(attempt.id)) {
      attemptsById.set(attempt.id, attempt);
    }
  }

  return [...attemptsById.values()];
}

async function ensureTicketBoardWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: "status" | "resume" | "ticket board" | "compare" | "compare relaunch",
): Promise<void> {
  const journalError = await readAccessError(() => access(layout.journalPath));
  const projectionsError = await readAccessError(() => access(layout.projectionsDir));
  const missionsError = await readAccessError(() => access(layout.missionsDir));

  const fileSystemError = [
    { error: journalError, filePath: layout.journalPath, label: "journal append-only" },
    { error: projectionsError, filePath: layout.projectionsDir, label: "repertoire projections" },
    { error: missionsError, filePath: layout.missionsDir, label: "repertoire missions" },
  ].find((entry) => entry.error && entry.error.code !== "ENOENT" && isFileSystemReadError(entry.error));

  if (fileSystemError?.error) {
    if (fileSystemError.filePath === layout.journalPath) {
      throw EventLogReadError.fileSystem(layout.journalPath, fileSystemError.error);
    }

    throw createFileSystemReadError(
      fileSystemError.error,
      fileSystemError.filePath,
      fileSystemError.label,
    );
  }

  if (journalError?.code === "ENOENT" && !projectionsError && !missionsError) {
    throw EventLogReadError.missing(layout.journalPath, journalError);
  }

  if (journalError || projectionsError || missionsError) {
    throw new Error(
      `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`,
    );
  }
}

async function readStoredMissionSnapshot(
  missionRepository: ReturnType<typeof createFileMissionRepository>,
  missionId: string,
): Promise<{ mission: Mission | null; recovered: boolean }> {
  try {
    return {
      mission: await missionRepository.findById(missionId),
      recovered: false,
    };
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }

    return {
      mission: null,
      recovered: true,
    };
  }
}

async function readStoredTicketsForBoard(
  ticketRepository: ReturnType<typeof createFileTicketRepository>,
  missionId: string,
): Promise<{ tickets: Ticket[]; recovered: boolean }> {
  try {
    return {
      tickets: await ticketRepository.listByMissionId(missionId),
      recovered: false,
    };
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }

    return {
      tickets: [],
      recovered: true,
    };
  }
}

async function readStoredAttemptsForBoard(
  mission: Mission,
  attemptRepository: ReturnType<typeof createFileExecutionAttemptRepository>,
): Promise<{ attempts: ExecutionAttempt[]; recovered: boolean }> {
  try {
    return {
      attempts: await listMissionAttempts(mission, attemptRepository),
      recovered: false,
    };
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }

    return {
      attempts: [],
      recovered: true,
    };
  }
}

async function listMissionAttempts(
  mission: Mission,
  attemptRepository: ReturnType<typeof createFileExecutionAttemptRepository>,
): Promise<ExecutionAttempt[]> {
  const missionAttempts: ExecutionAttempt[] = [];

  for (const ticketId of mission.ticketIds) {
    missionAttempts.push(
      ...(await attemptRepository.listByTicketId(mission.id, ticketId)),
    );
  }

  return missionAttempts;
}

async function readStoredTicketBoard(
  projectionsDir: string,
  projectionPath: string,
  recoverCorruptedProjection: boolean,
): Promise<TicketBoardProjection | null> {
  try {
    return JSON.parse(await readProjectionFile(projectionsDir, "ticket-board")) as TicketBoardProjection;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    if (error instanceof SyntaxError) {
      if (recoverCorruptedProjection) {
        return null;
      }

      throw createProjectionCorruptionError(projectionPath, error);
    }

    throw error;
  }
}

function isProjectionUpToDate(
  storedBoard: TicketBoardProjection,
  rebuiltBoard: TicketBoardProjection,
): boolean {
  return deepStrictEqualForComparison(storedBoard, rebuiltBoard);
}

function formatTicketBoardReadError(
  missionId: string,
  commandName: "status" | "resume" | "ticket board" | "compare" | "compare relaunch",
): string {
  if (commandName === "ticket board") {
    return `Projection ticket-board irreconciliable pour ${missionId}. Impossible d'afficher le board des tickets.`;
  }

  return `Projection ticket-board irreconciliable pour ${missionId}. Impossible d'afficher la mission.`;
}

function normalizeTicketBoardReadError(
  error: unknown,
  options: {
    missionId: string;
    commandName: "status" | "resume" | "ticket board" | "compare" | "compare relaunch";
    projectionPath: string;
  },
): Error {
  if (isProjectionCorruptionError(error)) {
    return error;
  }

  if (isEventLogReadError(error) || isPersistedDocumentReadError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  if (isFileSystemReadError(error)) {
    return createFileSystemReadError(error, options.projectionPath, "projection ticket-board");
  }

  if (error instanceof SyntaxError) {
    return createProjectionCorruptionError(options.projectionPath, error);
  }

  return new Error(
    formatTicketBoardReadError(options.missionId, options.commandName),
  );
}

function createProjectionCorruptionError(
  projectionPath: string,
  cause: SyntaxError,
): Error {
  return Object.assign(
    new Error(`Projection ticket-board corrompue: ${projectionPath}`, { cause }),
    {
      code: "EPROJCORRUPT",
      projectionPath,
    },
  );
}

function isProjectionCorruptionError(
  error: unknown,
): error is Error & { code: "EPROJCORRUPT"; projectionPath: string } {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "EPROJCORRUPT";
}
