import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { ResolvedSkillPackSummary } from "../../packages/contracts/src/extension/registered-skill-pack";
import { runCli } from "../../apps/corp-cli/src/index";
import { registerSkillPack } from "../../packages/skill-pack/src/loader/register-skill-pack";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";
import { ensureWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import { createFileSkillPackRegistryRepository } from "../../packages/storage/src/repositories/file-skill-pack-registry-repository";

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
    "Mission skill pack runtime",
    "--objective",
    "Verifier le chargement runtime d'un skill pack local",
    "--success-criterion",
    "Le ticket recoit un resume de skill pack",
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
        allowedCapabilities: [],
        skillPackRefs: ["pack.triage.local"],
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
    "Executer un ticket avec skill pack",
    "--owner",
    "agent_skill_pack",
    "--success-criterion",
    "Le skill pack est resolu",
    ...extraArgs,
  ]);

  assert.equal(result.exitCode, 0);

  return String(
    result.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
}

test("mission ticket run echoue avant execution externe quand un skill pack reference est absent du registre", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-skill-pack-missing-"));
  let launchCount = 0;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, [
    "--skill-pack",
    "pack.triage.local",
  ]);

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
  assert.match(runResult.lines.join("\n"), /Skill pack introuvable.*pack\.triage\.local/i);
  assert.deepEqual(
    journal.map((event) => event.type),
    ["mission.created", "ticket.created"],
  );
});

test("mission ticket run transmet un resume de skill pack resolu a l'adaptateur sans charger le contenu des fichiers", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-skill-pack-summary-"));
  let capturedSkillPacks: ResolvedSkillPackSummary[] | null = null;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileSkillPackRegistryRepository(layout);
  await registerSkillPack({
    filePath: getFixturePath("valid-skill-pack.json"),
    repository,
    registeredAt: "2026-04-13T20:40:00.000Z",
  });

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id, [
    "--skill-pack",
    "pack.triage.local",
  ]);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async (options) => {
        capturedSkillPacks = options.resolvedSkillPacks;
        return {
          status: "completed",
          adapterState: {},
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

  assert.equal(runResult.exitCode, 0);
  assert.deepEqual(capturedSkillPacks, [
    {
      packRef: "pack.triage.local",
      displayName: "Pack de triage local",
      description: "Declare un skill pack local pret a etre charge plus tard par le runtime.",
      owner: "core-platform",
      tags: ["skill-pack", "local"],
      rootDir: path.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack"),
      references: [
        path.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack", "README.md"),
      ],
      metadataFile: path.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack", "pack.json"),
      scripts: [
        path.join(process.cwd(), "tests", "fixtures", "extensions", "skill-packs", "triage-pack", "scripts", "preflight.sh"),
      ],
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(capturedSkillPacks),
    /Pack de triage local\.|echo "preflight"/,
  );
});

test("mission ticket run conserve un contexte vide quand aucun skill pack n'est reference", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-run-ticket-skill-pack-empty-"));
  let capturedSkillPacks: ResolvedSkillPackSummary[] | null = null;

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticketId = await createTicket(rootDir, mission.id);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_exec",
      launch: async (options) => {
        capturedSkillPacks = options.resolvedSkillPacks;
        return {
          status: "completed",
          adapterState: {},
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

  assert.equal(runResult.exitCode, 0);
  assert.deepEqual(capturedSkillPacks, []);
});
