import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ExtensionRegistrationDiagnostic } from "../../../contracts/src/extension/extension-registration";
import {
  validateExtensionRegistration,
  type ExtensionRegistrationValidationResult,
} from "./validate-extension-registration";

export interface ExtensionRegistrationFileReadResult
  extends ExtensionRegistrationValidationResult {
  filePath: string;
}

export async function readExtensionRegistrationFile(
  filePath: string,
): Promise<ExtensionRegistrationFileReadResult> {
  const resolvedFilePath = path.resolve(filePath);

  let fileContents: string;

  try {
    fileContents = await readFile(resolvedFilePath, "utf8");
  } catch (error) {
    return {
      filePath: resolvedFilePath,
      ok: false,
      diagnostics: [
        buildDiagnostic(
          "missing_file",
          "$",
          error instanceof Error
            ? `Impossible de lire le manifeste: ${error.message}`
            : "Impossible de lire le manifeste.",
        ),
      ],
      registration: null,
      resolvedLocalRefs: null,
    };
  }

  let parsedManifest: unknown;

  try {
    parsedManifest = JSON.parse(fileContents) as unknown;
  } catch (error) {
    return {
      filePath: resolvedFilePath,
      ok: false,
      diagnostics: [
        buildDiagnostic(
          "invalid_json",
          "$",
          error instanceof Error
            ? `Le fichier n'est pas un JSON valide: ${error.message}`
            : "Le fichier n'est pas un JSON valide.",
        ),
      ],
      registration: null,
      resolvedLocalRefs: null,
    };
  }

  return {
    filePath: resolvedFilePath,
    ...validateExtensionRegistration(parsedManifest, {
      sourcePath: resolvedFilePath,
    }),
  };
}

function buildDiagnostic(
  code: string,
  fieldPath: string,
  message: string,
): ExtensionRegistrationDiagnostic {
  return {
    code,
    path: fieldPath,
    message,
  };
}
