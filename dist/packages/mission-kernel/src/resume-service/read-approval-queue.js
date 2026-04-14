"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readApprovalQueue = readApprovalQueue;
const promises_1 = require("node:fs/promises");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const approval_queue_projection_1 = require("../../../journal/src/projections/approval-queue-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
const FILE_SYSTEM_ERROR_CODES = new Set(["EPERM", "EMFILE", "ENOSPC"]);
async function readApprovalQueue(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureApprovalQueueWorkspaceInitialized(layout, options.commandName);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const mission = await missionRepository.findById(options.missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${options.missionId}.`);
    }
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "approval-queue");
    try {
        const missionEvents = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
            .filter((event) => event.missionId === mission.id);
        const rebuiltProjection = (0, approval_queue_projection_1.createApprovalQueueProjection)({
            missionId: mission.id,
            events: missionEvents,
        });
        const storedProjection = await readStoredApprovalQueue(layout.projectionsDir);
        if (!storedProjection || !(0, structural_compare_1.deepStrictEqualForComparison)(storedProjection, rebuiltProjection)) {
            await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "approval-queue", rebuiltProjection);
            return {
                mission,
                approvals: rebuiltProjection.approvals,
                reconstructed: true,
                projectionPath,
            };
        }
        return {
            mission,
            approvals: storedProjection.approvals,
            reconstructed: false,
            projectionPath,
        };
    }
    catch (error) {
        if (isFileSystemError(error)) {
            throw new Error(`Erreur fichier: ${error.message}`);
        }
        throw new Error(formatApprovalQueueReadError(options.missionId, options.commandName));
    }
}
async function ensureApprovalQueueWorkspaceInitialized(layout, commandName) {
    try {
        await (0, promises_1.access)(layout.journalPath);
        await (0, promises_1.access)(layout.projectionsDir);
        await (0, promises_1.access)(layout.missionsDir);
    }
    catch {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`);
    }
}
async function readStoredApprovalQueue(projectionsDir) {
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "approval-queue"));
    }
    catch (error) {
        if (isMissingFileError(error) || error instanceof SyntaxError) {
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
function isFileSystemError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && typeof error.code === "string"
        && FILE_SYSTEM_ERROR_CODES.has(error.code);
}
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
