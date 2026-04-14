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
    "Mission ticket update",
    "--objective",
    "Faire evoluer un ticket sans casser l'historique",
    "--success-criterion",
    "Les mutations sont explicites",
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
    "Livrer la delegation initiale",
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

test("l'aide mission expose mission ticket update en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission ticket update --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id>/,
  );
  assert.match(output, /met a jour un ticket/i);
  assert.doesNotMatch(output, /codex|openai/i);
});

test("mission ticket update valide les gardes de surface principales", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-update-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  const cases = [
    {
      name: "mission-id manquant",
      args: [
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--ticket-id",
        ticketId,
        "--goal",
        "Nouveau goal",
      ],
      expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket update`.",
    },
    {
      name: "ticket-id manquant",
      args: [
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--goal",
        "Nouveau goal",
      ],
      expectedMessage: "L'option --ticket-id est obligatoire pour `corp mission ticket update`.",
    },
    {
      name: "aucune mutation demandee",
      args: [
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
      ],
      expectedMessage: "Aucune mutation demandee pour `corp mission ticket update`.",
    },
    {
      name: "depends-on et clear-depends-on incompatibles",
      args: [
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
        "--depends-on",
        "ticket_autre",
        "--clear-depends-on",
      ],
      expectedMessage:
        "Les options `--depends-on` et `--clear-depends-on` sont incompatibles pour `corp mission ticket update`.",
    },
    {
      name: "allow-capability et clear-allow-capability incompatibles",
      args: [
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
        "--allow-capability",
        "fs.read",
        "--clear-allow-capability",
      ],
      expectedMessage:
        "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission ticket update`.",
    },
    {
      name: "skill-pack et clear-skill-pack incompatibles",
      args: [
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
        "--skill-pack",
        "pack.core",
        "--clear-skill-pack",
      ],
      expectedMessage:
        "Les options `--skill-pack` et `--clear-skill-pack` sont incompatibles pour `corp mission ticket update`.",
    },
  ];

  for (const testCase of cases) {
    const result = await runCommand(testCase.args);

    assert.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.name}`);
    assert.equal(
      result.lines.at(-1),
      testCase.expectedMessage,
      `message inattendu pour ${testCase.name}`,
    );
  }
});

test("mission ticket update rejette claimed et in_progress sans muter l'etat", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-update-guards-"));

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
      "update",
      "--root",
      rootDir,
      "--mission-id",
      missionId,
      "--ticket-id",
      ticketId,
      "--goal",
      "Nouveau goal contractuel",
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
