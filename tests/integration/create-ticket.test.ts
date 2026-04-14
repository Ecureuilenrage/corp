import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { runCli } from "../../apps/corp-cli/src/index";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

interface JournalEventRecord {
  eventId: string;
  type: string;
  missionId: string;
  ticketId?: string;
  occurredAt: string;
  actor: string;
  source: string;
  payload: Record<string, unknown>;
}

interface TicketBoardEntry {
  ticketId: string;
  missionId: string;
  title: string;
  status: string;
  owner: string;
  kind: string;
  dependsOn: string[];
  allowedCapabilities: string[];
  skillPackRefs: string[];
  usedCapabilities: string[];
  usedSkillPacks: string[];
  planOrder: number;
  runnable: boolean;
  blockedByTicketIds: string[];
  planningState: string;
  dependencyStatuses: Array<{
    ticketId: string;
    status: string;
    blocksRunnable: boolean;
  }>;
  trackingState: string;
  statusReasonCode: string;
  blockingReasonCode: string | null;
  activeAttemptId: string | null;
  activeAttemptStatus: string | null;
  lastAttemptId: string | null;
  lastAttemptStatus: string | null;
  lastAttemptStartedAt: string | null;
  lastAttemptEndedAt: string | null;
  lastAttemptBackgroundRequested: boolean | null;
  lastAttemptWorkspaceIsolationId: string | null;
  updatedAt: string;
}

interface TicketBoardProjection {
  schemaVersion: 1;
  tickets: TicketBoardEntry[];
}

interface ResumeViewProjection {
  schemaVersion: 1;
  resume: {
    missionId: string;
    openTickets: Array<{ ticketId?: string; title?: string; status?: string }>;
    lastEventId: string;
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

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string, title = "Mission ticket"): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Structurer une delegation explicite",
    "--success-criterion",
    "Chaque ticket reste relancable",
    "--success-criterion",
    "Le resume operateur reste scannable",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  const mission = await readMission(rootDir, line.slice("Mission creee: ".length));
  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");

