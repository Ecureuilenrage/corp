from __future__ import annotations

import ast
import json
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
ANALYSIS_ROOT = REPO_ROOT / "analysis"
MANIFESTS_DIR = ANALYSIS_ROOT / "manifests"
BATCHES_DIR = ANALYSIS_ROOT / "batches"
REUSE_DIR = ANALYSIS_ROOT / "reuse"
SCRIPTS_DIR = ANALYSIS_ROOT / "scripts"

EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "analysis",
}

TEXT_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".vue",
    ".yaml",
    ".yml",
    ".json",
    ".md",
    ".toml",
    ".txt",
    ".css",
    ".scss",
    ".html",
    ".env",
}

SPECIAL_TEXT_FILES = {
    "Dockerfile",
    "Makefile",
    "compose.yml",
    "compose.yaml",
    ".env.example",
    ".env.docker",
    ".gitignore",
    ".python-version",
    ".node-version",
    "requirements.txt",
    "pyproject.toml",
    "frontend/package.json",
    "package.json",
}

ENTRYPOINTS = {
    "run.py",
    "server_main.py",
    "server/app.py",
    "runtime/sdk.py",
    "frontend/src/main.js",
    "tools/validate_all_yamls.py",
    "tools/sync_vuegraphs.py",
}

SOURCE_KINDS = {"python", "javascript", "typescript", "vue", "yaml", "config"}


def posix(path: Path | str) -> str:
    return str(path).replace("\\", "/")


def rel_path(path: Path) -> str:
    return posix(path.relative_to(REPO_ROOT))


@dataclass(frozen=True)
class BatchDefinition:
    batch_id: str
    title: str
    purpose: str
    doc_name: str
    entrypoints: list[dict[str, str]]
    key_files: list[dict[str, str]]
    data_flow: list[str]
    external_deps: list[str]
    flags_env: list[str]
    reusable_ideas: list[str]
    copy_risk: list[str]
    search_hints: list[str]


BATCHES: list[BatchDefinition] = []
FEATURE_CATALOG: list[dict[str, Any]] = []
BATCH_BY_ID: dict[str, BatchDefinition] = {}


def iter_repo_files() -> Iterable[Path]:
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(REPO_ROOT).parts
        if any(part in EXCLUDED_DIRS for part in rel_parts):
            continue
        rel = rel_path(path)
        if (
            path.suffix.lower() in TEXT_EXTENSIONS
            or path.name in SPECIAL_TEXT_FILES
            or rel in SPECIAL_TEXT_FILES
            or path.name.startswith("README")
        ):
            yield path


def detect_kind(rel: str, suffix: str) -> str:
    suffix = suffix.lower()
    if suffix == ".py":
        return "python"
    if suffix == ".vue":
        return "vue"
    if suffix == ".js":
        return "javascript"
    if suffix in {".ts", ".tsx"}:
        return "typescript"
    if suffix in {".yaml", ".yml"}:
        return "yaml"
    if suffix in {".md", ".txt"}:
        return "docs"
    if suffix in {".toml", ".json", ".env"} or rel in SPECIAL_TEXT_FILES or rel.startswith(".github/"):
        return "config"
    if suffix in {".css", ".scss", ".html"}:
        return "frontend-asset"
    if rel.startswith("assets/"):
        return "asset"
    return "text"


def classify_batch(rel: str) -> str:
    rel = rel.replace("\\", "/")
    if rel in {"run.py", "tools/export_design_template.py"}:
        return "01-core-config-schema"
    if rel.startswith("check/") or rel.startswith("entity/") or rel.startswith("schema_registry/"):
        return "01-core-config-schema"
    if rel == "runtime/bootstrap/schema.py":
        return "01-core-config-schema"

    if rel == "runtime/sdk.py" or rel.startswith("workflow/"):
        return "02-workflow-orchestration"

    if rel == "runtime/node/executor/agent_executor.py":
        return "04-agent-runtime"
    if rel.startswith("runtime/node/agent/") or rel.startswith(".agents/skills/"):
        return "04-agent-runtime"

    if rel.startswith("runtime/node/") or rel.startswith("runtime/edge/") or rel == "runtime/__init__.py":
        return "03-node-edge-runtime"

    if rel.startswith("functions/edge/") or rel.startswith("functions/edge_processor/"):
        return "03-node-edge-runtime"
    if rel.startswith("functions/function_calling/") or rel.startswith("mcp_example/"):
        return "05-function-tooling-and-mcp"
    if rel in {"utils/function_catalog.py", "utils/function_manager.py"}:
        return "05-function-tooling-and-mcp"

    if rel == "server_main.py" or rel.startswith("server/"):
        return "06-server-api-and-sessions"

    if rel.startswith("frontend/public/") and rel.endswith((".yaml", ".yml")):
        return "09-yaml-surface"
    if rel.startswith("frontend/"):
        return "08-frontend-vue-console"

    if rel.startswith("yaml_template/") or rel.startswith("yaml_instance/"):
        return "09-yaml-surface"

    if rel.startswith("tests/") or rel.startswith("docs/") or rel.startswith("assets/") or rel.startswith(".github/") or rel.startswith("tools/"):
        return "10-tests-docs-infra"
    if rel in {
        "Dockerfile",
        "compose.yml",
        "compose.yaml",
        "Makefile",
        ".env.example",
        ".env.docker",
        "pyproject.toml",
        "requirements.txt",
    }:
        return "10-tests-docs-infra"
    if rel.startswith("README") or rel.startswith(".agents/"):
        return "10-tests-docs-infra"

    if rel.startswith("utils/"):
        return "07-shared-utils"

    return "10-tests-docs-infra"


def build_python_module_map(py_files: list[str]) -> dict[str, str]:
    module_map: dict[str, str] = {}
    for rel in py_files:
        path = Path(rel)
        parts = list(path.parts)
        if parts[-1] == "__init__.py":
            module_name = ".".join(parts[:-1])
        else:
            parts[-1] = path.stem
            module_name = ".".join(parts)
        module_map[module_name] = rel
    return module_map


def current_package_name(rel: str) -> str:
    path = Path(rel)
    parts = list(path.parts)
    if path.name == "__init__.py":
        return ".".join(parts[:-1])
    if len(parts) == 1:
        return ""
    parts[-1] = path.stem
    return ".".join(parts[:-1])


def resolve_python_import_target(module_map: dict[str, str], module: str | None) -> str | None:
    if not module:
        return None
    if module in module_map:
        return module_map[module]
    probe = module
    while "." in probe:
        probe = probe.rsplit(".", 1)[0]
        if probe in module_map:
            return module_map[probe]
    return None


def absolutize_import(module: str | None, level: int, rel: str) -> str | None:
    if level <= 0:
        return module
    package = current_package_name(rel)
    package_parts = package.split(".") if package else []
    keep = max(len(package_parts) - (level - 1), 0)
    base_parts = package_parts[:keep]
    if module:
        base_parts.extend(module.split("."))
    return ".".join(part for part in base_parts if part)


def extract_python_symbols(text: str) -> list[str]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return []
    symbols: list[str] = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            symbols.append(node.name)
    return symbols[:20]


