# 02-workflow-orchestration - Workflow Orchestration, Topology, Execution

_Primary coverage_: 21 fichiers, 3890 lignes approx. dans ce batch.

## purpose
Porter le moteur d'orchestration des workflows YAML: construction du graphe runtime, detection des cycles, choix de strategie DAG/cycle/majority vote, execution des noeuds, composition de sous-graphes, et persistance des artefacts de run.

## subdomains
- coeur runtime: `workflow/graph.py`, `workflow/graph_context.py`, `workflow/runtime/runtime_builder.py`, `workflow/runtime/runtime_context.py`, `workflow/runtime/result_archiver.py`.
- orchestration de graphes/workflows: `workflow/graph_manager.py`, `workflow/topology_builder.py`, `workflow/cycle_manager.py`, `workflow/runtime/execution_strategy.py`, `workflow/executor/dag_executor.py`, `workflow/executor/cycle_executor.py`, `workflow/executor/parallel_executor.py`, `workflow/executor/resource_manager.py`.
- YAML-driven orchestration: `workflow/subgraph_loader.py`, `workflow/graph_manager.py::_build_subgraph`, `yaml_instance/demo_sub_graph.yaml`, `yaml_instance/subgraphs/react_agent.yaml`, `yaml_instance/react.yaml`, `yaml_instance/demo_majority_voting.yaml`, `yaml_instance/demo_dynamic.yaml`.
- glue code / SDK / session hooks: `runtime/sdk.py`, `workflow/hooks/workspace_artifact.py`, `server/routes/execute_sync.py`, `server/services/workflow_run_service.py`, `server/services/websocket_executor.py`.
- agents / providers / tools / functions touches par couplage, pas par implementation principale: `runtime/node/agent/memory/__init__.py`, `runtime/node/agent/thinking/__init__.py`, `runtime/node/agent/__init__.py`, `runtime/node/executor/factory.py`, `runtime/edge/conditions/registry.py`, `runtime/edge/processors/registry.py`, `utils/function_manager.py`.
- frontend Vue: aucun import direct depuis ce batch. Le frontend arrive via les routes serveur du batch `06-server-api-and-sessions`.
- tests / docs / infra: aucun test dedie dans `tests/` pour ce batch; les docs les plus proches sont `docs/user_guide/en/execution_logic.md` et `docs/user_guide/en/dynamic_execution.md`, et les YAML servent de documentation executable.

## entrypoints
- `runtime/sdk.py` - `run_workflow` - point d'entree Python le plus simple pour lancer un YAML avec prompt, pieces jointes et metadonnees de run.
- `workflow/graph.py` - `GraphExecutor.execute_graph`, `GraphExecutor.run` - coeur d'execution qui assemble les dependances runtime, prepare les edge managers, execute les noeuds et collecte la sortie finale.
- `workflow/graph_manager.py` - `GraphManager.build_graph` - transforme un `GraphContext` vide en graphe executable avec noeuds, aretes, cycles, couches et metadata.
- `workflow/subgraph_loader.py` - `load_subgraph_config` - charge un sous-graphe fichier, resout le chemin reel et renvoie une copie isolee du payload YAML.
- `workflow/hooks/workspace_artifact.py` - `WorkspaceArtifactHook` - hook optionnel pour sessions live qui detecte les fichiers crees/modifies dans le workspace.

## key files
- `workflow/graph.py` - `GraphExecutor` - orchestration complete du run, y compris memory/thinking/tool managers, edge conditions, dynamic edges, final output et archivage.
- `workflow/graph_manager.py` - `GraphManager` - construction du graphe, initialisation des aretes, injection des sous-graphes, determination des start nodes et metadata.
- `workflow/topology_builder.py` - `GraphTopologyBuilder` - briques stateless pour detecter les cycles, condenser en super-noeuds et produire les couches topologiques.
- `workflow/cycle_manager.py` - `CycleInfo`, `CycleDetector`, `CycleManager` - Tarjan SCC + metadata de cycle + entry/exit analysis.
- `workflow/executor/cycle_executor.py` - `CycleExecutor` - execution recursive des cycles et sous-cycles avec verification du point d'entree unique.
- `workflow/executor/dynamic_edge_executor.py` - `DynamicEdgeExecutor` - fan-out map / tree reduce au niveau des aretes.
- `workflow/runtime/execution_strategy.py` - `DagExecutionStrategy`, `CycleExecutionStrategy`, `MajorityVoteStrategy` - couche de selection de strategie.
- `workflow/subgraph_loader.py` - `load_subgraph_config` - plus petite brique reutilisable pour la composition YAML.
- `workflow/hooks/workspace_artifact.py` - `WorkspaceArtifactHook` - hook reusable pour sessions avec artefacts de workspace.
- `runtime/sdk.py` - `run_workflow` - surface glue utile pour reexposer le moteur dans un autre produit sans reprendre FastAPI.

