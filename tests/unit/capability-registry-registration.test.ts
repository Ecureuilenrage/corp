import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { RegisteredCapability } from "../../packages/contracts/src/extension/registered-capability";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { invokeRegisteredCapability } from "../../packages/capability-registry/src/registry/invoke-registered-capability";
import { registerCapability } from "../../packages/capability-registry/src/registry/register-capability";
import {
  ensureWorkspaceLayout,
  resolveCapabilityStoragePaths,
  resolveWorkspaceLayout,
} from "../../packages/storage/src/fs-layout/workspace-layout";
import { createFileCapabilityRegistryRepository } from "../../packages/storage/src/repositories/file-capability-registry-repository";

function getFixtureRoot(): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions");
}

function getFixturePath(fileName: string): string {
  return path.join(getFixtureRoot(), fileName);
}

function createMission(overrides: Partial<Mission> = {}): Mission {
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

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
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

test("registerCapability persiste une capability locale valide de facon idempotente", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-register-unit-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileCapabilityRegistryRepository(layout);

  const firstResult = await registerCapability({
    filePath: getFixturePath("valid-capability-local.json"),
    repository,
    registeredAt: "2026-04-12T10:10:00.000Z",
  });
  const storedCapability = await repository.findByCapabilityId("shell.exec");
  const secondResult = await registerCapability({
    filePath: getFixturePath("valid-capability-local.json"),
    repository,
    registeredAt: "2026-04-12T10:10:01.000Z",
  });

  assert.equal(firstResult.status, "registered");
  assert.equal(secondResult.status, "unchanged");
  assert.ok(storedCapability);
  assert.equal(storedCapability.capabilityId, "shell.exec");
  assert.equal(storedCapability.registrationId, "ext.capability.shell.exec.local");
  assert.equal(storedCapability.provider, "local");
  assert.equal(storedCapability.approvalSensitive, true);
  assert.deepEqual(storedCapability.permissions, ["shell.exec", "fs.read"]);
  assert.deepEqual(storedCapability.constraints, [
    "local_only",
    "approval_sensitive",
    "workspace_scoped",
  ]);
  assert.equal(
    storedCapability.localRefs.entrypoint,
    path.join(getFixtureRoot(), "capabilities", "shell-exec.ts"),
  );
  assert.equal(storedCapability.mcp, null);
  assert.equal((await repository.list()).length, 1);
});

test("registerCapability persiste une capability MCP sans recopier de configuration vendor et rejette les seams hors scope", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-register-mcp-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileCapabilityRegistryRepository(layout);

  const result = await registerCapability({
    filePath: getFixturePath("valid-capability-mcp.json"),
    repository,
    registeredAt: "2026-04-12T10:20:00.000Z",
  });

  assert.equal(result.status, "registered");
  assert.equal(result.registeredCapability.capabilityId, "docs.search");
  assert.equal(result.registeredCapability.provider, "mcp");
  assert.deepEqual(result.registeredCapability.mcp, {
    serverName: "corp-mcp",
    toolName: "search_local_docs",
  });
  assert.equal(result.registeredCapability.localRefs.entrypoint, undefined);
  assert.doesNotMatch(
    JSON.stringify(result.registeredCapability),
    /enabled_tools|disabled_tools|tool_timeout_sec|token|secret|apiKey/i,
  );

  await assert.rejects(
    () =>
      registerCapability({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-12T10:20:01.000Z",
      }),
    /Seam non supporte.*capability/i,
  );
});

test("registerCapability rejette une capability MCP sans binding explicite et ne persiste rien", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-capability-mcp-invalid-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const workspaceRoot = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  await writeFile(
    path.join(copiedFixturesDir, "invalid-capability-mcp-missing-binding.json"),
    `${JSON.stringify({
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
    }, null, 2)}\n`,
    "utf8",
  );

  const layout = await ensureWorkspaceLayout(workspaceRoot);
  const repository = createFileCapabilityRegistryRepository(layout);

  await assert.rejects(
    () =>
      registerCapability({
        filePath: path.join(copiedFixturesDir, "invalid-capability-mcp-missing-binding.json"),
        repository,
        registeredAt: "2026-04-13T18:00:00.000Z",
      }),
    /Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP\./i,
  );
  assert.equal((await repository.list()).length, 0);
});

