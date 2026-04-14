import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRequest } from "../../packages/contracts/src/approval/approval-request";
import type { Artifact } from "../../packages/contracts/src/artifact/artifact";
import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import { createAuditLogProjection } from "../../packages/journal/src/projections/audit-log-projection";

function createMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_demo",
    title: "Mission demo",
    objective: "Rendre l'audit lisible",
    status: "running",
    successCriteria: ["L'audit est lisible"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: ["ticket_alpha"],
    artifactIds: [],
    eventIds: ["event_mission_created"],
    resumeCursor: "event_mission_created",
    createdAt: "2026-04-11T09:59:00.000Z",
    updatedAt: "2026-04-11T09:59:00.000Z",
    ...overrides,
  };
}

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket_alpha",
    missionId: "mission_demo",
    kind: "implement",
    goal: "Produire une sortie traquable",
    status: "done",
    owner: "agent_dev",
    dependsOn: [],
    successCriteria: ["Un artefact est produit"],
    allowedCapabilities: [],
    skillPackRefs: [],
    workspaceIsolationId: "iso_alpha",
    executionHandle: {
      adapter: "codex_responses",
      adapterState: {},
    },
    artifactIds: ["artifact_report"],
    eventIds: ["event_ticket_created", "event_exec_completed", "event_artifact_registered"],
    createdAt: "2026-04-11T09:59:30.000Z",
    updatedAt: "2026-04-11T10:01:00.000Z",
    ...overrides,
  };
}

function createAttempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
  return {
    id: "attempt_alpha",
    ticketId: "ticket_alpha",
    adapter: "codex_responses",
    status: "completed",
    workspaceIsolationId: "iso_alpha",
    backgroundRequested: false,
    adapterState: {},
    startedAt: "2026-04-11T10:00:00.000Z",
    endedAt: "2026-04-11T10:00:30.000Z",
    ...overrides,
  };
}

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "artifact_report",
    missionId: "mission_demo",
    ticketId: "ticket_alpha",
    producingEventId: "event_exec_completed",
    attemptId: "attempt_alpha",
    workspaceIsolationId: "iso_alpha",
    kind: "structured_output",
    title: "Rapport JSON",
    createdAt: "2026-04-11T10:01:00.000Z",
    summary: "Resume court",
    ...overrides,
  };
}

function createApproval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    approvalId: "approval_alpha",
    missionId: "mission_demo",
    ticketId: "ticket_alpha",
    attemptId: "attempt_alpha",
    status: "requested",
    title: "Validation requise",
    actionType: "workspace_write",
    actionSummary: "Modifier README.md",
    guardrails: ["manual_review: workspace_write"],
    relatedEventIds: ["event_exec_requested"],
    relatedArtifactIds: ["artifact_hint_1"],
    createdAt: "2026-04-11T10:00:10.000Z",
    updatedAt: "2026-04-11T10:00:10.000Z",
    ...overrides,
  };
}

function createEvent(overrides: Partial<JournalEventRecord> = {}): JournalEventRecord {
  return {
    eventId: "event_demo",
    type: "mission.created",
    missionId: "mission_demo",
    occurredAt: "2026-04-11T09:59:00.000Z",
    actor: "operator",
    source: "corp-cli",
    payload: {},
    ...overrides,
  };
}

