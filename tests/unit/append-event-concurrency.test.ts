import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  appendEvent,
  type JournalEventRecord,
} from "../../packages/journal/src/event-log/append-event";

function buildEvent(index: number, missionId: string): JournalEventRecord {
  return {
    eventId: `event_${String(index).padStart(4, "0")}`,
    type: "test.concurrent_append",
    missionId,
    occurredAt: new Date(1_700_000_000_000 + index).toISOString(),
    actor: "test",
    source: "unit",
    payload: {
      index,
      // Charge utile volumineuse pour augmenter la probabilite d'entrelacement
      // en cas d'appendFile non serialise.
      filler: "x".repeat(512),
    },
  };
}

test("appendEvent serialise 10 appends concurrents sur le meme journal sans ligne tronquee", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-append-event-concurrent-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  await writeFile(journalPath, "", "utf8");

  const concurrentCount = 10;
  const missionId = "mission_concurrent";
  const appendPromises = Array.from({ length: concurrentCount }, (_, index) =>
    appendEvent(journalPath, buildEvent(index, missionId)),
  );

  await Promise.all(appendPromises);

  const content = await readFile(journalPath, "utf8");
  const lines = content.split("\n").filter((line) => line.length > 0);

  assert.equal(lines.length, concurrentCount);

  const seenIndexes = new Set<number>();
  for (const line of lines) {
    const parsed = JSON.parse(line) as {
      missionId?: string;
      payload?: { index?: number; filler?: string };
    };

    assert.equal(parsed.missionId, missionId);
    assert.equal(parsed.payload?.filler?.length, 512);
    assert.equal(typeof parsed.payload?.index, "number");

    seenIndexes.add(parsed.payload!.index!);
  }

  assert.equal(seenIndexes.size, concurrentCount);
});

test("appendEvent serialise les appends par chemin sans bloquer les autres journaux", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-append-event-multi-path-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPathA = path.join(rootDir, "events-a.jsonl");
  const journalPathB = path.join(rootDir, "events-b.jsonl");
  await writeFile(journalPathA, "", "utf8");
  await writeFile(journalPathB, "", "utf8");

  await Promise.all([
    ...Array.from({ length: 5 }, (_, index) =>
      appendEvent(journalPathA, buildEvent(index, "mission_a")),
    ),
    ...Array.from({ length: 5 }, (_, index) =>
      appendEvent(journalPathB, buildEvent(index, "mission_b")),
    ),
  ]);

  const linesA = (await readFile(journalPathA, "utf8"))
    .split("\n")
    .filter((line) => line.length > 0);
  const linesB = (await readFile(journalPathB, "utf8"))
    .split("\n")
    .filter((line) => line.length > 0);

  assert.equal(linesA.length, 5);
  assert.equal(linesB.length, 5);

  for (const line of linesA) {
    assert.equal((JSON.parse(line) as { missionId: string }).missionId, "mission_a");
  }
  for (const line of linesB) {
    assert.equal((JSON.parse(line) as { missionId: string }).missionId, "mission_b");
  }
});
