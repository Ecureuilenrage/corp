import type { Dirent } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  attachStructuralValidationWarnings,
  validateMission,
  type StructuralValidationWarning,
} from "../../../contracts/src/guards/persisted-document-guards";
import { hydrateMission, type Mission } from "../../../contracts/src/mission/mission";
import { isAlreadyExistsError, writeJsonAtomic } from "../fs-layout/atomic-json";
import { isMissingFileError } from "../fs-layout/file-system-read-errors";
import {
  resolveMissionStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";
import {
  assertValidPersistedDocument,
  readPersistedJsonDocument,
} from "./persisted-document-errors";

export interface SaveMissionResult {
  missionDir: string;
  missionPath: string;
}

export interface FileMissionRepositoryDependencies {
  mkdir?: typeof mkdir;
  createLockFile?: typeof writeFile;
  removeLockFile?: typeof unlink;
  readLockStat?: typeof stat;
  writeMissionJson?: typeof writeJsonAtomic;
  warn?: (message: string) => void;
  now?: () => Date;
  lockStaleTtlMs?: number;
}

export interface CleanupStaleMissionLocksOptions {
  lockStaleTtlMs?: number;
  warn?: (message: string) => void;
  now?: () => Date;
}

interface ResolvedMissionRepositoryDependencies {
  mkdir: typeof mkdir;
  createLockFile: typeof writeFile;
  removeLockFile: typeof unlink;
  readLockStat: typeof stat;
  writeMissionJson: typeof writeJsonAtomic;
  warn: (message: string) => void;
  now: () => Date;
  lockStaleTtlMs: number;
}

export const DEFAULT_MISSION_LOCK_STALE_TTL_MS = 5 * 60 * 1000;
const MISSION_LOCK_STALE_TTL_ENV_VAR = "CORP_MISSION_LOCK_STALE_TTL_MS";

export class FileMissionRepository {
  private readonly dependencies: ResolvedMissionRepositoryDependencies;

  public constructor(
    private readonly layout: WorkspaceLayout,
    dependencies: FileMissionRepositoryDependencies = {},
  ) {
    this.dependencies = resolveRepositoryDependencies(dependencies);
  }

  public async save(mission: Mission): Promise<SaveMissionResult> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, mission.id);

    await this.dependencies.mkdir(missionStoragePaths.missionDir, { recursive: true });
    await this.dependencies.writeMissionJson(missionStoragePaths.missionPath, mission);

    return missionStoragePaths;
  }

  public async saveIfUnchanged(
    mission: Mission,
    expectedMission: Mission,
    beforeSave?: () => Promise<void>,
  ): Promise<SaveMissionResult> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, mission.id);
    const lockPath = resolveMissionLockPath(missionStoragePaths.missionPath);

    await this.dependencies.mkdir(missionStoragePaths.missionDir, { recursive: true });
    await removeStaleMissionLockIfNeeded(lockPath, mission.id, this.dependencies);

    try {
      await this.dependencies.createLockFile(lockPath, "", {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        throw new Error(
          `Conflit d'ecriture concurrente detecte pour la mission \`${mission.id}\`.`,
        );
      }

      throw error;
    }

    let primaryError: unknown;

    try {
      const currentMission = await this.findById(mission.id);

      if (!currentMission || !areMissionSnapshotsEqual(currentMission, expectedMission)) {
        throw new Error(
          `Conflit d'ecriture concurrente detecte pour la mission \`${mission.id}\`.`,
        );
      }

      // journal-as-source-of-truth : la callback beforeSave execute l'append au journal
      // (et, le cas echeant, la reconstruction des read-models sous lock). Si le
      // writeJsonAtomic suivant echoue, le journal contient deja la decision et le
      // prochain reader reconstruira l'etat via reconstructMissionFromJournal.
      // Voir docs/architecture/journal-as-source-of-truth.md.
      await beforeSave?.();
      await this.dependencies.writeMissionJson(missionStoragePaths.missionPath, mission);

      return missionStoragePaths;
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      await releaseMissionLock(lockPath, mission.id, primaryError, this.dependencies);
    }
  }

  public async findById(missionId: string): Promise<Mission | null> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, missionId);
    const context = {
      filePath: missionStoragePaths.missionPath,
      entityLabel: "Mission",
      documentId: missionId,
    };

    try {
      const storedMission = await readPersistedJsonDocument(context);
      const warnings: StructuralValidationWarning[] = [];
      assertValidPersistedDocument<Mission>(
        storedMission,
        (value) => validateMission(value, { strict: false, warnings }),
        context,
      );
      return attachStructuralValidationWarnings(hydrateMission(storedMission), warnings);
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }
}

