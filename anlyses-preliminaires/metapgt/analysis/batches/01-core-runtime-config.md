# Core Runtime / Config / Schema

Batch ID: `B01-core-runtime-config`

## purpose
Runtime substrate for almost every reusable slice in MetaGPT: config composition, shared context, llm ownership, message/plan serialization, memory layers, and runtime logging hooks.

If a later batch looks "self-contained", this batch is usually the hidden reason it is not. The most reusable code here is small, but the most dangerous coupling is also here.

## subdomains
- `config composition + CLI override`
  - `metagpt/config2.py::{CLIParams,Config,merge_dict}`
  - `metagpt/configs/*`
- `shared context + llm ownership`
  - `metagpt/context.py::{AttrDict,Context}`
  - `metagpt/context_mixin.py::ContextMixin`
  - `metagpt/llm.py::LLM`
- `message / document / serialization primitives`
  - `metagpt/schema.py::{SerializationMixin,Document,Documents,Message,MessageQueue}`
- `task / plan runtime`
  - `metagpt/schema.py::{Task,TaskResult,Plan}`
- `memory tiers`
  - `metagpt/memory/memory.py::Memory`
  - `metagpt/memory/brain_memory.py::BrainMemory`
  - `metagpt/memory/role_zero_memory.py::RoleZeroLongTermMemory`
- `runtime logging + human IO hooks`
  - `metagpt/logs.py::{define_log_level,log_llm_stream,log_tool_output,get_human_input}`
- `base abstract contracts`
  - `metagpt/base/base_role.py::BaseRole`
  - `metagpt/base/base_env.py::BaseEnvironment`
  - `metagpt/base/base_serialization.py::BaseSerialization`

## entrypoints
- `metagpt/config2.py::Config.default`
- `metagpt/config2.py::Config.update_via_cli`
- `metagpt/context.py::Context.llm`
- `metagpt/context_mixin.py::ContextMixin.llm`
- `metagpt/schema.py::Message`
- `metagpt/schema.py::Plan`
- `metagpt/schema.py::MessageQueue`
- `metagpt/memory/memory.py::Memory.add`
- `metagpt/memory/role_zero_memory.py::RoleZeroLongTermMemory.get`
- `metagpt/logs.py::get_human_input`

## key files
- `metagpt/config2.py` [182 lines, inbound_imports=62]
  - config merge order, CLI overrides, global `config = Config.default()`
- `metagpt/context.py` [127 lines, inbound_imports=27]
  - shared runtime `Context`, cost manager selection, llm factory
- `metagpt/context_mixin.py` [101 lines, inbound_imports=3]
  - common `context` / `config` / `llm` contract for roles, actions, envs
- `metagpt/schema.py` [976 lines, inbound_imports=130]
  - message/document/task/plan primitives plus serialization and UML/report helpers
- `metagpt/memory/memory.py` [112 lines, inbound_imports=4]
  - tiny indexed short-term memory
- `metagpt/memory/brain_memory.py`
  - long-form assistant memory with summarization and Redis persistence
- `metagpt/memory/role_zero_memory.py`
  - hybrid short-term + RAG long-term memory used by `RoleZero`
- `metagpt/logs.py` [153 lines, inbound_imports=246]
  - log level setup plus stream/tool/human IO indirection layer
- `metagpt/llm.py` [20 lines, inbound_imports=33]
  - convenience wrapper over `Context`

## data flow
- `metagpt/config2.py::Config.default` merges `os.environ`, repo default yaml, `~/.metagpt/config2.yaml`, then explicit kwargs.
- `metagpt/context.py::Context` owns config, misc runtime kwargs, and cost accounting.
- `metagpt/context_mixin.py::ContextMixin` exposes `context`, `config`, and `llm` to roles/actions/envs.
- `metagpt/schema.py::Message` and `metagpt/schema.py::MessageQueue` are the canonical transport payloads used by roles and environments.
- `metagpt/schema.py::Plan` and `Task` carry the planning protocol later consumed by `B02` and `B03`.
- `metagpt/memory/memory.py::Memory` stores message history; specialized memory classes layer summarization or RAG retrieval on top.
- `metagpt/logs.py` injects runtime side effects for LLM token streaming, tool output streaming, and human replies.

