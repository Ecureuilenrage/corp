# Reuse Candidates

Classement transverse des briques les plus faciles a extraire a partir du code reel. Les chemins listes sont les premiers fichiers a lire; les symboles cites sont les vraies surfaces de coupe.

## Top 10 A Extraire D Abord

### 1. `schema.message_contract`
Chemins: `entity/messages.py`.
Symboles critiques: `MessageRole`, `MessageBlockType`, `AttachmentRef`, `MessageBlock`, `ToolCallPayload`, `Message`, `serialize_messages`, `deserialize_messages`.
Dependances minimales: aucune brique ChatDev en dessous de ce contrat.
Coupling: low.
Strategie: `copier`.
Pourquoi en premier: tout le runtime, les tools, les artefacts, le human loop et le frontend indirect reposent sur cette forme de message.

### 2. `shared.generic_registry`
Chemins: `utils/registry.py`.
Symboles critiques: `Registry`, `Registry.register`, `Registry.get`, `Registry.names`, `Registry.items`, `RegistryEntry`, `RegistryEntry.load`, `RegistryError`.
Dependances minimales: stdlib uniquement.
Coupling: low.
Strategie: `copier`.
Pourquoi en premier: c est la petite brique commune qui alimente ensuite les registries de schemas, providers, memories, thinking et edge plugins.

### 3. `tools.file_suite`
Chemins: `functions/function_calling/file.py`.
Symboles critiques: `FileToolContext`, `read_file`, `write_file`, `apply_text_edits`, `search_in_files`, `list_files`, `copy_path`, `move_path`.
Dependances minimales: `utils/function_catalog.py`.
Coupling: low.
Strategie: `copier`.
Pourquoi en premier: c est une suite quasi autonome pour donner a un agent des capacites workspace immediates.

### 4. `tools.function_json_schema_catalog`
Chemins: `utils/function_catalog.py`, `utils/function_manager.py`.
Symboles critiques: `FunctionCatalog`, `get_function_catalog`, `_build_function_metadata`, `FunctionManager`, `get_function_manager`.
Dependances minimales: annotations Python standard et vos modules de fonctions.
Coupling: low.
Strategie: `adapter`.
Pourquoi en premier: cette brique fait le pont entre fonctions Python et surfaces JSON schema/tool calling.

### 5. `shared.placeholder_resolution`
Chemins: `utils/vars_resolver.py`, `utils/env_loader.py`.
Symboles critiques: `PlaceholderResolver`, `resolve_design_placeholders`, `resolve_mapping_with_vars`, `load_dotenv_file`, `build_env_var_map`.
Dependances minimales: aucune hors stdlib.
Coupling: low.
Strategie: `copier`.
Pourquoi en premier: utile des qu un YAML ou une config doit interpoler `${VAR}` sans emporter le reste de ChatDev.

### 6. `shared.task_input_builder`
Chemins: `utils/task_input.py`, `utils/attachments.py`.
Symboles critiques: `TaskInputBuilder`, `TaskInputBuilder.build_from_file_paths`, `TaskInputBuilder.build_from_blocks`, `AttachmentStore`.
Dependances minimales: `entity/messages.py`.
Coupling: low.
Strategie: `adapter`.
Pourquoi en premier: plus petite extraction viable pour transformer prompt plus fichiers en `List[Message]`.

### 7. `schema.schema_bootstrap_registry`
Chemins: `runtime/bootstrap/schema.py`, `schema_registry/registry.py`.
Symboles critiques: `ensure_schema_registry_populated`, `register_node_type`, `register_memory_store`, `register_thinking_manager`, `register_provider`, `register_tooling_type`, `register_subgraph_source`, `register_dynamic_edge_type`.
Dependances minimales: modules builtin enregistres dans `runtime/node/builtin_nodes.py`, `runtime/node/agent/memory/builtin_stores.py`, `runtime/node/agent/thinking/builtin_thinking.py`, `runtime/node/agent/providers/builtin_providers.py`.
Coupling: medium.
Strategie: `adapter`.
Pourquoi en premier: c est la facon la plus compacte de recuperer le coeur declaratif des schemas sans embarquer tout le moteur.

### 8. `runtime.node_registry_factory`
Chemins: `runtime/node/registry.py`, `runtime/node/builtin_nodes.py`, `runtime/node/executor/factory.py`.
Symboles critiques: `NodeCapabilities`, `NodeRegistration`, `register_node_type`, `get_node_registration`, `iter_node_registrations`, `NodeExecutorFactory`.
Dependances minimales: `runtime/node/executor/base.py`, schemas de noeuds, executors cibles.
Coupling: medium.
Strategie: `adapter`.
Pourquoi en premier: meilleure extraction pour un futur workflow engine ou agent runtime base sur un registry de noeuds.