test("registerCapability rejette une collision ambigue sur un meme capabilityId", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-capability-collision-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const workspaceRoot = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  await writeFile(
    path.join(copiedFixturesDir, "valid-capability-local-conflict.json"),
    `${JSON.stringify({
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
    }, null, 2)}\n`,
    "utf8",
  );

  const layout = await ensureWorkspaceLayout(workspaceRoot);
  const repository = createFileCapabilityRegistryRepository(layout);

  await registerCapability({
    filePath: path.join(copiedFixturesDir, "valid-capability-local.json"),
    repository,
    registeredAt: "2026-04-12T10:30:00.000Z",
  });

  await assert.rejects(
    () =>
      registerCapability({
        filePath: path.join(copiedFixturesDir, "valid-capability-local-conflict.json"),
        repository,
        registeredAt: "2026-04-12T10:30:01.000Z",
      }),
    /Collision ambigue.*shell\.exec/i,
  );
});

test("registerCapability detecte une collision de casse pour un capabilityId deja present", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-capability-case-collision-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const workspaceRoot = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  await writeFile(
    path.join(copiedFixturesDir, "valid-capability-local-case-collision.json"),
    `${JSON.stringify({
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
    }, null, 2)}\n`,
    "utf8",
  );

  const layout = await ensureWorkspaceLayout(workspaceRoot);
  const repository = createFileCapabilityRegistryRepository(layout);

  await registerCapability({
    filePath: path.join(copiedFixturesDir, "valid-capability-local.json"),
    repository,
    registeredAt: "2026-04-20T23:50:00.000Z",
  });

  await assert.rejects(
    () =>
      registerCapability({
        filePath: path.join(copiedFixturesDir, "valid-capability-local-case-collision.json"),
        repository,
        registeredAt: "2026-04-20T23:50:01.000Z",
      }),
    /collision de casse detectee.*Shell\.Exec.*shell\.exec/i,
  );
});

