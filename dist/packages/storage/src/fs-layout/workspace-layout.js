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
const extension_registration_1 = require("../../../contracts/src/extension/extension-registration");
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
const UNSAFE_STORAGE_ID_PATTERN = /[/\\]|^\.{1,2}$|\x00/;
const WINDOWS_FORBIDDEN_STORAGE_CHARACTERS = new Set([":", "<", ">", "|", "?", "*", "\""]);
const WINDOWS_CONTROL_CHARACTER_PATTERN = /[\x01-\x1F]/;
const WINDOWS_RESERVED_STORAGE_NAMES = /^(?:con|prn|nul|aux|com[1-9]|lpt[1-9])(?:\..*)?$/i;
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
    const capabilityDir = node_path_1.default.join(layout.capabilitiesDir, normalizeCaseInsensitiveStorageSegment(capabilityId));
    return {
        capabilityDir,
        capabilityPath: node_path_1.default.join(capabilityDir, "capability.json"),
    };
}
function resolveSkillPackStoragePaths(layout, packRef) {
    assertSafeStorageIdentifier(packRef, "skill pack");
    const skillPackDir = node_path_1.default.join(layout.skillPacksDir, normalizeCaseInsensitiveStorageSegment(packRef));
    return {
        skillPackDir,
        skillPackPath: node_path_1.default.join(skillPackDir, "skill-pack.json"),
    };
}
function assertSafeStorageIdentifier(value, label) {
    if (!value || !value.trim()) {
        throw new Error(`Identifiant de ${label} invalide: valeur vide ou blanche.`);
    }
    if (value.length > MAX_STORAGE_ID_LENGTH) {
        throw new Error(`Identifiant de ${label} invalide: longueur superieure a ${MAX_STORAGE_ID_LENGTH} caracteres.`);
    }
    const forbiddenCharacter = [...value].find((character) => character === "\0" || WINDOWS_FORBIDDEN_STORAGE_CHARACTERS.has(character));
    if (forbiddenCharacter) {
        const printableCharacter = forbiddenCharacter === "\0"
            ? "\\0"
            : forbiddenCharacter;
        throw new Error(`Identifiant de ${label} invalide: caractere interdit Windows \`${printableCharacter}\` dans \`${value}\`.`);
    }
    const controlCharacterMatch = value.match(WINDOWS_CONTROL_CHARACTER_PATTERN);
    if (controlCharacterMatch) {
        const codePoint = controlCharacterMatch[0].charCodeAt(0)
            .toString(16)
            .padStart(2, "0")
            .toUpperCase();
        throw new Error(`Identifiant de ${label} invalide: caractere de controle interdit \`\\x${codePoint}\` dans \`${value}\`.`);
    }
    if (UNSAFE_STORAGE_ID_PATTERN.test(value)) {
        throw new Error(`Identifiant de ${label} invalide: segment relatif ou separateur interdit dans \`${value}\`.`);
    }
    if (value.endsWith(" ") || value.endsWith(".")) {
        throw new Error(`Identifiant de ${label} invalide: espace ou point terminal interdit dans \`${value}\`.`);
    }
    if (WINDOWS_RESERVED_STORAGE_NAMES.test(value)) {
        throw new Error(`Identifiant de ${label} invalide: nom reserve Windows \`${value}\`.`);
    }
}
function normalizeCaseInsensitiveStorageSegment(value) {
    return (0, extension_registration_1.normalizeOpaqueReferenceKey)(value);
}
