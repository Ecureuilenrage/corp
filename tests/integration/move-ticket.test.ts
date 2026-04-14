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
  ticketId?: string;
  occurredAt: string;
  actor: string;
  source: string;
  payload: Record<string, unknown>;
}

interface TicketBoardProjection {
  schemaVersion: 1;
  tickets: Array<{
    ticketId: string;
    planOrder: number;
  }>;
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
    "Mission move standalone",
    "--objective",
    "Tester les deplacements de tickets",
    "--success-criterion",
    "Le plan canonique reste coherent",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return readMission(rootDir, line.slice("Mission creee: ".length));
}

async function createTicket(rootDir: string, missionId: string, goal: string): Promise<string> {
  const result = await runCommand([
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
    goal,
    "--owner",
    "agent_move",
    "--success-criterion",
    "Le ticket existe",
  ]);

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

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

function ticketBoardPath(rootDir: string): string {
  return path.join(rootDir, ".corp", "projections", "ticket-board.json");
}

test("mission ticket move applique les strategies standalone en gardant mission, board et journal synchronises", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-move-ticket-standalone-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketA = await createTicket(rootDir, mission.id, "Ticket A");
  const ticketB = await createTicket(rootDir, mission.id, "Ticket B");
  const ticketC = await createTicket(rootDir, mission.id, "Ticket C");
  const ticketD = await createTicket(rootDir, mission.id, "Ticket D");

  const assertMoveState = async (
    args: string[],
    movedTicketId: string,
    expectedOrder: string[],
  ): Promise<void> => {
    const result = await runCommand(args);
    assert.equal(result.exitCode, 0);
    assert.equal(result.lines[0], `Ticket deplace: ${movedTicketId}`);

    const updatedMission = await readMission(rootDir, mission.id);
    const ticketBoard = await readJson<TicketBoardProjection>(ticketBoardPath(rootDir));
    const lastEvent = (await readJournal(rootDir)).at(-1);

    assert.ok(lastEvent);
    assert.deepEqual(updatedMission.ticketIds, expectedOrder);
    assert.deepEqual(
      ticketBoard.tickets.map((ticket) => ticket.ticketId),
      expectedOrder,
    );
    assert.deepEqual(
      ticketBoard.tickets.map((ticket) => ticket.planOrder),
      expectedOrder.map((_, index) => index),
    );
    assert.equal(lastEvent.type, "ticket.reprioritized");
    assert.equal(lastEvent.ticketId, movedTicketId);
    assert.deepEqual(lastEvent.payload.orderedTicketIds, expectedOrder);
  };

  await assertMoveState([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketD,
    "--to-front",
  ], ticketD, [ticketD, ticketA, ticketB, ticketC]);

  await assertMoveState([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketD,
    "--to-back",
  ], ticketD, [ticketA, ticketB, ticketC, ticketD]);

  await assertMoveState([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketA,
    "--after-ticket",
    ticketC,
  ], ticketA, [ticketB, ticketC, ticketA, ticketD]);

  await assertMoveState([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketD,
    "--before-ticket",
    ticketB,
  ], ticketD, [ticketD, ticketB, ticketC, ticketA]);
});

test("mission ticket move rejette auto-reference et reference inconnue sans muter mission ni board", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-move-ticket-guards-integration-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketA = await createTicket(rootDir, mission.id, "Ticket A");
  const ticketB = await createTicket(rootDir, mission.id, "Ticket B");

  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const beforeMission = await readFile(missionPath, "utf8");
  const beforeBoard = await readFile(ticketBoardPath(rootDir), "utf8");
  const beforeJournal = await readJournal(rootDir);

  const selfReferenceResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketA,
    "--after-ticket",
    ticketA,
  ]);

  assert.equal(selfReferenceResult.exitCode, 1);
  assert.equal(
    selfReferenceResult.lines.at(-1),
    `Le ticket \`${ticketA}\` ne peut pas etre deplace par rapport a lui-meme.`,
  );
  assert.equal(await readFile(missionPath, "utf8"), beforeMission);
  assert.equal(await readFile(ticketBoardPath(rootDir), "utf8"), beforeBoard);
  assert.deepEqual(await readJournal(rootDir), beforeJournal);

  const unknownReferenceResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketB,
    "--before-ticket",
    "ticket_inconnu",
  ]);

  assert.equal(unknownReferenceResult.exitCode, 1);
  assert.equal(
    unknownReferenceResult.lines.at(-1),
    `Le ticket de reference \`ticket_inconnu\` est introuvable dans la mission \`${mission.id}\`.`,
  );
  assert.equal(await readFile(missionPath, "utf8"), beforeMission);
  assert.equal(await readFile(ticketBoardPath(rootDir), "utf8"), beforeBoard);
  assert.deepEqual(await readJournal(rootDir), beforeJournal);
});
