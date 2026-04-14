import type { ApprovalRequest } from "../../../contracts/src/approval/approval-request";
import type { Artifact } from "../../../contracts/src/artifact/artifact";
import type { CapabilityInvocationDetails } from "../../../contracts/src/extension/registered-capability";
import type { SkillPackUsageDetails } from "../../../contracts/src/extension/registered-skill-pack";
import type { ExecutionAttempt } from "../../../contracts/src/execution-attempt/execution-attempt";
import {
  hydrateMission,
  type Mission,
  type MissionAuthorizedExtensions,
} from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { WorkspaceIsolationMetadata } from "../../../workspace-isolation/src/workspace-isolation";
import type { JournalEventRecord } from "../event-log/append-event";
import {
  createArtifactIndexProjection,
  readSourceReferences,
  toPublicSource,
} from "./artifact-index-projection";

export interface MissionAuditEntry {
  entryId: string;
  occurredAt: string;
  eventId: string;
  eventType: string;
  kind: string;
  title: string;
  summary: string;
  missionId: string;
  ticketId?: string;
  attemptId?: string;
  artifactId?: string;
  approvalId?: string;
  actor: string;
  source: string;
  ticketOwner?: string;
  relatedEventIds: string[];
  relatedArtifactIds: string[];
}

export interface AuditLogProjection {
  schemaVersion: 1;
  entries: MissionAuditEntry[];
}

export function createAuditLogProjection(options: {
  mission: Mission;
  tickets: Ticket[];
  artifacts: Artifact[];
  events: JournalEventRecord[];
}): AuditLogProjection {
  const ticketOwnersById = new Map(
    options.tickets.map((ticket) => [ticket.id, ticket.owner] as const),
  );
  const artifactIndex = createArtifactIndexProjection(options);
  const relatedArtifactIdsByEventId = new Map<string, string[]>();

  for (const artifact of artifactIndex.artifacts) {
    const existingArtifactIds = relatedArtifactIdsByEventId.get(artifact.producingEventId) ?? [];
    existingArtifactIds.push(artifact.artifactId);
    relatedArtifactIdsByEventId.set(
      artifact.producingEventId,
      normalizeOpaqueReferences(existingArtifactIds),
    );
  }

  const entries = options.events
    .filter((event) => event.missionId === options.mission.id)
    .sort((left, right) =>
      `${left.occurredAt}|${left.eventId}`.localeCompare(`${right.occurredAt}|${right.eventId}`),
    )
    .map((event) =>
      buildMissionAuditEntry(event, {
        ticketOwnersById,
        relatedArtifactIdsByEventId,
      })
    );

  return {
    schemaVersion: 1,
    entries,
  };
}

