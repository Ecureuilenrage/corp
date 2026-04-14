"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerArtifacts = registerArtifacts;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const append_event_1 = require("../../../journal/src/event-log/append-event");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_artifact_repository_1 = require("../../../storage/src/repositories/file-artifact-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const ticket_service_support_1 = require("../ticket-service/ticket-service-support");
async function registerArtifacts(options) {
    if (options.detectedArtifacts.length === 0) {
        return {
            mission: options.mission,
            ticket: options.ticket,
            artifacts: [],
            events: [],
        };
    }
    const missionRepository = options.missionRepository
        ?? (0, file_mission_repository_1.createFileMissionRepository)(options.layout);
    const ticketRepository = options.ticketRepository
        ?? (0, file_ticket_repository_1.createFileTicketRepository)(options.layout);
    const artifactRepository = options.artifactRepository
        ?? (0, file_artifact_repository_1.createFileArtifactRepository)(options.layout);
    const createArtifactId = options.createArtifactId ?? (() => `artifact_${(0, node_crypto_1.randomUUID)()}`);
    const createEventId = options.createEventId ?? (() => `event_${(0, node_crypto_1.randomUUID)()}`);
    const createdArtifacts = [];
    const createdEvents = [];
    let currentMission = options.mission;
    let currentTicket = options.ticket;
    for (const detectedArtifact of options.detectedArtifacts) {
        const createdAt = new Date().toISOString();
        const artifactId = createArtifactId();
        const payloadPath = detectedArtifact.payload
            ? await persistArtifactPayload(options.layout, currentMission.id, currentTicket.id, artifactId, detectedArtifact.payload.fileName, detectedArtifact.payload.contents)
            : undefined;
        const sha256 = detectedArtifact.sha256
            ?? (detectedArtifact.payload
                ? (0, node_crypto_1.createHash)("sha256").update(detectedArtifact.payload.contents).digest("hex")
                : undefined);
        const sizeBytes = detectedArtifact.sizeBytes
            ?? (detectedArtifact.payload
                ? Buffer.byteLength(detectedArtifact.payload.contents, "utf8")
                : undefined);
        const artifact = {
            id: artifactId,
            missionId: currentMission.id,
            ticketId: currentTicket.id,
            producingEventId: options.producingEvent.eventId,
            attemptId: options.attempt.id,
            workspaceIsolationId: options.attempt.workspaceIsolationId,
            kind: detectedArtifact.kind,
            title: detectedArtifact.title,
            createdAt,
            ...(detectedArtifact.label ? { label: detectedArtifact.label } : {}),
            ...(detectedArtifact.path ? { path: detectedArtifact.path } : {}),
            ...(detectedArtifact.mediaType ? { mediaType: detectedArtifact.mediaType } : {}),
            ...(detectedArtifact.summary ? { summary: detectedArtifact.summary } : {}),
            ...(payloadPath ? { payloadPath } : {}),
            ...(sha256 ? { sha256 } : {}),
            ...(typeof sizeBytes === "number" ? { sizeBytes } : {}),
        };
        await artifactRepository.save(artifact);
        const detectedAt = new Date().toISOString();
        const detectedEventId = createEventId();
        const missionAfterDetection = {
            ...currentMission,
            eventIds: [...currentMission.eventIds, detectedEventId],
            resumeCursor: detectedEventId,
            updatedAt: detectedAt,
        };
        const ticketAfterDetection = {
            ...currentTicket,
            eventIds: [...currentTicket.eventIds, detectedEventId],
            updatedAt: detectedAt,
        };
        const detectedEvent = {
            eventId: detectedEventId,
            type: "artifact.detected",
            missionId: currentMission.id,
            ticketId: currentTicket.id,
            attemptId: options.attempt.id,
            occurredAt: detectedAt,
            actor: "system",
            source: "ticket-runtime",
            payload: {
                artifact,
                producingEventId: options.producingEvent.eventId,
                sourceEventType: options.producingEvent.type,
                trigger: options.trigger,
                mission: missionAfterDetection,
                ticket: ticketAfterDetection,
            },
        };
        await (0, append_event_1.appendEvent)(options.layout.journalPath, detectedEvent);
        const registeredAt = new Date().toISOString();
        const registeredEventId = createEventId();
        const missionAfterRegistration = {
            ...missionAfterDetection,
            artifactIds: [...missionAfterDetection.artifactIds, artifact.id],
            eventIds: [...missionAfterDetection.eventIds, registeredEventId],
            resumeCursor: registeredEventId,
            updatedAt: registeredAt,
        };
        const ticketAfterRegistration = {
            ...ticketAfterDetection,
            artifactIds: [...ticketAfterDetection.artifactIds, artifact.id],
            eventIds: [...ticketAfterDetection.eventIds, registeredEventId],
            updatedAt: registeredAt,
        };
        const registeredEvent = {
            eventId: registeredEventId,
            type: "artifact.registered",
            missionId: currentMission.id,
            ticketId: currentTicket.id,
            attemptId: options.attempt.id,
            occurredAt: registeredAt,
            actor: "system",
            source: "ticket-runtime",
            payload: {
                artifact,
                producingEventId: options.producingEvent.eventId,
                sourceEventType: options.producingEvent.type,
                trigger: options.trigger,
                mission: missionAfterRegistration,
                ticket: ticketAfterRegistration,
            },
        };
        await (0, append_event_1.appendEvent)(options.layout.journalPath, registeredEvent);
        currentMission = missionAfterRegistration;
        currentTicket = ticketAfterRegistration;
        createdArtifacts.push(artifact);
        createdEvents.push(detectedEvent, registeredEvent);
    }
    await missionRepository.save(currentMission);
    await ticketRepository.save(currentTicket);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(options.layout, currentMission, ticketRepository);
    return {
        mission: currentMission,
        ticket: currentTicket,
        artifacts: createdArtifacts,
        events: createdEvents,
    };
}
async function persistArtifactPayload(layout, missionId, ticketId, artifactId, fileName, contents) {
    const artifactStoragePaths = (0, workspace_layout_1.resolveArtifactStoragePaths)(layout, missionId, ticketId, artifactId);
    const payloadAbsolutePath = node_path_1.default.join(artifactStoragePaths.artifactDir, fileName);
    await (0, promises_1.mkdir)(artifactStoragePaths.artifactDir, { recursive: true });
    await (0, promises_1.writeFile)(payloadAbsolutePath, contents, "utf8");
    return node_path_1.default.relative(layout.rootDir, payloadAbsolutePath).split(node_path_1.default.sep).join("/");
}
