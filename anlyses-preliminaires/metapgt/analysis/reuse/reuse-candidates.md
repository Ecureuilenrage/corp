# Reuse Candidates

Cette passe transverse repond a la question:

> "Si je veux recuperer une fonctionnalite precise dans MetaGPT, quels fichiers et quels symboles dois-je regarder d'abord, et quels couplages dois-je eviter ?"

## Regles de lecture

- Toujours partir du coeur runtime, puis ajouter les adapters/providers, puis seulement les outils ou les prompts.
- Les meilleurs points d'entree de verification restent les exemples minimaux et les tests ciblant exactement la brique.
- Les plus gros hubs de glue a eviter en premier sont `metagpt/logs.py`, `metagpt/utils/common.py`, `metagpt/const.py`, `metagpt/actions/__init__.py`, `metagpt/roles/__init__.py`, `metagpt/environment/__init__.py`, `metagpt/provider/__init__.py`.
- Legende strategie:
- `copier`: copiable tel quel ou presque, avec peu de risque structurel.
- `adapter`: copiable avec adaptation locale ou decoupage partiel.
- `reecrire`: utile comme reference, mais trop couple pour etre deplace tel quel.

## Top 10 des briques a extraire en premier

### 1. Message / Context / Config system (`message_context_config_system`)
- Chemins a lire en priorite: `metagpt/config2.py`, `metagpt/context.py`, `metagpt/context_mixin.py`, `metagpt/llm.py`, `metagpt/schema.py`
- Symboles critiques: `CLIParams`, `Config.default`, `Config.from_llm_config`, `Config.update_via_cli`, `merge_dict`, `AttrDict`, `Context.llm`, `Context.llm_with_cost_manager_from_llm_config`, `Context.serialize`, `Context.deserialize`, `ContextMixin.context`, `ContextMixin.llm`, `Message`, `MessageQueue`
- Coeur runtime: `metagpt/config2.py`, `metagpt/context.py`, `metagpt/context_mixin.py`, la tranche transport de `metagpt/schema.py`
- Adapters/providers: `metagpt/provider/llm_provider_registry.py`, `metagpt/provider/base_llm.py`
- Tools: aucun indispensable
- Docs/tests: `tests/metagpt/test_context.py`, `tests/metagpt/test_context_mixin.py`, `tests/metagpt/test_message.py`, `tests/metagpt/test_schema.py`
- Glue a eviter d'abord: les parties `CodingContext`, `TestingContext`, `CodeSummarizeContext`, `UMLClass*` et l'enregistrement tool de `Plan` dans `metagpt/schema.py`
- Dependances minimales: `metagpt/configs/*.py`, `metagpt/utils/yaml_model.py`, `metagpt/base/base_serialization.py`, `metagpt/utils/serialize.py`, `metagpt/utils/cost_manager.py`
- Couplings dangereux: `Config.default` conserve un singleton global via `_CONFIG_CACHE`; `Context.llm()` recree le provider a chaque appel; `ContextMixin.context` fabrique un `Context()` neuf si rien n'est injecte; `Message.check_cause_by` retombe implicitement sur `UserRequirement`
- Niveau de coupling: `high`
- Strategie: `adapter`

### 2. Systeme multi-agent minimal (`multi_agent_minimal_system`)
- Chemins a lire en priorite: `metagpt/team.py`, `metagpt/environment/base_env.py`, `metagpt/roles/role.py`, `metagpt/actions/action.py`, `metagpt/schema.py`
- Symboles critiques: `Team.__init__`, `Team.hire`, `Team.run_project`, `Team.run`, `Environment.add_roles`, `Environment.publish_message`, `Environment.run`, `Role._observe`, `Role._think`, `Role._act`, `Role.publish_message`, `Role.run`, `MessageQueue`
- Coeur runtime: `metagpt/team.py`, `metagpt/environment/base_env.py`, `metagpt/roles/role.py`, `metagpt/actions/action.py`, `metagpt/schema.py`
- Adapters/providers: `metagpt/context.py`, `metagpt/context_mixin.py`, `metagpt/provider/__init__.py`
- Tools: aucun indispensable pour un multi-agent basique
- Docs/tests: `examples/build_customized_multi_agents.py`, `tests/metagpt/roles/test_role.py`, `tests/metagpt/test_subscription.py`
- Glue a eviter d'abord: `metagpt/environment/__init__.py`, `metagpt/environment/mgx/mgx_env.py`, `metagpt/roles/__init__.py`
- Dependances minimales: `metagpt/memory/memory.py`, `metagpt/context.py`, `metagpt/context_mixin.py`, `pydantic`, `gymnasium`
- Couplings dangereux: `Team.use_mgx` vaut `True` par defaut; `team.py` importe le barrel `metagpt.environment` et `MGXEnv`; `Environment.archive()` peut declencher un archivage git; `Role` depend aussi du barrel `metagpt.actions` et du barrel `metagpt.provider`
- Niveau de coupling: `high`
- Strategie: `adapter`

