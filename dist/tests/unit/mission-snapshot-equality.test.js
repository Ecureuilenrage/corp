"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const mission_1 = require("../../packages/contracts/src/mission/mission");
const file_mission_repository_1 = require("../../packages/storage/src/repositories/file-mission-repository");
function buildMission(overrides = {}) {
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
(0, node_test_1.default)("areMissionSnapshotsEqual considere egales deux missions construites dans des ordres de cles differents", () => {
    const reference = buildMission();
    // Simule une hydratation alternative : on reconstruit l'objet en inserant les cles
    // dans un ordre different, ce qui produit un JSON.stringify different en V8.
    const reversedRecord = {};
    const reversedKeys = Object.keys(reference).reverse();
    for (const key of reversedKeys) {
        reversedRecord[key] = reference[key];
    }
    const reversedInsertion = reversedRecord;
    const hydratedFromDisk = (0, mission_1.hydrateMission)(reference);
    const hydratedFromJournal = (0, mission_1.hydrateMission)(reversedInsertion);
    strict_1.default.notEqual(JSON.stringify(hydratedFromDisk), JSON.stringify(hydratedFromJournal), "Pre-condition du test: les deux missions doivent differer par l'ordre des cles.");
    strict_1.default.equal((0, file_mission_repository_1.areMissionSnapshotsEqual)(hydratedFromDisk, hydratedFromJournal), true);
});
(0, node_test_1.default)("areMissionSnapshotsEqual renvoie false quand une valeur differe reellement", () => {
    const reference = (0, mission_1.hydrateMission)(buildMission());
    const mutated = (0, mission_1.hydrateMission)(buildMission({ title: "Autre titre" }));
    strict_1.default.equal((0, file_mission_repository_1.areMissionSnapshotsEqual)(reference, mutated), false);
});
(0, node_test_1.default)("areMissionSnapshotsEqual preserve l'ordre des arrays (semantiquement ordonnes)", () => {
    const reference = (0, mission_1.hydrateMission)(buildMission({ eventIds: ["event_1", "event_2"] }));
    const reordered = (0, mission_1.hydrateMission)(buildMission({ eventIds: ["event_2", "event_1"] }));
    strict_1.default.equal((0, file_mission_repository_1.areMissionSnapshotsEqual)(reference, reordered), false);
});
(0, node_test_1.default)("areMissionSnapshotsEqual traite une cle undefined comme equivalente a une cle absente", () => {
    const withUndefined = {
        ...buildMission(),
        authorizedExtensions: undefined,
    };
    const { authorizedExtensions: _removed, ...withoutKey } = buildMission();
    strict_1.default.equal((0, file_mission_repository_1.areMissionSnapshotsEqual)(withUndefined, withoutKey), true);
});
(0, node_test_1.default)("areMissionSnapshotsEqual canonise Date et BigInt avant comparaison", () => {
    const left = {
        ...buildMission(),
        metadata: {
            generatedAt: new Date("2026-04-16T10:00:00.000Z"),
            revision: 7n,
        },
    };
    const right = {
        ...buildMission(),
        metadata: {
            generatedAt: "2026-04-16T10:00:00.000Z",
            revision: "7",
        },
    };
    strict_1.default.equal((0, file_mission_repository_1.areMissionSnapshotsEqual)(left, right), true);
});
(0, node_test_1.default)("areMissionSnapshotsEqual rejette Map et Set inattendus dans les snapshots mission", () => {
    const withMap = {
        ...buildMission(),
        metadata: {
            extensionMap: new Map([["shell.exec", true]]),
        },
    };
    const withSet = {
        ...buildMission(),
        metadata: {
            extensionSet: new Set(["shell.exec"]),
        },
    };
    strict_1.default.throws(() => (0, file_mission_repository_1.areMissionSnapshotsEqual)(withMap, buildMission()), /Map\/Set non supportes/i);
    strict_1.default.throws(() => (0, file_mission_repository_1.areMissionSnapshotsEqual)(buildMission(), withSet), /Map\/Set non supportes/i);
});
