#!/usr/bin/env python3
"""Generate reusable repo analysis artifacts for MetaGPT."""

from __future__ import annotations

import ast
import json
import re
import warnings
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


warnings.filterwarnings("ignore", category=SyntaxWarning)


REPO_ROOT = Path(__file__).resolve().parents[2]
ANALYSIS_ROOT = REPO_ROOT / "analysis"
MANIFESTS_ROOT = ANALYSIS_ROOT / "manifests"
BATCHES_ROOT = ANALYSIS_ROOT / "batches"
REUSE_ROOT = ANALYSIS_ROOT / "reuse"

EXCLUDED_DIRS = {
    ".git",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    "analysis",
    "htmlcov",
    "node_modules",
}

ROOT_INFRA_FILES = {
    ".coveragerc",
    ".dockerignore",
    ".gitattributes",
    ".gitignore",
    ".pre-commit-config.yaml",
    "Dockerfile",
    "LICENSE",
    "MANIFEST.in",
    "METAGPT_ANALYSIS_PROMPTS.md",
    "pytest.ini",
    "README.md",
    "requirements.txt",
    "ruff.toml",
    "SECURITY.md",
    "setup.py",
}

TEXT_EXTENSIONS = {
    "",
    ".cfg",
    ".css",
    ".csv",
    ".env",
    ".html",
    ".ini",
    ".ipynb",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".pyi",
    ".sh",
    ".sql",
    ".svg",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}

KIND_BY_SUFFIX = {
    ".py": "python",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".ini": "ini",
    ".sh": "shell",
    ".ps1": "shell",
    ".js": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".txt": "text",
    ".html": "html",
    ".svg": "svg",
    ".css": "css",
    ".csv": "csv",
    ".ipynb": "notebook",
}

ASSET_SUFFIXES = {
    ".bmp",
    ".docx",
    ".gif",
    ".jpeg",
    ".jpg",
    ".mov",
    ".mp3",
    ".mp4",
    ".pdf",
    ".png",
    ".wav",
    ".webp",
    ".xls",
    ".xlsx",
    ".zip",
}

CODE_KINDS = {
    "css",
    "html",
    "ini",
    "javascript",
    "json",
    "markdown",
    "notebook",
    "python",
    "shell",
    "text",
    "toml",
    "typescript",
    "yaml",
}


@dataclass(frozen=True)
class BatchSpec:
    batch_id: str
    slug: str
    title: str
    exact: tuple[str, ...]
    prefixes: tuple[str, ...]
    purpose: str
    description: str
    entrypoints: tuple[str, ...]
    key_files: tuple[str, ...]
    data_flow: tuple[str, ...]
    flags_env: tuple[str, ...]
    reusable_ideas: tuple[str, ...]
    copy_risk: tuple[str, ...]
    search_hints: tuple[str, ...]
    depth_rank: int


