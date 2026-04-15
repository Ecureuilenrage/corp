import { writeFile } from "node:fs/promises";

import { DEFAULT_PROJECTIONS } from "../../../journal/src/projections/default-projections";
import { isAlreadyExistsError } from "../../../storage/src/fs-layout/atomic-json";
import { resolveProjectionPath } from "../../../storage/src/projection-store/file-projection-store";
import type { WorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";

export interface EnsureMissionWorkspaceOptions {
  commandLabel: string;
  skipProjections?: ReadonlySet<string>;
}

// Garantit que le workspace mission est initialise en utilisant le pattern exclusif
// writeFile({flag: "wx"}) aligne sur ensureAppendOnlyEventLog et seedProjectionStore.
// Deux initialisations concurrentes produisent une seule creation effective : la
// perdante recoit EEXIST (benign). Tout autre echec (ex. ENOENT sur le dossier parent)
// est surface comme "Workspace non initialise" pour guider l'operateur vers bootstrap.
export async function ensureMissionWorkspaceInitialized(
  layout: WorkspaceLayout,
  options: EnsureMissionWorkspaceOptions,
): Promise<void> {
  const initializationError = new Error(
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${options.commandLabel}\`.`,
  );

  await ensureWorkspaceFileIdempotent(layout.journalPath, "", initializationError);

  for (const [projectionName, snapshot] of Object.entries(DEFAULT_PROJECTIONS)) {
    if (options.skipProjections?.has(projectionName)) {
      continue;
    }

    await ensureWorkspaceFileIdempotent(
      resolveProjectionPath(layout.projectionsDir, projectionName),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      initializationError,
    );
  }
}

async function ensureWorkspaceFileIdempotent(
  filePath: string,
  contents: string,
  initializationError: Error,
): Promise<void> {
  try {
    await writeFile(filePath, contents, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return;
    }

    throw initializationError;
  }
}
