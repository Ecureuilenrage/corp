import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ApprovalRequest } from "../../packages/contracts/src/approval/approval-request";
import type { ExecutionAttempt } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import type { JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import { runCli } from "../../apps/corp-cli/src/index";
import { FileMissionRepository } from "../../packages/storage/src/repositories/file-mission-repository";
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
    "Mission extensions",
    "--objective",
    "Gouverner les extensions autorisees par mission",
    "--success-criterion",
    "Les extensions sont bornees par mission",
    "--success-criterion",
    "Leur usage est lisible en CLI",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const missionId = String(
    result.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length),
  );

  return readMission(rootDir, missionId);
}

async function readMission(rootDir: string, missionId: string): Promise<Mission> {
  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", missionId, "mission.json"),
  );
}

async function writeMissionStatus(
  rootDir: string,
  missionId: string,
  status: Mission["status"],
): Promise<void> {
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  const mission = await readMission(rootDir, missionId);

  await writeFile(
    missionPath,
    `${JSON.stringify({ ...mission, status }, null, 2)}\n`,
    "utf8",
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

async function registerCapability(rootDir: string): Promise<void> {
  const result = await runCommand([
    "extension",
    "capability",
    "register",
    "--root",
    rootDir,
    "--file",
    path.join(process.cwd(), "tests", "fixtures", "extensions", "valid-capability-local.json"),
  ]);

  assert.equal(result.exitCode, 0);
}

async function registerSkillPack(rootDir: string, packRef = "pack.triage.local"): Promise<void> {
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

async function selectMissionExtensions(
  rootDir: string,
  missionId: string,
  extraArgs: string[],
): Promise<CommandResult> {
  return runCommand([
    "mission",
    "extension",
    "select",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    ...extraArgs,
  ]);
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
    "Executer une operation gouvernee",
    "--owner",
    "agent_extension",
    "--success-criterion",
    "Le ticket reste gouverne",
    ...extraArgs,
  ]);
}

async function updateTicket(
  rootDir: string,
  missionId: string,
  ticketId: string,
  extraArgs: string[],
): Promise<CommandResult> {
  return runCommand([
    "mission",
    "ticket",
    "update",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
    ...extraArgs,
  ]);
}

async function openApproval(
  rootDir: string,
  missionId: string,
  ticketId: string,
): Promise<ApprovalRequest> {
  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_extensions_approval",
          pollCursor: "cursor_extensions_approval",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation extension",
          actionType: "workspace_write",
          actionSummary: "Confirmer la gouvernance des extensions",
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

  const approvalQueue = await readJson<{
    approvals: ApprovalRequest[];
  }>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );

  assert.equal(approvalQueue.approvals.length, 1);
  return approvalQueue.approvals[0];
}

test("mission create initialise authorizedExtensions a vide et mission extension select journalise la mutation", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-select-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await registerCapability(rootDir);
  await registerSkillPack(rootDir);

  const mission = await createMission(rootDir);

  assert.deepEqual(mission.authorizedExtensions, {
    allowedCapabilities: [],
    skillPackRefs: [],
  });

  const selectResult = await selectMissionExtensions(rootDir, mission.id, [
    "--allow-capability",
    "shell.exec",
    "--skill-pack",
    "pack.triage.local",
  ]);
  const missionAfter = await readMission(rootDir, mission.id);
  const journal = await readJournal(rootDir);
  const selectionEvent = journal.find((event) => event.type === "mission.extensions_selected");
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
  ]);

  assert.equal(selectResult.exitCode, 0);
  assert.deepEqual(missionAfter.authorizedExtensions, {
    allowedCapabilities: ["shell.exec"],
    skillPackRefs: ["pack.triage.local"],
  });
  assert.ok(selectionEvent);
  assert.deepEqual(selectionEvent.payload.previousAuthorizedExtensions, {
    allowedCapabilities: [],
    skillPackRefs: [],
  });
  assert.deepEqual(selectionEvent.payload.authorizedExtensions, {
    allowedCapabilities: ["shell.exec"],
    skillPackRefs: ["pack.triage.local"],
  });
  assert.deepEqual(selectionEvent.payload.changedFields, [
    "allowedCapabilities",
    "skillPackRefs",
  ]);
  assert.equal(selectionEvent.payload.trigger, "operator");
  assert.match(selectResult.lines.join("\n"), /Extensions mission mises a jour/i);
  assert.match(statusResult.lines.join("\n"), /Capabilities mission: shell\.exec/);
  assert.match(statusResult.lines.join("\n"), /Skill packs mission: pack\.triage\.local/);
});

