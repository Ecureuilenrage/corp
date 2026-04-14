import { randomUUID } from "node:crypto";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import {
  NON_UPDATABLE_TICKET_STATUSES,
  type Ticket,
} from "../../../contracts/src/ticket/ticket";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readMissionResume } from "../../../mission-kernel/src/resume-service/read-mission-resume";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { validateAndNormalizeTicketDependencies } from "../dependency-graph/validate-ticket-dependencies";
import {
  deepStrictEqualForComparison,
  deepStrictEqualIgnoringArrayOrder,
} from "../utils/structural-compare";
import {
  ensureTicketExtensionsAllowedByMission,
  ensureMissionWorkspaceInitialized,
  normalizeOpaqueReferences,
  normalizeUpdatedSuccessCriteria,
  requireText,
  requireTicketInMission,
  rewriteMissionReadModels,
} from "./ticket-service-support";

export interface UpdateTicketOptions {
  rootDir: string;
  missionId?: string;
  ticketId?: string;
  goal?: string;
  owner?: string;
  status?: string;
  successCriteria: string[];
  dependsOn: string[];
  clearDependsOn: boolean;
  allowedCapabilities: string[];
  clearAllowedCapabilities: boolean;
  skillPackRefs: string[];
  clearSkillPackRefs: boolean;
}

export interface UpdateTicketResult {
  mission: Mission;
  ticket: Ticket;
  event: JournalEventRecord;
  resume: MissionResume;
}

const NON_UPDATABLE_TICKET_STATUS_SET = new Set<string>(NON_UPDATABLE_TICKET_STATUSES);
const UPDATABLE_TICKET_FIELDS = [
  "goal",
  "owner",
  "successCriteria",
  "dependsOn",
  "allowedCapabilities",
  "skillPackRefs",
] as const;

export async function updateTicket(
  options: UpdateTicketOptions,
): Promise<UpdateTicketResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, "ticket update");

  const missionId = requireText(
    options.missionId,
    "L'option --mission-id est obligatoire pour `corp mission ticket update`.",
  );
  const ticketId = requireText(
    options.ticketId,
    "L'option --ticket-id est obligatoire pour `corp mission ticket update`.",
  );
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  const storedTicket = await ticketRepository.findById(mission.id, ticketId);
  const ticket = requireTicketInMission(storedTicket, mission, ticketId);

  if (options.status !== undefined && options.status !== ticket.status) {
    throw new Error(
      `Le statut du ticket ${ticket.id} ne peut pas etre modifie via \`corp mission ticket update\`. `
      + "Utilisez les commandes de transition dediees.",
    );
  }

  if (NON_UPDATABLE_TICKET_STATUS_SET.has(ticket.status)) {
    throw new Error(formatNonUpdatableStatusError(ticket));
  }

  const missionTickets = await ticketRepository.listByMissionId(mission.id);
  const nextGoal = options.goal !== undefined
    ? requireText(options.goal, "L'option --goal ne peut pas etre vide pour `corp mission ticket update`.")
    : ticket.goal;
  const nextOwner = options.owner !== undefined
    ? requireText(options.owner, "L'option --owner ne peut pas etre vide pour `corp mission ticket update`.")
    : ticket.owner;
  const nextSuccessCriteria = options.successCriteria.length > 0
    ? normalizeUpdatedSuccessCriteria(options.successCriteria)
    : ticket.successCriteria;
  const nextDependsOn = options.clearDependsOn
    ? []
    : options.dependsOn.length > 0
      ? await validateAndNormalizeTicketDependencies({
        missionId: mission.id,
        ticketRepository,
        missionTickets,
        dependsOn: options.dependsOn,
        targetTicketId: ticket.id,
      })
      : ticket.dependsOn;
  const nextAllowedCapabilities = options.clearAllowedCapabilities
    ? []
    : options.allowedCapabilities.length > 0
      ? normalizeOpaqueReferences(options.allowedCapabilities)
      : ticket.allowedCapabilities;
  const nextSkillPackRefs = options.clearSkillPackRefs
    ? []
    : options.skillPackRefs.length > 0
      ? normalizeOpaqueReferences(options.skillPackRefs)
      : ticket.skillPackRefs;
  const normalizedTicket: Ticket = {
    ...ticket,
    goal: nextGoal,
    owner: nextOwner,
    successCriteria: nextSuccessCriteria,
    dependsOn: nextDependsOn,
    allowedCapabilities: nextAllowedCapabilities,
    skillPackRefs: nextSkillPackRefs,
  };

  ensureTicketExtensionsAllowedByMission({
    mission,
    allowedCapabilities: normalizedTicket.allowedCapabilities,
    skillPackRefs: normalizedTicket.skillPackRefs,
  });

  if (!hasEffectiveTicketMutation(ticket, normalizedTicket)) {
    throw new Error(`Aucune mutation effective detectee pour le ticket \`${ticket.id}\`.`);
  }

  const changedFields = collectChangedFields(ticket, normalizedTicket);
  const occurredAt = new Date().toISOString();
  const eventId = `event_${randomUUID()}`;
  const updatedTicket: Ticket = {
    ...normalizedTicket,
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
    type: "ticket.updated",
    missionId: mission.id,
    ticketId: ticket.id,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: updatedMission,
      ticket: updatedTicket,
      previousTicket: ticket,
      changedFields,
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

function formatNonUpdatableStatusError(ticket: Ticket): string {
  return `Le ticket ${ticket.id} ne peut pas etre modifie dans son statut actuel (statut: ${ticket.status}). `
    + "Seuls les tickets en statut todo peuvent etre mis a jour via \`ticket update\`.";
}

function collectChangedFields(previousTicket: Ticket, nextTicket: Ticket): string[] {
  const changedFields: string[] = [];

  for (const field of UPDATABLE_TICKET_FIELDS) {
    if (!areTicketFieldValuesEquivalent(field, previousTicket[field], nextTicket[field])) {
      changedFields.push(field);
    }
  }

  return changedFields;
}

function hasEffectiveTicketMutation(previousTicket: Ticket, nextTicket: Ticket): boolean {
  return UPDATABLE_TICKET_FIELDS.some((field) =>
    !areTicketFieldValuesEquivalent(field, previousTicket[field], nextTicket[field])
  );
}

function areTicketFieldValuesEquivalent(
  field: typeof UPDATABLE_TICKET_FIELDS[number],
  previousValue: unknown,
  nextValue: unknown,
): boolean {
  if (field === "allowedCapabilities" || field === "skillPackRefs") {
    return deepStrictEqualIgnoringArrayOrder(previousValue, nextValue);
  }

  return deepStrictEqualForComparison(previousValue, nextValue);
}
