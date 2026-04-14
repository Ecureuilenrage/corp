"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWorkspaceLayout = resolveWorkspaceLayout;
exports.ensureWorkspaceLayout = ensureWorkspaceLayout;
exports.resolveMissionStoragePaths = resolveMissionStoragePaths;
exports.resolveTicketStoragePaths = resolveTicketStoragePaths;
exports.resolveExecutionAttemptStoragePaths = resolveExecutionAttemptStoragePaths;
exports.resolveArtifactStoragePaths = resolveArtifactStoragePaths;
exports.resolveCapabilityStoragePaths = resolveCapabilityStoragePaths;
exports.resolveSkillPackStoragePaths = resolveSkillPackStoragePaths;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
function resolveWorkspaceLayout(rootDir) {
    const resolvedRootDir = node_path_1.default.resolve(rootDir);
    const corpDir = node_path_1.default.join(resolvedRootDir, ".corp");
    const journalDir = node_path_1.default.join(corpDir, "journal");
    const projectionsDir = node_path_1.default.join(corpDir, "projections");
    const missionsDir = node_path_1.default.join(corpDir, "missions");
    const isolationsDir = node_path_1.default.join(corpDir, "isolations");
    const capabilitiesDir = node_path_1.default.join(corpDir, "capabilities");
    const skillPacksDir = node_path_1.default.join(corpDir, "skill-packs");
    return {
        rootDir: resolvedRootDir,
        corpDir,
        journalDir,
        journalPath: node_path_1.default.join(journalDir, "events.jsonl"),
        projectionsDir,
        missionsDir,
        isolationsDir,
        capabilitiesDir,
        skillPacksDir,
    };
}
async function ensureWorkspaceLayout(rootDir) {
    const layout = resolveWorkspaceLayout(rootDir);
    await (0, promises_1.mkdir)(layout.journalDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.projectionsDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.missionsDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.isolationsDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.capabilitiesDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.skillPacksDir, { recursive: true });
    return layout;
}
const MAX_STORAGE_ID_LENGTH = 255;
const UNSAFE_STORAGE_ID_PATTERN = /[/\\]|\.\.|^\.?$|\x00/;
function resolveMissionStoragePaths(layout, missionId) {
    assertSafeStorageIdentifier(missionId, "mission");
    const missionDir = node_path_1.default.join(layout.missionsDir, missionId);
    return {
        missionDir,
        missionPath: node_path_1.default.join(missionDir, "mission.json"),
    };
}
function resolveTicketStoragePaths(layout, missionId, ticketId) {
    const missionStoragePaths = resolveMissionStoragePaths(layout, missionId);
    assertSafeStorageIdentifier(ticketId, "ticket");
    const ticketsDir = node_path_1.default.join(missionStoragePaths.missionDir, "tickets");
    const ticketDir = node_path_1.default.join(ticketsDir, ticketId);
    return {
        ticketsDir,
        ticketDir,
        ticketPath: node_path_1.default.join(ticketDir, "ticket.json"),
    };
}
function resolveExecutionAttemptStoragePaths(layout, missionId, ticketId, attemptId) {
    const ticketStoragePaths = resolveTicketStoragePaths(layout, missionId, ticketId);
    assertSafeStorageIdentifier(attemptId, "attempt");
    const attemptsDir = node_path_1.default.join(ticketStoragePaths.ticketDir, "attempts");
    const attemptDir = node_path_1.default.join(attemptsDir, attemptId);
    return {
        attemptsDir,
        attemptDir,
        attemptPath: node_path_1.default.join(attemptDir, "attempt.json"),
    };
}
function resolveArtifactStoragePaths(layout, missionId, ticketId, artifactId) {
    const ticketStoragePaths = resolveTicketStoragePaths(layout, missionId, ticketId);
    assertSafeStorageIdentifier(artifactId, "artifact");
    const artifactsDir = node_path_1.default.join(ticketStoragePaths.ticketDir, "artifacts");
    const artifactDir = node_path_1.default.join(artifactsDir, artifactId);
    return {
        artifactsDir,
        artifactDir,
        artifactPath: node_path_1.default.join(artifactDir, "artifact.json"),
    };
}
function resolveCapabilityStoragePaths(layout, capabilityId) {
    assertSafeStorageIdentifier(capabilityId, "capability");
    const capabilityDir = node_path_1.default.join(layout.capabilitiesDir, capabilityId);
    return {
        capabilityDir,
        capabilityPath: node_path_1.default.join(capabilityDir, "capability.json"),
    };
}
function resolveSkillPackStoragePaths(layout, packRef) {
    assertSafeStorageIdentifier(packRef, "skill pack");
    const skillPackDir = node_path_1.default.join(layout.skillPacksDir, packRef);
    return {
        skillPackDir,
        skillPackPath: node_path_1.default.join(skillPackDir, "skill-pack.json"),
    };
}
function assertSafeStorageIdentifier(value, label) {
    if (!value
        || !value.trim()
        || value.length > MAX_STORAGE_ID_LENGTH
        || UNSAFE_STORAGE_ID_PATTERN.test(value)) {
        throw new Error(`Identifiant de ${label} invalide: ${value}.`);
    }
}
