# 03-node-edge-runtime - Node And Edge Runtime

_Primary coverage_: 30 fichiers, 2342 lignes approx. dans ce batch.

## purpose
Implementer la couche intermediaire qui fait le lien entre le graphe orchestral et les comportements concrets des noeuds et des aretes: registre de types de noeuds, contrat d'execution, executeurs builtin non-agent, pipeline pluginable des conditions/processors d'aretes, et splitters reutilises par les aretes dynamiques.

## subdomains
- coeur runtime: `runtime/node/registry.py`, `runtime/node/builtin_nodes.py`, `runtime/node/executor/base.py`, `runtime/node/executor/factory.py`.
- node registry et executors: `runtime/node/executor/human_executor.py`, `runtime/node/executor/literal_executor.py`, `runtime/node/executor/passthrough_executor.py`, `runtime/node/executor/python_executor.py`, `runtime/node/executor/subgraph_executor.py`, `runtime/node/executor/loop_counter_executor.py`, `runtime/node/executor/loop_timer_executor.py`.
- edge conditions et edge processors: `runtime/edge/conditions/base.py`, `runtime/edge/conditions/registry.py`, `runtime/edge/conditions/function_manager.py`, `runtime/edge/conditions/keyword_manager.py`, `runtime/edge/processors/base.py`, `runtime/edge/processors/registry.py`, `runtime/edge/processors/function_processor.py`, `runtime/edge/processors/regex_processor.py`.
- functions / tools touches par couplage: `functions/edge/conditions.py`, `functions/edge_processor/transformers.py`, `utils/function_manager.py`, `functions/function_calling/file.py`.
- orchestration graph/workflow touchee par couplage: `runtime/node/executor/subgraph_executor.py` vers `workflow/graph.py`, `runtime/node/splitter.py` reutilise par `workflow/executor/dynamic_edge_executor.py`, `runtime/node/builtin_nodes.py` expose les `resource_key` lus par `workflow/executor/resource_manager.py`.
- agents / providers touches par couplage cache: `runtime/node/executor/base.py` importe `MemoryManager`, `ThinkingManagerBase`, `ToolManager` depuis le batch `04-agent-runtime`.
- YAML declaratif / executable docs: `yaml_instance/demo_code.yaml`, `yaml_instance/demo_human.yaml`, `yaml_instance/demo_edge_transform.yaml`, `yaml_instance/demo_loop_counter.yaml`, `yaml_instance/demo_loop_timer.yaml`, `yaml_instance/demo_context_reset.yaml`, `yaml_instance/demo_sub_graph.yaml`.
- docs / tests / infra: pas de tests dedies dans `tests/`; les docs utiles sont `docs/user_guide/en/nodes/python.md`, `docs/user_guide/en/nodes/human.md`, `docs/user_guide/en/nodes/passthrough.md`, `docs/user_guide/en/nodes/loop_counter.md`, `docs/user_guide/en/nodes/loop_timer.md`, `docs/user_guide/en/nodes/subgraph.md`, `docs/user_guide/en/dynamic_execution.md`, `docs/user_guide/en/workflow_authoring.md`.
- frontend Vue: aucun import direct.

## entrypoints
- `runtime/node/builtin_nodes.py` - `register_node_type(...)` au chargement du module - point de branchement des types builtin.
- `runtime/node/executor/factory.py` - `NodeExecutorFactory.create_executors`, `NodeExecutorFactory.create_executor` - fabrique les executeurs reels a partir du registre.
- `runtime/edge/conditions/builtin_types.py` - `register_edge_condition(...)` - branche les conditions `function` et `keyword`.
- `runtime/edge/processors/builtin_types.py` - `register_edge_processor(...)` - branche les processors `regex_extract` et `function`.
- `runtime/node/splitter.py` - `create_splitter`, `create_splitter_from_config` - surface minimale pour la logique map/tree.