### 3. Roles + Actions + SOP chain (`roles_actions_sop_chain`)
- Chemins a lire en priorite: `metagpt/roles/role.py`, `metagpt/actions/action.py`, `metagpt/actions/action_node.py`, `metagpt/strategy/planner.py`, `metagpt/actions/di/write_plan.py`, `metagpt/actions/di/ask_review.py`, `metagpt/schema.py`
- Symboles critiques: `Role.set_actions`, `Role._set_react_mode`, `Role._react`, `Role._plan_and_act`, `Action._aask`, `Action.run`, `ActionNode.compile`, `ActionNode.fill`, `ActionNode.from_pydantic`, `Planner.update_plan`, `Planner.process_task_result`, `Planner.ask_review`, `WritePlan.run`, `AskReview.run`
- Coeur runtime: `metagpt/roles/role.py`, `metagpt/actions/action.py`, `metagpt/actions/action_node.py`, `metagpt/strategy/planner.py`
- Adapters/providers: `metagpt/provider/llm_provider_registry.py`, `metagpt/provider/postprocess/llm_output_postprocess.py`
- Tools: aucun obligatoire pour la chaine SOP fixe
- Docs/tests: `examples/build_customized_agent.py`, `tests/metagpt/actions/test_action_node.py`, `tests/metagpt/strategy/test_planner.py`
- Glue a eviter d'abord: `metagpt/actions/__init__.py`, `metagpt/actions/action_outcls_registry.py`, `metagpt/exp_pool/*`
- Dependances minimales: `metagpt/context_mixin.py`, `metagpt/memory/memory.py`, `metagpt/schema.py`, `pydantic`, `tenacity`
- Couplings dangereux: `Action._update_private_llm` rebinde silencieusement le llm via `ModelsConfig.default()`; `ActionNode.fill` est decore par `@exp_cache`; dans `fill()`, les branches `CODE_FILL`, `XML_FILL` et `SINGLE_FILL` utilisent un contexte fragile; `Planner` depend de `AskReview` et `WritePlan`, donc d'une boucle de review explicite
- Niveau de coupling: `high`
- Strategie: `adapter`

### 4. Abstraction providers LLM (`llm_provider_abstraction_system`)
- Chemins a lire en priorite: `metagpt/provider/llm_provider_registry.py`, `metagpt/provider/base_llm.py`, `metagpt/provider/openai_api.py`
- Symboles critiques: `LLM_REGISTRY`, `register_provider`, `create_llm_instance`, `BaseLLM.aask`, `BaseLLM.acompletion_text`, `BaseLLM.get_choice_text`, `BaseLLM.get_choice_function_arguments`, `OpenAILLM._cons_kwargs`, `OpenAILLM._achat_completion_stream`, `OpenAILLM.aask_code`, `OpenAILLM.get_choice_function_arguments`
- Coeur runtime: `metagpt/provider/llm_provider_registry.py`, `metagpt/provider/base_llm.py`
- Adapters/providers: `metagpt/provider/openai_api.py` pour la coque OpenAI-compatible, puis seulement les vendors necessaires
- Tools: aucun
- Docs/tests: `tests/metagpt/provider/test_base_llm.py`, `tests/metagpt/provider/test_openai.py`, `tests/metagpt/provider/mock_llm_config.py`, `tests/metagpt/provider/req_resp_const.py`
- Glue a eviter d'abord: `metagpt/provider/__init__.py` et toute la flotte vendor si vous n'en voulez qu'un seul
- Dependances minimales: `metagpt/configs/llm_config.py`, `metagpt/utils/cost_manager.py`, `metagpt/utils/token_counter.py`, `metagpt/provider/constant.py`, `openai`, `tenacity`
- Couplings dangereux: l'import de `metagpt/provider/__init__.py` declenche l'enregistrement par side effect; `BaseLLM` est pense autour du format OpenAI `choices[0]["message"]`; `BaseLLM.compress_messages()` peut tronquer l'historique; `OpenAILLM.aask_code` suppose un schema de tool call OpenAI
- Niveau de coupling: `medium`
- Strategie: `adapter`

