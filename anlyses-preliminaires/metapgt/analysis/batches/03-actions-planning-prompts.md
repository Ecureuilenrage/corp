# Actions / Planning / Prompt Assets

Batch ID: `B03-actions-planning-prompts`

## purpose
Action execution layer, structured prompt trees, planner review loop, and the document-heavy SOP actions that turn requirements into PRD/tasks/code/test instructions.

This batch mixes two very different reuse profiles:
- small reusable runtime kernels: `Action`, `ActionNode`, `Planner`, notebook execution
- strongly coupled document pipelines: `WritePRD`, `WriteTasks`, `WriteCode`, requirement-analysis prompt packs

## subdomains
- `generic action contract`
  - `metagpt/actions/action.py::Action`
- `structured prompt trees + typed outputs`
  - `metagpt/actions/action_node.py::{ActionNode,ReviewMode,ReviseMode,FillMode}`
- `planner + review loop`
  - `metagpt/strategy/planner.py::Planner`
  - `metagpt/actions/di/ask_review.py::AskReview`
- `repo-document SOPs`
  - `metagpt/actions/write_prd.py::WritePRD`
  - `metagpt/actions/project_management.py::WriteTasks`
  - `metagpt/actions/write_code.py::WriteCode`
  - `metagpt/actions/write_prd_an.py::*`
  - `metagpt/actions/project_management_an.py::*`
  - `metagpt/actions/write_code_plan_and_change_an.py::*`
- `notebook/code execution`
  - `metagpt/actions/di/execute_nb_code.py::{RealtimeOutputNotebookClient,ExecuteNbCode}`
- `prompt assets + requirement-analysis packs`
  - `metagpt/prompts/*`
  - `metagpt/actions/requirement_analysis/*`

## entrypoints
- `metagpt/actions/action.py::Action.run`
- `metagpt/actions/action_node.py::ActionNode.fill`
- `metagpt/actions/action_node.py::ActionNode.review`
- `metagpt/actions/action_node.py::ActionNode.revise`
- `metagpt/strategy/planner.py::Planner.update_plan`
- `metagpt/strategy/planner.py::Planner.process_task_result`
- `metagpt/actions/write_prd.py::WritePRD.run`
- `metagpt/actions/project_management.py::WriteTasks.run`
- `metagpt/actions/write_code.py::WriteCode.run`
- `metagpt/actions/di/execute_nb_code.py::ExecuteNbCode.run`

## key files
- `metagpt/actions/action.py` [119 lines, inbound_imports=26]
  - minimal action shell with context + llm + optional `ActionNode`
- `metagpt/actions/action_node.py` [876 lines, inbound_imports=36]
  - the main structured prompt engine in MetaGPT
- `metagpt/strategy/planner.py` [192 lines, inbound_imports=3]
  - human/auto review loop around `Plan` and `TaskResult`
- `metagpt/actions/write_prd.py` [325 lines, inbound_imports=3]
  - PRD generation/update pipeline backed by `ProjectRepo`
- `metagpt/actions/project_management.py` [201 lines, inbound_imports=5]
  - turns design docs into task docs + dependency file updates
- `metagpt/actions/write_code.py` [228 lines, inbound_imports=5]
  - single-file code generation using design/task/legacy-code context
- `metagpt/actions/di/execute_nb_code.py` [328 lines, inbound_imports=6]
  - notebook-backed code execution loop with streaming reporter
- `metagpt/actions/write_prd_an.py`
  - `ActionNode` trees for PRD structure, bug/update detection, requirement refinement
- `metagpt/actions/project_management_an.py`
  - `ActionNode` trees for required packages, logic analysis, task list, shared knowledge
- `metagpt/actions/write_code_plan_and_change_an.py`
  - incremental-development prompt nodes and diff-style change guidance

