import type {
  MissionCompare,
  MissionCompareBlockingReason,
} from "../../../../packages/contracts/src/mission/mission-compare";
import type {
  MissionResumeArtifact,
  MissionResumeApproval,
  MissionResumeBlockage,
} from "../../../../packages/contracts/src/mission/mission-resume";

export function formatMissionCompare(compare: MissionCompare): string[] {
  const impactedTicketIds = new Set(compare.impactedBranch.impactedTicketIds);
  const descendantTicketIds = compare.impactedBranch.rootTicketId
    ? compare.impactedBranch.impactedTicketIds.filter(
      (ticketId) => ticketId !== compare.impactedBranch.rootTicketId,
    )
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

function formatCriteria(successCriteria: string[]): string[] {
  if (successCriteria.length === 0) {
    return ["    aucun"];
  }

  return successCriteria.map(
    (criterion, index) => `    ${index + 1}. ${criterion}`,
  );
}

function formatTicketIds(ticketIds: string[]): string {
  if (ticketIds.length === 0) {
    return "aucun";
  }

  return ticketIds.join(", ");
}

function formatApprovals(approvals: MissionCompare["observed"]["pendingApprovals"]): string {
  if (approvals.length === 0) {
    return "aucune";
  }

  return approvals
    .map((approval) => approval.title || approval.approvalId)
    .join(", ");
}

function formatArtifact(lastRelevantArtifact: MissionResumeArtifact | null): string {
  if (!lastRelevantArtifact) {
    return "aucun";
  }

  return formatEntity(lastRelevantArtifact, ["title", "label", "path", "artifactId"]);
}

function formatBlockage(
  blockage: MissionResumeBlockage | null | undefined,
): string {
  if (!blockage) {
    return "aucun";
  }

  return blockage.summary;
}

function formatGaps(compare: MissionCompare): string[] {
  if (compare.gaps.length === 0) {
    return ["  aucun"];
  }

  return compare.gaps.map((gap, index) => {
    const details: string[] = [];

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

function formatBlockingReasons(
  blockingReasons: MissionCompareBlockingReason[],
): string {
  if (blockingReasons.length === 0) {
    return "aucun";
  }

  return blockingReasons
    .map((reason) => reason.summary)
    .join("; ");
}

function formatEntity(
  entity: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = entity[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return JSON.stringify(entity);
}
