import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Artifact } from "../../packages/contracts/src/artifact/artifact";
import type { RegisteredCapability } from "../../packages/contracts/src/extension/registered-capability";
import type { RegisteredSkillPack } from "../../packages/contracts/src/extension/registered-skill-pack";
import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { getStructuralValidationWarnings } from "../../packages/contracts/src/guards/persisted-document-guards";
import { ensureWorkspaceLayout, type WorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import {
  CorruptedPersistedDocumentError,
  InvalidPersistedDocumentError,
} from "../../packages/storage/src/repositories/persisted-document-errors";
import { createFileArtifactRepository } from "../../packages/storage/src/repositories/file-artifact-repository";
import { createFileCapabilityRegistryRepository } from "../../packages/storage/src/repositories/file-capability-registry-repository";
import { createFileExecutionAttemptRepository } from "../../packages/storage/src/repositories/file-execution-attempt-repository";
import { createFileMissionRepository } from "../../packages/storage/src/repositories/file-mission-repository";
import { createFileSkillPackRegistryRepository } from "../../packages/storage/src/repositories/file-skill-pack-registry-repository";
import { createFileTicketRepository } from "../../packages/storage/src/repositories/file-ticket-repository";

const missionId = "mission_defensive_read";
const ticketId = "ticket_defensive_read";
const attemptId = "attempt_defensive_read";
const artifactId = "artifact_defensive_read";
const capabilityId = "cap.defensive";
const packRef = "pack.defensive";

interface RepositoryCase {
  entityLabel: string;
  documentId: string;
  filePath(layout: WorkspaceLayout): string;
  read(layout: WorkspaceLayout): Promise<unknown>;
  invalidDocument: Record<string, unknown>;
}

function createCases(): RepositoryCase[] {
  return [
    {
      entityLabel: "Mission",
      documentId: missionId,
      filePath: (layout) => path.join(layout.missionsDir, missionId, "mission.json"),
      read: (layout) => createFileMissionRepository(layout).findById(missionId),
      invalidDocument: { ...createMission(), ticketIds: [42] },
    },
    {
      entityLabel: "Ticket",
      documentId: ticketId,
      filePath: (layout) => path.join(layout.missionsDir, missionId, "tickets", ticketId, "ticket.json"),
      read: (layout) => createFileTicketRepository(layout).findById(missionId, ticketId),
      invalidDocument: { ...createTicket(), kind: "fix" },
    },
    {
      entityLabel: "ExecutionAttempt",
      documentId: attemptId,
      filePath: (layout) => path.join(layout.missionsDir, missionId, "tickets", ticketId, "attempts", attemptId, "attempt.json"),
      read: (layout) => createFileExecutionAttemptRepository(layout).findById(missionId, ticketId, attemptId),
      invalidDocument: { ...createAttempt(), status: "stalled" },
    },
    {
      entityLabel: "Artifact",
      documentId: artifactId,
      filePath: (layout) => path.join(layout.missionsDir, missionId, "tickets", ticketId, "artifacts", artifactId, "artifact.json"),
      read: (layout) => createFileArtifactRepository(layout).findById(missionId, artifactId),
      invalidDocument: { ...createArtifact(), sizeBytes: "12" },
    },
    {
      entityLabel: "RegisteredCapability",
      documentId: capabilityId,
      filePath: (layout) => path.join(layout.capabilitiesDir, capabilityId, "capability.json"),
      read: (layout) => createFileCapabilityRegistryRepository(layout).findByCapabilityId(capabilityId),
      invalidDocument: { ...createCapability(), provider: "remote" },
    },
    {
      entityLabel: "RegisteredSkillPack",
      documentId: packRef,
      filePath: (layout) => path.join(layout.skillPacksDir, packRef, "skill-pack.json"),
      read: (layout) => createFileSkillPackRegistryRepository(layout).findByPackRef(packRef),
      invalidDocument: { ...createSkillPack(), schemaVersion: "corp.extension.v2" },
    },
  ];
}

test("les repositories classent le JSON corrompu sans laisser fuir SyntaxError", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-json-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);

  for (const repositoryCase of createCases()) {
    const snapshotPath = repositoryCase.filePath(layout);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, "{json invalide\n", "utf8");

    await assert.rejects(
      () => repositoryCase.read(layout),
      (error: unknown) => {
        assert.ok(error instanceof CorruptedPersistedDocumentError);
        assert.equal(error.code, "json_corrompu");
        assert.equal(error.filePath, snapshotPath);
        assert.equal(error.documentId, repositoryCase.documentId);
        assert.equal(error.entityLabel, repositoryCase.entityLabel);
        assert.match(
          error.message,
          repositoryCase.entityLabel.startsWith("Registered")
            ? /fichier de registre corrompu/i
            : new RegExp(repositoryCase.entityLabel, "i"),
        );
        assert.doesNotMatch(error.message, /SyntaxError/);
        return true;
      },
    );
  }
});

test("les repositories acceptent un document UTF-8 avec BOM sans le classer json_corrompu", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-json-bom-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const missionPath = path.join(layout.missionsDir, missionId, "mission.json");

  await mkdir(path.dirname(missionPath), { recursive: true });
  await writeFile(
    missionPath,
    `\uFEFF${JSON.stringify(createMission(), null, 2)}\n`,
    "utf8",
  );

  const mission = await createFileMissionRepository(layout).findById(missionId);

  assert.ok(mission);
  assert.equal(mission.id, missionId);
});

