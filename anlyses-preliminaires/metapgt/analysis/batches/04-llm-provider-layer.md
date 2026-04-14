# LLM Provider Layer / Model Abstraction

Batch ID: `B04-llm-provider-layer`

## purpose
Provider registry, shared llm contract, OpenAI-shaped transport assumptions, per-vendor adapters, and output postprocessing.

The most reusable part is the registry + `BaseLLM` interface. The biggest portability decision is whether you want to keep MetaGPT's OpenAI-compatible response shape across providers.

## subdomains
- `provider registration`
  - `metagpt/provider/llm_provider_registry.py::{LLMProviderRegistry,register_provider,create_llm_instance}`
- `common llm contract`
  - `metagpt/provider/base_llm.py::BaseLLM`
- `OpenAI-shaped provider family`
  - `metagpt/provider/openai_api.py::OpenAILLM`
  - `metagpt/provider/azure_openai_api.py::AzureOpenAILLM`
  - `metagpt/provider/metagpt_api.py::MetaGPTLLM`
  - `metagpt/provider/ark_api.py::ArkLLM`
- `HTTP requestor substrate`
  - `metagpt/provider/general_api_base.py::{ApiType,OpenAIResponse,APIRequestor}`
  - `metagpt/provider/general_api_requestor.py::GeneralAPIRequestor`
- `vendor adapters`
  - `metagpt/provider/anthropic_api.py::AnthropicLLM`
  - `metagpt/provider/google_gemini_api.py::GeminiLLM`
  - `metagpt/provider/qianfan_api.py::QianFanLLM`
  - `metagpt/provider/dashscope_api.py::DashScopeLLM`
  - `metagpt/provider/bedrock_api.py::BedrockLLM`
  - `metagpt/provider/ollama_api.py::OllamaLLM`
  - `metagpt/provider/spark_api.py::SparkLLM`
  - `metagpt/provider/zhipuai_api.py::ZhiPuAILLM`
  - `metagpt/provider/openrouter_reasoning.py::OpenrouterReasoningLLM`
- `output postprocess`
  - `metagpt/provider/postprocess/llm_output_postprocess.py::llm_output_postprocess`

## entrypoints
- `metagpt/provider/__init__.py`
- `metagpt/provider/llm_provider_registry.py::register_provider`
- `metagpt/provider/llm_provider_registry.py::create_llm_instance`
- `metagpt/provider/base_llm.py::BaseLLM.aask`
- `metagpt/provider/base_llm.py::BaseLLM.acompletion_text`
- `metagpt/provider/openai_api.py::OpenAILLM.acompletion_text`
- `metagpt/provider/general_api_requestor.py::GeneralAPIRequestor.arequest`
- `metagpt/provider/postprocess/llm_output_postprocess.py::llm_output_postprocess`

## key files
- `metagpt/provider/__init__.py` [39 lines, inbound_imports=5]
  - import-time side effects that register many providers
- `metagpt/provider/llm_provider_registry.py` [48 lines, inbound_imports=18]
  - tiny registry/decorator/factory layer
- `metagpt/provider/base_llm.py` [412 lines, inbound_imports=26]
  - main shared llm interface, retries, streaming, multimodal input, message compression, cost tracking
- `metagpt/provider/openai_api.py` [327 lines, inbound_imports=5]
  - canonical provider implementation and template for OpenAI-compatible backends
- `metagpt/provider/general_api_base.py` [581 lines, inbound_imports=2]
  - low-level sync/async HTTP requestor with streaming helpers
- `metagpt/provider/general_api_requestor.py` [140 lines, inbound_imports=4]
  - concrete generic requestor for SSE / ndjson style endpoints
- `metagpt/provider/postprocess/llm_output_postprocess.py` [20 lines, inbound_imports=2]
  - current single-entry postprocess hook

## data flow
- `metagpt/provider/__init__.py` imports provider modules so their `@register_provider(...)` decorators populate the global registry.
- `metagpt/context.py::Context.llm` later calls `create_llm_instance(config.llm)`.
- `BaseLLM` normalizes messages, system prompts, multimodal inputs, compression, retries, and cost updates.
- Provider adapters implement `_achat_completion`, `acompletion`, and streaming variants, then return OpenAI-like choice structures.
- `llm_output_postprocess()` is used downstream by `ActionNode` to parse or clean model output.

