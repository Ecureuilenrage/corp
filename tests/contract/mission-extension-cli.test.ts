import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";

test("la CLI expose la commande mission extension select dans l'aide globale", async () => {
  const lines: string[] = [];
  const exitCode = await runCli([], {
    writeLine: (line: string) => lines.push(line),
  });
  const output = lines.join("\n");

  assert.equal(exitCode, 0);
  assert.match(
    output,
    /corp mission extension select --root <workspace> --mission-id <mission_id>/,
  );
  assert.match(
    output,
    /corp extension skill-pack list --root <workspace>/,
  );
});

test("mission extension select rejette les combinaisons incompatibles avant execution", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-cli-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const lines: string[] = [];
  const exitCode = await runCli([
    "mission",
    "extension",
    "select",
    "--root",
    rootDir,
    "--mission-id",
    "mission_demo",
    "--allow-capability",
    "shell.exec",
    "--clear-allow-capability",
  ], {
    writeLine: (line: string) => lines.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(
    lines.at(-1),
    "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission extension select`.",
  );
});
