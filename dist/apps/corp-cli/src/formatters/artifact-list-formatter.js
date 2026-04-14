"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatArtifactList = formatArtifactList;
function formatArtifactList(artifacts) {
    if (artifacts.length === 0) {
        return [
            "Artefacts de mission:",
            "  Aucun artefact enregistre.",
        ];
    }
    return [
        "Artefacts de mission:",
        ...artifacts.map((artifact, index) => formatArtifactListEntry(artifact, index)),
    ];
}
function formatArtifactListEntry(artifact, index) {
    const reference = artifact.path ?? artifact.label ?? artifact.title;
    return [
        `  ${index + 1}. ${artifact.artifactId}`,
        `ticket=${artifact.ticketId}`,
        `kind=${artifact.kind}`,
        `ref=${reference}`,
        `event=${artifact.producingEventId}`,
        `source=${artifact.sourceEventType ?? "inconnu"}`,
        `tentative=${artifact.attemptId ?? "aucune"}`,
        `isolation=${artifact.workspaceIsolationId ?? "aucune"}`,
    ].join(" | ");
}
