"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createArtifactIndexProjection = createArtifactIndexProjection;
exports.readSourceReferences = readSourceReferences;
exports.toPublicSource = toPublicSource;
function createArtifactIndexProjection(options) {
    const ticketIds = new Set(options.tickets.map((ticket) => ticket.id));
    const ticketOwnersById = new Map(options.tickets.map((ticket) => [ticket.id, ticket.owner]));
    const artifactsById = new Map(options.artifacts.map((artifact) => [artifact.id, artifact]));
    const sourceEvents = new Map(options.events.map((event) => [event.eventId, event]));
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
        };
    });
    return {
        schemaVersion: 1,
        artifacts,
    };
}
function resolveRegisteredArtifacts(events, storedArtifactsById) {
    const registeredArtifacts = new Map();
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
function readArtifactFromPayload(payload) {
    const candidate = payload.artifact;
    if (!isArtifact(candidate)) {
        return null;
    }
    return candidate;
}
function isArtifact(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
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
function readSourceReferences(payload) {
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
        const nestedRecord = nestedValue;
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
function toPublicSource(event) {
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
function readOptionalString(record, key) {
    const candidate = record[key];
    return typeof candidate === "string" && candidate.trim().length > 0
        ? candidate
        : undefined;
}
