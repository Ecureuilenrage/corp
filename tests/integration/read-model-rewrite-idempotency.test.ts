import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import type { ApprovalQueueProjection } from "../../packages/journal/src/projections/approval-queue-projection";
import type { TicketBoardProjection } from "../../packages/journal/src/projections/ticket-board-projection";
import { FileMissionRepository } from "../../packages/storage/src/repositories/file-mission-repository";
import { FileTicketRepository } from "../../packages/storage/src/repositories/file-ticket-repository";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";

interface CommandResult {
  exitCode: number;
  lines: string[];
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

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string): Promise<string> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission rewrite",
    "--objective",
    "Verifier la reconstruction centralisee",
    "--success-criterion",
    "Les read-models sont idempotents",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const missionLine = result.lines.find((line) => line.startsWith("Mission creee: "));
  assert.ok(missionLine);

  return missionLine.slice("Mission creee: ".length);
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
    "Verifier la reconstruction d'un ticket",
    "--owner",
    "agent_recovery",
    "--success-criterion",
    "Le ticket est reconstructible",
    "--allow-capability",
    "fs.read",
  ]);

  assert.equal(result.exitCode, 0);

  const ticketLine = result.lines.find((line) => line.startsWith("Ticket cree: "));
  assert.ok(ticketLine);

  return ticketLine.slice("Ticket cree: ".length);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function removeProjectionFiles(rootDir: string, projectionNames: string[]): Promise<void> {
  await Promise.all(
    projectionNames.map((projectionName) =>
      rm(path.join(rootDir, ".corp", "projections", `${projectionName}.json`), {
        force: true,
      })
    ),
  );
}

async function readJournalEvents(rootDir: string): Promise<Array<{
  type: string;
  missionId: string;
}>> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; missionId: string });
}

function patchProjectionWrites(t: test.TestContext): string[] {
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

  return projectionWrites;
}

function assertCoreReadModelsWereRewritten(projectionWrites: string[]): void {
  for (const projectionName of [
    "mission-status",
    "ticket-board",
    "artifact-index",
    "audit-log",
    "resume-view",
  ]) {
    assert.ok(
      projectionWrites.includes(projectionName),
      `projection attendue manquante: ${projectionName}`,
    );
  }
}

test("mission create declenche la reconstruction centralisee des read-models apres persist", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-rewrite-read-models-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const projectionWrites = patchProjectionWrites(t);

  await createMission(rootDir);

  assertCoreReadModelsWereRewritten(projectionWrites);
});

test("mission lifecycle declenche la reconstruction centralisee des read-models apres persist", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-lifecycle-rewrite-read-models-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const projectionWrites = patchProjectionWrites(t);
  const result = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assertCoreReadModelsWereRewritten(projectionWrites);
});

test("mission resume reconstruit les read-models mission et ticket apres perte post-persist", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-resume-crash-recovery-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  await removeProjectionFiles(rootDir, [
    "resume-view",
    "ticket-board",
    "approval-queue",
    "artifact-index",
  ]);

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);

  const ticketBoard = await readJson<TicketBoardProjection>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );

  assert.ok(ticketBoard.tickets.some((ticket) => ticket.ticketId === ticketId));
});

test("approval queue reconstruit une ApprovalRequest apres perte des read-models", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-crash-recovery-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_crash_recovery",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation crash recovery",
          actionType: "workspace_write",
          actionSummary: "Verifier la reconstruction de la queue",
          guardrails: ["manual_review: workspace_write"],
        },
      }),
    }),
  });

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

  await removeProjectionFiles(rootDir, ["approval-queue", "resume-view"]);

  const queueResult = await runCommand([
    "mission",
    "approval",
    "queue",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(queueResult.exitCode, 0);

  const approvalQueue = await readJson<ApprovalQueueProjection>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );

  assert.equal(approvalQueue.approvals.length, 1);
  assert.equal(approvalQueue.approvals[0]?.ticketId, ticketId);
  assert.equal(approvalQueue.approvals[0]?.status, "requested");
});

test("mission resume reconstruit une mission creee si le crash survient apres appendEvent avant save", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-append-crash-recovery-"));
  const originalSave = FileMissionRepository.prototype.save;
  let shouldCrashAfterAppend = true;

  t.after(async () => {
    FileMissionRepository.prototype.save = originalSave;
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  FileMissionRepository.prototype.save = async function patchedSave(...args) {
    if (shouldCrashAfterAppend) {
      shouldCrashAfterAppend = false;
      throw new Error("crash simule apres appendEvent");
    }

    return originalSave.apply(this, args);
  };

  const createResult = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission crash append",
    "--objective",
    "Reconstruire sans snapshot mission",
    "--success-criterion",
    "Le journal suffit",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 1);
  assert.equal(createResult.lines.at(-1), "crash simule apres appendEvent");

  const missionCreatedEvent = (await readJournalEvents(rootDir))
    .find((event) => event.type === "mission.created");

  assert.ok(missionCreatedEvent);

  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionCreatedEvent.missionId,
  ]);

  assert.equal(resumeResult.exitCode, 0);
  assert.match(resumeResult.lines.join("\n"), /Mission crash append/);
});