### 9. `agent.provider_registry_abstraction`
Chemins: `runtime/node/agent/providers/base.py`, `runtime/node/agent/providers/builtin_providers.py`, `runtime/node/agent/providers/response.py`, `runtime/node/agent/providers/openai_provider.py`, `runtime/node/agent/providers/gemini_provider.py`.
Symboles critiques: `ModelProvider`, `ProviderRegistry`, `ProviderRegistry.register`, `ProviderRegistry.get`, `ModelResponse`, `ToolCallRequest`.
Dependances minimales: `entity/messages.py`, `entity/tool_spec.py`, `utils/token_tracker.py`.
Coupling: medium.
Strategie: `adapter`.
Pourquoi en premier: abstraction simple pour brancher plusieurs providers sans recopier tout `AgentNodeExecutor`.

### 10. `shared.schema_exporter`
Chemins: `utils/schema_exporter.py`, puis `server/config_schema_router.py` si vous voulez l exposer.
Symboles critiques: `Breadcrumb`, `_resolve_config_class`, `_serialize_field`, `build_schema_response`.
Dependances minimales: `BaseConfig`, `FIELD_SPECS`, `child_routes`, `entity/configs/graph.py`.
Coupling: medium.
Strategie: `adapter`.
Pourquoi en premier: brique cle pour regagner tres vite une UI schema-driven ou un configurateur declaratif.

## Copiable Tel Quel

- `schema.message_contract`: contrat de message central, tres peu couple hors serialisation et types Python.
- `shared.generic_registry`: helper minimal de registre paresseux, meilleur point de depart que les registries specialises.
- `shared.placeholder_resolution`: resolution `${VAR}` propre et compacte.
- `tools.file_suite`: suite workspace utile telle quelle si votre politique de securite accepte les operations fichiers exposees.
- `agent.skill_frontmatter_loader`: discovery locale de skills via `SKILL.md` et frontmatter YAML.
- `ops.yaml_validation_ci`: script et workflow CI pour verrouiller un corpus YAML.

## Copiable Avec Adaptation

- `schema.schema_bootstrap_registry`: emporter avec les modules builtin que vous voulez vraiment enregistrer.
- `schema.subgraph_source_registry`: simple, mais lie au contrat `subgraph` et aux `child_routes`.
- `schema.tooling_config_registry`: utile si vous gardez la surface tooling ChatDev.
- `schema.design_validation`: bonne base si vous conservez `DesignConfig`, `Node`, `EdgeLink`, `EdgeConfig`.
- `runtime.node_registry_factory`: extraction propre pour registry plus factory d executors.
- `runtime.edge_plugin_pipeline`: tres reutilisable, mais seulement si vous gardez le contrat d arete et de messages.
- `runtime.dynamic_edges`: bon slice si vous voulez `map` ou `tree`, sinon trop specifique.
- `runtime.subgraph_composition`: vaut le coup si votre YAML supporte des sous-graphes par fichier.
- `workflow.subgraph_yaml_loader`: petite extraction de composition, plus simple que le runtime complet.
- `workflow.graph_executor`: a adapter par morceaux, pas a copier seul.
- `workflow.cycle_supernode_scheduler`: interessant si votre moteur doit accepter des cycles riches.
- `agent.provider_registry_abstraction`: meilleure coupe pour multi-provider minimal.
- `agent.memory_store_runtime`: a garder seulement si vous avez besoin des stores `simple`, `file`, `blackboard` ou `mem0`.
- `agent.thinking_reflection_runtime`: utile si vous voulez une couche de self-reflection detachable.
- `agent.execution_pipeline`: a redecouper avant extraction; le coeur utile est dans provider, tool manager, memory et thinking.
- `agent.mcp_tool_bridge`: tres utile, mais fortement lie a `FunctionManager`, `ToolSpec` et `tool_manager.py`.
- `agent.skills_runtime`: simple si vous gardez la convention `.agents/skills/*`.
- `tools.function_json_schema_catalog`: adapte vite a vos propres modules de fonctions.
- `tools.workspace_command_runner`: a reprendre en revalidant sandbox, timeout et installation de paquets.
- `tools.deep_research_report_suite`: puissant mais stateful; a adapter a votre stockage de rapports.
- `api.config_schema_endpoint`: excellente extraction si vous avez deja `build_schema_response`.
- `api.workflow_storage_crud`: utile pour CRUD YAML, mais lie aux conventions de validation et de noms.
- `api.sync_streaming_execution`: bon exemple de facade HTTP ou SSE autour du moteur.
- `api.batch_ingestion`: a reprendre seulement si vos batchs sont CSV ou XLSX.
- `api.artifact_event_dispatch`: petite brique utile pour exposer les fichiers produits par un run.
- `api.websocket_human_loop`: extraction possible, mais seulement avec le protocole session et artefacts complet.
- `shared.attachment_store`: propre, mais il faut redecider la politique de persistance des fichiers.
- `shared.task_input_builder`: petite adaptation autour de votre propre contrat de messages.
- `shared.human_prompt_channel`: bonne coupe si vous avez deja un canal humain ou console.
- `shared.schema_exporter`: utile des que votre modele de config expose `FIELD_SPECS`.
- `shared.workflow_logging`: bonne pile, mais tres liee aux enums et evenements ChatDev.
- `frontend.schema_driven_forms`: utile si vous gardez l API schema backend.
- `frontend.workflow_editor_console`: a adapter avec prudence a cause du protocole YAML plus vuegraph.
- `frontend.launch_execution_console`: a adapter avec prudence a cause des evenements WebSocket et des artefacts.
- `frontend.batch_run_console`: viable si vous gardez les routes batch et websocket.
- `frontend.yaml_form_serialization`: bonne petite coupe si votre forme YAML reste proche de ChatDev.
- `yaml.dynamic_edge_examples`: excellent support pour valider une extraction dynamic edge.
- `yaml.subgraph_examples`: bon point d entree pour tester la composition.
- `yaml.memory_examples`: utiles pour recabler vite le runtime memoire.
- `yaml.workflow_library`: utile comme corpus de regression et de templates.
- `tests.websocket_sync_contract`: tres bon test de non-regression pour votre propre `WebSocketManager`.
- `ops.vuegraph_sync`: utile seulement si vous gardez la persistence `vuegraph`.