## key files
- `runtime/node/registry.py` - `NodeCapabilities`, `NodeRegistration`, `register_node_type`, `get_node_registration`, `iter_node_registrations`.
- `runtime/node/builtin_nodes.py` - enregistrement des types `agent`, `human`, `subgraph`, `python`, `passthrough`, `literal`, `loop_counter`, `loop_timer`.
- `runtime/node/executor/base.py` - `ExecutionContext`, `NodeExecutor` - contrat commun impose a tous les executeurs.
- `runtime/node/executor/python_executor.py` - `PythonNodeExecutor` - execute du code Python trouve dans le dernier message d'entree.
- `runtime/node/executor/subgraph_executor.py` - `SubgraphNodeExecutor` - adapte un sous-graphe comme noeud en reinvoquant `workflow/graph.py::GraphExecutor`.
- `runtime/edge/conditions/base.py` - `EdgeConditionManager` - applique clear context, keep_message, role rewrite, tagging `_from_dynamic_edge` et triggering.
- `runtime/edge/processors/regex_processor.py` - `RegexEdgePayloadProcessor` - extraction regex avec `pass/default/drop`.
- `runtime/edge/processors/function_processor.py` - `FunctionEdgePayloadProcessor` - transforme un `Message` via une fonction Python.
- `runtime/node/splitter.py` - `MessageSplitter`, `RegexSplitter`, `JsonPathSplitter`, `group_messages`.
- `functions/edge_processor/transformers.py` - `uppercase_payload`, `code_save_and_run` - examples concrets de functions processors, dont un tres dangereux.

## feature inventory
- `runtime.node_registry_factory`: coeur runtime. Fichiers `runtime/node/registry.py`, `runtime/node/builtin_nodes.py`, `runtime/node/executor/factory.py`. Symboles centraux `NodeRegistration`, `NodeCapabilities`, `register_node_type`, `iter_node_registrations`, `NodeExecutorFactory.create_executors`. Statut reuse: copiable avec adaptation.
- `runtime.node_execution_contract`: coeur runtime. Fichier `runtime/node/executor/base.py`. Symboles centraux `ExecutionContext`, `NodeExecutor.execute`, `_build_message`, `_inputs_to_text`, `_ensure_not_cancelled`. Statut reuse: a reecrire ou alleguer si vous ne voulez pas trainer la couche agent.
- `runtime.simple_builtin_nodes`: executeurs simples. Fichiers `runtime/node/executor/human_executor.py`, `runtime/node/executor/literal_executor.py`, `runtime/node/executor/passthrough_executor.py`. Symboles centraux `HumanNodeExecutor.execute`, `LiteralNodeExecutor.execute`, `PassthroughNodeExecutor.execute`. Statut reuse: copiable tel quel a adaptation faible.
- `runtime.python_workspace_executor`: tools / workspace runtime. Fichiers `runtime/node/executor/python_executor.py`, `yaml_instance/demo_code.yaml`, `docs/user_guide/en/nodes/python.md`. Symboles centraux `PythonNodeExecutor.execute`, `_ensure_workspace_root`, `_extract_code`, `_write_script_file`, `_run_process`, `_build_failure_message`. Statut reuse: copiable avec adaptation apres revue securite.
- `runtime.loop_guard_nodes`: runtime de controle. Fichiers `runtime/node/executor/loop_counter_executor.py`, `runtime/node/executor/loop_timer_executor.py`, `yaml_instance/demo_loop_counter.yaml`, `yaml_instance/demo_loop_timer.yaml`. Symboles centraux `LoopCounterNodeExecutor.execute`, `LoopTimerNodeExecutor.execute`. Statut reuse: copiable avec adaptation.
- `runtime.subgraph_node_adapter`: orchestration bridge. Fichiers `runtime/node/executor/subgraph_executor.py`, `workflow/subgraph_loader.py`, `workflow/graph.py`, `yaml_instance/demo_sub_graph.yaml`. Symboles centraux `SubgraphNodeExecutor.execute`. Statut reuse: copiable avec adaptation forte.
- `runtime.edge_condition_pipeline`: functions / edge runtime. Fichiers `runtime/edge/conditions/base.py`, `runtime/edge/conditions/registry.py`, `runtime/edge/conditions/function_manager.py`, `runtime/edge/conditions/keyword_manager.py`, `functions/edge/conditions.py`. Symboles centraux `EdgeConditionManager._process_with_condition`, `build_edge_condition_manager`, `FunctionEdgeConditionManager`, `KeywordEdgeConditionManager`. Statut reuse: copiable avec adaptation.
- `runtime.edge_payload_processor_pipeline`: payload transformation runtime. Fichiers `runtime/edge/processors/base.py`, `runtime/edge/processors/registry.py`, `runtime/edge/processors/function_processor.py`, `runtime/edge/processors/regex_processor.py`, `functions/edge_processor/transformers.py`, `yaml_instance/demo_edge_transform.yaml`. Symboles centraux `EdgePayloadProcessor.transform`, `build_edge_processor`, `FunctionEdgePayloadProcessor._coerce_result`, `RegexEdgePayloadProcessor.transform`. Statut reuse: copiable avec adaptation.
- `runtime.message_splitters`: support des aretes dynamiques. Fichiers `runtime/node/splitter.py`, `workflow/executor/dynamic_edge_executor.py`, `yaml_instance/demo_dynamic.yaml`. Symboles centraux `create_splitter_from_config`, `MessageSplitter.split`, `RegexSplitter.split`, `JsonPathSplitter.split`, `group_messages`. Statut reuse: copiable avec adaptation faible.
- `runtime.edge_context_reset`: edge behavior exact. Fichiers `runtime/edge/conditions/base.py`, `yaml_instance/demo_context_reset.yaml`. Symboles centraux `EdgeConditionManager._clear_target_context`, `EdgeConditionManager._prepare_payload_for_target`. Statut reuse: copiable avec adaptation.

