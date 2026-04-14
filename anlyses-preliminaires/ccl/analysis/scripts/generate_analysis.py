from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from fnmatch import fnmatch
from pathlib import Path
import platform

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
AN = ROOT / "analysis"
MAN = AN / "manifests"
BAT = AN / "batches"
REU = AN / "reuse"
EXTS = [".ts", ".tsx", ".js", ".jsx"]
READ_ORDER = ["B01", "B03", "B04", "B05", "B08", "B09", "B02", "B06", "B07", "B10"]

BATCHES = [
    {"id": "B01", "title": "Core bootstrap & session loop", "prio": "haute",
     "patterns": ["src/main.tsx", "src/setup.ts", "src/query.ts", "src/QueryEngine.ts", "src/context.ts", "src/cost-tracker.ts", "src/costHook.ts", "src/entrypoints/**", "src/bootstrap/**"],
     "purpose": "Demarrage CLI, contexte, startup prefetch et boucle principale.",
     "entry": ["src/main.tsx", "src/query.ts", "src/QueryEngine.ts", "src/entrypoints/init.ts"],
     "flow": ["Bootstrap side-effects", "Resolution du contexte", "Boucle session -> query engine"],
     "deps": ["Commander / CLI", "settings", "API layer"], "ideas": ["parallel startup prefetch", "feature flags au boot", "bootstrap separe de la boucle"], "risk": "Couplage eleve au runtime de session.", "hints": ["profileCheckpoint", "startMdmRawRead", "prepareApiRequest"]},
    {"id": "B02", "title": "Command system & CLI transports", "prio": "moyenne",
     "patterns": ["src/commands.ts", "src/commands/**", "src/cli/**", "src/types/command.ts"],
     "purpose": "Registre des commandes et chemins CLI interactifs/non interactifs.",
     "entry": ["src/commands.ts", "src/cli/print.ts", "src/cli/structuredIO.ts"],
     "flow": ["Registry", "Filtrage par mode", "Transport IO"], "deps": ["Commander", "structured IO", "remote IO"], "ideas": ["lazy command shims", "registry central"], "risk": "Couplage moyen au runtime de session.", "hints": ["getCommands", "filterCommandsForRemoteMode", "structuredIO"]},
    {"id": "B03", "title": "Tool system: shell/file/web/search", "prio": "haute",
     "patterns": ["src/Tool.ts", "src/tools.ts", "src/tools/BashTool/**", "src/tools/PowerShellTool/**", "src/tools/FileEditTool/**", "src/tools/FileReadTool/**", "src/tools/FileWriteTool/**", "src/tools/NotebookEditTool/**", "src/tools/WebFetchTool/**", "src/tools/WebSearchTool/**", "src/tools/GrepTool/**", "src/tools/GlobTool/**", "src/tools/TodoWriteTool/**", "src/tools/testing/**", "src/tools/utils.ts", "src/utils/bash/**", "src/utils/powershell/**", "src/utils/shell/**", "src/components/permissions/BashPermissionRequest/**", "src/components/permissions/PowerShellPermissionRequest/**", "src/components/permissions/FileEditPermissionRequest/**", "src/components/permissions/FileWritePermissionRequest/**", "src/components/permissions/NotebookEditPermissionRequest/**", "src/components/permissions/WebFetchPermissionRequest/**"],
     "purpose": "Contracts de tools, shell safety rails, edition de fichiers, web et recherche.",
     "entry": ["src/Tool.ts", "src/tools.ts", "src/tools/BashTool/BashTool.tsx", "src/tools/PowerShellTool/PowerShellTool.tsx"],
     "flow": ["Registry de tools", "Schema + prompt + UI", "Validation / execution"], "deps": ["Shell local", "permission UI", "web fetch/search"], "ideas": ["shell guardrails", "diff-friendly file editing", "separation schema/prompt/execution"], "risk": "Valeur tres haute mais forte integration au systeme de permissions.", "hints": ["getAllBaseTools", "bashPermissions", "pathValidation"]},
    {"id": "B04", "title": "Agent orchestration", "prio": "haute",
     "patterns": ["src/Task.ts", "src/tasks.ts", "src/tasks/**", "src/coordinator/**", "src/tools/AgentTool/**", "src/tools/AskUserQuestionTool/**", "src/tools/SendMessageTool/**", "src/tools/TeamCreateTool/**", "src/tools/TeamDeleteTool/**", "src/tools/TaskCreateTool/**", "src/tools/TaskGetTool/**", "src/tools/TaskListTool/**", "src/tools/TaskOutputTool/**", "src/tools/TaskStopTool/**", "src/tools/TaskUpdateTool/**", "src/tools/EnterPlanModeTool/**", "src/tools/ExitPlanModeTool/**", "src/tools/EnterWorktreeTool/**", "src/tools/ExitWorktreeTool/**", "src/tools/ToolSearchTool/**", "src/utils/swarm/**", "src/utils/task/**", "src/utils/tasks.js", "src/utils/agent*", "src/utils/teammate.js", "src/hooks/useTasksV2.ts", "src/hooks/useTaskListWatcher.ts", "src/hooks/useSwarm*.ts*", "src/hooks/useTeammate*.ts*", "src/components/agents/**", "src/components/teams/**", "src/components/AgentProgressLine.tsx", "src/components/CoordinatorAgentStatus.tsx", "src/components/permissions/Worker*.tsx"],
     "purpose": "Sous-agents, teams, tasks, worktrees et plan mode.",
     "entry": ["src/tools/AgentTool/AgentTool.ts", "src/tasks/LocalAgentTask/LocalAgentTask.tsx", "src/utils/swarm/backends/registry.ts"],
     "flow": ["Spawn / team", "Task lifecycle", "Backends swarm / worktree"], "deps": ["task runtime", "swarm backends", "UI status"], "ideas": ["backend abstraction", "task progress streaming", "plan/worktree guardrails"], "risk": "Couplage eleve avec etat, UI et tools.", "hints": ["AgentTool", "TeamCreateTool", "swarm", "worktree"]},
    {"id": "B05", "title": "MCP, LSP, plugins, skills", "prio": "haute",
     "patterns": ["src/tools/MCPTool/**", "src/tools/ReadMcpResourceTool/**", "src/tools/ListMcpResourcesTool/**", "src/tools/McpAuthTool/**", "src/tools/LSPTool/**", "src/tools/SkillTool/**", "src/services/mcp/**", "src/services/lsp/**", "src/services/plugins/**", "src/plugins/**", "src/skills/**", "src/outputStyles/**", "src/utils/plugins/**", "src/utils/skills/**", "src/components/mcp/**", "src/components/LspRecommendation/**", "src/components/MCP*.tsx"],
     "purpose": "Integrations extensibles: MCP, LSP, plugins, skills et output styles.",
     "entry": ["src/services/mcp/client.ts", "src/services/mcp/MCPConnectionManager.tsx", "src/utils/plugins/pluginLoader.ts", "src/skills/loadSkillsDir.ts"],
     "flow": ["Load registries", "Policy / auth", "Expose tools/resources/styles"], "deps": ["MCP", "LSP", "plugin marketplace"], "ideas": ["plugin loader versionne", "skill loading", "MCP connection manager"], "risk": "Abstractions tres utiles mais couches de chargement denses.", "hints": ["MCPConnectionManager", "pluginLoader", "loadSkillsDir"]},
    {"id": "B06", "title": "REPL & UI shell", "prio": "moyenne",
     "patterns": ["src/replLauncher.tsx", "src/dialogLaunchers.tsx", "src/interactiveHelpers.tsx", "src/screens/**", "src/components/**", "src/hooks/**", "src/context/**", "src/history.ts"],
     "purpose": "REPL terminal, composants de conversation, prompt input et dialogues.",
     "entry": ["src/screens/REPL.tsx", "src/components/PromptInput/PromptInput.tsx", "src/components/Messages.tsx", "src/dialogLaunchers.tsx"],
     "flow": ["REPL state", "message rendering", "prompt + dialogs"], "deps": ["Ink UI", "state store", "permission components"], "ideas": ["rich prompt input", "message components", "wizard/dialog flows"], "risk": "Couplage moyen avec etat et permissions.", "hints": ["REPL.tsx", "PromptInput", "Messages.tsx"]},
    {"id": "B07", "title": "Terminal engine & interaction model", "prio": "moyenne",
     "patterns": ["src/ink.ts", "src/ink/**", "src/keybindings/**", "src/vim/**", "src/native-ts/**", "src/moreright/**"],
     "purpose": "Moteur terminal Ink custom, layout, evenements, keybindings et mode Vim.",
     "entry": ["src/ink/ink.tsx", "src/ink/renderer.ts", "src/keybindings/resolver.ts", "src/vim/transitions.ts"],
     "flow": ["Layout", "event pipeline", "interaction model"], "deps": ["Ink", "Yoga", "keyboard events"], "ideas": ["terminal abstraction", "vim motions", "keybinding resolver"], "risk": "Reutilisable mais lie au paradigme Ink.", "hints": ["render-to-screen", "resolver", "motions"]},
    {"id": "B08", "title": "Bridge, remote & IDE integration", "prio": "haute",
     "patterns": ["src/bridge/**", "src/remote/**", "src/server/**", "src/upstreamproxy/**", "src/utils/teleport/**", "src/utils/githubRepoPathMapping.ts", "src/utils/githubRepoPathMapping.js"],
     "purpose": "Bridge IDE, sessions distantes, direct connect et teleport.",
     "entry": ["src/bridge/bridgeMain.ts", "src/bridge/replBridge.ts", "src/remote/RemoteSessionManager.ts", "src/server/createDirectConnectSession.ts"],
     "flow": ["Bridge protocol", "remote session state", "direct connect"], "deps": ["WebSocket", "permissions", "session runtime"], "ideas": ["bridge protocol", "remote session manager", "permission callbacks"], "risk": "Bloc tres riche mais couplage eleve.", "hints": ["bridgeMain", "replBridge", "RemoteSessionManager"]},
    {"id": "B09", "title": "Memory, state, settings & policy", "prio": "haute",
     "patterns": ["src/projectOnboardingState.ts", "src/state/**", "src/memdir/**", "src/migrations/**", "src/services/SessionMemory/**", "src/services/extractMemories/**", "src/services/teamMemorySync/**", "src/services/settingsSync/**", "src/services/remoteManagedSettings/**", "src/services/policyLimits/**", "src/utils/settings/**", "src/utils/permissions/**", "src/utils/config.ts", "src/utils/session*.ts", "src/utils/session*.tsx", "src/utils/conversationRecovery.ts", "src/utils/sessionRestore.ts", "src/schemas/**", "src/components/memory/**", "src/components/ManagedSettingsSecurityDialog/**"],
     "purpose": "Memoire persistante, state store, settings, migrations et policy limits.",
     "entry": ["src/state/store.ts", "src/memdir/memdir.ts", "src/services/SessionMemory/sessionMemory.ts", "src/utils/settings/settings.ts"],
     "flow": ["store + caches", "memory extraction/sync", "settings/policy resolution"], "deps": ["local storage", "managed settings", "validation"], "ideas": ["persistent memory stack", "multi-source settings", "policy layer"], "risk": "Tres bon socle, mais partage dans tout le runtime.", "hints": ["sessionMemory", "memdir", "policyLimits"]},
    {"id": "B10", "title": "Shared infra, auth, analytics & edge features", "prio": "moyenne",
     "patterns": ["src/assistant/**", "src/buddy/**", "src/constants/**", "src/query/**", "src/services/**", "src/tools/**", "src/types/**", "src/voice/**", "src/utils/**"],
     "purpose": "API, OAuth, analytics, compact, voice, constants, types et utils transverses.",
     "entry": ["src/services/api/claude.ts", "src/services/oauth/client.ts", "src/services/analytics/index.ts", "src/services/compact/compact.ts", "src/utils/messages.ts"],
     "flow": ["shared services", "auth + telemetry", "utility layer"], "deps": ["Anthropic API", "OAuth", "analytics"], "ideas": ["API client robuste", "OAuth stack", "context compaction"], "risk": "Couplage variable selon la sous-zone.", "hints": ["services/api/claude.ts", "oauth", "compact", "growthbook"]},
]

