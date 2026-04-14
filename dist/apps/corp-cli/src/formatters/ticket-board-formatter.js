"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTicketBoard = formatTicketBoard;
function formatTicketBoard(ticketBoardEntries) {
    if (ticketBoardEntries.length === 0) {
        return [
            "Etat des tickets:",
            "  Aucun ticket n'existe encore.",
        ];
    }
    return [
        "Etat des tickets:",
        ...ticketBoardEntries.map((ticketBoardEntry, index) => formatTicketBoardEntry(ticketBoardEntry, index)),
    ];
}
function formatTicketBoardEntry(ticketBoardEntry, index) {
    const parts = [
        `${index + 1}. ${ticketBoardEntry.ticketId}`,
        `statut=${ticketBoardEntry.status}`,
        `owner=${ticketBoardEntry.owner || "inconnu"}`,
        `dependances=${formatDependencies(ticketBoardEntry)}`,
        `suivi=${ticketBoardEntry.trackingState}`,
        `motif=${formatReason(ticketBoardEntry)}`,
    ];
    const attemptSummary = formatAttemptSummary(ticketBoardEntry);
    if (attemptSummary) {
        parts.push(`tentative=${attemptSummary}`);
    }
    const extensionUsage = formatExtensionUsage(ticketBoardEntry);
    if (extensionUsage) {
        parts.push(`usage=${extensionUsage}`);
    }
    return `  ${parts.join(" | ")}`;
}
function formatDependencies(ticketBoardEntry) {
    if (ticketBoardEntry.dependencyStatuses.length === 0) {
        return "aucune";
    }
    return ticketBoardEntry.dependencyStatuses
        .map((dependencyStatus) => `${dependencyStatus.ticketId}(${dependencyStatus.status})`)
        .join(", ");
}
function formatReason(ticketBoardEntry) {
    const reasonLabel = REASON_LABELS[ticketBoardEntry.statusReasonCode];
    if (!reasonLabel) {
        return ticketBoardEntry.statusReasonCode;
    }
    if (ticketBoardEntry.statusReasonCode === "dependency_pending"
        || ticketBoardEntry.statusReasonCode === "dependency_cancelled"
        || ticketBoardEntry.statusReasonCode === "dependency_failed") {
        const blockingDependencies = ticketBoardEntry.dependencyStatuses
            .filter((dependencyStatus) => dependencyStatus.blocksRunnable)
            .map((dependencyStatus) => `${dependencyStatus.ticketId}(${dependencyStatus.status})`);
        if (blockingDependencies.length > 0) {
            return `${reasonLabel}: ${blockingDependencies.join(", ")}`;
        }
    }
    return reasonLabel;
}
function formatAttemptSummary(ticketBoardEntry) {
    if (ticketBoardEntry.activeAttemptId && ticketBoardEntry.activeAttemptStatus) {
        return `${ticketBoardEntry.activeAttemptId}(${ticketBoardEntry.activeAttemptStatus})`;
    }
    if (ticketBoardEntry.lastAttemptId && ticketBoardEntry.lastAttemptStatus) {
        return `${ticketBoardEntry.lastAttemptId}(${ticketBoardEntry.lastAttemptStatus})`;
    }
    return null;
}
function formatExtensionUsage(ticketBoardEntry) {
    const usageParts = [];
    if (ticketBoardEntry.usedCapabilities.length > 0) {
        usageParts.push(`caps=${ticketBoardEntry.usedCapabilities.join(",")}`);
    }
    if (ticketBoardEntry.usedSkillPacks.length > 0) {
        usageParts.push(`packs=${ticketBoardEntry.usedSkillPacks.join(",")}`);
    }
    return usageParts.length > 0 ? usageParts.join(" ; ") : null;
}
const REASON_LABELS = {
    runnable: "pret a lancer",
    dependency_pending: "prerequis en attente",
    dependency_cancelled: "prerequis annule",
    dependency_failed: "prerequis en echec",
    dependency_missing: "prerequis introuvable",
    ticket_claimed: "ticket reserve",
    ticket_in_progress: "ticket en cours",
    ticket_blocked: "ticket bloque",
    ticket_awaiting_approval: "ticket en attente d'approbation",
    ticket_done: "ticket termine",
    ticket_failed: "ticket en echec",
    ticket_cancelled: "ticket annule",
};