## data flow
- `metagpt/actions/action.py::Action` gives roles a common `run()` contract plus llm/context ownership.
- `metagpt/actions/action_node.py::ActionNode.fill` compiles prompt instructions + examples, calls the llm, parses structured output, and returns typed `instruct_content`.
- `metagpt/strategy/planner.py::Planner` wraps `metagpt/schema.py::Plan` with review-confirm-update logic.
- SOP actions such as `WritePRD`, `WriteTasks`, and `WriteCode` read/write `ProjectRepo` docs and pass structured payloads through `Message.instruct_content`.
- `ExecuteNbCode` is the execution back-end used by notebook-style coding agents in `B02`.

## feature inventory
- `Action base contract`
  - kind: `core runtime`
  - files: `metagpt/actions/action.py`
  - symbols: `Action._update_private_llm`, `Action.set_prefix`, `Action._aask`, `Action._run_action_node`, `Action.run`, `Action.override_context`
  - reuse: `copiable avec adaptation`
- `ActionNode structured prompt engine`
  - kind: `core runtime`
  - files: `metagpt/actions/action_node.py`
  - symbols: `ActionNode.create_model_class`, `ActionNode.compile_instruction`, `ActionNode.compile_example`, `ActionNode.compile`, `ActionNode.fill`, `ActionNode.review`, `ActionNode.revise`, `ActionNode.from_pydantic`
  - reuse: `copiable avec adaptation`
- `Planner review loop`
  - kind: `core runtime`
  - files: `metagpt/strategy/planner.py`
  - symbols: `Planner.update_plan`, `Planner.process_task_result`, `Planner.ask_review`, `Planner.confirm_task`, `Planner.get_useful_memories`, `Planner.get_plan_status`
  - reuse: `copiable avec adaptation`
- `WritePRD repo document pipeline`
  - kind: `glue runtime`
  - files: `metagpt/actions/write_prd.py`, `metagpt/actions/write_prd_an.py`
  - symbols: `WritePRD.run`, `_handle_bugfix`, `_handle_new_requirement`, `_handle_requirement_update`, `_is_bugfix`, `get_related_docs`, `_merge`, `WRITE_PRD_NODE`, `REFINED_PRD_NODE`, `WP_ISSUE_TYPE_NODE`, `WP_IS_RELATIVE_NODE`
  - reuse: `a reecrire`
- `WriteTasks schedule pipeline`
  - kind: `glue runtime`
  - files: `metagpt/actions/project_management.py`, `metagpt/actions/project_management_an.py`
  - symbols: `WriteTasks.run`, `_update_tasks`, `_run_new_tasks`, `_merge`, `_update_requirements`, `PM_NODE`, `REFINED_PM_NODE`, `TASK_LIST`, `REFINED_TASK_LIST`
  - reuse: `copiable avec adaptation`
- `WriteCode single-file SOP`
  - kind: `glue runtime`
  - files: `metagpt/actions/write_code.py`, `metagpt/actions/write_code_plan_and_change_an.py`
  - symbols: `WriteCode.write_code`, `WriteCode.run`, `WriteCode.get_codes`, `WRITE_CODE_PLAN_AND_CHANGE_NODE`, `WriteCodePlanAndChange.run`
  - reuse: `copiable avec adaptation`
- `Notebook execution runner`
  - kind: `tool runtime`
  - files: `metagpt/actions/di/execute_nb_code.py`
  - symbols: `RealtimeOutputNotebookClient._async_poll_output_msg`, `ExecuteNbCode.build`, `ExecuteNbCode.run_cell`, `ExecuteNbCode.run`, `ExecuteNbCode.parse_outputs`, `ExecuteNbCode.reset`
  - reuse: `copiable avec adaptation`
- `Prompt node packs`
  - kind: `prompt glue`
  - files: `metagpt/actions/write_prd_an.py`, `metagpt/actions/project_management_an.py`, `metagpt/actions/write_code_plan_and_change_an.py`, `metagpt/prompts/*`
  - symbols: `WRITE_PRD_NODE`, `PM_NODE`, `WRITE_CODE_PLAN_AND_CHANGE_NODE`
  - reuse: `copiable avec adaptation` for pattern, usually `a reecrire` for content

