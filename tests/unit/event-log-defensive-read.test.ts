import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
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
  setEventLogDependenciesForTesting,
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

test("ensureAppendOnlyEventLog accepte une derniere ligne valide sans newline finale sans relire le journal", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-complete-no-newline-"));
  t.after(async () => {
    setEventLogDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const journalPath = path.join(rootDir, "events.jsonl");
  const contents = `${JSON.stringify(createEvent(1))}\n${JSON.stringify(createEvent(2))}`;
  await writeFile(journalPath, contents, "utf8");

  setEventLogDependenciesForTesting({
    createReadStream: (() => {
      throw new Error("readEventLog ne doit pas etre appele pour une derniere ligne valide");
    }) as typeof import("node:fs").createReadStream,
  });

  const created = await ensureAppendOnlyEventLog(journalPath);

  assert.equal(created, false);
  assert.equal(await readFile(journalPath, "utf8"), contents);
});

test("ensureAppendOnlyEventLog classe EROFS et EISDIR comme erreurs de lecture journal", async (t) => {
  t.after(() => {
    setEventLogDependenciesForTesting(null);
  });

  for (const osCode of ["EROFS", "EISDIR"] as const) {
    setEventLogDependenciesForTesting({
      writeFile: (async () => {
        const error = new Error(`${osCode}: simulated`) as NodeJS.ErrnoException;
        error.code = osCode;
        throw error;
      }) as typeof import("node:fs/promises").writeFile,
    });

    await assert.rejects(
      () => ensureAppendOnlyEventLog(`C:/tmp/${osCode.toLowerCase()}.jsonl`),
      (error: unknown) => {
        assert.ok(error instanceof EventLogReadError);
        assert.equal(error.code, "erreur_fichier");
        assert.equal(error.osCode, osCode);
        assert.match(error.message, new RegExp(osCode));
        return true;
      },
    );
  }
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

test("normalizeEventLogReadError preserve la cause pour une erreur opaque", () => {
  const journalPath = "C:/tmp/events.jsonl";
  const cause = { kind: "opaque_event_log_failure" };
  const error = normalizeEventLogReadError(cause, journalPath);

  assert.ok(error instanceof Error);
  assert.equal(error.cause, cause);
  assert.match(error.message, /journal append-only irreconciliable/i);
});

test("readEventLog capture une erreur async du stream et ne fuit pas en unhandledRejection", async (t) => {
  let unhandledRejection = false;
  const onUnhandledRejection = () => {
    unhandledRejection = true;
  };

  class AsyncErrorReadable extends Readable {
    private emitted = false;

    public override _read(): void {
      if (this.emitted) {
        return;
      }

      this.emitted = true;
      this.push(`${JSON.stringify(createEvent(1))}\n`);

      setImmediate(() => {
        const error = new Error("EBADF: simulated async stream failure") as NodeJS.ErrnoException;
        error.code = "EBADF";
        this.destroy(error);
      });
    }
  }

  process.once("unhandledRejection", onUnhandledRejection);
  t.after(() => {
    process.removeListener("unhandledRejection", onUnhandledRejection);
    setEventLogDependenciesForTesting(null);
  });

  setEventLogDependenciesForTesting({
    createReadStream: (() => new AsyncErrorReadable()) as unknown as typeof import("node:fs").createReadStream,
  });

  await assert.rejects(
    () => readEventLog("C:/tmp/events.jsonl"),
    (error: unknown) => {
      assert.ok(error instanceof EventLogReadError);
      assert.equal(error.code, "erreur_fichier");
      assert.equal(error.osCode, "EBADF");
      return true;
    },
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(unhandledRejection, false);
});

test("readEventLog normalise une erreur inattendue de JSON.parse en preservant la cause", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-event-log-unknown-json-"));
  const journalPath = path.join(rootDir, "events.jsonl");
  const rootCause = new TypeError("synthetic event-log parse failure");
  const originalJsonParse = JSON.parse;

  t.after(async () => {
    JSON.parse = originalJsonParse;
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeFile(journalPath, `${JSON.stringify(createEvent(1))}\n`, "utf8");

  JSON.parse = (() => {
    throw rootCause;
  }) as typeof JSON.parse;

  await assert.rejects(
    () => readEventLog(journalPath),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /journal append-only irreconciliable/i);
      assert.equal(error.cause, rootCause);
      return true;
    },
  );
});