## feature inventory
- `workflow.graph_executor_core`: coeur runtime + orchestration. Fichiers `workflow/graph.py`, `workflow/graph_context.py`, `workflow/runtime/runtime_builder.py`, `workflow/runtime/runtime_context.py`, `workflow/runtime/result_archiver.py`. Symboles centraux `GraphExecutor`, `GraphExecutor.run`, `GraphContext.record`, `RuntimeBuilder.build`, `ResultArchiver.export`. Statut reuse: copiable avec adaptation forte.
- `workflow.cycle_supernode_scheduler`: orchestration de graphes/workflows. Fichiers `workflow/cycle_manager.py`, `workflow/topology_builder.py`, `workflow/executor/cycle_executor.py`, `workflow/runtime/execution_strategy.py`. Symboles centraux `CycleDetector.detect_cycles`, `GraphTopologyBuilder.create_super_node_graph`, `CycleExecutor._validate_cycle_entry`, `CycleExecutor._execute_cycle_with_iterations`. Statut reuse: copiable avec adaptation.
- `workflow.dag_parallel_layers`: orchestration DAG minimale. Fichiers `workflow/executor/dag_executor.py`, `workflow/executor/parallel_executor.py`. Symboles centraux `DAGExecutor.execute`, `ParallelExecutor.execute_items_parallel`, `ParallelExecutor.execute_nodes_parallel`. Statut reuse: copiable tel quel a copiable avec adaptation faible selon votre logger.
- `workflow.dynamic_edge_runtime`: orchestration data-driven. Fichiers `workflow/executor/dynamic_edge_executor.py`, `workflow/graph.py`, `runtime/node/splitter.py`, `entity/configs/edge/dynamic_edge_config.py`. Symboles centraux `GraphExecutor._get_dynamic_config_for_node`, `GraphExecutor._execute_with_dynamic_config`, `DynamicEdgeExecutor.execute_from_inputs`, `DynamicEdgeExecutor._execute_map`, `DynamicEdgeExecutor._execute_tree`. Statut reuse: copiable avec adaptation.
- `workflow.subgraph_composition`: orchestration YAML. Fichiers `workflow/subgraph_loader.py`, `workflow/graph_manager.py::_build_subgraph`, `runtime/node/executor/subgraph_executor.py`, `yaml_instance/demo_sub_graph.yaml`, `yaml_instance/subgraphs/react_agent.yaml`, `yaml_instance/react.yaml`. Symboles centraux `load_subgraph_config`, `GraphManager._build_subgraph`, `SubgraphNodeExecutor.execute`. Statut reuse: copiable avec adaptation.
- `workflow.majority_vote_mode`: coeur runtime leger. Fichiers `workflow/runtime/execution_strategy.py`, `yaml_instance/demo_majority_voting.yaml`. Symboles centraux `MajorityVoteStrategy.run`, `MajorityVoteStrategy._collect_majority_result`. Statut reuse: copiable avec adaptation.
- `workflow.workspace_artifact_hook`: glue code / session execution. Fichiers `workflow/hooks/workspace_artifact.py`, `server/services/websocket_executor.py`. Symboles centraux `WorkspaceArtifactHook.before_node`, `WorkspaceArtifactHook.after_node`, `WebSocketGraphExecutor`. Statut reuse: copiable avec adaptation.
- `workflow.sdk_runner_with_attachments`: glue code / API serveur. Fichiers `runtime/sdk.py`, `utils/task_input.py`, `utils/attachments.py`, `server/routes/execute_sync.py`. Symboles centraux `run_workflow`, `_build_task_input`, `TaskInputBuilder.build_from_file_paths`, `_run_workflow_with_logger`. Statut reuse: copiable avec adaptation.