## feature inventory
- `Config composition stack`
  - kind: `core runtime`
  - files: `metagpt/config2.py`, `metagpt/configs/*`
  - symbols: `CLIParams.check_project_path`, `Config.default`, `Config.from_home`, `Config.from_llm_config`, `Config.update_via_cli`, `merge_dict`
  - reuse: `copiable avec adaptation`
- `Context-owned llm factory`
  - kind: `core runtime`
  - files: `metagpt/context.py`, `metagpt/context_mixin.py`, `metagpt/llm.py`
  - symbols: `Context._select_costmanager`, `Context.llm`, `Context.llm_with_cost_manager_from_llm_config`, `ContextMixin.set_context`, `ContextMixin.set_config`, `ContextMixin.set_llm`, `ContextMixin.llm`
  - reuse: `copiable avec adaptation`
- `Message / document serialization core`
  - kind: `core runtime`
  - files: `metagpt/schema.py`
  - symbols: `SerializationMixin.serialize`, `SerializationMixin.deserialize`, `Document.load`, `Documents.from_iterable`, `Message.check_instruct_content`, `Message.check_cause_by`, `Message.dump`, `Message.load`, `MessageQueue.push`, `MessageQueue.pop`, `MessageQueue.pop_all`, `MessageQueue.dump`, `MessageQueue.load`
  - reuse: `copiable avec adaptation`
- `Task / Plan runtime`
  - kind: `core runtime`
  - files: `metagpt/schema.py`
  - symbols: `Task.reset`, `Task.update_task_result`, `Plan.add_tasks`, `Plan.reset_task`, `Plan.finish_current_task`, `Plan.append_task`, `Plan.replace_task`, `Plan.get_finished_tasks`, `Plan.current_task`
  - reuse: `copiable avec adaptation`
- `Short-term indexed memory`
  - kind: `core runtime`
  - files: `metagpt/memory/memory.py`
  - symbols: `Memory.add`, `Memory.add_batch`, `Memory.get`, `Memory.find_news`, `Memory.get_by_action`, `Memory.get_by_actions`, `Memory.get_by_position`
  - reuse: `copiable tel quel`
- `BrainMemory summarization cache`
  - kind: `glue runtime`
  - files: `metagpt/memory/brain_memory.py`
  - symbols: `BrainMemory.loads`, `BrainMemory.dumps`, `BrainMemory.summarize`, `BrainMemory.get_title`, `BrainMemory.is_related`, `BrainMemory.rewrite`
  - reuse: `copiable avec adaptation`
- `RoleZero long-term memory bridge`
  - kind: `core runtime + RAG adapter`
  - files: `metagpt/memory/role_zero_memory.py`
  - symbols: `RoleZeroLongTermMemory.rag_engine`, `RoleZeroLongTermMemory.add`, `RoleZeroLongTermMemory.get`, `_resolve_rag_engine`, `_fetch_longterm_memories`
  - reuse: `copiable avec adaptation`
- `Runtime log / human-input hook layer`
  - kind: `tooling glue`
  - files: `metagpt/logs.py`
  - symbols: `define_log_level`, `log_llm_stream`, `log_tool_output`, `log_tool_output_async`, `get_human_input`, `set_llm_stream_logfunc`, `set_tool_output_logfunc`, `set_human_input_func`, `create_llm_stream_queue`, `get_llm_stream_queue`
  - reuse: `copiable avec adaptation`

## symbol map
- config
  - `metagpt/config2.py::{CLIParams,Config,merge_dict}`
  - `metagpt/config2.py::{default,from_home,from_llm_config,update_via_cli,get_openai_llm,get_azure_llm}`
- context
  - `metagpt/context.py::{AttrDict,Context}`
  - `metagpt/context.py::{new_environ,_select_costmanager,llm,llm_with_cost_manager_from_llm_config,serialize,deserialize}`
  - `metagpt/context_mixin.py::{_process_context_mixin_extra,set_context,set_config,set_llm,config,context,llm}`
  - `metagpt/llm.py::LLM`
