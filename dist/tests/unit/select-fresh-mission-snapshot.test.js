"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const read_ticket_board_1 = require("../../packages/ticket-runtime/src/planner/read-ticket-board");
function createMission(overrides = {}) {
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
(0, node_test_1.default)("selectFreshMissionSnapshot conserve le snapshot disque si les events plus recents ne sont pas autoritaires", () => {
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
    const lastAuthoritativeCursor = {
        occurredAt: "2026-04-16T10:05:00.000Z",
        eventId: "event_authoritative_100",
    };
    strict_1.default.strictEqual((0, read_ticket_board_1.selectFreshMissionSnapshot)(storedMission, missionFromJournal, lastAuthoritativeCursor), storedMission);
});
(0, node_test_1.default)("selectFreshMissionSnapshot utilise eventId en tie-break quand les timestamps autoritaires sont egaux", () => {
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
    const lastAuthoritativeCursor = {
        occurredAt: "2026-04-16T10:15:00.000Z",
        eventId: "event_020",
    };
    strict_1.default.strictEqual((0, read_ticket_board_1.selectFreshMissionSnapshot)(storedMission, missionFromJournal, lastAuthoritativeCursor), missionFromJournal);
});
