# 09-yaml-surface - YAML Templates, Instances, Declarative Assets

_Primary coverage_: 47 fichiers, 10383 lignes approx. dans ce batch.

## purpose
Cartographier la surface declarative reelle de ChatDev comme corpus de templates reutilisables, en reliant chaque famille YAML aux modules runtime qu'elle active vraiment.

## subdomains
- template de schema et surface d'authoring: `yaml_template/design.yaml`, `frontend/public/design_0.4.0.yaml`.
- examples agent + tools + providers: `yaml_instance/demo_function_call.yaml`, `yaml_instance/demo_mcp.yaml`, `yaml_instance/skills.yaml`, `yaml_instance/general_problem_solving_team.yaml`, `yaml_instance/deep_research_v1.yaml`.
- examples dynamic edges / cycles / control flow: `yaml_instance/demo_dynamic.yaml`, `yaml_instance/demo_dynamic_tree.yaml`, `yaml_instance/react.yaml`, `yaml_instance/demo_majority_voting.yaml`, `yaml_instance/demo_loop_counter.yaml`, `yaml_instance/demo_loop_timer.yaml`, `yaml_instance/demo_context_reset.yaml`.
- examples subgraph composition: `yaml_instance/demo_sub_graph.yaml`, `yaml_instance/demo_sub_graph_path.yaml`, `yaml_instance/subgraphs/react_agent.yaml`, `yaml_instance/subgraphs/reflexion_loop.yaml`, `yaml_instance/deep_research_executor_sub.yaml`, `yaml_instance/reflexion_product.yaml`, `yaml_instance/MACNet_v1.yaml`.
- examples memory / thinking / human loop: `yaml_instance/demo_simple_memory.yaml`, `yaml_instance/demo_improved_memory.yaml`, `yaml_instance/demo_file_memory.yaml`, `yaml_instance/demo_mem0_memory.yaml`, `yaml_instance/demo_human.yaml`.
- examples python/workspace nodes: `yaml_instance/demo_code.yaml`, `yaml_instance/data_visualization_basic.yaml`, `yaml_instance/data_visualization_enhanced_v2.yaml`, `yaml_instance/data_visualization_enhanced_v3.yaml`, `yaml_instance/teach_video.yaml`, `yaml_instance/GameDev_with_manager.yaml`.
- gros workflows produits / showcases: `yaml_instance/ChatDev_v1.yaml`, `yaml_instance/blender_*`, `yaml_instance/spring_*`, `yaml_instance/net_example*.yaml`.
- runtime/backend/frontend relies: `check/check.py`, `workflow/subgraph_loader.py`, `workflow/executor/dynamic_edge_executor.py`, `runtime/node/executor/python_executor.py`, `runtime/node/agent/tool/tool_manager.py`, `frontend/src/pages/WorkflowView.vue`.

## entrypoints
- `yaml_template/design.yaml` - template derive de la grammaire runtime.
- `frontend/public/design_0.4.0.yaml` - template frontend statique qui reflete la meme grammaire.
- `yaml_instance/demo_function_call.yaml`, `demo_mcp.yaml`, `demo_dynamic.yaml`, `demo_sub_graph.yaml`, `demo_simple_memory.yaml`, `skills.yaml`, `deep_research_v1.yaml` - meilleurs points d'entree pour recuperer une fonction precise.

