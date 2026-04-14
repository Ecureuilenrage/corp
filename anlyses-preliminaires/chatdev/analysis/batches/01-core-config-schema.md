# 01-core-config-schema - Core Config, Schema, Bootstrap

_Primary coverage_: 39 fichiers, 7127 lignes approx. dans ce batch.

## purpose
Porter le contrat declaratif du runtime: chargement YAML, resolution de variables, validation logique, registres de schemas et conversion vers `GraphConfig`.

## subdomains
- coeur runtime: `check/check.py`, `entity/configs/graph.py`, `entity/configs/node/node.py`, `entity/configs/edge/edge.py`, `entity/graph_config.py`.
- orchestration de graphes/workflows touchee par contrat, pas par execution: `check/check_workflow.py`, `entity/configs/node/subgraph.py`, `entity/configs/edge/dynamic_edge_config.py`.
- agents / providers / tools / functions exposes par schema: `entity/configs/node/agent.py`, `entity/configs/node/memory.py`, `entity/configs/node/tooling.py`, `entity/configs/node/thinking.py`, `schema_registry/registry.py`.
- API serveur / services / routes consommatrices du schema: `run.py`, `utils/schema_exporter.py`, `server/config_schema_router.py`.
- frontend Vue touche par contrat de schema uniquement: `frontend/src/components/FormGenerator.vue`, `frontend/src/utils/formUtils.js`, `frontend/public/design_0.4.0.yaml`.
- YAML templates / YAML instances: `yaml_template/design.yaml`, `yaml_instance/demo_sub_graph.yaml`, `yaml_instance/demo_mcp.yaml`, `yaml_instance/demo_dynamic.yaml`.
- tests / docs / infra: `tools/export_design_template.py`, `tools/validate_all_yamls.py`, `docs/user_guide/en/config_schema_contract.md`, `docs/user_guide/en/workflow_authoring.md`.

## entrypoints
- `run.py` - `build_task_input_payload`, `parse_arguments`, `main` - entree CLI qui charge un design, exporte un schema ou execute un workflow.
- `check/check.py` - `load_config`, `check_config` - point central de lecture YAML, resolution `${VAR}`, validation typage + validation logique.
- `runtime/bootstrap/schema.py` - `ensure_schema_registry_populated` - bootstrap par effets de bord des noeuds builtin, memoires, thinking, edge conditions/processors et providers.
- `schema_registry/registry.py` - `register_*_schema`, `get_*_schema`, `iter_*_schemas` - hub inter-batch des schemas declaratifs.

## key files
- `entity/configs/graph.py` - `GraphDefinition`, `DesignConfig` - grammaire racine du YAML.
- `entity/configs/node/node.py` - `Node`, `EdgeLink` - normalise un noeud, ses inputs fixes, sa config typee et ses liens sortants.
- `entity/configs/edge/edge.py` - `EdgeConfig` - porte `condition`, `process`, `dynamic`, `from_node`, `to_node`.
- `entity/configs/edge/edge_condition.py` - `EdgeConditionConfig`, `FunctionEdgeConditionConfig`, `KeywordEdgeConditionConfig` - contrat declaratif des conditions d'aretes.
- `entity/configs/edge/edge_processor.py` - `EdgeProcessorConfig`, `RegexEdgeProcessorConfig`, `FunctionEdgeProcessorConfig` - contrat declaratif des transformations de payload.
- `entity/configs/node/tooling.py` - `FunctionToolEntryConfig`, `FunctionToolConfig`, `McpRemoteConfig`, `McpLocalConfig`, `ToolingConfig` - schema des tools agent.
- `entity/configs/node/subgraph.py` - `SubgraphFileConfig`, `SubgraphInlineConfig`, `SubgraphConfig` - schema de composition de sous-graphes.
- `entity/configs/edge/dynamic_edge_config.py` - `DynamicEdgeConfig` - schema map/tree applique aux aretes.
- `runtime/bootstrap/schema.py` - `_modules_to_import`, `ensure_schema_registry_populated` - declare quels modules doivent etre importes pour hydrater les registres.
- `schema_registry/registry.py` - `NodeSchemaSpec`, `MemoryStoreSchemaSpec`, `ThinkingSchemaSpec`, `ModelProviderSchemaSpec` - stockage de la meta-schema.
- `entity/messages.py` - `Message`, `MessageBlock`, `AttachmentRef`, `ToolCallPayload` - contrat de message traverse ensuite tout le runtime.

