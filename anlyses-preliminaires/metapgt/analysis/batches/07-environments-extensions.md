# Environments / Extensions / Simulators

Batch ID: `B07-environments-extensions`

## purpose
Environment bus, environment API registries, MGX routing, and the domain-specific extension packs built on top of that shell.

This batch is only partially reusable as-is. The environment core is useful. Most extension folders are best treated as patterns or adapters, not copy-paste modules.

## subdomains
- `environment message bus`
  - `metagpt/environment/base_env.py::{ExtEnv,Environment}`
- `environment API registry`
  - `metagpt/environment/api/env_api.py::{EnvAPIAbstract,EnvAPIRegistry,WriteAPIRegistry,ReadAPIRegistry}`
- `MGX mediator routing`
  - `metagpt/environment/mgx/mgx_env.py::MGXEnv`
- `device / simulator adapters`
  - `metagpt/environment/android/android_ext_env.py::AndroidExtEnv`
  - `metagpt/environment/minecraft/*`
  - `metagpt/environment/werewolf/*`
  - `metagpt/environment/stanford_town/*`
- `domain roles and actions`
  - `metagpt/ext/android_assistant/roles/android_assistant.py::AndroidAssistant`
  - `metagpt/ext/stanford_town/roles/st_role.py::STRole`
  - `metagpt/ext/stanford_town/actions/st_action.py::STAction`
- `experimental agent wrappers`
  - `metagpt/ext/sela/experimenter.py::Experimenter`
  - `metagpt/ext/spo/app.py`

## entrypoints
- `metagpt/environment/base_env.py::Environment.publish_message`
- `metagpt/environment/base_env.py::Environment.run`
- `metagpt/environment/base_env.py::mark_as_readable`
- `metagpt/environment/base_env.py::mark_as_writeable`
- `metagpt/environment/mgx/mgx_env.py::MGXEnv.publish_message`
- `metagpt/environment/api/env_api.py::EnvAPIRegistry.get_apis`
- `metagpt/environment/android/android_ext_env.py::AndroidExtEnv.observe`
- `metagpt/ext/android_assistant/roles/android_assistant.py::AndroidAssistant._act`
- `metagpt/ext/stanford_town/roles/st_role.py::STRole.observe`
- `metagpt/ext/sela/experimenter.py::Experimenter.run`

## key files
- `metagpt/environment/base_env.py` [247 lines, inbound_imports=12]
  - shared environment shell, role registration, message routing, async round execution
- `metagpt/environment/api/env_api.py`
  - small registry for read/write environment APIs
- `metagpt/environment/mgx/mgx_env.py` [99 lines, inbound_imports=14]
  - public/direct chat routing through a TeamLeader mediator
- `metagpt/environment/android/android_ext_env.py` [375 lines, inbound_imports=2]
  - ADB + OCR + grounding adapter for Android environments
- `metagpt/ext/android_assistant/roles/android_assistant.py` [145 lines, inbound_imports=1]
  - role wrapper around Android learn/act actions
- `metagpt/ext/stanford_town/roles/st_role.py` [625 lines, inbound_imports=6]
  - large simulation role with custom memory/scratch/spatial state
- `metagpt/ext/stanford_town/actions/st_action.py` [118 lines, inbound_imports=12]
  - domain-specific prompt/action helper
- `metagpt/ext/sela/experimenter.py` [195 lines, inbound_imports=3]
  - timeout + state-saving wrapper around `DataInterpreter`

## data flow
- `Environment.add_role()` / `add_roles()` inject env and shared context into roles.
- `Environment.publish_message()` distributes messages to recipients by address sets and appends them to `history`.
- `Environment.run()` iterates role `run()` coroutines for every non-idle role.
- `mark_as_readable()` / `mark_as_writeable()` register callable env APIs in global registries.
- `MGXEnv.publish_message()` rewrites message content/routing so most traffic flows through `TeamLeader`.
- Domain environments and roles add external-world state, extra memory models, and sidecar integrations on top of the base bus.

## feature inventory
- `Environment message bus core`
  - kind: `core runtime`
  - files: `metagpt/environment/base_env.py`
  - symbols: `Environment.add_role`, `Environment.add_roles`, `Environment.publish_message`, `Environment.run`, `Environment.get_role`, `Environment.role_names`, `Environment.archive`
  - reuse: `copiable avec adaptation`
- `Environment API registry core`
  - kind: `core runtime`
  - files: `metagpt/environment/api/env_api.py`, `metagpt/environment/base_env.py`
  - symbols: `EnvAPIAbstract`, `EnvAPIRegistry.get`, `EnvAPIRegistry.get_apis`, `mark_as_readable`, `mark_as_writeable`, `ExtEnv.read_from_api`, `ExtEnv.write_thru_api`
  - reuse: `copiable tel quel`
