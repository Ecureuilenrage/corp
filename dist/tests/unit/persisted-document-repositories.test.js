"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = require("node:os");
const node_test_1 = __importDefault(require("node:test"));
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const persisted_document_errors_1 = require("../../packages/storage/src/repositories/persisted-document-errors");
const file_artifact_repository_1 = require("../../packages/storage/src/repositories/file-artifact-repository");
const file_capability_registry_repository_1 = require("../../packages/storage/src/repositories/file-capability-registry-repository");
const file_execution_attempt_repository_1 = require("../../packages/storage/src/repositories/file-execution-attempt-repository");
const file_mission_repository_1 = require("../../packages/storage/src/repositories/file-mission-repository");
const file_skill_pack_registry_repository_1 = require("../../packages/storage/src/repositories/file-skill-pack-registry-repository");
const file_ticket_repository_1 = require("../../packages/storage/src/repositories/file-ticket-repository");
const missionId = "mission_defensive_read";
const ticketId = "ticket_defensive_read";
const attemptId = "attempt_defensive_read";
const artifactId = "artifact_defensive_read";
const capabilityId = "cap.defensive";
const packRef = "pack.defensive";
function createCases() {
    return [
        {
            entityLabel: "Mission",
            documentId: missionId,
            filePath: (layout) => node_path_1.default.join(layout.missionsDir, missionId, "mission.json"),
            read: (layout) => (0, file_mission_repository_1.createFileMissionRepository)(layout).findById(missionId),
            invalidDocument: { ...createMission(), status: "closed" },
        },
        {
            entityLabel: "Ticket",
            documentId: ticketId,
            filePath: (layout) => node_path_1.default.join(layout.missionsDir, missionId, "tickets", ticketId, "ticket.json"),
            read: (layout) => (0, file_ticket_repository_1.createFileTicketRepository)(layout).findById(missionId, ticketId),
            invalidDocument: { ...createTicket(), kind: "fix" },
        },
        {
            entityLabel: "ExecutionAttempt",
            documentId: attemptId,
            filePath: (layout) => node_path_1.default.join(layout.missionsDir, missionId, "tickets", ticketId, "attempts", attemptId, "attempt.json"),
            read: (layout) => (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout).findById(missionId, ticketId, attemptId),
            invalidDocument: { ...createAttempt(), status: "stalled" },
        },
        {
            entityLabel: "Artifact",
            documentId: artifactId,
            filePath: (layout) => node_path_1.default.join(layout.missionsDir, missionId, "tickets", ticketId, "artifacts", artifactId, "artifact.json"),
            read: (layout) => (0, file_artifact_repository_1.createFileArtifactRepository)(layout).findById(missionId, artifactId),
            invalidDocument: { ...createArtifact(), kind: "binary_blob" },
        },
        {
            entityLabel: "RegisteredCapability",
            documentId: capabilityId,
            filePath: (layout) => node_path_1.default.join(layout.capabilitiesDir, capabilityId, "capability.json"),
            read: (layout) => (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout).findByCapabilityId(capabilityId),
            invalidDocument: { ...createCapability(), provider: "remote" },
        },
        {
            entityLabel: "RegisteredSkillPack",
            documentId: packRef,
            filePath: (layout) => node_path_1.default.join(layout.skillPacksDir, packRef, "skill-pack.json"),
            read: (layout) => (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout).findByPackRef(packRef),
            invalidDocument: { ...createSkillPack(), schemaVersion: "corp.extension.v2" },
        },
    ];
}
(0, node_test_1.default)("les repositories classent le JSON corrompu sans laisser fuir SyntaxError", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-defensive-json-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    for (const repositoryCase of createCases()) {
        const snapshotPath = repositoryCase.filePath(layout);
        await (0, promises_1.mkdir)(node_path_1.default.dirname(snapshotPath), { recursive: true });
        await (0, promises_1.writeFile)(snapshotPath, "{json invalide\n", "utf8");
        await strict_1.default.rejects(() => repositoryCase.read(layout), (error) => {
            strict_1.default.ok(error instanceof persisted_document_errors_1.CorruptedPersistedDocumentError);
            strict_1.default.equal(error.code, "json_corrompu");
            strict_1.default.equal(error.filePath, snapshotPath);
            strict_1.default.equal(error.documentId, repositoryCase.documentId);
            strict_1.default.equal(error.entityLabel, repositoryCase.entityLabel);
            strict_1.default.match(error.message, repositoryCase.entityLabel.startsWith("Registered")
                ? /fichier de registre corrompu/i
                : new RegExp(repositoryCase.entityLabel, "i"));
            strict_1.default.doesNotMatch(error.message, /SyntaxError/);
            return true;
        });
    }
});
(0, node_test_1.default)("les repositories rejettent les schemas valides JSON mais invalides runtime", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-defensive-schema-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    for (const repositoryCase of createCases()) {
        const snapshotPath = repositoryCase.filePath(layout);
        await (0, promises_1.mkdir)(node_path_1.default.dirname(snapshotPath), { recursive: true });
        await (0, promises_1.writeFile)(snapshotPath, `${JSON.stringify(repositoryCase.invalidDocument, null, 2)}\n`, "utf8");
        await strict_1.default.rejects(() => repositoryCase.read(layout), (error) => {
            strict_1.default.ok(error instanceof persisted_document_errors_1.InvalidPersistedDocumentError);
            strict_1.default.equal(error.code, "schema_invalide");
            strict_1.default.equal(error.filePath, snapshotPath);
            strict_1.default.equal(error.documentId, repositoryCase.documentId);
            strict_1.default.match(error.message, new RegExp(repositoryCase.entityLabel));
            strict_1.default.match(error.message, /statut inconnu|discriminant invalide/i);
            return true;
        });
    }
});
(0, node_test_1.default)("FileSkillPackRegistryRepository.list expose une entree corrompue au lieu de retourner une liste partielle", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-defensive-skill-pack-list-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const validSkillPack = createSkillPack({ packRef: "pack.valid" });
    const corruptPackRef = "pack.corrupt";
    const corruptPath = node_path_1.default.join(layout.skillPacksDir, corruptPackRef, "skill-pack.json");
    await repository.save(validSkillPack);
    await (0, promises_1.mkdir)(node_path_1.default.dirname(corruptPath), { recursive: true });
    await (0, promises_1.writeFile)(corruptPath, "{json invalide\n", "utf8");
    await strict_1.default.rejects(() => repository.list(), (error) => {
        strict_1.default.ok(error instanceof persisted_document_errors_1.CorruptedPersistedDocumentError);
        strict_1.default.equal(error.code, "json_corrompu");
        strict_1.default.equal(error.documentId, corruptPackRef);
        strict_1.default.equal(error.filePath, corruptPath);
        strict_1.default.match(error.message, /pack\.corrupt/);
        return true;
    });
});
function createMission(overrides = {}) {
    return {
        id: missionId,
        title: "Mission defensive read",
        objective: "Valider les repositories",
        status: "ready",
        successCriteria: ["Les erreurs sont classees"],
        policyProfileId: "policy_profile_local",
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: [],
        },
        ticketIds: [ticketId],
        artifactIds: [artifactId],
        eventIds: ["event_defensive"],
        resumeCursor: "event_defensive",
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createTicket(overrides = {}) {
    return {
        id: ticketId,
        missionId,
        kind: "implement",
        goal: "Tester la lecture defensive",
        status: "todo",
        owner: "agent_defensive",
        dependsOn: [],
        successCriteria: ["Le ticket est valide"],
        allowedCapabilities: [],
        skillPackRefs: [],
        workspaceIsolationId: null,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [artifactId],
        eventIds: ["event_defensive"],
        createdAt: "2026-04-15T10:00:00.000Z",
        updatedAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createAttempt(overrides = {}) {
    return {
        id: attemptId,
        ticketId,
        adapter: "codex_responses",
        status: "running",
        workspaceIsolationId: "iso_defensive",
        backgroundRequested: false,
        adapterState: {},
        startedAt: "2026-04-15T10:00:00.000Z",
        endedAt: null,
        ...overrides,
    };
}
function createArtifact(overrides = {}) {
    return {
        id: artifactId,
        missionId,
        ticketId,
        producingEventId: "event_defensive",
        attemptId: null,
        workspaceIsolationId: null,
        kind: "report_text",
        title: "Rapport defensive",
        createdAt: "2026-04-15T10:00:00.000Z",
        ...overrides,
    };
}
function createCapability(overrides = {}) {
    return {
        capabilityId,
        registrationId: "ext.cap.defensive",
        schemaVersion: "corp.extension.v1",
        provider: "local",
        displayName: "Capability defensive",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only"],
        approvalSensitive: false,
        requiredEnvNames: [],
        metadata: {
            description: "Capability defensive.",
            owner: "core-platform",
            tags: ["defensive"],
        },
        localRefs: {
            rootDir: "C:/tmp/cap.defensive",
            references: [],
            scripts: [],
        },
        mcp: null,
        registeredAt: "2026-04-15T10:00:00.000Z",
        sourceManifestPath: "C:/tmp/capability.json",
        ...overrides,
    };
}
function createSkillPack(overrides = {}) {
    return {
        packRef,
        registrationId: "ext.pack.defensive",
        schemaVersion: "corp.extension.v1",
        displayName: "Pack defensive",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only"],
        metadata: {
            description: "Pack defensive.",
            owner: "core-platform",
            tags: ["defensive"],
        },
        localRefs: {
            rootDir: "C:/tmp/pack.defensive",
            references: [],
            scripts: [],
        },
        registeredAt: "2026-04-15T10:00:00.000Z",
        sourceManifestPath: "C:/tmp/skill-pack.json",
        ...overrides,
    };
}
