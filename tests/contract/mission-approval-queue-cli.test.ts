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

async function createMission(rootDir: string): Promise<string> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission approval queue",
    "--objective",
    "Afficher une file d'approbation mission-centrique",
    "--success-criterion",
    "La file est lisible",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return line.slice("Mission creee: ".length);
}

test("l'aide mission expose approval queue et les decisions sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission approval queue --root <workspace> --mission-id <mission_id>/,
  );
  assert.match(output, /approval queue = file detaillee des validations en attente/i);
  assert.match(
    output,
    /corp mission approval approve --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/,
  );
  assert.match(
    output,
    /corp mission approval reject --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/,
  );
  assert.match(
    output,
    /corp mission approval defer --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/,
  );
  assert.doesNotMatch(output, /codex|openai|response_id|vendorStatus/i);
});

test("mission approval queue exige un mission-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-approval-queue-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "approval",
    "queue",
    "--root",
    rootDir,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission approval queue`.",
  );
});

test("mission approval queue affiche explicitement une file vide", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-approval-queue-empty-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  const result = await runCommand([
    "mission",
    "approval",
    "queue",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(output, new RegExp(`Mission: ${missionId}`));
  assert.match(output, /File d'approbation:/);
  assert.match(output, /Aucune validation en attente\./);
  assert.doesNotMatch(output, /codex|openai|response_id|vendorStatus/i);
});

test("mission approval approve|reject|defer exigent un mission-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-approval-decision-mission-id-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  for (const commandName of ["approve", "reject", "defer"] as const) {
    const result = await runCommand([
      "mission",
      "approval",
      commandName,
      "--root",
      rootDir,
      "--approval-id",
      "approval_demo",
    ]);

    assert.equal(result.exitCode, 1);
    assert.equal(
      result.lines.at(-1),
      `L'option --mission-id est obligatoire pour \`corp mission approval ${commandName}\`.`,
    );
  }
});

test("mission approval approve|reject|defer exigent un approval-id explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-approval-decision-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  for (const commandName of ["approve", "reject", "defer"] as const) {
    const result = await runCommand([
      "mission",
      "approval",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
    ]);

    assert.equal(result.exitCode, 1);
    assert.equal(
      result.lines.at(-1),
      `L'option --approval-id est obligatoire pour \`corp mission approval ${commandName}\`.`,
    );
  }
});

test("mission approval approve|reject|defer conservent les incompatibilites explicites sur les garde-fous", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-approval-decision-conflicts-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const scenarios = [
    {
      commandName: "approve",
      extraArgs: ["--allow-capability", "fs.read", "--clear-allow-capability"],
      expected:
        "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission approval approve`.",
    },
    {
      commandName: "reject",
      extraArgs: ["--skill-pack", "pack.audit", "--clear-skill-pack"],
      expected:
        "Les options `--skill-pack` et `--clear-skill-pack` sont incompatibles pour `corp mission approval reject`.",
    },
    {
      commandName: "defer",
      extraArgs: ["--allow-capability", "cli.run", "--clear-allow-capability"],
      expected:
        "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission approval defer`.",
    },
  ] as const;

  for (const scenario of scenarios) {
    const result = await runCommand([
      "mission",
      "approval",
      scenario.commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
      "--approval-id",
      "approval_demo",
      ...scenario.extraArgs,
    ]);

    assert.equal(result.exitCode, 1);
    assert.equal(result.lines.at(-1), scenario.expected);
  }
});
