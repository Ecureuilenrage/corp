import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  DEFAULT_PROJECTIONS,
  bootstrapMissionWorkspace,
} from "../../packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace";

test("le bootstrap cree un journal local et les projections V1 minimales de facon deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-bootstrap-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const result = await bootstrapMissionWorkspace({ rootDir });
  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const missionsDir = path.join(rootDir, ".corp", "missions");
  const isolationsDir = path.join(rootDir, ".corp", "isolations");
  const capabilitiesDir = path.join(rootDir, ".corp", "capabilities");
  const skillPacksDir = path.join(rootDir, ".corp", "skill-packs");

  assert.equal(result.rootDir, rootDir);
  assert.equal(result.journalPath, journalPath);
  assert.equal(result.missionsDir, missionsDir);
  assert.equal(result.isolationsDir, isolationsDir);
  assert.equal(result.capabilitiesDir, capabilitiesDir);
  assert.equal(result.skillPacksDir, skillPacksDir);
  assert.equal(await readFile(journalPath, "utf8"), "");
  await access(missionsDir);
  await access(isolationsDir);
  await access(capabilitiesDir);
  await access(skillPacksDir);

  for (const [projectionName, expectedState] of Object.entries(DEFAULT_PROJECTIONS)) {
    const projectionPath = path.join(
      rootDir,
      ".corp",
      "projections",
      `${projectionName}.json`,
    );

    assert.deepEqual(
      JSON.parse(await readFile(projectionPath, "utf8")),
      expectedState,
      `projection ${projectionName} should match the canonical bootstrap state`,
    );
  }
});

test("le bootstrap reste idempotent avec l'extension du layout missions", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-bootstrap-idempotent-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const firstRun = await bootstrapMissionWorkspace({ rootDir });
  const secondRun = await bootstrapMissionWorkspace({ rootDir });

  assert.ok(firstRun.createdPaths.length > 0);
  assert.deepEqual(secondRun.createdPaths, []);
  await access(path.join(rootDir, ".corp", "missions"));
  await access(path.join(rootDir, ".corp", "isolations"));
  await access(path.join(rootDir, ".corp", "capabilities"));
  await access(path.join(rootDir, ".corp", "skill-packs"));
  assert.equal(
    await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"),
    "",
  );
});