- schema core
  - `metagpt/schema.py::{SerializationMixin,SimpleMessage,Document,Documents,Message,Task,TaskResult,Plan,MessageQueue}`
  - `metagpt/schema.py::{CodingContext,TestingContext,RunCodeContext,RunCodeResult,CodeSummarizeContext,CodePlanAndChangeContext}`
- memory
  - `metagpt/memory/memory.py::{add,add_batch,get,find_news,get_by_action,get_by_actions,get_by_position}`
  - `metagpt/memory/brain_memory.py::{add_talk,add_answer,loads,dumps,summarize,get_title,is_related,rewrite}`
  - `metagpt/memory/role_zero_memory.py::{add,get,_resolve_rag_engine,_build_longterm_memory_query}`
- hooks
  - `metagpt/logs.py::{define_log_level,log_llm_stream,log_tool_output,get_human_input,set_*_func,create_llm_stream_queue}`

## dependency map
- import pressure by batch from B01 code
  - `B01-core-runtime-config`: `56`
  - `B05-tools-utils-execution`: `26`
  - `B06-rag-doc-knowledge`: `6`
  - `B04-llm-provider-layer`: `6`
  - `B03-actions-planning-prompts`: `2`
  - `B02-agent-orchestration`: `1`
- hard blockers for extracting `Config`
  - `metagpt/utils/yaml_model.py`
  - `metagpt/const.py`
  - `metagpt/configs/*`
- hard blockers for extracting `Context` / `ContextMixin`
  - `metagpt/config2.py`
  - `metagpt/provider/llm_provider_registry.py`
  - `metagpt/provider/base_llm.py`
  - `metagpt/utils/cost_manager.py`
- hard blockers for extracting `Message` / `Plan`
  - `metagpt/base/base_serialization.py`
  - `metagpt/utils/common.py`
  - `metagpt/utils/serialize.py`
  - `metagpt/utils/report.py` because `Plan._update_current_task` emits `TaskReporter`
- hard blockers for extracting `RoleZeroLongTermMemory`
  - `metagpt/rag/engines/simple.py`
  - `metagpt/rag/schema.py`
  - `llama-index` + `chromadb` optional extras
- soft but common couplings
  - `metagpt/schema.py` mixes very reusable primitives with more specific contexts and UML helpers. Small reuse is easier if you split the file first.
  - `metagpt/logs.py` is not just logging; later batches treat it as a runtime callback bus.

## extraction recipes
- extract only config composition
  - read first: `metagpt/config2.py`, `metagpt/configs/*`, `metagpt/utils/yaml_model.py`
  - keep: `Config.default`, `Config.from_llm_config`, `update_via_cli`
  - drop first: global `config` singleton if you do not want process-global mutable config
  - advice: `copiable avec adaptation`
- extract a shared `Context` + llm factory
  - read first: `metagpt/context.py`, `metagpt/context_mixin.py`, `metagpt/provider/llm_provider_registry.py`
  - keep: `Context`, `ContextMixin`, cost-manager selection
  - replace: MetaGPT-specific `Config` type if your project already has settings
  - advice: `copiable avec adaptation`
- extract typed transport + plan primitives
  - read first: `metagpt/schema.py`
  - smallest useful slice: `SerializationMixin`, `Document`, `Message`, `Task`, `TaskResult`, `Plan`, `MessageQueue`
  - drop first: `UMLClass*` helpers and code-summary contexts if you only need agent runtime
  - advice: `copiable avec adaptation`
- extract minimal short-term memory
  - read first: `metagpt/memory/memory.py`
  - keep: whole file
  - advice: `copiable tel quel`
- extract long-term memory for a tool agent
  - read first: `metagpt/memory/role_zero_memory.py`, then `B06`
  - keep: `RoleZeroLongTermMemory` shape
  - replace: retriever config, persistence path, and failure policy
  - advice: `copiable avec adaptation`

