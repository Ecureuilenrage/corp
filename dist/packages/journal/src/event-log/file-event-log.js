"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAppendOnlyEventLog = ensureAppendOnlyEventLog;
exports.readEventLog = readEventLog;
exports.isJournalEventRecord = isJournalEventRecord;
exports.validateJournalEventRecord = validateJournalEventRecord;
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_readline_1 = require("node:readline");
const atomic_json_1 = require("../../../storage/src/fs-layout/atomic-json");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const event_log_errors_1 = require("./event-log-errors");
async function ensureAppendOnlyEventLog(journalPath) {
    try {
        await (0, promises_1.writeFile)(journalPath, "", { encoding: "utf8", flag: "wx" });
        return true;
    }
    catch (error) {
        if ((0, atomic_json_1.isAlreadyExistsError)(error)) {
            await validateExistingAppendOnlyEventLog(journalPath);
            return false;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw event_log_errors_1.EventLogReadError.fileSystem(journalPath, error);
        }
        throw error;
    }
}
async function readEventLog(journalPath) {
    const events = [];
    const stream = (0, node_fs_1.createReadStream)(journalPath, { encoding: "utf8" });
    const lines = (0, node_readline_1.createInterface)({
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
    }
    catch (error) {
        throw (0, event_log_errors_1.normalizeEventLogReadError)(error, journalPath);
    }
    finally {
        lines.close();
        stream.destroy();
    }
    return events;
}
function isJournalEventRecord(value) {
    return validateJournalEventRecord(value).ok;
}
function validateJournalEventRecord(value) {
    if (!isRecord(value)) {
        return { ok: false, reason: "type incorrect `JournalEventRecord`: attendu objet" };
    }
    const candidate = value;
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
async function validateExistingAppendOnlyEventLog(journalPath) {
    let contents;
    try {
        contents = await (0, promises_1.readFile)(journalPath, "utf8");
    }
    catch (error) {
        throw (0, event_log_errors_1.normalizeEventLogReadError)(error, journalPath);
    }
    if (contents.length === 0) {
        return;
    }
    if (contents.endsWith("\n")) {
        await readEventLog(journalPath);
        return;
    }
    const lastLineStart = contents.lastIndexOf("\n") + 1;
    const lastLine = contents.slice(lastLineStart);
    const lineNumber = countLineNumberAtOffset(contents, lastLineStart);
    const trimmedLastLine = lastLine.trim();
    if (trimmedLastLine.length === 0) {
        await truncateJournal(journalPath, lastLineStart);
        await readEventLog(journalPath);
        return;
    }
    let parsedLastLine;
    try {
        parsedLastLine = JSON.parse(trimmedLastLine);
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            await truncateJournal(journalPath, lastLineStart);
            await readEventLog(journalPath);
            return;
        }
        throw error;
    }
    const validation = validateJournalEventRecord(parsedLastLine);
    if (!validation.ok) {
        throw event_log_errors_1.EventLogReadError.invalid({
            journalPath,
            lineNumber,
            reason: validation.reason,
        });
    }
    throw event_log_errors_1.EventLogReadError.invalid({
        journalPath,
        lineNumber,
        reason: "derniere ligne complete sans newline finale",
    });
}
async function truncateJournal(journalPath, length) {
    try {
        await (0, promises_1.truncate)(journalPath, length);
    }
    catch (error) {
        throw (0, event_log_errors_1.normalizeEventLogReadError)(error, journalPath);
    }
}
function parseJournalEventLine(line, journalPath, lineNumber) {
    let parsedEvent;
    try {
        parsedEvent = JSON.parse(line);
    }
    catch (error) {
        throw event_log_errors_1.EventLogReadError.invalid({
            journalPath,
            lineNumber,
            reason: "JSON corrompu",
            cause: error,
        });
    }
    const validation = validateJournalEventRecord(parsedEvent);
    if (!validation.ok) {
        throw event_log_errors_1.EventLogReadError.invalid({
            journalPath,
            lineNumber,
            reason: validation.reason,
        });
    }
    return parsedEvent;
}
function countLineNumberAtOffset(contents, offset) {
    if (offset === 0) {
        return 1;
    }
    return contents.slice(0, offset).split("\n").length;
}
function validateString(record, fieldName) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return { ok: false, reason: `champ manquant \`${fieldName}\`` };
    }
    return typeof record[fieldName] === "string"
        ? { ok: true }
        : { ok: false, reason: `type incorrect \`${fieldName}\`: attendu string` };
}
function validateOptionalString(record, fieldName) {
    if (!(fieldName in record) || record[fieldName] === undefined) {
        return { ok: true };
    }
    return typeof record[fieldName] === "string"
        ? { ok: true }
        : { ok: false, reason: `type incorrect \`${fieldName}\`: attendu string optionnel` };
}
function validatePayload(record) {
    if (!("payload" in record) || record.payload === undefined) {
        return { ok: false, reason: "champ manquant `payload`" };
    }
    return isRecord(record.payload)
        ? { ok: true }
        : { ok: false, reason: "type incorrect `payload`: attendu objet" };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
