# 05-function-tooling-and-mcp - Functions, Tool Catalog, MCP

_Primary coverage_: 12 fichiers, 2975 lignes approx. dans ce batch.

## purpose
Porter la surface de tools executable par les agents: chargement dynamique de fonctions Python, generation de schemas JSON pour function calling, suite workspace/file tools, outils `uv`, outils web/research et exemple MCP.

## subdomains
- coeur runtime tooling: `utils/function_manager.py`, `utils/function_catalog.py`.
- functions locales workspace / coding: `functions/function_calling/file.py`, `functions/function_calling/code_executor.py`, `functions/function_calling/uv_related.py`.
- functions web / research / utilities: `functions/function_calling/web.py`, `functions/function_calling/deep_research.py`, `functions/function_calling/weather.py`, `functions/function_calling/video.py`, `functions/function_calling/utils.py`, `functions/function_calling/user.py`.
- bridge agent runtime touche par couplage: `runtime/node/agent/tool/tool_manager.py`, `entity/configs/node/tooling.py`, `entity/tool_spec.py`.
- MCP example / docs executables: `mcp_example/mcp_server.py`, `yaml_instance/demo_mcp.yaml`, `docs/user_guide/en/modules/tooling/*.md`.
- frontend Vue: aucune dependance directe.
- tests / docs / infra: pas de tests dedies; la verification passe surtout par les YAML d'exemple et l'integration dans `AgentNodeExecutor`.

## entrypoints
- `utils/function_manager.py` - `FunctionManager.load_functions`, `get_function_manager` - charge dynamiquement un repertoire de fonctions.
- `utils/function_catalog.py` - `FunctionCatalog`, `get_function_catalog` - derive les schemas JSON depuis les signatures Python.
- `functions/function_calling/file.py` - `FileToolContext`, `describe_available_files`, `apply_text_edits`, `search_in_files` - suite workspace la plus reutilisable.
- `functions/function_calling/uv_related.py` - `WorkspaceCommandContext`, `install_python_packages`, `init_python_env`, `uv_run` - runner shell Python borne.
- `mcp_example/mcp_server.py` - `FastMCP`, `rand_num` - exemple minimal de serveur MCP local.

## key files
- `utils/function_manager.py` - `FunctionManager` - coeur du chargement dynamique par introspection de fichiers `.py`.
- `utils/function_catalog.py` - `FunctionCatalog`, `FunctionMetadata`, `_build_function_metadata` - generation du schema provider-agnostic.
- `functions/function_calling/file.py` - `FileToolContext`, `TextEdit`, `apply_text_edits`, `search_in_files` - vraie suite de reuse pour agent coding.
- `functions/function_calling/uv_related.py` - `WorkspaceCommandContext`, `_run_uv_command`, `uv_run` - execution d'outils Python sous `uv`.
- `functions/function_calling/deep_research.py` - `search_*`, `report_*` - suite metier pour accumuler des resultats et manipuler un rapport en chapitres.
- `functions/function_calling/web.py` - `web_search`, `read_webpage_content` - outils de recherche et lecture web.
- `mcp_example/mcp_server.py` - `mcp.tool`, `rand_num` - smoke test minimal.