FEATURES = [
    {"id": "bootstrap_parallel_prefetch", "b": "B01", "name": "Parallel startup prefetch", "p": ["src/main.tsx", "src/setup.ts", "src/bootstrap/**"], "sum": "Prefetch des prerequis critiques avant la charge lourde.", "kw": ["bootstrap", "prefetch"], "reuse": "haute", "coupling": "moyenne", "deps": ["settings", "secure storage"]},
    {"id": "main_session_loop", "b": "B01", "name": "Session main loop", "p": ["src/main.tsx", "src/query.ts", "src/QueryEngine.ts"], "sum": "Boucle principale et orchestration de requetes.", "kw": ["session", "query-engine"], "reuse": "moyenne", "coupling": "haute", "deps": ["state", "API", "tools"]},
    {"id": "command_registry", "b": "B02", "name": "Command registry", "p": ["src/commands.ts", "src/commands/**"], "sum": "Commandes slash et dispatch CLI.", "kw": ["commands", "dispatch"], "reuse": "haute", "coupling": "moyenne", "deps": ["main bootstrap"]},
    {"id": "cli_transports", "b": "B02", "name": "CLI transports", "p": ["src/cli/**"], "sum": "IO structuree, remote IO et upload d'evenements.", "kw": ["cli", "transport"], "reuse": "moyenne", "coupling": "moyenne", "deps": ["session events"]},
    {"id": "bash_safety_layer", "b": "B03", "name": "Bash safety rails", "p": ["src/tools/BashTool/**", "src/utils/bash/**", "src/utils/shell/**"], "sum": "Validation shell, read-only et avertissements de destruction.", "kw": ["bash", "shell", "permissions"], "reuse": "haute", "coupling": "moyenne", "deps": ["tool runtime", "permission UI"]},
    {"id": "powershell_safety_layer", "b": "B03", "name": "PowerShell safety rails", "p": ["src/tools/PowerShellTool/**", "src/utils/powershell/**"], "sum": "Validation PowerShell et controles de chemins.", "kw": ["powershell", "validation"], "reuse": "haute", "coupling": "moyenne", "deps": ["tool runtime"]},
    {"id": "file_mutation_tools", "b": "B03", "name": "File edit/write tools", "p": ["src/tools/FileEditTool/**", "src/tools/FileWriteTool/**", "src/tools/NotebookEditTool/**", "src/tools/FileReadTool/**"], "sum": "Edition de fichiers/notebooks et rendu de diff.", "kw": ["file-edit", "diff"], "reuse": "haute", "coupling": "moyenne", "deps": ["tool contracts", "UI diff"]},
    {"id": "web_and_search_tools", "b": "B03", "name": "Web/search tools", "p": ["src/tools/WebFetchTool/**", "src/tools/WebSearchTool/**", "src/tools/GrepTool/**", "src/tools/GlobTool/**"], "sum": "Fetch web, search web et search locale.", "kw": ["web", "grep", "glob"], "reuse": "haute", "coupling": "faible", "deps": ["tool contracts"]},
    {"id": "agent_orchestration", "b": "B04", "name": "Agent orchestration", "p": ["src/tools/AgentTool/**", "src/tools/Team*Tool/**", "src/utils/swarm/**", "src/tasks/**"], "sum": "Sous-agents, teams et execution parallele.", "kw": ["agent", "swarm", "task"], "reuse": "haute", "coupling": "haute", "deps": ["task runtime", "worktree"]},
    {"id": "plan_worktree_controls", "b": "B04", "name": "Plan/worktree controls", "p": ["src/tools/EnterPlanModeTool/**", "src/tools/ExitPlanModeTool/**", "src/tools/EnterWorktreeTool/**", "src/tools/ExitWorktreeTool/**"], "sum": "Separation planification/execution et isolation worktree.", "kw": ["plan-mode", "worktree"], "reuse": "haute", "coupling": "moyenne", "deps": ["permission model"]},
    {"id": "mcp_layer", "b": "B05", "name": "MCP layer", "p": ["src/services/mcp/**", "src/tools/MCPTool/**", "src/tools/ReadMcpResourceTool/**", "src/tools/ListMcpResourcesTool/**"], "sum": "Connections MCP, auth, ressources et tools.", "kw": ["mcp", "resource"], "reuse": "haute", "coupling": "moyenne", "deps": ["MCP SDK", "permission UI"]},
    {"id": "plugin_loader", "b": "B05", "name": "Plugin loader", "p": ["src/utils/plugins/**", "src/services/plugins/**", "src/plugins/**"], "sum": "Chargement, caches et validation des plugins.", "kw": ["plugin", "marketplace"], "reuse": "haute", "coupling": "moyenne", "deps": ["settings", "startup checks"]},
    {"id": "skill_loader", "b": "B05", "name": "Skill loader", "p": ["src/skills/**", "src/tools/SkillTool/**"], "sum": "Skills embarques/utilisateur et runtime associe.", "kw": ["skills"], "reuse": "haute", "coupling": "moyenne", "deps": ["filesystem", "tool runtime"]},
    {"id": "lsp_integration", "b": "B05", "name": "LSP integration", "p": ["src/services/lsp/**", "src/tools/LSPTool/**"], "sum": "Language servers, diagnostics et symbol context.", "kw": ["lsp", "diagnostics"], "reuse": "moyenne", "coupling": "moyenne", "deps": ["tool runtime"]},
    {"id": "repl_shell", "b": "B06", "name": "REPL shell", "p": ["src/screens/REPL.tsx", "src/components/PromptInput/**", "src/components/messages/**", "src/components/Messages.tsx"], "sum": "Surface conversationnelle et prompt riche.", "kw": ["repl", "prompt-input"], "reuse": "moyenne", "coupling": "moyenne", "deps": ["Ink", "state", "permissions"]},
    {"id": "dialog_wizards", "b": "B06", "name": "Dialogs and wizards", "p": ["src/components/wizard/**", "src/dialogLaunchers.tsx", "src/components/permissions/**"], "sum": "Dialogs, wizards et confirmations guidees.", "kw": ["dialog", "wizard"], "reuse": "moyenne", "coupling": "moyenne", "deps": ["UI shell"]},
    {"id": "terminal_engine", "b": "B07", "name": "Terminal engine", "p": ["src/ink/**", "src/ink.ts", "src/native-ts/**"], "sum": "Rendu terminal, layout et event pipeline.", "kw": ["ink", "terminal"], "reuse": "moyenne", "coupling": "moyenne", "deps": ["Ink", "Yoga"]},
    {"id": "keybindings_vim", "b": "B07", "name": "Keybindings and Vim", "p": ["src/keybindings/**", "src/vim/**"], "sum": "Raccourcis et motions Vim.", "kw": ["keybindings", "vim"], "reuse": "moyenne", "coupling": "faible", "deps": ["input pipeline"]},
    {"id": "ide_bridge", "b": "B08", "name": "IDE bridge", "p": ["src/bridge/**"], "sum": "Pont bidirectionnel CLI <-> IDE/clients externes.", "kw": ["bridge", "ide"], "reuse": "haute", "coupling": "haute", "deps": ["remote transports", "permissions"]},
    {"id": "remote_sessions", "b": "B08", "name": "Remote sessions", "p": ["src/remote/**", "src/server/**", "src/utils/teleport/**"], "sum": "Sessions distantes, direct connect et teleport.", "kw": ["remote", "session"], "reuse": "haute", "coupling": "haute", "deps": ["bridge", "API/auth"]},
    {"id": "memory_stack", "b": "B09", "name": "Persistent memory stack", "p": ["src/memdir/**", "src/services/SessionMemory/**", "src/services/extractMemories/**", "src/services/teamMemorySync/**"], "sum": "Memoire persistante, extraction et sync.", "kw": ["memory", "memdir"], "reuse": "haute", "coupling": "moyenne", "deps": ["settings", "filesystem"]},
    {"id": "settings_policy", "b": "B09", "name": "Settings and policy", "p": ["src/utils/settings/**", "src/services/remoteManagedSettings/**", "src/services/policyLimits/**", "src/migrations/**"], "sum": "Settings multi-source, migrations et policy limits.", "kw": ["settings", "policy"], "reuse": "haute", "coupling": "moyenne", "deps": ["bootstrap", "storage"]},
    {"id": "api_client", "b": "B10", "name": "Anthropic API client", "p": ["src/services/api/**", "src/services/claudeAiLimits.ts", "src/services/claudeAiLimitsHook.ts"], "sum": "Client API, retries, quotas et usage tracking.", "kw": ["api", "usage"], "reuse": "haute", "coupling": "moyenne", "deps": ["auth", "query engine"]},
    {"id": "oauth_stack", "b": "B10", "name": "OAuth stack", "p": ["src/services/oauth/**", "src/utils/auth.ts"], "sum": "Flux OAuth, credentials et profil.", "kw": ["oauth", "auth"], "reuse": "haute", "coupling": "moyenne", "deps": ["secure storage", "API"]},
    {"id": "analytics_flags", "b": "B10", "name": "Analytics and flags", "p": ["src/services/analytics/**"], "sum": "Analytics sinks et gates de fonctionnalites.", "kw": ["analytics", "feature-flags"], "reuse": "moyenne", "coupling": "faible", "deps": ["startup"]},
    {"id": "context_compaction", "b": "B10", "name": "Context compaction", "p": ["src/services/compact/**"], "sum": "Compact, microcompact et token budget logic.", "kw": ["compact", "context-window"], "reuse": "haute", "coupling": "moyenne", "deps": ["prompt assembly", "history"]},
    {"id": "voice_mode", "b": "B10", "name": "Voice mode", "p": ["src/services/voice*.ts", "src/voice/**", "src/hooks/useVoice*.ts*"], "sum": "Voice/STT et activation de l'experience vocale.", "kw": ["voice", "speech"], "reuse": "moyenne", "coupling": "moyenne", "deps": ["UI shell", "feature flags"]},
]

