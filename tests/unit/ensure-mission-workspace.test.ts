import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { ensureMissionWorkspaceInitialized } from "../../packages/mission-kernel/src/mission-service/ensure-mission-workspace";
import { resolveWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import { DEFAULT_PROJECTIONS } from "../../packages/journal/src/projections/default-projections";
import { resolveProjectionPath } from "../../packages/storage/src/projection-store/file-projection-store";

test("ensureMissionWorkspaceInitialized ne cree qu'un journal et qu'une projection sous appels concurrents", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ensure-workspace-concurrent-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = resolveWorkspaceLayout(rootDir);

  // Bootstrap partiel: les dossiers parents existent, les fichiers sont absents.
  await mkdir(layout.journalDir, { recursive: true });
  await mkdir(layout.projectionsDir, { recursive: true });

  // 20 initialisations concurrentes doivent toutes reussir sans corrompre les fichiers.
  await Promise.all(
    Array.from({ length: 20 }, () =>
      ensureMissionWorkspaceInitialized(layout, { commandLabel: "create" }),
    ),
  );

  // Le journal doit etre une baseline vide unique.
  const journalContents = await readFile(layout.journalPath, "utf8");
  assert.equal(journalContents, "");

  // Chaque projection doit exister et correspondre exactement au snapshot par defaut.
  for (const [projectionName, snapshot] of Object.entries(DEFAULT_PROJECTIONS)) {
    const projectionContents = await readFile(
      resolveProjectionPath(layout.projectionsDir, projectionName),
      "utf8",
    );
    assert.equal(projectionContents, `${JSON.stringify(snapshot, null, 2)}\n`);
  }
});

test("ensureMissionWorkspaceInitialized surface l'erreur d'initialisation quand le workspace n'existe pas", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ensure-workspace-uninit-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = resolveWorkspaceLayout(rootDir);

  // Aucun dossier .corp cree : writeFile(wx) echoue avec ENOENT et declenche l'erreur operateur.
  await assert.rejects(
    () => ensureMissionWorkspaceInitialized(layout, { commandLabel: "create" }),
    /Workspace mission non initialise\. Lancez `corp mission bootstrap --root/,
  );
});

test("ensureMissionWorkspaceInitialized respecte skipProjections pour le scenario lifecycle", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ensure-workspace-skip-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = resolveWorkspaceLayout(rootDir);

  await mkdir(layout.journalDir, { recursive: true });
  await mkdir(layout.projectionsDir, { recursive: true });

  await ensureMissionWorkspaceInitialized(layout, {
    commandLabel: "pause",
    skipProjections: new Set(["resume-view"]),
  });

  // resume-view ne doit PAS avoir ete cree.
  await assert.rejects(
    () => readFile(resolveProjectionPath(layout.projectionsDir, "resume-view"), "utf8"),
    /ENOENT/,
  );

  // Les autres projections DOIVENT avoir ete creees.
  for (const projectionName of Object.keys(DEFAULT_PROJECTIONS)) {
    if (projectionName === "resume-view") {
      continue;
    }
    await readFile(resolveProjectionPath(layout.projectionsDir, projectionName), "utf8");
  }
});
