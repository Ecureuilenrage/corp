# Tools / Utils / Execution Helpers

Batch ID: `B05-tools-utils-execution`

## purpose
Tool registration, search/browser adapters, guarded file editing, project/repo abstractions, reporting callbacks, and the large utility layer that many other batches quietly depend on.

This batch contains both clean extraction candidates and the biggest "do not copy blindly" zones in the repo. The difference is whether a module is a focused adapter or part of `metagpt/utils/common.py` style sprawl.

## subdomains
- `tool schema registry`
  - `metagpt/tools/tool_registry.py::{ToolRegistry,register_tool}`
- `search + browser adapters`
  - `metagpt/tools/search_engine.py::SearchEngine`
  - `metagpt/tools/web_browser_engine.py::WebBrowserEngine`
- `guarded file editing`
  - `metagpt/tools/libs/editor.py::Editor`
- `project workspace abstraction`
  - `metagpt/utils/project_repo.py::{DocFileRepositories,ResourceFileRepositories,ProjectRepo}`
- `git + remote workflow abstraction`
  - `metagpt/utils/git_repository.py::{GitRepository,GitBranch,ChangeType}`
- `reporting callback bus`
  - `metagpt/utils/report.py::{ResourceReporter,TerminalReporter,BrowserReporter,NotebookReporter,DocsReporter,EditorReporter}`
- `general utility grab bag`
  - `metagpt/utils/common.py::*`

## entrypoints
- `metagpt/tools/tool_registry.py::register_tool`
- `metagpt/tools/tool_registry.py::validate_tool_names`
- `metagpt/tools/search_engine.py::SearchEngine.run`
- `metagpt/tools/web_browser_engine.py::WebBrowserEngine.run`
- `metagpt/tools/libs/editor.py::Editor.open_file`
- `metagpt/tools/libs/editor.py::Editor.edit_file_by_replace`
- `metagpt/tools/libs/editor.py::Editor.insert_content_at_line`
- `metagpt/utils/project_repo.py::ProjectRepo`
- `metagpt/utils/git_repository.py::GitRepository`
- `metagpt/utils/report.py::ResourceReporter.async_report`

## key files
- `metagpt/tools/tool_registry.py` [194 lines, inbound_imports=34]
  - global registry + decorators + dynamic schema extraction
- `metagpt/tools/search_engine.py` [145 lines, inbound_imports=9]
  - async adapter over multiple search backends
- `metagpt/tools/web_browser_engine.py` [119 lines, inbound_imports=3]
  - async adapter over playwright / selenium / custom browser wrappers
- `metagpt/tools/libs/editor.py` [1139 lines, inbound_imports=5]
  - file-reading/editing tool with rollback-on-lint-error behavior
- `metagpt/utils/project_repo.py` [163 lines, inbound_imports=17]
  - repo-level directory contract over docs/resources/tests/srcs
- `metagpt/utils/git_repository.py` [633 lines, inbound_imports=14]
  - GitPython + PyGithub wrapper used by multiple flows
- `metagpt/utils/report.py` [330 lines, inbound_imports=21]
  - callback/report transport for editor/browser/notebook/docs/terminal blocks
- `metagpt/utils/common.py` [1243 lines, inbound_imports=143]
  - broad cross-cutting helper bag and major coupling hub

## data flow
- Tool classes/functions decorated with `@register_tool(...)` register themselves in `TOOL_REGISTRY`.
- Roles such as `RoleZero` later resolve tool names/tags/paths through `validate_tool_names()`.
- `SearchEngine` and `WebBrowserEngine` dynamically import backend wrappers based on config enums.
- `Editor` acts as a callable file-surgery tool and reports activity through `EditorReporter`.
- `ProjectRepo` wraps a `GitRepository` and exposes stable file repositories for docs/resources/tests/srcs.
- `GitRepository` handles local repo init/archive/push/clone and remote issue/PR helpers.
- `ResourceReporter` and subclasses stream side-channel observations to UI/server callbacks.

## feature inventory
- `ToolRegistry core`
  - kind: `tool runtime`
  - files: `metagpt/tools/tool_registry.py`
  - symbols: `ToolRegistry.register_tool`, `ToolRegistry.get_tool`, `ToolRegistry.get_tools_by_tag`, `register_tool`, `make_schema`, `validate_tool_names`, `register_tools_from_file`, `register_tools_from_path`
  - reuse: `copiable avec adaptation`
- `Search engine adapter`
  - kind: `provider adapter`
  - files: `metagpt/tools/search_engine.py`
  - symbols: `SearchEngine.from_search_config`, `SearchEngine.from_search_func`, `SearchEngine.run`, `_process_extra`
  - reuse: `copiable avec adaptation`
- `Web browser adapter`
  - kind: `provider adapter`
  - files: `metagpt/tools/web_browser_engine.py`
  - symbols: `WebBrowserEngine.from_browser_config`, `WebBrowserEngine.run`, `_process_extra`
  - reuse: `copiable avec adaptation`
