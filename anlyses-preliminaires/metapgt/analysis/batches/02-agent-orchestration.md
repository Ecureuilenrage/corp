# Agent Orchestration / Roles / Company Flow

Batch ID: `B02-agent-orchestration`

## purpose
Team assembly, role lifecycle, software-company bootstrap, dynamic tool-using agents, and the fixed-SOP role chains that turn messages into PRD/design/tasks/code/test handoffs.

This batch is the main answer to "how does MetaGPT actually orchestrate agents?" but not the whole answer. The runtime shell here is small; the heavy coupling comes from dependencies into:
- `B01-core-runtime-config` for `Context`, `Message`, `Plan`, `Memory`, serialization, and config
- `B03-actions-planning-prompts` for `Action`, `Planner`, SOP actions, and prompt assets
- `B05-tools-utils-execution` for repo/file/git/browser/editor/tooling helpers
- `B07-environments-extensions` for `Environment` / `MGXEnv`

## subdomains
- `team/bootstrap shell`
  - `metagpt/team.py::Team`
  - `metagpt/software_company.py::{generate_repo,startup,copy_config_to}`
  - `metagpt/startup.py`
- `generic role runtime`
  - `metagpt/roles/role.py::{RoleReactMode,RoleContext,Role}`
- `dynamic command-and-tool agents`
  - `metagpt/roles/di/role_zero.py::RoleZero`
  - `metagpt/roles/di/team_leader.py::TeamLeader`
  - `metagpt/roles/di/data_analyst.py::DataAnalyst`
  - `metagpt/roles/di/engineer2.py::Engineer2`
  - `metagpt/roles/di/swe_agent.py::SWEAgent`
- `plan-and-act coding agent`
  - `metagpt/roles/di/data_interpreter.py::DataInterpreter`
- `document-driven software-company roles`
  - `metagpt/roles/product_manager.py::ProductManager`
  - `metagpt/roles/architect.py::Architect`
  - `metagpt/roles/project_manager.py::ProjectManager`
  - `metagpt/roles/engineer.py::Engineer`
  - `metagpt/roles/qa_engineer.py::QaEngineer`
- `thin single-purpose role wrappers`
  - `metagpt/roles/searcher.py::Searcher`
  - `metagpt/roles/sales.py::Sales`
  - `metagpt/roles/customer_service.py::CustomerService`
  - `metagpt/roles/researcher.py::Researcher`
  - `metagpt/roles/assistant.py::Assistant`
  - `metagpt/roles/teacher.py::Teacher`
  - `metagpt/roles/tutorial_assistant.py::TutorialAssistant`
  - `metagpt/roles/invoice_ocr_assistant.py::InvoiceOCRAssistant`
- `async trigger wrapper`
  - `metagpt/subscription.py::SubscriptionRunner`

## entrypoints
- `metagpt/software_company.py::startup`
- `metagpt/software_company.py::generate_repo`
- `metagpt/team.py::Team.run`
- `metagpt/roles/role.py::Role.run`
- `metagpt/roles/di/role_zero.py::RoleZero._react`
- `metagpt/roles/di/team_leader.py::TeamLeader.publish_team_message`
- `metagpt/roles/di/data_interpreter.py::DataInterpreter`
- `metagpt/subscription.py::SubscriptionRunner.run`

## key files
- `metagpt/team.py` [138 lines, inbound_imports=14]
  - smallest reusable team shell; owns `Environment` / `MGXEnv`, budget, kickoff, run loop, and serdes
- `metagpt/roles/role.py` [592 lines, inbound_imports=20]
  - true runtime core; message observation, action selection, planner handoff, publishing, idle detection
- `metagpt/roles/di/role_zero.py` [491 lines, inbound_imports=8]
  - dynamic command agent wired to planner state, tool recommendation, command parsing, browser/editor/terminal, and human escalation
- `metagpt/roles/engineer.py` [513 lines, inbound_imports=3]
  - fixed-SOP engineer that is deeply coupled to `ProjectRepo`, task/design docs, and code-summary handoffs
- `metagpt/software_company.py` [157 lines, inbound_imports=2]
  - CLI/bootstrap glue; important for reuse decisions because current default hired roles differ from the classic MetaGPT chain
- `metagpt/roles/di/data_interpreter.py` [190 lines, inbound_imports=26]
  - most reusable "single coding/planning agent" in this batch
