import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  readExtensionRegistrationFile,
} from "../../packages/capability-registry/src/validation/read-extension-registration-file";

function getFixturePath(fileName: string): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
}

test("readExtensionRegistrationFile resolve les refs locales relativement au fichier de declaration", async () => {
  const result = await readExtensionRegistrationFile(
    getFixturePath("valid-capability-local.json"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.filePath, getFixturePath("valid-capability-local.json"));
  assert.equal(
    result.resolvedLocalRefs?.entrypoint,
    path.join(process.cwd(), "tests", "fixtures", "extensions", "capabilities", "shell-exec.ts"),
  );
  assert.deepEqual(result.resolvedLocalRefs?.references, [
    path.join(process.cwd(), "tests", "fixtures", "extensions", "docs", "capability-local.md"),
  ]);
});

test("readExtensionRegistrationFile remonte un diagnostic structure quand une ref locale manque", async () => {
  const result = await readExtensionRegistrationFile(
    getFixturePath("invalid-missing-local-ref.json"),
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "missing_local_ref"
      && diagnostic.path === "localRefs.entrypoint"
    ),
  );
});

test("readExtensionRegistrationFile remonte un diagnostic stable quand le JSON est invalide", async (t) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "corp-extension-json-"));
  const invalidFilePath = path.join(tempDir, "invalid.json");

  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  await writeFile(invalidFilePath, "{invalid", "utf8");

  const result = await readExtensionRegistrationFile(invalidFilePath);

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "invalid_json"
      && diagnostic.path === "$"
    ),
  );
});
