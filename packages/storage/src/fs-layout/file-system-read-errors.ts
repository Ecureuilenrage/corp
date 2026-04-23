export const FILE_SYSTEM_READ_ERROR_CODES = new Set([
  "ENOENT",
  "EACCES",
  "EPERM",
  "EIO",
  "EMFILE",
  "ENOSPC",
  "EBUSY",
  "ETIMEDOUT",
  "EROFS",
  "EISDIR",
]);

export interface ClassifiedFileSystemError extends Error {
  code: "erreur_fichier";
  osCode?: string;
  filePath: string;
}

export function createFileSystemReadError(
  error: NodeJS.ErrnoException,
  filePath: string,
  label = "fichier",
): ClassifiedFileSystemError {
  return Object.assign(
    new Error(formatFileSystemReadError(error, filePath, label), { cause: error }),
    {
      code: "erreur_fichier" as const,
      osCode: typeof error.code === "string" ? error.code : undefined,
      filePath,
    },
  );
}

export function formatFileSystemReadError(
  error: NodeJS.ErrnoException,
  filePath: string,
  label = "fichier",
): string {
  const osCode = typeof error.code === "string" ? error.code : "UNKNOWN";
  const detail = error.message.trim() || "erreur inconnue";

  return `erreur_fichier: erreur de lecture ${label} (${osCode}) sur ${filePath}: ${detail}`;
}

export function isFileSystemReadError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return isErrnoException(error)
    && typeof error.code === "string"
    && FILE_SYSTEM_READ_ERROR_CODES.has(error.code);
}

export function isMissingFileError(error: unknown): boolean {
  return isErrnoException(error) && error.code === "ENOENT";
}

export function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object"
    && error !== null
    && "code" in error;
}

export async function readAccessError(
  accessFile: () => Promise<void>,
): Promise<NodeJS.ErrnoException | null> {
  try {
    await accessFile();
    return null;
  } catch (error) {
    if (isErrnoException(error)) {
      return error;
    }

    throw error;
  }
}
