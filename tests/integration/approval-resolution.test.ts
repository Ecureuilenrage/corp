import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import type { ApprovalRequest } from "../../packages/contracts/src/approval/approval-request";
import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { appendEvent, type JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import type { ApprovalQueueProjection } from "../../packages/journal/src/projections/approval-queue-projection";
import { resolveWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import { createFileExecutionAttemptRepository } from "../../packages/storage/src/repositories/file-execution-attempt-repository";
import { createFileMissionRepository } from "../../packages/storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../packages/storage/src/repositories/file-ticket-repository";
import { rewriteMissionReadModels } from "../../packages/ticket-runtime/src/ticket-service/ticket-service-support";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

interface ApprovalDecisionPayload {
  approvalId: string;
  previousApproval: ApprovalRequest;
  approval: ApprovalRequest;
  decision: {
    outcome: "approved" | "rejected" | "deferred";
    reason?: string;
    missionPolicyChange?: { previous: string; next: string };
    ticketCapabilityChange?: { previous: string[]; next: string[] };
    ticketSkillPackChange?: { previous: string[]; next: string[] };
    budgetObservations?: string[];
  };
}

async function runCommand(args: string[]): Promise<CommandResult> {
  const lines: string[] = [];
  const exitCode = await runCli(args, {
    writeLine: (line: string) => lines.push(line),
  });

  return {
    exitCode,
    lines,
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string, title = "Mission approval resolution"): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Resoudre une validation en attente sans fuite vendor",
    "--success-criterion",
    "La decision est journalisee",
    "--success-criterion",
    "Les projections restent coherentes",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  const mission = await readMission(rootDir, line.slice("Mission creee: ".length));
  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");

  await writeFile(
    missionPath,
    `${JSON.stringify({
      ...mission,
      authorizedExtensions: {
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: ["pack.audit", "pack.review"],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  return readMission(rootDir, mission.id);
}

async function createTicket(
  rootDir: string,
  missionId: string,
  overrides: Partial<{
    goal: string;
    owner: string;
    successCriteria: string[];
    allowedCapabilities: string[];
    skillPackRefs: string[];
  }> = {},
): Promise<string> {
  const result = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    overrides.goal ?? "Executer une action sensible",
    "--owner",
    overrides.owner ?? "agent_sensitive",
    ...buildRepeatedOptionArgs(
      "--success-criterion",
      overrides.successCriteria ?? ["L'action sensible est decrite"],
    ),
    ...buildRepeatedOptionArgs(
      "--allow-capability",
      overrides.allowedCapabilities ?? ["fs.read", "cli.run"],
    ),
    ...buildRepeatedOptionArgs(
      "--skill-pack",
      overrides.skillPackRefs ?? ["pack.audit"],
    ),
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return line.slice("Ticket cree: ".length);
}

async function readMission(rootDir: string, missionId: string): Promise<Mission> {
  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", missionId, "mission.json"),
  );
}

async function readTicket(rootDir: string, missionId: string, ticketId: string): Promise<Ticket> {
  return readJson<Ticket>(
    path.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"),
  );
}

async function readAttempt(
  rootDir: string,
  missionId: string,
  ticketId: string,
  attemptId: string,
): Promise<ExecutionAttempt> {
  return readJson<ExecutionAttempt>(
    path.join(
      rootDir,
      ".corp",
      "missions",
      missionId,
      "tickets",
      ticketId,
      "attempts",
      attemptId,
      "attempt.json",
    ),
  );
}

async function readApprovalQueueProjection(rootDir: string): Promise<ApprovalQueueProjection> {
  return readJson<ApprovalQueueProjection>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

async function registerTestSkillPack(rootDir: string, packRef = "pack.audit"): Promise<void> {
  const sourceFixtureRoot = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "extensions",
  );
  const sourceManifestPath = path.join(sourceFixtureRoot, "valid-skill-pack.json");
  const fixtureRoot = path.join(rootDir, ".skill-pack-fixtures");
  const manifestPath = path.join(fixtureRoot, `${packRef.replace(/\./g, "-")}.skill-pack.json`);
  const manifest = JSON.parse(await readFile(sourceManifestPath, "utf8")) as Record<string, unknown>;
  const skillPack = manifest.skillPack as Record<string, unknown>;

  await cp(
    path.join(sourceFixtureRoot, "skill-packs"),
    path.join(fixtureRoot, "skill-packs"),
    { recursive: true },
  );

  manifest.id = `ext.skill-pack.${packRef}.test`;
  manifest.displayName = `Pack ${packRef}`;
  manifest.skillPack = {
    ...skillPack,
    packRef,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const registerResult = await runCommand([
    "extension",
    "skill-pack",
    "register",
    "--root",
    rootDir,
    "--file",
    manifestPath,
  ]);

  assert.equal(registerResult.exitCode, 0);
}

async function openApprovalForTicket(
  rootDir: string,
  missionId: string,
  ticketId: string,
  overrides: Partial<{
    title: string;
    actionType: string;
    actionSummary: string;
    guardrails: string[];
    relatedArtifactIds: string[];
    adapterState: Record<string, unknown>;
  }> = {},
): Promise<{
  approval: ApprovalRequest;
  attemptId: string;
}> {
  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_approval_resolution",
          pollCursor: "cursor_approval_resolution",
          vendorStatus: "requires_approval",
          ...overrides.adapterState,
        },
        approvalRequest: {
          title: overrides.title ?? "Validation requise pour une action sensible",
          actionType: overrides.actionType ?? "workspace_write",
          actionSummary: overrides.actionSummary ?? "Modification sensible dans le workspace isole",
          guardrails: overrides.guardrails ?? ["manual_review: workspace_write"],
          relatedArtifactIds: overrides.relatedArtifactIds,
        },
      }),
    }),
  });

  await registerTestSkillPack(rootDir, "pack.audit");
  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);

  const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
  assert.ok(attemptLine, "la commande doit annoncer l'attempt ouverte");

  const queueProjection = await readApprovalQueueProjection(rootDir);
  const approval = queueProjection.approvals.find((entry) => entry.ticketId === ticketId);

  assert.ok(approval, "la queue doit contenir la validation ouverte pour le ticket");

  return {
    approval,
    attemptId: attemptLine.slice("Tentative ouverte: ".length),
  };
}

function buildRepeatedOptionArgs(optionName: string, values: string[]): string[] {
  return values.flatMap((value) => [optionName, value]);
}

async function seedPendingApproval(
  rootDir: string,
  missionId: string,
  ticketId: string,
  suffix: string,
): Promise<ApprovalRequest> {
  const layout = resolveWorkspaceLayout(rootDir);
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const mission = await missionRepository.findById(missionId);
  const ticket = await ticketRepository.findById(missionId, ticketId);

  assert.ok(mission);
  assert.ok(ticket);

  const occurredAt = new Date().toISOString();
  const approvalId = `approval_seed_${suffix}`;
  const attemptId = `attempt_seed_${suffix}`;
  const eventId = `event_seed_${suffix}`;
  const adapterState = {
    responseId: `resp_seed_${suffix}`,
    vendorStatus: "requires_approval",
  };
  const workspaceIsolationId = `iso_seed_${suffix}`;
  const updatedMission: Mission = {
    ...mission,
    status: "awaiting_approval",
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const updatedTicket: Ticket = {
    ...ticket,
    status: "awaiting_approval",
    workspaceIsolationId,
    executionHandle: {
      adapter: "codex_responses",
      adapterState: { ...adapterState },
    },
    eventIds: [...ticket.eventIds, eventId],
    updatedAt: occurredAt,
  };
  const attempt: ExecutionAttempt = {
    id: attemptId,
    ticketId: ticket.id,
    adapter: "codex_responses",
    status: "awaiting_approval",
    workspaceIsolationId,
    backgroundRequested: true,
    adapterState: { ...adapterState },
    startedAt: occurredAt,
    endedAt: null,
  };
  const approval: ApprovalRequest = {
    approvalId,
    missionId,
    ticketId: ticket.id,
    attemptId,
    status: "requested",
    title: `Validation secondaire ${suffix}`,
    actionType: "workspace_write",
    actionSummary: `Modification secondaire ${suffix}`,
    guardrails: buildSeedGuardrails(
      ["manual_review: workspace_write"],
      updatedMission.policyProfileId,
      updatedTicket.allowedCapabilities,
      updatedTicket.skillPackRefs,
    ),
    relatedEventIds: [mission.resumeCursor],
    relatedArtifactIds: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const event: JournalEventRecord = {
    eventId,
    type: "approval.requested",
    missionId,
    ticketId: ticket.id,
    attemptId,
    occurredAt,
    actor: "adapter",
    source: "codex_responses",
    payload: {
      mission: updatedMission,
      ticket: updatedTicket,
      attempt,
      approvalId,
      approval,
      trigger: "adapter",
    },
  };

  await appendEvent(layout.journalPath, event);
  await missionRepository.save(updatedMission);
  await ticketRepository.save(updatedTicket);
  await attemptRepository.save(missionId, attempt);
  await rewriteMissionReadModels(layout, updatedMission, ticketRepository);

  return approval;
}

async function seedActiveAttempt(
  rootDir: string,
  missionId: string,
  ticketId: string,
  suffix: string,
): Promise<ExecutionAttempt> {
  const layout = resolveWorkspaceLayout(rootDir);
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const attemptRepository = createFileExecutionAttemptRepository(layout);
  const mission = await missionRepository.findById(missionId);
  const ticket = await ticketRepository.findById(missionId, ticketId);

  assert.ok(mission);
  assert.ok(ticket);

  const occurredAt = new Date().toISOString();
  const attemptId = `attempt_running_${suffix}`;
  const eventId = `event_running_${suffix}`;
  const adapterState = {
    responseId: `resp_running_${suffix}`,
    pollCursor: `cursor_running_${suffix}`,
    vendorStatus: "in_progress",
  };
  const workspaceIsolationId = `iso_running_${suffix}`;
  const updatedMission: Mission = {
    ...mission,
    status: mission.status === "awaiting_approval" ? "awaiting_approval" : "running",
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const updatedTicket: Ticket = {
    ...ticket,
    status: "claimed",
    workspaceIsolationId,
    executionHandle: {
      adapter: "codex_responses",
      adapterState: { ...adapterState },
    },
    eventIds: [...ticket.eventIds, eventId],
    updatedAt: occurredAt,
  };
  const attempt: ExecutionAttempt = {
    id: attemptId,
    ticketId: ticket.id,
    adapter: "codex_responses",
    status: "running",
    workspaceIsolationId,
    backgroundRequested: true,
    adapterState: { ...adapterState },
    startedAt: occurredAt,
    endedAt: null,
  };
  const event: JournalEventRecord = {
    eventId,
    type: "execution.background_started",
    missionId,
    ticketId: ticket.id,
    attemptId,
    occurredAt,
    actor: "adapter",
    source: "codex_responses",
    payload: {
      mission: updatedMission,
      ticket: updatedTicket,
      attempt,
      trigger: "adapter",
    },
  };

  await appendEvent(layout.journalPath, event);
  await missionRepository.save(updatedMission);
  await ticketRepository.save(updatedTicket);
  await attemptRepository.save(missionId, attempt);
  await rewriteMissionReadModels(layout, updatedMission, ticketRepository);

  return attempt;
}

function buildSeedGuardrails(
  baseGuardrails: string[],
  policyProfileId: string,
  allowedCapabilities: string[],
  skillPackRefs: string[],
): string[] {
  const values = [
    ...baseGuardrails.filter((guardrail) =>
      !guardrail.startsWith("policy_profile:")
      && !guardrail.startsWith("allowed_capabilities:")
      && !guardrail.startsWith("skill_packs:")
    ),
    `policy_profile: ${policyProfileId}`,
    ...(allowedCapabilities.length > 0
      ? [`allowed_capabilities: ${allowedCapabilities.join(", ")}`]
      : []),
    ...(skillPackRefs.length > 0
      ? [`skill_packs: ${skillPackRefs.join(", ")}`]
      : []),
  ];

  return values.filter((value, index) => value.trim().length > 0 && values.indexOf(value) === index);
}

async function assertNoVendorLeak(rootDir: string, outputs: string[]): Promise<void> {
  const approvalQueueText = await readFile(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
    "utf8",
  );
  const resumeViewText = await readFile(
    path.join(rootDir, ".corp", "projections", "resume-view.json"),
    "utf8",
  );

  for (const output of [...outputs, approvalQueueText, resumeViewText]) {
    assert.doesNotMatch(
      output,
      /resp_|cursor_|responseId|pollCursor|vendorStatus|requires_approval|requires_action/i,
    );
  }
}

test("mission approval approve journalise la decision, ferme l'attempt et applique les garde-fous persistants", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-approve-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId, {
    relatedArtifactIds: ["artifact_hint_approve"],
  });

  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
    "--reason",
    "Validation manuelle de l'operateur",
    "--policy-profile",
    "policy_profile_strict",
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    "cli.run",
    "--allow-capability",
    "shell.exec",
    "--skill-pack",
    "pack.audit",
    "--skill-pack",
    "pack.review",
    "--budget-observation",
    "openai.responses.tokens=1200",
    "--budget-observation",
    "workspace_write=approved",
  ]);
  const missionAfter = await readMission(rootDir, mission.id);
  const ticketAfter = await readTicket(rootDir, mission.id, ticketId);
  const attemptAfter = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const queueAfter = await readApprovalQueueProjection(rootDir);
  const journal = await readJournal(rootDir);
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const queueResult = await runCommand([
    "mission",
    "approval",
    "queue",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const approvedEvent = journal.find((event) => event.type === "approval.approved");

  assert.equal(approveResult.exitCode, 0);
  assert.equal(
    approveResult.lines[0],
    `Approval resolue: ${approval.approvalId} (approved)`,
  );
  assert.ok(approvedEvent, "la resolution doit produire approval.approved");
  assert.ok(
    journal.findIndex((event) => event.type === "approval.requested")
      < journal.findIndex((event) => event.type === "approval.approved"),
  );

  const payload = approvedEvent.payload as unknown as ApprovalDecisionPayload;

  assert.equal(missionAfter.status, "ready");
  assert.equal(missionAfter.policyProfileId, "policy_profile_strict");
  assert.equal(ticketAfter.status, "todo");
  assert.deepEqual(ticketAfter.allowedCapabilities, ["fs.read", "cli.run", "shell.exec"]);
  assert.deepEqual(ticketAfter.skillPackRefs, ["pack.audit", "pack.review"]);
  assert.equal(attemptAfter.status, "cancelled");
  assert.ok(attemptAfter.endedAt);
  assert.deepEqual(attemptAfter.adapterState, {
    responseId: "resp_approval_resolution",
    pollCursor: "cursor_approval_resolution",
    vendorStatus: "requires_approval",
  });
  assert.deepEqual(queueAfter.approvals, []);
  assert.equal(payload.approvalId, approval.approvalId);
  assert.equal(payload.previousApproval.status, "requested");
  assert.equal(payload.approval.status, "approved");
  assert.deepEqual(payload.approval.relatedArtifactIds, ["artifact_hint_approve"]);
  assert.deepEqual(payload.approval.guardrails, [
    "manual_review: workspace_write",
    "policy_profile: policy_profile_strict",
    "allowed_capabilities: fs.read, cli.run, shell.exec",
    "skill_packs: pack.audit, pack.review",
  ]);
  assert.deepEqual(payload.decision, {
    outcome: "approved",
    reason: "Validation manuelle de l'operateur",
    missionPolicyChange: {
      previous: "policy_profile_local",
      next: "policy_profile_strict",
    },
    ticketCapabilityChange: {
      previous: ["fs.read", "cli.run"],
      next: ["fs.read", "cli.run", "shell.exec"],
    },
    ticketSkillPackChange: {
      previous: ["pack.audit"],
      next: ["pack.audit", "pack.review"],
    },
    budgetObservations: [
      "openai.responses.tokens=1200",
      "workspace_write=approved",
    ],
  });
  assert.equal(statusResult.exitCode, 0);
  assert.equal(resumeResult.exitCode, 0);
  assert.equal(queueResult.exitCode, 0);
  assert.match(statusResult.lines.join("\n"), /Statut: ready/);
  assert.match(statusResult.lines.join("\n"), /Validations en attente: aucune/);
  assert.match(resumeResult.lines.join("\n"), /Validations en attente: aucune/);
  assert.match(queueResult.lines.join("\n"), /Aucune validation en attente\./);
  assert.equal(
    Object.prototype.hasOwnProperty.call(missionAfter, "resource_budget"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(ticketAfter, "resource_budget"),
    false,
  );
  await assertNoVendorLeak(rootDir, [
    approveResult.lines.join("\n"),
    statusResult.lines.join("\n"),
    resumeResult.lines.join("\n"),
    queueResult.lines.join("\n"),
  ]);
});

test("mission approval reject vide la queue, passe le ticket en failed et garde la surface operateur sans fuite vendor", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-reject-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);

  const rejectResult = await runCommand([
    "mission",
    "approval",
    "reject",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
    "--reason",
    "Refus operateur",
    "--budget-observation",
    "openai.responses.tokens=2200",
  ]);
  const missionAfter = await readMission(rootDir, mission.id);
  const ticketAfter = await readTicket(rootDir, mission.id, ticketId);
  const attemptAfter = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const queueAfter = await readApprovalQueueProjection(rootDir);
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const rejectEvent = (await readJournal(rootDir)).find((event) => event.type === "approval.rejected");

  assert.equal(rejectResult.exitCode, 0);
  assert.equal(
    rejectResult.lines[0],
    `Approval resolue: ${approval.approvalId} (rejected)`,
  );
  assert.ok(rejectEvent);
  assert.equal(missionAfter.status, "ready");
  assert.equal(ticketAfter.status, "failed");
  assert.equal(attemptAfter.status, "cancelled");
  assert.ok(attemptAfter.endedAt);
  assert.deepEqual(queueAfter.approvals, []);
  assert.match(statusResult.lines.join("\n"), /Validations en attente: aucune/);
  assert.match(resumeResult.lines.join("\n"), /Aucun ticket n'est runnable pour le moment\./);
  await assertNoVendorLeak(rootDir, [
    rejectResult.lines.join("\n"),
    statusResult.lines.join("\n"),
    resumeResult.lines.join("\n"),
  ]);
});

test("mission approval defer peut nettoyer capabilities et skill packs sans ajouter de schema coeur", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-defer-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);

  const deferResult = await runCommand([
    "mission",
    "approval",
    "defer",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
    "--reason",
    "Report operateur",
    "--clear-allow-capability",
    "--clear-skill-pack",
    "--budget-observation",
    "budget.observe=manual_review",
  ]);
  const ticketAfter = await readTicket(rootDir, mission.id, ticketId);
  const attemptAfter = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const deferEvent = (await readJournal(rootDir)).find((event) => event.type === "approval.deferred");

  assert.equal(deferResult.exitCode, 0);
  assert.equal(
    deferResult.lines[0],
    `Approval resolue: ${approval.approvalId} (deferred)`,
  );
  assert.ok(deferEvent);
  assert.equal(ticketAfter.status, "failed");
  assert.deepEqual(ticketAfter.allowedCapabilities, []);
  assert.deepEqual(ticketAfter.skillPackRefs, []);
  assert.equal(attemptAfter.status, "cancelled");

  const payload = deferEvent.payload as unknown as ApprovalDecisionPayload;

  assert.deepEqual(payload.approval.guardrails, [
    "manual_review: workspace_write",
    "policy_profile: policy_profile_local",
  ]);
  assert.deepEqual(payload.decision, {
    outcome: "deferred",
    reason: "Report operateur",
    ticketCapabilityChange: {
      previous: ["fs.read", "cli.run"],
      next: [],
    },
    ticketSkillPackChange: {
      previous: ["pack.audit"],
      next: [],
    },
    budgetObservations: [
      "budget.observe=manual_review",
    ],
  });
});

test("mission approval approve reconstruit la queue depuis le journal quand les projections sont corrompues", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-rebuild-before-resolve-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval } = await openApprovalForTicket(rootDir, mission.id, ticketId);
  const approvalQueuePath = path.join(rootDir, ".corp", "projections", "approval-queue.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await writeFile(approvalQueuePath, "{corrupted", "utf8");
  await writeFile(resumeViewPath, "{corrupted", "utf8");

  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
  ]);
  const queueAfter = await readApprovalQueueProjection(rootDir);
  const resumeViewAfter = await readJson<{
    schemaVersion: number;
    resume: {
      pendingApprovals: Array<{ approvalId?: string }>;
      status: string;
    } | null;
  }>(resumeViewPath);

  assert.equal(approveResult.exitCode, 0);
  assert.deepEqual(queueAfter.approvals, []);
  assert.deepEqual(resumeViewAfter.resume?.pendingApprovals, []);
  assert.equal(resumeViewAfter.resume?.status, "ready");
});

test("mission approval detecte deterministiquement approval inconnue puis deja resolue sans muter mission, ticket ou attempt", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-deterministic-errors-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
  const missionBefore = await readMission(rootDir, mission.id);
  const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
  const attemptBefore = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const journalBefore = await readJournal(rootDir);

  const unknownResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    "approval_unknown",
  ]);

  assert.equal(unknownResult.exitCode, 1);
  assert.equal(
    unknownResult.lines.at(-1),
    `Validation introuvable dans la mission \`${mission.id}\`: \`approval_unknown\`.`,
  );
  assert.deepEqual(await readMission(rootDir, mission.id), missionBefore);
  assert.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
  assert.deepEqual(await readAttempt(rootDir, mission.id, ticketId, attemptId), attemptBefore);
  assert.equal((await readJournal(rootDir)).length, journalBefore.length);

  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
  ]);

  assert.equal(approveResult.exitCode, 0);

  const journalAfterApprove = await readJournal(rootDir);
  const missionAfterApprove = await readMission(rootDir, mission.id);
  const ticketAfterApprove = await readTicket(rootDir, mission.id, ticketId);
  const attemptAfterApprove = await readAttempt(rootDir, mission.id, ticketId, attemptId);

  const terminalResult = await runCommand([
    "mission",
    "approval",
    "defer",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
  ]);

  assert.equal(terminalResult.exitCode, 1);
  assert.equal(
    terminalResult.lines.at(-1),
    `La validation \`${approval.approvalId}\` est deja resolue (statut: approved).`,
  );
  assert.deepEqual(await readMission(rootDir, mission.id), missionAfterApprove);
  assert.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketAfterApprove);
  assert.deepEqual(await readAttempt(rootDir, mission.id, ticketId, attemptId), attemptAfterApprove);
  assert.equal((await readJournal(rootDir)).length, journalAfterApprove.length);
});