test("mission extension select rejette les built-ins et les refs non enregistrees de maniere deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-errors-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  const mission = await createMission(rootDir);

  const builtInResult = await selectMissionExtensions(rootDir, mission.id, [
    "--allow-capability",
    "fs.read",
  ]);
  const unknownCapabilityResult = await selectMissionExtensions(rootDir, mission.id, [
    "--allow-capability",
    "shell.exec",
  ]);
  const unknownPackResult = await selectMissionExtensions(rootDir, mission.id, [
    "--skill-pack",
    "pack.unknown",
  ]);
  const emptyMutationResult = await selectMissionExtensions(rootDir, mission.id, []);

  assert.equal(builtInResult.exitCode, 1);
  assert.equal(
    builtInResult.lines.at(-1),
    "La capability built-in `fs.read` reste hors selection mission. N'utilisez pas `corp mission extension select` pour les built-ins.",
  );
  assert.equal(unknownCapabilityResult.exitCode, 1);
  assert.equal(
    unknownCapabilityResult.lines.at(-1),
    "Capability introuvable dans le registre local: shell.exec.",
  );
  assert.equal(unknownPackResult.exitCode, 1);
  assert.equal(
    unknownPackResult.lines.at(-1),
    "Skill pack introuvable dans le registre local: pack.unknown.",
  );
  assert.equal(emptyMutationResult.exitCode, 1);
  assert.equal(
    emptyMutationResult.lines.at(-1),
    "Aucune mutation demandee pour `corp mission extension select`.",
  );
});

test("mission extension select et ticket create restent coherents quand les refs varient seulement par la casse", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-casefold-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await registerCapability(rootDir);
  await registerSkillPack(rootDir);

  const mission = await createMission(rootDir);
  const selectResult = await selectMissionExtensions(rootDir, mission.id, [
    "--allow-capability",
    "Shell.Exec",
    "--skill-pack",
    "Pack.Triage.Local",
  ]);

  assert.equal(selectResult.exitCode, 0);

  const missionAfterSelection = await readMission(rootDir, mission.id);
  assert.deepEqual(missionAfterSelection.authorizedExtensions, {
    allowedCapabilities: ["shell.exec"],
    skillPackRefs: ["pack.triage.local"],
  });

  const createResult = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "FS.READ",
    "--allow-capability",
    "CLI.RUN",
    "--allow-capability",
    "Shell.Exec",
    "--skill-pack",
    "Pack.Triage.Local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const ticketId = String(
    createResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const ticket = await readTicket(rootDir, mission.id, ticketId);

  assert.deepEqual(ticket.allowedCapabilities, ["fs.read", "cli.run", "shell.exec"]);
  assert.deepEqual(ticket.skillPackRefs, ["pack.triage.local"]);
});

test("mission extension select rejette les missions terminales de maniere deterministe", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-terminal-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await registerCapability(rootDir);
  const mission = await createMission(rootDir);

  for (const terminalStatus of ["completed", "cancelled", "failed"] as const) {
    await writeMissionStatus(rootDir, mission.id, terminalStatus);

    const result = await selectMissionExtensions(rootDir, mission.id, [
      "--allow-capability",
      "shell.exec",
    ]);

    assert.equal(result.exitCode, 1);
    assert.equal(
      result.lines.at(-1),
      `Impossible de modifier la selection d'extensions de la mission \`${mission.id}\` car son statut est terminal (\`${terminalStatus}\`).`,
    );
  }
});