## data flow
1. `runtime/sdk.py::run_workflow` ou une route serveur charge le YAML via `check/check.py::load_config`, puis fabrique un `entity/graph_config.py::GraphConfig`.
2. `workflow/graph_context.py::GraphContext` installe le state mutable du run, choisit le dossier de sortie et prepare `vars`, `nodes`, `edges`, `layers`, `subgraphs`.
3. `workflow/graph_manager.py::GraphManager.build_graph` clone les `Node`, transforme les `EdgeConfig` en `EdgeLink`, detecte les cycles, calcule `layers` ou `cycle_execution_order`, puis remplit `metadata`.
4. `workflow/graph.py::GraphExecutor.__init__` appelle `workflow/runtime/runtime_builder.py::RuntimeBuilder.build`, ce qui injecte `ToolManager`, `FunctionManager`, `AttachmentStore`, `TokenTracker`, `LogManager` et le `code_workspace`.
5. `workflow/graph.py::GraphExecutor.run` compile les edge conditions et edge processors via `runtime/edge/conditions/registry.py::build_edge_condition_manager` et `runtime/edge/processors/registry.py::build_edge_processor`.
6. `workflow/graph.py::GraphExecutor._build_memories_and_thinking` attache les stores de memoire et managers de thinking venant du batch `04-agent-runtime`, puis instancie les executeurs de noeud via `runtime/node/executor/factory.py::NodeExecutorFactory.create_executors`.
7. `workflow/runtime/execution_strategy.py` choisit `DAGExecutor`, `CycleExecutor` ou `MajorityVoteStrategy`; chaque strategie rappelle `GraphExecutor._execute_node`.
8. `GraphExecutor._execute_node` applique au besoin `DynamicEdgeExecutor`, fait transiter les `Message` sur les `EdgeLink`, nettoie le contexte de noeud, puis `GraphContext.record` et `ResultArchiver.export` persistent outputs, logs et token usage.

## symbol map
- `runtime/sdk.py`: `WorkflowMetaInfo`, `WorkflowRunResult`, `_normalize_session_name`, `_build_task_input`, `_resolve_yaml_path`, `run_workflow`.
- `workflow/graph.py`: `ExecutionError`, `GraphExecutor`, `GraphExecutor.execute_graph`, `GraphExecutor.run`, `GraphExecutor._build_memories_and_thinking`, `GraphExecutor._prepare_edge_conditions`, `GraphExecutor._get_dynamic_config_for_node`, `GraphExecutor._execute_with_dynamic_config`, `GraphExecutor._execute_node`, `GraphExecutor._process_result`, `GraphExecutor.get_final_output_message`, `GraphExecutor._normalize_task_input`.
- `workflow/graph_manager.py`: `GraphManager`, `GraphManager.build_graph_structure`, `GraphManager._build_subgraph`, `GraphManager._initiate_edges`, `GraphManager._build_cycle_execution_order`, `GraphManager._build_metadata`, `GraphManager._determine_start_nodes`, `GraphManager.build_graph`.
- `workflow/topology_builder.py`: `GraphTopologyBuilder.detect_cycles`, `GraphTopologyBuilder.create_super_node_graph`, `GraphTopologyBuilder.topological_sort_super_nodes`, `GraphTopologyBuilder.build_execution_order`, `GraphTopologyBuilder.build_dag_layers`.
- `workflow/cycle_manager.py`: `CycleInfo`, `CycleDetector.detect_cycles`, `CycleManager.initialize_cycles`, `CycleManager._analyze_cycle_structure`, `CycleManager.activate_cycle`, `CycleManager.deactivate_cycle`.
- `workflow/executor/cycle_executor.py`: `CycleExecutor.execute`, `CycleExecutor._validate_cycle_entry`, `CycleExecutor._execute_cycle_with_iterations`, `CycleExecutor._detect_cycles_in_scope`, `CycleExecutor._build_scoped_nodes`, `CycleExecutor._build_topological_layers_in_scope`, `CycleExecutor._execute_scope_layers`, `CycleExecutor._execute_single_cycle_node_in_scope`, `CycleExecutor._is_initial_node_retriggered`.
- `workflow/executor/dag_executor.py`: `DAGExecutor.execute`, `DAGExecutor._execute_layer`.
- `workflow/executor/parallel_executor.py`: `ParallelExecutor.execute_items_parallel`, `ParallelExecutor.execute_nodes_parallel`.
- `workflow/executor/resource_manager.py`: `ResourceRequest`, `_ResourceSlot`, `ResourceManager.guard_node`, `ResourceManager._resolve_node_requests`.
- `workflow/executor/dynamic_edge_executor.py`: `DynamicEdgeExecutor.execute`, `DynamicEdgeExecutor.execute_from_inputs`, `DynamicEdgeExecutor._execute_map`, `DynamicEdgeExecutor._execute_tree`, `DynamicEdgeExecutor._execute_unit`, `DynamicEdgeExecutor._execute_group`.
- `workflow/graph_context.py`: `GraphContext`, `GraphContext.record`, `GraphContext.final_message`, `GraphContext.get_sink_nodes`, `GraphContext.to_dict`.
- `workflow/runtime/execution_strategy.py`: `DagExecutionStrategy`, `CycleExecutionStrategy`, `MajorityVoteStrategy`, `MajorityVoteStrategy._collect_majority_result`.
- `workflow/runtime/runtime_builder.py`: `RuntimeBuilder.build`.
- `workflow/runtime/runtime_context.py`: `RuntimeContext`.
- `workflow/runtime/result_archiver.py`: `ResultArchiver.export`.
- `workflow/subgraph_loader.py`: `_resolve_candidate_paths`, `_resolve_existing_path`, `_load_graph_dict`, `load_subgraph_config`.
- `workflow/hooks/workspace_artifact.py`: `WorkspaceArtifact`, `_FileSignature`, `_TrackedEntry`, `WorkspaceArtifactHook`, `WorkspaceArtifactHook.before_node`, `WorkspaceArtifactHook.after_node`.

