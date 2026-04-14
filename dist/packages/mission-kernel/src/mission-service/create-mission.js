"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMission = createMission;
const promises_1 = require("node:fs/promises");
const node_crypto_1 = require("node:crypto");
const mission_1 = require("../../../contracts/src/mission/mission");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const audit_log_projection_1 = require("../../../journal/src/projections/audit-log-projection");
const default_projections_1 = require("../../../journal/src/projections/default-projections");
const mission_status_projection_1 = require("../../../journal/src/projections/mission-status-projection");
const resume_view_projection_1 = require("../../../journal/src/projections/resume-view-projection");
const file_projection_store_1 = require("../../../storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
async function createMission(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await ensureMissionWorkspaceInitialized(layout);
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
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "mission-status", (0, mission_status_projection_1.createMissionStatusProjection)(mission));
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "resume-view", (0, resume_view_projection_1.createResumeViewProjection)(mission));
    await (0, file_projection_store_1.writeProjectionSnapshot)(layout.projectionsDir, "audit-log", (0, audit_log_projection_1.createAuditLogProjection)({
        mission,
        tickets: [],
        artifacts: [],
        events: [event],
    }));
    return {
        mission,
        missionDir: missionLocation.missionDir,
        missionPath: missionLocation.missionPath,
        event,
    };
}
async function ensureMissionWorkspaceInitialized(layout) {
    try {
        await (0, promises_1.access)(layout.journalPath);
        for (const projectionName of Object.keys(default_projections_1.DEFAULT_PROJECTIONS)) {
            await (0, promises_1.access)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, projectionName));
        }
    }
    catch {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission create\`.`);
    }
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
