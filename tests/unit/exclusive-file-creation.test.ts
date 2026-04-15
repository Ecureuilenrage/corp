import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { ensureAppendOnlyEventLog } from "../../packages/journal/src/event-log/file-event-log";
import { seedProjectionStore } from "../../packages/storage/src/projection-store/file-projection-store";

test("ensureAppendOnlyEventLog ne signale qu'une creation sous appels concurrents", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-exclusive-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  const results = await Promise.all(
    Array.from({ length: 20 }, () => ensureAppendOnlyEventLog(journalPath)),
  );

  assert.equal(results.filter(Boolean).length, 1);
});

test("seedProjectionStore traite EEXIST comme benign sous appels concurrents", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-projection-seed-exclusive-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      seedProjectionStore(rootDir, {
        "resume-view": { schemaVersion: 1, resume: null },
      })
    ),
  );
  const createdCount = results
    .flatMap((result) => result.createdPaths)
    .filter((createdPath) => createdPath.endsWith("resume-view.json"))
    .length;

  assert.equal(createdCount, 1);
});
