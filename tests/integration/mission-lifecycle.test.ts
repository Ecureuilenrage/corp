import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import { runCli } from "../../apps/corp-cli/src/index";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

interface JournalEventRecord {
  eventId: string;
  type: string;
  missionId: string;
  occurredAt: string;
  actor: string;
  source: string;
  payload: Record<string, unknown>;
}

interface MissionStatusProjection {
  schemaVersion: 1;
  mission: Mission | null;
}

interface ResumeViewProjection {
  schemaVersion: 1;
  resume: {
    status: string;
    lastEventId: string;
    updatedAt: string;
    nextOperatorAction: string;
  } | null;
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

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function createMission(rootDir: string): Promise<{ missionId: string }> {
  const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(bootstrapResult.exitCode, 0);

  const createResult = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission lifecycle",
    "--objective",
    "Piloter la mission sans perdre son historique",
    "--success-criterion",
    "Les transitions restent auditable",
    "--success-criterion",
    "Le resume operateur reste coherent",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const missionCreatedLine = createResult.lines.find((line) =>
    line.startsWith("Mission creee: "),
  );

  assert.ok(missionCreatedLine, "la creation doit retourner un missionId");

  return {
    missionId: missionCreatedLine.slice("Mission creee: ".length),
  };
}

async function readMission(rootDir: string, missionId: string): Promise<Mission> {
  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", missionId, "mission.json"),
  );
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

function assertLifecycleOutput(output: string, missionId: string, status: string): void {
  assert.match(output, new RegExp(`Mission: ${missionId}`));
  assert.match(output, new RegExp(`Statut: ${status}`));
}

test("les transitions lifecycle appendent le journal et preservent le snapshot mission", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);
  const createdMission = await readMission(rootDir, missionId);

  const initialCreatedAt = createdMission.createdAt;
  const initialPolicyProfileId = createdMission.policyProfileId;
  const initialTicketIds = [...createdMission.ticketIds];
  const initialArtifactIds = [...createdMission.artifactIds];

  const pauseResult = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(pauseResult.exitCode, 0);
  assertLifecycleOutput(pauseResult.lines.join("\n"), missionId, "blocked");
  assert.match(
    pauseResult.lines.join("\n"),
    /Prochain arbitrage utile: Mission bloquee\. Relancez-la quand les conditions de reprise sont reunies\./,
  );

  const pausedMission = await readMission(rootDir, missionId);
  const pauseJournal = await readJournal(rootDir);
  const pauseEvent = pauseJournal.at(-1);

  assert.ok(pauseEvent);
  assert.equal(pausedMission.status, "blocked");
  assert.equal(pausedMission.createdAt, initialCreatedAt);
  assert.equal(pausedMission.policyProfileId, initialPolicyProfileId);
  assert.deepEqual(pausedMission.ticketIds, initialTicketIds);
  assert.deepEqual(pausedMission.artifactIds, initialArtifactIds);
  assert.equal(pausedMission.resumeCursor, pauseEvent.eventId);
  assert.equal(pausedMission.updatedAt, pauseEvent.occurredAt);
  assert.deepEqual(pausedMission.eventIds, pauseJournal.map((event) => event.eventId));
  assert.equal(pauseEvent.type, "mission.paused");
  assert.equal(pauseEvent.payload.previousStatus, "ready");
  assert.equal(pauseEvent.payload.nextStatus, "blocked");
  assert.equal(pauseEvent.payload.trigger, "operator");
  assert.deepEqual(pauseEvent.payload.mission, pausedMission);

  const pausedMissionStatusProjection = await readJson<MissionStatusProjection>(
    path.join(rootDir, ".corp", "projections", "mission-status.json"),
  );
  const pausedResumeViewProjection = await readJson<ResumeViewProjection>(
    path.join(rootDir, ".corp", "projections", "resume-view.json"),
  );

  assert.deepEqual(pausedMissionStatusProjection, {
    schemaVersion: 1,
    mission: pausedMission,
  });
  assert.equal(pausedResumeViewProjection.resume?.status, "blocked");
  assert.equal(pausedResumeViewProjection.resume?.lastEventId, pauseEvent.eventId);
  assert.equal(
    pausedResumeViewProjection.resume?.nextOperatorAction,
    "Mission bloquee. Relancez-la quand les conditions de reprise sont reunies.",
  );

