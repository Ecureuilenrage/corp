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

test("l'aide mission expose status, resume et ticket board en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(output, /corp mission status --root <workspace> --mission-id <mission_id>/);
  assert.match(output, /corp mission resume --root <workspace> --mission-id <mission_id>/);
  assert.match(output, /corp mission ticket board --root <workspace> --mission-id <mission_id>/);
  assert.match(output, /status = vue mission detaillee/i);
  assert.match(output, /resume = vue de reprise compacte/i);
  assert.match(output, /ticket board = supervision ticket par ticket/i);
  assert.doesNotMatch(output, /codex|openai|response_id|vendorStatus/i);
});

test("mission status et mission resume exigent un mission-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-resume-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const statusResult = await runCommand(["mission", "status", "--root", rootDir]);
  const resumeResult = await runCommand(["mission", "resume", "--root", rootDir]);

  assert.equal(statusResult.exitCode, 1);
  assert.equal(
    statusResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission status`.",
  );

  assert.equal(resumeResult.exitCode, 1);
  assert.equal(
    resumeResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission resume`.",
  );
});

test("mission status echoue proprement si la mission est inconnue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-status-unknown-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    "mission_inconnue",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});

test("mission resume echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-resume-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission resume\`.`,
  );
});

test("mission resume affiche explicitement l'absence de blocage connu en francais", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-resume-blockage-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const createResult = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission reprise CLI",
    "--objective",
    "Afficher un resume de reprise lisible",
    "--success-criterion",
    "Le blocage connu est explicite",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const missionId = String(
    createResult.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length),
  );

  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  const output = resumeResult.lines.join("\n");

  assert.equal(resumeResult.exitCode, 0);
  assert.match(output, /Dernier blocage connu: aucun/);
  assert.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_action/i);
});
