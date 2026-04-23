import { randomUUID } from "node:crypto";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import {
  TERMINAL_TICKET_STATUSES,
  type Ticket,
} from "../../../contracts/src/ticket/ticket";
import {
  ACTIVE_EXECUTION_ATTEMPT_STATUSES,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readMissionResume } from "../../../mission-kernel/src/resume-service/read-mission-resume";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { createFileExecutionAttemptRepository } from "../../../storage/src/repositories/file-execution-attempt-repository";
import { ensureMissionWorkspaceInitialized } from "../../../mission-kernel/src/mission-service/ensure-mission-workspace";
import {
  requireText,
  requireTicketInMission,
  rewriteMissionReadModels,
} from "./ticket-service-support";

export interface CancelTicketOptions {
  rootDir: string;
  missionId?: string;
  ticketId?: string;
  reason?: string;
}

export interface CancelTicketResult {
  mission: Mission;
  ticket: Ticket;
  event: JournalEventRecord;
  resume: MissionResume;
}

const TERMINAL_TICKET_STATUS_SET = new Set<string>(TERMINAL_TICKET_STATUSES);

export async function cancelTicket(
  options: CancelTicketOptions,
): Promise<CancelTicketResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, {
    commandLabel: "ticket cancel",
    cleanupLocks: true,
  });

  const missionId = requireText(
    options.missionId,
    "L'option --mission-id est obligatoire pour `corp mission ticket cancel`.",
  );
  const ticketId = requireText(
    options.ticketId,
    "L'option --ticket-id est obligatoire pour `corp mission ticket cancel`.",
  );
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  const storedTicket = await ticketRepository.findById(mission.id, ticketId);
  const ticket = requireTicketInMission(storedTicket, mission, ticketId);

  if (TERMINAL_TICKET_STATUS_SET.has(ticket.status)) {
    throw new Error(formatTerminalCancelError(ticket));
  }

  if (ticket.status === "in_progress") {
    const attemptRepository = createFileExecutionAttemptRepository(layout);
    const activeAttempt = await attemptRepository.findActiveByTicketId(mission.id, ticket.id);

    if (activeAttempt) {
      throw new Error(
        `Le ticket \`${ticket.id}\` est en cours d'execution (attempt: \`${activeAttempt.id}\`). Annulation refusee.`,
      );
    }
  }

  const occurredAt = new Date().toISOString();
  const eventId = `event_${randomUUID()}`;
  const normalizedReason = options.reason?.trim() || undefined;
  const updatedTicket: Ticket = {
    ...ticket,
    status: "cancelled",
    eventIds: [...ticket.eventIds, eventId],
    updatedAt: occurredAt,
  };
  const updatedMission: Mission = {
    ...mission,
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const event: JournalEventRecord = {
    eventId,
    type: "ticket.cancelled",
    missionId: mission.id,
    ticketId: ticket.id,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: updatedMission,
      ticket: updatedTicket,
      previousStatus: ticket.status,
      trigger: "operator",
      ...(normalizedReason ? { reason: normalizedReason } : {}),
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

function formatTerminalCancelError(ticket: Ticket): string {
  if (ticket.status === "done") {
    return `Le ticket ${ticket.id} est deja termine (statut: done).`;
  }

  if (ticket.status === "failed") {
    return `Le ticket ${ticket.id} est deja en echec (statut: failed).`;
  }

  return `Le ticket ${ticket.id} est deja annule.`;
}
