import { randomUUID } from "node:crypto";
import { rename, unlink, writeFile } from "node:fs/promises";

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const serializedValue = JSON.stringify(value, null, 2);

  if (serializedValue === undefined) {
    throw new Error("Impossible de serialiser une valeur JSON undefined.");
  }

  // journal-as-source-of-truth : ce helper assure une ecriture best-effort ; si le
  // rename echoue, on supprime explicitement le fichier temporaire (chemin prefere ou
  // chemin UUID fallback) pour eviter tout orphelin sur disque. Voir
  // docs/architecture/journal-as-source-of-truth.md et Story 5.1.1 AC3.
  const temporaryPath = await writeTemporaryJsonFile(filePath, `${serializedValue}\n`);

  try {
    await renameWithTransientRetry(temporaryPath, filePath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch {
      // Best-effort cleanup: preserve the original write/rename failure.
    }

    throw error;
  }
}

async function renameWithTransientRetry(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rename(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!isTransientRenameError(error)) {
        throw error;
      }

      lastError = error;
      await delay(5 * (attempt + 1));
    }
  }

  throw lastError;
}

async function writeTemporaryJsonFile(filePath: string, contents: string): Promise<string> {
  const preferredTemporaryPath = `${filePath}.tmp`;

  try {
    await writeFile(preferredTemporaryPath, contents, { encoding: "utf8", flag: "wx" });
    return preferredTemporaryPath;
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }

  const contendedTemporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  await writeFile(contendedTemporaryPath, contents, { encoding: "utf8", flag: "wx" });
  return contendedTemporaryPath;
}

export function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "EEXIST";
}

function isTransientRenameError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (
      error.code === "EACCES"
      || error.code === "EBUSY"
      || error.code === "EPERM"
    );
}

async function delay(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