def extract_python_import_edges(rel: str, text: str, module_map: dict[str, str]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return edges

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                raw = alias.name
                resolved = resolve_python_import_target(module_map, raw)
                if resolved:
                    edges.append(
                        {
                            "source": rel,
                            "source_batch": classify_batch(rel),
                            "language": "python",
                            "kind": "internal",
                            "target": resolved,
                            "target_batch": classify_batch(resolved),
                            "raw_import": raw,
                            "symbols": [],
                        }
                    )
                else:
                    edges.append(
                        {
                            "source": rel,
                            "source_batch": classify_batch(rel),
                            "language": "python",
                            "kind": "external",
                            "target": raw.split(".")[0],
                            "target_batch": None,
                            "raw_import": raw,
                            "symbols": [],
                        }
                    )
        elif isinstance(node, ast.ImportFrom):
            base_module = absolutize_import(node.module, node.level, rel)
            preferred = resolve_python_import_target(module_map, base_module)
            if preferred is None and base_module:
                for alias in node.names:
                    candidate = f"{base_module}.{alias.name}"
                    preferred = resolve_python_import_target(module_map, candidate)
                    if preferred:
                        break
            symbols = [alias.name for alias in node.names]
            if preferred:
                edges.append(
                    {
                        "source": rel,
                        "source_batch": classify_batch(rel),
                        "language": "python",
                        "kind": "internal",
                        "target": preferred,
                        "target_batch": classify_batch(preferred),
                        "raw_import": "." * node.level + (node.module or ""),
                        "symbols": symbols,
                    }
                )
            else:
                target = base_module.split(".")[0] if base_module else "<relative>"
                edges.append(
                    {
                        "source": rel,
                        "source_batch": classify_batch(rel),
                        "language": "python",
                        "kind": "external",
                        "target": target,
                        "target_batch": None,
                        "raw_import": "." * node.level + (node.module or ""),
                        "symbols": symbols,
                    }
                )
    return edges


JS_IMPORT_RE = re.compile(
    r"""(?mx)
    ^\s*import\s+(?:.+?\s+from\s+)?["']([^"']+)["']\s*;?
    |
    import\(\s*["']([^"']+)["']\s*\)
    |
    require\(\s*["']([^"']+)["']\s*\)
    """
)

ROUTE_RE = re.compile(r"""@router\.(get|post|put|delete|patch|websocket)\(\s*["']([^"']+)["']""")

ENV_PATTERNS = [
    re.compile(r"""os\.getenv\(\s*["']([A-Z0-9_]+)["']"""),
    re.compile(r"""os\.environ\.get\(\s*["']([A-Z0-9_]+)["']"""),
    re.compile(r"""environ\[\s*["']([A-Z0-9_]+)["']\s*\]"""),
    re.compile(r"""import\.meta\.env\.([A-Z0-9_]+)"""),
    re.compile(r"""process\.env\.([A-Z0-9_]+)"""),
    re.compile(r"""\$\{([A-Z0-9_]+)\}"""),
]


def build_frontend_file_set(files: list[str]) -> set[str]:
    return {
        rel
        for rel in files
        if rel.startswith("frontend/") and Path(rel).suffix.lower() in {".js", ".ts", ".vue", ".json"}
    }


def resolve_frontend_import(specifier: str, current_rel: str, frontend_files: set[str]) -> str | None:
    current_path = REPO_ROOT / current_rel
    candidates: list[Path] = []
    if specifier.startswith("@/"):
        candidates.append(REPO_ROOT / "frontend" / "src" / specifier[2:])
    elif specifier.startswith("./") or specifier.startswith("../"):
        candidates.append(current_path.parent / specifier)
    else:
        return None

    expanded: list[Path] = []
    for candidate in candidates:
        expanded.append(candidate)
        for suffix in [".js", ".ts", ".vue", ".json"]:
            expanded.append(Path(str(candidate) + suffix))
            expanded.append(candidate / f"index{suffix}")

    for candidate in expanded:
        if candidate.exists():
            rel = rel_path(candidate)
            if rel in frontend_files:
                return rel
    return None


def extract_js_import_edges(rel: str, text: str, frontend_files: set[str]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for match in JS_IMPORT_RE.finditer(text):
        raw = next(group for group in match.groups() if group)
        resolved = resolve_frontend_import(raw, rel, frontend_files)
        if resolved:
            edges.append(
                {
                    "source": rel,
                    "source_batch": classify_batch(rel),
                    "language": "frontend",
                    "kind": "internal",
                    "target": resolved,
                    "target_batch": classify_batch(resolved),
                    "raw_import": raw,
                    "symbols": [],
                }
            )
        else:
            edges.append(
                {
                    "source": rel,
                    "source_batch": classify_batch(rel),
                    "language": "frontend",
                    "kind": "external",
                    "target": raw,
                    "target_batch": None,
                    "raw_import": raw,
                    "symbols": [],
                }
            )
    return edges


def extract_env_vars(text: str) -> list[str]:
    found: set[str] = set()
    for pattern in ENV_PATTERNS:
        found.update(pattern.findall(text))
    return sorted(found)


def extract_routes(text: str) -> list[dict[str, str]]:
    return [{"method": method.upper(), "path": path} for method, path in ROUTE_RE.findall(text)]


def find_top_level_heading(path: Path, text: str) -> str | None:
    if path.suffix.lower() != ".md":
        return None
    for line in text.splitlines():
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return None


def summarize_yaml_document(rel: str, text: str) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    if not text.strip():
        return summary
    try:
        data = yaml.safe_load(text)
    except Exception:
        return summary
    if not isinstance(data, dict):
        return summary

    graph_obj = data.get("graph") if isinstance(data.get("graph"), dict) else data
    if isinstance(graph_obj, dict):
        nodes = graph_obj.get("nodes") if isinstance(graph_obj.get("nodes"), list) else []
        edges = graph_obj.get("edges") if isinstance(graph_obj.get("edges"), list) else []
        starts = graph_obj.get("start")
        node_types = Counter()
        node_ids: list[str] = []
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_type = node.get("node_type") or node.get("type") or "unknown"
            node_types[str(node_type)] += 1
            node_id = node.get("id")
            if node_id:
                node_ids.append(str(node_id))
        summary["node_count"] = len(nodes)
        summary["edge_count"] = len(edges)
        summary["node_types"] = dict(sorted(node_types.items()))
        if starts:
            summary["start"] = starts
        if node_ids:
            summary["node_ids"] = node_ids[:20]

    refs: list[str] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key == "file" and isinstance(value, str) and value.endswith((".yaml", ".yml")):
                    refs.append(value)
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    if refs:
        summary["yaml_refs"] = sorted(set(refs))
    if "vars" in data and isinstance(data["vars"], dict):
        summary["vars_keys"] = sorted(map(str, data["vars"].keys()))
    if rel.startswith("yaml_instance/"):
        summary["surface"] = "workflow-instance"
    elif rel.startswith("yaml_template/"):
        summary["surface"] = "workflow-template"
    return summary


def extract_yaml_edges(rel: str, yaml_summary: dict[str, Any]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    current_dir = (REPO_ROOT / rel).parent
    for ref in yaml_summary.get("yaml_refs", []):
        candidate = (current_dir / ref).resolve()
        try:
            target = rel_path(candidate)
        except ValueError:
            target = ref.replace("\\", "/")
        if (REPO_ROOT / target).exists():
            edges.append(
                {
                    "source": rel,
                    "source_batch": classify_batch(rel),
                    "language": "yaml",
                    "kind": "internal",
                    "target": target,
                    "target_batch": classify_batch(target),
                    "raw_import": ref,
                    "symbols": [],
                }
            )
        else:
            edges.append(
                {
                    "source": rel,
                    "source_batch": classify_batch(rel),
                    "language": "yaml",
                    "kind": "external",
                    "target": ref,
                    "target_batch": None,
                    "raw_import": ref,
                    "symbols": [],
                }
            )
    return edges


def importance_score(kind: str, entrypoint: bool, routes: int, symbols: int, envs: int, internal_imports: int) -> int:
    score = 1
    if kind in {"python", "vue", "javascript", "yaml"}:
        score += 1
    if entrypoint:
        score += 4
    score += min(routes, 3)
    score += min(symbols, 5)
    score += min(envs, 2)
    score += min(internal_imports // 3, 3)
    return score


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def ascii_safe(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def ensure_dirs() -> None:
    ANALYSIS_ROOT.mkdir(parents=True, exist_ok=True)
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)
    REUSE_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: Any) -> None:
    content = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    path.write_text(ascii_safe(content), encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(ascii_safe(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n"))


BATCHES.extend(
    [
        BatchDefinition(
            batch_id="01-core-config-schema",
            title="Core Config, Schema, Bootstrap",
            purpose="Charge, valide et normalise la surface YAML en `GraphConfig` via registres et modèles Pydantic.",
            doc_name="01-core-config-schema.md",
            entrypoints=[
                {"path": "run.py", "symbol": "main, parse_args", "why": "Entrée CLI qui charge un YAML puis lance `GraphExecutor`."},
                {"path": "runtime/bootstrap/schema.py", "symbol": "ensure_schema_registry_populated", "why": "Hydrate les registres de noeuds, mémoires, providers et thinking."},
                {"path": "check/check.py", "symbol": "load_config", "why": "Point central de parsing, résolution de variables et validation."},
            ],
            key_files=[
                {"path": "entity/graph_config.py", "symbol": "GraphConfig.from_definition", "why": "Transforme la définition validée en config runtime."},
                {"path": "entity/configs/graph.py", "symbol": "GraphDefinition, DesignConfig", "why": "Décrit la grammaire de design YAML."},
                {"path": "entity/configs/node/node.py", "symbol": "Node, EdgeLink, child_routes", "why": "Normalise les noeuds avant dispatch vers les schémas enregistrés."},
                {"path": "entity/configs/edge/edge.py", "symbol": "EdgeConfig", "why": "Porte les transitions, conditions et processors d’arêtes."},
                {"path": "schema_registry/registry.py", "symbol": "register_* / get_*_schema", "why": "Hub des registres de schémas et capacités."},
                {"path": "check/check_workflow.py", "symbol": "check_workflow_structure", "why": "Valide topologie, fins de graphe et sous-graphes."},
                {"path": "tools/export_design_template.py", "symbol": "DesignTemplateEmitter", "why": "Génère un template YAML à partir des schémas réels."},
            ],
            data_flow=[
                "Le YAML est lu par `check.check.load_config`, les variables `${...}` sont résolues puis la structure est validée.",
                "Les types déclarés sont recoupés avec `schema_registry/registry.py` après `ensure_schema_registry_populated()`.",
                "Le design validé devient un `GraphConfig` consommé ensuite par `workflow/graph_context.py` et `workflow/graph.py`.",
            ],
            external_deps=["pydantic 2", "PyYAML"],
            flags_env=["Placeholders `${BASE_URL}`, `${API_KEY}`, `${MODEL_NAME}`, `${MEM0_API_KEY}` visibles dans les YAML."],
            reusable_ideas=[
                "Pipeline de validation déclarative réutilisable pour tout moteur piloté par YAML.",
                "Registre de schémas centralisable pour brancher de nouveaux types sans toucher au parseur principal.",
                "Génération de template à partir des schémas effectifs pour garder doc et runtime alignés.",
            ],
            copy_risk=[
                "Faible à moyen: registre et validation sont copiables avec peu d’adaptation.",
                "Attention au couplage nominal entre `entity/configs/*`, `schema_registry/registry.py` et les builtins du runtime.",
            ],
            search_hints=[
                "Chercher `ensure_schema_registry_populated` pour voir toute la surface branchée au bootstrap.",
                "Chercher `from_definition` et `from_dict` pour suivre la conversion YAML -> config runtime.",
                "Chercher `register_node_type` et `register_model_provider` pour localiser les extensions réelles.",
            ],
        ),
        BatchDefinition(
            batch_id="02-workflow-orchestration",
            title="Workflow Orchestration, Topology, Execution",
            purpose="Construit le graphe exécutable, détecte les cycles, prépare le contexte runtime et orchestre l’exécution.",
            doc_name="02-workflow-orchestration.md",
            entrypoints=[
                {"path": "workflow/graph.py", "symbol": "GraphExecutor", "why": "Chef d’orchestre runtime pour mémoires, thinking, executors et stratégies."},
                {"path": "runtime/sdk.py", "symbol": "run_workflow", "why": "Surface SDK Python pour lancer un workflow sans passer par FastAPI."},
                {"path": "workflow/graph_context.py", "symbol": "GraphContext", "why": "Conteneur de l’état d’exécution, des outputs et du workspace."},
            ],
            key_files=[
                {"path": "workflow/graph_manager.py", "symbol": "GraphManager, build_graph_structure", "why": "Construit la topologie pratique du graphe et résout les sous-graphes."},
                {"path": "workflow/topology_builder.py", "symbol": "GraphTopologyBuilder", "why": "Produit l’ordre topologique et les infos de super-noeuds."},
                {"path": "workflow/cycle_manager.py", "symbol": "CycleDetector, CycleManager", "why": "Détecte et pilote les composantes cycliques."},
                {"path": "workflow/subgraph_loader.py", "symbol": "resolve_subgraph_source_path", "why": "Résout les chemins de sous-graphes depuis `yaml_instance/` et les parents."},
                {"path": "workflow/runtime/runtime_builder.py", "symbol": "RuntimeBuilder", "why": "Assemble `ToolManager`, stores, trackers et hooks dans `RuntimeContext`."},
                {"path": "workflow/runtime/execution_strategy.py", "symbol": "DagExecutionStrategy, CycleExecutionStrategy, MajorityVoteStrategy", "why": "Sépare la logique d’ordonnancement par forme de graphe."},
                {"path": "workflow/executor/dynamic_edge_executor.py", "symbol": "DynamicEdgeExecutor", "why": "Étend l’orchestration aux arêtes dynamiques map/tree."},
            ],
            data_flow=[
                "Un `GraphConfig` validé est encapsulé dans `GraphContext`, qui prépare l’espace de travail de session.",
                "`GraphExecutor` délègue à `RuntimeBuilder`, crée les exécuteurs de noeuds puis choisit une stratégie d’exécution.",
                "Les résultats transitent par `GraphContext.record`, `ResultArchiver` et les hooks de workspace.",
            ],
            external_deps=["threading", "networkx déclaré dans les dépendances du repo"],
            flags_env=["`OUTPUT_ROOT` via `runtime/sdk.py` pour les répertoires de sortie."],
            reusable_ideas=[
                "`GraphExecutor` + `RuntimeBuilder` forment un noyau d’orchestration transférable.",
                "Le découplage topologie / stratégie / exécution de noeud est une base saine pour d’autres moteurs multi-agents.",
                "La résolution de sous-graphes par chemins relatifs rend la composition YAML portable.",
            ],
            copy_risk=[
                "Moyen: l’orchestrateur dépend des contrats `NodeExecutorFactory`, `GraphContext` et `entity/messages.py`.",
                "Les cycles et arêtes dynamiques sont plus couplés au format de message interne.",
            ],
            search_hints=[
                "Chercher `execute_graph`, `run`, `_build_node_executors` dans `workflow/graph.py`.",
                "Chercher `CycleExecutionStrategy` et `DynamicEdgeExecutor` pour les chemins non linéaires.",
                "Chercher `subgraph` dans `workflow/subgraph_loader.py` et `yaml_instance/subgraphs/`.",
            ],
        ),
        BatchDefinition(
            batch_id="03-node-edge-runtime",
            title="Node And Edge Runtime",
            purpose="Implémente le runtime des noeuds non-agent et la mécanique des arêtes, splitters et processors.",
            doc_name="03-node-edge-runtime.md",
            entrypoints=[
                {"path": "runtime/node/builtin_nodes.py", "symbol": "register_builtin_nodes", "why": "Déclare les types de noeuds disponibles."},
                {"path": "runtime/node/executor/factory.py", "symbol": "NodeExecutorFactory.create_executors", "why": "Construit les exécuteurs réels à partir des noeuds du graphe."},
                {"path": "runtime/edge/conditions/builtin_types.py", "symbol": "register_builtin_edge_conditions", "why": "Expose les conditions d’arêtes standard au registre."},
            ],
            key_files=[
                {"path": "runtime/node/registry.py", "symbol": "NodeRegistration, register_node_type", "why": "Table de dispatch entre type de noeud, schéma et exécuteur."},
                {"path": "runtime/node/executor/python_executor.py", "symbol": "PythonNodeExecutor", "why": "Exécute du code Python généré dans un workspace dédié."},
                {"path": "runtime/node/executor/subgraph_executor.py", "symbol": "SubgraphNodeExecutor", "why": "Permet d’insérer des sous-graphes comme noeuds."},
                {"path": "runtime/node/splitter.py", "symbol": "MessageSplitter, RegexSplitter, JsonPathSplitter", "why": "Supporte les expansions dynamiques de messages."},
                {"path": "runtime/edge/conditions/__init__.py", "symbol": "build_edge_condition_manager", "why": "Fabrique les conditions réelles à partir du catalogue de fonctions."},
                {"path": "runtime/edge/processors/__init__.py", "symbol": "build_edge_processor", "why": "Applique des transformations sur les payloads de sortie."},
                {"path": "functions/edge/conditions.py", "symbol": "contains_keyword, need_reflection_loop, should_stop_loop", "why": "Fonctions concrètes appelées par les edge conditions builtin."},
            ],
            data_flow=[
                "Les types sont enregistrés dans `runtime/node/builtin_nodes.py`, puis résolus par `NodeExecutorFactory`.",
                "Lors d’une transition, les edge conditions et edge processors sont instanciés depuis le catalogue de fonctions.",
                "Les arêtes dynamiques utilisent `runtime/node/splitter.py` pour démultiplier ou restructurer les messages.",
            ],
            external_deps=["subprocess et environnement Python local pour `PythonNodeExecutor`"],
            flags_env=["`MAC_CODE_WORKSPACE`, `MAC_CODE_SCRIPT`, `MAC_NODE_ID` exportés par `python_executor.py`."],
            reusable_ideas=[
                "Registre de noeuds + factory d’exécuteurs: copiable avec adaptation faible à moyenne.",
                "Noeud Python sandboxé par workspace: utile comme brique d’automatisation.",
                "Splitters et arêtes dynamiques: fort levier pour transformer un DAG simple en runtime data-driven.",
            ],
            copy_risk=[
                "Moyen: les exécuteurs restent liés au format `Message` et au `ExecutionContext` maison.",
                "Le noeud Python est réutilisable mais nécessite une revue de sécurité avant extraction telle quelle.",
            ],
            search_hints=[
                "Chercher `register_node_type(` et `NodeExecutorFactory` pour voir l’extension réelle des types.",
                "Chercher `splitter` et `dynamic` pour les branches data-driven.",
                "Chercher `build_edge_condition_manager` et `build_edge_processor` pour le pipeline des arêtes.",
            ],
        ),
        BatchDefinition(
            batch_id="04-agent-runtime",
            title="Agent Runtime, Providers, Memory, Skills",
            purpose="Porte le coeur agentique: exécution des agents, providers de modèles, mémoires, thinking et skills locales.",
            doc_name="04-agent-runtime.md",
            entrypoints=[
                {"path": "runtime/node/executor/agent_executor.py", "symbol": "AgentNodeExecutor.execute", "why": "Chemin d’exécution central des noeuds `agent`."},
                {"path": "runtime/node/agent/providers/builtin_providers.py", "symbol": "register_builtin_model_providers", "why": "Branche les providers réellement disponibles au runtime."},
                {"path": "runtime/node/agent/memory/builtin_stores.py", "symbol": "register_builtin_memory_stores", "why": "Expose les stores de mémoire configurables."},
            ],
            key_files=[
                {"path": "runtime/node/agent/tool/tool_manager.py", "symbol": "ToolManager", "why": "Génère les specs d’outils, gère MCP local/distant et exécute les appels."},
                {"path": "runtime/node/agent/providers/openai_provider.py", "symbol": "OpenAIProvider", "why": "Provider principal avec tracking de tokens."},
                {"path": "runtime/node/agent/providers/gemini_provider.py", "symbol": "GeminiProvider", "why": "Deuxième provider builtin utile pour juger l’abstraction."},
                {"path": "runtime/node/agent/thinking/self_reflection.py", "symbol": "SelfReflectionThinkingManager", "why": "Implémente le thinking builtin branché."},
                {"path": "runtime/node/agent/memory/memory_base.py", "symbol": "MemoryBase, MemoryManager", "why": "Contrat central pour lecture/écriture de mémoire."},
                {"path": "runtime/node/agent/skills/manager.py", "symbol": "AgentSkillManager", "why": "Découvre et expose les skills sous `.agents/skills/`."},
                {"path": ".agents/skills/greeting-demo/SKILL.md", "symbol": "n/a", "why": "Exemple réel de surface skill consommée par le runtime."},
            ],
            data_flow=[
                "Un noeud `agent` est converti en `AgentConfig`, puis `AgentNodeExecutor` prépare conversation, mémoire, thinking et outils.",
                "Le provider sélectionné via `ProviderRegistry` appelle le modèle et retourne un `ModelResponse` potentiellement enrichi d’appels d’outils.",
                "Les skills et mémoires modifient le prompt, les outils disponibles et les opérations post-génération avant persistance mémoire.",
            ],
            external_deps=["openai", "google-genai", "mem0ai", "tenacity", "fastmcp", "mcp"],
            flags_env=[
                "`BASE_URL`, `API_KEY`, `MODEL_NAME`, `MEM0_API_KEY` via les YAML et `.env.example`.",
                "`MAC_FUNCTIONS_DIR`, `MAC_EDGE_FUNCTIONS_DIR`, `MAC_EDGE_PROCESSOR_FUNCTIONS_DIR` via `utils/function_manager.py`.",
            ],
            reusable_ideas=[
                "Le pipeline `AgentNodeExecutor` est une brique forte pour un moteur agentique piloté par YAML.",
                "Le `ToolManager` est un bon candidat de réemploi avec adaptation moyenne pour tout système MCP/local tools.",
                "Le `AgentSkillManager` est réutilisable si l’on garde le contrat `SKILL.md` sous `.agents/skills/`.",
            ],
            copy_risk=[
                "Moyen à élevé: le runtime agent dépend d’`entity/messages.py`, des configs node et du `ToolManager`.",
                "Les providers sont copiables avec adaptation, mais les messages et le tracking de tokens sont spécifiques à ce repo.",
            ],
            search_hints=[
                "Chercher `has_tool_calls`, `_handle_tool_calls`, `_apply_pre_generation_thinking` dans `agent_executor.py`.",
                "Chercher `register_model_provider`, `register_memory_store`, `register_thinking_manager`.",
                "Chercher `.agents/skills` et `activate_skill` pour la surface skill réelle.",
            ],
        ),
        BatchDefinition(
            batch_id="05-function-tooling-and-mcp",
            title="Functions, Tool Catalog, MCP",
            purpose="Regroupe les fonctions appelables, le catalogue de tools et l’exemple MCP livré avec le repo.",
            doc_name="05-function-tooling-and-mcp.md",
            entrypoints=[
                {"path": "utils/function_catalog.py", "symbol": "build_function_catalog", "why": "Introspecte les fonctions Python et produit le catalogue exploitable par le runtime."},
                {"path": "utils/function_manager.py", "symbol": "FunctionManager", "why": "Charge les répertoires de fonctions et sert d’interface avec le `ToolManager`."},
                {"path": "mcp_example/mcp_server.py", "symbol": "mcp.tool", "why": "Exemple minimal de serveur MCP consommable par les agents."},
            ],
            key_files=[
                {"path": "functions/function_calling/file.py", "symbol": "describe_available_files, save_file, apply_text_edits, search_in_files", "why": "Suite d’outils locale la plus riche du repo."},
                {"path": "functions/function_calling/web.py", "symbol": "web_search, read_webpage_content", "why": "Expose des outils réseau pilotés par clés d’API."},
                {"path": "functions/function_calling/code_executor.py", "symbol": "execute_code", "why": "Brique d’exécution ad hoc consommable comme tool."},
                {"path": "functions/function_calling/deep_research.py", "symbol": "report_*, search_*", "why": "Montre un set d’outils spécialisé pour la recherche approfondie."},
                {"path": "functions/function_calling/uv_related.py", "symbol": "install_python_packages, uv_run", "why": "Permet aux agents de préparer et exécuter un environnement Python."},
                {"path": "functions/edge_processor/transformers.py", "symbol": "uppercase_payload, code_save_and_run", "why": "Expose des processors de payload réutilisables hors agent runtime."},
            ],
            data_flow=[
                "Les fonctions Python sont découvertes par `utils/function_catalog.py`, converties en schéma JSON puis servies au `ToolManager`.",
                "Le runtime résout les dossiers de fonctions via `utils/function_manager.py` et les variables d’environnement de chemin.",
                "Les tools MCP passent par `runtime/node/agent/tool/tool_manager.py`, tandis que les functions locales restent appelées directement.",
            ],
            external_deps=["fastmcp", "mcp", "ddgs", "beautifulsoup4"],
            flags_env=[
                "`SERPER_DEV_API_KEY`, `JINA_API_KEY` dans `functions/function_calling/web.py`.",
                "`LIB_INSTALL_TIMEOUT` dans `functions/function_calling/uv_related.py`.",
                "`TEMP_CODE_DIR` dans `functions/function_calling/code_executor.py`.",
            ],
            reusable_ideas=[
                "La suite d’outils fichier est un candidat fort de réemploi pour des agents coding ou research.",
                "Le couple `FunctionManager` + `function_catalog` sert de pont simple entre fichiers Python et JSON schema de tools.",
                "L’exemple MCP est copiable tel quel comme base de smoke test ou de démonstration.",
            ],
            copy_risk=[
                "Faible à moyen pour les outils fichier et le catalogue.",
                "Élevé pour les tools qui exécutent du code ou installent des paquets sans garde-fous supplémentaires.",
            ],
            search_hints=[
                "Chercher `def ` dans `functions/function_calling/` pour voir la surface callable réelle.",
                "Chercher `FunctionManager(` et `build_function_catalog` pour le pipeline d’introspection.",
                "Chercher `mcp` dans `tool_manager.py` et `mcp_example/mcp_server.py`.",
            ],
        ),
    ]
)


BATCHES.extend(
    [
        BatchDefinition(
            batch_id="06-server-api-and-sessions",
            title="Server API, Sessions, Streaming",
            purpose="Expose le moteur sous FastAPI, WebSocket et SSE avec services de session, uploads et artefacts.",
            doc_name="06-server-api-and-sessions.md",
            entrypoints=[
                {"path": "server_main.py", "symbol": "main", "why": "Lance Uvicorn et centralise host/port/log."},
                {"path": "server/app.py", "symbol": "app, create_app", "why": "Construit l’application FastAPI et appelle le bootstrap."},
                {"path": "server/routes/__init__.py", "symbol": "ALL_ROUTERS", "why": "Vue consolidée de toute la surface HTTP/WebSocket."},
            ],
            key_files=[
                {"path": "server/routes/execute.py", "symbol": "router.post('/api/workflow/execute')", "why": "Chemin d’exécution asynchrone piloté par session WebSocket."},
                {"path": "server/routes/execute_sync.py", "symbol": "router.post('/api/workflow/run')", "why": "Chemin sync/SSE réutilisable pour lancer un workflow."},
                {"path": "server/routes/websocket.py", "symbol": "router.websocket('/ws')", "why": "Canal bidirectionnel pour logs, prompts humains et progression."},
                {"path": "server/services/workflow_run_service.py", "symbol": "WorkflowRunService", "why": "Service central de démarrage, suivi et annulation."},
                {"path": "server/services/session_execution.py", "symbol": "SessionExecutionController", "why": "Coordonne l’attente et l’injection de réponses humaines."},
                {"path": "server/services/websocket_executor.py", "symbol": "WebSocketGraphExecutor", "why": "Pont entre `GraphExecutor` et les hooks WebSocket/artefacts."},
                {"path": "server/services/workflow_storage.py", "symbol": "WorkflowStorageService", "why": "Gère la persistance, validation, renommage et copie de workflows YAML."},
            ],
            data_flow=[
                "Une requête HTTP ou WebSocket construit un `WorkflowRunRequest`, charge le YAML puis délègue à `WorkflowRunService` ou `run_workflow`.",
                "Les messages, logs et prompts humains transitent par `WebSocketManager`, `message_handler.py` et `prompt_channel.py`.",
                "Les fichiers uploadés et les artefacts sont gérés par `AttachmentService`, `ArtifactDispatcher` et les routes d’artefacts.",
            ],
            external_deps=["fastapi", "uvicorn", "websockets", "pandas", "openpyxl"],
            flags_env=[
                "`LOG_LEVEL`, `SERVER_LOG_FILE`, `WORKFLOW_LOG_FILE` via `server_main.py` et `utils/structured_logger.py`.",
                "`MAC_AUTO_CLEAN_ATTACHMENTS` dans `server/services/attachment_service.py`.",
                "`VUEGRAPHS_DB_PATH` dans `server/services/vuegraphs_storage.py`.",
                "`CORS_ALLOW_ORIGINS` et `ENVIRONMENT` via `utils/middleware.py` et `utils/error_handler.py`.",
            ],
            reusable_ideas=[
                "La double surface sync/SSE et async/WebSocket est une bonne base pour encapsuler un moteur agentique.",
                "Les services de session humaine sont intéressants pour tout produit human-in-the-loop.",
                "Le stockage de workflows YAML et de `vuegraph` facilite un produit no-code persistant.",
            ],
            copy_risk=[
                "Moyen: la structure FastAPI est portable, mais les services sont couplés à `GraphExecutor`, `GraphContext` et aux messages internes.",
                "Le circuit humain et artefacts devient plus risqué à extraire sans reprendre aussi `utils/attachments.py` et `utils/human_prompt.py`.",
            ],
            search_hints=[
                "Chercher `@router.` dans `server/routes/` pour la carte API réelle.",
                "Chercher `WorkflowRunService`, `WebSocketGraphExecutor`, `SessionExecutionController`.",
                "Chercher `artifact` et `attachment` dans `server/services/`.",
            ],
        ),
        BatchDefinition(
            batch_id="07-shared-utils",
            title="Shared Runtime Utilities",
            purpose="Fournit les briques transverses: attachments, prompts humains, logs, tokens, variables et exceptions.",
            doc_name="07-shared-utils.md",
            entrypoints=[
                {"path": "utils/attachments.py", "symbol": "AttachmentStore", "why": "Base de stockage/encodage des fichiers échangés entre runtime, serveur et agents."},
                {"path": "utils/human_prompt.py", "symbol": "HumanPromptService, CliPromptChannel", "why": "Contrat partagé entre exécution CLI et WebSocket pour les réponses humaines."},
                {"path": "utils/token_tracker.py", "symbol": "TokenTracker", "why": "Compteur central de coûts d’inférence."},
            ],
            key_files=[
                {"path": "utils/task_input.py", "symbol": "TaskInputBuilder", "why": "Construit les entrées utilisateur enrichies de pièces jointes."},
                {"path": "utils/log_manager.py", "symbol": "LogManager", "why": "Hub runtime pour log structuré et journal de workflow."},
                {"path": "utils/structured_logger.py", "symbol": "get_server_logger", "why": "Normalise les logs serveur et workflow avec fichiers dédiés."},
                {"path": "utils/vars_resolver.py", "symbol": "resolve_vars", "why": "Résout les placeholders `${...}` avant validation de design."},
                {"path": "utils/workspace_scanner.py", "symbol": "iter_workspace_entries", "why": "Scanne les outputs de session et aide à exposer l’état du workspace."},
                {"path": "utils/exceptions.py", "symbol": "ValidationError, WorkflowExecutionError, WorkflowCancelledError", "why": "Socle d’erreurs typées partagé par le backend."},
            ],
            data_flow=[
                "Les attachments transitent du serveur ou du SDK vers `AttachmentStore`, puis sont réinjectés dans les messages agentiques.",
                "Les prompts humains passent par `HumanPromptService` quel que soit le canal effectif CLI ou WebSocket.",
                "Les logs et métriques de tokens sont collectés par les providers, le runtime et les routes via les utilitaires partagés.",
            ],
            external_deps=["stdlib majoritairement"],
            flags_env=[
                "`SERVER_LOG_FILE`, `WORKFLOW_LOG_FILE`, `LOG_LEVEL` dans `utils/structured_logger.py`.",
                "`CORS_ALLOW_ORIGINS` et `ENVIRONMENT` consommés par les utilitaires middleware/error handling.",
            ],
            reusable_ideas=[
                "Les utilitaires de prompt humain et d’attachments sont de bonnes briques cross-cutting.",
                "Le token tracking est léger et facile à extraire.",
                "Les erreurs structurées améliorent le diagnostic côté API et moteur.",
            ],
            copy_risk=[
                "Faible à moyen: nombreuses briques copiables avec adaptation limitée.",
                "Le couplage principal vient du type `Message` et des conventions de logs du repo.",
            ],
            search_hints=[
                "Chercher `AttachmentStore`, `HumanPromptService`, `TokenTracker`.",
                "Chercher `resolve_vars` pour les points de résolution de placeholders.",
                "Chercher `WorkflowExecutionError` pour les chemins d’échec critiques.",
            ],
        ),
        BatchDefinition(
            batch_id="08-frontend-vue-console",
            title="Frontend Vue Workbench",
            purpose="Porte la console no-code Vue/Vite: édition de graphes, formulaires dynamiques, lancement et batch.",
            doc_name="08-frontend-vue-console.md",
            entrypoints=[
                {"path": "frontend/src/main.js", "symbol": "createApp(App).use(router).use(i18n)", "why": "Bootstrap principal du frontend."},
                {"path": "frontend/src/router/index.js", "symbol": "createRouter", "why": "Expose `launch`, `batch-run`, `tutorial` et `workflows/:name?`."},
                {"path": "frontend/src/pages/WorkflowWorkbench.vue", "symbol": "WorkflowWorkbench", "why": "Point d’entrée de l’éditeur de workflows."},
            ],
            key_files=[
                {"path": "frontend/src/pages/WorkflowView.vue", "symbol": "WorkflowView", "why": "Composant central d’édition et synchronisation backend."},
                {"path": "frontend/src/components/FormGenerator.vue", "symbol": "FormGenerator", "why": "Rend des formulaires à partir des schémas backend."},
                {"path": "frontend/src/components/DynamicFormField.vue", "symbol": "DynamicFormField", "why": "Gère les champs polymorphes et dynamiques."},
                {"path": "frontend/src/pages/LaunchView.vue", "symbol": "LaunchView", "why": "Surface de lancement/runtime avec logs et artefacts."},
                {"path": "frontend/src/pages/BatchRunView.vue", "symbol": "BatchRunView", "why": "Surface spécifique aux exécutions par lot."},
                {"path": "frontend/src/utils/apiFunctions.js", "symbol": "fetch* / run* helpers", "why": "Cartographie pratique des endpoints backend réellement utilisés."},
            ],
            data_flow=[
                "Le frontend charge les schémas via `/api/config/schema`, génère l’UI puis sérialise les changements en YAML/vuegraph.",
                "Les actions utilisateur appellent `frontend/src/utils/apiFunctions.js`, qui dialogue avec les routes FastAPI de workflow, upload, batch, exécution et artefacts.",
                "Les graphes visuels sont persistés côté serveur via `server/routes/vuegraphs.py` et rechargés dans `WorkflowView.vue`.",
            ],
            external_deps=["vue", "vue-router", "vue-i18n", "@vue-flow/core", "@vue-flow/background", "@vue-flow/controls", "@vue-flow/minimap", "js-yaml", "markdown-it"],
            flags_env=["`VITE_API_BASE_URL` dans `frontend/vite.config.js` et les vues de lancement."],
            reusable_ideas=[
                "Le couple `FormGenerator.vue` + schémas backend est très réutilisable pour d’autres consoles no-code.",
                "Le workbench Vue Flow est un bon point de départ pour un éditeur de pipelines agents.",
                "La séparation `WorkflowWorkbench` / `WorkflowView` / `apiFunctions.js` rend l’extraction front praticable.",
            ],
            copy_risk=[
                "Moyen: le frontend dépend fortement de la forme des schémas backend et du format `vuegraph` persisté.",
                "Les composants de formulaire sont plus transférables que la totalité du workbench.",
            ],
            search_hints=[
                "Chercher `VueFlow` et `FormGenerator` dans `frontend/src/`.",
                "Chercher `/api/` dans `frontend/src/utils/apiFunctions.js` pour la carte backend consommée.",
                "Chercher `VITE_API_BASE_URL` pour la configuration réseau.",
            ],
        ),
        BatchDefinition(
            batch_id="09-yaml-surface",
            title="YAML Templates, Instances, Declarative Assets",
            purpose="Regroupe la surface déclarative réelle: template de design, workflows exemples et sous-graphes YAML.",
            doc_name="09-yaml-surface.md",
            entrypoints=[
                {"path": "yaml_template/design.yaml", "symbol": "n/a", "why": "Template de référence dérivé des schémas runtime."},
                {"path": "yaml_instance/deep_research_v1.yaml", "symbol": "n/a", "why": "Exemple riche couvrant planning, outils, sous-graphes et orchestration multi-agent."},
                {"path": "yaml_instance/subgraphs/react_agent.yaml", "symbol": "n/a", "why": "Sous-graphe réutilisable montrant la composition déclarative."},
            ],
            key_files=[
                {"path": "yaml_instance/demo_function_call.yaml", "symbol": "n/a", "why": "Démontre le branchement de tools Python catalogués."},
                {"path": "yaml_instance/demo_mcp.yaml", "symbol": "n/a", "why": "Démontre l’intégration MCP distante."},
                {"path": "yaml_instance/skills.yaml", "symbol": "n/a", "why": "Montre la configuration de skills locales côté agent."},
                {"path": "yaml_instance/demo_dynamic.yaml", "symbol": "n/a", "why": "Couvre les arêtes dynamiques map/tree et splitters."},
                {"path": "yaml_instance/demo_sub_graph.yaml", "symbol": "n/a", "why": "Montre l’inclusion de sous-graphes depuis un fichier YAML."},
                {"path": "frontend/public/design_0.4.0.yaml", "symbol": "n/a", "why": "Surface statique côté frontend utilisée comme design de référence."},
            ],
            data_flow=[
                "Les YAML sont chargés par `check/check.py`, convertis en `DesignConfig` puis transformés en `GraphConfig`.",
                "Les sous-graphes référencent d’autres fichiers YAML, résolus par `workflow/subgraph_loader.py` lors de la construction.",
                "Le frontend et les outils d’infra utilisent ces fichiers comme fixtures et surfaces d’édition/import.",
            ],
            external_deps=["PyYAML", "js-yaml"],
            flags_env=["Placeholders `${BASE_URL}`, `${API_KEY}`, `${MODEL_NAME}`, `${MEM0_API_KEY}` visibles dans plusieurs workflows."],
            reusable_ideas=[
                "La librairie de workflows exemples vaut comme corpus de patterns réutilisables.",
                "Les sous-graphes YAML sont de bons candidats de composition pour d’autres produits agents.",
                "Le template de design est copiable avec adaptation faible si l’on conserve la même grammaire YAML.",
            ],
            copy_risk=[
                "Faible pour les workflows simples comme démonstrateurs.",
                "Moyen pour les workflows complexes qui dépendent fortement des noms de tools, providers et schémas de ce repo.",
            ],
            search_hints=[
                "Chercher `provider:`, `tooling:`, `thinking:`, `skills:` dans `yaml_instance/`.",
                "Chercher `source: file` et `file:` pour les sous-graphes.",
                "Comparer `yaml_template/design.yaml` aux exemples sous `yaml_instance/`.",
            ],
        ),
        BatchDefinition(
            batch_id="10-tests-docs-infra",
            title="Tests, Docs, Infra, Ops",
            purpose="Couvre la documentation, les tests automatisés, Docker, la CI et les scripts utilitaires d’encadrement.",
            doc_name="10-tests-docs-infra.md",
            entrypoints=[
                {"path": "pyproject.toml", "symbol": "n/a", "why": "Source principale de dépendances backend et métadonnées projet."},
                {"path": "compose.yml", "symbol": "n/a", "why": "Orchestre backend et frontend en environnement conteneurisé."},
                {"path": ".github/workflows/validate-yamls.yml", "symbol": "n/a", "why": "Pipeline CI vérifiant la validité des workflows YAML."},
            ],
            key_files=[
                {"path": "Dockerfile", "symbol": "n/a", "why": "Image backend officielle et commande de lancement serveur."},
                {"path": "frontend/Dockerfile", "symbol": "n/a", "why": "Image frontend de dev pour la console Vite."},
                {"path": "Makefile", "symbol": "n/a", "why": "Expose les commandes de dev, sync et validation."},
                {"path": "tests/test_mem0_memory.py", "symbol": "n/a", "why": "Valide le store mémoire Mem0."},
                {"path": "tests/test_memory_embedding_consistency.py", "symbol": "n/a", "why": "Couvre la cohérence embeddings/mémoire."},
                {"path": "tests/test_websocket_send_message_sync.py", "symbol": "n/a", "why": "Couvre un point sensible de synchronisation WebSocket."},
                {"path": "tools/validate_all_yamls.py", "symbol": "main", "why": "Script d’infra important pour valider la surface YAML."},
            ],
            data_flow=[
                "La CI installe les dépendances, exécute `tools/validate_all_yamls.py` et s’appuie sur le même parseur YAML que le runtime.",
                "Docker et compose reproduisent un environnement backend + frontend cohérent pour lancer la plateforme.",
                "Les docs sous `docs/user_guide/` expliquent surtout l’usage du produit et complètent les YAML d’exemple.",
            ],
            external_deps=["uv", "Docker", "Docker Compose", "GitHub Actions"],
            flags_env=["`.env.example` et `.env.docker` définissent les variables d’environnement d’exécution usuelles."],
            reusable_ideas=[
                "La validation CI des YAML est directement réutilisable si l’on garde le même parseur.",
                "Le compose backend/frontend est une bonne base de packaging pour un outil no-code multi-agent.",
                "Les tests existants indiquent surtout les zones les plus fragiles du runtime mémoire et WebSocket.",
            ],
            copy_risk=[
                "Faible pour la partie infra.",
                "Les tests ne couvrent qu’une faible partie du repo; ils sont à reprendre plutôt qu’à copier comme unique filet de sécurité.",
            ],
            search_hints=[
                "Chercher `validate-yamls` dans `Makefile` et `.github/workflows/validate-yamls.yml`.",
                "Chercher `test_` dans `tests/` pour voir la couverture réelle.",
                "Lire `.env.example` avant toute extraction de feature dépendante d’un provider externe.",
            ],
        ),
    ]
)


FEATURE_CATALOG.extend(
    [
        {
            "feature_id": "workflow.graph_executor",
            "name": "Graph executor with DAG/cycle strategies",
            "summary": "Orchestrateur principal qui construit le runtime, gère mémoires/thinking et exécute un graphe avec stratégies DAG, cycle ou majority vote.",
            "paths": ["workflow/graph.py", "workflow/runtime/runtime_builder.py", "workflow/runtime/execution_strategy.py", "workflow/cycle_manager.py"],
            "keywords": ["graph-executor", "dag", "cycle", "majority-vote", "runtime-context"],
            "reuse_score": 9,
            "coupling": "medium",
            "dependencies": ["entity/graph_config.py", "workflow/graph_context.py", "runtime/node/executor/factory.py", "entity/messages.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "schema.design_validation",
            "name": "YAML design validation and schema registry",
            "summary": "Pipeline de validation déclarative basé sur Pydantic et registres pour noeuds, mémoires, providers et edge processors.",
            "paths": ["check/check.py", "check/check_workflow.py", "runtime/bootstrap/schema.py", "schema_registry/registry.py", "entity/configs/graph.py"],
            "keywords": ["yaml", "validation", "schema-registry", "pydantic", "design-config"],
            "reuse_score": 9,
            "coupling": "medium",
            "dependencies": ["entity/configs/node/node.py", "entity/configs/edge/edge.py", "tools/export_design_template.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "runtime.dynamic_edges",
            "name": "Dynamic edge expansion with splitters",
            "summary": "Support map/tree pour arêtes dynamiques, basé sur splitters de messages et exécuteur dédié.",
            "paths": ["workflow/executor/dynamic_edge_executor.py", "runtime/node/splitter.py", "entity/configs/dynamic_base.py", "yaml_instance/demo_dynamic.yaml"],
            "keywords": ["dynamic-edge", "splitter", "map", "tree", "jsonpath", "regex"],
            "reuse_score": 8,
            "coupling": "medium",
            "dependencies": ["entity/messages.py", "workflow/graph.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "runtime.subgraph_composition",
            "name": "Subgraph loading and composition",
            "summary": "Permet de référencer des sous-graphes YAML par fichier et de les injecter comme noeuds du graphe parent.",
            "paths": ["workflow/subgraph_loader.py", "runtime/node/executor/subgraph_executor.py", "yaml_instance/demo_sub_graph.yaml", "yaml_instance/subgraphs/react_agent.yaml"],
            "keywords": ["subgraph", "composition", "yaml", "nested-workflow"],
            "reuse_score": 8,
            "coupling": "medium",
            "dependencies": ["check/check.py", "workflow/graph_manager.py", "entity/graph_config.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "agent.execution_pipeline",
            "name": "Agent execution pipeline with memory and tool calls",
            "summary": "Chemin agent complet incluant préparation du prompt, mémoire, thinking, appel provider, gestion d’outils et persistance.",
            "paths": ["runtime/node/executor/agent_executor.py", "runtime/node/agent/memory/memory_base.py", "runtime/node/agent/thinking/self_reflection.py"],
            "keywords": ["agent", "memory", "thinking", "tool-call", "provider"],
            "reuse_score": 10,
            "coupling": "high",
            "dependencies": ["runtime/node/agent/tool/tool_manager.py", "runtime/node/agent/providers/openai_provider.py", "entity/messages.py", "entity/configs/node/agent.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "agent.mcp_tool_bridge",
            "name": "Local and remote MCP tool bridge",
            "summary": "Gestionnaire d’outils capable d’exposer des fonctions locales, des serveurs MCP distants et des MCP locaux stdio.",
            "paths": ["runtime/node/agent/tool/tool_manager.py", "entity/configs/node/tooling.py", "yaml_instance/demo_mcp.yaml", "mcp_example/mcp_server.py"],
            "keywords": ["mcp", "tool-manager", "remote-tools", "stdio", "function-tools"],
            "reuse_score": 9,
            "coupling": "high",
            "dependencies": ["utils/function_manager.py", "utils/function_catalog.py", "entity/tool_spec.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "agent.skills_runtime",
            "name": "Repo-local skill discovery runtime",
            "summary": "Découvre des skills sous `.agents/skills/` et les expose aux agents comme surface activable.",
            "paths": ["runtime/node/agent/skills/manager.py", ".agents/skills/greeting-demo/SKILL.md", ".agents/skills/python-scratchpad/SKILL.md", ".agents/skills/rest-api-caller/SKILL.md"],
            "keywords": ["skills", "skill-md", "agent-skill-manager", "prompt-surface"],
            "reuse_score": 7,
            "coupling": "medium",
            "dependencies": ["entity/configs/node/skills.py", "runtime/node/executor/agent_executor.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "tools.file_suite",
            "name": "Workspace file tool suite",
            "summary": "Collection d’outils fichier pour lister, lire, écrire, patcher, déplacer et rechercher dans le workspace.",
            "paths": ["functions/function_calling/file.py"],
            "keywords": ["file-tools", "workspace", "search", "apply-edits", "copy", "move"],
            "reuse_score": 9,
            "coupling": "low",
            "dependencies": ["utils/function_catalog.py"],
            "copy_mode": "copiable tel quel",
        },
        {
            "feature_id": "api.sync_streaming_execution",
            "name": "Sync and SSE workflow execution API",
            "summary": "Endpoint FastAPI qui exécute un workflow soit en réponse classique, soit en streaming SSE avec logs incrémentaux.",
            "paths": ["server/routes/execute_sync.py", "runtime/sdk.py", "workflow/graph.py"],
            "keywords": ["fastapi", "sse", "workflow-run", "streaming", "sdk"],
            "reuse_score": 8,
            "coupling": "medium",
            "dependencies": ["check/check.py", "entity/graph_config.py", "utils/task_input.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "api.websocket_human_loop",
            "name": "WebSocket session execution with human-in-the-loop",
            "summary": "Exposition WebSocket permettant logs live, prompts humains, état de session et dispatch d’artefacts.",
            "paths": ["server/routes/websocket.py", "server/services/workflow_run_service.py", "server/services/session_execution.py", "server/services/websocket_manager.py", "server/services/websocket_executor.py"],
            "keywords": ["websocket", "human-loop", "session", "artifacts", "prompt-channel"],
            "reuse_score": 9,
            "coupling": "high",
            "dependencies": ["workflow/graph.py", "utils/human_prompt.py", "utils/attachments.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "frontend.schema_driven_forms",
            "name": "Schema-driven Vue form generation",
            "summary": "Génère des formulaires d’édition de noeuds à partir des schémas backend et les injecte dans le workbench Vue Flow.",
            "paths": ["frontend/src/components/FormGenerator.vue", "frontend/src/components/DynamicFormField.vue", "frontend/src/components/InlineConfigRenderer.vue", "frontend/src/pages/WorkflowView.vue"],
            "keywords": ["vue", "schema-driven", "form-generator", "workflow-editor", "vue-flow"],
            "reuse_score": 8,
            "coupling": "medium",
            "dependencies": ["server/config_schema_router.py", "frontend/src/utils/formUtils.js", "frontend/src/utils/apiFunctions.js"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "yaml.workflow_library",
            "name": "Workflow example library",
            "summary": "Corpus d’exemples couvrant tools, MCP, skills, dynamic edges, sous-graphes et deep research.",
            "paths": ["yaml_instance/demo_function_call.yaml", "yaml_instance/demo_mcp.yaml", "yaml_instance/skills.yaml", "yaml_instance/demo_dynamic.yaml", "yaml_instance/deep_research_v1.yaml"],
            "keywords": ["workflow-library", "examples", "yaml", "deep-research", "skills", "mcp"],
            "reuse_score": 8,
            "coupling": "low",
            "dependencies": ["check/check.py", "runtime/bootstrap/schema.py"],
            "copy_mode": "copiable avec adaptation",
        },
        {
            "feature_id": "ops.yaml_validation_ci",
            "name": "YAML validation script and CI",
            "summary": "Script batch de validation des YAML branché dans GitHub Actions pour empêcher les régressions déclaratives.",
            "paths": ["tools/validate_all_yamls.py", ".github/workflows/validate-yamls.yml", "Makefile"],
            "keywords": ["ci", "yaml-validation", "github-actions", "quality-gate"],
            "reuse_score": 7,
            "coupling": "low",
            "dependencies": ["check/check.py", "runtime/bootstrap/schema.py"],
            "copy_mode": "copiable tel quel",
        },
    ]
)

BATCH_BY_ID = {batch.batch_id: batch for batch in BATCHES}


def compile_inventory() -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    files = sorted(iter_repo_files(), key=lambda p: rel_path(p))
    rels = [rel_path(path) for path in files]
    py_files = [rel for rel in rels if rel.endswith(".py")]
    module_map = build_python_module_map(py_files)
    frontend_files = build_frontend_file_set(rels)

    inventory: list[dict[str, Any]] = []
    import_edges: list[dict[str, Any]] = []
    file_text_by_rel: dict[str, str] = {}

    for path in files:
        rel = rel_path(path)
        text = read_text(path)
        file_text_by_rel[rel] = text
        kind = detect_kind(rel, path.suffix)
        symbols: list[str] = []
        routes: list[dict[str, str]] = []
        yaml_summary: dict[str, Any] = {}
        internal_edges: list[dict[str, Any]] = []
        external_edges: list[dict[str, Any]] = []

        if kind == "python":
            symbols = extract_python_symbols(text)
            py_edges = extract_python_import_edges(rel, text, module_map)
            internal_edges = [edge for edge in py_edges if edge["kind"] == "internal"]
            external_edges = [edge for edge in py_edges if edge["kind"] == "external"]
            if rel.startswith("server/"):
                routes = extract_routes(text)
            import_edges.extend(py_edges)
        elif kind in {"javascript", "typescript", "vue"}:
            fe_edges = extract_js_import_edges(rel, text, frontend_files)
            internal_edges = [edge for edge in fe_edges if edge["kind"] == "internal"]
            external_edges = [edge for edge in fe_edges if edge["kind"] == "external"]
            import_edges.extend(fe_edges)
        elif kind == "yaml":
            yaml_summary = summarize_yaml_document(rel, text)
            yaml_edges = extract_yaml_edges(rel, yaml_summary)
            internal_edges = [edge for edge in yaml_edges if edge["kind"] == "internal"]
            external_edges = [edge for edge in yaml_edges if edge["kind"] == "external"]
            import_edges.extend(yaml_edges)

        env_vars = extract_env_vars(text)
        loc = len(text.splitlines())
        nonempty_loc = len([line for line in text.splitlines() if line.strip()])

        inventory.append(
            {
                "path": rel,
                "primary_batch": classify_batch(rel),
                "kind": kind,
                "extension": path.name if (path.name in SPECIAL_TEXT_FILES or rel in SPECIAL_TEXT_FILES) else (path.suffix.lower() or path.name),
                "entrypoint": rel in ENTRYPOINTS,
                "size_bytes": path.stat().st_size,
                "loc": loc,
                "nonempty_loc": nonempty_loc,
                "symbols": symbols,
                "imports_internal": sorted({edge["target"] for edge in internal_edges}),
                "imports_external": sorted({edge["target"] for edge in external_edges}),
                "env_vars": env_vars,
                "routes": routes,
                "yaml_summary": yaml_summary,
                "doc_heading": find_top_level_heading(path, text),
                "importance_score": max(
                    1,
                    importance_score(
                        kind=kind,
                        entrypoint=rel in ENTRYPOINTS,
                        routes=len(routes),
                        symbols=len(symbols),
                        envs=len(env_vars),
                        internal_imports=len(internal_edges),
                    )
                    - (4 if rel.startswith(("tests/", "docs/")) or rel.startswith("README") else 0),
                ),
            }
        )

    deduped_edges: dict[tuple[Any, ...], dict[str, Any]] = {}
    for edge in import_edges:
        key = (
            edge["source"],
            edge["language"],
            edge["kind"],
            edge["target"],
            edge["raw_import"],
            tuple(edge["symbols"]),
        )
        deduped_edges[key] = edge

    edges = sorted(deduped_edges.values(), key=lambda row: (row["source"], row["target"], row["raw_import"]))
    return inventory, edges, file_text_by_rel


def aggregate_counts(inventory: list[dict[str, Any]]) -> dict[str, Any]:
    by_extension = Counter(item["extension"] for item in inventory)
    by_kind = Counter(item["kind"] for item in inventory)
    by_batch = Counter(item["primary_batch"] for item in inventory)
    loc_by_batch = Counter()
    for item in inventory:
        loc_by_batch[item["primary_batch"]] += item["loc"]
    return {
        "files_by_extension": dict(sorted(by_extension.items())),
        "files_by_kind": dict(sorted(by_kind.items())),
        "files_by_batch": dict(sorted(by_batch.items())),
        "loc_by_batch": dict(sorted(loc_by_batch.items())),
        "total_files": len(inventory),
        "total_loc": sum(item["loc"] for item in inventory),
    }


def find_hubs(inventory: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    ranked = sorted(inventory, key=lambda item: (-item["importance_score"], item["path"]))
    return {
        "overall": [
            {"path": item["path"], "primary_batch": item["primary_batch"], "importance_score": item["importance_score"]}
            for item in ranked[:25]
        ],
        "entrypoints": [{"path": item["path"], "primary_batch": item["primary_batch"]} for item in ranked if item["entrypoint"]],
    }


def compute_coverage(inventory: list[dict[str, Any]]) -> dict[str, Any]:
    source_paths = {item["path"] for item in inventory if item["kind"] in SOURCE_KINDS or item["kind"] == "docs"}
    assigned_paths = {item["path"] for item in inventory if item["primary_batch"] in BATCH_BY_ID}
    missing_in_domain_map = sorted(source_paths - assigned_paths)
    return {
        "scope_definition": "Tous les fichiers texte du repo hors `analysis/`, binaires et dossiers de build exclus.",
        "source_paths_in_scope": len(source_paths),
        "inventory_entries": len(inventory),
        "assigned_to_batch": len(assigned_paths),
        "missing_in_domain_map": missing_in_domain_map,
        "missing_in_inventory": [],
        "coverage_ok": not missing_in_domain_map,
    }


def build_domain_map(inventory: list[dict[str, Any]]) -> dict[str, Any]:
    coverage = compute_coverage(inventory)
    batches_payload = []
    for batch in BATCHES:
        batch_files = [item for item in inventory if item["primary_batch"] == batch.batch_id]
        batch_files = sorted(batch_files, key=lambda item: item["path"])
        batches_payload.append(
            {
                "batch_id": batch.batch_id,
                "title": batch.title,
                "purpose": batch.purpose,
                "doc": f"analysis/batches/{batch.doc_name}",
                "file_count": len(batch_files),
                "loc": sum(item["loc"] for item in batch_files),
                "entrypoints": [entry["path"] for entry in batch.entrypoints],
                "paths": [item["path"] for item in batch_files],
                "top_files": [
                    {"path": item["path"], "importance_score": item["importance_score"], "kind": item["kind"]}
                    for item in sorted(batch_files, key=lambda row: (-row["importance_score"], row["path"]))[:20]
                ],
            }
        )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo_root": posix(REPO_ROOT),
        "batch_order": [batch.batch_id for batch in BATCHES],
        "batches": batches_payload,
        "file_to_batch": {item["path"]: item["primary_batch"] for item in inventory},
        "coverage": coverage,
    }


def parse_project_metadata(file_text_by_rel: dict[str, str]) -> dict[str, Any]:
    pyproject = file_text_by_rel.get("pyproject.toml", "")
    frontend_package = file_text_by_rel.get("frontend/package.json", "")

    backend_deps: list[str] = []
    frontend_deps: list[str] = []

    dep_match = re.search(r"dependencies\s*=\s*\[(.*?)\]", pyproject, re.S)
    if dep_match:
        backend_deps = sorted(re.findall(r'"([^"]+)"', dep_match.group(1)))

    frontend_deps = sorted(re.findall(r'"([^"]+)":\s*"[^"]+"', frontend_package))
    return {"project_name": "DevAll", "backend_dependencies": backend_deps, "frontend_dependencies": frontend_deps}


def build_system_summary(
    inventory: list[dict[str, Any]],
    import_edges: list[dict[str, Any]],
    file_text_by_rel: dict[str, str],
) -> dict[str, Any]:
    counts = aggregate_counts(inventory)
    coverage = compute_coverage(inventory)
    hubs = find_hubs(inventory)
    metadata = parse_project_metadata(file_text_by_rel)
    env_vars = sorted({env for item in inventory if item["kind"] != "docs" for env in item["env_vars"]})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo_root": posix(REPO_ROOT),
        "project_name": metadata["project_name"],
        "summary": "Plateforme zero-code multi-agent avec backend Python, console Vue/Vite, runtime de graphes YAML et surface serveur temps reel.",
        "counts": counts,
        "coverage": coverage,
        "entrypoints": sorted([item["path"] for item in inventory if item["entrypoint"]]),
        "subsystems": [
            {
                "batch_id": batch.batch_id,
                "title": batch.title,
                "purpose": batch.purpose,
                "file_count": counts["files_by_batch"].get(batch.batch_id, 0),
                "loc": counts["loc_by_batch"].get(batch.batch_id, 0),
            }
            for batch in BATCHES
        ],
        "key_hubs": hubs,
        "backend_dependencies": metadata["backend_dependencies"],
        "frontend_dependencies": metadata["frontend_dependencies"],
        "env_vars": env_vars,
        "route_files": [{"path": item["path"], "routes": item["routes"]} for item in inventory if item["routes"]],
        "yaml_assets": [{"path": item["path"], "yaml_summary": item["yaml_summary"]} for item in inventory if item["kind"] == "yaml"],
        "tests": [item["path"] for item in inventory if item["path"].startswith("tests/")],
        "docs": [item["path"] for item in inventory if item["path"].startswith("docs/") or item["path"].startswith("README")],
        "ci_and_infra": [
            item["path"]
            for item in inventory
            if item["path"].startswith(".github/") or item["path"] in {"Dockerfile", "compose.yml", "Makefile", ".env.example", ".env.docker"}
        ],
        "import_graph_edge_count": len(import_edges),
    }


def render_batch_doc(batch: BatchDefinition, inventory: list[dict[str, Any]]) -> str:
    batch_files = [item for item in inventory if item["primary_batch"] == batch.batch_id]
    batch_files = sorted(batch_files, key=lambda item: (-item["importance_score"], item["path"]))
    file_count = len(batch_files)
    loc = sum(item["loc"] for item in batch_files)

    lines = [
        f"# {batch.batch_id} - {batch.title}",
        "",
        f"_Primary coverage_: {file_count} fichiers, {loc} lignes approx. dans ce batch.",
        "",
        "## purpose",
        batch.purpose,
        "",
        "## entrypoints",
    ]
    for entry in batch.entrypoints:
        lines.append(f"- `{entry['path']}` - `{entry['symbol']}` - {entry['why']}")
    lines.extend(["", "## key files"])
    for item in batch.key_files:
        lines.append(f"- `{item['path']}` - `{item['symbol']}` - {item['why']}")
    lines.extend(["", "## data flow"])
    for item in batch.data_flow:
        lines.append(f"- {item}")
    lines.extend(["", "## external deps"])
    for item in batch.external_deps:
        lines.append(f"- {item}")
    lines.extend(["", "## flags/env"])
    for item in batch.flags_env:
        lines.append(f"- {item}")
    lines.extend(["", "## reusable ideas"])
    for item in batch.reusable_ideas:
        lines.append(f"- {item}")
    lines.extend(["", "## copy risk"])
    for item in batch.copy_risk:
        lines.append(f"- {item}")
    lines.extend(["", "## search hints"])
    for item in batch.search_hints:
        lines.append(f"- {item}")
    lines.extend(["", "## primary file slice"])
    for item in batch_files[:12]:
        lines.append(f"- `{item['path']}`")
    return "\n".join(lines).rstrip() + "\n"


def render_reuse_candidates() -> str:
    ordered = sorted(FEATURE_CATALOG, key=lambda item: (-item["reuse_score"], item["feature_id"]))
    buckets = {
        "Copiable Tel Quel": [item for item in ordered if item["copy_mode"] == "copiable tel quel"],
        "Copiable Avec Adaptation": [item for item in ordered if item["copy_mode"] == "copiable avec adaptation"],
        "A Reecrire": [item for item in ordered if item["copy_mode"] == "a reecrire"],
    }

    lines = [
        "# Reuse Candidates",
        "",
        "Classement initial des blocs a haute valeur, fonde sur le code reel du repo et non sur les README seuls.",
        "",
    ]
    for title, items in buckets.items():
        lines.append(f"## {title}")
        if not items:
            lines.append("- Aucun candidat classe dans cette categorie pour l’instant.")
        for item in items:
            deps = ", ".join(f"`{dep}`" for dep in item["dependencies"])
            paths = ", ".join(f"`{path}`" for path in item["paths"])
            lines.append(
                f"- `{item['feature_id']}` - score {item['reuse_score']}/10 - {item['name']} - "
                f"{item['summary']} - fichiers: {paths} - dependances bloquantes: {deps}"
            )
        lines.append("")
    lines.append("## Notes")
    lines.append("- Les blocs les plus risqués a extraire sont ceux qui emportent `entity/messages.py`, `GraphContext` ou le protocole WebSocket maison.")
    lines.append("- Les blocs classes ici comme tel quel restent a verifier contre vos contraintes de securite et d’environnement.")
    return "\n".join(lines).rstrip() + "\n"


def render_index(
    inventory: list[dict[str, Any]],
    import_edges: list[dict[str, Any]],
    domain_map: dict[str, Any],
    system_summary: dict[str, Any],
) -> str:
    counts = system_summary["counts"]
    coverage = system_summary["coverage"]

    batch_lines = []
    for batch in domain_map["batches"]:
        batch_lines.append(
            f"- `{batch['batch_id']}` - {batch['title']} - {batch['file_count']} fichiers - {batch['loc']} lignes - `analysis/batches/{Path(batch['doc']).name}`"
        )

    hub_lines = [
        f"- `{item['path']}` - batch `{item['primary_batch']}` - importance {item['importance_score']}"
        for item in system_summary["key_hubs"]["overall"][:10]
    ]

    entrypoint_lines = [f"- `{path}`" for path in system_summary["entrypoints"]]
    env_lines = [f"- `{env}`" for env in system_summary["env_vars"][:30]]
    deep_dive_order = [
        "`01-core-config-schema` pour fixer la grammaire et les points d’injection du runtime.",
        "`02-workflow-orchestration` pour comprendre la machine d’execution et la topologie.",
        "`04-agent-runtime` pour isoler le coeur agentique reutilisable.",
        "`05-function-tooling-and-mcp` pour la surface outils/MCP reellement exploitable.",
        "`06-server-api-and-sessions` pour les surfaces d’integration produit.",
        "`08-frontend-vue-console` pour l’editeur no-code et les formulaires pilotes par schema.",
        "`09-yaml-surface` pour les patterns declaratifs et exemples.",
        "`03-node-edge-runtime`, `07-shared-utils`, puis `10-tests-docs-infra` en approfondissement cible.",
    ]

    lines = [
        "# ChatDev-main Analysis Index",
        "",
        "Cartographie preliminaire generee automatiquement a partir du code reel de `ChatDev-main`, orientee indexation future par IA et reperage rapide des fonctionnalites reutilisables.",
        "",
        "## Snapshot",
        f"- Racine analysee: `{posix(REPO_ROOT)}`",
        f"- Fichiers texte en scope: {counts['total_files']}",
        f"- Lignes totales approx.: {counts['total_loc']}",
        f"- Edges d’import/reference: {len(import_edges)}",
        f"- Couverture inventaire/domain map: {'OK' if coverage['coverage_ok'] else 'INCOMPLETE'}",
        f"- Scope de couverture: {coverage['scope_definition']}",
        "",
        "## Tech Stack Confirmed",
        "- Backend: Python 3.12+, FastAPI, Pydantic 2, WebSockets, runtime YAML.",
        "- Frontend: Vue 3, Vite 7, Vue Router, Vue I18n, Vue Flow.",
        "- Surface declarative: `yaml_template/` et `yaml_instance/`.",
        "- Infra: Docker, Docker Compose, GitHub Actions, Makefile.",
        "",
        "## Entrypoints",
        *entrypoint_lines,
        "",
        "## Proposed Batches",
        *batch_lines,
        "",
        "## Key Hubs",
        *hub_lines,
        "",
        "## High-Value Env/Flags",
        *env_lines,
        "",
        "## Recommended Deep-Dive Order",
        *[f"- {item}" for item in deep_dive_order],
        "",
        "## Reuse Shortlist",
        "- Voir `analysis/reuse/reuse-candidates.md`.",
        "- Voir `analysis/manifests/feature_catalog.jsonl`.",
        "",
        "## Coverage Checks",
        f"- `missing_in_domain_map`: {len(coverage['missing_in_domain_map'])}",
        f"- `missing_in_inventory`: {len(coverage['missing_in_inventory'])}",
        f"- `source_paths_in_scope`: {coverage['source_paths_in_scope']}",
        f"- `assigned_to_batch`: {coverage['assigned_to_batch']}",
    ]
    return "\n".join(lines).rstrip() + "\n"


def generate() -> None:
    ensure_dirs()
    inventory, import_edges, file_text_by_rel = compile_inventory()
    domain_map = build_domain_map(inventory)
    system_summary = build_system_summary(inventory, import_edges, file_text_by_rel)

    write_jsonl(MANIFESTS_DIR / "file_inventory.jsonl", inventory)
    write_jsonl(MANIFESTS_DIR / "import_graph.jsonl", import_edges)
    write_jsonl(MANIFESTS_DIR / "feature_catalog.jsonl", sorted(FEATURE_CATALOG, key=lambda item: item["feature_id"]))
    write_json(MANIFESTS_DIR / "domain_map.json", domain_map)
    write_json(MANIFESTS_DIR / "system_summary.json", system_summary)

    for batch in BATCHES:
        (BATCHES_DIR / batch.doc_name).write_text(ascii_safe(render_batch_doc(batch, inventory)), encoding="utf-8")

    (REUSE_DIR / "reuse-candidates.md").write_text(ascii_safe(render_reuse_candidates()), encoding="utf-8")
    (ANALYSIS_ROOT / "index.md").write_text(ascii_safe(render_index(inventory, import_edges, domain_map, system_summary)), encoding="utf-8")


if __name__ == "__main__":
    generate()
