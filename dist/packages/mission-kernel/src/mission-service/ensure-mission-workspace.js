"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMissionWorkspaceInitialized = ensureMissionWorkspaceInitialized;
const promises_1 = require("node:fs/promises");
const event_log_errors_1 = require("../../../journal/src/event-log/event-log-errors");
const default_projections_1 = require("../../../journal/src/projections/default-projections");
const atomic_json_1 = require("../../../storage/src/fs-layout/atomic-json");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const REQUIRED_PROJECTION_NAMES = Object.freeze(Object.keys(default_projections_1.DEFAULT_PROJECTIONS));
// Garantit que le workspace mission est initialise en utilisant le pattern exclusif
// writeFile({flag: "wx"}) aligne sur ensureAppendOnlyEventLog et seedProjectionStore.
// Deux initialisations concurrentes produisent une seule creation effective : la
// perdante recoit EEXIST (benign). Tout autre echec (ex. ENOENT sur le dossier parent)
// est surface comme "Workspace non initialise" pour guider l'operateur vers bootstrap.
async function ensureMissionWorkspaceInitialized(layout, options) {
    const initializationError = new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${options.commandLabel}\`.`);
    if (options.cleanupLocks) {
        await runLockCleanup(layout);
    }
    if (options.initializeJournal !== false) {
        await ensureWorkspaceFileIdempotent(layout.journalPath, "", initializationError);
    }
    for (const [projectionName, snapshot] of Object.entries(default_projections_1.DEFAULT_PROJECTIONS)) {
        await ensureWorkspaceFileIdempotent((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName), `${JSON.stringify(snapshot, null, 2)}\n`, initializationError);
    }
    await assertWorkspaceReady(layout, initializationError);
}
async function runLockCleanup(layout) {
    try {
        await (0, file_mission_repository_1.cleanupStaleMissionLocks)(layout);
    }
    catch (error) {
        // ENOENT sur le repertoire missions signifie qu'il n'y a rien a nettoyer ;
        // `assertWorkspaceReady` surfacera plus bas le bon diagnostic d'absence.
        if (isMissingDirectoryError(error)) {
            return;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw (0, file_system_read_errors_1.createFileSystemReadError)(error, layout.missionsDir, "repertoire missions");
        }
        throw error;
    }
}
function isMissingDirectoryError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
async function ensureWorkspaceFileIdempotent(filePath, contents, initializationError) {
    try {
        await (0, promises_1.writeFile)(filePath, contents, { encoding: "utf8", flag: "wx" });
    }
    catch (error) {
        if ((0, atomic_json_1.isAlreadyExistsError)(error)) {
            return;
        }
        throw initializationError;
    }
}
async function assertWorkspaceReady(layout, initializationError) {
    const checks = await collectWorkspaceAccessChecks(layout);
    const firstFileSystemError = checks.find((entry) => entry.error && entry.error.code !== "ENOENT" && (0, file_system_read_errors_1.isFileSystemReadError)(entry.error));
    if (firstFileSystemError?.error) {
        if (firstFileSystemError.isJournal) {
            throw event_log_errors_1.EventLogReadError.fileSystem(layout.journalPath, firstFileSystemError.error);
        }
        throw (0, file_system_read_errors_1.createFileSystemReadError)(firstFileSystemError.error, firstFileSystemError.filePath, firstFileSystemError.label);
    }
    const journalCheck = checks.find((entry) => entry.isJournal);
    const missingNonJournalEntry = checks.find((entry) => entry.error?.code === "ENOENT" && !entry.isJournal);
    // Le journal est la source de verite canonique : un ENOENT sur le journal
    // merite toujours le diagnostic dedie, meme si d'autres projections manquent.
    if (journalCheck?.error?.code === "ENOENT") {
        throw event_log_errors_1.EventLogReadError.missing(layout.journalPath, journalCheck.error);
    }
    if (journalCheck?.error || missingNonJournalEntry) {
        throw initializationError;
    }
}
async function collectWorkspaceAccessChecks(layout) {
    const projectionChecks = REQUIRED_PROJECTION_NAMES.map(async (projectionName) => ({
        error: await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName))),
        filePath: (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName),
        label: `projection ${projectionName}`,
    }));
    return [
        {
            error: await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.journalPath)),
            filePath: layout.journalPath,
            label: "journal append-only",
            isJournal: true,
        },
        {
            error: await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.projectionsDir)),
            filePath: layout.projectionsDir,
            label: "repertoire projections",
        },
        {
            error: await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.missionsDir)),
            filePath: layout.missionsDir,
            label: "repertoire missions",
        },
        {
            error: await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.capabilitiesDir)),
            filePath: layout.capabilitiesDir,
            label: "repertoire capabilities",
        },
        {
            error: await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.skillPacksDir)),
            filePath: layout.skillPacksDir,
            label: "repertoire skill packs",
        },
        ...(await Promise.all(projectionChecks)),
    ];
}
