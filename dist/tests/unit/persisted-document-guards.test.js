"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const persisted_document_guards_1 = require("../../packages/contracts/src/guards/persisted-document-guards");
function assertInvalid(result, reasonPattern) {
    strict_1.default.equal(result.ok, false);
    if (!result.ok) {
        strict_1.default.match(result.reason, reasonPattern);
    }
}
function createMission(overrides = {}) {
    return {
        id: "mission_guard",
        title: "Mission guard",
        objective: "Valider le snapshot mission",
        status: "ready",
        successCriteria: ["Le guard accepte le document"],
        policyProfileId: "policy_profile_local",
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: [],
        },
        ticketIds: [],
        artifactIds: [],
        eventIds: ["event_guard"],
        resumeCursor: "event_guard",
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createTicket(overrides = {}) {
    return {
        id: "ticket_guard",
        missionId: "mission_guard",
        kind: "implement",
        goal: "Valider le snapshot ticket",
        status: "todo",
        owner: "agent_guard",
        dependsOn: [],
        successCriteria: ["Le guard accepte le ticket"],
        allowedCapabilities: [],
        skillPackRefs: [],
        workspaceIsolationId: null,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: ["event_guard"],
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createExecutionAttempt(overrides = {}) {
    return {
        id: "attempt_guard",
        ticketId: "ticket_guard",
        adapter: "codex_responses",
        status: "running",
        workspaceIsolationId: "iso_guard",
        backgroundRequested: false,
        adapterState: {},
        startedAt: "2026-04-15T10:00:00.000Z",
        endedAt: null,
        ...overrides,
    };
}
function createArtifact(overrides = {}) {
    return {
        id: "artifact_guard",
        missionId: "mission_guard",
        ticketId: "ticket_guard",
        producingEventId: "event_guard",
        attemptId: null,
        workspaceIsolationId: null,
        kind: "report_text",
        title: "Rapport guard",
        createdAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createRegisteredCapability(overrides = {}) {
    return {
        capabilityId: "cap.guard",
        registrationId: "ext.cap.guard",
        schemaVersion: "corp.extension.v1",
        provider: "local",
        displayName: "Capability guard",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only"],
        approvalSensitive: false,
        requiredEnvNames: [],
        metadata: {
            description: "Capability locale de test.",
            owner: "core-platform",
            tags: ["guard"],
        },
        localRefs: {
            rootDir: "C:/tmp/cap.guard",
            references: [],
            scripts: [],
        },
        mcp: null,
        registeredAt: "2026-04-15T10:00:00.000Z",
        sourceManifestPath: "C:/tmp/capability.json",
        ...overrides,
    };
}
function createRegisteredSkillPack(overrides = {}) {
    return {
        packRef: "pack.guard",
        registrationId: "ext.pack.guard",
        schemaVersion: "corp.extension.v1",
        displayName: "Pack guard",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only"],
        metadata: {
            description: "Pack local de test.",
            owner: "core-platform",
            tags: ["guard"],
        },
        localRefs: {
            rootDir: "C:/tmp/pack.guard",
            references: [],
            scripts: [],
        },
        registeredAt: "2026-04-15T10:00:00.000Z",
        sourceManifestPath: "C:/tmp/skill-pack.json",
        ...overrides,
    };
}
(0, node_test_1.default)("isMission valide le snapshot mission et documente les raisons de rejet", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isMission)(createMission()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isMission)({ ...createMission(), authorizedExtensions: undefined }), true);
    assertInvalid((0, persisted_document_guards_1.validateMission)({ ...createMission(), title: undefined }), /champ manquant.*title/i);
    assertInvalid((0, persisted_document_guards_1.validateMission)({ ...createMission(), ticketIds: [42] }), /type incorrect.*ticketIds/i);
    assertInvalid((0, persisted_document_guards_1.validateMission)({ ...createMission(), status: "closed" }), /statut inconnu.*status/i);
    assertInvalid((0, persisted_document_guards_1.validateMission)({ ...createMission(), authorizedExtensions: { allowedCapabilities: "cap", skillPackRefs: [] } }), /type incorrect.*authorizedExtensions\.allowedCapabilities/i);
});
(0, node_test_1.default)("isTicket valide le snapshot ticket et rejette champs, types et discriminants inconnus", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isTicket)(createTicket()), true);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), goal: undefined }), /champ manquant.*goal/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), dependsOn: ["a", 1] }), /type incorrect.*dependsOn/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), kind: "fix" }), /discriminant invalide.*kind/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), status: "closed" }), /statut inconnu.*status/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), executionHandle: { adapter: "unknown", adapterState: {} } }), /discriminant invalide.*executionHandle\.adapter/i);
});
(0, node_test_1.default)("isExecutionAttempt valide les tentatives et rejette les statuts/adapters inconnus", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isExecutionAttempt)(createExecutionAttempt()), true);
    assertInvalid((0, persisted_document_guards_1.validateExecutionAttempt)({ ...createExecutionAttempt(), ticketId: undefined }), /champ manquant.*ticketId/i);
    assertInvalid((0, persisted_document_guards_1.validateExecutionAttempt)({ ...createExecutionAttempt(), backgroundRequested: "false" }), /type incorrect.*backgroundRequested/i);
    assertInvalid((0, persisted_document_guards_1.validateExecutionAttempt)({ ...createExecutionAttempt(), adapter: "legacy_adapter" }), /discriminant invalide.*adapter/i);
    assertInvalid((0, persisted_document_guards_1.validateExecutionAttempt)({ ...createExecutionAttempt(), status: "stalled" }), /statut inconnu.*status/i);
});
(0, node_test_1.default)("isArtifact valide les artefacts et rejette les kinds ou champs optionnels invalides", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isArtifact)(createArtifact()), true);
    assertInvalid((0, persisted_document_guards_1.validateArtifact)({ ...createArtifact(), missionId: undefined }), /champ manquant.*missionId/i);
    assertInvalid((0, persisted_document_guards_1.validateArtifact)({ ...createArtifact(), sizeBytes: "12" }), /type incorrect.*sizeBytes/i);
    assertInvalid((0, persisted_document_guards_1.validateArtifact)({ ...createArtifact(), kind: "binary_blob" }), /discriminant invalide.*kind/i);
});
(0, node_test_1.default)("isRegisteredCapability valide le registre capability et ses branches provider", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isRegisteredCapability)(createRegisteredCapability()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isRegisteredCapability)(createRegisteredCapability({
        provider: "mcp",
        mcp: { serverName: "server", toolName: "tool" },
    })), true);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredCapability)({ ...createRegisteredCapability(), capabilityId: undefined }), /champ manquant.*capabilityId/i);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredCapability)({ ...createRegisteredCapability(), permissions: ["docs.read", 42] }), /type incorrect.*permissions/i);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredCapability)({ ...createRegisteredCapability(), provider: "remote" }), /discriminant invalide.*provider/i);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredCapability)({ ...createRegisteredCapability({ provider: "mcp", mcp: null }) }), /champ manquant.*mcp/i);
});
(0, node_test_1.default)("isRegisteredSkillPack valide le registre skill-pack et ses metadonnees", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isRegisteredSkillPack)(createRegisteredSkillPack()), true);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredSkillPack)({ ...createRegisteredSkillPack(), packRef: undefined }), /champ manquant.*packRef/i);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredSkillPack)({ ...createRegisteredSkillPack(), constraints: ["local_only", 42] }), /type incorrect.*constraints/i);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredSkillPack)({ ...createRegisteredSkillPack(), schemaVersion: "corp.extension.v2" }), /discriminant invalide.*schemaVersion/i);
    assertInvalid((0, persisted_document_guards_1.validateRegisteredSkillPack)({
        ...createRegisteredSkillPack(),
        metadata: { description: "x", owner: "core", tags: [42] },
    }), /type incorrect.*metadata\.tags/i);
});
