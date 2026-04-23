import { access } from "node:fs/promises";

import type { ApprovalDecision } from "../../../contracts/src/approval/approval-decision";
import type { ApprovalRequest } from "../../../contracts/src/approval/approval-request";
import type { Artifact } from "../../../contracts/src/artifact/artifact";
import type { CapabilityInvocationDetails } from "../../../contracts/src/extension/registered-capability";
import type { SkillPackUsageDetails } from "../../../contracts/src/extension/registered-skill-pack";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import {
  isApprovalRequest,
  isArtifact,
  isCapabilityInvocationDetails,
  isExecutionAttempt,
  isTicket,
  isWorkspaceIsolationMetadata,
} from "../../../contracts/src/guards/persisted-document-guards";
import {
  type Mission,
  type MissionAuthorizedExtensions,
} from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { WorkspaceIsolationMetadata } from "../../../workspace-isolation/src/workspace-isolation";
import type { JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { EventLogReadError } from "../../../journal/src/event-log/event-log-errors";
import { readEventLog } from "../../../journal/src/event-log/file-event-log";
import {
  readMissionSnapshotFromJournalOrThrow,
  reconstructTicketsFromJournal,
} from "../../../journal/src/reconstruction/mission-reconstruction";
import {
  createAuditLogProjection,
  type AuditLogProjection,
  type MissionAuditEntry,
} from "../../../journal/src/projections/audit-log-projection";
import { readSourceReferences } from "../../../journal/src/projections/artifact-index-projection";
import {
  readProjectionFile,
  resolveProjectionPath,
  writeProjectionSnapshot,
} from "../../../storage/src/projection-store/file-projection-store";
import {
  resolveWorkspaceLayout,
  type WorkspaceLayout,
} from "../../../storage/src/fs-layout/workspace-layout";
import {
  createFileSystemReadError,
  isFileSystemReadError,
  isMissingFileError,
  readAccessError,
} from "../../../storage/src/fs-layout/file-system-read-errors";
import { createFileArtifactRepository } from "../../../storage/src/repositories/file-artifact-repository";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { isRecoverablePersistedDocumentError } from "../../../storage/src/repositories/persisted-document-errors";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";

export interface MissionAuditDetailField {
  label: string;
  value: string;
}

export interface ReadMissionAuditOptions {
  rootDir: string;
  missionId: string;
  ticketId?: string;
  limit?: number;
}

export interface ReadMissionAuditResult {
  mission: Mission;
  entries: MissionAuditEntry[];
  reconstructed: boolean;
  projectionPath: string;
}

export interface ReadMissionAuditEventDetailResult {
  mission: Mission;
  entry: MissionAuditEntry;
  fields: MissionAuditDetailField[];
  reconstructed: boolean;
  projectionPath: string;
}

type MissionAuditCommandName = "audit" | "audit show";

export async function readMissionAudit(
  options: ReadMissionAuditOptions,
): Promise<ReadMissionAuditResult> {
  const context = await loadMissionAuditContext({
    rootDir: options.rootDir,
    missionId: options.missionId,
    commandName: "audit",
  });

  if (options.ticketId && !context.mission.ticketIds.includes(options.ticketId)) {
    throw new Error(
      `Ticket introuvable dans la mission \`${context.mission.id}\`: \`${options.ticketId}\`.`,
    );
  }

  const filteredEntries = options.ticketId
    ? context.projection.entries.filter((entry) => entry.ticketId === options.ticketId)
    : context.projection.entries;
  const limitedEntries = typeof options.limit === "number" && options.limit > 0
    ? filteredEntries.slice(-options.limit)
    : filteredEntries;

  return {
    mission: context.mission,
    entries: limitedEntries,
    reconstructed: context.reconstructed,
    projectionPath: context.projectionPath,
  };
}

export async function readMissionAuditEventDetail(options: {
  rootDir: string;
  missionId: string;
  eventId: string;
}): Promise<ReadMissionAuditEventDetailResult> {
  const context = await loadMissionAuditContext({
    rootDir: options.rootDir,
    missionId: options.missionId,
    commandName: "audit show",
  });
  const entry = context.projection.entries.find((candidate) => candidate.eventId === options.eventId);
  const event = context.events.find((candidate) => candidate.eventId === options.eventId);

  if (!entry || !event) {
    throw new Error(
      `Evenement introuvable dans la mission \`${options.missionId}\`: \`${options.eventId}\`.`,
    );
  }

  return {
    mission: context.mission,
    entry,
    fields: buildMissionAuditDetailFields(event),
    reconstructed: context.reconstructed,
    projectionPath: context.projectionPath,
  };
}

async function loadMissionAuditContext(options: {
  rootDir: string;
  missionId: string;
  commandName: MissionAuditCommandName;
}): Promise<{
  mission: Mission;
  events: JournalEventRecord[];
  projection: AuditLogProjection;
  reconstructed: boolean;
  projectionPath: string;
}> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionAuditWorkspaceInitialized(layout, options.commandName);

  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const artifactRepository = createFileArtifactRepository(layout);
  const mission = await readMissionSnapshotForAudit(
    layout,
    missionRepository,
    options.missionId,
  );
  const events = (await readEventLog(layout.journalPath))
    .filter((event) => event.missionId === mission.id);
  const tickets = await readTicketsForAudit(ticketRepository, mission.id, events);
  const artifacts = await readArtifactsForAudit(artifactRepository, mission.id);
  const rebuiltProjection = createAuditLogProjection({
    mission,
    tickets,
    artifacts,
    events,
  });
  const storedProjection = await readStoredAuditLog(layout.projectionsDir);
  const projectionPath = resolveProjectionPath(layout.projectionsDir, "audit-log");

  if (!storedProjection || !deepStrictEqualForComparison(storedProjection, rebuiltProjection)) {
    await writeProjectionSnapshot(layout.projectionsDir, "audit-log", rebuiltProjection);

    return {
      mission,
      events,
      projection: rebuiltProjection,
      reconstructed: true,
      projectionPath,
    };
  }

  return {
    mission,
    events,
    projection: storedProjection,
    reconstructed: false,
    projectionPath,
  };
}