  await writeFile(
    missionPath,
    `${JSON.stringify({
      ...mission,
      authorizedExtensions: {
        allowedCapabilities: [],
        skillPackRefs: ["pack.core"],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  return readMission(rootDir, mission.id);
}

async function createTicket(
  rootDir: string,
  missionId: string,
  extraArgs: string[] = [],
): Promise<CommandResult> {
  return runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Livrer la delegation ticket",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket est persiste",
    "--success-criterion",
    "Le resume pointe vers le ticket",
    ...extraArgs,
  ]);
}

async function readMission(rootDir: string, missionId: string): Promise<Mission> {
  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", missionId, "mission.json"),
  );
}

async function readTicket(rootDir: string, missionId: string, ticketId: string): Promise<Ticket> {
  return readJson<Ticket>(
    path.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"),
  );
}

async function writeMissionStatus(
  rootDir: string,
  missionId: string,
  status: Mission["status"],
): Promise<void> {
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  const mission = await readMission(rootDir, missionId);

  await writeFile(
    missionPath,
    `${JSON.stringify({ ...mission, status }, null, 2)}\n`,
    "utf8",
  );
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

test("mission ticket create persiste le ticket, met a jour la mission et rafraichit les projections", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const initialMission = await createMission(rootDir);
  const initialJournal = await readJournal(rootDir);
  const initialEventId = initialJournal.at(-1)?.eventId;
  const artifactIndexPath = path.join(rootDir, ".corp", "projections", "artifact-index.json");
  const artifactIndexBefore = await readFile(artifactIndexPath, "utf8");
  const artifactIndexMtimeBefore = (await stat(artifactIndexPath)).mtimeMs;

  assert.ok(initialEventId);
  await new Promise((resolve) => setTimeout(resolve, 20));

  const result = await createTicket(rootDir, initialMission.id, [
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    " fs.read ",
    "--allow-capability",
    "cli.run",
    "--skill-pack",
    "pack.core",
    "--skill-pack",
    " pack.core ",
  ]);

  assert.equal(result.exitCode, 0);

  const createdLine = result.lines.find((line) => line.startsWith("Ticket cree: "));
  assert.ok(createdLine, "la sortie doit inclure l'identifiant de ticket");

  const ticketId = createdLine.slice("Ticket cree: ".length);
  const ticket = await readTicket(rootDir, initialMission.id, ticketId);
  const updatedMission = await readMission(rootDir, initialMission.id);
  const journal = await readJournal(rootDir);
  const createdEvent = journal.at(-1);

  assert.ok(createdEvent);
  assert.match(ticket.id, /^ticket_/);
  assert.equal(ticket.id, ticketId);
  assert.equal(ticket.missionId, initialMission.id);
  assert.equal(ticket.kind, "implement");
  assert.equal(ticket.goal, "Livrer la delegation ticket");
  assert.equal(ticket.status, "todo");
  assert.equal(ticket.owner, "agent_dev");
  assert.deepEqual(ticket.dependsOn, []);
  assert.deepEqual(ticket.successCriteria, [
    "Le ticket est persiste",
    "Le resume pointe vers le ticket",
  ]);
  assert.deepEqual(ticket.allowedCapabilities, ["fs.read", "cli.run"]);
  assert.deepEqual(ticket.skillPackRefs, ["pack.core"]);
  assert.equal(ticket.workspaceIsolationId, null);
  assert.deepEqual(ticket.executionHandle, {
    adapter: "codex_responses",
    adapterState: {},
  });
  assert.deepEqual(ticket.artifactIds, []);
  assert.deepEqual(ticket.eventIds, [createdEvent.eventId]);
  assert.equal(ticket.createdAt, ticket.updatedAt);

  assert.equal(updatedMission.id, initialMission.id);
  assert.equal(updatedMission.createdAt, initialMission.createdAt);
  assert.equal(updatedMission.policyProfileId, initialMission.policyProfileId);
  assert.equal(updatedMission.status, initialMission.status);
  assert.deepEqual(updatedMission.artifactIds, initialMission.artifactIds);
  assert.deepEqual(updatedMission.ticketIds, [ticketId]);
  assert.deepEqual(updatedMission.eventIds, [initialEventId, createdEvent.eventId]);
  assert.equal(updatedMission.resumeCursor, createdEvent.eventId);
  assert.equal(updatedMission.updatedAt, createdEvent.occurredAt);

  assert.equal(journal.length, 2);
  assert.equal(createdEvent.type, "ticket.created");
  assert.equal(createdEvent.missionId, initialMission.id);
  assert.equal(createdEvent.ticketId, ticketId);
  assert.equal(createdEvent.actor, "operator");
  assert.equal(createdEvent.source, "corp-cli");
  assert.deepEqual(createdEvent.payload, {
    mission: updatedMission,
    ticket,
  });

  const missionStatusProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "mission-status.json"),
  );
  const ticketBoardProjection = await readJson<TicketBoardProjection>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );
  const resumeViewProjection = await readJson<ResumeViewProjection>(
    path.join(rootDir, ".corp", "projections", "resume-view.json"),
  );
  const artifactIndexAfter = await readFile(artifactIndexPath, "utf8");
  const artifactIndexMtimeAfter = (await stat(artifactIndexPath)).mtimeMs;

  assert.deepEqual(missionStatusProjection, {
    schemaVersion: 1,
    mission: updatedMission,
  });
  assert.deepEqual(ticketBoardProjection, {
    schemaVersion: 1,
    tickets: [
      {
        ticketId,
        missionId: initialMission.id,
        title: "Livrer la delegation ticket",
        status: "todo",
        owner: "agent_dev",
        kind: "implement",
        dependsOn: [],
        allowedCapabilities: ["fs.read", "cli.run"],
        skillPackRefs: ["pack.core"],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 0,
        runnable: true,
        blockedByTicketIds: [],
        planningState: "runnable",
        dependencyStatuses: [],
        trackingState: "runnable",
        statusReasonCode: "runnable",
        blockingReasonCode: null,
        activeAttemptId: null,
        activeAttemptStatus: null,
        lastAttemptId: null,
        lastAttemptStatus: null,
        lastAttemptStartedAt: null,
        lastAttemptEndedAt: null,
        lastAttemptBackgroundRequested: null,
        lastAttemptWorkspaceIsolationId: null,
        updatedAt: ticket.updatedAt,
      },
    ],
  });
  assert.deepEqual(resumeViewProjection.resume?.openTickets, [
    {
      ticketId,
      missionId: initialMission.id,
      title: "Livrer la delegation ticket",
      status: "todo",
      owner: "agent_dev",
      kind: "implement",
      dependsOn: [],
      allowedCapabilities: ["fs.read", "cli.run"],
      skillPackRefs: ["pack.core"],
      usedCapabilities: [],
      usedSkillPacks: [],
      planOrder: 0,
      runnable: true,
      blockedByTicketIds: [],
      planningState: "runnable",
      dependencyStatuses: [],
      trackingState: "runnable",
      statusReasonCode: "runnable",
      blockingReasonCode: null,
      activeAttemptId: null,
      activeAttemptStatus: null,
      lastAttemptId: null,
      lastAttemptStatus: null,
      lastAttemptStartedAt: null,
      lastAttemptEndedAt: null,
      lastAttemptBackgroundRequested: null,
      lastAttemptWorkspaceIsolationId: null,
      updatedAt: ticket.updatedAt,
    },
  ]);
  assert.equal(resumeViewProjection.resume?.lastEventId, createdEvent.eventId);
  assert.equal(
    resumeViewProjection.resume?.nextOperatorAction,
    "Traitez le prochain ticket runnable: Livrer la delegation ticket.",
  );
  assert.equal(artifactIndexAfter, artifactIndexBefore);
  assert.equal(artifactIndexMtimeAfter, artifactIndexMtimeBefore);

  const output = result.lines.join("\n");
  assert.match(output, new RegExp(`Ticket cree: ${ticketId}`));
  assert.match(output, new RegExp(`Mission: ${initialMission.id}`));
  assert.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
  assert.match(
    output,
    /Prochain arbitrage utile: Traitez le prochain ticket runnable: Livrer la delegation ticket\./,
  );
});

test("mission ticket create rejette une dependance inconnue et une dependance cross-mission sans muter l'etat", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-ticket-dependencies-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const missionA = await createMission(rootDir, "Mission A");
  const missionB = await createMission(rootDir, "Mission B");
  const initialJournal = await readJournal(rootDir);

  const missionBTicketResult = await createTicket(rootDir, missionB.id, [
    "--kind",
    "research",
    "--goal",
    "Explorer la mission B",
    "--owner",
    "agent_research",
    "--success-criterion",
    "Le ticket B existe",
  ]);
  assert.equal(missionBTicketResult.exitCode, 0);

  const ticketBLine = missionBTicketResult.lines.find((line) => line.startsWith("Ticket cree: "));
  assert.ok(ticketBLine);
  const ticketBId = ticketBLine.slice("Ticket cree: ".length);
  const initialMissionA = await readMission(rootDir, missionA.id);
  const boardBeforeFailures = await readJson<TicketBoardProjection>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );

  const unknownDependencyResult = await createTicket(rootDir, missionA.id, [
    "--depends-on",
    "ticket_inconnu",
  ]);

  assert.equal(unknownDependencyResult.exitCode, 1);
  assert.equal(
    unknownDependencyResult.lines.at(-1),
    `La dependance \`ticket_inconnu\` est introuvable dans la mission \`${missionA.id}\`.`,
  );

