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

test("l'aide mission expose audit et audit show en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission audit --root <workspace> --mission-id <mission_id> \[--ticket-id <ticket_id>\] \[--limit <n>\]/,
  );
  assert.match(
    output,
    /corp mission audit show --root <workspace> --mission-id <mission_id> --event-id <event_id>/,
  );
  assert.match(output, /audit = chronologie structuree mission-centrique/i);
  assert.match(output, /audit show = detail d'un evenement et de ses correlations/i);
  assert.doesNotMatch(output, /openai|response_id|responseId|vendorStatus|threadId|pollCursor/i);
});

test("mission audit et mission audit show exigent les identifiants obligatoires et valident --limit", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-audit-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const auditWithoutMission = await runCommand([
    "mission",
    "audit",
    "--root",
    rootDir,
  ]);
  const auditWithInvalidLimit = await runCommand([
    "mission",
    "audit",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
    "--limit",
    "0",
  ]);
  const auditShowWithoutMission = await runCommand([
    "mission",
    "audit",
    "show",
    "--root",
    rootDir,
  ]);
  const auditShowWithoutEvent = await runCommand([
    "mission",
    "audit",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
  ]);

  assert.equal(auditWithoutMission.exitCode, 1);
  assert.equal(
    auditWithoutMission.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission audit`.",
  );

  assert.equal(auditWithInvalidLimit.exitCode, 1);
  assert.equal(
    auditWithInvalidLimit.lines.at(-1),
    "L'option --limit doit etre un entier strictement positif pour `corp mission audit`.",
  );

  assert.equal(auditShowWithoutMission.exitCode, 1);
  assert.equal(
    auditShowWithoutMission.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission audit show`.",
  );

  assert.equal(auditShowWithoutEvent.exitCode, 1);
  assert.equal(
    auditShowWithoutEvent.lines.at(-1),
    "L'option --event-id est obligatoire pour `corp mission audit show`.",
  );
});