- `metagpt/roles/di/team_leader.py` [90 lines, inbound_imports=12]
  - mediator role for `MGXEnv`; useful only if you want routed public/direct chat semantics
- `metagpt/subscription.py` [100 lines, inbound_imports=6]
  - very small wrapper for periodically feeding a `Role`
- `metagpt/roles/__init__.py` [34 lines, inbound_imports=40]
  - import hub only; not a behavior hub
- `metagpt/startup.py` [10 lines, inbound_imports=0]
  - deprecated alias marker; not reusable runtime

## data flow
- `metagpt/software_company.py::generate_repo` updates config through `metagpt.config2.config.update_via_cli`, builds `metagpt.context.Context`, creates `metagpt.team.Team`, hires a default role set, and optionally recovers state with `Team.deserialize`.
- `metagpt/team.py::Team.run_project` publishes the initial `metagpt.schema.Message` containing the user idea. `Team.run` then loops over rounds, checks budget, calls `env.run()`, and archives on completion.
- `metagpt/environment/base_env.py::Environment.publish_message` distributes messages to role inboxes. `metagpt/roles/role.py::Role.run` pulls from `RoleContext.msg_buffer`, filters messages in `_observe`, chooses work in `_think`, executes in `_act`, then republishes.
- Fixed-SOP roles like `ProductManager`, `Architect`, `ProjectManager`, `Engineer`, and `QaEngineer` pass structured payloads in `Message.instruct_content`, usually backed by `ProjectRepo` documents and filenames rather than raw file blobs.
- `DataInterpreter` does not need `Team` or `MGXEnv`; it can run standalone through `Role.run(with_message=...)`, use `Planner`, emit notebook code, execute it, and feed results back into planning.
- `RoleZero` and `TeamLeader` replace most of the standard `Role._react` loop with a dynamic command cycle: inspect context, ask the LLM for tool commands, execute via `tool_execution_map`, and optionally escalate to the human.

## feature inventory
- `Team` round loop
  - kind: `core runtime`
  - files: `metagpt/team.py`
  - symbols: `Team.__init__`, `Team.hire`, `Team.invest`, `Team.run_project`, `Team.run`, `Team.serialize`, `Team.deserialize`
  - reuse: `copiable avec adaptation`
- `Role` runtime contract
  - kind: `core runtime`
  - files: `metagpt/roles/role.py`
  - symbols: `Role.set_actions`, `Role._set_react_mode`, `Role._watch`, `Role._observe`, `Role._think`, `Role._act`, `Role._react`, `Role._plan_and_act`, `Role.publish_message`, `Role.run`
  - reuse: `copiable avec adaptation`
- `RoleZero` dynamic tool agent
  - kind: `core runtime + tool glue`
  - files: `metagpt/roles/di/role_zero.py`, `metagpt/roles/di/team_leader.py`
  - symbols: `RoleZero.set_tool_execution`, `RoleZero.llm_cached_aask`, `RoleZero._quick_think`, `RoleZero._run_commands`, `RoleZero._run_special_command`, `RoleZero.ask_human`, `RoleZero._end`, `TeamLeader.publish_team_message`
  - reuse: `copiable avec adaptation`, but only with its prompt/tool stack
- `DataInterpreter` planning executor
  - kind: `core runtime + coding agent`
  - files: `metagpt/roles/di/data_interpreter.py`
  - symbols: `DataInterpreter.set_plan_and_tool`, `DataInterpreter._plan_and_act`, `DataInterpreter._act_on_task`, `DataInterpreter._write_and_exec_code`, `DataInterpreter._check_data`
  - reuse: `copiable avec adaptation`
- `Software-company document chain`
  - kind: `glue + SOP runtime`
  - files: `metagpt/roles/product_manager.py`, `metagpt/roles/architect.py`, `metagpt/roles/project_manager.py`, `metagpt/roles/engineer.py`, `metagpt/roles/qa_engineer.py`
  - symbols: `ProductManager._think`, `Architect._retrieve_experience`, `ProjectManager._update_tool_execution`, `Engineer._new_code_actions`, `Engineer._new_coding_context`, `Engineer._act_summarize`, `QaEngineer._write_test`, `QaEngineer._run_code`, `QaEngineer._debug_error`
  - reuse: `a reecrire` unless you also want MetaGPT's repo/doc layout
