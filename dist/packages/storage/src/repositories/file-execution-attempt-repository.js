"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileExecutionAttemptRepository = void 0;
exports.createFileExecutionAttemptRepository = createFileExecutionAttemptRepository;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const execution_attempt_1 = require("../../../contracts/src/execution-attempt/execution-attempt");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
class FileExecutionAttemptRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(missionId, attempt) {
        const attemptStoragePaths = (0, workspace_layout_1.resolveExecutionAttemptStoragePaths)(this.layout, missionId, attempt.ticketId, attempt.id);
        await (0, promises_1.mkdir)(attemptStoragePaths.attemptDir, { recursive: true });
        await (0, promises_1.writeFile)(attemptStoragePaths.attemptPath, `${JSON.stringify(attempt, null, 2)}\n`, "utf8");
        return attemptStoragePaths;
    }
    async findById(missionId, ticketId, attemptId) {
        const attemptStoragePaths = (0, workspace_layout_1.resolveExecutionAttemptStoragePaths)(this.layout, missionId, ticketId, attemptId);
        try {
            const storedAttempt = await (0, promises_1.readFile)(attemptStoragePaths.attemptPath, "utf8");
            return JSON.parse(storedAttempt);
        }
        catch (error) {
            if (isMissingFileError(error)) {
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
