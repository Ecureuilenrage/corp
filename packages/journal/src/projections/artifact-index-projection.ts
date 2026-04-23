import type { Artifact } from "../../../contracts/src/artifact/artifact";
import { isArtifact } from "../../../contracts/src/guards/persisted-document-guards";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { MissionResumeArtifact } from "../../../contracts/src/mission/mission-resume";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../event-log/append-event";

export interface ArtifactIndexEntry extends MissionResumeArtifact {
  artifactId: string;
  missionId: string;
  ticketId: string;
  producingEventId: string;
  attemptId: string | null;
  workspaceIsolationId: string | null;
  kind: Artifact["kind"];
  title: string;
  label?: string;
  path?: string;
  mediaType?: string;
  summary?: string;
  payloadPath?: string;
  sha256?: string;
  sizeBytes?: number;
  sourceEventType?: string;
  sourceEventOccurredAt?: string;
  sourceActor?: string;
  source?: string;
  approvalId?: string;
  decisionRef?: string;
  ticketOwner?: string;
  createdAt: string;
}

export interface ArtifactIndexProjection {
  schemaVersion: 1;
  artifacts: ArtifactIndexEntry[];
}

export function createArtifactIndexProjection(options: {
  mission: Mission;
  tickets: Ticket[];
  artifacts: Artifact[];
  events: JournalEventRecord[];
}): ArtifactIndexProjection {
  const ticketIds = new Set(options.tickets.map((ticket) => ticket.id));
  const ticketOwnersById = new Map(
    options.tickets.map((ticket) => [ticket.id, ticket.owner] as const),
  );
  const artifactsById = new Map(
    options.artifacts.map((artifact) => [artifact.id, artifact] as const),
  );
  const sourceEvents = new Map(
    options.events.map((event) => [event.eventId, event] as const),
  );

  const artifacts = resolveRegisteredArtifacts(options.events, artifactsById)
    .filter((artifact) => {
      if (artifact.missionId !== options.mission.id) {
        return false;
      }

      if (!ticketIds.has(artifact.ticketId)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const leftKey = `${left.createdAt}|${left.id}`;
      const rightKey = `${right.createdAt}|${right.id}`;
      return leftKey.localeCompare(rightKey);
    })
    .map((artifact) => {
      const sourceEvent = sourceEvents.get(artifact.producingEventId);
      const sourceReferences = readSourceReferences(sourceEvent?.payload);

      return {
        artifactId: artifact.id,
        missionId: artifact.missionId,
        ticketId: artifact.ticketId,
        producingEventId: artifact.producingEventId,
        attemptId: artifact.attemptId,
        workspaceIsolationId: artifact.workspaceIsolationId,
        kind: artifact.kind,
        title: artifact.title,
        ...(artifact.label ? { label: artifact.label } : {}),
        ...(artifact.path ? { path: artifact.path } : {}),
        ...(artifact.mediaType ? { mediaType: artifact.mediaType } : {}),
        ...(artifact.summary ? { summary: artifact.summary } : {}),
        ...(artifact.payloadPath ? { payloadPath: artifact.payloadPath } : {}),
        ...(artifact.sha256 ? { sha256: artifact.sha256 } : {}),
        ...(typeof artifact.sizeBytes === "number" ? { sizeBytes: artifact.sizeBytes } : {}),
        ...(sourceEvent?.type
          ? { sourceEventType: sourceEvent.type }
          : artifact.sourceEventType
            ? { sourceEventType: artifact.sourceEventType }
            : {}),
        ...(sourceEvent?.occurredAt
          ? { sourceEventOccurredAt: sourceEvent.occurredAt }
          : artifact.sourceEventOccurredAt
            ? { sourceEventOccurredAt: artifact.sourceEventOccurredAt }
          : {}),
        ...(sourceEvent?.actor ? { sourceActor: sourceEvent.actor } : {}),
        ...(sourceEvent ? { source: toPublicSource(sourceEvent) } : {}),
        ...(sourceReferences.approvalId ? { approvalId: sourceReferences.approvalId } : {}),
        ...(sourceReferences.decisionRef ? { decisionRef: sourceReferences.decisionRef } : {}),
        ...(ticketOwnersById.get(artifact.ticketId) ? { ticketOwner: ticketOwnersById.get(artifact.ticketId) } : {}),
        createdAt: artifact.createdAt,
      } satisfies ArtifactIndexEntry;
    });

  return {
    schemaVersion: 1,
    artifacts,
  };
}

function resolveRegisteredArtifacts(
  events: JournalEventRecord[],
  storedArtifactsById: Map<string, Artifact>,
): Artifact[] {
  const registeredArtifacts = new Map<string, Artifact>();

  for (const event of events) {
    if (event.type !== "artifact.registered") {
      continue;
    }

    const eventArtifact = readArtifactFromPayload(event.payload);

    if (!eventArtifact) {
      continue;
    }

    registeredArtifacts.set(eventArtifact.id, {
      ...eventArtifact,
      ...(storedArtifactsById.get(eventArtifact.id) ?? {}),
    });
  }

  return [...registeredArtifacts.values()];
}

function readArtifactFromPayload(payload: Record<string, unknown>): Artifact | null {
  const candidate = payload.artifact;

  if (!isArtifact(candidate)) {
    return null;
  }

  return candidate;
}


export function readSourceReferences(
  payload: Record<string, unknown> | undefined,
): { approvalId?: string; decisionRef?: string } {
  if (!payload) {
    return {};
  }

  const directApprovalId = readOptionalString(payload, "approvalId");
  const directDecisionRef = readOptionalString(payload, "decisionRef")
    ?? readOptionalString(payload, "decisionId");

  if (directApprovalId || directDecisionRef) {
    return {
      ...(directApprovalId ? { approvalId: directApprovalId } : {}),
      ...(directDecisionRef ? { decisionRef: directDecisionRef } : {}),
    };
  }

  for (const nestedValue of Object.values(payload)) {
    if (typeof nestedValue !== "object" || nestedValue === null) {
      continue;
    }

    const nestedRecord = nestedValue as Record<string, unknown>;
    const approvalId = readOptionalString(nestedRecord, "approvalId");
    const decisionRef = readOptionalString(nestedRecord, "decisionRef")
      ?? readOptionalString(nestedRecord, "decisionId");

    if (approvalId || decisionRef) {
      return {
        ...(approvalId ? { approvalId } : {}),
        ...(decisionRef ? { decisionRef } : {}),
      };
    }
  }

  return {};
}

export function toPublicSource(
  event: Pick<JournalEventRecord, "actor" | "source">,
): string {
  if (event.actor === "adapter") {
    return "execution-adapter";
  }

  if (event.source === "corp-cli" || event.source === "workspace-isolation") {
    return event.source;
  }

  return event.source.toLowerCase().includes("openai")
    || event.source.toLowerCase().includes("codex")
    ? "execution-adapter"
    : event.source;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const candidate = record[key];

  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : undefined;
}
