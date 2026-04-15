import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import {
  EventLogReadError,
  normalizeEventLogReadError,
} from "../../packages/journal/src/event-log/event-log-errors";
import {
  ensureAppendOnlyEventLog,
  isJournalEventRecord,
  readEventLog,
} from "../../packages/journal/src/event-log/file-event-log";

function createEvent(index: number): JournalEventRecord {
  return {
    eventId: `event_${index}`,
    type: "mission.created",
    missionId: "mission_event_log",
    occurredAt: "2026-04-15T10:00:00.000Z",
    actor: "operator",
    source: "test",
    payload: {
      index,
    },
  };
}

test("readEventLog parse le journal ligne-a-ligne et exporte le guard event", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-valid-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  await writeFile(
    journalPath,
    `${JSON.stringify(createEvent(1))}\n${JSON.stringify(createEvent(2))}\n`,
    "utf8",
  );

  const events = await readEventLog(journalPath);

  assert.equal(events.length, 2);
  assert.equal(events[0].eventId, "event_1");
  assert.equal(isJournalEventRecord(events[1]), true);
});

test("readEventLog classe ENOENT comme journal_manquant avec action operateur", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-missing-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");

  await assert.rejects(
    () => readEventLog(journalPath),
    (error: unknown) => {
      assert.ok(error instanceof EventLogReadError);
      assert.equal(error.code, "journal_manquant");
      assert.equal(error.journalPath, journalPath);
      assert.match(error.message, /journal_manquant/i);
      assert.match(error.message, /relancez.*bootstrap|restaurez le journal/i);
      return true;
    },
  );
});

test("readEventLog indique la ligne JSON corrompue sans SyntaxError brut", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-json-invalid-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  await writeFile(journalPath, `${JSON.stringify(createEvent(1))}\n{json invalide\n`, "utf8");

  await assert.rejects(
    () => readEventLog(journalPath),
    (error: unknown) => {
      assert.ok(error instanceof EventLogReadError);
      assert.equal(error.code, "journal_invalide");
      assert.equal(error.lineNumber, 2);
      assert.match(error.message, /ligne 2/);
      assert.doesNotMatch(error.message, /SyntaxError/);
      return true;
    },
  );
});

test("readEventLog rejette une ligne event valide JSON mais schema invalide", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-schema-invalid-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  await writeFile(
    journalPath,
    `${JSON.stringify({ ...createEvent(1), payload: null })}\n`,
    "utf8",
  );

  await assert.rejects(
    () => readEventLog(journalPath),
    (error: unknown) => {
      assert.ok(error instanceof EventLogReadError);
      assert.equal(error.code, "journal_invalide");
      assert.equal(error.lineNumber, 1);
      assert.match(error.message, /schema invalide|type incorrect/i);
      return true;
    },
  );
});

test("ensureAppendOnlyEventLog tronque seulement une derniere ligne clairement incomplete", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-truncated-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  const validLine = `${JSON.stringify(createEvent(1))}\n`;
  await writeFile(journalPath, `${validLine}{"eventId":"event_truncated"`, "utf8");

  const created = await ensureAppendOnlyEventLog(journalPath);
  const contents = await readFile(journalPath, "utf8");

  assert.equal(created, false);
  assert.equal(contents, validLine);
  assert.equal((await readEventLog(journalPath)).length, 1);
});

test("ensureAppendOnlyEventLog garde une ligne complete semantiquement invalide en erreur explicite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-complete-invalid-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  const contents = `${JSON.stringify(createEvent(1))}\n${JSON.stringify({ eventId: "event_invalid" })}\n`;
  await writeFile(journalPath, contents, "utf8");

  await assert.rejects(
    () => ensureAppendOnlyEventLog(journalPath),
    (error: unknown) => {
      assert.ok(error instanceof EventLogReadError);
      assert.equal(error.code, "journal_invalide");
      assert.equal(error.lineNumber, 2);
      return true;
    },
  );
  assert.equal(await readFile(journalPath, "utf8"), contents);
});

test("normalizeEventLogReadError conserve le code OS et le chemin", () => {
  const journalPath = "C:/tmp/events.jsonl";
  const errno = Object.assign(new Error("permission denied"), { code: "EACCES" });
  const error = normalizeEventLogReadError(errno, journalPath);

  assert.ok(error instanceof EventLogReadError);
  assert.equal(error.code, "erreur_fichier");
  assert.equal(error.osCode, "EACCES");
  assert.equal(error.journalPath, journalPath);
  assert.match(error.message, /EACCES/);
  assert.match(error.message, /events\.jsonl/);
});