function buildMissionAuditEntry(
  event: JournalEventRecord,
  context: {
    ticketOwnersById: Map<string, string>;
    relatedArtifactIdsByEventId: Map<string, string[]>;
  },
): MissionAuditEntry {
  const approval = readApprovalFromPayload(event.payload);
  const artifact = readArtifactFromPayload(event.payload);
  const capability = readCapabilityInvocationFromPayload(event.payload);
  const skillPack = readSkillPackUsageFromPayload(event.payload);
  const sourceReferences = readSourceReferences(event.payload);
  const relatedArtifactIds = normalizeOpaqueReferences([
    ...readRelatedArtifactIds(event.payload),
    ...(context.relatedArtifactIdsByEventId.get(event.eventId) ?? []),
    ...(artifact ? [artifact.id] : []),
  ]);
  const relatedEventIds = normalizeOpaqueReferences([
    ...readRelatedEventIds(event.payload),
    ...readSourceEventIds(event.payload),
  ]);
  const ticketId = event.ticketId
    ?? approval?.ticketId
    ?? artifact?.ticketId
    ?? readTicketIdFromPayload(event.payload);
  const attemptId = event.attemptId
    ?? approval?.attemptId
    ?? artifact?.attemptId
    ?? readAttemptIdFromPayload(event.payload);
  const artifactId = artifact?.id
    ?? (relatedArtifactIds.length === 1 ? relatedArtifactIds[0] : undefined);
  const approvalId = approval?.approvalId ?? sourceReferences.approvalId;
  const ticketOwner = ticketId
    ? context.ticketOwnersById.get(ticketId) ?? readTicketOwnerFromPayload(event.payload)
    : undefined;
  const descriptor = describeEvent(event, {
    approval,
    artifact,
    capability,
    ticketId,
    attemptId,
    approvalId,
    relatedArtifactIds,
    skillPack,
  });

  return {
    entryId: event.eventId,
    occurredAt: event.occurredAt,
    eventId: event.eventId,
    eventType: event.type,
    kind: descriptor.kind,
    title: descriptor.title,
    summary: descriptor.summary,
    missionId: event.missionId,
    ...(ticketId ? { ticketId } : {}),
    ...(attemptId ? { attemptId } : {}),
    ...(artifactId ? { artifactId } : {}),
    ...(approvalId ? { approvalId } : {}),
    actor: event.actor,
    source: toPublicSource(event),
    ...(ticketOwner ? { ticketOwner } : {}),
    relatedEventIds,
    relatedArtifactIds,
  };
}

