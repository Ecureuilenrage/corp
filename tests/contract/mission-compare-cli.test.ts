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

test("l'aide mission expose compare et compare relaunch sans detourner la relance globale", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(output, /corp mission compare --root <workspace> --mission-id <mission_id>/);
  assert.match(
    output,
    /corp mission compare relaunch --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id> \[--background\]/,
  );
  assert.match(output, /compare = diagnostic attendu \/ observe et branche impactee/i);
  assert.match(output, /compare relaunch = relance ciblee de la racine selectionnee/i);
  assert.match(output, /relaunch = relance globale du cycle de vie mission/i);
  assert.doesNotMatch(output, /codex|openai|responseId|pollCursor|vendorStatus|requires_action/i);
});

test("mission compare et mission compare relaunch exigent les options requises", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-compare-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const compareResult = await runCommand(["mission", "compare", "--root", rootDir]);
  const compareRelaunchWithoutMission = await runCommand([
    "mission",
    "compare",
    "relaunch",
    "--root",
    rootDir,
  ]);
  const compareRelaunchWithoutTicket = await runCommand([
    "mission",
    "compare",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    "mission_demo",
  ]);

  assert.equal(compareResult.exitCode, 1);
  assert.equal(
    compareResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission compare`.",
  );

  assert.equal(compareRelaunchWithoutMission.exitCode, 1);
  assert.equal(
    compareRelaunchWithoutMission.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission compare relaunch`.",
  );

  assert.equal(compareRelaunchWithoutTicket.exitCode, 1);
  assert.equal(
    compareRelaunchWithoutTicket.lines.at(-1),
    "L'option --ticket-id est obligatoire pour `corp mission compare relaunch`.",
  );
});

test("mission compare relaunch echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-compare-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "compare",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    "mission_demo",
    "--ticket-id",
    "ticket_demo",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission compare relaunch\`.`,
  );
});
