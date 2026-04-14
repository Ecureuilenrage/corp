import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import { readMissionCompare } from "../../packages/mission-kernel/src/resume-service/read-mission-compare";
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

interface MissionSnapshot {
  id: string;
  status: string;
  ticketIds: string[];
  eventIds: string[];
  updatedAt: string;
}

interface TicketSnapshot {
  id: string;
  missionId: string;
  status: string;
  dependsOn: string[];
  eventIds: string[];
  updatedAt: string;
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

async function createMission(rootDir: string, title = "Mission compare"): Promise<MissionSnapshot> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Comparer l'etat observe a l'objectif courant",
    "--success-criterion",
    "Le diagnostic reste explicable",
    "--success-criterion",
    "Seule la branche impactee est relancee",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const missionLine = result.lines.find((line) => line.startsWith("Mission creee: "));
  assert.ok(missionLine, "la creation doit retourner un missionId");

  return readMission(rootDir, missionLine.slice("Mission creee: ".length));
}

async function createTicket(
  rootDir: string,
  missionId: string,
  input: {
    goal: string;
    owner: string;
    dependsOn?: string[];
  },
): Promise<string> {
  const args = [
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
    input.goal,
    "--owner",
    input.owner,
    "--success-criterion",
    "Le ticket existe",
  ];

  for (const dependencyId of input.dependsOn ?? []) {
    args.push("--depends-on", dependencyId);
  }

  const result = await runCommand(args);
  assert.equal(result.exitCode, 0);

  const ticketLine = result.lines.find((line) => line.startsWith("Ticket cree: "));
  assert.ok(ticketLine, "la creation doit retourner un ticketId");

  return ticketLine.slice("Ticket cree: ".length);
}

async function readMission(rootDir: string, missionId: string): Promise<MissionSnapshot> {
  return readJson<MissionSnapshot>(
    path.join(rootDir, ".corp", "missions", missionId, "mission.json"),
  );
}