function describeEvent(
  event: JournalEventRecord,
  context: {
    approval: ApprovalRequest | null;
    artifact: Artifact | null;
    capability: CapabilityInvocationDetails | null;
    ticketId?: string;
    attemptId?: string;
    approvalId?: string;
    relatedArtifactIds: string[];
    skillPack: SkillPackUsageDetails | null;
  },
): { kind: string; title: string; summary: string } {
  if (event.type === "mission.created") {
    return {
      kind: "mission",
      title: "Mission creee",
      summary: buildMissionSummary(event, "initialisee"),
    };
  }

  if (event.type === "mission.paused") {
    return {
      kind: "mission",
      title: "Mission mise en pause",
      summary: buildMissionSummary(event, "mise en pause"),
    };
  }

  if (event.type === "mission.relaunched") {
    return {
      kind: "mission",
      title: "Mission relancee",
      summary: buildMissionSummary(event, "relancee"),
    };
  }

  if (event.type === "mission.completed") {
    return {
      kind: "mission",
      title: "Mission terminee",
      summary: buildMissionSummary(event, "terminee"),
    };
  }

  if (event.type === "mission.cancelled") {
    return {
      kind: "mission",
      title: "Mission annulee",
      summary: buildMissionSummary(event, "annulee"),
    };
  }

  if (event.type === "mission.extensions_selected") {
    const authorizedExtensions = readAuthorizedExtensionsFromPayload(
      event.payload,
      "authorizedExtensions",
    );
    const changedFields = readStringArray(event.payload, "changedFields");
    const fragments: string[] = [];

    if (authorizedExtensions) {
      fragments.push(
        `capabilities=${formatListSummary(authorizedExtensions.allowedCapabilities, "aucune")}`,
      );
      fragments.push(
        `skill packs=${formatListSummary(authorizedExtensions.skillPackRefs, "aucun")}`,
      );
    }

    if (changedFields.length > 0) {
      fragments.push(`champs=${changedFields.join(", ")}`);
    }

    return {
      kind: "mission",
      title: "Extensions mission selectionnees",
      summary: fragments.length > 0
        ? `Selection des extensions mise a jour pour la mission ${event.missionId}: ${fragments.join(" | ")}.`
        : `Selection des extensions mise a jour pour la mission ${event.missionId}.`,
    };
  }

  if (event.type === "ticket.created") {
    return {
      kind: "ticket",
      title: "Ticket cree",
      summary: buildTicketSummary(event, context.ticketId, "cree"),
    };
  }

  if (event.type === "ticket.updated") {
    const changedFields = readStringArray(event.payload, "changedFields");

    return {
      kind: "ticket",
      title: "Ticket mis a jour",
      summary: changedFields.length > 0
        ? `Ticket ${context.ticketId ?? "inconnu"} mis a jour: ${changedFields.join(", ")}.`
        : buildTicketSummary(event, context.ticketId, "mis a jour"),
    };
  }

  if (event.type === "ticket.reprioritized") {
    const previousOrder = readOptionalNumber(event.payload, "previousOrder");
    const nextOrder = readOptionalNumber(event.payload, "nextOrder");

    return {
      kind: "ticket",
      title: "Ticket repriorise",
      summary: previousOrder !== undefined && nextOrder !== undefined
        ? `Ticket ${context.ticketId ?? "inconnu"} deplace de la position ${previousOrder + 1} a ${nextOrder + 1}.`
        : buildTicketSummary(event, context.ticketId, "repriorise"),
    };
  }

  if (event.type === "ticket.cancelled") {
    const reason = readOptionalString(event.payload, "reason");

    return {
      kind: "ticket",
      title: "Ticket annule",
      summary: reason
        ? `Ticket ${context.ticketId ?? "inconnu"} annule: ${reason}.`
        : buildTicketSummary(event, context.ticketId, "annule"),
    };
  }

  if (event.type === "ticket.claimed") {
    return {
      kind: "ticket",
      title: "Ticket pris en charge",
      summary: buildTicketSummary(event, context.ticketId, "pris en charge"),
    };
  }

  if (event.type === "ticket.in_progress") {
    return {
      kind: "ticket",
      title: "Ticket en cours",
      summary: buildTicketSummary(event, context.ticketId, "en cours"),
    };
  }

  if (event.type === "execution.requested") {
    const backgroundRequested = readOptionalBoolean(event.payload, "backgroundRequested");

    return {
      kind: "execution",
      title: "Execution demandee",
      summary: backgroundRequested
        ? `Tentative ${context.attemptId ?? "inconnue"} demandee en arriere-plan pour le ticket ${context.ticketId ?? "inconnu"}.`
        : `Tentative ${context.attemptId ?? "inconnue"} demandee pour le ticket ${context.ticketId ?? "inconnu"}.`,
    };
  }

  if (event.type === "execution.background_started") {
    return {
      kind: "execution",
      title: "Execution lancee en arriere-plan",
      summary: `Tentative ${context.attemptId ?? "inconnue"} poursuivie en arriere-plan pour le ticket ${context.ticketId ?? "inconnu"}.`,
    };
  }

  if (event.type === "execution.completed") {
    return {
      kind: "execution",
      title: "Execution terminee",
      summary: buildExecutionSummary("terminee", context),
    };
  }

  if (event.type === "execution.failed") {
    return {
      kind: "execution",
      title: "Execution en echec",
      summary: buildExecutionSummary("en echec", context),
    };
  }

  if (event.type === "execution.cancelled") {
    return {
      kind: "execution",
      title: "Execution annulee",
      summary: buildExecutionSummary("annulee", context),
    };
  }

  if (event.type === "approval.requested") {
    const actionSummary = context.approval?.actionSummary?.trim();

    return {
      kind: "approval",
      title: context.approval?.title ?? "Validation requise",
      summary: actionSummary
        ? `Validation en attente pour le ticket ${context.ticketId ?? "inconnu"}: ${actionSummary}.`
        : `Validation en attente pour le ticket ${context.ticketId ?? "inconnu"}.`,
    };
  }

  if (event.type === "approval.approved") {
    return {
      kind: "approval",
      title: "Validation approuvee",
      summary: buildApprovalSummary("approuvee", context),
    };
  }

  if (event.type === "approval.rejected") {
    return {
      kind: "approval",
      title: "Validation refusee",
      summary: buildApprovalSummary("refusee", context),
    };
  }

  if (event.type === "approval.deferred") {
    return {
      kind: "approval",
      title: "Validation differee",
      summary: buildApprovalSummary("differee", context),
    };
  }

  if (event.type === "artifact.detected") {
    return {
      kind: "artifact",
      title: "Artefact detecte",
      summary: buildArtifactSummary("detecte", context.artifact, context.ticketId),
    };
  }

  if (event.type === "artifact.registered") {
    return {
      kind: "artifact",
      title: "Artefact enregistre",
      summary: buildArtifactSummary("enregistre", context.artifact, context.ticketId),
    };
  }

  if (event.type === "workspace.isolation_created") {
    const isolation = readIsolationFromPayload(event.payload);

    return {
      kind: "workspace",
      title: "Isolation creee",
      summary: isolation
        ? `Isolation ${isolation.workspaceIsolationId} creee pour le ticket ${context.ticketId ?? "inconnu"}.`
        : `Isolation creee pour le ticket ${context.ticketId ?? "inconnu"}.`,
    };
  }

  if (event.type === "capability.invoked") {
    return {
      kind: "capability",
      title: "Capability invoquee",
      summary: buildCapabilitySummary(context.capability, context.ticketId),
    };
  }

  if (event.type === "skill_pack.used") {
    return {
      kind: "skill_pack",
      title: "Skill pack utilise",
      summary: buildSkillPackSummary(context.skillPack, context.ticketId),
    };
  }

  return {
    kind: resolveEventKind(event.type),
    title: event.type,
    summary: `Evenement ${event.type} journalise pour la mission ${event.missionId}.`,
  };
}

