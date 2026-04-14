#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const analysisRoot = path.join(repoRoot, "analysis");
const manifestsDir = path.join(analysisRoot, "manifests");

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".plist",
  ".xcconfig",
  ".swift",
  ".kt",
  ".kts",
  ".java",
  ".py",
  ".sh",
  ".ps1",
]);

const SPECIAL_FILENAMES = new Set([
  "Dockerfile",
  "Dockerfile.sandbox",
  "Dockerfile.sandbox-browser",
  "Dockerfile.sandbox-common",
  "Makefile",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".plist",
  ".xcconfig",
  ".swift",
  ".kt",
  ".kts",
  ".java",
  ".py",
  ".sh",
  ".ps1",
]);

const TS_FAMILY_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const IGNORE_DIRS = new Set([
  ".git",
  "analysis",
  "build",
  "coverage",
  "dist",
  "node_modules",
  ".next",
  ".turbo",
]);

const CHANNEL_EXTENSION_DIRS = new Set([
  "acpx",
  "bluebubbles",
  "discord",
  "feishu",
  "googlechat",
  "imessage",
  "irc",
  "line",
  "matrix",
  "mattermost",
  "msteams",
  "nextcloud-talk",
  "nostr",
  "qa-channel",
  "qqbot",
  "signal",
  "slack",
  "synology-chat",
  "telegram",
  "tlon",
  "twitch",
  "voice-call",
  "whatsapp",
  "zalo",
  "zalouser",
]);

const PROVIDER_EXTENSION_DIRS = new Set([
  "alibaba",
  "amazon-bedrock",
  "amazon-bedrock-mantle",
  "anthropic",
  "anthropic-vertex",
  "arcee",
  "brave",
  "browser",
  "byteplus",
  "chutes",
  "cloudflare-ai-gateway",
  "comfy",
  "copilot-proxy",
  "deepgram",
  "deepseek",
  "device-pair",
  "diagnostics-otel",
  "diffs",
  "duckduckgo",
  "elevenlabs",
  "exa",
  "fal",
  "firecrawl",
  "fireworks",
  "github-copilot",
  "google",
  "groq",
  "huggingface",
  "image-generation-core",
  "kilocode",
  "kimi-coding",
  "litellm",
  "llm-task",
  "lobster",
  "media-understanding-core",
  "memory-core",
  "memory-lancedb",
  "memory-wiki",
  "microsoft",
  "microsoft-foundry",
  "minimax",
  "mistral",
  "moonshot",
  "nvidia",
  "ollama",
  "open-prose",
  "openai",
  "opencode",
  "opencode-go",
  "openrouter",
  "openshell",
  "perplexity",
  "phone-control",
  "qa-lab",
  "qianfan",
  "qwen",
  "runway",
  "searxng",
  "sglang",
  "speech-core",
  "stepfun",
  "synthetic",
  "talk-voice",
  "tavily",
  "thread-ownership",
  "together",
  "venice",
  "vercel-ai-gateway",
  "video-generation-core",
  "vllm",
  "volcengine",
  "vydra",
  "webhooks",
  "xai",
  "xiaomi",
  "zai",
]);

