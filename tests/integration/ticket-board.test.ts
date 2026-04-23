import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ExecutionAttempt, ExecutionAttemptStatus } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket, TicketStatus } from "../../packages/contracts/src/ticket/ticket";
import { runCli } from "../../apps/corp-cli/src/index";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

interface TicketBoardDependencyStatus {
  ticketId: string;
  status: string;
  blocksRunnable: boolean;
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
  dependencyStatuses: TicketBoardDependencyStatus[];
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

async function createMission(rootDir: string, title = "Mission board"): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Suivre l'etat detaille des tickets",
    "--success-criterion",
    "Le board mission est lisible",
    "--success-criterion",
    "Les blocages restent explicites",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return readMission(rootDir, line.slice("Mission creee: ".length));
}

async function createTicket(
  rootDir: string,
  missionId: string,
  input: {
    goal: string;
    owner: string;
    dependsOn?: string[];
  },
): Promise<string> {
  const args = [
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
    input.goal,
    "--owner",
    input.owner,
    "--success-criterion",
    "Le ticket existe",
  ];

  for (const dependencyId of input.dependsOn ?? []) {
    args.push("--depends-on", dependencyId);
  }

  const result = await runCommand(args);
  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return line.slice("Ticket cree: ".length);
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

async function writeTicketSnapshot(
  rootDir: string,
  missionId: string,
  ticketId: string,
  update: (ticket: Ticket) => Ticket,
): Promise<Ticket> {
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "ticket.json",
  );
  const currentTicket = await readTicket(rootDir, missionId, ticketId);
  const nextTicket = update(currentTicket);

  await writeFile(ticketPath, `${JSON.stringify(nextTicket, null, 2)}\n`, "utf8");

  return nextTicket;
}

async function writeAttemptSnapshot(
  rootDir: string,
  missionId: string,
  ticketId: string,
  input: {
    attemptId: string;
    status: ExecutionAttemptStatus;
    startedAt: string;
    endedAt?: string | null;
    backgroundRequested?: boolean;
    workspaceIsolationId?: string;
    adapterState?: Record<string, unknown>;
  },
): Promise<ExecutionAttempt> {
  const attemptDir = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "attempts",
    input.attemptId,
  );
  const attemptPath = path.join(attemptDir, "attempt.json");
  const attempt: ExecutionAttempt = {
    id: input.attemptId,
    ticketId,
    adapter: "codex_responses",
    status: input.status,
    workspaceIsolationId: input.workspaceIsolationId ?? `iso_${input.attemptId}`,
    backgroundRequested: input.backgroundRequested ?? true,
    adapterState: {
      responseId: `resp_${input.attemptId}`,
      pollCursor: `cursor_${input.attemptId}`,
      model: "gpt-5-codex",
      vendorStatus: "opaque",
      ...input.adapterState,
    },
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
  };

  await mkdir(attemptDir, { recursive: true });
  await writeFile(attemptPath, `${JSON.stringify(attempt, null, 2)}\n`, "utf8");

  return attempt;
}

function ticketBoardPath(rootDir: string): string {
  return path.join(rootDir, ".corp", "projections", "ticket-board.json");
}

