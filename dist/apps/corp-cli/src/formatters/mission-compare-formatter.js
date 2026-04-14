"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMissionCompare = formatMissionCompare;
function formatMissionCompare(compare) {
    const impactedTicketIds = new Set(compare.impactedBranch.impactedTicketIds);
    const descendantTicketIds = compare.impactedBranch.rootTicketId
        ? compare.impactedBranch.impactedTicketIds.filter((ticketId) => ticketId !== compare.impactedBranch.rootTicketId)
        : [];
    const nonImpactedTicketIds = compare.observed.tickets
        .map((ticket) => ticket.ticketId)
        .filter((ticketId) => !impactedTicketIds.has(ticketId));
    return [
        `Mission: ${compare.missionId}`,
        "Attendu:",
        `  Objectif: ${compare.expected.objective}`,
        "  Criteres de succes:",
        ...formatCriteria(compare.expected.successCriteria),
        "Observe:",
        `  Statut mission: ${compare.observed.missionStatus}`,
        `  Tickets ouverts: ${formatTicketIds(compare.observed.openTicketIds)}`,
        `  Validations en attente: ${formatApprovals(compare.observed.pendingApprovals)}`,
        `  Dernier artefact pertinent: ${formatArtifact(compare.observed.lastRelevantArtifact)}`,
        `  Dernier blocage connu: ${formatBlockage(compare.observed.lastKnownBlockage)}`,
        `  Prochain arbitrage utile: ${compare.observed.nextOperatorAction}`,
        "Ecarts:",
        ...formatGaps(compare),
        "Branche impactee:",
        `  Racine: ${compare.impactedBranch.rootTicketId ?? "aucune"} | relaunchable=${compare.impactedBranch.relaunchable ? "oui" : "non"}`,
        `  Descendants impactes: ${formatTicketIds(descendantTicketIds)}`,
        `  Tickets non impactes: ${formatTicketIds(nonImpactedTicketIds)}`,
        `  Blocages restants: ${formatBlockingReasons(compare.impactedBranch.blockingReasons)}`,
        `Validation operateur requise: ${compare.operatorValidationRequired ? "oui" : "non"}`,
    ];
}
function formatCriteria(successCriteria) {
    if (successCriteria.length === 0) {
        return ["    aucun"];
    }
    return successCriteria.map((criterion, index) => `    ${index + 1}. ${criterion}`);
}
function formatTicketIds(ticketIds) {
    if (ticketIds.length === 0) {
        return "aucun";
    }
    return ticketIds.join(", ");
}
function formatApprovals(approvals) {
    if (approvals.length === 0) {
        return "aucune";
    }
    return approvals
        .map((approval) => approval.title || approval.approvalId)
        .join(", ");
}
function formatArtifact(lastRelevantArtifact) {
    if (!lastRelevantArtifact) {
        return "aucun";
    }
    return formatEntity(lastRelevantArtifact, ["title", "label", "path", "artifactId"]);
}
function formatBlockage(blockage) {
    if (!blockage) {
        return "aucun";
    }
    return blockage.summary;
}
function formatGaps(compare) {
    if (compare.gaps.length === 0) {
        return ["  aucun"];
    }
    return compare.gaps.map((gap, index) => {
        const details = [];
        if (gap.ticketId) {
            details.push(`ticket=${gap.ticketId}`);
        }
        if (gap.approvalId) {
            details.push(`approval=${gap.approvalId}`);
        }
        const prefix = details.length > 0
            ? `${gap.code} | ${details.join(" | ")}`
            : gap.code;
        return `  ${index + 1}. ${prefix} | ${gap.summary}`;
    });
}
function formatBlockingReasons(blockingReasons) {
    if (blockingReasons.length === 0) {
        return "aucun";
    }
    return blockingReasons
        .map((reason) => reason.summary)
        .join("; ");
}
function formatEntity(entity, keys) {
    for (const key of keys) {
        const value = entity[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }
    return JSON.stringify(entity);
}