## key files
- `yaml_template/design.yaml` - reference declarative la plus complete cote backend.
- `frontend/public/design_0.4.0.yaml` - reference declarative frontend.
- `yaml_instance/demo_function_call.yaml` - function tooling local.
- `yaml_instance/demo_mcp.yaml` - bridge MCP.
- `yaml_instance/skills.yaml` - skills repo-locales.
- `yaml_instance/demo_dynamic.yaml` - map/tree dynamic edges.
- `yaml_instance/demo_sub_graph.yaml` et `demo_sub_graph_path.yaml` - sous-graphes inline et par fichier.
- `yaml_instance/demo_simple_memory.yaml`, `demo_improved_memory.yaml`, `demo_file_memory.yaml`, `demo_mem0_memory.yaml` - familles memoire.
- `yaml_instance/demo_code.yaml` - noeud `python`.
- `yaml_instance/demo_human.yaml` - human-in-the-loop.
- `yaml_instance/react.yaml`, `demo_majority_voting.yaml` - orchestration plus avancee.
- `yaml_instance/deep_research_v1.yaml` - exemple le plus dense couvrant subgraph + tooling + dynamic.

## feature inventory
- `yaml.template_schema_surface`: template de schema. Fichiers `yaml_template/design.yaml`, `frontend/public/design_0.4.0.yaml`. Runtime relie: `entity/configs/graph.py`, `utils/schema_exporter.py`, `server/config_schema_router.py`. Statut reuse: copiable avec adaptation faible.
- `yaml.function_tool_examples`: tooling local. Fichiers `yaml_instance/demo_function_call.yaml`, `yaml_instance/general_problem_solving_team.yaml`. Runtime relie: `entity/configs/node/tooling.py`, `utils/function_catalog.py`, `runtime/node/agent/tool/tool_manager.py`. Statut reuse: copiable avec adaptation.
- `yaml.mcp_examples`: MCP. Fichiers `yaml_instance/demo_mcp.yaml`. Runtime relie: `McpRemoteConfig`, `ToolManager._build_mcp_remote_specs`, `ToolManager.execute_tool`. Statut reuse: copiable avec adaptation.
- `yaml.skill_examples`: skills. Fichiers `yaml_instance/skills.yaml`. Runtime relie: `entity/configs/node/skills.py`, `AgentSkillManager`. Statut reuse: copiable avec adaptation.
- `yaml.dynamic_edge_examples`: dynamic edges. Fichiers `yaml_instance/demo_dynamic.yaml`, `yaml_instance/demo_dynamic_tree.yaml`, `yaml_instance/deep_research_executor_sub.yaml`, `yaml_instance/deep_research_v1.yaml`, `yaml_instance/MACNet_Node_sub.yaml`. Runtime relie: `DynamicEdgeConfig`, `create_splitter_from_config`, `DynamicEdgeExecutor`. Statut reuse: copiable avec adaptation.
- `yaml.subgraph_examples`: subgraph composition. Fichiers `yaml_instance/demo_sub_graph.yaml`, `yaml_instance/demo_sub_graph_path.yaml`, `yaml_instance/subgraphs/react_agent.yaml`, `yaml_instance/subgraphs/reflexion_loop.yaml`, `yaml_instance/react.yaml`, `yaml_instance/reflexion_product.yaml`, `yaml_instance/MACNet_v1.yaml`. Runtime relie: `SubgraphConfig`, `load_subgraph_config`, `SubgraphNodeExecutor`. Statut reuse: copiable avec adaptation.
- `yaml.memory_examples`: memory. Fichiers `yaml_instance/demo_simple_memory.yaml`, `demo_improved_memory.yaml`, `demo_file_memory.yaml`, `demo_mem0_memory.yaml`, `yaml_instance/subgraphs/reflexion_loop.yaml`. Runtime relie: `MemoryStoreConfig`, `MemoryFactory`, `Mem0Memory`, `SimpleMemory`, `FileMemory`. Statut reuse: copiable avec adaptation.
- `yaml.python_workspace_examples`: python node. Fichiers `yaml_instance/demo_code.yaml`, `data_visualization_basic.yaml`, `data_visualization_enhanced_v2.yaml`, `data_visualization_enhanced_v3.yaml`, `teach_video.yaml`, `GameDev_with_manager.yaml`. Runtime relie: `PythonRunnerConfig`, `PythonNodeExecutor.execute`. Statut reuse: copiable avec adaptation.
- `yaml.human_loop_examples`: human node. Fichiers `yaml_instance/demo_human.yaml`, `demo_context_reset.yaml`, `spring_text_image*.yaml`, `net_example*.yaml`. Runtime relie: `HumanNodeExecutor`, `HumanPromptService`, `SessionExecutionController`. Statut reuse: copiable avec adaptation.
- `yaml.workflow_library`: corpus complet. Fichiers `yaml_instance/ChatDev_v1.yaml`, `blender_*`, `spring_*`, `net_example*.yaml`. Runtime relie: presque tous les batches 01-06. Statut reuse: utiliser comme inspiration plutot que copier.