### 5. API/provider layer reutilisable (`provider_api_layer_reusable`)
- Chemins a lire en priorite: `metagpt/provider/general_api_base.py`, `metagpt/provider/general_api_requestor.py`
- Symboles critiques: `ApiType`, `OpenAIResponse`, `APIRequestor.request`, `APIRequestor.arequest`, `APIRequestor.request_raw`, `APIRequestor.arequest_raw`, `GeneralAPIRequestor._interpret_response`, `GeneralAPIRequestor._interpret_async_response`, `parse_stream_helper`, `parse_stream`
- Coeur runtime: `metagpt/provider/general_api_base.py`, `metagpt/provider/general_api_requestor.py`
- Adapters/providers: vos wrappers vendors au-dessus de `APIRequestor` ou `GeneralAPIRequestor`
- Tools: aucun
- Docs/tests: `tests/metagpt/provider/test_general_api_base.py`, `tests/metagpt/provider/test_general_api_requestor.py`
- Glue a eviter d'abord: toute la couche `OpenAILLM` si vous ne voulez qu'un requestor HTTP generic
- Dependances minimales: `aiohttp`, `requests`, `openai` pour certaines exceptions et conventions de nommage
- Couplings dangereux: `general_api_base.py` reste nomme et pense autour des conventions OpenAI; la detection SSE/ndjson est heuristique; les erreurs et reponses reemploient `OpenAIResponse`
- Niveau de coupling: `medium`
- Strategie: `adapter`

### 6. Memory / serialization / recovery (`memory_serialization_recovery_system`)
- Chemins a lire en priorite: `metagpt/memory/memory.py`, `metagpt/base/base_serialization.py`, `metagpt/utils/serialize.py`, `metagpt/schema.py`, `metagpt/team.py`, `metagpt/context.py`, `metagpt/utils/recovery_util.py`, puis `metagpt/memory/role_zero_memory.py` si vous voulez du long terme
- Symboles critiques: `Memory.add`, `Memory.find_news`, `BaseSerialization.__serialize_with_class_type__`, `BaseSerialization.__convert_to_real_type__`, `SerializationMixin.serialize`, `SerializationMixin.deserialize`, `serialize_message`, `deserialize_message`, `Team.serialize`, `Team.deserialize`, `Context.serialize`, `Context.deserialize`, `load_history`, `save_history`, `RoleZeroLongTermMemory`
- Coeur runtime: `metagpt/memory/memory.py`, `metagpt/base/base_serialization.py`, `metagpt/utils/serialize.py`, les mixins de `metagpt/schema.py`, `metagpt/team.py`, `metagpt/context.py`
- Adapters/providers: `metagpt/memory/role_zero_memory.py` ajoute une branche RAG, pas une dependance de base
- Tools: aucun
- Docs/tests: `tests/metagpt/memory/test_memory.py`, `tests/metagpt/test_message.py`, `tests/metagpt/test_schema.py`, `tests/metagpt/memory/test_role_zero_memory.py`
- Glue a eviter d'abord: `metagpt/utils/recovery_util.py` si vous n'avez pas un role type DataInterpreter avec notebook
- Dependances minimales: `pickle`, `pydantic`, `nbformat` pour la recovery notebook, `metagpt/const.py`
- Couplings dangereux: `schema.py` melange transport, plan, contexts de code et classes UML; `serialize_message()` depend de la reconstruction `ActionNode`; `save_history()` suppose `role.planner.plan` et `role.execute_code.nb`; `RoleZeroLongTermMemory` avale les erreurs et tire `metagpt.rag`
- Niveau de coupling: `high`
- Strategie: `adapter`

