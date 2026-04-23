"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistedDocumentFileSystemError = exports.InvalidPersistedDocumentError = exports.CorruptedPersistedDocumentError = void 0;
exports.readPersistedJsonDocument = readPersistedJsonDocument;
exports.assertValidPersistedDocument = assertValidPersistedDocument;
exports.normalizePersistedDocumentReadError = normalizePersistedDocumentReadError;
exports.isPersistedDocumentReadError = isPersistedDocumentReadError;
exports.isRecoverablePersistedDocumentError = isRecoverablePersistedDocumentError;
const promises_1 = require("node:fs/promises");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
class CorruptedPersistedDocumentError extends Error {
    code = "json_corrompu";
    filePath;
    entityLabel;
    documentId;
    constructor(context, cause) {
        super(formatPersistedDocumentMessage("json_corrompu", {
            ...context,
            entityLabel: context.corruptionLabel ?? context.entityLabel,
        }, "JSON corrompu"), { cause });
        this.name = "CorruptedPersistedDocumentError";
        this.filePath = context.filePath;
        this.entityLabel = context.entityLabel;
        this.documentId = context.documentId;
    }
}
exports.CorruptedPersistedDocumentError = CorruptedPersistedDocumentError;
class InvalidPersistedDocumentError extends Error {
    code = "schema_invalide";
    filePath;
    entityLabel;
    documentId;
    reason;
    constructor(context, reason, cause = new Error(reason)) {
        super(formatPersistedDocumentMessage("schema_invalide", context, reason), { cause });
        this.name = "InvalidPersistedDocumentError";
        this.filePath = context.filePath;
        this.entityLabel = context.entityLabel;
        this.documentId = context.documentId;
        this.reason = reason;
    }
}
exports.InvalidPersistedDocumentError = InvalidPersistedDocumentError;
class PersistedDocumentFileSystemError extends Error {
    code = "erreur_fichier";
    filePath;
    entityLabel;
    documentId;
    osCode;
    constructor(context, cause) {
        const fileSystemError = (0, file_system_read_errors_1.createFileSystemReadError)(cause, context.filePath, context.entityLabel);
        super(fileSystemError.message, { cause });
        this.name = "PersistedDocumentFileSystemError";
        this.filePath = context.filePath;
        this.entityLabel = context.entityLabel;
        this.documentId = context.documentId;
        this.osCode = fileSystemError.osCode;
    }
}
exports.PersistedDocumentFileSystemError = PersistedDocumentFileSystemError;
async function readPersistedJsonDocument(context) {
    let contents;
    try {
        contents = await (0, promises_1.readFile)(context.filePath, "utf8");
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            throw error;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw new PersistedDocumentFileSystemError(context, error);
        }
        throw error;
    }
    try {
        return JSON.parse(stripUtf8Bom(contents));
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new CorruptedPersistedDocumentError(context, error);
        }
        throw normalizePersistedDocumentReadError(error, context);
    }
}
function assertValidPersistedDocument(value, validator, context) {
    const validation = validator(value);
    if (!validation.ok) {
        throw new InvalidPersistedDocumentError(context, validation.reason);
    }
}
function normalizePersistedDocumentReadError(error, context) {
    if (isPersistedDocumentReadError(error) || (0, file_system_read_errors_1.isMissingFileError)(error)) {
        return error;
    }
    if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
        return new PersistedDocumentFileSystemError(context, error);
    }
    const message = formatUnexpectedPersistedDocumentReadMessage(context);
    return new Error(message, { cause: error });
}
function isPersistedDocumentReadError(error) {
    return error instanceof CorruptedPersistedDocumentError
        || error instanceof InvalidPersistedDocumentError
        || error instanceof PersistedDocumentFileSystemError;
}
function isRecoverablePersistedDocumentError(error) {
    return error instanceof CorruptedPersistedDocumentError
        || error instanceof InvalidPersistedDocumentError;
}
function formatPersistedDocumentMessage(code, context, reason) {
    const documentId = context.documentId ? ` \`${context.documentId}\`` : "";
    return `${code}: ${context.entityLabel}${documentId} invalide (${context.filePath}): ${reason}.`;
}
function stripUtf8Bom(contents) {
    return contents.startsWith("\uFEFF")
        ? contents.slice(1)
        : contents;
}
function formatUnexpectedPersistedDocumentReadMessage(context) {
    const documentId = context.documentId ? ` \`${context.documentId}\`` : "";
    return `Lecture du document persiste ${context.entityLabel}${documentId} irreconciliable (${context.filePath}).`;
}