## data flow
1. Les YAML de `yaml_instance/` et `yaml_template/` passent par `check/check.py::load_config` puis `DesignConfig.from_dict`.
2. Les exemples subgraph font ensuite intervenir `workflow/subgraph_loader.py::load_subgraph_config` et `runtime/node/executor/subgraph_executor.py`.
3. Les exemples dynamiques activent `entity/configs/edge/dynamic_edge_config.py` puis `workflow/executor/dynamic_edge_executor.py`.
4. Les examples tools/MCP/skills/memory activent respectivement `ToolManager`, `AgentSkillManager`, `MemoryFactory` et les providers.
5. Le frontend charge aussi ces YAML comme fixtures et templates d'edition via `WorkflowView.vue`, `FormGenerator.vue` et `sync_vuegraphs.py`.

## symbol map
- YAML n'expose pas de symboles Python, mais les points d'ancrage a citer d'abord sont:
- `yaml_template/design.yaml` <-> `DesignConfig`, `GraphDefinition`, `build_schema_response`.
- `demo_function_call.yaml` <-> `FunctionToolConfig`, `FunctionCatalog`, `ToolManager`.
- `demo_mcp.yaml` <-> `McpRemoteConfig`, `ToolManager._build_mcp_remote_specs`.
- `skills.yaml` <-> `AgentSkillManager`, `parse_skill_file`.
- `demo_dynamic.yaml` <-> `DynamicEdgeConfig`, `create_splitter_from_config`, `DynamicEdgeExecutor.execute_from_inputs`.
- `demo_sub_graph.yaml` / `demo_sub_graph_path.yaml` <-> `SubgraphConfig`, `load_subgraph_config`, `SubgraphNodeExecutor.execute`.
- `demo_simple_memory.yaml`, `demo_file_memory.yaml`, `demo_mem0_memory.yaml` <-> `MemoryFactory.create_memory`, `SimpleMemory`, `FileMemory`, `Mem0Memory`.
- `demo_code.yaml` <-> `PythonNodeExecutor.execute`.
- `demo_human.yaml` <-> `HumanNodeExecutor.execute`, `HumanPromptService.request`.
- `react.yaml`, `demo_majority_voting.yaml` <-> `GraphExecutor`, `CycleExecutor`, `MajorityVoteStrategy`.

## dependency map
- hard blocker - parser and schema: `check/check.py`, `entity/configs/graph.py`, `runtime/bootstrap/schema.py`.
- hard blocker - runtime execution modules varient selon la famille YAML:
- tools / MCP / skills: `runtime/node/agent/tool/tool_manager.py`, `runtime/node/agent/skills/manager.py`, providers.
- dynamic edges: `runtime/node/splitter.py`, `workflow/executor/dynamic_edge_executor.py`.
- subgraphs: `workflow/subgraph_loader.py`, `runtime/node/executor/subgraph_executor.py`.
- memory: `runtime/node/agent/memory/*`, `entity/configs/node/memory.py`.
- python node: `runtime/node/executor/python_executor.py`.
- human loop: `runtime/node/executor/human_executor.py`, `utils/human_prompt.py`, server WebSocket layer.
- medium blocker - template/frontend sync: `frontend/public/design_0.4.0.yaml` et `yaml_template/design.yaml` peuvent diverger si le schema backend evolue; il faut toujours recroiser avec `schema_exporter.py`.

