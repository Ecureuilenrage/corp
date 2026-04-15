import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { runCli } from "../../apps/corp-cli/src/index";
import { createCodexResponsesAdapterFromEnvironment } from "../../packages/execution-adapters/codex-responses/src/codex-responses-adapter";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";
import { resolveWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import { FileMissionRepository } from "../../packages/storage/src/repositories/file-mission-repository";
import { resolvePreferredIsolationKind } from "../../packages/workspace-isolation/src/workspace-isolation";

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

interface MissionStatusProjection {
  schemaVersion: 1;
  mission: Mission | null;
}

interface TicketBoardEntry {
  ticketId: string;
  missionId: string;
  title: string;
  status: string;
  owner: string;
  kind: string;
  dependsOn: string[];
  allowedCapabilities: string[];
  skillPackRefs: string[];
  usedCapabilities: string[];
  usedSkillPacks: string[];
  planOrder: number;
  runnable: boolean;
  blockedByTicketIds: string[];
  planningState: string;
  dependencyStatuses: Array<{
    ticketId: string;
    status: string;
    blocksRunnable: boolean;
  }>;
  trackingState: string;
  statusReasonCode: string;
  blockingReasonCode: string | null;
  activeAttemptId: string | null;
  activeAttemptStatus: string | null;
  lastAttemptId: string | null;
  lastAttemptStatus: string | null;
  lastAttemptStartedAt: string | null;
  lastAttemptEndedAt: string | null;
  lastAttemptBackgroundRequested: boolean | null;
  lastAttemptWorkspaceIsolationId: string | null;
  updatedAt: string;
}

interface TicketBoardProjection {
  schemaVersion: 1;
  tickets: TicketBoardEntry[];
}

interface IsolationMetadata {
  workspaceIsolationId: string;
  kind: string;
  sourceRoot: string;
  workspacePath: string;
  createdAt: string;
  retained: boolean;
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

async function createMission(rootDir: string, title = "Mission execution"): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Orchestrer une execution isolee",
    "--success-criterion",
    "Le ticket est executable",
    "--success-criterion",
    "Le resume reste fiable",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return readMission(rootDir, line.slice("Mission creee: ".length));
}

async function createTicket(
  rootDir: string,
  missionId: string,
  extraArgs: string[] = [],
): Promise<CommandResult> {
  return runCommand([
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
    "Livrer le ticket runnable",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket est executable",
    ...extraArgs,
  ]);
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

async function injectActiveTicketSnapshot(
  rootDir: string,
  mission: Mission,
  ticketId: string,
): Promise<void> {
  const occurredAt = new Date().toISOString();
  const attemptId = `attempt_${ticketId}`;
  const ticket: Ticket = {
    id: ticketId,
    missionId: mission.id,
    kind: "implement",
    goal: "Ticket concurrent actif",
    status: "in_progress",
    owner: "agent_concurrent",
    dependsOn: [],
    successCriteria: ["La tentative concurrente reste active"],
    allowedCapabilities: [],
    skillPackRefs: [],
    workspaceIsolationId: "iso_concurrent_active",
    executionHandle: {
      adapter: "codex_responses",
      adapterState: {},
    },
    artifactIds: [],
    eventIds: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const attempt: ExecutionAttempt = {
    id: attemptId,
    ticketId,
    adapter: "codex_responses",
    status: "running",
    workspaceIsolationId: "iso_concurrent_active",
    backgroundRequested: true,
    adapterState: {},
    startedAt: occurredAt,
    endedAt: null,
  };
  const missionPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json");
  const ticketDir = path.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId);
  const attemptDir = path.join(ticketDir, "attempts", attemptId);
  const updatedMission: Mission = {
    ...mission,
    ticketIds: mission.ticketIds.includes(ticketId)
      ? mission.ticketIds
      : [...mission.ticketIds, ticketId],
    updatedAt: occurredAt,
  };

  await mkdir(attemptDir, { recursive: true });
  await writeFile(
    path.join(ticketDir, "ticket.json"),
    `${JSON.stringify(ticket, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(attemptDir, "attempt.json"),
    `${JSON.stringify(attempt, null, 2)}\n`,
    "utf8",
  );
  await writeFile(missionPath, `${JSON.stringify(updatedMission, null, 2)}\n`, "utf8");
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

test("mission ticket run foreground cree une isolation dediee, persiste l'attempt et termine le ticket", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-foreground-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async () => ({
        status: "completed",
        adapterState: {
          responseId: "resp_foreground_123",
          pollCursor: "cursor_foreground_1",
          sequenceNumber: 7,
          vendorStatus: "completed",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  await writeFile(path.join(rootDir, "workspace.txt"), "workspace racine\n", "utf8");

  const mission = await createMission(rootDir);
  const ticketCreateResult = await createTicket(rootDir, mission.id);
  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store") as {
    writeProjectionSnapshot: (
      projectionsDir: string,
      projectionName: string,
      snapshot: object,
    ) => Promise<string>;
  };
  const originalWriteProjectionSnapshot = projectionStoreModule.writeProjectionSnapshot;
  const projectionWrites: string[] = [];

  projectionStoreModule.writeProjectionSnapshot = async (
    ...args: Parameters<typeof originalWriteProjectionSnapshot>
  ): Promise<string> => {
    projectionWrites.push(args[1]);
    return originalWriteProjectionSnapshot(...args);
  };

  t.after(() => {
    projectionStoreModule.writeProjectionSnapshot = originalWriteProjectionSnapshot;
  });

  const approvalQueueBefore = await readFile(
    path.join(layout.projectionsDir, "approval-queue.json"),
    "utf8",
  );
  const artifactIndexBefore = await readFile(
    path.join(layout.projectionsDir, "artifact-index.json"),
    "utf8",
  );

  const runResult = await runCommand([
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

  assert.equal(runResult.exitCode, 0);

  const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
  assert.ok(attemptLine, "la commande doit annoncer l'attempt ouverte");

  const attemptId = attemptLine.slice("Tentative ouverte: ".length);
  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
  const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const journal = await readJournal(rootDir);
  const missionStatusProjection = await readJson<MissionStatusProjection>(
    path.join(layout.projectionsDir, "mission-status.json"),
  );
  const ticketBoardProjection = await readJson<TicketBoardProjection>(
    path.join(layout.projectionsDir, "ticket-board.json"),
  );
  const isolationPath = path.join(
    layout.isolationsDir,
    updatedTicket.workspaceIsolationId ?? "missing",
    "isolation.json",
  );
  const isolation = await readJson<IsolationMetadata>(isolationPath);

  assert.equal(updatedMission.status, "ready");
  assert.equal(updatedTicket.status, "done");
  assert.equal(updatedTicket.executionHandle.adapter, "codex_exec");
  assert.deepEqual(updatedTicket.executionHandle.adapterState, {
    responseId: "resp_foreground_123",
    pollCursor: "cursor_foreground_1",
    sequenceNumber: 7,
    vendorStatus: "completed",
  });
  assert.ok(updatedTicket.workspaceIsolationId);
  assert.equal(updatedTicket.workspaceIsolationId, attempt.workspaceIsolationId);

  assert.equal(attempt.id, attemptId);
  assert.equal(attempt.ticketId, ticketId);
  assert.equal(attempt.adapter, "codex_exec");
  assert.equal(attempt.status, "completed");
  assert.equal(attempt.backgroundRequested, false);
  assert.equal(attempt.workspaceIsolationId, updatedTicket.workspaceIsolationId);
  assert.deepEqual(attempt.adapterState, updatedTicket.executionHandle.adapterState);
  assert.equal(typeof attempt.startedAt, "string");
  assert.equal(typeof attempt.endedAt, "string");

  assert.equal(isolation.workspaceIsolationId, updatedTicket.workspaceIsolationId);
  assert.equal(isolation.kind, "workspace_copy");
  assert.equal(isolation.sourceRoot, rootDir);
  assert.equal(isolation.retained, true);
  await access(path.join(isolation.workspacePath, "workspace.txt"));
  await assert.rejects(
    access(path.join(isolation.workspacePath, ".corp")),
    /ENOENT/,
  );

  assert.deepEqual(
    journal.map((event) => event.type),
    [
      "mission.created",
      "ticket.created",
      "workspace.isolation_created",
      "ticket.claimed",
      "execution.requested",
      "ticket.in_progress",
      "execution.completed",
    ],
  );
  assert.equal(journal.at(-1)?.attemptId, attemptId);
  assert.deepEqual(updatedMission.eventIds, journal.map((event) => event.eventId));
  assert.deepEqual(
    updatedTicket.eventIds,
    journal.filter((event) => event.ticketId === ticketId).map((event) => event.eventId),
  );
  assert.equal(updatedMission.resumeCursor, journal.at(-1)?.eventId);
  assert.equal(updatedMission.updatedAt, journal.at(-1)?.occurredAt);
  assert.equal(updatedTicket.updatedAt, journal.at(-1)?.occurredAt);

  assert.deepEqual(missionStatusProjection, {
    schemaVersion: 1,
    mission: updatedMission,
  });
  assert.deepEqual(ticketBoardProjection, {
    schemaVersion: 1,
    tickets: [
      {
        ticketId,
        missionId: mission.id,
        title: "Livrer le ticket runnable",
        status: "done",
        owner: "agent_dev",
        kind: "implement",
        dependsOn: [],
        allowedCapabilities: [],
        skillPackRefs: [],
        usedCapabilities: [],
        usedSkillPacks: [],
        planOrder: 0,
        runnable: false,
        blockedByTicketIds: [],
        planningState: "not_runnable_status",
        dependencyStatuses: [],
        trackingState: "done",
        statusReasonCode: "ticket_done",
        blockingReasonCode: null,
        activeAttemptId: null,
        activeAttemptStatus: null,
        lastAttemptId: attemptId,
        lastAttemptStatus: "completed",
        lastAttemptStartedAt: attempt.startedAt,
        lastAttemptEndedAt: attempt.endedAt,
        lastAttemptBackgroundRequested: false,
        lastAttemptWorkspaceIsolationId: updatedTicket.workspaceIsolationId,
        updatedAt: updatedTicket.updatedAt,
      },
    ],
  });

  assert.equal(
    await readFile(path.join(layout.projectionsDir, "approval-queue.json"), "utf8"),
    approvalQueueBefore,
  );
  assert.equal(
    await readFile(path.join(layout.projectionsDir, "artifact-index.json"), "utf8"),
    artifactIndexBefore,
  );
  assert.deepEqual(projectionWrites, [
    "mission-status",
    "ticket-board",
    "artifact-index",
    "audit-log",
    "resume-view",
    "mission-status",
    "ticket-board",
    "artifact-index",
    "audit-log",
    "resume-view",
  ]);

  const output = runResult.lines.join("\n");
  assert.match(output, new RegExp(`Tentative ouverte: ${attemptId}`));
  assert.match(output, /Tickets ouverts: aucun/);
  assert.doesNotMatch(output, /resp_foreground_123|cursor_foreground_1|vendorStatus/i);
});

test("mission ticket run foreground avec trois artefacts ne reecrit les projections qu'en fin de run puis une seule fois pour le batch artefacts", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-artifact-batch-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "completed",
        adapterState: {
          responseId: "resp_batching_123",
          pollCursor: "cursor_batching_1",
          sequenceNumber: 4,
          vendorStatus: "completed",
        },
        outputs: [
          {
            kind: "text",
            title: "Synthese run",
            label: "resume",
            mediaType: "text/plain",
            text: "Une sortie texte utile pour le diagnostic.",
            summary: "Sortie texte foreground.",
          },
          {
            kind: "structured",
            title: "Rapport run",
            label: "rapport",
            mediaType: "application/json",
            data: {
              result: "ok",
              produced: ["report.txt", "report.json"],
            },
            summary: "Sortie JSON foreground.",
          },
          {
            kind: "reference",
            title: "Pointeur diagnostic",
            label: "trace",
            mediaType: "text/plain",
            path: "logs/run.log",
            summary: "Pointeur de diagnostic foreground.",
          },
        ],
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission batching");
  const ticketCreateResult = await createTicket(rootDir, mission.id);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store") as {
    writeProjectionSnapshot: (
      projectionsDir: string,
      projectionName: string,
      snapshot: object,
    ) => Promise<string>;
  };
  const originalWriteProjectionSnapshot = projectionStoreModule.writeProjectionSnapshot;
  const projectionWrites: string[] = [];

  projectionStoreModule.writeProjectionSnapshot = async (
    ...args: Parameters<typeof originalWriteProjectionSnapshot>
  ): Promise<string> => {
    projectionWrites.push(args[1]);
    return originalWriteProjectionSnapshot(...args);
  };

  t.after(() => {
    projectionStoreModule.writeProjectionSnapshot = originalWriteProjectionSnapshot;
  });

  const runResult = await runCommand([
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
  const artifactIndexProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
  );
  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);

  assert.equal(runResult.exitCode, 0);
  assert.deepEqual(projectionWrites, [
    "mission-status",
    "ticket-board",
    "artifact-index",
    "audit-log",
    "resume-view",
    "mission-status",
    "ticket-board",
    "artifact-index",
    "audit-log",
    "resume-view",
    "mission-status",
    "ticket-board",
    "artifact-index",
    "audit-log",
    "resume-view",
  ]);
  assert.equal(
    Array.isArray((artifactIndexProjection as { artifacts?: unknown[] }).artifacts)
      ? (artifactIndexProjection as { artifacts: unknown[] }).artifacts.length
      : 0,
    3,
  );
  assert.equal(updatedMission.artifactIds.length, 3);
  assert.equal(updatedTicket.artifactIds.length, 3);
});

test("mission ticket run background normalise l'etat vendor sans fuite hors adapterState", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-background-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "requested",
        adapterState: {
          responseId: "resp_background_123",
          pollCursor: "cursor_background_1",
          sequenceNumber: 3,
          vendorStatus: "queued",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketCreateResult = await createTicket(rootDir, mission.id);
  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);

  const attemptId = String(
    runResult.lines.find((line) => line.startsWith("Tentative ouverte: "))?.slice("Tentative ouverte: ".length),
  );

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
  const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const journal = await readJournal(rootDir);
  const ticketBoardProjection = await readJson<TicketBoardProjection>(
    path.join(layout.projectionsDir, "ticket-board.json"),
  );
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(updatedMission.status, "running");
  assert.equal(updatedTicket.status, "in_progress");
  assert.equal(attempt.status, "requested");
  assert.equal(attempt.backgroundRequested, true);
  assert.deepEqual(attempt.adapterState, {
    responseId: "resp_background_123",
    pollCursor: "cursor_background_1",
    sequenceNumber: 3,
    vendorStatus: "queued",
  });
  assert.deepEqual(updatedTicket.executionHandle.adapterState, attempt.adapterState);
  assert.deepEqual(
    journal.map((event) => event.type),
    [
      "mission.created",
      "ticket.created",
      "workspace.isolation_created",
      "ticket.claimed",
      "execution.requested",
      "ticket.in_progress",
      "execution.background_started",
    ],
  );
  assert.equal(journal.at(-1)?.attemptId, attemptId);
  assert.equal(ticketBoardProjection.tickets[0]?.status, "in_progress");
  assert.equal(ticketBoardProjection.tickets[0]?.planningState, "not_runnable_status");
  assert.equal(ticketBoardProjection.tickets[0]?.trackingState, "active");
  assert.equal(ticketBoardProjection.tickets[0]?.statusReasonCode, "ticket_in_progress");
  assert.equal(ticketBoardProjection.tickets[0]?.activeAttemptId, attemptId);
  assert.equal(ticketBoardProjection.tickets[0]?.activeAttemptStatus, "requested");
  assert.match(statusResult.lines.join("\n"), /Statut: running/);
  assert.match(
    statusResult.lines.join("\n"),
    /Prochain arbitrage utile: Suivez le ticket en cours: Livrer le ticket runnable\./,
  );
  assert.doesNotMatch(JSON.stringify(updatedMission), /resp_background_123|queued/);
  assert.doesNotMatch(JSON.stringify(ticketBoardProjection), /resp_background_123|queued/);
  assert.doesNotMatch(runResult.lines.join("\n"), /resp_background_123|queued/);
});

test("mission ticket run foreground distingue une annulation adapteur d'un echec", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-cancelled-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "cancelled",
        adapterState: {
          responseId: "resp_cancelled_123",
          vendorStatus: "cancelled",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission cancelled");
  const ticketCreateResult = await createTicket(rootDir, mission.id);
  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const runResult = await runCommand([
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

  assert.equal(runResult.exitCode, 0);

  const attemptId = String(
    runResult.lines.find((line) => line.startsWith("Tentative ouverte: "))?.slice("Tentative ouverte: ".length),
  );
  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
  const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const journal = await readJournal(rootDir);
  const ticketBoardProjection = await readJson<TicketBoardProjection>(
    path.join(layout.projectionsDir, "ticket-board.json"),
  );

  assert.equal(updatedMission.status, "ready");
  assert.equal(updatedTicket.status, "cancelled");
  assert.equal(attempt.status, "cancelled");
  assert.deepEqual(
    journal.map((event) => event.type),
    [
      "mission.created",
      "ticket.created",
      "workspace.isolation_created",
      "ticket.claimed",
      "execution.requested",
      "ticket.in_progress",
      "execution.cancelled",
    ],
  );
  assert.equal(journal.at(-1)?.attemptId, attemptId);
  assert.equal(journal.at(-1)?.type, "execution.cancelled");
  assert.equal(ticketBoardProjection.tickets[0]?.status, "cancelled");
  assert.equal(ticketBoardProjection.tickets[0]?.trackingState, "cancelled");
  assert.equal(ticketBoardProjection.tickets[0]?.lastAttemptStatus, "cancelled");
  assert.equal(ticketBoardProjection.tickets[0]?.activeAttemptId, null);
});

test("mission ticket run garde la mission en running si une autre tentative reste active lors d'un echec adapteur", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-failed-with-active-peer-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async ({ background }) => {
        if (background) {
          return {
            status: "running",
            adapterState: {
              responseId: "resp_other_active",
              pollCursor: "cursor_other_active",
              vendorStatus: "in_progress",
            },
          };
        }

        throw new Error("adapter boom");
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission active peer");
  const firstTicketCreateResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket deja actif",
  ]);
  const secondTicketCreateResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket qui echoue",
    "--owner",
    "agent_second",
  ]);

  assert.equal(firstTicketCreateResult.exitCode, 0);
  assert.equal(secondTicketCreateResult.exitCode, 0);

  const firstTicketId = String(
    firstTicketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const secondTicketId = String(
    secondTicketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const firstRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    firstTicketId,
    "--background",
  ]);
  assert.equal(firstRun.exitCode, 0);

  const secondRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    secondTicketId,
  ]);

  assert.equal(secondRun.exitCode, 1);
  assert.equal(secondRun.lines.at(-1), "adapter boom");

  const updatedMission = await readMission(rootDir, mission.id);
  const activeTicket = await readTicket(rootDir, mission.id, firstTicketId);
  const failedTicket = await readTicket(rootDir, mission.id, secondTicketId);
  const secondTicketAttemptsDir = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    secondTicketId,
    "attempts",
  );
  const failedAttemptIds = await readdir(secondTicketAttemptsDir);
  const failedAttemptId = failedAttemptIds[0];
  assert.ok(failedAttemptId, "une tentative failed doit etre persistee");
  const failedAttempt = await readAttempt(rootDir, mission.id, secondTicketId, failedAttemptId);
  const journal = await readJournal(rootDir);
  const ticketBoardProjection = await readJson<TicketBoardProjection>(
    path.join(layout.projectionsDir, "ticket-board.json"),
  );

  assert.equal(updatedMission.status, "running");
  assert.equal(activeTicket.status, "in_progress");
  assert.equal(failedTicket.status, "failed");
  assert.equal(failedAttempt.status, "failed");
  assert.equal(journal.at(-1)?.type, "execution.failed");
  assert.equal((journal.at(-1)?.payload as { mission?: Mission }).mission?.status, "running");
  assert.equal(
    ticketBoardProjection.tickets.find((entry) => entry.ticketId === firstTicketId)?.activeAttemptStatus,
    "running",
  );
  assert.equal(
    ticketBoardProjection.tickets.find((entry) => entry.ticketId === secondTicketId)?.trackingState,
    "failed",
  );
});

test("mission ticket run execute deux tentatives concurrentes et garde la mission running quand l'une echoue tandis que l'autre reste active", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-concurrent-failure-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  // L'adapter simule deux attempts concurrents : le premier reste "running" en arriere-plan
  // (pour maintenir une tentative active sur la mission), le second echoue avec une erreur
  // adapteur. Le catch de runTicket doit utiliser `latestMission.ticketIds` afin de
  // detecter la tentative active du premier ticket meme si `mission.ticketIds` initial
  // ne contenait qu'une sous-liste au moment du fetch top-level.
  let launchCount = 0;
  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async ({ background }) => {
        launchCount += 1;
        if (background) {
          return {
            status: "running",
            adapterState: {
              responseId: `resp_concurrent_${launchCount}`,
              pollCursor: `cursor_concurrent_${launchCount}`,
              vendorStatus: "in_progress",
            },
          };
        }
        throw new Error("adapter boom concurrent");
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission concurrent runs");
  const firstTicketResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket background actif",
  ]);
  const secondTicketResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket qui echoue",
    "--owner",
    "agent_second",
  ]);

  assert.equal(firstTicketResult.exitCode, 0);
  assert.equal(secondTicketResult.exitCode, 0);

  const firstTicketId = String(
    firstTicketResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const secondTicketId = String(
    secondTicketResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  // Runs sequentiels : d'abord le background, puis le foreground qui echoue.
  // Le test exerce le chemin catch restructure avec `latestMission` au scope externe.
  const firstRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    firstTicketId,
    "--background",
  ]);
  assert.equal(firstRun.exitCode, 0);

  const concurrentTicketId = "ticket_concurrent_active";
  const originalFindById = FileMissionRepository.prototype.findById;
  let missionReadsDuringSecondRun = 0;
  let injectedConcurrentTicket = false;

  FileMissionRepository.prototype.findById = async function patchedFindById(
    missionId: string,
  ): Promise<Mission | null> {
    const foundMission = await originalFindById.call(this, missionId);

    if (missionId === mission.id) {
      missionReadsDuringSecondRun += 1;

      if (
        missionReadsDuringSecondRun === 2
        && foundMission
        && !injectedConcurrentTicket
      ) {
        injectedConcurrentTicket = true;
        await injectActiveTicketSnapshot(rootDir, foundMission, concurrentTicketId);
        return await originalFindById.call(this, missionId);
      }
    }

    return foundMission;
  };

  t.after(() => {
    FileMissionRepository.prototype.findById = originalFindById;
  });

  const secondRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    secondTicketId,
  ]);
  assert.equal(secondRun.exitCode, 1);
  assert.equal(secondRun.lines.at(-1), "adapter boom concurrent");

  // Verifie que le catch (chemin fixe par AC4) a bien consulte les tickets actifs
  // via `latestMission.ticketIds` et non via un snapshot obsolete : la mission doit
  // rester "running" car le ticket 1 est actif, meme apres l'echec du ticket 2.
  const updatedMission = await readMission(rootDir, mission.id);
  assert.equal(updatedMission.status, "running");
  assert.deepEqual(
    updatedMission.ticketIds.sort(),
    [firstTicketId, secondTicketId, concurrentTicketId].sort(),
  );
  const failedTicket = await readTicket(rootDir, mission.id, secondTicketId);
  assert.equal(failedTicket.status, "failed");
  const activeTicket = await readTicket(rootDir, mission.id, firstTicketId);
  assert.equal(activeTicket.status, "in_progress");
});

test("mission ticket run autorise la relance d'un ticket failed quand la mission est en echec", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-retry-failed-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  let launchCount = 0;

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => {
        launchCount += 1;

        if (launchCount === 1) {
          throw new Error("adapter boom");
        }

        return {
          status: "completed",
          adapterState: {
            responseId: "resp_retry_failed_ok",
            pollCursor: "cursor_retry_failed_ok",
            vendorStatus: "completed",
          },
        };
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission retry failed");
  const ticketCreateResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket a relancer",
    "--owner",
    "agent_retry",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const firstRun = await runCommand([
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

  assert.equal(firstRun.exitCode, 1);
  assert.equal(firstRun.lines.at(-1), "adapter boom");

  const failedMission = await readMission(rootDir, mission.id);
  const failedTicket = await readTicket(rootDir, mission.id, ticketId);
  const boardAfterFailure = await readJson<TicketBoardProjection>(
    path.join(layout.projectionsDir, "ticket-board.json"),
  );

  assert.equal(failedMission.status, "failed");
  assert.equal(failedTicket.status, "failed");
  assert.equal(boardAfterFailure.tickets[0]?.ticketId, ticketId);
  assert.equal(boardAfterFailure.tickets[0]?.trackingState, "failed");
  assert.equal(boardAfterFailure.tickets[0]?.planningState, "runnable");
  assert.equal(boardAfterFailure.tickets[0]?.runnable, true);

  const secondRun = await runCommand([
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

  assert.equal(secondRun.exitCode, 0);

  const secondAttemptLine = secondRun.lines.find((line) => line.startsWith("Tentative ouverte: "));
  assert.ok(secondAttemptLine, "la relance doit ouvrir une nouvelle tentative");

  const retriedMission = await readMission(rootDir, mission.id);
  const retriedTicket = await readTicket(rootDir, mission.id, ticketId);
  const retriedAttempt = await readAttempt(
    rootDir,
    mission.id,
    ticketId,
    secondAttemptLine.slice("Tentative ouverte: ".length),
  );
  const attemptsDir = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    ticketId,
    "attempts",
  );
  const boardAfterRetry = await readJson<TicketBoardProjection>(
    path.join(layout.projectionsDir, "ticket-board.json"),
  );

  assert.equal(launchCount, 2);
  assert.equal((await readdir(attemptsDir)).length, 2);
  assert.equal(retriedMission.status, "ready");
  assert.equal(retriedTicket.status, "done");
  assert.equal(retriedAttempt.status, "completed");
  assert.equal(boardAfterRetry.tickets[0]?.status, "done");
  assert.equal(boardAfterRetry.tickets[0]?.runnable, false);
});

test("mission ticket run foreground detecte et enregistre les artefacts du workspace avant de propager l'erreur adapteur originale", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-throw-artifacts-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await writeFile(path.join(rootDir, "README.md"), "README initial\n", "utf8");

  const mission = await createMission(rootDir, "Mission artefacts sur throw");
  const ticketCreateResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket qui produit puis throw",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async ({ workspacePath }) => {
        await writeFile(path.join(workspacePath, "README.md"), "README crash\n", "utf8");
        throw new Error("adapter boom");
      },
    }),
  });

  const runResult = await runCommand([
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

  assert.equal(runResult.exitCode, 1);
  assert.equal(runResult.lines.at(-1), "adapter boom");

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
  const journal = await readJournal(rootDir);
  const artifactIndexProjection = await readJson<{
    artifacts: Array<{
      kind: string;
      path?: string;
      sourceEventType?: string;
    }>;
  }>(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
  );

  assert.equal(updatedMission.status, "failed");
  assert.equal(updatedTicket.status, "failed");
  assert.equal(updatedMission.artifactIds.length, 1);
  assert.deepEqual(updatedMission.artifactIds, updatedTicket.artifactIds);
  assert.equal(updatedMission.resumeCursor, journal.at(-1)?.eventId);
  assert.equal(updatedTicket.eventIds.at(-1), journal.at(-1)?.eventId);
  assert.deepEqual(
    journal.slice(-3).map((event) => event.type),
    ["execution.failed", "artifact.detected", "artifact.registered"],
  );
  assert.equal(journal.at(-1)?.type, "artifact.registered");
  assert.equal(artifactIndexProjection.artifacts.length, 1);
  assert.deepEqual(
    artifactIndexProjection.artifacts.map((artifact) => ({
      kind: artifact.kind,
      path: artifact.path,
      sourceEventType: artifact.sourceEventType,
    })),
    [
      {
        kind: "workspace_file",
        path: "README.md",
        sourceEventType: "execution.failed",
      },
    ],
  );

  // AC7 (Story 5.1.1) : apres retrait de skipProjectionRewrite dans le catch,
  // audit-log.json et resume-view.json doivent refleter execution.failed ET
  // artifact.registered au moment du rethrow. Auparavant seule artifact-index
  // etait a jour car les autres projections restaient figees sur execution.failed.
  const auditLogProjection = await readJson<{
    entries: Array<{ eventId: string; kind: string }>;
  }>(path.join(rootDir, ".corp", "projections", "audit-log.json"));
  const resumeViewProjection = await readJson<{
    schemaVersion: 1;
    resume: { lastEventId?: string } | null;
  }>(path.join(rootDir, ".corp", "projections", "resume-view.json"));
  const auditEventIds = auditLogProjection.entries.map((entry) => entry.eventId);
  const artifactRegisteredEvent = journal.at(-1);

  assert.ok(artifactRegisteredEvent);
  assert.equal(
    auditEventIds.includes(artifactRegisteredEvent.eventId),
    true,
    "audit-log doit contenir l'event artifact.registered apres rewrite post-catch.",
  );
  assert.equal(
    resumeViewProjection.resume?.lastEventId,
    artifactRegisteredEvent.eventId,
    "resume-view doit pointer sur artifact.registered apres rewrite post-catch.",
  );
});

test("mission ticket run background ne declenche pas la detection d'artefacts avant completion terminale", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-background-artifacts-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const artifactServiceModule = require("../../packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts") as {
    detectTicketArtifacts: typeof import("../../packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts").detectTicketArtifacts;
  };
  const originalDetectTicketArtifacts = artifactServiceModule.detectTicketArtifacts;
  let detectCalls = 0;

  artifactServiceModule.detectTicketArtifacts = async (
    ...args: Parameters<typeof originalDetectTicketArtifacts>
  ): Promise<Awaited<ReturnType<typeof originalDetectTicketArtifacts>>> => {
    detectCalls += 1;
    return originalDetectTicketArtifacts(...args);
  };

  t.after(() => {
    artifactServiceModule.detectTicketArtifacts = originalDetectTicketArtifacts;
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "requested",
        adapterState: {
          responseId: "resp_background_no_artifacts",
          pollCursor: "cursor_background_no_artifacts",
          vendorStatus: "queued",
        },
        outputs: [
          {
            kind: "text",
            title: "Sortie qui ne doit pas etre scannee",
            text: "Le polling terminal decidera plus tard.",
            mediaType: "text/plain",
          },
        ],
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission background artifacts");
  const ticketCreateResult = await createTicket(rootDir, mission.id);
  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const artifactIndexBefore = await readFile(
    path.join(layout.projectionsDir, "artifact-index.json"),
    "utf8",
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);
  assert.equal(detectCalls, 0);
  assert.equal(
    await readFile(path.join(layout.projectionsDir, "artifact-index.json"), "utf8"),
    artifactIndexBefore,
  );
});

test("mission ticket run refuse une seconde execution tant qu'une tentative active existe deja", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-active-guard-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "running",
        adapterState: {
          responseId: "resp_active_guard",
          pollCursor: "cursor_active_guard",
          vendorStatus: "in_progress",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);
  const ticketCreateResult = await createTicket(rootDir, mission.id);
  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const firstRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(firstRun.exitCode, 0);

  const journalBefore = await readFile(layout.journalPath, "utf8");
  const attemptsDir = path.join(
    rootDir,
    ".corp",
    "missions",
    mission.id,
    "tickets",
    ticketId,
    "attempts",
  );
  const attemptsBefore = await readdir(attemptsDir);
  const missionBefore = await readMission(rootDir, mission.id);
  const ticketBefore = await readTicket(rootDir, mission.id, ticketId);

  const secondRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(secondRun.exitCode, 1);
  assert.equal(
    secondRun.lines.at(-1),
    `Une tentative active existe deja pour le ticket \`${ticketId}\`.`,
  );
  assert.equal(await readFile(path.join(layout.journalPath), "utf8"), journalBefore);
  assert.deepEqual(await readdir(attemptsDir), attemptsBefore);
  assert.deepEqual(await readMission(rootDir, mission.id), missionBefore);
  assert.deepEqual(await readTicket(rootDir, mission.id, ticketId), ticketBefore);
});

test("mission ticket run relit le ticket juste avant adapter.launch et bloque une mutation concurrente non autorisee", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-reread-ticket-"));
  let launchCount = 0;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => {
        launchCount += 1;
        return {
          status: "completed",
          adapterState: {},
        };
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission reread ticket");
  const ticketCreateResult = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "fs.read",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const originalFindById = FileMissionRepository.prototype.findById;
  let missionReads = 0;

  FileMissionRepository.prototype.findById = async function patchedFindById(
    missionId: string,
  ): Promise<Mission | null> {
    const foundMission = await originalFindById.call(this, missionId);

    if (missionId === mission.id) {
      missionReads += 1;

      if (missionReads === 2) {
        const ticket = await readTicket(rootDir, mission.id, ticketId);
        const ticketPath = path.join(
          rootDir,
          ".corp",
          "missions",
          mission.id,
          "tickets",
          ticketId,
          "ticket.json",
        );

        await writeFile(
          ticketPath,
          `${JSON.stringify({
            ...ticket,
            allowedCapabilities: [...ticket.allowedCapabilities, "shell.exec"],
            updatedAt: new Date().toISOString(),
          }, null, 2)}\n`,
          "utf8",
        );
      }
    }

    return foundMission;
  };

  t.after(() => {
    FileMissionRepository.prototype.findById = originalFindById;
  });

  const runResult = await runCommand([
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

  assert.equal(runResult.exitCode, 1);
  assert.equal(launchCount, 0);
  assert.match(runResult.lines.at(-1) ?? "", /conflit d'ecriture concurrente.*ticket/i);
});

test("mission ticket run refuse un ticket non runnable sans muter journal, projections, snapshots ni isolations", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-non-runnable-"));
  const layout = resolveWorkspaceLayout(rootDir);

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "completed",
        adapterState: {
          responseId: "resp_should_not_run",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);

  const prerequisiteResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Prerequis non termine",
    "--owner",
    "agent_pre",
  ]);
  const prerequisiteTicketId = String(
    prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const dependentResult = await createTicket(rootDir, mission.id, [
    "--goal",
    "Ticket dependant",
    "--owner",
    "agent_dep",
    "--depends-on",
    prerequisiteTicketId,
  ]);

  assert.equal(prerequisiteResult.exitCode, 0);
  assert.equal(dependentResult.exitCode, 0);

  const dependentTicketId = String(
    dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const journalBefore = await readFile(layout.journalPath, "utf8");
  const missionBefore = await readMission(rootDir, mission.id);
  const ticketBefore = await readTicket(rootDir, mission.id, dependentTicketId);
  const ticketBoardBefore = await readFile(
    path.join(layout.projectionsDir, "ticket-board.json"),
    "utf8",
  );
  const missionStatusBefore = await readFile(
    path.join(layout.projectionsDir, "mission-status.json"),
    "utf8",
  );
  const approvalQueueBefore = await readFile(
    path.join(layout.projectionsDir, "approval-queue.json"),
    "utf8",
  );
  const artifactIndexBefore = await readFile(
    path.join(layout.projectionsDir, "artifact-index.json"),
    "utf8",
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    dependentTicketId,
  ]);

  assert.equal(runResult.exitCode, 1);
  assert.equal(
    runResult.lines.at(-1),
    `Le ticket \`${dependentTicketId}\` n'est pas runnable: dependances non resolues.`,
  );
  assert.equal(await readFile(layout.journalPath, "utf8"), journalBefore);
  assert.deepEqual(await readMission(rootDir, mission.id), missionBefore);
  assert.deepEqual(await readTicket(rootDir, mission.id, dependentTicketId), ticketBefore);
  assert.equal(
    await readFile(path.join(layout.projectionsDir, "ticket-board.json"), "utf8"),
    ticketBoardBefore,
  );
  assert.equal(
    await readFile(path.join(layout.projectionsDir, "mission-status.json"), "utf8"),
    missionStatusBefore,
  );
  assert.equal(
    await readFile(path.join(layout.projectionsDir, "approval-queue.json"), "utf8"),
    approvalQueueBefore,
  );
  assert.equal(
    await readFile(path.join(layout.projectionsDir, "artifact-index.json"), "utf8"),
    artifactIndexBefore,
  );
  assert.deepEqual(await readdir(layout.isolationsDir), []);
});

test("resolvePreferredIsolationKind prefere le worktree git seulement pour un workspace git exploitable", async () => {
  const gitCommands = async (args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
    if (args.includes("--show-toplevel")) {
      return {
        exitCode: 0,
        stdout: "C:/workspace/git-root\n",
        stderr: "",
      };
    }

    if (args.includes("--verify")) {
      return {
        exitCode: 0,
        stdout: "abc123\n",
        stderr: "",
      };
    }

    return {
      exitCode: 1,
      stdout: "",
      stderr: "unsupported",
    };
  };

  assert.equal(
    await resolvePreferredIsolationKind("C:/workspace/git-root", { runGitCommand: gitCommands }),
    "git_worktree",
  );
  assert.equal(
    await resolvePreferredIsolationKind("C:/workspace/non-git", {
      runGitCommand: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "fatal",
      }),
    }),
    "workspace_copy",
  );
  assert.equal(
    await resolvePreferredIsolationKind("C:/workspace/subdir", { runGitCommand: gitCommands }),
    "workspace_copy",
  );

  if (process.platform === "win32") {
    assert.equal(
      await resolvePreferredIsolationKind("C:/workspace/git-root", {
        runGitCommand: async (args: string[]) => {
          if (args.includes("--show-toplevel")) {
            return {
              exitCode: 0,
              stdout: "/c/workspace/git-root\n",
              stderr: "",
            };
          }

          if (args.includes("--verify")) {
            return {
              exitCode: 0,
              stdout: "abc123\n",
              stderr: "",
            };
          }

          return {
            exitCode: 1,
            stdout: "",
            stderr: "unsupported",
          };
        },
      }),
      "git_worktree",
    );
  }
});