test("invokeRegisteredCapability produit un evenement auditable et rejette les usages non autorises", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-invoke-unit-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileCapabilityRegistryRepository(layout);

  await registerCapability({
    filePath: getFixturePath("valid-capability-local.json"),
    repository,
    registeredAt: "2026-04-12T10:40:00.000Z",
  });

  const mission = createMission();
  const ticket = createTicket();
  const invocation = await invokeRegisteredCapability({
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

  assert.equal(invocation.kind, "invoked");
  assert.equal(invocation.event.type, "capability.invoked");
  assert.equal(invocation.event.attemptId, "attempt_capability");
  assert.deepEqual(invocation.guardrails, [
    "approval_sensitive: shell.exec",
    "policy_profile: policy_profile_local",
    "allowed_capabilities: shell.exec",
    "skill_packs: pack.audit",
  ]);
  assert.deepEqual(invocation.event.payload.capability, {
    capabilityId: "shell.exec",
    registrationId: "ext.capability.shell.exec.local",
    provider: "local",
    approvalSensitive: true,
    permissions: ["shell.exec", "fs.read"],
    constraints: ["local_only", "approval_sensitive", "workspace_scoped"],
    requiredEnvNames: [],
  });

  await assert.rejects(
    () =>
      invokeRegisteredCapability({
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
      }),
    /n'est pas autorisee pour le ticket/i,
  );
});

test("invokeRegisteredCapability emet missing_env sans bloquer et sans approval_sensitive quand la capability ne le demande pas", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-capability-env-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const workspaceRoot = path.join(tempDir, "workspace");
  const missingEnvName = "CORP_CAPABILITY_MISSING_ENV_TEST";
  const originalEnvValue = process.env[missingEnvName];

  t.after(async () => {
    if (originalEnvValue === undefined) {
      delete process.env[missingEnvName];
    } else {
      process.env[missingEnvName] = originalEnvValue;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  delete process.env[missingEnvName];
  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  await writeFile(
    path.join(copiedFixturesDir, "valid-capability-local-env.json"),
    `${JSON.stringify({
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
    }, null, 2)}\n`,
    "utf8",
  );

  const layout = await ensureWorkspaceLayout(workspaceRoot);
  const repository = createFileCapabilityRegistryRepository(layout);

  await registerCapability({
    filePath: path.join(copiedFixturesDir, "valid-capability-local-env.json"),
    repository,
    registeredAt: "2026-04-13T18:10:00.000Z",
  });

  const mission = createMission();
  const ticket = createTicket({
    allowedCapabilities: ["shell.exec.env"],
    skillPackRefs: [],
  });
  const invocation = await invokeRegisteredCapability({
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

  assert.deepEqual(invocation.guardrails, [
    `missing_env: ${missingEnvName}`,
    "policy_profile: policy_profile_local",
    "allowed_capabilities: shell.exec.env",
  ]);
  assert.deepEqual(invocation.event.payload.capability, {
    capabilityId: "shell.exec.env",
    registrationId: "ext.capability.shell.exec.env",
    provider: "local",
    approvalSensitive: false,
    permissions: ["shell.exec"],
    constraints: ["local_only", "workspace_scoped"],
    requiredEnvNames: [missingEnvName],
  });
  assert.ok(
    invocation.guardrails.every((guardrail) => !guardrail.startsWith("approval_sensitive:")),
  );
});

test("resolveCapabilityStoragePaths rejette les capabilityId pathologiques", () => {
  const layout = resolveWorkspaceLayout(path.join(tmpdir(), "corp-capability-storage-layout"));

  for (const invalidCapabilityId of [".", "..", "\0foo", "", "a".repeat(300)]) {
    assert.throws(
      () => resolveCapabilityStoragePaths(layout, invalidCapabilityId),
      /Identifiant de capability invalide/i,
    );
  }
});

test("FileCapabilityRegistryRepository signale un fichier corrompu pour une capability", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-corrupted-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileCapabilityRegistryRepository(layout);
  const capabilityPaths = resolveCapabilityStoragePaths(layout, "shell.exec");

  await mkdir(capabilityPaths.capabilityDir, { recursive: true });
  await writeFile(capabilityPaths.capabilityPath, "{invalid-json", "utf8");

  await assert.rejects(
    () => repository.findByCapabilityId("shell.exec"),
    /fichier de registre corrompu pour la capability `shell\.exec`/i,
  );
});

test("FileCapabilityRegistryRepository n'autorise qu'un seul enregistrement concurrent pour un meme capabilityId", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-concurrent-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileCapabilityRegistryRepository(layout);
  const baseCapability: RegisteredCapability = {
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
      entrypoint: path.join(rootDir, "capability-a.ts"),
      references: [],
      scripts: [],
    },
    mcp: null,
    registeredAt: "2026-04-13T18:20:00.000Z",
    sourceManifestPath: path.join(rootDir, "capability-a.json"),
  };
  const competingCapability: RegisteredCapability = {
    ...baseCapability,
    registrationId: "ext.capability.shell.exec.concurrent-b",
    displayName: "Shell exec concurrent B",
    sourceManifestPath: path.join(rootDir, "capability-b.json"),
  };
  const originalFindByCapabilityId = repository.findByCapabilityId.bind(repository);
  let waitingReaders = 0;
  let releaseReaders!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseReaders = resolve;
  });

  repository.findByCapabilityId = async (capabilityId: string) => {
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

  const successfulSaves = saveResults.filter(
    (
      result,
    ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.save>>> =>
      result.status === "fulfilled",
  );
  const failedSaves = saveResults.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  const storedCapability = await originalFindByCapabilityId("shell.exec");

  assert.equal(successfulSaves.length, 1);
  assert.equal(failedSaves.length, 1);
  assert.match(
    String(failedSaves[0]?.reason),
    /Enregistrement concurrent detecte pour la capability `shell\.exec`/i,
  );
  assert.ok(storedCapability);
  assert.match(
    storedCapability.registrationId,
    /ext\.capability\.shell\.exec\.concurrent-[ab]/i,
  );
});