async function ensureMissionAuditWorkspaceInitialized(
  layout: WorkspaceLayout,
  commandName: MissionAuditCommandName,
): Promise<void> {
  const journalError = await readAccessError(() => access(layout.journalPath));
  const projectionsError = await readAccessError(() => access(layout.projectionsDir));
  const missionsError = await readAccessError(() => access(layout.missionsDir));

  const fileSystemError = [
    { error: journalError, filePath: layout.journalPath, label: "journal append-only" },
    { error: projectionsError, filePath: layout.projectionsDir, label: "repertoire projections" },
    { error: missionsError, filePath: layout.missionsDir, label: "repertoire missions" },
  ].find((entry) => entry.error && entry.error.code !== "ENOENT" && isFileSystemReadError(entry.error));

  if (fileSystemError?.error) {
    if (fileSystemError.filePath === layout.journalPath) {
      throw EventLogReadError.fileSystem(layout.journalPath, fileSystemError.error);
    }

    throw createFileSystemReadError(
      fileSystemError.error,
      fileSystemError.filePath,
      fileSystemError.label,
    );
  }

  if (journalError?.code === "ENOENT" && !projectionsError && !missionsError) {
    throw EventLogReadError.missing(layout.journalPath, journalError);
  }

  if (journalError || projectionsError || missionsError) {
    throw new Error(
      `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${layout.rootDir}\` avant \`corp mission ${commandName}\`.`,
    );
  }
}

async function readStoredAuditLog(
  projectionsDir: string,
): Promise<AuditLogProjection | null> {
  const projectionPath = resolveProjectionPath(projectionsDir, "audit-log");

  try {
    return JSON.parse(await readProjectionFile(projectionsDir, "audit-log")) as AuditLogProjection;
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return null;
    }

    if (isFileSystemReadError(error)) {
      throw createFileSystemReadError(error, projectionPath, "projection audit-log");
    }

    throw error;
  }
}

