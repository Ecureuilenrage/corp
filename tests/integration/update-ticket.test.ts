import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { runCli } from "../../apps/corp-cli/src/index";
import { updateTicket } from "../../packages/ticket-runtime/src/ticket-service/update-ticket";

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

interface CreateTicketInput {
  kind?: string;
  goal: string;
  owner: string;
  successCriteria: string[];
  dependsOn?: string[];
  allowedCapabilities?: string[];
  skillPackRefs?: string[];
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
    "Mission replanning",
    "--objective",
    "Faire evoluer un plan ticket sans perdre le resume",
    "--success-criterion",
    "Le plan est reordonnable",
    "--success-criterion",
    "Le runnable set reste deterministe",
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
        skillPackRefs: ["pack.plan", "pack.audit"],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  return readMission(rootDir, mission.id);
}

async function createTicket(
  rootDir: string,
  missionId: string,
  input: CreateTicketInput,
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
    input.kind ?? "implement",
    "--goal",
    input.goal,
    "--owner",
    input.owner,
  ];

  for (const successCriterion of input.successCriteria) {
    args.push("--success-criterion", successCriterion);
  }

  for (const dependencyId of input.dependsOn ?? []) {
    args.push("--depends-on", dependencyId);
  }

  for (const allowedCapability of input.allowedCapabilities ?? []) {
    args.push("--allow-capability", allowedCapability);
  }

  for (const skillPackRef of input.skillPackRefs ?? []) {
    args.push("--skill-pack", skillPackRef);
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

test("mission ticket update puis move recalculent le plan canonique, le board et la reprise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketA = await createTicket(rootDir, mission.id, {
    goal: "Verifier les prerequis",
    owner: "agent_research",
    successCriteria: ["Les prerequis sont identifies"],
  });
  const ticketB = await createTicket(rootDir, mission.id, {
    goal: "Assembler le plan",
    owner: "agent_plan",
    successCriteria: ["Le plan initial existe"],
    dependsOn: [ticketA],
  });
  const ticketC = await createTicket(rootDir, mission.id, {
    goal: "Documenter la decision",
    owner: "agent_doc",
    successCriteria: ["La decision est tracee"],
  });

  const updateResult = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketB,
    "--goal",
    "Assembler le plan final",
    "--owner",
    "agent_coord",
    "--success-criterion",
    "Le plan final est consolide",
    "--success-criterion",
    " Le plan final est consolide ",
    "--success-criterion",
    "La delegation reste auditable",
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    " fs.read ",
    "--allow-capability",
    "cli.run",
    "--skill-pack",
    "pack.plan",
    "--skill-pack",
    " pack.plan ",
  ]);

  assert.equal(updateResult.exitCode, 0);
  assert.equal(updateResult.lines[0], `Ticket mis a jour: ${ticketB}`);

  const moveResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketB,
    "--to-front",
  ]);

  assert.equal(moveResult.exitCode, 0);
  assert.equal(moveResult.lines[0], `Ticket deplace: ${ticketB}`);

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicketB = await readTicket(rootDir, mission.id, ticketB);
  const updatedTicketA = await readTicket(rootDir, mission.id, ticketA);
  const updatedTicketC = await readTicket(rootDir, mission.id, ticketC);
  const journal = await readJournal(rootDir);
  const updatedEvent = journal.at(-2);
  const movedEvent = journal.at(-1);
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

  assert.ok(updatedEvent);
  assert.ok(movedEvent);
  assert.equal(updatedTicketB.goal, "Assembler le plan final");
  assert.equal(updatedTicketB.owner, "agent_coord");
  assert.deepEqual(updatedTicketB.successCriteria, [
    "Le plan final est consolide",
    "La delegation reste auditable",
  ]);
  assert.deepEqual(updatedTicketB.dependsOn, [ticketA]);
  assert.deepEqual(updatedTicketB.allowedCapabilities, ["fs.read", "cli.run"]);
  assert.deepEqual(updatedTicketB.skillPackRefs, ["pack.plan"]);
  assert.equal(updatedTicketB.executionHandle.adapter, "codex_responses");
  assert.deepEqual(updatedTicketB.artifactIds, []);
  assert.equal(updatedTicketB.createdAt < updatedTicketB.updatedAt, true);
  assert.equal(updatedTicketB.eventIds.length, 3);

  assert.deepEqual(updatedMission.ticketIds, [ticketB, ticketA, ticketC]);
  assert.equal(updatedMission.status, "ready");
  assert.equal(updatedMission.resumeCursor, movedEvent.eventId);
  assert.equal(updatedMission.updatedAt, movedEvent.occurredAt);

  assert.equal(updatedEvent.type, "ticket.updated");
  assert.equal(updatedEvent.ticketId, ticketB);
  assert.deepEqual(updatedEvent.payload.changedFields, [
    "goal",
    "owner",
    "successCriteria",
    "allowedCapabilities",
    "skillPackRefs",
  ]);
  assert.equal(updatedEvent.payload.trigger, "operator");
  assert.equal(movedEvent.type, "ticket.reprioritized");
  assert.equal(movedEvent.ticketId, ticketB);
  assert.equal(movedEvent.payload.previousOrder, 1);
  assert.equal(movedEvent.payload.nextOrder, 0);
  assert.deepEqual(movedEvent.payload.orderedTicketIds, [ticketB, ticketA, ticketC]);
  assert.equal(movedEvent.payload.trigger, "operator");

  assert.deepEqual(ticketBoardProjection, {
    schemaVersion: 1,
    tickets: [
      {
        ticketId: ticketB,
        missionId: mission.id,
        title: "Assembler le plan final",
        status: "todo",
        owner: "agent_coord",
        kind: "implement",
        dependsOn: [ticketA],
        allowedCapabilities: ["fs.read", "cli.run"],
        skillPackRefs: ["pack.plan"],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 0,
        runnable: false,
        blockedByTicketIds: [ticketA],
        planningState: "waiting_on_dependencies",
        dependencyStatuses: [
          {
            ticketId: ticketA,
            status: "todo",
            blocksRunnable: true,
          },
        ],
        trackingState: "blocked",
        statusReasonCode: "dependency_pending",
        blockingReasonCode: "dependency_pending",
        activeAttemptId: null,
        activeAttemptStatus: null,
        lastAttemptId: null,
        lastAttemptStatus: null,
        lastAttemptStartedAt: null,
        lastAttemptEndedAt: null,
        lastAttemptBackgroundRequested: null,
        lastAttemptWorkspaceIsolationId: null,
        updatedAt: updatedTicketB.updatedAt,
      },
      {
        ticketId: ticketA,
        missionId: mission.id,
        title: "Verifier les prerequis",
        status: "todo",
        owner: "agent_research",
        kind: "implement",
        dependsOn: [],
        allowedCapabilities: [],
        skillPackRefs: [],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 1,
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
        updatedAt: updatedTicketA.updatedAt,
      },
      {
        ticketId: ticketC,
        missionId: mission.id,
        title: "Documenter la decision",
        status: "todo",
        owner: "agent_doc",
        kind: "implement",
        dependsOn: [],
        allowedCapabilities: [],
        skillPackRefs: [],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 2,
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
        updatedAt: updatedTicketC.updatedAt,
      },
    ],
  });
  assert.deepEqual(resumeViewProjection.resume?.openTickets, ticketBoardProjection.tickets);
  assert.equal(
    resumeViewProjection.resume?.nextOperatorAction,
    "Traitez le prochain ticket runnable: Verifier les prerequis.",
  );

  const output = statusResult.lines.join("\n");
  assert.equal(statusResult.exitCode, 0);
  assert.match(output, new RegExp(`Tickets ouverts: ${ticketB}, ${ticketA}, ${ticketC}`));
  assert.match(
    output,
    /Prochain arbitrage utile: Traitez le prochain ticket runnable: Verifier les prerequis\./,
  );
});