- `MGX public/direct router`
  - kind: `core runtime + glue`
  - files: `metagpt/environment/mgx/mgx_env.py`
  - symbols: `MGXEnv.publish_message`, `MGXEnv._publish_message`, `MGXEnv.ask_human`, `MGXEnv.reply_to_human`, `MGXEnv.move_message_info_to_content`, `MGXEnv.attach_images`
  - reuse: `copiable avec adaptation`
- `Android external environment adapter`
  - kind: `provider adapter`
  - files: `metagpt/environment/android/android_ext_env.py`
  - symbols: `load_cv_model`, `AndroidExtEnv.observe`, `AndroidExtEnv.step`, `AndroidExtEnv.execute_adb_with_cmd`, `AndroidExtEnv.get_screenshot`, `AndroidExtEnv.get_xml`, `AndroidExtEnv.system_tap`, `AndroidExtEnv.user_input`, `AndroidExtEnv.user_open_app`
  - reuse: `copiable avec adaptation`
- `Android assistant role wrapper`
  - kind: `domain glue`
  - files: `metagpt/ext/android_assistant/roles/android_assistant.py`
  - symbols: `AndroidAssistant.__init__`, `_observe`, `_act`
  - reuse: `a reecrire`
- `Stanford Town role runtime`
  - kind: `domain runtime`
  - files: `metagpt/ext/stanford_town/roles/st_role.py`
  - symbols: `STRoleContext`, `STRole.load_from`, `STRole.save_into`, `STRole._observe`, `STRole.observe`, `STRole.add_inner_voice`
  - reuse: `a reecrire`
- `STAction prompt helper`
  - kind: `domain tool`
  - files: `metagpt/ext/stanford_town/actions/st_action.py`
  - symbols: `STAction.generate_prompt_with_tmpl_filename`, `_run_gpt35_max_tokens`, `_run_gpt35`, `_run_gpt35_wo_extra_prompt`
  - reuse: `copiable avec adaptation`
- `Experimenter timeout/state wrapper`
  - kind: `domain glue`
  - files: `metagpt/ext/sela/experimenter.py`
  - symbols: `async_timeout`, `Experimenter.get_score`, `Experimenter.save_state`, `Experimenter.run`
  - reuse: `copiable avec adaptation`

## symbol map
- environment core
  - `metagpt/environment/base_env.py::{EnvType,mark_as_readable,mark_as_writeable,ExtEnv,Environment}`
  - `metagpt/environment/base_env.py::{read_from_api,write_thru_api,add_role,add_roles,publish_message,run,get_role,role_names,archive}`
- api registry
  - `metagpt/environment/api/env_api.py::{EnvAPIAbstract,EnvAPIRegistry,WriteAPIRegistry,ReadAPIRegistry}`
- mgx
  - `metagpt/environment/mgx/mgx_env.py::{MGXEnv,_publish_message,publish_message,ask_human,reply_to_human,move_message_info_to_content,attach_images}`
- android
  - `metagpt/environment/android/android_ext_env.py::{load_cv_model,AndroidExtEnv,observe,step,execute_adb_with_cmd,get_screenshot,get_xml,system_back,system_tap,user_input,user_swipe,user_open_app,user_click_text}`
  - `metagpt/ext/android_assistant/roles/android_assistant.py::{AndroidAssistant,__init__,react,_observe,_act}`
- stanford town
  - `metagpt/ext/stanford_town/roles/st_role.py::{STRoleContext,STRole,load_from,save_into,_observe,observe,add_inner_voice}`
  - `metagpt/ext/stanford_town/actions/st_action.py::{STAction,generate_prompt_with_tmpl_filename,_run_gpt35_max_tokens,_run_gpt35,_run_gpt35_wo_extra_prompt}`
- sela
  - `metagpt/ext/sela/experimenter.py::{TimeoutException,async_timeout,Experimenter}`

## dependency map
- import pressure by batch from B07 code
  - `B07-environments-extensions`: `250`
  - `B01-core-runtime-config`: `110`
  - `B05-tools-utils-execution`: `34`
  - `B03-actions-planning-prompts`: `22`
  - `B02-agent-orchestration`: `8`
  - `B06-rag-doc-knowledge`: `2`
  - `B04-llm-provider-layer`: `2`
- hard blockers for extracting `Environment`
  - `metagpt/base/*`
  - `metagpt/context.py`
  - `metagpt/schema.py::Message`
  - `metagpt/memory/memory.py`
  - `metagpt/utils/common.py::{get_function_schema,is_coroutine_func,is_send_to}`
- hard blockers for extracting `MGXEnv`
  - `metagpt/roles/di/team_leader.py`
  - `metagpt/roles/role.py`
  - `metagpt/utils/common.py::extract_and_encode_images`
  - `metagpt/logs.py::get_human_input`
- hard blockers for extracting `AndroidExtEnv`
  - `adb`
  - `modelscope`
  - `clip`
  - `PIL`
  - `groundingdino` toolchain
