import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import {
  isExecutionAttempt,
  isMission,
  isTicket,
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
const MISSION_AUTHORITATIVE_EVENT_TYPES: ReadonlySet<string> = new Set([
  // Cycle de vie mission
  "mission.created",
  "mission.paused",
  "mission.relaunched",
  "mission.completed",
  "mission.cancelled",
  "mission.extensions_selected",
  // Cycle de vie ticket (mettent a jour mission.ticketIds / updatedAt)
  "ticket.created",
  "ticket.updated",
  "ticket.reprioritized",
  "ticket.cancelled",
  "ticket.claimed",
  "ticket.in_progress",
  // Execution (mettent a jour mission.updatedAt, compteurs attempts)
  "workspace.isolation_created",
  "execution.requested",
  "execution.background_started",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
  // Usage d'extensions (mettent a jour mission.eventIds / resumeCursor)
  "skill_pack.used",
  // File d'approbation
  "approval.requested",
  "approval.approved",
  "approval.rejected",
  "approval.deferred",
  // Artefacts (mettent a jour mission.artifactIds / updatedAt)
  "artifact.detected",
  "artifact.registered",
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

    const payloadMission = (event.payload as Record<string, unknown>).mission;

    if (isMission(payloadMission) && payloadMission.id === missionId) {
      reconstructedMission = hydrateMission(payloadMission);
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
    const payloadTicket = (event.payload as Record<string, unknown>).ticket;

    if (isTicket(payloadTicket) && payloadTicket.missionId === missionId) {
      ticketsById.set(payloadTicket.id, payloadTicket);
    }
  }

  return [...ticketsById.values()];
}

export function reconstructAttemptsFromJournal(
  missionEvents: JournalEventRecord[],
): ExecutionAttempt[] {
  const attemptsById = new Map<string, ExecutionAttempt>();

  for (const event of missionEvents) {
    const payloadAttempt = (event.payload as Record<string, unknown>).attempt;

    if (isExecutionAttempt(payloadAttempt)) {
      attemptsById.set(payloadAttempt.id, payloadAttempt);
    }
  }

  return [...attemptsById.values()];
}
