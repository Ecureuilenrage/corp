import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";

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

async function createMission(rootDir: string, title: string): Promise<string> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Faire evoluer l'ordre canonique du plan",
    "--success-criterion",
    "Les deplacements restent audites",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return line.slice("Mission creee: ".length);
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
    "agent_dev",
    "--success-criterion",
    "Le ticket existe",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return line.slice("Ticket cree: ".length);
}

test("l'aide mission expose mission ticket move en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission ticket move --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id>/,
  );
  assert.match(output, /deplace un ticket/i);
  assert.doesNotMatch(output, /codex|openai/i);
});

test("mission ticket move valide mission-id, ticket-id et la strategie de deplacement", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-move-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir, "Mission move");
  const ticketId = await createTicket(rootDir, missionId, "Ticket move");

  const cases = [
    {
      name: "mission-id manquant",
      args: [
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--ticket-id",
        ticketId,
        "--to-front",
      ],
      expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket move`.",
    },
    {
      name: "ticket-id manquant",
      args: [
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--to-front",
      ],
      expectedMessage: "L'option --ticket-id est obligatoire pour `corp mission ticket move`.",
    },
    {
      name: "strategie absente",
      args: [
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
      ],
      expectedMessage:
        "Choisissez exactement une strategie de deplacement pour `corp mission ticket move`.",
    },
    {
      name: "plusieurs strategies",
      args: [
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
        "--to-front",
        "--to-back",
      ],
      expectedMessage:
        "Choisissez exactement une strategie de deplacement pour `corp mission ticket move`.",
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

test("mission ticket move rejette les references inconnues, cross-mission, self-target et no-op", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-move-guards-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionA = await createMission(rootDir, "Mission A");
  const missionB = await createMission(rootDir, "Mission B");
  const ticketA1 = await createTicket(rootDir, missionA, "Ticket A1");
  const ticketA2 = await createTicket(rootDir, missionA, "Ticket A2");
  const ticketB1 = await createTicket(rootDir, missionB, "Ticket B1");

  const unknownReferenceResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    missionA,
    "--ticket-id",
    ticketA2,
    "--before-ticket",
    "ticket_inconnu",
  ]);

  assert.equal(unknownReferenceResult.exitCode, 1);
  assert.equal(
    unknownReferenceResult.lines.at(-1),
    `Le ticket de reference \`ticket_inconnu\` est introuvable dans la mission \`${missionA}\`.`,
  );

  const selfTargetResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    missionA,
    "--ticket-id",
    ticketA1,
    "--after-ticket",
    ticketA1,
  ]);

  assert.equal(selfTargetResult.exitCode, 1);
  assert.equal(
    selfTargetResult.lines.at(-1),
    `Le ticket \`${ticketA1}\` ne peut pas etre deplace par rapport a lui-meme.`,
  );

  const crossMissionReferenceResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    missionA,
    "--ticket-id",
    ticketA2,
    "--before-ticket",
    ticketB1,
  ]);

  assert.equal(crossMissionReferenceResult.exitCode, 1);
  assert.equal(
    crossMissionReferenceResult.lines.at(-1),
    `Le ticket de reference \`${ticketB1}\` n'appartient pas a la mission \`${missionA}\`.`,
  );

  const noOpResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    missionA,
    "--ticket-id",
    ticketA1,
    "--to-front",
  ]);

  assert.equal(noOpResult.exitCode, 1);
  assert.equal(
    noOpResult.lines.at(-1),
    `Le ticket \`${ticketA1}\` est deja a cette position.`,
  );
});
