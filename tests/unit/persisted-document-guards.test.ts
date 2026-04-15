import assert from "node:assert/strict";
import test from "node:test";

import type { Artifact } from "../../packages/contracts/src/artifact/artifact";
import type { RegisteredCapability } from "../../packages/contracts/src/extension/registered-capability";
import type { RegisteredSkillPack } from "../../packages/contracts/src/extension/registered-skill-pack";
import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import {
  isArtifact,
  isExecutionAttempt,
  isMission,
  isRegisteredCapability,
  isRegisteredSkillPack,
  isTicket,
  validateArtifact,
  validateExecutionAttempt,
  validateMission,
  validateRegisteredCapability,
  validateRegisteredSkillPack,
  validateTicket,
  type ValidationResult,
} from "../../packages/contracts/src/guards/persisted-document-guards";

function assertInvalid(result: ValidationResult, reasonPattern: RegExp): void {
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, reasonPattern);
  }
}

function createMission(overrides: Partial<Mission> = {}): Mission {
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

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
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

function createExecutionAttempt(
  overrides: Partial<ExecutionAttempt> = {},
): ExecutionAttempt {
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

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
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

function createRegisteredCapability(
  overrides: Partial<RegisteredCapability> = {},
): RegisteredCapability {
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

function createRegisteredSkillPack(
  overrides: Partial<RegisteredSkillPack> = {},
): RegisteredSkillPack {
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

test("isMission valide le snapshot mission et documente les raisons de rejet", () => {
  assert.equal(isMission(createMission()), true);
  assert.equal(isMission({ ...createMission(), authorizedExtensions: undefined }), true);
  assertInvalid(validateMission({ ...createMission(), title: undefined }), /champ manquant.*title/i);
  assertInvalid(validateMission({ ...createMission(), ticketIds: [42] }), /type incorrect.*ticketIds/i);
  assertInvalid(validateMission({ ...createMission(), status: "closed" }), /statut inconnu.*status/i);
  assertInvalid(
    validateMission({ ...createMission(), authorizedExtensions: { allowedCapabilities: "cap", skillPackRefs: [] } }),
    /type incorrect.*authorizedExtensions\.allowedCapabilities/i,
  );
});

test("isTicket valide le snapshot ticket et rejette champs, types et discriminants inconnus", () => {
  assert.equal(isTicket(createTicket()), true);
  assertInvalid(validateTicket({ ...createTicket(), goal: undefined }), /champ manquant.*goal/i);
  assertInvalid(validateTicket({ ...createTicket(), dependsOn: ["a", 1] }), /type incorrect.*dependsOn/i);
  assertInvalid(validateTicket({ ...createTicket(), kind: "fix" }), /discriminant invalide.*kind/i);
  assertInvalid(validateTicket({ ...createTicket(), status: "closed" }), /statut inconnu.*status/i);
  assertInvalid(
    validateTicket({ ...createTicket(), executionHandle: { adapter: "unknown", adapterState: {} } }),
    /discriminant invalide.*executionHandle\.adapter/i,
  );
});

test("isExecutionAttempt valide les tentatives et rejette les statuts/adapters inconnus", () => {
  assert.equal(isExecutionAttempt(createExecutionAttempt()), true);
  assertInvalid(
    validateExecutionAttempt({ ...createExecutionAttempt(), ticketId: undefined }),
    /champ manquant.*ticketId/i,
  );
  assertInvalid(
    validateExecutionAttempt({ ...createExecutionAttempt(), backgroundRequested: "false" }),
    /type incorrect.*backgroundRequested/i,
  );
  assertInvalid(
    validateExecutionAttempt({ ...createExecutionAttempt(), adapter: "legacy_adapter" }),
    /discriminant invalide.*adapter/i,
  );
  assertInvalid(
    validateExecutionAttempt({ ...createExecutionAttempt(), status: "stalled" }),
    /statut inconnu.*status/i,
  );
});

test("isArtifact valide les artefacts et rejette les kinds ou champs optionnels invalides", () => {
  assert.equal(isArtifact(createArtifact()), true);
  assertInvalid(validateArtifact({ ...createArtifact(), missionId: undefined }), /champ manquant.*missionId/i);
  assertInvalid(validateArtifact({ ...createArtifact(), sizeBytes: "12" }), /type incorrect.*sizeBytes/i);
  assertInvalid(validateArtifact({ ...createArtifact(), kind: "binary_blob" }), /discriminant invalide.*kind/i);
});

test("isRegisteredCapability valide le registre capability et ses branches provider", () => {
  assert.equal(isRegisteredCapability(createRegisteredCapability()), true);
  assert.equal(
    isRegisteredCapability(createRegisteredCapability({
      provider: "mcp",
      mcp: { serverName: "server", toolName: "tool" },
    })),
    true,
  );
  assertInvalid(
    validateRegisteredCapability({ ...createRegisteredCapability(), capabilityId: undefined }),
    /champ manquant.*capabilityId/i,
  );
  assertInvalid(
    validateRegisteredCapability({ ...createRegisteredCapability(), permissions: ["docs.read", 42] }),
    /type incorrect.*permissions/i,
  );
  assertInvalid(
    validateRegisteredCapability({ ...createRegisteredCapability(), provider: "remote" }),
    /discriminant invalide.*provider/i,
  );
  assertInvalid(
    validateRegisteredCapability({ ...createRegisteredCapability({ provider: "mcp", mcp: null }) }),
    /champ manquant.*mcp/i,
  );
});

test("isRegisteredSkillPack valide le registre skill-pack et ses metadonnees", () => {
  assert.equal(isRegisteredSkillPack(createRegisteredSkillPack()), true);
  assertInvalid(
    validateRegisteredSkillPack({ ...createRegisteredSkillPack(), packRef: undefined }),
    /champ manquant.*packRef/i,
  );
  assertInvalid(
    validateRegisteredSkillPack({ ...createRegisteredSkillPack(), constraints: ["local_only", 42] }),
    /type incorrect.*constraints/i,
  );
  assertInvalid(
    validateRegisteredSkillPack({ ...createRegisteredSkillPack(), schemaVersion: "corp.extension.v2" }),
    /discriminant invalide.*schemaVersion/i,
  );
  assertInvalid(
    validateRegisteredSkillPack({
      ...createRegisteredSkillPack(),
      metadata: { description: "x", owner: "core", tags: [42] },
    }),
    /type incorrect.*metadata\.tags/i,
  );
});