## feature inventory
- `Registry core`
  - kind: `core runtime`
  - files: `metagpt/provider/llm_provider_registry.py`
  - symbols: `LLMProviderRegistry.register`, `LLMProviderRegistry.get_provider`, `register_provider`, `create_llm_instance`
  - reuse: `copiable tel quel`
- `BaseLLM contract`
  - kind: `core runtime`
  - files: `metagpt/provider/base_llm.py`
  - symbols: `BaseLLM.aask`, `BaseLLM.aask_batch`, `BaseLLM.acompletion_text`, `BaseLLM.get_choice_text`, `BaseLLM.get_choice_function_arguments`, `BaseLLM.compress_messages`, `BaseLLM._update_costs`
  - reuse: `copiable avec adaptation`
- `OpenAI-compatible provider adapter`
  - kind: `provider adapter`
  - files: `metagpt/provider/openai_api.py`
  - symbols: `OpenAILLM._init_client`, `_cons_kwargs`, `_achat_completion`, `_achat_completion_stream`, `aask_code`, `get_choice_function_arguments`, `_calc_usage`
  - reuse: `copiable avec adaptation`
- `Generic HTTP requestor core`
  - kind: `provider adapter`
  - files: `metagpt/provider/general_api_base.py`, `metagpt/provider/general_api_requestor.py`
  - symbols: `APIRequestor.request`, `APIRequestor.arequest`, `_prepare_request_raw`, `request_raw`, `arequest_raw`, `GeneralAPIRequestor._interpret_response`, `GeneralAPIRequestor._interpret_async_response`
  - reuse: `copiable avec adaptation`
- `Vendor adapter family`
  - kind: `provider adapters`
  - files: `metagpt/provider/*.py`
  - symbols: `AnthropicLLM`, `GeminiLLM`, `QianFanLLM`, `DashScopeLLM`, `BedrockLLM`, `OllamaLLM`, `SparkLLM`, `ZhiPuAILLM`
  - reuse: mostly `copiable avec adaptation`
- `Postprocess entry`
  - kind: `glue`
  - files: `metagpt/provider/postprocess/llm_output_postprocess.py`
  - symbols: `llm_output_postprocess`
  - reuse: `copiable tel quel`

## symbol map
- registry
  - `metagpt/provider/__init__.py`
  - `metagpt/provider/llm_provider_registry.py::{LLMProviderRegistry,register_provider,create_llm_instance,LLM_REGISTRY}`
- shared contract
  - `metagpt/provider/base_llm.py::{BaseLLM,_user_msg,_user_msg_with_imgs,format_msg,_update_costs,aask,aask_batch,acompletion_text,get_choice_text,get_choice_delta_text,get_choice_function_arguments,compress_messages}`
- low-level requestors
  - `metagpt/provider/general_api_base.py::{ApiType,OpenAIResponse,APIRequestor,parse_stream,parse_stream_async,aiohttp_session}`
  - `metagpt/provider/general_api_requestor.py::{parse_stream_helper,parse_stream,GeneralAPIRequestor}`
- canonical provider
  - `metagpt/provider/openai_api.py::{OpenAILLM,_init_client,_make_client_kwargs,_achat_completion_stream,_cons_kwargs,_achat_completion,acompletion_text,aask_code,get_choice_function_arguments,_calc_usage}`
- postprocess
  - `metagpt/provider/postprocess/llm_output_postprocess.py::llm_output_postprocess`

## dependency map
- import pressure by batch from B04 code
  - `B04-llm-provider-layer`: `55`
  - `B01-core-runtime-config`: `46`
  - `B05-tools-utils-execution`: `20`
- hard blockers for extracting the registry
  - `metagpt/configs/llm_config.py`
  - `metagpt/provider/base_llm.py`
- hard blockers for extracting `BaseLLM`
  - `openai`
  - `tenacity`
  - `metagpt/utils/cost_manager.py`
  - `metagpt/utils/token_counter.py`
  - `metagpt/configs/compress_msg_config.py`
- hard blockers for extracting the generic HTTP requestor
  - `aiohttp`
  - `requests`
  - `openai` error/types surface reused by MetaGPT
- hard blockers for vendor adapters
  - provider-specific SDKs such as `anthropic`, `dashscope`, `google`, `sparkai`, `boto3`/bedrock clients, `ollama`, `zhipuai`

## extraction recipes
- extract only registry + provider binding
  - read first: `metagpt/provider/llm_provider_registry.py`
  - keep: whole file
  - verdict: `copiable tel quel`