test("mission extension select detecte un conflit concurrent au lieu d'un dernier-writer-gagne", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-concurrent-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await registerCapability(rootDir);
  await registerSkillPack(rootDir);

  const mission = await createMission(rootDir);
  const originalFindById = FileMissionRepository.prototype.findById;
  let synchronizedReads = 0;
  let releaseReads!: () => void;
  const readBarrier = new Promise<void>((resolve) => {
    releaseReads = resolve;
  });

  FileMissionRepository.prototype.findById = async function patchedFindById(
    missionId: string,
  ): Promise<Mission | null> {
    const foundMission = await originalFindById.call(this, missionId);

    if (missionId === mission.id && synchronizedReads < 2) {
      synchronizedReads += 1;

      if (synchronizedReads === 2) {
        releaseReads();
      }

      await readBarrier;
    }

    return foundMission;
  };

  t.after(() => {
    FileMissionRepository.prototype.findById = originalFindById;
  });

  const results = await Promise.all([
    selectMissionExtensions(rootDir, mission.id, ["--allow-capability", "shell.exec"]),
    selectMissionExtensions(rootDir, mission.id, ["--skill-pack", "pack.triage.local"]),
  ]);
  const successes = results.filter((result) => result.exitCode === 0);
  const failures = results.filter((result) => result.exitCode === 1);

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.match(failures[0].lines.at(-1) ?? "", /conflit d'ecriture concurrente/i);
});

test("la selection mission borne create update approval et run sans casser les built-ins", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-extension-governance-"));
  let launchCount = 0;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await registerCapability(rootDir);
  await registerSkillPack(rootDir);

  const mission = await createMission(rootDir);
  const initialSelectResult = await selectMissionExtensions(rootDir, mission.id, [
    "--allow-capability",
    "shell.exec",
    "--skill-pack",
    "pack.triage.local",
  ]);

  assert.equal(initialSelectResult.exitCode, 0);

  const unauthorizedCreateResult = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "shell.write",
  ]);

  assert.equal(unauthorizedCreateResult.exitCode, 1);
  assert.equal(
    unauthorizedCreateResult.lines.at(-1),
    `La capability \`shell.write\` n'est pas autorisee par la mission \`${mission.id}\`.`,
  );

  const createResult = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    "cli.run",
    "--allow-capability",
    "shell.exec",
    "--skill-pack",
    "pack.triage.local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const ticketId = String(
    createResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const restrictedRunTicketResult = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "shell.exec",
    "--skill-pack",
    "pack.triage.local",
  ]);

  assert.equal(restrictedRunTicketResult.exitCode, 0);

  const restrictedRunTicketId = String(
    restrictedRunTicketResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const unauthorizedUpdateResult = await updateTicket(rootDir, mission.id, ticketId, [
    "--skill-pack",
    "pack.review",
  ]);

  assert.equal(unauthorizedUpdateResult.exitCode, 1);
  assert.equal(
    unauthorizedUpdateResult.lines.at(-1),
    `Le skill pack \`pack.review\` n'est pas autorise par la mission \`${mission.id}\`.`,
  );

  const approval = await openApproval(rootDir, mission.id, ticketId);
  const unauthorizedApprovalResult = await runCommand([
    "mission",
    "approval",
    "approve",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--approval-id",
    approval.approvalId,
    "--skill-pack",
    "pack.review",
  ]);

  assert.equal(unauthorizedApprovalResult.exitCode, 1);
  assert.equal(
    unauthorizedApprovalResult.lines.at(-1),
    `Le skill pack \`pack.review\` n'est pas autorise par la mission \`${mission.id}\`.`,
  );
  await writeMissionStatus(rootDir, mission.id, "ready");

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async () => {
        launchCount += 1;
        return {
          status: "completed",
          adapterState: {},
        };
      },
    }),
  });

  const narrowedSelectionResult = await selectMissionExtensions(rootDir, mission.id, [
    "--clear-allow-capability",
    "--clear-skill-pack",
  ]);

  assert.equal(narrowedSelectionResult.exitCode, 0);

  const runAfterRestrictionResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    restrictedRunTicketId,
  ]);

  assert.equal(runAfterRestrictionResult.exitCode, 1);
  assert.equal(launchCount, 0);
  assert.equal(
    runAfterRestrictionResult.lines.at(-1),
    `La capability \`shell.exec\` n'est pas autorisee par la mission \`${mission.id}\`.`,
  );

  const builtInOnlyCreateResult = await createTicket(rootDir, mission.id, [
    "--allow-capability",
    "fs.read",
    "--allow-capability",
    "cli.run",
  ]);

  assert.equal(builtInOnlyCreateResult.exitCode, 0);

  const builtInTicketId = String(
    builtInOnlyCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const builtInRunResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    builtInTicketId,
  ]);

  assert.equal(builtInRunResult.exitCode, 0);
  assert.equal(launchCount, 1);
});

