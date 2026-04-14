import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    openTickets: TicketBoardEntry[];
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

async function createMission(rootDir: string): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission cancel",
    "--objective",
    "Annuler un prerequis sans perdre l'audit",
    "--success-criterion",
    "Le ticket annule reste visible au board",
    "--success-criterion",
    "Le dependent devient non runnable",
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
  options: {
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
    options.goal,
    "--owner",
    options.owner,
    "--success-criterion",
    "Le ticket existe",
  ];

  for (const dependencyId of options.dependsOn ?? []) {
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

async function writeTicketStatus(
  rootDir: string,
  missionId: string,
  ticketId: string,
  status: Ticket["status"],
): Promise<void> {
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "ticket.json",
  );
  const ticket = await readTicket(rootDir, missionId, ticketId);

  await writeFile(
    ticketPath,
    `${JSON.stringify({ ...ticket, status }, null, 2)}\n`,
    "utf8",
  );
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

test("mission ticket cancel garde le snapshot historique et bloque les dependants en projection", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cancel-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const prerequisiteTicketId = await createTicket(rootDir, mission.id, {
    goal: "Verifier le prerequis",
    owner: "agent_pre",
  });
  const dependentTicketId = await createTicket(rootDir, mission.id, {
    goal: "Executer le ticket dependant",
    owner: "agent_dep",
    dependsOn: [prerequisiteTicketId],
  });

  const cancelResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    prerequisiteTicketId,
    "--reason",
    "prerequis obsolete",
  ]);

  assert.equal(cancelResult.exitCode, 0);
  assert.equal(cancelResult.lines[0], `Ticket annule: ${prerequisiteTicketId}`);

  const updatedMission = await readMission(rootDir, mission.id);
  const cancelledTicket = await readTicket(rootDir, mission.id, prerequisiteTicketId);
  const dependentTicket = await readTicket(rootDir, mission.id, dependentTicketId);
  const journal = await readJournal(rootDir);
  const cancelledEvent = journal.at(-1);
  const ticketBoardProjection = await readJson<TicketBoardProjection>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );
  const resumeViewProjection = await readJson<ResumeViewProjection>(
    path.join(rootDir, ".corp", "projections", "resume-view.json"),
  );
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    prerequisiteTicketId,
    "ticket.json",
  );

  assert.ok(cancelledEvent);
  await access(ticketPath);

  assert.equal(updatedMission.status, "ready");
  assert.deepEqual(updatedMission.ticketIds, [prerequisiteTicketId, dependentTicketId]);
  assert.equal(updatedMission.resumeCursor, cancelledEvent.eventId);
  assert.equal(cancelledTicket.status, "cancelled");
  assert.equal(cancelledTicket.goal, "Verifier le prerequis");
  assert.equal(dependentTicket.status, "todo");
  assert.deepEqual(dependentTicket.dependsOn, [prerequisiteTicketId]);

  assert.equal(cancelledEvent.type, "ticket.cancelled");
  assert.equal(cancelledEvent.ticketId, prerequisiteTicketId);
  assert.equal(cancelledEvent.payload.previousStatus, "todo");
  assert.equal(cancelledEvent.payload.reason, "prerequis obsolete");
  assert.equal(cancelledEvent.payload.trigger, "operator");

  assert.deepEqual(ticketBoardProjection, {
    schemaVersion: 1,
    tickets: [
      {
        ticketId: prerequisiteTicketId,
        missionId: mission.id,
        title: "Verifier le prerequis",
        status: "cancelled",
        owner: "agent_pre",
        kind: "implement",
        dependsOn: [],
        allowedCapabilities: [],
        skillPackRefs: [],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 0,
        runnable: false,
        blockedByTicketIds: [],
        planningState: "not_runnable_status",
        dependencyStatuses: [],
        trackingState: "cancelled",
        statusReasonCode: "ticket_cancelled",
        blockingReasonCode: null,
        activeAttemptId: null,
        activeAttemptStatus: null,
        lastAttemptId: null,
        lastAttemptStatus: null,
        lastAttemptStartedAt: null,
        lastAttemptEndedAt: null,
        lastAttemptBackgroundRequested: null,
        lastAttemptWorkspaceIsolationId: null,
        updatedAt: cancelledTicket.updatedAt,
      },
      {
        ticketId: dependentTicketId,
        missionId: mission.id,
        title: "Executer le ticket dependant",
        status: "todo",
        owner: "agent_dep",
        kind: "implement",
        dependsOn: [prerequisiteTicketId],
        allowedCapabilities: [],
        skillPackRefs: [],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 1,
        runnable: false,
        blockedByTicketIds: [prerequisiteTicketId],
        planningState: "blocked_by_cancelled_dependency",
        dependencyStatuses: [
          {
            ticketId: prerequisiteTicketId,
            status: "cancelled",
            blocksRunnable: true,
          },
        ],
        trackingState: "blocked",
        statusReasonCode: "dependency_cancelled",
        blockingReasonCode: "dependency_cancelled",
        activeAttemptId: null,
        activeAttemptStatus: null,
        lastAttemptId: null,
        lastAttemptStatus: null,
        lastAttemptStartedAt: null,
        lastAttemptEndedAt: null,
        lastAttemptBackgroundRequested: null,
        lastAttemptWorkspaceIsolationId: null,
        updatedAt: dependentTicket.updatedAt,
      },
    ],
  });
  assert.deepEqual(resumeViewProjection.resume?.openTickets, [
    ticketBoardProjection.tickets[1],
  ]);
  assert.equal(
    resumeViewProjection.resume?.nextOperatorAction,
    "Aucun ticket n'est runnable pour le moment. Replanifiez ou debloquez la mission avant de poursuivre.",
  );

  const output = statusResult.lines.join("\n");
  assert.equal(statusResult.exitCode, 0);
  assert.match(output, new RegExp(`Tickets ouverts: ${dependentTicketId}`));
  assert.doesNotMatch(output, new RegExp(`Tickets ouverts: .*${prerequisiteTicketId}`));
  assert.match(
    output,
    /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./,
  );
});

