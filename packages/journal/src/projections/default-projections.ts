import {
  seedProjectionStore,
  type ProjectionCatalog,
  type ProjectionSeedResult,
} from "../../../storage/src/projection-store/file-projection-store";

export const DEFAULT_PROJECTIONS = {
  "mission-status": {
    schemaVersion: 1,
    mission: null,
  },
  "ticket-board": {
    schemaVersion: 1,
    tickets: [],
  },
  "approval-queue": {
    schemaVersion: 1,
    approvals: [],
  },
  "artifact-index": {
    schemaVersion: 1,
    artifacts: [],
  },
  "audit-log": {
    schemaVersion: 1,
    entries: [],
  },
  "resume-view": {
    schemaVersion: 1,
    resume: null,
  },
} satisfies ProjectionCatalog;

export async function ensureDefaultProjections(
  projectionsDir: string,
): Promise<ProjectionSeedResult> {
  return seedProjectionStore(projectionsDir, DEFAULT_PROJECTIONS);
}
