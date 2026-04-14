import assert from "node:assert/strict";
import test from "node:test";

import { formatAuditEntryDetail } from "../../apps/corp-cli/src/formatters/audit-entry-detail-formatter";
import { formatAuditLog } from "../../apps/corp-cli/src/formatters/audit-log-formatter";
import { formatArtifactDetail } from "../../apps/corp-cli/src/formatters/artifact-detail-formatter";
import { formatArtifactList } from "../../apps/corp-cli/src/formatters/artifact-list-formatter";
import { formatApprovalQueue } from "../../apps/corp-cli/src/formatters/approval-queue-formatter";
import { formatMissionHelp } from "../../apps/corp-cli/src/formatters/help-formatter";
import { formatMissionCompare } from "../../apps/corp-cli/src/formatters/mission-compare-formatter";
import { formatMissionResume } from "../../apps/corp-cli/src/formatters/mission-resume-formatter";
import { formatMissionStatus } from "../../apps/corp-cli/src/formatters/mission-status-formatter";
import { formatTicketBoard } from "../../apps/corp-cli/src/formatters/ticket-board-formatter";
import type { ApprovalQueueEntry } from "../../packages/contracts/src/approval/approval-request";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { MissionResume } from "../../packages/contracts/src/mission/mission-resume";
import type { MissionAuditDetailField } from "../../packages/mission-kernel/src/resume-service/read-mission-audit";
import type { ArtifactIndexEntry } from "../../packages/journal/src/projections/artifact-index-projection";
import type { MissionAuditEntry } from "../../packages/journal/src/projections/audit-log-projection";
import { createMissionResume } from "../../packages/journal/src/projections/resume-view-projection";
import type { TicketBoardEntry } from "../../packages/journal/src/projections/ticket-board-projection";

function createBoardEntry(overrides: Partial<TicketBoardEntry> = {}): TicketBoardEntry {
  return {
    ticketId: "ticket_alpha",
    missionId: "mission_demo",
    title: "Ticket demo",
    status: "todo",
    owner: "agent_alpha",
    kind: "implement",
    dependsOn: [],
    allowedCapabilities: [],
    skillPackRefs: [],
    usedCapabilities: [],
    usedSkillPacks: [],
    planOrder: 0,
    runnable: true,
    blockedByTicketIds: [],
    planningState: "runnable",
    dependencyStatuses: [],
    trackingState: "runnable",
    statusReasonCode: "runnable",
    blockingReasonCode: null,
    activeAttemptId: null,
    activeAttemptStatus: null,
    lastAttemptId: null,
    lastAttemptStatus: null,
    lastAttemptStartedAt: null,
    lastAttemptEndedAt: null,
    lastAttemptBackgroundRequested: null,
    lastAttemptWorkspaceIsolationId: null,
    updatedAt: "2026-04-10T10:00:00.000Z",
    ...overrides,
  };
}

function createResume(overrides: Partial<MissionResume> = {}): MissionResume {
  return {
    missionId: "mission_demo",
    title: "Mission demo",
    objective: "Rendre la supervision lisible",
    status: "ready",
    successCriteria: ["Le board est lisible", "Le resume reste compact"],
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    openTickets: [],
    pendingApprovals: [],
    lastRelevantArtifact: null,
    lastKnownBlockage: null,
    lastEventId: "event_demo",
    updatedAt: "2026-04-10T10:00:00.000Z",
    nextOperatorAction: "Traitez le prochain ticket runnable: Ticket demo.",
    ...overrides,
  };
}

function createArtifact(overrides: Partial<ArtifactIndexEntry> = {}): ArtifactIndexEntry {
  return {
    artifactId: "artifact_demo",
    missionId: "mission_demo",
    ticketId: "ticket_alpha",
    producingEventId: "event_demo",
    attemptId: null,
    workspaceIsolationId: null,
    kind: "report_text",
    title: "Artefact demo",
    createdAt: "2026-04-10T10:00:00.000Z",
    ...overrides,
  };
}

