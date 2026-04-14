import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";

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

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);

  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string): Promise<string> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission ticket cancel",
    "--objective",
    "Annuler un ticket sans supprimer son historique",
    "--success-criterion",
    "L'annulation reste auditable",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return line.slice("Mission creee: ".length);
}

async function createTicket(rootDir: string, missionId: string): Promise<string> {
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
    "Ticket a annuler",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket existe",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return line.slice("Ticket cree: ".length);
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
  const ticket = JSON.parse(await readFile(ticketPath, "utf8")) as Ticket;

  await writeFile(
    ticketPath,
    `${JSON.stringify({ ...ticket, status }, null, 2)}\n`,
    "utf8",
  );
}

test("l'aide mission expose mission ticket cancel en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission ticket cancel --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id>/,
  );
  assert.match(output, /annule un ticket/i);
  assert.doesNotMatch(output, /codex|openai/i);
});

test("mission ticket cancel exige un mission-id et un ticket-id explicites", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-cancel-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  const missingMissionIdResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(missingMissionIdResult.exitCode, 1);
  assert.equal(
    missingMissionIdResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission ticket cancel`.",
  );

  const missingTicketIdResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(missingTicketIdResult.exitCode, 1);
  assert.equal(
    missingTicketIdResult.lines.at(-1),
    "L'option --ticket-id est obligatoire pour `corp mission ticket cancel`.",
  );
});

test("mission ticket cancel rejette les tickets inconnus et deja annules", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-cancel-guards-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  const unknownTicketResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    "ticket_inconnu",
  ]);

  assert.equal(unknownTicketResult.exitCode, 1);
  assert.equal(
    unknownTicketResult.lines.at(-1),
    `Ticket introuvable dans la mission \`${missionId}\`: \`ticket_inconnu\`.`,
  );

  const firstCancelResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(firstCancelResult.exitCode, 0);

  const secondCancelResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(secondCancelResult.exitCode, 1);
  assert.equal(
    secondCancelResult.lines.at(-1),
    `Le ticket ${ticketId} est deja annule.`,
  );
});

test("mission ticket cancel rejette done et failed sans muter les snapshots ni les projections", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-cancel-terminal-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "ticket.json",
  );
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");

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
    await writeTicketStatus(rootDir, missionId, ticketId, testCase.status);

    const beforeMission = await readFile(missionPath, "utf8");
    const beforeTicket = await readFile(ticketPath, "utf8");
    const beforeMissionStatus = await readFile(missionStatusPath, "utf8");
    const beforeTicketBoard = await readFile(ticketBoardPath, "utf8");
    const beforeResumeView = await readFile(resumeViewPath, "utf8");
    const beforeJournal = await readFile(journalPath, "utf8");

    const result = await runCommand([
      "mission",
      "ticket",
      "cancel",
      "--root",
      rootDir,
      "--mission-id",
      missionId,
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
    assert.equal(await readFile(journalPath, "utf8"), beforeJournal);
  }
});
