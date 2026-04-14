import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { ArtifactKind } from "../../contracts/src/artifact/artifact";
import type { WorkspaceIsolationMetadata } from "./workspace-isolation";

const execFileAsync = promisify(execFile);
const IGNORED_TOP_LEVEL_SEGMENTS = new Set([".corp", ".git"]);

export interface WorkspaceArtifactCandidate {
  kind: Extract<ArtifactKind, "workspace_file">;
  title: string;
  path: string;
  label?: string;
  mediaType?: string;
  summary?: string;
  sha256?: string;
  sizeBytes: number;
}

export interface DetectGitWorkspaceArtifactsOptions {
  runGitCommand?: (
    workspacePath: string,
    args: string[],
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export async function detectWorkspaceArtifacts(
  isolation: WorkspaceIsolationMetadata,
): Promise<WorkspaceArtifactCandidate[]> {
  if (isolation.kind === "git_worktree") {
    return detectGitWorkspaceArtifacts(isolation.workspacePath);
  }

  return detectCopiedWorkspaceArtifacts(isolation);
}

export async function detectGitWorkspaceArtifacts(
  workspacePath: string,
  options: DetectGitWorkspaceArtifactsOptions = {},
): Promise<WorkspaceArtifactCandidate[]> {
  const result = await (options.runGitCommand ?? runGitCommand)(workspacePath, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);

  if (result.exitCode !== 0) {
    return [];
  }

  const candidates: WorkspaceArtifactCandidate[] = [];

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

    const filePath = path.join(workspacePath, relativePath);
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

async function detectCopiedWorkspaceArtifacts(
  isolation: WorkspaceIsolationMetadata,
): Promise<WorkspaceArtifactCandidate[]> {
  const sourceFiles = await listWorkspaceFiles(isolation.sourceRoot);
  const isolatedFiles = await listWorkspaceFiles(isolation.workspacePath);
  const candidates: WorkspaceArtifactCandidate[] = [];

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

async function listWorkspaceFiles(rootDir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  await walkWorkspaceFiles(rootDir, rootDir, files);
  return files;
}

async function walkWorkspaceFiles(
  rootDir: string,
  currentDir: string,
  files: Map<string, string>,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true, encoding: "utf8" });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizeRelativePath(path.relative(rootDir, absolutePath));

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

async function readFileMetadata(filePath: string): Promise<{ sha256: string; sizeBytes: number } | null> {
  try {
    const contents = await readFile(filePath);
    return {
      sha256: createHash("sha256").update(contents).digest("hex"),
      sizeBytes: contents.byteLength,
    };
  } catch {
    return null;
  }
}

function shouldTrackRelativePath(relativePath: string): boolean {
  if (!relativePath || relativePath === ".") {
    return false;
  }

  const normalizedRelativePath = normalizeRelativePath(stripEnclosingQuotes(relativePath));
  const [topLevelSegment] = normalizedRelativePath.split("/");

  return !IGNORED_TOP_LEVEL_SEGMENTS.has(topLevelSegment);
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join("/");
}

function inferMediaType(relativePath: string): string | undefined {
  const extension = path.extname(relativePath).toLowerCase();

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

async function runGitCommand(
  workspacePath: string,
  args: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("git", ["-C", workspacePath, ...args], {
      windowsHide: true,
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const candidate = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: typeof candidate.code === "number" ? candidate.code : 1,
      stdout: candidate.stdout ?? "",
      stderr: candidate.stderr ?? "",
    };
  }
}

function sortWorkspaceArtifacts(
  candidates: WorkspaceArtifactCandidate[],
): WorkspaceArtifactCandidate[] {
  return [...candidates].sort((left, right) => left.path.localeCompare(right.path));
}

function extractTrackedGitPath(rawPath: string): string {
  const pathCandidate = rawPath.includes(" -> ")
    ? rawPath.split(" -> ").at(-1) ?? rawPath
    : rawPath;

  return stripEnclosingQuotes(pathCandidate.trim());
}

function stripEnclosingQuotes(value: string): string {
  return value.startsWith("\"") && value.endsWith("\"")
    ? value.slice(1, -1)
    : value;
}

function isSignificantZeroByteGitStatus(status: string): boolean {
  return status.startsWith("D") || status.startsWith("R");
}

function describeGitWorkspaceChange(status: string): string {
  if (status === "??") {
    return "Fichier cree dans le workspace isole.";
  }

  if (status.startsWith("R")) {
    return "Fichier renomme dans le workspace isole.";
  }

  return "Fichier modifie dans le workspace isole.";
}

function readWorkspaceStatusLabel(status: string): string | undefined {
  if (status.startsWith("R")) {
    return "renamed";
  }

  return undefined;
}