function createApprovalEntry(overrides: Partial<ApprovalQueueEntry> = {}): ApprovalQueueEntry {
  return {
    approvalId: "approval_1",
    missionId: "mission_demo",
    ticketId: "ticket_alpha",
    attemptId: "attempt_1",
    status: "requested",
    title: "Validation critique",
    actionType: "workspace_write",
    actionSummary: "Modification de README.md",
    guardrails: [
      "policy_profile: policy_profile_local",
      "allowed_capabilities: fs.read, cli.run",
    ],
    relatedEventIds: ["event_1", "event_2"],
    relatedArtifactIds: ["artifact_1"],
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
    ...overrides,
  };
}

function createAuditEntry(overrides: Partial<MissionAuditEntry> = {}): MissionAuditEntry {
  return {
    entryId: "event_exec_completed",
    occurredAt: "2026-04-10T10:00:00.000Z",
    eventId: "event_exec_completed",
    eventType: "execution.completed",
    kind: "execution",
    title: "Execution terminee",
    summary: "Tentative attempt_1 terminee pour le ticket ticket_alpha. 1 artefact(s) lie(s).",
    missionId: "mission_demo",
    ticketId: "ticket_alpha",
    attemptId: "attempt_1",
    artifactId: "artifact_1",
    actor: "adapter",
    source: "execution-adapter",
    ticketOwner: "agent_dev",
    relatedEventIds: ["event_exec_requested"],
    relatedArtifactIds: ["artifact_1"],
    ...overrides,
  };
}

function createAuditDetailField(overrides: Partial<MissionAuditDetailField> = {}): MissionAuditDetailField {
  return {
    label: "Statut tentative",
    value: "completed",
    ...overrides,
  };
}

test("formatTicketBoard rend explicitement un board vide", () => {
  assert.deepEqual(formatTicketBoard([]), [
    "Etat des tickets:",
    "  Aucun ticket n'existe encore.",
  ]);
});

test("formatTicketBoard rend un ticket runnable unitaire", () => {
  assert.deepEqual(formatTicketBoard([
    createBoardEntry(),
  ]), [
    "Etat des tickets:",
    "  1. ticket_alpha | statut=todo | owner=agent_alpha | dependances=aucune | suivi=runnable | motif=pret a lancer",
  ]);
});

test("formatTicketBoard detaille les statuts mixtes, les dependances et les tentatives", () => {
  const blockedEntry = createBoardEntry({
    ticketId: "ticket_blocked",
    title: "Ticket bloque",
    owner: "agent_blocked",
    planOrder: 1,
    runnable: false,
    dependsOn: ["ticket_a", "ticket_b", "ticket_c", "ticket_d"],
    blockedByTicketIds: ["ticket_a", "ticket_c"],
    planningState: "waiting_on_dependencies",
    dependencyStatuses: [
      { ticketId: "ticket_a", status: "todo", blocksRunnable: true },
      { ticketId: "ticket_b", status: "done", blocksRunnable: false },
      { ticketId: "ticket_c", status: "failed", blocksRunnable: true },
      { ticketId: "ticket_d", status: "cancelled", blocksRunnable: true },
    ],
    trackingState: "blocked",
    statusReasonCode: "dependency_pending",
    blockingReasonCode: "dependency_pending",
  });
  const doneEntry = createBoardEntry({
    ticketId: "ticket_done",
    title: "Ticket termine",
    status: "done",
    owner: "agent_done",
    planOrder: 2,
    runnable: false,
    trackingState: "done",
    statusReasonCode: "ticket_done",
    lastAttemptId: "attempt_done",
    lastAttemptStatus: "completed",
    lastAttemptStartedAt: "2026-04-10T09:55:00.000Z",
    lastAttemptEndedAt: "2026-04-10T10:00:00.000Z",
    lastAttemptBackgroundRequested: false,
    lastAttemptWorkspaceIsolationId: "iso_done",
  });

  assert.deepEqual(formatTicketBoard([
    createBoardEntry(),
    blockedEntry,
    doneEntry,
  ]), [
    "Etat des tickets:",
    "  1. ticket_alpha | statut=todo | owner=agent_alpha | dependances=aucune | suivi=runnable | motif=pret a lancer",
    "  2. ticket_blocked | statut=todo | owner=agent_blocked | dependances=ticket_a(todo), ticket_b(done), ticket_c(failed), ticket_d(cancelled) | suivi=blocked | motif=prerequis en attente: ticket_a(todo), ticket_c(failed), ticket_d(cancelled)",
    "  3. ticket_done | statut=done | owner=agent_done | dependances=aucune | suivi=done | motif=ticket termine | tentative=attempt_done(completed)",
  ]);
});

