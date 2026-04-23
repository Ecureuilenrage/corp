import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import {
  reconstructAttemptsFromJournal,
  reconstructMissionFromJournal,
  reconstructTicketsFromJournal,
} from "../../packages/journal/src/reconstruction/mission-reconstruction";

function createAuthoritativeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_reconstruct",
    title: "Mission autoritaire",
    objective: "Valider le filtre par type d'event",
    status: "running",
    successCriteria: ["Filtre applique"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: ["ticket_1"],
    artifactIds: [],
    eventIds: ["event_created"],
    resumeCursor: "event_created",
    createdAt: "2026-04-15T12:00:00.000Z",
    updatedAt: "2026-04-15T12:00:00.000Z",
    ...overrides,
  };
}

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket_reconstruct",
    missionId: "mission_reconstruct",
    kind: "implement",
    goal: "Valider les events ticket autoritaires",
    status: "todo",
    owner: "agent_ticket",
    dependsOn: [],
    successCriteria: ["Le ticket reste coherent"],
    allowedCapabilities: [],
    skillPackRefs: [],
    workspaceIsolationId: null,
    executionHandle: {
      adapter: "codex_responses",
      adapterState: {},
    },
    artifactIds: [],
    eventIds: ["event_ticket_created"],
    createdAt: "2026-04-15T12:00:05.000Z",
    updatedAt: "2026-04-15T12:00:05.000Z",
    ...overrides,
  };
}

function createAttempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
  return {
    id: "attempt_reconstruct",
    ticketId: "ticket_reconstruct",
    adapter: "codex_responses",
    status: "running",
    workspaceIsolationId: "iso_reconstruct",
    backgroundRequested: false,
    adapterState: {},
    startedAt: "2026-04-15T12:00:10.000Z",
    endedAt: null,
    ...overrides,
  };
}

test("reconstructMissionFromJournal ignore les events non autoritaires qui embarquent un champ mission", () => {
  const authoritative = createAuthoritativeMission({
    title: "Titre autoritaire",
    updatedAt: "2026-04-15T12:00:00.000Z",
  });
  const polluted = createAuthoritativeMission({
    title: "Titre pollue",
    updatedAt: "2026-04-15T13:00:00.000Z",
  });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_created",
      type: "mission.created",
      missionId: authoritative.id,
      occurredAt: authoritative.createdAt,
      actor: "operator",
      source: "corp-cli",
      payload: { mission: authoritative },
    },
    {
      // Event non autoritaire porteur d'un champ `mission` dans le payload.
      // Hypothese defensive : si un jour un tel event existe, il ne doit pas ecraser l'etat.
      eventId: "event_bogus",
      type: "custom.diagnostic",
      missionId: authoritative.id,
      occurredAt: "2026-04-15T13:00:00.000Z",
      actor: "system",
      source: "diagnostic-service",
      payload: { mission: polluted },
    },
  ];

  const reconstructed = reconstructMissionFromJournal(events, authoritative.id);

  assert.equal(reconstructed.title, "Titre autoritaire");
  assert.equal(reconstructed.updatedAt, "2026-04-15T12:00:00.000Z");
});

test("reconstructMissionFromJournal applique skill_pack.used comme snapshot mission autoritaire", () => {
  const created = createAuthoritativeMission({
    title: "Titre initial",
    eventIds: ["event_created"],
    resumeCursor: "event_created",
    updatedAt: "2026-04-15T12:00:00.000Z",
  });
  const afterSkillPackUsage = createAuthoritativeMission({
    title: "Titre initial",
    eventIds: ["event_created", "event_skill_pack_used"],
    resumeCursor: "event_skill_pack_used",
    updatedAt: "2026-04-15T12:01:00.000Z",
  });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_created",
      type: "mission.created",
      missionId: created.id,
      occurredAt: created.createdAt,
      actor: "operator",
      source: "corp-cli",
      payload: { mission: created },
    },
    {
      eventId: "event_skill_pack_used",
      type: "skill_pack.used",
      missionId: created.id,
      occurredAt: afterSkillPackUsage.updatedAt,
      actor: "system",
      source: "ticket-runtime",
      payload: {
        mission: afterSkillPackUsage,
        skillPack: { packRef: "pack.local" },
      },
    },
  ];

  const reconstructed = reconstructMissionFromJournal(events, created.id);

  assert.equal(reconstructed.resumeCursor, "event_skill_pack_used");
  assert.deepEqual(reconstructed.eventIds, ["event_created", "event_skill_pack_used"]);
});

