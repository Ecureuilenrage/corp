import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function createMission(rootDir: string): Promise<string> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission run ticket",
    "--objective",
    "Lancer une tentative d'execution isolee",
    "--success-criterion",
    "Le ticket est runnable",
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
    "Executer le ticket runnable",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket est pret",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return line.slice("Ticket cree: ".length);
}

async function patchMissionJson(
  rootDir: string,
  missionId: string,
  mutate: (mission: Record<string, unknown>) => void,
): Promise<void> {
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  const mission = JSON.parse(await readFile(missionPath, "utf8")) as Record<string, unknown>;
  mutate(mission);
  await writeFile(missionPath, `${JSON.stringify(mission, null, 2)}\n`, "utf8");
}

async function patchTicketJson(
  rootDir: string,
  missionId: string,
  ticketId: string,
  mutate: (ticket: Record<string, unknown>) => void,
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
  const ticket = JSON.parse(await readFile(ticketPath, "utf8")) as Record<string, unknown>;
  mutate(ticket);
  await writeFile(ticketPath, `${JSON.stringify(ticket, null, 2)}\n`, "utf8");
}

test("l'aide mission expose mission ticket run en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission ticket run --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id> \[--background\]/,
  );
  assert.match(output, /lance un ticket runnable dans un espace isole/i);
  assert.doesNotMatch(output, /codex|openai|response_id/i);
});

test("mission ticket run rejette les parametres manquants avec des messages deterministes", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const cases = [
    {
      name: "mission-id manquant",
      args: [
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--ticket-id",
        "ticket_123",
      ],
      expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket run`.",
    },
    {
      name: "ticket-id manquant",
      args: [
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
      ],
      expectedMessage: "L'option --ticket-id est obligatoire pour `corp mission ticket run`.",
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

test("mission ticket run echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
    "--ticket-id",
    "ticket_123",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission ticket run\`.`,
  );
});

test("mission ticket run echoue proprement si la mission est inconnue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-unknown-mission-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    "mission_inconnue",
    "--ticket-id",
    "ticket_123",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});

test("mission ticket run rejette une mission completed avec un message deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-completed-mission-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  await patchMissionJson(rootDir, missionId, (mission) => {
    mission.status = "completed";
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `La mission \`${missionId}\` ne peut pas lancer de tentative depuis le statut \`completed\`.`,
  );
});

test("mission ticket run rejette aussi les missions cancelled et blocked avec un message deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-non-runnable-mission-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  for (const status of ["cancelled", "blocked"] as const) {
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);

    await patchMissionJson(rootDir, missionId, (mission) => {
      mission.status = status;
    });

    const result = await runCommand([
      "mission",
      "ticket",
      "run",
      "--root",
      rootDir,
      "--mission-id",
      missionId,
      "--ticket-id",
      ticketId,
    ]);

    assert.equal(result.exitCode, 1);
    assert.equal(
      result.lines.at(-1),
      `La mission \`${missionId}\` ne peut pas lancer de tentative depuis le statut \`${status}\`.`,
    );
  }
});

test("mission ticket run rejette un ticket done avec un message deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-done-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  await patchTicketJson(rootDir, missionId, ticketId, (ticket) => {
    ticket.status = "done";
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Le ticket \`${ticketId}\` n'est pas runnable car son statut actuel est \`done\`.`,
  );
});

test("mission ticket run rejette un ticket blocked pour reserver cette reprise a mission compare relaunch", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-blocked-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  await patchTicketJson(rootDir, missionId, ticketId, (ticket) => {
    ticket.status = "blocked";
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Le ticket \`${ticketId}\` n'est pas runnable car son statut actuel est \`blocked\`.`,
  );
});

test("mission ticket run rejette un ticket sans owner avec un message deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-missing-owner-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  await patchTicketJson(rootDir, missionId, ticketId, (ticket) => {
    ticket.owner = " ";
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Le ticket \`${ticketId}\` doit avoir un owner renseigne avant \`corp mission ticket run\`.`,
  );
});

test("mission ticket run exige un secret OpenAI avant toute isolation", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-run-secret-"));
  const previousOpenAiKey = process.env.OPENAI_API_KEY;

  t.after(async () => {
    if (previousOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    }

    await rm(rootDir, { recursive: true, force: true });
  });

  delete process.env.OPENAI_API_KEY;

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  const result = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    "Secret OpenAI absent. Renseignez `OPENAI_API_KEY` avant `corp mission ticket run`.",
  );
});
