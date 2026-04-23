"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const read_ticket_board_1 = require("../../packages/ticket-runtime/src/planner/read-ticket-board");
function createTicket(overrides = {}) {
    return {
        id: "ticket_merge",
        missionId: "mission_merge",
        kind: "implement",
        goal: "Tester la fusion ticket-board",
        status: "todo",
        owner: "agent_merge",
        dependsOn: [],
        successCriteria: [],
        allowedCapabilities: [],
        skillPackRefs: [],
        workspaceIsolationId: null,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: ["event_010"],
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:00:00.000Z",
        ...overrides,
    };
}
function createAttempt(overrides = {}) {
    return {
        id: "attempt_merge",
        ticketId: "ticket_merge",
        adapter: "codex_responses",
        status: "running",
        workspaceIsolationId: "iso_merge",
        backgroundRequested: true,
        adapterState: {},
        startedAt: "2026-04-20T10:00:00.000Z",
        endedAt: null,
        ...overrides,
    };
}
(0, node_test_1.default)("mergeTicketsById conserve le snapshot le plus recent meme si le journal porte un eventId plus grand", () => {
    const storedTicket = createTicket({
        status: "done",
        eventIds: ["event_020"],
        updatedAt: "2026-04-20T10:10:00.000Z",
    });
    const journalTicket = createTicket({
        status: "blocked",
        eventIds: ["event_030"],
        updatedAt: "2026-04-20T10:00:00.000Z",
    });
    const journalTicketCursors = new Map([
        [
            journalTicket.id,
            {
                occurredAt: "2026-04-20T10:00:00.000Z",
                eventId: "event_030",
            },
        ],
    ]);
    const merged = (0, read_ticket_board_1.mergeTicketsById)([storedTicket], [journalTicket], journalTicketCursors);
    strict_1.default.equal(merged.usedJournalSnapshot, false);
    strict_1.default.equal(merged.tickets[0]?.status, "done");
});
(0, node_test_1.default)("mergeAttemptsById conserve la tentative la plus fraiche par timestamp avant le tie-break eventId", () => {
    const storedAttempt = createAttempt({
        status: "completed",
        startedAt: "2026-04-20T10:00:00.000Z",
        endedAt: "2026-04-20T10:10:00.000Z",
    });
    const journalAttempt = createAttempt({
        status: "failed",
        startedAt: "2026-04-20T10:00:00.000Z",
        endedAt: "2026-04-20T10:05:00.000Z",
    });
    const journalAttemptCursors = new Map([
        [
            journalAttempt.id,
            {
                occurredAt: "2026-04-20T10:05:00.000Z",
                eventId: "event_030",
            },
        ],
    ]);
    const merged = (0, read_ticket_board_1.mergeAttemptsById)([storedAttempt], [journalAttempt], false, journalAttemptCursors);
    strict_1.default.equal(merged[0]?.status, "completed");
    strict_1.default.equal(merged[0]?.endedAt, "2026-04-20T10:10:00.000Z");
});
(0, node_test_1.default)("normalizeTicketBoardReadError preserve la cause inattendue", () => {
    const rootCause = new TypeError("synthetic ticket-board failure");
    const error = (0, read_ticket_board_1.normalizeTicketBoardReadError)(rootCause, {
        missionId: "mission_merge",
        commandName: "ticket board",
        projectionPath: "C:/tmp/ticket-board.json",
    });
    strict_1.default.ok(error instanceof Error);
    strict_1.default.match(error.message, /Projection ticket-board irreconciliable/);
    strict_1.default.equal(error.cause, rootCause);
});
