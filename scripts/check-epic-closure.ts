import { readFile } from "node:fs/promises";
import path from "node:path";

interface DevelopmentStatusEntry {
  key: string;
  lineNumber: number;
  value: string;
}

interface ParseDevelopmentStatusResult {
  entries: DevelopmentStatusEntry[];
  warnings: string[];
}

type EpicInspectionMode = "historical-done" | "pre-transition";

interface EpicStatus {
  epicKey: string;
  epicNumber: string;
  epicValue: string;
  mode: EpicInspectionMode;
  retrospectiveKey: string;
  retrospectiveStatus?: string;
  storyEntries: DevelopmentStatusEntry[];
}

interface EpicClosureCheckResult {
  errors: string[];
  warnings: string[];
  inspectedEpicKeys: string[];
  ok: boolean;
}

function isEpicKey(key: string): boolean {
  return /^epic-\d+$/.test(key);
}

function isEpicRetrospectiveKey(key: string): boolean {
  return /^epic-\d+-retrospective$/.test(key);
}

function isStoryKey(key: string): boolean {
  return /^\d+-\d+-/.test(key);
}

function parseEpicNumberFromEpicKey(epicKey: string): string {
  return epicKey.replace("epic-", "");
}

function stripInlineComment(rawValue: string): string {
  let inSingleQuotedScalar = false;
  let inDoubleQuotedScalar = false;
  let result = "";

  for (let index = 0; index < rawValue.length; index += 1) {
    const currentChar = rawValue[index];
    const nextChar = rawValue[index + 1];

    if (
      currentChar === "#"
      && !inSingleQuotedScalar
      && !inDoubleQuotedScalar
      && (index === 0 || /\s/.test(rawValue[index - 1]))
    ) {
      break;
    }

    result += currentChar;

    if (currentChar === "'" && !inDoubleQuotedScalar) {
      if (inSingleQuotedScalar && nextChar === "'") {
        result += nextChar;
        index += 1;
        continue;
      }

      inSingleQuotedScalar = !inSingleQuotedScalar;
      continue;
    }

    if (currentChar === "\"" && !inSingleQuotedScalar) {
      let backslashCount = 0;

      for (let cursor = index - 1; cursor >= 0 && rawValue[cursor] === "\\"; cursor -= 1) {
        backslashCount += 1;
      }

      if (backslashCount % 2 === 0) {
        inDoubleQuotedScalar = !inDoubleQuotedScalar;
      }
    }
  }

  return result.trim();
}

function unwrapQuotedScalar(value: string): string {
  if (value.length < 2) {
    return value;
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }

  return value;
}

function normalizeYamlScalar(rawValue: string): string {
  return unwrapQuotedScalar(stripInlineComment(rawValue).trim());
}

function parseDevelopmentStatusEntries(fileContents: string): ParseDevelopmentStatusResult {
  const lines = fileContents.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) => line.trim() === "development_status:");

  if (sectionIndex === -1) {
    throw new Error("Section `development_status` introuvable dans sprint-status.yaml.");
  }

  const rawEntries: DevelopmentStatusEntry[] = [];
  const duplicateLineNumbersByKey = new Map<string, number[]>();

  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }

    if (!/^[ \t]/.test(line)) {
      break;
    }

    const indentation = /^[ \t]+/.exec(line)?.[0] ?? "";

    if (indentation !== "  ") {
      throw new Error(
        `indentation invalide dans development_status, attendu 2 espaces (ligne ${index + 1}).`,
      );
    }

    const payload = line.slice(2);
    const entryMatch = /^([A-Za-z0-9][A-Za-z0-9-]*):(?:\s*(.*))?$/.exec(payload);

    if (entryMatch === null) {
      throw new Error(
        `entree development_status invalide a la ligne ${index + 1}: ${payload.trim()}`,
      );
    }

    const key = entryMatch[1];
    const value = normalizeYamlScalar(entryMatch[2] ?? "");

    if (value === "") {
      throw new Error(`valeur vide dans development_status pour \`${key}\` (ligne ${index + 1}).`);
    }

    rawEntries.push({
      key,
      lineNumber: index + 1,
      value,
    });

    const duplicateLines = duplicateLineNumbersByKey.get(key) ?? [];
    duplicateLines.push(index + 1);
    duplicateLineNumbersByKey.set(key, duplicateLines);
  }

  const lastRawIndexByKey = new Map<string, number>();

  rawEntries.forEach((entry, rawIndex) => {
    lastRawIndexByKey.set(entry.key, rawIndex);
  });

  const entries = rawEntries.filter(
    (entry, rawIndex) => lastRawIndexByKey.get(entry.key) === rawIndex,
  );
  const warnings = [...duplicateLineNumbersByKey.entries()]
    .filter(([, lineNumbers]) => lineNumbers.length > 1)
    .map(([key, lineNumbers]) => {
      const lastLineNumber = lineNumbers[lineNumbers.length - 1];

      return `development_status: cle dupliquee \`${key}\` detectee aux lignes ${lineNumbers.join(", ")}; derniere valeur conservee (ligne ${lastLineNumber}).`;
    });

  return {
    entries,
    warnings,
  };
}