- `Researcher` sequential pipeline
  - kind: `leaf role`
  - files: `metagpt/roles/researcher.py`
  - symbols: `Researcher.__init__`, `Researcher._act`, `Researcher.react`, `Researcher.write_report`
  - reuse: `copiable avec adaptation`
- `Searcher` / `Sales` / `CustomerService`
  - kind: `leaf wrappers`
  - files: `metagpt/roles/searcher.py`, `metagpt/roles/sales.py`, `metagpt/roles/customer_service.py`
  - symbols: `Searcher._act_sp`, `Sales.validate_stroe`
  - reuse: `copiable tel quel` for wrapper shape, `copiable avec adaptation` for actual search/store backend
- `Assistant` / `Teacher` / `TutorialAssistant` / `InvoiceOCRAssistant`
  - kind: `domain-specific leaf roles`
  - files: `metagpt/roles/assistant.py`, `metagpt/roles/teacher.py`, `metagpt/roles/tutorial_assistant.py`, `metagpt/roles/invoice_ocr_assistant.py`
  - symbols: `Assistant._plan`, `Teacher._react`, `TutorialAssistant._handle_directory`, `InvoiceOCRAssistant._act`
  - reuse: mostly `a reecrire`; useful as customization examples, not as clean runtime slices
- `SubscriptionRunner`
  - kind: `core runtime helper`
  - files: `metagpt/subscription.py`
  - symbols: `SubscriptionRunner.subscribe`, `SubscriptionRunner.unsubscribe`, `SubscriptionRunner.run`
  - reuse: `copiable tel quel` if you keep `Role` + `Message`

## symbol map
- team/bootstrap
  - `metagpt/software_company.py::generate_repo`
  - `metagpt/software_company.py::startup`
  - `metagpt/team.py::{__init__,hire,invest,run_project,run,serialize,deserialize}`
- generic role runtime
  - `metagpt/roles/role.py::RoleReactMode`
  - `metagpt/roles/role.py::RoleContext`
  - `metagpt/roles/role.py::{set_actions,_set_react_mode,_watch,_set_state,set_env,_observe,_think,_act,_react,_plan_and_act,publish_message,put_message,react,run,is_idle}`
- dynamic command runtime
  - `metagpt/roles/di/role_zero.py::{set_plan_and_tool,set_tool_execution,set_longterm_memory,llm_cached_aask,_think,_act,_react,_quick_think,_run_commands,_run_special_command,ask_human,reply_to_human,_end}`
  - `metagpt/roles/di/team_leader.py::{_get_team_info,_think,publish_message,publish_team_message,finish_current_task}`
- plan-and-act coding role
  - `metagpt/roles/di/data_interpreter.py::{set_plan_and_tool,_think,_plan_and_act,_act_on_task,_write_and_exec_code,_write_code,_check_data}`
- fixed-SOP company roles
  - `metagpt/roles/product_manager.py::{__init__,_think,_update_tool_execution}`
  - `metagpt/roles/architect.py::{__init__,_retrieve_experience,_update_tool_execution}`
  - `metagpt/roles/project_manager.py::{__init__,_update_tool_execution}`
  - `metagpt/roles/engineer.py::{_parse_tasks,_act_sp_with_cr,_act_write_code,_act_summarize,_act_code_plan_and_change,_new_coding_context,_new_code_actions,_new_summarize_actions,_new_code_plan_and_change_action}`
  - `metagpt/roles/qa_engineer.py::{_write_test,_run_code,_debug_error,_parse_user_requirement,_think}`
- reusable small helpers
  - `metagpt/subscription.py::{subscribe,unsubscribe,run}`
  - `metagpt/roles/researcher.py::{_act,react,write_report}`

## dependency map
- import pressure by batch from B02 code
  - `B03-actions-planning-prompts`: `59` internal import edges
  - `B01-core-runtime-config`: `48`
  - `B05-tools-utils-execution`: `44`
  - `B02-agent-orchestration`: `35`
  - `B07-environments-extensions`: `4`
  - `B06-rag-doc-knowledge`: `4`
  - `B04-llm-provider-layer`: `1`
- hard blockers for extracting `Team`
  - `metagpt/context.py`
  - `metagpt/schema.py`
  - `metagpt/environment/base_env.py`
  - `metagpt/environment/mgx/mgx_env.py` if you keep the default `use_mgx=True`
  - `metagpt/utils/common.py::{NoMoneyException,serialize_decorator,read_json_file,write_json_file}`
