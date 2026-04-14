# Tests / Examples / Docs / Infra

Batch ID: `B08-tests-examples-docs-infra`

## purpose
Executable documentation, packaging metadata, test harness, provider fixtures, CI workflow, and infra files that expose what MetaGPT actually assumes in practice.

This batch is not runtime core, but it is critical for fast reuse because it answers:
- which examples show the smallest working slice?
- which tests document exact payload shapes?
- which dependencies are optional vs required?
- which subsystems are skipped by default because they are brittle, expensive, or integration-heavy?

## subdomains
- `packaging + install surfaces`
  - `setup.py`
  - `requirements.txt`
  - `Dockerfile`
- `pytest + fixture harness`
  - `pytest.ini`
  - `tests/conftest.py`
  - `tests/config2.yaml`
- `provider mocks + response fixtures`
  - `tests/metagpt/provider/mock_llm_config.py`
  - `tests/metagpt/provider/req_resp_const.py`
- `minimal executable examples`
  - `examples/hello_world.py`
  - `examples/build_customized_agent.py`
  - `examples/build_customized_multi_agents.py`
  - `examples/di/software_company.py`
- `domain / optional examples`
  - `examples/rag/*`
  - `examples/android_assistant/*`
  - `examples/stanford_town/*`
  - `examples/werewolf_game/*`
- `CI workflow`
  - `.github/workflows/unittest.yaml`

## entrypoints
- `setup.py::entry_points`
- `examples/hello_world.py::main`
- `examples/build_customized_agent.py::main`
- `examples/build_customized_multi_agents.py::main`
- `examples/di/software_company.py::main`
- `tests/conftest.py::llm_mock`
- `tests/conftest.py::context`
- `.github/workflows/unittest.yaml`

## key files
- `setup.py` [122 lines, inbound_imports=0]
  - package name, extras, console entrypoint, optional install command
- `pytest.ini` [168 lines, inbound_imports=0]
  - negative map of slow/fragile/optional tests through ignore lists
- `tests/conftest.py`
  - main shared harness: llm patching, rsp cache, temp git repo context, network mockers
- `tests/config2.yaml`
  - test-time config shape expected by CI
- `tests/metagpt/provider/mock_llm_config.py`
  - concrete `LLMConfig` examples per provider family
- `tests/metagpt/provider/req_resp_const.py`
  - exact response-object fixtures used to validate adapter parsing
- `examples/build_customized_agent.py`
  - smallest single-role customization example
- `examples/build_customized_multi_agents.py`
  - smallest multi-agent orchestration example
- `examples/di/software_company.py`
  - smallest planning/coding-agent orchestration example using `DataInterpreter`
- `.github/workflows/unittest.yaml`
  - what CI actually installs and runs

## data flow
- `setup.py` defines extras that map directly onto major optional surfaces such as RAG, browser automation, Android assistant, and tests.
- `pytest.ini` excludes a very large number of tests, which effectively marks the most expensive or unstable subsystem boundaries.
- `tests/conftest.py` patches `BaseLLM.aask`, `BaseLLM.aask_batch`, and `OpenAILLM.aask_code` with `MockLLM`, creating the default executable-doc environment for tests.
- `examples/build_customized_agent.py` and `examples/build_customized_multi_agents.py` are the fastest paths into `B02` and `B03` without the full software-company stack.
- Provider fixture files under `tests/metagpt/provider/*` document the exact object shapes expected by `B04`.
- CI installs `.[test]`, global Mermaid CLI, and Playwright, then seeds `~/.metagpt/config2.yaml` from `tests/config2.yaml`.

## feature inventory
- `Packaging / extras matrix`
  - kind: `infra`
  - files: `setup.py`
  - symbols: `extras_require`, `InstallMermaidCLI`, `entry_points`
  - reuse: `copiable avec adaptation`
- `Pytest harness core`
  - kind: `tooling`
  - files: `tests/conftest.py`, `tests/config2.yaml`
  - symbols: `llm_mock`, `context`, `aiohttp_mocker`, `search_engine_mocker`, `rsp_cache`, `proxy`
  - reuse: `copiable avec adaptation`