### 7. RAG minimal (`rag_minimal_system`)
- Chemins a lire en priorite: `metagpt/rag/engines/simple.py`, `metagpt/rag/factories/retriever.py`, `metagpt/rag/schema.py`
- Symboles critiques: `SimpleEngine.from_docs`, `SimpleEngine.from_objs`, `SimpleEngine.retrieve`, `SimpleEngine.persist`, `SimpleEngine.delete_docs`, `RetrieverFactory.get_retriever`, `get_or_build_index`, `BaseRetrieverConfig`, `BM25RetrieverConfig`, `FAISSRetrieverConfig`, `ChromaRetrieverConfig`
- Coeur runtime: `metagpt/rag/engines/simple.py`, `metagpt/rag/factories/retriever.py`
- Adapters/providers: `metagpt/rag/retrievers/*.py`, `metagpt/rag/factories/embedding.py`, `metagpt/rag/factories/ranker.py`
- Tools: aucun
- Docs/tests: `examples/rag/rag_pipeline.py`, `examples/rag/rag_bm.py`, `tests/metagpt/rag/engines/test_simple.py`, `tests/metagpt/rag/factories/test_retriever.py`
- Glue a eviter d'abord: `metagpt/exp_pool/*`, `metagpt/memory/role_zero_memory.py`, OmniParse
- Dependances minimales: `llama_index`, `chromadb`, `faiss`, `fsspec`, `metagpt/rag/retrievers/base.py`, `metagpt/rag/retrievers/hybrid_retriever.py`
- Couplings dangereux: `SimpleEngine` definit `_from_nodes` deux fois; la resolution embed/omniparse depend de `config2`; `RetrieverFactory` tire vite trop de retrievers si vous gardez tous les configs; le support `persist`, `add_docs`, `delete_docs` depend du type reel de retriever
- Niveau de coupling: `high`
- Strategie: `adapter`

### 8. Tools / browser / search helpers (`tools_browser_search_helpers`)
- Chemins a lire en priorite: `metagpt/tools/tool_registry.py`, `metagpt/tools/search_engine.py`, `metagpt/tools/web_browser_engine.py`
- Symboles critiques: `TOOL_REGISTRY`, `register_tool`, `make_schema`, `validate_tool_names`, `register_tools_from_file`, `register_tools_from_path`, `SearchEngine.from_search_config`, `SearchEngine.from_search_func`, `SearchEngine.run`, `WebBrowserEngine.from_browser_config`, `WebBrowserEngine.run`
- Coeur runtime: `metagpt/tools/tool_registry.py`, `metagpt/tools/search_engine.py`, `metagpt/tools/web_browser_engine.py`
- Adapters/providers: `metagpt/tools/search_engine_serper.py`, `metagpt/tools/search_engine_ddg.py`, `metagpt/tools/web_browser_engine_playwright.py`, `metagpt/tools/web_browser_engine_selenium.py`
- Tools: cette brique est elle-meme une couche tools
- Docs/tests: `tests/metagpt/tools/test_tool_registry.py`, `tests/metagpt/tools/test_search_engine.py`, `tests/metagpt/tools/test_web_browser_engine.py`
- Glue a eviter d'abord: `metagpt/tools/__init__.py`, les wrappers browser/search non utilises, et `metagpt/tools/libs/editor.py` si vous voulez uniquement search/browser
- Dependances minimales: `metagpt/tools/tool_convert.py`, `metagpt/tools/tool_data_type.py`, `metagpt/configs/search_config.py`, `metagpt/configs/browser_config.py`, `metagpt/utils/parse_html.py`
- Couplings dangereux: l'enregistrement se fait a l'import; `validate_tool_names()` accepte noms, tags, fichiers et repertoires; les wrappers sont charges dynamiquement; les vrais couts arrivent via Playwright/Selenium et les backends search tiers
- Niveau de coupling: `medium`
- Strategie: `adapter`