async function readTicket(
  rootDir: string,
  missionId: string,
  ticketId: string,
): Promise<TicketSnapshot> {
  return readJson<TicketSnapshot>(
    path.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"),
  );
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

async function listAttemptIds(
  rootDir: string,
  missionId: string,
  ticketId: string,
): Promise<string[]> {
  const attemptsDir = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "attempts",
  );

  try {
    return await readdir(attemptsDir);
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

test("mission compare derive un diagnostic failed deterministe et reste read-only", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-compare-failed-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => {
        throw new Error("adapter boom");
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission compare failed");
  const rootTicketId = await createTicket(rootDir, mission.id, {
    goal: "Corriger la branche impactee",
    owner: "agent_root",
  });
  const descendantTicketId = await createTicket(rootDir, mission.id, {
    goal: "Publier apres correction",
    owner: "agent_publish",
    dependsOn: [rootTicketId],
  });
  const unaffectedTicketId = await createTicket(rootDir, mission.id, {
    goal: "Documenter sans dependance",
    owner: "agent_docs",
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
    rootTicketId,
  ]);

  assert.equal(runResult.exitCode, 1);
  assert.equal(runResult.lines.at(-1), "adapter boom");

  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const journalBeforeCompare = await readFile(journalPath, "utf8");
  const compareResult = await readMissionCompare({
    rootDir,
    missionId: mission.id,
  });
  const compareCommand = await runCommand([
    "mission",
    "compare",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const compareOutput = compareCommand.lines.join("\n");

  assert.equal(compareResult.compare.observed.missionStatus, "failed");
  assert.equal(compareResult.compare.observed.pendingApprovalCount, 0);
  assert.deepEqual(compareResult.compare.observed.openTicketIds, [
    descendantTicketId,
    unaffectedTicketId,
  ]);
  assert.equal(compareResult.compare.impactedBranch.rootTicketId, rootTicketId);
  assert.deepEqual(compareResult.compare.impactedBranch.impactedTicketIds, [
    rootTicketId,
    descendantTicketId,
  ]);
  assert.equal(compareResult.compare.impactedBranch.relaunchable, true);
  assert.equal(compareResult.compare.operatorValidationRequired, false);
  assert.match(JSON.stringify(compareResult.compare.gaps), new RegExp(rootTicketId));
  assert.doesNotMatch(
    JSON.stringify(compareResult.compare),
    /responseId|pollCursor|vendorStatus|threadId|requires_action/i,
  );

  assert.equal(compareCommand.exitCode, 0);
  assert.match(compareOutput, /Attendu:/);
  assert.match(compareOutput, /Observe:/);
  assert.match(compareOutput, /Ecarts:/);
  assert.match(compareOutput, /Branche impactee:/);
  assert.match(compareOutput, new RegExp(`Racine: ${rootTicketId} \\| relaunchable=oui`));
  assert.match(compareOutput, new RegExp(`Descendants impactes: ${descendantTicketId}`));
  assert.match(compareOutput, new RegExp(`Tickets non impactes: ${unaffectedTicketId}`));
  assert.doesNotMatch(compareOutput, /responseId|pollCursor|vendorStatus|requires_action/i);
  assert.equal(await readFile(journalPath, "utf8"), journalBeforeCompare);
});

test("mission compare reconstruit ticket-board et resume-view corrompus sans muter le journal", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-compare-rebuild-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => {
        throw new Error("adapter boom");
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission compare rebuild");
  const rootTicketId = await createTicket(rootDir, mission.id, {
    goal: "Racine a faire echouer",
    owner: "agent_root",
  });
  await createTicket(rootDir, mission.id, {
    goal: "Descendant impacte",
    owner: "agent_dep",
    dependsOn: [rootTicketId],
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
    rootTicketId,
  ]);

  assert.equal(runResult.exitCode, 1);

  const ticketBoardPath = path.join(rootDir, ".corp", "projections", "ticket-board.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const journalBeforeCompare = await readFile(journalPath, "utf8");

  await writeFile(ticketBoardPath, "{corrupted", "utf8");
  await writeFile(resumeViewPath, "{corrupted", "utf8");

  const compareResult = await readMissionCompare({
    rootDir,
    missionId: mission.id,
  });
  const compareCommand = await runCommand([
    "mission",
    "compare",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(compareResult.reconstructed, true);
  assert.equal(compareResult.compare.impactedBranch.rootTicketId, rootTicketId);
  assert.equal(compareCommand.exitCode, 0);
  assert.deepEqual(
    Object.keys(await readJson<Record<string, unknown>>(ticketBoardPath)),
    ["schemaVersion", "tickets"],
  );
  assert.deepEqual(
    Object.keys(await readJson<Record<string, unknown>>(resumeViewPath)),
    ["schemaVersion", "resume"],
  );
  assert.equal(await readFile(journalPath, "utf8"), journalBeforeCompare);
});

test("mission compare rend visible une approval pending mais interdit la relance ciblee tant qu'elle n'est pas resolue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-compare-approval-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_compare_approval",
          pollCursor: "cursor_compare_approval",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation compare",
          actionType: "workspace_write",
          actionSummary: "Modification sensible",
          guardrails: ["manual_review: workspace_write"],
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission compare approval");
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Attendre une validation explicite",
    owner: "agent_approval",
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
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);

  const compareResult = await readMissionCompare({
    rootDir,
    missionId: mission.id,
  });
  const compareCommand = await runCommand([
    "mission",
    "compare",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const journalBeforeRelaunch = await readFile(journalPath, "utf8");
  const relaunchResult = await runCommand([
    "mission",
    "compare",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(compareResult.compare.observed.pendingApprovalCount, 1);
  assert.equal(compareResult.compare.impactedBranch.rootTicketId, ticketId);
  assert.equal(compareResult.compare.impactedBranch.relaunchable, false);
  assert.equal(compareResult.compare.impactedBranch.blockingReasons[0]?.code, "approval_pending");
  assert.equal(compareResult.compare.operatorValidationRequired, false);
  assert.doesNotMatch(
    JSON.stringify(compareResult.compare),
    /resp_compare_approval|cursor_compare_approval|vendorStatus|requires_approval/i,
  );

  assert.equal(compareCommand.exitCode, 0);
  assert.match(compareCommand.lines.join("\n"), /Blocages restants: .*attend encore une approbation/);
  assert.doesNotMatch(
    compareCommand.lines.join("\n"),
    /resp_compare_approval|cursor_compare_approval|vendorStatus|requires_approval/i,
  );

  assert.equal(relaunchResult.exitCode, 1);
  assert.match(
    relaunchResult.lines.at(-1) ?? "",
    new RegExp(`Le ticket \`${ticketId}\` attend encore une approbation`),
  );
  assert.equal(await readFile(journalPath, "utf8"), journalBeforeRelaunch);
});

test("mission compare relaunch refuse un descendant et guide vers la vraie racine amont", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-compare-descendant-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => {
        throw new Error("adapter boom");
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission compare descendant");
  const rootTicketId = await createTicket(rootDir, mission.id, {
    goal: "Racine a relancer",
    owner: "agent_root",
  });
  const descendantTicketId = await createTicket(rootDir, mission.id, {
    goal: "Descendant en attente de la racine",
    owner: "agent_child",
    dependsOn: [rootTicketId],
  });

  const firstRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    rootTicketId,
  ]);

  assert.equal(firstRun.exitCode, 1);

  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const journalBeforeRelaunch = await readFile(journalPath, "utf8");
  const relaunchResult = await runCommand([
    "mission",
    "compare",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    descendantTicketId,
  ]);

  assert.equal(relaunchResult.exitCode, 1);
  assert.match(
    relaunchResult.lines.at(-1) ?? "",
    new RegExp(`Relancez d'abord la racine amont \`${rootTicketId}\``),
  );
  assert.equal(await readFile(journalPath, "utf8"), journalBeforeRelaunch);
});

test("mission compare demande une validation operateur quand tous les tickets sont done sans declarer les criteres satisfaits", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-compare-validation-"));

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
          responseId: "resp_compare_done",
          pollCursor: "cursor_compare_done",
          vendorStatus: "completed",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission compare validation");
  const ticketId = await createTicket(rootDir, mission.id, {
    goal: "Terminer la mission",
    owner: "agent_done",
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

  assert.equal(runResult.exitCode, 0);

  const compareResult = await readMissionCompare({
    rootDir,
    missionId: mission.id,
  });
  const compareCommand = await runCommand([
    "mission",
    "compare",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);
  const output = compareCommand.lines.join("\n");

  assert.equal(compareResult.compare.operatorValidationRequired, true);
  assert.equal(compareResult.compare.impactedBranch.rootTicketId, null);
  assert.equal(compareResult.compare.impactedBranch.relaunchable, false);
  assert.match(JSON.stringify(compareResult.compare.gaps), /validation_operateur_requise/);
  assert.equal(compareCommand.exitCode, 0);
  assert.match(output, /Validation operateur requise: oui/);
  assert.doesNotMatch(output, /criteres de succes atteints/i);
  assert.doesNotMatch(output, /resp_compare_done|cursor_compare_done|vendorStatus/i);
});

test("mission compare relaunch cree une nouvelle tentative uniquement pour la racine selectionnee", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-compare-rerun-root-"));

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
            responseId: "resp_compare_retry_done",
            pollCursor: "cursor_compare_retry_done",
            vendorStatus: "completed",
          },
        };
      },
    }),
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir, "Mission compare relaunch root");
  const rootTicketId = await createTicket(rootDir, mission.id, {
    goal: "Racine a rejouer",
    owner: "agent_root",
  });
  const descendantTicketId = await createTicket(rootDir, mission.id, {
    goal: "Descendant impacte",
    owner: "agent_child",
    dependsOn: [rootTicketId],
  });
  const unaffectedTicketId = await createTicket(rootDir, mission.id, {
    goal: "Ticket sain",
    owner: "agent_safe",
  });

  const firstRun = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    rootTicketId,
  ]);

  assert.equal(firstRun.exitCode, 1);

  const descendantBefore = await readTicket(rootDir, mission.id, descendantTicketId);
  const unaffectedBefore = await readTicket(rootDir, mission.id, unaffectedTicketId);
  const descendantAttemptsBefore = await listAttemptIds(rootDir, mission.id, descendantTicketId);
  const unaffectedAttemptsBefore = await listAttemptIds(rootDir, mission.id, unaffectedTicketId);

  const relaunchResult = await runCommand([
    "mission",
    "compare",
    "relaunch",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    rootTicketId,
  ]);

  assert.equal(relaunchResult.exitCode, 0);
  assert.equal(launchCount, 2);
  assert.match(relaunchResult.lines.join("\n"), /Tentative ouverte: attempt_/);
  assert.doesNotMatch(
    relaunchResult.lines.join("\n"),
    /resp_compare_retry_done|cursor_compare_retry_done|vendorStatus/i,
  );

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedRoot = await readTicket(rootDir, mission.id, rootTicketId);
  const updatedDescendant = await readTicket(rootDir, mission.id, descendantTicketId);
  const updatedUnaffected = await readTicket(rootDir, mission.id, unaffectedTicketId);
  const rootAttempts = await listAttemptIds(rootDir, mission.id, rootTicketId);
  const descendantAttempts = await listAttemptIds(rootDir, mission.id, descendantTicketId);
  const unaffectedAttempts = await listAttemptIds(rootDir, mission.id, unaffectedTicketId);
  const journal = await readJournal(rootDir);

  assert.equal(updatedMission.status, "ready");
  assert.equal(updatedRoot.status, "done");
  assert.equal(rootAttempts.length, 2);
  assert.deepEqual(descendantAttempts, descendantAttemptsBefore);
  assert.deepEqual(unaffectedAttempts, unaffectedAttemptsBefore);
  assert.deepEqual(updatedDescendant, descendantBefore);
  assert.deepEqual(updatedUnaffected, unaffectedBefore);
  assert.equal(journal.at(-1)?.ticketId, rootTicketId);
  assert.equal(journal.at(-1)?.type, "execution.completed");
});