## data flow
1. Au premier acces, `runtime/node/registry.py::_ensure_builtins_loaded` importe `runtime/node/builtin_nodes.py`, ce qui peuple le registre de types et le schema registry.
2. `runtime/node/executor/factory.py::NodeExecutorFactory.create_executors` parcourt `iter_node_registrations()` et construit un executeur par type a partir du `ExecutionContext`.
3. Chaque `NodeExecutor.execute(node, inputs)` renvoie une `List[Message]`; meme les noeuds simples suivent ce contrat.
4. Quand `workflow/graph.py` traite une arete, `runtime/edge/conditions/registry.py::build_edge_condition_manager` instancie un `EdgeConditionManager` a partir du type declaratif.
5. `runtime/edge/conditions/base.py::EdgeConditionManager._process_with_condition` evalue la condition, gere `clear_context` / `clear_kept_context`, clone le payload, reecrit parfois le role, applique le processor, ajoute les tags de dynamic edge puis declenche l'arete.
6. Si un processor est configure, `runtime/edge/processors/registry.py::build_edge_processor` retourne un `RegexEdgePayloadProcessor` ou `FunctionEdgePayloadProcessor`, qui modifie ou supprime le `Message`.
7. Si l'arete est dynamique, `runtime/node/splitter.py` decompose les messages en unites pour `workflow/executor/dynamic_edge_executor.py`.
8. Pour les noeuds `python`, `subgraph`, `loop_counter` et `loop_timer`, l'etat persistant repose sur `ExecutionContext.global_state`, le workspace partage, ou l'appel recursive au batch `02-workflow-orchestration`.