## feature inventory
- `schema.design_validation`: coeur runtime. Fichiers `check/check.py`, `check/check_workflow.py`, `entity/configs/graph.py`, `entity/graph_config.py`, `runtime/bootstrap/schema.py`, `schema_registry/registry.py`. Symboles centraux `load_config`, `check_config`, `check_workflow_structure`, `GraphDefinition.from_dict`, `DesignConfig.from_dict`, `GraphConfig.from_definition`. Statut reuse: copiable avec adaptation.
- `schema.schema_bootstrap_registry`: coeur runtime / bootstrap. Fichiers `runtime/bootstrap/schema.py`, `schema_registry/registry.py`, `runtime/node/builtin_nodes.py`, `runtime/node/agent/memory/builtin_stores.py`, `runtime/node/agent/thinking/builtin_thinking.py`, `runtime/edge/conditions/builtin_types.py`, `runtime/node/agent/providers/builtin_providers.py`. Symboles centraux `_modules_to_import`, `ensure_schema_registry_populated`, `register_node_schema`, `register_memory_store_schema`, `register_thinking_schema`, `register_model_provider_schema`. Statut reuse: copiable avec adaptation faible.
- `schema.subgraph_source_registry`: orchestration YAML. Fichiers `entity/configs/node/subgraph.py`, `workflow/subgraph_loader.py`, `runtime/node/executor/subgraph_executor.py`. Symboles centraux `register_subgraph_source`, `get_subgraph_source_config`, `SubgraphFileConfig.from_dict`, `SubgraphInlineConfig.validate`, `SubgraphConfig.child_routes`. Statut reuse: copiable avec adaptation.
- `schema.tooling_config_registry`: agents / tools / functions. Fichiers `entity/configs/node/tooling.py`, `utils/function_catalog.py`, `runtime/node/agent/tool/tool_manager.py`. Symboles centraux `register_tooling_type`, `iter_tooling_type_registrations`, `FunctionToolEntryConfig.field_specs`, `FunctionToolConfig.from_dict`, `ToolingConfig.child_routes`. Statut reuse: copiable avec adaptation.
- `schema.dynamic_edge_schema`: orchestration graph/workflow. Fichiers `entity/configs/edge/dynamic_edge_config.py`, `entity/configs/dynamic_base.py`, `workflow/executor/dynamic_edge_executor.py`, `runtime/node/splitter.py`. Symboles centraux `register_dynamic_edge_type`, `DynamicEdgeConfig.from_dict`, `SplitConfig.from_dict`, `MapDynamicConfig`, `TreeDynamicConfig`. Statut reuse: copiable avec adaptation.
- `schema.edge_plugin_schema`: edge runtime. Fichiers `entity/configs/edge/edge_condition.py`, `entity/configs/edge/edge_processor.py`, `runtime/edge/conditions/registry.py`, `runtime/edge/processors/registry.py`. Symboles centraux `EdgeConditionConfig.from_dict`, `EdgeProcessorConfig.from_dict`, `get_edge_condition_schema`, `get_edge_processor_schema`. Statut reuse: copiable avec adaptation.
- `schema.message_contract`: contrat transversal. Fichiers `entity/messages.py`, `entity/configs/node/literal.py`, `entity/configs/node/node.py`, `runtime/node/executor/base.py`. Symboles centraux `Message.from_dict`, `MessageBlock.from_dict`, `AttachmentRef.from_dict`, `serialize_messages`, `deserialize_messages`. Statut reuse: copiable avec adaptation.
- `schema.frontend_schema_export`: glue code backend/frontend. Fichiers `utils/schema_exporter.py`, `run.py`, `server/config_schema_router.py`, `frontend/src/components/FormGenerator.vue`. Symboles centraux `Breadcrumb`, `_resolve_config_class`, `build_schema_response`, `_resolve_schema`. Statut reuse: copiable avec adaptation.

