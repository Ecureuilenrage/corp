"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRunTicketDependenciesForTesting = setRunTicketDependenciesForTesting;
exports.runTicket = runTicket;
const node_crypto_1 = require("node:crypto");
const execution_attempt_1 = require("../../../contracts/src/execution-attempt/execution-attempt");
const invoke_registered_capability_1 = require("../../../capability-registry/src/registry/invoke-registered-capability");
const read_registered_capability_1 = require("../../../capability-registry/src/registry/read-registered-capability");
const append_event_1 = require("../../../journal/src/event-log/append-event");
const read_mission_resume_1 = require("../../../mission-kernel/src/resume-service/read-mission-resume");
const workspace_layout_1 = require("../../../storage/src/fs-layout/workspace-layout");
const file_capability_registry_repository_1 = require("../../../storage/src/repositories/file-capability-registry-repository");
const file_skill_pack_registry_repository_1 = require("../../../storage/src/repositories/file-skill-pack-registry-repository");
const file_mission_repository_1 = require("../../../storage/src/repositories/file-mission-repository");
const file_execution_attempt_repository_1 = require("../../../storage/src/repositories/file-execution-attempt-repository");
const file_ticket_repository_1 = require("../../../storage/src/repositories/file-ticket-repository");
const codex_responses_adapter_1 = require("../../../execution-adapters/codex-responses/src/codex-responses-adapter");
const resolve_ticket_skill_packs_1 = require("../../../skill-pack/src/loader/resolve-ticket-skill-packs");
const read_registered_skill_pack_1 = require("../../../skill-pack/src/loader/read-registered-skill-pack");
const build_skill_pack_summary_1 = require("../../../skill-pack/src/metadata/build-skill-pack-summary");
const workspace_isolation_1 = require("../../../workspace-isolation/src/workspace-isolation");
const detect_ticket_artifacts_1 = require("../artifact-service/detect-ticket-artifacts");
const register_artifacts_1 = require("../artifact-service/register-artifacts");
const build_ticket_board_1 = require("../planner/build-ticket-board");
const ticket_service_support_1 = require("./ticket-service-support");
const structural_compare_1 = require("../utils/structural-compare");
let runTicketDependencyOverrides = null;
function setRunTicketDependenciesForTesting(overrides) {
    runTicketDependencyOverrides = overrides;
}
async function runTicket(options) {
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
    await (0, ticket_service_support_1.ensureMissionWorkspaceInitialized)(layout, "ticket run");
    const missionId = (0, ticket_service_support_1.requireText)(options.missionId, "L'option --mission-id est obligatoire pour `corp mission ticket run`.");
    const ticketId = (0, ticket_service_support_1.requireText)(options.ticketId, "L'option --ticket-id est obligatoire pour `corp mission ticket run`.");
    const backgroundRequested = options.background === true;
    const missionRepository = (0, file_mission_repository_1.createFileMissionRepository)(layout);
    const ticketRepository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const attemptRepository = (0, file_execution_attempt_repository_1.createFileExecutionAttemptRepository)(layout);
    const mission = await missionRepository.findById(missionId);
    if (!mission) {
        throw new Error(`Mission introuvable: ${missionId}.`);
    }
    const storedTicket = await ticketRepository.findById(mission.id, ticketId);
    const ticket = (0, ticket_service_support_1.requireTicketInMission)(storedTicket, mission, ticketId);
    ensureMissionCanRunTicket(mission, ticket);
    ensureTicketHasOwner(ticket);
    (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
        mission,
        allowedCapabilities: ticket.allowedCapabilities,
        skillPackRefs: ticket.skillPackRefs,
    });
    const activeAttempt = await attemptRepository.findActiveByTicketId(mission.id, ticket.id);
    if (activeAttempt) {
        throw new Error(`Une tentative active existe deja pour le ticket \`${ticket.id}\`.`);
    }
    ensureTicketStatusRunnable(ticket, options.allowBlockedTicketRetry === true);
    const missionTickets = await ticketRepository.listByMissionId(mission.id);
    const ticketBoard = (0, build_ticket_board_1.buildTicketBoardProjection)(mission, missionTickets);
    const boardEntry = ticketBoard.tickets.find((entry) => entry.ticketId === ticket.id);
    const blockedRetryAllowed = options.allowBlockedTicketRetry === true
        && ticket.status === "blocked"
        && !!boardEntry
        && boardEntry.statusReasonCode === "ticket_blocked"
        && boardEntry.blockedByTicketIds.length === 0;
    if ((!boardEntry || !boardEntry.runnable) && !blockedRetryAllowed) {
        throw new Error(`Le ticket \`${ticket.id}\` n'est pas runnable: dependances non resolues.`);
    }
    const capabilityRegistryRepository = (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout);
    const skillPackRegistryRepository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const dependencies = resolveRunTicketDependencies();
    const adapter = dependencies.createAdapter();
    const attemptId = dependencies.createAttemptId();
    const capabilityInvocations = await buildCapabilityInvocationEvents({
        repository: capabilityRegistryRepository,
        mission,
        ticket,
        attemptId,
        dependencies,
    });
    const resolvedSkillPacks = await (0, resolve_ticket_skill_packs_1.resolveTicketSkillPacks)({
        repository: skillPackRegistryRepository,
        mission,
        ticket,
    });
    const skillPackUsageEvents = await buildSkillPackUsageEvents({
        repository: skillPackRegistryRepository,
        mission,
        ticket,
        attemptId,
        dependencies,
    });
    const workspaceIsolationId = dependencies.createIsolationId();
    const events = [];
    let isolation;
    try {
        isolation = await dependencies.createWorkspaceIsolation({
            rootDir: layout.rootDir,
            workspaceIsolationId,
            layout,
        });
    }
    catch {
        throw new Error(`Creation d'isolation impossible pour le ticket \`${ticket.id}\`.`);
    }
    let currentMission = withMissionEvent(mission, {
        eventId: dependencies.createEventId(),
        occurredAt: new Date().toISOString(),
    });
    let currentTicket = withTicketEvent(ticket, {
        eventId: currentMission.resumeCursor,
        occurredAt: currentMission.updatedAt,
    });
    const workspaceEvent = {
        eventId: currentMission.resumeCursor,
        type: "workspace.isolation_created",
        missionId: mission.id,
        ticketId: ticket.id,
        attemptId,
        occurredAt: currentMission.updatedAt,
        actor: "system",
        source: "workspace-isolation",
        payload: {
            mission: currentMission,
            ticket: currentTicket,
            isolation,
            trigger: "system",
        },
    };
    await persistRunTransition({
        layout,
        event: workspaceEvent,
        mission: currentMission,
        ticket: currentTicket,
        ticketRepository,
        missionRepository,
        skipProjectionRewrite: true,
    });
    events.push(workspaceEvent);
    const claimedAt = new Date().toISOString();
    currentMission = withMissionEvent(currentMission, {
        eventId: dependencies.createEventId(),
        occurredAt: claimedAt,
    });
    currentTicket = withTicketEvent(currentTicket, {
        eventId: currentMission.resumeCursor,
        occurredAt: claimedAt,
        status: "claimed",
        workspaceIsolationId,
    });
    const claimEvent = {
        eventId: currentMission.resumeCursor,
        type: "ticket.claimed",
        missionId: mission.id,
        ticketId: ticket.id,
        attemptId,
        occurredAt: claimedAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: currentMission,
            ticket: currentTicket,
            previousStatus: ticket.status,
            trigger: "operator",
        },
    };
    await persistRunTransition({
        layout,
        event: claimEvent,
        mission: currentMission,
        ticket: currentTicket,
        ticketRepository,
        missionRepository,
        skipProjectionRewrite: true,
    });
    events.push(claimEvent);
    const requestedAt = new Date().toISOString();
    currentMission = withMissionEvent(currentMission, {
        eventId: dependencies.createEventId(),
        occurredAt: requestedAt,
        status: "running",
    });
    currentTicket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(currentTicket, {
        eventId: currentMission.resumeCursor,
        occurredAt: requestedAt,
    }), adapter.id, {});
    let currentAttempt = {
        id: attemptId,
        ticketId: ticket.id,
        adapter: adapter.id,
        status: "requested",
        workspaceIsolationId,
        backgroundRequested,
        adapterState: {},
        startedAt: requestedAt,
        endedAt: null,
    };
    const requestedEvent = {
        eventId: currentMission.resumeCursor,
        type: "execution.requested",
        missionId: mission.id,
        ticketId: ticket.id,
        attemptId,
        occurredAt: requestedAt,
        actor: "operator",
        source: "corp-cli",
        payload: {
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            trigger: "operator",
            backgroundRequested,
        },
    };
    await persistRunTransition({
        layout,
        event: requestedEvent,
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        ticketRepository,
        missionRepository,
        attemptRepository,
        skipProjectionRewrite: true,
    });
    events.push(requestedEvent);
    for (const capabilityInvocation of capabilityInvocations) {
        currentMission = withMissionEvent(currentMission, {
            eventId: capabilityInvocation.event.eventId,
            occurredAt: capabilityInvocation.event.occurredAt,
        });
        currentTicket = withTicketEvent(currentTicket, {
            eventId: currentMission.resumeCursor,
            occurredAt: capabilityInvocation.event.occurredAt,
        });
        const capabilityEvent = {
            ...capabilityInvocation.event,
            missionId: mission.id,
            ticketId: ticket.id,
            attemptId,
        };
        await persistRunTransition({
            layout,
            event: capabilityEvent,
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            ticketRepository,
            missionRepository,
            attemptRepository,
            skipProjectionRewrite: true,
        });
        events.push(capabilityEvent);
    }
    for (const skillPackUsageEventDetails of skillPackUsageEvents) {
        currentMission = withMissionEvent(currentMission, {
            eventId: skillPackUsageEventDetails.event.eventId,
            occurredAt: skillPackUsageEventDetails.event.occurredAt,
        });
        currentTicket = withTicketEvent(currentTicket, {
            eventId: currentMission.resumeCursor,
            occurredAt: skillPackUsageEventDetails.event.occurredAt,
        });
        const skillPackEvent = {
            ...skillPackUsageEventDetails.event,
            missionId: mission.id,
            ticketId: ticket.id,
            attemptId,
            payload: {
                mission: currentMission,
                ticket: currentTicket,
                skillPack: skillPackUsageEventDetails.skillPack,
                trigger: "ticket_run_launch",
            },
        };
        await persistRunTransition({
            layout,
            event: skillPackEvent,
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            ticketRepository,
            missionRepository,
            attemptRepository,
            skipProjectionRewrite: true,
        });
        events.push(skillPackEvent);
    }
    if (!backgroundRequested) {
        const inProgressTransition = buildTicketInProgressTransition({
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            missionId: mission.id,
            ticketId: ticket.id,
            adapterId: adapter.id,
            adapterState: currentAttempt.adapterState,
            attemptStatus: "running",
            dependencies,
            actor: "system",
            source: "ticket-runtime",
            trigger: "system",
        });
        currentMission = inProgressTransition.mission;
        currentTicket = inProgressTransition.ticket;
        currentAttempt = inProgressTransition.attempt;
        await persistRunTransition({
            layout,
            event: inProgressTransition.event,
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            ticketRepository,
            missionRepository,
            attemptRepository,
        });
        events.push(inProgressTransition.event);
    }
    let transitionResult;
    let adapterResult = null;
    // Declare au scope externe pour que le catch voie l'etat mission apres les ecritures
    // concurrentes (notamment les tickets ajoutes par un autre runTicket en vol). Fallback
    // sur `mission` si le findById lui-meme echoue avant l'assignation.
    let latestMission = null;
    try {
        latestMission = await missionRepository.findById(mission.id);
        if (!latestMission) {
            throw new Error(`Mission introuvable: ${mission.id}.`);
        }
        (0, ticket_service_support_1.ensureTicketExtensionsAllowedByMission)({
            mission: latestMission,
            allowedCapabilities: currentTicket.allowedCapabilities,
            skillPackRefs: currentTicket.skillPackRefs,
        });
        const latestTicket = (0, ticket_service_support_1.requireTicketInMission)(await ticketRepository.findById(latestMission.id, ticket.id), latestMission, ticket.id);
        ensureTicketHasNoConcurrentExtensionMutation(currentTicket, latestTicket);
        adapterResult = await adapter.launch({
            mission: currentMission,
            ticket: currentTicket,
            attemptId,
            workspacePath: isolation.workspacePath,
            background: backgroundRequested,
            resolvedSkillPacks,
        });
        if (backgroundRequested
            && isActiveAttemptStatus(adapterResult.status)
            && adapterResult.status !== "awaiting_approval") {
            const inProgressTransition = buildTicketInProgressTransition({
                mission: currentMission,
                ticket: currentTicket,
                attempt: currentAttempt,
                missionId: mission.id,
                ticketId: ticket.id,
                adapterId: adapter.id,
                adapterState: adapterResult.adapterState,
                attemptStatus: adapterResult.status,
                dependencies,
                actor: "adapter",
                source: adapter.id,
                trigger: "adapter",
            });
            currentMission = inProgressTransition.mission;
            currentTicket = inProgressTransition.ticket;
            currentAttempt = inProgressTransition.attempt;
            await persistRunTransition({
                layout,
                event: inProgressTransition.event,
                mission: currentMission,
                ticket: currentTicket,
                attempt: currentAttempt,
                ticketRepository,
                missionRepository,
                attemptRepository,
            });
            events.push(inProgressTransition.event);
        }
        transitionResult = await finalizeAdapterOutcome({
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            missionTicketIds: mission.ticketIds,
            missionId: mission.id,
            ticketId: ticket.id,
            adapterId: adapter.id,
            adapterResult,
            dependencies,
            backgroundRequested,
            attemptRepository,
        });
    }
    catch (error) {
        const failedAt = new Date().toISOString();
        const failureMissionBase = latestMission ?? currentMission;
        const missionTicketIdsForScan = failureMissionBase.ticketIds;
        const hasOtherActiveAttempts = await (0, ticket_service_support_1.missionHasOtherActiveAttempts)(mission.id, ticket.id, missionTicketIdsForScan, attemptRepository);
        currentMission = withMissionEvent(failureMissionBase, {
            eventId: dependencies.createEventId(),
            occurredAt: failedAt,
            status: hasOtherActiveAttempts ? "running" : "failed",
        });
        currentTicket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(currentTicket, {
            eventId: currentMission.resumeCursor,
            occurredAt: failedAt,
            status: "failed",
        }), adapter.id, currentAttempt.adapterState);
        currentAttempt = {
            ...currentAttempt,
            status: "failed",
            endedAt: failedAt,
        };
        const failedEvent = {
            eventId: currentMission.resumeCursor,
            type: "execution.failed",
            missionId: mission.id,
            ticketId: ticket.id,
            attemptId,
            occurredAt: failedAt,
            actor: "adapter",
            source: adapter.id,
            payload: {
                mission: currentMission,
                ticket: currentTicket,
                attempt: currentAttempt,
                trigger: "adapter",
            },
        };
        await persistRunTransition({
            layout,
            event: failedEvent,
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            ticketRepository,
            missionRepository,
            attemptRepository,
        });
        events.push(failedEvent);
        try {
            const artifactRegistrationResult = await detectAndRegisterTerminalArtifacts({
                layout,
                mission: currentMission,
                ticket: currentTicket,
                attempt: currentAttempt,
                producingEvent: failedEvent,
                trigger: "execution-terminal-output",
                isolation,
            });
            currentMission = artifactRegistrationResult.mission;
            currentTicket = artifactRegistrationResult.ticket;
            events.push(...artifactRegistrationResult.events);
            const latestArtifactEvent = artifactRegistrationResult.events.at(-1);
            if (latestArtifactEvent) {
                // journal-as-source-of-truth AC7 : on recalcule les projections apres persist
                // des artefacts pour que resume-view/audit-log/ticket-board refletent bien
                // execution.failed ET artifact.registered au moment du rethrow. Voir
                // docs/architecture/journal-as-source-of-truth.md (decision D4, 2026-04-15).
                await persistRunTransition({
                    layout,
                    event: latestArtifactEvent,
                    mission: currentMission,
                    ticket: currentTicket,
                    attempt: currentAttempt,
                    ticketRepository,
                    missionRepository,
                    attemptRepository,
                    eventAlreadyAppended: true,
                });
            }
        }
        catch (artifactDetectionError) {
            console.warn(`Avertissement: impossible de detecter/enregistrer les artefacts apres l'echec du ticket \`${ticket.id}\`: ${artifactDetectionError instanceof Error ? artifactDetectionError.message : String(artifactDetectionError)}`);
        }
        throw error;
    }
    currentMission = transitionResult.mission;
    currentTicket = transitionResult.ticket;
    currentAttempt = transitionResult.attempt;
    await persistRunTransition({
        layout,
        event: transitionResult.event,
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        ticketRepository,
        missionRepository,
        attemptRepository,
    });
    events.push(transitionResult.event);
    if (adapterResult && isTerminalExecutionEventType(transitionResult.event.type)) {
        const artifactRegistrationResult = await detectAndRegisterTerminalArtifacts({
            layout,
            mission: currentMission,
            ticket: currentTicket,
            attempt: currentAttempt,
            producingEvent: transitionResult.event,
            trigger: "execution-terminal-output",
            isolation,
            adapterOutputs: adapterResult.outputs,
        });
        currentMission = artifactRegistrationResult.mission;
        currentTicket = artifactRegistrationResult.ticket;
        events.push(...artifactRegistrationResult.events);
    }
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
        rootDir: layout.rootDir,
        missionId: currentMission.id,
        commandName: "resume",
    });
    return {
        mission: currentMission,
        ticket: currentTicket,
        attempt: currentAttempt,
        isolation,
        events,
        resume: resumeResult.resume,
    };
}
function resolveRunTicketDependencies() {
    return {
        createAdapter: runTicketDependencyOverrides?.createAdapter
            ?? (() => (0, codex_responses_adapter_1.createCodexResponsesAdapterFromEnvironment)()),
        createWorkspaceIsolation: runTicketDependencyOverrides?.createWorkspaceIsolation
            ?? ((options) => (0, workspace_isolation_1.createWorkspaceIsolation)(options)),
        createEventId: runTicketDependencyOverrides?.createEventId
            ?? (() => `event_${(0, node_crypto_1.randomUUID)()}`),
        createAttemptId: runTicketDependencyOverrides?.createAttemptId
            ?? (() => `attempt_${(0, node_crypto_1.randomUUID)()}`),
        createIsolationId: runTicketDependencyOverrides?.createIsolationId
            ?? (() => `iso_${(0, node_crypto_1.randomUUID)()}`),
        createApprovalId: runTicketDependencyOverrides?.createApprovalId
            ?? (() => `approval_${(0, node_crypto_1.randomUUID)()}`),
    };
}
async function finalizeAdapterOutcome(options) {
    const occurredAt = new Date().toISOString();
    const adapterState = { ...options.adapterResult.adapterState };
    if (options.adapterResult.status === "awaiting_approval") {
        const approval = materializeApprovalRequest({
            approvalRequest: options.adapterResult.approvalRequest,
            mission: options.mission,
            ticket: options.ticket,
            attempt: options.attempt,
            approvalId: options.dependencies.createApprovalId(),
            occurredAt,
            fallbackRelatedEventIds: [options.mission.resumeCursor],
        });
        const mission = withMissionEvent(options.mission, {
            eventId: options.dependencies.createEventId(),
            occurredAt,
            status: "awaiting_approval",
        });
        const ticket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(options.ticket, {
            eventId: mission.resumeCursor,
            occurredAt,
            status: "awaiting_approval",
        }), options.adapterId, adapterState);
        const attempt = {
            ...options.attempt,
            status: "awaiting_approval",
            adapterState,
        };
        return {
            mission,
            ticket,
            attempt,
            event: {
                eventId: mission.resumeCursor,
                type: "approval.requested",
                missionId: options.missionId,
                ticketId: options.ticketId,
                attemptId: attempt.id,
                occurredAt,
                actor: "adapter",
                source: options.adapterId,
                payload: {
                    mission,
                    ticket,
                    attempt,
                    approvalId: approval.approvalId,
                    approval,
                    trigger: "adapter",
                },
            },
        };
    }
    if (isActiveAttemptStatus(options.adapterResult.status)) {
        const mission = withMissionEvent(options.mission, {
            eventId: options.dependencies.createEventId(),
            occurredAt,
            status: "running",
        });
        const ticket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(options.ticket, {
            eventId: mission.resumeCursor,
            occurredAt,
        }), options.adapterId, adapterState);
        const attempt = {
            ...options.attempt,
            status: options.adapterResult.status,
            adapterState,
        };
        return {
            mission,
            ticket,
            attempt,
            event: {
                eventId: mission.resumeCursor,
                type: "execution.background_started",
                missionId: options.missionId,
                ticketId: options.ticketId,
                attemptId: attempt.id,
                occurredAt,
                actor: "adapter",
                source: options.adapterId,
                payload: {
                    mission,
                    ticket,
                    attempt,
                    trigger: "adapter",
                },
            },
        };
    }
    if (options.adapterResult.status === "completed") {
        const hasOtherActiveAttempts = await (0, ticket_service_support_1.missionHasOtherActiveAttempts)(options.missionId, options.ticketId, options.missionTicketIds, options.attemptRepository);
        const mission = withMissionEvent(options.mission, {
            eventId: options.dependencies.createEventId(),
            occurredAt,
            status: hasOtherActiveAttempts ? "running" : "ready",
        });
        const ticket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(options.ticket, {
            eventId: mission.resumeCursor,
            occurredAt,
            status: "done",
        }), options.adapterId, adapterState);
        const attempt = {
            ...options.attempt,
            status: "completed",
            adapterState,
            endedAt: occurredAt,
        };
        return {
            mission,
            ticket,
            attempt,
            event: {
                eventId: mission.resumeCursor,
                type: "execution.completed",
                missionId: options.missionId,
                ticketId: options.ticketId,
                attemptId: attempt.id,
                occurredAt,
                actor: "adapter",
                source: options.adapterId,
                payload: {
                    mission,
                    ticket,
                    attempt,
                    trigger: "adapter",
                },
            },
        };
    }
    const hasOtherActiveAttempts = await (0, ticket_service_support_1.missionHasOtherActiveAttempts)(options.missionId, options.ticketId, options.missionTicketIds, options.attemptRepository);
    const isCancelled = options.adapterResult.status === "cancelled";
    const mission = withMissionEvent(options.mission, {
        eventId: options.dependencies.createEventId(),
        occurredAt,
        status: isCancelled
            ? (hasOtherActiveAttempts ? "running" : "ready")
            : (hasOtherActiveAttempts ? "running" : "failed"),
    });
    const ticket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(options.ticket, {
        eventId: mission.resumeCursor,
        occurredAt,
        status: isCancelled ? "cancelled" : "failed",
    }), options.adapterId, adapterState);
    const attempt = {
        ...options.attempt,
        status: isCancelled ? "cancelled" : "failed",
        adapterState,
        endedAt: occurredAt,
    };
    return {
        mission,
        ticket,
        attempt,
        event: {
            eventId: mission.resumeCursor,
            type: isCancelled ? "execution.cancelled" : "execution.failed",
            missionId: options.missionId,
            ticketId: options.ticketId,
            attemptId: attempt.id,
            occurredAt,
            actor: "adapter",
            source: options.adapterId,
            payload: {
                mission,
                ticket,
                attempt,
                trigger: "adapter",
            },
        },
    };
}
function ensureTicketHasNoConcurrentExtensionMutation(currentTicket, latestTicket) {
    if ((0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(currentTicket.allowedCapabilities, latestTicket.allowedCapabilities)
        && (0, structural_compare_1.deepStrictEqualIgnoringArrayOrder)(currentTicket.skillPackRefs, latestTicket.skillPackRefs)) {
        return;
    }
    throw new Error(`Conflit d'ecriture concurrente detecte pour le ticket \`${currentTicket.id}\`.`);
}
function buildTicketInProgressTransition(options) {
    const occurredAt = new Date().toISOString();
    const mission = withMissionEvent(options.mission, {
        eventId: options.dependencies.createEventId(),
        occurredAt,
        status: "running",
    });
    const ticket = (0, ticket_service_support_1.applyExecutionHandleSnapshot)(withTicketEvent(options.ticket, {
        eventId: mission.resumeCursor,
        occurredAt,
        status: "in_progress",
    }), options.adapterId, options.adapterState);
    const attempt = {
        ...options.attempt,
        status: options.attemptStatus,
        adapterState: { ...options.adapterState },
    };
    return {
        mission,
        ticket,
        attempt,
        event: {
            eventId: mission.resumeCursor,
            type: "ticket.in_progress",
            missionId: options.missionId,
            ticketId: options.ticketId,
            attemptId: attempt.id,
            occurredAt,
            actor: options.actor,
            source: options.source,
            payload: {
                mission,
                ticket,
                attempt,
                previousStatus: options.ticket.status,
                trigger: options.trigger,
            },
        },
    };
}
async function detectAndRegisterTerminalArtifacts(options) {
    const detectedArtifacts = await (0, detect_ticket_artifacts_1.detectTicketArtifacts)({
        adapterOutputs: options.adapterOutputs,
        isolation: options.isolation,
        producingEvent: options.producingEvent,
    });
    const artifactRegistrationResult = await (0, register_artifacts_1.registerArtifacts)({
        layout: options.layout,
        mission: options.mission,
        ticket: options.ticket,
        attempt: options.attempt,
        producingEvent: options.producingEvent,
        trigger: options.trigger,
        detectedArtifacts,
    });
    return {
        mission: artifactRegistrationResult.mission,
        ticket: artifactRegistrationResult.ticket,
        events: artifactRegistrationResult.events,
    };
}
async function persistRunTransition(options) {
    // journal-as-source-of-truth : l'append est la decision d'autorite. Les saves
    // ticket/mission/attempt ci-dessous sont des optimisations de lecture ; un crash
    // entre deux d'entre eux laisse les snapshots en retard sur le journal, et le
    // prochain reader (readMissionResume, readTicketBoard, readMissionArtifacts)
    // reconstruit via reconstructMissionFromJournal. Voir
    // docs/architecture/journal-as-source-of-truth.md (decisions D1/D4, 2026-04-15).
    if (!options.eventAlreadyAppended) {
        await (0, append_event_1.appendEvent)(options.layout.journalPath, options.event);
    }
    await options.ticketRepository.save(options.ticket);
    await options.missionRepository.save(options.mission);
    if (options.attempt && options.attemptRepository) {
        await options.attemptRepository.save(options.mission.id, options.attempt);
    }
    if (!options.skipProjectionRewrite) {
        await (0, ticket_service_support_1.rewriteMissionReadModels)(options.layout, options.mission, options.ticketRepository);
    }
}
function withMissionEvent(mission, options) {
    return {
        ...mission,
        ...(options.status ? { status: options.status } : {}),
        eventIds: [...mission.eventIds, options.eventId],
        resumeCursor: options.eventId,
        updatedAt: options.occurredAt,
    };
}
function withTicketEvent(ticket, options) {
    return {
        ...ticket,
        ...(options.status ? { status: options.status } : {}),
        ...(options.workspaceIsolationId
            ? { workspaceIsolationId: options.workspaceIsolationId }
            : {}),
        eventIds: [...ticket.eventIds, options.eventId],
        updatedAt: options.occurredAt,
    };
}
function ensureMissionCanRunTicket(mission, ticket) {
    if (mission.status === "ready" || mission.status === "running") {
        return;
    }
    if (mission.status === "failed" && ticket.status === "failed") {
        return;
    }
    throw new Error(`La mission \`${mission.id}\` ne peut pas lancer de tentative depuis le statut \`${mission.status}\`.`);
}
function ensureTicketHasOwner(ticket) {
    if (ticket.owner.trim().length > 0) {
        return;
    }
    throw new Error(`Le ticket \`${ticket.id}\` doit avoir un owner renseigne avant \`corp mission ticket run\`.`);
}
function ensureTicketStatusRunnable(ticket, allowBlockedTicketRetry) {
    if (ticket.status === "todo"
        || ticket.status === "failed"
        || (allowBlockedTicketRetry && ticket.status === "blocked")) {
        return;
    }
    throw new Error(`Le ticket \`${ticket.id}\` n'est pas runnable car son statut actuel est \`${ticket.status}\`.`);
}
function isActiveAttemptStatus(status) {
    return execution_attempt_1.ACTIVE_EXECUTION_ATTEMPT_STATUSES.includes(status);
}
function materializeApprovalRequest(options) {
    return {
        approvalId: options.approvalId,
        missionId: options.mission.id,
        ticketId: options.ticket.id,
        attemptId: options.attempt.id,
        status: "requested",
        title: (0, ticket_service_support_1.requireText)(options.approvalRequest.title, "L'adaptateur doit fournir un `approvalRequest.title` non vide pour `awaiting_approval`."),
        actionType: (0, ticket_service_support_1.requireText)(options.approvalRequest.actionType, "L'adaptateur doit fournir un `approvalRequest.actionType` non vide pour `awaiting_approval`."),
        actionSummary: (0, ticket_service_support_1.requireText)(options.approvalRequest.actionSummary, "L'adaptateur doit fournir un `approvalRequest.actionSummary` non vide pour `awaiting_approval`."),
        guardrails: buildApprovalGuardrails(options.mission, options.ticket, options.approvalRequest),
        relatedEventIds: (0, ticket_service_support_1.normalizeOpaqueReferences)([
            ...(options.approvalRequest.relatedEventIds ?? []),
            ...options.fallbackRelatedEventIds,
        ]),
        relatedArtifactIds: (0, ticket_service_support_1.normalizeOpaqueReferences)(options.approvalRequest.relatedArtifactIds ?? []),
        createdAt: options.occurredAt,
        updatedAt: options.occurredAt,
    };
}
function buildApprovalGuardrails(mission, ticket, approvalRequest) {
    return (0, ticket_service_support_1.buildApprovalGuardrailsSnapshot)({
        baseGuardrails: approvalRequest.guardrails ?? [],
        policyProfileId: mission.policyProfileId,
        allowedCapabilities: ticket.allowedCapabilities,
        skillPackRefs: ticket.skillPackRefs,
    });
}
function isTerminalExecutionEventType(eventType) {
    return eventType === "execution.completed"
        || eventType === "execution.failed"
        || eventType === "execution.cancelled";
}
async function buildCapabilityInvocationEvents(options) {
    const invocations = [];
    for (const capabilityId of options.ticket.allowedCapabilities) {
        if ((0, ticket_service_support_1.isBuiltInAllowedCapability)(capabilityId)) {
            continue;
        }
        const capability = await (0, read_registered_capability_1.readRegisteredCapability)({
            repository: options.repository,
            capabilityId,
        });
        invocations.push(await (0, invoke_registered_capability_1.invokeRegisteredCapability)({
            capability,
            mission: options.mission,
            ticket: options.ticket,
            attemptId: options.attemptId,
            eventId: options.dependencies.createEventId(),
            occurredAt: new Date().toISOString(),
            actor: "system",
            source: "ticket-runtime",
            trigger: "ticket_run_preflight",
        }));
    }
    return invocations;
}
async function buildSkillPackUsageEvents(options) {
    const usageEvents = [];
    for (const packRef of [...new Set(options.ticket.skillPackRefs)]) {
        const registeredSkillPack = await (0, read_registered_skill_pack_1.readRegisteredSkillPack)({
            repository: options.repository,
            packRef,
        });
        const skillPack = (0, build_skill_pack_summary_1.buildSkillPackUsageDetails)(registeredSkillPack);
        usageEvents.push({
            skillPack,
            event: {
                eventId: options.dependencies.createEventId(),
                type: "skill_pack.used",
                missionId: options.mission.id,
                ticketId: options.ticket.id,
                attemptId: options.attemptId,
                occurredAt: new Date().toISOString(),
                actor: "system",
                source: "ticket-runtime",
                payload: {},
            },
        });
    }
    return usageEvents;
}
