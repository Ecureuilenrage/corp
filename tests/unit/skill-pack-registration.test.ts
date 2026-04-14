import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { registerSkillPack } from "../../packages/skill-pack/src/loader/register-skill-pack";
import { resolveTicketSkillPacks } from "../../packages/skill-pack/src/loader/resolve-ticket-skill-packs";
import { ensureWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import { createFileSkillPackRegistryRepository } from "../../packages/storage/src/repositories/file-skill-pack-registry-repository";

function getFixtureRoot(): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions");
}

function getFixturePath(fileName: string): string {
  return path.join(getFixtureRoot(), fileName);
}

function createMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_skill_pack",
    title: "Mission skill pack",
    objective: "Verifier le chargement metadata-first d'un skill pack",
    status: "running",
    successCriteria: ["Le pack est resolu sans charger son contenu"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: ["ticket_skill_pack"],
    artifactIds: [],
    eventIds: ["event_mission_created"],
    resumeCursor: "event_mission_created",
    createdAt: "2026-04-13T20:00:00.000Z",
    updatedAt: "2026-04-13T20:00:00.000Z",
    ...overrides,
  };
}

function createTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket_skill_pack",
    missionId: "mission_skill_pack",
    kind: "implement",
    goal: "Mobiliser un skill pack local en runtime",
    status: "claimed",
    owner: "agent_skill_pack",
    dependsOn: [],
    successCriteria: ["Le runtime recoit un resume compact du pack"],
    allowedCapabilities: [],
    skillPackRefs: ["pack.triage.local"],
    workspaceIsolationId: "iso_skill_pack",
    executionHandle: {
      adapter: "codex_responses",
      adapterState: {},
    },
    artifactIds: [],
    eventIds: ["event_ticket_created"],
    createdAt: "2026-04-13T20:00:05.000Z",
    updatedAt: "2026-04-13T20:00:05.000Z",
    ...overrides,
  };
}

test("registerSkillPack persiste un skill pack valide de facon idempotente", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-register-unit-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileSkillPackRegistryRepository(layout);

  const firstResult = await registerSkillPack({
    filePath: getFixturePath("valid-skill-pack.json"),
    repository,
    registeredAt: "2026-04-13T20:10:00.000Z",
  });
  const storedSkillPack = await repository.findByPackRef("pack.triage.local");
  const secondResult = await registerSkillPack({
    filePath: getFixturePath("valid-skill-pack.json"),
    repository,
    registeredAt: "2026-04-13T20:10:01.000Z",
  });

  assert.equal(firstResult.status, "registered");
  assert.equal(secondResult.status, "unchanged");
  assert.ok(storedSkillPack);
  assert.equal(storedSkillPack.packRef, "pack.triage.local");
  assert.equal(storedSkillPack.registrationId, "ext.skill-pack.triage.local");
  assert.equal(storedSkillPack.displayName, "Pack de triage local");
  assert.deepEqual(storedSkillPack.permissions, ["docs.read"]);
  assert.deepEqual(storedSkillPack.constraints, ["local_only", "workspace_scoped"]);
  assert.equal(
    storedSkillPack.localRefs.rootDir,
    path.join(getFixtureRoot(), "skill-packs", "triage-pack"),
  );
  assert.deepEqual(storedSkillPack.localRefs.references, [
    path.join(getFixtureRoot(), "skill-packs", "triage-pack", "README.md"),
  ]);
  assert.equal(
    storedSkillPack.localRefs.metadataFile,
    path.join(getFixtureRoot(), "skill-packs", "triage-pack", "pack.json"),
  );
  assert.deepEqual(storedSkillPack.localRefs.scripts, [
    path.join(getFixtureRoot(), "skill-packs", "triage-pack", "scripts", "preflight.sh"),
  ]);
  assert.doesNotMatch(
    JSON.stringify(storedSkillPack),
    /echo "preflight"|Pack de triage local\./,
  );
  assert.equal((await repository.list()).length, 1);
});

test("registerSkillPack rejette un seam hors scope pour le flux skill-pack", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-wrong-seam-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileSkillPackRegistryRepository(layout);

  await assert.rejects(
    () =>
      registerSkillPack({
        filePath: getFixturePath("valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-13T20:15:00.000Z",
      }),
    /Seam non supporte.*capability/i,
  );
});