test("mission ticket board reconstruit une projection absente, expose les statuts coeur et masque adapterState", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-statuses-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission supervision");
  const ticketIds = [
    await createTicket(rootDir, mission.id, { goal: "Ticket runnable", owner: "agent_todo" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket claimed", owner: "agent_claimed" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket actif", owner: "agent_run" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket bloque", owner: "agent_blocked" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket approval", owner: "agent_approval" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket done", owner: "agent_done" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket failed", owner: "agent_failed" }),
    await createTicket(rootDir, mission.id, { goal: "Ticket cancelled", owner: "agent_cancel" }),
  ];

  const [
    todoTicketId,
    claimedTicketId,
    runningTicketId,
    blockedTicketId,
    approvalTicketId,
    doneTicketId,
    failedTicketId,
    cancelledTicketId,
  ] = ticketIds;

  const statusByTicketId = new Map<string, TicketStatus>([
    [todoTicketId, "todo"],
    [claimedTicketId, "claimed"],
    [runningTicketId, "in_progress"],
    [blockedTicketId, "blocked"],
    [approvalTicketId, "awaiting_approval"],
    [doneTicketId, "done"],
    [failedTicketId, "failed"],
    [cancelledTicketId, "cancelled"],
  ]);

  for (const ticketId of ticketIds) {
    await writeTicketSnapshot(rootDir, mission.id, ticketId, (ticket) => ({
      ...ticket,
      status: statusByTicketId.get(ticketId) ?? ticket.status,
      updatedAt: `2026-04-09T12:${String(ticketIds.indexOf(ticketId)).padStart(2, "0")}:00.000Z`,
    }));
  }

  await writeAttemptSnapshot(rootDir, mission.id, claimedTicketId, {
    attemptId: "attempt_claimed_board",
    status: "requested",
    startedAt: "2026-04-09T12:01:00.000Z",
  });
  await writeAttemptSnapshot(rootDir, mission.id, runningTicketId, {
    attemptId: "attempt_running_board",
    status: "running",
    startedAt: "2026-04-09T12:02:00.000Z",
  });
  await writeAttemptSnapshot(rootDir, mission.id, approvalTicketId, {
    attemptId: "attempt_approval_board",
    status: "awaiting_approval",
    startedAt: "2026-04-09T12:04:00.000Z",
  });
  await writeAttemptSnapshot(rootDir, mission.id, doneTicketId, {
    attemptId: "attempt_done_board",
    status: "completed",
    startedAt: "2026-04-09T12:05:00.000Z",
    endedAt: "2026-04-09T12:06:00.000Z",
  });
  await writeAttemptSnapshot(rootDir, mission.id, failedTicketId, {
    attemptId: "attempt_failed_board",
    status: "failed",
    startedAt: "2026-04-09T12:06:00.000Z",
    endedAt: "2026-04-09T12:07:00.000Z",
  });

  await rm(ticketBoardPath(rootDir), { force: true });

  const boardResult = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(boardResult.exitCode, 0);
  assert.equal(statusResult.exitCode, 0);
  assert.equal(resumeResult.exitCode, 0);

  const projection = await readJson<TicketBoardProjection>(ticketBoardPath(rootDir));
  const projectionJson = JSON.stringify(projection);
  const boardOutput = boardResult.lines.join("\n");
  const statusOutput = statusResult.lines.join("\n");
  const resumeOutput = resumeResult.lines.join("\n");

  assert.deepEqual(
    projection.tickets.map((ticket) => ticket.ticketId),
    ticketIds,
  );
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === todoTicketId)?.trackingState, "runnable");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === todoTicketId)?.statusReasonCode, "runnable");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === claimedTicketId)?.trackingState, "active");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === claimedTicketId)?.activeAttemptStatus, "requested");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === runningTicketId)?.trackingState, "active");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === runningTicketId)?.activeAttemptStatus, "running");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === blockedTicketId)?.blockingReasonCode, "ticket_blocked");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === approvalTicketId)?.trackingState, "awaiting_approval");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === approvalTicketId)?.activeAttemptStatus, "awaiting_approval");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === doneTicketId)?.lastAttemptStatus, "completed");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === failedTicketId)?.lastAttemptStatus, "failed");
  assert.equal(projection.tickets.find((ticket) => ticket.ticketId === cancelledTicketId)?.trackingState, "cancelled");

  assert.match(boardOutput, new RegExp(`Mission: ${mission.id}`));
  assert.match(boardOutput, /Etat des tickets:/);
  assert.match(boardOutput, new RegExp(`${todoTicketId} \\| statut=todo \\| owner=agent_todo`));
  assert.match(boardOutput, new RegExp(`${claimedTicketId} \\| statut=claimed \\| owner=agent_claimed`));
  assert.match(boardOutput, new RegExp(`${runningTicketId} \\| statut=in_progress \\| owner=agent_run`));
  assert.match(boardOutput, new RegExp(`${blockedTicketId} \\| statut=blocked \\| owner=agent_blocked`));
  assert.match(boardOutput, new RegExp(`${approvalTicketId} \\| statut=awaiting_approval \\| owner=agent_approval`));
  assert.match(boardOutput, new RegExp(`${doneTicketId} \\| statut=done \\| owner=agent_done`));
  assert.match(boardOutput, new RegExp(`${failedTicketId} \\| statut=failed \\| owner=agent_failed`));
  assert.match(boardOutput, new RegExp(`${cancelledTicketId} \\| statut=cancelled \\| owner=agent_cancel`));
  assert.match(statusOutput, /Etat des tickets:/);
  assert.doesNotMatch(resumeOutput, /Etat des tickets:/);
  assert.doesNotMatch(resumeOutput, new RegExp(`${todoTicketId} \\| statut=todo`));

  for (const hiddenValue of [
    "resp_attempt_claimed_board",
    "cursor_attempt_running_board",
    "gpt-5-codex",
    "opaque",
  ]) {
    assert.doesNotMatch(boardOutput, new RegExp(hiddenValue));
    assert.doesNotMatch(statusOutput, new RegExp(hiddenValue));
    assert.doesNotMatch(resumeOutput, new RegExp(hiddenValue));
    assert.doesNotMatch(projectionJson, new RegExp(hiddenValue));
  }
});

