import { access } from "node:fs/promises";

import type { ApprovalQueueEntry } from "../../../contracts/src/approval/approval-request";
import type { Mission } from "../../../contracts/src/mission/mission";
import { EventLogReadError, isEventLogReadError } from "../../../journal/src/event-log/event-log-errors";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import { readMissionSnapshotFromJournalOrThrow } from "../../../journal/src/reconstruction/mission-reconstruction";
import {
  createApprovalQueueProjection,
  type ApprovalQueueProjection,
} from "../../../journal/src/projections/approval-queue-projection";
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
import {
  isPersistedDocumentReadError,
  isRecoverablePersistedDocumentError,
} from "../../../storage/src/repositories/persisted-document-errors";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";

export interface ReadApprovalQueueOptions {
  rootDir: string;
  missionId: string;
  commandName:
    | "approval queue"
    | "approval approve"
    | "approval reject"
    | "approval defer"
    | "resume"
    | "status"
    | "compare"
    | "compare relaunch";
}

export interface ReadApprovalQueueResult {
  mission: Mission;
  approvals: ApprovalQueueEntry[];
  reconstructed: boolean;
  projectionPath: string;
}

export async function readApprovalQueue(
  options: ReadApprovalQueueOptions,
): Promise<ReadApprovalQueueResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureApprovalQueueWorkspaceInitialized(layout, options.commandName);

  const missionSnapshotResult = await readMissionSnapshotForApprovalQueue(
    layout,
    options.missionId,
  );
  const missionSnapshot = missionSnapshotResult.mission;

  const projectionPath = resolveProjectionPath(layout.projectionsDir, "approval-queue");

  try {
    const missionEvents = (await readEventLog(layout.journalPath))
      .filter((event) => event.missionId === missionSnapshot.id);
    const rebuiltProjection = createApprovalQueueProjection({
      missionId: missionSnapshot.id,
      events: missionEvents,
    });
    const storedProjection = await readStoredApprovalQueue(layout.projectionsDir);

    if (!storedProjection || !deepStrictEqualForComparison(storedProjection, rebuiltProjection)) {
      await writeProjectionSnapshot(layout.projectionsDir, "approval-queue", rebuiltProjection);

      return {
        mission: missionSnapshot,
        approvals: rebuiltProjection.approvals,
        reconstructed: true,
        projectionPath,
      };
    }

    return {
      mission: missionSnapshot,
      approvals: storedProjection.approvals,
      reconstructed: missionSnapshotResult.reconstructed,
      projectionPath,
    };
  } catch (error) {
    if (isClassifiedReadError(error)) {
      throw error;
    }

    if (isFileSystemReadError(error)) {
      throw createFileSystemReadError(error, projectionPath, "projection approval-queue");
    }

    throw new Error(
      formatApprovalQueueReadError(options.missionId, options.commandName),
    );
  }
}

async function ensureApprovalQueueWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: ReadApprovalQueueOptions["commandName"],
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

async function readStoredApprovalQueue(
  projectionsDir: string,
): Promise<ApprovalQueueProjection | null> {
  try {
    return JSON.parse(await readProjectionFile(projectionsDir, "approval-queue")) as ApprovalQueueProjection;
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

function formatApprovalQueueReadError(
  missionId: string,
  commandName: ReadApprovalQueueOptions["commandName"],
): string {
  if (commandName === "approval queue") {
    return `Projection approval-queue irreconciliable pour ${missionId}. Impossible d'afficher la file d'approbation.`;
  }

  if (commandName.startsWith("approval ")) {
    return `Projection approval-queue irreconciliable pour ${missionId}. Impossible de resoudre la validation.`;
  }

  return `Projection approval-queue irreconciliable pour ${missionId}. Impossible d'afficher la mission.`;
}

async function readMissionSnapshotForApprovalQueue(
  layout: WorkspaceLayout,
  missionId: string,
): Promise<{ mission: Mission; reconstructed: boolean }> {
  const missionRepository = createFileMissionRepository(layout);

  try {
    const mission = await missionRepository.findById(missionId);

    if (mission) {
      return { mission, reconstructed: false };
    }
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }
  }

  return {
    mission: await readMissionSnapshotFromJournalOrThrow(layout.journalPath, missionId),
    reconstructed: true,
  };
}

function isClassifiedReadError(error: unknown): boolean {
  return isEventLogReadError(error) || isPersistedDocumentReadError(error);
}