test("mission ticket cancel rejette done et failed sans muter journal ni projections", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cancel-ticket-terminal-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket terminal",
    owner: "agent_terminal",
  });
  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    ticketId,
    "ticket.json",
  );
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  const cases: Array<{
    status: Ticket["status"];
    expectedMessage: string;
  }> = [
    {
      status: "done",
      expectedMessage: `Le ticket ${ticketId} est deja termine (statut: done).`,
    },
    {
      status: "failed",
      expectedMessage: `Le ticket ${ticketId} est deja en echec (statut: failed).`,
    },
  ];

  for (const testCase of cases) {
    await writeTicketStatus(rootDir, mission.id, ticketId, testCase.status);

    const beforeMission = await readFile(missionPath, "utf8");
    const beforeTicket = await readFile(ticketPath, "utf8");
    const beforeMissionStatus = await readFile(missionStatusPath, "utf8");
    const beforeTicketBoard = await readFile(ticketBoardPath, "utf8");
    const beforeResumeView = await readFile(resumeViewPath, "utf8");
    const beforeJournal = await readJournal(rootDir);

    const result = await runCommand([
      "mission",
      "ticket",
      "cancel",
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
      "--ticket-id",
      ticketId,
    ]);

    assert.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.status}`);
    assert.equal(
      result.lines.at(-1),
      testCase.expectedMessage,
      `message inattendu pour ${testCase.status}`,
    );
    assert.equal(await readFile(missionPath, "utf8"), beforeMission);
    assert.equal(await readFile(ticketPath, "utf8"), beforeTicket);
    assert.equal(await readFile(missionStatusPath, "utf8"), beforeMissionStatus);
    assert.equal(await readFile(ticketBoardPath, "utf8"), beforeTicketBoard);
    assert.equal(await readFile(resumeViewPath, "utf8"), beforeResumeView);
    assert.deepEqual(await readJournal(rootDir), beforeJournal);
  }
});
