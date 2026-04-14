"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMissionCompare = readMissionCompare;
exports.resolveMissionCompareSelection = resolveMissionCompareSelection;
const read_approval_queue_1 = require("./read-approval-queue");
const read_mission_artifacts_1 = require("./read-mission-artifacts");
const read_mission_resume_1 = require("./read-mission-resume");
async function readMissionCompare(options) {
    const commandName = options.commandName ?? "compare";
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName,
    });
    const approvalQueueResult = await (0, read_approval_queue_1.readApprovalQueue)({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName,
    });
    const artifactIndexResult = await (0, read_mission_artifacts_1.readMissionArtifacts)({
        rootDir: options.rootDir,
        missionId: options.missionId,
        commandName,
    });
    const context = buildAnalysisContext(resumeResult.resume, resumeResult.ticketBoard, approvalQueueResult.approvals);
    const branchCandidates = buildBranchCandidates(context);
    const compare = buildMissionCompare(context, branchCandidates, approvalQueueResult.approvals);
    return {
        compare,
        resume: resumeResult.resume,
        ticketBoard: resumeResult.ticketBoard,
        approvals: approvalQueueResult.approvals,
        artifacts: artifactIndexResult.artifacts,
        branchCandidates: branchCandidates.map((candidate) => candidate.branch),
        reconstructed: resumeResult.reconstructed
            || approvalQueueResult.reconstructed
            || artifactIndexResult.reconstructed,
    };
}
function resolveMissionCompareSelection(options) {
    const context = buildAnalysisContext(options.resume, options.ticketBoard, options.approvals);
    const ticketEntry = context.ticketsById.get(options.ticketId);
    if (!ticketEntry) {
        return {
            selectionState: "missing",
            rootTicketId: null,
            impactedTicketIds: [],
            relaunchable: false,
            blockingReasons: [
                {
                    code: "ticket_missing",
                    summary: `Ticket introuvable dans la mission: ${options.ticketId}.`,
                    ticketId: options.ticketId,
                },
            ],
            allowBlockedTicketRetry: false,
        };
    }
    const directBranch = options.branchCandidates.find((branch) => branch.rootTicketId === options.ticketId);
    if (directBranch) {
        return {
            selectionState: "root",
            rootTicketId: directBranch.rootTicketId,
            impactedTicketIds: [...directBranch.impactedTicketIds],
            relaunchable: directBranch.relaunchable,
            blockingReasons: [...directBranch.blockingReasons],
            allowBlockedTicketRetry: ticketEntry.status === "blocked",
        };
    }
    const ancestorBranch = options.branchCandidates.find((branch) => branch.impactedTicketIds.includes(options.ticketId));
    if (ancestorBranch && ancestorBranch.rootTicketId) {
        return {
            selectionState: "descendant",
            rootTicketId: ancestorBranch.rootTicketId,
            impactedTicketIds: [...ancestorBranch.impactedTicketIds],
            relaunchable: false,
            blockingReasons: [
                {
                    code: "upstream_root_required",
                    summary: `Le ticket ${options.ticketId} depend encore de la racine amont ${ancestorBranch.rootTicketId}.`,
                    ticketId: options.ticketId,
                    relatedTicketId: ancestorBranch.rootTicketId,
                },
            ],
            allowBlockedTicketRetry: false,
        };
    }
    const directReasons = describeDirectSelectionReasons(ticketEntry, context);
    return {
        selectionState: "non_impacted",
        rootTicketId: null,
        impactedTicketIds: [],
        relaunchable: false,
        blockingReasons: directReasons.length > 0
            ? directReasons
            : [
                {
                    code: "ticket_not_impacted",
                    summary: `Le ticket ${options.ticketId} ne fait pas partie d'une branche impactee a relancer.`,
                    ticketId: options.ticketId,
                },
            ],
        allowBlockedTicketRetry: false,
    };
}
function buildMissionCompare(context, branchCandidates, approvals) {
    const operatorValidationRequired = hasOnlyTerminalTickets(context.sortedTickets);
    const primaryBranch = selectPrimaryBranch(context, branchCandidates, operatorValidationRequired);
    return {
        missionId: context.resume.missionId,
        expected: {
            objective: context.resume.objective,
            successCriteria: [...context.resume.successCriteria],
        },
        observed: {
            missionStatus: context.resume.status,
            openTicketIds: context.resume.openTickets
                .map((ticket) => ticket.ticketId)
                .filter((ticketId) => typeof ticketId === "string"),
            pendingApprovalCount: approvals.length,
            pendingApprovals: approvals.map((approval) => ({
                approvalId: approval.approvalId,
                ticketId: approval.ticketId,
                title: approval.title,
                status: approval.status,
            })),
            lastKnownBlockage: context.resume.lastKnownBlockage,
            lastRelevantArtifact: context.resume.lastRelevantArtifact,
            nextOperatorAction: context.resume.nextOperatorAction,
            tickets: context.sortedTickets.map((ticket) => ({
                ticketId: ticket.ticketId,
                title: ticket.title,
                status: ticket.status,
                trackingState: ticket.trackingState,
                statusReasonCode: ticket.statusReasonCode,
                blockingReasonCode: ticket.blockingReasonCode,
                planOrder: ticket.planOrder,
            })),
        },
        gaps: buildGaps(context, approvals, operatorValidationRequired),
        impactedBranch: primaryBranch,
        operatorValidationRequired,
    };
}
function buildAnalysisContext(resume, ticketBoard, approvals) {
    const sortedTickets = [...ticketBoard.tickets].sort((left, right) => left.planOrder - right.planOrder || left.ticketId.localeCompare(right.ticketId));
    const ticketsById = new Map(sortedTickets.map((ticket) => [ticket.ticketId, ticket]));
    const approvalsByTicketId = new Map();
    for (const approval of approvals) {
        const existingApprovals = approvalsByTicketId.get(approval.ticketId) ?? [];
        existingApprovals.push(approval);
        approvalsByTicketId.set(approval.ticketId, existingApprovals);
    }
    const reverseDependencies = new Map();
    for (const ticket of sortedTickets) {
        for (const dependencyId of ticket.dependsOn) {
            const descendants = reverseDependencies.get(dependencyId) ?? [];
            descendants.push(ticket.ticketId);
            reverseDependencies.set(dependencyId, descendants);
        }
    }
    return {
        resume,
        sortedTickets,
        ticketsById,
        approvalsByTicketId,
        reverseDependencies,
    };
}
function buildBranchCandidates(context) {
    const problemTickets = context.sortedTickets.filter((ticket) => isProblemTicket(ticket, context));
    const candidatesByRootId = new Map();
    for (const problemTicket of problemTickets) {
        const rootTicketIds = resolveProblemRootIds(problemTicket.ticketId, context);
        if (rootTicketIds.length !== 1) {
            continue;
        }
        const rootEntry = context.ticketsById.get(rootTicketIds[0]);
        if (!rootEntry || candidatesByRootId.has(rootEntry.ticketId)) {
            continue;
        }
        candidatesByRootId.set(rootEntry.ticketId, buildBranchCandidate(rootEntry, context));
    }
    return [...candidatesByRootId.values()].sort((left, right) => left.rootPlanOrder - right.rootPlanOrder);
}
function buildBranchCandidate(rootEntry, context) {
    const impactedTicketIds = collectImpactedTicketIds(rootEntry.ticketId, context);
    const blockingReasons = describeBranchBlockingReasons(rootEntry, context);
    return {
        rootPlanOrder: rootEntry.planOrder,
        branch: {
            rootTicketId: rootEntry.ticketId,
            impactedTicketIds,
            relaunchable: blockingReasons.length === 0,
            blockingReasons,
        },
    };
}
function selectPrimaryBranch(context, branchCandidates, operatorValidationRequired) {
    if (operatorValidationRequired) {
        return {
            rootTicketId: null,
            impactedTicketIds: [],
            relaunchable: false,
            blockingReasons: [
                {
                    code: "validation_operateur_requise",
                    summary: "Validation operateur requise avant toute conclusion de mission.",
                },
            ],
        };
    }
    const preferredTicketId = context.resume.lastKnownBlockage?.ticketId
        ?? context.sortedTickets.find((ticket) => isProblemTicket(ticket, context))?.ticketId
        ?? null;
    if (preferredTicketId) {
        const preferredBranch = branchCandidates.find((candidate) => candidate.branch.impactedTicketIds.includes(preferredTicketId));
        if (preferredBranch) {
            return preferredBranch.branch;
        }
        const preferredEntry = context.ticketsById.get(preferredTicketId);
        if (preferredEntry) {
            const fallbackReasons = describeDirectSelectionReasons(preferredEntry, context);
            if (fallbackReasons.length > 0) {
                return {
                    rootTicketId: null,
                    impactedTicketIds: [],
                    relaunchable: false,
                    blockingReasons: fallbackReasons,
                };
            }
        }
    }
    if (branchCandidates.length > 0) {
        return branchCandidates[0].branch;
    }
    const lifecycleReason = describeMissionLifecycleReason(context.resume);
    return {
        rootTicketId: null,
        impactedTicketIds: [],
        relaunchable: false,
        blockingReasons: lifecycleReason ? [lifecycleReason] : [],
    };
}
function buildGaps(context, approvals, operatorValidationRequired) {
    if (operatorValidationRequired) {
        return [
            {
                code: "validation_operateur_requise",
                summary: "Tous les tickets sont termines, mais les criteres de succes exigent une validation operateur.",
            },
        ];
    }
    const gaps = [];
    for (const approval of approvals) {
        gaps.push({
            code: "approval_pending",
            summary: `La validation ${approval.approvalId} attend encore une decision operateur.`,
            ticketId: approval.ticketId,
            approvalId: approval.approvalId,
        });
    }
    for (const ticket of context.sortedTickets) {
        if (ticket.status === "failed") {
            gaps.push({
                code: "ticket_failed",
                summary: `Le ticket critique ${ticket.ticketId} a echoue.`,
                ticketId: ticket.ticketId,
            });
            continue;
        }
        if (ticket.status === "blocked" && ticket.blockedByTicketIds.length === 0) {
            gaps.push({
                code: "ticket_blocked",
                summary: `Le ticket ${ticket.ticketId} reste localement bloque.`,
                ticketId: ticket.ticketId,
            });
            continue;
        }
        if (ticket.blockingReasonCode) {
            gaps.push({
                code: ticket.blockingReasonCode,
                summary: describeDependencyGapSummary(ticket),
                ticketId: ticket.ticketId,
            });
        }
    }
    return dedupeGaps(gaps);
}
function describeDirectSelectionReasons(ticket, context) {
    const blockingReasons = [];
    const pendingApprovals = context.approvalsByTicketId.get(ticket.ticketId) ?? [];
    if (pendingApprovals.length > 0 || ticket.status === "awaiting_approval") {
        blockingReasons.push({
            code: "approval_pending",
            summary: `Le ticket ${ticket.ticketId} attend encore une approbation operateur.`,
            ticketId: ticket.ticketId,
            approvalId: pendingApprovals[0]?.approvalId,
        });
    }
    if ((ticket.activeAttemptId && ticket.activeAttemptStatus !== "awaiting_approval")
        || ticket.status === "claimed"
        || ticket.status === "in_progress") {
        blockingReasons.push({
            code: "attempt_active",
            summary: `Le ticket ${ticket.ticketId} a deja une tentative active.`,
            ticketId: ticket.ticketId,
        });
    }
    if (ticket.status === "done") {
        blockingReasons.push({
            code: "ticket_done",
            summary: `Le ticket ${ticket.ticketId} est deja termine.`,
            ticketId: ticket.ticketId,
        });
    }
    if (ticket.status === "cancelled") {
        blockingReasons.push({
            code: "ticket_cancelled",
            summary: `Le ticket ${ticket.ticketId} est annule et n'est pas relaunchable.`,
            ticketId: ticket.ticketId,
        });
    }
    if (ticket.blockingReasonCode === "dependency_missing") {
        blockingReasons.push({
            code: "dependency_missing",
            summary: `Le ticket ${ticket.ticketId} depend encore d'une dependance introuvable.`,
            ticketId: ticket.ticketId,
        });
    }
    if (blockingReasons.length > 0) {
        return blockingReasons;
    }
    return [];
}
function describeBranchBlockingReasons(rootEntry, context) {
    const blockingReasons = describeDirectSelectionReasons(rootEntry, context);
    if (context.resume.status === "completed" || context.resume.status === "cancelled") {
        blockingReasons.push({
            code: "mission_terminal",
            summary: `La mission est deja dans un statut terminal: ${context.resume.status}.`,
            ticketId: rootEntry.ticketId,
        });
    }
    if (rootEntry.status === "blocked" && rootEntry.blockedByTicketIds.length > 0) {
        blockingReasons.push({
            code: rootEntry.blockingReasonCode ?? "dependency_pending",
            summary: describeDependencyGapSummary(rootEntry),
            ticketId: rootEntry.ticketId,
            relatedTicketId: rootEntry.blockedByTicketIds[0],
        });
    }
    if (rootEntry.status === "todo" && !rootEntry.runnable) {
        blockingReasons.push({
            code: rootEntry.blockingReasonCode ?? "dependency_pending",
            summary: describeDependencyGapSummary(rootEntry),
            ticketId: rootEntry.ticketId,
            relatedTicketId: rootEntry.blockedByTicketIds[0],
        });
    }
    return dedupeBlockingReasons(blockingReasons);
}
function describeMissionLifecycleReason(resume) {
    if (!resume.lastKnownBlockage || resume.lastKnownBlockage.kind !== "mission_lifecycle") {
        return null;
    }
    return {
        code: resume.lastKnownBlockage.reasonCode ?? "mission_lifecycle",
        summary: resume.lastKnownBlockage.summary,
    };
}
function isProblemTicket(ticket, context) {
    if ((context.approvalsByTicketId.get(ticket.ticketId)?.length ?? 0) > 0) {
        return true;
    }
    return ticket.status === "failed"
        || ticket.status === "blocked"
        || ticket.status === "awaiting_approval"
        || ticket.blockingReasonCode !== null;
}
function resolveProblemRootIds(ticketId, context, trail = new Set()) {
    if (trail.has(ticketId)) {
        return [];
    }
    trail.add(ticketId);
    const ticket = context.ticketsById.get(ticketId);
    if (!ticket) {
        return [];
    }
    if ((context.approvalsByTicketId.get(ticketId)?.length ?? 0) > 0) {
        return [ticketId];
    }
    if (ticket.status === "awaiting_approval") {
        return [ticketId];
    }
    if (ticket.status === "failed") {
        return [ticketId];
    }
    if (ticket.status === "blocked" && ticket.blockedByTicketIds.length === 0) {
        return [ticketId];
    }
    if (ticket.status === "claimed"
        || ticket.status === "in_progress"
        || ticket.status === "cancelled"
        || (ticket.status === "todo" && ticket.runnable)) {
        return [ticketId];
    }
    if (ticket.blockedByTicketIds.length === 0) {
        return [];
    }
    return dedupeTicketIds(ticket.blockedByTicketIds.flatMap((blockingTicketId) => resolveProblemRootIds(blockingTicketId, context, new Set(trail))));
}
function collectImpactedTicketIds(rootTicketId, context) {
    const visited = new Set([rootTicketId]);
    const queue = [...(context.reverseDependencies.get(rootTicketId) ?? [])];
    while (queue.length > 0) {
        const currentTicketId = queue.shift();
        if (!currentTicketId || visited.has(currentTicketId)) {
            continue;
        }
        visited.add(currentTicketId);
        queue.push(...(context.reverseDependencies.get(currentTicketId) ?? []));
    }
    return context.sortedTickets
        .map((ticket) => ticket.ticketId)
        .filter((ticketId) => visited.has(ticketId));
}
function hasOnlyTerminalTickets(sortedTickets) {
    return sortedTickets.length > 0
        && sortedTickets.every((ticket) => ticket.status === "done" || ticket.status === "cancelled");
}
function describeDependencyGapSummary(ticket) {
    const dependencyList = ticket.blockedByTicketIds.length > 0
        ? ticket.blockedByTicketIds.join(", ")
        : "dependance inconnue";
    if (ticket.blockingReasonCode === "dependency_failed") {
        return `Le ticket ${ticket.ticketId} reste bloque par un echec amont: ${dependencyList}.`;
    }
    if (ticket.blockingReasonCode === "dependency_cancelled") {
        return `Le ticket ${ticket.ticketId} reste bloque par une dependance annulee: ${dependencyList}.`;
    }
    if (ticket.blockingReasonCode === "dependency_missing") {
        return `Le ticket ${ticket.ticketId} depend encore d'une dependance introuvable.`;
    }
    return `Le ticket ${ticket.ticketId} attend encore des prerequis amont: ${dependencyList}.`;
}
function dedupeTicketIds(values) {
    return [...new Set(values)];
}
function dedupeGaps(gaps) {
    const seenGapKeys = new Set();
    return gaps.filter((gap) => {
        const gapKey = `${gap.code}|${gap.ticketId ?? ""}|${gap.approvalId ?? ""}`;
        if (seenGapKeys.has(gapKey)) {
            return false;
        }
        seenGapKeys.add(gapKey);
        return true;
    });
}
function dedupeBlockingReasons(blockingReasons) {
    const seenReasonKeys = new Set();
    return blockingReasons.filter((blockingReason) => {
        const reasonKey = [
            blockingReason.code,
            blockingReason.ticketId ?? "",
            blockingReason.approvalId ?? "",
            blockingReason.relatedTicketId ?? "",
        ].join("|");
        if (seenReasonKeys.has(reasonKey)) {
            return false;
        }
        seenReasonKeys.add(reasonKey);
        return true;
    });
}