test("createAuditLogProjection trie les evenements et reconstruit les correlations utiles sans fuite vendor", () => {
  const mission = createMission();
  const ticket = createTicket();
  const attempt = createAttempt({
    adapterState: {
      responseId: "resp_123",
      pollCursor: "cursor_123",
      vendorStatus: "completed",
    },
  });
  const artifact = createArtifact();
  const missionCreated = createEvent({
    eventId: "event_mission_created",
    type: "mission.created",
    payload: {
      mission,
    },
  });
  const executionCompleted = createEvent({
    eventId: "event_exec_completed",
    type: "execution.completed",
    ticketId: ticket.id,
    attemptId: attempt.id,
    occurredAt: "2026-04-11T10:00:30.000Z",
    actor: "adapter",
    source: "codex_responses",
    payload: {
      mission,
      ticket,
      attempt,
      trigger: "adapter",
    },
  });
  const artifactRegistered = createEvent({
    eventId: "event_artifact_registered",
    type: "artifact.registered",
    ticketId: ticket.id,
    attemptId: attempt.id,
    occurredAt: "2026-04-11T10:01:00.000Z",
    actor: "system",
    source: "ticket-runtime",
    payload: {
      artifact,
      mission,
      ticket,
      producingEventId: executionCompleted.eventId,
      sourceEventType: executionCompleted.type,
      trigger: "execution-terminal-output",
    },
  });

  const projection = createAuditLogProjection({
    mission,
    tickets: [ticket],
    artifacts: [artifact],
    events: [artifactRegistered, executionCompleted, missionCreated],
  });

  assert.equal(projection.schemaVersion, 1);
  assert.deepEqual(
    projection.entries.map((entry) => entry.eventId),
    [
      "event_mission_created",
      "event_exec_completed",
      "event_artifact_registered",
    ],
  );

  const executionEntry = projection.entries[1];
  assert.equal(executionEntry.ticketId, ticket.id);
  assert.equal(executionEntry.attemptId, attempt.id);
  assert.equal(executionEntry.ticketOwner, "agent_dev");
  assert.equal(executionEntry.source, "execution-adapter");
  assert.deepEqual(executionEntry.relatedArtifactIds, ["artifact_report"]);

  const artifactEntry = projection.entries[2];
  assert.equal(artifactEntry.artifactId, "artifact_report");
  assert.equal(artifactEntry.source, "ticket-runtime");
  assert.deepEqual(artifactEntry.relatedEventIds, ["event_exec_completed"]);
  assert.deepEqual(artifactEntry.relatedArtifactIds, ["artifact_report"]);

  assert.doesNotMatch(
    JSON.stringify(projection),
    /responseId|pollCursor|vendorStatus|adapterState/i,
  );
});

test("createAuditLogProjection remonte approvalId, owner et source publique pour approval.requested", () => {
  const mission = createMission();
  const ticket = createTicket({
    owner: "agent_sensitive",
    status: "awaiting_approval",
  });
  const approval = createApproval();
  const approvalRequested = createEvent({
    eventId: "event_approval_requested",
    type: "approval.requested",
    ticketId: ticket.id,
    attemptId: approval.attemptId,
    occurredAt: approval.createdAt,
    actor: "adapter",
    source: "openai.responses",
    payload: {
      approvalId: approval.approvalId,
      approval,
    },
  });

  const projection = createAuditLogProjection({
    mission,
    tickets: [ticket],
    artifacts: [],
    events: [approvalRequested],
  });
  const entry = projection.entries[0];

  assert.equal(entry.approvalId, "approval_alpha");
  assert.equal(entry.ticketOwner, "agent_sensitive");
  assert.equal(entry.source, "execution-adapter");
  assert.deepEqual(entry.relatedEventIds, ["event_exec_requested"]);
  assert.deepEqual(entry.relatedArtifactIds, ["artifact_hint_1"]);
  assert.equal(entry.title, "Validation requise");
  assert.match(entry.summary, /ticket ticket_alpha/i);
});

test("createAuditLogProjection garde un fallback sobre pour les types d'evenements inconnus", () => {
  const mission = createMission();
  const unknownEvent = createEvent({
    eventId: "event_future_signal",
    type: "future.signal",
    occurredAt: "2026-04-11T10:05:00.000Z",
    actor: "system",
    source: "corp-cli",
    payload: {
      note: "champ futur",
    },
  });

  const projection = createAuditLogProjection({
    mission,
    tickets: [],
    artifacts: [],
    events: [unknownEvent],
  });
  const entry = projection.entries[0];

  assert.equal(entry.kind, "future");
  assert.equal(entry.title, "future.signal");
  assert.match(entry.summary, /future\.signal/);
  assert.equal(entry.actor, "system");
  assert.equal(entry.source, "corp-cli");
});

