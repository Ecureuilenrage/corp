import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  detectGitWorkspaceArtifacts,
  detectWorkspaceArtifacts,
} from "../../packages/workspace-isolation/src/workspace-artifact-detector";
import type { WorkspaceIsolationMetadata } from "../../packages/workspace-isolation/src/workspace-isolation";

function createIsolation(
  kind: WorkspaceIsolationMetadata["kind"],
  sourceRoot: string,
  workspacePath: string,
): WorkspaceIsolationMetadata {
  return {
    workspaceIsolationId: "iso_test",
    kind,
    sourceRoot,
    workspacePath,
    createdAt: "2026-04-10T00:00:00.000Z",
    retained: true,
  };
}

test("detectGitWorkspaceArtifacts reconnait une suppression comme un artefact significatif", async (t) => {
  const workspacePath = await mkdtemp(path.join(tmpdir(), "corp-workspace-git-delete-"));

  t.after(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  const artifacts = await detectGitWorkspaceArtifacts(workspacePath, {
    runGitCommand: async () => ({
      exitCode: 0,
      stdout: "D  deleted.txt\n",
      stderr: "",
    }),
  });

  assert.deepEqual(artifacts, [
    {
      kind: "workspace_file",
      title: "deleted.txt",
      path: "deleted.txt",
      label: "deleted",
      summary: "Fichier supprime dans le workspace isole.",
      sizeBytes: 0,
    },
  ]);
});

test("detectGitWorkspaceArtifacts nettoie les guillemets des chemins git contenant des espaces", async (t) => {
  const workspacePath = await mkdtemp(path.join(tmpdir(), "corp-workspace-git-spaces-"));
  const fileName = "notes with spaces.txt";

  t.after(async () => {
    await rm(workspacePath, { recursive: true, force: true });
  });

  await writeFile(path.join(workspacePath, fileName), "contenu utile\n", "utf8");

  const artifacts = await detectGitWorkspaceArtifacts(workspacePath, {
    runGitCommand: async () => ({
      exitCode: 0,
      stdout: `M  "${fileName}"\n`,
      stderr: "",
    }),
  });

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0]?.path, fileName);
  assert.equal(artifacts[0]?.title, fileName);
});

test("detectWorkspaceArtifacts ignore les fichiers de taille zero dans un workspace_copy", async (t) => {
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "corp-workspace-source-"));
  const workspacePath = await mkdtemp(path.join(tmpdir(), "corp-workspace-copy-"));

  t.after(async () => {
    await rm(sourceRoot, { recursive: true, force: true });
    await rm(workspacePath, { recursive: true, force: true });
  });

  await writeFile(path.join(workspacePath, "empty.txt"), "", "utf8");

  const artifacts = await detectWorkspaceArtifacts(
    createIsolation("workspace_copy", sourceRoot, workspacePath),
  );

  assert.deepEqual(artifacts, []);
});
