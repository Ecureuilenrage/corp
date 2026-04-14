# 04-agent-runtime - Agent Runtime, Providers, Memory, Skills

_Primary coverage_: 31 fichiers, 6200 lignes approx. dans ce batch.

## purpose
Porter le coeur agentique de ChatDev: conversation provider-aware, tool-calling, memoire, thinking, skills locales et normalisation des reponses modele.

## subdomains
- coeur runtime: `runtime/node/executor/agent_executor.py`, `runtime/node/agent/providers/response.py`.
- providers / abstraction modele: `runtime/node/agent/providers/base.py`, `runtime/node/agent/providers/builtin_providers.py`, `runtime/node/agent/providers/openai_provider.py`, `runtime/node/agent/providers/gemini_provider.py`.
- tools / function calling / MCP: `runtime/node/agent/tool/tool_manager.py`, `entity/configs/node/tooling.py`, `utils/function_manager.py`, `utils/function_catalog.py`.
- memory runtime: `runtime/node/agent/memory/memory_base.py`, `runtime/node/agent/memory/registry.py`, `runtime/node/agent/memory/builtin_stores.py`, `runtime/node/agent/memory/simple_memory.py`, `runtime/node/agent/memory/file_memory.py`, `runtime/node/agent/memory/blackboard_memory.py`, `runtime/node/agent/memory/mem0_memory.py`, `runtime/node/agent/memory/embedding.py`.
- thinking / self-reflection: `runtime/node/agent/thinking/registry.py`, `runtime/node/agent/thinking/builtin_thinking.py`, `runtime/node/agent/thinking/thinking_manager.py`, `runtime/node/agent/thinking/self_reflection.py`.
- skills repo-locales: `runtime/node/agent/skills/manager.py`, `.agents/skills/greeting-demo/SKILL.md`, `.agents/skills/python-scratchpad/SKILL.md`, `.agents/skills/rest-api-caller/SKILL.md`.
- orchestration graph/workflow touchee par couplage: `runtime/node/executor/base.py`, `workflow/graph.py`, `workflow/runtime/runtime_builder.py`.
- API serveur / sessions touchees par couplage: `utils/attachments.py`, `utils/token_tracker.py`, `utils/human_prompt.py`, `server/services/websocket_executor.py`.
- frontend Vue: aucune dependance directe.
- tests / docs / infra: `tests/test_mem0_memory.py`, `tests/test_memory_embedding_consistency.py`, `docs/user_guide/en/nodes/agent.md`, `docs/user_guide/en/modules/memory.md`, `docs/user_guide/en/modules/thinking.md`, `docs/user_guide/en/modules/tooling/*.md`.

## entrypoints
- `runtime/node/executor/agent_executor.py` - `AgentNodeExecutor.execute` - pipeline principal d'un noeud `agent`.
- `runtime/node/agent/providers/builtin_providers.py` - `ProviderRegistry.register(...)` - branche les providers builtin visibles dans les schemas.
- `runtime/node/agent/memory/builtin_stores.py` - `register_memory_store(...)`, `MemoryFactory.create_memory` - branche les stores memoire builtin.
- `runtime/node/agent/thinking/builtin_thinking.py` - `register_thinking_mode(...)`, `ThinkingManagerFactory.get_thinking_manager` - branche le thinking builtin.
- `runtime/node/agent/tool/tool_manager.py` - `ToolManager.get_tool_specs`, `ToolManager.execute_tool` - surface reelle du pont functions + MCP.
- `runtime/node/agent/skills/manager.py` - `AgentSkillManager.discover`, `activate_skill`, `read_skill_file` - surface reelle des skills.

## key files
- `runtime/node/executor/agent_executor.py` - `AgentNodeExecutor` - assemble provider, tool specs, thinking, memoire, skills et boucle tool-calling.
- `runtime/node/agent/providers/base.py` - `ModelProvider`, `ProviderRegistry` - abstraction minimale pour brancher un modele.
- `runtime/node/agent/providers/openai_provider.py` - `OpenAIProvider` - implementation la plus complete, incluant responses API, chat fallback, fichiers, images et tool calls.
- `runtime/node/agent/providers/gemini_provider.py` - `GeminiProvider` - seconde implementation utile pour juger la stabilite de l'abstraction.
- `runtime/node/agent/providers/response.py` - `ModelResponse` - contrat normalise provider -> executor.
- `runtime/node/agent/tool/tool_manager.py` - `ToolManager`, `_StdioClientWrapper` - pont vers functions locales, MCP HTTP et MCP stdio.
- `runtime/node/agent/memory/memory_base.py` - `MemoryContentSnapshot`, `MemoryItem`, `MemoryWritePayload`, `MemoryRetrievalResult`, `MemoryBase`, `MemoryManager`.
- `runtime/node/agent/memory/embedding.py` - `EmbeddingFactory`, `OpenAIEmbedding`, `LocalEmbedding` - couche vectorisation pour memoires semantiques.
- `runtime/node/agent/thinking/self_reflection.py` - `SelfReflectionThinkingManager` - thinking post-generation builtin.
- `runtime/node/agent/skills/manager.py` - `parse_skill_file`, `AgentSkillManager` - parse frontmatter YAML et outils internes de skills.

