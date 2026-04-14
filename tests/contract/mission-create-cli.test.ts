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

test("l'aide mission expose create en francais sans fuite vendor", async () => {
  const result = await runCommand(["mission", "help"]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(output, /corp mission create/);
  assert.match(output, /cree une mission persistante/i);
  assert.doesNotMatch(output, /codex|openai/i);
});

test("mission create rejette les parametres manquants avec des messages deterministes", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-create-validation-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const cases = [
    {
      name: "titre manquant",
      args: [
        "mission",
        "create",
        "--root",
        rootDir,
        "--objective",
        "Poser une mission persistante",
        "--success-criterion",
        "Critere 1",
        "--policy-profile",
        "policy_profile_local",
      ],
      expectedMessage: "Le titre de mission est obligatoire.",
    },
    {
      name: "objectif manquant",
      args: [
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission V1",
        "--success-criterion",
        "Critere 1",
        "--policy-profile",
        "policy_profile_local",
      ],
      expectedMessage: "L'objectif de mission est obligatoire.",
    },
    {
      name: "aucun critere de succes",
      args: [
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission V1",
        "--objective",
        "Poser une mission persistante",
        "--policy-profile",
        "policy_profile_local",
      ],
      expectedMessage: "Au moins un critere de succes est obligatoire.",
    },
    {
      name: "policy profile vide",
      args: [
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission V1",
        "--objective",
        "Poser une mission persistante",
        "--success-criterion",
        "Critere 1",
        "--policy-profile",
        "",
      ],
      expectedMessage: "Le policy profile initial est obligatoire.",
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

test("mission create echoue proprement si le workspace n'est pas initialise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-create-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission V1",
    "--objective",
    "Poser une mission persistante",
    "--success-criterion",
    "Critere 1",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${rootDir}\` avant \`corp mission create\`.`,
  );
});
