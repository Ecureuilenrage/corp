import { mkdir, unlink, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { validateMission } from "../../../contracts/src/guards/persisted-document-guards";
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

export class FileMissionRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(mission: Mission): Promise<SaveMissionResult> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, mission.id);

    await mkdir(missionStoragePaths.missionDir, { recursive: true });
    await writeJsonAtomic(missionStoragePaths.missionPath, mission);

    return missionStoragePaths;
  }

  public async saveIfUnchanged(
    mission: Mission,
    expectedMission: Mission,
    beforeSave?: () => Promise<void>,
  ): Promise<SaveMissionResult> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, mission.id);
    const lockPath = `${missionStoragePaths.missionPath}.lock`;

    await mkdir(missionStoragePaths.missionDir, { recursive: true });

    try {
      await writeFile(lockPath, "", { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        throw new Error(
          `Conflit d'ecriture concurrente detecte pour la mission \`${mission.id}\`.`,
        );
      }

      throw error;
    }

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
      await writeJsonAtomic(missionStoragePaths.missionPath, mission);

      return missionStoragePaths;
    } finally {
      try {
        await unlink(lockPath);
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
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
      assertValidPersistedDocument<Mission>(storedMission, validateMission, context);
      return hydrateMission(storedMission);
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

export function areMissionSnapshotsEqual(left: Mission, right: Mission): boolean {
  // Compare sous forme canonique (cles triees recursivement) pour que deux missions
  // logiquement egales mais hydratees par des chemins distincts (lecture disque vs
  // reconstruction programmatique) soient considerees egales. Voir Story 5.1.1 AC4.
  return isDeepStrictEqual(canonicalize(left), canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const sortedRecord: Record<string, unknown> = {};
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();

  for (const key of sortedKeys) {
    sortedRecord[key] = canonicalize((value as Record<string, unknown>)[key]);
  }

  return sortedRecord;
}