test("mission ticket board distingue les prerequis en attente, resolus, annules et en echec sans casser l'ordre canonique", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-dependencies-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission dependances");
  const prerequisiteTicketId = await createTicket(rootDir, mission.id, {
    goal: "Prerequis canonique",
    owner: "agent_pre",
  });
  const dependentTicketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket dependant",
    owner: "agent_dep",
    dependsOn: [prerequisiteTicketId],
  });

  const readBoardProjection = async (): Promise<{
    command: CommandResult;
    projection: TicketBoardProjection;
  }> => {
    const command = await runCommand([
      "mission",
      "ticket",
      "board",
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
    ]);

    return {
      command,
      projection: await readJson<TicketBoardProjection>(ticketBoardPath(rootDir)),
    };
  };

  let result = await readBoardProjection();
  assert.equal(result.command.exitCode, 0);
  assert.deepEqual(
    result.projection.tickets.map((ticket) => ticket.ticketId),
    [prerequisiteTicketId, dependentTicketId],
  );
  assert.equal(result.projection.tickets[1]?.runnable, false);
  assert.equal(result.projection.tickets[1]?.planningState, "waiting_on_dependencies");
  assert.equal(result.projection.tickets[1]?.blockingReasonCode, "dependency_pending");
  assert.deepEqual(result.projection.tickets[1]?.blockedByTicketIds, [prerequisiteTicketId]);
  assert.deepEqual(result.projection.tickets[1]?.dependencyStatuses, [
    {
      ticketId: prerequisiteTicketId,
      status: "todo",
      blocksRunnable: true,
    },
  ]);
  assert.match(result.command.lines.join("\n"), /motif=prerequis en attente/);

  await writeTicketSnapshot(rootDir, mission.id, prerequisiteTicketId, (ticket) => ({
    ...ticket,
    status: "done",
    updatedAt: "2026-04-09T13:00:00.000Z",
  }));

  result = await readBoardProjection();
  assert.equal(result.projection.tickets[1]?.runnable, true);
  assert.equal(result.projection.tickets[1]?.planningState, "runnable");
  assert.equal(result.projection.tickets[1]?.blockingReasonCode, null);
  assert.equal(result.projection.tickets[1]?.statusReasonCode, "runnable");
  assert.match(result.command.lines.join("\n"), /motif=pret a lancer/);

  await writeTicketSnapshot(rootDir, mission.id, prerequisiteTicketId, (ticket) => ({
    ...ticket,
    status: "cancelled",
    updatedAt: "2026-04-09T13:01:00.000Z",
  }));

  result = await readBoardProjection();
  assert.equal(result.projection.tickets[1]?.runnable, false);
  assert.equal(result.projection.tickets[1]?.planningState, "blocked_by_cancelled_dependency");
  assert.equal(result.projection.tickets[1]?.blockingReasonCode, "dependency_cancelled");
  assert.match(result.command.lines.join("\n"), /motif=prerequis annule/);

  await writeTicketSnapshot(rootDir, mission.id, prerequisiteTicketId, (ticket) => ({
    ...ticket,
    status: "failed",
    updatedAt: "2026-04-09T13:02:00.000Z",
  }));

  result = await readBoardProjection();
  assert.equal(result.projection.tickets[1]?.runnable, false);
  assert.equal(result.projection.tickets[1]?.planningState, "blocked_by_failed_dependency");
  assert.equal(result.projection.tickets[1]?.blockingReasonCode, "dependency_failed");
  assert.match(result.command.lines.join("\n"), /motif=prerequis en echec/);
});