  const relaunchResult = await runCommand([
    "mission",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(relaunchResult.exitCode, 0);
  assertLifecycleOutput(relaunchResult.lines.join("\n"), missionId, "ready");
  assert.match(
    relaunchResult.lines.join("\n"),
    /Prochain arbitrage utile: Aucun ticket n'existe encore\./,
  );

  const relaunchedMission = await readMission(rootDir, missionId);
  const relaunchJournal = await readJournal(rootDir);
  const relaunchEvent = relaunchJournal.at(-1);

  assert.ok(relaunchEvent);
  assert.equal(relaunchedMission.status, "ready");
  assert.equal(relaunchedMission.createdAt, initialCreatedAt);
  assert.equal(relaunchedMission.resumeCursor, relaunchEvent.eventId);
  assert.equal(relaunchedMission.updatedAt, relaunchEvent.occurredAt);
  assert.deepEqual(relaunchedMission.eventIds, relaunchJournal.map((event) => event.eventId));
  assert.equal(relaunchEvent.type, "mission.relaunched");
  assert.equal(relaunchEvent.payload.previousStatus, "blocked");
  assert.equal(relaunchEvent.payload.nextStatus, "ready");
  assert.deepEqual(relaunchEvent.payload.mission, relaunchedMission);

  const closeResult = await runCommand([
    "mission",
    "close",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--outcome",
    "completed",
  ]);

  assert.equal(closeResult.exitCode, 0);
  assertLifecycleOutput(closeResult.lines.join("\n"), missionId, "completed");
  assert.match(
    closeResult.lines.join("\n"),
    /Prochain arbitrage utile: Mission terminee\. Aucun arbitrage supplementaire n'est requis\./,
  );

  const completedMission = await readMission(rootDir, missionId);
  const closeJournal = await readJournal(rootDir);
  const closeEvent = closeJournal.at(-1);

  assert.ok(closeEvent);
  assert.equal(completedMission.status, "completed");
  assert.equal(completedMission.createdAt, initialCreatedAt);
  assert.equal(completedMission.resumeCursor, closeEvent.eventId);
  assert.equal(completedMission.updatedAt, closeEvent.occurredAt);
  assert.deepEqual(completedMission.eventIds, closeJournal.map((event) => event.eventId));
  assert.equal(closeEvent.type, "mission.completed");
  assert.equal(closeEvent.payload.previousStatus, "ready");
  assert.equal(closeEvent.payload.nextStatus, "completed");
  assert.deepEqual(closeEvent.payload.mission, completedMission);

  const completedResumeViewProjection = await readJson<ResumeViewProjection>(
    path.join(rootDir, ".corp", "projections", "resume-view.json"),
  );

  assert.equal(completedResumeViewProjection.resume?.status, "completed");
  assert.equal(completedResumeViewProjection.resume?.lastEventId, closeEvent.eventId);
  assert.equal(
    completedResumeViewProjection.resume?.nextOperatorAction,
    "Mission terminee. Aucun arbitrage supplementaire n'est requis.",
  );
});

test("mission close --outcome cancelled place la mission dans un etat terminal conforme", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-cancelled-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);
  const result = await runCommand([
    "mission",
    "close",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--outcome",
    "cancelled",
  ]);

  assert.equal(result.exitCode, 0);
  assertLifecycleOutput(result.lines.join("\n"), missionId, "cancelled");

  const mission = await readMission(rootDir, missionId);
  const journal = await readJournal(rootDir);
  const lastEvent = journal.at(-1);

  assert.ok(lastEvent);
  assert.equal(mission.status, "cancelled");
  assert.equal(mission.resumeCursor, lastEvent.eventId);
  assert.equal(lastEvent.type, "mission.cancelled");
  assert.equal(lastEvent.payload.previousStatus, "ready");
  assert.equal(lastEvent.payload.nextStatus, "cancelled");
  assert.equal(
    result.lines.at(-1),
    "Prochain arbitrage utile: Mission annulee. Aucun arbitrage supplementaire n'est requis.",
  );
});