- `Provider fixture pack`
  - kind: `tooling`
  - files: `tests/metagpt/provider/mock_llm_config.py`, `tests/metagpt/provider/req_resp_const.py`
  - symbols: `mock_llm_config*`, `get_openai_chat_completion`, `get_openai_chat_completion_chunk`, `get_qianfan_response`, `get_dashscope_response`, `get_anthropic_response`, `llm_general_chat_funcs_test`
  - reuse: `copiable tel quel`
- `Minimal single-agent example`
  - kind: `executable docs`
  - files: `examples/build_customized_agent.py`
  - symbols: `SimpleWriteCode`, `SimpleRunCode`, `SimpleCoder`, `RunnableCoder`, `main`
  - reuse: `copiable tel quel`
- `Minimal multi-agent example`
  - kind: `executable docs`
  - files: `examples/build_customized_multi_agents.py`
  - symbols: `SimpleWriteCode`, `SimpleCoder`, `SimpleWriteTest`, `SimpleTester`, `SimpleWriteReview`, `SimpleReviewer`, `main`
  - reuse: `copiable tel quel`
- `Planning-agent example`
  - kind: `executable docs`
  - files: `examples/di/software_company.py`
  - symbols: `main`
  - reuse: `copiable avec adaptation`
- `CI dependency contract`
  - kind: `infra`
  - files: `.github/workflows/unittest.yaml`, `pytest.ini`
  - symbols: workflow steps and pytest ignore map
  - reuse: `copiable avec adaptation`

## symbol map
- packaging
  - `setup.py::{InstallMermaidCLI,extras_require,entry_points}`
- fixture harness
  - `tests/conftest.py::{rsp_cache,llm_mock,context,proxy,loguru_caplog,new_filename,search_engine_mocker,aiohttp_mocker,curl_cffi_mocker,httplib2_mocker,http_server}`
- provider fixtures
  - `tests/metagpt/provider/mock_llm_config.py::{mock_llm_config,mock_llm_config_proxy,mock_llm_config_azure,mock_llm_config_anthropic,mock_llm_config_bedrock,...}`
  - `tests/metagpt/provider/req_resp_const.py::{get_part_chat_completion,get_openai_chat_completion,get_openai_chat_completion_chunk,get_qianfan_response,get_dashscope_response,get_anthropic_response,llm_general_chat_funcs_test}`
- examples
  - `examples/hello_world.py::{ask_and_print,lowlevel_api_example,main}`
  - `examples/build_customized_agent.py::{SimpleWriteCode,SimpleRunCode,SimpleCoder,RunnableCoder,main}`
  - `examples/build_customized_multi_agents.py::{SimpleWriteCode,SimpleCoder,SimpleWriteTest,SimpleTester,SimpleWriteReview,SimpleReviewer,main}`
  - `examples/di/software_company.py::main`

## dependency map
- import pressure by batch from B08 code
  - `B01-core-runtime-config`: `285`
  - `B05-tools-utils-execution`: `161`
  - `B03-actions-planning-prompts`: `132`
  - `B02-agent-orchestration`: `123`
  - `B06-rag-doc-knowledge`: `80`
  - `B07-environments-extensions`: `80`
  - `B08-tests-examples-docs-infra`: `66`
  - `B04-llm-provider-layer`: `29`
- hard blockers for reusing the test harness
  - `pytest`
  - `pytest-mock`
  - `tests/mock/*`
  - `metagpt` importability in test env
- hard blockers for CI parity
  - `pip install -e .[test]`
  - `npm install -g @mermaid-js/mermaid-cli`
  - `playwright install --with-deps`
- hard blockers for example parity
  - valid `~/.metagpt/config2.yaml`
  - provider credentials or test mocks
  - optional extras depending on the example (`rag`, android, browser, etc.)

## extraction recipes
- find the smallest runnable custom agent
  - read first: `examples/build_customized_agent.py`
  - then map classes back to `B02` + `B03`
  - advice: `copiable tel quel`
