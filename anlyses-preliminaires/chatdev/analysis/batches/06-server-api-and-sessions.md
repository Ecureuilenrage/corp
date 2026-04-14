# 06-server-api-and-sessions - Server API, Sessions, Streaming

_Primary coverage_: 36 fichiers, 3553 lignes approx. dans ce batch.

## purpose
Exposer le runtime ChatDev via FastAPI, SSE et WebSocket avec gestion de sessions, uploads, artefacts, CRUD YAML et persistence `vuegraph`.

## subdomains
- API serveur / bootstrap: `server/app.py`, `server_main.py`, `server/routes/__init__.py`, `server/models.py`.
- HTTP sync / SSE workflow execution: `server/routes/execute_sync.py`, `runtime/sdk.py`, `workflow/graph.py`.
- WebSocket session execution / human-in-the-loop: `server/routes/websocket.py`, `server/services/workflow_run_service.py`, `server/services/session_execution.py`, `server/services/websocket_executor.py`, `server/services/websocket_manager.py`, `server/services/message_handler.py`, `server/services/prompt_channel.py`, `server/services/session_store.py`.
- CRUD YAML / schema / vuegraph: `server/routes/workflows.py`, `server/config_schema_router.py`, `server/services/workflow_storage.py`, `server/routes/vuegraphs.py`, `server/services/vuegraphs_storage.py`.
- uploads / attachments / artifacts: `server/routes/uploads.py`, `server/services/attachment_service.py`, `server/routes/artifacts.py`, `server/services/artifact_dispatcher.py`, `server/services/artifact_events.py`, `server/routes/sessions.py`.
- batch ingestion / execution: `server/routes/batch.py`, `server/services/batch_parser.py`, `server/services/batch_run_service.py`.
- orchestration runtime touchee par couplage: `workflow/graph.py`, `workflow/graph_context.py`, `workflow/hooks/workspace_artifact.py`, `utils/attachments.py`, `utils/human_prompt.py`.
- frontend Vue consommateur: `frontend/src/utils/apiFunctions.js`, `frontend/src/pages/LaunchView.vue`, `frontend/src/pages/BatchRunView.vue`, `frontend/src/pages/WorkflowView.vue`.
- tests / docs / infra: `tests/test_websocket_send_message_sync.py`, `docs/user_guide/en/ws_frontend_logic.md`, `docs/user_guide/en/web_ui_guide.md`.

## entrypoints
- `server_main.py` - `main` - lancement Uvicorn et options host/port/log.
- `server/app.py` - `app` - bootstrap FastAPI + `init_app(app)`.
- `server/routes/execute_sync.py` - `run_workflow_sync` - endpoint `/api/workflow/run` en mode JSON ou SSE.
- `server/routes/websocket.py` - `websocket_endpoint` - canal `/ws`.
- `server/routes/workflows.py` - endpoints CRUD YAML.
- `server/config_schema_router.py` - `get_schema`, `validate_document` - endpoints backend pour les formulaires pilotes par schema.

## key files
- `server/routes/execute_sync.py` - `_resolve_yaml_path`, `_build_task_input`, `_run_workflow_with_logger`, `_sse_event`, `run_workflow_sync`.
- `server/services/workflow_run_service.py` - `WorkflowRunService.start_workflow`, `_execute_workflow_async`, `_build_initial_task_input`, `_resolve_yaml_path`, `request_cancel`.
- `server/services/session_execution.py` - `SessionExecutionController.set_waiting_for_input`, `wait_for_human_input`, `provide_human_input`, `cleanup_session`.
- `server/services/websocket_manager.py` - `WebSocketManager.connect`, `disconnect`, `send_message`, `send_message_sync`, `handle_message`.
- `server/services/session_store.py` - `WorkflowSession`, `WorkflowSessionStore`.
- `server/services/artifact_dispatcher.py` - `emit_workspace_artifacts`, `emit`.
- `server/services/artifact_events.py` - `ArtifactEvent`, `ArtifactEventQueue`.
- `server/services/workflow_storage.py` - `validate_workflow_filename`, `validate_workflow_content`, `persist_workflow`, `rename_workflow`, `copy_workflow`.
- `server/services/vuegraphs_storage.py` - `save_vuegraph_content`, `fetch_vuegraph_content`.
- `server/services/batch_parser.py` - `BatchTask`, `parse_batch_file`.

