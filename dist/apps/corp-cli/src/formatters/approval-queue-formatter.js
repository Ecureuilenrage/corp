"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatApprovalQueue = formatApprovalQueue;
function formatApprovalQueue(approvals) {
    if (approvals.length === 0) {
        return [
            "File d'approbation:",
            "  Aucune validation en attente.",
        ];
    }
    return [
        "File d'approbation:",
        ...approvals.flatMap((approval, index) => formatApprovalEntry(approval, index)),
    ];
}
function formatApprovalEntry(approval, index) {
    return [
        `  ${index + 1}. ${approval.approvalId} | ticket=${approval.ticketId} | attempt=${approval.attemptId} | statut=${approval.status}`,
        `     titre=${approval.title}`,
        `     action=${approval.actionType} | resume=${approval.actionSummary}`,
        `     garde-fous=${formatList(approval.guardrails, "aucun", " ; ")}`,
        `     evenements=${formatList(approval.relatedEventIds, "aucun")}`,
        `     artefacts=${formatList(approval.relatedArtifactIds, "aucun")}`,
    ];
}
function formatList(values, fallback, separator = ", ") {
    return values.length > 0 ? values.join(separator) : fallback;
}
