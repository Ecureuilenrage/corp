import assert from "node:assert/strict";
import test from "node:test";

import { isFileSystemReadError } from "../../packages/storage/src/fs-layout/file-system-read-errors";

for (const osCode of ["EBUSY", "ETIMEDOUT"] as const) {
  test(`isFileSystemReadError classe ${osCode} comme erreur de lecture`, () => {
    const error = new Error(`${osCode}: simulated`) as NodeJS.ErrnoException;
    error.code = osCode;

    assert.equal(isFileSystemReadError(error), true);
  });
}