## feature inventory
- `api.sync_streaming_execution`: API serveur / SSE. Fichiers `server/routes/execute_sync.py`, `runtime/sdk.py`, `workflow/graph.py`, `utils/task_input.py`, `utils/attachments.py`. Symboles centraux `run_workflow_sync`, `_run_workflow_with_logger`, `_sse_event`, `run_workflow`, `TaskInputBuilder.build_from_file_paths`. Statut reuse: copiable avec adaptation.
- `api.websocket_human_loop`: WebSocket / sessions. Fichiers `server/routes/websocket.py`, `server/services/websocket_manager.py`, `server/services/message_handler.py`, `server/services/workflow_run_service.py`, `server/services/session_execution.py`, `server/services/session_store.py`, `server/services/websocket_executor.py`. Symboles centraux `websocket_endpoint`, `WebSocketManager.send_message_sync`, `WorkflowRunService.start_workflow`, `SessionExecutionController.wait_for_human_input`, `WorkflowSessionStore.create_session`, `WebSocketGraphExecutor`. Statut reuse: copiable avec adaptation.
- `api.workflow_storage_crud`: CRUD YAML. Fichiers `server/routes/workflows.py`, `server/services/workflow_storage.py`. Symboles centraux `_persist_workflow_from_content`, `validate_workflow_filename`, `validate_workflow_content`, `persist_workflow`, `rename_workflow`, `copy_workflow`. Statut reuse: copiable avec adaptation faible.
- `api.config_schema_endpoint`: schema-driven backend. Fichiers `server/config_schema_router.py`, `utils/schema_exporter.py`. Symboles centraux `SchemaRequest`, `SchemaValidateRequest`, `_resolve_schema`, `get_schema`, `validate_document`. Statut reuse: copiable avec adaptation faible.
- `api.artifact_event_dispatch`: artefacts. Fichiers `server/routes/artifacts.py`, `server/services/artifact_dispatcher.py`, `server/services/artifact_events.py`, `workflow/hooks/workspace_artifact.py`. Symboles centraux `_get_session_and_queue`, `poll_artifact_events`, `ArtifactDispatcher.emit_workspace_artifacts`, `ArtifactEventQueue.wait_for_events`. Statut reuse: copiable avec adaptation.
- `api.batch_ingestion`: batch run support. Fichiers `server/routes/batch.py`, `server/services/batch_parser.py`, `server/services/batch_run_service.py`, `frontend/src/pages/BatchRunView.vue`. Symboles centraux `parse_batch_file`, `BatchTask`, `BatchRunService`. Statut reuse: copiable avec adaptation.
- `api.vuegraph_persistence`: frontend persistence. Fichiers `server/routes/vuegraphs.py`, `server/services/vuegraphs_storage.py`, `tools/sync_vuegraphs.py`. Symboles centraux `save_vuegraph_content`, `fetch_vuegraph_content`, `sync_yaml_to_vuegraphs`. Statut reuse: copiable avec adaptation.

## data flow
1. `server/app.py` cree l'application et `server.bootstrap.init_app` branche middlewares, exception handlers et routers.
2. En mode HTTP sync/SSE, `server/routes/execute_sync.py::run_workflow_sync` valide la requete `WorkflowRunRequest`, resout le YAML, construit le `TaskInput` et lance `runtime/sdk.py::run_workflow` ou un `_StreamingExecutor`.
3. En mode WebSocket, `server/routes/websocket.py::websocket_endpoint` delegue a `WebSocketManager.connect`, puis `WebSocketManager.handle_message` dispatch a `MessageHandler`.
4. `MessageHandler` declenche `WorkflowRunService.start_workflow`, qui cree une `WorkflowSession`, prepare le workspace d'attachments et instancie `WebSocketGraphExecutor`.
5. Si un noeud humain bloque le run, `SessionExecutionController.set_waiting_for_input` enregistre la future; le frontend renvoie ensuite la reponse via WebSocket, que `provide_human_input` debloque.
6. Les artefacts de workspace detectes pendant le run sont transformes en `ArtifactEvent` par `ArtifactDispatcher`, pousses dans `ArtifactEventQueue` et potentiellement diffuses en direct via `WebSocketManager.send_message_sync`.
7. En parallele, les routes `workflows`, `uploads`, `vuegraphs`, `artifacts`, `sessions` et `tools` exposent les assets necessaires au frontend.