- hard blockers for extracting `Role`
  - `metagpt/actions/action.py`
  - `metagpt/actions/action_output.py`
  - `metagpt/actions/action_node.py`
  - `metagpt/context_mixin.py`
  - `metagpt/memory/memory.py`
  - `metagpt/schema.py::{Message,MessageQueue,Task,TaskResult,SerializationMixin}`
  - `metagpt/strategy/planner.py`
  - `metagpt/utils/common.py`
- hard blockers for extracting `RoleZero` / `TeamLeader`
  - `metagpt/prompts/di/role_zero.py`
  - `metagpt/prompts/di/team_leader.py`
  - `metagpt/actions/di/run_command.py`
  - `metagpt/tools/tool_registry.py`
  - `metagpt/tools/tool_recommend.py`
  - `metagpt/tools/libs/browser.py`
  - `metagpt/tools/libs/editor.py`
  - `metagpt/utils/role_zero_utils.py`
  - `metagpt/environment/mgx/mgx_env.py` if you need human routing
  - `metagpt/exp_pool/*` if you keep cached experience retrieval
- hard blockers for extracting the classic software-company chain
  - `metagpt/actions/prepare_documents.py`
  - `metagpt/actions/write_prd.py`
  - `metagpt/actions/design_api.py`
  - `metagpt/actions/project_management.py`
  - `metagpt/actions/write_code.py`
  - `metagpt/actions/write_code_review.py`
  - `metagpt/actions/summarize_code.py`
  - `metagpt/actions/write_code_plan_and_change_an.py`
  - `metagpt/utils/project_repo.py`
  - `metagpt/utils/git_repository.py`
  - `metagpt/schema.py::{Document,Documents,CodingContext,CodeSummarizeContext,CodePlanAndChangeContext,RunCodeContext,TestingContext}`
- optional couplings
  - `B04` is not the primary blocker here. The role/team layer only lightly touches provider code directly; most provider coupling arrives through `Context.llm()` in `B01`.
  - `B06` appears mostly through store-backed roles like `Sales` / `CustomerService`, not through the core orchestration shell.

## extraction recipes
- extract a minimal standalone agent
  - read first: `metagpt/roles/role.py`, `metagpt/context.py`, `metagpt/schema.py`, `metagpt/actions/action.py`
  - copy target: `Role.run(with_message=...)` plus one or two custom `Action`s
  - working example: `examples/build_customized_agent.py`
  - advice: `copiable avec adaptation`
- extract a minimal multi-agent message bus
  - read first: `metagpt/team.py`, `metagpt/environment/base_env.py`, `metagpt/roles/role.py`, `metagpt/schema.py`
  - use `Environment`, not `MGXEnv`, unless you explicitly want TeamLeader mediation
  - working example: `examples/build_customized_multi_agents.py`
  - advice: `copiable avec adaptation`
- extract a periodic event-driven agent runner
  - read first: `metagpt/subscription.py`, `metagpt/roles/role.py`, `metagpt/schema.py`
  - working test: `tests/metagpt/test_subscription.py`
  - advice: `copiable tel quel`
- extract a single planning/coding agent
  - read first: `metagpt/roles/di/data_interpreter.py`, `metagpt/strategy/planner.py`, `metagpt/actions/di/write_analysis_code.py`, `metagpt/actions/di/execute_nb_code.py`
  - working examples/tests: `examples/di/software_company.py`, `tests/metagpt/roles/di/test_data_interpreter.py`
  - advice: `copiable avec adaptation`
- extract a mediated team-leader router
  - read first: `metagpt/roles/di/role_zero.py`, `metagpt/roles/di/team_leader.py`, `metagpt/environment/mgx/mgx_env.py`
  - executable docs/tests: `examples/use_off_the_shelf_agent.py`, `tests/metagpt/roles/di/test_team_leader.py`, `tests/metagpt/roles/di/test_routing.py`
  - advice: `copiable avec adaptation`, not a small slice
- extract the PRD -> design -> tasks -> code -> QA software-company flow
  - read first: `metagpt/software_company.py`, `metagpt/roles/product_manager.py`, `metagpt/roles/architect.py`, `metagpt/roles/project_manager.py`, `metagpt/roles/engineer.py`, `metagpt/roles/qa_engineer.py`
  - then follow blockers in `B03` and `B05`
  - advice: `a reecrire` unless you want the full MetaGPT document/repo convention