export function createFileMissionRepository(
  layout: WorkspaceLayout,
): FileMissionRepository {
  return new FileMissionRepository(layout);
}

export async function cleanupStaleMissionLocks(
  layout: WorkspaceLayout,
  options: CleanupStaleMissionLocksOptions = {},
): Promise<string[]> {
  const removedLockPaths: string[] = [];
  const missionEntries = await readDirectoryEntries(layout.missionsDir);
  const dependencies = resolveRepositoryDependencies(options);

  for (const missionEntry of missionEntries) {
    if (!missionEntry.isDirectory()) {
      continue;
    }

    const lockPath = path.join(layout.missionsDir, missionEntry.name, "mission.json.lock");

    if (await removeStaleMissionLockIfNeeded(lockPath, missionEntry.name, dependencies)) {
      removedLockPaths.push(lockPath);
    }
  }

  return removedLockPaths;
}

export function areMissionSnapshotsEqual(left: Mission, right: Mission): boolean {
  // Compare sous forme canonique (cles triees recursivement) pour que deux missions
  // logiquement egales mais hydratees par des chemins distincts (lecture disque vs
  // reconstruction programmatique) restent equivalentes sans changer le contrat persiste.
  return isDeepStrictEqual(canonicalize(left), canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Map || value instanceof Set) {
    throw new TypeError("Map/Set non supportes dans les snapshots mission.");
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const sortedRecord: Record<string, unknown> = {};
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();

  for (const key of sortedKeys) {
    const nextValue = (value as Record<string, unknown>)[key];

    if (nextValue === undefined) {
      continue;
    }

    sortedRecord[key] = canonicalize(nextValue);
  }

  return sortedRecord;
}

function resolveRepositoryDependencies(
  dependencies: FileMissionRepositoryDependencies | CleanupStaleMissionLocksOptions,
): ResolvedMissionRepositoryDependencies {
  const repositoryDependencies = dependencies as FileMissionRepositoryDependencies;

  return {
    mkdir: repositoryDependencies.mkdir ?? mkdir,
    createLockFile: repositoryDependencies.createLockFile ?? writeFile,
    removeLockFile: repositoryDependencies.removeLockFile ?? unlink,
    readLockStat: repositoryDependencies.readLockStat ?? stat,
    writeMissionJson: repositoryDependencies.writeMissionJson ?? writeJsonAtomic,
    warn: dependencies.warn ?? ((message: string) => console.warn(message)),
    now: dependencies.now ?? (() => new Date()),
    lockStaleTtlMs: resolveMissionLockStaleTtlMs(dependencies.lockStaleTtlMs),
  };
}

function resolveMissionLockPath(missionPath: string): string {
  return `${missionPath}.lock`;
}

function resolveMissionLockStaleTtlMs(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return override;
  }

  const rawValue = process.env[MISSION_LOCK_STALE_TTL_ENV_VAR];
  const parsedValue = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_MISSION_LOCK_STALE_TTL_MS;
}

async function removeStaleMissionLockIfNeeded(
  lockPath: string,
  missionId: string,
  dependencies: ResolvedMissionRepositoryDependencies,
): Promise<boolean> {
  try {
    const lockStats = await dependencies.readLockStat(lockPath);

    if (!isMissionLockStale(lockStats.mtimeMs, dependencies)) {
      return false;
    }

    await dependencies.removeLockFile(lockPath);
    dependencies.warn(`Lock stale supprime pour la mission \`${missionId}\`: ${lockPath}.`);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

function isMissionLockStale(
  mtimeMs: number,
  dependencies: ResolvedMissionRepositoryDependencies,
): boolean {
  return dependencies.now().getTime() - mtimeMs >= dependencies.lockStaleTtlMs;
}

async function releaseMissionLock(
  lockPath: string,
  missionId: string,
  primaryError: unknown,
  dependencies: ResolvedMissionRepositoryDependencies,
): Promise<void> {
  try {
    await dependencies.removeLockFile(lockPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    if (primaryError !== undefined) {
      dependencies.warn(
        `Liberation du lock mission echouee apres une erreur primaire pour \`${missionId}\`: ${String(error)}.`,
      );
      return;
    }

    throw error;
  }
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
