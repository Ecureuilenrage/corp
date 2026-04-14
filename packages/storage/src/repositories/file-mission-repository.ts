import { mkdir, readFile, writeFile } from "node:fs/promises";

import { hydrateMission, type Mission } from "../../../contracts/src/mission/mission";
import {
  resolveMissionStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";

export interface SaveMissionResult {
  missionDir: string;
  missionPath: string;
}

export class FileMissionRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(mission: Mission): Promise<SaveMissionResult> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, mission.id);

    await mkdir(missionStoragePaths.missionDir, { recursive: true });
    await writeFile(
      missionStoragePaths.missionPath,
      `${JSON.stringify(mission, null, 2)}\n`,
      "utf8",
    );

    return missionStoragePaths;
  }

  public async findById(missionId: string): Promise<Mission | null> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, missionId);

    try {
      const storedMission = await readFile(missionStoragePaths.missionPath, "utf8");
      return hydrateMission(JSON.parse(storedMission) as Mission);
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

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
