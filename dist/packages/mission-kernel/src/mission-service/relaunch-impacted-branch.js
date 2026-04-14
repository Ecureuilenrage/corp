"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relaunchImpactedBranch = relaunchImpactedBranch;
const run_ticket_1 = require("../../../ticket-runtime/src/ticket-service/run-ticket");
const read_mission_compare_1 = require("../resume-service/read-mission-compare");
const update_mission_lifecycle_1 = require("./update-mission-lifecycle");
async function relaunchImpactedBranch(options) {
    const compareResult = await (0, read_mission_compare_1.readMissionCompare)({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName: "compare relaunch",
    });
    const selection = (0, read_mission_compare_1.resolveMissionCompareSelection)({
        ticketBoard: compareResult.ticketBoard,
        approvals: compareResult.approvals,
        resume: compareResult.resume,
        branchCandidates: compareResult.branchCandidates,
        ticketId: options.ticketId,
    });
    if (selection.selectionState === "missing") {
        throw new Error(`Ticket introuvable dans la mission: ${options.ticketId}.`);
    }
    if (selection.selectionState === "descendant" && selection.rootTicketId) {
        throw new Error(`Le ticket \`${options.ticketId}\` n'est pas une racine relaunchable. Relancez d'abord la racine amont \`${selection.rootTicketId}\`.`);
    }
    if (!selection.relaunchable) {
        const primaryReason = selection.blockingReasons[0];
        if (primaryReason?.code === "approval_pending") {
            throw new Error(`Le ticket \`${options.ticketId}\` attend encore une approbation avant toute relance ciblee.`);
        }
        if (primaryReason?.code === "attempt_active") {
            throw new Error(`Le ticket \`${options.ticketId}\` a deja une tentative active et ne peut pas etre relance maintenant.`);
        }
        if (primaryReason?.summary) {
            throw new Error(primaryReason.summary);
        }
        throw new Error(`Le ticket \`${options.ticketId}\` ne fait pas partie d'une branche impactee relaunchable.`);
    }
    let lifecycleRelaunched = false;
    if (requiresLifecycleRelaunch(compareResult.resume.status)) {
        await (0, update_mission_lifecycle_1.updateMissionLifecycle)({
            rootDir: options.rootDir,
            missionId: options.missionId,
            action: "relaunch",
        });
        lifecycleRelaunched = true;
    }
    const run = await (0, run_ticket_1.runTicket)({
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        background: options.background,
        allowBlockedTicketRetry: selection.allowBlockedTicketRetry,
    });
    return {
        run,
        lifecycleRelaunched,
    };
}
function requiresLifecycleRelaunch(missionStatus) {
    return missionStatus === "failed" || missionStatus === "blocked" || missionStatus === "awaiting_approval";
}