## symbol map
- `runtime/node/registry.py`: `NodeCapabilities`, `NodeRegistration`, `NodeRegistration.build_executor`, `register_node_type`, `get_node_registration`, `iter_node_registrations`.
- `runtime/node/builtin_nodes.py`: `register_node_type(...)`, `register_subgraph_source(...)`.
- `runtime/node/executor/base.py`: `ExecutionContext`, `ExecutionContext.get_memory_manager`, `ExecutionContext.get_thinking_manager`, `ExecutionContext.get_human_prompt_service`, `NodeExecutor`, `NodeExecutor.execute`, `NodeExecutor._inputs_to_text`, `NodeExecutor._build_message`, `NodeExecutor._ensure_not_cancelled`.
- `runtime/node/executor/factory.py`: `NodeExecutorFactory.create_executors`, `NodeExecutorFactory.create_executor`.
- `runtime/node/executor/human_executor.py`: `HumanNodeExecutor.execute`.
- `runtime/node/executor/literal_executor.py`: `LiteralNodeExecutor.execute`.
- `runtime/node/executor/passthrough_executor.py`: `PassthroughNodeExecutor.execute`.
- `runtime/node/executor/python_executor.py`: `_ExecutionResult`, `PythonNodeExecutor.execute`, `PythonNodeExecutor._ensure_workspace_root`, `PythonNodeExecutor._extract_code`, `PythonNodeExecutor._write_script_file`, `PythonNodeExecutor._run_process`, `PythonNodeExecutor._build_failure_message`.
- `runtime/node/executor/subgraph_executor.py`: `SubgraphNodeExecutor.execute`.
- `runtime/node/executor/loop_counter_executor.py`: `LoopCounterNodeExecutor.execute`.
- `runtime/node/executor/loop_timer_executor.py`: `LoopTimerNodeExecutor.execute`, `LoopTimerNodeExecutor._convert_to_seconds`.
- `runtime/edge/conditions/base.py`: `ConditionFactoryContext`, `EdgeConditionManager.process`, `EdgeConditionManager.transform_payload`, `EdgeConditionManager._process_with_condition`, `EdgeConditionManager._prepare_payload_for_target`, `EdgeConditionManager._clear_target_context`.
- `runtime/edge/conditions/function_manager.py`: `FunctionEdgeConditionManager`, `FunctionEdgeConditionManager._build_evaluator`, `FunctionEdgeConditionManager._resolve_function`.
- `runtime/edge/conditions/keyword_manager.py`: `KeywordEdgeConditionManager`, `KeywordEdgeConditionManager._evaluate`.
- `runtime/edge/conditions/registry.py`: `EdgeConditionRegistration`, `register_edge_condition`, `get_edge_condition_registration`, `iter_edge_condition_registrations`, `build_edge_condition_manager`.
- `runtime/edge/processors/base.py`: `ProcessorFactoryContext`, `EdgePayloadProcessor.transform`.
- `runtime/edge/processors/function_processor.py`: `FunctionEdgePayloadProcessor`, `FunctionEdgePayloadProcessor.transform`, `FunctionEdgePayloadProcessor._resolve`, `FunctionEdgePayloadProcessor._coerce_result`.
- `runtime/edge/processors/regex_processor.py`: `RegexEdgePayloadProcessor`, `RegexEdgePayloadProcessor.transform`, `RegexEdgePayloadProcessor._extract_values`, `RegexEdgePayloadProcessor._handle_no_match`.
- `runtime/edge/processors/registry.py`: `EdgeProcessorRegistration`, `register_edge_processor`, `get_edge_processor_registration`, `iter_edge_processor_registrations`, `build_edge_processor`.
- `runtime/node/splitter.py`: `Splitter`, `MessageSplitter`, `RegexSplitter`, `JsonPathSplitter`, `create_splitter`, `create_splitter_from_config`, `group_messages`.
- `functions/edge/conditions.py`: `contains_keyword`, `not_contains_keyword`, `code_pass`, `code_fail`, `need_reflection_loop`, `should_stop_loop`.
- `functions/edge_processor/transformers.py`: `uppercase_payload`, `code_save_and_run`.

## dependency map
- hard blocker - config/schema contract: `entity/configs/node/agent.py`, `entity/configs/node/human.py`, `entity/configs/node/literal.py`, `entity/configs/node/passthrough.py`, `entity/configs/node/python_runner.py`, `entity/configs/node/subgraph.py`, `entity/configs/node/loop_counter.py`, `entity/configs/node/loop_timer.py`, `entity/configs/edge/edge_condition.py`, `entity/configs/edge/edge_processor.py`, `schema_registry/__init__.py`. Sans eux, le registre ne peut ni exposer les schemas ni instancier les configs.
- hard blocker - message contract: `entity/messages.py::Message`, `entity/messages.py::MessageRole`, `entity/messages.py::serialize_messages`. Toute la couche runtime de noeud/arete parle ce format.
- hard blocker cache - agent runtime: `runtime/node/executor/base.py` importe `MemoryManager`, `ThinkingManagerBase`, `ToolManager` depuis `runtime/node/agent/__init__.py`. Le contrat `ExecutionContext` n'est donc pas neutre.
- hard blocker cache - import package piege: `runtime/edge/conditions/base.py` et `runtime/edge/processors/base.py` importent `ExecutionContext` via `runtime.node.executor`, or `runtime/node/executor/__init__.py` importe aussi `AgentNodeExecutor`. Extraire seulement la couche edge sans nettoyer ces imports recree un couplage involontaire vers le batch `04-agent-runtime`.
- hard blocker - function plugin layer: `utils/function_manager.py`, `functions/edge/conditions.py`, `functions/edge_processor/transformers.py`. Les edges `function` et les processors `function` ne servent a rien sans leur catalogue dynamique.
- medium blocker - workflow orchestration: `runtime/node/executor/subgraph_executor.py` depend de `workflow/graph.py::GraphExecutor`; `runtime/node/splitter.py` est surtout utile quand `workflow/executor/dynamic_edge_executor.py` est present.
- medium blocker - session glue: `utils/human_prompt.py::HumanPromptService`, `utils/exceptions.py::WorkflowCancelledError`, `utils/log_manager.py`, `utils/token_tracker.py`.
- medium blocker - tooling sidecar: `functions/edge_processor/transformers.py::code_save_and_run` depend de `functions/function_calling/file.py::FileToolContext`, donc du batch `05-function-tooling-and-mcp`.
- frontend / API: aucune dependance directe, seulement transitives via le batch `02-workflow-orchestration`.