test("les transitions interdites apres un etat terminal echouent explicitement", async (t) => {
  const completedRootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-completed-"));
  const cancelledRootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-cancelled-terminal-"));

  t.after(async () => {
    await rm(completedRootDir, { recursive: true, force: true });
    await rm(cancelledRootDir, { recursive: true, force: true });
  });

  const { missionId: completedMissionId } = await createMission(completedRootDir);
  const { missionId: cancelledMissionId } = await createMission(cancelledRootDir);

  const closeCompletedResult = await runCommand([
    "mission",
    "close",
    "--root",
    completedRootDir,
    "--mission-id",
    completedMissionId,
    "--outcome",
    "completed",
  ]);
  const closeCancelledResult = await runCommand([
    "mission",
    "close",
    "--root",
    cancelledRootDir,
    "--mission-id",
    cancelledMissionId,
    "--outcome",
    "cancelled",
  ]);

  assert.equal(closeCompletedResult.exitCode, 0);
  assert.equal(closeCancelledResult.exitCode, 0);

  const relaunchAfterCompleted = await runCommand([
    "mission",
    "relaunch",
    "--root",
    completedRootDir,
    "--mission-id",
    completedMissionId,
  ]);
  const pauseAfterCancelled = await runCommand([
    "mission",
    "pause",
    "--root",
    cancelledRootDir,
    "--mission-id",
    cancelledMissionId,
  ]);

  assert.equal(relaunchAfterCompleted.exitCode, 1);
  assert.equal(
    relaunchAfterCompleted.lines.at(-1),
    "La transition `relaunch` est interdite depuis le statut `completed`.",
  );

  assert.equal(pauseAfterCancelled.exitCode, 1);
  assert.equal(
    pauseAfterCancelled.lines.at(-1),
    "La transition `pause` est interdite depuis le statut `cancelled`.",
  );
});

test("pause sur une mission deja blocked echoue explicitement", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-pause-blocked-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const pauseResult = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(pauseResult.exitCode, 0);
  assertLifecycleOutput(pauseResult.lines.join("\n"), missionId, "blocked");

  const doublePauseResult = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(doublePauseResult.exitCode, 1);
  assert.equal(
    doublePauseResult.lines.at(-1),
    "La transition `pause` est interdite depuis le statut `blocked`.",
  );
});

test("relaunch sur une mission deja ready echoue explicitement", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-relaunch-ready-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const relaunchResult = await runCommand([
    "mission",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(relaunchResult.exitCode, 1);
  assert.equal(
    relaunchResult.lines.at(-1),
    "La transition `relaunch` est interdite depuis le statut `ready`.",
  );
});

test("toutes les transitions sont interdites depuis les etats terminaux", async (t) => {
  const completedRootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-terminal-completed-"));
  const cancelledRootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lifecycle-terminal-cancelled-"));

  t.after(async () => {
    await rm(completedRootDir, { recursive: true, force: true });
    await rm(cancelledRootDir, { recursive: true, force: true });
  });

  const { missionId: completedMissionId } = await createMission(completedRootDir);
  const { missionId: cancelledMissionId } = await createMission(cancelledRootDir);

  await runCommand(["mission", "close", "--root", completedRootDir, "--mission-id", completedMissionId, "--outcome", "completed"]);
  await runCommand(["mission", "close", "--root", cancelledRootDir, "--mission-id", cancelledMissionId, "--outcome", "cancelled"]);

  const cases = [
    { rootDir: completedRootDir, missionId: completedMissionId, action: "pause", status: "completed" },
    { rootDir: completedRootDir, missionId: completedMissionId, action: "relaunch", status: "completed" },
    { rootDir: completedRootDir, missionId: completedMissionId, action: "close", status: "completed", extra: ["--outcome", "completed"] },
    { rootDir: cancelledRootDir, missionId: cancelledMissionId, action: "pause", status: "cancelled" },
    { rootDir: cancelledRootDir, missionId: cancelledMissionId, action: "relaunch", status: "cancelled" },
    { rootDir: cancelledRootDir, missionId: cancelledMissionId, action: "close", status: "cancelled", extra: ["--outcome", "cancelled"] },
  ];

  for (const testCase of cases) {
    const args = [
      "mission",
      testCase.action,
      "--root",
      testCase.rootDir,
      "--mission-id",
      testCase.missionId,
      ...(testCase.extra ?? []),
    ];

    const result = await runCommand(args);

    assert.equal(result.exitCode, 1, `${testCase.action} apres ${testCase.status} devrait echouer`);
    assert.equal(
      result.lines.at(-1),
      `La transition \`${testCase.action}\` est interdite depuis le statut \`${testCase.status}\`.`,
      `message inattendu pour ${testCase.action} apres ${testCase.status}`,
    );
  }
});
