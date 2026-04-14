import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import {
  createFileTicketRepository,
  MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP,
} from "../../packages/storage/src/repositories/file-ticket-repository";
import { ensureWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";

function createTicketSnapshot(missionId: string, ticketId: string): Ticket {
  return {
    id: ticketId,
    missionId,
    kind: "implement",
    goal: "Ticket de test",
    status: "todo",
    owner: "agent_repo",
    dependsOn: [],
    successCriteria: ["Le ticket existe"],
    allowedCapabilities: [],
    skillPackRefs: [],
    workspaceIsolationId: null,
    executionHandle: {
      adapter: "codex_responses",
      adapterState: {},
    },
    artifactIds: [],
    eventIds: ["event_repo"],
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
  };
}

test("findOwningMissionId ignore les repertoires mission invalides avant de resoudre un ticket", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-file-ticket-repository-invalid-dir-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileTicketRepository(layout);
  const missionId = "mission_valid_owner";
  const ticketId = "ticket_owned";

  await mkdir(path.join(layout.missionsDir, missionId), { recursive: true });
  await writeFile(
    path.join(layout.missionsDir, missionId, "mission.json"),
    `${JSON.stringify({
      id: missionId,
      title: "Mission demo",
      objective: "Retrouver le ticket",
      status: "ready",
      successCriteria: ["Le ticket est reference"],
      policyProfileId: "policy_profile_local",
      ticketIds: [ticketId],
      artifactIds: [],
      eventIds: ["event_repo"],
      resumeCursor: "event_repo",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }, null, 2)}\n`,
    "utf8",
  );
  await repository.save(createTicketSnapshot(missionId, ticketId));
  await mkdir(path.join(layout.missionsDir, "mission_..poison"), { recursive: true });

  const owningMissionId = await repository.findOwningMissionId(ticketId);

  assert.equal(owningMissionId, missionId);
});

test("findOwningMissionId rejette une recherche exhaustive quand trop de missions valides existent", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-file-ticket-repository-threshold-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileTicketRepository(layout);

  for (let index = 0; index <= MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP; index += 1) {
    await mkdir(
      path.join(layout.missionsDir, `mission_load_${String(index).padStart(2, "0")}`),
      { recursive: true },
    );
  }

  await assert.rejects(
    () => repository.findOwningMissionId("ticket_inconnu"),
    new Error("Trop de missions pour une recherche exhaustive."),
  );
});
