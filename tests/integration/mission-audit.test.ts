import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { ApprovalQueueProjection } from "../../packages/journal/src/projections/approval-queue-projection";
import type { ArtifactIndexProjection } from "../../packages/journal/src/projections/artifact-index-projection";
import type { AuditLogProjection } from "../../packages/journal/src/projections/audit-log-projection";
import { runCli } from "../../apps/corp-cli/src/index";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

interface JournalEventRecord {
  eventId: string;
  type: string;
  missionId: string;
  ticketId?: string;
  attemptId?: string;
  occurredAt: string;
  actor: string;
  source: string;
  payload: Record<string, unknown>;
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

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission audit",
    "--objective",
    "Lire le journal comme une chronologie structuree",
    "--success-criterion",
    "La timeline reste lisible",
    "--success-criterion",
    "Les corrrelations restent auditables",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", line.slice("Mission creee: ".length), "mission.json"),
  );
}

async function createTicket(rootDir: string, missionId: string): Promise<string> {
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
    "Produire une sortie et passer par une validation",
    "--owner",
    "agent_audit",
    "--success-criterion",
    "Une sortie est disponible",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return line.slice("Ticket cree: ".length);
}

async function prepareMissionWithAuditTimeline(rootDir: string): Promise<{
  missionId: string;
  ticketId: string;
  approvalId: string;
  approvalEventId: string;
  artifactId: string;
  artifactEventId: string;
}> {
  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_audit_approval",
          pollCursor: "cursor_audit_approval",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation critique",
          actionType: "workspace_write",
          actionSummary: "Modifier README.md",
          guardrails: ["manual_review: workspace_write"],
        },
      }),
    }),
  });

  const firstRunResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(firstRunResult.exitCode, 0);

  const approvalQueue = await readJson<ApprovalQueueProjection>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );
  const approvalId = approvalQueue.approvals[0]?.approvalId;
  assert.ok(approvalId, "une approbation doit exister");

  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approvalId,
    "--reason",
    "Validation operateur",
  ]);

  assert.equal(approveResult.exitCode, 0);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "completed",
        adapterState: {
          responseId: "resp_audit_completed",
          pollCursor: "cursor_audit_completed",
          vendorStatus: "completed",
        },
        outputs: [
          {
            kind: "text",
            title: "Synthese operateur",
            label: "synthese",
            mediaType: "text/plain",
            text: "Une synthese borne pour l'operateur.",
            summary: "Synthese finale du run.",
          },
        ],
      }),
    }),
  });

  const secondRunResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(secondRunResult.exitCode, 0);

  const pauseResult = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const relaunchResult = await runCommand([
    "mission",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(pauseResult.exitCode, 0);
  assert.equal(relaunchResult.exitCode, 0);

  const journal = await readJournal(rootDir);
  const approvalEvent = journal.find((event) => event.type === "approval.requested");
  const artifactEvent = [...journal].reverse().find((event) => event.type === "artifact.registered");
  const artifactIndex = await readJson<ArtifactIndexProjection>(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
  );
  const artifactId = artifactIndex.artifacts.at(-1)?.artifactId;

  assert.ok(approvalEvent, "approval.requested doit exister");
  assert.ok(artifactEvent, "artifact.registered doit exister");
  assert.ok(artifactId, "un artefact doit etre disponible");

  return {
    missionId: mission.id,
    ticketId,
    approvalId,
    approvalEventId: approvalEvent.eventId,
    artifactId,
    artifactEventId: artifactEvent.eventId,
  };
}

test("mission audit expose une timeline mission-centrique structuree, filtrable et sans fuite vendor", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-audit-flow-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithAuditTimeline(rootDir);
  const result = await runCommand([
    "mission",
    "audit",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);
  const output = result.lines.join("\n");
  const auditLogRaw = await readFile(
    path.join(rootDir, ".corp", "projections", "audit-log.json"),
    "utf8",
  );
  const auditLog = JSON.parse(auditLogRaw) as AuditLogProjection;
  const executionCompletedEntry = auditLog.entries.find((entry) => entry.eventType === "execution.completed");

  assert.equal(result.exitCode, 0);
  assert.match(output, new RegExp(`Mission: ${prepared.missionId}`));
  assert.match(output, /Journal d'audit:/);
  assert.match(output, /Mission creee/);
  assert.match(output, /Ticket cree/);
  assert.match(output, /Isolation creee/);
  assert.match(output, /Execution demandee/);
  assert.match(output, /Ticket en cours/);
  assert.match(output, /Validation critique/);
  assert.match(output, /Validation approuvee/);
  assert.match(output, /Artefact enregistre/);
  assert.match(output, /Mission mise en pause/);
  assert.match(output, /Mission relancee/);

  assert.ok(executionCompletedEntry);
  assert.equal(executionCompletedEntry.ticketId, prepared.ticketId);
  assert.equal(executionCompletedEntry.ticketOwner, "agent_audit");
  assert.equal(executionCompletedEntry.source, "execution-adapter");
  assert.deepEqual(executionCompletedEntry.relatedArtifactIds, [prepared.artifactId]);

  assert.deepEqual(
    auditLog.entries.map((entry) => `${entry.occurredAt}|${entry.eventId}`),
    [...auditLog.entries.map((entry) => `${entry.occurredAt}|${entry.eventId}`)].sort((left, right) =>
      left.localeCompare(right),
    ),
  );

  for (const candidate of [output, auditLogRaw]) {
    assert.doesNotMatch(
      candidate,
      /resp_audit_approval|cursor_audit_approval|resp_audit_completed|cursor_audit_completed|vendorStatus|pollCursor|threadId|adapterState/i,
    );
  }

  const filteredResult = await runCommand([
    "mission",
    "audit",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
    "--ticket-id",
    prepared.ticketId,
    "--limit",
    "2",
  ]);
  const filteredOutput = filteredResult.lines.join("\n");

  assert.equal(filteredResult.exitCode, 0);
  assert.match(filteredOutput, /Artefact detecte/);
  assert.match(filteredOutput, /Artefact enregistre/);
  assert.doesNotMatch(filteredOutput, /Mission creee/);
});

test("mission audit reconstruit audit-log quand la projection manque ou est corrompue sans muter le journal", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-audit-rebuild-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithAuditTimeline(rootDir);
  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const auditLogPath = path.join(rootDir, ".corp", "projections", "audit-log.json");
  const journalBeforeRead = await readFile(journalPath, "utf8");

  await unlink(auditLogPath);

  const listAfterDelete = await runCommand([
    "mission",
    "audit",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);

  assert.equal(listAfterDelete.exitCode, 0);
  assert.equal(await readFile(journalPath, "utf8"), journalBeforeRead);

  await writeFile(auditLogPath, "{corrupted", "utf8");

  const showAfterCorruption = await runCommand([
    "mission",
    "audit",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
    "--event-id",
    prepared.approvalEventId,
  ]);
  const rebuiltProjection = await readJson<AuditLogProjection>(auditLogPath);

  assert.equal(showAfterCorruption.exitCode, 0);
  assert.equal(await readFile(journalPath, "utf8"), journalBeforeRead);
  assert.ok(rebuiltProjection.entries.some((entry) => entry.eventId === prepared.approvalEventId));
  assert.ok(rebuiltProjection.entries.some((entry) => entry.eventId === prepared.artifactEventId));
});

test("mission audit show renvoie un detail lisible et correle pour un evenement precis", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-audit-show-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithAuditTimeline(rootDir);
  const result = await runCommand([
    "mission",
    "audit",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
    "--event-id",
    prepared.approvalEventId,
  ]);
  const output = result.lines.join("\n");

  assert.equal(result.exitCode, 0);
  assert.match(output, new RegExp(`Mission: ${prepared.missionId}`));
  assert.match(output, new RegExp(`Evenement: ${prepared.approvalEventId}`));
  assert.match(output, /Type: approval.requested/);
  assert.match(output, new RegExp(`Ticket: ${prepared.ticketId}`));
  assert.match(output, /Owner ticket: agent_audit/);
  assert.match(output, new RegExp(`Tentative: attempt_`));
  assert.match(output, new RegExp(`Approval: ${prepared.approvalId}`));
  assert.match(output, /Acteur: adapter/);
  assert.match(output, /Source: execution-adapter/);
  assert.match(output, /Details:/);
  assert.match(output, /Action: workspace_write/);
  assert.match(output, /Resume action: Modifier README\.md/);
  assert.match(output, /Garde-fous: manual_review: workspace_write/);
  assert.doesNotMatch(
    output,
    /resp_audit_approval|cursor_audit_approval|resp_audit_completed|cursor_audit_completed|vendorStatus|pollCursor|threadId|adapterState/i,
  );
});
