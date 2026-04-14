import type { RunTicketResult } from "../../../ticket-runtime/src/ticket-service/run-ticket";
import { runTicket } from "../../../ticket-runtime/src/ticket-service/run-ticket";
import {
  readMissionCompare,
  resolveMissionCompareSelection,
} from "../resume-service/read-mission-compare";
import { updateMissionLifecycle } from "./update-mission-lifecycle";

export interface RelaunchImpactedBranchOptions {
  rootDir: string;
  missionId: string;
  ticketId: string;
  background?: boolean;
}

export interface RelaunchImpactedBranchResult {
  run: RunTicketResult;
  lifecycleRelaunched: boolean;
}

export async function relaunchImpactedBranch(
  options: RelaunchImpactedBranchOptions,
): Promise<RelaunchImpactedBranchResult> {
  const compareResult = await readMissionCompare({
    rootDir: options.rootDir,
    missionId: options.missionId,
    commandName: "compare relaunch",
  });
  const selection = resolveMissionCompareSelection({
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
    throw new Error(
      `Le ticket \`${options.ticketId}\` n'est pas une racine relaunchable. Relancez d'abord la racine amont \`${selection.rootTicketId}\`.`,
    );
  }

  if (!selection.relaunchable) {
    const primaryReason = selection.blockingReasons[0];

    if (primaryReason?.code === "approval_pending") {
      throw new Error(
        `Le ticket \`${options.ticketId}\` attend encore une approbation avant toute relance ciblee.`,
      );
    }

    if (primaryReason?.code === "attempt_active") {
      throw new Error(
        `Le ticket \`${options.ticketId}\` a deja une tentative active et ne peut pas etre relance maintenant.`,
      );
    }

    if (primaryReason?.summary) {
      throw new Error(primaryReason.summary);
    }

    throw new Error(
      `Le ticket \`${options.ticketId}\` ne fait pas partie d'une branche impactee relaunchable.`,
    );
  }

  let lifecycleRelaunched = false;

  if (requiresLifecycleRelaunch(compareResult.resume.status)) {
    await updateMissionLifecycle({
      rootDir: options.rootDir,
      missionId: options.missionId,
      action: "relaunch",
    });
    lifecycleRelaunched = true;
  }

  const run = await runTicket({
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

function requiresLifecycleRelaunch(missionStatus: string): boolean {
  return missionStatus === "failed" || missionStatus === "blocked" || missionStatus === "awaiting_approval";
}
