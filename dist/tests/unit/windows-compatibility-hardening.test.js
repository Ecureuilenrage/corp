"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = require("node:os");
const node_test_1 = __importDefault(require("node:test"));
const mission_1 = require("../../packages/contracts/src/mission/mission");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const ticket_service_support_1 = require("../../packages/ticket-runtime/src/ticket-service/ticket-service-support");
function createMission(overrides = {}) {
    return {
        id: "mission_windows",
        title: "Mission Windows",
        objective: "Durcir la compatibilite Windows",
        status: "ready",
        successCriteria: ["Les refs restent deterministes"],
        policyProfileId: "policy_profile_windows",
        authorizedExtensions: (0, mission_1.normalizeMissionAuthorizedExtensions)({
            allowedCapabilities: ["Shell.Exec"],
            skillPackRefs: ["Pack.Triage.Local"],
        }),
        ticketIds: [],
        artifactIds: [],
        eventIds: ["event_windows_0"],
        resumeCursor: "event_windows_0",
        createdAt: "2026-04-20T22:00:00.000Z",
        updatedAt: "2026-04-20T22:00:00.000Z",
        ...overrides,
    };
}
function mixCase(value) {
    return [...value]
        .map((character, index) => /[A-Za-z]/.test(character)
        ? (index % 2 === 0 ? character.toLowerCase() : character.toUpperCase())
        : character)
        .join("");
}
(0, node_test_1.default)("resolve*StoragePaths rejettent les caracteres interdits Windows avec un motif explicite", () => {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-windows-layout"));
    const invalidCharacters = [":", "<", ">", "|", "?", "*", "\"", "\0"];
    for (const character of invalidCharacters) {
        strict_1.default.throws(() => (0, workspace_layout_1.resolveCapabilityStoragePaths)(layout, `cap${character}id`), /caractere interdit Windows/i, `Le caractere ${JSON.stringify(character)} devrait etre rejete.`);
    }
    strict_1.default.throws(() => (0, workspace_layout_1.resolveMissionStoragePaths)(layout, "mission. "), /espace ou point terminal/i);
    strict_1.default.throws(() => (0, workspace_layout_1.resolveSkillPackStoragePaths)(layout, "pack.triage."), /espace ou point terminal/i);
});
(0, node_test_1.default)("resolve*StoragePaths rejettent chaque nom reserve Windows avec ou sans extension et en casse mixte", () => {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-windows-reserved-layout"));
    const reservedNames = [
        "CON",
        "PRN",
        "NUL",
        "AUX",
        "COM1",
        "COM2",
        "COM3",
        "COM4",
        "COM5",
        "COM6",
        "COM7",
        "COM8",
        "COM9",
        "LPT1",
        "LPT2",
        "LPT3",
        "LPT4",
        "LPT5",
        "LPT6",
        "LPT7",
        "LPT8",
        "LPT9",
    ];
    for (const reservedName of reservedNames) {
        for (const candidate of [
            reservedName,
            `${reservedName}.txt`,
            mixCase(reservedName),
            `${mixCase(reservedName)}.log`,
        ]) {
            strict_1.default.throws(() => (0, workspace_layout_1.resolveCapabilityStoragePaths)(layout, candidate), /nom reserve Windows/i, `Le nom reserve ${candidate} devrait etre rejete.`);
        }
    }
    strict_1.default.throws(() => (0, workspace_layout_1.resolveMissionStoragePaths)(layout, "con"), /Identifiant de mission invalide.*nom reserve Windows/i);
    strict_1.default.throws(() => (0, workspace_layout_1.resolveSkillPackStoragePaths)(layout, "AuX.md"), /Identifiant de skill pack invalide.*nom reserve Windows/i);
});
(0, node_test_1.default)("resolve*StoragePaths rejettent les caracteres de controle ASCII en citant leur code point", () => {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-windows-control"));
    const controlSamples = [
        { character: "\t", codePoint: "x09" },
        { character: "\n", codePoint: "x0A" },
        { character: "\r", codePoint: "x0D" },
        { character: "\x01", codePoint: "x01" },
        { character: "\x1F", codePoint: "x1F" },
    ];
    for (const { character, codePoint } of controlSamples) {
        strict_1.default.throws(() => (0, workspace_layout_1.resolveCapabilityStoragePaths)(layout, `cap${character}id`), new RegExp(`caractere de controle interdit.*\\\\${codePoint}`, "i"), `Le caractere de controle \\\\${codePoint} devrait etre rejete.`);
    }
});
// Comportement attendu identique sur Windows et POSIX: AC1 est applique en amont du FS,
// donc la validation ne depend pas du separateur ni de la sensibilite de casse du noyau.
(0, node_test_1.default)("assertSafeStorageIdentifier rejette `..` seul mais tolere un double point au milieu d'un identifiant", () => {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-windows-dotdot"));
    strict_1.default.throws(() => (0, workspace_layout_1.resolveMissionStoragePaths)(layout, ".."), /segment relatif ou separateur interdit/i);
    strict_1.default.doesNotThrow(() => (0, workspace_layout_1.resolveSkillPackStoragePaths)(layout, "pack..triage"));
});
// AC4 — la discrimination unc_unreachable vs missing_local_ref est pilotee par le code
// d'erreur retourne par statSync (voir UNC_UNREACHABLE_ERROR_CODES). Le test unitaire
// `UNC_UNREACHABLE_ERROR_CODES contient les codes reseau ...` dans
// extension-registration-validation.test.ts couvre la matrice exhaustive sans dependance OS.
(0, node_test_1.default)("ensureTicketExtensionsAllowedByMission compare les refs de ticket et mission sans faux negatif de casse", () => {
    const mission = createMission();
    strict_1.default.doesNotThrow(() => (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
        mission,
        allowedCapabilities: ["shell.exec", "FS.READ", "CLI.RUN"],
        skillPackRefs: ["pack.triage.local"],
    }));
    strict_1.default.throws(() => (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
        mission,
        allowedCapabilities: ["shell.write"],
        skillPackRefs: [],
    }), /La capability `shell\.write` n'est pas autorisee par la mission `mission_windows`\./i);
});
