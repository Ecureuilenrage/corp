"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = require("node:os");
const node_test_1 = __importDefault(require("node:test"));
const ensure_mission_workspace_1 = require("../../packages/mission-kernel/src/mission-service/ensure-mission-workspace");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const default_projections_1 = require("../../packages/journal/src/projections/default-projections");
const file_projection_store_1 = require("../../packages/storage/src/projection-store/file-projection-store");
(0, node_test_1.default)("ensureMissionWorkspaceInitialized ne cree qu'un journal et qu'une projection sous appels concurrents", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ensure-workspace-concurrent-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    // Bootstrap partiel: les dossiers parents existent, les fichiers sont absents.
    await (0, promises_1.mkdir)(layout.journalDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.projectionsDir, { recursive: true });
    // 20 initialisations concurrentes doivent toutes reussir sans corrompre les fichiers.
    await Promise.all(Array.from({ length: 20 }, () => (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, { commandLabel: "create" })));
    // Le journal doit etre une baseline vide unique.
    const journalContents = await (0, promises_1.readFile)(layout.journalPath, "utf8");
    strict_1.default.equal(journalContents, "");
    // Chaque projection doit exister et correspondre exactement au snapshot par defaut.
    for (const [projectionName, snapshot] of Object.entries(default_projections_1.DEFAULT_PROJECTIONS)) {
        const projectionContents = await (0, promises_1.readFile)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName), "utf8");
        strict_1.default.equal(projectionContents, `${JSON.stringify(snapshot, null, 2)}\n`);
    }
});
(0, node_test_1.default)("ensureMissionWorkspaceInitialized surface l'erreur d'initialisation quand le workspace n'existe pas", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ensure-workspace-uninit-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    // Aucun dossier .corp cree : writeFile(wx) echoue avec ENOENT et declenche l'erreur operateur.
    await strict_1.default.rejects(() => (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, { commandLabel: "create" }), /Workspace mission non initialise\. Lancez `corp mission bootstrap --root/);
});
(0, node_test_1.default)("ensureMissionWorkspaceInitialized respecte skipProjections pour le scenario lifecycle", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-ensure-workspace-skip-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    await (0, promises_1.mkdir)(layout.journalDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.projectionsDir, { recursive: true });
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: "pause",
        skipProjections: new Set(["resume-view"]),
    });
    // resume-view ne doit PAS avoir ete cree.
    await strict_1.default.rejects(() => (0, promises_1.readFile)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "resume-view"), "utf8"), /ENOENT/);
    // Les autres projections DOIVENT avoir ete creees.
    for (const projectionName of Object.keys(default_projections_1.DEFAULT_PROJECTIONS)) {
        if (projectionName === "resume-view") {
            continue;
        }
        await (0, promises_1.readFile)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName), "utf8");
    }
});
