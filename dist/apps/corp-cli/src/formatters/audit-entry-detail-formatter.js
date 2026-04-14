"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAuditEntryDetail = formatAuditEntryDetail;
function formatAuditEntryDetail(entry, options) {
    const lines = [
        `Mission: ${options.missionId}`,
        `Evenement: ${entry.eventId}`,
        `Type: ${entry.eventType}`,
        `Horodatage: ${entry.occurredAt}`,
        `Titre: ${entry.title}`,
        `Resume: ${entry.summary}`,
    ];
    if (entry.ticketId) {
        lines.push(`Ticket: ${entry.ticketId}`);
    }
    if (entry.ticketOwner) {
        lines.push(`Owner ticket: ${entry.ticketOwner}`);
    }
    if (entry.attemptId) {
        lines.push(`Tentative: ${entry.attemptId}`);
    }
    if (entry.artifactId) {
        lines.push(`Artefact: ${entry.artifactId}`);
    }
    if (entry.approvalId) {
        lines.push(`Approval: ${entry.approvalId}`);
    }
    lines.push(`Acteur: ${entry.actor}`);
    lines.push(`Source: ${entry.source}`);
    if (entry.relatedEventIds.length > 0) {
        lines.push(`Evenements lies: ${entry.relatedEventIds.join(", ")}`);
    }
    if (entry.relatedArtifactIds.length > 0) {
        lines.push(`Artefacts lies: ${entry.relatedArtifactIds.join(", ")}`);
    }
    if (options.fields.length > 0) {
        lines.push("Details:");
        for (const field of options.fields) {
            lines.push(`  ${field.label}: ${field.value}`);
        }
    }
    return lines;
}