## external deps
- uniquement via les modules runtime actives par les YAML: OpenAI, Gemini, MCP, Mem0, FAISS, `uv`, etc.

## flags/env
- `API_KEY`, `BASE_URL`, `MODEL_NAME`, `MEM0_API_KEY`, `JINA_API_KEY`, `SERPER_DEV_API_KEY` apparaissent dans les examples et doivent etre resolus au runtime.

## reusable ideas
- les meilleurs templates de demarrage ne sont pas les plus gros workflows, mais les `demo_*` tres cibles.
- `deep_research_v1.yaml` est utile comme reference de composition multi-sous-systemes, pas comme extraction minimale.
- `yaml_template/design.yaml` et `frontend/public/design_0.4.0.yaml` servent de contrat lisible, mais la source de verite reste le code `entity/configs/*`.

## extraction recipes
1. Recuperer un template function calling minimal.
   Fichiers a prendre d'abord: `yaml_instance/demo_function_call.yaml`.
   Lire aussi: `entity/configs/node/tooling.py`, `runtime/node/agent/tool/tool_manager.py`.
   Strategie: copier avec adaptation.

2. Recuperer un template MCP minimal.
   Fichiers a prendre d'abord: `yaml_instance/demo_mcp.yaml`.
   Lire aussi: `McpRemoteConfig`, `ToolManager`, `mcp_example/mcp_server.py`.
   Strategie: copier avec adaptation.

3. Recuperer un template dynamic edge.
   Fichiers a prendre d'abord: `yaml_instance/demo_dynamic.yaml`, puis `demo_dynamic_tree.yaml` si besoin tree reduce.
   Lire aussi: `DynamicEdgeConfig`, `DynamicEdgeExecutor`, `runtime/node/splitter.py`.
   Strategie: copier avec adaptation.

4. Recuperer un template subgraph.
   Fichiers a prendre d'abord: `yaml_instance/demo_sub_graph.yaml` pour inline, `demo_sub_graph_path.yaml` pour path-based, puis `yaml_instance/subgraphs/react_agent.yaml` comme sous-graphe portable.
   Strategie: copier avec adaptation.

5. Recuperer un template memoire.
   Fichiers a prendre d'abord: `yaml_instance/demo_simple_memory.yaml`, `demo_file_memory.yaml`, `demo_mem0_memory.yaml`.
   Strategie: copier avec adaptation et choisir explicitement le store.

6. Recuperer un template python workspace.
   Fichiers a prendre d'abord: `yaml_instance/demo_code.yaml`.
   Lire aussi: `PythonNodeExecutor.execute`.
   Strategie: copier avec adaptation et revue securite.

## do not copy blindly
- les gros fichiers `ChatDev_v1.yaml`, `blender_*`, `spring_*`, `GameDev_with_manager.yaml` sont trop couples a des tools, prompts, providers et conventions de projet pour etre de bons templates minimaux.
- `frontend/public/design_0.4.0.yaml` est une capture statique utile, mais ce n'est pas la source de verite si les `FIELD_SPECS` ont change.
- certains YAML conservent des champs `dynamic: null` tres frequents; ils n'apportent rien a la comprehension de la fonctionnalite et peuvent alourdir un template extrait.
- les placeholders `${...}` doivent etre resolus par le runtime; copier un YAML sans son environnement peut donner une impression trompeuse de completude.