test("two-concurrent-extension-select-produces-no-intermediate-projection", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-extension-rewrite-under-lock-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);
  await registerCapability(rootDir);
  await registerSkillPack(rootDir);
  const mission = await createMission(rootDir);

  const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store") as {
    writeProjectionSnapshot: (
      projectionsDir: string,
      projectionName: string,
      snapshot: object,
    ) => Promise<string>;
  };
  const originalWriteProjectionSnapshot = projectionStoreModule.writeProjectionSnapshot;
  const lockPath = path.join(rootDir, ".corp", "missions", mission.id, "mission.json.lock");
  const lockObservations: Array<{ projection: string; lockPresent: boolean }> = [];

  projectionStoreModule.writeProjectionSnapshot = async (
    ...args: Parameters<typeof originalWriteProjectionSnapshot>
  ): Promise<string> => {
    let lockPresent = true;

    try {
      await access(lockPath);
    } catch {
      lockPresent = false;
    }

    lockObservations.push({ projection: args[1], lockPresent });
    return originalWriteProjectionSnapshot(...args);
  };

  t.after(() => {
    projectionStoreModule.writeProjectionSnapshot = originalWriteProjectionSnapshot;
  });

  const originalFindById = FileMissionRepository.prototype.findById;
  let synchronizedReads = 0;
  let releaseReads!: () => void;
  const readBarrier = new Promise<void>((resolve) => {
    releaseReads = resolve;
  });

  FileMissionRepository.prototype.findById = async function patchedFindById(
    missionId: string,
  ): Promise<Mission | null> {
    const foundMission = await originalFindById.call(this, missionId);

    if (missionId === mission.id && synchronizedReads < 2) {
      synchronizedReads += 1;

      if (synchronizedReads === 2) {
        releaseReads();
      }

      await readBarrier;
    }

    return foundMission;
  };

  t.after(() => {
    FileMissionRepository.prototype.findById = originalFindById;
  });

  const results = await Promise.all([
    selectMissionExtensions(rootDir, mission.id, ["--allow-capability", "shell.exec"]),
    selectMissionExtensions(rootDir, mission.id, ["--skill-pack", "pack.triage.local"]),
  ]);
  const successes = results.filter((result) => result.exitCode === 0);
  const failures = results.filter((result) => result.exitCode === 1);

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);

  assert.ok(
    lockObservations.length > 0,
    "Au moins une projection devrait avoir ete ecrite par le gagnant.",
  );

  for (const observation of lockObservations) {
    assert.equal(
      observation.lockPresent,
      true,
      `La projection ${observation.projection} a ete ecrite hors du lock saveIfUnchanged; rewrite non atomique.`,
    );
  }
});
