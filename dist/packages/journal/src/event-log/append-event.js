"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendEvent = appendEvent;
const promises_1 = require("node:fs/promises");
// journal-as-source-of-truth : appendFile n'est pas atomique cross-platform. Sur NTFS
// (Windows) et sur POSIX sous forte concurrence intra-process, plusieurs appels
// paralleles peuvent entrelacer leurs octets et produire des lignes JSONL corrompues
// (Story 5.1.1 AC5, dette D-35). On serialise donc les appends par chemin via une
// mini-file d'attente asynchrone : chaque path possede une chaine Promise dediee, et
// chaque nouvel append attend que le precedent sur le meme path soit termine avant
// d'emettre son propre appendFile. Cela garantit l'atomicite logique de l'ajout de
// ligne dans le seul processus courant (suffisant pour la V1 mono-operateur CLI ;
// voir docs/architecture/journal-as-source-of-truth.md).
const appendQueuesByPath = new Map();
async function appendEvent(journalPath, event) {
    const serializedLine = `${JSON.stringify(redactEventPayload(event))}\n`;
    const previousInQueue = appendQueuesByPath.get(journalPath) ?? Promise.resolve();
    const nextInQueue = previousInQueue
        .catch(() => undefined)
        .then(() => (0, promises_1.appendFile)(journalPath, serializedLine, "utf8"));
    appendQueuesByPath.set(journalPath, nextInQueue);
    try {
        await nextInQueue;
    }
    finally {
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
function redactEventPayload(event) {
    return {
        ...event,
        payload: redactVendorDetails(event.payload),
    };
}
function redactVendorDetails(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => redactVendorDetails(entry));
    }
    if (typeof value !== "object" || value === null) {
        return value;
    }
    const candidate = value;
    const redactedRecord = {};
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
