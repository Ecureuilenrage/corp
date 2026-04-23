import { access } from "node:fs/promises";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { EventLogReadError, isEventLogReadError } from "../../../journal/src/event-log/event-log-errors";
import {
  getLastAuthoritativeMissionCursor,
  readMissionEvents,
  reconstructAttemptsFromJournal,
  reconstructMissionFromJournal,
  reconstructTicketsFromJournal,
  type MissionAuthoritativeCursor,
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

interface TicketBoardDependencies {
  readMissionEvents: typeof readMissionEvents;
}

const DEFAULT_TICKET_BOARD_DEPENDENCIES: TicketBoardDependencies = {
  readMissionEvents,
};

let ticketBoardDependenciesForTesting: Partial<TicketBoardDependencies> | null = null;

export function setReadTicketBoardDependenciesForTesting(
  dependencies: Partial<TicketBoardDependencies> | null,
): void {
  ticketBoardDependenciesForTesting = dependencies;
}

export async function readTicketBoard(
  options: ReadTicketBoardOptions,
): Promise<ReadTicketBoardResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureTicketBoardWorkspaceInitialized(layout, options.commandName);

  const projectionPath = resolveProjectionPath(layout.projectionsDir, "ticket-board");

  try {
    const missionRepository = createFileMissionRepository(layout);
    const ticketRepository = createFileTicketRepository(layout);
    const attemptRepository = createFileExecutionAttemptRepository(layout);
    const storedMissionResult = await readStoredMissionSnapshot(
      missionRepository,
      options.missionId,
    );
    const storedMission = storedMissionResult.mission;
    const missionEvents = await readMissionEventsSafely(layout, options.missionId);
    const missionFromJournal = missionEvents.length > 0
      ? reconstructMissionFromJournal(missionEvents, options.missionId)
      : null;

    if (!storedMission && !missionFromJournal) {
      throw new Error(`Mission introuvable: ${options.missionId}.`);
    }

    const missionSnapshot = selectFreshMissionSnapshot(
      storedMission,
      missionFromJournal,
      getLastAuthoritativeMissionCursor(missionEvents),
    );
    const storedTickets = await readStoredTicketsForBoard(
      ticketRepository,
      missionSnapshot.id,
    );
    const journalTickets = reconstructTicketsFromJournal(missionEvents, missionSnapshot.id);
    const journalTicketCursors = buildTicketCursors(missionEvents, missionSnapshot.id);
    const mergedTickets = mergeTicketsById(
      storedTickets.tickets,
      journalTickets,
      journalTicketCursors,
    );
    const missionTickets = mergedTickets.tickets;
    const storedAttempts = await readStoredAttemptsForBoard(
      missionSnapshot,
      attemptRepository,
    );
    const journalAttempts = reconstructAttemptsFromJournal(missionEvents, missionSnapshot.id);
    const journalAttemptCursors = buildAttemptCursors(missionEvents, missionSnapshot.id);
    const missionAttempts = mergeAttemptsById(
      storedAttempts.attempts,
      journalAttempts,
      mergedTickets.usedJournalSnapshot
        || missionSnapshot === missionFromJournal
        || storedMissionResult.recovered
        || storedTickets.recovered
        || storedAttempts.recovered,
      journalAttemptCursors,
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

export function selectFreshMissionSnapshot(
  storedMission: Mission | null,
  missionFromJournal: Mission | null,
  lastAuthoritativeCursor: MissionAuthoritativeCursor | null,
): Mission {
  if (!storedMission) {
    if (!missionFromJournal) {
      throw new Error("Mission introuvable.");
    }

    return missionFromJournal;
  }

  if (!missionFromJournal || !lastAuthoritativeCursor) {
    return storedMission;
  }

  return compareMissionFreshness(
    toStoredMissionCursor(storedMission),
    lastAuthoritativeCursor,
  ) < 0
    ? missionFromJournal
    : storedMission;
}

export function mergeTicketsById(
  storedTickets: Ticket[],
  journalTickets: Ticket[],
  journalTicketCursors: ReadonlyMap<string, MissionAuthoritativeCursor> = new Map(),
): { tickets: Ticket[]; usedJournalSnapshot: boolean } {
  const ticketsById = new Map(storedTickets.map((ticket) => [ticket.id, ticket] as const));
  let usedJournalSnapshot = false;

  for (const ticket of journalTickets) {
    const storedTicket = ticketsById.get(ticket.id);

    if (!storedTicket || isJournalTicketNewer(storedTicket, ticket, journalTicketCursors)) {
      ticketsById.set(ticket.id, ticket);
      usedJournalSnapshot = true;
    }
  }

  return {
    tickets: [...ticketsById.values()],
    usedJournalSnapshot,
  };
}

function isJournalTicketNewer(
  storedTicket: Ticket,
  journalTicket: Ticket,
  journalTicketCursors: ReadonlyMap<string, MissionAuthoritativeCursor>,
): boolean {
  const storedEventIds = new Set(storedTicket.eventIds);
  const hasUnseenJournalEvent = journalTicket.eventIds.some((eventId) => !storedEventIds.has(eventId));

  if (!hasUnseenJournalEvent) {
    return false;
  }

  return compareMissionFreshness(
    toStoredTicketCursor(storedTicket),
    toJournalTicketCursor(journalTicket, journalTicketCursors),
  ) < 0;
}

export function mergeAttemptsById(
  storedAttempts: ExecutionAttempt[],
  journalAttempts: ExecutionAttempt[],
  preferJournalSnapshots: boolean,
  journalAttemptCursors: ReadonlyMap<string, MissionAuthoritativeCursor> = new Map(),
): ExecutionAttempt[] {
  const attemptsById = new Map(storedAttempts.map((attempt) => [attempt.id, attempt] as const));

  for (const attempt of journalAttempts) {
    const storedAttempt = attemptsById.get(attempt.id);

    if (
      preferJournalSnapshots
      || !storedAttempt
      || isJournalAttemptNewer(storedAttempt, attempt, journalAttemptCursors)
    ) {
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

export function normalizeTicketBoardReadError(
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

  if (isClassifiedReadError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  if (error instanceof Error && error.message.startsWith("Mission introuvable: ")) {
    return error;
  }

  if (isFileSystemReadError(error)) {
    return createFileSystemReadError(error, options.projectionPath, "projection ticket-board");
  }

  if (error instanceof SyntaxError) {
    return createProjectionCorruptionError(options.projectionPath, error);
  }

  return new Error(
    formatTicketBoardReadError(options.missionId, options.commandName),
    { cause: error },
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

function isClassifiedReadError(error: unknown): boolean {
  return isEventLogReadError(error) || isPersistedDocumentReadError(error);
}

function getTicketBoardDependencies(): TicketBoardDependencies {
  return {
    ...DEFAULT_TICKET_BOARD_DEPENDENCIES,
    ...ticketBoardDependenciesForTesting,
  };
}

async function readMissionEventsSafely(
  layout: WorkspaceLayout,
  missionId: string,
): Promise<Awaited<ReturnType<typeof readMissionEvents>>> {
  try {
    return await getTicketBoardDependencies().readMissionEvents(layout.journalPath, missionId);
  } catch (error) {
    if (isClassifiedReadError(error)) {
      throw error;
    }

    if (isFileSystemReadError(error)) {
      throw EventLogReadError.fileSystem(layout.journalPath, error);
    }

    throw error;
  }
}

function toStoredMissionCursor(mission: Mission): MissionAuthoritativeCursor {
  return {
    occurredAt: mission.updatedAt,
    eventId: mission.resumeCursor,
  };
}

function toStoredTicketCursor(ticket: Ticket): MissionAuthoritativeCursor {
  return {
    occurredAt: ticket.updatedAt,
    eventId: ticket.eventIds.at(-1) ?? "",
  };
}

function toJournalTicketCursor(
  ticket: Ticket,
  journalTicketCursors: ReadonlyMap<string, MissionAuthoritativeCursor>,
): MissionAuthoritativeCursor {
  return journalTicketCursors.get(ticket.id) ?? toStoredTicketCursor(ticket);
}

function isJournalAttemptNewer(
  storedAttempt: ExecutionAttempt,
  journalAttempt: ExecutionAttempt,
  journalAttemptCursors: ReadonlyMap<string, MissionAuthoritativeCursor>,
): boolean {
  return compareMissionFreshness(
    toStoredAttemptCursor(storedAttempt),
    toJournalAttemptCursor(journalAttempt, journalAttemptCursors),
  ) < 0;
}

function toStoredAttemptCursor(attempt: ExecutionAttempt): MissionAuthoritativeCursor {
  return {
    occurredAt: getAttemptFreshnessTimestamp(attempt),
    eventId: "",
  };
}

function toJournalAttemptCursor(
  attempt: ExecutionAttempt,
  journalAttemptCursors: ReadonlyMap<string, MissionAuthoritativeCursor>,
): MissionAuthoritativeCursor {
  return journalAttemptCursors.get(attempt.id) ?? toStoredAttemptCursor(attempt);
}

function getAttemptFreshnessTimestamp(attempt: ExecutionAttempt): string {
  return attempt.endedAt ?? attempt.startedAt;
}

function compareMissionFreshness(
  left: MissionAuthoritativeCursor,
  right: MissionAuthoritativeCursor,
): number {
  const occurredAtComparison = left.occurredAt.localeCompare(right.occurredAt);

  if (occurredAtComparison !== 0) {
    return occurredAtComparison;
  }

  return left.eventId.localeCompare(right.eventId);
}

function buildTicketCursors(
  missionEvents: Awaited<ReturnType<typeof readMissionEvents>>,
  missionId: string,
): Map<string, MissionAuthoritativeCursor> {
  const ticketCursors = new Map<string, MissionAuthoritativeCursor>();

  for (const event of missionEvents) {
    if (event.missionId !== missionId || typeof event.ticketId !== "string") {
      continue;
    }

    ticketCursors.set(event.ticketId, {
      occurredAt: event.occurredAt,
      eventId: event.eventId,
    });
  }

  return ticketCursors;
}

function buildAttemptCursors(
  missionEvents: Awaited<ReturnType<typeof readMissionEvents>>,
  missionId: string,
): Map<string, MissionAuthoritativeCursor> {
  const attemptCursors = new Map<string, MissionAuthoritativeCursor>();

  for (const event of missionEvents) {
    if (event.missionId !== missionId || typeof event.attemptId !== "string") {
      continue;
    }

    attemptCursors.set(event.attemptId, {
      occurredAt: event.occurredAt,
      eventId: event.eventId,
    });
  }

  return attemptCursors;
}
