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
const workspace_artifact_detector_1 = require("../../packages/workspace-isolation/src/workspace-artifact-detector");
function createIsolation(kind, sourceRoot, workspacePath) {
    return {
        workspaceIsolationId: "iso_test",
        kind,
        sourceRoot,
        workspacePath,
        createdAt: "2026-04-10T00:00:00.000Z",
        retained: true,
    };
}
(0, node_test_1.default)("detectGitWorkspaceArtifacts reconnait une suppression comme un artefact significatif", async (t) => {
    const workspacePath = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-workspace-git-delete-"));
    t.after(async () => {
        await (0, promises_1.rm)(workspacePath, { recursive: true, force: true });
    });
    const artifacts = await (0, workspace_artifact_detector_1.detectGitWorkspaceArtifacts)(workspacePath, {
        runGitCommand: async () => ({
            exitCode: 0,
            stdout: "D  deleted.txt\n",
            stderr: "",
        }),
    });
    strict_1.default.deepEqual(artifacts, [
        {
            kind: "workspace_file",
            title: "deleted.txt",
            path: "deleted.txt",
            label: "deleted",
            summary: "Fichier supprime dans le workspace isole.",
            sizeBytes: 0,
        },
    ]);
});
(0, node_test_1.default)("detectGitWorkspaceArtifacts nettoie les guillemets des chemins git contenant des espaces", async (t) => {
    const workspacePath = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-workspace-git-spaces-"));
    const fileName = "notes with spaces.txt";
    t.after(async () => {
        await (0, promises_1.rm)(workspacePath, { recursive: true, force: true });
    });
    await (0, promises_1.writeFile)(node_path_1.default.join(workspacePath, fileName), "contenu utile\n", "utf8");
    const artifacts = await (0, workspace_artifact_detector_1.detectGitWorkspaceArtifacts)(workspacePath, {
        runGitCommand: async () => ({
            exitCode: 0,
            stdout: `M  "${fileName}"\n`,
            stderr: "",
        }),
    });
    strict_1.default.equal(artifacts.length, 1);
    strict_1.default.equal(artifacts[0]?.path, fileName);
    strict_1.default.equal(artifacts[0]?.title, fileName);
});
(0, node_test_1.default)("detectWorkspaceArtifacts ignore les fichiers de taille zero dans un workspace_copy", async (t) => {
    const sourceRoot = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-workspace-source-"));
    const workspacePath = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-workspace-copy-"));
    t.after(async () => {
        await (0, promises_1.rm)(sourceRoot, { recursive: true, force: true });
        await (0, promises_1.rm)(workspacePath, { recursive: true, force: true });
    });
    await (0, promises_1.writeFile)(node_path_1.default.join(workspacePath, "empty.txt"), "", "utf8");
    const artifacts = await (0, workspace_artifact_detector_1.detectWorkspaceArtifacts)(createIsolation("workspace_copy", sourceRoot, workspacePath));
    strict_1.default.deepEqual(artifacts, []);
});
