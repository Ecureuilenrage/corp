"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readApprovalQueue = readApprovalQueue;
const promises_1 = require("node:fs/promises");
const event_log_errors_1 = require("../../../journal/src/event-log/event-log-errors");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const mission_reconstruction_1 = require("../../../journal/src/reconstruction/mission-reconstruction");
const approval_queue_projection_1 = require("../../../journal/src/projections/approval-queue-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const persisted_document_errors_1 = require("../../../storage/src/repositories/persisted-document-errors");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
async function readApprovalQueue(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureApprovalQueueWorkspaceInitialized(layout, options.commandName);
    const missionSnapshotResult = await readMissionSnapshotForApprovalQueue(layout, options.missionId);
    const missionSnapshot = missionSnapshotResult.mission;
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "approval-queue");
    try {
        const missionEvents = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
            .filter((event) => event.missionId === missionSnapshot.id);
        const rebuiltProjection = (0, approval_queue_projection_1.createApprovalQueueProjection)({
            missionId: missionSnapshot.id,
            events: missionEvents,
        });
        const storedProjection = await readStoredApprovalQueue(layout.projectionsDir);
        if (!storedProjection || !(0, structural_compare_1.deepStrictEqualForComparison)(storedProjection, rebuiltProjection)) {
            await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "approval-queue", rebuiltProjection);
            return {
                mission: missionSnapshot,
                approvals: rebuiltProjection.approvals,
                reconstructed: true,
                projectionPath,
            };
        }
        return {
            mission: missionSnapshot,
            approvals: storedProjection.approvals,
            reconstructed: missionSnapshotResult.reconstructed,
            projectionPath,
        };
    }
    catch (error) {
        if (isClassifiedReadError(error)) {
            throw error;
        }
        if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
            throw (0, file_system_read_errors_1.createFileSystemReadError)(error, projectionPath, "projection approval-queue");
        }
        throw new Error(formatApprovalQueueReadError(options.missionId, options.commandName));
    }
}
async function ensureApprovalQueueWorkspaceInitialized(layout, commandName) {
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
async function readStoredApprovalQueue(projectionsDir) {
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "approval-queue"));
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error) || error instanceof SyntaxError) {
            return null;
        }
        throw error;
    }
}
function formatApprovalQueueReadError(missionId, commandName) {
    if (commandName === "approval queue") {
        return `Projection approval-queue irreconciliable pour ${missionId}. Impossible d'afficher la file d'approbation.`;
    }
    if (commandName.startsWith("approval ")) {
        return `Projection approval-queue irreconciliable pour ${missionId}. Impossible de resoudre la validation.`;
    }
    return `Projection approval-queue irreconciliable pour ${missionId}. Impossible d'afficher la mission.`;
}
async function readMissionSnapshotForApprovalQueue(layout, missionId) {
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    try {
        const mission = await missionRepository.findById(missionId);
        if (mission) {
            return { mission, reconstructed: false };
        }
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
    }
    return {
        mission: await (0, mission_reconstruction_1.readMissionSnapshotFromJournalOrThrow)(layout.journalPath, missionId),
        reconstructed: true,
    };
}
function isClassifiedReadError(error) {
    return (0, event_log_errors_1.isEventLogReadError)(error) || (0, persisted_document_errors_1.isPersistedDocumentReadError)(error);
}