## data flow
1. `run.py` ou `server/routes/execute_sync.py` appelle `check/check.py::load_config`.
2. `load_config` lit le YAML, appelle `utils/env_loader.py::load_dotenv_file` et `build_env_var_map`, puis resout les placeholders via `utils/vars_resolver.py::resolve_design_placeholders`.
3. `runtime/bootstrap/schema.py::ensure_schema_registry_populated` importe les modules d'enregistrement builtin pour peupler `schema_registry/registry.py`.
4. `entity/configs/graph.py::DesignConfig.from_dict` parse la racine `version/vars/graph`, puis `GraphDefinition.from_dict` parse `nodes`, `edges`, `memory`, `start`, `end`.
5. `entity/configs/node/node.py::Node.from_dict` resout le type de noeud via `schema_registry.get_node_schema`, parse les `input_messages`, la config typee et les `EdgeLink`.
6. `entity/configs/edge/edge.py::EdgeConfig.from_dict` parse eventuellement `condition`, `process` et `dynamic` en deleguant a `EdgeConditionConfig.from_dict`, `EdgeProcessorConfig.from_dict` et `DynamicEdgeConfig.from_dict`.
7. `check/check_workflow.py::check_workflow_structure` valide la topologie de haut niveau avant execution.
8. Le design valide est converti par `entity/graph_config.py::GraphConfig.from_definition` en configuration runtime, puis consomme ensuite par `workflow/graph_context.py` et `workflow/graph.py`.

## symbol map
- `run.py`: `build_task_input_payload`, `parse_arguments`, `main`.
- `check/check.py`: `DesignError`, `_allowed_node_types`, `_ensure_supported`, `load_config`, `check_config`.
- `check/check_workflow.py`: `_node_ids`, `_edge_list`, `_analyze_graph`, `check_workflow_structure`, `main`.
- `runtime/bootstrap/schema.py`: `_modules_to_import`, `ensure_schema_registry_populated`.
- `schema_registry/registry.py`: `SchemaLookupError`, `SchemaRegistrationError`, `NodeSchemaSpec`, `EdgeConditionSchemaSpec`, `EdgeProcessorSchemaSpec`, `MemoryStoreSchemaSpec`, `ThinkingSchemaSpec`, `ModelProviderSchemaSpec`, `register_node_schema`, `get_node_schema`, `register_edge_condition_schema`, `register_edge_processor_schema`, `register_memory_store_schema`, `register_thinking_schema`, `register_model_provider_schema`, `iter_model_provider_schemas`.
- `entity/configs/graph.py`: `GraphDefinition`, `GraphDefinition.from_dict`, `DesignConfig`, `DesignConfig.from_dict`.
- `entity/configs/node/node.py`: `EdgeLink`, `Node`, `Node.from_dict`, `Node.child_routes`.
- `entity/configs/node/tooling.py`: `register_tooling_type`, `get_tooling_type_config`, `iter_tooling_type_registrations`, `FunctionToolEntryConfig`, `FunctionToolConfig`, `McpRemoteConfig`, `McpLocalConfig`, `ToolingConfig`.
- `entity/configs/node/subgraph.py`: `register_subgraph_source`, `get_subgraph_source_config`, `iter_subgraph_source_registrations`, `SubgraphFileConfig`, `SubgraphInlineConfig`, `SubgraphConfig`.
- `entity/configs/edge/edge.py`: `EdgeConfig`, `EdgeConfig.from_dict`.
- `entity/configs/edge/edge_condition.py`: `FunctionEdgeConditionConfig`, `KeywordEdgeConditionConfig`, `EdgeConditionConfig`.
- `entity/configs/edge/edge_processor.py`: `RegexEdgeProcessorConfig`, `FunctionEdgeProcessorConfig`, `EdgeProcessorConfig`.
- `entity/configs/edge/dynamic_edge_config.py`: `register_dynamic_edge_type`, `get_dynamic_edge_type_config`, `DynamicEdgeConfig`, `DynamicEdgeConfig.from_dict`.
- `entity/messages.py`: `MessageRole`, `MessageBlockType`, `AttachmentRef`, `MessageBlock`, `ToolCallPayload`, `FunctionCallOutputEvent`, `Message`, `serialize_messages`, `deserialize_messages`.

## dependency map
- hard blocker - base config runtime: `entity/configs/base.py`, `entity/configs/dynamic_base.py`, `entity/enum_options.py`, `entity/enums.py`. Sans eux, toutes les classes `BaseConfig`, les `FIELD_SPECS` et les `child_routes` cassent.
- hard blocker - schema registry contract: `schema_registry/registry.py` et `runtime/bootstrap/schema.py`. Le parseur depend des schemas enregistres; sans bootstrap, `Node.from_dict` et `Edge*Config.from_dict` ne connaissent plus les types builtin.
- hard blocker - message contract: `entity/messages.py`. Les noeuds `literal`, `human`, `python`, `agent`, les tools et les aretes manipulent tous `Message`.
- medium blocker - tooling schema depends on function catalog: `entity/configs/node/tooling.py::FunctionToolEntryConfig.field_specs` tire `utils/function_catalog.py::get_function_catalog`. Copier le schema tooling sans le catalogue supprime l'autocompletion reelle des tools.
- medium blocker - subgraph schema depends on workflow composition semantics: `entity/configs/node/subgraph.py` reference `EdgeConfig`, `MemoryStoreConfig` et le schema `Node` dans `field_specs()`. La copie minimale doit garder ce chainage.
- medium blocker - frontend/API schema surface: `utils/schema_exporter.py`, `server/config_schema_router.py`, `frontend/src/components/FormGenerator.vue`. Requis si l'objectif est un editeur schema-driven, inutiles pour un parseur CLI pur.
- inbound adapters a lire avant extraction: `run.py`, `server/config_schema_router.py`, `tools/export_design_template.py`, `tools/validate_all_yamls.py`.

