import type { Dirent } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import {
  attachStructuralValidationWarnings,
  validateArtifact,
  type StructuralValidationWarning,
} from "../../../contracts/src/guards/persisted-document-guards";
import type { Artifact } from "../../../contracts/src/artifact/artifact";
import { writeJsonAtomic } from "../fs-layout/atomic-json";
import { isMissingFileError } from "../fs-layout/file-system-read-errors";
import {
  resolveArtifactStoragePaths,
  resolveMissionStoragePaths,
  resolveTicketStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";
import {
  assertValidPersistedDocument,
  readPersistedJsonDocument,
} from "./persisted-document-errors";

export interface SaveArtifactResult {
  artifactsDir: string;
  artifactDir: string;
  artifactPath: string;
}

export class FileArtifactRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(artifact: Artifact): Promise<SaveArtifactResult> {
    const artifactStoragePaths = resolveArtifactStoragePaths(
      this.layout,
      artifact.missionId,
      artifact.ticketId,
      artifact.id,
    );

    await mkdir(artifactStoragePaths.artifactDir, { recursive: true });
    await writeJsonAtomic(artifactStoragePaths.artifactPath, artifact);

    return artifactStoragePaths;
  }

  public async findById(
    missionId: string,
    artifactId: string,
  ): Promise<Artifact | null> {
    const artifacts = await this.listByMissionId(missionId);

    return artifacts.find((artifact) => artifact.id === artifactId) ?? null;
  }

  public async listByTicketId(
    missionId: string,
    ticketId: string,
  ): Promise<Artifact[]> {
    const ticketStoragePaths = resolveTicketStoragePaths(this.layout, missionId, ticketId);
    const artifactsDir = path.join(ticketStoragePaths.ticketDir, "artifacts");
    const artifactEntries = await readDirectoryEntries(artifactsDir);
    const artifacts: Artifact[] = [];

    for (const artifactEntry of artifactEntries) {
      if (!artifactEntry.isDirectory()) {
        continue;
      }

      const artifact = await this.readArtifactSnapshot(missionId, ticketId, artifactEntry.name);

      if (artifact) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  public async listByMissionId(missionId: string): Promise<Artifact[]> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, missionId);
    const ticketsDir = path.join(missionStoragePaths.missionDir, "tickets");
    const ticketEntries = await readDirectoryEntries(ticketsDir);
    const artifacts: Artifact[] = [];

    for (const ticketEntry of ticketEntries) {
      if (!ticketEntry.isDirectory()) {
        continue;
      }

      artifacts.push(...(await this.listByTicketId(missionId, ticketEntry.name)));
    }

    return artifacts;
  }

  private async readArtifactSnapshot(
    missionId: string,
    ticketId: string,
    artifactId: string,
  ): Promise<Artifact | null> {
    const artifactStoragePaths = resolveArtifactStoragePaths(
      this.layout,
      missionId,
      ticketId,
      artifactId,
    );
    const context = {
      filePath: artifactStoragePaths.artifactPath,
      entityLabel: "Artifact",
      documentId: artifactId,
    };

    try {
      const storedArtifact = await readPersistedJsonDocument(context);
      const warnings: StructuralValidationWarning[] = [];
      assertValidPersistedDocument<Artifact>(
        storedArtifact,
        (value) => validateArtifact(value, { strict: false, warnings }),
        context,
      );
      return attachStructuralValidationWarnings(storedArtifact, warnings);
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }
}

export function createFileArtifactRepository(
  layout: WorkspaceLayout,
): FileArtifactRepository {
  return new FileArtifactRepository(layout);
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