### 9. Software company flow minimal (`software_company_flow_minimal`)
- Chemins a lire en priorite: `metagpt/software_company.py`, `metagpt/team.py`, `metagpt/roles/product_manager.py`, `metagpt/roles/architect.py`, `metagpt/roles/project_manager.py`, `metagpt/roles/engineer.py`, `metagpt/roles/qa_engineer.py`, `metagpt/roles/di/team_leader.py`, `metagpt/roles/di/role_zero.py`
- Symboles critiques: `generate_repo`, `startup`, `Team.deserialize`, `ProductManager.__init__`, `Architect.__init__`, `ProjectManager.__init__`, `Engineer._act_write_code`, `QaEngineer._write_test`, `RoleZero.set_plan_and_tool`, `RoleZero.set_tool_execution`, `TeamLeader.publish_team_message`
- Coeur runtime: `metagpt/software_company.py`, `metagpt/team.py`, `metagpt/roles/di/role_zero.py`, `metagpt/roles/di/team_leader.py`
- Adapters/providers: `metagpt/roles/product_manager.py`, `metagpt/roles/architect.py`, `metagpt/roles/project_manager.py`, `metagpt/roles/engineer.py`, `metagpt/roles/qa_engineer.py`
- Tools: `metagpt/tools/libs/browser.py`, `metagpt/tools/libs/editor.py`, `metagpt/tools/libs/terminal.py`, `metagpt/tools/tool_registry.py`
- Docs/tests: `examples/use_off_the_shelf_agent.py`, `examples/di/software_company.py`, `tests/metagpt/roles/di/test_team_leader.py`, `tests/metagpt/roles/di/test_routing.py`
- Glue a eviter d'abord: `metagpt/roles/__init__.py`, `metagpt/actions/__init__.py`, `ProjectRepo` et toute la convention documentaire MetaGPT si vous n'en avez pas besoin
- Dependances minimales: `metagpt/config2.py`, `metagpt/context.py`, `metagpt/prompts/di/*`, `metagpt/actions/*`, `metagpt/utils/project_repo.py`
- Couplings dangereux: le flow par defaut actuel n'est plus le vieux PM -> Architect -> PMgr -> Engineer -> QA; `generate_repo()` embauche `TeamLeader`, `ProductManager`, `Architect`, `Engineer2`, `DataAnalyst`; `ProjectManager` et `QaEngineer` sont hors du chemin par defaut; `Engineer` et `QaEngineer` restent fortement couples a `ProjectRepo` et aux contrats `instruct_content`
- Niveau de coupling: `very_high`
- Strategie: `reecrire`

### 10. Environment API registry core (`environment_api_registry_core`)
- Chemins a lire en priorite: `metagpt/environment/api/env_api.py`, `metagpt/environment/base_env.py`
- Symboles critiques: `EnvAPIAbstract`, `EnvAPIRegistry`, `WriteAPIRegistry`, `ReadAPIRegistry`, `mark_as_readable`, `mark_as_writeable`, `ExtEnv.get_all_available_apis`, `ExtEnv.read_from_api`, `ExtEnv.write_thru_api`
- Coeur runtime: `metagpt/environment/api/env_api.py`, les decorateurs et `ExtEnv` dans `metagpt/environment/base_env.py`
- Adapters/providers: vos classes d'env concretes ensuite, par exemple un env device ou simulator, mais pas necessaires au noyau
- Tools: aucun
- Docs/tests: `tests/metagpt/test_environment.py`
- Glue a eviter d'abord: `Environment`, `MGXEnv`, les environnements de domaine (`android`, `stanford_town`, `werewolf`)
- Dependances minimales: `pydantic`, `gymnasium`, `metagpt.utils.common.get_function_schema`, `metagpt.utils.common.is_coroutine_func`
- Couplings dangereux: les registres `env_read_api_registry` et `env_write_api_registry` sont process-global et alimentes a l'import; `base_env.py` contient aussi le bus de messages multi-role, qu'il faut separer si vous ne voulez que l'API registry
- Niveau de coupling: `low`
- Strategie: `copier`

## Vue transverse des hubs techniques