## do not copy blindly
- `metagpt/team.py::Team` defaults `use_mgx=True`, so a naive copy silently changes routing semantics by pulling in `MGXEnv` and `TeamLeader`-style traffic expectations.
- `metagpt/software_company.py::generate_repo` currently hires `TeamLeader`, `ProductManager`, `Architect`, `Engineer2`, and `DataAnalyst`. The older `Engineer` / `QaEngineer` path is still present but commented out, so `implement`, `code_review`, and `run_tests` are not driving the current default flow.
- `metagpt/team.py::Team.run_project` exposes `send_to` but does not use it; do not assume targeted kickoff works without patching.
- `metagpt/roles/__init__.py` has high inbound import count only because it is a re-export barrel. It is glue, not runtime logic.
- `metagpt/roles/engineer.py` and `metagpt/roles/qa_engineer.py` are tightly bound to `ProjectRepo`, repository path constants, dependency files, and message `instruct_content` contracts. Copying only the role classes will fail.
- `metagpt/roles/di/role_zero.py` gets much of its behavior from prompt assets and command parsing helpers, not just class methods. Copying the class without `metagpt/prompts/di/*` and `metagpt/utils/role_zero_utils.py` strips most of the agent policy.
- `metagpt/roles/researcher.py`, `metagpt/roles/tutorial_assistant.py`, and `metagpt/roles/invoice_ocr_assistant.py` write deliverables to global constant paths like `RESEARCH_PATH` and `TUTORIAL_PATH`; this is convenient in MetaGPT but risky in a library extraction.
- `metagpt/startup.py` is explicitly deprecated. Reuse `metagpt/software_company.py` or rewrite your own bootstrap.

## minimal reusable slices
- `Team round runner core`
  - files: `metagpt/team.py`, `metagpt/context.py`, `metagpt/schema.py`, `metagpt/environment/base_env.py`
  - keep: `Team.__init__`, `Team.hire`, `Team.run_project`, `Team.run`
  - drop first: `MGXEnv` default, archiving, CLI glue
  - verdict: `copiable avec adaptation`
- `Role runtime core`
  - files: `metagpt/roles/role.py`, `metagpt/context_mixin.py`, `metagpt/schema.py`, `metagpt/memory/memory.py`, `metagpt/actions/action.py`, `metagpt/strategy/planner.py`
  - keep: `_observe`, `_think`, `_act`, `publish_message`, `put_message`, `run`
  - drop first: `PLAN_AND_ACT` if you do not need `Planner`
  - verdict: `copiable avec adaptation`
- `Subscription wrapper`
  - files: `metagpt/subscription.py`, `metagpt/schema.py`, `metagpt/roles/role.py`
  - keep: whole file
  - verdict: `copiable tel quel`
- `Research pipeline role`
  - files: `metagpt/roles/researcher.py`
  - keep: whole class shape
  - replace: research actions and report persistence path
  - verdict: `copiable avec adaptation`
- `Search-backed assistant wrapper`
  - files: `metagpt/roles/searcher.py`, `metagpt/roles/sales.py`, `metagpt/roles/customer_service.py`
  - keep: wrapper pattern over a single `Action`
  - replace: action backend and store/search adapter
  - verdict: `copiable avec adaptation`
- `Dynamic command agent`
  - files: `metagpt/roles/di/role_zero.py`, `metagpt/roles/di/team_leader.py`, `metagpt/environment/mgx/mgx_env.py`
  - keep only if you want LLM-generated tool commands, direct/public chat routing, and human escalation
  - verdict: `copiable avec adaptation`
- `MetaGPT software-company SOP`
  - files: `metagpt/software_company.py`, `metagpt/roles/product_manager.py`, `metagpt/roles/architect.py`, `metagpt/roles/project_manager.py`, `metagpt/roles/engineer.py`, `metagpt/roles/qa_engineer.py`
  - smallest viable copy still drags in actions, schemas, repo helpers, and prompt assets from other batches
  - verdict: `a reecrire`

## executable docs / tests
- best minimal role example
  - `examples/build_customized_agent.py`
- best minimal multi-agent example
  - `examples/build_customized_multi_agents.py`
- best off-the-shelf `RoleZero` / `TeamLeader` example
  - `examples/use_off_the_shelf_agent.py`
- best standalone planning/coding-agent example
  - `examples/di/software_company.py`
- best research-role example
  - `examples/research.py`