## symbol map
- `server_main.py`: `main`.
- `server/app.py`: `app`.
- `server/models.py`: `WorkflowRequest`, `WorkflowRunRequest`, `WorkflowUploadContentRequest`, `WorkflowUpdateContentRequest`, `WorkflowRenameRequest`, `WorkflowCopyRequest`, `VueGraphContentPayload`.
- `server/config_schema_router.py`: `SchemaRequest`, `SchemaValidateRequest`, `_resolve_schema`, `get_schema`, `validate_document`.
- `server/routes/execute_sync.py`: `_normalize_session_name`, `_resolve_yaml_path`, `_build_task_input`, `_run_workflow_with_logger`, `_sse_event`, `run_workflow_sync`.
- `server/routes/websocket.py`: `websocket_endpoint`.
- `server/routes/workflows.py`: `_persist_workflow_from_content`, `list_workflows`, `get_workflow_args`, `get_workflow_desc`, `upload_workflow_content`, `update_workflow_content`, `delete_workflow`, `rename_workflow_route`, `copy_workflow_route`, `get_workflow`.
- `server/routes/artifacts.py`: `_split_csv`, `_get_session_and_queue`, `poll_artifact_events`, `get_artifact`.
- `server/routes/tools.py`: `LocalToolCreateRequest`, `list_local_tools`, `create_local_tool`.
- `server/routes/batch.py`: `run_batch_workflow`.
- `server/routes/uploads.py`: `upload_file`, `list_uploads`.
- `server/routes/vuegraphs.py`: `upload_vuegraph_content`, `get_vuegraph_content`.
- `server/routes/sessions.py`: `download_logs`.
- `server/services/workflow_run_service.py`: `WorkflowRunService`, `request_cancel`, `start_workflow`, `_execute_workflow_async`, `_build_initial_task_input`, `_resolve_yaml_path`.
- `server/services/session_execution.py`: `SessionExecutionController`, `set_waiting_for_input`, `wait_for_human_input`, `provide_human_input`, `cleanup_session`.
- `server/services/session_store.py`: `SessionStatus`, `WorkflowSession`, `WorkflowSessionStore`, `create_session`, `update_session_status`, `complete_session`, `get_artifact_queue`.
- `server/services/websocket_manager.py`: `_json_default`, `_encode_ws_message`, `WebSocketManager`, `connect`, `disconnect`, `send_message`, `send_message_sync`, `broadcast`, `handle_heartbeat`, `handle_message`.
- `server/services/artifact_dispatcher.py`: `ArtifactDispatcher`, `emit_workspace_artifacts`, `emit`.
- `server/services/artifact_events.py`: `ArtifactEvent`, `ArtifactEventQueue`, `append_many`, `snapshot`, `wait_for_events`.
- `server/services/workflow_storage.py`: `_update_workflow_id`, `validate_workflow_filename`, `validate_workflow_content`, `persist_workflow`, `rename_workflow`, `copy_workflow`.
- `server/services/vuegraphs_storage.py`: `_get_db_path`, `_ensure_db_initialized`, `save_vuegraph_content`, `fetch_vuegraph_content`.
- `server/services/batch_parser.py`: `BatchTask`, `parse_batch_file`, `_read_csv`, `_read_excel`, `_parse_dataframe`.

