import { randomUUID } from "node:crypto";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readMissionResume } from "../../../mission-kernel/src/resume-service/read-mission-resume";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { validateAndNormalizeTicketDependencies } from "../dependency-graph/validate-ticket-dependencies";
import {
  ensureTicketExtensionsAllowedByMission,
  ensureMissionWorkspaceInitialized,
  normalizeOpaqueReferences,
  requireCreateSuccessCriteria,
  requireText,
  requireTicketKind,
  rewriteMissionReadModels,
} from "./ticket-service-support";

export interface CreateTicketOptions {
  rootDir: string;
  missionId?: string;
  kind?: string;
  goal?: string;
  owner?: string;
  dependsOn: string[];
  successCriteria: string[];
  allowedCapabilities: string[];
  skillPackRefs: string[];
}

export interface CreateTicketResult {
  mission: Mission;
  ticket: Ticket;
  event: JournalEventRecord;
  missionDir: string;
  missionPath: string;
  ticketDir: string;
  ticketPath: string;
  resume: MissionResume;
}

export async function createTicket(
  options: CreateTicketOptions,
): Promise<CreateTicketResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, "ticket create");

  const missionId = requireText(
    options.missionId,
    "L'option --mission-id est obligatoire pour `corp mission ticket create`.",
  );
  const kind = requireTicketKind(options.kind);
  const goal = requireText(
    options.goal,
    "L'option --goal est obligatoire pour `corp mission ticket create`.",
  );
  const owner = requireText(
    options.owner,
    "L'option --owner est obligatoire pour `corp mission ticket create`.",
  );
  const successCriteria = requireCreateSuccessCriteria(options.successCriteria);

  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  ensureMissionAcceptsNewTicket(mission);
  const missionTickets = await ticketRepository.listByMissionId(mission.id);

  const dependsOn = await validateAndNormalizeTicketDependencies({
    missionId: mission.id,
    ticketRepository,
    missionTickets,
    dependsOn: options.dependsOn,
  });
  const allowedCapabilities = normalizeOpaqueReferences(options.allowedCapabilities);
  const skillPackRefs = normalizeOpaqueReferences(options.skillPackRefs);

  ensureTicketExtensionsAllowedByMission({
    mission,
    allowedCapabilities,
    skillPackRefs,
  });

  const occurredAt = new Date().toISOString();
  const ticketId = `ticket_${randomUUID()}`;
  const eventId = `event_${randomUUID()}`;

  const ticket: Ticket = {
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
  const updatedMission: Mission = {
    ...mission,
    ticketIds: [...mission.ticketIds, ticket.id],
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const event: JournalEventRecord = {
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

  await appendEvent(layout.journalPath, event);

  const ticketLocation = await ticketRepository.save(ticket);
  const missionLocation = await missionRepository.save(updatedMission);
  await rewriteMissionReadModels(layout, updatedMission, ticketRepository, {
    skipArtifactIndex: true,
  });

  const resumeResult = await readMissionResume({
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

function ensureMissionAcceptsNewTicket(mission: Mission): void {
  if (mission.status === "completed" || mission.status === "cancelled" || mission.status === "failed") {
    throw new Error(
      `Impossible de creer un ticket dans la mission \`${mission.id}\` car son statut est terminal (\`${mission.status}\`).`,
    );
  }
}
