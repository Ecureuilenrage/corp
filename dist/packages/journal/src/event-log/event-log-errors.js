"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLogReadError = void 0;
exports.normalizeEventLogReadError = normalizeEventLogReadError;
exports.isEventLogReadError = isEventLogReadError;
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const UNEXPECTED_EVENT_LOG_READ_PREFIX = "Lecture du journal append-only irreconciliable (";
class EventLogReadError extends Error {
    code;
    journalPath;
    lineNumber;
    osCode;
    constructor(options) {
        super(options.message, { cause: options.cause });
        this.name = "EventLogReadError";
        this.code = options.code;
        this.journalPath = options.journalPath;
        this.lineNumber = options.lineNumber;
        this.osCode = options.osCode;
    }
    static missing(journalPath, cause) {
        return new EventLogReadError({
            code: "journal_manquant",
            journalPath,
            cause,
            message: `journal_manquant: journal append-only manquant: ${journalPath}. `
                + "Relancez `corp mission bootstrap` ou restaurez le journal.",
        });
    }
    static invalid(options) {
        return new EventLogReadError({
            code: "journal_invalide",
            journalPath: options.journalPath,
            lineNumber: options.lineNumber,
            cause: options.cause,
            message: `journal_invalide: journal append-only invalide a la ligne ${options.lineNumber} `
                + `(${options.journalPath}): ${options.reason}.`,
        });
    }
    static fileSystem(journalPath, cause) {
        return new EventLogReadError({
            code: "erreur_fichier",
            journalPath,
            osCode: typeof cause.code === "string" ? cause.code : undefined,
            cause,
            message: (0, file_system_read_errors_1.formatFileSystemReadError)(cause, journalPath, "journal append-only"),
        });
    }
}
exports.EventLogReadError = EventLogReadError;
function normalizeEventLogReadError(error, journalPath) {
    if (error instanceof EventLogReadError) {
        return error;
    }
    if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
        return EventLogReadError.missing(journalPath, error);
    }
    if ((0, file_system_read_errors_1.isErrnoException)(error)) {
        return EventLogReadError.fileSystem(journalPath, error);
    }
    if (error instanceof Error && error.message.startsWith(UNEXPECTED_EVENT_LOG_READ_PREFIX)) {
        return error;
    }
    return new Error(`${UNEXPECTED_EVENT_LOG_READ_PREFIX}${journalPath}).`, { cause: error });
}
function isEventLogReadError(error) {
    return error instanceof EventLogReadError;
}
