"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEpicClosure = checkEpicClosure;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
function isEpicKey(key) {
    return /^epic-\d+$/.test(key);
}
function isEpicRetrospectiveKey(key) {
    return /^epic-\d+-retrospective$/.test(key);
}
function isStoryKey(key) {
    return /^\d+-\d+-/.test(key);
}
function parseEpicNumberFromEpicKey(epicKey) {
    return epicKey.replace("epic-", "");
}
function stripInlineComment(rawValue) {
    let inSingleQuotedScalar = false;
    let inDoubleQuotedScalar = false;
    let result = "";
    for (let index = 0; index < rawValue.length; index += 1) {
        const currentChar = rawValue[index];
        const nextChar = rawValue[index + 1];
        if (currentChar === "#"
            && !inSingleQuotedScalar
            && !inDoubleQuotedScalar
            && (index === 0 || /\s/.test(rawValue[index - 1]))) {
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
function unwrapQuotedScalar(value) {
    if (value.length < 2) {
        return value;
    }
    if (value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replace(/''/g, "'");
    }
    if (value.startsWith("\"") && value.endsWith("\"")) {
        const inner = value.slice(1, -1);
        let result = "";
        for (let index = 0; index < inner.length; index += 1) {
            const currentChar = inner[index];
            if (currentChar === "\\" && index + 1 < inner.length) {
                const nextChar = inner[index + 1];
                if (nextChar === "\\" || nextChar === "\"") {
                    result += nextChar;
                    index += 1;
                    continue;
                }
            }
            result += currentChar;
        }
        return result;
    }
    return value;
}
function normalizeYamlScalar(rawValue) {
    return unwrapQuotedScalar(stripInlineComment(rawValue).trim());
}
function isDevelopmentStatusSectionLine(line) {
    return stripInlineComment(line).trim() === "development_status:";
}
function parseDevelopmentStatusEntries(fileContents) {
    const lines = fileContents.split(/\r?\n/);
    const sectionIndex = lines.findIndex(isDevelopmentStatusSectionLine);
    if (sectionIndex === -1) {
        throw new Error("Section `development_status` introuvable dans sprint-status.yaml.");
    }
    const duplicateSectionIndex = lines.findIndex((line, index) => index > sectionIndex && isDevelopmentStatusSectionLine(line));
    if (duplicateSectionIndex !== -1) {
        throw new Error(`development_status: section dupliquee detectee (lignes ${sectionIndex + 1} et ${duplicateSectionIndex + 1}).`);
    }
    const rawEntries = [];
    const duplicateLineNumbersByKey = new Map();
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
            throw new Error(`indentation invalide dans development_status, attendu 2 espaces (ligne ${index + 1}).`);
        }
        const payload = line.slice(2);
        const entryMatch = /^([A-Za-z0-9][A-Za-z0-9-]*):(?:\s*(.*))?$/.exec(payload);
        if (entryMatch === null) {
            throw new Error(`entree development_status invalide a la ligne ${index + 1}: ${payload.trim()}`);
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
    const lastRawIndexByKey = new Map();
    rawEntries.forEach((entry, rawIndex) => {
        lastRawIndexByKey.set(entry.key, rawIndex);
    });
    const entries = rawEntries.filter((entry, rawIndex) => lastRawIndexByKey.get(entry.key) === rawIndex);
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
function buildInspectableEpicStatuses(entries) {
    const epicStatuses = [];
    for (const entry of entries) {
        if (!isEpicKey(entry.key)) {
            continue;
        }
        const epicNumber = parseEpicNumberFromEpicKey(entry.key);
        const retrospectiveKey = `epic-${epicNumber}-retrospective`;
        const storyEntries = entries.filter((candidate) => isStoryKey(candidate.key) && candidate.key.startsWith(`${epicNumber}-`));
        const retrospectiveEntry = entries.find((candidate) => isEpicRetrospectiveKey(candidate.key) && candidate.key === retrospectiveKey);
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
        if (entry.value === "in-progress"
            && storyEntries.length > 0
            && storyEntries.every((storyEntry) => storyEntry.value === "done")) {
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
function extractStoryHeader(fileContents) {
    const lines = fileContents.split(/\r?\n/);
    const headerLines = [];
    let firstNonEmptyIndex = -1;
    for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].trim() !== "") {
            firstNonEmptyIndex = index;
            break;
        }
    }
    let cursor = 0;
    let frontmatterClosed = true;
    if (firstNonEmptyIndex !== -1 && lines[firstNonEmptyIndex].trim() === "---") {
        frontmatterClosed = false;
        cursor = firstNonEmptyIndex + 1;
        for (; cursor < lines.length; cursor += 1) {
            const line = lines[cursor];
            if (line.trim() === "---") {
                frontmatterClosed = true;
                cursor += 1;
                break;
            }
            headerLines.push(line);
        }
    }
    if (!frontmatterClosed) {
        // Frontmatter ouvert sans fermeture : retourner "" explicitement afin que les
        // consommateurs (notamment readStoryFileStatus) ne lisent pas par erreur le
        // contenu accumule du frontmatter tronque comme s'il s'agissait du header.
        return "";
    }
    let fenceMarker = null;
    for (; cursor < lines.length; cursor += 1) {
        const line = lines[cursor];
        if (fenceMarker === null && line.startsWith("## ")) {
            break;
        }
        const fenceMatch = /^ {0,3}(```+|~~~+)/.exec(line);
        if (fenceMatch !== null) {
            const marker = fenceMatch[1];
            if (fenceMarker === null) {
                fenceMarker = marker;
            }
            else if (marker.length >= fenceMarker.length && marker[0] === fenceMarker[0]) {
                fenceMarker = null;
            }
            continue;
        }
        if (fenceMarker !== null) {
            continue;
        }
        headerLines.push(line);
    }
    return headerLines.join("\n");
}
async function readStoryFileStatus(implementationDir, storyKey) {
    const filePath = node_path_1.default.join(implementationDir, `${storyKey}.md`);
    const fileContents = await (0, promises_1.readFile)(filePath, "utf8");
    const headerContents = extractStoryHeader(fileContents);
    const statusMatches = [...headerContents.matchAll(/^Status:\s*(.+?)\s*$/gm)];
    if (statusMatches.length === 0) {
        return undefined;
    }
    const lastStatus = statusMatches[statusMatches.length - 1];
    return lastStatus[1].trim();
}
function buildEpicErrorPrefix(epicStatus) {
    if (epicStatus.mode === "pre-transition") {
        return `${epicStatus.epicKey}: epic pret a clore mais desynchronise`;
    }
    return epicStatus.epicKey;
}
function formatStoryTrackerError(epicStatus, storyEntry) {
    return `${buildEpicErrorPrefix(epicStatus)}: la story ${storyEntry.key} vaut ${storyEntry.value} dans sprint-status.yaml (attendu: done avant cloture d'epic).`;
}
function formatStoryReadError(epicStatus, storyKey, error) {
    const errorCode = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    if (errorCode === "ENOENT") {
        return `${buildEpicErrorPrefix(epicStatus)} - story file ${storyKey}.md introuvable (ENOENT).`;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `${buildEpicErrorPrefix(epicStatus)} - impossible de lire le story file ${storyKey}.md (${errorMessage}).`;
}
function formatStoryStatusError(epicStatus, storyEntry, storyFileStatus) {
    const statusLabel = storyFileStatus ?? "(absent)";
    if (epicStatus.mode === "pre-transition") {
        return `${buildEpicErrorPrefix(epicStatus)} - la story ${storyEntry.key} declare Status: ${statusLabel} dans son fichier Markdown (tracker=${storyEntry.value}, attendu: done avant passage a done).`;
    }
    return `${buildEpicErrorPrefix(epicStatus)}: la story ${storyEntry.key} declare Status: ${statusLabel} dans son fichier Markdown (tracker=${storyEntry.value}, attendu: done).`;
}
function formatRetrospectiveError(epicStatus) {
    const retrospectiveStatus = epicStatus.retrospectiveStatus ?? "(absent)";
    if (epicStatus.mode === "pre-transition") {
        return `${buildEpicErrorPrefix(epicStatus)} - la retrospective ${epicStatus.retrospectiveKey} vaut ${retrospectiveStatus} (attendu: done avant cloture).`;
    }
    return `${buildEpicErrorPrefix(epicStatus)}: la retrospective ${epicStatus.retrospectiveKey} vaut ${retrospectiveStatus} (attendu: done).`;
}
async function validateEpicStatus(implementationDir, epicStatus) {
    const errors = [];
    for (const storyEntry of epicStatus.storyEntries) {
        if (epicStatus.mode === "historical-done" && storyEntry.value !== "done") {
            errors.push(formatStoryTrackerError(epicStatus, storyEntry));
            continue;
        }
        let storyFileStatus;
        try {
            storyFileStatus = await readStoryFileStatus(implementationDir, storyEntry.key);
        }
        catch (error) {
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
async function checkEpicClosure(rootDir) {
    const implementationDir = node_path_1.default.join(rootDir, "_bmad-output", "implementation");
    const sprintStatusPath = node_path_1.default.join(implementationDir, "sprint-status.yaml");
    const rawContents = await (0, promises_1.readFile)(sprintStatusPath, "utf8");
    const sprintStatusContents = rawContents.startsWith("\uFEFF")
        ? rawContents.slice(1)
        : rawContents;
    const parseResult = parseDevelopmentStatusEntries(sprintStatusContents);
    const epicStatuses = buildInspectableEpicStatuses(parseResult.entries);
    const warnings = [...parseResult.warnings];
    const errors = [];
    for (const epicStatus of epicStatuses) {
        if (epicStatus.mode === "historical-done" && epicStatus.storyEntries.length === 0) {
            warnings.push(`${epicStatus.epicKey}: aucune story associee dans development_status alors que l'epic est declare done.`);
        }
        errors.push(...await validateEpicStatus(implementationDir, epicStatus));
    }
    for (const entry of parseResult.entries) {
        if (!isEpicKey(entry.key) || entry.value !== "in-progress") {
            continue;
        }
        const epicNumber = parseEpicNumberFromEpicKey(entry.key);
        const hasStories = parseResult.entries.some((candidate) => isStoryKey(candidate.key) && candidate.key.startsWith(`${epicNumber}-`));
        if (!hasStories) {
            warnings.push(`${entry.key}: aucune story associee dans development_status alors que l'epic est in-progress.`);
        }
    }
    return {
        errors,
        warnings,
        inspectedEpicKeys: epicStatuses.map((epicStatus) => epicStatus.epicKey),
        ok: errors.length === 0,
    };
}
function formatWarnings(warnings) {
    return warnings.map((warning) => `Avertissement: ${warning}`);
}
function formatSuccess(result) {
    const lines = ["Verification cloture epic: ok", ...formatWarnings(result.warnings)];
    if (result.inspectedEpicKeys.length === 0) {
        lines.push("Aucun epic en statut done ou pret a clore a verifier.");
        return lines;
    }
    lines.push(`Epics verifies: ${result.inspectedEpicKeys.join(", ")}`);
    return lines;
}
function formatFailure(result) {
    return [
        "Verification cloture epic: echec",
        ...formatWarnings(result.warnings),
        ...result.errors.map((error) => `- ${error}`),
    ];
}
function usageLine() {
    return "Usage: node dist/scripts/check-epic-closure.js [--root <workspace> | --root=<workspace>]";
}
function parseRootDirFromArgs(args) {
    let rootDir = process.cwd();
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            const nextArg = args[index + 1];
            if (nextArg === undefined || nextArg === "" || nextArg.startsWith("--")) {
                throw new Error("L'option --root requiert un chemin.");
            }
            rootDir = node_path_1.default.resolve(nextArg);
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            const rawRootDir = currentArg.slice("--root=".length);
            if (rawRootDir.trim() === "") {
                throw new Error("L'option --root requiert un chemin.");
            }
            rootDir = node_path_1.default.resolve(rawRootDir);
            continue;
        }
        if (currentArg === "--help") {
            throw new Error("USAGE");
        }
        throw new Error(`Argument inconnu pour check-epic-closure: ${currentArg}`);
    }
    return rootDir;
}
async function main() {
    let rootDir;
    try {
        rootDir = parseRootDirFromArgs(process.argv.slice(2));
    }
    catch (error) {
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
    }
    catch (error) {
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
