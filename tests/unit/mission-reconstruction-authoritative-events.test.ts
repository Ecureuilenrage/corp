import assert from "node:assert/strict";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import { reconstructMissionFromJournal } from "../../packages/journal/src/reconstruction/mission-reconstruction";

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