## external deps
- `yaml` / PyYAML pour lecture et validation YAML.
- `pathlib`, `dataclasses`, `typing`, `copy`, `hashlib` dominent sinon la couche.
- pas de SDK provider direct ici, mais `ensure_schema_registry_populated()` importe des modules du batch `04-agent-runtime`.

## flags/env
- `BASE_URL`, `API_KEY`, `MODEL_NAME`, `MEM0_API_KEY` apparaissent dans les YAML et sont resolus par `vars_resolver`.
- `MAC_FUNCTIONS_DIR`, `MAC_EDGE_FUNCTIONS_DIR`, `MAC_EDGE_PROCESSOR_FUNCTIONS_DIR` affectent indirectement les schemas tooling et edge via `utils/function_manager.py`.
- `VAR` et `VARIABLE_NAME` apparaissent dans les exemples YAML et les locales frontend, mais la logique reelle passe par `${...}` et `DesignConfig.vars`.

## reusable ideas
- `schema_registry/registry.py` + `runtime/bootstrap/schema.py` forment un bootstrap de meta-schema tres portable pour tout moteur declaratif.
- `entity/configs/node/tooling.py`, `entity/configs/node/subgraph.py` et `entity/configs/edge/dynamic_edge_config.py` montrent une bonne maniere de brancher des sous-schemas par registre sans durcir le parseur racine.
- `utils/schema_exporter.py` est une brique a forte valeur si l'on veut generer des formulaires depuis le code reel plutot que maintenir un schema JSON separe.

## extraction recipes
1. Extraire uniquement le parseur YAML + validation.
   Fichiers a prendre d'abord: `check/check.py`, `check/check_workflow.py`, `entity/configs/graph.py`, `entity/configs/node/node.py`, `entity/configs/edge/edge.py`, `runtime/bootstrap/schema.py`, `schema_registry/registry.py`.
   Dependances minimales: `entity/configs/base.py`, `entity/messages.py`, `utils/env_loader.py`, `utils/vars_resolver.py`.
   Strategie: copier avec adaptation.

2. Extraire seulement le bootstrap de schemas extensibles.
   Fichiers a prendre d'abord: `runtime/bootstrap/schema.py`, `schema_registry/registry.py`.
   Dependances minimales: classes config cibles + modules d'enregistrement builtin.
   Strategie: copier presque tel quel.

3. Extraire le sous-systeme de schema tooling/subgraph/dynamic.
   Fichiers a prendre d'abord: `entity/configs/node/tooling.py`, `entity/configs/node/subgraph.py`, `entity/configs/edge/dynamic_edge_config.py`.
   Dependances minimales: `utils/registry.py`, `utils/function_catalog.py`, `entity/configs/base.py`, `entity/configs/dynamic_base.py`.
   Strategie: copier avec adaptation.

4. Extraire le contrat `Message`.
   Fichiers a prendre d'abord: `entity/messages.py`.
   Dependances minimales: aucune hors stdlib.
   Strategie: copier avec adaptation faible.

5. Extraire la surface backend->frontend de schemas.
   Fichiers a prendre d'abord: `utils/schema_exporter.py`, `server/config_schema_router.py`.
   Dependances minimales: `DesignConfig`, `BaseConfig`, `child_routes`, `FIELD_SPECS`.
   Strategie: copier avec adaptation.