- `Editor guarded patch kernel`
  - kind: `tool runtime`
  - files: `metagpt/tools/libs/editor.py`
  - symbols: `Editor.open_file`, `Editor.goto_line`, `Editor.edit_file_by_replace`, `Editor.insert_content_at_line`, `Editor.append_file`, `Editor.search_dir`, `Editor.search_file`, `Editor.find_file`, `Editor.similarity_search`, `_edit_file_impl`
  - reuse: `copiable avec adaptation`
- `ProjectRepo workspace contract`
  - kind: `glue runtime`
  - files: `metagpt/utils/project_repo.py`
  - symbols: `DocFileRepositories`, `ResourceFileRepositories`, `ProjectRepo.code_files_exists`, `ProjectRepo.with_src_path`, `ProjectRepo.search_project_path`
  - reuse: `copiable avec adaptation`
- `GitRepository abstraction`
  - kind: `tool runtime`
  - files: `metagpt/utils/git_repository.py`
  - symbols: `GitRepository.open`, `_init`, `changed_files`, `archive`, `push`, `clone_from`, `create_pull`, `create_issue`, `get_repos`, `create_github_pull_url`
  - reuse: `copiable avec adaptation`
- `Reporter callback bus`
  - kind: `tooling glue`
  - files: `metagpt/utils/report.py`
  - symbols: `ResourceReporter.report`, `ResourceReporter.async_report`, `_format_data`, `__aenter__`, `__aexit__`, `_llm_stream_report`, `TerminalReporter`, `BrowserReporter`, `NotebookReporter`, `DocsReporter`, `EditorReporter`
  - reuse: `copiable avec adaptation`
- `Common helper bag`
  - kind: `glue`
  - files: `metagpt/utils/common.py`
  - symbols: `OutputParser`, `CodeParser`, `get_function_schema`, `serialize_decorator`, `aread`, `awrite`, `import_class`, `extract_and_encode_images`, `get_markdown_code_block_type`, `save_json_to_markdown`, `download_model`
  - reuse: mixed; small functions `copiable tel quel`, whole module `a reecrire`

## symbol map
- tool registry
  - `metagpt/tools/tool_registry.py::{ToolRegistry,register_tool,make_schema,validate_tool_names,register_tools_from_file,register_tools_from_path,TOOL_REGISTRY}`
- adapters
  - `metagpt/tools/search_engine.py::{SearchEngine,_process_extra,from_search_config,from_search_func,run}`
  - `metagpt/tools/web_browser_engine.py::{WebBrowserEngine,_process_extra,from_browser_config,run}`
- editor
  - `metagpt/tools/libs/editor.py::{FileBlock,LineNumberError,Editor}`
  - `metagpt/tools/libs/editor.py::{open_file,goto_line,scroll_down,scroll_up,create_file,edit_file_by_replace,insert_content_at_line,append_file,search_dir,search_file,find_file,similarity_search,_edit_file_impl}`
- repo abstractions
  - `metagpt/utils/project_repo.py::{DocFileRepositories,ResourceFileRepositories,ProjectRepo}`
  - `metagpt/utils/git_repository.py::{ChangeType,RateLimitError,GitBranch,GitRepository}`
- reporters
  - `metagpt/utils/report.py::{BlockType,ResourceReporter,TerminalReporter,BrowserReporter,ServerReporter,ObjectReporter,NotebookReporter,DocsReporter,EditorReporter,GalleryReporter}`

## dependency map
- import pressure by batch from B05 code
  - `B05-tools-utils-execution`: `125`
  - `B01-core-runtime-config`: `81`
  - `B06-rag-doc-knowledge`: `6`
  - `B03-actions-planning-prompts`: `5`
  - `B07-environments-extensions`: `4`
  - `B04-llm-provider-layer`: `3`
  - `B02-agent-orchestration`: `2`
- hard blockers for extracting `ToolRegistry`
  - `metagpt/tools/tool_convert.py`
  - `metagpt/tools/tool_data_type.py`
  - `metagpt/const.py`
- hard blockers for extracting `Editor`
  - `metagpt/tools/libs/linter.py`
  - `metagpt/utils/file.py`
  - `metagpt/utils/report.py::EditorReporter`
  - optional `metagpt/tools/libs/index_repo.py` for similarity search
- hard blockers for extracting `ProjectRepo`
  - `metagpt/utils/file_repository.py`
  - `metagpt/utils/git_repository.py`
  - many path constants in `metagpt/const.py`
- hard blockers for extracting `GitRepository`
  - `gitpython`
  - `PyGithub`
  - `gitignore_parser`
  - `metagpt/tools/libs/shell.py`
  - `metagpt/context.py`
- hard blockers for extracting `Reporter`
  - `aiohttp`
  - `playwright` types for browser reporters
  - `metagpt/logs.py` queue helpers

## extraction recipes
- extract schema-driven tool registration
  - read first: `metagpt/tools/tool_registry.py`
  - keep: global registry, decorator, name/tag/path validation
  - replace: tool schema generation if your callable schema format differs
  - advice: `copiable avec adaptation`
