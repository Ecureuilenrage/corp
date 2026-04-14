import { appendFile } from "node:fs/promises";

export interface JournalEventRecord {
  eventId: string;
  type: string;
  missionId: string;
  ticketId?: string;
  attemptId?: string;
  occurredAt: string;
  actor: string;
  source: string;
  payload: Record<string, unknown>;
}

export async function appendEvent(
  journalPath: string,
  event: JournalEventRecord,
): Promise<void> {
  await appendFile(journalPath, `${JSON.stringify(redactEventPayload(event))}\n`, "utf8");
}

const VENDOR_DETAIL_KEYS = new Set([
  "responseId",
  "response_id",
  "pollCursor",
  "vendorStatus",
  "threadId",
]);

function redactEventPayload(event: JournalEventRecord): JournalEventRecord {
  return {
    ...event,
    payload: redactVendorDetails(event.payload) as Record<string, unknown>,
  };
}

function redactVendorDetails(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactVendorDetails(entry));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  const redactedRecord: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(candidate)) {
    if (VENDOR_DETAIL_KEYS.has(key)) {
      continue;
    }

    if (key === "adapterState" && typeof entryValue === "object" && entryValue !== null) {
      redactedRecord[key] = {};
      continue;
    }

    redactedRecord[key] = redactVendorDetails(entryValue);
  }

  return redactedRecord;
}