## feature inventory
- `agent.execution_pipeline`: coeur runtime. Fichiers `runtime/node/executor/agent_executor.py`, `runtime/node/agent/providers/response.py`, `entity/messages.py`. Symboles centraux `AgentNodeExecutor.execute`, `_prepare_prompt_messages`, `_prepare_message_conversation`, `_invoke_provider`, `_execute_with_retry`, `_handle_tool_calls`, `_update_memory`. Statut reuse: copiable avec adaptation forte.
- `agent.provider_registry_abstraction`: providers. Fichiers `runtime/node/agent/providers/base.py`, `runtime/node/agent/providers/builtin_providers.py`, `runtime/node/agent/providers/openai_provider.py`, `runtime/node/agent/providers/gemini_provider.py`, `runtime/node/agent/providers/response.py`. Symboles centraux `ModelProvider`, `ProviderRegistry.register`, `ProviderRegistry.get_provider`, `ModelResponse`, `OpenAIProvider.call_model`, `GeminiProvider.call_model`. Statut reuse: copiable avec adaptation.
- `agent.mcp_tool_bridge`: tools / MCP. Fichiers `runtime/node/agent/tool/tool_manager.py`, `entity/configs/node/tooling.py`, `utils/function_manager.py`, `utils/function_catalog.py`, `mcp_example/mcp_server.py`. Symboles centraux `ToolManager.get_tool_specs`, `ToolManager.execute_tool`, `_build_function_specs`, `_build_mcp_remote_specs`, `_build_mcp_local_specs`, `_StdioClientWrapper.list_tools`, `_StdioClientWrapper.call_tool`. Statut reuse: copiable avec adaptation.
- `agent.memory_store_runtime`: memory runtime. Fichiers `runtime/node/agent/memory/memory_base.py`, `runtime/node/agent/memory/registry.py`, `runtime/node/agent/memory/builtin_stores.py`, `runtime/node/agent/memory/simple_memory.py`, `runtime/node/agent/memory/file_memory.py`, `runtime/node/agent/memory/blackboard_memory.py`, `runtime/node/agent/memory/mem0_memory.py`, `runtime/node/agent/memory/embedding.py`. Symboles centraux `MemoryBase`, `MemoryManager.retrieve`, `MemoryManager.update`, `register_memory_store`, `MemoryFactory.create_memory`, `SimpleMemory.retrieve`, `FileMemory.retrieve`, `Mem0Memory.retrieve`, `EmbeddingFactory.create_embedding`. Statut reuse: copiable avec adaptation.
- `agent.thinking_reflection_runtime`: thinking. Fichiers `runtime/node/agent/thinking/registry.py`, `runtime/node/agent/thinking/builtin_thinking.py`, `runtime/node/agent/thinking/thinking_manager.py`, `runtime/node/agent/thinking/self_reflection.py`. Symboles centraux `ThinkingRegistration`, `register_thinking_mode`, `ThinkingManagerFactory.get_thinking_manager`, `ThinkingManagerBase.think`, `SelfReflectionThinkingManager._after_gen_think`. Statut reuse: copiable avec adaptation.
- `agent.skill_frontmatter_loader`: skills. Fichiers `runtime/node/agent/skills/manager.py`, `.agents/skills/*`. Symboles centraux `SkillMetadata`, `SkillValidationError`, `parse_skill_file`, `_parse_frontmatter`, `AgentSkillManager.discover`, `AgentSkillManager.build_available_skills_xml`, `AgentSkillManager.activate_skill`, `AgentSkillManager.read_skill_file`. Statut reuse: copiable avec adaptation faible.