## dependency map
- hard blocker - workflow runtime: `runtime/sdk.py`, `workflow/graph.py`, `workflow/graph_context.py`, `check/check.py`, `entity/graph_config.py`. Les routes d'execution ne sont que des adaptateurs autour du moteur.
- hard blocker - shared utils: `utils/attachments.py`, `utils/task_input.py`, `utils/human_prompt.py`, `utils/exceptions.py`, `utils/structured_logger.py`, `utils/error_handler.py`. Requis presque partout.
- hard blocker - session protocol: `server/services/message_handler.py` et les types de messages attendus par le frontend. La semantique WebSocket est maison.
- medium blocker - artifact hook: `workflow/hooks/workspace_artifact.py` + `server/services/artifact_dispatcher.py`. Si vous retirez ce hook, les routes d'artefacts perdent une partie de leur utilite.
- medium blocker - vuegraph persistence: `server/services/vuegraphs_storage.py` stocke dans un sqlite simplifie via chemin `VUEGRAPHS_DB_PATH`. A adapter si votre produit a un autre stockage.
- medium blocker - uploads and attachments: `AttachmentService` prepare des workspaces par session et nettoie selon `MAC_AUTO_CLEAN_ATTACHMENTS`.
- inbound adapters utiles a lire avant extraction: `frontend/src/utils/apiFunctions.js`, `frontend/src/pages/LaunchView.vue`, `frontend/src/pages/BatchRunView.vue`, `tests/test_websocket_send_message_sync.py`.

## external deps
- `fastapi`, `uvicorn`, `starlette`, `websockets`.
- `pandas`, `openpyxl` pour `batch_parser`.
- le backend reste majoritairement stdlib + le runtime ChatDev.

## flags/env
- `LOG_LEVEL`, `SERVER_LOG_FILE`, `WORKFLOW_LOG_FILE` affectent le logging serveur et workflow.
- `MAC_AUTO_CLEAN_ATTACHMENTS` affecte le cycle de vie des uploads.
- `VUEGRAPHS_DB_PATH` pilote la persistence des graphes frontend.
- `CORS_ALLOW_ORIGINS`, `ENVIRONMENT` affectent middlewares et error handling.
- `YAML_DIR`, `WARE_HOUSE_DIR` depuis `server.settings` gouvernent la resolution des workflows et des outputs.

## reusable ideas
- la separation `routes -> services -> runtime` est relativement propre et rend l'extraction partielle praticable.
- `ArtifactEventQueue` est une bonne brique autonome pour exposer des fichiers produits par un run long.
- `WebSocketManager.send_message_sync` + capture de l'owner loop est une solution concrete a un vrai edge case cross-thread.

## extraction recipes
1. Extraire l'API HTTP sync/SSE minimale.
   Fichiers a prendre d'abord: `server/routes/execute_sync.py`, `runtime/sdk.py`, `utils/task_input.py`, `utils/attachments.py`.
   Dependances minimales: `check/check.py`, `GraphExecutor`.
   Strategie: copier avec adaptation.

2. Extraire la couche WebSocket/session.
   Fichiers a prendre d'abord: `server/routes/websocket.py`, `server/services/websocket_manager.py`, `server/services/workflow_run_service.py`, `server/services/session_execution.py`, `server/services/session_store.py`.
   Dependances minimales: runtime workflow, prompt humain, attachments.
   Strategie: copier avec adaptation.

3. Extraire seulement le CRUD YAML.
   Fichiers a prendre d'abord: `server/routes/workflows.py`, `server/services/workflow_storage.py`.
   Dependances minimales: `check/check.py`, `utils/exceptions.py`.
   Strategie: copier avec adaptation faible.

4. Extraire la file d'artefacts.
   Fichiers a prendre d'abord: `server/services/artifact_events.py`, `server/services/artifact_dispatcher.py`, `server/routes/artifacts.py`.
   Dependances minimales: `WorkflowSessionStore`, `WorkspaceArtifact`.
   Strategie: copier avec adaptation.

5. Extraire le backend schema-driven pour formulaires.
   Fichiers a prendre d'abord: `server/config_schema_router.py`, `utils/schema_exporter.py`.
   Dependances minimales: `DesignConfig`, `BaseConfig`.
   Strategie: copier presque tel quel.

## do not copy blindly
- `server/services/websocket_manager.py` depend d'un protocole de messages implicite partage avec `frontend/src/pages/LaunchView.vue` et `BatchRunView.vue`. Copier seulement le backend casse facilement l'UI.
- `server/services/workflow_run_service.py` suppose l'existence de `WebSocketGraphExecutor`, `AttachmentService`, `WorkflowSessionStore`, `SessionExecutionController` et `GraphContext`.
- `server/routes/execute_sync.py` cree une classe locale `_StreamingExecutor` qui sous-classe `GraphExecutor` juste pour injecter un logger SSE. C'est utile mais tres specifique au runtime actuel.
- `server/services/workflow_storage.py::_update_workflow_id` modifie l'`id:` YAML par regex. Si votre format YAML differe, cette logique devient fragile.
- `server/services/artifact_dispatcher.py` appelle `send_message_sync` depuis des threads de runtime. Cette strategie n'est correcte que si l'owner loop est bien capture au `connect()`.