test("reconstructMissionFromJournal jette une erreur explicite quand tous les events sont non autoritaires", () => {
  const polluted = createAuthoritativeMission({ title: "Titre pollue" });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_bogus",
      type: "custom.diagnostic",
      missionId: polluted.id,
      occurredAt: polluted.createdAt,
      actor: "system",
      source: "diagnostic-service",
      payload: { mission: polluted },
    },
  ];

  assert.throws(
    () => reconstructMissionFromJournal(events, polluted.id),
    /Journal mission irreconciliable pour mission_reconstruct\. Impossible de reconstruire la mission\./,
  );
});

test("reconstructMissionFromJournal propage errorContextNoun pour preserver le wording historique de la commande resume", () => {
  const polluted = createAuthoritativeMission({ title: "Titre pollue" });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_bogus",
      type: "custom.diagnostic",
      missionId: polluted.id,
      occurredAt: polluted.createdAt,
      actor: "system",
      source: "diagnostic-service",
      payload: { mission: polluted },
    },
  ];

  assert.throws(
    () =>
      reconstructMissionFromJournal(events, polluted.id, {
        errorContextNoun: "la reprise",
      }),
    /Impossible de reconstruire la reprise\./,
  );
});

test("reconstructTicketsFromJournal ignore les payloads ticket presents sur des events hors allow-list", () => {
  const createdTicket = createTicket({
    goal: "Ticket autoritaire",
    updatedAt: "2026-04-15T12:00:05.000Z",
  });
  const pollutedTicket = createTicket({
    goal: "Ticket pollue",
    updatedAt: "2026-04-15T13:00:00.000Z",
  });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_ticket_created",
      type: "ticket.created",
      missionId: createdTicket.missionId,
      occurredAt: createdTicket.updatedAt,
      actor: "operator",
      source: "corp-cli",
      payload: { ticket: createdTicket },
    },
    {
      eventId: "event_ticket_polluted",
      type: "custom.diagnostic",
      missionId: createdTicket.missionId,
      occurredAt: pollutedTicket.updatedAt,
      actor: "system",
      source: "diagnostic-service",
      payload: { ticket: pollutedTicket },
    },
  ];

  const tickets = reconstructTicketsFromJournal(events, createdTicket.missionId);

  assert.equal(tickets.length, 1);
  assert.equal(tickets[0]?.goal, "Ticket autoritaire");
});

test("reconstructTicketsFromJournal ignore un previousTicket accidentel sur ticket.reprioritized sans payload.ticket", () => {
  const createdTicket = createTicket({
    goal: "Ticket courant",
  });
  const previousTicket = createTicket({
    goal: "Ancien ticket a ignorer",
    updatedAt: "2026-04-15T12:10:00.000Z",
  });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_ticket_created",
      type: "ticket.created",
      missionId: createdTicket.missionId,
      occurredAt: createdTicket.updatedAt,
      actor: "operator",
      source: "corp-cli",
      payload: { ticket: createdTicket },
    },
    {
      eventId: "event_ticket_reprioritized",
      type: "ticket.reprioritized",
      missionId: createdTicket.missionId,
      occurredAt: previousTicket.updatedAt,
      actor: "operator",
      source: "corp-cli",
      payload: { previousTicket },
    },
  ];

  const tickets = reconstructTicketsFromJournal(events, createdTicket.missionId);

  assert.equal(tickets.length, 1);
  assert.equal(tickets[0]?.goal, "Ticket courant");
});

test("reconstructAttemptsFromJournal filtre les tentatives d'autres missions", () => {
  const keptAttempt = createAttempt({
    id: "attempt_kept",
    ticketId: "ticket_kept",
  });
  const foreignAttempt = createAttempt({
    id: "attempt_foreign",
    ticketId: "ticket_foreign",
  });
  const events: JournalEventRecord[] = [
    {
      eventId: "event_attempt_kept",
      type: "execution.requested",
      missionId: "mission_reconstruct",
      ticketId: keptAttempt.ticketId,
      occurredAt: keptAttempt.startedAt,
      actor: "operator",
      source: "corp-cli",
      payload: { attempt: keptAttempt },
    },
    {
      eventId: "event_attempt_foreign",
      type: "execution.requested",
      missionId: "mission_other",
      ticketId: foreignAttempt.ticketId,
      occurredAt: foreignAttempt.startedAt,
      actor: "operator",
      source: "corp-cli",
      payload: { attempt: foreignAttempt },
    },
  ];

  const attempts = reconstructAttemptsFromJournal(events, "mission_reconstruct");

  assert.equal(attempts.length, 1);
  assert.equal(attempts[0]?.id, "attempt_kept");
});