- extract shared llm contract
  - read first: `metagpt/provider/base_llm.py`
  - keep: message formatting, streaming, retries, compression
  - replace: cost manager and token counting if you do not want MetaGPT accounting
  - verdict: `copiable avec adaptation`
- extract a generic OpenAI-compatible backend
  - read first: `metagpt/provider/openai_api.py`, then `metagpt/provider/base_llm.py`
  - keep: `_cons_kwargs`, streaming accumulation, usage fallback calculation
  - replace: `aask_code` tool schema if your function-call surface differs
  - verdict: `copiable avec adaptation`
- extract a raw HTTP requestor for custom providers
  - read first: `metagpt/provider/general_api_base.py`, `metagpt/provider/general_api_requestor.py`
  - keep: request preparation, sync/async request methods, stream interpretation
  - verdict: `copiable avec adaptation`

## do not copy blindly
- `metagpt/provider/__init__.py` is operational glue, not just a barrel file. Import order matters because registration is a side effect.
- `create_llm_instance()` assumes `config.api_type` already maps to a registered provider. Incomplete imports yield runtime lookup failures.
- `BaseLLM` is written around OpenAI-style `choices[0]["message"]` semantics even when the actual provider is not OpenAI.
- `OpenAILLM.get_choice_function_arguments()` contains compatibility fallbacks for malformed tool-call outputs; useful, but it bakes in OpenAI tool-call conventions.
- `BaseLLM.compress_messages()` silently truncates history based on `compress_type`; this can change behavior in subtle ways during extraction.
- `general_api_base.py` reuses `openai` exception classes and naming even for non-OpenAI HTTP backends.
- `llm_output_postprocess()` currently always instantiates `BasePostProcessPlugin`; the "plugin selection" abstraction is shallower than the file name suggests.

## minimal reusable slices
- `LLM registry core`
  - files: `metagpt/provider/llm_provider_registry.py`
  - verdict: `copiable tel quel`
- `BaseLLM contract`
  - files: `metagpt/provider/base_llm.py`
  - verdict: `copiable avec adaptation`
- `OpenAI-compatible adapter shell`
  - files: `metagpt/provider/openai_api.py`
  - verdict: `copiable avec adaptation`
- `Generic HTTP requestor`
  - files: `metagpt/provider/general_api_base.py`, `metagpt/provider/general_api_requestor.py`
  - verdict: `copiable avec adaptation`
- `Output postprocess hook`
  - files: `metagpt/provider/postprocess/llm_output_postprocess.py`
  - verdict: `copiable tel quel`

## executable docs / tests
- `tests/metagpt/provider/test_base_llm.py`
- `tests/metagpt/provider/test_openai.py`
- `tests/metagpt/provider/test_general_api_base.py`
- `tests/metagpt/provider/test_general_api_requestor.py`
- `tests/metagpt/provider/test_anthropic_api.py`
- `tests/metagpt/provider/test_bedrock_api.py`
- `tests/metagpt/provider/mock_llm_config.py`
- `tests/metagpt/provider/req_resp_const.py`

`tests/metagpt/provider/mock_llm_config.py` and `tests/metagpt/provider/req_resp_const.py` are especially valuable because they reveal the exact response shapes the adapter layer expects.

## external deps
- core
  - `openai`
  - `tenacity`
  - `aiohttp`
  - `requests`
- optional vendors
  - `anthropic`
  - `dashscope`
  - `sparkai`
  - `google`
  - `ollama`
  - `boto3` / bedrock stack

## flags/env
- `config.llm.api_type`
- `config.llm.model`
- `config.llm.base_url`
- `config.llm.api_key`
- `config.llm.timeout`
- `config.llm.stream`
- `config.llm.use_system_prompt`
- `LLM_LOG` environment variable in `general_api_base.py`

## exact search shortcuts
- `rg -n "@register_provider|create_llm_instance|class BaseLLM|class .*LLM\\(" metagpt/provider`
- `rg -n "def (aask|acompletion_text|get_choice_text|get_choice_function_arguments|compress_messages)" metagpt/provider`
- `rg -n "class (APIRequestor|GeneralAPIRequestor)|def (_prepare_request_raw|request_raw|arequest_raw)" metagpt/provider`

## hubs
- `metagpt/provider/base_llm.py` [inbound_imports=26]
- `metagpt/provider/llm_provider_registry.py` [inbound_imports=18]
- `metagpt/provider/openai_api.py` [inbound_imports=5]
- `metagpt/provider/__init__.py` [inbound_imports=5]
