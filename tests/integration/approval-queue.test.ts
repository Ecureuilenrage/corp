import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ApprovalRequest } from "../../packages/contracts/src/approval/approval-request";
import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import type { ApprovalQueueProjection } from "../../packages/journal/src/projections/approval-queue-projection";
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

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string, title = "Mission approvals"): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    title,
    "--objective",
    "Ouvrir une file d'approbation durable",
    "--success-criterion",
    "La file est journalisee",
    "--success-criterion",
    "Le resume reste coherent",
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
        allowedCapabilities: [],
        skillPackRefs: ["pack.audit"],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  return readMission(rootDir, mission.id);
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
    "Executer une action sensible",
    "--owner",
    "agent_sensitive",
    "--success-criterion",
    "L'action sensible est decrite",
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    "cli.run",
    "--skill-pack",
    "pack.audit",
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

async function openApprovalFlow(rootDir: string): Promise<{
  mission: Mission;
  ticketId: string;
  attemptId: string;
}> {
  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_approval_123",
          pollCursor: "cursor_approval_1",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation requise pour une action sensible",
          actionType: "workspace_write",
          actionSummary: "Modification de README.md dans le workspace isole",
          guardrails: ["manual_review: workspace_write"],
          relatedArtifactIds: ["artifact_hint_1"],
        },
      }),
    }),
  });

  await registerTestSkillPack(rootDir, "pack.audit");
  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);
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

  const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
  assert.ok(attemptLine, "la commande doit annoncer l'attempt ouverte");

  return {
    mission,
    ticketId,
    attemptId: attemptLine.slice("Tentative ouverte: ".length),
  };
}

test("mission ticket run materialise approval.requested, persiste la queue et alimente les vues operateur", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-queue-flow-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const { mission, ticketId, attemptId } = await openApprovalFlow(rootDir);

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
  const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);
  const journal = await readJournal(rootDir);
  const approvalQueueProjection = await readJson<ApprovalQueueProjection>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );
  const approvalEvent = journal.at(-1);
  const relatedRuntimeEvent = journal.at(-2);
  const approval = (approvalEvent?.payload as { approval?: ApprovalRequest }).approval;
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
  const approvalQueueRaw = await readFile(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
    "utf8",
  );

  assert.equal(updatedMission.status, "awaiting_approval");
  assert.equal(updatedTicket.status, "awaiting_approval");
  assert.equal(attempt.status, "awaiting_approval");
  assert.equal(attempt.backgroundRequested, true);
  assert.deepEqual(updatedTicket.executionHandle.adapterState, {
    responseId: "resp_approval_123",
    pollCursor: "cursor_approval_1",
    vendorStatus: "requires_approval",
  });
  assert.deepEqual(attempt.adapterState, updatedTicket.executionHandle.adapterState);

  assert.deepEqual(
    journal.map((event) => event.type),
    [
      "mission.created",
      "ticket.created",
      "workspace.isolation_created",
      "ticket.claimed",
      "execution.requested",
      "skill_pack.used",
      "approval.requested",
    ],
  );
  assert.equal(approvalEvent?.type, "approval.requested");
  assert.ok(approval);
  assert.match(approval.approvalId, /^approval_/);
  assert.equal(approval.missionId, mission.id);
  assert.equal(approval.ticketId, ticketId);
  assert.equal(approval.attemptId, attemptId);
  assert.equal(approval.status, "requested");
  assert.equal(approval.title, "Validation requise pour une action sensible");
  assert.equal(approval.actionType, "workspace_write");
  assert.equal(approval.actionSummary, "Modification de README.md dans le workspace isole");
  assert.deepEqual(approval.guardrails, [
    "manual_review: workspace_write",
    "policy_profile: policy_profile_local",
    "allowed_capabilities: fs.read, cli.run",
    "skill_packs: pack.audit",
  ]);
  assert.ok(relatedRuntimeEvent);
  assert.deepEqual(approval.relatedEventIds, [relatedRuntimeEvent.eventId]);
  assert.deepEqual(approval.relatedArtifactIds, ["artifact_hint_1"]);
  assert.equal(approval.createdAt, approval.updatedAt);
  assert.deepEqual(approvalQueueProjection, {
    schemaVersion: 1,
    approvals: [approval],
  });
  assert.equal(statusResult.exitCode, 0);
  assert.equal(resumeResult.exitCode, 0);
  assert.equal(queueResult.exitCode, 0);
  assert.match(
    statusResult.lines.join("\n"),
    new RegExp(`Validations en attente: ${approval.approvalId}`),
  );
  assert.match(
    resumeResult.lines.join("\n"),
    /Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation requise pour une action sensible\./,
  );
  assert.match(queueResult.lines.join("\n"), new RegExp(`Mission: ${mission.id}`));
  assert.match(queueResult.lines.join("\n"), new RegExp(`${approval.approvalId} \\| ticket=${ticketId} \\| attempt=${attemptId} \\| statut=requested`));
  assert.match(queueResult.lines.join("\n"), /action=workspace_write \| resume=Modification de README\.md dans le workspace isole/);
  assert.match(queueResult.lines.join("\n"), /garde-fous=manual_review: workspace_write ; policy_profile: policy_profile_local ; allowed_capabilities: fs\.read, cli\.run ; skill_packs: pack\.audit/);
  assert.match(queueResult.lines.join("\n"), /evenements=event_/);
  assert.match(queueResult.lines.join("\n"), /artefacts=artifact_hint_1/);

  for (const output of [
    statusResult.lines.join("\n"),
    resumeResult.lines.join("\n"),
    queueResult.lines.join("\n"),
    approvalQueueRaw,
  ]) {
    assert.doesNotMatch(output, /resp_approval_123|cursor_approval_1|vendorStatus|requires_approval/i);
  }
});

