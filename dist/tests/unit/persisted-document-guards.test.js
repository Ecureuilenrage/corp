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
function createApprovalRequest(overrides = {}) {
    return {
        approvalId: "approval_guard",
        missionId: "mission_guard",
        ticketId: "ticket_guard",
        attemptId: "attempt_guard",
        status: "requested",
        title: "Validation guard",
        actionType: "fs.write",
        actionSummary: "Verifier le guard approval request",
        guardrails: ["local_only"],
        relatedEventIds: ["event_guard"],
        relatedArtifactIds: ["artifact_guard"],
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createApprovalDecision(overrides = {}) {
    return {
        outcome: "approved",
        reason: "Validation explicite.",
        missionPolicyChange: {
            previous: "policy.old",
            next: "policy.new",
        },
        ticketCapabilityChange: {
            previous: ["cap.old"],
            next: ["cap.new"],
        },
        ticketSkillPackChange: {
            previous: ["pack.old"],
            next: ["pack.new"],
        },
        budgetObservations: ["RAS"],
        ...overrides,
    };
}
function createCapabilityInvocationDetails(overrides = {}) {
    return {
        capabilityId: "cap.guard",
        registrationId: "ext.cap.guard",
        provider: "local",
        approvalSensitive: false,
        permissions: ["docs.read"],
        constraints: ["local_only"],
        requiredEnvNames: [],
        ...overrides,
    };
}
function createWorkspaceIsolationMetadata(overrides = {}) {
    return {
        workspaceIsolationId: "iso_guard",
        kind: "workspace_copy",
        sourceRoot: "C:/tmp/source",
        workspacePath: "C:/tmp/workspace",
        createdAt: "2026-04-15T10:00:00.000Z",
        retained: true,
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
(0, node_test_1.default)("validateMission accepte authorizedExtensions null et tolere un statut futur en lecture", () => {
    const warnings = [];
    const nullAuthorizedExtensions = (0, persisted_document_guards_1.validateMission)({
        ...createMission(),
        authorizedExtensions: null,
    });
    const futureMissionStatus = (0, persisted_document_guards_1.validateMission)({
        ...createMission(),
        status: "archived_v2",
    }, { strict: false, warnings });
    const futureTicketStatus = (0, persisted_document_guards_1.validateTicket)({
        ...createTicket(),
        status: "on_hold",
    }, { strict: false, warnings });
    const futureArtifactKind = (0, persisted_document_guards_1.validateArtifact)({
        ...createArtifact(),
        kind: "binary_blob_v2",
    }, { strict: false, warnings });
    strict_1.default.equal(nullAuthorizedExtensions.ok, true);
    assertInvalid((0, persisted_document_guards_1.validateMission)({ ...createMission(), authorizedExtensions: 42 }), /type incorrect.*authorizedExtensions/i);
    strict_1.default.equal(futureMissionStatus.ok, true);
    strict_1.default.equal(futureTicketStatus.ok, true);
    strict_1.default.equal(futureArtifactKind.ok, true);
    strict_1.default.equal((0, persisted_document_guards_1.isMission)({ ...createMission(), status: "archived_v2" }), false);
    strict_1.default.equal((0, persisted_document_guards_1.isTicket)({ ...createTicket(), status: "on_hold" }), false);
    strict_1.default.equal((0, persisted_document_guards_1.isArtifact)({ ...createArtifact(), kind: "binary_blob_v2" }), false);
    strict_1.default.deepEqual(warnings.map((warning) => ({ path: warning.path, value: warning.value })), [
        { path: "status", value: "archived_v2" },
        { path: "status", value: "on_hold" },
        { path: "kind", value: "binary_blob_v2" },
    ]);
});
(0, node_test_1.default)("isTicket valide le snapshot ticket et rejette champs, types et discriminants inconnus", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isTicket)(createTicket()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isTicket)(createTicket({ workspaceIsolationId: "iso_guard" })), true);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), goal: undefined }), /champ manquant.*goal/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), dependsOn: ["a", 1] }), /type incorrect.*dependsOn/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), kind: "fix" }), /discriminant invalide.*kind/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), status: "closed" }), /statut inconnu.*status/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), executionHandle: { adapter: "unknown", adapterState: {} } }), /discriminant invalide.*executionHandle\.adapter/i);
});
(0, node_test_1.default)("validateTicket rejette les champs herites du prototype et distingue champ manquant vs type incorrect", () => {
    const inheritedTicket = Object.create({
        id: "ticket_proto",
    });
    Object.assign(inheritedTicket, {
        missionId: "mission_guard",
        kind: "implement",
        goal: "Ticket prototype pollution",
        status: "todo",
        owner: "agent_guard",
        dependsOn: [],
        successCriteria: [],
        allowedCapabilities: [],
        skillPackRefs: [],
        workspaceIsolationId: null,
        artifactIds: [],
        eventIds: ["event_guard"],
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
    });
    assertInvalid((0, persisted_document_guards_1.validateTicket)(inheritedTicket), /champ manquant.*id/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), executionHandle: undefined }), /champ manquant.*executionHandle/i);
    assertInvalid((0, persisted_document_guards_1.validateTicket)({ ...createTicket(), executionHandle: "invalid" }), /type incorrect.*executionHandle/i);
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
    strict_1.default.equal((0, persisted_document_guards_1.isArtifact)(createArtifact({ workspaceIsolationId: "iso_guard" })), true);
    assertInvalid((0, persisted_document_guards_1.validateArtifact)({ ...createArtifact(), missionId: undefined }), /champ manquant.*missionId/i);
    assertInvalid((0, persisted_document_guards_1.validateArtifact)({ ...createArtifact(), sizeBytes: "12" }), /type incorrect.*sizeBytes/i);
    assertInvalid((0, persisted_document_guards_1.validateArtifact)({ ...createArtifact(), kind: "binary_blob" }), /discriminant invalide.*kind/i);
});
(0, node_test_1.default)("isApprovalRequest valide le contrat approval et rejette les tableaux mal typés", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalRequest)(createApprovalRequest()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalRequest)({ ...createApprovalRequest(), relatedArtifactIds: [] }), true);
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalRequest)({ ...createApprovalRequest(), title: undefined }), false);
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalRequest)({ ...createApprovalRequest(), guardrails: ["ok", 42] }), false);
});
(0, node_test_1.default)("isApprovalDecision valide les changements optionnels et les outcomes supportés", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalDecision)(createApprovalDecision()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalDecision)({ outcome: "deferred" }), true);
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalDecision)({ ...createApprovalDecision(), outcome: "cancelled" }), false);
    strict_1.default.equal((0, persisted_document_guards_1.isApprovalDecision)({
        ...createApprovalDecision(),
        ticketCapabilityChange: { previous: ["cap.old"], next: [42] },
    }), false);
});
(0, node_test_1.default)("isCapabilityInvocationDetails valide provider, booleens et tableaux string[]", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isCapabilityInvocationDetails)(createCapabilityInvocationDetails()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isCapabilityInvocationDetails)({ ...createCapabilityInvocationDetails(), provider: "mcp" }), true);
    strict_1.default.equal((0, persisted_document_guards_1.isCapabilityInvocationDetails)({ ...createCapabilityInvocationDetails(), provider: "remote" }), false);
    strict_1.default.equal((0, persisted_document_guards_1.isCapabilityInvocationDetails)({ ...createCapabilityInvocationDetails(), permissions: ["docs.read", 42] }), false);
});
(0, node_test_1.default)("isWorkspaceIsolationMetadata valide la structure d'isolation de workspace", () => {
    strict_1.default.equal((0, persisted_document_guards_1.isWorkspaceIsolationMetadata)(createWorkspaceIsolationMetadata()), true);
    strict_1.default.equal((0, persisted_document_guards_1.isWorkspaceIsolationMetadata)({ ...createWorkspaceIsolationMetadata(), retained: "yes" }), false);
    strict_1.default.equal((0, persisted_document_guards_1.isWorkspaceIsolationMetadata)({ ...createWorkspaceIsolationMetadata(), workspacePath: undefined }), false);
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
