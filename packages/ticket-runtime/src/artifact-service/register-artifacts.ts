import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Artifact } from "../../../contracts/src/artifact/artifact";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import {
  resolveArtifactStoragePaths,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import {
  createFileArtifactRepository,
  type FileArtifactRepository,
} from "../../../storage/src/repositories/file-artifact-repository";
import {
  createFileMissionRepository,
  type FileMissionRepository,
} from "../../../storage/src/repositories/file-mission-repository";
import {
  createFileTicketRepository,
  type FileTicketRepository,
} from "../../../storage/src/repositories/file-ticket-repository";
import { rewriteMissionReadModels } from "../ticket-service/ticket-service-support";
import type { DetectedArtifactCandidate } from "./detect-ticket-artifacts";

export interface RegisterArtifactsResult {
  mission: Mission;
  ticket: Ticket;
  artifacts: Artifact[];
  events: JournalEventRecord[];
}

export async function registerArtifacts(options: {
  layout: WorkspaceLayout;
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  producingEvent: JournalEventRecord;
  trigger: string;
  detectedArtifacts: DetectedArtifactCandidate[];
  createArtifactId?: () => string;
  createEventId?: () => string;
  missionRepository?: FileMissionRepository;
  ticketRepository?: FileTicketRepository;
  artifactRepository?: FileArtifactRepository;
}): Promise<RegisterArtifactsResult> {
  if (options.detectedArtifacts.length === 0) {
    return {
      mission: options.mission,
      ticket: options.ticket,
      artifacts: [],
      events: [],
    };
  }

  const missionRepository = options.missionRepository
    ?? createFileMissionRepository(options.layout);
  const ticketRepository = options.ticketRepository
    ?? createFileTicketRepository(options.layout);
  const artifactRepository = options.artifactRepository
    ?? createFileArtifactRepository(options.layout);
  const createArtifactId = options.createArtifactId ?? (() => `artifact_${randomUUID()}`);
  const createEventId = options.createEventId ?? (() => `event_${randomUUID()}`);
  const createdArtifacts: Artifact[] = [];
  const createdEvents: JournalEventRecord[] = [];

  let currentMission = options.mission;
  let currentTicket = options.ticket;

  for (const detectedArtifact of options.detectedArtifacts) {
    const createdAt = new Date().toISOString();
    const artifactId = createArtifactId();
    const payloadPath = detectedArtifact.payload
      ? await persistArtifactPayload(
        options.layout,
        currentMission.id,
        currentTicket.id,
        artifactId,
        detectedArtifact.payload.fileName,
        detectedArtifact.payload.contents,
      )
      : undefined;
    const sha256 = detectedArtifact.sha256
      ?? (detectedArtifact.payload
        ? createHash("sha256").update(detectedArtifact.payload.contents).digest("hex")
        : undefined);
    const sizeBytes = detectedArtifact.sizeBytes
      ?? (detectedArtifact.payload
        ? Buffer.byteLength(detectedArtifact.payload.contents, "utf8")
        : undefined);
    const artifact: Artifact = {
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
    const detectedEvent: JournalEventRecord = {
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

    await appendEvent(options.layout.journalPath, detectedEvent);

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
    const registeredEvent: JournalEventRecord = {
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

    await appendEvent(options.layout.journalPath, registeredEvent);

    currentMission = missionAfterRegistration;
    currentTicket = ticketAfterRegistration;
    createdArtifacts.push(artifact);
    createdEvents.push(detectedEvent, registeredEvent);
  }

  await missionRepository.save(currentMission);
  await ticketRepository.save(currentTicket);
  await rewriteMissionReadModels(options.layout, currentMission, ticketRepository);

  return {
    mission: currentMission,
    ticket: currentTicket,
    artifacts: createdArtifacts,
    events: createdEvents,
  };
}

async function persistArtifactPayload(
  layout: WorkspaceLayout,
  missionId: string,
  ticketId: string,
  artifactId: string,
  fileName: string,
  contents: string,
): Promise<string> {
  const artifactStoragePaths = resolveArtifactStoragePaths(layout, missionId, ticketId, artifactId);
  const payloadAbsolutePath = path.join(artifactStoragePaths.artifactDir, fileName);

  await mkdir(artifactStoragePaths.artifactDir, { recursive: true });
  await writeFile(payloadAbsolutePath, contents, "utf8");

  return path.relative(layout.rootDir, payloadAbsolutePath).split(path.sep).join("/");
}
