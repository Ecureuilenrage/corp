"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const approval_queue_projection_1 = require("../../packages/journal/src/projections/approval-queue-projection");
function createApproval(overrides = {}) {
    return {
        approvalId: "approval_demo",
        missionId: "mission_demo",
        ticketId: "ticket_demo",
        attemptId: "attempt_demo",
        status: "requested",
        title: "Validation requise",
        actionType: "workspace_write",
        actionSummary: "Modification d'un fichier sensible",
        guardrails: ["policy_profile: policy_profile_local"],
        relatedEventIds: ["event_requested"],
        relatedArtifactIds: [],
        createdAt: "2026-04-10T10:00:00.000Z",
        updatedAt: "2026-04-10T10:00:00.000Z",
        ...overrides,
    };
}
function createEvent(input) {
    return {
        eventId: input.eventId,
        type: input.type,
        missionId: input.missionId ?? input.approval?.missionId ?? "mission_demo",
        ticketId: input.approval?.ticketId,
        attemptId: input.approval?.attemptId,
        occurredAt: input.occurredAt ?? input.approval?.updatedAt ?? "2026-04-10T10:00:00.000Z",
        actor: "adapter",
        source: "codex_responses",
        payload: input.approval
            ? { approval: input.approval }
            : {},
    };
}
(0, node_test_1.default)("createApprovalQueueProjection trie les validations par createdAt puis approvalId", () => {
    const projection = (0, approval_queue_projection_1.createApprovalQueueProjection)({
        missionId: "mission_demo",
        events: [
            createEvent({
                eventId: "event_c",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_c",
                    createdAt: "2026-04-10T10:02:00.000Z",
                    updatedAt: "2026-04-10T10:02:00.000Z",
                }),
            }),
            createEvent({
                eventId: "event_a",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_a",
                    createdAt: "2026-04-10T10:01:00.000Z",
                    updatedAt: "2026-04-10T10:01:00.000Z",
                }),
            }),
            createEvent({
                eventId: "event_b",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_b",
                    createdAt: "2026-04-10T10:01:00.000Z",
                    updatedAt: "2026-04-10T10:01:00.000Z",
                }),
            }),
        ],
    });
    strict_1.default.deepEqual(projection.approvals.map((approval) => approval.approvalId), ["approval_a", "approval_b", "approval_c"]);
});
(0, node_test_1.default)("createApprovalQueueProjection retire les validations terminales et ignore les autres missions", () => {
    const projection = (0, approval_queue_projection_1.createApprovalQueueProjection)({
        missionId: "mission_demo",
        events: [
            createEvent({
                eventId: "event_requested",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_keep",
                    title: "Validation a conserver",
                }),
            }),
            createEvent({
                eventId: "event_other_mission",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_other_mission",
                    missionId: "mission_other",
                    ticketId: "ticket_other",
                    attemptId: "attempt_other",
                }),
            }),
            createEvent({
                eventId: "event_close_requested",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_closed",
                    title: "Validation closee",
                }),
            }),
            createEvent({
                eventId: "event_close_approved",
                type: "approval.approved",
                approval: createApproval({
                    approvalId: "approval_closed",
                    status: "approved",
                    title: "Validation closee",
                    updatedAt: "2026-04-10T10:05:00.000Z",
                }),
                occurredAt: "2026-04-10T10:05:00.000Z",
            }),
        ],
    });
    strict_1.default.deepEqual(projection, {
        schemaVersion: 1,
        approvals: [
            createApproval({
                approvalId: "approval_keep",
                title: "Validation a conserver",
            }),
        ],
    });
});
(0, node_test_1.default)("createApprovalQueueProjection conserve le snapshot pending le plus recent puis le retire sur evenement terminal", () => {
    const refreshedApproval = createApproval({
        approvalId: "approval_refresh",
        title: "Validation raffraichie",
        guardrails: [
            "manual_review: workspace_write",
            "policy_profile: policy_profile_strict",
        ],
        updatedAt: "2026-04-10T10:03:00.000Z",
    });
    const projectionBeforeTerminal = (0, approval_queue_projection_1.createApprovalQueueProjection)({
        missionId: "mission_demo",
        events: [
            createEvent({
                eventId: "event_refresh_requested_1",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_refresh",
                    title: "Validation initiale",
                    updatedAt: "2026-04-10T10:01:00.000Z",
                }),
            }),
            createEvent({
                eventId: "event_refresh_requested_2",
                type: "approval.requested",
                approval: refreshedApproval,
                occurredAt: refreshedApproval.updatedAt,
            }),
        ],
    });
    strict_1.default.deepEqual(projectionBeforeTerminal, {
        schemaVersion: 1,
        approvals: [refreshedApproval],
    });
    const projectionAfterTerminal = (0, approval_queue_projection_1.createApprovalQueueProjection)({
        missionId: "mission_demo",
        events: [
            createEvent({
                eventId: "event_refresh_requested_1",
                type: "approval.requested",
                approval: createApproval({
                    approvalId: "approval_refresh",
                    title: "Validation initiale",
                    updatedAt: "2026-04-10T10:01:00.000Z",
                }),
            }),
            createEvent({
                eventId: "event_refresh_requested_2",
                type: "approval.requested",
                approval: refreshedApproval,
                occurredAt: refreshedApproval.updatedAt,
            }),
            createEvent({
                eventId: "event_refresh_approved",
                type: "approval.approved",
                approval: {
                    ...refreshedApproval,
                    status: "approved",
                    updatedAt: "2026-04-10T10:04:00.000Z",
                },
                occurredAt: "2026-04-10T10:04:00.000Z",
            }),
        ],
    });
    strict_1.default.deepEqual(projectionAfterTerminal, {
        schemaVersion: 1,
        approvals: [],
    });
});