function buildMissionAuditDetailFields(
  event: JournalEventRecord,
): MissionAuditDetailField[] {
  const fields: MissionAuditDetailField[] = [];
  const ticket = readTicketFromPayload(event.payload);
  const attempt = readAttemptFromPayload(event.payload);
  const artifact = readArtifactFromPayload(event.payload);
  const approval = readApprovalFromPayload(event.payload);
  const decision = readDecisionFromPayload(event.payload);
  const isolation = readIsolationFromPayload(event.payload);
  const capability = readCapabilityFromPayload(event.payload);
  const skillPack = readSkillPackFromPayload(event.payload);
  const sourceReferences = readSourceReferences(event.payload);

  if (event.type.startsWith("mission.")) {
    const previousStatus = readOptionalString(event.payload, "previousStatus");
    const nextStatus = readOptionalString(event.payload, "nextStatus");
    const reason = readOptionalString(event.payload, "reason");

    if (previousStatus) {
      fields.push({ label: "Statut precedent", value: previousStatus });
    }

    if (nextStatus) {
      fields.push({ label: "Statut suivant", value: nextStatus });
    }

    if (reason) {
      fields.push({ label: "Raison", value: reason });
    }
  }

  if (event.type === "mission.extensions_selected") {
    const previousAuthorizedExtensions = readAuthorizedExtensionsFromPayload(
      event.payload,
      "previousAuthorizedExtensions",
    );
    const authorizedExtensions = readAuthorizedExtensionsFromPayload(
      event.payload,
      "authorizedExtensions",
    );
    const changedFields = readStringArray(event.payload, "changedFields");
    const trigger = readOptionalString(event.payload, "trigger");

    if (previousAuthorizedExtensions) {
      fields.push({
        label: "Selection precedente capabilities",
        value: formatList(previousAuthorizedExtensions.allowedCapabilities, "aucune"),
      });
      fields.push({
        label: "Selection precedente skill packs",
        value: formatList(previousAuthorizedExtensions.skillPackRefs, "aucun"),
      });
    }

    if (authorizedExtensions) {
      fields.push({
        label: "Capabilities mission",
        value: formatList(authorizedExtensions.allowedCapabilities, "aucune"),
      });
      fields.push({
        label: "Skill packs mission",
        value: formatList(authorizedExtensions.skillPackRefs, "aucun"),
      });
    }

    if (changedFields.length > 0) {
      fields.push({ label: "Champs modifies", value: changedFields.join(", ") });
    }

    if (trigger) {
      fields.push({ label: "Trigger", value: trigger });
    }
  }

  if (event.type === "ticket.created" || event.type === "ticket.claimed" || event.type === "ticket.in_progress") {
    if (ticket?.goal) {
      fields.push({ label: "Objectif ticket", value: ticket.goal });
    }

    if (ticket?.owner) {
      fields.push({ label: "Owner ticket", value: ticket.owner });
    }

    if (ticket?.kind) {
      fields.push({ label: "Type ticket", value: ticket.kind });
    }
  }

  if (event.type === "ticket.updated") {
    const changedFields = readStringArray(event.payload, "changedFields");

    if (changedFields.length > 0) {
      fields.push({ label: "Champs modifies", value: changedFields.join(", ") });
    }
  }

  if (event.type === "ticket.reprioritized") {
    const previousOrder = readOptionalNumber(event.payload, "previousOrder");
    const nextOrder = readOptionalNumber(event.payload, "nextOrder");

    if (previousOrder !== undefined) {
      fields.push({ label: "Position precedente", value: String(previousOrder + 1) });
    }

    if (nextOrder !== undefined) {
      fields.push({ label: "Position suivante", value: String(nextOrder + 1) });
    }
  }

  if (event.type === "ticket.cancelled") {
    const reason = readOptionalString(event.payload, "reason");
    if (reason) {
      fields.push({ label: "Raison", value: reason });
    }
  }

  if (event.type.startsWith("execution.")) {
    if (attempt?.status) {
      fields.push({ label: "Statut tentative", value: attempt.status });
    }

    if (attempt?.workspaceIsolationId) {
      fields.push({ label: "Isolation", value: attempt.workspaceIsolationId });
    }

    if (typeof attempt?.backgroundRequested === "boolean") {
      fields.push({
        label: "Mode",
        value: attempt.backgroundRequested ? "background" : "foreground",
      });
    }
  }

  if (event.type.startsWith("approval.")) {
    if (approval?.actionType) {
      fields.push({ label: "Action", value: approval.actionType });
    }

    if (approval?.actionSummary) {
      fields.push({ label: "Resume action", value: approval.actionSummary });
    }

    if (approval?.guardrails.length) {
      fields.push({ label: "Garde-fous", value: approval.guardrails.join(" ; ") });
    }

    if (decision?.outcome) {
      fields.push({ label: "Decision", value: decision.outcome });
    }

    if (decision?.reason) {
      fields.push({ label: "Raison decision", value: decision.reason });
    }

    if (decision?.budgetObservations?.length) {
      fields.push({
        label: "Observations budget",
        value: decision.budgetObservations.join(" ; "),
      });
    }
  }

  if (event.type.startsWith("artifact.")) {
    if (artifact?.title) {
      fields.push({ label: "Titre artefact", value: artifact.title });
    }

    if (artifact?.kind) {
      fields.push({ label: "Type artefact", value: artifact.kind });
    }

    const artifactReference = artifact?.path ?? artifact?.label;
    if (artifactReference) {
      fields.push({ label: "Reference artefact", value: artifactReference });
    }

    const producingEventId = readOptionalString(event.payload, "producingEventId");
    if (producingEventId) {
      fields.push({ label: "Evenement producteur", value: producingEventId });
    }
  }

  if (event.type === "workspace.isolation_created" && isolation) {
    fields.push({ label: "Isolation", value: isolation.workspaceIsolationId });
    fields.push({ label: "Type isolation", value: isolation.kind });
  }

  if (event.type === "capability.invoked" && capability) {
    fields.push({ label: "Capability", value: capability.capabilityId });
    fields.push({ label: "Registration", value: capability.registrationId });
    fields.push({ label: "Provider", value: capability.provider });
    fields.push({
      label: "Approval sensitive",
      value: capability.approvalSensitive ? "oui" : "non",
    });

    if (capability.permissions.length > 0) {
      fields.push({
        label: "Permissions",
        value: capability.permissions.join(" ; "),
      });
    }

    if (capability.constraints.length > 0) {
      fields.push({
        label: "Contraintes",
        value: capability.constraints.join(" ; "),
      });
    }

    if (capability.requiredEnvNames.length > 0) {
      fields.push({
        label: "Env requis",
        value: capability.requiredEnvNames.join(" ; "),
      });
    }

    const guardrails = readStringArray(event.payload, "guardrails");
    if (guardrails.length > 0) {
      fields.push({
        label: "Garde-fous",
        value: guardrails.join(" ; "),
      });
    }

    const trigger = readOptionalString(event.payload, "trigger");
    if (trigger) {
      fields.push({ label: "Trigger", value: trigger });
    }
  }

  if (event.type === "skill_pack.used" && skillPack) {
    fields.push({ label: "Skill pack", value: skillPack.packRef });
    fields.push({ label: "Registration", value: skillPack.registrationId });
    fields.push({ label: "Nom", value: skillPack.displayName });

    if (skillPack.permissions.length > 0) {
      fields.push({
        label: "Permissions",
        value: skillPack.permissions.join(" ; "),
      });
    }

    if (skillPack.constraints.length > 0) {
      fields.push({
        label: "Contraintes",
        value: skillPack.constraints.join(" ; "),
      });
    }

    fields.push({ label: "Owner", value: skillPack.owner });

    if (skillPack.tags.length > 0) {
      fields.push({
        label: "Tags",
        value: skillPack.tags.join(" ; "),
      });
    }

    const trigger = readOptionalString(event.payload, "trigger");
    if (trigger) {
      fields.push({ label: "Trigger", value: trigger });
    }
  }

  if (ticket?.goal && !fields.some((field) => field.label === "Objectif ticket")) {
    fields.push({ label: "Objectif ticket", value: ticket.goal });
  }

  if (sourceReferences.decisionRef) {
    fields.push({ label: "Decision liee", value: sourceReferences.decisionRef });
  }

  return fields;
}

