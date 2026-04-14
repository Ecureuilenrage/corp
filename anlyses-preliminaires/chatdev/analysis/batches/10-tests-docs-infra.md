# 10-tests-docs-infra - Tests, Docs, Infra, Ops

_Primary coverage_: 65 fichiers, 8448 lignes approx. dans ce batch.

## purpose
Cartographier le filet de securite et l'enveloppe produit autour du runtime: tests existants, docs executees, scripts d'ops, packaging Docker/compose et CI.

## subdomains
- tests automatises: `tests/test_mem0_memory.py`, `tests/test_memory_embedding_consistency.py`, `tests/test_websocket_send_message_sync.py`.
- scripts ops / tooling: `tools/validate_all_yamls.py`, `tools/sync_vuegraphs.py`, `Makefile`.
- packaging / bootstrap dev: `pyproject.toml`, `Dockerfile`, `frontend/Dockerfile`, `compose.yml`, `.env.example`, `.env.docker`.
- CI: `.github/workflows/validate-yamls.yml`.
- docs utilisateur backend/runtime: `docs/user_guide/en/*`, `docs/user_guide/zh/*`, `README.md`, `README-zh.md`.
- runtime/backend/frontend touches par couplage: `check/check.py`, `runtime/bootstrap/schema.py`, `server/services/websocket_manager.py`, `runtime/node/agent/memory/*`, `frontend/public/tutorial-*.md`.

## entrypoints
- `pyproject.toml` - dependances et configuration `pytest`.
- `tools/validate_all_yamls.py` - `validate_all` - script de verification CI le plus concret.
- `tools/sync_vuegraphs.py` - `sync_yaml_to_vuegraphs` - synchronisation YAML -> stockage frontend.
- `.github/workflows/validate-yamls.yml` - pipeline CI existante.
- `Dockerfile`, `compose.yml`, `Makefile` - surfaces de bootstrap et d'exploitation.

## key files
- `tests/test_websocket_send_message_sync.py` - valide `WebSocketManager.send_message_sync` cross-thread.
- `tests/test_mem0_memory.py` - couvre les filtres `user_id` / `agent_id`, update path et edge cases du store Mem0.
- `tests/test_memory_embedding_consistency.py` - couvre la robustesse dimensionnelle de `SimpleMemory` et le fallback d'`OpenAIEmbedding`.
- `tools/validate_all_yamls.py` - appelle `python -m check.check --path ...` sur toute la librairie YAML.
- `tools/sync_vuegraphs.py` - pousse tous les YAML vers l'API `vuegraphs`.
- `.github/workflows/validate-yamls.yml` - branche le script de validation dans la CI.
- `docs/user_guide/en/execution_logic.md`, `dynamic_execution.md`, `ws_frontend_logic.md`, `config_schema_contract.md` - docs les plus utiles pour relier code et comportement.

## feature inventory
- `tests.websocket_sync_contract`: tests. Fichiers `tests/test_websocket_send_message_sync.py`, `server/services/websocket_manager.py`. Symboles centraux `_make_manager`, `FakeWebSocket`, `TestSendMessageSync`, `TestOwnerLoopCapture`, `WebSocketManager.send_message_sync`. Statut reuse: copiable avec adaptation.
- `tests.memory_store_contracts`: tests. Fichiers `tests/test_mem0_memory.py`, `tests/test_memory_embedding_consistency.py`, `runtime/node/agent/memory/mem0_memory.py`, `runtime/node/agent/memory/simple_memory.py`, `runtime/node/agent/memory/embedding.py`. Symboles centraux `TestMem0MemoryRetrieve`, `TestMem0MemoryUpdate`, `TestSimpleMemoryRetrieveMixedDimensions`, `TestOpenAIEmbeddingDynamicFallback`. Statut reuse: copiable avec adaptation.
- `ops.yaml_validation_ci`: ops / CI. Fichiers `tools/validate_all_yamls.py`, `.github/workflows/validate-yamls.yml`, `Makefile`. Symboles centraux `validate_all`. Statut reuse: copiable tel quel.
- `ops.vuegraph_sync`: tooling frontend/backend. Fichiers `tools/sync_vuegraphs.py`, `server/routes/vuegraphs.py`, `server/services/vuegraphs_storage.py`. Symboles centraux `sync_yaml_to_vuegraphs`. Statut reuse: copiable avec adaptation.
- `ops.dev_bootstrap`: infra. Fichiers `pyproject.toml`, `Dockerfile`, `frontend/Dockerfile`, `compose.yml`, `.env.example`, `.env.docker`, `Makefile`. Symboles centraux: aucune API, mais variables et commandes de bootstrap reelles. Statut reuse: copiable avec adaptation.
- `docs.executable_reference`: docs / corpus d'exemples. Fichiers `docs/user_guide/en/config_schema_contract.md`, `docs/user_guide/en/dynamic_execution.md`, `docs/user_guide/en/execution_logic.md`, `docs/user_guide/en/modules/tooling/*.md`, `docs/user_guide/en/nodes/*.md`, `docs/user_guide/en/ws_frontend_logic.md`. Statut reuse: relire avec le code, ne pas copier comme source unique de verite.