- extract search/browser adapter shells
  - read first: `metagpt/tools/search_engine.py`, `metagpt/tools/web_browser_engine.py`
  - keep: dynamic import + unified async `run()`
  - replace: backend wrapper module names and config enums
  - advice: `copiable avec adaptation`
- extract a guarded file editor
  - read first: `metagpt/tools/libs/editor.py`
  - keep: `_edit_file_impl`, rollback-on-lint-error behavior, search helpers
  - replace: linter integration and reporter if unnecessary
  - advice: `copiable avec adaptation`
- extract project workspace contract
  - read first: `metagpt/utils/project_repo.py`, then `metagpt/utils/file_repository.py`
  - keep: repo subtrees for docs/resources/tests/srcs
  - replace: MetaGPT-specific path constants
  - advice: `copiable avec adaptation`
- extract reporter callback bus
  - read first: `metagpt/utils/report.py`
  - keep: `ResourceReporter` and needed subclasses only
  - advice: `copiable avec adaptation`

## do not copy blindly
- `register_tool()` depends on import-time side effects. If the module never imports, the tool never exists in the registry.
- `validate_tool_names()` accepts tool names, tags, file paths, and directories; this is convenient but broadens the attack surface in an extracted system.
- `Editor.write()` is a blunt full-file overwrite. The safer logic lives in `_edit_file_impl()`.
- `Editor._edit_file_impl()` uses temp files, optional lint rollback, and window rendering together. Copying only the user-facing methods without this core function loses the main safety property.
- `ProjectRepo` auto-constructs a `GitRepository` from a plain path, which may initialize a git repo if none exists.
- `GitRepository.archive()` mutates the repository by staging and committing all tracked changes.
- `GitRepository.push()` and `clone_from()` pull proxy and environment settings from `Context()`, so the class is less self-contained than it first appears.
- `ResourceReporter._format_data()` attaches current role metadata and absolutizes file paths; this is transport logic, not just formatting.
- `metagpt/utils/common.py` is a major coupling hub. Prefer extracting single helpers, not the full module.

## minimal reusable slices
- `Tool registry core`
  - files: `metagpt/tools/tool_registry.py`
  - verdict: `copiable avec adaptation`
- `Search / browser adapter shells`
  - files: `metagpt/tools/search_engine.py`, `metagpt/tools/web_browser_engine.py`
  - verdict: `copiable avec adaptation`
- `Editor guarded patch kernel`
  - files: `metagpt/tools/libs/editor.py`
  - keep: `_edit_file_impl`, `edit_file_by_replace`, `insert_content_at_line`, `append_file`
  - verdict: `copiable avec adaptation`
- `ProjectRepo workspace contract`
  - files: `metagpt/utils/project_repo.py`, `metagpt/utils/file_repository.py`
  - verdict: `copiable avec adaptation`
- `Reporter callback bus`
  - files: `metagpt/utils/report.py`
  - verdict: `copiable avec adaptation`
- `Utility grab-bag`
  - files: `metagpt/utils/common.py`
  - verdict: `a reecrire` as a module, extract function-by-function only

## executable docs / tests
- `tests/metagpt/tools/test_tool_registry.py`
- `tests/metagpt/tools/test_search_engine.py`
- `tests/metagpt/tools/test_web_browser_engine.py`
- `tests/metagpt/tools/libs/test_editor.py`
- `tests/metagpt/utils/test_project_repo.py`
- `tests/metagpt/utils/test_git_repository.py`
- `tests/metagpt/test_reporter.py`

These are strong reverse-engineering aids even when many are skipped in the default `pytest.ini` run.

## external deps
- focused deps
  - `pydantic`
  - `inspect`
  - `aiohttp`
  - `playwright`
- repo/integration deps
  - `gitpython`
  - `PyGithub`
  - `gitignore_parser`
- optional search/browser backends
  - Serper / SerpAPI / Google API / DDG wrappers

## flags/env
- `TOOL_SCHEMA_PATH`
- `config.search.*`
- `config.browser.*`
- `ENABLE_AUTO_LINT` style behavior through `Editor.enable_auto_lint`
- `METAGPT_REPORTER_DEFAULT_URL`
- `METAGPT_ROLE`

## exact search shortcuts
- `rg -n "class (ToolRegistry|SearchEngine|WebBrowserEngine|Editor|ProjectRepo|GitRepository|ResourceReporter)" metagpt/tools metagpt/utils`
- `rg -n "def (register_tool|validate_tool_names|run|edit_file_by_replace|_edit_file_impl|archive|push|async_report)" metagpt/tools metagpt/utils`
- `rg -n "OutputParser|CodeParser|serialize_decorator|import_class|get_function_schema" metagpt/utils/common.py`

## hubs
- `metagpt/utils/common.py` [inbound_imports=143]
- `metagpt/tools/tool_registry.py` [inbound_imports=34]
- `metagpt/utils/report.py` [inbound_imports=21]
- `metagpt/utils/project_repo.py` [inbound_imports=17]
- `metagpt/utils/git_repository.py` [inbound_imports=14]