async function readMissionSnapshotForAudit(
  layout: WorkspaceLayout,
  missionRepository: ReturnType<typeof createFileMissionRepository>,
  missionId: string,
): Promise<Mission> {
  try {
    const mission = await missionRepository.findById(missionId);

    if (mission) {
      return mission;
    }
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }
  }

  return readMissionSnapshotFromJournalOrThrow(layout.journalPath, missionId);
}

async function readTicketsForAudit(
  ticketRepository: ReturnType<typeof createFileTicketRepository>,
  missionId: string,
  events: JournalEventRecord[],
): Promise<Ticket[]> {
  try {
    return await ticketRepository.listByMissionId(missionId);
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }

    return reconstructTicketsFromJournal(events, missionId);
  }
}

async function readArtifactsForAudit(
  artifactRepository: ReturnType<typeof createFileArtifactRepository>,
  missionId: string,
): Promise<Artifact[]> {
  try {
    return await artifactRepository.listByMissionId(missionId);
  } catch (error) {
    if (!isRecoverablePersistedDocumentError(error)) {
      throw error;
    }

    return [];
  }
}

function readApprovalFromPayload(
  payload: Record<string, unknown>,
): ApprovalRequest | null {
  const candidate = payload.approval ?? payload.approvalRequest;
  return isApprovalRequest(candidate) ? candidate : null;
}

function readArtifactFromPayload(
  payload: Record<string, unknown>,
): Artifact | null {
  const candidate = payload.artifact;
  return isArtifact(candidate) ? candidate : null;
}

function readTicketFromPayload(
  payload: Record<string, unknown>,
): Ticket | null {
  const candidate = payload.ticket;
  return isTicket(candidate) ? candidate : null;
}

