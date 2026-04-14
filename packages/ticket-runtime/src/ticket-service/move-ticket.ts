import { randomUUID } from "node:crypto";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readMissionResume } from "../../../mission-kernel/src/resume-service/read-mission-resume";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import {
  ensureMissionWorkspaceInitialized,
  requireText,
  requireTicketInMission,
  rewriteMissionReadModels,
} from "./ticket-service-support";

export type MoveTicketStrategy =
  | { type: "before-ticket"; referenceTicketId: string }
  | { type: "after-ticket"; referenceTicketId: string }
  | { type: "to-front" }
  | { type: "to-back" };

export interface MoveTicketOptions {
  rootDir: string;
  missionId?: string;
  ticketId?: string;
  strategy: MoveTicketStrategy;
}

export interface MoveTicketResult {
  mission: Mission;
  ticket: Ticket;
  event: JournalEventRecord;
  resume: MissionResume;
}

export async function moveTicket(
  options: MoveTicketOptions,
): Promise<MoveTicketResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, "ticket move");

  const missionId = requireText(
    options.missionId,
    "L'option --mission-id est obligatoire pour `corp mission ticket move`.",
  );
  const ticketId = requireText(
    options.ticketId,
    "L'option --ticket-id est obligatoire pour `corp mission ticket move`.",
  );
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  const storedTicket = await ticketRepository.findById(mission.id, ticketId);
  const ticket = requireTicketInMission(storedTicket, mission, ticketId);
  const previousOrder = [...mission.ticketIds];
  const nextOrder = await computeNextOrder(mission, ticket.id, options.strategy, ticketRepository);

  if (arraysEqual(previousOrder, nextOrder)) {
    throw new Error(`Le ticket \`${ticket.id}\` est deja a cette position.`);
  }

  const occurredAt = new Date().toISOString();
  const eventId = `event_${randomUUID()}`;
  const updatedTicket: Ticket = {
    ...ticket,
    eventIds: [...ticket.eventIds, eventId],
    updatedAt: occurredAt,
  };
  const updatedMission: Mission = {
    ...mission,
    ticketIds: nextOrder,
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const event: JournalEventRecord = {
    eventId,
    type: "ticket.reprioritized",
    missionId: mission.id,
    ticketId: ticket.id,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: updatedMission,
      ticket: updatedTicket,
      previousOrder: previousOrder.indexOf(ticket.id),
      nextOrder: nextOrder.indexOf(ticket.id),
      orderedTicketIds: [...nextOrder],
      trigger: "operator",
    },
  };

  await appendEvent(layout.journalPath, event);
  await ticketRepository.save(updatedTicket);
  await missionRepository.save(updatedMission);
  await rewriteMissionReadModels(layout, updatedMission, ticketRepository);

  const resumeResult = await readMissionResume({
    rootDir: layout.rootDir,
    missionId: updatedMission.id,
    commandName: "resume",
  });

  return {
    mission: updatedMission,
    ticket: updatedTicket,
    event,
    resume: resumeResult.resume,
  };
}

async function computeNextOrder(
  mission: Mission,
  ticketId: string,
  strategy: MoveTicketStrategy,
  ticketRepository: ReturnType<typeof createFileTicketRepository>,
): Promise<string[]> {
  const currentOrder = [...mission.ticketIds];
  const currentIndex = currentOrder.indexOf(ticketId);

  if (currentIndex < 0) {
    throw new Error(`Ticket introuvable dans la mission \`${mission.id}\`: \`${ticketId}\`.`);
  }

  if (
    (strategy.type === "before-ticket" || strategy.type === "after-ticket")
    && strategy.referenceTicketId === ticketId
  ) {
    throw new Error(`Le ticket \`${ticketId}\` ne peut pas etre deplace par rapport a lui-meme.`);
  }

  const orderWithoutTarget = currentOrder.filter((currentTicketId) => currentTicketId !== ticketId);

  if (strategy.type === "to-front") {
    return [ticketId, ...orderWithoutTarget];
  }

  if (strategy.type === "to-back") {
    return [...orderWithoutTarget, ticketId];
  }

  const referenceTicketId = strategy.referenceTicketId;
  const referenceIndex = orderWithoutTarget.indexOf(referenceTicketId);

  if (referenceIndex < 0) {
    const referenceMissionId = await ticketRepository.findOwningMissionId(referenceTicketId);

    if (referenceMissionId && referenceMissionId !== mission.id) {
      throw new Error(
        `Le ticket de reference \`${referenceTicketId}\` n'appartient pas a la mission \`${mission.id}\`.`,
      );
    }

    throw new Error(
      `Le ticket de reference \`${referenceTicketId}\` est introuvable dans la mission \`${mission.id}\`.`,
    );
  }

  const insertionIndex = strategy.type === "before-ticket"
    ? referenceIndex
    : referenceIndex + 1;

  return [
    ...orderWithoutTarget.slice(0, insertionIndex),
    ticketId,
    ...orderWithoutTarget.slice(insertionIndex),
  ];
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}
