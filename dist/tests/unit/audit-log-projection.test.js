"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const audit_log_projection_1 = require("../../packages/journal/src/projections/audit-log-projection");
function createMission(overrides = {}) {
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
function createTicket(overrides = {}) {
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
function createAttempt(overrides = {}) {
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
function createArtifact(overrides = {}) {
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
function createApproval(overrides = {}) {
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
function createEvent(overrides = {}) {
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
(0, node_test_1.default)("createAuditLogProjection trie les evenements et reconstruit les correlations utiles sans fuite vendor", () => {
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
    const projection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [ticket],
        artifacts: [artifact],
        events: [artifactRegistered, executionCompleted, missionCreated],
    });
    strict_1.default.equal(projection.schemaVersion, 1);
    strict_1.default.deepEqual(projection.entries.map((entry) => entry.eventId), [
        "event_mission_created",
        "event_exec_completed",
        "event_artifact_registered",
    ]);
    const executionEntry = projection.entries[1];
    strict_1.default.equal(executionEntry.ticketId, ticket.id);
    strict_1.default.equal(executionEntry.attemptId, attempt.id);
    strict_1.default.equal(executionEntry.ticketOwner, "agent_dev");
    strict_1.default.equal(executionEntry.source, "execution-adapter");
    strict_1.default.deepEqual(executionEntry.relatedArtifactIds, ["artifact_report"]);
    const artifactEntry = projection.entries[2];
    strict_1.default.equal(artifactEntry.artifactId, "artifact_report");
    strict_1.default.equal(artifactEntry.source, "ticket-runtime");
    strict_1.default.deepEqual(artifactEntry.relatedEventIds, ["event_exec_completed"]);
    strict_1.default.deepEqual(artifactEntry.relatedArtifactIds, ["artifact_report"]);
    strict_1.default.doesNotMatch(JSON.stringify(projection), /responseId|pollCursor|vendorStatus|adapterState/i);
});
(0, node_test_1.default)("createAuditLogProjection remonte approvalId, owner et source publique pour approval.requested", () => {
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
    const projection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [ticket],
        artifacts: [],
        events: [approvalRequested],
    });
    const entry = projection.entries[0];
    strict_1.default.equal(entry.approvalId, "approval_alpha");
    strict_1.default.equal(entry.ticketOwner, "agent_sensitive");
    strict_1.default.equal(entry.source, "execution-adapter");
    strict_1.default.deepEqual(entry.relatedEventIds, ["event_exec_requested"]);
    strict_1.default.deepEqual(entry.relatedArtifactIds, ["artifact_hint_1"]);
    strict_1.default.equal(entry.title, "Validation requise");
    strict_1.default.match(entry.summary, /ticket ticket_alpha/i);
});
(0, node_test_1.default)("createAuditLogProjection garde un fallback sobre pour les types d'evenements inconnus", () => {
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
    const projection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [],
        artifacts: [],
        events: [unknownEvent],
    });
    const entry = projection.entries[0];
    strict_1.default.equal(entry.kind, "future");
    strict_1.default.equal(entry.title, "future.signal");
    strict_1.default.match(entry.summary, /future\.signal/);
    strict_1.default.equal(entry.actor, "system");
    strict_1.default.equal(entry.source, "corp-cli");
});
(0, node_test_1.default)("createAuditLogProjection rend capability.invoked lisible sans fuite vendor ni secret", () => {
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
    const projection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [ticket],
        artifacts: [],
        events: [capabilityInvoked],
    });
    const entry = projection.entries[0];
    strict_1.default.equal(entry.kind, "capability");
    strict_1.default.equal(entry.title, "Capability invoquee");
    strict_1.default.match(entry.summary, /shell\.exec/);
    strict_1.default.match(entry.summary, /ticket ticket_alpha/);
    strict_1.default.equal(entry.source, "ticket-runtime");
    strict_1.default.equal(entry.ticketOwner, "agent_dev");
    strict_1.default.doesNotMatch(JSON.stringify(projection), /responseId|vendorStatus|pollCursor|token|secret/i);
});
(0, node_test_1.default)("createAuditLogProjection rend skill_pack.used lisible avec packRef et ticketId sans fuite vendor", () => {
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
    const projection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [ticket],
        artifacts: [],
        events: [skillPackUsed],
    });
    const entry = projection.entries[0];
    strict_1.default.equal(entry.kind, "skill_pack");
    strict_1.default.equal(entry.title, "Skill pack utilise");
    strict_1.default.match(entry.summary, /pack\.triage\.local/);
    strict_1.default.match(entry.summary, /ticket ticket_alpha/);
    strict_1.default.equal(entry.ticketId, ticket.id);
    strict_1.default.equal(entry.attemptId, "attempt_alpha");
    strict_1.default.equal(entry.source, "ticket-runtime");
    strict_1.default.equal(entry.ticketOwner, "agent_dev");
    strict_1.default.doesNotMatch(JSON.stringify(projection), /responseId|vendorStatus|pollCursor|token|secret/i);
});
(0, node_test_1.default)("createAuditLogProjection rend mission.extensions_selected avec selection courante et champs modifies", () => {
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
    const projection = (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [],
        artifacts: [],
        events: [extensionsSelected],
    });
    const entry = projection.entries[0];
    strict_1.default.equal(entry.kind, "mission");
    strict_1.default.equal(entry.title, "Extensions mission selectionnees");
    strict_1.default.match(entry.summary, /shell\.exec/);
    strict_1.default.match(entry.summary, /pack\.triage\.local/);
    strict_1.default.match(entry.summary, /allowedCapabilities/);
    strict_1.default.match(entry.summary, /skillPackRefs/);
    strict_1.default.equal(entry.actor, "operator");
    strict_1.default.equal(entry.source, "corp-cli");
});