## symbol map
- action shell
  - `metagpt/actions/action.py::{Action,_update_private_llm,set_prefix,_aask,_run_action_node,run,override_context}`
- structured prompt engine
  - `metagpt/actions/action_node.py::{ReviewMode,ReviseMode,FillMode,ActionNode}`
  - `metagpt/actions/action_node.py::{create_model_class,compile_instruction,compile_example,compile,_aask_v1,simple_fill,code_fill,xml_fill,fill,review,revise,from_pydantic}`
- planner
  - `metagpt/strategy/planner.py::{update_plan,process_task_result,ask_review,confirm_task,get_useful_memories,get_plan_status}`
- repo pipelines
  - `metagpt/actions/write_prd.py::{run,_handle_bugfix,_handle_new_requirement,_handle_requirement_update,_is_bugfix,get_related_docs,_merge}`
  - `metagpt/actions/project_management.py::{run,_update_tasks,_run_new_tasks,_merge,_update_requirements}`
  - `metagpt/actions/write_code.py::{write_code,run,get_codes}`
  - `metagpt/actions/write_code_plan_and_change_an.py::{WRITE_CODE_PLAN_AND_CHANGE_NODE,WriteCodePlanAndChange}`
- notebook execution
  - `metagpt/actions/di/execute_nb_code.py::{RealtimeOutputNotebookClient,ExecuteNbCode,remove_log_and_warning_lines,remove_escape_and_color_codes,display_markdown}`

## dependency map
- import pressure by batch from B03 code
  - `B03-actions-planning-prompts`: `111`
  - `B05-tools-utils-execution`: `91`
  - `B01-core-runtime-config`: `80`
  - `B06-rag-doc-knowledge`: `4`
  - `B04-llm-provider-layer`: `4`
  - `B02-agent-orchestration`: `1`
  - `B07-environments-extensions`: `1`
- hard blockers for extracting `ActionNode`
  - `metagpt/provider/base_llm.py`
  - `metagpt/provider/postprocess/llm_output_postprocess.py`
  - `metagpt/exp_pool/decorator.py`
  - `metagpt/exp_pool/serializers/ActionNodeSerializer`
  - `metagpt/utils/common.py::{OutputParser,general_after_log}`
  - `metagpt/utils/human_interaction.py`
  - `metagpt/utils/sanitize.py`
- hard blockers for extracting `Planner`
  - `metagpt/schema.py::{Plan,Task,TaskResult,Message}`
  - `metagpt/memory/memory.py`
  - `metagpt/actions/di/ask_review.py`
  - `metagpt/actions/di/write_plan.py`
- hard blockers for extracting `WritePRD` / `WriteTasks` / `WriteCode`
  - `metagpt/utils/project_repo.py`
  - `metagpt/utils/file_repository.py`
  - `metagpt/utils/report.py`
  - `metagpt/schema.py::{AIMessage,Document,Documents,CodingContext,RunCodeResult}`
  - prompt node files `*_an.py`
- hard blockers for extracting `ExecuteNbCode`
  - `nbclient`
  - `nbformat`
  - `rich`
  - `metagpt/utils/report.py::NotebookReporter`

## extraction recipes
- extract only typed prompt filling
  - read first: `metagpt/actions/action_node.py`
  - keep: model creation, prompt compilation, structured parse, `from_pydantic`
  - drop first: exp-cache, human review, and MetaGPT postprocess if you want a lighter slice
  - advice: `copiable avec adaptation`
- extract planner review loop
  - read first: `metagpt/strategy/planner.py`, then `metagpt/schema.py::Plan`
  - keep: `update_plan`, `process_task_result`, `ask_review`
  - replace: `AskReview` and `WritePlan` with your own review/generation actions
  - advice: `copiable avec adaptation`
- extract notebook execution kernel
  - read first: `metagpt/actions/di/execute_nb_code.py`
  - keep: `RealtimeOutputNotebookClient`, `ExecuteNbCode.run`
  - replace: reporter and workspace path management if you do not use MetaGPT reporters
  - advice: `copiable avec adaptation`