function buildInspectableEpicStatuses(entries: DevelopmentStatusEntry[]): EpicStatus[] {
  const epicStatuses: EpicStatus[] = [];

  for (const entry of entries) {
    if (!isEpicKey(entry.key)) {
      continue;
    }

    const epicNumber = parseEpicNumberFromEpicKey(entry.key);
    const retrospectiveKey = `epic-${epicNumber}-retrospective`;
    const storyEntries = entries.filter(
      (candidate) => isStoryKey(candidate.key) && candidate.key.startsWith(`${epicNumber}-`),
    );
    const retrospectiveEntry = entries.find(
      (candidate) => isEpicRetrospectiveKey(candidate.key) && candidate.key === retrospectiveKey,
    );

    if (entry.value === "done") {
      epicStatuses.push({
        epicKey: entry.key,
        epicNumber,
        epicValue: entry.value,
        mode: "historical-done",
        retrospectiveKey,
        retrospectiveStatus: retrospectiveEntry?.value,
        storyEntries,
      });
      continue;
    }

    if (
      entry.value === "in-progress"
      && storyEntries.length > 0
      && storyEntries.every((storyEntry) => storyEntry.value === "done")
    ) {
      epicStatuses.push({
        epicKey: entry.key,
        epicNumber,
        epicValue: entry.value,
        mode: "pre-transition",
        retrospectiveKey,
        retrospectiveStatus: retrospectiveEntry?.value,
        storyEntries,
      });
    }
  }

  return epicStatuses;
}

function extractStoryHeader(fileContents: string): string {
  const lines = fileContents.split(/\r?\n/);
  const headerLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ") || line.trim() === "---") {
      break;
    }

    headerLines.push(line);
  }

  return headerLines.join("\n");
}

async function readStoryFileStatus(
  implementationDir: string,
  storyKey: string,
): Promise<string | undefined> {
  const filePath = path.join(implementationDir, `${storyKey}.md`);
  const fileContents = await readFile(filePath, "utf8");
  const headerContents = extractStoryHeader(fileContents);
  const statusMatches = [...headerContents.matchAll(/^Status:\s*(.+?)\s*$/gm)];

  if (statusMatches.length === 0) {
    return undefined;
  }

  const lastStatus = statusMatches[statusMatches.length - 1];
  return lastStatus[1].trim();
}

function buildEpicErrorPrefix(epicStatus: EpicStatus): string {
  if (epicStatus.mode === "pre-transition") {
    return `${epicStatus.epicKey}: epic pret a clore mais desynchronise`;
  }

  return epicStatus.epicKey;
}

function formatStoryTrackerError(epicStatus: EpicStatus, storyEntry: DevelopmentStatusEntry): string {
  return `${buildEpicErrorPrefix(epicStatus)}: la story ${storyEntry.key} vaut ${storyEntry.value} dans sprint-status.yaml (attendu: done avant cloture d'epic).`;
}

