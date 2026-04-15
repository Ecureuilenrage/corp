"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectMissionExtensions = selectMissionExtensions;
const node_crypto_1 = require("node:crypto");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_capability_registry_repository_1 = require("../../../storage/src/repositories/file-capability-registry-repository");
const file_skill_pack_registry_repository_1 = require("../../../storage/src/repositories/file-skill-pack-registry-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const ticket_service_support_1 = require("../../../ticket-runtime/src/ticket-service/ticket-service-support");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
async function selectMissionExtensions(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ticket_service_support_1.ensureMissionWorkspaceInitialized)(layout, "extension select");
    if (!hasAnyExtensionMutation(options)) {
        throw new Error("Aucune mutation demandee pour `corp mission extension select`.");
    }
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, "L'option --mission-id est obligatoire pour `corp mission extension select`.");
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const capabilityRegistryRepository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    const skillPackRegistryRepository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    ensureMissionAcceptsExtensionSelect(mission);
    const nextAuthorizedExtensions = resolveNextAuthorizedExtensions(mission, options);
    await assertMissionExtensionSelectionRegistered({
        capabilityRegistryRepository,
        skillPackRegistryRepository,
        authorizedExtensions: nextAuthorizedExtensions,
    });
    const changedFields = collectChangedFields(mission.authorizedExtensions, nextAuthorizedExtensions);
    if (changedFields.length === 0) {
        throw new Error(`Aucune mutation effective detectee pour la selection d'extensions de la mission \`${mission.id}\`.`);
    }
    const occurredAt = new Date().toISOString();
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const updatedMission = {
        ...mission,
        authorizedExtensions: nextAuthorizedExtensions,
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: "mission.extensions_selected",
        missionId: mission.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            previousAuthorizedExtensions: mission.authorizedExtensions,
            authorizedExtensions: updatedMission.authorizedExtensions,
            changedFields,
            trigger: "operator",
        },
    };
    // journal-as-source-of-truth : l'append precede la reconstruction des read-models ;
    // les deux s'executent dans la callback beforeSave de saveIfUnchanged pour fermer la
    // fenetre unlock->rewrite (AC2 de la story 5.1.1). Voir
    // docs/architecture/journal-as-source-of-truth.md.
    await missionRepository.saveIfUnchanged(updatedMission, mission, async () => {
        await (0, append_event_1.appendEvent)(layout.journalPath, event);
        await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, updatedMission, ticketRepository);
    });
    return {
        mission: updatedMission,
        event,
    };
}
function hasAnyExtensionMutation(options) {
    return options.allowedCapabilities.length > 0
        || options.clearAllowedCapabilities
        || options.skillPackRefs.length > 0
        || options.clearSkillPackRefs;
}
function resolveNextAuthorizedExtensions(mission, options) {
    return {
        allowedCapabilities: options.clearAllowedCapabilities
            ? []
            : options.allowedCapabilities.length > 0
                ? (0, ticket_service_support_1.normalizeOpaqueReferences)(options.allowedCapabilities)
                : [...mission.authorizedExtensions.allowedCapabilities],
        skillPackRefs: options.clearSkillPackRefs
            ? []
            : options.skillPackRefs.length > 0
                ? (0, ticket_service_support_1.normalizeOpaqueReferences)(options.skillPackRefs)
                : [...mission.authorizedExtensions.skillPackRefs],
    };
}
async function assertMissionExtensionSelectionRegistered(options) {
    for (const capabilityId of options.authorizedExtensions.allowedCapabilities) {
        if ((0, ticket_service_support_1.isBuiltInAllowedCapability)(capabilityId)) {
            throw new Error(`La capability built-in \`${capabilityId}\` reste hors selection mission. N'utilisez pas \`corp mission extension select\` pour les built-ins.`);
        }
        const capability = await options.capabilityRegistryRepository.findByCapabilityId(capabilityId);
        if (!capability) {
            throw new Error(`Capability introuvable dans le registre local: ${capabilityId}.`);
        }
    }
    for (const packRef of options.authorizedExtensions.skillPackRefs) {
        const skillPack = await options.skillPackRegistryRepository.findByPackRef(packRef);
        if (!skillPack) {
            throw new Error(`Skill pack introuvable dans le registre local: ${packRef}.`);
        }
    }
}
function collectChangedFields(previousAuthorizedExtensions, nextAuthorizedExtensions) {
    const changedFields = [];
    if (!(0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(previousAuthorizedExtensions.allowedCapabilities, nextAuthorizedExtensions.allowedCapabilities)) {
        changedFields.push("allowedCapabilities");
    }
    if (!(0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(previousAuthorizedExtensions.skillPackRefs, nextAuthorizedExtensions.skillPackRefs)) {
        changedFields.push("skillPackRefs");
    }
    return changedFields;
}
const TERMINAL_MISSION_STATUSES = new Set([
    "completed",
    "cancelled",
    "failed",
]);
function ensureMissionAcceptsExtensionSelect(mission) {
    if (TERMINAL_MISSION_STATUSES.has(mission.status)) {
        throw new Error(`Impossible de modifier la selection d'extensions de la mission \`${mission.id}\` car son statut est terminal (\`${mission.status}\`).`);
    }
}
