import { randomUUID } from "node:crypto";

import type { ApprovalDecision, ApprovalDecisionOutcome } from "../../../contracts/src/approval/approval-decision";
import type { ApprovalRequest } from "../../../contracts/src/approval/approval-request";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import { isApprovalRequest } from "../../../contracts/src/guards/persisted-document-guards";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileExecutionAttemptRepository } from "../../../storage/src/repositories/file-execution-attempt-repository";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import {
  buildApprovalGuardrailsSnapshot,
  ensureTicketExtensionsAllowedByMission,
  missionHasOtherActiveAttempts,
  normalizeOpaqueReferences,
  normalizeTrimmedList,
  requireText,
  requireTicketInMission,
  rewriteMissionReadModels,
} from "../../../ticket-runtime/src/ticket-service/ticket-service-support";
import { deepStrictEqualIgnoringArrayOrder } from "../../../ticket-runtime/src/utils/structural-compare";
import { readApprovalQueue } from "../resume-service/read-approval-queue";
import { readMissionResume } from "../resume-service/read-mission-resume";

export interface ResolveApprovalRequestOptions {
  rootDir: string;
  missionId?: string;
  approvalId?: string;
  outcome: ApprovalDecisionOutcome;
  reason?: string;
  policyProfileId?: string;
  allowedCapabilities: string[];
  clearAllowedCapabilities: boolean;
  skillPackRefs: string[];
  clearSkillPackRefs: boolean;
  budgetObservations: string[];
}

export interface ResolveApprovalRequestResult {
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  approval: ApprovalRequest;
  event: JournalEventRecord;
  decision: ApprovalDecision;
  resume: MissionResume;
}