## data flow
1. La CI lance `tools/validate_all_yamls.py`, qui parcourt `yaml_instance/` puis appelle `python -m check.check --path <yaml>`.
2. Les tests memoire et WebSocket ciblent des zones fragiles du runtime sans lancer toute l'application.
3. `tools/sync_vuegraphs.py` lit chaque YAML local, verifie qu'il parse, puis le POSTe a l'API `vuegraphs`.
4. `Makefile` et `compose.yml` exposent les chemins de demarrage de dev et de validation utilises dans le repo.
5. Les docs utilisateur servent surtout de pont entre comportement attendu et exemples YAML, mais ne remplacent pas la lecture du code.

## symbol map
- `tools/validate_all_yamls.py`: `validate_all`.
- `tools/sync_vuegraphs.py`: `sync_yaml_to_vuegraphs`.
- `tests/test_websocket_send_message_sync.py`: `_make_manager`, `FakeWebSocket`, `TestSendMessageSync`, `TestOwnerLoopCapture`.
- `tests/test_mem0_memory.py`: `_make_store`, `_make_mem0_memory`, `TestMem0MemoryRetrieve`, `TestMem0MemoryUpdate`, `TestMem0MemoryPipelineTextCleaning`, `TestMem0MemoryLoadSave`, `TestMem0MemoryConfig`, `TestMem0MemoryConstructor`.
- `tests/test_memory_embedding_consistency.py`: `_make_store`, `_make_embedding`, `_make_memory_item`, `TestSimpleMemoryRetrieveMixedDimensions`, `TestOpenAIEmbeddingDynamicFallback`.

## dependency map
- hard blocker - YAML validation path: `tools/validate_all_yamls.py` depend directement de `check/check.py` et donc de tout le bootstrap schema.
- hard blocker - websocket test contract: `tests/test_websocket_send_message_sync.py` stubbe plusieurs modules du runtime avant d'importer `WebSocketManager`. Le test reflete un vrai couplage circulaire serveur/runtime.
- medium blocker - vuegraph sync: `tools/sync_vuegraphs.py` suppose un backend vivant sur `http://localhost:6400/api/vuegraphs/upload/content`.
- medium blocker - docs are secondary sources: certaines docs sont plus generales que le code reel. Toujours recroiser avec `analysis/batches/02*.md`, `03*.md`, `04*.md`.
- inbound adapters utiles a lire avant extraction: `check/check.py`, `server/services/websocket_manager.py`, `runtime/node/agent/memory/simple_memory.py`, `runtime/node/agent/memory/mem0_memory.py`, `runtime/node/agent/memory/embedding.py`.

## external deps
- `uv`, `pytest`, `ruff`, Docker, Docker Compose, GitHub Actions.
- le `pyproject.toml` confirme aussi les deps runtime importantes: `openai`, `fastapi`, `mcp`, `fastmcp`, `faiss-cpu`, `google-genai`, `mem0ai`, `pandas`, `openpyxl`, `xhtml2pdf`.

## flags/env
- `.env.example` et `.env.docker` listent les variables d'execution principales.
- `BACKEND_BIND`, `PATH`, `VITE_API_BASE_URL`, `API_KEY`, `BASE_URL`, `MEM0_API_KEY`, `MODEL_NAME` sont parmi les plus structurantes.

## reusable ideas
- le test WebSocket est plus utile comme specification de comportement cross-thread que comme simple filet de regression.
- `validate_all_yamls.py` est un excellent candidat de reuse si votre futur projet garde un parseur YAML comparable.
- les docs `execution_logic.md`, `dynamic_execution.md` et `ws_frontend_logic.md` servent de cartes de lecture a combiner avec les batchs 02, 03 et 06.

## extraction recipes
1. Extraire la validation CI YAML.
   Fichiers a prendre d'abord: `tools/validate_all_yamls.py`, `.github/workflows/validate-yamls.yml`, `Makefile`.
   Dependances minimales: `check.check`.
   Strategie: copier tel quel si la commande de validation reste compatible.

2. Extraire le test contractuel WebSocket.
   Fichiers a prendre d'abord: `tests/test_websocket_send_message_sync.py`.
   Dependances minimales: `WebSocketManager` ou equivalent.
   Strategie: copier avec adaptation.