## external deps
- stdlib dominante: `subprocess`, `os`, `pathlib`, `re`, `time`, `textwrap`, `shutil`, `signal`.
- le path `functions/edge_processor/transformers.py::code_save_and_run` suppose `uv` disponible et lance `uv run main.py`.
- pas de SDK provider direct dans ce batch, mais l'import package de `ExecutionContext` peut charger le batch agent si vous gardez les `__init__.py` inchanges.

## flags/env
- `runtime/node/executor/python_executor.py` exporte `MAC_CODE_WORKSPACE`, `MAC_CODE_SCRIPT`, `MAC_NODE_ID` avant de lancer le process Python.
- `runtime/node/executor/python_executor.py` fusionne `PythonRunnerConfig.env` avec l'environnement systeme.
- `utils/function_manager.py` peut rerouter `functions/edge` et `functions/edge_processor` via `MAC_EDGE_FUNCTIONS_DIR` et `MAC_EDGE_PROCESSOR_FUNCTIONS_DIR`.
- `functions/edge_processor/transformers.py::code_save_and_run` depend implicitement de `FileToolContext.workspace_root` et d'un fichier `main.py` attendu dans le workspace.

## reusable ideas
- `runtime/node/registry.py` + `runtime/node/executor/factory.py` forment une bonne base de moteur extensible si vous voulez enregistrer des types declaratifs avec schema + executeur + metadata de capacites.
- `runtime/edge/conditions/base.py` est la vraie brique a lire pour comprendre le comportement des edges: role rewrite, keep_message, clear_context, tag dynamic.
- `runtime/node/splitter.py` est plus reutilisable que tout le bloc dynamic edge si vous voulez juste du fan-out base sur message / regex / json.
- les noeuds `loop_counter` et `loop_timer` sont des guard nodes compacts et faciles a porter si vous gardez une `global_state` partagee.

## extraction recipes
1. Extraire le registre de noeuds minimal.
   Fichiers a prendre d'abord: `runtime/node/registry.py`, `runtime/node/builtin_nodes.py`, `runtime/node/executor/factory.py`.
   Dependances minimales: vos classes config, un schema registry simple, et un `ExecutionContext` leger.
   Strategie: copier avec adaptation. Le vrai travail consiste a redefinir `NodeCapabilities` et supprimer les imports agent caches si vous ne voulez pas d'agent runtime.

2. Extraire les noeuds simples `literal` / `passthrough` / `human`.
   Fichiers a prendre d'abord: `runtime/node/executor/base.py`, `runtime/node/executor/literal_executor.py`, `runtime/node/executor/passthrough_executor.py`, `runtime/node/executor/human_executor.py`.
   Dependances minimales: `entity/messages.py`, `utils/human_prompt.py` pour le noeud humain.
   Strategie: copier tel quel a adaptation faible, mais allegez `ExecutionContext` si votre runtime n'a ni memory ni tools.

3. Extraire le noeud Python workspace.
   Fichiers a prendre d'abord: `runtime/node/executor/python_executor.py`, `entity/configs/node/python_runner.py`, `yaml_instance/demo_code.yaml`.
   Dependances minimales: `NodeExecutor`, `Message`, `ExecutionContext.global_state`.
   Strategie: copier avec adaptation. Avant tout, decidez explicitement la politique de sandbox, de timeouts, de workspace partage et de provenance du code.

4. Extraire le pipeline pluginable des aretes.
   Fichiers a prendre d'abord: `runtime/edge/conditions/base.py`, `runtime/edge/conditions/registry.py`, `runtime/edge/conditions/function_manager.py`, `runtime/edge/conditions/keyword_manager.py`, `runtime/edge/processors/base.py`, `runtime/edge/processors/registry.py`, `runtime/edge/processors/function_processor.py`, `runtime/edge/processors/regex_processor.py`.
   Dependances minimales: `entity/messages.py`, vos configs edge, `utils/function_manager.py`.
   Strategie: copier avec adaptation. Nettoyez les imports a `runtime.node.executor` pour casser le couplage involontaire vers `AgentNodeExecutor`.

