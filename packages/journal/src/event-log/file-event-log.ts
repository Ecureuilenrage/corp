import { createReadStream } from "node:fs";
import { readFile, truncate, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { finished } from "node:stream/promises";

import { isAlreadyExistsError } from "../../../storage/src/fs-layout/atomic-json";
import { isFileSystemReadError } from "../../../storage/src/fs-layout/file-system-read-errors";
import type { JournalEventRecord } from "./append-event";
import { EventLogReadError, normalizeEventLogReadError } from "./event-log-errors";

interface EventLogDependencies {
  createReadStream: typeof createReadStream;
  readFile: typeof readFile;
  truncate: typeof truncate;
  writeFile: typeof writeFile;
}

const DEFAULT_EVENT_LOG_DEPENDENCIES: EventLogDependencies = {
  createReadStream,
  readFile,
  truncate,
  writeFile,
};

let eventLogDependenciesForTesting: Partial<EventLogDependencies> | null = null;

export function setEventLogDependenciesForTesting(
  dependencies: Partial<EventLogDependencies> | null,
): void {
  eventLogDependenciesForTesting = dependencies;
}

export async function ensureAppendOnlyEventLog(journalPath: string): Promise<boolean> {
  try {
    await getEventLogDependencies().writeFile(journalPath, "", {
      encoding: "utf8",
      flag: "wx",
    });
    return true;
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      await validateExistingAppendOnlyEventLog(journalPath);
      return false;
    }

    if (isFileSystemReadError(error)) {
      throw EventLogReadError.fileSystem(journalPath, error);
    }

    throw error;
  }
}

export async function readEventLog(journalPath: string): Promise<JournalEventRecord[]> {
  const events: JournalEventRecord[] = [];
  const stream = getEventLogDependencies().createReadStream(journalPath, { encoding: "utf8" });
  const lines = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  let lineNumber = 0;

  try {
    for await (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.trim();

      if (line.length === 0) {
        continue;
      }

      events.push(parseJournalEventLine(line, journalPath, lineNumber));
    }
    await finished(stream, { cleanup: true });
  } catch (error: unknown) {
    throw normalizeEventLogReadError(error, journalPath);
  } finally {
    lines.close();
    if (!stream.destroyed) {
      stream.destroy();
    }
  }

  return events;
}

export function isJournalEventRecord(value: unknown): value is JournalEventRecord {
  return validateJournalEventRecord(value).ok;
}

export function validateJournalEventRecord(value: unknown): {
  ok: true;
} | {
  ok: false;
  reason: string;
} {
  if (!isRecord(value)) {
    return { ok: false, reason: "type incorrect `JournalEventRecord`: attendu objet" };
  }

  const candidate = value as Record<string, unknown>;
  const validations = [
    validateString(candidate, "eventId"),
    validateString(candidate, "type"),
    validateString(candidate, "missionId"),
    validateOptionalString(candidate, "ticketId"),
    validateOptionalString(candidate, "attemptId"),
    validateString(candidate, "occurredAt"),
    validateString(candidate, "actor"),
    validateString(candidate, "source"),
    validatePayload(candidate),
  ];

  return validations.find((validation) => !validation.ok) ?? { ok: true };
}

async function validateExistingAppendOnlyEventLog(journalPath: string): Promise<void> {
  let contents: string;

  try {
    contents = await getEventLogDependencies().readFile(journalPath, "utf8");
  } catch (error) {
    throw normalizeEventLogReadError(error, journalPath);
  }

  if (contents.length === 0) {
    return;
  }

  if (contents.endsWith("\n")) {
    await readEventLog(journalPath);
    return;
  }

  const lastLineStart = contents.lastIndexOf("\n") + 1;
  const validatedPrefix = contents.slice(0, lastLineStart);
  const lastLine = contents.slice(lastLineStart);
  const lineNumber = countLineNumberAtOffset(contents, lastLineStart);
  const trimmedLastLine = lastLine.trim();

  validateBufferedEventLog(validatedPrefix, journalPath);

  if (trimmedLastLine.length === 0) {
    await truncateJournal(journalPath, lastLineStart);
    return;
  }

  let parsedLastLine: unknown;

  try {
    parsedLastLine = JSON.parse(trimmedLastLine) as unknown;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      await truncateJournal(journalPath, lastLineStart);
      return;
    }

    throw normalizeEventLogReadError(error, journalPath);
  }

  const validation = validateJournalEventRecord(parsedLastLine);
  if (!validation.ok) {
    throw EventLogReadError.invalid({
      journalPath,
      lineNumber,
      reason: validation.reason,
    });
  }
}

async function truncateJournal(journalPath: string, length: number): Promise<void> {
  try {
    await getEventLogDependencies().truncate(journalPath, length);
  } catch (error) {
    throw normalizeEventLogReadError(error, journalPath);
  }
}

function validateBufferedEventLog(contents: string, journalPath: string): void {
  if (!contents) {
    return;
  }

  const lines = contents.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    parseJournalEventLine(line, journalPath, index + 1);
  }
}

function parseJournalEventLine(
  line: string,
  journalPath: string,
  lineNumber: number,
): JournalEventRecord {
  let parsedEvent: unknown;

  try {
    parsedEvent = JSON.parse(line) as unknown;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw EventLogReadError.invalid({
        journalPath,
        lineNumber,
        reason: "JSON corrompu",
        cause: error,
      });
    }

    throw normalizeEventLogReadError(error, journalPath);
  }

  const validation = validateJournalEventRecord(parsedEvent);
  if (!validation.ok) {
    throw EventLogReadError.invalid({
      journalPath,
      lineNumber,
      reason: validation.reason,
    });
  }

  return parsedEvent as JournalEventRecord;
}

function countLineNumberAtOffset(contents: string, offset: number): number {
  if (offset === 0) {
    return 1;
  }

  return contents.slice(0, offset).split("\n").length;
}

function validateString(
  record: Record<string, unknown>,
  fieldName: string,
): { ok: true } | { ok: false; reason: string } {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return { ok: false, reason: `champ manquant \`${fieldName}\`` };
  }

  return typeof record[fieldName] === "string"
    ? { ok: true }
    : { ok: false, reason: `type incorrect \`${fieldName}\`: attendu string` };
}

function validateOptionalString(
  record: Record<string, unknown>,
  fieldName: string,
): { ok: true } | { ok: false; reason: string } {
  if (!(fieldName in record) || record[fieldName] === undefined) {
    return { ok: true };
  }

  return typeof record[fieldName] === "string"
    ? { ok: true }
    : { ok: false, reason: `type incorrect \`${fieldName}\`: attendu string optionnel` };
}

function validatePayload(
  record: Record<string, unknown>,
): { ok: true } | { ok: false; reason: string } {
  if (!("payload" in record) || record.payload === undefined) {
    return { ok: false, reason: "champ manquant `payload`" };
  }

  return isRecord(record.payload)
    ? { ok: true }
    : { ok: false, reason: "type incorrect `payload`: attendu objet" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getEventLogDependencies(): EventLogDependencies {
  return {
    ...DEFAULT_EVENT_LOG_DEPENDENCIES,
    ...eventLogDependenciesForTesting,
  };
}
