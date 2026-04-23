"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
const node_crypto_1 = require("node:crypto");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const read_mission_resume_1 = require("../../../mission-kernel/src/resume-service/read-mission-resume");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const validate_ticket_dependencies_1 = require("../dependency-graph/validate-ticket-dependencies");
const ensure_mission_workspace_1 = require("../../../mission-kernel/src/mission-service/ensure-mission-workspace");
const ticket_service_support_1 = require("./ticket-service-support");
async function createTicket(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ensure_mission_workspace_1.ensureMissionWorkspaceInitialized)(layout, {
        commandLabel: "ticket create",
        cleanupLocks: true,
    });
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, "L'option --mission-id est obligatoire pour `corp mission ticket create`.");
    const kind = (0, ticket_service_support_1.requireTicketKind)(options.kind);
    const goal = (0, ticket_service_support_1.requireText)(options.goal, "L'option --goal est obligatoire pour `corp mission ticket create`.");
    const owner = (0, ticket_service_support_1.requireText)(options.owner, "L'option --owner est obligatoire pour `corp mission ticket create`.");
    const successCriteria = (0, ticket_service_support_1.requireCreateSuccessCriteria)(options.successCriteria);
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    ensureMissionAcceptsNewTicket(mission);
    const missionTickets = await ticketRepository.listByMissionId(mission.id);
    const dependsOn = await (0, validate_ticket_dependencies_1.validateAndNormalizeTicketDependencies)({
        missionId: mission.id,
        ticketRepository,
        missionTickets,
        dependsOn: options.dependsOn,
    });
    const allowedCapabilities = (0, ticket_service_support_1.normalizeOpaqueReferences)(options.allowedCapabilities, {
        caseInsensitive: true,
    });
    const skillPackRefs = (0, ticket_service_support_1.normalizeOpaqueReferences)(options.skillPackRefs, {
        caseInsensitive: true,
    });
    (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
        mission,
        allowedCapabilities,
        skillPackRefs,
    });
    const occurredAt = new Date().toISOString();
    const ticketId = `ticket_${(0, node_crypto_1.randomUUID)()}`;
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const ticket = {
        id: ticketId,
        missionId: mission.id,
        kind,
        goal,
        status: "todo",
        owner,
        dependsOn,
        successCriteria,
        allowedCapabilities,
        skillPackRefs,
        workspaceIsolationId: null,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: [eventId],
        createdAt: occurredAt,
        updatedAt: occurredAt,
    };
    const updatedMission = {
        ...mission,
        ticketIds: [...mission.ticketIds, ticket.id],
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const event = {
        eventId,
        type: "ticket.created",
        missionId: mission.id,
        ticketId: ticket.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            ticket,
        },
    };
    await (0, append_event_1.appendEvent)(layout.journalPath, event);
    const ticketLocation = await ticketRepository.save(ticket);
    const missionLocation = await missionRepository.save(updatedMission);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(layout, updatedMission, ticketRepository, {
        skipArtifactIndex: true,
    });
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
        rootDir: layout.rootDir,
        missionId: updatedMission.id,
        commandName: "resume",
    });
    return {
        mission: updatedMission,
        ticket,
        event,
        missionDir: missionLocation.missionDir,
        missionPath: missionLocation.missionPath,
        ticketDir: ticketLocation.ticketDir,
        ticketPath: ticketLocation.ticketPath,
        resume: resumeResult.resume,
    };
}
function ensureMissionAcceptsNewTicket(mission) {
    if (mission.status === "completed" || mission.status === "cancelled" || mission.status === "failed") {
        throw new Error(`Impossible de creer un ticket dans la mission \`${mission.id}\` car son statut est terminal (\`${mission.status}\`).`);
    }
}