## feature inventory
- `tools.function_json_schema_catalog`: coeur runtime tooling. Fichiers `utils/function_catalog.py`, `utils/function_manager.py`. Symboles centraux `FunctionCatalog.refresh`, `FunctionCatalog.iter_modules`, `get_function_catalog`, `_build_function_metadata`, `_build_parameters_schema`, `_annotation_to_schema`. Statut reuse: copiable avec adaptation faible.
- `tools.workspace_file_suite`: workspace tooling. Fichiers `functions/function_calling/file.py`, `utils/attachments.py`. Symboles centraux `FileToolContext`, `describe_available_files`, `load_file`, `save_file`, `read_text_file_snippet`, `read_file_segment`, `TextEdit`, `apply_text_edits`, `rename_path`, `copy_path`, `move_path`, `search_in_files`. Statut reuse: copiable tel quel a adaptation faible.
- `tools.workspace_command_runner`: execution borne. Fichiers `functions/function_calling/uv_related.py`, `functions/function_calling/code_executor.py`. Symboles centraux `WorkspaceCommandContext`, `_run_uv_command`, `install_python_packages`, `init_python_env`, `uv_run`, `execute_code`. Statut reuse: copiable avec adaptation et revue securite.
- `tools.deep_research_report_suite`: outils metier research. Fichiers `functions/function_calling/deep_research.py`, `functions/function_calling/web.py`. Symboles centraux `search_save_result`, `search_load_all`, `search_load_by_url`, `search_high_light_key`, `report_outline`, `report_create_chapter`, `report_rewrite_chapter`, `report_continue_chapter`, `report_export_pdf`. Statut reuse: copiable avec adaptation.
- `tools.web_fetch_suite`: web helper. Fichiers `functions/function_calling/web.py`. Symboles centraux `web_search`, `read_webpage_content`. Statut reuse: copiable avec adaptation.
- `tools.mcp_smoke_server`: exemple MCP. Fichiers `mcp_example/mcp_server.py`. Symboles centraux `FastMCP`, `rand_num`. Statut reuse: copiable tel quel.
- `agent.mcp_tool_bridge`: couplage vers agent runtime. Fichiers `runtime/node/agent/tool/tool_manager.py`, `entity/configs/node/tooling.py`, `mcp_example/mcp_server.py`. Symboles centraux `ToolManager.get_tool_specs`, `ToolManager.execute_tool`, `_build_mcp_remote_specs`, `_build_mcp_local_specs`. Statut reuse: copiable avec adaptation.

## data flow
1. `utils/function_manager.py::FunctionManager.load_functions` parcourt le repertoire cible, importe chaque fichier `.py` et enregistre les fonctions publiques.
2. `utils/function_catalog.py::FunctionCatalog.refresh` reutilise ce manager, inspecte chaque callable, derive `description`, `parameters_schema`, `module_name` et `file_path`.
3. `entity/configs/node/tooling.py::FunctionToolEntryConfig.field_specs` expose ces fonctions a la couche schema/backend/frontend.
4. `runtime/node/agent/tool/tool_manager.py::ToolManager.get_tool_specs` transforme les configs `function`, `mcp_remote` ou `mcp_local` en `ToolSpec`.
5. Lorsqu'un agent appelle un tool, `ToolManager.execute_tool` dispatch vers `_execute_function_tool`, `_execute_mcp_remote_tool` ou `_execute_mcp_local_tool`.
6. Les outils fichier et `uv` reçoivent souvent un contexte workspace via `_context`, materialise par `FileToolContext` ou `WorkspaceCommandContext`.
7. Les resultats MCP peuvent etre normalises en `MessageBlock` et pieces jointes par `ToolManager._convert_mcp_content_to_blocks`.

## symbol map
- `utils/function_manager.py`: `_resolve_dir`, `FUNCTION_CALLING_DIR`, `EDGE_FUNCTION_DIR`, `EDGE_PROCESSOR_FUNCTION_DIR`, `FunctionManager`, `FunctionManager.load_functions`, `FunctionManager.get_function`, `FunctionManager.list_functions`, `FunctionManager.reload_functions`, `get_function_manager`.
- `utils/function_catalog.py`: `ParamMeta`, `FunctionMetadata`, `FunctionCatalog`, `FunctionCatalog.refresh`, `FunctionCatalog.iter_modules`, `FunctionCatalog.functions_for_module`, `get_function_catalog`, `_build_function_metadata`, `_extract_description`, `_build_parameters_schema`, `_annotation_to_schema`.
- `functions/function_calling/file.py`: `FileToolContext`, `_check_attachments_not_modified`, `describe_available_files`, `list_directory`, `create_folder`, `delete_path`, `load_file`, `save_file`, `read_text_file_snippet`, `read_file_segment`, `TextEdit`, `apply_text_edits`, `rename_path`, `copy_path`, `move_path`, `search_in_files`.
- `functions/function_calling/uv_related.py`: `_trim_output_preview`, `_build_timeout_message`, `WorkspaceCommandContext`, `_validate_packages`, `_coerce_timeout_seconds`, `_run_uv_command`, `install_python_packages`, `init_python_env`, `uv_run`.
- `functions/function_calling/deep_research.py`: `_get_files`, `_get_locks`, `search_save_result`, `search_load_all`, `search_load_by_url`, `search_high_light_key`, `report_read`, `report_read_chapter`, `report_outline`, `report_create_chapter`, `report_rewrite_chapter`, `report_continue_chapter`, `report_reorder_chapters`, `report_del_chapter`, `report_export_pdf`.
- `functions/function_calling/web.py`: `web_search`, `read_webpage_content`.
- `functions/function_calling/code_executor.py`: `execute_code`.
- `functions/function_calling/video.py`: `_get_class_names`, `render_manim`, `concat_videos`.
- `functions/function_calling/weather.py`: `get_city_num`, `get_weather`.
- `functions/function_calling/user.py`: `call_user`.
- `functions/function_calling/utils.py`: `wait`, `get_current_time`.
- `mcp_example/mcp_server.py`: `mcp`, `rand_num`.

