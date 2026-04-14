"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePreferredIsolationKind = resolvePreferredIsolationKind;
exports.createWorkspaceIsolation = createWorkspaceIsolation;
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
async function resolvePreferredIsolationKind(rootDir, options = {}) {
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
async function createWorkspaceIsolation(options) {
    const resolvedRootDir = node_path_1.default.resolve(options.rootDir);
    const isolationDir = node_path_1.default.join(options.layout.isolationsDir, options.workspaceIsolationId);
    const workspacePath = node_path_1.default.join(isolationDir, "workspace");
    const createdAt = new Date().toISOString();
    const kind = await resolvePreferredIsolationKind(resolvedRootDir, options);
    await (0, promises_1.mkdir)(isolationDir, { recursive: true });
    if (kind === "git_worktree") {
        await createGitWorktreeIsolation(resolvedRootDir, workspacePath, options.runGitCommand ?? createDefaultGitCommandRunner(resolvedRootDir));
    }
    else {
        await copyWorkspaceContents(resolvedRootDir, workspacePath);
    }
    const metadata = {
        workspaceIsolationId: options.workspaceIsolationId,
        kind,
        sourceRoot: resolvedRootDir,
        workspacePath,
        createdAt,
        retained: true,
    };
    try {
        await (0, promises_1.writeFile)(node_path_1.default.join(isolationDir, "isolation.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    }
    catch (metadataWriteError) {
        try {
            await (0, promises_1.rm)(isolationDir, { recursive: true, force: true });
        }
        catch {
            // Best effort cleanup — ignore secondary failure
        }
        throw metadataWriteError;
    }
    return metadata;
}
function createDefaultGitCommandRunner(rootDir) {
    return async (args) => {
        try {
            const result = await execFileAsync("git", ["-C", rootDir, ...args], {
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
    };
}
async function createGitWorktreeIsolation(rootDir, workspacePath, runGitCommand) {
    const result = await runGitCommand(["worktree", "add", "--detach", workspacePath, "HEAD"]);
    if (result.exitCode !== 0) {
        throw new Error(`Creation du worktree Git impossible pour \`${rootDir}\`.`);
    }
}
function shouldCopyWorkspaceEntry(sourceRoot, sourcePath) {
    const relativePath = node_path_1.default.relative(sourceRoot, sourcePath);
    if (!relativePath) {
        return true;
    }
    const [firstSegment] = relativePath.split(node_path_1.default.sep);
    return firstSegment !== ".corp";
}
async function copyWorkspaceContents(sourceRoot, workspacePath) {
    await (0, promises_1.mkdir)(workspacePath, { recursive: true });
    const entries = await (0, promises_1.readdir)(sourceRoot, { withFileTypes: true, encoding: "utf8" });
    for (const entry of entries) {
        if (entry.name === ".corp") {
            continue;
        }
        const sourcePath = node_path_1.default.join(sourceRoot, entry.name);
        const destinationPath = node_path_1.default.join(workspacePath, entry.name);
        await (0, promises_1.cp)(sourcePath, destinationPath, {
            recursive: true,
            filter: (nestedSourcePath) => shouldCopyWorkspaceEntry(sourceRoot, nestedSourcePath),
        });
    }
}
function normalizeFileSystemPath(value) {
    const normalizedValue = node_path_1.default.resolve(normalizeWindowsPosixPath(value));
    return process.platform === "win32"
        ? normalizedValue.toLowerCase()
        : normalizedValue;
}
function normalizeWindowsPosixPath(value) {
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