function buildMissionSummary(event: JournalEventRecord, verb: string): string {
  const mission = readMissionFromPayload(event.payload);
  return mission
    ? `Mission ${mission.title} ${verb}.`
    : `Mission ${event.missionId} ${verb}.`;
}

function buildTicketSummary(
  event: JournalEventRecord,
  ticketId: string | undefined,
  verb: string,
): string {
  const ticket = readTicketFromPayload(event.payload);
  if (ticket) {
    return `Ticket ${ticket.id} ${verb}: ${ticket.goal}.`;
  }

  return `Ticket ${ticketId ?? "inconnu"} ${verb}.`;
}

function buildExecutionSummary(
  statusLabel: string,
  context: {
    ticketId?: string;
    attemptId?: string;
    relatedArtifactIds: string[];
  },
): string {
  const artifactSummary = context.relatedArtifactIds.length > 0
    ? ` ${context.relatedArtifactIds.length} artefact(s) lie(s).`
    : "";

  return `Tentative ${context.attemptId ?? "inconnue"} ${statusLabel} pour le ticket ${context.ticketId ?? "inconnu"}.${artifactSummary}`;
}

function buildApprovalSummary(
  outcomeLabel: string,
  context: {
    approval: ApprovalRequest | null;
    approvalId?: string;
    ticketId?: string;
  },
): string {
  const actionSummary = context.approval?.actionSummary?.trim();
  const suffix = actionSummary ? ` ${actionSummary}.` : "";

  return `Validation ${context.approvalId ?? "inconnue"} ${outcomeLabel} pour le ticket ${context.ticketId ?? "inconnu"}.${suffix}`;
}

function buildArtifactSummary(
  verb: string,
  artifact: Artifact | null,
  ticketId: string | undefined,
): string {
  if (artifact) {
    return `Artefact ${artifact.id} ${verb} pour le ticket ${artifact.ticketId}: ${artifact.title}.`;
  }

  return `Artefact ${verb} pour le ticket ${ticketId ?? "inconnu"}.`;
}

function buildCapabilitySummary(
  capability: CapabilityInvocationDetails | null,
  ticketId: string | undefined,
): string {
  if (capability) {
    return `Capability ${capability.capabilityId} (provider ${capability.provider}) invoquee pour le ticket ${ticketId ?? "inconnu"}.`;
  }

  return `Capability invoquee pour le ticket ${ticketId ?? "inconnu"}.`;
}

