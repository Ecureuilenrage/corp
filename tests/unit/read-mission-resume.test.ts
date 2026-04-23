import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import { DEFAULT_PROJECTIONS } from "../../packages/journal/src/projections/default-projections";
import { CorruptedPersistedDocumentError } from "../../packages/storage/src/repositories/persisted-document-errors";
import { resolveProjectionPath } from "../../packages/storage/src/projection-store/file-projection-store";
import { resolveWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import {
  readMissionResume,
  readStoredResumeView,
} from "../../packages/mission-kernel/src/resume-service/read-mission-resume";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

async function runCommand(args: string[]): Promise<CommandResult> {
  const lines: string[] = [];
  const exitCode = await runCli(args, {
    writeLine: (line: string) => lines.push(line),
  });

  return {
    exitCode,
    lines,
  };
}

async function bootstrapAndCreateMission(rootDir: string): Promise<string> {
  const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(bootstrapResult.exitCode, 0);

  const createResult = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission read resume",
    "--objective",
    "Verifier la lecture defensive du resume",
    "--success-criterion",
    "Le resume reste lisible",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const missionLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
  assert.ok(missionLine);

  return missionLine.slice("Mission creee: ".length);
}

test("readStoredResumeView classe explicitement une projection resume-view corrompue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-read-stored-resume-view-"));
  const projectionsDir = path.join(rootDir, "projections");
  const projectionPath = path.join(projectionsDir, "resume-view.json");

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await mkdir(projectionsDir, { recursive: true });
  await writeFile(projectionPath, "{corrupted", "utf8");

  const result = await readStoredResumeView(projectionsDir);

  assert.equal(result.projection, null);
  assert.ok(result.readError instanceof CorruptedPersistedDocumentError);
  assert.equal(result.readError.filePath, projectionPath);
});

test("readMissionResume preserve la cause d'une erreur inattendue issue de readMissionEvents", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-read-mission-resume-cause-"));
  const missionId = await bootstrapAndCreateMission(rootDir);
  const missionReconstructionModule = require("../../packages/journal/src/reconstruction/mission-reconstruction") as {
    readMissionEvents: (
      journalPath: string,
      missionId: string,
    ) => Promise<unknown[]>;
  };
  const originalReadMissionEvents = missionReconstructionModule.readMissionEvents;
  const rootCause = new TypeError("synthetic mission resume failure");
  let mockInvocationCount = 0;

  t.after(async () => {
    missionReconstructionModule.readMissionEvents = originalReadMissionEvents;
    await rm(rootDir, { recursive: true, force: true });
  });

  missionReconstructionModule.readMissionEvents = async () => {
    mockInvocationCount += 1;
    throw rootCause;
  };

  await assert.rejects(
    () => readMissionResume({
      rootDir,
      missionId,
      commandName: "resume",
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Journal mission irreconciliable/);
      assert.equal(error.cause, rootCause);
      return true;
    },
  );

  // Le monkey-patch doit avoir ete appele : sans cette assertion, une migration
  // future vers ESM figerait l'export et ferait passer le test en silence.
  assert.equal(mockInvocationCount, 1);
});

test("readMissionResume signale explicitement un workspace legacy sans registres d'extensions", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-read-mission-resume-legacy-layout-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await mkdir(layout.journalDir, { recursive: true });
  await mkdir(layout.projectionsDir, { recursive: true });
  await mkdir(layout.missionsDir, { recursive: true });
  await writeFile(layout.journalPath, "", "utf8");
  await writeFile(
    resolveProjectionPath(layout.projectionsDir, "resume-view"),
    `${JSON.stringify(DEFAULT_PROJECTIONS["resume-view"], null, 2)}\n`,
    "utf8",
  );

  await assert.rejects(
    () => readMissionResume({
      rootDir,
      missionId: "mission_legacy",
      commandName: "resume",
    }),
    /Workspace mission non initialise\. Lancez `corp mission bootstrap --root .*` avant `corp mission resume`\./,
  );
});
