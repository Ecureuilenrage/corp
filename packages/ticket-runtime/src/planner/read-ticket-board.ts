import { access } from "node:fs/promises";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
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
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileExecutionAttemptRepository } from "../../../storage/src/repositories/file-execution-attempt-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
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

const FILE_SYSTEM_ERROR_CODES = new Set(["ENOENT", "EPERM", "EMFILE", "ENOSPC"]);

export async function readTicketBoard(
  options: ReadTicketBoardOptions,
): Promise<ReadTicketBoardResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureTicketBoardWorkspaceInitialized(layout, options.commandName);

  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const mission = await missionRepository.findById(options.missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${options.missionId}.`);
  }

  const projectionPath = resolveProjectionPath(layout.projectionsDir, "ticket-board");

  try {
    const missionTickets = await ticketRepository.listByMissionId(mission.id);
    const missionAttempts = await listMissionAttempts(mission, attemptRepository);
    const missionEvents = (await readEventLog(layout.journalPath))
      .filter((event) => event.missionId === mission.id);
    const rebuiltBoard = buildTicketBoardProjection(
      mission,
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
        mission,
        board: rebuiltBoard,
        reconstructed: true,
        projectionPath,
      };
    }

    return {
      mission,
      board: storedBoard,
      reconstructed: false,
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

async function ensureTicketBoardWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: "status" | "resume" | "ticket board" | "compare" | "compare relaunch",
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

  if (isFileSystemError(error)) {
    return new Error(`Erreur fichier: ${error.message}`);
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

function isFileSystemError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && FILE_SYSTEM_ERROR_CODES.has(error.code);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
