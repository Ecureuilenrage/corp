"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PREVIEW_BYTES = void 0;
exports.readMissionArtifacts = readMissionArtifacts;
exports.listMissionArtifacts = listMissionArtifacts;
exports.readMissionArtifactDetail = readMissionArtifactDetail;
exports.readPayloadPreview = readPayloadPreview;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_string_decoder_1 = require("node:string_decoder");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const artifact_index_projection_1 = require("../../../journal/src/projections/artifact-index-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_artifact_repository_1 = require("../../../storage/src/repositories/file-artifact-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
exports.MAX_PREVIEW_BYTES = 1024;
async function readMissionArtifacts(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureArtifactWorkspaceInitialized(layout, options.commandName);
    try {
        const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
        const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
        const artifactRepository = (0, file_artifact_repository_1.createFileArtifactRepository)(layout);
        const mission = await missionRepository.findById(options.missionId);
        if (!mission) {
            throw new Error(`Mission introuvable: ${options.missionId}.`);
        }
        const tickets = await ticketRepository.listByMissionId(mission.id);
        const artifacts = await artifactRepository.listByMissionId(mission.id);
        const events = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
            .filter((event) => event.missionId === mission.id);
        const rebuiltProjection = (0, artifact_index_projection_1.createArtifactIndexProjection)({
            mission,
            tickets,
            artifacts,
            events,
        });
        const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "artifact-index");
        const storedProjection = await readStoredArtifactIndex(layout.projectionsDir);
        if (!storedProjection || !isArtifactProjectionUpToDate(storedProjection, rebuiltProjection)) {
            await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "artifact-index", rebuiltProjection);
            return {
                mission,
                artifacts: rebuiltProjection.artifacts,
                reconstructed: true,
                projectionPath,
            };
        }
        return {
            mission,
            artifacts: storedProjection.artifacts,
            reconstructed: false,
            projectionPath,
        };
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Mission introuvable:")) {
            throw error;
        }
        throw new Error(formatArtifactReadError(options.missionId, options.commandName));
    }
}
async function listMissionArtifacts(options) {
    const result = await readMissionArtifacts({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName: "artifact list",
    });
    if (options.ticketId && !result.mission.ticketIds.includes(options.ticketId)) {
        throw new Error(`Ticket introuvable dans la mission \`${result.mission.id}\`: \`${options.ticketId}\`.`);
    }
    return {
        ...result,
        artifacts: options.ticketId
            ? result.artifacts.filter((artifact) => artifact.ticketId === options.ticketId)
            : result.artifacts,
    };
}
async function readMissionArtifactDetail(options) {
    const result = await readMissionArtifacts({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName: "artifact show",
    });
    const artifact = result.artifacts.find((entry) => entry.artifactId === options.artifactId);
    if (!artifact) {
        throw new Error(`Artefact introuvable dans la mission \`${options.missionId}\`: \`${options.artifactId}\`.`);
    }
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    const payloadPreview = artifact.payloadPath
        ? await readPayloadPreview(layout.rootDir, artifact.payloadPath, artifact.mediaType)
        : null;
    return {
        mission: result.mission,
        artifact,
        reconstructed: result.reconstructed,
        projectionPath: result.projectionPath,
        payloadPreview,
    };
}
async function ensureArtifactWorkspaceInitialized(layout, commandName) {
    try {
        await (0, promises_1.access)(layout.journalPath);
        await (0, promises_1.access)(layout.projectionsDir);
        await (0, promises_1.access)(layout.missionsDir);
    }
    catch {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`);
    }
}
async function readStoredArtifactIndex(projectionsDir) {
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "artifact-index"));
    }
    catch (error) {
        if (isMissingFileError(error) || error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
}
function isArtifactProjectionUpToDate(storedProjection, rebuiltProjection) {
    return (0, structural_compare_1.deepStrictEqualForComparison)(storedProjection, rebuiltProjection);
}
function formatArtifactReadError(missionId, commandName) {
    if (commandName === "artifact list" || commandName === "artifact show") {
        return `Projection artifact-index irreconciliable pour ${missionId}. Impossible d'afficher les artefacts.`;
    }
    return `Projection artifact-index irreconciliable pour ${missionId}. Impossible d'afficher la mission.`;
}
async function readPayloadPreview(rootDir, payloadPath, mediaType, dependencies = {}) {
    try {
        const resolvedPayloadPath = node_path_1.default.isAbsolute(payloadPath)
            ? payloadPath
            : node_path_1.default.join(rootDir, payloadPath);
        if (mediaType?.includes("json") || !mediaType || mediaType.startsWith("text/")) {
            return truncatePreview(await readUtf8PreviewContents(resolvedPayloadPath, dependencies));
        }
        return null;
    }
    catch {
        return null;
    }
}
function truncatePreview(value) {
    const trimmedValue = value.trim();
    if (trimmedValue.length <= 240) {
        return trimmedValue;
    }
    return `${trimmedValue.slice(0, 237)}...`;
}
async function readUtf8PreviewContents(filePath, dependencies) {
    const fileHandle = await (dependencies.openFile ?? promises_1.open)(filePath, "r");
    try {
        const buffer = Buffer.alloc(exports.MAX_PREVIEW_BYTES);
        const { bytesRead } = await fileHandle.read(buffer, 0, exports.MAX_PREVIEW_BYTES, 0);
        const decoder = new node_string_decoder_1.StringDecoder("utf8");
        return `${decoder.write(buffer.subarray(0, bytesRead))}${decoder.end()}`;
    }
    finally {
        await fileHandle.close();
    }
}
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