test("mission ticket update rejette une mutation sans effet sans changer les snapshots ni les projections", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-noop-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Livrer la delegation ticket",
    owner: "agent_dev",
    successCriteria: ["Le ticket reste stable"],
  });

  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketPath = path.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const beforeMission = await readFile(missionPath, "utf8");
  const beforeTicket = await readFile(ticketPath, "utf8");
  const beforeMissionStatus = await readFile(missionStatusPath, "utf8");
  const beforeTicketBoard = await readFile(ticketBoardPath, "utf8");
  const beforeResumeView = await readFile(resumeViewPath, "utf8");
  const beforeJournal = await readJournal(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
    "--goal",
    "Livrer la delegation ticket",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Aucune mutation effective detectee pour le ticket \`${ticketId}\`.`,
  );

  const afterMission = await readFile(missionPath, "utf8");
  const afterTicket = await readFile(ticketPath, "utf8");
  const afterMissionStatus = await readFile(missionStatusPath, "utf8");
  const afterTicketBoard = await readFile(ticketBoardPath, "utf8");
  const afterResumeView = await readFile(resumeViewPath, "utf8");
  const afterJournal = await readJournal(rootDir);

  assert.equal(afterMission, beforeMission);
  assert.equal(afterTicket, beforeTicket);
  assert.equal(afterMissionStatus, beforeMissionStatus);
  assert.equal(afterTicketBoard, beforeTicketBoard);
  assert.equal(afterResumeView, beforeResumeView);
  assert.deepEqual(afterJournal, beforeJournal);
});

