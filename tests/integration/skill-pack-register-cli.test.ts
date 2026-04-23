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

function getFixturePath(fileName: string): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
}

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

test("corp extension skill-pack register exige un workspace initialise", { concurrency: false }, async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-cli-uninitialized-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const registerResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-skill-pack.json"),
  ]);

  assert.equal(registerResult.exitCode, 1);
  assert.match(registerResult.lines.join("\n"), /Workspace mission non initialise/i);

  await assert.rejects(
    stat(path.join(rootDir, ".corp")),
    /ENOENT/,
  );
});

test("corp extension skill-pack register distingue un workspace ancien sans repertoire skill-packs", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-cli-legacy-"));
  const corpDir = path.join(rootDir, ".corp");

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await mkdir(path.join(corpDir, "journal"), { recursive: true });
  await mkdir(path.join(corpDir, "projections"), { recursive: true });
  await mkdir(path.join(corpDir, "missions"), { recursive: true });
  await mkdir(path.join(corpDir, "isolations"), { recursive: true });
  await mkdir(path.join(corpDir, "capabilities"), { recursive: true });
  await writeFile(path.join(corpDir, "journal", "events.jsonl"), "", "utf8");

  const registerResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-skill-pack.json"),
  ]);

  assert.equal(registerResult.exitCode, 1);
  assert.match(registerResult.lines.join("\n"), /repertoire skill-packs n'est pas initialise/i);
  assert.match(registerResult.lines.join("\n"), /corp mission bootstrap --root/i);
});

test("corp extension skill-pack register puis show restent metadata-first", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-cli-show-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const registerResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-skill-pack.json"),
  ]);

  assert.equal(registerResult.exitCode, 0);
  assert.match(registerResult.lines.join("\n"), /Skill pack enregistre: pack\.triage\.local/);
  assert.match(registerResult.lines.join("\n"), /Statut: registered/);

  const storedSkillPack = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "skill-packs", "pack.triage.local", "skill-pack.json"),
  );
  assert.equal(storedSkillPack.packRef, "pack.triage.local");
  assert.equal(storedSkillPack.displayName, "Pack de triage local");

  const showResult = await runCommand([
    "extension",
    "skill-pack",
    "show",
    "--root",
    rootDir,
    "--pack-ref",
    "pack.triage.local",
  ]);
  const showOutput = showResult.lines.join("\n");

  assert.equal(showResult.exitCode, 0);
  assert.match(showOutput, /Skill pack: pack\.triage\.local/);
  assert.match(showOutput, /Display name: Pack de triage local/);
  assert.match(showOutput, /Description: Declare un skill pack local pret a etre charge plus tard par le runtime\./);
  assert.match(showOutput, /Owner: core-platform/);
  assert.match(showOutput, /Tags: skill-pack, local/);
  assert.match(showOutput, /Root dir: .*triage-pack/i);
  assert.match(showOutput, /References: .*README\.md/i);
  assert.match(showOutput, /Metadata file: .*pack\.json/i);
  assert.match(showOutput, /Scripts: .*preflight\.sh/i);
  assert.match(showOutput, /Source manifest: .*valid-skill-pack\.json/i);
  assert.match(showOutput, /Registered at: /i);
  assert.doesNotMatch(showOutput, /Pack de triage local\./);
  assert.doesNotMatch(showOutput, /echo "preflight"/);

  const secondRegisterResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-skill-pack.json"),
  ]);

  assert.equal(secondRegisterResult.exitCode, 0);
  assert.match(secondRegisterResult.lines.join("\n"), /Statut: unchanged/);

  const listResult = await runCommand([
    "extension",
    "skill-pack",
    "list",
    "--root",
    rootDir,
  ]);

  assert.equal(listResult.exitCode, 0);
  assert.match(listResult.lines.join("\n"), /Skill packs valides: 1/);
  assert.match(listResult.lines.join("\n"), /pack\.triage\.local \| displayName=Pack de triage local/);
  assert.match(listResult.lines.join("\n"), /Diagnostics invalides: aucun/);
});

test("corp extension skill-pack register rejette un seam hors scope et show echoue sur un pack inconnu", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-cli-errors-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const seamResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(seamResult.exitCode, 1);
  assert.match(seamResult.lines.join("\n"), /Seam non supporte.*capability/i);

  const showResult = await runCommand([
    "extension",
    "skill-pack",
    "show",
    "--root",
    rootDir,
    "--pack-ref",
    "pack.unknown",
  ]);

  assert.equal(showResult.exitCode, 1);
  assert.match(showResult.lines.join("\n"), /Skill pack introuvable.*pack\.unknown/i);
});

test("corp extension skill-pack register rejette une ref locale hors du rootDir du pack", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-cli-boundary-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const rootDir = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(
    path.join(process.cwd(), "tests", "fixtures", "extensions"),
    copiedFixturesDir,
    { recursive: true },
  );
  await writeFile(
    path.join(copiedFixturesDir, "skill-packs", "outside.md"),
    "outside\n",
    "utf8",
  );
  await writeFile(
    path.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"),
    `${JSON.stringify({
      schemaVersion: "corp.extension.v1",
      seamType: "skill_pack",
      id: "ext.skill-pack.outside-root",
      displayName: "Pack hors frontiere",
      version: "0.1.0",
      permissions: ["docs.read"],
      constraints: ["local_only", "workspace_scoped"],
      metadata: {
        description: "Fixture de test hors frontiere.",
        owner: "core-platform",
        tags: ["skill-pack", "invalid"],
      },
      localRefs: {
        rootDir: "./skill-packs/triage-pack",
        references: ["./skill-packs/triage-pack/../outside.md"],
        metadataFile: "./skill-packs/triage-pack/pack.json",
        scripts: [],
      },
      skillPack: {
        packRef: "pack.outside.root",
      },
    }, null, 2)}\n`,
    "utf8",
  );

  await bootstrapWorkspace(rootDir);

  const registerResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    path.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"),
  ]);

  assert.equal(registerResult.exitCode, 1);
  assert.match(registerResult.lines.join("\n"), /frontiere locale/i);
});

test("corp extension skill-pack list expose les packs sains et les diagnostics corrompus ensemble", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-cli-list-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const registerResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-skill-pack.json"),
  ]);

  assert.equal(registerResult.exitCode, 0);

  const corruptPath = path.join(
    rootDir,
    ".corp",
    "skill-packs",
    "pack.corrupt",
    "skill-pack.json",
  );
  await mkdir(path.dirname(corruptPath), { recursive: true });
  await writeFile(corruptPath, "{json invalide\n", "utf8");

  const listResult = await runCommand([
    "extension",
    "skill-pack",
    "list",
    "--root",
    rootDir,
  ]);
  const output = listResult.lines.join("\n");

  assert.equal(listResult.exitCode, 1);
  assert.match(output, /Skill packs valides: 1/);
  assert.match(output, /pack\.triage\.local \| displayName=Pack de triage local/);
  assert.match(output, /Diagnostics invalides: 1/);
  assert.match(output, /pack\.corrupt \| code=json_corrompu/);
  assert.match(output, /message=json_corrompu: fichier de registre corrompu pour le skill pack `pack\.corrupt` invalide/i);
});