const BATCH_DEFS = [
  {
    id: "batch-01-core-runtime-cli",
    name: "Core Runtime and CLI",
    domain: "core-runtime-cli",
    summary:
      "CLI entrypoints, config loading, runtime bootstrap, daemon lifecycle, shared infra and root library exports.",
  },
  {
    id: "batch-02-agent-runtime-tools",
    name: "Agent Runtime and Tools",
    domain: "agent-runtime-tools",
    summary:
      "Embedded agent orchestration, tool inventory, subagents, auth profiles, auto-reply and task execution.",
  },
  {
    id: "batch-03-gateway-control-plane",
    name: "Gateway Control Plane",
    domain: "gateway-control-plane",
    summary:
      "Gateway server, RPC surfaces, channel runtime wiring, session control, control-plane auth and transport.",
  },
  {
    id: "batch-04-plugin-platform-sdk",
    name: "Plugin Platform and SDK",
    domain: "plugin-platform-sdk",
    summary:
      "Plugin contracts, SDK entry helpers, plugin runtime, extension boundaries and package-level exports.",
  },
  {
    id: "batch-05-ui-control-surfaces",
    name: "Control UI and TUI",
    domain: "ui-control-surfaces",
    summary:
      "Lit/Vite control UI, chat/config views, browser client state and terminal UI surfaces.",
  },
  {
    id: "batch-06-extensions-channels",
    name: "Extensions Channels",
    domain: "extensions-channels",
    summary:
      "Bundled messaging and presence channel adapters for Discord, Slack, Matrix, Telegram and peers.",
  },
  {
    id: "batch-07-extensions-providers-memory-media",
    name: "Extensions Providers, Memory and Media",
    domain: "extensions-providers-memory-media",
    summary:
      "Model/search/media providers, memory engines, voice/media plugins and core media abstractions.",
  },
  {
    id: "batch-08-shared-swift-mobile-kit",
    name: "Shared Swift and Mobile Nodes",
    domain: "shared-swift-mobile-kit",
    summary:
      "Shared OpenClawKit, iOS app, Android/mobile node surfaces and the Swabble Swift package.",
  },
  {
    id: "batch-09-macos-companion",
    name: "macOS Companion",
    domain: "macos-companion",
    summary:
      "Menu bar macOS app, gateway process management, overlays, approvals and desktop device integrations.",
  },
  {
    id: "batch-10-tooling-tests-release",
    name: "Tooling, Tests and Release",
    domain: "tooling-tests-release",
    summary:
      "Build/test scripts, Vitest sharding, CI helpers, release automation and top-level project manifests.",
  },
  {
    id: "batch-11-vendor-a2ui",
    name: "Vendor A2UI",
    domain: "vendor-a2ui",
    summary:
      "Vendored A2UI specifications, renderers and evaluator tooling embedded inside the repository.",
  },
];

const BUILTIN_IMPORT_PREFIXES = ["node:"];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  return text.split(/\r?\n/u).length;
}

function languageFromExtension(ext, relPath) {
  const baseName = path.basename(relPath);
  if (SPECIAL_FILENAMES.has(baseName)) {
    if (baseName.startsWith("Dockerfile")) {
      return "docker";
    }
    if (baseName === "Makefile") {
      return "makefile";
    }
  }
  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".mts":
    case ".cts":
      return "typescript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".json":
    case ".jsonc":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".toml":
      return "toml";
    case ".plist":
      return "plist";
    case ".xcconfig":
      return "xcconfig";
    case ".swift":
      return "swift";
    case ".kt":
    case ".kts":
      return "kotlin";
    case ".java":
      return "java";
    case ".py":
      return "python";
    case ".sh":
      return "shell";
    case ".ps1":
      return "powershell";
    default:
      return "unknown";
  }
}

function isEntrypoint(relPath) {
  const entrypoints = new Set([
    "openclaw.mjs",
    "src/entry.ts",
    "src/index.ts",
    "src/library.ts",
    "ui/src/main.ts",
    "apps/macos/Sources/OpenClaw/MenuBar.swift",
    "apps/ios/Sources/OpenClawApp.swift",
    "apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift",
    "packages/plugin-sdk/src/plugin-entry.ts",
    "packages/plugin-sdk/src/provider-entry.ts",
    "apps/shared/OpenClawKit/Package.swift",
    "apps/macos/Package.swift",
    "Swabble/Package.swift",
  ]);
  return entrypoints.has(relPath);
}

function isTestFile(relPath) {
  return (
    relPath.includes("/__tests__/") ||
    relPath.includes("/Tests/") ||
    relPath.includes("/tests/") ||
    /\.test\./u.test(relPath) ||
    /\.spec\./u.test(relPath)
  );
}

function classifyTopLevelKind(relPath) {
  if (relPath.startsWith("scripts/") || relPath.startsWith("test/")) {
    return "tooling";
  }
  if (relPath.startsWith("apps/") || relPath.startsWith("Swabble/")) {
    return "mobile";
  }
  if (relPath.startsWith("ui/")) {
    return "ui";
  }
  if (relPath.startsWith("extensions/")) {
    return "extension";
  }
  if (relPath.startsWith("packages/")) {
    return "package";
  }
  if (relPath.startsWith("vendor/")) {
    return "vendor";
  }
  if (relPath.startsWith("src/")) {
    return "core";
  }
  return "root";
}

function topLevelSegment(relPath) {
  if (!relPath.includes("/")) {
    return "(root)";
  }
  return relPath.split("/")[0];
}

