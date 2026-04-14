"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileArtifactRepository = void 0;
exports.createFileArtifactRepository = createFileArtifactRepository;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const workspace_layout_1 = require("../fs-layout/workspace-layout");
class FileArtifactRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(artifact) {
        const artifactStoragePaths = (0, workspace_layout_1.resolveArtifactStoragePaths)(this.layout, artifact.missionId, artifact.ticketId, artifact.id);
        await (0, promises_1.mkdir)(artifactStoragePaths.artifactDir, { recursive: true });
        await (0, promises_1.writeFile)(artifactStoragePaths.artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
        return artifactStoragePaths;
    }
    async findById(missionId, artifactId) {
        const artifacts = await this.listByMissionId(missionId);
        return artifacts.find((artifact) => artifact.id === artifactId) ?? null;
    }
    async listByTicketId(missionId, ticketId) {
        const ticketStoragePaths = (0, workspace_layout_1.resolveTicketStoragePaths)(this.layout, missionId, ticketId);
        const artifactsDir = node_path_1.default.join(ticketStoragePaths.ticketDir, "artifacts");
        const artifactEntries = await readDirectoryEntries(artifactsDir);
        const artifacts = [];
        for (const artifactEntry of artifactEntries) {
            if (!artifactEntry.isDirectory()) {
                continue;
            }
            const artifact = await this.readArtifactSnapshot(missionId, ticketId, artifactEntry.name);
            if (artifact) {
                artifacts.push(artifact);
            }
        }
        return artifacts;
    }
    async listByMissionId(missionId) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, missionId);
        const ticketsDir = node_path_1.default.join(missionStoragePaths.missionDir, "tickets");
        const ticketEntries = await readDirectoryEntries(ticketsDir);
        const artifacts = [];
        for (const ticketEntry of ticketEntries) {
            if (!ticketEntry.isDirectory()) {
                continue;
            }
            artifacts.push(...(await this.listByTicketId(missionId, ticketEntry.name)));
        }
        return artifacts;
    }
    async readArtifactSnapshot(missionId, ticketId, artifactId) {
        const artifactStoragePaths = (0, workspace_layout_1.resolveArtifactStoragePaths)(this.layout, missionId, ticketId, artifactId);
        try {
            const storedArtifact = await (0, promises_1.readFile)(artifactStoragePaths.artifactPath, "utf8");
            return JSON.parse(storedArtifact);
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return null;
            }
            throw error;
        }
    }
}
exports.FileArtifactRepository = FileArtifactRepository;
function createFileArtifactRepository(layout) {
    return new FileArtifactRepository(layout);
}
async function readDirectoryEntries(directoryPath) {
    try {
        return await (0, promises_1.readdir)(directoryPath, { withFileTypes: true, encoding: "utf8" });
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return [];
        }
        throw error;
    }
}
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
