import type { MissionAuditEntry } from "../../../../packages/journal/src/projections/audit-log-projection";

export function formatAuditLog(entries: MissionAuditEntry[]): string[] {
  if (entries.length === 0) {
    return [
      "Journal d'audit:",
      "  Aucun evenement d'audit pour cette selection.",
    ];
  }

  const lines = ["Journal d'audit:"];

  entries.forEach((entry, index) => {
    lines.push(
      `  ${index + 1}. ${entry.occurredAt} | ${entry.title} | event=${entry.eventId} | type=${entry.eventType}`,
    );
    lines.push(`     resume=${entry.summary}`);

    const correlations = [
      entry.ticketId ? `ticket=${entry.ticketId}` : null,
      entry.ticketOwner ? `owner=${entry.ticketOwner}` : null,
      entry.attemptId ? `attempt=${entry.attemptId}` : null,
      `acteur=${entry.actor}`,
      `source=${entry.source}`,
    ].filter((value): value is string => value !== null);

    lines.push(`     ${correlations.join(" | ")}`);

    if (entry.approvalId) {
      lines.push(`     approval=${entry.approvalId}`);
    }

    if (entry.artifactId) {
      lines.push(`     artefact=${entry.artifactId}`);
    }

    if (entry.relatedEventIds.length > 0) {
      lines.push(`     evenements lies=${entry.relatedEventIds.join(", ")}`);
    }

    if (entry.relatedArtifactIds.length > 0) {
      lines.push(`     artefacts lies=${entry.relatedArtifactIds.join(", ")}`);
    }
  });

  return lines;
}
