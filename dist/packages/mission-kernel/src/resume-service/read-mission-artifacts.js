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
const event_log_errors_1 = require("../../../journal/src/event-log/event-log-errors");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const mission_reconstruction_1 = require("../../../journal/src/reconstruction/mission-reconstruction");
const artifact_index_projection_1 = require("../../../journal/src/projections/artifact-index-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const file_artifact_repository_1 = require("../../../storage/src/repositories/file-artifact-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const persisted_document_errors_1 = require("../../../storage/src/repositories/persisted-document-errors");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
exports.MAX_PREVIEW_BYTES = 1024;
async function readMissionArtifacts(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureArtifactWorkspaceInitialized(layout, options.commandName);
    try {
        const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
        const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
        const artifactRepository = (0, file_artifact_repository_1.createFileArtifactRepository)(layout);
        const missionSnapshot = await readMissionSnapshotForArtifacts(layout, missionRepository, options.missionId);
        const events = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
            .filter((event) => event.missionId === missionSnapshot.id);
        const tickets = await readTicketsForArtifacts(ticketRepository, missionSnapshot.id, events);
        const artifacts = await readStoredArtifactsForArtifacts(artifactRepository, missionSnapshot.id);
        const rebuiltProjection = (0, artifact_index_projection_1.createArtifactIndexProjection)({
            mission: missionSnapshot,
            tickets,
            artifacts,
            events,
        });
        const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "artifact-index");
        const storedProjection = await readStoredArtifactIndex(layout.projectionsDir);
        if (!storedProjection || !isArtifactProjectionUpToDate(storedProjection, rebuiltProjection)) {
            await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "artifact-index", rebuiltProjection);
            return {
                mission: missionSnapshot,
                artifacts: rebuiltProjection.artifacts,
                reconstructed: true,
                projectionPath,
            };
        }
        return {
            mission: missionSnapshot,
            artifacts: storedProjection.artifacts,
            reconstructed: false,
            projectionPath,
        };
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("Mission introuvable:")) {
            throw error;
        }
        if (isClassifiedReadError(error)) {
            throw error;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw (0, file_system_read_errors_1.createFileSystemReadError)(error, layout.journalPath, "lecture artefacts mission");
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
    const journalError = await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.journalPath));
    const projectionsError = await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.projectionsDir));
    const missionsError = await (0, file_system_read_errors_1.readAccessError)(() => (0, promises_1.access)(layout.missionsDir));
    const fileSystemError = [
        { error: journalError, filePath: layout.journalPath, label: "journal append-only" },
        { error: projectionsError, filePath: layout.projectionsDir, label: "repertoire projections" },
        { error: missionsError, filePath: layout.missionsDir, label: "repertoire missions" },
    ].find((entry) => entry.error && entry.error.code !== "ENOENT" && (0, file_system_read_errors_1.isFileSystemReadError)(entry.error));
    if (fileSystemError?.error) {
        if (fileSystemError.filePath === layout.journalPath) {
            throw event_log_errors_1.EventLogReadError.fileSystem(layout.journalPath, fileSystemError.error);
        }
        throw (0, file_system_read_errors_1.createFileSystemReadError)(fileSystemError.error, fileSystemError.filePath, fileSystemError.label);
    }
    if (journalError?.code === "ENOENT" && !projectionsError && !missionsError) {
        throw event_log_errors_1.EventLogReadError.missing(layout.journalPath, journalError);
    }
    if (journalError || projectionsError || missionsError) {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`);
    }
}
async function readStoredArtifactIndex(projectionsDir) {
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(projectionsDir, "artifact-index");
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "artifact-index"));
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error) || error instanceof SyntaxError) {
            return null;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw (0, file_system_read_errors_1.createFileSystemReadError)(error, projectionPath, "projection artifact-index");
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
async function readMissionSnapshotForArtifacts(layout, missionRepository, missionId) {
    try {
        const mission = await missionRepository.findById(missionId);
        if (mission) {
            return mission;
        }
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
    }
    return (0, mission_reconstruction_1.readMissionSnapshotFromJournalOrThrow)(layout.journalPath, missionId);
}
async function readTicketsForArtifacts(ticketRepository, missionId, events) {
    try {
        return await ticketRepository.listByMissionId(missionId);
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return (0, mission_reconstruction_1.reconstructTicketsFromJournal)(events, missionId);
    }
}
async function readStoredArtifactsForArtifacts(artifactRepository, missionId) {
    try {
        return await artifactRepository.listByMissionId(missionId);
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return [];
    }
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
function isClassifiedReadError(error) {
    return (0, event_log_errors_1.isEventLogReadError)(error) || (0, persisted_document_errors_1.isPersistedDocumentReadError)(error);
}