test("mission ticket board garde la chaine de blocages explicite quand un prerequis intermediaire est bloque", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-blocked-chain-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission blocages en chaine");
  const ticketC = await createTicket(rootDir, mission.id, {
    goal: "Ticket C runnable",
    owner: "agent_c",
  });
  const ticketB = await createTicket(rootDir, mission.id, {
    goal: "Ticket B bloque",
    owner: "agent_b",
    dependsOn: [ticketC],
  });
  const ticketA = await createTicket(rootDir, mission.id, {
    goal: "Ticket A attend B",
    owner: "agent_a",
    dependsOn: [ticketB],
  });

  await writeTicketSnapshot(rootDir, mission.id, ticketB, (ticket) => ({
    ...ticket,
    status: "blocked",
    updatedAt: "2026-04-10T12:00:00.000Z",
  }));

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const projection = await readJson<TicketBoardProjection>(ticketBoardPath(rootDir));
  const entryA = projection.tickets.find((ticket) => ticket.ticketId === ticketA);
  const entryB = projection.tickets.find((ticket) => ticket.ticketId === ticketB);
  const entryC = projection.tickets.find((ticket) => ticket.ticketId === ticketC);

  assert.equal(result.exitCode, 0);
  assert.ok(entryA);
  assert.ok(entryB);
  assert.ok(entryC);
  assert.equal(entryA.planningState, "waiting_on_dependencies");
  assert.equal(entryA.trackingState, "blocked");
  assert.deepEqual(entryA.blockedByTicketIds, [ticketB]);
  assert.equal(entryB.trackingState, "blocked");
  assert.equal(entryB.statusReasonCode, "ticket_blocked");
  assert.equal(entryC.runnable, true);
  assert.equal(entryC.trackingState, "runnable");
});

test("mission ticket board ne reecrit pas une projection equivalente quand seules les cles JSON changent d'ordre", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-equivalent-projection-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission projection equivalente");
  await createTicket(rootDir, mission.id, {
    goal: "Ticket projection stable",
    owner: "agent_projection",
  });

  const originalProjection = await readJson<TicketBoardProjection>(ticketBoardPath(rootDir));
  const reorderedProjection = {
    tickets: originalProjection.tickets.map((ticket) => ({
      updatedAt: ticket.updatedAt,
      lastAttemptWorkspaceIsolationId: ticket.lastAttemptWorkspaceIsolationId,
      lastAttemptBackgroundRequested: ticket.lastAttemptBackgroundRequested,
      lastAttemptEndedAt: ticket.lastAttemptEndedAt,
      lastAttemptStartedAt: ticket.lastAttemptStartedAt,
      lastAttemptStatus: ticket.lastAttemptStatus,
      lastAttemptId: ticket.lastAttemptId,
      activeAttemptStatus: ticket.activeAttemptStatus,
      activeAttemptId: ticket.activeAttemptId,
      blockingReasonCode: ticket.blockingReasonCode,
      statusReasonCode: ticket.statusReasonCode,
      trackingState: ticket.trackingState,
      dependencyStatuses: ticket.dependencyStatuses.map((dependencyStatus) => ({
        blocksRunnable: dependencyStatus.blocksRunnable,
        status: dependencyStatus.status,
        ticketId: dependencyStatus.ticketId,
      })),
      planningState: ticket.planningState,
      blockedByTicketIds: [...ticket.blockedByTicketIds],
      runnable: ticket.runnable,
      planOrder: ticket.planOrder,
      skillPackRefs: [...ticket.skillPackRefs],
      allowedCapabilities: [...ticket.allowedCapabilities],
      usedSkillPacks: [...ticket.usedSkillPacks],
      usedCapabilities: [...ticket.usedCapabilities],
      dependsOn: [...ticket.dependsOn],
      kind: ticket.kind,
      owner: ticket.owner,
      status: ticket.status,
      title: ticket.title,
      missionId: ticket.missionId,
      ticketId: ticket.ticketId,
    })),
    schemaVersion: 1 as const,
  };
  const reorderedProjectionJson = `${JSON.stringify(reorderedProjection, null, 2)}\n`;

  await writeFile(ticketBoardPath(rootDir), reorderedProjectionJson, "utf8");

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(await readFile(ticketBoardPath(rootDir), "utf8"), reorderedProjectionJson);
});