## dependency map
- hard blocker - function loader contract: `utils/function_manager.py`. Sans lui, `FunctionCatalog` et `ToolManager` ne savent plus charger de functions locales.
- hard blocker - tool schema contract: `entity/tool_spec.py`, `entity/configs/node/tooling.py`, `runtime/node/agent/tool/tool_manager.py`. Requis si l'on veut brancher ces functions dans le runtime agent.
- medium blocker - workspace context: `functions/function_calling/file.py` et `uv_related.py` supposent un `_context` avec workspace, attachments et permissions implicites.
- medium blocker - attachments safety: `functions/function_calling/file.py::_check_attachments_not_modified` depend de `utils/attachments.py` et des conventions d'attachments ChatDev.
- medium blocker - MCP libs: `fastmcp`, `mcp`, et les transports HTTP/stdio. Sans eux, seule la partie function locale reste utile.
- medium blocker - web/research API keys: `SERPER_DEV_API_KEY`, `JINA_API_KEY`, `TEMP_CODE_DIR`, `LIB_INSTALL_TIMEOUT`.
- inbound adapters utiles a lire avant extraction: `runtime/node/agent/tool/tool_manager.py`, `entity/configs/node/tooling.py`, `yaml_instance/demo_function_call.yaml`, `yaml_instance/demo_mcp.yaml`.

## external deps
- `fastmcp`, `mcp` pour MCP.
- `ddgs`, `beautifulsoup4`, `requests` / ecosysteme web pour les outils web.
- `xhtml2pdf` pour `report_export_pdf`.
- `uv` doit etre disponible pour `uv_run` et `install_python_packages`.

## flags/env
- `MAC_FUNCTIONS_DIR`, `MAC_EDGE_FUNCTIONS_DIR`, `MAC_EDGE_PROCESSOR_FUNCTIONS_DIR` reroutent les repertoires de fonctions.
- `SERPER_DEV_API_KEY`, `JINA_API_KEY` pilotent `web_search` et `read_webpage_content`.
- `LIB_INSTALL_TIMEOUT` pilote la securisation des installs `uv`.
- `TEMP_CODE_DIR` pilote `execute_code`.

## reusable ideas
- `FunctionCatalog` est une tres bonne brique autonome pour transformer des callables Python en schemas de function calling.
- `FileToolContext` + `apply_text_edits` + `search_in_files` constituent probablement la meilleure extraction immediate de ce batch.
- `deep_research.py` montre un pattern utile: tools stateful sur fichiers + verrous, sans base de donnees.

## extraction recipes
1. Extraire uniquement le catalogue JSON-schema des functions.
   Fichiers a prendre d'abord: `utils/function_catalog.py`, `utils/function_manager.py`.
   Dependances minimales: repertoire de functions Python.
   Strategie: copier presque tel quel.

2. Extraire la suite workspace fichier.
   Fichiers a prendre d'abord: `functions/function_calling/file.py`.
   Dependances minimales: `FileToolContext`, eventuellement `AttachmentStore`.
   Strategie: copier tel quel a adaptation faible.

3. Extraire le runner workspace `uv`.
   Fichiers a prendre d'abord: `functions/function_calling/uv_related.py`.
   Dependances minimales: `uv`, workspace root, politique de timeout.
   Strategie: copier avec adaptation.

4. Extraire les outils deep research.
   Fichiers a prendre d'abord: `functions/function_calling/deep_research.py`, `functions/function_calling/web.py`.
   Dependances minimales: `FileToolContext`, APIs web, `xhtml2pdf` pour l'export PDF.
   Strategie: copier avec adaptation.