## data flow
1. `runtime/node/executor/agent_executor.py::AgentNodeExecutor.execute` recoit `Node` et `List[Message]`.
2. L'executor recupere le provider via `ProviderRegistry.get_provider(agent_config.provider)`, instancie le client et prepare `conversation` + `timeline`.
3. Il construit eventuellement `AgentSkillManager`, ajoute les tool specs internes `activate_skill` / `read_skill_file`, puis fusionne ces specs avec les tools externes du `ToolManager`.
4. Si `thinking` est active, `_apply_pre_generation_thinking` et `_apply_post_generation_thinking` passent par `ThinkingManagerBase.think`.
5. Si des `memory attachments` sont declares, `_retrieve_memory` et `_update_memory` deleguent a `MemoryManager.retrieve` / `MemoryManager.update`.
6. Le provider renvoie un `ModelResponse`; si `ModelResponse.has_tool_calls()` retourne vrai, `_handle_tool_calls` execute chaque appel via `ToolManager.execute_tool` ou via les outils internes de skills.
7. Les resultats d'outils sont reserialises en `Message` / `FunctionCallOutputEvent`, reinjectes dans `timeline`, puis l'executor relance le provider jusqu'a epuisement des tool calls ou limite.
8. Les pieces jointes produites par le modele ou les outils sont persistees via `utils/attachments.py::AttachmentStore`, puis le `Message` final repart vers `workflow/graph.py`.

## symbol map
- `runtime/node/executor/agent_executor.py`: `AgentNodeExecutor`, `execute`, `_prepare_prompt_messages`, `_prepare_message_conversation`, `_prepare_call_options`, `_build_skill_manager`, `_build_system_prompt`, `_merge_skill_tool_specs`, `_build_agent_invoker`, `_invoke_provider`, `_execute_with_retry`, `_apply_pre_generation_thinking`, `_apply_memory_retrieval`, `_retrieve_memory`, `_handle_tool_calls`, `_execute_tool_batch`, `_execute_skill_tool`, `_build_function_call_output_event`, `_build_tool_message`, `_persist_message_attachments`, `_apply_post_generation_thinking`, `_update_memory`.
- `runtime/node/agent/providers/base.py`: `ModelProvider`, `ProviderRegistry.register`, `ProviderRegistry.get_provider`, `ProviderRegistry.list_providers`, `ProviderRegistry.iter_metadata`.
- `runtime/node/agent/providers/response.py`: `ModelResponse`, `ModelResponse.has_tool_calls`, `ModelResponse.to_dict`.
- `runtime/node/agent/providers/openai_provider.py`: `OpenAIProvider`, `call_model`, `_build_request_payload`, `_build_chat_payload`, `_serialize_message_for_chat`, `_deserialize_chat_response`, `_deserialize_response`, `_parse_tool_call`, `_build_tool_call_id`, `_append_response_output`, `extract_token_usage`.
- `runtime/node/agent/providers/gemini_provider.py`: `GeminiProvider`, `_build_tool_call_payload`, `_parse_candidate_parts`, `extract_token_usage`.
- `runtime/node/agent/tool/tool_manager.py`: `_FunctionManagerCacheEntry`, `ToolManager`, `get_tool_specs`, `execute_tool`, `_build_function_specs`, `_build_mcp_remote_specs`, `_build_mcp_local_specs`, `_execute_function_tool`, `_normalize_mcp_result`, `_convert_mcp_content_to_blocks`, `_extract_attachment_store`, `_get_stdio_client`, `_StdioClientWrapper`, `_StdioClientWrapper.list_tools`, `_StdioClientWrapper.call_tool`.
- `runtime/node/agent/memory/memory_base.py`: `MemoryContentSnapshot`, `MemoryItem`, `MemoryWritePayload`, `MemoryRetrievalResult`, `MemoryBase`, `MemoryManager`, `MemoryManager.retrieve`, `MemoryManager.update`.
- `runtime/node/agent/memory/registry.py`: `MemoryStoreRegistration`, `register_memory_store`, `get_memory_store_registration`, `iter_memory_store_registrations`.
- `runtime/node/agent/memory/builtin_stores.py`: `_create_mem0_memory`, `MemoryFactory.create_memory`.
- `runtime/node/agent/memory/embedding.py`: `EmbeddingBase`, `EmbeddingFactory`, `OpenAIEmbedding`, `LocalEmbedding`.
- `runtime/node/agent/thinking/registry.py`: `ThinkingRegistration`, `register_thinking_mode`, `get_thinking_registration`, `iter_thinking_registrations`.
- `runtime/node/agent/thinking/builtin_thinking.py`: `ThinkingManagerFactory.get_thinking_manager`.
- `runtime/node/agent/thinking/thinking_manager.py`: `ThinkingPayload`, `ThinkingManagerBase`, `ThinkingManagerBase.think`.
- `runtime/node/agent/thinking/self_reflection.py`: `SelfReflectionThinkingManager`, `_after_gen_think`.
- `runtime/node/agent/skills/manager.py`: `SkillValidationError`, `SkillMetadata`, `parse_skill_file`, `_parse_frontmatter`, `_parse_optional_str_list`, `_parse_optional_mapping`, `AgentSkillManager`.