test("createAuditLogProjection rend capability.invoked lisible sans fuite vendor ni secret", () => {
  const mission = createMission();
  const ticket = createTicket({
    allowedCapabilities: ["shell.exec"],
    skillPackRefs: ["pack.audit"],
  });
  const capabilityInvoked = createEvent({
    eventId: "event_capability_invoked",
    type: "capability.invoked",
    ticketId: ticket.id,
    attemptId: "attempt_alpha",
    occurredAt: "2026-04-11T10:00:05.000Z",
    actor: "system",
    source: "ticket-runtime",
    payload: {
      capability: {
        capabilityId: "shell.exec",
        registrationId: "ext.capability.shell.exec.local",
        provider: "local",
        approvalSensitive: true,
        permissions: ["shell.exec", "fs.read"],
        constraints: ["local_only", "approval_sensitive", "workspace_scoped"],
        requiredEnvNames: [],
      },
      guardrails: [
        "policy_profile: policy_profile_local",
        "allowed_capabilities: shell.exec",
        "skill_packs: pack.audit",
      ],
      trigger: "ticket_run_preflight",
      responseId: "resp_should_not_leak",
      vendorStatus: "completed",
    },
  });

  const projection = createAuditLogProjection({
    mission,
    tickets: [ticket],
    artifacts: [],
    events: [capabilityInvoked],
  });
  const entry = projection.entries[0];

  assert.equal(entry.kind, "capability");
  assert.equal(entry.title, "Capability invoquee");
  assert.match(entry.summary, /shell\.exec/);
  assert.match(entry.summary, /ticket ticket_alpha/);
  assert.equal(entry.source, "ticket-runtime");
  assert.equal(entry.ticketOwner, "agent_dev");
  assert.doesNotMatch(
    JSON.stringify(projection),
    /responseId|vendorStatus|pollCursor|token|secret/i,
  );
});

test("createAuditLogProjection rend skill_pack.used lisible avec packRef et ticketId sans fuite vendor", () => {
  const mission = createMission({
    authorizedExtensions: {
      allowedCapabilities: ["shell.exec"],
      skillPackRefs: ["pack.triage.local"],
    },
  });
  const ticket = createTicket({
    allowedCapabilities: ["shell.exec"],
    skillPackRefs: ["pack.triage.local"],
  });
  const skillPackUsed = createEvent({
    eventId: "event_skill_pack_used",
    type: "skill_pack.used",
    ticketId: ticket.id,
    attemptId: "attempt_alpha",
    occurredAt: "2026-04-11T10:00:06.000Z",
    actor: "system",
    source: "ticket-runtime",
    payload: {
      mission,
      ticket,
      skillPack: {
        packRef: "pack.triage.local",
        registrationId: "ext.skill-pack.triage.local",
        displayName: "Pack de triage local",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        owner: "core-platform",
        tags: ["skill-pack", "local"],
      },
      trigger: "ticket_run_launch",
      responseId: "resp_should_not_leak",
      vendorStatus: "completed",
    },
  });

  const projection = createAuditLogProjection({
    mission,
    tickets: [ticket],
    artifacts: [],
    events: [skillPackUsed],
  });
  const entry = projection.entries[0];

  assert.equal(entry.kind, "skill_pack");
  assert.equal(entry.title, "Skill pack utilise");
  assert.match(entry.summary, /pack\.triage\.local/);
  assert.match(entry.summary, /ticket ticket_alpha/);
  assert.equal(entry.ticketId, ticket.id);
  assert.equal(entry.attemptId, "attempt_alpha");
  assert.equal(entry.source, "ticket-runtime");
  assert.equal(entry.ticketOwner, "agent_dev");
  assert.doesNotMatch(
    JSON.stringify(projection),
    /responseId|vendorStatus|pollCursor|token|secret/i,
  );
});

test("createAuditLogProjection rend mission.extensions_selected avec selection courante et champs modifies", () => {
  const mission = createMission({
    authorizedExtensions: {
      allowedCapabilities: ["shell.exec"],
      skillPackRefs: ["pack.triage.local"],
    },
  });
  const extensionsSelected = createEvent({
    eventId: "event_extensions_selected",
    type: "mission.extensions_selected",
    occurredAt: "2026-04-11T10:02:00.000Z",
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission,
      previousAuthorizedExtensions: {
        allowedCapabilities: [],
        skillPackRefs: [],
      },
      authorizedExtensions: {
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: ["pack.triage.local"],
      },
      changedFields: ["allowedCapabilities", "skillPackRefs"],
      trigger: "operator",
    },
  });

  const projection = createAuditLogProjection({
    mission,
    tickets: [],
    artifacts: [],
    events: [extensionsSelected],
  });
  const entry = projection.entries[0];

  assert.equal(entry.kind, "mission");
  assert.equal(entry.title, "Extensions mission selectionnees");
  assert.match(entry.summary, /shell\.exec/);
  assert.match(entry.summary, /pack\.triage\.local/);
  assert.match(entry.summary, /allowedCapabilities/);
  assert.match(entry.summary, /skillPackRefs/);
  assert.equal(entry.actor, "operator");
  assert.equal(entry.source, "corp-cli");
});
