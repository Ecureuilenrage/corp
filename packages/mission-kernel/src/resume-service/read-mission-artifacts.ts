import { access, open } from "node:fs/promises";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import type { Mission } from "../../../contracts/src/mission/mission";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import {
  createArtifactIndexProjection,
  type ArtifactIndexEntry,
  type ArtifactIndexProjection,
} from "../../../journal/src/projections/artifact-index-projection";
import {
  readProjectionFile,
  resolveProjectionPath,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import {
  resolveWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import { createFileArtifactRepository } from "../../../storage/src/repositories/file-artifact-repository";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";

export interface ReadMissionArtifactsOptions {
  rootDir: string;
  missionId: string;
  commandName: "artifact list" | "artifact show" | "resume" | "status" | "compare" | "compare relaunch";
}

export interface ReadMissionArtifactsResult {
  mission: Mission;
  artifacts: ArtifactIndexEntry[];
  reconstructed: boolean;
  projectionPath: string;
}

export interface MissionArtifactDetail {
  mission: Mission;
  artifact: ArtifactIndexEntry;
  reconstructed: boolean;
  projectionPath: string;
  payloadPreview: string | null;
}

export const MAX_PREVIEW_BYTES = 1024;

export interface PreviewFileHandle {
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null,
  ): Promise<{ bytesRead: number; buffer: Buffer }>;
  close(): Promise<void>;
}

export interface ReadPayloadPreviewDependencies {
  openFile?: (
    filePath: string,
    flags?: string,
  ) => Promise<PreviewFileHandle>;
}

export async function readMissionArtifacts(
  options: ReadMissionArtifactsOptions,
): Promise<ReadMissionArtifactsResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureArtifactWorkspaceInitialized(layout, options.commandName);

  try {
    const missionRepository = createFileMissionRepository(layout);
    const ticketRepository = createFileTicketRepository(layout);
    const artifactRepository = createFileArtifactRepository(layout);
    const mission = await missionRepository.findById(options.missionId);

    if (!mission) {
      throw new Error(`Mission introuvable: ${options.missionId}.`);
    }

    const tickets = await ticketRepository.listByMissionId(mission.id);
    const artifacts = await artifactRepository.listByMissionId(mission.id);
    const events = (await readEventLog(layout.journalPath))
      .filter((event) => event.missionId === mission.id);
    const rebuiltProjection = createArtifactIndexProjection({
      mission,
      tickets,
      artifacts,
      events,
    });
    const projectionPath = resolveProjectionPath(layout.projectionsDir, "artifact-index");
    const storedProjection = await readStoredArtifactIndex(layout.projectionsDir);

    if (!storedProjection || !isArtifactProjectionUpToDate(storedProjection, rebuiltProjection)) {
      await writeProjectionSnapshot(layout.projectionsDir, "artifact-index", rebuiltProjection);

      return {
        mission,
        artifacts: rebuiltProjection.artifacts,
        reconstructed: true,
        projectionPath,
      };
    }

    return {
      mission,
      artifacts: storedProjection.artifacts,
      reconstructed: false,
      projectionPath,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Mission introuvable:")) {
      throw error;
    }

    throw new Error(formatArtifactReadError(options.missionId, options.commandName));
  }
}

export async function listMissionArtifacts(options: {
  rootDir: string;
  missionId: string;
  ticketId?: string;
}): Promise<ReadMissionArtifactsResult> {
  const result = await readMissionArtifacts({
    rootDir: options.rootDir,
    missionId: options.missionId,
    commandName: "artifact list",
  });

  if (options.ticketId && !result.mission.ticketIds.includes(options.ticketId)) {
    throw new Error(
      `Ticket introuvable dans la mission \`${result.mission.id}\`: \`${options.ticketId}\`.`,
    );
  }

  return {
    ...result,
    artifacts: options.ticketId
      ? result.artifacts.filter((artifact) => artifact.ticketId === options.ticketId)
      : result.artifacts,
  };
}

export async function readMissionArtifactDetail(options: {
  rootDir: string;
  missionId: string;
  artifactId: string;
}): Promise<MissionArtifactDetail> {
  const result = await readMissionArtifacts({
    rootDir: options.rootDir,
    missionId: options.missionId,
    commandName: "artifact show",
  });
  const artifact = result.artifacts.find((entry) => entry.artifactId === options.artifactId);

  if (!artifact) {
    throw new Error(
      `Artefact introuvable dans la mission \`${options.missionId}\`: \`${options.artifactId}\`.`,
    );
  }

  const layout = resolveWorkspaceLayout(options.rootDir);
  const payloadPreview = artifact.payloadPath
    ? await readPayloadPreview(layout.rootDir, artifact.payloadPath, artifact.mediaType)
    : null;

  return {
    mission: result.mission,
    artifact,
    reconstructed: result.reconstructed,
    projectionPath: result.projectionPath,
    payloadPreview,
  };
}

async function ensureArtifactWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: "artifact list" | "artifact show" | "resume" | "status" | "compare" | "compare relaunch",
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

async function readStoredArtifactIndex(
  projectionsDir: string,
): Promise<ArtifactIndexProjection | null> {
  try {
    return JSON.parse(await readProjectionFile(projectionsDir, "artifact-index")) as ArtifactIndexProjection;
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

function isArtifactProjectionUpToDate(
  storedProjection: ArtifactIndexProjection,
  rebuiltProjection: ArtifactIndexProjection,
): boolean {
  return deepStrictEqualForComparison(storedProjection, rebuiltProjection);
}

function formatArtifactReadError(
  missionId: string,
  commandName: "artifact list" | "artifact show" | "resume" | "status" | "compare" | "compare relaunch",
): string {
  if (commandName === "artifact list" || commandName === "artifact show") {
    return `Projection artifact-index irreconciliable pour ${missionId}. Impossible d'afficher les artefacts.`;
  }

  return `Projection artifact-index irreconciliable pour ${missionId}. Impossible d'afficher la mission.`;
}

export async function readPayloadPreview(
  rootDir: string,
  payloadPath: string,
  mediaType: string | undefined,
  dependencies: ReadPayloadPreviewDependencies = {},
): Promise<string | null> {
  try {
    const resolvedPayloadPath = path.isAbsolute(payloadPath)
      ? payloadPath
      : path.join(rootDir, payloadPath);

    if (mediaType?.includes("json") || !mediaType || mediaType.startsWith("text/")) {
      return truncatePreview(
        await readUtf8PreviewContents(resolvedPayloadPath, dependencies),
      );
    }

    return null;
  } catch {
    return null;
  }
}

function truncatePreview(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length <= 240) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, 237)}...`;
}

async function readUtf8PreviewContents(
  filePath: string,
  dependencies: ReadPayloadPreviewDependencies,
): Promise<string> {
  const fileHandle = await (dependencies.openFile ?? open)(filePath, "r");

  try {
    const buffer = Buffer.alloc(MAX_PREVIEW_BYTES);
    const { bytesRead } = await fileHandle.read(buffer, 0, MAX_PREVIEW_BYTES, 0);
    const decoder = new StringDecoder("utf8");

    return `${decoder.write(buffer.subarray(0, bytesRead))}${decoder.end()}`;
  } finally {
    await fileHandle.close();
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