test("mission ticket board echoue proprement si la projection est irreconciliable sans snapshots exploitables", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-irreconcilable-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission irreconciliable");

  await createTicket(rootDir, mission.id, {
    goal: "Ticket a corrompre",
    owner: "agent_break",
  });
  const buildTicketBoardModule = require("../../packages/ticket-runtime/src/planner/build-ticket-board") as {
    buildTicketBoardProjection: (
      mission: Mission,
      tickets: Ticket[],
      attempts?: ExecutionAttempt[],
    ) => TicketBoardProjection;
  };
  const originalBuildTicketBoardProjection = buildTicketBoardModule.buildTicketBoardProjection;

  buildTicketBoardModule.buildTicketBoardProjection = () => {
    throw new Error("incoherence logique entre journal et snapshots");
  };

  t.after(() => {
    buildTicketBoardModule.buildTicketBoardProjection = originalBuildTicketBoardProjection;
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Projection ticket-board irreconciliable pour ${mission.id}. Impossible d'afficher le board des tickets.`,
  );
});

test("mission ticket board remonte une erreur fichier explicite sur EPERM", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-fs-error-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission erreur fichier");

  await createTicket(rootDir, mission.id, {
    goal: "Ticket lecture projection",
    owner: "agent_fs",
  });

  const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store") as {
    readProjectionFile: (
      projectionsDir: string,
      projectionName: string,
    ) => Promise<string>;
  };
  const originalReadProjectionFile = projectionStoreModule.readProjectionFile;

  projectionStoreModule.readProjectionFile = async (
    ...args: Parameters<typeof originalReadProjectionFile>
  ): Promise<string> => {
    if (args[1] === "ticket-board") {
      const error = new Error("EPERM: permission denied, open ticket-board.json") as NodeJS.ErrnoException;
      error.code = "EPERM";
      throw error;
    }

    return originalReadProjectionFile(...args);
  };

  t.after(() => {
    projectionStoreModule.readProjectionFile = originalReadProjectionFile;
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(result.exitCode, 1);
  assert.match(
    result.lines.at(-1) ?? "",
    /erreur_fichier: erreur de lecture projection ticket-board \(EPERM\).*ticket-board\.json/,
  );
  assert.doesNotMatch(result.lines.at(-1) ?? "", /irreconciliable/);
});

test("mission ticket board signale une projection corrompue au lieu de la masquer", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-corrupted-projection-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission projection corrompue");

  await createTicket(rootDir, mission.id, {
    goal: "Ticket json corrompu",
    owner: "agent_json",
  });

  await writeFile(ticketBoardPath(rootDir), "{corrupted", "utf8");

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(result.exitCode, 1);
  assert.match(result.lines.at(-1) ?? "", /Projection ticket-board corrompue:/);
  assert.match(result.lines.at(-1) ?? "", /ticket-board\.json/);
});

test("mission ticket board lit un snapshot ticket avec statut inconnu sans casser la projection", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-ticket-board-unknown-status-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission statut inconnu");
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket forge avec statut inconnu",
    owner: "agent_unknown",
  });

  await writeTicketSnapshot(rootDir, mission.id, ticketId, (ticket) => ({
    ...ticket,
    status: "on_hold" as TicketStatus,
    updatedAt: "2026-04-10T11:11:11.000Z",
  }));

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const projection = await readJson<TicketBoardProjection>(ticketBoardPath(rootDir));
  const entry = projection.tickets.find((ticket) => ticket.ticketId === ticketId);

  assert.equal(result.exitCode, 0);
  assert.ok(entry);
  assert.equal(entry.runnable, false);
  assert.equal(entry.planningState, "not_runnable_status");
  assert.equal(entry.trackingState, "blocked");
  assert.equal(entry.status, "on_hold");
  assert.equal(entry.statusReasonCode, "ticket_blocked");
  assert.match(result.lines.join("\n"), new RegExp(`${ticketId} \\| statut=on_hold \\| owner=agent_unknown`));
  assert.match(result.lines.join("\n"), /motif=ticket bloque/);
});
