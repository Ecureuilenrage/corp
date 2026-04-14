import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";

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

test("mission create persiste la mission, le journal initial et les projections minimales", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-create-mission-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(bootstrapResult.exitCode, 0);

  const createResult = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission V1",
    "--objective",
    "Poser une mission persistante et local-first",
    "--success-criterion",
    "Un journal initial existe",
    "--success-criterion",
    "Les projections restent coherentes",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const missionCreatedLine = createResult.lines.find((line) =>
    line.startsWith("Mission creee: "),
  );

  assert.ok(missionCreatedLine, "la sortie doit inclure l'identifiant de mission");

  const missionId = missionCreatedLine.slice("Mission creee: ".length);
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");
  const mission = await readJson<Record<string, unknown>>(missionPath);

  assert.match(missionId, /^mission_/);
  assert.equal(mission.id, missionId);
  assert.equal(mission.title, "Mission V1");
  assert.equal(mission.objective, "Poser une mission persistante et local-first");
  assert.equal(mission.status, "ready");
  assert.deepEqual(mission.successCriteria, [
    "Un journal initial existe",
    "Les projections restent coherentes",
  ]);
  assert.equal(mission.policyProfileId, "policy_profile_local");
  assert.deepEqual(mission.ticketIds, []);
  assert.deepEqual(mission.artifactIds, []);
  assert.equal(mission.createdAt, mission.updatedAt);

  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const journalEntries = (await readFile(journalPath, "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  assert.equal(journalEntries.length, 1);

  const [missionCreatedEvent] = journalEntries;
  const firstEventId = missionCreatedEvent.eventId;

  assert.match(String(firstEventId), /^event_/);
  assert.equal(missionCreatedEvent.type, "mission.created");
  assert.equal(missionCreatedEvent.missionId, missionId);
  assert.equal(mission.resumeCursor, firstEventId);
  assert.deepEqual(mission.eventIds, [firstEventId]);
  assert.deepEqual(missionCreatedEvent.payload, { mission });

  const missionStatusProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "mission-status.json"),
  );
  const resumeViewProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "resume-view.json"),
  );
  const ticketBoardProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "ticket-board.json"),
  );
  const approvalQueueProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "approval-queue.json"),
  );
  const artifactIndexProjection = await readJson<Record<string, unknown>>(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
  );

  assert.deepEqual(missionStatusProjection, {
    schemaVersion: 1,
    mission,
  });
  assert.deepEqual(resumeViewProjection, {
    schemaVersion: 1,
    resume: {
      missionId,
      title: "Mission V1",
      objective: "Poser une mission persistante et local-first",
      status: "ready",
      successCriteria: [
        "Un journal initial existe",
        "Les projections restent coherentes",
      ],
      authorizedExtensions: {
        allowedCapabilities: [],
        skillPackRefs: [],
      },
      openTickets: [],
      pendingApprovals: [],
      lastRelevantArtifact: null,
      lastKnownBlockage: null,
      lastEventId: firstEventId,
      updatedAt: mission.updatedAt,
      nextOperatorAction:
        "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.",
    },
  });
  assert.deepEqual(ticketBoardProjection, {
    schemaVersion: 1,
    tickets: [],
  });
  assert.deepEqual(approvalQueueProjection, {
    schemaVersion: 1,
    approvals: [],
  });
  assert.deepEqual(artifactIndexProjection, {
    schemaVersion: 1,
    artifacts: [],
  });

  assert.match(createResult.lines.join("\n"), /Prochaine action suggeree:/i);
});