test("formatMissionResume rend un resume complet avec tickets, validations et artefact", () => {
  assert.deepEqual(formatMissionResume(createResume({
    status: "running",
    openTickets: [
      { ticketId: "ticket_alpha", title: "Ticket alpha" },
      { ticketId: "ticket_beta", title: "Ticket beta" },
    ],
    pendingApprovals: [
      { approvalId: "approval_1", title: "Validation critique" },
    ],
    lastRelevantArtifact: {
      artifactId: "artifact_1",
      title: "Resume execution",
      missionId: "mission_demo",
      ticketId: "ticket_alpha",
      producingEventId: "event_artifact",
      attemptId: "attempt_1",
      workspaceIsolationId: "iso_1",
    },
  })), [
    "Mission: mission_demo",
    "Titre: Mission demo",
    "Objectif: Rendre la supervision lisible",
    "Statut: running",
    "Criteres de succes:",
    "  1. Le board est lisible",
    "  2. Le resume reste compact",
    "Tickets ouverts: ticket_alpha, ticket_beta",
    "Validations en attente: approval_1",
    "Capabilities mission: aucune",
    "Skill packs mission: aucun",
    "Dernier artefact pertinent: Resume execution",
    "Dernier blocage connu: aucun",
    "Dernier evenement: event_demo",
    "Mis a jour: 2026-04-10T10:00:00.000Z",
    "Prochain arbitrage utile: Traitez le prochain ticket runnable: Ticket demo.",
  ]);
});

test("formatMissionResume rend les sections vides explicitement", () => {
  assert.deepEqual(formatMissionResume({
    ...createResume({
      successCriteria: [],
      nextOperatorAction: "Aucun ticket n'est runnable pour le moment.",
    }),
    lastKnownBlockage: null,
  } as MissionResume & { lastKnownBlockage: null }), [
    "Mission: mission_demo",
    "Titre: Mission demo",
    "Objectif: Rendre la supervision lisible",
    "Statut: ready",
    "Criteres de succes:",
    "  aucun",
    "Tickets ouverts: aucun",
    "Validations en attente: aucune",
    "Capabilities mission: aucune",
    "Skill packs mission: aucun",
    "Dernier artefact pertinent: aucun",
    "Dernier blocage connu: aucun",
    "Dernier evenement: event_demo",
    "Mis a jour: 2026-04-10T10:00:00.000Z",
    "Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment.",
  ]);
});

test("formatMissionResume rend un blocage approval compact et deterministe", () => {
  const lines = formatMissionResume({
    ...createResume({
      status: "awaiting_approval",
      successCriteria: [],
      pendingApprovals: [
        { approvalId: "approval_1", title: "Validation critique" },
      ],
      nextOperatorAction: "Arbitrez la prochaine validation en attente: Validation critique.",
    }),
    lastKnownBlockage: {
      kind: "approval_pending",
      summary: "Validation en attente pour le ticket ticket_alpha: Modification de README.md",
      missionStatus: "awaiting_approval",
      occurredAt: "2026-04-10T10:00:00.000Z",
      approvalId: "approval_1",
      ticketId: "ticket_alpha",
      attemptId: "attempt_1",
      reasonCode: "approval_requested",
      sourceEventId: "event_approval_requested",
    },
  } as MissionResume & {
    lastKnownBlockage: {
      kind: string;
      summary: string;
      missionStatus: string;
      occurredAt: string;
      approvalId: string;
      ticketId: string;
      attemptId: string;
      reasonCode: string;
      sourceEventId: string;
    };
  });

  assert.equal(
    lines[11],
    "Dernier blocage connu: Validation en attente pour le ticket ticket_alpha: Modification de README.md | validation=approval_1 | ticket=ticket_alpha | tentative=attempt_1",
  );
});

