import assert from "node:assert/strict";
import { cp, mkdtemp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";

function getFixtureRoot(): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions");
}

test("la CLI racine expose la surface extension en plus du flux mission", async () => {
  const lines: string[] = [];
  const exitCode = await runCli([], {
    writeLine: (line: string) => lines.push(line),
  });
  const output = lines.join("\n");

  assert.equal(exitCode, 0);
  assert.match(output, /corp mission bootstrap/);
  assert.match(output, /corp extension validate --file <path>/);
  assert.match(output, /corp extension capability register --root <workspace> --file <path>/);
  assert.match(output, /corp extension skill-pack register --root <workspace> --file <path>/);
  assert.match(output, /corp extension skill-pack show --root <workspace> --pack-ref <ref>/);
  assert.doesNotMatch(output, /codex|openai|responseId|pollCursor|vendorStatus|apiKey/i);
});

test("corp extension validate fonctionne offline sans bootstrap mission ni creation de .corp", { concurrency: false }, async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-extension-cli-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const previousCwd = process.cwd();

  t.after(async () => {
    process.chdir(previousCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  process.chdir(tempDir);

  const lines: string[] = [];
  const exitCode = await runCli(
    ["extension", "validate", "--file", path.join("fixtures", "extensions", "valid-skill-pack.json")],
    {
      writeLine: (line: string) => lines.push(line),
    },
  );
  const output = lines.join("\n");

  assert.equal(exitCode, 0);
  assert.match(output, /Validation extension: ok/);
  assert.match(output, /Type de seam: skill_pack/);
  assert.match(output, /Pack public: pack\.triage\.local/);

  await assert.rejects(
    stat(path.join(tempDir, ".corp")),
    /ENOENT/,
  );
});

test("corp extension validate rend des diagnostics lisibles sur un manifeste invalide", async () => {
  const lines: string[] = [];
  const exitCode = await runCli(
    ["extension", "validate", "--file", path.join(getFixtureRoot(), "invalid-marketplace.json")],
    {
      writeLine: (line: string) => lines.push(line),
    },
  );
  const output = lines.join("\n");

  assert.equal(exitCode, 1);
  assert.match(output, /Validation extension: echec/);
  assert.match(output, /out_of_scope_field/);
  assert.match(output, /marketplace/);
  assert.doesNotMatch(output, /responseId|threadId|pollCursor|vendorStatus|apiKey|token/i);
});
