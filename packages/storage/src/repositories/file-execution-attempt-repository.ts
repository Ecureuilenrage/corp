import type { Dirent } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { validateExecutionAttempt } from "../../../contracts/src/guards/persisted-document-guards";
import {
  ACTIVE_EXECUTION_ATTEMPT_STATUSES,
  type ExecutionAttempt,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import { writeJsonAtomic } from "../fs-layout/atomic-json";
import { isMissingFileError } from "../fs-layout/file-system-read-errors";
import {
  resolveExecutionAttemptStoragePaths,
  resolveTicketStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";
import {
  assertValidPersistedDocument,
  readPersistedJsonDocument,
} from "./persisted-document-errors";

export interface SaveExecutionAttemptResult {
  attemptsDir: string;
  attemptDir: string;
  attemptPath: string;
}

export class FileExecutionAttemptRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(
    missionId: string,
    attempt: ExecutionAttempt,
  ): Promise<SaveExecutionAttemptResult> {
    const attemptStoragePaths = resolveExecutionAttemptStoragePaths(
      this.layout,
      missionId,
      attempt.ticketId,
      attempt.id,
    );

    await mkdir(attemptStoragePaths.attemptDir, { recursive: true });
    await writeJsonAtomic(attemptStoragePaths.attemptPath, attempt);

    return attemptStoragePaths;
  }

  public async findById(
    missionId: string,
    ticketId: string,
    attemptId: string,
  ): Promise<ExecutionAttempt | null> {
    const attemptStoragePaths = resolveExecutionAttemptStoragePaths(
      this.layout,
      missionId,
      ticketId,
      attemptId,
    );
    const context = {
      filePath: attemptStoragePaths.attemptPath,
      entityLabel: "ExecutionAttempt",
      documentId: attemptId,
    };

    try {
      const storedAttempt = await readPersistedJsonDocument(context);
      assertValidPersistedDocument<ExecutionAttempt>(storedAttempt, validateExecutionAttempt, context);
      return storedAttempt;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async listByTicketId(
    missionId: string,
    ticketId: string,
  ): Promise<ExecutionAttempt[]> {
    const ticketStoragePaths = resolveTicketStoragePaths(this.layout, missionId, ticketId);
    const attemptsDir = path.join(ticketStoragePaths.ticketDir, "attempts");
    const attemptEntries = await readDirectoryEntries(attemptsDir);
    const attempts: ExecutionAttempt[] = [];

    for (const attemptEntry of attemptEntries) {
      if (!attemptEntry.isDirectory()) {
        continue;
      }

      const attempt = await this.findById(missionId, ticketId, attemptEntry.name);

      if (attempt) {
        attempts.push(attempt);
      }
    }

    return attempts;
  }

  public async findActiveByTicketId(
    missionId: string,
    ticketId: string,
  ): Promise<ExecutionAttempt | null> {
    const attempts = await this.listByTicketId(missionId, ticketId);

    return attempts.find((attempt) =>
      ACTIVE_EXECUTION_ATTEMPT_STATUSES.includes(attempt.status)
    ) ?? null;
  }
}

export function createFileExecutionAttemptRepository(
  layout: WorkspaceLayout,
): FileExecutionAttemptRepository {
  return new FileExecutionAttemptRepository(layout);
}

async function readDirectoryEntries(directoryPath: string): Promise<Dirent[]> {
  try {
    return await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}