test("les repositories rejettent les schemas valides JSON mais invalides runtime", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-schema-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);

  for (const repositoryCase of createCases()) {
    const snapshotPath = repositoryCase.filePath(layout);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${JSON.stringify(repositoryCase.invalidDocument, null, 2)}\n`, "utf8");

    await assert.rejects(
      () => repositoryCase.read(layout),
      (error: unknown) => {
        assert.ok(error instanceof InvalidPersistedDocumentError);
        assert.equal(error.code, "schema_invalide");
        assert.equal(error.filePath, snapshotPath);
        assert.equal(error.documentId, repositoryCase.documentId);
        assert.match(error.message, new RegExp(repositoryCase.entityLabel));
        assert.match(error.message, /statut inconnu|discriminant invalide|type incorrect/i);
        return true;
      },
    );
  }
});

test("InvalidPersistedDocumentError preserve une cause exploitable", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-schema-cause-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const missionPath = path.join(layout.missionsDir, missionId, "mission.json");

  await mkdir(path.dirname(missionPath), { recursive: true });
  await writeFile(
    missionPath,
    `${JSON.stringify({ ...createMission(), title: undefined }, null, 2)}\n`,
    "utf8",
  );

  await assert.rejects(
    () => createFileMissionRepository(layout).findById(missionId),
    (error: unknown) => {
      assert.ok(error instanceof InvalidPersistedDocumentError);
      assert.ok(error.cause instanceof Error);
      assert.match(error.cause.message, /champ manquant.*title/i);
      return true;
    },
  );
});

test("les repositories normalisent une erreur inattendue de JSON.parse avec sa cause", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-json-unknown-"));
  const rootCause = new TypeError("synthetic persisted parse failure");
  const originalJsonParse = JSON.parse;

  t.after(async () => {
    JSON.parse = originalJsonParse;
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const missionPath = path.join(layout.missionsDir, missionId, "mission.json");

  await mkdir(path.dirname(missionPath), { recursive: true });
  await writeFile(missionPath, `${JSON.stringify(createMission(), null, 2)}\n`, "utf8");

  JSON.parse = (() => {
    throw rootCause;
  }) as typeof JSON.parse;

  await assert.rejects(
    () => createFileMissionRepository(layout).findById(missionId),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Lecture du document persiste Mission/);
      assert.equal(error.cause, rootCause);
      return true;
    },
  );
});

test("FileSkillPackRegistryRepository.list expose une entree corrompue au lieu de retourner une liste partielle", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-skill-pack-list-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileSkillPackRegistryRepository(layout);
  const validSkillPack = createSkillPack({ packRef: "pack.valid" });
  const corruptPackRef = "pack.corrupt";
  const corruptPath = path.join(layout.skillPacksDir, corruptPackRef, "skill-pack.json");

  await repository.save(validSkillPack);
  await mkdir(path.dirname(corruptPath), { recursive: true });
  await writeFile(corruptPath, "{json invalide\n", "utf8");

  await assert.rejects(
    () => repository.list(),
    (error: unknown) => {
      assert.ok(error instanceof CorruptedPersistedDocumentError);
      assert.equal(error.code, "json_corrompu");
      assert.equal(error.documentId, corruptPackRef);
      assert.equal(error.filePath, corruptPath);
      assert.match(error.message, /pack\.corrupt/);
      return true;
    },
  );
});

test("les repositories lisent les discriminants ouverts inconnus en attachant des warnings structurels", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-defensive-open-discriminants-"));
  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const missionPath = path.join(layout.missionsDir, missionId, "mission.json");
  const ticketPath = path.join(layout.missionsDir, missionId, "tickets", ticketId, "ticket.json");
  const artifactPath = path.join(
    layout.missionsDir,
    missionId,
    "tickets",
    ticketId,
    "artifacts",
    artifactId,
    "artifact.json",
  );

  await mkdir(path.dirname(missionPath), { recursive: true });
  await mkdir(path.dirname(ticketPath), { recursive: true });
  await mkdir(path.dirname(artifactPath), { recursive: true });

  await writeFile(
    missionPath,
    `${JSON.stringify({ ...createMission(), status: "archived_v2" }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    ticketPath,
    `${JSON.stringify({ ...createTicket(), status: "on_hold" }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    artifactPath,
    `${JSON.stringify({ ...createArtifact(), kind: "binary_blob_v2" }, null, 2)}\n`,
    "utf8",
  );

  const mission = await createFileMissionRepository(layout).findById(missionId);
  const ticket = await createFileTicketRepository(layout).findById(missionId, ticketId);
  const artifact = await createFileArtifactRepository(layout).findById(missionId, artifactId);

  assert.ok(mission);
  assert.ok(ticket);
  assert.ok(artifact);
  assert.equal((mission as unknown as Record<string, unknown>).status, "archived_v2");
  assert.equal((ticket as unknown as Record<string, unknown>).status, "on_hold");
  assert.equal((artifact as unknown as Record<string, unknown>).kind, "binary_blob_v2");
  assert.deepEqual(
    getStructuralValidationWarnings(mission).map((warning) => warning.path),
    ["status"],
  );
  assert.deepEqual(
    getStructuralValidationWarnings(ticket).map((warning) => warning.path),
    ["status"],
  );
  assert.deepEqual(
    getStructuralValidationWarnings(artifact).map((warning) => warning.path),
    ["kind"],
  );
});

function createMission(overrides: Partial<Mission> = {}): Mission {
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

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
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

function createAttempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
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

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
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

function createCapability(overrides: Partial<RegisteredCapability> = {}): RegisteredCapability {
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

function createSkillPack(overrides: Partial<RegisteredSkillPack> = {}): RegisteredSkillPack {
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