- extract PRD/task/code document pipeline
  - read first: `metagpt/actions/write_prd.py`, `metagpt/actions/project_management.py`, `metagpt/actions/write_code.py`
  - then read blockers in `B05`
  - advice: `a reecrire` unless you also want MetaGPT's repo/doc conventions

## do not copy blindly
- `metagpt/actions/action.py::Action._update_private_llm` silently swaps in a model-specific llm from `ModelsConfig.default()` and reuses the current cost manager.
- `metagpt/actions/action_node.py::ActionNode.fill` is decorated with `@exp_cache(...)`, so the structured fill path is coupled to the experience-pool machinery.
- `ActionNode` special fill modes contain a portability hazard: inside `fill()`, `CODE_FILL`, `XML_FILL`, and `SINGLE_FILL` branches reference local `context` instead of `self.context`. If you rely on those branches, patch and verify them first.
- `WritePRD`, `WriteTasks`, and `WriteCode` assume `ProjectRepo` layout, file naming conventions, and `Message.instruct_content` payload contracts from other batches.
- `WriteTasks._update_requirements` mutates `requirements.txt`-style package data as part of task generation.
- `ExecuteNbCode.run` always writes `code.ipynb` into `config.workspace.path`.
- Prompt asset files are policy, not just data. Copying the engine without rewriting prompt nodes often imports MetaGPT's product assumptions with it.

## minimal reusable slices
- `Action base`
  - files: `metagpt/actions/action.py`
  - verdict: `copiable avec adaptation`
- `ActionNode structured prompt engine`
  - files: `metagpt/actions/action_node.py`
  - keep: `create_model_class`, `compile`, `fill`, `from_pydantic`
  - patch first: special fill-mode bug
  - verdict: `copiable avec adaptation`
- `Planner review loop`
  - files: `metagpt/strategy/planner.py`
  - verdict: `copiable avec adaptation`
- `Notebook execution runner`
  - files: `metagpt/actions/di/execute_nb_code.py`
  - verdict: `copiable avec adaptation`
- `Repo-document SOPs`
  - files: `metagpt/actions/write_prd.py`, `metagpt/actions/project_management.py`, `metagpt/actions/write_code.py`
  - verdict: `a reecrire` for most future projects

## executable docs / tests
- `tests/metagpt/actions/test_action_node.py`
- `tests/metagpt/strategy/test_planner.py`
- `tests/metagpt/actions/di/test_execute_nb_code.py`
- `tests/metagpt/actions/test_write_prd.py`
- `tests/metagpt/actions/test_project_management.py`
- `tests/metagpt/actions/test_write_code.py`
- `examples/di/software_company.py`

Several of these are ignored by `pytest.ini` in the default suite, but they still serve as high-value executable documentation.

## external deps
- core reusable deps
  - `pydantic`
  - `tenacity`
  - `json`
- execution / tooling deps
  - `nbclient`
  - `nbformat`
  - `rich`
- hidden optional deps
  - `B06` experience-pool components through `ActionNode`

## flags/env
- `config.prompt_schema`
- `config.inc`
- `config.max_auto_summarize_code`
- `config.workspace.path`

## exact search shortcuts
- `rg -n "class (Action|ActionNode|Planner|WritePRD|WriteTasks|WriteCode|ExecuteNbCode)" metagpt/actions metagpt/strategy`
- `rg -n "def (fill|review|revise|update_plan|process_task_result|run_cell|get_codes)" metagpt/actions metagpt/strategy`
- `rg -n "WRITE_PRD_NODE|PM_NODE|WRITE_CODE_PLAN_AND_CHANGE_NODE|TASK_LIST|REFINED_TASK_LIST" metagpt/actions`

## hubs
- `metagpt/actions/__init__.py` [inbound_imports=85]
- `metagpt/actions/action_node.py` [inbound_imports=36]
- `metagpt/actions/action.py` [inbound_imports=26]
- `metagpt/prompts/di/role_zero.py` [inbound_imports=8]