## dependency map
- hard blocker - node execution contract: `runtime/node/executor/base.py::NodeExecutor`, `ExecutionContext`. `AgentNodeExecutor` herite d'un contrat qui lui fournit `attachment_store`, `log_manager`, `token_tracker`, `human_prompt_service`, `memory_managers`, `thinking_managers`.
- hard blocker - message contract: `entity/messages.py::Message`, `MessageBlock`, `AttachmentRef`, `ToolCallPayload`, `FunctionCallOutputEvent`. Les providers et le tool loop parlent tous ce format.
- hard blocker - config contract: `entity/configs/node/agent.py`, `entity/configs/node/memory.py`, `entity/configs/node/tooling.py`, `entity/configs/node/thinking.py`, `entity/configs/node/skills.py`. Sans eux, impossible de typer `provider`, `memory attachments`, `tooling`, `thinking`, `skills`.
- hard blocker - tool bridge: `utils/function_manager.py`, `utils/function_catalog.py`, `entity/tool_spec.py`, `utils/attachments.py`. Meme un agent "minimal" garde au moins ces dependances si on veut tool calling.
- medium blocker - logging / token usage: `utils/log_manager.py`, `utils/logger.py`, `utils/token_tracker.py`. `OpenAIProvider` et `AgentNodeExecutor` s'en servent pour tracer couts et appels.
- medium blocker - memory vector search: `faiss-cpu`, `numpy`, `openai` et `mem0ai` selon le store choisi. `SimpleMemory` et `FileMemory` supposent `EmbeddingFactory`.
- medium blocker - MCP stack: `fastmcp`, `mcp`, `fastmcp.client.transports.StreamableHttpTransport`, `StdioTransport`. Requis si l'on garde `mcp_remote` ou `mcp_local`.
- medium blocker - skills runtime: `.agents/skills/<skill>/SKILL.md` avec frontmatter YAML valide. Sans ce layout, `AgentSkillManager.discover` ne trouve rien.
- inbound adapters utiles a lire avant extraction: `workflow/runtime/runtime_builder.py`, `workflow/graph.py`, `runtime/node/executor/base.py`, `entity/configs/node/tooling.py`, `yaml_instance/demo_mcp.yaml`, `yaml_instance/skills.yaml`.

## external deps
- `openai` pour `OpenAIProvider` et `OpenAIEmbedding`.
- `google-genai` pour `GeminiProvider`.
- `mem0ai` pour `Mem0Memory`.
- `faiss-cpu`, `numpy` pour `SimpleMemory` / `FileMemory`.
- `fastmcp`, `mcp` pour le pont MCP.
- `tenacity` est utilise par le provider/runtime pour les retries.

## flags/env
- `API_KEY`, `BASE_URL`, `MODEL_NAME` et `provider` pilotent les providers via `AgentConfig`.
- `MEM0_API_KEY` est requis pour `Mem0Memory`.
- `MAC_FUNCTIONS_DIR`, `MAC_EDGE_FUNCTIONS_DIR`, `MAC_EDGE_PROCESSOR_FUNCTIONS_DIR` peuvent changer les repertoires de tools/fonctions visibles.
- `MY_MCP_TOKEN` ou autres headers peuvent etre injectes via `McpRemoteConfig.headers`.

## reusable ideas
- `ProviderRegistry` est une abstraction minimale et saine pour brancher plusieurs providers tout en gardant un contrat unique `ModelResponse`.
- `AgentSkillManager` est une brique rare et portable: discovery repo-locale, frontmatter, activation explicite, lecture de fichiers bornes.
- `MemoryContentSnapshot` et `MemoryWritePayload` sont de bons contrats autonomes si l'on veut separer memoire et executor.