function classifyFileKind(relPath) {
  if (isTestFile(relPath)) {
    return "test";
  }
  if (relPath.startsWith("scripts/")) {
    return "script";
  }
  if (
    relPath.endsWith("package.json") ||
    relPath.endsWith("Package.swift") ||
    relPath.endsWith(".plist") ||
    relPath.endsWith(".xcconfig") ||
    relPath.endsWith(".yml") ||
    relPath.endsWith(".yaml") ||
    relPath.endsWith(".toml") ||
    relPath.endsWith("project.yml") ||
    relPath.endsWith("tsconfig.json") ||
    relPath.endsWith("pnpm-workspace.yaml")
  ) {
    return "manifest";
  }
  if (
    relPath.startsWith(".github/") ||
    relPath.startsWith("git-hooks/") ||
    relPath.startsWith("patches/") ||
    relPath.startsWith("test/") ||
    relPath.startsWith("vendor/")
  ) {
    return "support";
  }
  return "source";
}

function classifyBatch(relPath) {
  if (relPath.startsWith("vendor/")) {
    return "batch-11-vendor-a2ui";
  }

  if (relPath.startsWith("apps/macos/")) {
    return "batch-09-macos-companion";
  }

  if (
    relPath.startsWith("apps/shared/") ||
    relPath.startsWith("apps/ios/") ||
    relPath.startsWith("apps/android/") ||
    relPath.startsWith("Swabble/")
  ) {
    return "batch-08-shared-swift-mobile-kit";
  }

  if (relPath.startsWith("ui/") || relPath.startsWith("src/tui/")) {
    return "batch-05-ui-control-surfaces";
  }

  if (relPath.startsWith("packages/")) {
    return "batch-04-plugin-platform-sdk";
  }

  if (relPath.startsWith("extensions/")) {
    const [, extensionName = ""] = relPath.split("/");
    if (CHANNEL_EXTENSION_DIRS.has(extensionName)) {
      return "batch-06-extensions-channels";
    }
    if (extensionName === "shared") {
      return "batch-04-plugin-platform-sdk";
    }
    if (PROVIDER_EXTENSION_DIRS.has(extensionName)) {
      return "batch-07-extensions-providers-memory-media";
    }
    return "batch-07-extensions-providers-memory-media";
  }

  if (relPath.startsWith("scripts/") || relPath.startsWith("test/") || relPath.startsWith(".github/")) {
    return "batch-10-tooling-tests-release";
  }

  if (
    relPath === "knip.config.ts" ||
    relPath === "package.json" ||
    relPath === "pnpm-workspace.yaml" ||
    relPath === "pyproject.toml" ||
    relPath === "tsconfig.json" ||
    relPath === "tsdown.config.ts" ||
    relPath.startsWith("vitest.") ||
    relPath.startsWith("Dockerfile") ||
    relPath.endsWith(".sh") ||
    relPath.endsWith(".py") ||
    relPath.endsWith(".ps1")
  ) {
    if (relPath === "openclaw.mjs") {
      return "batch-01-core-runtime-cli";
    }
    return "batch-10-tooling-tests-release";
  }

  if (
    relPath === "openclaw.mjs" ||
    relPath === "src/entry.ts" ||
    relPath === "src/index.ts" ||
    relPath === "src/library.ts" ||
    relPath === "src/runtime.ts" ||
    relPath === "src/version.ts" ||
    relPath === "src/logging.ts" ||
    relPath === "src/logger.ts" ||
    relPath.startsWith("src/cli/") ||
    relPath.startsWith("src/bootstrap/") ||
    relPath.startsWith("src/commands/") ||
    relPath.startsWith("src/config/") ||
    relPath.startsWith("src/daemon/") ||
    relPath.startsWith("src/infra/") ||
    relPath.startsWith("src/interactive/") ||
    relPath.startsWith("src/markdown/") ||
    relPath.startsWith("src/process/") ||
    relPath.startsWith("src/secrets/") ||
    relPath.startsWith("src/security/") ||
    relPath.startsWith("src/shared/") ||
    relPath.startsWith("src/terminal/") ||
    relPath.startsWith("src/types/") ||
    relPath.startsWith("src/utils/") ||
    relPath.startsWith("src/wizard/") ||
    relPath.startsWith("src/logging/") ||
    relPath.startsWith("src/docs/") ||
    relPath === "src/browser-lifecycle-cleanup.ts" ||
    relPath === "src/browser-lifecycle-cleanup.test.ts" ||
    relPath === "src/global-state.ts" ||
    relPath === "src/globals.ts" ||
    relPath === "src/utils.ts" ||
    relPath === "src/utils.test.ts"
  ) {
    return "batch-01-core-runtime-cli";
  }

  if (
    relPath.startsWith("src/agents/") ||
    relPath.startsWith("src/auto-reply/") ||
    relPath.startsWith("src/tasks/") ||
    relPath.startsWith("src/hooks/") ||
    relPath.startsWith("src/flows/") ||
    relPath.startsWith("src/context-engine/") ||
    relPath.startsWith("src/chat/") ||
    relPath.startsWith("src/pairing/") ||
    relPath === "src/polls.ts" ||
    relPath === "src/polls.test.ts" ||
    relPath === "src/poll-params.ts" ||
    relPath === "src/poll-params.test.ts" ||
    relPath === "src/param-key.ts"
  ) {
    return "batch-02-agent-runtime-tools";
  }

  if (
    relPath.startsWith("src/gateway/") ||
    relPath.startsWith("src/acp/") ||
    relPath.startsWith("src/bindings/") ||
    relPath.startsWith("src/canvas-host/") ||
    relPath.startsWith("src/channels/") ||
    relPath.startsWith("src/cron/") ||
    relPath.startsWith("src/mcp/") ||
    relPath.startsWith("src/node-host/") ||
    relPath.startsWith("src/realtime-transcription/") ||
    relPath.startsWith("src/realtime-voice/") ||
    relPath.startsWith("src/routing/") ||
    relPath.startsWith("src/sessions/") ||
    relPath.startsWith("src/web/") ||
    relPath.startsWith("src/web-fetch/") ||
    relPath.startsWith("src/web-search/") ||
    relPath === "src/channel-web.ts"
  ) {
    return "batch-03-gateway-control-plane";
  }

  if (
    relPath.startsWith("src/plugin-sdk/") ||
    relPath.startsWith("src/plugins/") ||
    relPath === "src/extensionAPI.ts"
  ) {
    return "batch-04-plugin-platform-sdk";
  }

  if (
    relPath.startsWith("src/image-generation/") ||
    relPath.startsWith("src/link-understanding/") ||
    relPath.startsWith("src/media/") ||
    relPath.startsWith("src/media-generation/") ||
    relPath.startsWith("src/media-understanding/") ||
    relPath.startsWith("src/memory-host-sdk/") ||
    relPath.startsWith("src/music-generation/") ||
    relPath.startsWith("src/tts/") ||
    relPath.startsWith("src/video-generation/")
  ) {
    return "batch-07-extensions-providers-memory-media";
  }

  return "batch-10-tooling-tests-release";
}

