"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureMissionWorkspaceInitialized = ensureMissionWorkspaceInitialized;
const promises_1 = require("node:fs/promises");
const default_projections_1 = require("../../../journal/src/projections/default-projections");
const atomic_json_1 = require("../../../storage/src/fs-layout/atomic-json");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
// Garantit que le workspace mission est initialise en utilisant le pattern exclusif
// writeFile({flag: "wx"}) aligne sur ensureAppendOnlyEventLog et seedProjectionStore.
// Deux initialisations concurrentes produisent une seule creation effective : la
// perdante recoit EEXIST (benign). Tout autre echec (ex. ENOENT sur le dossier parent)
// est surface comme "Workspace non initialise" pour guider l'operateur vers bootstrap.
async function ensureMissionWorkspaceInitialized(layout, options) {
    const initializationError = new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${options.commandLabel}\`.`);
    await ensureWorkspaceFileIdempotent(layout.journalPath, "", initializationError);
    for (const [projectionName, snapshot] of Object.entries(default_projections_1.DEFAULT_PROJECTIONS)) {
        if (options.skipProjections?.has(projectionName)) {
            continue;
        }
        await ensureWorkspaceFileIdempotent((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName), `${JSON.stringify(snapshot, null, 2)}\n`, initializationError);
    }
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