## extraction recipes
1. Extraire une abstraction provider minimale.
   Fichiers a prendre d'abord: `runtime/node/agent/providers/base.py`, `runtime/node/agent/providers/response.py`, `runtime/node/agent/providers/openai_provider.py`, `runtime/node/agent/providers/gemini_provider.py`, `runtime/node/agent/providers/builtin_providers.py`.
   Dependances minimales: `entity/messages.py`, `entity/tool_spec.py`, `utils/token_tracker.py`, `AgentConfig`.
   Strategie: copier avec adaptation.

2. Extraire le runtime memoire sans l'agent complet.
   Fichiers a prendre d'abord: `runtime/node/agent/memory/memory_base.py`, `runtime/node/agent/memory/registry.py`, `runtime/node/agent/memory/builtin_stores.py`, `runtime/node/agent/memory/simple_memory.py`, `runtime/node/agent/memory/file_memory.py`, `runtime/node/agent/memory/blackboard_memory.py`, `runtime/node/agent/memory/mem0_memory.py`, `runtime/node/agent/memory/embedding.py`.
   Dependances minimales: `entity/messages.py`, `entity/configs/node/memory.py`.
   Strategie: copier avec adaptation.

3. Extraire uniquement le loader de skills.
   Fichiers a prendre d'abord: `runtime/node/agent/skills/manager.py`.
   Dependances minimales: `entity/tool_spec.py`, `yaml`, layout `.agents/skills`.
   Strategie: copier presque tel quel.

4. Extraire le thinking reflection.
   Fichiers a prendre d'abord: `runtime/node/agent/thinking/registry.py`, `runtime/node/agent/thinking/builtin_thinking.py`, `runtime/node/agent/thinking/thinking_manager.py`, `runtime/node/agent/thinking/self_reflection.py`.
   Dependances minimales: `entity/messages.py`, `entity/configs/node/thinking.py`.
   Strategie: copier avec adaptation.

5. Extraire le pont functions + MCP.
   Fichiers a prendre d'abord: `runtime/node/agent/tool/tool_manager.py`, `entity/configs/node/tooling.py`, `utils/function_manager.py`, `utils/function_catalog.py`, `mcp_example/mcp_server.py`.
   Dependances minimales: `entity/tool_spec.py`, `utils/attachments.py`, bibliotheques MCP.
   Strategie: copier avec adaptation.

6. Extraire l'agent executor complet.
   Fichiers a prendre d'abord: `runtime/node/executor/agent_executor.py`, plus provider/memory/thinking/tool/skills.
   Dependances minimales: pratiquement tous les sous-systemes ci-dessus.
   Strategie: redecouper ou reecrire autour d'un contrat plus petit plutot que copier brut.

## do not copy blindly
- `runtime/node/executor/agent_executor.py` est trop central et trop large pour etre un bon candidat copy-paste brut. Il depend de `ExecutionContext`, des providers, des memories, du thinking, des tools, des skills, du logger et des attachments.
- `runtime/node/agent/tool/tool_manager.py` utilise `asyncio.run(...)` pour certains fetchs MCP. Si vous l'integrez dans un produit deja async, il faudra revoir cette strategie.
- `runtime/node/agent/providers/openai_provider.py` embarque plusieurs modes de serialisation (`responses` et `chat`), inline des pieces jointes et preserve des conventions ChatDev sur `timeline`. Copier partiellement ce fichier change vite le comportement.
- `runtime/node/agent/memory/simple_memory.py` et `file_memory.py` supposent des embeddings de dimension stable et `faiss.IndexFlatIP`. Changer le backend d'embedding sans garder ce contrat casse la recherche.
- `runtime/node/agent/skills/manager.py` impose un frontmatter YAML en tete de `SKILL.md` et exige que le nom du skill matche le nom du dossier. C'est un couplage de layout, pas juste de parsing.
- `Mem0Memory` depend d'un SDK externe permissif et a des conventions de filtres `user_id` / `agent_id` confirmees seulement par les tests du repo.

