import assert from "node:assert/strict";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { MissionAuthoritativeCursor } from "../../packages/journal/src/reconstruction/mission-reconstruction";
import { selectFreshMissionSnapshot } from "../../packages/ticket-runtime/src/planner/read-ticket-board";

function createMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_snapshot",
    title: "Mission snapshot",
    objective: "Choisir le snapshot le plus frais",
    status: "running",
    successCriteria: ["Le bon snapshot est retenu"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: [],
    artifactIds: [],
    eventIds: ["event_001"],
    resumeCursor: "event_001",
    createdAt: "2026-04-16T10:00:00.000Z",
    updatedAt: "2026-04-16T10:00:00.000Z",
    ...overrides,
  };
}

test("selectFreshMissionSnapshot conserve le snapshot disque si les events plus recents ne sont pas autoritaires", () => {
  const storedMission = createMission({
    title: "Snapshot disque plus frais",
    resumeCursor: "event_custom_999",
    updatedAt: "2026-04-16T10:10:00.000Z",
  });
  const missionFromJournal = createMission({
    title: "Snapshot journal plus ancien",
    resumeCursor: "event_authoritative_100",
    updatedAt: "2026-04-16T10:05:00.000Z",
  });
  const lastAuthoritativeCursor: MissionAuthoritativeCursor = {
    occurredAt: "2026-04-16T10:05:00.000Z",
    eventId: "event_authoritative_100",
  };

  assert.strictEqual(
    selectFreshMissionSnapshot(
      storedMission,
      missionFromJournal,
      lastAuthoritativeCursor,
    ),
    storedMission,
  );
});

test("selectFreshMissionSnapshot utilise eventId en tie-break quand les timestamps autoritaires sont egaux", () => {
  const storedMission = createMission({
    title: "Snapshot disque",
    resumeCursor: "event_010",
    updatedAt: "2026-04-16T10:15:00.000Z",
  });
  const missionFromJournal = createMission({
    title: "Snapshot journal gagne au tie-break",
    resumeCursor: "event_020",
    updatedAt: "2026-04-16T10:15:00.000Z",
  });
  const lastAuthoritativeCursor: MissionAuthoritativeCursor = {
    occurredAt: "2026-04-16T10:15:00.000Z",
    eventId: "event_020",
  };

  assert.strictEqual(
    selectFreshMissionSnapshot(
      storedMission,
      missionFromJournal,
      lastAuthoritativeCursor,
    ),
    missionFromJournal,
  );
});
