"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTicketRepository = exports.MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP = void 0;
exports.createFileTicketRepository = createFileTicketRepository;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const mission_1 = require("../../../contracts/src/mission/mission");
const atomic_json_1 = require("../fs-layout/atomic-json");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const persisted_document_errors_1 = require("./persisted-document-errors");
exports.MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP = 50;
const SEARCHABLE_MISSION_DIRECTORY_NAME_PATTERN = /^mission_[A-Za-z0-9_-]+$/;
class FileTicketRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(ticket) {
        const ticketStoragePaths = (0, workspace_layout_1.resolveTicketStoragePaths)(this.layout, ticket.missionId, ticket.id);
        await (0, promises_1.mkdir)(ticketStoragePaths.ticketDir, { recursive: true });
        await (0, atomic_json_1.writeJsonAtomic)(ticketStoragePaths.ticketPath, ticket);
        return ticketStoragePaths;
    }
    async findById(missionId, ticketId) {
        const ticketStoragePaths = (0, workspace_layout_1.resolveTicketStoragePaths)(this.layout, missionId, ticketId);
        const context = {
            filePath: ticketStoragePaths.ticketPath,
            entityLabel: "Ticket",
            documentId: ticketId,
        };
        try {
            const storedTicket = await (0, persisted_document_errors_1.readPersistedJsonDocument)(context);
            const warnings = [];
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedTicket, (value) => (0, persisted_document_guards_1.validateTicket)(value, { strict: false, warnings }), context);
            return (0, persisted_document_guards_1.attachStructuralValidationWarnings)(storedTicket, warnings);
        }
        catch (error) {
            if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
                return null;
            }
            throw error;
        }
    }
    async findOwningMissionId(ticketId) {
        const missionEntries = (await readMissionDirectories(this.layout.missionsDir))
            .filter((missionEntry) => isSearchableMissionDirectory(missionEntry));
        if (missionEntries.length > exports.MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP) {
            throw new Error("Trop de missions pour une recherche exhaustive.");
        }
        const owningMissionIdsByTicketId = new Map();
        for (const missionEntry of missionEntries) {
            const mission = await this.readMissionSnapshot(missionEntry.name);
            if (!mission) {
                continue;
            }
            for (const missionTicketId of mission.ticketIds) {
                if (!owningMissionIdsByTicketId.has(missionTicketId)) {
                    owningMissionIdsByTicketId.set(missionTicketId, mission.id);
                }
            }
        }
        return owningMissionIdsByTicketId.get(ticketId) ?? null;
    }
    async listByMissionId(missionId) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, missionId);
        const ticketsDir = node_path_1.default.join(missionStoragePaths.missionDir, "tickets");
        const ticketEntries = await readDirectoryEntries(ticketsDir);
        const tickets = [];
        for (const ticketEntry of ticketEntries) {
            if (!ticketEntry.isDirectory()) {
                continue;
            }
            const ticket = await this.findById(missionId, ticketEntry.name);
            if (ticket) {
                tickets.push(ticket);
            }
        }
        return tickets;
    }
    async readMissionSnapshot(missionId) {
        const missionStoragePaths = (0, workspace_layout_1.resolveMissionStoragePaths)(this.layout, missionId);
        const context = {
            filePath: missionStoragePaths.missionPath,
            entityLabel: "Mission",
            documentId: missionId,
        };
        try {
            const storedMission = await (0, persisted_document_errors_1.readPersistedJsonDocument)(context);
            const warnings = [];
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedMission, (value) => (0, persisted_document_guards_1.validateMission)(value, { strict: false, warnings }), context);
            return (0, persisted_document_guards_1.attachStructuralValidationWarnings)((0, mission_1.hydrateMission)(storedMission), warnings);
        }
        catch (error) {
            if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
                return null;
            }
            throw error;
        }
    }
}
exports.FileTicketRepository = FileTicketRepository;
function createFileTicketRepository(layout) {
    return new FileTicketRepository(layout);
}
async function readMissionDirectories(missionsDir) {
    return readDirectoryEntries(missionsDir);
}
async function readDirectoryEntries(directoryPath) {
    try {
        return await (0, promises_1.readdir)(directoryPath, { withFileTypes: true, encoding: "utf8" });
    }
    catch (error) {
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            return [];
        }
        throw error;
    }
}
function isSearchableMissionDirectory(entry) {
    return entry.isDirectory()
        && SEARCHABLE_MISSION_DIRECTORY_NAME_PATTERN.test(entry.name);
}