test("formatMissionResume rend prioritaire l'arbitrage d'une validation en attente", () => {
  const mission: Mission = {
    id: "mission_demo",
    title: "Mission demo",
    objective: "Rendre la supervision lisible",
    status: "awaiting_approval",
    successCriteria: ["Le board est lisible"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: ["ticket_alpha"],
    artifactIds: [],
    eventIds: ["event_demo"],
    resumeCursor: "event_demo",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  };
  const resume = createMissionResume(mission, {
    openTickets: [
      { ticketId: "ticket_alpha", title: "Ticket alpha", status: "in_progress" },
    ],
    pendingApprovals: [
      { approvalId: "approval_1", title: "Validation critique", status: "requested" },
    ],
  });

  assert.equal(
    resume.nextOperatorAction,
    "Arbitrez la prochaine validation en attente: Validation critique.",
  );
  assert.equal(
    formatMissionResume(resume).at(-1),
    "Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation critique.",
  );
});

test("formatMissionStatus assemble resume et board vide", () => {
  assert.deepEqual(formatMissionStatus({
    ...createResume({
      nextOperatorAction: "Aucun ticket n'existe encore.",
    }),
    lastKnownBlockage: null,
  } as MissionResume & { lastKnownBlockage: null }, []), [
    "Mission: mission_demo",
    "Titre: Mission demo",
    "Objectif: Rendre la supervision lisible",
    "Statut: ready",
    "Criteres de succes:",
    "  1. Le board est lisible",
    "  2. Le resume reste compact",
    "Tickets ouverts: aucun",
    "Validations en attente: aucune",
    "Capabilities mission: aucune",
    "Skill packs mission: aucun",
    "Dernier artefact pertinent: aucun",
    "Dernier blocage connu: aucun",
    "Dernier evenement: event_demo",
    "Mis a jour: 2026-04-10T10:00:00.000Z",
    "Prochain arbitrage utile: Aucun ticket n'existe encore.",
    "",
    "Etat des tickets:",
    "  Aucun ticket n'existe encore.",
  ]);
});

test("formatMissionStatus preserve le bloc Etat des tickets pour un board mixte", () => {
  const lines = formatMissionStatus({
    ...createResume({
      openTickets: [{ ticketId: "ticket_alpha", title: "Ticket alpha" }],
    }),
    lastKnownBlockage: null,
  } as MissionResume & { lastKnownBlockage: null }, [
    createBoardEntry(),
    createBoardEntry({
      ticketId: "ticket_blocked",
      status: "blocked",
      owner: "agent_blocked",
      runnable: false,
      trackingState: "blocked",
      statusReasonCode: "ticket_blocked",
      blockingReasonCode: "ticket_blocked",
    }),
  ]);

  assert.equal(lines[16], "");
  assert.equal(lines[17], "Etat des tickets:");
  assert.equal(lines[18], "  1. ticket_alpha | statut=todo | owner=agent_alpha | dependances=aucune | suivi=runnable | motif=pret a lancer");
  assert.equal(lines[19], "  2. ticket_blocked | statut=blocked | owner=agent_blocked | dependances=aucune | suivi=blocked | motif=ticket bloque");
});

test("formatArtifactList rend les listes vides et mixtes", () => {
  assert.deepEqual(formatArtifactList([]), [
    "Artefacts de mission:",
    "  Aucun artefact enregistre.",
  ]);

  assert.deepEqual(formatArtifactList([
    createArtifact({
      artifactId: "artifact_note",
      ticketId: "ticket_alpha",
      kind: "workspace_file",
      path: "notes/alpha.md",
      producingEventId: "event_note",
    }),
    createArtifact({
      artifactId: "artifact_payload",
      ticketId: "ticket_beta",
      kind: "structured_output",
      label: "rapport",
      attemptId: "attempt_1",
      workspaceIsolationId: "iso_1",
      producingEventId: "event_payload",
      sourceEventType: "execution.completed",
    }),
  ]), [
    "Artefacts de mission:",
    "  1. artifact_note | ticket=ticket_alpha | kind=workspace_file | ref=notes/alpha.md | event=event_note | source=inconnu | tentative=aucune | isolation=aucune",
    "  2. artifact_payload | ticket=ticket_beta | kind=structured_output | ref=rapport | event=event_payload | source=execution.completed | tentative=attempt_1 | isolation=iso_1",
  ]);
});

test("formatApprovalQueue rend la file detaillee et le cas vide", () => {
  assert.deepEqual(formatApprovalQueue([]), [
    "File d'approbation:",
    "  Aucune validation en attente.",
  ]);

  assert.deepEqual(formatApprovalQueue([
    createApprovalEntry(),
  ]), [
    "File d'approbation:",
    "  1. approval_1 | ticket=ticket_alpha | attempt=attempt_1 | statut=requested",
    "     titre=Validation critique",
    "     action=workspace_write | resume=Modification de README.md",
    "     garde-fous=policy_profile: policy_profile_local ; allowed_capabilities: fs.read, cli.run",
    "     evenements=event_1, event_2",
    "     artefacts=artifact_1",
  ]);
});

test("formatMissionHelp expose les decisions d'approbation et la timeline d'audit sans fuite vendor", () => {
  const output = formatMissionHelp().join("\n");

  assert.match(
    output,
    /corp mission approval approve --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/,
  );
  assert.match(
    output,
    /corp mission approval reject --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/,
  );
  assert.match(
    output,
    /corp mission approval defer --root <workspace> --mission-id <mission_id> --approval-id <approval_id>/,
  );
  assert.match(
    output,
    /corp mission compare --root <workspace> --mission-id <mission_id>/,
  );
  assert.match(
    output,
    /corp mission compare relaunch --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id> \[--background\]/,
  );
  assert.match(
    output,
    /corp mission audit --root <workspace> --mission-id <mission_id> \[--ticket-id <ticket_id>\] \[--limit <n>\]/,
  );
  assert.match(
    output,
    /corp mission audit show --root <workspace> --mission-id <mission_id> --event-id <event_id>/,
  );
  assert.doesNotMatch(output, /codex|openai|responseId|pollCursor|vendorStatus|requires_action/i);
});

test("formatMissionCompare rend attendu observe ecarts et branche impactee sans fuite vendor", () => {
  assert.deepEqual(formatMissionCompare({
    missionId: "mission_demo",
    expected: {
      objective: "Comparer l'etat courant a la mission",
      successCriteria: [
        "Le ticket critique est relance proprement",
        "Les tickets sains restent intacts",
      ],
    },
    observed: {
      missionStatus: "failed",
      openTicketIds: ["ticket_publish", "ticket_docs"],
      pendingApprovalCount: 0,
      pendingApprovals: [],
      lastKnownBlockage: {
        kind: "ticket_failed",
        summary: "Ticket ticket_codegen en echec",
        missionStatus: "failed",
        occurredAt: "2026-04-12T09:00:00.000Z",
        reasonCode: "ticket_failed",
        ticketId: "ticket_codegen",
        attemptId: "attempt_codegen_1",
        sourceEventId: "event_codegen_failed",
      },
      lastRelevantArtifact: {
        artifactId: "artifact_report",
        ticketId: "ticket_codegen",
        title: "Rapport d'execution",
        missionId: "mission_demo",
        producingEventId: "event_artifact",
        attemptId: "attempt_codegen_1",
        workspaceIsolationId: "iso_codegen_1",
      },
      nextOperatorAction: "Diagnostiquez la cause puis relancez la racine impactee.",
      tickets: [
        {
          ticketId: "ticket_codegen",
          title: "Generer le code",
          status: "failed",
          trackingState: "failed",
          statusReasonCode: "ticket_failed",
          blockingReasonCode: null,
          planOrder: 0,
        },
        {
          ticketId: "ticket_publish",
          title: "Publier la sortie",
          status: "todo",
          trackingState: "blocked",
          statusReasonCode: "dependency_failed",
          blockingReasonCode: "dependency_failed",
          planOrder: 1,
        },
        {
          ticketId: "ticket_docs",
          title: "Documenter",
          status: "todo",
          trackingState: "runnable",
          statusReasonCode: "runnable",
          blockingReasonCode: null,
          planOrder: 2,
        },
      ],
    },
    gaps: [
      {
        code: "ticket_failed",
        summary: "Le ticket critique ticket_codegen a echoue.",
        ticketId: "ticket_codegen",
      },
    ],
    impactedBranch: {
      rootTicketId: "ticket_codegen",
      impactedTicketIds: ["ticket_codegen", "ticket_publish"],
      relaunchable: true,
      blockingReasons: [],
    },
    operatorValidationRequired: false,
  }), [
    "Mission: mission_demo",
    "Attendu:",
    "  Objectif: Comparer l'etat courant a la mission",
    "  Criteres de succes:",
    "    1. Le ticket critique est relance proprement",
    "    2. Les tickets sains restent intacts",
    "Observe:",
    "  Statut mission: failed",
    "  Tickets ouverts: ticket_publish, ticket_docs",
    "  Validations en attente: aucune",
    "  Dernier artefact pertinent: Rapport d'execution",
    "  Dernier blocage connu: Ticket ticket_codegen en echec",
    "  Prochain arbitrage utile: Diagnostiquez la cause puis relancez la racine impactee.",
    "Ecarts:",
    "  1. ticket_failed | ticket=ticket_codegen | Le ticket critique ticket_codegen a echoue.",
    "Branche impactee:",
    "  Racine: ticket_codegen | relaunchable=oui",
    "  Descendants impactes: ticket_publish",
    "  Tickets non impactes: ticket_docs",
    "  Blocages restants: aucun",
    "Validation operateur requise: non",
  ]);
});

test("formatMissionCompare rend explicitement la validation operateur requise quand tout est done", () => {
  const output = formatMissionCompare({
    missionId: "mission_demo",
    expected: {
      objective: "Verifier la fin de mission",
      successCriteria: ["Tous les tickets sont termines"],
    },
    observed: {
      missionStatus: "ready",
      openTicketIds: [],
      pendingApprovalCount: 0,
      pendingApprovals: [],
      lastKnownBlockage: null,
      lastRelevantArtifact: null,
      nextOperatorAction: "Verifiez les criteres puis cloturez ou poursuivez manuellement.",
      tickets: [
        {
          ticketId: "ticket_done",
          title: "Ticket termine",
          status: "done",
          trackingState: "done",
          statusReasonCode: "ticket_done",
          blockingReasonCode: null,
          planOrder: 0,
        },
      ],
    },
    gaps: [
      {
        code: "validation_operateur_requise",
        summary: "Tous les tickets sont termines, mais les criteres de succes exigent une validation operateur.",
      },
    ],
    impactedBranch: {
      rootTicketId: null,
      impactedTicketIds: [],
      relaunchable: false,
      blockingReasons: [
        {
          code: "validation_operateur_requise",
          summary: "Validation operateur requise avant toute conclusion.",
        },
      ],
    },
    operatorValidationRequired: true,
  }).join("\n");

  assert.match(output, /Racine: aucune \| relaunchable=non/);
  assert.match(output, /Descendants impactes: aucun/);
  assert.match(output, /Tickets non impactes: ticket_done/);
  assert.match(output, /Blocages restants: Validation operateur requise avant toute conclusion\./);
  assert.match(output, /Validation operateur requise: oui/);
  assert.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_action/i);
});