export async function resolveApprovalRequest(
  options: ResolveApprovalRequestOptions,
): Promise<ResolveApprovalRequestResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  const commandName = resolveCommandName(options.outcome);

  const missionId = requireText(
    options.missionId,
    `L'option --mission-id est obligatoire pour \`corp mission ${commandName}\`.`,
  );
  const approvalId = requireText(
    options.approvalId,
    `L'option --approval-id est obligatoire pour \`corp mission ${commandName}\`.`,
  );
  const queueResult = await readApprovalQueue({
    rootDir: layout.rootDir,
    missionId,
    commandName,
  });

  if (queueResult.reconstructed) {
    await readMissionResume({
      rootDir: layout.rootDir,
      missionId,
      commandName: "resume",
    });
  }

  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  const journalEvents = (await readEventLog(layout.journalPath))
    .filter((event) => event.missionId === mission.id);
  const pendingApproval = queueResult.approvals.find((entry) => entry.approvalId === approvalId);

  if (!pendingApproval) {
    const latestApproval = findLatestApproval(journalEvents, approvalId);

    if (latestApproval && latestApproval.status !== "requested") {
      throw new Error(
        `La validation \`${approvalId}\` est deja resolue (statut: ${latestApproval.status}).`,
      );
    }

    throw new Error(`Validation introuvable dans la mission \`${mission.id}\`: \`${approvalId}\`.`);
  }

  const ticket = requireTicketInMission(
    await ticketRepository.findById(mission.id, pendingApproval.ticketId),
    mission,
    pendingApproval.ticketId,
  );
  const attempt = await attemptRepository.findById(
    mission.id,
    ticket.id,
    pendingApproval.attemptId,
  );

  if (!attempt) {
    throw new Error(
      `Tentative introuvable pour la validation \`${approvalId}\`: \`${pendingApproval.attemptId}\`.`,
    );
  }

  if (attempt.status !== "awaiting_approval") {
    throw new Error(
      `La validation \`${approvalId}\` ne peut pas etre resolue car la tentative \`${attempt.id}\` n'est plus en attente d'approbation.`,
    );
  }

  const occurredAt = new Date().toISOString();
  const eventId = `event_${randomUUID()}`;
  const nextPolicyProfileId = options.policyProfileId !== undefined
    ? requireText(
      options.policyProfileId,
      `L'option --policy-profile ne peut pas etre vide pour \`corp mission ${commandName}\`.`,
    )
    : mission.policyProfileId;
  const nextAllowedCapabilities = resolveNormalizedReferenceList(
    ticket.allowedCapabilities,
    options.allowedCapabilities,
    options.clearAllowedCapabilities,
  );
  const nextSkillPackRefs = resolveNormalizedReferenceList(
    ticket.skillPackRefs,
    options.skillPackRefs,
    options.clearSkillPackRefs,
  );
  const nextMissionStatus = await resolveMissionStatusAfterDecision({
    mission,
    currentTicketId: ticket.id,
    currentApprovalId: approvalId,
    queuedApprovals: queueResult.approvals,
    attemptRepository,
  });

  ensureTicketExtensionsAllowedByMission({
    mission,
    allowedCapabilities: nextAllowedCapabilities,
    skillPackRefs: nextSkillPackRefs,
  });

  const updatedMission: Mission = {
    ...mission,
    status: nextMissionStatus,
    policyProfileId: nextPolicyProfileId,
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const updatedTicket: Ticket = {
    ...ticket,
    status: options.outcome === "approved" ? "todo" : "failed",
    allowedCapabilities: nextAllowedCapabilities,
    skillPackRefs: nextSkillPackRefs,
    eventIds: [...ticket.eventIds, eventId],
    updatedAt: occurredAt,
  };
  const updatedAttempt: ExecutionAttempt = {
    ...attempt,
    status: "cancelled",
    endedAt: occurredAt,
  };
  const updatedApproval: ApprovalRequest = {
    ...pendingApproval,
    status: options.outcome,
    guardrails: buildApprovalGuardrailsSnapshot({
      baseGuardrails: pendingApproval.guardrails,
      policyProfileId: nextPolicyProfileId,
      allowedCapabilities: nextAllowedCapabilities,
      skillPackRefs: nextSkillPackRefs,
    }),
    updatedAt: occurredAt,
  };
  const decision = buildDecision({
    outcome: options.outcome,
    reason: options.reason,
    budgetObservations: options.budgetObservations,
    mission,
    ticket,
    nextMissionPolicyId: nextPolicyProfileId,
    nextAllowedCapabilities,
    nextSkillPackRefs,
  });
  const event: JournalEventRecord = {
    eventId,
    type: `approval.${options.outcome}`,
    missionId: mission.id,
    ticketId: ticket.id,
    attemptId: attempt.id,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: updatedMission,
      ticket: updatedTicket,
      attempt: updatedAttempt,
      approvalId,
      previousApproval: pendingApproval,
      approval: updatedApproval,
      decision,
      trigger: "operator",
    },
  };

  await persistApprovalTransition({
    layout,
    event,
    mission: updatedMission,
    ticket: updatedTicket,
    attempt: updatedAttempt,
    missionRepository,
    ticketRepository,
    attemptRepository,
  });

  const resumeResult = await readMissionResume({
    rootDir: layout.rootDir,
    missionId: updatedMission.id,
    commandName: "resume",
  });

  return {
    mission: updatedMission,
    ticket: updatedTicket,
    attempt: updatedAttempt,
    approval: updatedApproval,
    event,
    decision,
    resume: resumeResult.resume,
  };
}

async function persistApprovalTransition(options: {
  layout: ReturnType<typeof resolveWorkspaceLayout>;
  event: JournalEventRecord;
  mission: Mission;
  ticket: Ticket;
  attempt: ExecutionAttempt;
  missionRepository: ReturnType<typeof createFileMissionRepository>;
  ticketRepository: ReturnType<typeof createFileTicketRepository>;
  attemptRepository: ReturnType<typeof createFileExecutionAttemptRepository>;
}): Promise<void> {
  // journal-as-source-of-truth : l'append est la decision d'autorite ; les 4 saves
  // sequentiels ci-dessous sont des optimisations de lecture. Un crash entre deux
  // saves laisse le journal en avance sur les snapshots, et le prochain reader
  // (readMissionResume, readApprovalQueue, readMissionArtifacts, readTicketBoard)
  // reconstruit l'etat via reconstructMissionFromJournal. Voir
  // docs/architecture/journal-as-source-of-truth.md (decision D2, 2026-04-15).
  await appendEvent(options.layout.journalPath, options.event);
  await options.missionRepository.save(options.mission);
  await options.ticketRepository.save(options.ticket);
  await options.attemptRepository.save(options.mission.id, options.attempt);
  await rewriteMissionReadModels(options.layout, options.mission, options.ticketRepository);
}

