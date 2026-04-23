import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import { readEventLog } from "../../packages/journal/src/event-log/file-event-log";
import {
  readApprovalQueue,
  setReadApprovalQueueDependenciesForTesting,
} from "../../packages/mission-kernel/src/resume-service/read-approval-queue";

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
    "Mission approval queue",
    "--objective",
    "Verifier la lecture defensive de la queue",
    "--success-criterion",
    "La queue reste lisible",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const missionLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
  assert.ok(missionLine);

  return missionLine.slice("Mission creee: ".length);
}

test("readApprovalQueue lit le journal une seule fois quand il doit reconstruire la mission depuis le journal", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-read-approval-queue-single-read-"));

  t.after(async () => {
    setReadApprovalQueueDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const missionId = await bootstrapAndCreateMission(rootDir);
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  let readCount = 0;

  await rm(missionPath, { force: true });
  setReadApprovalQueueDependenciesForTesting({
    readEventLog: async (...args) => {
      readCount += 1;
      return readEventLog(...args);
    },
  });

  const result = await readApprovalQueue({
    rootDir,
    missionId,
    commandName: "approval queue",
  });

  assert.equal(result.mission.id, missionId);
  assert.equal(readCount, 1);
});

test("readApprovalQueue recree le dossier projections manquant quand le journal existe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-read-approval-queue-projections-"));

  t.after(async () => {
    setReadApprovalQueueDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const missionId = await bootstrapAndCreateMission(rootDir);
  const projectionsDir = path.join(rootDir, ".corp", "projections");
  const projectionPath = path.join(projectionsDir, "approval-queue.json");

  await rm(projectionsDir, { recursive: true, force: true });

  const result = await readApprovalQueue({
    rootDir,
    missionId,
    commandName: "approval queue",
  });

  assert.equal(result.mission.id, missionId);
  await access(projectionPath);
});