## dependency map
- hard blocker - graph schema contract: `entity/graph_config.py::GraphConfig`, `entity/configs/node/node.py::Node`, `entity/configs/node/node.py::EdgeLink`, `entity/configs/edge/edge.py::EdgeConfig`, `entity/configs/edge/edge_condition.py::EdgeConditionConfig`. Sans ce contrat, `GraphManager`, `CycleExecutor` et `GraphExecutor` n'ont plus de type d'arete ni de mecanique de trigger.
- hard blocker - message contract: `entity/messages.py::Message`, `entity/messages.py::MessageRole`, `entity/messages.py::MessageBlockType`. Les inputs, outputs, dynamic edges, human prompts, artefacts et final results passent tous par ce format.
- hard blocker - node execution dispatch: `runtime/node/executor/factory.py::NodeExecutorFactory`, `runtime/node/executor/base.py::ExecutionContext`, `runtime/node/registry.py::get_node_registration`. `GraphExecutor` ne sait pas executer un noeud seul; il depend d'un registry + factory exterieurs.
- hard blocker - agent runtime injected into orchestrator: `runtime/node/agent/memory/__init__.py::MemoryFactory`, `runtime/node/agent/memory/__init__.py::MemoryManager`, `runtime/node/agent/thinking/__init__.py::ThinkingManagerFactory`, `runtime/node/agent/__init__.py::ToolManager`. Le batch 02 n'est donc pas un moteur neutre; il embarque deja du batch `04-agent-runtime`.
- hard blocker - edge plugin layer: `runtime/edge/conditions/registry.py::build_edge_condition_manager`, `runtime/edge/processors/registry.py::build_edge_processor`, `utils/function_manager.py::get_function_manager`. Les conditions d'aretes et transformations payload sont resolues dynamiquement a partir des repertoires de fonctions.
- medium blocker - dynamic splitting: `runtime/node/splitter.py::create_splitter_from_config`, `runtime/node/splitter.py::group_messages`, `entity/configs/edge/dynamic_edge_config.py::DynamicEdgeConfig`. Le map/tree runtime ne peut pas etre isole sans eux.
- medium blocker - session / attachment glue: `utils/attachments.py::AttachmentStore`, `utils/task_input.py::TaskInputBuilder`, `utils/human_prompt.py::HumanPromptService`, `utils/human_prompt.py::PromptChannel`. Requis si vous gardez les pieces jointes, les prompts humains ou le hook d'artefacts.
- inbound adapters utiles a lire avant extraction: `server/routes/execute_sync.py`, `server/services/workflow_run_service.py`, `server/services/websocket_executor.py`, `runtime/node/executor/subgraph_executor.py`, `run.py`. Ces fichiers montrent comment le batch 02 est instancie dans un produit reel.
- frontend: aucune dependance directe. Toute surface UI passe par les routes / websockets serveurs, pas par ce batch.