BATCHES: list[BatchSpec] = [
    BatchSpec(
        batch_id="B01-core-runtime-config",
        slug="01-core-runtime-config",
        title="Core Runtime / Config / Schema",
        exact=(
            "metagpt/__init__.py",
            "metagpt/_compat.py",
            "metagpt/config2.py",
            "metagpt/const.py",
            "metagpt/context.py",
            "metagpt/context_mixin.py",
            "metagpt/llm.py",
            "metagpt/logs.py",
            "metagpt/schema.py",
        ),
        prefixes=("metagpt/base/", "metagpt/configs/", "metagpt/memory/"),
        purpose=(
            "Runtime substrate: config loading, shared context, schema/message primitives, "
            "base abstract contracts, memory, and logging."
        ),
        description=(
            "Use this batch when you need the minimum runtime contract for any MetaGPT-derived "
            "agent system."
        ),
        entrypoints=(
            "metagpt/config2.py::Config.default",
            "metagpt/context.py::Context.llm",
            "metagpt/schema.py::Message",
            "metagpt/schema.py::Plan",
            "metagpt/base/base_role.py::BaseRole",
            "metagpt/base/base_env.py::BaseEnvironment",
        ),
        key_files=(
            "metagpt/config2.py",
            "metagpt/context.py",
            "metagpt/schema.py",
            "metagpt/context_mixin.py",
            "metagpt/base/base_role.py",
            "metagpt/base/base_env.py",
            "metagpt/memory/memory.py",
        ),
        data_flow=(
            "Config objects are assembled in metagpt/config2.py::Config and injected into metagpt/context.py::Context.",
            "Context.llm() lazily asks the provider registry for an LLM instance and attaches a shared cost manager.",
            "metagpt/schema.py::Message and metagpt/schema.py::MessageQueue are the canonical runtime payloads.",
            "metagpt/schema.py::Plan, Task, and TaskResult become the planning protocol consumed later by roles and strategy.",
            "metagpt/context_mixin.py and metagpt/base/* give Action, Role, and Environment a common runtime surface.",
        ),
        flags_env=(
            "Global config root is ~/.metagpt/config2.yaml; the template is emitted by metagpt/software_company.py::copy_config_to.",
            "Important config groups live in metagpt/config2.py and metagpt/configs/*: llm, search, browser, workspace, exp_pool, omniparse, role_zero.",
            "Budget and token accounting attach through metagpt/context.py::Context.cost_manager and metagpt/utils/cost_manager.py.",
        ),
        reusable_ideas=(
            "Typed Message + MessageQueue + Plan primitives that are independent from any one role implementation.",
            "Lazy context-owned LLM factory with shared billing/cost state.",
            "Pydantic-based serialization mixins for agent state recovery.",
        ),
        copy_risk=(
            "Copy with adaptation: schema primitives are reusable, but file layout constants and Pydantic model shapes are baked into the runtime.",
            "Rewrite if you do not want the current serialization format or the shared Context object pattern.",
        ),
        search_hints=(
            'rg -n "class (Context|Message|Plan|Task|SerializationMixin)" metagpt',
            'rg -n "Config\\(|Config.default|cost_manager|MessageQueue" metagpt',
        ),
        depth_rank=1,
    ),
    BatchSpec(
        batch_id="B02-agent-orchestration",
        slug="02-agent-orchestration",
        title="Agent Orchestration / Roles / Company Flow",
        exact=(
            "metagpt/software_company.py",
            "metagpt/startup.py",
            "metagpt/subscription.py",
            "metagpt/team.py",
        ),
        prefixes=("metagpt/roles/",),
        purpose=(
            "Team assembly, role lifecycle, software-company entrypoints, and higher-level agent flow wiring."
        ),
        description=(
            "Use this batch to understand how MetaGPT turns a requirement into an active team of roles."
        ),
        entrypoints=(
            "metagpt/software_company.py::app",
            "metagpt/software_company.py::generate_repo",
            "metagpt/team.py::Team.run",
            "metagpt/roles/role.py::Role.run",
            "metagpt/roles/di/data_interpreter.py::DataInterpreter",
            "metagpt/roles/di/team_leader.py::TeamLeader",
        ),
        key_files=(
            "metagpt/software_company.py",
            "metagpt/team.py",
            "metagpt/roles/role.py",
            "metagpt/roles/engineer.py",
            "metagpt/roles/di/data_interpreter.py",
            "metagpt/roles/di/team_leader.py",
        ),
        data_flow=(
            "CLI and library entry both land in metagpt/software_company.py::generate_repo.",
            "generate_repo() builds a Context, instantiates Team, hires concrete roles, then calls Team.run().",
            "metagpt/team.py::Team delegates execution to Environment or MGXEnv and enforces budget checks before each round.",
            "metagpt/roles/role.py::Role.run implements observe -> think -> act -> publish.",
            "Specialized role flows live in concrete roles like metagpt/roles/engineer.py::Engineer and metagpt/roles/di/data_interpreter.py::DataInterpreter.",
        ),
        flags_env=(
            "CLI flags are defined in metagpt/software_company.py::startup: --investment, --n-round, --project-name, --inc, --project-path, --recover-path, --init-config.",
            "Team.use_mgx defaults to True in metagpt/team.py, so MGXEnv is the default environment unless explicitly bypassed.",
            "Role behavior switches through Role._set_react_mode() and per-role fields like auto_run, use_plan, use_code_review.",
        ),
        reusable_ideas=(
            "A compact Team object that owns budget, recovery, and the round-based run loop.",
            "A reusable Role runtime contract with watch lists, personal buffers, working memory, and multiple react modes.",
            "A DataInterpreter agent that mixes planning, code generation, execution, and optional tool recommendation.",
        ),
        copy_risk=(
            "Copy with adaptation: Team + Role are reusable but strongly coupled to Message, Context, Planner, and Action APIs.",
            "Rewrite or isolate carefully: Engineer and software-company flows depend on ProjectRepo, document repos, and MetaGPT-specific SOP artifacts.",
        ),
        search_hints=(
            'rg -n "class (Team|Role|Engineer|DataInterpreter|TeamLeader)" metagpt/roles metagpt/team.py',
            'rg -n "generate_repo|hire\\(|publish_message|_observe\\(|_think\\(|_act\\(" metagpt',
        ),
        depth_rank=2,
    ),
    BatchSpec(
        batch_id="B03-actions-planning-prompts",
        slug="03-actions-planning-prompts",
        title="Actions / Planning / Prompt Assets",
        exact=(),
        prefixes=("metagpt/actions/", "metagpt/prompts/", "metagpt/strategy/", "metagpt/skills/"),
        purpose=(
            "Action library, action-node machinery, task planning, requirement-analysis flows, and packaged prompt assets."
        ),
        description=(
            "Use this batch to reuse SOP fragments, planning logic, or prompt-driven workflow pieces."
        ),
        entrypoints=(
            "metagpt/actions/action.py::Action",
            "metagpt/actions/action_node.py::ActionNode",
            "metagpt/strategy/planner.py::Planner",
            "metagpt/actions/write_prd.py::WritePRD",
            "metagpt/actions/write_code.py::WriteCode",
            "metagpt/actions/requirement_analysis/trd/write_trd.py",
        ),
        key_files=(
            "metagpt/actions/action.py",
            "metagpt/actions/action_node.py",
            "metagpt/strategy/planner.py",
            "metagpt/actions/write_prd.py",
            "metagpt/actions/write_code.py",
            "metagpt/actions/project_management.py",
        ),
        data_flow=(
            "Roles choose or are assigned Actions; Action.run() either delegates to a concrete implementation or to ActionNode-based prompt filling.",
            "Action outputs become Message or ActionOutput payloads that feed the role memory and environment message bus.",
            "metagpt/strategy/planner.py::Planner drives plan confirmation, task acceptance, and plan updates on top of metagpt/schema.py::Plan.",
            "Requirement-analysis subpackages in metagpt/actions/requirement_analysis/* break down framework, TRD, and image-to-text analysis into smaller actions.",
            "metagpt/prompts/* and metagpt/skills/* hold prompt assets and skill presets that make many flows domain-specific.",
        ),
        flags_env=(
            "Prompt format depends on config.prompt_schema and action/role prefixes.",
            "Planning loops use react_mode = react/by_order/plan_and_act from metagpt/roles/role.py.",
            "Auto summarize and incremental-coding behavior are driven by config.max_auto_summarize_code and config.inc.",
        ),
        reusable_ideas=(
            "ActionNode-based prompt workflows that return typed structured outputs.",
            "Planner + Plan feedback loop for multi-step task execution and review.",
            "Requirement decomposition steps that can be extracted as smaller domain workflows.",
        ),
        copy_risk=(
            "Copy with adaptation: Action and Planner abstractions are reusable, but prompt assets and file-repo assumptions create hidden coupling.",
            "Rewrite if you want a different document pipeline or less prompt-heavy SOP logic.",
        ),
        search_hints=(
            'rg -n "class (Action|ActionNode|Planner)|def update_plan|def process_task_result" metagpt/actions metagpt/strategy',
            'rg -n "WritePRD|WriteCode|WriteTasks|requirement_analysis" metagpt/actions',
        ),
        depth_rank=3,
    ),
    BatchSpec(
        batch_id="B04-llm-provider-layer",
        slug="04-llm-provider-layer",
        title="LLM Provider Layer / Model Abstraction",
        exact=(),
        prefixes=("metagpt/provider/",),
        purpose=(
            "Provider registry, base LLM abstraction, per-vendor implementations, and output postprocessing."
        ),
        description=(
            "Use this batch to plug MetaGPT into a new model backend or reuse its provider abstraction pattern."
        ),
        entrypoints=(
            "metagpt/provider/llm_provider_registry.py::create_llm_instance",
            "metagpt/provider/base_llm.py::BaseLLM.aask",
            "metagpt/provider/openai_api.py::OpenAILLM",
            "metagpt/provider/anthropic_api.py::AnthropicLLM",
            "metagpt/provider/postprocess/llm_output_postprocess.py",
        ),
        key_files=(
            "metagpt/provider/base_llm.py",
            "metagpt/provider/llm_provider_registry.py",
            "metagpt/provider/openai_api.py",
            "metagpt/provider/general_api_base.py",
            "metagpt/provider/postprocess/llm_output_postprocess.py",
        ),
        data_flow=(
            "Context hands LLMConfig to create_llm_instance() in metagpt/provider/llm_provider_registry.py.",
            "Concrete provider classes register themselves through @register_provider and subclass BaseLLM.",
            "BaseLLM normalizes messages, optional image payloads, streaming, retries, and token/cost accounting.",
            "Vendor-specific modules handle request signing, response parsing, and model quirks.",
            "Postprocess plugins in metagpt/provider/postprocess/* can mutate or normalize raw model output downstream.",
        ),
        flags_env=(
            "Primary knobs are llm.api_type, llm.model, llm.base_url, llm.api_key, llm.timeout, llm.use_system_prompt, and llm.stream.",
            "Some providers override timeout or system-prompt behavior inside BaseLLM and their concrete subclasses.",
            "RAG-specific model selection is separate and lives under metagpt/rag/factories/llm.py.",
        ),
        reusable_ideas=(
            "Provider registry pattern with explicit enum-to-class binding.",
            "Single base class handling retries, streaming, multimodal payload formatting, and cost accounting.",
            "Per-provider postprocess layer for model-specific output cleanup.",
        ),
        copy_risk=(
            "Copy with adaptation: registry + BaseLLM are portable, but cost manager hooks, config objects, and tool output conventions are MetaGPT-specific.",
            "Rewrite vendor adapters if you do not want OpenAI-shaped response objects across all providers.",
        ),
        search_hints=(
            'rg -n "class .*LLM|register_provider|create_llm_instance|class BaseLLM" metagpt/provider',
            'rg -n "aask\\(|acompletion_text\\(|get_choice_text\\(" metagpt/provider',
        ),
        depth_rank=4,
    ),
    BatchSpec(
        batch_id="B05-tools-utils-execution",
        slug="05-tools-utils-execution",
        title="Tools / Utils / Execution Helpers",
        exact=(),
        prefixes=("metagpt/tools/", "metagpt/utils/", "metagpt/learn/"),
        purpose=(
            "Tool registration, search/browser wrappers, shell/editor helpers, repo/file utilities, and general execution support."
        ),
        description=(
            "Use this batch when you need practical helper modules rather than core agent orchestration."
        ),
        entrypoints=(
            "metagpt/tools/tool_registry.py::register_tool",
            "metagpt/tools/search_engine.py::SearchEngine",
            "metagpt/tools/web_browser_engine.py",
            "metagpt/utils/project_repo.py::ProjectRepo",
            "metagpt/utils/git_repository.py::GitRepository",
        ),
        key_files=(
            "metagpt/tools/tool_registry.py",
            "metagpt/tools/search_engine.py",
            "metagpt/tools/web_browser_engine.py",
            "metagpt/tools/libs/editor.py",
            "metagpt/utils/project_repo.py",
            "metagpt/utils/git_repository.py",
            "metagpt/utils/common.py",
        ),
        data_flow=(
            "Tool definitions are discovered and normalized in metagpt/tools/tool_registry.py, including schema extraction from code.",
            "Search and browsing are routed through wrapper objects like metagpt/tools/search_engine.py::SearchEngine and browser engine adapters.",
            "Execution-oriented helpers live in metagpt/tools/libs/* for shell, editor, repo indexing, linting, scraping, and notebook support.",
            "Utility modules in metagpt/utils/* provide repo abstractions, serialization helpers, common parsers, token counting, and async helpers.",
            "metagpt/learn/* adds lightweight wrappers for embedding, image, speech, and search-related helper capabilities.",
        ),
        flags_env=(
            "Browser and search settings live in metagpt/configs/browser_config.py and metagpt/configs/search_config.py.",
            "Tool schema files are written relative to TOOL_SCHEMA_PATH from metagpt/const.py.",
            "Several helpers depend on external executables or services such as browsers, git, nbclient, or search APIs.",
        ),
        reusable_ideas=(
            "Schema-driven tool registry with tag lookup and dynamic code scanning.",
            "Search engine adapter layer that swaps providers behind one async interface.",
            "A large utility belt around git repos, markdown/code parsing, and execution traces.",
        ),
        copy_risk=(
            "Mixed: some helpers are near-standalone, but registry, repo, and tool schemas depend on MetaGPT constants and data models.",
            "Review every utils/common.py dependency before copying, because it has become a broad grab bag and a major coupling hub.",
        ),
        search_hints=(
            'rg -n "class ToolRegistry|def register_tool|class SearchEngine" metagpt/tools',
            'rg -n "class ProjectRepo|class GitRepository|def import_class|def serialize" metagpt/utils',
        ),
        depth_rank=5,
    ),
    BatchSpec(
        batch_id="B06-rag-doc-knowledge",
        slug="06-rag-doc-knowledge",
        title="RAG / Document Store / Experience / Repo Parsing",
        exact=("metagpt/document.py", "metagpt/repo_parser.py"),
        prefixes=("metagpt/document_store/", "metagpt/exp_pool/", "metagpt/management/", "metagpt/rag/"),
        purpose=(
            "Knowledge retrieval stack: document ingestion, vector stores, retrievers, rerankers, experience cache, and repo parsing."
        ),
        description=(
            "Use this batch for retrieval-heavy features, document pipelines, or reusable knowledge-store components."
        ),
        entrypoints=(
            "metagpt/rag/engines/simple.py::SimpleEngine",
            "metagpt/rag/factories/retriever.py::get_retriever",
            "metagpt/exp_pool/decorator.py::exp_cache",
            "metagpt/exp_pool/manager.py::ExperienceManager",
            "metagpt/repo_parser.py::RepoParser",
        ),
        key_files=(
            "metagpt/rag/engines/simple.py",
            "metagpt/rag/factories/retriever.py",
            "metagpt/exp_pool/decorator.py",
            "metagpt/exp_pool/manager.py",
            "metagpt/document.py",
            "metagpt/repo_parser.py",
            "metagpt/document_store/base_store.py",
        ),
        data_flow=(
            "SimpleEngine in metagpt/rag/engines/simple.py is the main assembly point: it reads docs/objects, transforms them into nodes, builds retrievers, then queries and reconstructs objects.",
            "RetrieverFactory in metagpt/rag/factories/retriever.py chooses BM25, FAISS, Chroma, or Elasticsearch-backed retrieval from config objects.",
            "ExperiencePool layers a reusable cache/evaluation loop on top of RAG through metagpt/exp_pool/decorator.py and metagpt/exp_pool/manager.py.",
            "metagpt/document.py and metagpt/repo_parser.py cover document normalization and codebase structural extraction for downstream prompting and reports.",
            "management/skill_manager.py is a smaller retrieval surface backed by ChromaStore.",
        ),
        flags_env=(
            "RAG extras are optional and declared in setup.py extras_require['rag'].",
            "Important runtime knobs: config.exp_pool.*, config.omniparse.*, retriever/ranker config objects in metagpt/rag/schema.py.",
            "Persist paths and collection names matter because several stores assume on-disk or external-service state.",
        ),
        reusable_ideas=(
            "SimpleEngine as a thin composition layer over document readers, embeddings, retrievers, and rerankers.",
            "Decorator-based experience caching with pluggable serializers, scorers, and judges.",
            "RepoParser for extracting class and dependency views from source trees.",
        ),
        copy_risk=(
            "Copy with adaptation: the retrieval stack is valuable, but it is heavily shaped around llama-index config objects and node types.",
            "Rewrite if you want a lighter-weight store layer without the current amount of adapter surface.",
        ),
        search_hints=(
            'rg -n "class SimpleEngine|class RetrieverFactory|def exp_cache|class ExperienceManager" metagpt/rag metagpt/exp_pool',
            'rg -n "class RepoParser|class DotClassInfo|class ChromaStore|class BaseStore" metagpt',
        ),
        depth_rank=6,
    ),
    BatchSpec(
        batch_id="B07-environments-extensions",
        slug="07-environments-extensions",
        title="Environments / Extensions / Simulators",
        exact=(),
        prefixes=("metagpt/environment/", "metagpt/ext/"),
        purpose=(
            "Specialized runtime environments and extension packs for MGX, Android, Werewolf, Stanford Town, Minecraft, SPO, SELA, and related experiments."
        ),
        description=(
            "Use this batch when you need domain-specific simulation, external-world integration, or research extensions."
        ),
        entrypoints=(
            "metagpt/environment/base_env.py::Environment",
            "metagpt/environment/mgx/mgx_env.py::MGXEnv",
            "metagpt/ext/android_assistant/roles/android_assistant.py::AndroidAssistant",
            "metagpt/ext/stanford_town/roles/st_role.py::STRole",
            "metagpt/ext/spo/app.py",
        ),
        key_files=(
            "metagpt/environment/base_env.py",
            "metagpt/environment/mgx/mgx_env.py",
            "metagpt/environment/android/android_ext_env.py",
            "metagpt/ext/android_assistant/roles/android_assistant.py",
            "metagpt/ext/stanford_town/roles/st_role.py",
            "metagpt/ext/spo/app.py",
            "metagpt/ext/sela/experimenter.py",
        ),
        data_flow=(
            "Environment subclasses implement message routing plus optional external world APIs for read/write actions.",
            "MGXEnv wraps the standard Environment with TeamLeader-mediated routing, direct chat handling, and image extraction from user prompts.",
            "Specialized environments in metagpt/environment/* expose Android, Werewolf, Stanford Town, Minecraft, software, and API-specific hooks.",
            "Extension packs in metagpt/ext/* bundle domain roles, actions, memory models, prompts, evaluation, and sometimes their own datasets or scripts.",
            "Several extensions cross the Python boundary, most visibly the Minecraft mineflayer sidecar under metagpt/environment/minecraft/mineflayer.",
        ),
        flags_env=(
            "Many extension-specific configs are optional extras rather than core requirements; inspect setup.py extras and extension README files before reuse.",
            "MGXEnv changes routing semantics compared with the plain Environment, so reuse must decide whether TeamLeader mediation is desired.",
            "Android and Minecraft stacks have external runtime dependencies beyond Python packages.",
        ),
        reusable_ideas=(
            "MGXEnv as a pattern for wrapping a base message bus with mediator-controlled routing.",
            "Stanford Town and Android Assistant as examples of how to embed domain state, memory, and actions into the core role contract.",
            "Environment API registries (read/write) for exposing world operations as typed tool-like surfaces.",
        ),
        copy_risk=(
            "High: extensions are valuable references but usually come with the strongest domain coupling, prompts, datasets, and third-party runtime assumptions.",
            "Prefer extracting patterns rather than copying whole extension folders unless you want the exact same domain.",
        ),
        search_hints=(
            'rg -n "class (Environment|MGXEnv|.*Env|.*Assistant|STRole)|mark_as_readable|mark_as_writeable" metagpt/environment metagpt/ext',
            'rg -n "publish_message|direct_chat|observe\\(|step\\(" metagpt/environment metagpt/ext',
        ),
        depth_rank=7,
    ),
    BatchSpec(
        batch_id="B08-tests-examples-docs-infra",
        slug="08-tests-examples-docs-infra",
        title="Tests / Examples / Docs / Infra",
        exact=tuple(sorted(ROOT_INFRA_FILES)),
        prefixes=("tests/", "examples/", "docs/", "config/", ".github/", ".devcontainer/"),
        purpose=(
            "Validation surfaces, usage examples, packaging metadata, config samples, Docker/devcontainer, and CI workflows."
        ),
        description=(
            "Use this batch to find runnable examples, test coverage, packaging assumptions, and operational constraints."
        ),
        entrypoints=(
            "setup.py::entry_points",
            "README.md::Get Started",
            "examples/hello_world.py",
            "examples/di/software_company.py",
            ".github/workflows/unittest.yaml",
            "pytest.ini",
        ),
        key_files=(
            "setup.py",
            "requirements.txt",
            "pytest.ini",
            "README.md",
            "Dockerfile",
            ".github/workflows/unittest.yaml",
            "examples/hello_world.py",
            "examples/di/software_company.py",
        ),
        data_flow=(
            "Packaging and install metadata live at the repo root in setup.py, requirements.txt, MANIFEST.in, and Dockerfile.",
            "docs/ and README.md document the intended product surfaces, but they lag behind code in some areas and should be treated as secondary evidence.",
            "examples/ mirrors major capabilities: software company flow, DI, RAG, debate, research, Stanford Town, Werewolf, Android Assistant, SPO, AFLOW, and SELA.",
            "tests/ contains a real, broad validation surface, but pytest.ini ignores many expensive or integration-heavy paths by default.",
            "CI workflows under .github/workflows split package build, unit tests, full tests, pre-commit checks, and stale issue management.",
        ),
        flags_env=(
            "setup.py pins Python to >=3.9,<3.12 and registers console script metagpt=metagpt.software_company:app.",
            "Dockerfile exports CHROME_BIN, puppeteer_config, and PUPPETEER_SKIP_CHROMIUM_DOWNLOAD for browser-related tooling.",
            "pytest.ini defines testpaths, coverage outputs, and a long ignore list that highlights unstable or heavy integration areas.",
        ),
        reusable_ideas=(
            "Examples are the fastest way to discover supported entrypoints without reading all roles or actions.",
            "The ignore list in pytest.ini is an implicit map of costly or optional subsystems.",
            "CI files make hidden operational assumptions explicit: lint, package build, and the split between unit and full tests.",
        ),
        copy_risk=(
            "Low for sample scripts and config templates as orientation material; medium for CI and Docker because they encode project-specific operational tradeoffs.",
            "Do not treat docs as authoritative over code for architectural decisions; always cross-check against metagpt/*.",
        ),
        search_hints=(
            'rg -n "metagpt\\(|DataInterpreter|SearchEngine|SimpleEngine" examples tests',
            'rg -n "ignore=" pytest.ini .github/workflows -g "*.yaml"',
        ),
        depth_rank=8,
    ),
]

