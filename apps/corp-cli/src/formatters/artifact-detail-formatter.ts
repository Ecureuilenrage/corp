import type { ArtifactIndexEntry } from "../../../../packages/journal/src/projections/artifact-index-projection";

export function formatArtifactDetail(
  artifact: ArtifactIndexEntry,
  options: {
    missionId: string;
    payloadPreview: string | null;
  },
): string[] {
  const lines = [
    `Mission: ${options.missionId}`,
    `Ticket: ${artifact.ticketId}`,
    ...(artifact.ticketOwner ? [`Owner ticket: ${artifact.ticketOwner}`] : []),
    `Artefact: ${artifact.artifactId}`,
    `Type: ${artifact.kind}`,
    `Titre: ${artifact.title}`,
    `Evenement producteur: ${artifact.producingEventId}`,
    `Type source: ${artifact.sourceEventType ?? "inconnu"}`,
    `Survenu a: ${artifact.sourceEventOccurredAt ?? "inconnu"}`,
    `Acteur: ${artifact.sourceActor ?? "inconnu"}`,
    `Source: ${artifact.source ?? "inconnu"}`,
    `Tentative: ${artifact.attemptId ?? "aucune"}`,
    `Isolation: ${artifact.workspaceIsolationId ?? "aucune"}`,
  ];

  if (artifact.path) {
    lines.push(`Chemin: ${artifact.path}`);
  }

  if (artifact.label) {
    lines.push(`Label: ${artifact.label}`);
  }

  if (artifact.mediaType) {
    lines.push(`Media type: ${artifact.mediaType}`);
  }

  if (artifact.summary) {
    lines.push(`Resume: ${artifact.summary}`);
  }

  if (artifact.approvalId) {
    lines.push(`Approval: ${artifact.approvalId}`);
  }

  if (artifact.decisionRef) {
    lines.push(`Decision: ${artifact.decisionRef}`);
  }

  if (options.payloadPreview) {
    lines.push("Preview:");
    lines.push(`  ${options.payloadPreview}`);
  }

  return lines;
}
