"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAppendOnlyEventLog = ensureAppendOnlyEventLog;
exports.readEventLog = readEventLog;
const promises_1 = require("node:fs/promises");
async function ensureAppendOnlyEventLog(journalPath) {
    try {
        await (0, promises_1.access)(journalPath);
        return false;
    }
    catch {
        await (0, promises_1.writeFile)(journalPath, "", "utf8");
        return true;
    }
}
async function readEventLog(journalPath) {
    const contents = await (0, promises_1.readFile)(journalPath, "utf8");
    const events = [];
    for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
        const line = rawLine.trim();
        if (line.length === 0) {
            continue;
        }
        let parsedEvent;
        try {
            parsedEvent = JSON.parse(line);
        }
        catch {
            throw new Error(`Le journal append-only est invalide a la ligne ${index + 1}.`);
        }
        if (!isJournalEventRecord(parsedEvent)) {
            throw new Error(`Le journal append-only est invalide a la ligne ${index + 1}.`);
        }
        events.push(parsedEvent);
    }
    return events;
}
function isJournalEventRecord(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
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