BATCH_BY_ID = {batch.batch_id: batch for batch in BATCHES}


FEATURES: list[dict[str, Any]] = [
    {
        "feature_id": "llm_registry_core",
        "name": "LLM provider registry core",
        "summary": "Very small registry/decorator layer that binds config keys to provider classes.",
        "paths": ["metagpt/provider/llm_provider_registry.py"],
        "keywords": ["registry", "provider", "factory", "decorator"],
        "reuse_score": 6,
        "coupling": "low",
        "dependencies": ["metagpt.configs.llm_config", "metagpt.provider.base_llm"],
        "copy_advice": "copy_as_is",
    },
    {
        "feature_id": "base_store_contracts",
        "name": "BaseStore and LocalStore contracts",
        "summary": "Minimal abstract interfaces for searchable local stores with a simple load-or-build lifecycle.",
        "paths": ["metagpt/document_store/base_store.py"],
        "keywords": ["store", "interface", "abstract base", "local cache"],
        "reuse_score": 5,
        "coupling": "low",
        "dependencies": ["abc", "pathlib"],
        "copy_advice": "copy_as_is",
    },
    {
        "feature_id": "team_environment_message_loop",
        "name": "Team + Environment message loop",
        "summary": "Round-based multi-agent orchestration that hires roles, routes messages, enforces budget, and supports recovery.",
        "paths": [
            "metagpt/team.py",
            "metagpt/environment/base_env.py",
            "metagpt/roles/role.py",
            "metagpt/schema.py",
        ],
        "keywords": ["multi-agent", "team", "orchestration", "message bus", "budget", "recovery"],
        "reuse_score": 9,
        "coupling": "high",
        "dependencies": ["pydantic", "metagpt.context", "metagpt.memory", "metagpt.provider"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "typed_message_plan_core",
        "name": "Typed message and plan primitives",
        "summary": "Pydantic models for Message, MessageQueue, Plan, Task, and serialization helpers used across the runtime.",
        "paths": ["metagpt/schema.py"],
        "keywords": ["message", "plan", "task", "serialization", "workflow"],
        "reuse_score": 8,
        "coupling": "medium",
        "dependencies": ["pydantic", "metagpt.const", "metagpt.utils.serialize"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "role_runtime_contract",
        "name": "Role runtime contract",
        "summary": "Observe-think-act role loop with personal buffers, watch filters, memory, and multiple react modes.",
        "paths": ["metagpt/roles/role.py", "metagpt/context_mixin.py"],
        "keywords": ["agent", "role", "react", "planner", "memory", "observe"],
        "reuse_score": 9,
        "coupling": "high",
        "dependencies": ["metagpt.actions", "metagpt.schema", "metagpt.strategy", "metagpt.memory"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "action_node_workflows",
        "name": "Action and ActionNode workflow layer",
        "summary": "Prompt-driven action abstraction that can return typed outputs and plug into role execution.",
        "paths": ["metagpt/actions/action.py", "metagpt/actions/action_node.py", "metagpt/actions/action_output.py"],
        "keywords": ["action", "prompt", "workflow", "typed output", "SOP"],
        "reuse_score": 8,
        "coupling": "medium",
        "dependencies": ["pydantic", "metagpt.context_mixin", "metagpt.schema"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "provider_registry",
        "name": "Provider registry and BaseLLM abstraction",
        "summary": "Enum-driven provider registry plus a common async LLM base for retries, streaming, multimodal input, and cost tracking.",
        "paths": [
            "metagpt/provider/llm_provider_registry.py",
            "metagpt/provider/base_llm.py",
            "metagpt/provider/openai_api.py",
        ],
        "keywords": ["llm", "provider", "registry", "streaming", "cost"],
        "reuse_score": 9,
        "coupling": "medium",
        "dependencies": ["openai", "tenacity", "metagpt.configs.llm_config", "metagpt.utils.cost_manager"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "tool_registry_schema",
        "name": "Schema-driven tool registry",
        "summary": "Registers tools from code, generates callable schemas, tags tools, and supports dynamic loading from file paths.",
        "paths": ["metagpt/tools/tool_registry.py", "metagpt/tools/tool_convert.py", "metagpt/tools/tool_data_type.py"],
        "keywords": ["tool", "registry", "schema", "dynamic loading", "tags"],
        "reuse_score": 8,
        "coupling": "medium",
        "dependencies": ["pydantic", "inspect", "metagpt.const"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "search_engine_adapter",
        "name": "Search engine adapter layer",
        "summary": "Single async interface that swaps Serper, SerpAPI, Google API, DuckDuckGo, Bing, or custom engines.",
        "paths": [
            "metagpt/tools/search_engine.py",
            "metagpt/tools/search_engine_serper.py",
            "metagpt/tools/search_engine_ddg.py",
        ],
        "keywords": ["search", "adapter", "serper", "duckduckgo", "bing", "google"],
        "reuse_score": 7,
        "coupling": "medium",
        "dependencies": ["pydantic", "metagpt.configs.search_config"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "simple_rag_engine",
        "name": "SimpleEngine RAG composition layer",
        "summary": "Thin composition over readers, node transforms, embeddings, retrievers, rerankers, and response synthesis.",
        "paths": [
            "metagpt/rag/engines/simple.py",
            "metagpt/rag/factories/retriever.py",
            "metagpt/rag/factories/embedding.py",
        ],
        "keywords": ["rag", "retrieval", "llama-index", "engine", "ranker"],
        "reuse_score": 8,
        "coupling": "high",
        "dependencies": ["llama_index", "fsspec", "metagpt.rag.schema"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "experience_pool_cache",
        "name": "Experience pool cache decorator",
        "summary": "Decorator-based cache that retrieves prior solutions, scores new ones, and persists them through a pluggable storage backend.",
        "paths": ["metagpt/exp_pool/decorator.py", "metagpt/exp_pool/manager.py", "metagpt/exp_pool/schema.py"],
        "keywords": ["experience", "cache", "retrieval", "decorator", "evaluation"],
        "reuse_score": 8,
        "coupling": "high",
        "dependencies": ["metagpt.rag", "metagpt.config2", "pydantic"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "repo_parser_views",
        "name": "Repo parser and structural views",
        "summary": "Parses code structure into class/dependency views that later feed diagrams, summaries, and reports.",
        "paths": ["metagpt/repo_parser.py", "metagpt/actions/rebuild_class_view.py", "metagpt/actions/rebuild_sequence_view.py"],
        "keywords": ["repo parser", "dependency graph", "uml", "mermaid", "code map"],
        "reuse_score": 8,
        "coupling": "medium",
        "dependencies": ["ast", "pandas", "metagpt.utils.common"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "data_interpreter_agent",
        "name": "DataInterpreter agent",
        "summary": "Planning-capable coding agent that writes and executes notebook-style analysis code with optional tool recommendation.",
        "paths": [
            "metagpt/roles/di/data_interpreter.py",
            "metagpt/actions/di/write_analysis_code.py",
            "metagpt/actions/di/execute_nb_code.py",
        ],
        "keywords": ["data interpreter", "coding agent", "notebook", "planning", "tool recommendation"],
        "reuse_score": 9,
        "coupling": "high",
        "dependencies": ["nbclient", "nbformat", "metagpt.strategy", "metagpt.tools.tool_recommend"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "mgx_team_leader_router",
        "name": "MGX TeamLeader routing",
        "summary": "Mediator-driven environment that routes public and direct-chat messages through a TeamLeader role.",
        "paths": ["metagpt/environment/mgx/mgx_env.py", "metagpt/roles/di/team_leader.py"],
        "keywords": ["mgx", "router", "mediator", "team leader", "chat routing"],
        "reuse_score": 7,
        "coupling": "high",
        "dependencies": ["metagpt.environment.base_env", "metagpt.roles.di.role_zero"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "document_store_abstractions",
        "name": "Document store abstractions",
        "summary": "Thin interfaces over local and vector-backed document stores including Chroma, FAISS, LanceDB, Milvus, and Qdrant.",
        "paths": ["metagpt/document_store/base_store.py", "metagpt/document_store/faiss_store.py", "metagpt/document_store/qdrant_store.py"],
        "keywords": ["document store", "vector store", "faiss", "qdrant", "chroma"],
        "reuse_score": 7,
        "coupling": "medium",
        "dependencies": ["faiss", "qdrant-client", "lancedb", "chromadb"],
        "copy_advice": "copy_with_adaptation",
    },
    {
        "feature_id": "stanford_town_memory_stack",
        "name": "Stanford Town memory stack",
        "summary": "Domain-specific long-horizon memory and planning system for social simulation agents.",
        "paths": [
            "metagpt/ext/stanford_town/roles/st_role.py",
            "metagpt/ext/stanford_town/memory/agent_memory.py",
            "metagpt/ext/stanford_town/plan/st_plan.py",
        ],
        "keywords": ["stanford town", "memory", "simulation", "social agents", "plan"],
        "reuse_score": 7,
        "coupling": "very_high",
        "dependencies": ["metagpt.ext.stanford_town", "metagpt.environment.stanford_town"],
        "copy_advice": "rewrite",
    },
    {
        "feature_id": "android_assistant_stack",
        "name": "Android assistant stack",
        "summary": "End-to-end Android agent extension with screenshot parsing, records, prompts, and environment hooks.",
        "paths": [
            "metagpt/ext/android_assistant/roles/android_assistant.py",
            "metagpt/ext/android_assistant/actions/screenshot_parse.py",
            "metagpt/environment/android/android_ext_env.py",
        ],
        "keywords": ["android", "assistant", "screenshot", "environment", "vision"],
        "reuse_score": 6,
        "coupling": "very_high",
        "dependencies": ["opencv", "tensorflow", "torch", "groundingdino", "metagpt.environment.android"],
        "copy_advice": "rewrite",
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize(path: Path) -> str:
    return path.as_posix()


def rel_path(path: Path) -> str:
    return normalize(path.relative_to(REPO_ROOT))


def is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)


def classify_kind(path: Path) -> str:
    if path.name == "Dockerfile":
        return "docker"
    if path.name in {"LICENSE", "MANIFEST.in"}:
        return "text"
    suffix = path.suffix.lower()
    if suffix in ASSET_SUFFIXES:
        return "asset"
    if suffix in KIND_BY_SUFFIX:
        return KIND_BY_SUFFIX[suffix]
    if suffix:
        return "other"
    return "other"


def is_text_file(path: Path, kind: str) -> bool:
    return kind in CODE_KINDS or path.suffix.lower() in TEXT_EXTENSIONS or path.name in ROOT_INFRA_FILES


def safe_read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def count_lines(text: str) -> int:
    if not text:
        return 0
    return text.count("\n") + (0 if text.endswith("\n") else 1)


def top_level_bucket(rel: str) -> str:
    return rel.split("/", 1)[0]


def module_name_for(rel: str) -> str | None:
    if not rel.endswith(".py"):
        return None
    parts = list(Path(rel).with_suffix("").parts)
    if parts[-1] == "__init__":
        parts = parts[:-1]
    if not parts:
        return None
    return ".".join(parts)


def current_package_for(module_name: str, rel: str) -> list[str]:
    if Path(rel).name == "__init__.py":
        return module_name.split(".")
    return module_name.split(".")[:-1]


def symbol_summary(record: dict[str, Any], limit: int = 6) -> str:
    symbols = []
    for cls in record.get("classes", []):
        symbols.append(f"class {cls}")
    for fn in record.get("functions", []):
        symbols.append(f"def {fn}")
    for fn in record.get("async_functions", []):
        symbols.append(f"async def {fn}")
    return "; ".join(symbols[:limit]) if symbols else "no top-level symbols parsed"


def resolve_import_target(
    node: ast.AST,
    module_name: str,
    rel: str,
    module_to_path: dict[str, str],
) -> list[str]:
    targets: list[str] = []
    package_parts = current_package_for(module_name, rel)

    def resolve_candidate(name: str) -> str | None:
        parts = name.split(".")
        while parts:
            candidate = ".".join(parts)
            if candidate in module_to_path:
                return candidate
            parts.pop()
        return None

    if isinstance(node, ast.Import):
        for alias in node.names:
            resolved = resolve_candidate(alias.name)
            if resolved:
                targets.append(resolved)
    elif isinstance(node, ast.ImportFrom):
        if node.level > 0:
            base_parts = package_parts[: len(package_parts) - (node.level - 1)]
        else:
            base_parts = []
        if node.module:
            base_parts = base_parts + node.module.split(".")
        base_name = ".".join(base_parts) if base_parts else ""
        for alias in node.names:
            candidate = ".".join([part for part in [base_name, alias.name] if part])
            resolved = resolve_candidate(candidate)
            if resolved:
                targets.append(resolved)
                continue
            if base_name:
                resolved = resolve_candidate(base_name)
                if resolved:
                    targets.append(resolved)
    return sorted(set(targets))


def external_import_name(node: ast.AST) -> list[str]:
    names: list[str] = []
    if isinstance(node, ast.Import):
        for alias in node.names:
            names.append(alias.name)
    elif isinstance(node, ast.ImportFrom):
        if node.level == 0 and node.module:
            names.append(node.module)
    return names


def assign_batch(rel: str) -> str:
    for batch in BATCHES:
        if rel in batch.exact:
            return batch.batch_id
        if any(rel.startswith(prefix) for prefix in batch.prefixes):
            return batch.batch_id
    return "B08-tests-examples-docs-infra"


def repo_files() -> list[Path]:
    files: list[Path] = []
    for path in sorted(REPO_ROOT.rglob("*")):
        if not path.is_file():
            continue
        if is_excluded(path):
            continue
        files.append(path)
    return files


def ensure_dirs() -> None:
    for path in (ANALYSIS_ROOT, MANIFESTS_ROOT, BATCHES_ROOT, REUSE_ROOT):
        path.mkdir(parents=True, exist_ok=True)


def build_inventory(files: list[Path]) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], dict[str, str]]:
    inventory: list[dict[str, Any]] = []
    inventory_by_path: dict[str, dict[str, Any]] = {}
    module_to_path: dict[str, str] = {}

    for path in files:
        rel = rel_path(path)
        batch_id = assign_batch(rel)
        kind = classify_kind(path)
        text = safe_read_text(path) if is_text_file(path, kind) else ""
        line_count = count_lines(text) if text else None
        module_name = module_name_for(rel)
        classes: list[str] = []
        functions: list[str] = []
        async_functions: list[str] = []
        entrypoint_markers: list[str] = []

        if module_name:
            module_to_path[module_name] = rel

        if rel.endswith(".py") and text:
            try:
                tree = ast.parse(text)
            except SyntaxError:
                tree = ast.parse(text, type_comments=True)
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    classes.append(node.name)
                elif isinstance(node, ast.FunctionDef):
                    functions.append(node.name)
                elif isinstance(node, ast.AsyncFunctionDef):
                    async_functions.append(node.name)
            if "if __name__ == \"__main__\":" in text or "if __name__ == '__main__':" in text:
                entrypoint_markers.append("__main__")
            if "typer.Typer(" in text or "Typer(" in text:
                entrypoint_markers.append("typer")
            if "fire.Fire(" in text or "Fire(" in text:
                entrypoint_markers.append("fire")
            if re.search(r"^\s*def main\(", text, re.MULTILINE):
                entrypoint_markers.append("main")

        record = {
            "path": rel,
            "top_level": top_level_bucket(rel),
            "kind": kind,
            "size_bytes": path.stat().st_size,
            "line_count": line_count,
            "batch_primary": batch_id,
            "is_python": rel.endswith(".py"),
            "is_text": bool(text),
            "module": module_name,
            "classes": classes,
            "functions": functions,
            "async_functions": async_functions,
            "entrypoint_markers": entrypoint_markers,
        }
        inventory.append(record)
        inventory_by_path[rel] = record
    return inventory, inventory_by_path, module_to_path


def build_import_graph(
    files: list[Path],
    inventory_by_path: dict[str, dict[str, Any]],
    module_to_path: dict[str, str],
) -> tuple[list[dict[str, Any]], Counter[str], Counter[str], dict[str, Counter[str]], dict[str, dict[str, list[str]]]]:
    edges: list[dict[str, Any]] = []
    inbound_counts: Counter[str] = Counter()
    outbound_counts: Counter[str] = Counter()
    batch_external_counts: dict[str, Counter[str]] = defaultdict(Counter)
    batch_external_files: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))

    for path in files:
        rel = rel_path(path)
        if not rel.endswith(".py"):
            continue
        text = safe_read_text(path)
        module_name = inventory_by_path[rel]["module"]
        if not module_name:
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            tree = ast.parse(text, type_comments=True)
        for node in ast.walk(tree):
            if not isinstance(node, (ast.Import, ast.ImportFrom)):
                continue
            lineno = getattr(node, "lineno", None)
            resolved_targets = resolve_import_target(node, module_name, rel, module_to_path)
            for target in resolved_targets:
                target_path = module_to_path[target]
                edge = {
                    "source_path": rel,
                    "source_module": module_name,
                    "target_module": target,
                    "target_path": target_path,
                    "edge_type": "internal",
                    "lineno": lineno,
                }
                edges.append(edge)
                inbound_counts[target_path] += 1
                outbound_counts[rel] += 1

            for ext_name in external_import_name(node):
                top_pkg = ext_name.split(".")[0]
                if top_pkg in {"metagpt", "tests", "examples"}:
                    continue
                edge = {
                    "source_path": rel,
                    "source_module": module_name,
                    "target_module": ext_name,
                    "target_path": None,
                    "edge_type": "external",
                    "lineno": lineno,
                    "top_package": top_pkg,
                }
                edges.append(edge)
                batch_id = inventory_by_path[rel]["batch_primary"]
                batch_external_counts[batch_id][top_pkg] += 1
                files_for_pkg = batch_external_files[batch_id][top_pkg]
                if rel not in files_for_pkg:
                    files_for_pkg.append(rel)
    return edges, inbound_counts, outbound_counts, batch_external_counts, batch_external_files


def source_records(inventory: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [record for record in inventory if record["kind"] in CODE_KINDS or record["kind"] == "docker"]


def largest_python_files(inventory: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    rows = [record for record in inventory if record["is_python"]]
    return sorted(rows, key=lambda item: (item["line_count"] or 0, item["path"]), reverse=True)[:limit]


def major_package_stats(inventory: list[dict[str, Any]]) -> list[dict[str, Any]]:
    roots = ["metagpt", "tests", "examples", "docs", "config", ".github", ".devcontainer"]
    output = []
    for root in roots:
        records = [record for record in inventory if record["path"] == root or record["path"].startswith(f"{root}/")]
        py_records = [record for record in records if record["is_python"]]
        output.append(
            {
                "path": root,
                "file_count": len(records),
                "python_file_count": len(py_records),
                "python_loc": sum(record["line_count"] or 0 for record in py_records),
            }
        )
    return output


def top_level_package_stats(inventory: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prefix = "metagpt/"
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in inventory:
        if not record["path"].startswith(prefix):
            continue
        parts = record["path"].split("/")
        if len(parts) < 2:
            continue
        groups[parts[1]].append(record)
    output = []
    for name, records in sorted(groups.items()):
        py_records = [record for record in records if record["is_python"]]
        output.append(
            {
                "name": name,
                "python_file_count": len(py_records),
                "python_loc": sum(record["line_count"] or 0 for record in py_records),
            }
        )
    return output


def batch_records(inventory: list[dict[str, Any]], batch_id: str) -> list[dict[str, Any]]:
    return [record for record in inventory if record["batch_primary"] == batch_id]


def format_file_line(path: str, inventory_by_path: dict[str, dict[str, Any]], inbound_counts: Counter[str]) -> str:
    record = inventory_by_path[path]
    symbol_text = symbol_summary(record)
    inbound = inbound_counts.get(path, 0)
    line_count = record["line_count"] or 0
    return f"- `{path}` [{line_count} lines, inbound_imports={inbound}] :: {symbol_text}"


def format_entrypoint_line(path: str) -> str:
    return f"- `{path}`"


def batch_external_deps_markdown(
    batch_id: str,
    batch_external_counts: dict[str, Counter[str]],
    batch_external_files: dict[str, dict[str, list[str]]],
) -> list[str]:
    counter = batch_external_counts.get(batch_id, Counter())
    if not counter:
        return ["- No Python external imports detected for this batch."]
    lines = []
    for package, count in counter.most_common(10):
        files = ", ".join(f"`{path}`" for path in batch_external_files[batch_id][package][:3])
        lines.append(f"- `{package}` [{count} imports] via {files}")
    return lines


def search_hub_lines(
    batch_id: str,
    inventory: list[dict[str, Any]],
    inbound_counts: Counter[str],
    limit: int = 5,
) -> list[str]:
    py_records = [record for record in batch_records(inventory, batch_id) if record["is_python"]]
    top_records = sorted(
        py_records,
        key=lambda record: (inbound_counts.get(record["path"], 0), record["line_count"] or 0),
        reverse=True,
    )[:limit]
    return [f"- `{record['path']}` [inbound_imports={inbound_counts.get(record['path'], 0)}]" for record in top_records]


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")


def build_batch_docs(
    inventory: list[dict[str, Any]],
    inventory_by_path: dict[str, dict[str, Any]],
    inbound_counts: Counter[str],
    batch_external_counts: dict[str, Counter[str]],
    batch_external_files: dict[str, dict[str, list[str]]],
) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for batch in BATCHES:
        records = batch_records(inventory, batch.batch_id)
        py_records = [record for record in records if record["is_python"]]
        key_paths: list[str] = []
        for path in batch.key_files:
            if path in inventory_by_path and path not in key_paths:
                key_paths.append(path)
        auto_top = sorted(
            py_records,
            key=lambda record: (inbound_counts.get(record["path"], 0), record["line_count"] or 0),
            reverse=True,
        )[:6]
        for record in auto_top:
            if record["path"] not in key_paths:
                key_paths.append(record["path"])
        key_paths = key_paths[:10]

        lines = [
            f"# {batch.title}",
            "",
            f"Batch ID: `{batch.batch_id}`",
            "",
            "## purpose",
            batch.purpose,
            "",
            "## entrypoints",
            *[format_entrypoint_line(item) for item in batch.entrypoints],
            "",
            "## key files",
            *[format_file_line(path, inventory_by_path, inbound_counts) for path in key_paths],
            "",
            "## data flow",
            *[f"- {line}" for line in batch.data_flow],
            "",
            "## external deps",
            *batch_external_deps_markdown(batch.batch_id, batch_external_counts, batch_external_files),
            "",
            "## flags/env",
            *[f"- {line}" for line in batch.flags_env],
            "",
            "## reusable ideas",
            *[f"- {line}" for line in batch.reusable_ideas],
            "",
            "## copy risk",
            *[f"- {line}" for line in batch.copy_risk],
            "",
            "## search hints",
            *[f"- `{line}`" for line in batch.search_hints],
            "",
            "## hubs",
            *search_hub_lines(batch.batch_id, inventory, inbound_counts),
            "",
        ]
        output_path = BATCHES_ROOT / f"{batch.slug}.md"
        output_path.write_text("\n".join(lines), encoding="utf-8")
        summaries.append(
            {
                "batch_id": batch.batch_id,
                "slug": batch.slug,
                "title": batch.title,
                "path": f"analysis/batches/{batch.slug}.md",
                "file_count": len(records),
                "python_file_count": len(py_records),
                "python_loc": sum(record["line_count"] or 0 for record in py_records),
                "depth_rank": batch.depth_rank,
            }
        )
    return summaries


def build_domain_map(inventory: list[dict[str, Any]], batch_summaries: list[dict[str, Any]]) -> dict[str, Any]:
    source = source_records(inventory)
    file_to_batch = {record["path"]: record["batch_primary"] for record in inventory}
    return {
        "generated_at": now_iso(),
        "repo_root": normalize(REPO_ROOT),
        "batch_summaries": batch_summaries,
        "file_to_batch": file_to_batch,
        "source_file_count": len(source),
        "covered_source_file_count": sum(1 for record in source if record["path"] in file_to_batch),
        "unassigned_source_files": sorted(record["path"] for record in source if record["path"] not in file_to_batch),
    }


def build_system_summary(
    inventory: list[dict[str, Any]],
    inbound_counts: Counter[str],
    outbound_counts: Counter[str],
    batch_summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    source = source_records(inventory)
    top_inbound = sorted(
        (
            {
                "path": record["path"],
                "inbound_imports": inbound_counts.get(record["path"], 0),
                "line_count": record["line_count"],
            }
            for record in inventory
            if record["is_python"]
        ),
        key=lambda item: (item["inbound_imports"], item["line_count"] or 0),
        reverse=True,
    )[:25]
    top_outbound = sorted(
        (
            {
                "path": record["path"],
                "outbound_imports": outbound_counts.get(record["path"], 0),
                "line_count": record["line_count"],
            }
            for record in inventory
            if record["is_python"]
        ),
        key=lambda item: (item["outbound_imports"], item["line_count"] or 0),
        reverse=True,
    )[:25]
    return {
        "generated_at": now_iso(),
        "repo_root": normalize(REPO_ROOT),
        "primary_language": "Python",
        "estimated_python_loc": sum(record["line_count"] or 0 for record in inventory if record["is_python"]),
        "inventory_file_count": len(inventory),
        "source_file_count": len(source),
        "package_overview": major_package_stats(inventory),
        "metagpt_subpackage_overview": top_level_package_stats(inventory),
        "top_inbound_python_files": top_inbound,
        "top_outbound_python_files": top_outbound,
        "largest_python_files": [
            {"path": record["path"], "line_count": record["line_count"]} for record in largest_python_files(inventory)
        ],
        "entrypoints": [
            {
                "type": "console_script",
                "name": "metagpt",
                "target": "metagpt.software_company:app",
                "source": "setup.py",
            },
            {
                "type": "library_api",
                "name": "generate_repo",
                "target": "metagpt/software_company.py::generate_repo",
                "source": "metagpt/software_company.py",
            },
            {
                "type": "role_entry",
                "name": "Role.run",
                "target": "metagpt/roles/role.py::Role.run",
                "source": "metagpt/roles/role.py",
            },
            {
                "type": "rag_entry",
                "name": "SimpleEngine.from_docs",
                "target": "metagpt/rag/engines/simple.py::SimpleEngine.from_docs",
                "source": "metagpt/rag/engines/simple.py",
            },
        ],
        "surface_presence": {
            "tests": any(record["path"].startswith("tests/") for record in inventory),
            "docs": any(record["path"].startswith("docs/") for record in inventory),
            "examples": any(record["path"].startswith("examples/") for record in inventory),
            "config": any(record["path"].startswith("config/") for record in inventory),
            "docker": any(record["path"] == "Dockerfile" for record in inventory),
            "ci": any(record["path"].startswith(".github/workflows/") for record in inventory),
            "devcontainer": any(record["path"].startswith(".devcontainer/") for record in inventory),
        },
        "batch_summaries": batch_summaries,
    }


def build_reuse_candidates() -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    label_map = {
        "copy_as_is": "Copy as-is",
        "copy_with_adaptation": "Copy with adaptation",
        "rewrite": "Rewrite or re-derive",
    }
    for feature in sorted(FEATURES, key=lambda item: (-item["reuse_score"], item["name"])):
        grouped[label_map[feature["copy_advice"]]].append(feature)

    lines = [
        "# Reuse Candidates",
        "",
        "This shortlist is intentionally opinionated. Scores favor practical reuse, not just architectural importance.",
        "",
    ]
    for section in ("Copy as-is", "Copy with adaptation", "Rewrite or re-derive"):
        lines.extend([f"## {section}", ""])
        for feature in grouped.get(section, []):
            paths = ", ".join(f"`{path}`" for path in feature["paths"])
            deps = ", ".join(f"`{dep}`" for dep in feature["dependencies"])
            lines.append(f"### {feature['name']} (`{feature['feature_id']}`)")
            lines.append(f"- Summary: {feature['summary']}")
            lines.append(f"- Paths: {paths}")
            lines.append(f"- Reuse score: `{feature['reuse_score']}`")
            lines.append(f"- Coupling: `{feature['coupling']}`")
            lines.append(f"- Dependencies: {deps}")
            lines.append(f"- Keywords: {', '.join(feature['keywords'])}")
            lines.append("")
    return "\n".join(lines)


def build_index(
    batch_summaries: list[dict[str, Any]],
    system_summary: dict[str, Any],
    domain_map: dict[str, Any],
) -> str:
    top_modules = system_summary["top_inbound_python_files"][:10]
    lines = [
        "# MetaGPT Analysis Index",
        "",
        f"Generated at: `{system_summary['generated_at']}`",
        "",
        "## Repo shape",
        "",
        "- Primary language: `Python`",
        "- Package root: `metagpt/`",
        f"- Python LOC under repo: `{system_summary['estimated_python_loc']}`",
        f"- Inventory files scanned (excluding analysis/): `{system_summary['inventory_file_count']}`",
        f"- Source-like files covered by domain map: `{domain_map['covered_source_file_count']}` / `{domain_map['source_file_count']}`",
        "- Major surfaces present: tests, docs, examples, config, Docker, CI, devcontainer",
        "",
        "## Fast navigation",
        "",
        "- Runtime core starts at `metagpt/config2.py`, `metagpt/context.py`, `metagpt/schema.py`.",
        "- Team orchestration starts at `metagpt/software_company.py`, `metagpt/team.py`, `metagpt/roles/role.py`.",
        "- Action/SOP logic starts at `metagpt/actions/` and `metagpt/strategy/planner.py`.",
        "- LLM abstraction starts at `metagpt/provider/base_llm.py` and `metagpt/provider/llm_provider_registry.py`.",
        "- Tools and execution helpers start at `metagpt/tools/tool_registry.py`, `metagpt/tools/search_engine.py`, `metagpt/utils/project_repo.py`.",
        "- Retrieval stack starts at `metagpt/rag/engines/simple.py`, `metagpt/rag/factories/retriever.py`, `metagpt/exp_pool/decorator.py`.",
        "- Domain-specific environments/extensions start at `metagpt/environment/` and `metagpt/ext/`.",
        "",
        "## Proposed batches",
        "",
    ]
    for batch in sorted(batch_summaries, key=lambda item: item["depth_rank"]):
        lines.append(
            f"- `{batch['batch_id']}` -> `analysis/batches/{batch['slug']}.md` "
            f"[files={batch['file_count']}, py_files={batch['python_file_count']}, py_loc={batch['python_loc']}]"
        )
    lines.extend(["", "## Highest-value hubs", ""])
    for item in top_modules:
        lines.append(f"- `{item['path']}` [inbound_imports={item['inbound_imports']}, lines={item['line_count']}]")
    lines.extend(
        [
            "",
            "## Manifests",
            "",
            "- `analysis/manifests/file_inventory.jsonl` -> one record per scanned file with kind, size, lines, symbols, and primary batch.",
            "- `analysis/manifests/import_graph.jsonl` -> import edges for Python files with internal vs external classification.",
            "- `analysis/manifests/feature_catalog.jsonl` -> shortlist of reusable features with reuse score and coupling.",
            "- `analysis/manifests/domain_map.json` -> batch assignment for every scanned file plus coverage counts.",
            "- `analysis/manifests/system_summary.json` -> repo-wide counts, entrypoints, hubs, and batch stats.",
            "",
            "## Recommended deep-dive order",
            "",
        ]
    )
    for batch in sorted(batch_summaries, key=lambda item: item["depth_rank"]):
        lines.append(f"{batch['depth_rank']}. `{batch['batch_id']}`")
    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- This map is code-first. Docs and README files are indexed, but architectural claims were anchored in `metagpt/*` and the executable surfaces.",
            "- `pytest.ini` ignores many expensive integration paths; treat that file as part of the risk map when choosing what to trust as well-covered.",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    ensure_dirs()
    files = repo_files()
    inventory, inventory_by_path, module_to_path = build_inventory(files)
    edges, inbound_counts, outbound_counts, batch_external_counts, batch_external_files = build_import_graph(
        files, inventory_by_path, module_to_path
    )
    batch_summaries = build_batch_docs(
        inventory,
        inventory_by_path,
        inbound_counts,
        batch_external_counts,
        batch_external_files,
    )
    domain_map = build_domain_map(inventory, batch_summaries)
    system_summary = build_system_summary(inventory, inbound_counts, outbound_counts, batch_summaries)

    write_jsonl(MANIFESTS_ROOT / "file_inventory.jsonl", inventory)
    write_jsonl(MANIFESTS_ROOT / "import_graph.jsonl", edges)
    write_jsonl(MANIFESTS_ROOT / "feature_catalog.jsonl", FEATURES)
    write_json(MANIFESTS_ROOT / "domain_map.json", domain_map)
    write_json(MANIFESTS_ROOT / "system_summary.json", system_summary)

    (REUSE_ROOT / "reuse-candidates.md").write_text(build_reuse_candidates(), encoding="utf-8")
    (ANALYSIS_ROOT / "index.md").write_text(build_index(batch_summaries, system_summary, domain_map), encoding="utf-8")

    print("Analysis artifacts generated:")
    print(f"- {normalize(ANALYSIS_ROOT / 'index.md')}")
    print(f"- {normalize(MANIFESTS_ROOT / 'file_inventory.jsonl')}")
    print(f"- {normalize(MANIFESTS_ROOT / 'import_graph.jsonl')}")
    print(f"- {normalize(MANIFESTS_ROOT / 'feature_catalog.jsonl')}")
    print(f"- {normalize(MANIFESTS_ROOT / 'domain_map.json')}")
    print(f"- {normalize(MANIFESTS_ROOT / 'system_summary.json')}")
    print(f"- {normalize(REUSE_ROOT / 'reuse-candidates.md')}")


if __name__ == "__main__":
    main()