## do not copy blindly
- `runtime/bootstrap/schema.py::_modules_to_import` importe directement des modules du runtime agent, edge et noeuds builtin. Copier ce bootstrap tel quel embarque deja une bonne partie des batches `03` et `04`.
- `entity/configs/node/tooling.py::FunctionToolEntryConfig.field_specs` inspecte le vrai dossier `functions/function_calling`. Sans reproduire ce layout, les enums de functions deviennent trompeuses.
- `schema_registry/registry.py::_ensure_edge_processor_builtins_loaded` importe silencieusement `runtime.edge.processors.builtin_types`. Ce side effect peut masquer des dependances si vous pensez n'extraire que la couche schema.
- `entity/configs/node/subgraph.py::SubgraphInlineConfig.field_specs` ne connait le schema `Node` qu'au runtime via import local. Une copie partielle qui remplace `Node` par un type statique cassera les child routes frontend.
- `check/check.py::_ensure_supported` et `check/check_workflow.py` imposent des regles de structure specifiques a ChatDev. Ne pas supposer qu'elles conviennent a un autre moteur sans redecider les regles `start`, `end`, cycles et sous-graphes.

## minimal reusable slices
- slice `schema-bootstrap`: `runtime/bootstrap/schema.py`, `schema_registry/registry.py`. Copiable tel quel a adaptation tres faible.
- slice `yaml-parse-and-validate`: `check/check.py`, `check/check_workflow.py`, `entity/configs/graph.py`, `entity/configs/node/node.py`, `entity/configs/edge/edge.py`. Copiable avec adaptation.
- slice `message-contract`: `entity/messages.py`. Copiable presque tel quel.
- slice `tooling-schema-surface`: `entity/configs/node/tooling.py`, `utils/function_catalog.py`, `utils/function_manager.py`. Copiable avec adaptation.
- slice `subgraph-schema-surface`: `entity/configs/node/subgraph.py`. Copiable avec adaptation.
- slice `dynamic-edge-schema-surface`: `entity/configs/edge/dynamic_edge_config.py`, `entity/configs/dynamic_base.py`. Copiable avec adaptation.
- slice `frontend-schema-export`: `utils/schema_exporter.py`, `server/config_schema_router.py`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "load_config|check_config|_ensure_supported|check_workflow_structure" check/check.py check/check_workflow.py`
- `rg -n "GraphDefinition|DesignConfig|from_dict|GraphConfig.from_definition" entity/configs/graph.py entity/graph_config.py run.py`
- `rg -n "class Node|class EdgeLink|child_routes|from_dict" entity/configs/node/node.py`
- `rg -n "register_tooling_type|FunctionToolEntryConfig|FunctionToolConfig|McpRemoteConfig|McpLocalConfig|ToolingConfig" entity/configs/node/tooling.py`
- `rg -n "register_subgraph_source|SubgraphFileConfig|SubgraphInlineConfig|SubgraphConfig" entity/configs/node/subgraph.py`
- `rg -n "register_dynamic_edge_type|DynamicEdgeConfig|SplitConfig|MapDynamicConfig|TreeDynamicConfig" entity/configs/edge/dynamic_edge_config.py entity/configs/dynamic_base.py`
- `rg -n "register_node_schema|register_edge_condition_schema|register_edge_processor_schema|register_memory_store_schema|register_thinking_schema|register_model_provider_schema" schema_registry/registry.py`
- `rg -n "_modules_to_import|ensure_schema_registry_populated" runtime/bootstrap/schema.py`
- `rg -n "class Message|class MessageBlock|class AttachmentRef|ToolCallPayload|serialize_messages|deserialize_messages" entity/messages.py`

## copy risk
- copiable tel quel: `schema_registry/registry.py` en grande partie, `entity/messages.py` presque entier.
- copiable avec adaptation: `check/check.py`, `check/check_workflow.py`, `entity/configs/graph.py`, `entity/configs/node/tooling.py`, `entity/configs/node/subgraph.py`, `entity/configs/edge/dynamic_edge_config.py`, `utils/schema_exporter.py`.
- a reecrire ou a retailler avant copie: `runtime/bootstrap/schema.py` si vous ne voulez pas embarquer les builtins ChatDev, et les regles de validation structurelle si votre moteur a d'autres conventions.

## primary file slice
- `run.py`
- `check/check.py`
- `check/check_workflow.py`
- `runtime/bootstrap/schema.py`
- `schema_registry/registry.py`
- `entity/configs/graph.py`
- `entity/configs/node/node.py`
- `entity/configs/node/agent.py`
- `entity/configs/node/memory.py`
- `entity/configs/node/tooling.py`
- `entity/configs/node/subgraph.py`
- `entity/configs/edge/edge.py`
- `entity/configs/edge/edge_condition.py`
- `entity/configs/edge/edge_processor.py`
- `entity/configs/edge/dynamic_edge_config.py`
- `entity/messages.py`