test("registerSkillPack rejette une ref locale qui sort du rootDir du pack", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-boundary-"));
  const copiedFixturesDir = path.join(tempDir, "fixtures", "extensions");
  const workspaceRoot = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await cp(getFixtureRoot(), copiedFixturesDir, { recursive: true });
  await writeFile(
    path.join(copiedFixturesDir, "skill-packs", "outside.md"),
    "outside\n",
    "utf8",
  );
  await writeFile(
    path.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"),
    `${JSON.stringify({
      schemaVersion: "corp.extension.v1",
      seamType: "skill_pack",
      id: "ext.skill-pack.outside-root",
      displayName: "Pack hors frontiere",
      version: "0.1.0",
      permissions: ["docs.read"],
      constraints: ["local_only", "workspace_scoped"],
      metadata: {
        description: "Fixture de test hors frontiere.",
        owner: "core-platform",
        tags: ["skill-pack", "invalid"],
      },
      localRefs: {
        rootDir: "./skill-packs/triage-pack",
        references: ["./skill-packs/triage-pack/../outside.md"],
        metadataFile: "./skill-packs/triage-pack/pack.json",
        scripts: [],
      },
      skillPack: {
        packRef: "pack.outside.root",
      },
    }, null, 2)}\n`,
    "utf8",
  );

  const layout = await ensureWorkspaceLayout(workspaceRoot);
  const repository = createFileSkillPackRegistryRepository(layout);

  await assert.rejects(
    () =>
      registerSkillPack({
        filePath: path.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"),
        repository,
        registeredAt: "2026-04-13T20:20:00.000Z",
      }),
    /frontiere locale/i,
  );
  assert.equal((await repository.list()).length, 0);
});

test("registerSkillPack detecte une collision ambigue quand le contenu differe pour le meme packRef", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-collision-"));
  const workspaceRoot = path.join(tempDir, "workspace");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(workspaceRoot);
  const repository = createFileSkillPackRegistryRepository(layout);

  await registerSkillPack({
    filePath: getFixturePath("valid-skill-pack.json"),
    repository,
    registeredAt: "2026-04-13T20:30:00.000Z",
  });

  const collisionManifestPath = path.join(tempDir, "collision-skill-pack.json");
  await writeFile(
    collisionManifestPath,
    `${JSON.stringify({
      schemaVersion: "corp.extension.v1",
      seamType: "skill_pack",
      id: "ext.skill-pack.collision",
      displayName: "Pack collision",
      version: "0.2.0",
      permissions: ["docs.read", "docs.write"],
      constraints: ["local_only", "workspace_scoped"],
      metadata: {
        description: "Fixture de test collision.",
        owner: "core-platform",
        tags: ["skill-pack", "collision"],
      },
      localRefs: {
        rootDir: "./skill-packs/triage-pack",
        references: ["./skill-packs/triage-pack/README.md"],
        metadataFile: "./skill-packs/triage-pack/pack.json",
        scripts: [],
      },
      skillPack: {
        packRef: "pack.triage.local",
      },
    }, null, 2)}\n`,
    "utf8",
  );

  await cp(
    path.join(getFixtureRoot(), "skill-packs"),
    path.join(tempDir, "skill-packs"),
    { recursive: true },
  );

  await assert.rejects(
    () =>
      registerSkillPack({
        filePath: collisionManifestPath,
        repository,
        registeredAt: "2026-04-13T20:30:01.000Z",
      }),
    /Collision ambigue.*pack\.triage\.local/i,
  );
  assert.equal((await repository.list()).length, 1);
});

test("resolveTicketSkillPacks deduplique les packRefs en double dans un ticket", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-dedup-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileSkillPackRegistryRepository(layout);

  await registerSkillPack({
    filePath: getFixturePath("valid-skill-pack.json"),
    repository,
    registeredAt: "2026-04-13T20:35:00.000Z",
  });

  const mission = createMission();
  const summaries = await resolveTicketSkillPacks({
    repository,
    mission,
    ticket: createTicket({ skillPackRefs: ["pack.triage.local", "pack.triage.local"] }),
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].packRef, "pack.triage.local");
});

test("resolveTicketSkillPacks retourne un resume compact et rejette les refs inconnues", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-skill-pack-resolve-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const repository = createFileSkillPackRegistryRepository(layout);

  await registerSkillPack({
    filePath: getFixturePath("valid-skill-pack.json"),
    repository,
    registeredAt: "2026-04-13T20:25:00.000Z",
  });

  const mission = createMission();
  const summaries = await resolveTicketSkillPacks({
    repository,
    mission,
    ticket: createTicket(),
  });

  assert.deepEqual(summaries, [
    {
      packRef: "pack.triage.local",
      displayName: "Pack de triage local",
      description: "Declare un skill pack local pret a etre charge plus tard par le runtime.",
      owner: "core-platform",
      tags: ["skill-pack", "local"],
      rootDir: path.join(getFixtureRoot(), "skill-packs", "triage-pack"),
      references: [
        path.join(getFixtureRoot(), "skill-packs", "triage-pack", "README.md"),
      ],
      metadataFile: path.join(getFixtureRoot(), "skill-packs", "triage-pack", "pack.json"),
      scripts: [
        path.join(getFixtureRoot(), "skill-packs", "triage-pack", "scripts", "preflight.sh"),
      ],
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(summaries),
    /Pack de triage local\.|echo "preflight"/,
  );

  const emptySummaries = await resolveTicketSkillPacks({
    repository,
    mission,
    ticket: createTicket({ skillPackRefs: [] }),
  });
  assert.deepEqual(emptySummaries, []);

  await assert.rejects(
    () =>
      resolveTicketSkillPacks({
        repository,
        mission,
        ticket: createTicket({ skillPackRefs: ["pack.unknown"] }),
      }),
    /Skill pack introuvable.*pack\.unknown/i,
  );
});