## external deps
- stdlib lourde mais simple: `threading`, `concurrent.futures`, `copy`, `dataclasses`, `pathlib`, `datetime`, `hashlib`, `mimetypes`, `os`, `time`.
- `yaml` est requis par `workflow/graph_context.py` pour la persistence `node_outputs.yaml` et `workflow_summary.yaml`.
- pas de SDK provider direct ici, mais `GraphExecutor` tire quand meme `ToolManager`, memory et thinking factories via les packages du batch `04-agent-runtime`.

## flags/env
- `runtime/sdk.py::OUTPUT_ROOT` fixe le dossier de sortie par defaut a `WareHouse/`.
- `server/settings.py::YAML_DIR` est utilise par `runtime/sdk.py::_resolve_yaml_path` et `server/routes/execute_sync.py::_resolve_yaml_path` pour retrouver les YAML relatifs.
- `utils/function_manager.py::MAC_EDGE_FUNCTIONS_DIR` et `utils/function_manager.py::MAC_EDGE_PROCESSOR_FUNCTIONS_DIR` modulent les repertoires reels de fonctions utilises par `RuntimeBuilder`.
- `workflow/graph_context.py` regarde `config.metadata["fixed_output_dir"]` et le prefixe `session_` pour decider si le dossier de sortie est stable ou timestamped.
- `workflow/graph_manager.py::_determine_start_nodes` depend de `graph.start`; ce moteur n'auto-detecte pas silencieusement les source nodes quand `start` est absent.

## reusable ideas
- la separation `GraphManager` / `GraphExecutor` / `ExecutionStrategy` est saine pour rebatir un moteur de workflow en plusieurs couches.
- `GraphTopologyBuilder` est la meilleure brique "pure" de ce batch: peu d'effets de bord, peu de dependances, facilement portable.
- `workflow/subgraph_loader.py` est une bonne extraction autonome si votre futur moteur veut juste de la composition YAML.
- `WorkspaceArtifactHook` est une brique rare et utile pour tout runtime agentique capable de produire des fichiers dans un workspace.

## extraction recipes
1. Extraire un moteur DAG minimal sans agents ni tools.
   Fichiers a prendre d'abord: `workflow/graph_manager.py`, `workflow/topology_builder.py`, `workflow/executor/dag_executor.py`, `workflow/executor/parallel_executor.py`, `workflow/graph_context.py`.
   Dependances minimales: `entity/graph_config.py`, `entity/configs/node/node.py`, `entity/messages.py`, un remplacement simple de `runtime/node/executor/factory.py`.
   Strategie: reechantillonner `workflow/graph.py` au lieu de le copier. Le `GraphExecutor` actuel traine memory/thinking/tools meme si votre cible n'en veut pas.

2. Extraire seulement le scheduler de cycles.
   Fichiers a prendre d'abord: `workflow/cycle_manager.py`, `workflow/topology_builder.py`, `workflow/executor/cycle_executor.py`.
   Dependances minimales: `entity/configs/node/node.py`, `utils/log_manager.py`, un callback `execute_node_func(node)`.
   Strategie: copier avec adaptation. Le contrat implicite a reproduire est `Node.predecessors`, `Node.successors`, `Node.iter_outgoing_edges()`, `Node.is_triggered()`, `EdgeLink.triggered`.

3. Extraire la composition de sous-graphes YAML.
   Fichiers a prendre d'abord: `workflow/subgraph_loader.py`, `workflow/graph_manager.py::_build_subgraph`, `runtime/node/executor/subgraph_executor.py`.
   Dependances minimales: `utils/io_utils.py::read_yaml`, `entity/graph_config.py::GraphConfig`, `workflow/graph_context.py::GraphContext`.
   Strategie: copier avec adaptation. Garder la resolution relative au YAML parent est le detail de reuse le plus utile; le deep-copy du sous-graphe a l'execution est le detail de surete a ne pas perdre.

