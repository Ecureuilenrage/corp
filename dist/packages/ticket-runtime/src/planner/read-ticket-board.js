"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTicketBoard = readTicketBoard;
const promises_1 = require("node:fs/promises");
const event_log_errors_1 = require("../../../journal/src/event-log/event-log-errors");
const mission_reconstruction_1 = require("../../../journal/src/reconstruction/mission-reconstruction");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_system_read_errors_1 = require("../../../storage/src/fs-layout/file-system-read-errors");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_execution_attempt_repository_1 = require("../../../storage/src/repositories/file-execution-attempt-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const persisted_document_errors_1 = require("../../../storage/src/repositories/persisted-document-errors");
const build_ticket_board_1 = require("./build-ticket-board");
const structural_compare_1 = require("../utils/structural-compare");
async function readTicketBoard(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureTicketBoardWorkspaceInitialized(layout, options.commandName);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const storedMissionResult = await readStoredMissionSnapshot(missionRepository, options.missionId);
    const storedMission = storedMissionResult.mission;
    const missionEvents = await (0, mission_reconstruction_1.readMissionEvents)(layout.journalPath, options.missionId);
    const missionFromJournal = missionEvents.length > 0
        ? (0, mission_reconstruction_1.reconstructMissionFromJournal)(missionEvents, options.missionId)
        : null;
    if (!storedMission && !missionFromJournal) {
        throw new Error(`Mission introuvable: ${options.missionId}.`);
    }
    const missionSnapshot = selectFreshMissionSnapshot(storedMission, missionFromJournal, missionEvents.at(-1)?.eventId);
    const projectionPath = (0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "ticket-board");
    try {
        const storedTickets = await readStoredTicketsForBoard(ticketRepository, missionSnapshot.id);
        const journalTickets = (0, mission_reconstruction_1.reconstructTicketsFromJournal)(missionEvents, missionSnapshot.id);
        const mergedTickets = mergeTicketsById(storedTickets.tickets, journalTickets);
        const missionTickets = mergedTickets.tickets;
        const storedAttempts = await readStoredAttemptsForBoard(missionSnapshot, attemptRepository);
        const missionAttempts = mergeAttemptsById(storedAttempts.attempts, (0, mission_reconstruction_1.reconstructAttemptsFromJournal)(missionEvents), mergedTickets.usedJournalSnapshot
            || missionSnapshot === missionFromJournal
            || storedMissionResult.recovered
            || storedTickets.recovered
            || storedAttempts.recovered);
        const rebuiltBoard = (0, build_ticket_board_1.buildTicketBoardProjection)(missionSnapshot, missionTickets, missionAttempts, missionEvents);
        const storedBoard = await readStoredTicketBoard(layout.projectionsDir, projectionPath, options.commandName === "compare" || options.commandName === "compare relaunch");
        if (!storedBoard || !isProjectionUpToDate(storedBoard, rebuiltBoard)) {
            await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "ticket-board", rebuiltBoard);
            return {
                mission: missionSnapshot,
                board: rebuiltBoard,
                reconstructed: true,
                projectionPath,
            };
        }
        return {
            mission: missionSnapshot,
            board: storedBoard,
            reconstructed: storedMissionResult.recovered
                || storedTickets.recovered
                || storedAttempts.recovered,
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
function selectFreshMissionSnapshot(storedMission, missionFromJournal, lastEventId) {
    if (!storedMission) {
        if (!missionFromJournal) {
            throw new Error("Mission introuvable.");
        }
        return missionFromJournal;
    }
    if (missionFromJournal && lastEventId && storedMission.resumeCursor !== lastEventId) {
        return missionFromJournal;
    }
    return storedMission;
}
function mergeTicketsById(storedTickets, journalTickets) {
    const ticketsById = new Map(storedTickets.map((ticket) => [ticket.id, ticket]));
    let usedJournalSnapshot = false;
    for (const ticket of journalTickets) {
        const storedTicket = ticketsById.get(ticket.id);
        if (!storedTicket || isJournalTicketNewer(storedTicket, ticket)) {
            ticketsById.set(ticket.id, ticket);
            usedJournalSnapshot = true;
        }
    }
    return {
        tickets: [...ticketsById.values()],
        usedJournalSnapshot,
    };
}
function isJournalTicketNewer(storedTicket, journalTicket) {
    const storedEventIds = new Set(storedTicket.eventIds);
    return journalTicket.eventIds.some((eventId) => !storedEventIds.has(eventId));
}
function mergeAttemptsById(storedAttempts, journalAttempts, preferJournalSnapshots) {
    const attemptsById = new Map(storedAttempts.map((attempt) => [attempt.id, attempt]));
    for (const attempt of journalAttempts) {
        if (preferJournalSnapshots || !attemptsById.has(attempt.id)) {
            attemptsById.set(attempt.id, attempt);
        }
    }
    return [...attemptsById.values()];
}
async function ensureTicketBoardWorkspaceInitialized(layout, commandName) {
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
async function readStoredMissionSnapshot(missionRepository, missionId) {
    try {
        return {
            mission: await missionRepository.findById(missionId),
            recovered: false,
        };
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return {
            mission: null,
            recovered: true,
        };
    }
}
async function readStoredTicketsForBoard(ticketRepository, missionId) {
    try {
        return {
            tickets: await ticketRepository.listByMissionId(missionId),
            recovered: false,
        };
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return {
            tickets: [],
            recovered: true,
        };
    }
}
async function readStoredAttemptsForBoard(mission, attemptRepository) {
    try {
        return {
            attempts: await listMissionAttempts(mission, attemptRepository),
            recovered: false,
        };
    }
    catch (error) {
        if (!(0, persisted_document_errors_1.isRecoverablePersistedDocumentError)(error)) {
            throw error;
        }
        return {
            attempts: [],
            recovered: true,
        };
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
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
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
    if ((0, event_log_errors_1.isEventLogReadError)(error) || (0, persisted_document_errors_1.isPersistedDocumentReadError)(error)) {
        return error instanceof Error ? error : new Error(String(error));
    }
    if ((0, file_system_read_errors_1.isFileSystemReadError)(error)) {
        return (0, file_system_read_errors_1.createFileSystemReadError)(error, options.projectionPath, "projection ticket-board");
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