  const crossMissionDependencyResult = await createTicket(rootDir, missionA.id, [
    "--depends-on",
    ticketBId,
  ]);

  assert.equal(crossMissionDependencyResult.exitCode, 1);
  assert.equal(
    crossMissionDependencyResult.lines.at(-1),
    `La dependance \`${ticketBId}\` n'appartient pas a la mission \`${missionA.id}\`.`,
  );

  const finalMissionA = await readMission(rootDir, missionA.id);
  const finalJournal = await readJournal(rootDir);
  const finalBoard = await readJson<TicketBoardProjection>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );

  assert.deepEqual(finalMissionA, initialMissionA);
  assert.equal(
    finalMissionA.updatedAt,
    initialMissionA.updatedAt,
    "missionA.updatedAt ne doit pas changer apres un echec de dependance invalide",
  );
  assert.equal(finalJournal.length, initialJournal.length + 1);
  assert.deepEqual(finalBoard, boardBeforeFailures);
});

test("mission ticket create accepte les missions blocked sans changer leur statut", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-ticket-non-terminal-statuses-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir, "Mission blocked");
  await writeMissionStatus(rootDir, mission.id, "blocked");

  const missionBefore = await readMission(rootDir, mission.id);
  const ticketResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Creer un ticket sur mission blocked",
    "--owner",
    "agent_blocked",
    "--success-criterion",
    "Le ticket est persiste",
  ]);

  assert.equal(ticketResult.exitCode, 0, "la creation doit reussir pour blocked");

  const createdLine = ticketResult.lines.find((line) => line.startsWith("Ticket cree: "));
  assert.ok(createdLine, "la creation doit annoncer le ticket pour blocked");

  const ticketId = createdLine!.slice("Ticket cree: ".length);
  const missionAfter = await readMission(rootDir, mission.id);
  const ticket = await readTicket(rootDir, mission.id, ticketId);

  assert.equal(ticket.missionId, mission.id);
  assert.equal(ticket.owner, "agent_blocked");
  assert.equal(missionAfter.status, "blocked");
  assert.deepEqual(missionAfter.ticketIds, [...missionBefore.ticketIds, ticketId]);
});

