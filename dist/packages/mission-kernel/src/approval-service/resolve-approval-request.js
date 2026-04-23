"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveApprovalRequest = resolveApprovalRequest;
const node_crypto_1 = require("node:crypto");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const file_event_log_1 = require("../../../journal/src/event-log/file-event-log");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_execution_attempt_repository_1 = require("../../../storage/src/repositories/file-execution-attempt-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const ticket_service_support_1 = require("../../../ticket-runtime/src/ticket-service/ticket-service-support");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
const read_approval_queue_1 = require("../resume-service/read-approval-queue");
const read_mission_resume_1 = require("../resume-service/read-mission-resume");
async function resolveApprovalRequest(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    const commandName = resolveCommandName(options.outcome);
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, `L'option --mission-id est obligatoire pour \`corp mission ${commandName}\`.`);
    const approvalId = (0, ticket_service_support_1.requireText)(options.approvalId, `L'option --approval-id est obligatoire pour \`corp mission ${commandName}\`.`);
    const queueResult = await (0, read_approval_queue_1.readApprovalQueue)({
        rootDir: layout.rootDir,
        missionId,
        commandName,
    });
    if (queueResult.reconstructed) {
        await (0, read_mission_resume_1.readMissionResume)({
            rootDir: layout.rootDir,
            missionId,
            commandName: "resume",
        });
    }
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    const journalEvents = (await (0, file_event_log_1.readEventLog)(layout.journalPath))
        .filter((event) => event.missionId === mission.id);
    const pendingApproval = queueResult.approvals.find((entry) => entry.approvalId === approvalId);
    if (!pendingApproval) {
        const latestApproval = findLatestApproval(journalEvents, approvalId);
        if (latestApproval && latestApproval.status !== "requested") {
            throw new Error(`La validation \`${approvalId}\` est deja resolue (statut: ${latestApproval.status}).`);
        }
        throw new Error(`Validation introuvable dans la mission \`${mission.id}\`: \`${approvalId}\`.`);
    }
    const ticket = (0, ticket_service_support_1.requireTicketInMission)(await ticketRepository.findById(mission.id, pendingApproval.ticketId), mission, pendingApproval.ticketId);
    const attempt = await attemptRepository.findById(mission.id, ticket.id, pendingApproval.attemptId);
    if (!attempt) {
        throw new Error(`Tentative introuvable pour la validation \`${approvalId}\`: \`${pendingApproval.attemptId}\`.`);
    }
    if (attempt.status !== "awaiting_approval") {
        throw new Error(`La validation \`${approvalId}\` ne peut pas etre resolue car la tentative \`${attempt.id}\` n'est plus en attente d'approbation.`);
    }
    const occurredAt = new Date().toISOString();
    const eventId = `event_${(0, node_crypto_1.randomUUID)()}`;
    const nextPolicyProfileId = options.policyProfileId !== undefined
        ? (0, ticket_service_support_1.requireText)(options.policyProfileId, `L'option --policy-profile ne peut pas etre vide pour \`corp mission ${commandName}\`.`)
        : mission.policyProfileId;
    const nextAllowedCapabilities = resolveNormalizedReferenceList(ticket.allowedCapabilities, options.allowedCapabilities, options.clearAllowedCapabilities);
    const nextSkillPackRefs = resolveNormalizedReferenceList(ticket.skillPackRefs, options.skillPackRefs, options.clearSkillPackRefs);
    const nextMissionStatus = await resolveMissionStatusAfterDecision({
        mission,
        currentTicketId: ticket.id,
        currentApprovalId: approvalId,
        queuedApprovals: queueResult.approvals,
        attemptRepository,
    });
    (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
        mission,
        allowedCapabilities: nextAllowedCapabilities,
        skillPackRefs: nextSkillPackRefs,
    });
    const updatedMission = {
        ...mission,
        status: nextMissionStatus,
        policyProfileId: nextPolicyProfileId,
        eventIds: [...mission.eventIds, eventId],
        resumeCursor: eventId,
        updatedAt: occurredAt,
    };
    const updatedTicket = {
        ...ticket,
        status: options.outcome === "approved" ? "todo" : "failed",
        allowedCapabilities: nextAllowedCapabilities,
        skillPackRefs: nextSkillPackRefs,
        eventIds: [...ticket.eventIds, eventId],
        updatedAt: occurredAt,
    };
    const updatedAttempt = {
        ...attempt,
        status: "cancelled",
        endedAt: occurredAt,
    };
    const updatedApproval = {
        ...pendingApproval,
        status: options.outcome,
        guardrails: (0, ticket_service_support_1.buildApprovalGuardrailsSnapshot)({
            baseGuardrails: pendingApproval.guardrails,
            policyProfileId: nextPolicyProfileId,
            allowedCapabilities: nextAllowedCapabilities,
            skillPackRefs: nextSkillPackRefs,
        }),
        updatedAt: occurredAt,
    };
    const decision = buildDecision({
        outcome: options.outcome,
        reason: options.reason,
        budgetObservations: options.budgetObservations,
        mission,
        ticket,
        nextMissionPolicyId: nextPolicyProfileId,
        nextAllowedCapabilities,
        nextSkillPackRefs,
    });
    const event = {
        eventId,
        type: `approval.${options.outcome}`,
        missionId: mission.id,
        ticketId: ticket.id,
        attemptId: attempt.id,
        occurredAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: updatedMission,
            ticket: updatedTicket,
            attempt: updatedAttempt,
            approvalId,
            previousApproval: pendingApproval,
            approval: updatedApproval,
            decision,
            trigger: "operator",
        },
    };
    await persistApprovalTransition({
        layout,
        event,
        mission: updatedMission,
        ticket: updatedTicket,
        attempt: updatedAttempt,
        missionRepository,
        ticketRepository,
        attemptRepository,
    });
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
        rootDir: layout.rootDir,
        missionId: updatedMission.id,
        commandName: "resume",
    });
    return {
        mission: updatedMission,
        ticket: updatedTicket,
        attempt: updatedAttempt,
        approval: updatedApproval,
        event,
        decision,
        resume: resumeResult.resume,
    };
}
async function persistApprovalTransition(options) {
    // journal-as-source-of-truth : l'append est la decision d'autorite ; les 4 saves
    // sequentiels ci-dessous sont des optimisations de lecture. Un crash entre deux
    // saves laisse le journal en avance sur les snapshots, et le prochain reader
    // (readMissionResume, readApprovalQueue, readMissionArtifacts, readTicketBoard)
    // reconstruit l'etat via reconstructMissionFromJournal. Voir
    // docs/architecture/journal-as-source-of-truth.md (decision D2, 2026-04-15).
    await (0, append_event_1.appendEvent)(options.layout.journalPath, options.event);
    await options.missionRepository.save(options.mission);
    await options.ticketRepository.save(options.ticket);
    await options.attemptRepository.save(options.mission.id, options.attempt);
    await (0, ticket_service_support_1.rewriteMissionReadModels)(options.layout, options.mission, options.ticketRepository);
}
async function resolveMissionStatusAfterDecision(options) {
    if (options.queuedApprovals.some((approval) => approval.approvalId !== options.currentApprovalId)) {
        return "awaiting_approval";
    }
    return await (0, ticket_service_support_1.missionHasOtherActiveAttempts)(options.mission.id, options.currentTicketId, options.mission.ticketIds, options.attemptRepository)
        ? "running"
        : "ready";
}
function resolveNormalizedReferenceList(currentValues, nextValues, clearValues) {
    if (clearValues) {
        return [];
    }
    if (nextValues.length === 0) {
        return [...currentValues];
    }
    const normalizedValues = (0, ticket_service_support_1.normalizeOpaqueReferences)(nextValues, {
        caseInsensitive: true,
    });
    return (0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(currentValues, normalizedValues)
        ? [...currentValues]
        : normalizedValues;
}
function buildDecision(options) {
    const decision = {
        outcome: options.outcome,
    };
    const normalizedReason = options.reason?.trim();
    const normalizedBudgetObservations = (0, ticket_service_support_1.normalizeTrimmedList)(options.budgetObservations, {
        dedupe: true,
    });
    if (normalizedReason) {
        decision.reason = normalizedReason;
    }
    if (options.mission.policyProfileId !== options.nextMissionPolicyId) {
        decision.missionPolicyChange = {
            previous: options.mission.policyProfileId,
            next: options.nextMissionPolicyId,
        };
    }
    if (!(0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(options.ticket.allowedCapabilities, options.nextAllowedCapabilities)) {
        decision.ticketCapabilityChange = {
            previous: [...options.ticket.allowedCapabilities],
            next: [...options.nextAllowedCapabilities],
        };
    }
    if (!(0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(options.ticket.skillPackRefs, options.nextSkillPackRefs)) {
        decision.ticketSkillPackChange = {
            previous: [...options.ticket.skillPackRefs],
            next: [...options.nextSkillPackRefs],
        };
    }
    if (normalizedBudgetObservations.length > 0) {
        decision.budgetObservations = normalizedBudgetObservations;
    }
    return decision;
}
function findLatestApproval(events, approvalId) {
    for (const event of [...events].reverse()) {
        const approval = readApprovalFromPayload(event.payload);
        if (approval?.approvalId === approvalId) {
            return approval;
        }
    }
    return null;
}
function readApprovalFromPayload(payload) {
    const candidate = payload.approval ?? payload.approvalRequest;
    return (0, persisted_document_guards_1.isApprovalRequest)(candidate) ? candidate : null;
}
function resolveCommandName(outcome) {
    if (outcome === "approved") {
        return "approval approve";
    }
    if (outcome === "rejected") {
        return "approval reject";
    }
    return "approval defer";
}
