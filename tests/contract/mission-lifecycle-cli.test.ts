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

test("l'aide mission expose pause relaunch et close sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(output, /corp mission pause --root <workspace> --mission-id <mission_id>/);
  assert.match(output, /corp mission relaunch --root <workspace> --mission-id <mission_id>/);
  assert.match(
    output,
    /corp mission close --root <workspace> --mission-id <mission_id> --outcome <completed\|cancelled>/,
  );
  assert.doesNotMatch(output, /codex|openai/i);
});

test("mission pause et mission relaunch exigent un mission-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-lifecycle-mission-id-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const pauseResult = await runCommand(["mission", "pause", "--root", rootDir]);
  const relaunchResult = await runCommand(["mission", "relaunch", "--root", rootDir]);

  assert.equal(pauseResult.exitCode, 1);
  assert.equal(
    pauseResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission pause`.",
  );

  assert.equal(relaunchResult.exitCode, 1);
  assert.equal(
    relaunchResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission relaunch`.",
  );
});

test("mission close exige un outcome explicite et valide", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-lifecycle-close-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const missingOutcomeResult = await runCommand([
    "mission",
    "close",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
  ]);
  const invalidOutcomeResult = await runCommand([
    "mission",
    "close",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
    "--outcome",
    "closed",
  ]);

  assert.equal(missingOutcomeResult.exitCode, 1);
  assert.equal(
    missingOutcomeResult.lines.at(-1),
    "L'option --outcome est obligatoire pour `corp mission close`.",
  );

  assert.equal(invalidOutcomeResult.exitCode, 1);
  assert.equal(
    invalidOutcomeResult.lines.at(-1),
    "L'option --outcome doit valoir `completed` ou `cancelled` pour `corp mission close`.",
  );
});

test("mission pause echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-lifecycle-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission pause\`.`,
  );
});

test("mission close exige un mission-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-lifecycle-close-mission-id-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "close",
    "--root",
    rootDir,
    "--outcome",
    "completed",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission close`.",
  );
});

test("mission relaunch echoue proprement si la mission est inconnue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-lifecycle-unknown-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    "mission_inconnue",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});