4. Extraire le runtime map/tree des aretes dynamiques.
   Fichiers a prendre d'abord: `workflow/executor/dynamic_edge_executor.py`, `runtime/node/splitter.py`, `entity/configs/edge/dynamic_edge_config.py`, `entity/messages.py`.
   Dependances minimales: un `node_executor_func(node, inputs) -> List[Message]`, plus un contrat `Message.clone()` et metadata mutable.
   Strategie: copier avec adaptation. Le code est utile, mais il suppose des executeurs de noeud reentrants et une semantique precise des `Message.metadata`.

5. Extraire le hook d'artefacts workspace pour sessions live.
   Fichiers a prendre d'abord: `workflow/hooks/workspace_artifact.py`, `utils/attachments.py`, `utils/human_prompt.py`, `server/services/websocket_executor.py`.
   Dependances minimales: un `AttachmentStore`, un `PromptChannel`, et un callback `emit_callback`.
   Strategie: copier avec adaptation. Le scan recursive et l'enregistrement d'artefacts sont reutilisables, mais il faut recalibrer les seuils de scan et le protocole de diffusion d'evenements.

## do not copy blindly
- `workflow/graph.py` n'est pas un simple orchestrateur de graphes. Il importe directement `MemoryFactory`, `MemoryManager`, `ThinkingManagerFactory`, `ToolManager`, `NodeExecutorFactory`, les edge managers et le `ResourceManager`. Si vous le copiez tel quel dans un moteur plus petit, vous embarquez presque tout le runtime ChatDev.
- `workflow/graph_manager.py::_determine_start_nodes` impose `graph.start` meme pour des graphes DAG. Si votre futur produit attend une auto-detection des sources, il faut redecider cette regle au lieu de la subir.
- `workflow/executor/cycle_executor.py::_build_scoped_nodes` fait des copies superficielles de `Node` et reutilise des `EdgeLink` existants. Ce detail est suffisant pour la detection/scheduling locale actuelle, mais il est fragile si vous changez la mutabilite des noeuds ou l'implementation des edges.
- `workflow/executor/dynamic_edge_executor.py` execute en parallele sur le meme template `Node`. Cela n'est correct que si les executeurs de noeud ne mutent pas l'objet noeud partage de facon non thread-safe.
- `workflow/executor/parallel_executor.py` annonce dans sa docstring la serialisation de certains noeuds, mais dans les faits cette protection vient surtout de `workflow/executor/resource_manager.py` + `runtime/node/builtin_nodes.py` via `resource_key` / `resource_limit`. Copier `ParallelExecutor` seul fait perdre cette surete.
- `workflow/hooks/workspace_artifact.py` peut scanner beaucoup de fichiers et enregistrer des artefacts lourds. Sans revoir `max_files_scanned`, `max_bytes_scanned`, `exclude_dirs` et la politique `copy_file=False`, la copie peut etre couteuse ou dangereuse.
- `docs/user_guide/en/dynamic_execution.md` et `yaml_instance/demo_dynamic.yaml` sont utiles, mais certains exemples conservent des traces de l'ancien modele `dynamic` au niveau des noeuds. Le code source actuel ne lit le `dynamic` effectif qu'au niveau des aretes via `GraphManager._initiate_edges` et `GraphExecutor._get_dynamic_config_for_node`.

