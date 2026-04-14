"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTicketBoard = readTicketBoard;
const promises_1 = require("node:fs/promises");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_execution_attempt_repository_1 = require("../../../storage/src/repositories/file-execution-attempt-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const build_ticket_board_1 = require("./build-ticket-board");
const structural_compare_1 = require("../utils/structural-compare");
const FILE_SYSTEM_ERROR_CODES = new Set(["ENOENT", "EPERM", "EMFILE", "ENOSPC"]);
async function readTicketBoard(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureTicketBoardWorkspaceInitialized(layout, options.commandName);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const mission = await missionRepository.findById(options.missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${options.missionId}.`);
    }
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "ticket-board");
    try {
        const missionTickets = await ticketRepository.listByMissionId(mission.id);
        const missionAttempts = await listMissionAttempts(mission, attemptRepository);
        const missionEvents = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
            .filter((event) => event.missionId === mission.id);
        const rebuiltBoard = (0, build_ticket_board_1.buildTicketBoardProjection)(mission, missionTickets, missionAttempts, missionEvents);
        const storedBoard = await readStoredTicketBoard(layout.projectionsDir, projectionPath, options.commandName === "compare" || options.commandName === "compare relaunch");
        if (!storedBoard || !isProjectionUpToDate(storedBoard, rebuiltBoard)) {
            await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "ticket-board", rebuiltBoard);
            return {
                mission,
                board: rebuiltBoard,
                reconstructed: true,
                projectionPath,
            };
        }
        return {
            mission,
            board: storedBoard,
            reconstructed: false,
            projectionPath,
        };
    }
    catch (error) {
        throw normalizeTicketBoardReadError(error, {
            missionId: options.missionId,
            commandName: options.commandName,
            projectionPath,
        });
    }
}
async function ensureTicketBoardWorkspaceInitialized(layout, commandName) {
    try {
        await (0, promises_1.access)(layout.journalPath);
        await (0, promises_1.access)(layout.projectionsDir);
        await (0, promises_1.access)(layout.missionsDir);
    }
    catch {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`);
    }
}
async function listMissionAttempts(mission, attemptRepository) {
    const missionAttempts = [];
    for (const ticketId of mission.ticketIds) {
        missionAttempts.push(...(await attemptRepository.listByTicketId(mission.id, ticketId)));
    }
    return missionAttempts;
}
async function readStoredTicketBoard(projectionsDir, projectionPath, recoverCorruptedProjection) {
    try {
        return JSON.parse(await (0, file_projection_store_1.readProjectionFile)(projectionsDir, "ticket-board"));
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return null;
        }
        if (error instanceof SyntaxError) {
            if (recoverCorruptedProjection) {
                return null;
            }
            throw createProjectionCorruptionError(projectionPath, error);
        }
        throw error;
    }
}
function isProjectionUpToDate(storedBoard, rebuiltBoard) {
    return (0, structural_compare_1.deepStrictEqualForComparison)(storedBoard, rebuiltBoard);
}
function formatTicketBoardReadError(missionId, commandName) {
    if (commandName === "ticket board") {
        return `Projection ticket-board irreconciliable pour ${missionId}. Impossible d'afficher le board des tickets.`;
    }
    return `Projection ticket-board irreconciliable pour ${missionId}. Impossible d'afficher la mission.`;
}
function normalizeTicketBoardReadError(error, options) {
    if (isProjectionCorruptionError(error)) {
        return error;
    }
    if (isFileSystemError(error)) {
        return new Error(`Erreur fichier: ${error.message}`);
    }
    if (error instanceof SyntaxError) {
        return createProjectionCorruptionError(options.projectionPath, error);
    }
    return new Error(formatTicketBoardReadError(options.missionId, options.commandName));
}
function createProjectionCorruptionError(projectionPath, cause) {
    return Object.assign(new Error(`Projection ticket-board corrompue: ${projectionPath}`, { cause }), {
        code: "EPROJCORRUPT",
        projectionPath,
    });
}
function isProjectionCorruptionError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "EPROJCORRUPT";
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
