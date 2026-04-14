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
    "Mission artefacts",
    "--objective",
    "Rendre les sorties consultables",
    "--success-criterion",
    "Les artefacts sont visibles",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return line.slice("Mission creee: ".length);
}

test("l'aide mission expose artifact list et artifact show en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission artifact list --root <workspace> --mission-id <mission_id> \[--ticket-id <ticket_id>\]/,
  );
  assert.match(
    output,
    /corp mission artifact show --root <workspace> --mission-id <mission_id> --artifact-id <artifact_id>/,
  );
  assert.match(output, /artifact list = navigation mission-centrique des sorties/i);
  assert.match(output, /artifact show = detail d'un artefact et de sa provenance/i);
  assert.doesNotMatch(output, /openai|response_id|responseId|vendorStatus|sequenceNumber/i);
});

test("mission artifact list et mission artifact show exigent les identifiants obligatoires", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-artifact-guards-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const listResult = await runCommand([
    "mission",
    "artifact",
    "list",
    "--root",
    rootDir,
  ]);
  const showWithoutMissionResult = await runCommand([
    "mission",
    "artifact",
    "show",
    "--root",
    rootDir,
  ]);
  const showWithoutArtifactResult = await runCommand([
    "mission",
    "artifact",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
  ]);

  assert.equal(listResult.exitCode, 1);
  assert.equal(
    listResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission artifact list`.",
  );

  assert.equal(showWithoutMissionResult.exitCode, 1);
  assert.equal(
    showWithoutMissionResult.lines.at(-1),
    "L'option --mission-id est obligatoire pour `corp mission artifact show`.",
  );

  assert.equal(showWithoutArtifactResult.exitCode, 1);
  assert.equal(
    showWithoutArtifactResult.lines.at(-1),
    "L'option --artifact-id est obligatoire pour `corp mission artifact show`.",
  );
});

test("mission artifact list rejette un filtre ticket inconnu et mission artifact show echoue proprement si l'artefact manque", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-artifact-errors-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  const listResult = await runCommand([
    "mission",
    "artifact",
    "list",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    "ticket_inconnu",
  ]);
  const showResult = await runCommand([
    "mission",
    "artifact",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--artifact-id",
    "artifact_inconnu",
  ]);

  assert.equal(listResult.exitCode, 1);
  assert.equal(
    listResult.lines.at(-1),
    `Ticket introuvable dans la mission \`${missionId}\`: \`ticket_inconnu\`.`,
  );

  assert.equal(showResult.exitCode, 1);
  assert.equal(
    showResult.lines.at(-1),
    `Artefact introuvable dans la mission \`${missionId}\`: \`artifact_inconnu\`.`,
  );
});
