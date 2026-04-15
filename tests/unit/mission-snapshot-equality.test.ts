import assert from "node:assert/strict";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import { hydrateMission } from "../../packages/contracts/src/mission/mission";
import { areMissionSnapshotsEqual } from "../../packages/storage/src/repositories/file-mission-repository";

function buildMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_abc",
    title: "Mission test",
    objective: "Comparer deux snapshots",
    status: "ready",
    successCriteria: ["critere A"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: ["shell.exec"],
      skillPackRefs: ["pack.triage.local"],
    },
    ticketIds: ["ticket_1"],
    artifactIds: [],
    eventIds: ["event_1"],
    resumeCursor: "event_1",
    createdAt: "2026-04-15T10:00:00.000Z",
    updatedAt: "2026-04-15T10:00:00.000Z",
    ...overrides,
  };
}

test("areMissionSnapshotsEqual considere egales deux missions construites dans des ordres de cles differents", () => {
  const reference = buildMission();

  // Simule une hydratation alternative : on reconstruit l'objet en inserant les cles
  // dans un ordre different, ce qui produit un JSON.stringify different en V8.
  const reversedRecord: Record<string, unknown> = {};
  const reversedKeys = Object.keys(reference).reverse();
  for (const key of reversedKeys) {
    reversedRecord[key] = (reference as unknown as Record<string, unknown>)[key];
  }
  const reversedInsertion = reversedRecord as unknown as Mission;

  const hydratedFromDisk = hydrateMission(reference);
  const hydratedFromJournal = hydrateMission(reversedInsertion);

  assert.notEqual(
    JSON.stringify(hydratedFromDisk),
    JSON.stringify(hydratedFromJournal),
    "Pre-condition du test: les deux missions doivent differer par l'ordre des cles.",
  );

  assert.equal(areMissionSnapshotsEqual(hydratedFromDisk, hydratedFromJournal), true);
});

test("areMissionSnapshotsEqual renvoie false quand une valeur differe reellement", () => {
  const reference = hydrateMission(buildMission());
  const mutated = hydrateMission(buildMission({ title: "Autre titre" }));

  assert.equal(areMissionSnapshotsEqual(reference, mutated), false);
});

test("areMissionSnapshotsEqual preserve l'ordre des arrays (semantiquement ordonnes)", () => {
  const reference = hydrateMission(buildMission({ eventIds: ["event_1", "event_2"] }));
  const reordered = hydrateMission(buildMission({ eventIds: ["event_2", "event_1"] }));

  assert.equal(areMissionSnapshotsEqual(reference, reordered), false);
});
