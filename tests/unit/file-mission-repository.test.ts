import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, unlink as unlinkFile, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { Mission } from "../../packages/contracts/src/mission/mission";
import { ensureWorkspaceLayout } from "../../packages/storage/src/fs-layout/workspace-layout";
import { writeJsonAtomic } from "../../packages/storage/src/fs-layout/atomic-json";
import {
  CorruptedPersistedDocumentError,
} from "../../packages/storage/src/repositories/persisted-document-errors";
import {
  cleanupStaleMissionLocks,
  DEFAULT_MISSION_LOCK_STALE_TTL_MS,
  FileMissionRepository,
  createFileMissionRepository,
} from "../../packages/storage/src/repositories/file-mission-repository";

function createMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_lock_test",
    title: "Mission lock test",
    objective: "Durcir saveIfUnchanged",
    status: "ready",
    successCriteria: ["Les locks sont sains"],
    policyProfileId: "policy_profile_local",
    authorizedExtensions: {
      allowedCapabilities: [],
      skillPackRefs: [],
    },
    ticketIds: [],
    artifactIds: [],
    eventIds: ["event_lock_1"],
    resumeCursor: "event_lock_1",
    createdAt: "2026-04-16T10:00:00.000Z",
    updatedAt: "2026-04-16T10:00:00.000Z",
    ...overrides,
  };
}

test("cleanupStaleMissionLocks supprime seulement les locks depassant le TTL", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lock-cleanup-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const staleLockPath = path.join(layout.missionsDir, "mission_stale", "mission.json.lock");
  const freshLockPath = path.join(layout.missionsDir, "mission_fresh", "mission.json.lock");
  const now = new Date("2026-04-16T12:00:00.000Z");
  const warnings: string[] = [];

  await mkdir(path.dirname(staleLockPath), { recursive: true });
  await mkdir(path.dirname(freshLockPath), { recursive: true });
  await writeFile(staleLockPath, "", "utf8");
  await writeFile(freshLockPath, "", "utf8");
  await utimes(staleLockPath, new Date("2026-04-16T11:00:00.000Z"), new Date("2026-04-16T11:00:00.000Z"));
  await utimes(freshLockPath, new Date("2026-04-16T11:58:00.000Z"), new Date("2026-04-16T11:58:00.000Z"));

  const removedLockPaths = await cleanupStaleMissionLocks(layout, {
    lockStaleTtlMs: DEFAULT_MISSION_LOCK_STALE_TTL_MS,
    now: () => now,
    warn: (message) => warnings.push(message),
  });

  assert.deepEqual(removedLockPaths, [staleLockPath]);
  await assert.rejects(() => access(staleLockPath), /ENOENT/);
  await access(freshLockPath);
  assert.match(warnings.join("\n"), /Lock stale supprime pour la mission `mission_stale`/);
});

test("saveIfUnchanged preserve l'erreur primaire et ne laisse pas le lock en place si unlink echoue ensuite", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lock-primary-error-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const initialMission = createMission();
  const updatedMission = createMission({
    title: "Mission mise a jour",
    resumeCursor: "event_lock_2",
    eventIds: ["event_lock_1", "event_lock_2"],
    updatedAt: "2026-04-16T10:05:00.000Z",
  });
  const missionPath = path.join(layout.missionsDir, initialMission.id, "mission.json");
  const lockPath = `${missionPath}.lock`;
  const warnings: string[] = [];
  const primaryError = Object.assign(new Error("ENOSPC: disk full"), { code: "ENOSPC" });

  await createFileMissionRepository(layout).save(initialMission);

  const repository = new FileMissionRepository(layout, {
    writeMissionJson: (async (..._args) => {
      throw primaryError;
    }) as typeof writeJsonAtomic,
    removeLockFile: (async (target) => {
      await unlinkFile(target);
      const secondaryError = new Error("EACCES: permission denied while releasing lock") as NodeJS.ErrnoException;
      secondaryError.code = "EACCES";
      throw secondaryError;
    }) as typeof unlinkFile,
    warn: (message) => warnings.push(message),
  });

  await assert.rejects(
    () => repository.saveIfUnchanged(updatedMission, initialMission),
    (error: unknown) => error === primaryError,
  );
  await assert.rejects(() => access(lockPath), /ENOENT/);
  assert.match(warnings.join("\n"), /Liberation du lock mission echouee apres une erreur primaire/);
});

test("saveIfUnchanged propage une mission corrompue lue sous lock puis libere le lock", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-lock-corrupted-read-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const layout = await ensureWorkspaceLayout(rootDir);
  const mission = createMission({ id: "mission_corrupted_lock" });
  const missionPath = path.join(layout.missionsDir, mission.id, "mission.json");
  const lockPath = `${missionPath}.lock`;

  await mkdir(path.dirname(missionPath), { recursive: true });
  await writeFile(missionPath, "{json invalide\n", "utf8");

  await assert.rejects(
    () => createFileMissionRepository(layout).saveIfUnchanged(mission, mission),
    (error: unknown) => {
      assert.ok(error instanceof CorruptedPersistedDocumentError);
      assert.equal(error.filePath, missionPath);
      return true;
    },
  );
  await assert.rejects(() => access(lockPath), /ENOENT/);
});