## minimal reusable slices
- slice `provider-registry`: `runtime/node/agent/providers/base.py`, `runtime/node/agent/providers/response.py`, `runtime/node/agent/providers/builtin_providers.py`. Copiable avec adaptation faible.
- slice `openai-provider`: `runtime/node/agent/providers/openai_provider.py` + base/response. Copiable avec adaptation.
- slice `memory-runtime`: `runtime/node/agent/memory/memory_base.py`, `runtime/node/agent/memory/registry.py`, `runtime/node/agent/memory/builtin_stores.py`, `runtime/node/agent/memory/embedding.py`. Copiable avec adaptation.
- slice `simple-memory-store`: `runtime/node/agent/memory/simple_memory.py`. Copiable avec adaptation.
- slice `skills-loader`: `runtime/node/agent/skills/manager.py`. Copiable presque tel quel.
- slice `thinking-reflection`: `runtime/node/agent/thinking/thinking_manager.py`, `runtime/node/agent/thinking/self_reflection.py`, `runtime/node/agent/thinking/builtin_thinking.py`. Copiable avec adaptation.
- slice `tool-bridge`: `runtime/node/agent/tool/tool_manager.py`, `utils/function_manager.py`, `utils/function_catalog.py`, `entity/tool_spec.py`. Copiable avec adaptation.
- slice `agent-executor-core`: `runtime/node/executor/agent_executor.py`. A reecrire ou a scinder avant copie.

## exact search shortcuts
- `rg -n "execute\\(|_prepare_prompt_messages|_prepare_message_conversation|_handle_tool_calls|_execute_tool_batch|_update_memory|_apply_pre_generation_thinking|_apply_post_generation_thinking" runtime/node/executor/agent_executor.py`
- `rg -n "class ModelProvider|class ProviderRegistry|register\\(|get_provider|list_providers" runtime/node/agent/providers/base.py runtime/node/agent/providers/builtin_providers.py`
- `rg -n "call_model|extract_token_usage|_deserialize_response|_parse_tool_call|_build_tool_call_id" runtime/node/agent/providers/openai_provider.py runtime/node/agent/providers/gemini_provider.py`
- `rg -n "class ToolManager|get_tool_specs|execute_tool|_build_function_specs|_build_mcp_remote_specs|_build_mcp_local_specs|_StdioClientWrapper" runtime/node/agent/tool/tool_manager.py`
- `rg -n "class MemoryBase|class MemoryManager|MemoryContentSnapshot|MemoryWritePayload|retrieve\\(|update\\(" runtime/node/agent/memory/memory_base.py`
- `rg -n "register_memory_store|MemoryFactory|SimpleMemory|FileMemory|BlackboardMemory|Mem0Memory|EmbeddingFactory" runtime/node/agent/memory`
- `rg -n "register_thinking_mode|ThinkingManagerFactory|ThinkingManagerBase|SelfReflectionThinkingManager|think\\(" runtime/node/agent/thinking`
- `rg -n "parse_skill_file|AgentSkillManager|activate_skill|read_skill_file|build_available_skills_xml" runtime/node/agent/skills/manager.py`
- `rg -n "provider:|tooling:|thinking:|skills:" yaml_instance/skills.yaml yaml_instance/demo_mcp.yaml yaml_instance/demo_mem0_memory.yaml yaml_instance/demo_simple_memory.yaml docs/user_guide/en/nodes/agent.md`

## copy risk
- copiable tel quel: `runtime/node/agent/skills/manager.py` en grande partie, `runtime/node/agent/providers/response.py`.
- copiable avec adaptation: `runtime/node/agent/providers/base.py`, `runtime/node/agent/providers/openai_provider.py`, `runtime/node/agent/providers/gemini_provider.py`, `runtime/node/agent/tool/tool_manager.py`, tout le sous-dossier `runtime/node/agent/memory/`, tout le sous-dossier `runtime/node/agent/thinking/`.
- a reecrire ou a scinder avant copie: `runtime/node/executor/agent_executor.py`.

## primary file slice
- `runtime/node/executor/agent_executor.py`
- `runtime/node/agent/providers/base.py`
- `runtime/node/agent/providers/builtin_providers.py`
- `runtime/node/agent/providers/openai_provider.py`
- `runtime/node/agent/providers/gemini_provider.py`
- `runtime/node/agent/providers/response.py`
- `runtime/node/agent/tool/tool_manager.py`
- `runtime/node/agent/memory/memory_base.py`
- `runtime/node/agent/memory/registry.py`
- `runtime/node/agent/memory/builtin_stores.py`
- `runtime/node/agent/memory/simple_memory.py`
- `runtime/node/agent/memory/file_memory.py`
- `runtime/node/agent/memory/blackboard_memory.py`
- `runtime/node/agent/memory/mem0_memory.py`
- `runtime/node/agent/memory/embedding.py`
- `runtime/node/agent/thinking/registry.py`
- `runtime/node/agent/thinking/builtin_thinking.py`
- `runtime/node/agent/thinking/thinking_manager.py`
- `runtime/node/agent/thinking/self_reflection.py`
- `runtime/node/agent/skills/manager.py`
