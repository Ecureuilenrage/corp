import { ensureAppendOnlyEventLog } from "../../../journal/src/event-log/file-event-log";
import {
  DEFAULT_PROJECTIONS,
  ensureDefaultProjections,
} from "../../../journal/src/projections/default-projections";
import {
  ensureWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import { cleanupStaleMissionLocks } from "../../../storage/src/repositories/file-mission-repository";

export interface BootstrapMissionWorkspaceOptions {
  rootDir: string;
}

export interface BootstrapMissionWorkspaceResult extends WorkspaceLayout {
  createdPaths: string[];
}

export { DEFAULT_PROJECTIONS };

export async function bootstrapMissionWorkspace(
  options: BootstrapMissionWorkspaceOptions,
): Promise<BootstrapMissionWorkspaceResult> {
  const layout = await ensureWorkspaceLayout(options.rootDir);
  const createdPaths: string[] = [];

  await cleanupStaleMissionLocks(layout);

  const createdJournal = await ensureAppendOnlyEventLog(layout.journalPath);
  if (createdJournal) {
    createdPaths.push(layout.journalPath);
  }

  const projectionSeedResult = await ensureDefaultProjections(layout.projectionsDir);
  createdPaths.push(...projectionSeedResult.createdPaths);

  return {
    ...layout,
    createdPaths,
  };
}
