"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLogProjection = createAuditLogProjection;
const extension_registration_1 = require("../../../contracts/src/extension/extension-registration");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const mission_1 = require("../../../contracts/src/mission/mission");
const artifact_index_projection_1 = require("./artifact-index-projection");
function createAuditLogProjection(options) {
    const ticketOwnersById = new Map(options.tickets.map((ticket) => [ticket.id, ticket.owner]));
    const artifactIndex = (0, artifact_index_projection_1.createArtifactIndexProjection)(options);
    const relatedArtifactIdsByEventId = new Map();
    for (const artifact of artifactIndex.artifacts) {
        const existingArtifactIds = relatedArtifactIdsByEventId.get(artifact.producingEventId) ?? [];
        existingArtifactIds.push(artifact.artifactId);
        relatedArtifactIdsByEventId.set(artifact.producingEventId, (0, extension_registration_1.normalizeOpaqueReferences)(existingArtifactIds));
    }
    const entries = options.events
        .filter((event) => event.missionId === options.mission.id)
        .sort((left, right) => `${left.occurredAt}|${left.eventId}`.localeCompare(`${right.occurredAt}|${right.eventId}`))
        .map((event) => buildMissionAuditEntry(event, {
        ticketOwnersById,
        relatedArtifactIdsByEventId,
    }));
    return {
        schemaVersion: 1,
        entries,
    };
}
function buildMissionAuditEntry(event, context) {
    const approval = readApprovalFromPayload(event.payload);
    const artifact = readArtifactFromPayload(event.payload);
    const capability = readCapabilityInvocationFromPayload(event.payload);
    const skillPack = readSkillPackUsageFromPayload(event.payload);
    const sourceReferences = (0, artifact_index_projection_1.readSourceReferences)(event.payload);
    const relatedArtifactIds = (0, extension_registration_1.normalizeOpaqueReferences)([
        ...readRelatedArtifactIds(event.payload),
        ...(context.relatedArtifactIdsByEventId.get(event.eventId) ?? []),
        ...(artifact ? [artifact.id] : []),
    ]);
    const relatedEventIds = (0, extension_registration_1.normalizeOpaqueReferences)([
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
        source: (0, artifact_index_projection_1.toPublicSource)(event),
        ...(ticketOwner ? { ticketOwner } : {}),
        relatedEventIds,
        relatedArtifactIds,
    };
}
function describeEvent(event, context) {
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
        const authorizedExtensions = readAuthorizedExtensionsFromPayload(event.payload, "authorizedExtensions");
        const changedFields = readStringArray(event.payload, "changedFields");
        const fragments = [];
        if (authorizedExtensions) {
            fragments.push(`capabilities=${formatListSummary(authorizedExtensions.allowedCapabilities, "aucune")}`);
            fragments.push(`skill packs=${formatListSummary(authorizedExtensions.skillPackRefs, "aucun")}`);
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
function buildMissionSummary(event, verb) {
    const mission = readMissionFromPayload(event.payload);
    return mission
        ? `Mission ${mission.title} ${verb}.`
        : `Mission ${event.missionId} ${verb}.`;
}
function buildTicketSummary(event, ticketId, verb) {
    const ticket = readTicketFromPayload(event.payload);
    if (ticket) {
        return `Ticket ${ticket.id} ${verb}: ${ticket.goal}.`;
    }
    return `Ticket ${ticketId ?? "inconnu"} ${verb}.`;
}
function buildExecutionSummary(statusLabel, context) {
    const artifactSummary = context.relatedArtifactIds.length > 0
        ? ` ${context.relatedArtifactIds.length} artefact(s) lie(s).`
        : "";
    return `Tentative ${context.attemptId ?? "inconnue"} ${statusLabel} pour le ticket ${context.ticketId ?? "inconnu"}.${artifactSummary}`;
}
function buildApprovalSummary(outcomeLabel, context) {
    const actionSummary = context.approval?.actionSummary?.trim();
    const suffix = actionSummary ? ` ${actionSummary}.` : "";
    return `Validation ${context.approvalId ?? "inconnue"} ${outcomeLabel} pour le ticket ${context.ticketId ?? "inconnu"}.${suffix}`;
}
function buildArtifactSummary(verb, artifact, ticketId) {
    if (artifact) {
        return `Artefact ${artifact.id} ${verb} pour le ticket ${artifact.ticketId}: ${artifact.title}.`;
    }
    return `Artefact ${verb} pour le ticket ${ticketId ?? "inconnu"}.`;
}
function buildCapabilitySummary(capability, ticketId) {
    if (capability) {
        return `Capability ${capability.capabilityId} (provider ${capability.provider}) invoquee pour le ticket ${ticketId ?? "inconnu"}.`;
    }
    return `Capability invoquee pour le ticket ${ticketId ?? "inconnu"}.`;
}
function buildSkillPackSummary(skillPack, ticketId) {
    if (skillPack) {
        return `Skill pack ${skillPack.packRef} utilise pour le ticket ${ticketId ?? "inconnu"}.`;
    }
    return `Skill pack utilise pour le ticket ${ticketId ?? "inconnu"}.`;
}
function formatListSummary(values, emptyLabel) {
    return values.length > 0 ? values.join(", ") : emptyLabel;
}
function resolveEventKind(eventType) {
    const [prefix] = eventType.split(".");
    return prefix?.trim().length ? prefix : "event";
}
function readApprovalFromPayload(payload) {
    const candidate = payload.approval ?? payload.approvalRequest;
    return (0, persisted_document_guards_1.isApprovalRequest)(candidate) ? candidate : null;
}
function readArtifactFromPayload(payload) {
    const candidate = payload.artifact;
    return (0, persisted_document_guards_1.isArtifact)(candidate) ? candidate : null;
}
function readMissionFromPayload(payload) {
    const candidate = payload.mission;
    return isAuditMissionShape(candidate) ? (0, mission_1.hydrateMission)(candidate) : null;
}
function readTicketFromPayload(payload) {
    const candidate = payload.ticket;
    return (0, persisted_document_guards_1.isTicket)(candidate) ? candidate : null;
}
function readIsolationFromPayload(payload) {
    const candidate = payload.isolation;
    return (0, persisted_document_guards_1.isWorkspaceIsolationMetadata)(candidate) ? candidate : null;
}
function readCapabilityInvocationFromPayload(payload) {
    const candidate = payload.capability;
    return (0, persisted_document_guards_1.isCapabilityInvocationDetails)(candidate) ? candidate : null;
}
function readSkillPackUsageFromPayload(payload) {
    const candidate = payload.skillPack;
    return isSkillPackUsageDetails(candidate) ? candidate : null;
}
function readAuthorizedExtensionsFromPayload(payload, key) {
    const candidate = payload[key];
    return isAuthorizedExtensions(candidate)
        ? {
            allowedCapabilities: [...candidate.allowedCapabilities],
            skillPackRefs: [...candidate.skillPackRefs],
        }
        : null;
}
function readRelatedEventIds(payload) {
    const approval = readApprovalFromPayload(payload);
    return (0, extension_registration_1.normalizeOpaqueReferences)([
        ...readStringArray(payload, "relatedEventIds"),
        ...(approval?.relatedEventIds ?? []),
    ]);
}
function readSourceEventIds(payload) {
    return (0, extension_registration_1.normalizeOpaqueReferences)([
        ...readStringArray(payload, "sourceEventIds"),
        ...readOptionalStringValues([
            payload.producingEventId,
            payload.sourceEventId,
        ]),
    ]);
}
function readRelatedArtifactIds(payload) {
    const approval = readApprovalFromPayload(payload);
    return (0, extension_registration_1.normalizeOpaqueReferences)([
        ...readStringArray(payload, "relatedArtifactIds"),
        ...(approval?.relatedArtifactIds ?? []),
    ]);
}
function readTicketIdFromPayload(payload) {
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
function readAttemptIdFromPayload(payload) {
    const approval = readApprovalFromPayload(payload);
    if (approval) {
        return approval.attemptId;
    }
    const artifact = readArtifactFromPayload(payload);
    if (artifact?.attemptId) {
        return artifact.attemptId;
    }
    const attempt = payload.attempt;
    if ((0, persisted_document_guards_1.isExecutionAttempt)(attempt)) {
        return attempt.id;
    }
    return undefined;
}
function readTicketOwnerFromPayload(payload) {
    const ticket = readTicketFromPayload(payload);
    return ticket?.owner?.trim().length ? ticket.owner : undefined;
}
function readStringArray(payload, key) {
    const candidate = payload[key];
    return Array.isArray(candidate)
        ? candidate.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
        : [];
}
function readOptionalStringValues(values) {
    return values.filter((value) => typeof value === "string" && value.trim().length > 0);
}
function readOptionalString(payload, key) {
    const candidate = payload[key];
    return typeof candidate === "string" && candidate.trim().length > 0
        ? candidate
        : undefined;
}
function readOptionalNumber(payload, key) {
    const candidate = payload[key];
    return typeof candidate === "number" && Number.isFinite(candidate)
        ? candidate
        : undefined;
}
function readOptionalBoolean(payload, key) {
    const candidate = payload[key];
    return typeof candidate === "boolean" ? candidate : undefined;
}
// Fork delibere du guard `isMission` canonique : l'audit doit pouvoir surfacer
// des snapshots mission historiques meme si leurs tableaux (successCriteria,
// ticketIds, artifactIds, eventIds) contiennent des entrees non-string residuelles
// ou si le statut est hors union courante. Le guard canonique
// `isMission` dans packages/contracts impose une validation stricte pour les
// reads repository ; ici, l'audit privilegie la fidelite journalistique.
function isAuditMissionShape(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return typeof candidate.id === "string"
        && typeof candidate.title === "string"
        && typeof candidate.objective === "string"
        && typeof candidate.status === "string"
        && Array.isArray(candidate.successCriteria)
        && typeof candidate.policyProfileId === "string"
        && (candidate.authorizedExtensions === undefined
            || isAuthorizedExtensions(candidate.authorizedExtensions))
        && Array.isArray(candidate.ticketIds)
        && Array.isArray(candidate.artifactIds)
        && Array.isArray(candidate.eventIds)
        && typeof candidate.resumeCursor === "string"
        && typeof candidate.createdAt === "string"
        && typeof candidate.updatedAt === "string";
}
function isAuthorizedExtensions(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return Array.isArray(candidate.allowedCapabilities)
        && candidate.allowedCapabilities.every((entry) => typeof entry === "string")
        && Array.isArray(candidate.skillPackRefs)
        && candidate.skillPackRefs.every((entry) => typeof entry === "string");
}
function isSkillPackUsageDetails(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const candidate = value;
    return typeof candidate.packRef === "string"
        && typeof candidate.registrationId === "string"
        && typeof candidate.displayName === "string"
        && Array.isArray(candidate.permissions)
        && Array.isArray(candidate.constraints)
        && typeof candidate.owner === "string"
        && Array.isArray(candidate.tags);
}