- best runtime smoke tests
  - `tests/metagpt/roles/test_role.py`
  - `tests/metagpt/test_subscription.py`
- best fixed-SOP extraction tests
  - `tests/metagpt/roles/test_product_manager.py`
  - `tests/metagpt/roles/test_engineer.py`
- best dynamic-agent routing tests
  - `tests/metagpt/roles/di/test_data_interpreter.py`
  - `tests/metagpt/roles/di/test_team_leader.py`
  - `tests/metagpt/roles/di/test_routing.py`

## external deps
- direct deps inside B02 are relatively light
  - `pydantic`
  - `asyncio`
  - `typer`
  - `fire`
  - `json`
  - `pathlib`
- the heavy operational footprint arrives indirectly through other batches
  - browser/editor/search/git helpers from `B05`
  - notebook/code actions and prompt assets from `B03`
  - provider/config wiring from `B01` and `B04`

## flags/env
- `metagpt/team.py::Team.use_mgx` defaults to `True`.
- `metagpt/software_company.py::startup` exposes `--investment`, `--n-round`, `--project-name`, `--inc`, `--project-path`, `--reqa-file`, `--max-auto-summarize-code`, `--recover-path`, `--init-config`.
- `metagpt/roles/product_manager.py::ProductManager` switches to fixed SOP only when `use_fixed_sop` is enabled.
- `metagpt/roles/di/role_zero.py::RoleZero` can enable long-term memory through `config.role_zero.enable_longterm_memory`.
- `metagpt/roles/engineer.py::Engineer` and `metagpt/roles/qa_engineer.py::QaEngineer` change behavior heavily under `config.inc`, `config.project_path`, `config.reqa_file`, and `config.max_auto_summarize_code`.

## reusable ideas
- `Role.run(with_message=...)` is the cleanest reuse seam for standalone agents.
- `Team` + `Environment` is a very small multi-agent shell once `MGXEnv` is removed.
- `DataInterpreter` is the least MetaGPT-specific "agent that plans, writes code, executes, and iterates".
- `Researcher` is a good example of a deterministic multi-step role using `BY_ORDER` rather than dynamic tool dispatch.
- `SubscriptionRunner` is a useful pattern for turning any role into a triggered async worker.

## copy risk
- lowest risk
  - `metagpt/subscription.py`
  - `metagpt/roles/searcher.py`
  - `metagpt/roles/researcher.py`
- medium risk
  - `metagpt/team.py`
  - `metagpt/roles/role.py`
  - `metagpt/roles/di/data_interpreter.py`
- highest risk
  - `metagpt/software_company.py`
  - `metagpt/roles/di/role_zero.py`
  - `metagpt/roles/di/team_leader.py`
  - `metagpt/roles/engineer.py`
  - `metagpt/roles/qa_engineer.py`

## exact search shortcuts
- `rg -n "class Team|def hire|def run_project|async def run" metagpt/team.py`
- `rg -n "class Role|async def (_observe|_think|_act|_react|_plan_and_act|run)|def (set_actions|_watch|publish_message|put_message|_set_react_mode)" metagpt/roles/role.py`
- `rg -n "class RoleZero|async def (_quick_think|_run_commands|_run_special_command|_end)|def (set_tool_execution|set_longterm_memory)" metagpt/roles/di/role_zero.py`
- `rg -n "class TeamLeader|publish_team_message|finish_current_task" metagpt/roles/di/team_leader.py`
- `rg -n "class DataInterpreter|_write_and_exec_code|_act_on_task|_check_data" metagpt/roles/di/data_interpreter.py`
- `rg -n "class Engineer|_new_code_actions|_new_coding_context|_act_summarize|_new_code_plan_and_change_action" metagpt/roles/engineer.py`
- `rg -n "class (ProductManager|Architect|ProjectManager|QaEngineer|Researcher|Searcher|Sales|CustomerService)" metagpt/roles metagpt/roles/di`
- `rg -n "Team\\(|Role\\(|DataInterpreter\\(|TeamLeader\\(" examples tests`

## hubs
- `metagpt/roles/__init__.py` [inbound_imports=40, glue only]
- `metagpt/roles/di/data_interpreter.py` [inbound_imports=26]
- `metagpt/roles/role.py` [inbound_imports=20]
- `metagpt/team.py` [inbound_imports=14]
- `metagpt/roles/di/team_leader.py` [inbound_imports=12]