## minimal reusable slices
- slice `topology-only`: `workflow/topology_builder.py`, `workflow/cycle_manager.py`. Requis en plus: un contrat `Node` minimal. Copiable avec adaptation faible.
- slice `dag-layers`: `workflow/executor/dag_executor.py`, `workflow/executor/parallel_executor.py`. Requis en plus: un logger compatible et `Node.is_triggered()`. Copiable tel quel a presque tel quel.
- slice `cycle-scheduler`: `workflow/cycle_manager.py`, `workflow/topology_builder.py`, `workflow/executor/cycle_executor.py`. Requis en plus: `Node`, `EdgeLink`, callback d'execution. Copiable avec adaptation.
- slice `subgraph-loader`: `workflow/subgraph_loader.py`. Requis en plus: `read_yaml`, exception de config. Copiable tel quel a adaptation tres faible.
- slice `dynamic-map-tree`: `workflow/executor/dynamic_edge_executor.py`, `runtime/node/splitter.py`, `entity/messages.py`, `entity/configs/edge/dynamic_edge_config.py`. Copiable avec adaptation.
- slice `resource-gating`: `workflow/executor/resource_manager.py`, `runtime/node/registry.py`, `runtime/node/builtin_nodes.py`. Copiable avec adaptation.
- slice `workspace-artifacts`: `workflow/hooks/workspace_artifact.py`, `utils/attachments.py`, `utils/human_prompt.py`. Copiable avec adaptation.
- slice `sdk-entrypoint`: `runtime/sdk.py`, `utils/task_input.py`, `utils/attachments.py`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "execute_graph|def run\\(|_prepare_edge_conditions|_get_dynamic_config_for_node|_execute_with_dynamic_config|_execute_node|_process_result|get_final_output_message" workflow/graph.py`
- `rg -n "build_graph_structure|_build_subgraph|_initiate_edges|_build_cycle_execution_order|_determine_start_nodes|_build_metadata" workflow/graph_manager.py`
- `rg -n "detect_cycles|create_super_node_graph|topological_sort_super_nodes|build_dag_layers" workflow/topology_builder.py workflow/cycle_manager.py`
- `rg -n "_validate_cycle_entry|_execute_cycle_with_iterations|_build_scoped_nodes|_build_topological_layers_in_scope|_execute_scope_layers|_is_initial_node_retriggered" workflow/executor/cycle_executor.py`
- `rg -n "execute_from_inputs|_execute_map|_execute_tree|_execute_unit|_execute_group" workflow/executor/dynamic_edge_executor.py`
- `rg -n "load_subgraph_config|_resolve_candidate_paths|_resolve_existing_path" workflow/subgraph_loader.py`
- `rg -n "RuntimeBuilder|RuntimeContext|ResultArchiver|MajorityVoteStrategy" workflow/runtime`
- `rg -n "WorkspaceArtifactHook|before_node|after_node|prompt_channel" workflow/hooks/workspace_artifact.py server/services/websocket_executor.py`
- `rg -n "run_workflow\\(|_build_task_input|_resolve_yaml_path|GraphExecutor\\.execute_graph|GraphContext\\(" runtime/sdk.py server/routes/execute_sync.py server/services/workflow_run_service.py run.py`
- `rg -n "dynamic:|type: subgraph|is_majority_voting" yaml_instance/demo_dynamic.yaml yaml_instance/demo_sub_graph.yaml yaml_instance/react.yaml yaml_instance/demo_majority_voting.yaml yaml_instance/subgraphs/react_agent.yaml`

## copy risk
- copiable tel quel: `workflow/executor/parallel_executor.py` si vous acceptez son protocole de logger; `workflow/subgraph_loader.py` si vous remplacez simplement `read_yaml` et `ConfigError`.
- copiable avec adaptation: `workflow/topology_builder.py`, `workflow/cycle_manager.py`, `workflow/executor/cycle_executor.py`, `workflow/executor/dag_executor.py`, `workflow/executor/dynamic_edge_executor.py`, `workflow/executor/resource_manager.py`, `workflow/hooks/workspace_artifact.py`, `runtime/sdk.py`.
- a reecrire ou a extraire par morceaux plutot que copier: `workflow/graph.py`, `workflow/runtime/runtime_builder.py`, `workflow/runtime/runtime_context.py`. Ces fichiers sont trop couples au reste du runtime ChatDev pour etre de bons candidats "copy-paste".

## primary file slice
- `runtime/sdk.py`
- `workflow/graph.py`
- `workflow/graph_context.py`
- `workflow/graph_manager.py`
- `workflow/topology_builder.py`
- `workflow/cycle_manager.py`
- `workflow/runtime/execution_strategy.py`
- `workflow/executor/dag_executor.py`
- `workflow/executor/cycle_executor.py`
- `workflow/executor/dynamic_edge_executor.py`
- `workflow/executor/parallel_executor.py`
- `workflow/executor/resource_manager.py`
- `workflow/subgraph_loader.py`
- `workflow/hooks/workspace_artifact.py`
- `workflow/runtime/runtime_builder.py`
- `workflow/runtime/runtime_context.py`
- `workflow/runtime/result_archiver.py`
