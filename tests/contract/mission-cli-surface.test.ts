import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import packageJson from "../../package.json";
import { runCli } from "../../apps/corp-cli/src/index";

test("le binaire corp pointe vers l'entree CLI dediee", () => {
  assert.equal(packageJson.bin.corp, "dist/apps/corp-cli/src/index.js");
});

test("la CLI expose une entree mission-centrique sans fuite vendor", async () => {
  const lines: string[] = [];

  const exitCode = await runCli([], {
    writeLine: (line: string) => lines.push(line),
  });

  const output = lines.join("\n");

  assert.equal(exitCode, 0);
  assert.match(output, /corp mission bootstrap/);
  assert.match(output, /corp mission create/);
  assert.match(output, /corp mission ticket create/);
  assert.match(output, /corp mission ticket run/);
  assert.match(output, /corp mission audit/);
  assert.doesNotMatch(output, /codex|openai/i);
});

test("la commande mission bootstrap initialise le socle local-first", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-cli-bootstrap-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const lines: string[] = [];
  const exitCode = await runCli(["mission", "bootstrap", "--root", rootDir], {
    writeLine: (line: string) => lines.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(lines.join("\n"), /socle mission/i);
  assert.equal(
    await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"),
    "",
  );
});