async function resolveMissionStatusAfterDecision(options: {
  mission: Mission;
  currentTicketId: string;
  currentApprovalId: string;
  queuedApprovals: ApprovalRequest[];
  attemptRepository: ReturnType<typeof createFileExecutionAttemptRepository>;
}): Promise<Mission["status"]> {
  if (options.queuedApprovals.some((approval) => approval.approvalId !== options.currentApprovalId)) {
    return "awaiting_approval";
  }

  return await missionHasOtherActiveAttempts(
    options.mission.id,
    options.currentTicketId,
    options.mission.ticketIds,
    options.attemptRepository,
  )
    ? "running"
    : "ready";
}

function resolveNormalizedReferenceList(
  currentValues: string[],
  nextValues: string[],
  clearValues: boolean,
): string[] {
  if (clearValues) {
    return [];
  }

  if (nextValues.length === 0) {
    return [...currentValues];
  }

  const normalizedValues = normalizeOpaqueReferences(nextValues, {
    caseInsensitive: true,
  });

  return deepStrictEqualIgnoringArrayOrder(currentValues, normalizedValues)
    ? [...currentValues]
    : normalizedValues;
}

function buildDecision(options: {
  outcome: ApprovalDecisionOutcome;
  reason?: string;
  budgetObservations: string[];
  mission: Mission;
  ticket: Ticket;
  nextMissionPolicyId: string;
  nextAllowedCapabilities: string[];
  nextSkillPackRefs: string[];
}): ApprovalDecision {
  const decision: ApprovalDecision = {
    outcome: options.outcome,
  };
  const normalizedReason = options.reason?.trim();
  const normalizedBudgetObservations = normalizeTrimmedList(options.budgetObservations, {
    dedupe: true,
  });

  if (normalizedReason) {
    decision.reason = normalizedReason;
  }

  if (options.mission.policyProfileId !== options.nextMissionPolicyId) {
    decision.missionPolicyChange = {
      previous: options.mission.policyProfileId,
      next: options.nextMissionPolicyId,
    };
  }

  if (!deepStrictEqualIgnoringArrayOrder(
    options.ticket.allowedCapabilities,
    options.nextAllowedCapabilities,
  )) {
    decision.ticketCapabilityChange = {
      previous: [...options.ticket.allowedCapabilities],
      next: [...options.nextAllowedCapabilities],
    };
  }

  if (!deepStrictEqualIgnoringArrayOrder(
    options.ticket.skillPackRefs,
    options.nextSkillPackRefs,
  )) {
    decision.ticketSkillPackChange = {
      previous: [...options.ticket.skillPackRefs],
      next: [...options.nextSkillPackRefs],
    };
  }

  if (normalizedBudgetObservations.length > 0) {
    decision.budgetObservations = normalizedBudgetObservations;
  }

  return decision;
}

function findLatestApproval(
  events: JournalEventRecord[],
  approvalId: string,
): ApprovalRequest | null {
  for (const event of [...events].reverse()) {
    const approval = readApprovalFromPayload(event.payload);

    if (approval?.approvalId === approvalId) {
      return approval;
    }
  }

  return null;
}

function readApprovalFromPayload(payload: Record<string, unknown>): ApprovalRequest | null {
  const candidate = payload.approval ?? payload.approvalRequest;

  return isApprovalRequest(candidate) ? candidate : null;
}

function resolveCommandName(outcome: ApprovalDecisionOutcome): "approval approve" | "approval reject" | "approval defer" {
  if (outcome === "approved") {
    return "approval approve";
  }

  if (outcome === "rejected") {
    return "approval reject";
  }

  return "approval defer";
}