- `metagpt/logs.py` `[inbound_imports=246]`: hub global d'observation et de side effects; souvent indispensable pour faire tourner, rarement une bonne cible de copie brute.
- `metagpt/utils/common.py` `[inbound_imports=143]`: gros sac de helpers; a traiter fonction par fonction, jamais comme module a embarquer en bloc.
- `metagpt/const.py` `[inbound_imports=132]`: hub de constantes, chemins et flags; utile comme reference, dangereux comme dependance implicite.
- `metagpt/schema.py` `[inbound_imports=130]`: vrai centre du runtime, mais il melange transport, planification, serialization, contexts de code et structures UML; le meilleur gain vient d'un split interne avant extraction.
- `metagpt/actions/__init__.py` `[inbound_imports=85]`: barrel pratique pour MetaGPT, mauvais point d'entree de reuse.
- `metagpt/config2.py` `[inbound_imports=62]`: hub de configuration multi-sous-systemes; tres utile, mais il embarque beaucoup plus que le seul llm.
- `metagpt/roles/__init__.py` `[inbound_imports=40]`: autre barrel; la plupart des extractions gagnent a l'eviter pour viser les fichiers de role exacts.
- `metagpt/actions/action_node.py` `[inbound_imports=36]`: hub de structured prompting; excellent levier si vous assumez son coupling `exp_pool` et postprocess.
- `metagpt/tools/tool_registry.py` `[inbound_imports=34]`: hub de schema tools et de chargement dynamique; tres rentable, mais demande un bornage de securite.
- `metagpt/llm.py` `[inbound_imports=33]`: facade tres mince; bonne pour localiser la fabrique llm, pas comme cible principale d'extraction.
- Hubs de side effects a surveiller en plus: `metagpt/provider/__init__.py`, `metagpt/environment/__init__.py`, `metagpt/team.py`, `metagpt/roles/di/role_zero.py`

## Couplages a eviter en priorite

- Eviter les barrel imports comme point d'entree de copie: `metagpt/actions/__init__.py`, `metagpt/roles/__init__.py`, `metagpt/provider/__init__.py`, `metagpt/environment/__init__.py`
- Eviter les defaults caches ou globaux sans les revisiter: `_CONFIG_CACHE` dans `metagpt/config2.py`, `env_read_api_registry`, `env_write_api_registry`, `TOOL_REGISTRY`, `LLM_REGISTRY`
- Eviter les side effects de persistance silencieuse: `Environment.archive()`, `GitRepository.archive()`, `save_history()`, long-term memory RAG
- Eviter de copier `schema.py` en bloc si vous ne voulez qu'une seule sous-fonction; c'est le fichier le plus rentable a decouper avant tout effort de reuse
- Eviter de prendre `RoleZero` ou `software_company.py` comme "minimal stack"; ce sont des couches d'integration, pas des noyaux minimaux

## Batchs ou sous-batchs qui meritent encore un prompt specialise dedie

- `B01 / schema split`: isoler `Message`, `Task`, `Plan`, `MessageQueue`, `SerializationMixin` du reste de `metagpt/schema.py`
- `B01 / context-config deglobalize`: sortir `_CONFIG_CACHE`, clarifier `Context.llm()`, et rendre `ContextMixin` non-creatrice par defaut
- `B02 + B07 / team-env split`: separer proprement `Team`, `Environment`, `MGXEnv`, `Environment API registry`, et retirer les imports barrel
- `B03 / ActionNode portability`: fermer la dependance `exp_pool`, verifier les branches `CODE_FILL` / `XML_FILL` / `SINGLE_FILL`, et definir un closure minimal exact
- `B03 / fixed SOP only`: produire une extraction "Role + Action + BY_ORDER" sans planner ni tool bus
- `B04 / provider import contract`: cartographier l'ordre minimal d'import pour n'enregistrer que les vendors voulus
- `B05 / tool registry hardening`: durcir `validate_tool_names()` et distinguer noms, tags, fichiers et repertoires
- `B05 / editor/browser/search subset`: documenter un sous-ensemble strict sans Playwright ou sans edition de fichiers
- `B06 / one-retriever RAG`: produire une recette RAG minimale centree uniquement sur `BM25` ou uniquement sur `Chroma`
- `B02 + B03 + B05 / RoleZero-TeamLeader`: cartographier exactement le closure runtime/prompt/tools/memory du stack agent dynamique
- `B02 + B08 / software company current vs legacy`: separer le flow actuel `TeamLeader/ProductManager/Architect/Engineer2/DataAnalyst` du flow historique `ProjectManager/Engineer/QaEngineer`

## Verdict rapide

- Meilleures extractions immediates: `environment_api_registry_core`, `llm_provider_registry.py`, `general_api_requestor`, `tool_registry`, `SearchEngine`, `WebBrowserEngine`, `Memory`
- Meilleures extractions avec adaptation raisonnable: `Context`, `Team + Environment`, `Role + Action`, `BaseLLM + OpenAILLM`, `SimpleEngine`
- Pieces a prendre surtout comme spec de reference: `software_company.py`, `RoleZero`, `TeamLeader`, `Engineer`, `QaEngineer`, tout le flow software-company complet
