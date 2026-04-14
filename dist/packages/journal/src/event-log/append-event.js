"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendEvent = appendEvent;
const promises_1 = require("node:fs/promises");
async function appendEvent(journalPath, event) {
    await (0, promises_1.appendFile)(journalPath, `${JSON.stringify(redactEventPayload(event))}\n`, "utf8");
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