- hard blockers for extracting `STRole`
  - `metagpt/ext/stanford_town/*`
  - simulation storage data under `examples/stanford_town/storage/*`
  - domain env `metagpt/environment/stanford_town/*`

## extraction recipes
- extract only the environment bus
  - read first: `metagpt/environment/base_env.py`
  - keep: `Environment`, `ExtEnv`, API dispatch helpers
  - drop first: `archive()` side effect if you do not want git mutations
  - advice: `copiable avec adaptation`
- extract only environment API registries
  - read first: `metagpt/environment/api/env_api.py`, plus `mark_as_readable` / `mark_as_writeable`
  - keep: whole files
  - advice: `copiable tel quel`
- extract a mediator-routed chat env
  - read first: `metagpt/environment/mgx/mgx_env.py`
  - keep: direct/public-chat state machine and message rewriting
  - replace: TeamLeader-specific role names and human IO hooks
  - advice: `copiable avec adaptation`
- extract a real-world device adapter pattern
  - read first: `metagpt/environment/android/android_ext_env.py`
  - keep: `mark_as_readable` / `mark_as_writeable` methods and API pattern
  - replace: ADB/CV specifics for your own environment
  - advice: `copiable avec adaptation`
- extract StanfordTown or Android assistant as full features
  - advice: `a reecrire` unless you want the exact same domain

## do not copy blindly
- `mark_as_readable()` and `mark_as_writeable()` write into process-global registries at import time.
- `Environment.archive()` auto-archives the repo whenever `context.kwargs.project_path` exists.
- `MGXEnv.publish_message()` rewrites routing semantics, content, and image metadata; it is not a thin subclass.
- `MGXEnv.move_message_info_to_content()` mutates the prompt-visible text seen by downstream llms.
- `AndroidExtEnv.__init__()` eagerly loads CV models and validates devices, which is expensive and side-effectful.
- `AndroidAssistant` behavior is driven by `config.extra` keys such as `stage`, `mode`, `task_desc`, and `app_name`.
- `STRole.validate_st_role_after()` immediately loads state from disk and configures watch/actions during model validation.
- `STRole._observe()` always returns `1`, so the role keeps reacting each cycle even when there is no new message.
- `Experimenter.save_state()` writes serialized role state under `SERDESER_PATH`; good for recovery, risky for library reuse.

## minimal reusable slices
- `Environment message bus core`
  - files: `metagpt/environment/base_env.py`
  - verdict: `copiable avec adaptation`
- `Environment API registry core`
  - files: `metagpt/environment/api/env_api.py`, `metagpt/environment/base_env.py`
  - verdict: `copiable tel quel`
- `MGX router`
  - files: `metagpt/environment/mgx/mgx_env.py`
  - verdict: `copiable avec adaptation`
- `STAction prompt helper`
  - files: `metagpt/ext/stanford_town/actions/st_action.py`
  - verdict: `copiable avec adaptation`
- `Android / Stanford Town / SELA full stacks`
  - verdict: `a reecrire`

## executable docs / tests
- `examples/mgx_write_project_framework.py`
- `examples/android_assistant/run_assistant.py`
- `examples/stanford_town/run_st_game.py`
- `examples/werewolf_game/start_game.py`
- `tests/metagpt/test_environment.py`
- `tests/metagpt/roles/di/test_team_leader.py`
- `tests/metagpt/roles/di/test_routing.py`

## external deps
- environment core
  - `gymnasium`
  - `pydantic`
- domain extras
  - Android: `adb`, `modelscope`, `clip`, `PIL`, CV model stack
  - Stanford Town: domain datasets and storage snapshots
  - Minecraft / Werewolf / SPO / AFLOW: extra services, scripts, or sidecars

## flags/env
- `context.kwargs.project_path`
- `MGXEnv.is_public_chat`
- Android extra config in `config.extra`
- Stanford Town storage rooted from `examples/stanford_town/storage/*`

## exact search shortcuts
- `rg -n "class (ExtEnv|Environment|MGXEnv|EnvAPIRegistry|AndroidExtEnv|AndroidAssistant|STRole|Experimenter|STAction)" metagpt/environment metagpt/ext`
- `rg -n "def (publish_message|run|read_from_api|write_thru_api|get_screenshot|get_xml|observe|save_state)" metagpt/environment metagpt/ext`
- `rg -n "mark_as_readable|mark_as_writeable|direct_chat_roles|is_public_chat" metagpt/environment`

## hubs
- `metagpt/environment/werewolf/const.py` [inbound_imports=15]
- `metagpt/environment/__init__.py` [inbound_imports=15]
- `metagpt/environment/mgx/mgx_env.py` [inbound_imports=14]
- `metagpt/environment/base_env.py` [inbound_imports=12]
- `metagpt/ext/stanford_town/actions/st_action.py` [inbound_imports=12]