5. Extraire uniquement les splitters.
   Fichiers a prendre d'abord: `runtime/node/splitter.py`.
   Dependances minimales: `entity/messages.py`, `entity/configs/dynamic_base.py` ou un schema equivalent.
   Strategie: copier presque tel quel. C'est la tranche la plus compacte et la plus portable de ce batch.

6. Extraire les loop guards.
   Fichiers a prendre d'abord: `runtime/node/executor/loop_counter_executor.py`, `runtime/node/executor/loop_timer_executor.py`, `yaml_instance/demo_loop_counter.yaml`, `yaml_instance/demo_loop_timer.yaml`.
   Dependances minimales: `ExecutionContext.global_state`, `Message`, `MessageRole`.
   Strategie: copier avec adaptation faible. La seule vraie contrainte est la forme de `global_state`.

## do not copy blindly
- `runtime/node/executor/base.py::ExecutionContext` est beaucoup plus large que ce batch. Il embarque `ToolManager`, `MemoryManager`, `ThinkingManagerBase`, `TokenTracker` et `HumanPromptService`. Si vous voulez un runtime de noeuds simple, recomposez ce contrat au lieu de le copier tel quel.
- `runtime/node/executor/__init__.py` importe `AgentNodeExecutor`. Comme `runtime/edge/conditions/base.py` et `runtime/edge/processors/base.py` importent `ExecutionContext` depuis ce package, un import innocent de la couche edge tire en fait le batch agent.
- `runtime/node/builtin_nodes.py` repose sur des effets de bord a l'import. Copier le registre sans reproduire ce chargement implicite laisse un registre vide.
- `runtime/node/executor/python_executor.py` n'envoie pas les inputs en stdin; il extrait juste du code du dernier message, l'ecrit sur disque puis execute le script. La doc `docs/user_guide/en/nodes/python.md` n'est donc pas source de verite sur ce point.
- `runtime/edge/processors/regex_processor.py` ne supporte pas les modes documentes `metadata` / `data_block` cites dans `docs/user_guide/en/workflow_authoring.md`; le code reel ne fait que remplacer le contenu, appliquer un default, laisser passer ou dropper le message.
- `runtime/edge/conditions/function_manager.py` bascule sur `true` si la fonction de condition est introuvable. C'est pratique pour ne pas casser un workflow, mais dangereux si vous attendez un fail-fast.
- `runtime/edge/conditions/base.py::_process_with_condition` met aussi la condition a `true` en cas d'exception dans l'evaluateur. Ce choix est tres permissif.
- `runtime/edge/conditions/base.py::_prepare_payload_for_target` reecrit le role en `user` lors d'un passage inter-noeud, sauf `preserve_role`. Une copie partielle qui oublie cette convention changera le comportement des prompts downstream.
- `functions/edge_processor/transformers.py::code_save_and_run` efface le workspace sauf `attachments`, suppose `uv`, suppose `main.py`, et execute en shell avec timeout tres court. Ne pas copier sans revue securite tres explicite.
- `runtime/node/executor/subgraph_executor.py` n'est pas autonome. Il depend de `workflow/graph.py::GraphExecutor` et deep-copy le sous-graphe a chaque execution pour rester thread-safe.

## minimal reusable slices
- slice `node-registry`: `runtime/node/registry.py`, `runtime/node/executor/factory.py`. Requis en plus: schema registry simple et config classes. Copiable avec adaptation.
- slice `simple-nodes`: `runtime/node/executor/literal_executor.py`, `runtime/node/executor/passthrough_executor.py`, `runtime/node/executor/human_executor.py`. Requis en plus: `NodeExecutor`, `Message`, `HumanPromptService` pour le noeud humain. Copiable tel quel a adaptation faible.
- slice `python-node`: `runtime/node/executor/python_executor.py`. Requis en plus: `PythonRunnerConfig`, `NodeExecutor`, `ExecutionContext.global_state`. Copiable avec adaptation.
- slice `loop-guards`: `runtime/node/executor/loop_counter_executor.py`, `runtime/node/executor/loop_timer_executor.py`. Requis en plus: `global_state` persistant. Copiable avec adaptation faible.
- slice `edge-conditions`: `runtime/edge/conditions/base.py`, `runtime/edge/conditions/registry.py`, `runtime/edge/conditions/keyword_manager.py`, `runtime/edge/conditions/function_manager.py`, `functions/edge/conditions.py`. Copiable avec adaptation.
- slice `edge-processors`: `runtime/edge/processors/base.py`, `runtime/edge/processors/registry.py`, `runtime/edge/processors/regex_processor.py`, `runtime/edge/processors/function_processor.py`, `functions/edge_processor/transformers.py`. Copiable avec adaptation.
- slice `message-splitters`: `runtime/node/splitter.py`. Copiable presque tel quel.
- slice `subgraph-node-adapter`: `runtime/node/executor/subgraph_executor.py`, `workflow/graph.py`, `workflow/subgraph_loader.py`. Copiable avec adaptation forte.

