"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectWorkspaceArtifacts = detectWorkspaceArtifacts;
exports.detectGitWorkspaceArtifacts = detectGitWorkspaceArtifacts;
const node_crypto_1 = require("node:crypto");
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const IGNORED_TOP_LEVEL_SEGMENTS = new Set([".corp", ".git"]);
async function detectWorkspaceArtifacts(isolation) {
    if (isolation.kind === "git_worktree") {
        return detectGitWorkspaceArtifacts(isolation.workspacePath);
    }
    return detectCopiedWorkspaceArtifacts(isolation);
}
async function detectGitWorkspaceArtifacts(workspacePath, options = {}) {
    const result = await (options.runGitCommand ?? runGitCommand)(workspacePath, [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    ]);
    if (result.exitCode !== 0) {
        return [];
    }
    const candidates = [];
    for (const line of result.stdout.split(/\r?\n/)) {
        if (line.trim().length === 0) {
            continue;
        }
        const status = line.slice(0, 2).trim();
        const rawPath = line.slice(3).trim();
        const relativePath = extractTrackedGitPath(rawPath);
        if (!shouldTrackRelativePath(relativePath)) {
            continue;
        }
        if (status.startsWith("D")) {
            candidates.push({
                kind: "workspace_file",
                title: relativePath,
                path: relativePath,
                label: "deleted",
                summary: "Fichier supprime dans le workspace isole.",
                sizeBytes: 0,
            });
            continue;
        }
        const filePath = node_path_1.default.join(workspacePath, relativePath);
        const fileMetadata = await readFileMetadata(filePath);
        if (!fileMetadata) {
            continue;
        }
        if (fileMetadata.sizeBytes === 0 && !isSignificantZeroByteGitStatus(status)) {
            continue;
        }
        candidates.push({
            kind: "workspace_file",
            title: relativePath,
            path: relativePath,
            mediaType: inferMediaType(relativePath),
            ...(readWorkspaceStatusLabel(status) ? { label: readWorkspaceStatusLabel(status) } : {}),
            summary: describeGitWorkspaceChange(status),
            sha256: fileMetadata.sha256,
            sizeBytes: fileMetadata.sizeBytes,
        });
    }
    return sortWorkspaceArtifacts(candidates);
}
async function detectCopiedWorkspaceArtifacts(isolation) {
    const sourceFiles = await listWorkspaceFiles(isolation.sourceRoot);
    const isolatedFiles = await listWorkspaceFiles(isolation.workspacePath);
    const candidates = [];
    for (const [relativePath, isolatedFilePath] of isolatedFiles.entries()) {
        const isolatedFile = await readFileMetadata(isolatedFilePath);
        if (!isolatedFile || isolatedFile.sizeBytes === 0) {
            continue;
        }
        const sourceFilePath = sourceFiles.get(relativePath);
        if (!sourceFilePath) {
            candidates.push({
                kind: "workspace_file",
                title: relativePath,
                path: relativePath,
                mediaType: inferMediaType(relativePath),
                summary: "Fichier cree dans le workspace isole.",
                sha256: isolatedFile.sha256,
                sizeBytes: isolatedFile.sizeBytes,
            });
            continue;
        }
        const sourceFile = await readFileMetadata(sourceFilePath);
        if (!sourceFile || sourceFile.sha256 !== isolatedFile.sha256) {
            candidates.push({
                kind: "workspace_file",
                title: relativePath,
                path: relativePath,
                mediaType: inferMediaType(relativePath),
                summary: "Fichier modifie dans le workspace isole.",
                sha256: isolatedFile.sha256,
                sizeBytes: isolatedFile.sizeBytes,
            });
        }
    }
    return sortWorkspaceArtifacts(candidates);
}
async function listWorkspaceFiles(rootDir) {
    const files = new Map();
    await walkWorkspaceFiles(rootDir, rootDir, files);
    return files;
}
async function walkWorkspaceFiles(rootDir, currentDir, files) {
    const entries = await (0, promises_1.readdir)(currentDir, { withFileTypes: true, encoding: "utf8" });
    for (const entry of entries) {
        const absolutePath = node_path_1.default.join(currentDir, entry.name);
        const relativePath = normalizeRelativePath(node_path_1.default.relative(rootDir, absolutePath));
        if (!shouldTrackRelativePath(relativePath)) {
            continue;
        }
        if (entry.isDirectory()) {
            await walkWorkspaceFiles(rootDir, absolutePath, files);
            continue;
        }
        if (entry.isFile()) {
            files.set(relativePath, absolutePath);
        }
    }
}
async function readFileMetadata(filePath) {
    try {
        const contents = await (0, promises_1.readFile)(filePath);
        return {
            sha256: (0, node_crypto_1.createHash)("sha256").update(contents).digest("hex"),
            sizeBytes: contents.byteLength,
        };
    }
    catch {
        return null;
    }
}
function shouldTrackRelativePath(relativePath) {
    if (!relativePath || relativePath === ".") {
        return false;
    }
    const normalizedRelativePath = normalizeRelativePath(stripEnclosingQuotes(relativePath));
    const [topLevelSegment] = normalizedRelativePath.split("/");
    return !IGNORED_TOP_LEVEL_SEGMENTS.has(topLevelSegment);
}
function normalizeRelativePath(value) {
    return value.split(node_path_1.default.sep).join("/");
}
function inferMediaType(relativePath) {
    const extension = node_path_1.default.extname(relativePath).toLowerCase();
    if (extension === ".md") {
        return "text/markdown";
    }
    if (extension === ".txt") {
        return "text/plain";
    }
    if (extension === ".json") {
        return "application/json";
    }
    if (extension === ".yml" || extension === ".yaml") {
        return "application/yaml";
    }
    if (extension === ".html") {
        return "text/html";
    }
    if (extension === ".bin") {
        return "application/octet-stream";
    }
    return undefined;
}
async function runGitCommand(workspacePath, args) {
    try {
        const result = await execFileAsync("git", ["-C", workspacePath, ...args], {
            windowsHide: true,
        });
        return {
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr,
        };
    }
    catch (error) {
        const candidate = error;
        return {
            exitCode: typeof candidate.code === "number" ? candidate.code : 1,
            stdout: candidate.stdout ?? "",
            stderr: candidate.stderr ?? "",
        };
    }
}
function sortWorkspaceArtifacts(candidates) {
    return [...candidates].sort((left, right) => left.path.localeCompare(right.path));
}
function extractTrackedGitPath(rawPath) {
    const pathCandidate = rawPath.includes(" -> ")
        ? rawPath.split(" -> ").at(-1) ?? rawPath
        : rawPath;
    return stripEnclosingQuotes(pathCandidate.trim());
}
function stripEnclosingQuotes(value) {
    return value.startsWith("\"") && value.endsWith("\"")
        ? value.slice(1, -1)
        : value;
}
function isSignificantZeroByteGitStatus(status) {
    return status.startsWith("D") || status.startsWith("R");
}
function describeGitWorkspaceChange(status) {
    if (status === "??") {
        return "Fichier cree dans le workspace isole.";
    }
    if (status.startsWith("R")) {
        return "Fichier renomme dans le workspace isole.";
    }
    return "Fichier modifie dans le workspace isole.";
}
function readWorkspaceStatusLabel(status) {
    if (status.startsWith("R")) {
        return "renamed";
    }
    return undefined;
}