5. Extraire un smoke test MCP.
   Fichiers a prendre d'abord: `mcp_example/mcp_server.py`.
   Dependances minimales: `fastmcp`.
   Strategie: copier tel quel.

## do not copy blindly
- `functions/function_calling/file.py::delete_path`, `move_path` et `copy_path` sont puissants. Sans une politique workspace stricte, la copie peut etre dangereuse.
- `functions/function_calling/uv_related.py` execute des commandes de process et peut installer des paquets. Il faut rediscuter sandbox, timeout et allowlist avant extraction.
- `functions/function_calling/code_executor.py` et `uv_related.py` sont proches mais pas interchangeables. Le premier execute du code brut, le second pilote un workspace.
- `ToolManager` n'est pas dans ce batch mais c'est lui qui impose la vraie semantique d'execution des functions et du MCP. Copier seulement les functions sans relire `ToolManager` peut fausser le contrat d'appel.
- `FunctionCatalog` ignore les params commencant par `_` et derive les schemas depuis les annotations Python. Si votre style d'API n'utilise pas d'annotations, les schemas deviennent faibles.

## minimal reusable slices
- slice `function-loader`: `utils/function_manager.py`. Copiable tel quel a adaptation tres faible.
- slice `function-json-schema`: `utils/function_catalog.py`, `utils/function_manager.py`. Copiable avec adaptation faible.
- slice `file-tools`: `functions/function_calling/file.py`. Copiable tel quel a adaptation faible.
- slice `uv-runner`: `functions/function_calling/uv_related.py`. Copiable avec adaptation.
- slice `web-tools`: `functions/function_calling/web.py`. Copiable avec adaptation.
- slice `deep-research-suite`: `functions/function_calling/deep_research.py`. Copiable avec adaptation.
- slice `mcp-smoke-server`: `mcp_example/mcp_server.py`. Copiable tel quel.

## exact search shortcuts
- `rg -n "class FunctionCatalog|get_function_catalog|_build_function_metadata|_build_parameters_schema|_annotation_to_schema" utils/function_catalog.py`
- `rg -n "class FunctionManager|load_functions|get_function|list_functions|get_function_manager" utils/function_manager.py`
- `rg -n "class FileToolContext|apply_text_edits|search_in_files|save_file|load_file|read_text_file_snippet|delete_path" functions/function_calling/file.py`
- `rg -n "class WorkspaceCommandContext|_run_uv_command|install_python_packages|init_python_env|uv_run" functions/function_calling/uv_related.py`
- `rg -n "search_save_result|search_load_all|report_outline|report_create_chapter|report_export_pdf" functions/function_calling/deep_research.py`
- `rg -n "web_search|read_webpage_content" functions/function_calling/web.py`
- `rg -n "get_tool_specs|execute_tool|_build_mcp_remote_specs|_build_mcp_local_specs" runtime/node/agent/tool/tool_manager.py`
- `rg -n "tooling:|mcp_remote|mcp_local|function" yaml_instance/demo_function_call.yaml yaml_instance/demo_mcp.yaml docs/user_guide/en/modules/tooling`

## copy risk
- copiable tel quel: `utils/function_manager.py`, `mcp_example/mcp_server.py`, la majeure partie de `functions/function_calling/file.py`.
- copiable avec adaptation: `utils/function_catalog.py`, `functions/function_calling/uv_related.py`, `functions/function_calling/web.py`, `functions/function_calling/deep_research.py`, `functions/function_calling/code_executor.py`.
- a reecrire ou a borner fortement avant copie: toute commande shell/code exec exposee a des utilisateurs non fiables.

## primary file slice
- `utils/function_manager.py`
- `utils/function_catalog.py`
- `functions/function_calling/file.py`
- `functions/function_calling/uv_related.py`
- `functions/function_calling/deep_research.py`
- `functions/function_calling/web.py`
- `functions/function_calling/code_executor.py`
- `functions/function_calling/video.py`
- `functions/function_calling/weather.py`
- `functions/function_calling/user.py`
- `functions/function_calling/utils.py`
- `mcp_example/mcp_server.py`
