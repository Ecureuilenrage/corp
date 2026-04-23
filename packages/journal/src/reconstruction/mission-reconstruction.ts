import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import {
  attachStructuralValidationWarnings,
  validateExecutionAttempt,
  validateMission,
  validateTicket,
  type StructuralValidationWarning,
} from "../../../contracts/src/guards/persisted-document-guards";
import { hydrateMission, type Mission } from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../event-log/append-event";
import { isEventLogReadError } from "../event-log/event-log-errors";
import { readEventLog } from "../event-log/file-event-log";

export async function readMissionEvents(
  journalPath: string,
  missionId: string,
): Promise<JournalEventRecord[]> {
  return (await readEventLog(journalPath)).filter((event) => event.missionId === missionId);
}

export interface ReconstructMissionOptions {
  // Nom du contexte insere dans "Impossible de reconstruire X." Permet aux callers
  // de preserver leur surface d'erreur historique (ex. "la reprise" pour le flow
  // resume depuis la story 5.1). Par defaut : "la mission".
  errorContextNoun?: string;
}

export interface MissionAuthoritativeCursor {
  occurredAt: string;
  eventId: string;
}

export async function readMissionFromJournal(
  journalPath: string,
  missionId: string,
  options: ReconstructMissionOptions = {},
): Promise<Mission> {
  return reconstructMissionFromJournal(
    await readMissionEvents(journalPath, missionId),
    missionId,
    options,
  );
}

export async function readMissionSnapshotFromJournalOrThrow(
  journalPath: string,
  missionId: string,
): Promise<Mission> {
  try {
    return await readMissionFromJournal(journalPath, missionId);
  } catch (error) {
    if (isEventLogReadError(error)) {
      throw error;
    }

    throw new Error(`Mission introuvable: ${missionId}.`);
  }
}

// Allow-list exhaustive des types d'event dont `payload.mission` porte l'etat mission
// autoritaire post-transition. Tout nouveau type d'event qui embarque une mission mise
// a jour DOIT etre ajoute ici, sinon l'etat reconstruit sera obsolete. Les payloads
// qui embarquent une mission a des fins historiques (ex. champ `previousMission`) ne
// doivent PAS etre inclus : seul `payload.mission` est lu.
export const MISSION_AUTHORITATIVE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "mission.created",
  "mission.paused",
  "mission.relaunched",
  "mission.completed",
  "mission.cancelled",
  "mission.extensions_selected",
  "ticket.created",
  "ticket.updated",
  "ticket.reprioritized",
  "ticket.cancelled",
  "ticket.claimed",
  "ticket.in_progress",
  "workspace.isolation_created",
  "execution.requested",
  "execution.background_started",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "skill_pack.used",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "approval.deferred",
  "artifact.detected",
  "artifact.registered",
]);

export const TICKET_AUTHORITATIVE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "ticket.created",
  "ticket.updated",
  "ticket.reprioritized",
  "ticket.cancelled",
  "ticket.claimed",
  "ticket.in_progress",
  "execution.requested",
  "execution.background_started",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "approval.deferred",
]);

export const ATTEMPT_AUTHORITATIVE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "execution.requested",
  "ticket.in_progress",
  "execution.background_started",
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "approval.deferred",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
]);

export function reconstructMissionFromJournal(
  missionEvents: JournalEventRecord[],
  missionId: string,
  options: ReconstructMissionOptions = {},
): Mission {
  let reconstructedMission: Mission | null = null;

  for (const event of missionEvents) {
    if (!MISSION_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
      continue;
    }

    const payloadMission = readPayloadRecord(event.payload, "mission");
    const nextMission = payloadMission
      ? tryReadMissionSnapshot(payloadMission, missionId)
      : null;

    if (nextMission) {
      reconstructedMission = nextMission;
    }
  }

  if (!reconstructedMission) {
    const errorContextNoun = options.errorContextNoun ?? "la mission";
    throw new Error(
      `Journal mission irreconciliable pour ${missionId}. Impossible de reconstruire ${errorContextNoun}.`,
    );
  }

  return reconstructedMission;
}

export function reconstructTicketsFromJournal(
  missionEvents: JournalEventRecord[],
  missionId: string,
): Ticket[] {
  const ticketsById = new Map<string, Ticket>();

  for (const event of missionEvents) {
    if (event.missionId !== missionId || !TICKET_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
      continue;
    }

    const payloadTicket = readPayloadRecord(event.payload, "ticket");
    const nextTicket = payloadTicket
      ? tryReadTicketSnapshot(payloadTicket, missionId)
      : null;

    if (nextTicket) {
      ticketsById.set(nextTicket.id, nextTicket);
    }
  }

  return [...ticketsById.values()];
}

export function reconstructAttemptsFromJournal(
  missionEvents: JournalEventRecord[],
  missionId: string,
): ExecutionAttempt[] {
  const attemptsById = new Map<string, ExecutionAttempt>();

  for (const event of missionEvents) {
    if (event.missionId !== missionId || !ATTEMPT_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
      continue;
    }

    const payloadAttempt = readPayloadRecord(event.payload, "attempt");
    const nextAttempt = payloadAttempt ? tryReadAttemptSnapshot(payloadAttempt) : null;

    if (nextAttempt) {
      attemptsById.set(nextAttempt.id, nextAttempt);
    }
  }

  return [...attemptsById.values()];
}

export function getLastAuthoritativeMissionCursor(
  missionEvents: JournalEventRecord[],
): MissionAuthoritativeCursor | null {
  for (let index = missionEvents.length - 1; index >= 0; index -= 1) {
    const event = missionEvents[index];

    if (!event || !MISSION_AUTHORITATIVE_EVENT_TYPES.has(event.type)) {
      continue;
    }

    const payloadMission = readPayloadRecord(event.payload, "mission");

    if (!payloadMission) {
      continue;
    }

    const warnings: StructuralValidationWarning[] = [];
    const validation = validateMission(payloadMission, {
      strict: false,
      warnings,
    });

    if (!validation.ok) {
      continue;
    }

    return {
      occurredAt: event.occurredAt,
      eventId: event.eventId,
    };
  }

  return null;
}

function tryReadMissionSnapshot(
  candidate: Record<string, unknown>,
  missionId: string,
): Mission | null {
  const warnings: StructuralValidationWarning[] = [];
  const validation = validateMission(candidate, { strict: false, warnings });

  if (!validation.ok || candidate.id !== missionId) {
    return null;
  }

  return attachStructuralValidationWarnings(
    hydrateMission(candidate as unknown as Mission),
    warnings,
  );
}

function tryReadTicketSnapshot(
  candidate: Record<string, unknown>,
  missionId: string,
): Ticket | null {
  const warnings: StructuralValidationWarning[] = [];
  const validation = validateTicket(candidate, { strict: false, warnings });

  if (!validation.ok || candidate.missionId !== missionId) {
    return null;
  }

  return attachStructuralValidationWarnings(candidate as unknown as Ticket, warnings);
}

function tryReadAttemptSnapshot(
  candidate: Record<string, unknown>,
): ExecutionAttempt | null {
  const warnings: StructuralValidationWarning[] = [];
  const validation = validateExecutionAttempt(candidate, { strict: false, warnings });

  if (!validation.ok) {
    return null;
  }

  return attachStructuralValidationWarnings(
    candidate as unknown as ExecutionAttempt,
    warnings,
  );
}

function readPayloadRecord(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const candidate = payload[key];
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null;
}
