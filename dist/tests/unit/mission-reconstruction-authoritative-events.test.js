"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const mission_reconstruction_1 = require("../../packages/journal/src/reconstruction/mission-reconstruction");
function createAuthoritativeMission(overrides = {}) {
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
(0, node_test_1.default)("reconstructMissionFromJournal ignore les events non autoritaires qui embarquent un champ mission", () => {
    const authoritative = createAuthoritativeMission({
        title: "Titre autoritaire",
        updatedAt: "2026-04-15T12:00:00.000Z",
    });
    const polluted = createAuthoritativeMission({
        title: "Titre pollue",
        updatedAt: "2026-04-15T13:00:00.000Z",
    });
    const events = [
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
    const reconstructed = (0, mission_reconstruction_1.reconstructMissionFromJournal)(events, authoritative.id);
    strict_1.default.equal(reconstructed.title, "Titre autoritaire");
    strict_1.default.equal(reconstructed.updatedAt, "2026-04-15T12:00:00.000Z");
});
(0, node_test_1.default)("reconstructMissionFromJournal applique skill_pack.used comme snapshot mission autoritaire", () => {
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
    const events = [
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
    const reconstructed = (0, mission_reconstruction_1.reconstructMissionFromJournal)(events, created.id);
    strict_1.default.equal(reconstructed.resumeCursor, "event_skill_pack_used");
    strict_1.default.deepEqual(reconstructed.eventIds, ["event_created", "event_skill_pack_used"]);
});
(0, node_test_1.default)("reconstructMissionFromJournal jette une erreur explicite quand tous les events sont non autoritaires", () => {
    const polluted = createAuthoritativeMission({ title: "Titre pollue" });
    const events = [
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
    strict_1.default.throws(() => (0, mission_reconstruction_1.reconstructMissionFromJournal)(events, polluted.id), /Journal mission irreconciliable pour mission_reconstruct\. Impossible de reconstruire la mission\./);
});
(0, node_test_1.default)("reconstructMissionFromJournal propage errorContextNoun pour preserver le wording historique de la commande resume", () => {
    const polluted = createAuthoritativeMission({ title: "Titre pollue" });
    const events = [
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
    strict_1.default.throws(() => (0, mission_reconstruction_1.reconstructMissionFromJournal)(events, polluted.id, {
        errorContextNoun: "la reprise",
    }), /Impossible de reconstruire la reprise\./);
});
