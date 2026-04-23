import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import type { MissionAuthoritativeCursor } from "../../packages/journal/src/reconstruction/mission-reconstruction";
import {
  mergeAttemptsById,
  mergeTicketsById,
  normalizeTicketBoardReadError,
} from "../../packages/ticket-runtime/src/planner/read-ticket-board";

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
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

function createAttempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
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

test("mergeTicketsById conserve le snapshot le plus recent meme si le journal porte un eventId plus grand", () => {
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
  const journalTicketCursors = new Map<string, MissionAuthoritativeCursor>([
    [
      journalTicket.id,
      {
        occurredAt: "2026-04-20T10:00:00.000Z",
        eventId: "event_030",
      },
    ],
  ]);

  const merged = mergeTicketsById([storedTicket], [journalTicket], journalTicketCursors);

  assert.equal(merged.usedJournalSnapshot, false);
  assert.equal(merged.tickets[0]?.status, "done");
});

test("mergeAttemptsById conserve la tentative la plus fraiche par timestamp avant le tie-break eventId", () => {
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
  const journalAttemptCursors = new Map<string, MissionAuthoritativeCursor>([
    [
      journalAttempt.id,
      {
        occurredAt: "2026-04-20T10:05:00.000Z",
        eventId: "event_030",
      },
    ],
  ]);

  const merged = mergeAttemptsById(
    [storedAttempt],
    [journalAttempt],
    false,
    journalAttemptCursors,
  );

  assert.equal(merged[0]?.status, "completed");
  assert.equal(merged[0]?.endedAt, "2026-04-20T10:10:00.000Z");
});

test("normalizeTicketBoardReadError preserve la cause inattendue", () => {
  const rootCause = new TypeError("synthetic ticket-board failure");
  const error = normalizeTicketBoardReadError(rootCause, {
    missionId: "mission_merge",
    commandName: "ticket board",
    projectionPath: "C:/tmp/ticket-board.json",
  });

  assert.ok(error instanceof Error);
  assert.match(error.message, /Projection ticket-board irreconciliable/);
  assert.equal(error.cause, rootCause);
});
