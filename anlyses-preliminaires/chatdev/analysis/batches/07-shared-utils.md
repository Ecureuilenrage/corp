# 07-shared-utils - Shared Runtime Utilities

_Primary coverage_: 18 fichiers, 2435 lignes approx. dans ce batch.

## purpose
Fournir les briques transverses qui recollent runtime, serveur et frontend: attachments, prompt humain, build d'inputs, logging, token tracking, placeholders `${VAR}`, export de schema, registres generiques et erreurs typees.

## subdomains
- coeur runtime utilitaire: `utils/attachments.py`, `utils/task_input.py`, `utils/human_prompt.py`, `utils/token_tracker.py`.
- logging / telemetry: `utils/log_manager.py`, `utils/logger.py`, `utils/structured_logger.py`.
- config / schema / registry: `utils/vars_resolver.py`, `utils/env_loader.py`, `utils/schema_exporter.py`, `utils/registry.py`.
- API serveur / middleware / erreurs: `utils/exceptions.py`, `utils/error_handler.py`, `utils/middleware.py`.
- workspace / infra helpers: `utils/workspace_scanner.py`.
- orchestration / API / agent runtime consomment massivement ce batch: `runtime/sdk.py`, `workflow/graph.py`, `server/routes/execute_sync.py`, `server/services/workflow_run_service.py`, `runtime/node/executor/agent_executor.py`, `runtime/node/agent/tool/tool_manager.py`.
- frontend Vue: consommateur indirect via `server/config_schema_router.py` et les attachments/artifacts.
- YAML / docs / tests: `docs/user_guide/en/attachments.md`, `docs/user_guide/en/config_schema_contract.md`.

## entrypoints
- `utils/attachments.py` - `AttachmentStore` - manifest filesystem des pieces jointes d'un run.
- `utils/task_input.py` - `TaskInputBuilder` - transforme un prompt + fichiers en `List[Message]`.
- `utils/human_prompt.py` - `HumanPromptService`, `CliPromptChannel`, `resolve_prompt_channel` - abstraction du human-in-the-loop.
- `utils/schema_exporter.py` - `build_schema_response` - surface backend pour le frontend schema-driven.
- `utils/registry.py` - `Registry` - registre generique reutilise partout.

## key files
- `utils/attachments.py` - `AttachmentRecord`, `AttachmentStore` - stockage, manifest, deduplication et serialisation en `MessageBlock`.
- `utils/task_input.py` - `TaskInputBuilder` - plus petite brique pour joindre des fichiers a un prompt.
- `utils/human_prompt.py` - `PromptResult`, `PromptChannel`, `CliPromptChannel`, `HumanPromptService`.
- `utils/logger.py` - `WorkflowLogger` - vrai coeur des logs de run.
- `utils/log_manager.py` - `LogManager` - shim de compatibilite autour de `WorkflowLogger`.
- `utils/structured_logger.py` - `StructuredLogger`, `get_server_logger`, `get_workflow_logger`.
- `utils/vars_resolver.py` - `PlaceholderResolver`, `resolve_design_placeholders`.
- `utils/schema_exporter.py` - `Breadcrumb`, `build_schema_response`.
- `utils/registry.py` - `Registry`, `RegistryEntry`, `RegistryError`.
- `utils/exceptions.py` - `ValidationError`, `SecurityError`, `WorkflowExecutionError`, `WorkflowCancelledError`.