function resolveBatchMeta(batchId) {
  const match = BATCH_DEFS.find((batch) => batch.id === batchId);
  if (!match) {
    throw new Error(`Unknown batch id: ${batchId}`);
  }
  return match;
}

function nearestManifest(relPath) {
  const parts = relPath.split("/");
  for (let index = parts.length; index > 0; index -= 1) {
    const candidateDir = path.join(repoRoot, ...parts.slice(0, index - 1));
    for (const manifestName of ["package.json", "Package.swift", "project.yml"]) {
      const candidate = path.join(candidateDir, manifestName);
      if (fs.existsSync(candidate)) {
        return toPosix(path.relative(repoRoot, candidate));
      }
    }
  }
  return null;
}

function packageContext(relPath) {
  const manifest = nearestManifest(relPath);
  if (!manifest) {
    return "root";
  }
  if (manifest.endsWith("package.json")) {
    const pkg = safeReadJson(path.join(repoRoot, manifest));
    return pkg?.name ?? manifest;
  }
  return manifest;
}

function deriveModuleRoot(relPath) {
  const parts = relPath.split("/");
  if (parts.length === 1) {
    return "(root)";
  }
  if (parts[0] === "src" && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === "extensions" && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === "ui" && parts.length >= 3) {
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  if (parts[0] === "apps" && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === "packages" && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts[0] === "Swabble" && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

function walkSourceFiles(rootDir) {
  const results = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir) {
      continue;
    }
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = toPosix(path.relative(rootDir, fullPath));
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) {
          continue;
        }
        queue.push(fullPath);
        continue;
      }
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext) && !SPECIAL_FILENAMES.has(entry.name)) {
      continue;
    }
    results.push(relPath);
  }
  }
  return results.sort((left, right) => left.localeCompare(right));
}