test("formatAuditLog rend la timeline detaillee et le cas vide", () => {
  assert.deepEqual(formatAuditLog([]), [
    "Journal d'audit:",
    "  Aucun evenement d'audit pour cette selection.",
  ]);

  assert.deepEqual(formatAuditLog([
    createAuditEntry(),
  ]), [
    "Journal d'audit:",
    "  1. 2026-04-10T10:00:00.000Z | Execution terminee | event=event_exec_completed | type=execution.completed",
    "     resume=Tentative attempt_1 terminee pour le ticket ticket_alpha. 1 artefact(s) lie(s).",
    "     ticket=ticket_alpha | owner=agent_dev | attempt=attempt_1 | acteur=adapter | source=execution-adapter",
    "     artefact=artifact_1",
    "     evenements lies=event_exec_requested",
    "     artefacts lies=artifact_1",
  ]);
});

test("formatAuditEntryDetail rend un detail d'evenement lisible et correle", () => {
  assert.deepEqual(formatAuditEntryDetail(createAuditEntry({
    approvalId: "approval_1",
    relatedArtifactIds: ["artifact_1", "artifact_2"],
  }), {
    missionId: "mission_demo",
    fields: [
      createAuditDetailField(),
      createAuditDetailField({
        label: "Isolation",
        value: "iso_1",
      }),
    ],
  }), [
    "Mission: mission_demo",
    "Evenement: event_exec_completed",
    "Type: execution.completed",
    "Horodatage: 2026-04-10T10:00:00.000Z",
    "Titre: Execution terminee",
    "Resume: Tentative attempt_1 terminee pour le ticket ticket_alpha. 1 artefact(s) lie(s).",
    "Ticket: ticket_alpha",
    "Owner ticket: agent_dev",
    "Tentative: attempt_1",
    "Artefact: artifact_1",
    "Approval: approval_1",
    "Acteur: adapter",
    "Source: execution-adapter",
    "Evenements lies: event_exec_requested",
    "Artefacts lies: artifact_1, artifact_2",
    "Details:",
    "  Statut tentative: completed",
    "  Isolation: iso_1",
  ]);
});