test("mission resume reconstruit une mission pausee si le crash survient apres appendEvent avant save", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-lifecycle-append-crash-recovery-"));
  const originalSave = FileMissionRepository.prototype.save;
  let shouldCrashAfterAppend = false;

  t.after(async () => {
    FileMissionRepository.prototype.save = originalSave;
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);

  FileMissionRepository.prototype.save = async function patchedSave(...args) {
    if (shouldCrashAfterAppend) {
      shouldCrashAfterAppend = false;
      throw new Error("crash simule apres appendEvent pause");
    }

    return originalSave.apply(this, args);
  };

  shouldCrashAfterAppend = true;
  const pauseResult = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(pauseResult.exitCode, 1);
  assert.equal(pauseResult.lines.at(-1), "crash simule apres appendEvent pause");

  const pausedEvent = (await readJournalEvents(rootDir)).find(
    (event) => event.type === "mission.paused",
  );
  assert.ok(pausedEvent);

  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(resumeResult.exitCode, 0);
  assert.match(
    resumeResult.lines.join("\n"),
    /blocked/i,
    "La reconstruction doit exposer le statut pause (blocked) meme sans snapshot mission.json a jour.",
  );
});

test("ticket board reconstruit un ticket en execution si le crash survient apres appendEvent avant save", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-append-crash-recovery-"));
  const originalSave = FileTicketRepository.prototype.save;
  let runTicketSaveCount = 0;
  const crashOnExecutionRequestedSave = 3;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    FileTicketRepository.prototype.save = originalSave;
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "completed",
        adapterState: { responseId: "resp_run_crash", vendorStatus: "completed" },
      }),
    }),
  });

  FileTicketRepository.prototype.save = async function patchedTicketSave(...args) {
    runTicketSaveCount += 1;

    if (runTicketSaveCount === crashOnExecutionRequestedSave) {
      throw new Error("crash simule apres appendEvent run");
    }

    return originalSave.apply(this, args);
  };

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

  assert.equal(runResult.exitCode, 1);
  assert.equal(runResult.lines.at(-1), "crash simule apres appendEvent run");

  const journalEventTypes = (await readJournalEvents(rootDir)).map((event) => event.type);
  assert.ok(
    journalEventTypes.includes("execution.requested"),
    `Le journal doit contenir un event d'execution (${journalEventTypes.join(", ")}).`,
  );

  await removeProjectionFiles(rootDir, ["ticket-board", "resume-view"]);

  const boardResult = await runCommand([
    "mission",
    "ticket",
    "board",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(boardResult.exitCode, 0);

  const ticketBoard = await readJson<TicketBoardProjection>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );

  const reconstructedTicket = ticketBoard.tickets.find((ticket) => ticket.ticketId === ticketId);
  assert.ok(reconstructedTicket, "Le ticket reconstruit doit apparaitre dans la projection ticket-board.");
  assert.equal(reconstructedTicket.status, "claimed");
  assert.equal(reconstructedTicket.trackingState, "active");
  assert.equal(reconstructedTicket.activeAttemptStatus, "requested");
});

test("approval queue reconstruit la transition si le crash survient apres appendEvent avant save", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-transition-append-crash-recovery-"));
  const originalSave = FileMissionRepository.prototype.save;
  let shouldCrashAfterAppend = false;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    FileMissionRepository.prototype.save = originalSave;
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const missionId = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, missionId);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_approval_transition_crash",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation crash recovery transition",
          actionType: "workspace_write",
          actionSummary: "Reconstruire apres crash approval resolve",
          guardrails: ["manual_review: workspace_write"],
        },
      }),
    }),
  });

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

  const approvalQueueBeforeCrash = await readJson<ApprovalQueueProjection>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );
  const approvalId = approvalQueueBeforeCrash.approvals[0]?.approvalId;
  assert.ok(approvalId);

  FileMissionRepository.prototype.save = async function patchedMissionSave(...args) {
    if (shouldCrashAfterAppend) {
      shouldCrashAfterAppend = false;
      throw new Error("crash simule apres appendEvent approval");
    }

    return originalSave.apply(this, args);
  };

  shouldCrashAfterAppend = true;
  const approveResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--approval-id",
    approvalId,
  ]);

  assert.equal(approveResult.exitCode, 1);
  assert.equal(approveResult.lines.at(-1), "crash simule apres appendEvent approval");

  const approvalEvent = (await readJournalEvents(rootDir)).find(
    (event) => event.type === "approval.approved",
  );
  assert.ok(approvalEvent, "Le journal doit contenir l'event approval.approved.");

  await removeProjectionFiles(rootDir, ["approval-queue", "resume-view", "ticket-board"]);

  const queueResult = await runCommand([
    "mission",
    "approval",
    "queue",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(queueResult.exitCode, 0);

  const approvalQueueAfter = await readJson<ApprovalQueueProjection>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );

  assert.equal(
    approvalQueueAfter.approvals.length,
    0,
    "La queue reconstruite depuis le journal ne doit plus contenir d'approval requested apres la transition.",
  );
});