function readAuthorizedExtensionsFromPayload(
  payload: Record<string, unknown>,
  key: string,
): MissionAuthorizedExtensions | null {
  const candidate = payload[key];
  return isAuthorizedExtensions(candidate)
    ? {
      allowedCapabilities: [...candidate.allowedCapabilities],
      skillPackRefs: [...candidate.skillPackRefs],
    }
    : null;
}

function readAttemptFromPayload(
  payload: Record<string, unknown>,
): ExecutionAttempt | null {
  const candidate = payload.attempt;
  return isExecutionAttempt(candidate) ? candidate : null;
}

function readIsolationFromPayload(
  payload: Record<string, unknown>,
): WorkspaceIsolationMetadata | null {
  const candidate = payload.isolation;
  return isWorkspaceIsolationMetadata(candidate) ? candidate : null;
}

// Extraction tolerante pour l'audit : on preserve l'outcome et les champs
// optionnels bien formes, on ignore ceux qui sont malformes sans laisser
// tomber toute la decision. Le guard canonique `isApprovalDecision`
// (packages/contracts) reste strict pour les reads repository.
function readDecisionFromPayload(
  payload: Record<string, unknown>,
): ApprovalDecision | null {
  const candidate = payload.decision;

  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const outcome = record.outcome;

  if (outcome !== "approved" && outcome !== "rejected" && outcome !== "deferred") {
    return null;
  }

  const decision: ApprovalDecision = { outcome };

  if (typeof record.reason === "string") {
    decision.reason = record.reason;
  }

  const missionPolicyChange = record.missionPolicyChange;
  if (isStringChange(missionPolicyChange)) {
    decision.missionPolicyChange = { ...missionPolicyChange };
  }

  const ticketCapabilityChange = record.ticketCapabilityChange;
  if (isStringArrayChange(ticketCapabilityChange)) {
    decision.ticketCapabilityChange = {
      previous: [...ticketCapabilityChange.previous],
      next: [...ticketCapabilityChange.next],
    };
  }

  const ticketSkillPackChange = record.ticketSkillPackChange;
  if (isStringArrayChange(ticketSkillPackChange)) {
    decision.ticketSkillPackChange = {
      previous: [...ticketSkillPackChange.previous],
      next: [...ticketSkillPackChange.next],
    };
  }

  const budgetObservations = record.budgetObservations;
  if (Array.isArray(budgetObservations) && budgetObservations.every((entry) => typeof entry === "string")) {
    decision.budgetObservations = [...budgetObservations];
  }

  return decision;
}

function isStringChange(
  value: unknown,
): value is { previous: string; next: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.previous === "string" && typeof candidate.next === "string";
}

function isStringArrayChange(
  value: unknown,
): value is { previous: string[]; next: string[] } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.previous)
    && candidate.previous.every((entry) => typeof entry === "string")
    && Array.isArray(candidate.next)
    && candidate.next.every((entry) => typeof entry === "string");
}

function readCapabilityFromPayload(
  payload: Record<string, unknown>,
): CapabilityInvocationDetails | null {
  const candidate = payload.capability;
  return isCapabilityInvocationDetails(candidate) ? candidate : null;
}

function readSkillPackFromPayload(
  payload: Record<string, unknown>,
): SkillPackUsageDetails | null {
  const candidate = payload.skillPack;
  return isSkillPackUsageDetails(candidate) ? candidate : null;
}

function readStringArray(
  payload: Record<string, unknown>,
  key: string,
): string[] {
  const candidate = payload[key];
  return Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function readOptionalString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const candidate = payload[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : undefined;
}

function readOptionalNumber(
  payload: Record<string, unknown>,
  key: string,
): number | undefined {
  const candidate = payload[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function formatList(values: string[], emptyValue: string): string {
  return values.length > 0 ? values.join(", ") : emptyValue;
}

function isAuthorizedExtensions(value: unknown): value is MissionAuthorizedExtensions {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return Array.isArray(candidate.allowedCapabilities)
    && candidate.allowedCapabilities.every((entry) => typeof entry === "string")
    && Array.isArray(candidate.skillPackRefs)
    && candidate.skillPackRefs.every((entry) => typeof entry === "string");
}

function isSkillPackUsageDetails(value: unknown): value is SkillPackUsageDetails {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.packRef === "string"
    && typeof candidate.registrationId === "string"
    && typeof candidate.displayName === "string"
    && Array.isArray(candidate.permissions)
    && Array.isArray(candidate.constraints)
    && typeof candidate.owner === "string"
    && Array.isArray(candidate.tags);
}