function tryResolveCandidate(basePath) {
  const candidatePaths = new Set();
  const baseExt = path.extname(basePath).toLowerCase();
  const baseStem = baseExt ? basePath.slice(0, -baseExt.length) : basePath;
  candidatePaths.add(basePath);
  for (const ext of TS_FAMILY_EXTENSIONS) {
    candidatePaths.add(basePath + ext);
    candidatePaths.add(baseStem + ext);
  }
  for (const ext of TS_FAMILY_EXTENSIONS) {
    candidatePaths.add(path.join(basePath, `index${ext}`));
    candidatePaths.add(path.join(baseStem, `index${ext}`));
  }
  candidatePaths.add(basePath + ".swift");
  candidatePaths.add(baseStem + ".swift");
  candidatePaths.add(path.join(basePath, "index.swift"));
  candidatePaths.add(path.join(baseStem, "index.swift"));

  for (const candidate of candidatePaths) {
    const rel = toPosix(path.relative(repoRoot, candidate));
    if (!rel.startsWith("..") && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return rel;
    }
  }
  return null;
}

function resolveAliasImport(specifier) {
  if (specifier === "openclaw/extension-api") {
    return "src/extensionAPI.ts";
  }
  if (specifier === "openclaw/plugin-sdk" || specifier === "@openclaw/plugin-sdk") {
    return tryResolveCandidate(path.join(repoRoot, "src", "plugin-sdk", "index"));
  }
  if (
    specifier.startsWith("openclaw/plugin-sdk/") ||
    specifier.startsWith("@openclaw/plugin-sdk/")
  ) {
    const remainder = specifier.replace(/^@?openclaw\/plugin-sdk\//u, "");
    return tryResolveCandidate(path.join(repoRoot, "src", "plugin-sdk", remainder));
  }
  if (specifier.startsWith("@openclaw/")) {
    const remainder = specifier.slice("@openclaw/".length);
    return tryResolveCandidate(path.join(repoRoot, "extensions", remainder));
  }
  return null;
}

function resolveImport(fromRelPath, specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const fromDir = path.dirname(path.join(repoRoot, fromRelPath));
    const resolved = tryResolveCandidate(path.resolve(fromDir, specifier));
    if (resolved) {
      return { kind: "internal", resolved };
    }
    return { kind: "unresolved-local" };
  }

  const aliasResolved = resolveAliasImport(specifier);
  if (aliasResolved) {
    return { kind: "internal", resolved: aliasResolved };
  }

  if (BUILTIN_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix))) {
    return { kind: "builtin" };
  }

  return { kind: "external" };
}

function parseTsLikeImports(text) {
  const specifiers = [];
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/gu,
    /import\(\s*["']([^"']+)["']\s*\)/gu,
    /require\(\s*["']([^"']+)["']\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) {
        specifiers.push(specifier);
      }
    }
  }
  return [...new Set(specifiers)].sort((left, right) => left.localeCompare(right));
}

function parseSwiftImports(text) {
  const specifiers = [];
  for (const match of text.matchAll(/^\s*import\s+([A-Za-z_][A-Za-z0-9_.]*)/gmu)) {
    const specifier = match[1]?.trim();
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return [...new Set(specifiers)].sort((left, right) => left.localeCompare(right));
}

function collectImports(relPath, ext, text) {
  if (TS_FAMILY_EXTENSIONS.includes(ext)) {
    return parseTsLikeImports(text);
  }
  if (ext === ".swift") {
    return parseSwiftImports(text);
  }
  return [];
}

function makeInventoryEntry(relPath) {
  const absPath = path.join(repoRoot, relPath);
  const stat = fs.statSync(absPath);
  const ext = path.extname(relPath).toLowerCase();
  const text =
    TEXT_EXTENSIONS.has(ext) || SPECIAL_FILENAMES.has(path.basename(relPath))
      ? fs.readFileSync(absPath, "utf8")
      : "";
  const batchId = classifyBatch(relPath);
  const batchMeta = resolveBatchMeta(batchId);

  return {
    path: relPath,
    ext,
    language: languageFromExtension(ext, relPath),
    bytes: stat.size,
    lines: countLines(text),
    top_level: topLevelSegment(relPath),
    module_root: deriveModuleRoot(relPath),
    top_level_kind: classifyTopLevelKind(relPath),
    file_kind: classifyFileKind(relPath),
    batch_id: batchId,
    batch_name: batchMeta.name,
    domain: batchMeta.domain,
    package_context: packageContext(relPath),
    nearest_manifest: nearestManifest(relPath),
    is_test: isTestFile(relPath),
    entrypoint: isEntrypoint(relPath),
    text,
  };
}

function summarizeCounts(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return String(left[0]).localeCompare(String(right[0]));
    }),
  );
}

