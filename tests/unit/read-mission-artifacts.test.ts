import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  MAX_PREVIEW_BYTES,
  readPayloadPreview,
} from "../../packages/mission-kernel/src/resume-service/read-mission-artifacts";

test("readPayloadPreview lit un payload volumineux de maniere bornee sans casser l'utf8", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-read-payload-preview-"));
  const payloadPath = path.join(rootDir, "payload.txt");
  const requestedLengths: number[] = [];

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeFile(payloadPath, `${"€".repeat(5000)}suffix`, "utf8");

  const preview = await readPayloadPreview(rootDir, "payload.txt", "text/plain", {
    openFile: async (filePath, flags) => {
      const handle = await open(filePath, flags ?? "r");

      return {
        read: async (
          buffer: Buffer<ArrayBufferLike>,
          offset: number,
          length: number,
          position: number | null,
        ) => {
          requestedLengths.push(length);
          return handle.read(buffer, offset, length, position);
        },
        close: async () => handle.close(),
      };
    },
  });

  assert.deepEqual(requestedLengths, [MAX_PREVIEW_BYTES]);
  assert.ok(preview);
  assert.ok(preview.length <= 240);
  assert.doesNotMatch(preview, /�/);
  assert.match(preview, /^€+/);
});

test("readPayloadPreview retourne null seulement pour ENOENT", async () => {
  const preview = await readPayloadPreview("C:/tmp", "payload.txt", "text/plain", {
    openFile: async () => {
      const error = new Error("ENOENT: missing payload") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    },
  });

  assert.equal(preview, null);
});

test("readPayloadPreview remonte EACCES comme erreur_fichier au lieu d'un null silencieux", async () => {
  await assert.rejects(
    () => readPayloadPreview("C:/tmp", "payload.txt", "text/plain", {
      openFile: async () => {
        const error = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as Error & { code?: string }).code, "erreur_fichier");
      assert.match(error.message, /EACCES/);
      assert.match(error.message, /payload\.txt/);
      return true;
    },
  );
});
