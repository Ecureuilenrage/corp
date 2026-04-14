import type {
  MissionResume,
  MissionResumeApproval,
  MissionResumeArtifact,
  MissionResumeBlockage,
  MissionResumeTicket,
} from "../../../../packages/contracts/src/mission/mission-resume";

export function formatMissionResume(resume: MissionResume): string[] {
  return [
    `Mission: ${resume.missionId}`,
    `Titre: ${resume.title}`,
    `Objectif: ${resume.objective}`,
    `Statut: ${resume.status}`,
    "Criteres de succes:",
    ...formatCriteria(resume.successCriteria),
    `Tickets ouverts: ${formatTickets(resume.openTickets)}`,
    `Validations en attente: ${formatApprovals(resume.pendingApprovals)}`,
    `Capabilities mission: ${formatExtensionList(resume.authorizedExtensions.allowedCapabilities, "aucune")}`,
    `Skill packs mission: ${formatExtensionList(resume.authorizedExtensions.skillPackRefs, "aucun")}`,
    `Dernier artefact pertinent: ${formatArtifact(resume.lastRelevantArtifact)}`,
    `Dernier blocage connu: ${formatBlockage(resume.lastKnownBlockage)}`,
    `Dernier evenement: ${resume.lastEventId}`,
    `Mis a jour: ${resume.updatedAt}`,
    `Prochain arbitrage utile: ${resume.nextOperatorAction}`,
  ];
}

function formatExtensionList(values: string[], emptyValue: string): string {
  if (values.length === 0) {
    return emptyValue;
  }

  return values.join(", ");
}

function formatCriteria(successCriteria: string[]): string[] {
  if (successCriteria.length === 0) {
    return ["  aucun"];
  }

  return successCriteria.map(
    (criterion, index) => `  ${index + 1}. ${criterion}`,
  );
}

function formatTickets(openTickets: MissionResumeTicket[]): string {
  if (openTickets.length === 0) {
    return "aucun";
  }

  return openTickets.map((ticket) => formatEntity(ticket, ["ticketId", "title"])).join(", ");
}

function formatApprovals(pendingApprovals: MissionResumeApproval[]): string {
  if (pendingApprovals.length === 0) {
    return "aucune";
  }

  return pendingApprovals
    .map((approval) => formatEntity(approval, ["approvalId", "title"]))
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

  const details: string[] = [];

  if (blockage.kind === "approval_pending") {
    if (blockage.approvalId) {
      details.push(`validation=${blockage.approvalId}`);
    }

    if (blockage.ticketId) {
      details.push(`ticket=${blockage.ticketId}`);
    }

    if (blockage.attemptId) {
      details.push(`tentative=${blockage.attemptId}`);
    }
  }

  if (blockage.kind === "ticket_failed" || blockage.kind === "ticket_blocked") {
    if (blockage.ticketId) {
      details.push(`ticket=${blockage.ticketId}`);
    }

    if (blockage.attemptId) {
      details.push(`tentative=${blockage.attemptId}`);
    }

    const reasonLabel = formatBlockageReason(blockage.reasonCode);

    if (reasonLabel) {
      details.push(`raison=${reasonLabel}`);
    }
  }

  return details.length > 0
    ? `${blockage.summary} | ${details.join(" | ")}`
    : blockage.summary;
}

function formatBlockageReason(
  reasonCode: MissionResumeBlockage["reasonCode"],
): string | null {
  if (reasonCode === "approval_requested") {
    return "validation demandee";
  }

  if (reasonCode === "approval_rejected") {
    return "validation rejetee";
  }

  if (reasonCode === "approval_deferred") {
    return "validation differee";
  }

  if (reasonCode === "ticket_failed") {
    return "ticket en echec";
  }

  if (reasonCode === "ticket_blocked") {
    return "ticket bloque";
  }

  if (reasonCode === "dependency_pending") {
    return "dependance en attente";
  }

  if (reasonCode === "dependency_cancelled") {
    return "dependance annulee";
  }

  if (reasonCode === "dependency_failed") {
    return "dependance en echec";
  }

  if (reasonCode === "dependency_missing") {
    return "dependance manquante";
  }

  if (reasonCode === "mission_paused") {
    return "mission en pause";
  }

  if (reasonCode === "mission_failed") {
    return "mission en echec";
  }

  return null;
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
