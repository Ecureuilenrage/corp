import { access, writeFile } from "node:fs/promises";

import { EventLogReadError } from "../../../journal/src/event-log/event-log-errors";
import { DEFAULT_PROJECTIONS } from "../../../journal/src/projections/default-projections";
import { isAlreadyExistsError } from "../../../storage/src/fs-layout/atomic-json";
import {
  createFileSystemReadError,
  isFileSystemReadError,
  readAccessError,
} from "../../../storage/src/fs-layout/file-system-read-errors";
import { resolveProjectionPath } from "../../../storage/src/projection-store/file-projection-store";
import type { WorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { cleanupStaleMissionLocks } from "../../../storage/src/repositories/file-mission-repository";

export interface EnsureMissionWorkspaceOptions {
  commandLabel: string;
  initializeJournal?: boolean;
  // Les commandes d'ecriture demandent explicitement le cleanup des verrous
  // mission periumes. Les commandes de lecture (status/resume/compare) doivent
  // rester pures et ne pas muter le disque : `cleanupLocks` reste `false` par
  // defaut pour preserver cette garantie.
  cleanupLocks?: boolean;
}

interface WorkspaceAccessCheck {
  error: NodeJS.ErrnoException | null;
  filePath: string;
  isJournal?: boolean;
  label: string;
}

const REQUIRED_PROJECTION_NAMES = Object.freeze(
  Object.keys(DEFAULT_PROJECTIONS),
);

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

  if (options.cleanupLocks) {
    await runLockCleanup(layout);
  }

  if (options.initializeJournal !== false) {
    await ensureWorkspaceFileIdempotent(layout.journalPath, "", initializationError);
  }

  for (const [projectionName, snapshot] of Object.entries(DEFAULT_PROJECTIONS)) {
    await ensureWorkspaceFileIdempotent(
      resolveProjectionPath(layout.projectionsDir, projectionName),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      initializationError,
    );
  }

  await assertWorkspaceReady(layout, initializationError);
}

async function runLockCleanup(layout: WorkspaceLayout): Promise<void> {
  try {
    await cleanupStaleMissionLocks(layout);
  } catch (error) {
    // ENOENT sur le repertoire missions signifie qu'il n'y a rien a nettoyer ;
    // `assertWorkspaceReady` surfacera plus bas le bon diagnostic d'absence.
    if (isMissingDirectoryError(error)) {
      return;
    }

    if (isFileSystemReadError(error)) {
      throw createFileSystemReadError(error, layout.missionsDir, "repertoire missions");
    }

    throw error;
  }
}

function isMissingDirectoryError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "ENOENT";
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

async function assertWorkspaceReady(
  layout: WorkspaceLayout,
  initializationError: Error,
): Promise<void> {
  const checks = await collectWorkspaceAccessChecks(layout);
  const firstFileSystemError = checks.find((entry) =>
    entry.error && entry.error.code !== "ENOENT" && isFileSystemReadError(entry.error)
  );

  if (firstFileSystemError?.error) {
    if (firstFileSystemError.isJournal) {
      throw EventLogReadError.fileSystem(layout.journalPath, firstFileSystemError.error);
    }

    throw createFileSystemReadError(
      firstFileSystemError.error,
      firstFileSystemError.filePath,
      firstFileSystemError.label,
    );
  }

  const journalCheck = checks.find((entry) => entry.isJournal);
  const missingNonJournalEntry = checks.find((entry) => entry.error?.code === "ENOENT" && !entry.isJournal);

  // Le journal est la source de verite canonique : un ENOENT sur le journal
  // merite toujours le diagnostic dedie, meme si d'autres projections manquent.
  if (journalCheck?.error?.code === "ENOENT") {
    throw EventLogReadError.missing(layout.journalPath, journalCheck.error);
  }

  if (journalCheck?.error || missingNonJournalEntry) {
    throw initializationError;
  }
}

async function collectWorkspaceAccessChecks(
  layout: WorkspaceLayout,
): Promise<WorkspaceAccessCheck[]> {
  const projectionChecks = REQUIRED_PROJECTION_NAMES.map(async (projectionName) => ({
    error: await readAccessError(() =>
      access(resolveProjectionPath(layout.projectionsDir, projectionName))
    ),
    filePath: resolveProjectionPath(layout.projectionsDir, projectionName),
    label: `projection ${projectionName}`,
  }));

  return [
    {
      error: await readAccessError(() => access(layout.journalPath)),
      filePath: layout.journalPath,
      label: "journal append-only",
      isJournal: true,
    },
    {
      error: await readAccessError(() => access(layout.projectionsDir)),
      filePath: layout.projectionsDir,
      label: "repertoire projections",
    },
    {
      error: await readAccessError(() => access(layout.missionsDir)),
      filePath: layout.missionsDir,
      label: "repertoire missions",
    },
    {
      error: await readAccessError(() => access(layout.capabilitiesDir)),
      filePath: layout.capabilitiesDir,
      label: "repertoire capabilities",
    },
    {
      error: await readAccessError(() => access(layout.skillPacksDir)),
      filePath: layout.skillPacksDir,
      label: "repertoire skill packs",
    },
    ...(await Promise.all(projectionChecks)),
  ];
}