## A Reecrire Comme Ensemble Monolithique

- `agent.execution_pipeline`: ne pas essayer de copier `runtime/node/executor/agent_executor.py` seul; recomposer plutot `provider_registry_abstraction` + `memory_store_runtime` + `tool_manager`.
- `api.websocket_human_loop`: la valeur est dans le protocole et les services satellites, pas dans une copie brute de la route WebSocket.
- `frontend.workflow_editor_console`: trop couple a l API schema, au stockage YAML, au stockage vuegraph et au client API maison pour une copie directe.
- `workflow.graph_executor`: a reprendre par couches si vous changez `GraphContext`, `ExecutionContext` ou le contrat de noeud.

## Hubs Techniques A Lire En Premier

- `entity/messages.py`: hub transverse numero un; sans lui, tools, memories, attachments, human prompts et artefacts divergent.
- `utils/registry.py`: hub minimal pour comprendre la plupart des registries du projet.
- `runtime/bootstrap/schema.py`: hub de bootstrap declaratif des schemas.
- `runtime/node/registry.py`: hub du runtime noeud plus factory.
- `runtime/node/agent/tool/tool_manager.py`: hub de function calling, MCP et tools locaux.
- `utils/function_manager.py`: hub des fonctions Python chargees dynamiquement.
- `workflow/graph.py`: hub d orchestration globale et d execution strategy.
- `server/config_schema_router.py`: hub entre config Python et frontend schema-driven.
- `server/services/websocket_manager.py`: hub du protocole session live.
- `frontend/src/utils/apiFunctions.js`: hub du couplage frontend vers les routes backend.

## Couplages A Eviter

- `Message` plus `MessageBlock` plus attachments: ne cassez pas ce contrat si vous extrayez tools, memories ou human prompts.
- `ToolManager` plus `FunctionManager` plus `entity/configs/node/tooling.py`: copier un seul morceau produit vite un faux runtime de tools.
- `build_schema_response` plus `FIELD_SPECS` plus `FormGenerator.vue`: le backend schema-driven n existe pas sans les trois.
- `WebSocketManager` plus `session_execution.py` plus `LaunchView.vue` ou `BatchRunView.vue`: le protocole maison est plus important que chaque fichier pris isolement.
- `workflow/graph.py` plus `runtime/node/executor/base.py` plus `runtime/node/executor/factory.py`: le moteur depend d un contrat d execution partage.
- `yaml_template/design.yaml` et `frontend/public/design_0.4.0.yaml`: utiles comme reference secondaire, mais le code Python reste la source de verite.
