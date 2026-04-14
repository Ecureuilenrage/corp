import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function getFixtureRoot(): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions");
}

function getFixturePath(fileName: string): string {
  return path.join(getFixtureRoot(), fileName);
}

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

test("corp extension capability register exige un workspace initialise et preserve validate en lecture seule", { concurrency: false }, async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-cli-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const registerResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(registerResult.exitCode, 1);
  assert.match(
    registerResult.lines.join("\n"),
    /Workspace mission non initialise/i,
  );

  await assert.rejects(
    stat(path.join(rootDir, ".corp")),
    /ENOENT/,
  );

  const validateResult = await runCommand([
    "extension",
    "validate",
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(validateResult.exitCode, 0);
  assert.match(validateResult.lines.join("\n"), /Validation extension: ok/);

  await assert.rejects(
    stat(path.join(rootDir, ".corp")),
    /ENOENT/,
  );
});

test("corp extension capability register distingue un workspace ancien sans repertoire capabilities", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-cli-legacy-workspace-"));
  const corpDir = path.join(rootDir, ".corp");

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await mkdir(path.join(corpDir, "journal"), { recursive: true });
  await mkdir(path.join(corpDir, "projections"), { recursive: true });
  await mkdir(path.join(corpDir, "missions"), { recursive: true });
  await writeFile(path.join(corpDir, "journal", "events.jsonl"), "", "utf8");

  const registerResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(registerResult.exitCode, 1);
  assert.match(
    registerResult.lines.join("\n"),
    /repertoire capabilities n'est pas initialise/i,
  );
  assert.match(
    registerResult.lines.join("\n"),
    /corp mission bootstrap --root/i,
  );

  await bootstrapWorkspace(rootDir);

  const retryResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(retryResult.exitCode, 0);
  assert.match(retryResult.lines.join("\n"), /Capability enregistree: shell\.exec/);
});

test("corp extension capability register enregistre les providers local et mcp de facon deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-cli-register-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const localResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);
  const localOutput = localResult.lines.join("\n");
  const localStored = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "capabilities", "shell.exec", "capability.json"),
  );

  assert.equal(localResult.exitCode, 0);
  assert.match(localOutput, /Capability enregistree: shell\.exec/);
  assert.match(localOutput, /Statut: registered/);
  assert.equal(localStored.capabilityId, "shell.exec");
  assert.equal(localStored.provider, "local");

  const secondLocalResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(secondLocalResult.exitCode, 0);
  assert.match(secondLocalResult.lines.join("\n"), /Statut: unchanged/);

  const mcpResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-mcp.json"),
  ]);
  const mcpOutput = mcpResult.lines.join("\n");
  const mcpStored = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "capabilities", "docs.search", "capability.json"),
  );

  assert.equal(mcpResult.exitCode, 0);
  assert.match(mcpOutput, /Capability enregistree: docs\.search/);
  assert.equal(mcpStored.capabilityId, "docs.search");
  assert.deepEqual(mcpStored.mcp, {
    serverName: "corp-mcp",
    toolName: "search_local_docs",
  });
  assert.doesNotMatch(
    JSON.stringify(mcpStored),
    /enabled_tools|disabled_tools|tool_timeout_sec|token|secret|apiKey/i,
  );
});

test("corp extension capability register rejette un seam hors scope et une collision ambigue", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-capability-cli-collision-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const rootDir = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  await writeFile(
    path.join(copiedFixturesDir, "valid-capability-local-conflict.json"),
    `${JSON.stringify({
      schemaVersion: "corp.extension.v1",
      seamType: "capability",
      id: "ext.capability.shell.exec.alt",
      displayName: "Shell exec local alt",
      version: "0.1.0",
      permissions: ["shell.exec"],
      constraints: ["local_only", "workspace_scoped"],
      metadata: {
        description: "Manifeste de test pour collision.",
        owner: "core-platform",
        tags: ["capability", "local"],
      },
      localRefs: {
        rootDir: ".",
        entrypoint: "./capabilities/shell-exec.ts",
        references: ["./docs/capability-local.md"],
        scripts: [],
      },
      capability: {
        capabilityId: "shell.exec",
        provider: "local",
        approvalSensitive: false,
        requiredEnvNames: [],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  await bootstrapWorkspace(rootDir);

  const seamResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-skill-pack.json"),
  ]);

  assert.equal(seamResult.exitCode, 1);
  assert.match(seamResult.lines.join("\n"), /Seam non supporte.*skill_pack/i);

  const firstRegister = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    path.join(copiedFixturesDir, "valid-capability-local.json"),
  ]);
  const conflictRegister = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    path.join(copiedFixturesDir, "valid-capability-local-conflict.json"),
  ]);

  assert.equal(firstRegister.exitCode, 0);
  assert.equal(conflictRegister.exitCode, 1);
  assert.match(conflictRegister.lines.join("\n"), /Collision ambigue.*shell\.exec/i);
});

test("corp extension capability affiche l'aide et retourne 1 pour une sous-commande inconnue", async () => {
  const result = await runCommand([
    "extension",
    "capability",
    "list",
  ]);

  assert.equal(result.exitCode, 1);
  assert.match(result.lines.join("\n"), /Commande extension capability inconnue: list/i);
  assert.match(result.lines.join("\n"), /corp extension <commande>/i);
});