function formatStoryReadError(epicStatus: EpicStatus, storyKey: string, error: unknown): string {
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  if (errorCode === "ENOENT") {
    return `${buildEpicErrorPrefix(epicStatus)} - story file ${storyKey}.md introuvable (ENOENT).`;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return `${buildEpicErrorPrefix(epicStatus)} - impossible de lire le story file ${storyKey}.md (${errorMessage}).`;
}

function formatStoryStatusError(
  epicStatus: EpicStatus,
  storyEntry: DevelopmentStatusEntry,
  storyFileStatus: string | undefined,
): string {
  const statusLabel = storyFileStatus ?? "(absent)";

  if (epicStatus.mode === "pre-transition") {
    return `${buildEpicErrorPrefix(epicStatus)} - la story ${storyEntry.key} declare Status: ${statusLabel} dans son fichier Markdown (tracker=${storyEntry.value}, attendu: done avant passage a done).`;
  }

  return `${buildEpicErrorPrefix(epicStatus)}: la story ${storyEntry.key} declare Status: ${statusLabel} dans son fichier Markdown (tracker=${storyEntry.value}, attendu: done).`;
}

function formatRetrospectiveError(epicStatus: EpicStatus): string {
  const retrospectiveStatus = epicStatus.retrospectiveStatus ?? "(absent)";

  if (epicStatus.mode === "pre-transition") {
    return `${buildEpicErrorPrefix(epicStatus)} - la retrospective ${epicStatus.retrospectiveKey} vaut ${retrospectiveStatus} (attendu: done avant cloture).`;
  }

  return `${buildEpicErrorPrefix(epicStatus)}: la retrospective ${epicStatus.retrospectiveKey} vaut ${retrospectiveStatus} (attendu: done).`;
}

async function validateEpicStatus(
  implementationDir: string,
  epicStatus: EpicStatus,
): Promise<string[]> {
  const errors: string[] = [];

  for (const storyEntry of epicStatus.storyEntries) {
    if (epicStatus.mode === "historical-done" && storyEntry.value !== "done") {
      errors.push(formatStoryTrackerError(epicStatus, storyEntry));
      continue;
    }

    let storyFileStatus: string | undefined;

    try {
      storyFileStatus = await readStoryFileStatus(implementationDir, storyEntry.key);
    } catch (error) {
      errors.push(formatStoryReadError(epicStatus, storyEntry.key, error));
      continue;
    }

    if (storyFileStatus !== "done") {
      errors.push(formatStoryStatusError(epicStatus, storyEntry, storyFileStatus));
    }
  }

  if (epicStatus.retrospectiveStatus !== "done") {
    errors.push(formatRetrospectiveError(epicStatus));
  }

  return errors;
}

export async function checkEpicClosure(rootDir: string): Promise<EpicClosureCheckResult> {
  const implementationDir = path.join(rootDir, "_bmad-output", "implementation");
  const sprintStatusPath = path.join(implementationDir, "sprint-status.yaml");
  const sprintStatusContents = await readFile(sprintStatusPath, "utf8");
  const parseResult = parseDevelopmentStatusEntries(sprintStatusContents);
  const epicStatuses = buildInspectableEpicStatuses(parseResult.entries);
  const warnings = [...parseResult.warnings];
  const errors: string[] = [];

  for (const epicStatus of epicStatuses) {
    if (epicStatus.mode === "historical-done" && epicStatus.storyEntries.length === 0) {
      warnings.push(
        `${epicStatus.epicKey}: aucune story associee dans development_status alors que l'epic est declare done.`,
      );
    }

    errors.push(...await validateEpicStatus(implementationDir, epicStatus));
  }

  return {
    errors,
    warnings,
    inspectedEpicKeys: epicStatuses.map((epicStatus) => epicStatus.epicKey),
    ok: errors.length === 0,
  };
}

function formatWarnings(warnings: string[]): string[] {
  return warnings.map((warning) => `Avertissement: ${warning}`);
}

function formatSuccess(result: EpicClosureCheckResult): string[] {
  const lines = ["Verification cloture epic: ok", ...formatWarnings(result.warnings)];

  if (result.inspectedEpicKeys.length === 0) {
    lines.push("Aucun epic en statut done ou pret a clore a verifier.");
    return lines;
  }

  lines.push(`Epics verifies: ${result.inspectedEpicKeys.join(", ")}`);
  return lines;
}

function formatFailure(result: EpicClosureCheckResult): string[] {
  return [
    "Verification cloture epic: echec",
    ...formatWarnings(result.warnings),
    ...result.errors.map((error) => `- ${error}`),
  ];
}

function usageLine(): string {
  return "Usage: node dist/scripts/check-epic-closure.js [--root <workspace> | --root=<workspace>]";
}

function parseRootDirFromArgs(args: string[]): string {
  let rootDir = process.cwd();

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];

    if (currentArg === "--root") {
      const nextArg = args[index + 1];

      if (nextArg === undefined || nextArg.startsWith("--")) {
        throw new Error("L'option --root requiert un chemin.");
      }

      rootDir = path.resolve(nextArg);
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--root=")) {
      const rawRootDir = currentArg.slice("--root=".length);

      if (rawRootDir.trim() === "") {
        throw new Error("L'option --root requiert un chemin.");
      }

      rootDir = path.resolve(rawRootDir);
      continue;
    }

    if (currentArg === "--help") {
      throw new Error("USAGE");
    }

    throw new Error(`Argument inconnu pour check-epic-closure: ${currentArg}`);
  }

  return rootDir;
}

async function main(): Promise<number> {
  let rootDir: string;

  try {
    rootDir = parseRootDirFromArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof Error && error.message === "USAGE") {
      console.log(usageLine());
      return 0;
    }

    console.error(error instanceof Error ? error.message : String(error));
    console.error(usageLine());
    return 1;
  }

  try {
    const result = await checkEpicClosure(rootDir);
    const lines = result.ok ? formatSuccess(result) : formatFailure(result);
    const writer = result.ok ? console.log : console.error;

    for (const line of lines) {
      writer(line);
    }

    return result.ok ? 0 : 1;
  } catch (error) {
    console.error("Verification cloture epic: echec");
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  void main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
