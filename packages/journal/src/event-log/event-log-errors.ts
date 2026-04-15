import {
  formatFileSystemReadError,
  isErrnoException,
  isFileSystemReadError,
  isMissingFileError,
} from "../../../storage/src/fs-layout/file-system-read-errors";

export type EventLogReadErrorCode =
  | "journal_manquant"
  | "journal_invalide"
  | "erreur_fichier";

export class EventLogReadError extends Error {
  public readonly code: EventLogReadErrorCode;
  public readonly journalPath: string;
  public readonly lineNumber?: number;
  public readonly osCode?: string;

  private constructor(options: {
    code: EventLogReadErrorCode;
    message: string;
    journalPath: string;
    lineNumber?: number;
    osCode?: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "EventLogReadError";
    this.code = options.code;
    this.journalPath = options.journalPath;
    this.lineNumber = options.lineNumber;
    this.osCode = options.osCode;
  }

  public static missing(journalPath: string, cause?: unknown): EventLogReadError {
    return new EventLogReadError({
      code: "journal_manquant",
      journalPath,
      cause,
      message:
        `journal_manquant: journal append-only manquant: ${journalPath}. `
        + "Relancez `corp mission bootstrap` ou restaurez le journal.",
    });
  }

  public static invalid(options: {
    journalPath: string;
    lineNumber: number;
    reason: string;
    cause?: unknown;
  }): EventLogReadError {
    return new EventLogReadError({
      code: "journal_invalide",
      journalPath: options.journalPath,
      lineNumber: options.lineNumber,
      cause: options.cause,
      message:
        `journal_invalide: journal append-only invalide a la ligne ${options.lineNumber} `
        + `(${options.journalPath}): ${options.reason}.`,
    });
  }

  public static fileSystem(
    journalPath: string,
    cause: NodeJS.ErrnoException,
  ): EventLogReadError {
    return new EventLogReadError({
      code: "erreur_fichier",
      journalPath,
      osCode: typeof cause.code === "string" ? cause.code : undefined,
      cause,
      message: formatFileSystemReadError(cause, journalPath, "journal append-only"),
    });
  }
}

export function normalizeEventLogReadError(
  error: unknown,
  journalPath: string,
): Error {
  if (error instanceof EventLogReadError) {
    return error;
  }

  if (isMissingFileError(error)) {
    return EventLogReadError.missing(journalPath, error);
  }

  if (isFileSystemReadError(error)) {
    return EventLogReadError.fileSystem(journalPath, error);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export function isEventLogReadError(error: unknown): error is EventLogReadError {
  return error instanceof EventLogReadError;
}

export function isEventLogFileSystemError(error: unknown): boolean {
  return isErrnoException(error) && isFileSystemReadError(error);
}