3. Extraire les tests memoire.
   Fichiers a prendre d'abord: `tests/test_mem0_memory.py`, `tests/test_memory_embedding_consistency.py`.
   Dependances minimales: votre implementation memoire.
   Strategie: copier avec adaptation.

4. Extraire le bootstrap dev.
   Fichiers a prendre d'abord: `pyproject.toml`, `Dockerfile`, `frontend/Dockerfile`, `compose.yml`, `.env.example`, `Makefile`.
   Dependances minimales: votre layout repo.
   Strategie: copier avec adaptation.

5. Extraire la sync YAML -> frontend.
   Fichiers a prendre d'abord: `tools/sync_vuegraphs.py`.
   Dependances minimales: API `vuegraphs` compatible.
   Strategie: copier avec adaptation.

## do not copy blindly
- `tools/sync_vuegraphs.py` hardcode l'URL `http://localhost:6400/api/vuegraphs/upload/content`. A adapter avant toute reutilisation.
- `tests/test_websocket_send_message_sync.py` stubbe des modules entiers pour contourner des imports circulaires. C'est une tres bonne alerte de coupling, pas juste un test.
- `docs/user_guide/en/workflow_authoring.md` et certaines docs de nodes peuvent decrire des intentions plus larges que le code reel actuel. Toujours verifier dans les batchs 01-06.
- `pyproject.toml` embarque beaucoup de dependances; ne pas le copier brut si vous ne reprenez pas toutes les briques ChatDev.

## minimal reusable slices
- slice `yaml-validation-ci`: `tools/validate_all_yamls.py`, `.github/workflows/validate-yamls.yml`, `Makefile`. Copiable tel quel.
- slice `websocket-contract-test`: `tests/test_websocket_send_message_sync.py`. Copiable avec adaptation.
- slice `memory-contract-tests`: `tests/test_mem0_memory.py`, `tests/test_memory_embedding_consistency.py`. Copiable avec adaptation.
- slice `vuegraph-sync`: `tools/sync_vuegraphs.py`. Copiable avec adaptation.
- slice `dev-bootstrap`: `pyproject.toml`, `Dockerfile`, `frontend/Dockerfile`, `compose.yml`, `.env.example`, `Makefile`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "validate_all|check.check|yaml_instance" tools/validate_all_yamls.py .github/workflows/validate-yamls.yml Makefile`
- `rg -n "send_message_sync|owner_loop|ThreadPoolExecutor|FakeWebSocket" tests/test_websocket_send_message_sync.py server/services/websocket_manager.py`
- `rg -n "Mem0Memory|search\\(|add\\(|threshold|agent_id|user_id" tests/test_mem0_memory.py runtime/node/agent/memory/mem0_memory.py`
- `rg -n "OpenAIEmbedding|SimpleMemory|mixed-dimensional|fallback" tests/test_memory_embedding_consistency.py runtime/node/agent/memory/simple_memory.py runtime/node/agent/memory/embedding.py`
- `rg -n "sync_yaml_to_vuegraphs|/api/vuegraphs/upload/content|yaml.safe_load" tools/sync_vuegraphs.py`
- `rg -n "validate-yamls|backend-tests|backend-lint|sync" Makefile`
- `rg -n "fastapi|openai|mcp|fastmcp|faiss-cpu|google-genai|mem0ai" pyproject.toml`

## copy risk
- copiable tel quel: `tools/validate_all_yamls.py`, `.github/workflows/validate-yamls.yml` si le parseur reste `check.check`.
- copiable avec adaptation: `tests/test_websocket_send_message_sync.py`, `tests/test_mem0_memory.py`, `tests/test_memory_embedding_consistency.py`, `tools/sync_vuegraphs.py`, `Makefile`, `compose.yml`.
- a reecrire ou a reduire avant copie: `pyproject.toml` si vous ne reprenez pas le meme produit.

## primary file slice
- `pyproject.toml`
- `tools/validate_all_yamls.py`
- `.github/workflows/validate-yamls.yml`
- `Makefile`
- `tests/test_websocket_send_message_sync.py`
- `tests/test_mem0_memory.py`
- `tests/test_memory_embedding_consistency.py`
- `tools/sync_vuegraphs.py`
- `Dockerfile`
- `frontend/Dockerfile`
- `compose.yml`
- `.env.example`
- `.env.docker`
- `docs/user_guide/en/config_schema_contract.md`
- `docs/user_guide/en/dynamic_execution.md`
- `docs/user_guide/en/execution_logic.md`
- `docs/user_guide/en/ws_frontend_logic.md`
- `docs/user_guide/en/modules/tooling/function.md`
- `docs/user_guide/en/modules/tooling/mcp.md`
- `docs/user_guide/en/nodes/agent.md`
- `docs/user_guide/en/nodes/python.md`