## exact search shortcuts
- `rg -n "register_node_type|get_node_registration|iter_node_registrations|NodeCapabilities|NodeRegistration" runtime/node/registry.py runtime/node/builtin_nodes.py`
- `rg -n "create_executors|create_executor|ExecutionContext|class NodeExecutor" runtime/node/executor/factory.py runtime/node/executor/base.py`
- `rg -n "def execute\\(" runtime/node/executor/human_executor.py runtime/node/executor/literal_executor.py runtime/node/executor/passthrough_executor.py runtime/node/executor/python_executor.py runtime/node/executor/subgraph_executor.py runtime/node/executor/loop_counter_executor.py runtime/node/executor/loop_timer_executor.py`
- `rg -n "_ensure_workspace_root|_extract_code|_write_script_file|_run_process|_build_failure_message" runtime/node/executor/python_executor.py`
- `rg -n "build_edge_condition_manager|EdgeConditionManager|_process_with_condition|clear_context|keep_message" runtime/edge/conditions`
- `rg -n "build_edge_processor|RegexEdgePayloadProcessor|FunctionEdgePayloadProcessor|_coerce_result|on_no_match" runtime/edge/processors`
- `rg -n "create_splitter|create_splitter_from_config|group_messages|split\\(" runtime/node/splitter.py`
- `rg -n "code_save_and_run|uppercase_payload|need_reflection_loop|should_stop_loop" functions/edge functions/edge_processor`
- `rg -n "type: python|type: human|type: loop_counter|type: loop_timer|type: subgraph|regex_extract|clear_context|keep_message" yaml_instance/demo_code.yaml yaml_instance/demo_human.yaml yaml_instance/demo_edge_transform.yaml yaml_instance/demo_loop_counter.yaml yaml_instance/demo_loop_timer.yaml yaml_instance/demo_context_reset.yaml yaml_instance/demo_sub_graph.yaml`

## copy risk
- copiable tel quel: `runtime/node/executor/literal_executor.py`, `runtime/node/executor/passthrough_executor.py`, la majeure partie de `runtime/node/splitter.py`.
- copiable avec adaptation: `runtime/node/registry.py`, `runtime/node/executor/factory.py`, `runtime/node/executor/human_executor.py`, `runtime/node/executor/python_executor.py`, `runtime/node/executor/loop_counter_executor.py`, `runtime/node/executor/loop_timer_executor.py`, toute la couche `runtime/edge/conditions/*`, toute la couche `runtime/edge/processors/*`.
- a reecrire ou a decouper avant copie: `runtime/node/executor/base.py`, `runtime/node/executor/__init__.py`, `runtime/node/executor/subgraph_executor.py`, `functions/edge_processor/transformers.py::code_save_and_run`.

## primary file slice
- `runtime/node/registry.py`
- `runtime/node/builtin_nodes.py`
- `runtime/node/executor/base.py`
- `runtime/node/executor/factory.py`
- `runtime/node/executor/human_executor.py`
- `runtime/node/executor/literal_executor.py`
- `runtime/node/executor/passthrough_executor.py`
- `runtime/node/executor/python_executor.py`
- `runtime/node/executor/subgraph_executor.py`
- `runtime/node/executor/loop_counter_executor.py`
- `runtime/node/executor/loop_timer_executor.py`
- `runtime/edge/conditions/base.py`
- `runtime/edge/conditions/registry.py`
- `runtime/edge/conditions/function_manager.py`
- `runtime/edge/conditions/keyword_manager.py`
- `runtime/edge/processors/base.py`
- `runtime/edge/processors/registry.py`
- `runtime/edge/processors/function_processor.py`
- `runtime/edge/processors/regex_processor.py`
- `runtime/node/splitter.py`
- `functions/edge/conditions.py`
- `functions/edge_processor/transformers.py`