function toJsonlRows(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

function loadWorkspaceSummary() {
  const rootPackage = safeReadJson(path.join(repoRoot, "package.json")) ?? {};
  const workspaceFile = path.join(repoRoot, "pnpm-workspace.yaml");
  const workspaceText = fs.existsSync(workspaceFile) ? fs.readFileSync(workspaceFile, "utf8") : "";
  const workspacePackages = [];

  for (const relPath of walkSourceFiles(repoRoot)) {
    if (!relPath.endsWith("package.json")) {
      continue;
    }
    if (
      relPath.startsWith("vendor/") ||
      (!(
        relPath === "package.json" ||
        relPath === "ui/package.json" ||
        relPath.startsWith("packages/") ||
        relPath.startsWith("extensions/")
      ))
    ) {
      continue;
    }
    const pkg = safeReadJson(path.join(repoRoot, relPath));
    if (!pkg) {
      continue;
    }
    workspacePackages.push({
      path: relPath,
      name: pkg.name ?? null,
      private: pkg.private ?? null,
      type: pkg.type ?? null,
    });
  }

  return {
    root_package: {
      name: rootPackage.name ?? null,
      version: rootPackage.version ?? null,
      type: rootPackage.type ?? null,
      package_manager: rootPackage.packageManager ?? null,
      bin: rootPackage.bin ?? null,
    },
    workspace_manifest_present: fs.existsSync(workspaceFile),
    workspace_manifest_excerpt: workspaceText
      .split(/\r?\n/u)
      .slice(0, 20)
      .join("\n"),
    workspace_packages: workspacePackages.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function topHubs(inDegreeMap, outDegreeMap, inventoryByPath) {
  const normalize = (map) =>
    [...map.entries()]
      .map(([filePath, count]) => ({
        path: filePath,
        count,
        batch_id: inventoryByPath.get(filePath)?.batch_id ?? null,
      }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.path.localeCompare(right.path);
      })
      .slice(0, 25);

  return {
    highest_indegree: normalize(inDegreeMap),
    highest_outdegree: normalize(outDegreeMap),
  };
}

function main() {
  ensureDir(analysisRoot);
  ensureDir(manifestsDir);

  const generatedAt = new Date().toISOString();
  const relPaths = walkSourceFiles(repoRoot);
  const inventoryEntries = relPaths.map((relPath) => makeInventoryEntry(relPath));
  const inventoryByPath = new Map(inventoryEntries.map((entry) => [entry.path, entry]));
  const importRows = [];
  const inDegree = new Map();
  const outDegree = new Map();
  let importEdgeCount = 0;
  let internalImportEdgeCount = 0;

  for (const entry of inventoryEntries) {
    const imports = collectImports(entry.path, entry.ext, entry.text);
    const resolvedImports = imports.map((specifier) => {
      const resolution = resolveImport(entry.path, specifier);
      const record = {
        specifier,
        kind: resolution.kind,
        resolved: resolution.kind === "internal" ? resolution.resolved : undefined,
      };
      importEdgeCount += 1;
      if (resolution.kind === "internal" && resolution.resolved) {
        internalImportEdgeCount += 1;
        outDegree.set(entry.path, (outDegree.get(entry.path) ?? 0) + 1);
        inDegree.set(resolution.resolved, (inDegree.get(resolution.resolved) ?? 0) + 1);
      }
      return record;
    });

    importRows.push({
      path: entry.path,
      batch_id: entry.batch_id,
      language: entry.language,
      imports: resolvedImports,
    });
  }

  const batchFileMap = Object.fromEntries(BATCH_DEFS.map((batch) => [batch.id, []]));
  for (const entry of inventoryEntries) {
    batchFileMap[entry.batch_id].push(entry.path);
  }

  const unassigned = inventoryEntries.filter((entry) => !entry.batch_id).map((entry) => entry.path);
  const domainMap = {
    generated_at: generatedAt,
    repo_root: repoRoot,
    source_definition: {
      included_extensions: [...SOURCE_EXTENSIONS].sort(),
      ignored_directories: [...IGNORE_DIRS].sort(),
      note: "Source coverage includes code, manifests and automation files; Markdown and binary assets are excluded.",
    },
    coverage: {
      source_files: inventoryEntries.length,
      assigned_files: inventoryEntries.length - unassigned.length,
      unassigned_files: unassigned.length,
      unassigned_paths: unassigned,
      complete: unassigned.length === 0,
    },
    batches: BATCH_DEFS.map((batch) => ({
      batch_id: batch.id,
      name: batch.name,
      domain: batch.domain,
      summary: batch.summary,
      file_count: batchFileMap[batch.id].length,
      files: batchFileMap[batch.id],
    })),
    path_to_batch: Object.fromEntries(inventoryEntries.map((entry) => [entry.path, entry.batch_id])),
  };

  const workspaceSummary = loadWorkspaceSummary();
  const systemSummary = {
    generated_at: generatedAt,
    repo_root: repoRoot,
    repo_name: workspaceSummary.root_package.name,
    tech_stack: [
      "Node.js ESM monorepo",
      "TypeScript core runtime",
      "pnpm workspace",
      "Lit + Vite control UI",
      "Swift packages for macOS/iOS/shared kit",
      "Kotlin/Android companion stubs",
      "Vitest-based test matrix",
      "Plugin-first extension architecture",
    ],
    source_metrics: {
      source_file_count: inventoryEntries.length,
      by_extension: summarizeCounts(inventoryEntries, (entry) => entry.ext),
      by_top_level: summarizeCounts(inventoryEntries, (entry) => entry.top_level),
      by_batch: summarizeCounts(inventoryEntries, (entry) => entry.batch_id),
      tests: inventoryEntries.filter((entry) => entry.is_test).length,
      entrypoints: inventoryEntries.filter((entry) => entry.entrypoint).length,
    },
    workspace: workspaceSummary,
    entrypoints: inventoryEntries
      .filter((entry) => entry.entrypoint)
      .map((entry) => ({
        path: entry.path,
        batch_id: entry.batch_id,
        package_context: entry.package_context,
      })),
    presence: {
      docs_dir: fs.existsSync(path.join(repoRoot, "docs")),
      qa_dir: fs.existsSync(path.join(repoRoot, "qa")),
      scripts_dir: fs.existsSync(path.join(repoRoot, "scripts")),
      test_dir: fs.existsSync(path.join(repoRoot, "test")),
      ui_dir: fs.existsSync(path.join(repoRoot, "ui")),
      apps_dir: fs.existsSync(path.join(repoRoot, "apps")),
      extensions_dir: fs.existsSync(path.join(repoRoot, "extensions")),
      vendor_dir: fs.existsSync(path.join(repoRoot, "vendor")),
    },
    import_graph: {
      rows: importRows.length,
      import_edges: importEdgeCount,
      internal_import_edges: internalImportEdgeCount,
      hubs: topHubs(inDegree, outDegree, inventoryByPath),
    },
    coverage: domainMap.coverage,
  };

  const inventoryForOutput = inventoryEntries.map(({ text, ...rest }) => rest);

  fs.writeFileSync(
    path.join(manifestsDir, "file_inventory.jsonl"),
    toJsonlRows(inventoryForOutput),
    "utf8",
  );
  fs.writeFileSync(path.join(manifestsDir, "import_graph.jsonl"), toJsonlRows(importRows), "utf8");
  fs.writeFileSync(
    path.join(manifestsDir, "domain_map.json"),
    JSON.stringify(domainMap, null, 2) + "\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(manifestsDir, "system_summary.json"),
    JSON.stringify(systemSummary, null, 2) + "\n",
    "utf8",
  );

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        generated_at: generatedAt,
        source_files: inventoryEntries.length,
        import_rows: importRows.length,
        internal_import_edges: internalImportEdgeCount,
        batches: BATCH_DEFS.map((batch) => ({
          id: batch.id,
          file_count: batchFileMap[batch.id].length,
        })),
      },
      null,
      2,
    ) + "\n",
  );
}

main();
