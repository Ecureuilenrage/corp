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
    "Mission ticket",
    "--objective",
    "Rendre la delegation explicite",
    "--success-criterion",
    "Les tickets sont persistants",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return line.slice("Mission creee: ".length);
}

test("l'aide mission expose mission ticket create en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(
    output,
    /corp mission ticket create --root <workspace> --mission-id <mission_id> --kind <research\|plan\|implement\|review\|operate>/,
  );
  assert.match(output, /cree un ticket delegable borne/i);
  assert.doesNotMatch(output, /codex|openai/i);
});

test("mission ticket create rejette les parametres manquants avec des messages deterministes", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-create-validation-"));

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
        "create",
        "--root",
        rootDir,
        "--kind",
        "implement",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
      ],
      expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket create`.",
    },
    {
      name: "kind manquant",
      args: [
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
      ],
      expectedMessage: "L'option --kind est obligatoire pour `corp mission ticket create`.",
    },
    {
      name: "kind invalide",
      args: [
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--kind",
        "ship",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
      ],
      expectedMessage:
        "L'option --kind doit valoir `research`, `plan`, `implement`, `review` ou `operate` pour `corp mission ticket create`.",
    },
    {
      name: "goal manquant",
      args: [
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--kind",
        "implement",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
      ],
      expectedMessage: "L'option --goal est obligatoire pour `corp mission ticket create`.",
    },
    {
      name: "owner manquant",
      args: [
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--kind",
        "implement",
        "--goal",
        "Livrer la delegation",
        "--success-criterion",
        "Le ticket est persiste",
      ],
      expectedMessage: "L'option --owner est obligatoire pour `corp mission ticket create`.",
    },
    {
      name: "aucun critere de succes",
      args: [
        "mission",
        "ticket",
        "create",
        "--root",
        rootDir,
        "--mission-id",
        "mission_123",
        "--kind",
        "implement",
        "--goal",
        "Livrer la delegation",
        "--owner",
        "agent_dev",
      ],
      expectedMessage:
        "Au moins un `--success-criterion` est obligatoire pour `corp mission ticket create`.",
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

test("mission ticket create echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-create-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    "mission_123",
    "--kind",
    "implement",
    "--goal",
    "Livrer la delegation",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket est persiste",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission ticket create\`.`,
  );
});

test("mission ticket create echoue proprement si la mission est inconnue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-create-unknown-mission-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const result = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    "mission_inconnue",
    "--kind",
    "implement",
    "--goal",
    "Livrer la delegation",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket est persiste",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.lines.at(-1), "Mission introuvable: mission_inconnue.");
});

test("mission ticket create refuse une mission terminale avec un message stable", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-ticket-create-terminal-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  const closeResult = await runCommand([
    "mission",
    "close",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--outcome",
    "completed",
  ]);

  assert.equal(closeResult.exitCode, 0);

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
    "Livrer la delegation",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket est persiste",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Impossible de creer un ticket dans la mission \`${missionId}\` car son statut est terminal (\`completed\`).`,
  );
});
