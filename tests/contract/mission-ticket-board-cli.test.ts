import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import { setReadTicketBoardDependenciesForTesting } from "../../packages/ticket-runtime/src/planner/read-ticket-board";

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
    "Mission board vide",
    "--objective",
    "Verifier le message board vide",
    "--success-criterion",
    "Le board reste lisible sans ticket",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return line.slice("Mission creee: ".length);
}

test("mission ticket board exige un mission-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-board-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand(["mission", "ticket", "board", "--root", rootDir]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission ticket board`.",
  );
});

test("mission ticket board echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-board-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission ticket board\`.`,
  );
});

test("mission ticket board echoue proprement si la mission est inconnue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-board-unknown-mission-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    "mission_inconnue",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});

test("mission ticket board annonce explicitement un board vide", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-board-empty-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), /Aucun ticket n'existe encore\./);
});

test("mission ticket board classe une erreur OS issue de readMissionEvents sans fuite EACCES brute", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-board-journal-eacces-"));

  t.after(async () => {
    setReadTicketBoardDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  setReadTicketBoardDependenciesForTesting({
    readMissionEvents: async () => {
      const error = new Error("EACCES: permission denied, open events.jsonl") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    },
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.match(result.lines.at(-1) ?? "", /erreur_fichier: erreur de lecture journal append-only \(EACCES\)/i);
  assert.doesNotMatch(result.lines.at(-1) ?? "", /^EACCES:/);
});