test("mission ticket update traite des dependances identiques comme un no-op", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-reordered-dependencies-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketA = await createTicket(rootDir, mission.id, {
    goal: "Prerequis A",
    owner: "agent_a",
    successCriteria: ["A existe"],
  });
  const ticketB = await createTicket(rootDir, mission.id, {
    goal: "Prerequis B",
    owner: "agent_b",
    successCriteria: ["B existe"],
  });
  const targetTicketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket cible",
    owner: "agent_target",
    successCriteria: ["Le ticket reste stable"],
    dependsOn: [ticketA, ticketB],
  });

  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketPath = path.join(rootDir, ".corp", "missions", mission.id, "tickets", targetTicketId, "ticket.json");
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const beforeMission = await readFile(missionPath, "utf8");
  const beforeTicket = await readFile(ticketPath, "utf8");
  const beforeMissionStatus = await readFile(missionStatusPath, "utf8");
  const beforeTicketBoard = await readFile(ticketBoardPath, "utf8");
  const beforeResumeView = await readFile(resumeViewPath, "utf8");
  const beforeJournal = await readJournal(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    targetTicketId,
    "--depends-on",
    ticketA,
    "--depends-on",
    ticketB,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Aucune mutation effective detectee pour le ticket \`${targetTicketId}\`.`,
  );
  assert.equal(await readFile(missionPath, "utf8"), beforeMission);
  assert.equal(await readFile(ticketPath, "utf8"), beforeTicket);
  assert.equal(await readFile(missionStatusPath, "utf8"), beforeMissionStatus);
  assert.equal(await readFile(ticketBoardPath, "utf8"), beforeTicketBoard);
  assert.equal(await readFile(resumeViewPath, "utf8"), beforeResumeView);
  assert.deepEqual(await readJournal(rootDir), beforeJournal);
});

test("mission ticket update traite le reordonnancement de allowedCapabilities et skillPackRefs comme un no-op", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-reordered-opaque-refs-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket avec references opaques",
    owner: "agent_refs",
    successCriteria: ["Les references restent stables"],
    allowedCapabilities: ["fs.read", "cli.run"],
    skillPackRefs: ["pack.plan", "pack.audit"],
  });

  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketPath = path.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const beforeMission = await readFile(missionPath, "utf8");
  const beforeTicket = await readFile(ticketPath, "utf8");
  const beforeMissionStatus = await readFile(missionStatusPath, "utf8");
  const beforeTicketBoard = await readFile(ticketBoardPath, "utf8");
  const beforeResumeView = await readFile(resumeViewPath, "utf8");
  const beforeJournal = await readJournal(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
    "--allow-capability",
    "cli.run",
    "--allow-capability",
    "fs.read",
    "--skill-pack",
    "pack.audit",
    "--skill-pack",
    "pack.plan",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Aucune mutation effective detectee pour le ticket \`${ticketId}\`.`,
  );
  assert.equal(await readFile(missionPath, "utf8"), beforeMission);
  assert.equal(await readFile(ticketPath, "utf8"), beforeTicket);
  assert.equal(await readFile(missionStatusPath, "utf8"), beforeMissionStatus);
  assert.equal(await readFile(ticketBoardPath, "utf8"), beforeTicketBoard);
  assert.equal(await readFile(resumeViewPath, "utf8"), beforeResumeView);
  assert.deepEqual(await readJournal(rootDir), beforeJournal);
});

