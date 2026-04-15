"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileExecutionAttemptRepository = void 0;
exports.createFileExecutionAttemptRepository = createFileExecutionAttemptRepository;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const execution_attempt_1 = require("../../../contracts/src/execution-attempt/execution-attempt");
const atomic_json_1 = require("../fs-layout/atomic-json");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const persisted_document_errors_1 = require("./persisted-document-errors");
class FileExecutionAttemptRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(missionId, attempt) {
        const attemptStoragePaths = (0, workspace_layout_1.resolveExecutionAttemptStoragePaths)(this.layout, missionId, attempt.ticketId, attempt.id);
        await (0, promises_1.mkdir)(attemptStoragePaths.attemptDir, { recursive: true });
        await (0, atomic_json_1.writeJsonAtomic)(attemptStoragePaths.attemptPath, attempt);
        return attemptStoragePaths;
    }
    async findById(missionId, ticketId, attemptId) {
        const attemptStoragePaths = (0, workspace_layout_1.resolveExecutionAttemptStoragePaths)(this.layout, missionId, ticketId, attemptId);
        const context = {
            filePath: attemptStoragePaths.attemptPath,
            entityLabel: "ExecutionAttempt",
            documentId: attemptId,
        };
        try {
            const storedAttempt = await (0, persisted_document_errors_1.readPersistedJsonDocument)(context);
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedAttempt, persisted_document_guards_1.validateExecutionAttempt, context);
            return storedAttempt;
        }
        catch (error) {
            if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
                return null;
            }
            throw error;
        }
    }
    async listByTicketId(missionId, ticketId) {
        const ticketStoragePaths = (0, workspace_layout_1.resolveTicketStoragePaths)(this.layout, missionId, ticketId);
        const attemptsDir = node_path_1.default.join(ticketStoragePaths.ticketDir, "attempts");
        const attemptEntries = await readDirectoryEntries(attemptsDir);
        const attempts = [];
        for (const attemptEntry of attemptEntries) {
            if (!attemptEntry.isDirectory()) {
                continue;
            }
            const attempt = await this.findById(missionId, ticketId, attemptEntry.name);
            if (attempt) {
                attempts.push(attempt);
            }
        }
        return attempts;
    }
    async findActiveByTicketId(missionId, ticketId) {
        const attempts = await this.listByTicketId(missionId, ticketId);
        return attempts.find((attempt) => execution_attempt_1.ACTIVE_EXECUTION_ATTEMPT_STATUSES.includes(attempt.status)) ?? null;
    }
}
exports.FileExecutionAttemptRepository = FileExecutionAttemptRepository;
function createFileExecutionAttemptRepository(layout) {
    return new FileExecutionAttemptRepository(layout);
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