## minimal reusable slices
- slice `template-schema`: `yaml_template/design.yaml`, `frontend/public/design_0.4.0.yaml`. Copiable avec adaptation faible.
- slice `function-tool-template`: `yaml_instance/demo_function_call.yaml`. Copiable avec adaptation.
- slice `mcp-template`: `yaml_instance/demo_mcp.yaml`. Copiable avec adaptation.
- slice `skills-template`: `yaml_instance/skills.yaml`. Copiable avec adaptation.
- slice `dynamic-edge-template`: `yaml_instance/demo_dynamic.yaml`, `yaml_instance/demo_dynamic_tree.yaml`. Copiable avec adaptation.
- slice `subgraph-template`: `yaml_instance/demo_sub_graph.yaml`, `yaml_instance/demo_sub_graph_path.yaml`, `yaml_instance/subgraphs/react_agent.yaml`. Copiable avec adaptation.
- slice `memory-template`: `yaml_instance/demo_simple_memory.yaml`, `yaml_instance/demo_file_memory.yaml`, `yaml_instance/demo_mem0_memory.yaml`. Copiable avec adaptation.
- slice `python-node-template`: `yaml_instance/demo_code.yaml`. Copiable avec adaptation.
- slice `human-loop-template`: `yaml_instance/demo_human.yaml`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "provider:|tooling:|thinking:|skills:" yaml_instance/skills.yaml yaml_instance/demo_function_call.yaml yaml_instance/demo_mcp.yaml`
- `rg -n "dynamic:" yaml_instance/demo_dynamic.yaml yaml_instance/demo_dynamic_tree.yaml yaml_instance/deep_research_v1.yaml yaml_instance/MACNet_Node_sub.yaml`
- `rg -n "type: subgraph|source: file|path:" yaml_instance/demo_sub_graph.yaml yaml_instance/demo_sub_graph_path.yaml yaml_instance/react.yaml yaml_instance/subgraphs`
- `rg -n "memory:" yaml_instance/demo_simple_memory.yaml yaml_instance/demo_improved_memory.yaml yaml_instance/demo_file_memory.yaml yaml_instance/demo_mem0_memory.yaml yaml_instance/subgraphs/reflexion_loop.yaml`
- `rg -n "type: python" yaml_instance/demo_code.yaml yaml_instance/data_visualization_basic.yaml yaml_instance/data_visualization_enhanced_v2.yaml yaml_instance/teach_video.yaml`
- `rg -n "type: human" yaml_instance/demo_human.yaml yaml_instance/demo_context_reset.yaml yaml_instance/net_example.yaml yaml_instance/spring_text_image.yaml`
- `rg -n "loop_counter|loop_timer|is_majority_voting" yaml_instance/demo_loop_counter.yaml yaml_instance/demo_loop_timer.yaml yaml_instance/demo_majority_voting.yaml yaml_instance/ChatDev_v1.yaml`
- `rg -n "provider: <string>|tooling:|thinking:|memory:" yaml_template/design.yaml frontend/public/design_0.4.0.yaml`

## copy risk
- copiable tel quel: plusieurs `demo_*` tres cibles apres simple remplacement d'IDs et variables.
- copiable avec adaptation: `yaml_template/design.yaml`, `frontend/public/design_0.4.0.yaml`, la plupart des `demo_*`.
- a reecrire ou a reduire avant copie: les gros workflows produits et showcases.

## primary file slice
- `yaml_template/design.yaml`
- `frontend/public/design_0.4.0.yaml`
- `yaml_instance/demo_function_call.yaml`
- `yaml_instance/demo_mcp.yaml`
- `yaml_instance/skills.yaml`
- `yaml_instance/demo_dynamic.yaml`
- `yaml_instance/demo_dynamic_tree.yaml`
- `yaml_instance/demo_sub_graph.yaml`
- `yaml_instance/demo_sub_graph_path.yaml`
- `yaml_instance/subgraphs/react_agent.yaml`
- `yaml_instance/demo_simple_memory.yaml`
- `yaml_instance/demo_file_memory.yaml`
- `yaml_instance/demo_mem0_memory.yaml`
- `yaml_instance/demo_code.yaml`
- `yaml_instance/demo_human.yaml`
- `yaml_instance/react.yaml`
- `yaml_instance/demo_majority_voting.yaml`
- `yaml_instance/deep_research_v1.yaml`
