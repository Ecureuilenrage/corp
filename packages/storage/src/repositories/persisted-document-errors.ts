import { readFile } from "node:fs/promises";

import type { ValidationResult } from "../../../contracts/src/guards/persisted-document-guards";
import {
  createFileSystemReadError,
  isFileSystemReadError,
  isMissingFileError,
} from "../fs-layout/file-system-read-errors";

export type PersistedDocumentErrorCode =
  | "json_corrompu"
  | "schema_invalide"
  | "erreur_fichier";

export interface PersistedDocumentContext {
  filePath: string;
  entityLabel: string;
  documentId?: string;
  corruptionLabel?: string;
}

export class CorruptedPersistedDocumentError extends Error {
  public readonly code = "json_corrompu" as const;
  public readonly filePath: string;
  public readonly entityLabel: string;
  public readonly documentId?: string;

  public constructor(
    context: PersistedDocumentContext,
    cause: SyntaxError,
  ) {
    super(
      formatPersistedDocumentMessage(
        "json_corrompu",
        {
          ...context,
          entityLabel: context.corruptionLabel ?? context.entityLabel,
        },
        "JSON corrompu",
      ),
      { cause },
    );
    this.name = "CorruptedPersistedDocumentError";
    this.filePath = context.filePath;
    this.entityLabel = context.entityLabel;
    this.documentId = context.documentId;
  }
}

export class InvalidPersistedDocumentError extends Error {
  public readonly code = "schema_invalide" as const;
  public readonly filePath: string;
  public readonly entityLabel: string;
  public readonly documentId?: string;
  public readonly reason: string;

  public constructor(
    context: PersistedDocumentContext,
    reason: string,
    cause: unknown = new Error(reason),
  ) {
    super(formatPersistedDocumentMessage("schema_invalide", context, reason), { cause });
    this.name = "InvalidPersistedDocumentError";
    this.filePath = context.filePath;
    this.entityLabel = context.entityLabel;
    this.documentId = context.documentId;
    this.reason = reason;
  }
}

export class PersistedDocumentFileSystemError extends Error {
  public readonly code = "erreur_fichier" as const;
  public readonly filePath: string;
  public readonly entityLabel: string;
  public readonly documentId?: string;
  public readonly osCode?: string;

  public constructor(
    context: PersistedDocumentContext,
    cause: NodeJS.ErrnoException,
  ) {
    const fileSystemError = createFileSystemReadError(cause, context.filePath, context.entityLabel);
    super(fileSystemError.message, { cause });
    this.name = "PersistedDocumentFileSystemError";
    this.filePath = context.filePath;
    this.entityLabel = context.entityLabel;
    this.documentId = context.documentId;
    this.osCode = fileSystemError.osCode;
  }
}

export type PersistedDocumentReadError =
  | CorruptedPersistedDocumentError
  | InvalidPersistedDocumentError
  | PersistedDocumentFileSystemError;

export type PersistedDocumentValidator<T> = (value: unknown) => ValidationResult<T>;

export async function readPersistedJsonDocument(
  context: PersistedDocumentContext,
): Promise<unknown> {
  let contents: string;

  try {
    contents = await readFile(context.filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw error;
    }

    if (isFileSystemReadError(error)) {
      throw new PersistedDocumentFileSystemError(context, error);
    }

    throw error;
  }

  try {
    return JSON.parse(stripUtf8Bom(contents)) as unknown;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new CorruptedPersistedDocumentError(context, error);
    }

    throw normalizePersistedDocumentReadError(error, context);
  }
}

export function assertValidPersistedDocument<T>(
  value: unknown,
  validator: PersistedDocumentValidator<T>,
  context: PersistedDocumentContext,
): asserts value is T {
  const validation = validator(value);

  if (!validation.ok) {
    throw new InvalidPersistedDocumentError(context, validation.reason);
  }
}

export function normalizePersistedDocumentReadError(
  error: unknown,
  context: PersistedDocumentContext,
): Error {
  if (isPersistedDocumentReadError(error) || isMissingFileError(error)) {
    return error as Error;
  }

  if (isFileSystemReadError(error)) {
    return new PersistedDocumentFileSystemError(context, error);
  }

  const message = formatUnexpectedPersistedDocumentReadMessage(context);
  return new Error(message, { cause: error });
}

export function isPersistedDocumentReadError(
  error: unknown,
): error is PersistedDocumentReadError {
  return error instanceof CorruptedPersistedDocumentError
    || error instanceof InvalidPersistedDocumentError
    || error instanceof PersistedDocumentFileSystemError;
}

export function isRecoverablePersistedDocumentError(
  error: unknown,
): error is CorruptedPersistedDocumentError | InvalidPersistedDocumentError {
  return error instanceof CorruptedPersistedDocumentError
    || error instanceof InvalidPersistedDocumentError;
}

function formatPersistedDocumentMessage(
  code: PersistedDocumentErrorCode,
  context: PersistedDocumentContext,
  reason: string,
): string {
  const documentId = context.documentId ? ` \`${context.documentId}\`` : "";

  return `${code}: ${context.entityLabel}${documentId} invalide (${context.filePath}): ${reason}.`;
}

function stripUtf8Bom(contents: string): string {
  return contents.startsWith("\uFEFF")
    ? contents.slice(1)
    : contents;
}

function formatUnexpectedPersistedDocumentReadMessage(
  context: PersistedDocumentContext,
): string {
  const documentId = context.documentId ? ` \`${context.documentId}\`` : "";

  return `Lecture du document persiste ${context.entityLabel}${documentId} irreconciliable (${context.filePath}).`;
}
