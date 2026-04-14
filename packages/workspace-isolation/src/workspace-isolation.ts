import { execFile } from "node:child_process";
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { WorkspaceLayout } from "../../storage/src/fs-layout/workspace-layout";

const execFileAsync = promisify(execFile);

export type WorkspaceIsolationKind = "git_worktree" | "workspace_copy";

export interface WorkspaceIsolationMetadata {
  workspaceIsolationId: string;
  kind: WorkspaceIsolationKind;
  sourceRoot: string;
  workspacePath: string;
  createdAt: string;
  retained: boolean;
}

export interface GitCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunGitCommandOptions {
  runGitCommand?: (args: string[]) => Promise<GitCommandResult>;
}

export interface CreateWorkspaceIsolationOptions extends RunGitCommandOptions {
  layout: WorkspaceLayout;
  rootDir: string;
  workspaceIsolationId: string;
}

export async function resolvePreferredIsolationKind(
  rootDir: string,
  options: RunGitCommandOptions = {},
): Promise<WorkspaceIsolationKind> {
  const runGitCommand = options.runGitCommand
    ?? createDefaultGitCommandRunner(rootDir);
  const topLevelResult = await runGitCommand(["rev-parse", "--show-toplevel"]);

  if (topLevelResult.exitCode !== 0) {
    return "workspace_copy";
  }

  const resolvedTopLevel = normalizeFileSystemPath(topLevelResult.stdout.trim());
  const resolvedRootDir = normalizeFileSystemPath(rootDir);

  if (!resolvedTopLevel || resolvedTopLevel !== resolvedRootDir) {
    return "workspace_copy";
  }

  const headResult = await runGitCommand(["rev-parse", "--verify", "HEAD"]);

  return headResult.exitCode === 0
    ? "git_worktree"
    : "workspace_copy";
}

export async function createWorkspaceIsolation(
  options: CreateWorkspaceIsolationOptions,
): Promise<WorkspaceIsolationMetadata> {
  const resolvedRootDir = path.resolve(options.rootDir);
  const isolationDir = path.join(options.layout.isolationsDir, options.workspaceIsolationId);
  const workspacePath = path.join(isolationDir, "workspace");
  const createdAt = new Date().toISOString();
  const kind = await resolvePreferredIsolationKind(resolvedRootDir, options);

  await mkdir(isolationDir, { recursive: true });

  if (kind === "git_worktree") {
    await createGitWorktreeIsolation(
      resolvedRootDir,
      workspacePath,
      options.runGitCommand ?? createDefaultGitCommandRunner(resolvedRootDir),
    );
  } else {
    await copyWorkspaceContents(resolvedRootDir, workspacePath);
  }

  const metadata: WorkspaceIsolationMetadata = {
    workspaceIsolationId: options.workspaceIsolationId,
    kind,
    sourceRoot: resolvedRootDir,
    workspacePath,
    createdAt,
    retained: true,
  };

  try {
    await writeFile(
      path.join(isolationDir, "isolation.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
  } catch (metadataWriteError) {
    try {
      await rm(isolationDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup — ignore secondary failure
    }

    throw metadataWriteError;
  }

  return metadata;
}

function createDefaultGitCommandRunner(
  rootDir: string,
): (args: string[]) => Promise<GitCommandResult> {
  return async (args: string[]): Promise<GitCommandResult> => {
    try {
      const result = await execFileAsync("git", ["-C", rootDir, ...args], {
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
  };
}

async function createGitWorktreeIsolation(
  rootDir: string,
  workspacePath: string,
  runGitCommand: (args: string[]) => Promise<GitCommandResult>,
): Promise<void> {
  const result = await runGitCommand(["worktree", "add", "--detach", workspacePath, "HEAD"]);

  if (result.exitCode !== 0) {
    throw new Error(
      `Creation du worktree Git impossible pour \`${rootDir}\`.`,
    );
  }
}

function shouldCopyWorkspaceEntry(
  sourceRoot: string,
  sourcePath: string,
): boolean {
  const relativePath = path.relative(sourceRoot, sourcePath);

  if (!relativePath) {
    return true;
  }

  const [firstSegment] = relativePath.split(path.sep);

  return firstSegment !== ".corp";
}

async function copyWorkspaceContents(
  sourceRoot: string,
  workspacePath: string,
): Promise<void> {
  await mkdir(workspacePath, { recursive: true });

  const entries = await readdir(sourceRoot, { withFileTypes: true, encoding: "utf8" });

  for (const entry of entries) {
    if (entry.name === ".corp") {
      continue;
    }

    const sourcePath = path.join(sourceRoot, entry.name);
    const destinationPath = path.join(workspacePath, entry.name);

    await cp(sourcePath, destinationPath, {
      recursive: true,
      filter: (nestedSourcePath) => shouldCopyWorkspaceEntry(sourceRoot, nestedSourcePath),
    });
  }
}

function normalizeFileSystemPath(value: string): string {
  const normalizedValue = path.resolve(normalizeWindowsPosixPath(value));

  return process.platform === "win32"
    ? normalizedValue.toLowerCase()
    : normalizedValue;
}

function normalizeWindowsPosixPath(value: string): string {
  if (process.platform !== "win32") {
    return value;
  }

  const trimmedValue = value.trim();
  const windowsPosixMatch = trimmedValue.match(/^\/([a-zA-Z])(?:\/(.*))?$/);

  if (!windowsPosixMatch) {
    return trimmedValue;
  }

  const driveLetter = windowsPosixMatch[1].toUpperCase();
  const relativeSegments = windowsPosixMatch[2]?.replace(/\//g, "\\") ?? "";

  return relativeSegments.length > 0
    ? `${driveLetter}:\\${relativeSegments}`
    : `${driveLetter}:\\`;
}
