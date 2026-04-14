# ChatDev-main Analysis Index

Cartographie preliminaire generee automatiquement a partir du code reel de `ChatDev-main`, orientee indexation future par IA et reperage rapide des fonctionnalites reutilisables.

## Snapshot
- Racine analysee: `C:/Dev/PRJET/chatdev/ChatDev-main`
- Fichiers texte en scope: 345
- Lignes totales approx.: 71503
- Edges dimport/reference: 1272
- Couverture inventaire/domain map: OK
- Scope de couverture: Tous les fichiers texte du repo hors `analysis/`, binaires et dossiers de build exclus.

## Tech Stack Confirmed
- Backend: Python 3.12+, FastAPI, Pydantic 2, WebSockets, runtime YAML.
- Frontend: Vue 3, Vite 7, Vue Router, Vue I18n, Vue Flow.
- Surface declarative: `yaml_template/` et `yaml_instance/`.
- Infra: Docker, Docker Compose, GitHub Actions, Makefile.

## Entrypoints
- `frontend/src/main.js`
- `run.py`
- `runtime/sdk.py`
- `server/app.py`
- `server_main.py`
- `tools/sync_vuegraphs.py`
- `tools/validate_all_yamls.py`

## Proposed Batches
- `01-core-config-schema` - Core Config, Schema, Bootstrap - 39 fichiers - 7127 lignes - `analysis/batches/01-core-config-schema.md`
- `02-workflow-orchestration` - Workflow Orchestration, Topology, Execution - 21 fichiers - 3890 lignes - `analysis/batches/02-workflow-orchestration.md`
- `03-node-edge-runtime` - Node And Edge Runtime - 30 fichiers - 2342 lignes - `analysis/batches/03-node-edge-runtime.md`
- `04-agent-runtime` - Agent Runtime, Providers, Memory, Skills - 31 fichiers - 6200 lignes - `analysis/batches/04-agent-runtime.md`
- `05-function-tooling-and-mcp` - Functions, Tool Catalog, MCP - 12 fichiers - 2975 lignes - `analysis/batches/05-function-tooling-and-mcp.md`
- `06-server-api-and-sessions` - Server API, Sessions, Streaming - 36 fichiers - 3553 lignes - `analysis/batches/06-server-api-and-sessions.md`
- `07-shared-utils` - Shared Runtime Utilities - 18 fichiers - 2435 lignes - `analysis/batches/07-shared-utils.md`
- `08-frontend-vue-console` - Frontend Vue Workbench - 46 fichiers - 24150 lignes - `analysis/batches/08-frontend-vue-console.md`
- `09-yaml-surface` - YAML Templates, Instances, Declarative Assets - 47 fichiers - 10383 lignes - `analysis/batches/09-yaml-surface.md`
- `10-tests-docs-infra` - Tests, Docs, Infra, Ops - 65 fichiers - 8448 lignes - `analysis/batches/10-tests-docs-infra.md`

## Key Hubs
- `runtime/sdk.py` - batch `02-workflow-orchestration` - importance 14
- `run.py` - batch `01-core-config-schema` - importance 12
- `entity/configs/node/agent.py` - batch `01-core-config-schema` - importance 11
- `server/routes/execute_sync.py` - batch `06-server-api-and-sessions` - importance 11
- `server/routes/workflows.py` - batch `06-server-api-and-sessions` - importance 11
- `entity/configs/node/memory.py` - batch `01-core-config-schema` - importance 10
- `server/config_schema_router.py` - batch `06-server-api-and-sessions` - importance 10
- `check/check.py` - batch `01-core-config-schema` - importance 9
- `entity/configs/node/subgraph.py` - batch `01-core-config-schema` - importance 9
- `entity/configs/edge/dynamic_edge_config.py` - batch `01-core-config-schema` - importance 8

## High-Value Env/Flags
- `API_KEY`
- `BACKEND_BIND`
- `BASE_URL`
- `COMMON_PROMPT`
- `CORS_ALLOW_ORIGINS`
- `DEV`
- `ENVIRONMENT`
- `JINA_API_KEY`
- `LIB_INSTALL_TIMEOUT`
- `LOG_LEVEL`
- `MAC_AUTO_CLEAN_ATTACHMENTS`
- `MEM0_API_KEY`
- `MODEL_NAME`
- `PATH`
- `SERPER_DEV_API_KEY`
- `SERVER_LOG_FILE`
- `START_NODE_ID`
- `TEMP_CODE_DIR`
- `VAR`
- `VARIABLE_NAME`
- `VITE_API_BASE_URL`
- `VUEGRAPHS_DB_PATH`
- `WORKFLOW_LOG_FILE`

## Recommended Deep-Dive Order
- `01-core-config-schema` pour fixer la grammaire et les points dinjection du runtime.
- `02-workflow-orchestration` pour comprendre la machine dexecution et la topologie.
- `04-agent-runtime` pour isoler le coeur agentique reutilisable.
- `05-function-tooling-and-mcp` pour la surface outils/MCP reellement exploitable.
- `06-server-api-and-sessions` pour les surfaces dintegration produit.
- `08-frontend-vue-console` pour lediteur no-code et les formulaires pilotes par schema.
- `09-yaml-surface` pour les patterns declaratifs et exemples.
- `03-node-edge-runtime`, `07-shared-utils`, puis `10-tests-docs-infra` en approfondissement cible.

## Reuse Shortlist
- Voir `analysis/reuse/reuse-candidates.md`.
- Voir `analysis/manifests/feature_catalog.jsonl`.

## Coverage Checks
- `missing_in_domain_map`: 0
- `missing_in_inventory`: 0
- `source_paths_in_scope`: 338
- `assigned_to_batch`: 345