- find the smallest runnable multi-agent team
  - read first: `examples/build_customized_multi_agents.py`
  - then map `Team` / `Role` / `Action` dependencies back to `B02`, `B01`, `B03`
  - advice: `copiable tel quel`
- find exact provider response expectations
  - read first: `tests/metagpt/provider/req_resp_const.py`
  - then confirm parser code in `B04`
  - advice: `copiable tel quel`
- bootstrap a reusable test harness
  - read first: `tests/conftest.py`, `tests/config2.yaml`
  - keep: llm patching, temp repo context, network mockers
  - replace: MetaGPT-specific mocks and cache files
  - advice: `copiable avec adaptation`

## do not copy blindly
- `pytest.ini` ignores a huge fraction of the suite. Treat it as a risk map, not proof that those subsystems are unimportant.
- `tests/conftest.py::llm_mock` globally patches core llm methods; reuse is convenient, but it changes behavior everywhere in the test process.
- `tests/conftest.py::context` creates a temporary git repo under `DEFAULT_WORKSPACE_ROOT`; extracted tests should verify their cleanup semantics.
- `setup.py` extras are the real optional-dependency map. Docs and README are secondary evidence compared with this file.
- `.github/workflows/unittest.yaml` installs Mermaid CLI and Playwright globally; examples or tests that depend on browser/report outputs may silently assume those binaries exist.
- `examples/di/software_company.py` is not the classic full multi-role company flow; it drives `DataInterpreter` with a specific tool set.

## minimal reusable slices
- `Provider fixture pack`
  - files: `tests/metagpt/provider/mock_llm_config.py`, `tests/metagpt/provider/req_resp_const.py`
  - verdict: `copiable tel quel`
- `Minimal custom agent example`
  - files: `examples/build_customized_agent.py`
  - verdict: `copiable tel quel`
- `Minimal multi-agent example`
  - files: `examples/build_customized_multi_agents.py`
  - verdict: `copiable tel quel`
- `Pytest harness core`
  - files: `tests/conftest.py`, `tests/config2.yaml`
  - verdict: `copiable avec adaptation`
- `CI dependency contract`
  - files: `.github/workflows/unittest.yaml`, `pytest.ini`
  - verdict: `copiable avec adaptation`

## executable docs / tests
- `examples/hello_world.py`
- `examples/build_customized_agent.py`
- `examples/build_customized_multi_agents.py`
- `examples/di/software_company.py`
- `examples/rag/rag_pipeline.py`
- `examples/rag/rag_bm.py`
- `examples/android_assistant/run_assistant.py`
- `examples/stanford_town/run_st_game.py`
- `tests/metagpt/roles/test_role.py`
- `tests/metagpt/test_subscription.py`
- `tests/metagpt/provider/test_base_llm.py`
- `tests/metagpt/provider/test_general_api_requestor.py`

## external deps
- packaging / test
  - `pytest`
  - `pytest-asyncio`
  - `pytest-mock`
  - `pytest-cov`
- optional infra
  - `playwright`
  - `mermaid-cli`
  - provider SDKs from `setup.py` extras

## flags/env
- `ALLOW_OPENAI_API_CALL`
- `~/.metagpt/config2.yaml`
- `tests/config2.yaml`
- coverage output config in `pytest.ini`

## exact search shortcuts
- `rg -n "entry_points|extras_require|python_requires" setup.py`
- `rg -n "def (main|run)|class (SimpleCoder|RunnableCoder|SimpleTester|SimpleReviewer)" examples`
- `rg -n "mock_llm_config|get_openai_chat_completion|llm_mock|ALLOW_OPENAI_API_CALL" tests`
- `rg -n -- '--ignore=' pytest.ini`

## hubs
- `tests/metagpt/provider/mock_llm_config.py` [inbound_imports=16]
- `tests/metagpt/provider/req_resp_const.py` [inbound_imports=11]
- `tests/data/incremental_dev_project/mock.py` [inbound_imports=8]
- `tests/metagpt/serialize_deserialize/test_serdeser_base.py` [inbound_imports=6]
