import type { ApprovalQueueEntry } from "../../../../packages/contracts/src/approval/approval-request";

export function formatApprovalQueue(approvals: ApprovalQueueEntry[]): string[] {
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

function formatApprovalEntry(
  approval: ApprovalQueueEntry,
  index: number,
): string[] {
  return [
    `  ${index + 1}. ${approval.approvalId} | ticket=${approval.ticketId} | attempt=${approval.attemptId} | statut=${approval.status}`,
    `     titre=${approval.title}`,
    `     action=${approval.actionType} | resume=${approval.actionSummary}`,
    `     garde-fous=${formatList(approval.guardrails, "aucun", " ; ")}`,
    `     evenements=${formatList(approval.relatedEventIds, "aucun")}`,
    `     artefacts=${formatList(approval.relatedArtifactIds, "aucun")}`,
  ];
}

function formatList(
  values: string[],
  fallback: string,
  separator = ", ",
): string {
  return values.length > 0 ? values.join(separator) : fallback;
}
