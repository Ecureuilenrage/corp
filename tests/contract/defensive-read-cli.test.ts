import assert from "node:assert/strict";
import { mkdtemp, rm, unlink } from "node:fs/promises";
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

async function createMission(rootDir: string): Promise<string> {
  const bootstrap = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(bootstrap.exitCode, 0);

  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission defensive CLI",
    "--objective",
    "Verifier les diagnostics de lecture",
    "--success-criterion",
    "Le journal manquant reste explicite",
    "--policy-profile",
    "policy_profile_local",
  ]);
  assert.equal(result.exitCode, 0);

  const missionLine = result.lines.find((line) => line.startsWith("Mission creee: "));
  assert.ok(missionLine);
  return missionLine.slice("Mission creee: ".length);
}

test("les commandes mission-centriques diagnostiquent events.jsonl manquant sans fallback trompeur", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-cli-missing-journal-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const missionId = await createMission(rootDir);
  await unlink(path.join(rootDir, ".corp", "journal", "events.jsonl"));

  const commands = [
    ["mission", "status", "--root", rootDir, "--mission-id", missionId],
    ["mission", "resume", "--root", rootDir, "--mission-id", missionId],
    ["mission", "audit", "--root", rootDir, "--mission-id", missionId],
    ["mission", "approval", "queue", "--root", rootDir, "--mission-id", missionId],
    ["mission", "artifact", "list", "--root", rootDir, "--mission-id", missionId],
    ["mission", "ticket", "board", "--root", rootDir, "--mission-id", missionId],
  ];

  for (const args of commands) {
    const result = await runCommand(args);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 1, args.join(" "));
    assert.match(output, /journal_manquant|journal append-only manquant/i);
    assert.match(output, /relancez.*bootstrap|restaurez le journal/i);
    assert.doesNotMatch(output, /Workspace mission non initialise/i);
    assert.doesNotMatch(output, /Projection .*irreconciliable/i);
    assert.doesNotMatch(output, /Mission introuvable/i);
    assert.doesNotMatch(output, /SyntaxError|^\s*at\s/m);
  }
});
