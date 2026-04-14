import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
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

interface AuditLogProjection {
  schemaVersion: 1;
  entries: Array<{
    eventId: string;
    eventType: string;
    title: string;
    summary: string;
    ticketId?: string;
    attemptId?: string;
    source: string;
  }>;
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

function getFixturePath(fileName: string): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
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
    "Mission capability audit",
    "--objective",
    "Tracer l'usage d'une capability en runtime",
    "--success-criterion",
    "Le ticket est runnable",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const missionId = String(
    result.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length),
  );

  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  const mission = await readJson<Mission>(missionPath);

  await writeFile(
    missionPath,
    `${JSON.stringify({
      ...mission,
      authorizedExtensions: {
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: [],
      },
    }, null, 2)}\n`,
    "utf8",
  );

  return readJson<Mission>(missionPath);
}

async function createTicket(
  rootDir: string,
  missionId: string,
  extraArgs: string[] = [],
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
    "Utiliser une capability enregistr ee",
    "--owner",
    "agent_capability",
    "--success-criterion",
    "La capability est resolue",
    ...extraArgs,
  ]);

  assert.equal(result.exitCode, 0);

  return String(
    result.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
}

test("mission ticket run emet capability.invoked et rend l'audit lisible pour une capability enregistree", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-audit-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const registerResult = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    getFixturePath("valid-capability-local.json"),
  ]);

  assert.equal(registerResult.exitCode, 0);

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "shell.exec",
  ]);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async () => ({
        status: "completed",
        adapterState: {
          responseId: "resp_capability_audit",
          pollCursor: "cursor_capability_audit",
          vendorStatus: "completed",
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
    mission.id,
    "--ticket-id",
    ticketId,
  ]);
  const journal = await readJournal(rootDir);
  const capabilityEvent = journal.find((event) => event.type === "capability.invoked");
  const auditProjection = await readJson<AuditLogProjection>(
    path.join(rootDir, ".corp", "projections", "audit-log.json"),
  );
  const auditResult = await runCommand([
    "mission",
    "audit",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(runResult.exitCode, 0);
  assert.ok(capabilityEvent, "capability.invoked doit etre journalise");
  assert.equal(capabilityEvent.missionId, mission.id);
  assert.equal(capabilityEvent.ticketId, ticketId);
  assert.equal(capabilityEvent.actor, "system");
  assert.equal(capabilityEvent.source, "ticket-runtime");
  assert.deepEqual(capabilityEvent.payload.capability, {
    capabilityId: "shell.exec",
    registrationId: "ext.capability.shell.exec.local",
    provider: "local",
    approvalSensitive: true,
    permissions: ["shell.exec", "fs.read"],
    constraints: ["local_only", "approval_sensitive", "workspace_scoped"],
    requiredEnvNames: [],
  });
  assert.deepEqual(capabilityEvent.payload.guardrails, [
    "approval_sensitive: shell.exec",
    "policy_profile: policy_profile_local",
    "allowed_capabilities: shell.exec",
  ]);

  const auditEntry = auditProjection.entries.find((entry) => entry.eventType === "capability.invoked");

  assert.ok(auditEntry);
  assert.equal(auditEntry.ticketId, ticketId);
  assert.equal(auditEntry.attemptId, capabilityEvent.attemptId);
  assert.equal(auditEntry.source, "ticket-runtime");
  assert.equal(auditEntry.title, "Capability invoquee");
  assert.match(auditEntry.summary, /shell\.exec/);

  const auditOutput = auditResult.lines.join("\n");
  assert.equal(auditResult.exitCode, 0);
  assert.match(auditOutput, /Capability invoquee/);
  assert.match(auditOutput, /shell\.exec/);
  assert.doesNotMatch(
    JSON.stringify(journal),
    /resp_capability_audit|cursor_capability_audit|vendorStatus|pollCursor|responseId/i,
  );
  assert.doesNotMatch(
    `${JSON.stringify(auditProjection)}\n${auditOutput}`,
    /resp_capability_audit|cursor_capability_audit|vendorStatus|pollCursor|responseId/i,
  );
});

test("mission ticket run ignore fs.read et cli.run comme built-ins sans emettre capability.invoked", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-builtins-"));
  let launchCount = 0;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    "cli.run",
  ]);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async () => {
        launchCount += 1;
        return {
          status: "completed",
          adapterState: {
            responseId: "resp_builtin_capability",
            pollCursor: "cursor_builtin_capability",
            vendorStatus: "completed",
          },
        };
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
  const journal = await readJournal(rootDir);

  assert.equal(runResult.exitCode, 0);
  assert.equal(launchCount, 1);
  assert.equal(
    journal.some((event) => event.type === "capability.invoked"),
    false,
  );
  assert.equal(journal.at(-1)?.type, "execution.completed");
});

test("mission ticket run echoue avant execution externe quand la capability referencee est absente du registre", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-capability-missing-"));
  let launchCount = 0;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "shell.exec",
  ]);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async () => {
        launchCount += 1;
        return {
          status: "completed",
          adapterState: {
            responseId: "resp_should_not_run",
          },
        };
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
  const journal = await readJournal(rootDir);

  assert.equal(runResult.exitCode, 1);
  assert.equal(launchCount, 0);
  assert.match(runResult.lines.join("\n"), /Capability introuvable.*shell\.exec/i);
  assert.deepEqual(
    journal.map((event) => event.type),
    ["mission.created", "ticket.created"],
  );
});
