"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_SYSTEM_READ_ERROR_CODES = void 0;
exports.createFileSystemReadError = createFileSystemReadError;
exports.formatFileSystemReadError = formatFileSystemReadError;
exports.isFileSystemReadError = isFileSystemReadError;
exports.isMissingFileError = isMissingFileError;
exports.isErrnoException = isErrnoException;
exports.readAccessError = readAccessError;
exports.FILE_SYSTEM_READ_ERROR_CODES = new Set([
    "ENOENT",
    "EACCES",
    "EPERM",
    "EIO",
    "EMFILE",
    "ENOSPC",
]);
function createFileSystemReadError(error, filePath, label = "fichier") {
    return Object.assign(new Error(formatFileSystemReadError(error, filePath, label), { cause: error }), {
        code: "erreur_fichier",
        osCode: typeof error.code === "string" ? error.code : undefined,
        filePath,
    });
}
function formatFileSystemReadError(error, filePath, label = "fichier") {
    const osCode = typeof error.code === "string" ? error.code : "UNKNOWN";
    const detail = error.message.trim() || "erreur inconnue";
    return `erreur_fichier: erreur de lecture ${label} (${osCode}) sur ${filePath}: ${detail}`;
}
function isFileSystemReadError(error) {
    return isErrnoException(error)
        && typeof error.code === "string"
        && exports.FILE_SYSTEM_READ_ERROR_CODES.has(error.code);
}
function isMissingFileError(error) {
    return isErrnoException(error) && error.code === "ENOENT";
}
function isErrnoException(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error;
}
async function readAccessError(accessFile) {
    try {
        await accessFile();
        return null;
    }
    catch (error) {
        if (isErrnoException(error)) {
            return error;
        }
        throw error;
    }
}