test("mission ticket create refuse les missions failed sans modifier leur historique", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-ticket-failed-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission failed");
  await writeMissionStatus(rootDir, mission.id, "failed");
  const missionBefore = await readMission(rootDir, mission.id);
  const journalBefore = await readJournal(rootDir);

  const ticketResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Creer un ticket sur mission failed",
    "--owner",
    "agent_failed",
    "--success-criterion",
    "Le ticket est persiste",
  ]);

  assert.equal(ticketResult.exitCode, 1, "la creation doit echouer pour failed");
  assert.ok(
    ticketResult.lines.some((line) => line.includes("statut est terminal")),
    "le message doit mentionner statut terminal",
  );
  const missionAfter = await readMission(rootDir, mission.id);
  assert.deepEqual(missionAfter, missionBefore);
  assert.deepEqual(await readJournal(rootDir), journalBefore);
});

test("mission ticket create refuse les missions completed ou cancelled sans modifier leur historique", async (t) => {
  const completedRootDir = await mkdtemp(path.join(tmpdir(), "corp-create-ticket-completed-"));
  const cancelledRootDir = await mkdtemp(path.join(tmpdir(), "corp-create-ticket-cancelled-"));

  t.after(async () => {
    await rm(completedRootDir, { recursive: true, force: true });
    await rm(cancelledRootDir, { recursive: true, force: true });
  });

  for (const [rootDir, outcome] of [
    [completedRootDir, "completed"],
    [cancelledRootDir, "cancelled"],
  ] as const) {
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, `Mission ${outcome}`);
    const closeResult = await runCommand([
      "mission",
      "close",
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
      "--outcome",
      outcome,
    ]);

    assert.equal(closeResult.exitCode, 0);

    const missionBefore = await readMission(rootDir, mission.id);
    const journalBefore = await readJournal(rootDir);

    const ticketResult = await createTicket(rootDir, mission.id);

    assert.equal(ticketResult.exitCode, 1);
    assert.equal(
      ticketResult.lines.at(-1),
      `Impossible de creer un ticket dans la mission \`${mission.id}\` car son statut est terminal (\`${outcome}\`).`,
    );

    const missionAfter = await readMission(rootDir, mission.id);
    const journalAfter = await readJournal(rootDir);

    assert.deepEqual(missionAfter, missionBefore);
    assert.deepEqual(journalAfter, journalBefore);
  }
});