function buildSkillPackSummary(
  skillPack: SkillPackUsageDetails | null,
  ticketId: string | undefined,
): string {
  if (skillPack) {
    return `Skill pack ${skillPack.packRef} utilise pour le ticket ${ticketId ?? "inconnu"}.`;
  }

  return `Skill pack utilise pour le ticket ${ticketId ?? "inconnu"}.`;
}

function formatListSummary(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.join(", ") : emptyLabel;
}

function resolveEventKind(eventType: string): string {
  const [prefix] = eventType.split(".");
  return prefix?.trim().length ? prefix : "event";
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

function readMissionFromPayload(
  payload: Record<string, unknown>,
): Mission | null {
  const candidate = payload.mission;
  return isMission(candidate) ? hydrateMission(candidate) : null;
}

function readTicketFromPayload(
  payload: Record<string, unknown>,
): Ticket | null {
  const candidate = payload.ticket;
  return isTicket(candidate) ? candidate : null;
}

function readIsolationFromPayload(
  payload: Record<string, unknown>,
): WorkspaceIsolationMetadata | null {
  const candidate = payload.isolation;
  return isWorkspaceIsolationMetadata(candidate) ? candidate : null;
}

function readCapabilityInvocationFromPayload(
  payload: Record<string, unknown>,
): CapabilityInvocationDetails | null {
  const candidate = payload.capability;
  return isCapabilityInvocationDetails(candidate) ? candidate : null;
}

function readSkillPackUsageFromPayload(
  payload: Record<string, unknown>,
): SkillPackUsageDetails | null {
  const candidate = payload.skillPack;
  return isSkillPackUsageDetails(candidate) ? candidate : null;
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

function readRelatedEventIds(payload: Record<string, unknown>): string[] {
  const approval = readApprovalFromPayload(payload);
  return normalizeOpaqueReferences([
    ...readStringArray(payload, "relatedEventIds"),
    ...(approval?.relatedEventIds ?? []),
  ]);
}

function readSourceEventIds(payload: Record<string, unknown>): string[] {
  return normalizeOpaqueReferences([
    ...readStringArray(payload, "sourceEventIds"),
    ...readOptionalStringValues([
      payload.producingEventId,
      payload.sourceEventId,
    ]),
  ]);
}

function readRelatedArtifactIds(payload: Record<string, unknown>): string[] {
  const approval = readApprovalFromPayload(payload);
  return normalizeOpaqueReferences([
    ...readStringArray(payload, "relatedArtifactIds"),
    ...(approval?.relatedArtifactIds ?? []),
  ]);
}

function readTicketIdFromPayload(payload: Record<string, unknown>): string | undefined {
  const ticket = readTicketFromPayload(payload);
  if (ticket) {
    return ticket.id;
  }

  const approval = readApprovalFromPayload(payload);
  if (approval) {
    return approval.ticketId;
  }

  const artifact = readArtifactFromPayload(payload);
  if (artifact) {
    return artifact.ticketId;
  }

  return undefined;
}

function readAttemptIdFromPayload(payload: Record<string, unknown>): string | undefined {
  const approval = readApprovalFromPayload(payload);
  if (approval) {
    return approval.attemptId;
  }

  const artifact = readArtifactFromPayload(payload);
  if (artifact?.attemptId) {
    return artifact.attemptId;
  }

  const attempt = payload.attempt;
  if (isExecutionAttempt(attempt)) {
    return attempt.id;
  }

  return undefined;
}

function readTicketOwnerFromPayload(payload: Record<string, unknown>): string | undefined {
  const ticket = readTicketFromPayload(payload);
  return ticket?.owner?.trim().length ? ticket.owner : undefined;
}

function normalizeOpaqueReferences(values: string[]): string[] {
  const normalizedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    const normalizedValue = value.trim();

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
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

function readOptionalStringValues(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
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

function readOptionalBoolean(
  payload: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const candidate = payload[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

function isApprovalRequest(value: unknown): value is ApprovalRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.approvalId === "string"
    && typeof candidate.missionId === "string"
    && typeof candidate.ticketId === "string"
    && typeof candidate.attemptId === "string"
    && typeof candidate.status === "string"
    && typeof candidate.title === "string"
    && typeof candidate.actionType === "string"
    && typeof candidate.actionSummary === "string"
    && Array.isArray(candidate.guardrails)
    && Array.isArray(candidate.relatedEventIds)
    && Array.isArray(candidate.relatedArtifactIds)
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string";
}

function isArtifact(value: unknown): value is Artifact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === "string"
    && typeof candidate.missionId === "string"
    && typeof candidate.ticketId === "string"
    && typeof candidate.producingEventId === "string"
    && (typeof candidate.attemptId === "string" || candidate.attemptId === null)
    && (typeof candidate.workspaceIsolationId === "string" || candidate.workspaceIsolationId === null)
    && typeof candidate.kind === "string"
    && typeof candidate.title === "string"
    && typeof candidate.createdAt === "string";
}

function isMission(value: unknown): value is Mission {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && typeof candidate.objective === "string"
    && typeof candidate.status === "string"
    && Array.isArray(candidate.successCriteria)
    && typeof candidate.policyProfileId === "string"
    && (
      candidate.authorizedExtensions === undefined
      || isAuthorizedExtensions(candidate.authorizedExtensions)
    )
    && Array.isArray(candidate.ticketIds)
    && Array.isArray(candidate.artifactIds)
    && Array.isArray(candidate.eventIds)
    && typeof candidate.resumeCursor === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string";
}

function isTicket(value: unknown): value is Ticket {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === "string"
    && typeof candidate.missionId === "string"
    && typeof candidate.kind === "string"
    && typeof candidate.goal === "string"
    && typeof candidate.status === "string"
    && typeof candidate.owner === "string"
    && Array.isArray(candidate.dependsOn)
    && Array.isArray(candidate.successCriteria)
    && Array.isArray(candidate.allowedCapabilities)
    && Array.isArray(candidate.skillPackRefs)
    && (typeof candidate.workspaceIsolationId === "string" || candidate.workspaceIsolationId === null)
    && typeof candidate.executionHandle === "object"
    && candidate.executionHandle !== null
    && Array.isArray(candidate.artifactIds)
    && Array.isArray(candidate.eventIds)
    && typeof candidate.createdAt === "string"
    && typeof candidate.updatedAt === "string";
}

function isExecutionAttempt(value: unknown): value is ExecutionAttempt {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === "string"
    && typeof candidate.ticketId === "string"
    && typeof candidate.adapter === "string"
    && typeof candidate.status === "string"
    && typeof candidate.workspaceIsolationId === "string"
    && typeof candidate.backgroundRequested === "boolean"
    && typeof candidate.adapterState === "object"
    && candidate.adapterState !== null
    && typeof candidate.startedAt === "string"
    && (typeof candidate.endedAt === "string" || candidate.endedAt === null);
}

function isWorkspaceIsolationMetadata(value: unknown): value is WorkspaceIsolationMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.workspaceIsolationId === "string"
    && typeof candidate.kind === "string"
    && typeof candidate.sourceRoot === "string"
    && typeof candidate.workspacePath === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.retained === "boolean";
}

function isCapabilityInvocationDetails(value: unknown): value is CapabilityInvocationDetails {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.capabilityId === "string"
    && typeof candidate.registrationId === "string"
    && (candidate.provider === "local" || candidate.provider === "mcp")
    && typeof candidate.approvalSensitive === "boolean"
    && Array.isArray(candidate.permissions)
    && Array.isArray(candidate.constraints)
    && Array.isArray(candidate.requiredEnvNames);
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