test("formatArtifactDetail rend la preview et les metadonnees optionnelles", () => {
  assert.deepEqual(formatArtifactDetail(createArtifact({
    artifactId: "artifact_payload",
    ticketId: "ticket_alpha",
    ticketOwner: "agent_dev",
    kind: "structured_output",
    title: "Rapport JSON",
    path: "artifacts/report.json",
    label: "rapport",
    mediaType: "application/json",
    summary: "Resume court",
    approvalId: "approval_1",
    decisionRef: "decision_1",
    sourceEventType: "execution.completed",
    sourceEventOccurredAt: "2026-04-10T09:59:00.000Z",
    sourceActor: "adapter",
    source: "execution-adapter",
    attemptId: "attempt_1",
    workspaceIsolationId: "iso_1",
  }), {
    missionId: "mission_demo",
    payloadPreview: "{\"ok\":true}",
  }), [
    "Mission: mission_demo",
    "Ticket: ticket_alpha",
    "Owner ticket: agent_dev",
    "Artefact: artifact_payload",
    "Type: structured_output",
    "Titre: Rapport JSON",
    "Evenement producteur: event_demo",
    "Type source: execution.completed",
    "Survenu a: 2026-04-10T09:59:00.000Z",
    "Acteur: adapter",
    "Source: execution-adapter",
    "Tentative: attempt_1",
    "Isolation: iso_1",
    "Chemin: artifacts/report.json",
    "Label: rapport",
    "Media type: application/json",
    "Resume: Resume court",
    "Approval: approval_1",
    "Decision: decision_1",
    "Preview:",
    "  {\"ok\":true}",
  ]);
});

test("formatArtifactDetail omet la preview absente", () => {
  assert.deepEqual(formatArtifactDetail(createArtifact({
    artifactId: "artifact_note",
    ticketId: "ticket_alpha",
    kind: "report_text",
    title: "Note operateur",
  }), {
    missionId: "mission_demo",
    payloadPreview: null,
  }), [
    "Mission: mission_demo",
    "Ticket: ticket_alpha",
    "Artefact: artifact_note",
    "Type: report_text",
    "Titre: Note operateur",
    "Evenement producteur: event_demo",
    "Type source: inconnu",
    "Survenu a: inconnu",
    "Acteur: inconnu",
    "Source: inconnu",
    "Tentative: aucune",
    "Isolation: aucune",
  ]);
});