test("mission ticket update rejette les statuts non modifiables sans toucher aux snapshots ni aux projections", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-status-guards-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket non modifiable",
    owner: "agent_guard",
    successCriteria: ["Le ticket existe"],
  });

  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketPath = path.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const cases: Array<{
    status: Ticket["status"];
    expectedMessage: string;
  }> = [
    {
      status: "claimed",
      expectedMessage:
        `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: claimed). `
        + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
    },
    {
      status: "in_progress",
      expectedMessage:
        `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: in_progress). `
        + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
    },
    {
      status: "blocked",
      expectedMessage:
        `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: blocked). `
        + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
    },
    {
      status: "failed",
      expectedMessage:
        `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: failed). `
        + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
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
      "update",
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
      "--ticket-id",
      ticketId,
      "--goal",
      "Nouveau goal non autorise",
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

test("updateTicket rejette une mutation directe du champ status", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-direct-status-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket a proteger",
    owner: "agent_status",
    successCriteria: ["Le ticket existe"],
  });

  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketPath = path.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const beforeMission = await readFile(missionPath, "utf8");
  const beforeTicket = await readFile(ticketPath, "utf8");
  const beforeMissionStatus = await readFile(missionStatusPath, "utf8");
  const beforeTicketBoard = await readFile(ticketBoardPath, "utf8");
  const beforeResumeView = await readFile(resumeViewPath, "utf8");
  const beforeJournal = await readJournal(rootDir);

  const directStatusMutationOptions = {
    rootDir,
    missionId: mission.id,
    ticketId,
    goal: "Goal ignore",
    owner: undefined,
    successCriteria: [],
    dependsOn: [],
    clearDependsOn: false,
    allowedCapabilities: [],
    clearAllowedCapabilities: false,
    skillPackRefs: [],
    clearSkillPackRefs: false,
    status: "done",
  } as Parameters<typeof updateTicket>[0] & { status: string };

  await assert.rejects(
    () => updateTicket(directStatusMutationOptions),
    new Error(
      `Le statut du ticket ${ticketId} ne peut pas etre modifie via \`corp mission ticket update\`. `
      + "Utilisez les commandes de transition dediees.",
    ),
  );

  assert.equal(await readFile(missionPath, "utf8"), beforeMission);
  assert.equal(await readFile(ticketPath, "utf8"), beforeTicket);
  assert.equal(await readFile(missionStatusPath, "utf8"), beforeMissionStatus);
  assert.equal(await readFile(ticketBoardPath, "utf8"), beforeTicketBoard);
  assert.equal(await readFile(resumeViewPath, "utf8"), beforeResumeView);
  assert.deepEqual(await readJournal(rootDir), beforeJournal);
});

test("mission ticket update protege le graphe contre l'auto-reference, les cycles et les dependances annulees", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-graph-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketA = await createTicket(rootDir, mission.id, {
    goal: "Ticket A",
    owner: "agent_a",
    successCriteria: ["A existe"],
  });
  const ticketB = await createTicket(rootDir, mission.id, {
    goal: "Ticket B",
    owner: "agent_b",
    successCriteria: ["B existe"],
    dependsOn: [ticketA],
  });
  const ticketC = await createTicket(rootDir, mission.id, {
    goal: "Ticket C",
    owner: "agent_c",
    successCriteria: ["C existe"],
  });

  const beforeAutoJournal = await readJournal(rootDir);
  const autoReferenceResult = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketA,
    "--depends-on",
    ticketA,
  ]);

  assert.equal(autoReferenceResult.exitCode, 1);
  assert.equal(
    autoReferenceResult.lines.at(-1),
    `Le ticket \`${ticketA}\` ne peut pas dependre de lui-meme.`,
  );
  assert.deepEqual(await readJournal(rootDir), beforeAutoJournal);

  const beforeCycleJournal = await readJournal(rootDir);
  const cycleResult = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketA,
    "--depends-on",
    ticketB,
  ]);

  assert.equal(cycleResult.exitCode, 1);
  assert.equal(
    cycleResult.lines.at(-1),
    `La mise a jour du ticket \`${ticketA}\` introduit un cycle de dependances.`,
  );
  assert.deepEqual(await readJournal(rootDir), beforeCycleJournal);

  const cancelResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketC,
  ]);

  assert.equal(cancelResult.exitCode, 0);

  const beforeCancelledDependencyJournal = await readJournal(rootDir);
  const cancelledDependencyResult = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketA,
    "--depends-on",
    ticketC,
  ]);

  assert.equal(cancelledDependencyResult.exitCode, 1);
  assert.equal(
    cancelledDependencyResult.lines.at(-1),
    `La dependance \`${ticketC}\` est deja \`cancelled\` dans la mission \`${mission.id}\`.`,
  );
  assert.deepEqual(await readJournal(rootDir), beforeCancelledDependencyJournal);
});

test("mission ticket update detecte aussi un cycle de dependances a trois noeuds", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-update-ticket-cycle-three-nodes-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketA = await createTicket(rootDir, mission.id, {
    goal: "Ticket A",
    owner: "agent_a",
    successCriteria: ["A existe"],
  });
  const ticketB = await createTicket(rootDir, mission.id, {
    goal: "Ticket B",
    owner: "agent_b",
    successCriteria: ["B existe"],
    dependsOn: [ticketA],
  });
  const ticketC = await createTicket(rootDir, mission.id, {
    goal: "Ticket C",
    owner: "agent_c",
    successCriteria: ["C existe"],
    dependsOn: [ticketB],
  });

  const beforeJournal = await readJournal(rootDir);
  const result = await runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketA,
    "--depends-on",
    ticketC,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `La mise a jour du ticket \`${ticketA}\` introduit un cycle de dependances.`,
  );
  assert.deepEqual(await readJournal(rootDir), beforeJournal);
});