## feature inventory
- `shared.attachment_store`: coeur runtime utilitaire. Fichiers `utils/attachments.py`, `entity/messages.py`. Symboles centraux `AttachmentRecord`, `AttachmentStore.register_file`, `AttachmentStore.register_bytes`, `AttachmentStore.register_remote_file`, `AttachmentStore.to_message_block`, `AttachmentStore.export_manifest`, `encode_file_to_data_uri`. Statut reuse: copiable avec adaptation faible.
- `shared.task_input_builder`: coeur runtime utilitaire. Fichiers `utils/task_input.py`, `utils/attachments.py`. Symboles centraux `TaskInputBuilder.build_from_file_paths`, `TaskInputBuilder.build_from_blocks`. Statut reuse: copiable tel quel a adaptation faible.
- `shared.human_prompt_channel`: human-in-the-loop. Fichiers `utils/human_prompt.py`, `utils/log_manager.py`. Symboles centraux `PromptResult`, `PromptChannel`, `CliPromptChannel.request`, `HumanPromptService.request`, `resolve_prompt_channel`. Statut reuse: copiable avec adaptation.
- `shared.workflow_logging`: logging / telemetry. Fichiers `utils/logger.py`, `utils/log_manager.py`, `utils/structured_logger.py`, `utils/token_tracker.py`. Symboles centraux `WorkflowLogger`, `LogManager`, `StructuredLogger`, `get_server_logger`, `get_workflow_logger`, `TokenTracker`. Statut reuse: copiable avec adaptation.
- `shared.placeholder_resolution`: config helper. Fichiers `utils/vars_resolver.py`, `utils/env_loader.py`. Symboles centraux `PlaceholderResolver`, `resolve_design_placeholders`, `resolve_mapping_with_vars`, `load_dotenv_file`, `build_env_var_map`. Statut reuse: copiable presque tel quel.
- `shared.schema_exporter`: schema-driven backend. Fichiers `utils/schema_exporter.py`. Symboles centraux `Breadcrumb`, `_resolve_config_class`, `_serialize_field`, `build_schema_response`. Statut reuse: copiable avec adaptation faible.
- `shared.generic_registry`: registry helper. Fichiers `utils/registry.py`. Symboles centraux `Registry.register`, `Registry.get`, `Registry.items`, `Registry.names`, `RegistryEntry.load`. Statut reuse: copiable tel quel.
- `shared.error_surface`: serveur. Fichiers `utils/exceptions.py`, `utils/error_handler.py`, `utils/middleware.py`. Symboles centraux `MACException`, `ValidationError`, `SecurityError`, `WorkflowExecutionError`, `WorkflowCancelledError`, `add_exception_handlers`, `add_cors_middleware`, `add_middleware`. Statut reuse: copiable avec adaptation.
- `shared.workspace_scanner`: infra helper. Fichiers `utils/workspace_scanner.py`. Symboles centraux `WorkspaceEntry`, `iter_workspace_entries`. Statut reuse: copiable tel quel.

## data flow
1. Le SDK ou les routes serveur preparant un run utilisent `AttachmentStore` pour importer des fichiers utilisateur ou des artefacts existants.
2. `TaskInputBuilder` encapsule ces fichiers dans des `MessageBlock` et renvoie un `List[Message]` coherent avec le runtime.
3. Pendant l'execution, `HumanPromptService` appelle un `PromptChannel`, normalise la reponse et l'enregistre dans les logs.
4. `WorkflowLogger` et `StructuredLogger` collectent les appels modele, tools, memoire, thinking, humains et evenements de workflow.
5. Les parsers YAML et le schema API s'appuient sur `vars_resolver`, `env_loader` et `schema_exporter`.
6. Les erreurs remontees par le runtime ou les routes sont typiquement converties via `utils/error_handler.py`.

## symbol map
- `utils/attachments.py`: `AttachmentRecord`, `AttachmentRecord.as_message_block`, `AttachmentStore`, `AttachmentStore.register_file`, `AttachmentStore.register_bytes`, `AttachmentStore.register_remote_file`, `AttachmentStore.update_remote_file_id`, `AttachmentStore.to_message_block`, `AttachmentStore.export_manifest`, `_sha256_file`, `encode_file_to_data_uri`.
- `utils/task_input.py`: `TaskInputBuilder`, `TaskInputBuilder.build_from_file_paths`, `TaskInputBuilder.build_from_blocks`.
- `utils/human_prompt.py`: `PromptResult`, `PromptChannel`, `CliPromptChannel`, `CliPromptChannel.request`, `HumanPromptService`, `HumanPromptService.request`, `resolve_prompt_channel`.
- `utils/token_tracker.py`: `TokenUsage`, `TokenTracker`.
- `utils/logger.py`: `_json_safe`, `LogEntry`, `WorkflowLogger`.
- `utils/log_manager.py`: `LogManager`.
- `utils/structured_logger.py`: `LogType`, `StructuredLogger`, `get_server_logger`, `get_workflow_logger`.
- `utils/vars_resolver.py`: `PlaceholderResolver`, `resolve_design_placeholders`, `resolve_mapping_with_vars`.
- `utils/env_loader.py`: `load_dotenv_file`, `build_env_var_map`.
- `utils/schema_exporter.py`: `SchemaResolutionError`, `Breadcrumb`, `_normalize_breadcrumbs`, `_resolve_config_class`, `_serialize_field`, `build_schema_response`.
- `utils/registry.py`: `RegistryError`, `RegistryEntry`, `Registry`, `Registry.register`, `Registry.get`.
- `utils/workspace_scanner.py`: `WorkspaceEntry`, `iter_workspace_entries`.
- `utils/exceptions.py`: `MACException`, `ValidationError`, `SecurityError`, `ConfigurationError`, `WorkflowExecutionError`, `WorkflowCancelledError`, `ResourceNotFoundError`, `ResourceConflictError`, `TimeoutError`, `ExternalServiceError`.
- `utils/error_handler.py`: `add_exception_handlers`.
- `utils/middleware.py`: `add_cors_middleware`, `add_middleware`.