test("mission approval conserve les autres approvals pending et laisse la mission en awaiting_approval", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-multi-approval-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const firstTicketId = await createTicket(rootDir, mission.id, {
    goal: "Premiere action sensible",
    owner: "agent_alpha",
  });
  const secondTicketId = await createTicket(rootDir, mission.id, {
    goal: "Seconde action sensible",
    owner: "agent_beta",
  });
  const firstApproval = await openApprovalForTicket(rootDir, mission.id, firstTicketId);
  const secondApproval = await seedPendingApproval(rootDir, mission.id, secondTicketId, "secondary");

  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    firstApproval.approval.approvalId,
  ]);
  const missionAfter = await readMission(rootDir, mission.id);
  const queueAfter = await readApprovalQueueProjection(rootDir);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(approveResult.exitCode, 0);
  assert.equal(missionAfter.status, "awaiting_approval");
  assert.deepEqual(
    queueAfter.approvals.map((entry) => entry.approvalId),
    [secondApproval.approvalId],
  );
  assert.doesNotMatch(
    resumeResult.lines.join("\n"),
    new RegExp(firstApproval.approval.approvalId),
  );
  assert.match(
    resumeResult.lines.join("\n"),
    new RegExp(secondApproval.approvalId),
  );
});

test("mission approval passe la mission en running s'il reste une autre tentative active sans approval pending", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-running-after-resolve-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const approvalTicketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket avec approval",
    owner: "agent_alpha",
  });
  const runningTicketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket deja relance",
    owner: "agent_beta",
    allowedCapabilities: ["fs.read"],
    skillPackRefs: [],
  });
  const openedApproval = await openApprovalForTicket(rootDir, mission.id, approvalTicketId);

  await seedActiveAttempt(rootDir, mission.id, runningTicketId, "parallel");

  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    openedApproval.approval.approvalId,
  ]);
  const missionAfter = await readMission(rootDir, mission.id);
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(approveResult.exitCode, 0);
  assert.equal(missionAfter.status, "running");
  assert.match(statusResult.lines.join("\n"), /Statut: running/);
});

