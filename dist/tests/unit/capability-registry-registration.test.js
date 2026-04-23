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
const invoke_registered_capability_1 = require("../../packages/capability-registry/src/registry/invoke-registered-capability");
const register_capability_1 = require("../../packages/capability-registry/src/registry/register-capability");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const file_capability_registry_repository_1 = require("../../packages/storage/src/repositories/file-capability-registry-repository");
function getFixtureRoot() {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
}
function getFixturePath(fileName) {
    return node_path_1.default.join(getFixtureRoot(), fileName);
}
function createMission(overrides = {}) {
    return {
        id: "mission_capability",
        title: "Mission capability",
        objective: "Verifier le registre capability",
        status: "running",
        successCriteria: ["Le registre reste deterministe"],
        policyProfileId: "policy_profile_local",
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: [],
        },
        ticketIds: ["ticket_capability"],
        artifactIds: [],
        eventIds: ["event_mission_created"],
        resumeCursor: "event_mission_created",
        createdAt: "2026-04-12T10:00:00.000Z",
        updatedAt: "2026-04-12T10:00:00.000Z",
        ...overrides,
    };
}
function createTicket(overrides = {}) {
    return {
        id: "ticket_capability",
        missionId: "mission_capability",
        kind: "implement",
        goal: "Utiliser une capability locale de facon controlee",
        status: "claimed",
        owner: "agent_capability",
        dependsOn: [],
        successCriteria: ["La capability est resolue"],
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: ["pack.audit"],
        workspaceIsolationId: "iso_capability",
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: ["event_ticket_created"],
        createdAt: "2026-04-12T10:00:05.000Z",
        updatedAt: "2026-04-12T10:00:05.000Z",
        ...overrides,
    };
}
(0, node_test_1.default)("registerCapability persiste une capability locale valide de facon idempotente", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-register-unit-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    const firstResult = await (0, register_capability_1.registerCapability)({
        filePath: getFixturePath("valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-12T10:10:00.000Z",
    });
    const storedCapability = await repository.findByCapabilityId("shell.exec");
    const secondResult = await (0, register_capability_1.registerCapability)({
        filePath: getFixturePath("valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-12T10:10:01.000Z",
    });
    strict_1.default.equal(firstResult.status, "registered");
    strict_1.default.equal(secondResult.status, "unchanged");
    strict_1.default.ok(storedCapability);
    strict_1.default.equal(storedCapability.capabilityId, "shell.exec");
    strict_1.default.equal(storedCapability.registrationId, "ext.capability.shell.exec.local");
    strict_1.default.equal(storedCapability.provider, "local");
    strict_1.default.equal(storedCapability.approvalSensitive, true);
    strict_1.default.deepEqual(storedCapability.permissions, ["shell.exec", "fs.read"]);
    strict_1.default.deepEqual(storedCapability.constraints, [
        "local_only",
        "approval_sensitive",
        "workspace_scoped",
    ]);
    strict_1.default.equal(storedCapability.localRefs.entrypoint, node_path_1.default.join(getFixtureRoot(), "capabilities", "shell-exec.ts"));
    strict_1.default.equal(storedCapability.mcp, null);
    strict_1.default.equal((await repository.list()).length, 1);
});
(0, node_test_1.default)("registerCapability persiste une capability MCP sans recopier de configuration vendor et rejette les seams hors scope", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-register-mcp-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    const result = await (0, register_capability_1.registerCapability)({
        filePath: getFixturePath("valid-capability-mcp.json"),
        repository,
        registeredAt: "2026-04-12T10:20:00.000Z",
    });
    strict_1.default.equal(result.status, "registered");
    strict_1.default.equal(result.registeredCapability.capabilityId, "docs.search");
    strict_1.default.equal(result.registeredCapability.provider, "mcp");
    strict_1.default.deepEqual(result.registeredCapability.mcp, {
        serverName: "corp-mcp",
        toolName: "search_local_docs",
    });
    strict_1.default.equal(result.registeredCapability.localRefs.entrypoint, undefined);
    strict_1.default.doesNotMatch(JSON.stringify(result.registeredCapability), /enabled_tools|disabled_tools|tool_timeout_sec|token|secret|apiKey/i);
    await strict_1.default.rejects(() => (0, register_capability_1.registerCapability)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-12T10:20:01.000Z",
    }), /Seam non supporte.*capability/i);
});
(0, node_test_1.default)("registerCapability rejette une capability MCP sans binding explicite et ne persiste rien", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-mcp-invalid-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const workspaceRoot = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "invalid-capability-mcp-missing-binding.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "capability",
        id: "ext.capability.docs.search.invalid",
        displayName: "Recherche docs MCP invalide",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Binding MCP volontairement incomplet.",
            owner: "core-platform",
            tags: ["capability", "mcp"],
        },
        localRefs: {
            rootDir: ".",
            references: ["./docs/capability-mcp.md"],
            scripts: [],
        },
        capability: {
            capabilityId: "docs.search",
            provider: "mcp",
            approvalSensitive: false,
            requiredEnvNames: [],
            mcpServerName: "   ",
        },
    }, null, 2)}\n`, "utf8");
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(workspaceRoot);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    await strict_1.default.rejects(() => (0, register_capability_1.registerCapability)({
        filePath: node_path_1.default.join(copiedFixturesDir, "invalid-capability-mcp-missing-binding.json"),
        repository,
        registeredAt: "2026-04-13T18:00:00.000Z",
    }), /Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP\./i);
    strict_1.default.equal((await repository.list()).length, 0);
});
(0, node_test_1.default)("registerCapability rejette une collision ambigue sur un meme capabilityId", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-collision-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const workspaceRoot = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "valid-capability-local-conflict.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "capability",
        id: "ext.capability.shell.exec.alt",
        displayName: "Shell exec local alt",
        version: "0.1.0",
        permissions: ["shell.exec"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Variation de test pour collision.",
            owner: "core-platform",
            tags: ["capability", "local"],
        },
        localRefs: {
            rootDir: ".",
            entrypoint: "./capabilities/shell-exec.ts",
            references: ["./docs/capability-local.md"],
            scripts: [],
        },
        capability: {
            capabilityId: "shell.exec",
            provider: "local",
            approvalSensitive: false,
            requiredEnvNames: [],
        },
    }, null, 2)}\n`, "utf8");
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(workspaceRoot);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    await (0, register_capability_1.registerCapability)({
        filePath: node_path_1.default.join(copiedFixturesDir, "valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-12T10:30:00.000Z",
    });
    await strict_1.default.rejects(() => (0, register_capability_1.registerCapability)({
        filePath: node_path_1.default.join(copiedFixturesDir, "valid-capability-local-conflict.json"),
        repository,
        registeredAt: "2026-04-12T10:30:01.000Z",
    }), /Collision ambigue.*shell\.exec/i);
});
(0, node_test_1.default)("registerCapability detecte une collision de casse pour un capabilityId deja present", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-case-collision-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const workspaceRoot = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "valid-capability-local-case-collision.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "capability",
        id: "ext.capability.Shell.Exec.case",
        displayName: "Shell Exec Case Collision",
        version: "0.1.0",
        permissions: ["shell.exec", "fs.read"],
        constraints: ["local_only", "approval_sensitive", "workspace_scoped"],
        metadata: {
            description: "Variation de casse pour collision deterministe.",
            owner: "core-platform",
            tags: ["capability", "case-collision"],
        },
        localRefs: {
            rootDir: ".",
            entrypoint: "./capabilities/shell-exec.ts",
            references: ["./docs/capability-local.md"],
            scripts: [],
        },
        capability: {
            capabilityId: "Shell.Exec",
            provider: "local",
            approvalSensitive: true,
            requiredEnvNames: [],
        },
    }, null, 2)}\n`, "utf8");
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(workspaceRoot);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    await (0, register_capability_1.registerCapability)({
        filePath: node_path_1.default.join(copiedFixturesDir, "valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-20T23:50:00.000Z",
    });
    await strict_1.default.rejects(() => (0, register_capability_1.registerCapability)({
        filePath: node_path_1.default.join(copiedFixturesDir, "valid-capability-local-case-collision.json"),
        repository,
        registeredAt: "2026-04-20T23:50:01.000Z",
    }), /collision de casse detectee.*Shell\.Exec.*shell\.exec/i);
});
(0, node_test_1.default)("invokeRegisteredCapability produit un evenement auditable et rejette les usages non autorises", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-invoke-unit-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    await (0, register_capability_1.registerCapability)({
        filePath: getFixturePath("valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-12T10:40:00.000Z",
    });
    const mission = createMission();
    const ticket = createTicket();
    const invocation = await (0, invoke_registered_capability_1.invokeRegisteredCapability)({
        repository,
        mission,
        ticket,
        capabilityId: "shell.exec",
        attemptId: "attempt_capability",
        eventId: "event_capability_invoked",
        occurredAt: "2026-04-12T10:40:05.000Z",
        actor: "system",
        source: "ticket-runtime",
        trigger: "ticket_run_preflight",
    });
    strict_1.default.equal(invocation.kind, "invoked");
    strict_1.default.equal(invocation.event.type, "capability.invoked");
    strict_1.default.equal(invocation.event.attemptId, "attempt_capability");
    strict_1.default.deepEqual(invocation.guardrails, [
        "approval_sensitive: shell.exec",
        "policy_profile: policy_profile_local",
        "allowed_capabilities: shell.exec",
        "skill_packs: pack.audit",
    ]);
    strict_1.default.deepEqual(invocation.event.payload.capability, {
        capabilityId: "shell.exec",
        registrationId: "ext.capability.shell.exec.local",
        provider: "local",
        approvalSensitive: true,
        permissions: ["shell.exec", "fs.read"],
        constraints: ["local_only", "approval_sensitive", "workspace_scoped"],
        requiredEnvNames: [],
    });
    await strict_1.default.rejects(() => (0, invoke_registered_capability_1.invokeRegisteredCapability)({
        repository,
        mission,
        ticket: createTicket({ allowedCapabilities: [] }),
        capabilityId: "shell.exec",
        attemptId: "attempt_capability",
        eventId: "event_denied_capability",
        occurredAt: "2026-04-12T10:40:07.000Z",
        actor: "system",
        source: "ticket-runtime",
        trigger: "ticket_run_preflight",
    }), /n'est pas autorisee pour le ticket/i);
});
(0, node_test_1.default)("invokeRegisteredCapability emet missing_env sans bloquer et sans approval_sensitive quand la capability ne le demande pas", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-env-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const workspaceRoot = node_path_1.default.join(tempDir, "workspace");
    const missingEnvName = "CORP_CAPABILITY_MISSING_ENV_TEST";
    const originalEnvValue = process.env[missingEnvName];
    t.after(async () => {
        if (originalEnvValue === undefined) {
            delete process.env[missingEnvName];
        }
        else {
            process.env[missingEnvName] = originalEnvValue;
        }
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    delete process.env[missingEnvName];
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "valid-capability-local-env.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "capability",
        id: "ext.capability.shell.exec.env",
        displayName: "Shell exec env",
        version: "0.1.0",
        permissions: ["shell.exec"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Capability avec env requis.",
            owner: "core-platform",
            tags: ["capability", "local"],
        },
        localRefs: {
            rootDir: ".",
            entrypoint: "./capabilities/shell-exec.ts",
            references: ["./docs/capability-local.md"],
            scripts: [],
        },
        capability: {
            capabilityId: "shell.exec.env",
            provider: "local",
            approvalSensitive: false,
            requiredEnvNames: [missingEnvName],
        },
    }, null, 2)}\n`, "utf8");
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(workspaceRoot);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    await (0, register_capability_1.registerCapability)({
        filePath: node_path_1.default.join(copiedFixturesDir, "valid-capability-local-env.json"),
        repository,
        registeredAt: "2026-04-13T18:10:00.000Z",
    });
    const mission = createMission();
    const ticket = createTicket({
        allowedCapabilities: ["shell.exec.env"],
        skillPackRefs: [],
    });
    const invocation = await (0, invoke_registered_capability_1.invokeRegisteredCapability)({
        repository,
        mission,
        ticket,
        capabilityId: "shell.exec.env",
        attemptId: "attempt_capability_env",
        eventId: "event_capability_missing_env",
        occurredAt: "2026-04-13T18:10:05.000Z",
        actor: "system",
        source: "ticket-runtime",
        trigger: "ticket_run_preflight",
    });
    strict_1.default.deepEqual(invocation.guardrails, [
        `missing_env: ${missingEnvName}`,
        "policy_profile: policy_profile_local",
        "allowed_capabilities: shell.exec.env",
    ]);
    strict_1.default.deepEqual(invocation.event.payload.capability, {
        capabilityId: "shell.exec.env",
        registrationId: "ext.capability.shell.exec.env",
        provider: "local",
        approvalSensitive: false,
        permissions: ["shell.exec"],
        constraints: ["local_only", "workspace_scoped"],
        requiredEnvNames: [missingEnvName],
    });
    strict_1.default.ok(invocation.guardrails.every((guardrail) => !guardrail.startsWith("approval_sensitive:")));
});
(0, node_test_1.default)("resolveCapabilityStoragePaths rejette les capabilityId pathologiques", () => {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-storage-layout"));
    for (const invalidCapabilityId of [".", "..", "\0foo", "", "a".repeat(300)]) {
        strict_1.default.throws(() => (0, workspace_layout_1.resolveCapabilityStoragePaths)(layout, invalidCapabilityId), /Identifiant de capability invalide/i);
    }
});
(0, node_test_1.default)("FileCapabilityRegistryRepository signale un fichier corrompu pour une capability", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-corrupted-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    const capabilityPaths = (0, workspace_layout_1.resolveCapabilityStoragePaths)(layout, "shell.exec");
    await (0, promises_1.mkdir)(capabilityPaths.capabilityDir, { recursive: true });
    await (0, promises_1.writeFile)(capabilityPaths.capabilityPath, "{invalid-json", "utf8");
    await strict_1.default.rejects(() => repository.findByCapabilityId("shell.exec"), /fichier de registre corrompu pour la capability `shell\.exec`/i);
});
(0, node_test_1.default)("FileCapabilityRegistryRepository n'autorise qu'un seul enregistrement concurrent pour un meme capabilityId", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-concurrent-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    const baseCapability = {
        capabilityId: "shell.exec",
        registrationId: "ext.capability.shell.exec.concurrent-a",
        schemaVersion: "corp.extension.v1",
        provider: "local",
        displayName: "Shell exec concurrent A",
        version: "0.1.0",
        permissions: ["shell.exec"],
        constraints: ["local_only", "workspace_scoped"],
        approvalSensitive: false,
        requiredEnvNames: [],
        metadata: {
            description: "Test de collision concurrente.",
            owner: "core-platform",
            tags: ["capability", "local"],
        },
        localRefs: {
            rootDir,
            entrypoint: node_path_1.default.join(rootDir, "capability-a.ts"),
            references: [],
            scripts: [],
        },
        mcp: null,
        registeredAt: "2026-04-13T18:20:00.000Z",
        sourceManifestPath: node_path_1.default.join(rootDir, "capability-a.json"),
    };
    const competingCapability = {
        ...baseCapability,
        registrationId: "ext.capability.shell.exec.concurrent-b",
        displayName: "Shell exec concurrent B",
        sourceManifestPath: node_path_1.default.join(rootDir, "capability-b.json"),
    };
    const originalFindByCapabilityId = repository.findByCapabilityId.bind(repository);
    let waitingReaders = 0;
    let releaseReaders;
    const barrier = new Promise((resolve) => {
        releaseReaders = resolve;
    });
    repository.findByCapabilityId = async (capabilityId) => {
        waitingReaders += 1;
        if (waitingReaders === 2) {
            releaseReaders();
        }
        await barrier;
        return await originalFindByCapabilityId(capabilityId);
    };
    const saveResults = await Promise.allSettled([
        repository.save(baseCapability),
        repository.save(competingCapability),
    ]);
    const successfulSaves = saveResults.filter((result) => result.status === "fulfilled");
    const failedSaves = saveResults.filter((result) => result.status === "rejected");
    const storedCapability = await originalFindByCapabilityId("shell.exec");
    strict_1.default.equal(successfulSaves.length, 1);
    strict_1.default.equal(failedSaves.length, 1);
    strict_1.default.match(String(failedSaves[0]?.reason), /Enregistrement concurrent detecte pour la capability `shell\.exec`/i);
    strict_1.default.ok(storedCapability);
    strict_1.default.match(storedCapability.registrationId, /ext\.capability\.shell\.exec\.concurrent-[ab]/i);
});