## dependency map
- hard blocker - message contract: `entity/messages.py`, surtout pour `AttachmentStore`, `TaskInputBuilder`, `HumanPromptService`.
- hard blocker - logger contract: `entity/enums.py::CallStage`, `LogLevel` pour `WorkflowLogger` et `LogManager`.
- medium blocker - schema exporter depends on config classes: `entity/configs/__init__.py`, `entity/configs/graph.py`, `BaseConfig.child_routes`, `FIELD_SPECS`.
- medium blocker - attachment store depends on file-system semantics and run directory layout. Si votre runtime n'a pas de dossier de session, il faut redefinir `root`.
- medium blocker - error handler / middleware supposent FastAPI.
- inbound adapters utiles a lire avant extraction: `runtime/sdk.py`, `server/routes/execute_sync.py`, `server/config_schema_router.py`, `runtime/node/executor/agent_executor.py`, `server/services/workflow_run_service.py`.

## external deps
- principalement stdlib.
- `fastapi` est requis pour `middleware` et `error_handler`.
- ce batch sert de glue pour d'autres deps mais en porte peu directement.

## flags/env
- `SERVER_LOG_FILE`, `WORKFLOW_LOG_FILE`, `LOG_LEVEL` pilotent `StructuredLogger`.
- `CORS_ALLOW_ORIGINS`, `ENVIRONMENT` pilotent middleware et error handling.
- `AttachmentStore` et `TaskInputBuilder` ne lisent pas d'env directement mais dependent du layout workspace fourni par le runtime.

## reusable ideas
- `Registry` est un helper generique tres simple, meilleur point de depart que beaucoup de registries maison plus lourds.
- `TaskInputBuilder` est une mini-brique utile des qu'un runtime doit accepter prompt + fichiers.
- `AttachmentStore` + `AttachmentRecord` offrent une convention claire pour convertir des fichiers en references persistantes et blocs de message.

## extraction recipes
1. Extraire seulement le stockage d'attachments.
   Fichiers a prendre d'abord: `utils/attachments.py`.
   Dependances minimales: `entity/messages.py`.
   Strategie: copier avec adaptation faible.

2. Extraire le prompt humain cross-channel.
   Fichiers a prendre d'abord: `utils/human_prompt.py`, `utils/log_manager.py`.
   Dependances minimales: `MessageBlock`, un logger compatible.
   Strategie: copier avec adaptation.

3. Extraire le schema exporter.
   Fichiers a prendre d'abord: `utils/schema_exporter.py`.
   Dependances minimales: `BaseConfig`, `DesignConfig`, `FIELD_SPECS`, `child_routes`.
   Strategie: copier presque tel quel.

4. Extraire la resolution `${VAR}`.
   Fichiers a prendre d'abord: `utils/vars_resolver.py`, `utils/env_loader.py`.
   Dependances minimales: aucune hors stdlib.
   Strategie: copier tel quel.

5. Extraire le registry helper.
   Fichiers a prendre d'abord: `utils/registry.py`.
   Dependances minimales: stdlib.
   Strategie: copier tel quel.