test("mission approval detecte deterministiquement une tentative introuvable sans mutation", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-attempt-not-found-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
  const missionBefore = await readMission(rootDir, mission.id);
  const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
  const journalBefore = await readJournal(rootDir);

  const attemptPath = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    ticketId,
    "attempts",
    attemptId,
    "attempt.json",
  );
  await rm(attemptPath);

  const result = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `Tentative introuvable pour la validation \`${approval.approvalId}\`: \`${attemptId}\`.`,
  );
  assert.deepEqual(await readMission(rootDir, mission.id), missionBefore);
  assert.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
  assert.equal((await readJournal(rootDir)).length, journalBefore.length);
});

test("mission approval detecte deterministiquement une tentative non en attente d'approbation sans mutation", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-attempt-wrong-status-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
  const { approval, attemptId } = await openApprovalForTicket(rootDir, mission.id, ticketId);
  const missionBefore = await readMission(rootDir, mission.id);
  const ticketBefore = await readTicket(rootDir, mission.id, ticketId);
  const journalBefore = await readJournal(rootDir);

  const attemptPath = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    ticketId,
    "attempts",
    attemptId,
    "attempt.json",
  );
  const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  await writeFile(attemptPath, JSON.stringify({ ...attempt, status: "running" }), "utf8");

  const result = await runCommand([
    "mission",
    "approval",
    "reject",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.equal(
    result.lines.at(-1),
    `La validation \`${approval.approvalId}\` ne peut pas etre resolue car la tentative \`${attemptId}\` n'est plus en attente d'approbation.`,
  );
  assert.deepEqual(await readMission(rootDir, mission.id), missionBefore);
  assert.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
  assert.equal((await readJournal(rootDir)).length, journalBefore.length);
});
