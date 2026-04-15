import { appendFile } from "node:fs/promises";

// journal-as-source-of-truth : appendFile n'est pas atomique cross-platform. Sur NTFS
// (Windows) et sur POSIX sous forte concurrence intra-process, plusieurs appels
// paralleles peuvent entrelacer leurs octets et produire des lignes JSONL corrompues
// (Story 5.1.1 AC5, dette D-35). On serialise donc les appends par chemin via une
// mini-file d'attente asynchrone : chaque path possede une chaine Promise dediee, et
// chaque nouvel append attend que le precedent sur le meme path soit termine avant
// d'emettre son propre appendFile. Cela garantit l'atomicite logique de l'ajout de
// ligne dans le seul processus courant (suffisant pour la V1 mono-operateur CLI ;
// voir docs/architecture/journal-as-source-of-truth.md).
const appendQueuesByPath: Map<string, Promise<void>> = new Map();

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
  const serializedLine = `${JSON.stringify(redactEventPayload(event))}\n`;
  const previousInQueue = appendQueuesByPath.get(journalPath) ?? Promise.resolve();
  const nextInQueue = previousInQueue
    .catch(() => undefined)
    .then(() => appendFile(journalPath, serializedLine, "utf8"));

  appendQueuesByPath.set(journalPath, nextInQueue);

  try {
    await nextInQueue;
  } finally {
    if (appendQueuesByPath.get(journalPath) === nextInQueue) {
      appendQueuesByPath.delete(journalPath);
    }
  }
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