6. Extraire la couche de logging workflow.
   Fichiers a prendre d'abord: `utils/logger.py`, `utils/log_manager.py`, `utils/structured_logger.py`, `utils/token_tracker.py`.
   Dependances minimales: enums de log/call stage.
   Strategie: copier avec adaptation.

## do not copy blindly
- `AttachmentStore` persiste un manifest et peut copier des fichiers ou simplement referencer leur chemin. Il faut redecider ce contrat avant extraction dans un autre produit.
- `HumanPromptService` suppose qu'un `PromptChannel` est synchrone et que la serialisation des reponses tient dans `MessageBlock`. Si votre canal est async natif, il faudra adapter le contrat.
- `LogManager` n'est qu'un shim de compatibilite. Pour un nouveau projet, mieux vaut souvent repartir directement de `WorkflowLogger`.
- `schema_exporter.py` depend fortement des `FIELD_SPECS` et `child_routes` du systeme de config ChatDev. Copier seul ce fichier sans ce contrat rend l'API de schema trompeuse.
- `error_handler.py` et `middleware.py` sont utiles mais fortement FastAPI-centriques.

## minimal reusable slices
- slice `attachment-store`: `utils/attachments.py`. Copiable avec adaptation faible.
- slice `task-input`: `utils/task_input.py`. Copiable presque tel quel.
- slice `prompt-service`: `utils/human_prompt.py`. Copiable avec adaptation.
- slice `registry-helper`: `utils/registry.py`. Copiable tel quel.
- slice `vars-resolution`: `utils/vars_resolver.py`, `utils/env_loader.py`. Copiable tel quel.
- slice `schema-export`: `utils/schema_exporter.py`. Copiable avec adaptation.
- slice `workspace-scan`: `utils/workspace_scanner.py`. Copiable tel quel.
- slice `logging-stack`: `utils/logger.py`, `utils/log_manager.py`, `utils/structured_logger.py`, `utils/token_tracker.py`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "class AttachmentStore|register_file|register_bytes|register_remote_file|to_message_block|export_manifest" utils/attachments.py`
- `rg -n "class TaskInputBuilder|build_from_file_paths|build_from_blocks" utils/task_input.py`
- `rg -n "class PromptResult|class PromptChannel|class CliPromptChannel|class HumanPromptService|resolve_prompt_channel" utils/human_prompt.py`
- `rg -n "class WorkflowLogger|record_model_call|record_tool_call|record_memory_operation|record_workflow_end" utils/logger.py`
- `rg -n "class LogManager|get_logger|thinking_timer|memory_timer|record_human_interaction" utils/log_manager.py`
- `rg -n "class StructuredLogger|get_server_logger|get_workflow_logger" utils/structured_logger.py`
- `rg -n "class PlaceholderResolver|resolve_design_placeholders|resolve_mapping_with_vars" utils/vars_resolver.py`
- `rg -n "load_dotenv_file|build_env_var_map" utils/env_loader.py`
- `rg -n "class Breadcrumb|_resolve_config_class|build_schema_response" utils/schema_exporter.py`
- `rg -n "class Registry|class RegistryEntry|register\\(|get\\(|items\\(" utils/registry.py`

## copy risk
- copiable tel quel: `utils/registry.py`, `utils/workspace_scanner.py`, la majeure partie de `utils/vars_resolver.py`.
- copiable avec adaptation: `utils/attachments.py`, `utils/task_input.py`, `utils/human_prompt.py`, `utils/schema_exporter.py`, `utils/logger.py`, `utils/log_manager.py`, `utils/structured_logger.py`.
- a reecrire ou a simplifier selon cible: `middleware.py`, `error_handler.py` si vous n'etes pas sur FastAPI.

## primary file slice
- `utils/attachments.py`
- `utils/task_input.py`
- `utils/human_prompt.py`
- `utils/token_tracker.py`
- `utils/logger.py`
- `utils/log_manager.py`
- `utils/structured_logger.py`
- `utils/vars_resolver.py`
- `utils/env_loader.py`
- `utils/schema_exporter.py`
- `utils/registry.py`
- `utils/workspace_scanner.py`
- `utils/exceptions.py`
- `utils/error_handler.py`
- `utils/middleware.py`
