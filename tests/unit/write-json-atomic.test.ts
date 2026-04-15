import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { writeJsonAtomic } from "../../packages/storage/src/fs-layout/atomic-json";

// On reutilise le meme objet module que celui resolu par atomic-json.ts : en CJS,
// `require` retourne l'instance cachee, ce qui permet a t.mock.method de substituer
// la methode effectivement appelee depuis renameWithTransientRetry.
import fsPromises = require("node:fs/promises");

test("writeJsonAtomic ecrit un JSON formate via un fichier temporaire", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-write-json-atomic-success-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const targetPath = path.join(rootDir, "snapshot.json");

  await writeJsonAtomic(targetPath, { answer: 42, nested: { ok: true } });

  assert.equal(
    await readFile(targetPath, "utf8"),
    `${JSON.stringify({ answer: 42, nested: { ok: true } }, null, 2)}\n`,
  );
});

test("writeJsonAtomic nettoie le temporaire et laisse la cible intacte si rename echoue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-write-json-atomic-rename-fail-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const targetPath = path.join(rootDir, "snapshot.json");
  const targetMarkerPath = path.join(targetPath, "marker.txt");
  const temporaryPath = `${targetPath}.tmp`;

  await mkdir(targetPath);
  await writeFile(targetMarkerPath, "target-still-here", "utf8");

  await assert.rejects(() => writeJsonAtomic(targetPath, { next: true }));

  assert.equal(await readFile(targetMarkerPath, "utf8"), "target-still-here");
  await assert.rejects(() => readFile(temporaryPath, "utf8"), /ENOENT/);
});

test("writeJsonAtomic nettoie le fallback UUID si rename echoue et ne laisse aucun orphelin", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-write-json-atomic-uuid-fallback-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const targetPath = path.join(rootDir, "snapshot.json");
  const preferredTemporaryPath = `${targetPath}.tmp`;

  await mkdir(targetPath);
  await writeFile(path.join(targetPath, "marker.txt"), "target-is-a-dir", "utf8");
  await writeFile(preferredTemporaryPath, "contention", "utf8");

  await assert.rejects(() => writeJsonAtomic(targetPath, { fallback: true }));

  const residualEntries = await readdir(rootDir);
  const residualTmp = residualEntries.filter((entry) => entry.endsWith(".tmp") && entry !== "snapshot.json.tmp");

  assert.equal(
    residualTmp.length,
    0,
    `Un temporaire UUID a ete laisse orphelin: ${residualTmp.join(", ")}`,
  );

  assert.equal(await readFile(path.join(targetPath, "marker.txt"), "utf8"), "target-is-a-dir");
  assert.equal(await readFile(preferredTemporaryPath, "utf8"), "contention");
});

test("writeJsonAtomic recupere d'un rename transient EPERM apres deux retries", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-write-json-atomic-eperm-retry-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const targetPath = path.join(rootDir, "snapshot.json");
  const originalRename = fsPromises.rename;
  let attempts = 0;

  t.mock.method(fsPromises, "rename", async (
    src: Parameters<typeof fsPromises.rename>[0],
    dst: Parameters<typeof fsPromises.rename>[1],
  ) => {
    attempts += 1;
    if (attempts <= 2) {
      throw Object.assign(new Error("EPERM simule (transient)"), { code: "EPERM" });
    }
    return originalRename(src, dst);
  });

  await writeJsonAtomic(targetPath, { retry: "ok", attempt: 3 });

  assert.equal(attempts, 3);
  assert.equal(
    await readFile(targetPath, "utf8"),
    `${JSON.stringify({ retry: "ok", attempt: 3 }, null, 2)}\n`,
  );
  // Aucun .tmp residuel.
  const residualEntries = await readdir(rootDir);
  assert.deepEqual(residualEntries.sort(), ["snapshot.json"]);
});

test("writeJsonAtomic nettoie le temporaire et propage l'erreur apres epuisement du budget retry", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-write-json-atomic-eperm-exhausted-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const targetPath = path.join(rootDir, "snapshot.json");
  let attempts = 0;

  t.mock.method(fsPromises, "rename", async () => {
    attempts += 1;
    throw Object.assign(new Error("EPERM simule (persistant)"), { code: "EPERM" });
  });

  await assert.rejects(
    () => writeJsonAtomic(targetPath, { retry: "ko" }),
    (error: unknown) =>
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as Record<string, unknown>).code === "EPERM",
  );

  // Le retry boucle est borne a 10 attempts dans renameWithTransientRetry.
  assert.equal(attempts, 10);

  const residualEntries = await readdir(rootDir);
  assert.deepEqual(residualEntries, []);
});

test("writeJsonAtomic supporte 10 ecritures concurrentes sans JSON tronque", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-write-json-atomic-concurrent-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const targetPath = path.join(rootDir, "projection.json");

  await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      writeJsonAtomic(targetPath, {
        schemaVersion: 1,
        writer: index,
        payload: `value-${index}`,
      })
    ),
  );

  const parsed = JSON.parse(await readFile(targetPath, "utf8")) as {
    schemaVersion?: unknown;
    writer?: unknown;
    payload?: unknown;
  };

  assert.equal(parsed.schemaVersion, 1);
  assert.equal(typeof parsed.writer, "number");
  assert.equal(typeof parsed.payload, "string");
});