## do not copy blindly
- `metagpt/config2.py::Config.default` caches instances in module-global `_CONFIG_CACHE`; mutable config can silently bleed across tests or agents.
- Merge precedence is easy to misread: `os.environ` is loaded first, then repo yaml, then `~/.metagpt/config2.yaml`, then kwargs. Later sources overwrite earlier ones.
- `CLIParams.check_project_path` and `Config.update_via_cli` force `inc=True` when `project_path` is present.
- `metagpt/context.py::Context.llm` recreates the provider each call because the `if self._llm is None:` cache guard is commented out.
- `metagpt/context_mixin.py::ContextMixin.context` returns a fresh `Context()` when no private context was injected. A naive extraction can accidentally create multiple unrelated contexts.
- `metagpt/schema.py::Message.check_cause_by` defaults empty `cause_by` to `UserRequirement`, which is helpful in MetaGPT and surprising in a generic runtime.
- `metagpt/schema.py::Plan._update_current_task` has a reporting side effect through `TaskReporter`.
- `metagpt/memory/role_zero_memory.py` wraps long-term operations with `handle_exception`, so retrieval failures degrade silently to empty results.
- `metagpt/memory/brain_memory.py` is not the generic role-memory core; it is an assistant/chat memory with Redis and summarization assumptions.

## minimal reusable slices
- `Config composition stack`
  - files: `metagpt/config2.py`, `metagpt/configs/*`, `metagpt/utils/yaml_model.py`
  - verdict: `copiable avec adaptation`
- `Context llm factory`
  - files: `metagpt/context.py`, `metagpt/context_mixin.py`, `metagpt/provider/llm_provider_registry.py`
  - verdict: `copiable avec adaptation`
- `Message + MessageQueue core`
  - files: `metagpt/schema.py`
  - verdict: `copiable avec adaptation`
- `Plan + Task core`
  - files: `metagpt/schema.py`
  - keep: `Task`, `TaskResult`, `Plan`
  - drop: reporting side effect if you want a pure planner object
  - verdict: `copiable avec adaptation`
- `Short-term memory index`
  - files: `metagpt/memory/memory.py`
  - verdict: `copiable tel quel`
- `RoleZero long-term memory bridge`
  - files: `metagpt/memory/role_zero_memory.py`, plus `B06`
  - verdict: `copiable avec adaptation`

## executable docs / tests
- `tests/metagpt/test_context.py`
- `tests/metagpt/test_context_mixin.py`
- `tests/metagpt/test_message.py`
- `tests/metagpt/test_schema.py`
- `tests/metagpt/memory/test_memory.py`
- `tests/metagpt/memory/test_brain_memory.py`
- `tests/metagpt/memory/test_role_zero_memory.py`

These tests are especially useful as reverse-engineering aids even when `pytest.ini` ignores some of them in the default CI run.

## external deps
- direct core deps
  - `pydantic`
  - `loguru`
  - `yaml` model helpers
- optional runtime deps
  - `redis` via `BrainMemory`
  - `llama-index` + vector-store extras via `RoleZeroLongTermMemory`

## flags/env
- `~/.metagpt/config2.yaml`
- `config.prompt_schema`
- `config.enable_longterm_memory`
- `config.exp_pool.*`
- `config.role_zero.*`
- `config.workspace.path`

## exact search shortcuts
- `rg -n "class (Config|Context|ContextMixin|Message|Task|TaskResult|Plan|MessageQueue|Memory|BrainMemory|RoleZeroLongTermMemory)" metagpt`
- `rg -n "def (default|update_via_cli|llm|serialize|deserialize|append_task|replace_task|finish_current_task|add|get)" metagpt/config2.py metagpt/context.py metagpt/schema.py metagpt/memory`
- `rg -n "set_human_input_func|log_llm_stream|create_llm_stream_queue" metagpt/logs.py`

## hubs
- `metagpt/logs.py` [inbound_imports=246]
- `metagpt/schema.py` [inbound_imports=130]
- `metagpt/const.py` [inbound_imports=132]
- `metagpt/config2.py` [inbound_imports=62]
- `metagpt/llm.py` [inbound_imports=33]
