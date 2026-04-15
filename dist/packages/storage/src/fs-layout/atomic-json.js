"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJsonAtomic = writeJsonAtomic;
exports.isAlreadyExistsError = isAlreadyExistsError;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
async function writeJsonAtomic(filePath, value) {
    const serializedValue = JSON.stringify(value, null, 2);
    if (serializedValue === undefined) {
        throw new Error("Impossible de serialiser une valeur JSON undefined.");
    }
    // journal-as-source-of-truth : ce helper assure une ecriture best-effort ; si le
    // rename echoue, on supprime explicitement le fichier temporaire (chemin prefere ou
    // chemin UUID fallback) pour eviter tout orphelin sur disque. Voir
    // docs/architecture/journal-as-source-of-truth.md et Story 5.1.1 AC3.
    const temporaryPath = await writeTemporaryJsonFile(filePath, `${serializedValue}\n`);
    try {
        await renameWithTransientRetry(temporaryPath, filePath);
    }
    catch (error) {
        try {
            await (0, promises_1.unlink)(temporaryPath);
        }
        catch {
            // Best-effort cleanup: preserve the original write/rename failure.
        }
        throw error;
    }
}
async function renameWithTransientRetry(sourcePath, destinationPath) {
    let lastError;
    for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
            await (0, promises_1.rename)(sourcePath, destinationPath);
            return;
        }
        catch (error) {
            if (!isTransientRenameError(error)) {
                throw error;
            }
            lastError = error;
            await delay(5 * (attempt + 1));
        }
    }
    throw lastError;
}
async function writeTemporaryJsonFile(filePath, contents) {
    const preferredTemporaryPath = `${filePath}.tmp`;
    try {
        await (0, promises_1.writeFile)(preferredTemporaryPath, contents, { encoding: "utf8", flag: "wx" });
        return preferredTemporaryPath;
    }
    catch (error) {
        if (!isAlreadyExistsError(error)) {
            throw error;
        }
    }
    const contendedTemporaryPath = `${filePath}.${process.pid}.${(0, node_crypto_1.randomUUID)()}.tmp`;
    await (0, promises_1.writeFile)(contendedTemporaryPath, contents, { encoding: "utf8", flag: "wx" });
    return contendedTemporaryPath;
}
function isAlreadyExistsError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "EEXIST";
}
function isTransientRenameError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && (error.code === "EACCES"
            || error.code === "EBUSY"
            || error.code === "EPERM");
}
async function delay(durationMs) {
    await new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });
}