## minimal reusable slices
- slice `sync-sse-api`: `server/routes/execute_sync.py`. Copiable avec adaptation.
- slice `ws-manager`: `server/services/websocket_manager.py`, `server/routes/websocket.py`. Copiable avec adaptation.
- slice `session-store`: `server/services/session_store.py`. Copiable presque tel quel.
- slice `human-session-controller`: `server/services/session_execution.py`. Copiable avec adaptation.
- slice `workflow-storage-crud`: `server/services/workflow_storage.py`, `server/routes/workflows.py`. Copiable avec adaptation faible.
- slice `artifact-queue`: `server/services/artifact_events.py`, `server/services/artifact_dispatcher.py`. Copiable avec adaptation.
- slice `schema-api`: `server/config_schema_router.py`. Copiable presque tel quel.
- slice `vuegraph-storage`: `server/services/vuegraphs_storage.py`, `server/routes/vuegraphs.py`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "run_workflow_sync|_run_workflow_with_logger|_sse_event|StreamingResponse" server/routes/execute_sync.py`
- `rg -n "websocket_endpoint|connect\\(|send_message_sync|handle_message|disconnect\\(" server/routes/websocket.py server/services/websocket_manager.py`
- `rg -n "start_workflow|request_cancel|_execute_workflow_async|_build_initial_task_input" server/services/workflow_run_service.py`
- `rg -n "set_waiting_for_input|wait_for_human_input|provide_human_input|cleanup_session" server/services/session_execution.py`
- `rg -n "WorkflowSession|WorkflowSessionStore|SessionStatus" server/services/session_store.py`
- `rg -n "validate_workflow_filename|validate_workflow_content|persist_workflow|rename_workflow|copy_workflow" server/services/workflow_storage.py`
- `rg -n "ArtifactEvent|ArtifactEventQueue|emit_workspace_artifacts|poll_artifact_events" server/services/artifact_events.py server/services/artifact_dispatcher.py server/routes/artifacts.py`
- `rg -n "SchemaRequest|SchemaValidateRequest|get_schema|validate_document" server/config_schema_router.py`
- `rg -n "postBatchWorkflow|fetchConfigSchema|postYaml|postVuegraphs|getAttachment" frontend/src/utils/apiFunctions.js`
- `rg -n "send_message_sync|owner loop|cross-thread|WebSocketManager" tests/test_websocket_send_message_sync.py server/services/websocket_manager.py`

## copy risk
- copiable tel quel: `server/services/session_store.py` en grande partie, `server/services/artifact_events.py` en grande partie.
- copiable avec adaptation: `server/routes/execute_sync.py`, `server/services/websocket_manager.py`, `server/services/session_execution.py`, `server/services/workflow_storage.py`, `server/config_schema_router.py`, `server/services/artifact_dispatcher.py`.
- a reecrire ou a recabler avant copie: `server/services/workflow_run_service.py` si vous n'emportez pas le runtime workflow ChatDev et son protocole de session.

## primary file slice
- `server_main.py`
- `server/app.py`
- `server/models.py`
- `server/config_schema_router.py`
- `server/routes/execute_sync.py`
- `server/routes/websocket.py`
- `server/routes/workflows.py`
- `server/routes/artifacts.py`
- `server/routes/batch.py`
- `server/routes/uploads.py`
- `server/routes/vuegraphs.py`
- `server/routes/sessions.py`
- `server/services/workflow_run_service.py`
- `server/services/session_execution.py`
- `server/services/session_store.py`
- `server/services/websocket_manager.py`
- `server/services/websocket_executor.py`
- `server/services/message_handler.py`
- `server/services/artifact_dispatcher.py`
- `server/services/artifact_events.py`
- `server/services/workflow_storage.py`
- `server/services/vuegraphs_storage.py`
- `server/services/batch_parser.py`
- `server/services/batch_run_service.py`