test("createCodexResponsesAdapterFromEnvironment applique un timeout AbortController configurable", async () => {
  const adapter = createCodexResponsesAdapterFromEnvironment(
    {
      OPENAI_API_KEY: "sk-test",
      CORP_CODEX_RESPONSES_TIMEOUT_MS: "1",
    },
    {
      model: "gpt-5-codex",
      fetchImpl: async (_input, init) => {
        const signal = init?.signal;

        if (!signal) {
          throw new Error("signal missing");
        }

        return await new Promise<Response>((_resolve, reject) => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          signal.addEventListener("abort", () => reject(abortError), { once: true });
        });
      },
    },
  );

  const now = "2026-04-10T00:00:00.000Z";
  const mission: Mission = {
    id: "mission_timeout",
    title: "Mission timeout",
    objective: "Verifier le timeout adapteur",
    status: "running",
    successCriteria: ["Le timeout est remonte proprement"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: ["ticket_timeout"],
    artifactIds: [],
    eventIds: ["event_timeout"],
    resumeCursor: "event_timeout",
    createdAt: now,
    updatedAt: now,
  };
  const ticket: Ticket = {
    id: "ticket_timeout",
    missionId: mission.id,
    kind: "implement",
    goal: "Verifier le timeout adapteur",
    status: "claimed",
    owner: "agent_timeout",
    dependsOn: [],
    successCriteria: ["Un timeout clair est emis"],
    allowedCapabilities: [],
    skillPackRefs: [],
    workspaceIsolationId: "iso_timeout",
    executionHandle: {
      adapter: "codex_responses",
      adapterState: {},
    },
    artifactIds: [],
    eventIds: ["event_timeout"],
    createdAt: now,
    updatedAt: now,
  };

  await assert.rejects(
    adapter.launch({
      mission,
      ticket,
      attemptId: "attempt_timeout",
      workspacePath: "C:/workspace/timeout",
      background: false,
      resolvedSkillPacks: [],
    }),
    /timed out after 1ms/i,
  );
});