KW = {"agent": ["agent", "teammate", "swarm"], "api": ["api", "anthropic", "usage"], "auth": ["oauth", "auth", "jwt"], "bash": ["bash", "shell"], "bridge": ["bridge", "teleport", "remote"], "compact": ["compact", "microcompact"], "ink": ["ink", "terminal", "renderer"], "lsp": ["lsp", "diagnostic"], "mcp": ["mcp", "resource", "server"], "memory": ["memory", "memdir"], "permissions": ["permission", "approval", "sandbox"], "plugin": ["plugin", "marketplace"], "powershell": ["powershell", "pathvalidation"], "repl": ["repl", "promptinput", "messages"], "settings": ["settings", "policy", "migration"], "skill": ["skill"], "task": ["task", "todo"], "voice": ["voice", "speech"], "web": ["webfetch", "websearch", "grep", "glob"], "worktree": ["worktree", "git", "branch"]}
IMP = [("static", re.compile(r"^\s*import(?:[\s\w{},*]+?\s+from\s+)?['\"]([^'\"]+)['\"]", re.M)), ("export_from", re.compile(r"^\s*export\s+(?:type\s+)?(?:\{[^}]+\}|\*)\s*from\s+['\"]([^'\"]+)['\"]", re.M)), ("require", re.compile(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)")), ("dynamic_import", re.compile(r"import\(\s*['\"]([^'\"]+)['\"]\s*\)"))]
EXP = [re.compile(r"^\s*export\s+(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)", re.M), re.compile(r"^\s*export\s+default\s+([A-Za-z_$][\w$]*)?", re.M), re.compile(r"^\s*export\s*\{([^}]+)\}", re.M)]


def norm(p: Path) -> str: return p.relative_to(ROOT).as_posix()
def slug(text: str) -> str: return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
def match(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        base = pattern[:-3].rstrip("/")
        return path == base or path.startswith(base + "/")
    return fnmatch(path, pattern) if any(ch in pattern for ch in "*?[") else path == pattern


def choose_batch(path: str) -> dict[str, object]:
    for item in BATCHES:
        if any(match(path, pattern) for pattern in item["patterns"]):
            return item
    raise ValueError(f"Unassigned path: {path}")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def line_count(text: str) -> int:
    return 0 if not text else text.count("\n") + (0 if text.endswith("\n") else 1)


def extract_imports(text: str) -> list[dict[str, str]]:
    seen, out = set(), []
    for kind, rx in IMP:
        for m in rx.finditer(text):
            spec = m.group(1).strip()
            if spec and (kind, spec) not in seen:
                seen.add((kind, spec))
                out.append({"kind": kind, "specifier": spec})
    return out


def extract_exports(text: str) -> list[str]:
    seen, out = set(), []
    for rx in EXP:
        for m in rx.finditer(text):
            raw = "default" if m.group(1) is None else m.group(1)
            for chunk in raw.split(","):
                name = chunk.replace("type ", "").strip()
                if " as " in name:
                    name = name.split(" as ", 1)[1].strip()
                if name and name not in seen:
                    seen.add(name)
                    out.append(name)
    return out


def feature_flags(text: str) -> list[str]:
    return sorted(set(re.findall(r"feature\(\s*['\"]([A-Z0-9_]+)['\"]\s*\)", text)))


def resolve_module(source: str, spec: str) -> str | None:
    if spec.startswith("."):
        base = (ROOT / source).parent / spec
    elif spec.startswith("src/"):
        base = ROOT / spec
    else:
        return None
    candidates = []
    if base.suffix:
        stem = base.with_suffix("")
        candidates += [stem.with_suffix(ext) for ext in EXTS] + [base]
    else:
        candidates += [base.with_suffix(ext) for ext in EXTS]
        candidates += [base / f"index{ext}" for ext in EXTS]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return norm(candidate)
    return None


def file_keywords(path: str, text: str, seed: list[str]) -> list[str]:
    hay = f"{path.lower()} {text.lower()}".replace("_", "").replace("-", "")
    out = set(seed)
    for key, needles in KW.items():
        if any(n.lower().replace("_", "").replace("-", "") in hay for n in needles):
            out.add(key)
    parts = path.split("/")
    if len(parts) > 1:
        out.add(parts[1])
    if len(parts) > 2:
        out.add(parts[2].split(".")[0])
    return sorted(out)[:16]


def part_top_dir(path: str) -> str:
    parts = path.split("/")
    return parts[1] if len(parts) > 2 else "root"


def part_subsystem(path: str) -> str:
    parts = path.split("/")
    if len(parts) <= 2:
        return f"root/{Path(parts[-1]).stem}"
    return f"{parts[1]}/root" if len(parts) == 3 else f"{parts[1]}/{parts[2]}"


def match_paths(patterns: list[str], all_paths: list[str]) -> list[str]:
    return [path for path in all_paths if any(match(path, pattern) for pattern in patterns)]


def md_list(items: list[str], wrap: bool = False) -> str:
    if not items:
        return "- aucune entree notable"
    return "\n".join(f"- `{item}`" if wrap else f"- {item}" for item in items)


def batch_doc(cfg: dict[str, object], rows: list[dict[str, object]], feats: list[dict[str, object]]) -> str:
    paths = [pattern for pattern in cfg["patterns"] if any(match(row["path"], pattern) for row in rows)][:12]
    biggest = sorted(rows, key=lambda row: row["lines"], reverse=True)
    keys = [f"{row['path']} - {row['lines']} lignes" for row in biggest[:8]]
    hubs = [f"{row['path']} - {row['internal_dependents']} dependants" for row in biggest if row["internal_dependents"]][:6]
    flags = sorted({flag for row in rows for flag in row["feature_flags"]})
    feat_lines = [f"{item['name']} - {item['summary']} (reuse: {item['reuse_score']}, coupling: {item['coupling']})" for item in feats]
    top_sub = Counter(row["subsystem"] for row in rows).most_common(6)
    return "\n".join([
        "---",
        f"batch_id: {cfg['id']}",
        f"title: {cfg['title']}",
        "paths:",
        *[f"  - {p}" for p in paths],
        f"priority: {cfg['prio']}",
        "status: generated",
        "keywords:",
        *[f"  - {k}" for k in cfg["hints"]],
        "---",
        "",
        f"# {cfg['id']} - {cfg['title']}",
        "",
        "## Resume",
        f"- Couverture: {len(rows)} fichiers / {sum(row['lines'] for row in rows)} lignes.",
        f"- Sous-systemes dominants: {', '.join(f'{name} ({count})' for name, count in top_sub) or 'n/a'}.",
        f"- Hubs: {', '.join(hubs) if hubs else 'aucun hub dominant detecte'}.",
        "",
        "## purpose",
        str(cfg["purpose"]),
        "",
        "## entrypoints",
        md_list([item for item in cfg["entry"] if any(row["path"] == item for row in rows)], True),
        "",
        "## key files",
        md_list(keys),
        "",
        "## data flow",
        md_list(cfg["flow"]),
        "",
        "## external deps",
        md_list(cfg["deps"]),
        "",
        "## flags/env",
        md_list(flags, True) if flags else "- pas de feature flag dominant detecte",
        "",
        "## reusable ideas",
        md_list(cfg["ideas"]),
        "",
        "## reusable features",
        md_list(feat_lines),
        "",
        "## copy risk",
        str(cfg["risk"]),
        "",
        "## search hints",
        md_list(cfg["hints"], True),
        "",
    ])


def index_doc(summary: dict[str, object], feats_by_batch: dict[str, list[dict[str, object]]]) -> str:
    batch_rows = []
    for cfg in BATCHES:
        stats = summary["batch_stats"][cfg["id"]]
        doc = f"batches/{cfg['id'].lower()}-{slug(cfg['title'])}.md"
        batch_rows.append(f"| `{cfg['id']}` | {cfg['prio']} | {stats['files']} | {stats['lines']} | {cfg['title']} | [{cfg['id']}]({doc}) |")
    hubs = [f"- `{item['path']}` - {item['internal_dependents']} dependants internes" for item in summary["hub_modules"][:12]]
    top_dirs = ", ".join(f"{item['name']} ({item['lines']} lignes)" for item in summary["top_dirs"][:10])
    return "\n".join([
        "# Analysis Index",
        "",
        "## Snapshot",
        f"- Source analysee: `src/` dans `{ROOT.name}`.",
        f"- Total fichiers: {summary['total_files']}.",
        f"- Total lignes: {summary['total_lines']}.",
        f"- Runtime d'indexation: Python {summary['python_runtime']} ; Bun non requis.",
        "",
        "## Manifests",
        "| Fichier | Role |",
        "| --- | --- |",
        "| `manifests/file_inventory.jsonl` | inventaire par fichier avec lots, imports, exports, mots-cles et roles |",
        "| `manifests/import_graph.jsonl` | aretes d'import internes/externes |",
        "| `manifests/feature_catalog.jsonl` | catalogue des capacites reutilisables |",
        "| `manifests/domain_map.json` | regles + affectations exactes de tous les fichiers |",
        "| `manifests/system_summary.json` | synthese machine-friendly des volumes, hubs et lots |",
        "",
        "## Lots d'analyse",
        "| Batch | Priorite | Fichiers | Lignes | Focus | Document |",
        "| --- | --- | ---: | ---: | --- | --- |",
        *batch_rows,
        "",
        "## Hubs internes a surveiller",
        *hubs,
        "",
        "## Raccourcis de recherche",
        "| Question | Aller d'abord vers |",
        "| --- | --- |",
        "| Demarrage de session | `B01`, `src/main.tsx`, `bootstrap_parallel_prefetch` |",
        "| Permissions shell | `B03`, `src/tools/BashTool/`, `bash_safety_layer` |",
        "| Orchestration d'agents | `B04`, `src/tools/AgentTool/`, `agent_orchestration` |",
        "| MCP / plugins | `B05`, `src/services/mcp/`, `plugin_loader`, `mcp_layer` |",
        "| Demarrage REPL | `B06`, `src/screens/REPL.tsx`, `repl_shell` |",
        "| Memory / settings | `B09`, `src/memdir/`, `settings_policy` |",
        "| API / auth | `B10`, `src/services/api/`, `oauth_stack`, `api_client` |",
        "",
        "## Repartition macroscopique",
        f"- Top repertoires par volume: {top_dirs}.",
        f"- Features cataloguees: {sum(len(v) for v in feats_by_batch.values())}.",
        f"- Ordre de lecture recommande: {', '.join(READ_ORDER)}.",
        "",
        "## Regeneration",
        "- `python analysis/scripts/generate_analysis.py`",
        "- Voir aussi `reuse/reuse-candidates.md` pour les briques a copier en priorite.",
        "",
    ])


def reuse_doc(feats: list[dict[str, object]]) -> str:
    score = {"haute": 3, "moyenne": 2, "faible": 1}
    coupling = {"faible": 0, "moyenne": 1, "haute": 2}
    ordered = sorted(feats, key=lambda f: (-score[f["reuse_score"]], coupling[f["coupling"]], f["name"]))
    lines = [
        "# Reuse Candidates", "", "## Lecture rapide",
        "- Prioriser les briques `haute` valeur / `faible` ou `moyenne` coupling.",
        "- `B03`, `B05`, `B09` et `B10` offrent le meilleur ratio valeur / effort.",
        "",
        "| Feature | Batch | Valeur | Coupling | Pourquoi | Dependances |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for item in ordered:
        lines.append(f"| `{item['feature_id']}` | `{item['batch_id']}` | {item['reuse_score']} | {item['coupling']} | {item['summary']} | {', '.join(item['dependencies'])} |")
    return "\n".join(lines + [""])


def main() -> None:
    for path in (AN, MAN, BAT, REU):
        path.mkdir(exist_ok=True)

    raw, edges = [], []
    for file_path in sorted(path for path in SRC.rglob("*") if path.is_file()):
        rel = norm(file_path)
        cfg = choose_batch(rel)
        text = read_text(file_path)
        imports = extract_imports(text)
        resolved = []
        for item in imports:
            target = resolve_module(rel, item["specifier"])
            if target:
                resolved.append(target)
            edges.append({"source": rel, "specifier": item["specifier"], "resolved_target": target, "kind": item["kind"], "is_internal": bool(target)})
        raw.append({
            "path": rel,
            "top_dir": part_top_dir(rel),
            "subsystem": part_subsystem(rel),
            "lines": line_count(text),
            "imports": sorted({item["specifier"] for item in imports}),
            "exports": extract_exports(text),
            "batch_id": cfg["id"],
            "batch_title": cfg["title"],
            "keywords": file_keywords(rel, text, cfg["hints"]),
            "feature_flags": feature_flags(text),
            "resolved_internal_imports": sorted(set(resolved)),
        })

    indeg, outdeg = Counter(), Counter()
    for edge in edges:
        if edge["resolved_target"]:
            indeg[edge["resolved_target"]] += 1
            outdeg[edge["source"]] += 1

    entrypoints = {item for cfg in BATCHES for item in cfg["entry"]}
    inv, by_batch = [], defaultdict(list)
    for row in sorted(raw, key=lambda r: r["path"]):
        roles = []
        if row["path"] in entrypoints:
            roles.append("entrypoint")
        if row["path"] == "src/commands.ts":
            roles.append("command-registry")
        if row["path"] == "src/tools.ts":
            roles.append("tool-registry")
        if row["path"] == "src/QueryEngine.ts":
            roles.append("query-engine")
        if row["path"].startswith("src/commands/"):
            roles.append("command-module")
        if row["path"].startswith("src/tools/"):
            roles.append("tool-module")
        if row["path"].startswith("src/components/"):
            roles.append("ui-component")
        if row["path"].startswith("src/services/"):
            roles.append("service-module")
        if row["path"].startswith("src/utils/"):
            roles.append("utility-module")
        if indeg[row["path"]] >= 10:
            roles.append("hub-module")
        row["internal_dependents"] = indeg[row["path"]]
        row["internal_dependencies"] = outdeg[row["path"]]
        row["roles"] = roles
        inv.append(row)
        by_batch[row["batch_id"]].append(row)

    all_paths = [row["path"] for row in inv]
    feat_rows, feats_by_batch = [], defaultdict(list)
    for feat in FEATURES:
        paths = match_paths(feat["p"], all_paths)
        if paths:
            item = {
                "feature_id": feat["id"],
                "batch_id": feat["b"],
                "name": feat["name"],
                "summary": feat["sum"],
                "paths": paths,
                "path_patterns": feat["p"],
                "keywords": feat["kw"],
                "reuse_score": feat["reuse"],
                "coupling": feat["coupling"],
                "dependencies": feat["deps"],
            }
            feat_rows.append(item)
            feats_by_batch[item["batch_id"]].append(item)

    grouped = defaultdict(list)
    for row in inv:
        grouped[row["top_dir"]].append(row)
    top_dirs = sorted(
        [{"name": name, "files": len(rows), "lines": sum(row["lines"] for row in rows)} for name, rows in grouped.items()],
        key=lambda item: item["lines"], reverse=True
    )
    batch_stats = {cfg["id"]: {"files": len(by_batch[cfg["id"]]), "lines": sum(row["lines"] for row in by_batch[cfg["id"]])} for cfg in BATCHES}
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo_root": ROOT.name,
        "source_root": "src",
        "python_runtime": platform.python_version(),
        "total_files": len(inv),
        "total_lines": sum(row["lines"] for row in inv),
        "top_dirs": top_dirs,
        "largest_files": [{"path": row["path"], "lines": row["lines"]} for row in sorted(inv, key=lambda r: r["lines"], reverse=True)[:30]],
        "hub_modules": [{"path": row["path"], "internal_dependents": row["internal_dependents"]} for row in sorted(inv, key=lambda r: r["internal_dependents"], reverse=True)[:30]],
        "feature_flags": Counter(flag for row in inv for flag in row["feature_flags"]).most_common(30),
        "command_files": sum(1 for row in inv if row["path"].startswith("src/commands/")),
        "tool_files": sum(1 for row in inv if row["path"].startswith("src/tools/")),
        "entrypoints": sorted(entrypoints),
        "batch_stats": batch_stats,
    }
    domain = {
        "generated_at": summary["generated_at"],
        "source_root": "src",
        "rules": [{"batch_id": cfg["id"], "domain_name": cfg["title"], "patterns": cfg["patterns"], "priority": cfg["prio"]} for cfg in BATCHES],
        "assignments": [{"path": row["path"], "batch_id": row["batch_id"], "domain_name": row["batch_title"]} for row in inv],
    }

    for cfg in BATCHES:
        doc = batch_doc(cfg, by_batch[cfg["id"]], feats_by_batch.get(cfg["id"], []))
        (BAT / f"{cfg['id'].lower()}-{slug(cfg['title'])}.md").write_text(doc, encoding="utf-8")
    (AN / "index.md").write_text(index_doc(summary, feats_by_batch), encoding="utf-8")
    (REU / "reuse-candidates.md").write_text(reuse_doc(feat_rows), encoding="utf-8")
    (MAN / "domain_map.json").write_text(json.dumps(domain, indent=2, ensure_ascii=False), encoding="utf-8")
    (MAN / "system_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    with (MAN / "file_inventory.jsonl").open("w", encoding="utf-8") as handle:
        for row in inv:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    with (MAN / "import_graph.jsonl").open("w", encoding="utf-8") as handle:
        for edge in edges:
            handle.write(json.dumps(edge, ensure_ascii=False) + "\n")
    with (MAN / "feature_catalog.jsonl").open("w", encoding="utf-8") as handle:
        for row in sorted(feat_rows, key=lambda item: item["feature_id"]):
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Generated analysis for {summary['total_files']} files / {summary['total_lines']} lines")


if __name__ == "__main__":
    main()
