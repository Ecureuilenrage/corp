import { access, readFile, writeFile } from "node:fs/promises";

import type { JournalEventRecord } from "./append-event";

export async function ensureAppendOnlyEventLog(journalPath: string): Promise<boolean> {
  try {
    await access(journalPath);
    return false;
  } catch {
    await writeFile(journalPath, "", "utf8");
    return true;
  }
}

export async function readEventLog(journalPath: string): Promise<JournalEventRecord[]> {
  const contents = await readFile(journalPath, "utf8");
  const events: JournalEventRecord[] = [];

  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue;
    }

    let parsedEvent: unknown;

    try {
      parsedEvent = JSON.parse(line);
    } catch {
      throw new Error(`Le journal append-only est invalide a la ligne ${index + 1}.`);
    }

    if (!isJournalEventRecord(parsedEvent)) {
      throw new Error(`Le journal append-only est invalide a la ligne ${index + 1}.`);
    }

    events.push(parsedEvent);
  }

  return events;
}

function isJournalEventRecord(value: unknown): value is JournalEventRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.eventId === "string"
    && typeof candidate.type === "string"
    && typeof candidate.missionId === "string"
    && (candidate.ticketId === undefined || typeof candidate.ticketId === "string")
    && (candidate.attemptId === undefined || typeof candidate.attemptId === "string")
    && typeof candidate.occurredAt === "string"
    && typeof candidate.actor === "string"
    && typeof candidate.source === "string"
    && typeof candidate.payload === "object"
    && candidate.payload !== null;
}