test("mission approval queue reconstruit approval-queue et resynchronise resume-view si la projection manque ou est corrompue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-queue-rebuild-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const { mission } = await openApprovalFlow(rootDir);
  const approvalQueuePath = path.join(rootDir, ".corp", "projections", "approval-queue.json");
  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const initialQueue = await readJson<ApprovalQueueProjection>(approvalQueuePath);
  const approvalId = initialQueue.approvals[0]?.approvalId;

  assert.ok(approvalId, "une approbation doit etre disponible pour la reconstruction");

  for (const scenario of ["missing", "corrupted"] as const) {
    await writeFile(
      resumeViewPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          resume: {
            missionId: mission.id,
            title: mission.title,
            objective: mission.objective,
            status: "awaiting_approval",
            successCriteria: [...mission.successCriteria],
            openTickets: [],
            pendingApprovals: [],
            lastRelevantArtifact: null,
            lastEventId: mission.resumeCursor,
            updatedAt: mission.updatedAt,
            nextOperatorAction: "Obsolete",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    if (scenario === "missing") {
      await unlink(approvalQueuePath);
    } else {
      await writeFile(approvalQueuePath, "{corrupted", "utf8");
    }
    await writeFile(missionStatusPath, "{corrupted", "utf8");

    const queueResult = await runCommand([
      "mission",
      "approval",
      "queue",
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
    ]);

    const rebuiltQueue = await readJson<ApprovalQueueProjection>(approvalQueuePath);
    const rebuiltResumeViewAfterQueue = await readJson<{
      schemaVersion: number;
      resume: {
        pendingApprovals: Array<{ approvalId?: string }>;
        nextOperatorAction: string;
      };
    }>(resumeViewPath);

    assert.equal(queueResult.exitCode, 0);
    assert.equal(rebuiltQueue.approvals[0]?.approvalId, approvalId);
    assert.equal(
      rebuiltResumeViewAfterQueue.resume.pendingApprovals[0]?.approvalId,
      approvalId,
      `resume-view.json doit etre resynchronise par approval queue seul (scenario=${scenario})`,
    );
    assert.equal(
      rebuiltResumeViewAfterQueue.resume.nextOperatorAction,
      "Arbitrez la prochaine validation en attente: Validation requise pour une action sensible.",
    );
    assert.match(queueResult.lines.join("\n"), new RegExp(approvalId));

    const resumeResult = await runCommand([
      "mission",
      "resume",
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
    ]);

    assert.equal(resumeResult.exitCode, 0);
    assert.match(
      resumeResult.lines.join("\n"),
      /Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation requise pour une action sensible\./,
    );
  }
});

test("mission ticket run foreground avec awaiting_approval emet ticket.in_progress avant approval.requested", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-queue-foreground-"));

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
          responseId: "resp_fg_approval",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation foreground",
          actionType: "workspace_write",
          actionSummary: "Ecriture sensible en mode foreground",
        },
      }),
    }),
  });

  await bootstrapWorkspace(rootDir);
  await registerTestSkillPack(rootDir, "pack.audit");
  const mission = await createMission(rootDir, "Mission foreground approval");
  const ticketId = await createTicket(rootDir, mission.id);

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

  const journal = await readJournal(rootDir);
  const eventTypes = journal.map((event) => event.type);

  assert.deepEqual(eventTypes, [
    "mission.created",
    "ticket.created",
    "workspace.isolation_created",
    "ticket.claimed",
    "execution.requested",
    "skill_pack.used",
    "ticket.in_progress",
    "approval.requested",
  ]);

  const approvalEvent = journal.at(-1);
  const approval = (approvalEvent?.payload as { approval?: ApprovalRequest }).approval;

  assert.ok(approval);
  assert.equal(approval.status, "requested");
  assert.equal(approval.title, "Validation foreground");
  assert.equal(approval.missionId, mission.id);
  assert.equal(approval.ticketId, ticketId);

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticketId);
  const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
  assert.ok(attemptLine);
  const attemptId = attemptLine.slice("Tentative ouverte: ".length);
  const attempt = await readAttempt(rootDir, mission.id, ticketId, attemptId);

  assert.equal(updatedMission.status, "awaiting_approval");
  assert.equal(updatedTicket.status, "awaiting_approval");
  assert.equal(attempt.status, "awaiting_approval");
  assert.equal(attempt.backgroundRequested, false);

  for (const output of [
    runResult.lines.join("\n"),
  ]) {
    assert.doesNotMatch(output, /resp_fg_approval|vendorStatus|requires_approval/i);
  }
});

test("mission status et mission resume ignorent un mission-status.json stale quand le journal indique awaiting_approval", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-approval-queue-stale-status-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const { mission } = await openApprovalFlow(rootDir);

  const missionStatusPath = path.join(rootDir, ".corp", "projections", "mission-status.json");

  const staleMissionStatus = await readJson<{ schemaVersion: number; mission: Mission }>(missionStatusPath);
  staleMissionStatus.mission.status = "ready";
  await writeFile(missionStatusPath, JSON.stringify(staleMissionStatus, null, 2), "utf8");

  for (const commandName of ["status", "resume"] as const) {
    const result = await runCommand([
      "mission",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      mission.id,
    ]);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, /Statut: awaiting_approval/);
    assert.doesNotMatch(output, /Statut: ready/);
    assert.match(
      output,
      /Prochain arbitrage utile: Arbitrez la prochaine validation en attente/,
    );
  }
});
