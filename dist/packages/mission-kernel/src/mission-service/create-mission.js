"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMission = createMission;
const node_crypto_1 = require("node:crypto");
const mission_1 = require("../../../contracts/src/mission/mission");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const ticket_service_support_1 = require("../../../ticket-runtime/src/ticket-service/ticket-service-support");
const ensure_mission_workspace_1 = require("./ensure-mission-workspace");
async function createMission(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: "create",
        cleanupLocks: true,
    });
    const title = requireText(options.title, "Le titre de mission est obligatoire.");
    const objective = requireText(options.objective, "L'objectif de mission est obligatoire.");
    const successCriteria = requireSuccessCriteria(options.successCriteria);
    const policyProfileId = requireText(options.policyProfileId, "Le policy profile initial est obligatoire.");
    const occurredAt = new Date().toISOString();
    const missionId = `mission_${(0, node_crypto_1.randomUUID)()}`;
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const mission = {
        id: missionId,
        title,
        objective,
        status: "ready",
        successCriteria,
        policyProfileId,
        authorizedExtensions: (0, mission_1.createEmptyMissionAuthorizedExtensions)(),
        ticketIds: [],
        artifactIds: [],
        eventIds: [eventId],
        resumeCursor: eventId,
        createdAt: occurredAt,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: "mission.created",
        missionId,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission,
        },
    };
    await (0, append_event_1.appendEvent)(layout.journalPath, event);
    const repository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const missionLocation = await repository.save(mission);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, mission, ticketRepository);
    return {
        mission,
        missionDir: missionLocation.missionDir,
        missionPath: missionLocation.missionPath,
        event,
    };
}
function requireText(value, errorMessage) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
        throw new Error(errorMessage);
    }
    return normalizedValue;
}
function requireSuccessCriteria(successCriteria) {
    const normalizedCriteria = successCriteria
        .map((criterion) => criterion.trim())
        .filter((criterion) => criterion.length > 0);
    if (normalizedCriteria.length === 0) {
        throw new Error("Au moins un critere de succes est obligatoire.");
    }
    return normalizedCriteria;
}
