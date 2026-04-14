import { access } from "node:fs/promises";

import type { ApprovalQueueEntry } from "../../../contracts/src/approval/approval-request";
import type { Mission } from "../../../contracts/src/mission/mission";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
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
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
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

const FILE_SYSTEM_ERROR_CODES = new Set(["EPERM", "EMFILE", "ENOSPC"]);

export async function readApprovalQueue(
  options: ReadApprovalQueueOptions,
): Promise<ReadApprovalQueueResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureApprovalQueueWorkspaceInitialized(layout, options.commandName);

  const missionRepository = createFileMissionRepository(layout);
  const mission = await missionRepository.findById(options.missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${options.missionId}.`);
  }

  const projectionPath = resolveProjectionPath(layout.projectionsDir, "approval-queue");

  try {
    const missionEvents = (await readEventLog(layout.journalPath))
      .filter((event) => event.missionId === mission.id);
    const rebuiltProjection = createApprovalQueueProjection({
      missionId: mission.id,
      events: missionEvents,
    });
    const storedProjection = await readStoredApprovalQueue(layout.projectionsDir);

    if (!storedProjection || !deepStrictEqualForComparison(storedProjection, rebuiltProjection)) {
      await writeProjectionSnapshot(layout.projectionsDir, "approval-queue", rebuiltProjection);

      return {
        mission,
        approvals: rebuiltProjection.approvals,
        reconstructed: true,
        projectionPath,
      };
    }

    return {
      mission,
      approvals: storedProjection.approvals,
      reconstructed: false,
      projectionPath,
    };
  } catch (error) {
    if (isFileSystemError(error)) {
      throw new Error(`Erreur fichier: ${error.message}`);
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
