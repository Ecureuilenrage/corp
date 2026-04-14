# Batch 07 - Extensions Providers, Memory and Media

Scope: `1623` files. Dominant modules: [`extensions/openai/`](../../extensions/openai), [`extensions/google/`](../../extensions/google), [`extensions/browser/`](../../extensions/browser), [`extensions/memory-core/`](../../extensions/memory-core), [`src/media-understanding/`](../../src/media-understanding), [`src/media/`](../../src/media).

## purpose

This batch covers the non-channel extension surface: provider plugins, browser automation, memory indexing, media understanding, capability-specific generation runtimes, and reusable media persistence.

For extraction work, the important split is between small registration or registry shells and the heavier long-lived runtimes. The clean seams are the provider entry aggregators, the browser plugin registration shell, the memory runtime and tool shell, the capability-generation registry helpers, the TTS lazy facade, and the media store. The most dangerous files are [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts), [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts), and [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts), because each one fuses config, auth, runtime state, fallbacks, and side effects.

## entrypoints

- [`extensions/openai/index.ts`](../../extensions/openai/index.ts), [`extensions/google/index.ts`](../../extensions/google/index.ts), [`extensions/anthropic/index.ts`](../../extensions/anthropic/index.ts), [`extensions/xai/index.ts`](../../extensions/xai/index.ts), [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts): provider-plugin entries that publish model, search, speech, or media capabilities.
- [`extensions/browser/index.ts`](../../extensions/browser/index.ts): browser plugin entry that exposes tools, CLI, gateway, and service bootstrap.
- [`extensions/memory-core/index.ts`](../../extensions/memory-core/index.ts): memory plugin entry that registers memory capability runtime, tools, CLI, and embedding adapters.
- [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts): media-understanding orchestration entry.
- [`src/image-generation/runtime.ts`](../../src/image-generation/runtime.ts), [`src/tts/tts.ts`](../../src/tts/tts.ts): capability-specific runtime facades exposed to the rest of the host.

## key files

- [`extensions/openai/index.ts`](../../extensions/openai/index.ts): multi-capability provider bundle for models, speech, media understanding, realtime, and video.
- [`extensions/xai/index.ts`](../../extensions/xai/index.ts): strongest example of `defineSingleProviderPluginEntry` with auth, compat, tools, and web search.
- [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts): smallest browser-specific host registration seam.
- [`extensions/browser/src/browser/server-context.ts`](../../extensions/browser/src/browser/server-context.ts): profile-scoped browser operation context.
- [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts): gateway-to-browser proxy and local-dispatch bridge.
- [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts): hybrid memory index engine with sync, embeddings, batching, and watcher lifecycle.
- [`extensions/memory-core/src/tools.ts`](../../extensions/memory-core/src/tools.ts): memory search and snippet-read tool shell.
- [`src/memory-host-sdk/engine-foundation.ts`](../../src/memory-host-sdk/engine-foundation.ts): workspace contract bridge for external memory-engine code.
- [`src/media-understanding/provider-registry.ts`](../../src/media-understanding/provider-registry.ts): registry assembly for media-understanding providers, including auto image-provider backfill.
- [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts): attachment-level fallback loop across provider and CLI entries.
- [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts): generic candidate-resolution and normalization helpers reused by generation runtimes.
- [`src/media/store.ts`](../../src/media/store.ts): SSRF-aware temp media storage and cleanup layer.

## data flow

- Provider plugins start in extension-local [`index.ts`](../../extensions) files that call `definePluginEntry` or `defineSingleProviderPluginEntry`, then register one or more capability providers such as model, web-search, image-generation, speech, realtime-voice, or media-understanding.
- Multi-capability providers like [`extensions/openai/index.ts`](../../extensions/openai/index.ts) and [`extensions/google/index.ts`](../../extensions/google/index.ts) aggregate several `build*Provider` functions behind one plugin boundary.
- Browser flows split into a thin registration shell in [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts), a lazy service bootstrap in [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts), and profile-scoped request execution in [`extensions/browser/src/browser/server-context.ts`](../../extensions/browser/src/browser/server-context.ts) and [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts).
- Memory flows start in [`extensions/memory-core/index.ts`](../../extensions/memory-core/index.ts), which registers embedding adapters, a memory runtime, memory tools, prompt builders, and flush planning. Actual indexing lives under [`extensions/memory-core/src/memory/`](../../extensions/memory-core/src/memory) and crosses into [`src/memory-host-sdk/`](../../src/memory-host-sdk) for host contracts.
- Media-understanding builds a provider registry from plugin-owned capability providers in [`src/media-understanding/provider-registry.ts`](../../src/media-understanding/provider-registry.ts), resolves which entries apply in [`src/media-understanding/resolve.ts`](../../src/media-understanding/resolve.ts), then runs provider or CLI entries in [`src/media-understanding/runner.entries.ts`](../../src/media-understanding/runner.entries.ts) and [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts).
- Image, video, and speech runtimes reuse generic provider-registry and fallback helpers under [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts), [`src/image-generation/provider-registry.ts`](../../src/image-generation/provider-registry.ts), [`src/video-generation/provider-registry.ts`](../../src/video-generation/provider-registry.ts), and [`src/tts/provider-registry.ts`](../../src/tts/provider-registry.ts).
- Temporary media buffers are persisted through [`src/media/store.ts`](../../src/media/store.ts), which handles local files, remote downloads, mime sniffing, TTL cleanup, and path resolution.

## external deps

- Provider implementations depend on provider-specific SDKs and HTTP contracts under extension folders such as [`extensions/openai/package.json`](../../extensions/openai/package.json), [`extensions/google/package.json`](../../extensions/google/package.json), [`extensions/xai/package.json`](../../extensions/xai/package.json), and [`extensions/ollama/package.json`](../../extensions/ollama/package.json).
- Browser runtime and service bootstrap depend on the lazy service machinery exposed by `openclaw/plugin-sdk/browser-node-runtime` and on the browser control modules under [`extensions/browser/src/browser/`](../../extensions/browser/src/browser).
- [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts) depends on `chokidar`, `node:sqlite`, and optional local or remote embedding-provider runtimes.
- [`src/media/store.ts`](../../src/media/store.ts) depends on SSRF-aware hostname pinning and safe local-file reads from [`src/infra/net/ssrf.js`](../../src/infra/net/ssrf.js) and [`src/media/store.runtime.ts`](../../src/media/store.runtime.ts).

## flags/env

- Provider auth and discovery still inherit the SDK/provider-entry conventions from batch 04, but each plugin adds local policy. Examples: `XAI_API_KEY` in [`extensions/xai/index.ts`](../../extensions/xai/index.ts) and `OLLAMA_API_KEY` in [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts).
- Browser control service bootstrap reads `OPENCLAW_SKIP_BROWSER_CONTROL_SERVER` and `OPENCLAW_BROWSER_CONTROL_MODULE` in [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts).
- Memory engine behavior is config-driven via the workspace contract re-exported by [`src/memory-host-sdk/engine-foundation.ts`](../../src/memory-host-sdk/engine-foundation.ts), plus provider auto-selection rules in [`extensions/memory-core/src/memory/provider-adapters.ts`](../../extensions/memory-core/src/memory/provider-adapters.ts).
- Media-understanding, image-generation, and TTS selection are model-config driven rather than env-driven, with fallback and candidate resolution in [`src/media-understanding/resolve.ts`](../../src/media-understanding/resolve.ts) and [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts).

## subdomains

### Provider bundle entries and multi-capability registration

Classification: `glue` plus `adapters`.

Anchors:

- [`extensions/openai/index.ts`](../../extensions/openai/index.ts)
- [`extensions/google/index.ts`](../../extensions/google/index.ts)
- [`extensions/anthropic/index.ts`](../../extensions/anthropic/index.ts)
- [`extensions/xai/index.ts`](../../extensions/xai/index.ts)
- [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts)

These files are the extension-facing composition layer for provider ecosystems. They do not implement the full provider protocols themselves; they aggregate model providers, media providers, auth flows, CLI backends, discovery, or tools behind one plugin entry.

### Single-provider auth, discovery, and compat overlays

Classification: `adapters`.

Anchors:

- [`extensions/anthropic/register.runtime.ts`](../../extensions/anthropic/register.runtime.ts)
- [`extensions/xai/index.ts`](../../extensions/xai/index.ts)
- [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts)
- [`extensions/google/provider-registration.ts`](../../extensions/google/provider-registration.ts)
- [`extensions/openai/openai-provider.ts`](../../extensions/openai/openai-provider.ts)

This is where provider-specific auth modes, discovery policies, stream wrappers, replay hooks, and forward-compat model patches live. The reusable idea is not the exact vendor logic; it is the shape of a plugin-owned policy layer that sits on top of the generic provider-entry DSL.

### Browser plugin registration and service bootstrap

Classification: `glue` plus `runtime central`.

Anchors:

- [`extensions/browser/index.ts`](../../extensions/browser/index.ts)
- [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts)
- [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts)
- [`extensions/browser/src/browser-runtime.ts`](../../extensions/browser/src/browser-runtime.ts)
- [`extensions/browser/src/cli/browser-cli.ts`](../../extensions/browser/src/cli/browser-cli.ts)

This subdomain turns browser automation into a plugin rather than a special-case builtin. It wires a tool, a CLI surface, a gateway method, node-host commands, and a lazily started background service into one package.

### Browser route context and gateway proxy

Classification: `runtime central` plus `adapters`.

Anchors:

- [`extensions/browser/src/browser/server-context.ts`](../../extensions/browser/src/browser/server-context.ts)
- [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts)
- [`extensions/browser/src/browser-runtime.ts`](../../extensions/browser/src/browser-runtime.ts)

This is the execution core for browser requests. It resolves profiles, enforces node-proxy versus local-dispatch policy, and maps route-level browser operations onto long-lived profile state.

### Memory host bridge and runtime capability shell

Classification: `glue` plus `infra`.

Anchors:

- [`extensions/memory-core/index.ts`](../../extensions/memory-core/index.ts)
- [`extensions/memory-core/src/runtime-provider.ts`](../../extensions/memory-core/src/runtime-provider.ts)
- [`src/memory-host-sdk/engine.ts`](../../src/memory-host-sdk/engine.ts)
- [`src/memory-host-sdk/engine-foundation.ts`](../../src/memory-host-sdk/engine-foundation.ts)

This layer is the host integration seam around memory. It does not do the indexing itself; it exports the contracts, runtime adapters, and plugin registrations that let the engine attach to OpenClaw.

### Memory hybrid index engine and embedding provider policy

Classification: `runtime central` plus `infra`.

Anchors:

- [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts)
- [`extensions/memory-core/src/memory/manager-search.ts`](../../extensions/memory-core/src/memory/manager-search.ts)
- [`extensions/memory-core/src/memory/hybrid.ts`](../../extensions/memory-core/src/memory/hybrid.ts)
- [`extensions/memory-core/src/memory/provider-adapters.ts`](../../extensions/memory-core/src/memory/provider-adapters.ts)
- [`extensions/memory-core/src/memory/manager-sync-control.ts`](../../extensions/memory-core/src/memory/manager-sync-control.ts)

This is the heavy engine in the batch. It owns SQLite/FTS/vector state, embedding-provider selection, sync scheduling, readonly recovery, and manager caching.

### Memory recall tools, flush planning, and promotion heuristics

Classification: `adapters` plus `runtime central`.

Anchors:

- [`extensions/memory-core/src/tools.ts`](../../extensions/memory-core/src/tools.ts)
- [`extensions/memory-core/src/prompt-section.ts`](../../extensions/memory-core/src/prompt-section.ts)
- [`extensions/memory-core/src/flush-plan.ts`](../../extensions/memory-core/src/flush-plan.ts)
- [`extensions/memory-core/src/short-term-promotion.ts`](../../extensions/memory-core/src/short-term-promotion.ts)
- [`extensions/memory-core/src/public-artifacts.ts`](../../extensions/memory-core/src/public-artifacts.ts)

These files translate the engine into LLM-facing or operator-facing surfaces: tools, prompt sections, compaction hints, recall promotion, and inspectable artifacts.

### Media-understanding registry and attachment runner

Classification: `runtime central` plus `adapters`.

Anchors:

- [`src/media-understanding/provider-registry.ts`](../../src/media-understanding/provider-registry.ts)
- [`src/media-understanding/resolve.ts`](../../src/media-understanding/resolve.ts)
- [`src/media-understanding/runner.entries.ts`](../../src/media-understanding/runner.entries.ts)
- [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts)

This subdomain is the media fallback orchestrator. It turns capability providers into a registry, resolves which entries apply to which attachment or capability, and then runs provider or CLI backends per attachment.

### Capability-generation registries, TTS facade, and media store

Classification: `infra` plus `glue`.

Anchors:

- [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts)
- [`src/image-generation/runtime.ts`](../../src/image-generation/runtime.ts)
- [`src/video-generation/provider-registry.ts`](../../src/video-generation/provider-registry.ts)
- [`src/tts/provider-registry.ts`](../../src/tts/provider-registry.ts)
- [`src/plugin-sdk/tts-runtime.ts`](../../src/plugin-sdk/tts-runtime.ts)
- [`src/media/store.ts`](../../src/media/store.ts)

This area contains the smaller reusable bricks in the batch: generic candidate-resolution helpers, capability registries, the TTS facade loader, and the temp media persistence layer.

## feature inventory

### Provider bundle entry aggregator

- Goal: publish several provider-owned capabilities from one plugin boundary without bloating core bootstrap code.
- Open first: [`extensions/openai/index.ts`](../../extensions/openai/index.ts), [`extensions/google/index.ts`](../../extensions/google/index.ts), [`extensions/xai/index.ts`](../../extensions/xai/index.ts)
- Pivot symbols: `buildProviderWithPromptContribution`, `createLazyGoogleImageGenerationProvider`, `createLazyGoogleMediaUnderstandingProvider`, `createLazyCodeExecutionTool`, `createLazyXSearchTool`
- Strictly required modules: batch-04 plugin entry DSL plus the capability builder modules being aggregated
- Dangerous couplings: still depends on OpenClaw plugin API method names and the host capability inventory
- Reuse strategy: `adapter`

### Single-provider auth and discovery skeleton

- Goal: keep provider-specific auth modes, discovery, forward-compat models, and stream or replay policy inside the plugin rather than in core host code.
- Open first: [`extensions/anthropic/register.runtime.ts`](../../extensions/anthropic/register.runtime.ts), [`extensions/xai/index.ts`](../../extensions/xai/index.ts), [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts)
- Pivot symbols: `registerAnthropicPlugin`, `runAnthropicSetupTokenAuth`, `runAnthropicSetupTokenNonInteractive`, `resolveAnthropicForwardCompatModel`, `resolveOllamaDiscoveryApiKey`, `hasMeaningfulExplicitOllamaConfig`
- Strictly required modules: auth-profile store, provider-entry contracts, provider catalog builders, stream/replay hooks
- Dangerous couplings: auth-store semantics, onboarding UX, and config patch shapes are host-specific
- Reuse strategy: `adapter`

### Browser plugin registration shell

- Goal: register browser automation as a normal plugin with tool, CLI, gateway, service, and node-host hooks.
- Open first: [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts), [`extensions/browser/index.ts`](../../extensions/browser/index.ts), [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts)
- Pivot symbols: `browserPluginReload`, `browserPluginNodeHostCommands`, `browserSecurityAuditCollectors`, `registerBrowserPlugin`, `createBrowserPluginService`
- Strictly required modules: plugin API registration points, browser tool factory, service bootstrap helper, gateway handler
- Dangerous couplings: assumes the host exposes node-host commands, services, and gateway method registration
- Reuse strategy: `adapter`

### Browser gateway proxy and profile context

- Goal: route browser requests either to a local control service or to a browser-capable node while preserving profile policy and proxy-file mapping.
- Open first: [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts), [`extensions/browser/src/browser/server-context.ts`](../../extensions/browser/src/browser/server-context.ts)
- Pivot symbols: `handleBrowserGatewayRequest`, `browserHandlers`, `listKnownProfileNames`, `createBrowserRouteContext`
- Strictly required modules: node-registry invoke contract, browser route dispatcher, profile runtime state, request-policy helpers
- Dangerous couplings: node session model, gateway request scope, browser-control route shape, and profile persistence all leak through this seam
- Reuse strategy: `adapter`

### Memory host bridge and runtime shell

- Goal: expose the memory engine to the host as a runtime capability plus package-exported workspace contract.
- Open first: [`extensions/memory-core/index.ts`](../../extensions/memory-core/index.ts), [`extensions/memory-core/src/runtime-provider.ts`](../../extensions/memory-core/src/runtime-provider.ts), [`src/memory-host-sdk/engine-foundation.ts`](../../src/memory-host-sdk/engine-foundation.ts)
- Pivot symbols: `memoryRuntime`, `buildMemoryFlushPlan`, `buildPromptSection`
- Strictly required modules: memory host SDK export surface, memory manager lookup, plugin runtime registration
- Dangerous couplings: the package bridge assumes the same workspace concepts, config layout, and transcript-event contract
- Reuse strategy: `adapter`

### Hybrid memory index engine

- Goal: maintain a file-backed hybrid FTS/vector memory index with embedding-provider selection, sync control, and recovery behavior.
- Open first: [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts), [`extensions/memory-core/src/memory/manager-search.ts`](../../extensions/memory-core/src/memory/manager-search.ts), [`extensions/memory-core/src/memory/hybrid.ts`](../../extensions/memory-core/src/memory/hybrid.ts)
- Pivot symbols: `MemoryIndexManager`, `closeAllMemoryIndexManagers`, `searchVector`, `searchKeyword`, `mergeHybridResults`, `runMemorySyncWithReadonlyRecovery`
- Strictly required modules: workspace contract, embedding providers, SQLite schema, watcher/session sync, status and cache state
- Dangerous couplings: this is a full subsystem, not a utility. Filesystem layout, transcripts, agent workspace identity, and embedding runtime all matter
- Reuse strategy: `adapter`

### Memory search tools and flush-plan shell

- Goal: surface memory through small agent-facing tools and compaction hints without exposing the whole engine directly.
- Open first: [`extensions/memory-core/src/tools.ts`](../../extensions/memory-core/src/tools.ts), [`extensions/memory-core/src/prompt-section.ts`](../../extensions/memory-core/src/prompt-section.ts), [`extensions/memory-core/src/flush-plan.ts`](../../extensions/memory-core/src/flush-plan.ts)
- Pivot symbols: `createMemorySearchTool`, `createMemoryGetTool`, `buildPromptSection`, `buildMemoryFlushPlan`
- Strictly required modules: memory runtime lookup, tool schemas/shared helpers, memory backend resolution
- Dangerous couplings: the tools assume the same JSON-result conventions and memory runtime contract as OpenClaw
- Reuse strategy: `adapter`

### Short-term promotion engine

- Goal: promote frequently recalled short-term memory snippets into more durable memory artifacts using score, recency, diversity, and concept signals.
- Open first: [`extensions/memory-core/src/short-term-promotion.ts`](../../extensions/memory-core/src/short-term-promotion.ts)
- Pivot symbols: `recordShortTermRecalls`, `rankShortTermPromotionCandidates`, `applyShortTermPromotions`, `auditShortTermPromotionArtifacts`, `repairShortTermPromotionArtifacts`
- Strictly required modules: workspace file storage, memory-host events, concept vocabulary helpers, recall-result shape
- Dangerous couplings: depends on OpenClaw's memory file layout and on specific promotion artifact paths under `memory/.dreams`
- Reuse strategy: `adapter`

### Media-understanding registry and runner

- Goal: assemble media providers, resolve attachment scope and fallback order, and run provider or CLI backends per capability.
- Open first: [`src/media-understanding/provider-registry.ts`](../../src/media-understanding/provider-registry.ts), [`src/media-understanding/resolve.ts`](../../src/media-understanding/resolve.ts), [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts)
- Pivot symbols: `buildMediaUnderstandingRegistry`, `getMediaUnderstandingProvider`, `resolveModelEntries`, `resolveEntriesWithActiveFallback`, `resolveScopeDecision`, `runCapability`, `resolveAutoImageModel`
- Strictly required modules: capability-provider runtime, model catalog, auth availability checks, attachment cache, provider and CLI entry runners
- Dangerous couplings: attachment metadata, message-context shape, and model catalog assumptions are threaded through the whole runner
- Reuse strategy: `adapter`

### Capability-generation runtime helpers

- Goal: share provider-candidate resolution, size or aspect normalization, and failover error shaping across capability-specific runtimes.
- Open first: [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts), [`src/image-generation/runtime.ts`](../../src/image-generation/runtime.ts), [`src/tts/provider-registry.ts`](../../src/tts/provider-registry.ts)
- Pivot symbols: `resolveCapabilityModelCandidates`, `deriveAspectRatioFromSize`, `resolveClosestAspectRatio`, `resolveClosestSize`, `resolveClosestResolution`, `throwCapabilityGenerationFailure`, `generateImage`, `listSpeechProviders`
- Strictly required modules: config model selection helpers, auth-profile lookup, capability provider registries
- Dangerous couplings: candidate resolution depends on OpenClaw model config and auth-profile storage
- Reuse strategy: `adapter`

### SSRF-aware media store

- Goal: persist inbound or generated media safely with cleanup, local-file reads, remote download limits, and path resolution.
- Open first: [`src/media/store.ts`](../../src/media/store.ts)
- Pivot symbols: `MEDIA_MAX_BYTES`, `cleanOldMedia`, `SaveMediaSourceError`, `saveMediaSource`, `saveMediaBuffer`, `resolveMediaBufferPath`, `deleteMediaBuffer`
- Strictly required modules: config-dir resolution, SSRF hostname pinning, safe local-file read helpers, mime detection
- Dangerous couplings: the storage root and file-mode policy assume OpenClaw's state-directory trust model
- Reuse strategy: `adapter`

### TTS lazy facade

- Goal: expose speech runtime APIs without making the main host import the heavy speech plugin eagerly.
- Open first: [`src/plugin-sdk/tts-runtime.ts`](../../src/plugin-sdk/tts-runtime.ts)
- Pivot symbols: `buildTtsSystemPromptHint`, `getResolvedSpeechProviderConfig`, `resolveTtsProviderOrder`, `maybeApplyTtsToPayload`, `listSpeechVoices`, `synthesizeSpeech`, `textToSpeech`, `textToSpeechTelephony`
- Strictly required modules: bundled public-surface loader and the `@openclaw/speech-core` runtime artifact naming convention
- Dangerous couplings: the facade is only safe if the target packaging model still exposes a bundled `runtime-api.js`
- Reuse strategy: `copier`

## symbol map

### Provider entries and policy layers

- [`extensions/openai/index.ts`](../../extensions/openai/index.ts): `buildProviderWithPromptContribution`
- [`extensions/openai/openai-provider.ts`](../../extensions/openai/openai-provider.ts): `buildOpenAIProvider`
- [`extensions/openai/openai-codex-provider.ts`](../../extensions/openai/openai-codex-provider.ts): `buildOpenAICodexProviderPlugin`
- [`extensions/openai/media-understanding-provider.ts`](../../extensions/openai/media-understanding-provider.ts): `transcribeOpenAiAudio`, `openaiMediaUnderstandingProvider`, `openaiCodexMediaUnderstandingProvider`
- [`extensions/openai/speech-provider.ts`](../../extensions/openai/speech-provider.ts): `buildOpenAISpeechProvider`
- [`extensions/openai/realtime-voice-provider.ts`](../../extensions/openai/realtime-voice-provider.ts): `buildOpenAIRealtimeVoiceProvider`
- [`extensions/openai/realtime-transcription-provider.ts`](../../extensions/openai/realtime-transcription-provider.ts): `buildOpenAIRealtimeTranscriptionProvider`
- [`extensions/google/index.ts`](../../extensions/google/index.ts): `createLazyGoogleImageGenerationProvider`, `createLazyGoogleMediaUnderstandingProvider`, `loadGoogleRequiredMediaUnderstandingProvider`
- [`extensions/google/provider-registration.ts`](../../extensions/google/provider-registration.ts): `registerGoogleProvider`
- [`extensions/google/gemini-cli-provider.ts`](../../extensions/google/gemini-cli-provider.ts): `registerGoogleGeminiCliProvider`
- [`extensions/anthropic/register.runtime.ts`](../../extensions/anthropic/register.runtime.ts): `registerAnthropicPlugin`, `runAnthropicSetupTokenAuth`, `runAnthropicSetupTokenNonInteractive`, `resolveAnthropicForwardCompatModel`
- [`extensions/xai/index.ts`](../../extensions/xai/index.ts): `createLazyCodeExecutionTool`, `createLazyXSearchTool`
- [`extensions/xai/provider-catalog.ts`](../../extensions/xai/provider-catalog.ts): `buildXaiProvider`
- [`extensions/xai/web-search.ts`](../../extensions/xai/web-search.ts): `createXaiWebSearchProvider`
- [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts): `resolveOllamaDiscoveryApiKey`, `shouldSkipAmbientOllamaDiscovery`, `hasMeaningfulExplicitOllamaConfig`
- [`extensions/ollama/src/setup.ts`](../../extensions/ollama/src/setup.ts): `buildOllamaProvider`

### Browser plugin and routing surfaces

- [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts): `browserPluginReload`, `browserPluginNodeHostCommands`, `browserSecurityAuditCollectors`, `registerBrowserPlugin`
- [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts): `createBrowserPluginService`
- [`extensions/browser/src/browser-runtime.ts`](../../extensions/browser/src/browser-runtime.ts): `startBrowserBridgeServer`, `stopBrowserBridgeServer`, `createBrowserControlContext`, `startBrowserControlServiceFromConfig`, `stopBrowserControlService`, `createBrowserRuntimeState`, `stopBrowserRuntime`, `createBrowserRouteDispatcher`, `registerBrowserRoutes`, `runBrowserProxyCommand`
- [`extensions/browser/src/browser/server-context.ts`](../../extensions/browser/src/browser/server-context.ts): `listKnownProfileNames`, `createBrowserRouteContext`
- [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts): `handleBrowserGatewayRequest`, `browserHandlers`
- [`extensions/browser/src/cli/browser-cli.ts`](../../extensions/browser/src/cli/browser-cli.ts): `registerBrowserCli`

### Memory engine, runtime, and tool surfaces

- [`extensions/memory-core/index.ts`](../../extensions/memory-core/index.ts): `buildMemoryFlushPlan`, `DEFAULT_MEMORY_FLUSH_SOFT_TOKENS`, `DEFAULT_MEMORY_FLUSH_FORCE_TRANSCRIPT_BYTES`, `DEFAULT_MEMORY_FLUSH_PROMPT`, `buildPromptSection`
- [`extensions/memory-core/src/runtime-provider.ts`](../../extensions/memory-core/src/runtime-provider.ts): `memoryRuntime`
- [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts): `closeAllMemoryIndexManagers`, `MemoryIndexManager`
- [`extensions/memory-core/src/memory/index.ts`](../../extensions/memory-core/src/memory/index.ts): `getMemorySearchManager`, `closeAllMemorySearchManagers`
- [`extensions/memory-core/src/memory/manager-search.ts`](../../extensions/memory-core/src/memory/manager-search.ts): `searchVector`, `searchKeyword`, `listChunks`
- [`extensions/memory-core/src/memory/hybrid.ts`](../../extensions/memory-core/src/memory/hybrid.ts): `buildFtsQuery`, `bm25RankToScore`, `mergeHybridResults`
- [`extensions/memory-core/src/memory/provider-adapters.ts`](../../extensions/memory-core/src/memory/provider-adapters.ts): `builtinMemoryEmbeddingProviderAdapters`, `getBuiltinMemoryEmbeddingProviderAdapter`, `registerBuiltInMemoryEmbeddingProviders`, `listBuiltinAutoSelectMemoryEmbeddingProviderDoctorMetadata`
- [`extensions/memory-core/src/memory/manager-sync-control.ts`](../../extensions/memory-core/src/memory/manager-sync-control.ts): `isMemoryReadonlyDbError`, `extractMemoryErrorReason`, `runMemorySyncWithReadonlyRecovery`, `enqueueMemoryTargetedSessionSync`
- [`extensions/memory-core/src/tools.ts`](../../extensions/memory-core/src/tools.ts): `createMemorySearchTool`, `createMemoryGetTool`
- [`extensions/memory-core/src/short-term-promotion.ts`](../../extensions/memory-core/src/short-term-promotion.ts): `recordShortTermRecalls`, `rankShortTermPromotionCandidates`, `applyShortTermPromotions`, `auditShortTermPromotionArtifacts`, `repairShortTermPromotionArtifacts`
- [`extensions/memory-core/src/public-artifacts.ts`](../../extensions/memory-core/src/public-artifacts.ts): `listMemoryCorePublicArtifacts`
- [`src/memory-host-sdk/engine-foundation.ts`](../../src/memory-host-sdk/engine-foundation.ts): `resolveAgentDir`, `resolveAgentWorkspaceDir`, `resolveMemorySearchConfig`, `resolveSessionTranscriptsDirForAgent`, `onSessionTranscriptUpdate`, `runTasksWithConcurrency`

### Media-understanding, generation, and storage surfaces

- [`src/media-understanding/provider-registry.ts`](../../src/media-understanding/provider-registry.ts): `buildMediaUnderstandingRegistry`, `getMediaUnderstandingProvider`, `normalizeMediaProviderId`
- [`src/media-understanding/resolve.ts`](../../src/media-understanding/resolve.ts): `resolveTimeoutMs`, `resolvePrompt`, `resolveMaxChars`, `resolveMaxBytes`, `resolveScopeDecision`, `resolveModelEntries`, `resolveEntriesWithActiveFallback`, `resolveConcurrency`
- [`src/media-understanding/runner.entries.ts`](../../src/media-understanding/runner.entries.ts): `buildModelDecision`, `formatDecisionSummary`, `runProviderEntry`, `runCliEntry`
- [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts): `buildProviderRegistry`, `resolveMediaAttachmentLocalRoots`, `clearMediaUnderstandingBinaryCacheForTests`, `resolveAutoImageModel`, `runCapability`
- [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts): `resolveCapabilityModelCandidates`, `deriveAspectRatioFromSize`, `resolveClosestAspectRatio`, `resolveClosestSize`, `resolveClosestResolution`, `throwCapabilityGenerationFailure`, `buildNoCapabilityModelConfiguredMessage`
- [`src/image-generation/provider-registry.ts`](../../src/image-generation/provider-registry.ts): `listImageGenerationProviders`, `getImageGenerationProvider`
- [`src/image-generation/runtime.ts`](../../src/image-generation/runtime.ts): `listRuntimeImageGenerationProviders`, `generateImage`
- [`src/video-generation/provider-registry.ts`](../../src/video-generation/provider-registry.ts): `listVideoGenerationProviders`, `getVideoGenerationProvider`
- [`src/tts/provider-registry.ts`](../../src/tts/provider-registry.ts): `normalizeSpeechProviderId`, `listSpeechProviders`, `getSpeechProvider`, `canonicalizeSpeechProviderId`
- [`src/tts/tts-core.ts`](../../src/tts/tts-core.ts): `summarizeText`, `scheduleCleanup`
- [`src/plugin-sdk/tts-runtime.ts`](../../src/plugin-sdk/tts-runtime.ts): `buildTtsSystemPromptHint`, `getResolvedSpeechProviderConfig`, `resolveTtsProviderOrder`, `maybeApplyTtsToPayload`, `listSpeechVoices`, `synthesizeSpeech`, `textToSpeech`, `textToSpeechTelephony`
- [`src/media/store.ts`](../../src/media/store.ts): `MEDIA_MAX_BYTES`, `setMediaStoreNetworkDepsForTest`, `extractOriginalFilename`, `getMediaDir`, `ensureMediaDir`, `cleanOldMedia`, `SaveMediaSourceError`, `saveMediaSource`, `saveMediaBuffer`, `resolveMediaBufferPath`, `deleteMediaBuffer`

## dependency map

### Internal dependencies you must carry together

- Provider entry aggregators depend on the batch-04 plugin entry DSL plus the capability builder modules they register. Copying only `index.ts` without the `build*Provider` modules buys very little.
- Browser plugin registration depends on the browser tool, service loader, CLI registration, and gateway handler together. The registration shell is small, but it is only meaningful if those host hooks exist.
- Browser gateway proxy depends on the node-registry invoke contract, browser route dispatcher, profile resolution, and proxy-file persistence helpers.
- Memory runtime shells depend on the memory host SDK contracts and on `getMemorySearchManager`. The engine itself depends on transcript events, workspace resolution, embedding providers, SQLite schema, and watcher lifecycle.
- Media-understanding depends on plugin capability-provider resolution, model-catalog lookups, auth availability, attachment cache policy, and provider or CLI entry runners.
- Capability-generation runtimes depend on shared candidate resolution in [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts) plus capability-specific provider registries.
- The TTS facade depends on the bundled public-surface loader conventions from [`src/plugin-sdk/facade-runtime.ts`](../../src/plugin-sdk/facade-runtime.ts).

### External dependencies

- Provider-specific SDKs and vendor HTTP APIs are hard dependencies for the concrete provider builders under `extensions/openai`, `extensions/google`, `extensions/anthropic`, `extensions/xai`, and `extensions/ollama`.
- Browser runtime depends on browser-control modules and on the browser-node-runtime lazy service loader.
- Memory engine depends on `chokidar`, `node:sqlite`, and optional local embedding dependencies such as `node-llama-cpp`.
- Media store depends on the host network stack and SSRF policy helpers.

### Runtime and singleton assumptions

- Browser control service state is lazy, process-global, and env-overridable in [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts).
- Memory manager caching is process-global via `Symbol.for("openclaw.memoryIndexManagerCache")` in [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts).
- Media-understanding binary lookup caches are process-local in [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts).
- Media store writes into the OpenClaw config directory and intentionally leaves files world-readable inside a trusted parent directory for sandbox access in [`src/media/store.ts`](../../src/media/store.ts).

### Glue you can rewrite

- Provider-entry aggregation in extension `index.ts` files is mostly host glue. Rewrite it freely if your host exposes different registration calls.
- Browser CLI descriptors, gateway method names, and service IDs are host-surface glue rather than core browser-execution primitives.
- Memory public-artifact listing, prompt-section formatting, and flush-plan prompt text are product-layer surfaces and can be rewritten without changing the index engine.
- The TTS facade loader can be replaced entirely if your target host does not ship bundled public-surface artifacts.

## extraction recipes

### Recipe A - extract a provider bundle entry shell

- Carry: one extension entry such as [`extensions/google/index.ts`](../../extensions/google/index.ts) or [`extensions/openai/index.ts`](../../extensions/openai/index.ts), plus the exact `build*Provider` modules it registers
- Keep together: the entry `register(api)` function and the local helper wrappers such as `createLazyGoogleImageGenerationProvider`
- Replace with shims: your host plugin API type and any capability names that differ
- Best use: hosts that already support several capability registries and want one plugin to publish many surfaces
- Strategy: `adapter`

### Recipe B - extract the browser plugin registration shell

- Carry: [`extensions/browser/index.ts`](../../extensions/browser/index.ts), [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts), [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts)
- Keep together: `browserPluginReload`, `browserPluginNodeHostCommands`, `browserSecurityAuditCollectors`, `registerBrowserPlugin`, `createBrowserPluginService`
- Replace with shims: tool registration, gateway-method registration, and service lifecycle hooks for the target host
- Best use: agent hosts that want browser automation to behave like a plugin instead of a builtin
- Strategy: `adapter`

### Recipe C - extract the browser request proxy layer

- Carry: [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts), [`extensions/browser/src/browser/server-context.ts`](../../extensions/browser/src/browser/server-context.ts)
- Keep together: `handleBrowserGatewayRequest`, `createBrowserRouteContext`, profile-resolution helpers, and proxy-file mapping
- Replace with shims: your node-registry invoke API, your route dispatcher, and your browser-profile persistence contract
- Best use: systems that already have a browser control service and need a clean remote-or-local dispatch layer
- Strategy: `adapter`

### Recipe D - extract the memory runtime and tool shell

- Carry: [`extensions/memory-core/index.ts`](../../extensions/memory-core/index.ts), [`extensions/memory-core/src/runtime-provider.ts`](../../extensions/memory-core/src/runtime-provider.ts), [`extensions/memory-core/src/tools.ts`](../../extensions/memory-core/src/tools.ts), [`extensions/memory-core/src/prompt-section.ts`](../../extensions/memory-core/src/prompt-section.ts), [`extensions/memory-core/src/flush-plan.ts`](../../extensions/memory-core/src/flush-plan.ts)
- Keep together: `memoryRuntime`, `createMemorySearchTool`, `createMemoryGetTool`, `buildPromptSection`, `buildMemoryFlushPlan`
- Replace with shims: the runtime lookup contract and the JSON-result or tool-schema conventions of the target host
- Best use: hosts that want memory search exposed to agents before deciding whether to transplant the full engine
- Strategy: `adapter`

### Recipe E - extract the hybrid search kernel before the full manager

- Carry: [`extensions/memory-core/src/memory/hybrid.ts`](../../extensions/memory-core/src/memory/hybrid.ts), [`extensions/memory-core/src/memory/manager-search.ts`](../../extensions/memory-core/src/memory/manager-search.ts)
- Keep together: `buildFtsQuery`, `bm25RankToScore`, `mergeHybridResults`, `searchVector`, `searchKeyword`
- Replace with shims: your DB handle, chunk schema, and embedding backend
- Best use: projects that want hybrid ranking logic without inheriting OpenClaw's watcher and sync machinery
- Strategy: `adapter`

### Recipe F - extract short-term recall promotion

- Carry: [`extensions/memory-core/src/short-term-promotion.ts`](../../extensions/memory-core/src/short-term-promotion.ts)
- Keep together: `recordShortTermRecalls`, `rankShortTermPromotionCandidates`, `applyShortTermPromotions`
- Replace with shims: your memory-path conventions and event sink for promotion telemetry
- Best use: memory-backed assistants that want promotion heuristics separate from the index engine
- Strategy: `adapter`

### Recipe G - extract capability-generation runtime helpers

- Carry: [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts), plus one concrete consumer such as [`src/image-generation/runtime.ts`](../../src/image-generation/runtime.ts)
- Keep together: `resolveCapabilityModelCandidates`, normalization helpers, and the capability-specific provider lookup
- Replace with shims: your model-config representation and auth-profile lookup
- Best use: hosts that expose several generation capabilities and want one shared fallback policy
- Strategy: `adapter`

### Recipe H - extract the media store

- Carry: [`src/media/store.ts`](../../src/media/store.ts)
- Keep together: `cleanOldMedia`, `saveMediaSource`, `saveMediaBuffer`, `resolveMediaBufferPath`, `deleteMediaBuffer`
- Replace with shims: config-dir resolution, SSRF policy, and any file-permission model that differs
- Best use: chat or automation hosts that need bounded temp media persistence quickly
- Strategy: `adapter`

## do not copy blindly

- [`extensions/memory-core/src/memory/manager.ts`](../../extensions/memory-core/src/memory/manager.ts) is not a safe blind-copy target. It encodes workspace paths, transcript listeners, DB schema, watcher policy, provider fallback, and manager caching together.
- [`extensions/browser/src/gateway/browser-request.ts`](../../extensions/browser/src/gateway/browser-request.ts) should not be copied unless your host already has comparable node-registry, gateway, and browser-control route contracts.
- [`src/media-understanding/runner.ts`](../../src/media-understanding/runner.ts) looks generic, but it assumes OpenClaw message context, attachment metadata, auth resolution, and model-catalog behavior.
- Provider-specific auth layers such as [`extensions/anthropic/register.runtime.ts`](../../extensions/anthropic/register.runtime.ts) and discovery layers such as [`extensions/ollama/index.ts`](../../extensions/ollama/index.ts) are tightly tied to OpenClaw auth-profile storage and setup UX.
- [`src/plugin-sdk/tts-runtime.ts`](../../src/plugin-sdk/tts-runtime.ts) only makes sense if your packaging model still ships `@openclaw/speech-core/runtime-api.js`.

## minimal reusable slices

### Slice: capability-generation runtime shared

- Paths: [`src/media-generation/runtime-shared.ts`](../../src/media-generation/runtime-shared.ts), [`src/image-generation/runtime.ts`](../../src/image-generation/runtime.ts)
- Central symbols: `resolveCapabilityModelCandidates`, `throwCapabilityGenerationFailure`, `generateImage`
- Why minimal: this is the smallest cross-capability fallback and normalization seam in the batch
- Strategy: `adapter`

### Slice: SSRF-aware media store

- Paths: [`src/media/store.ts`](../../src/media/store.ts)
- Central symbols: `cleanOldMedia`, `saveMediaSource`, `saveMediaBuffer`, `resolveMediaBufferPath`
- Why minimal: useful even without the rest of the media-understanding stack
- Strategy: `adapter`

### Slice: browser plugin registration shell

- Paths: [`extensions/browser/plugin-registration.ts`](../../extensions/browser/plugin-registration.ts), [`extensions/browser/src/plugin-service.ts`](../../extensions/browser/src/plugin-service.ts)
- Central symbols: `registerBrowserPlugin`, `createBrowserPluginService`
- Why minimal: captures the pluginization pattern without dragging in all browser route logic
- Strategy: `adapter`

### Slice: memory search tool shell

- Paths: [`extensions/memory-core/src/tools.ts`](../../extensions/memory-core/src/tools.ts), [`extensions/memory-core/src/prompt-section.ts`](../../extensions/memory-core/src/prompt-section.ts), [`extensions/memory-core/src/flush-plan.ts`](../../extensions/memory-core/src/flush-plan.ts)
- Central symbols: `createMemorySearchTool`, `createMemoryGetTool`, `buildPromptSection`, `buildMemoryFlushPlan`
- Why minimal: exposes memory to agents before committing to full engine extraction
- Strategy: `adapter`

### Slice: short-term promotion engine

- Paths: [`extensions/memory-core/src/short-term-promotion.ts`](../../extensions/memory-core/src/short-term-promotion.ts)
- Central symbols: `recordShortTermRecalls`, `rankShortTermPromotionCandidates`, `applyShortTermPromotions`
- Why minimal: bounded heuristic subsystem with clear file-based inputs and outputs
- Strategy: `adapter`

### Slice: TTS lazy facade

- Paths: [`src/plugin-sdk/tts-runtime.ts`](../../src/plugin-sdk/tts-runtime.ts)
- Central symbols: `resolveTtsProviderOrder`, `listSpeechVoices`, `synthesizeSpeech`, `textToSpeech`
- Why minimal: small manual facade with clear packaging assumptions
- Strategy: `copier`

## exact search shortcuts

- `rg "definePluginEntry|defineSingleProviderPluginEntry|registerProvider|registerImageGenerationProvider|registerMediaUnderstandingProvider|registerSpeechProvider|registerWebSearchProvider" extensions/openai extensions/google extensions/anthropic extensions/xai extensions/ollama`
- `rg "registerAnthropicPlugin|runAnthropicSetupTokenAuth|resolveAnthropicForwardCompatModel|resolveOllamaDiscoveryApiKey|createLazyCodeExecutionTool|createLazyXSearchTool" extensions/anthropic extensions/ollama extensions/xai`
- `rg "registerBrowserPlugin|createBrowserPluginService|handleBrowserGatewayRequest|createBrowserRouteContext|registerBrowserCli" extensions/browser`
- `rg "MemoryIndexManager|searchVector|searchKeyword|mergeHybridResults|registerBuiltInMemoryEmbeddingProviders|runMemorySyncWithReadonlyRecovery" extensions/memory-core/src/memory`
- `rg "createMemorySearchTool|createMemoryGetTool|buildMemoryFlushPlan|buildPromptSection|recordShortTermRecalls|applyShortTermPromotions" extensions/memory-core/src`
- `rg "buildMediaUnderstandingRegistry|resolveModelEntries|resolveEntriesWithActiveFallback|runProviderEntry|runCliEntry|runCapability|resolveAutoImageModel" src/media-understanding`
- `rg "resolveCapabilityModelCandidates|throwCapabilityGenerationFailure|listImageGenerationProviders|getImageGenerationProvider|listSpeechProviders|getSpeechProvider" src/media-generation src/image-generation src/video-generation src/tts`
- `rg "saveMediaSource|saveMediaBuffer|resolveMediaBufferPath|deleteMediaBuffer|cleanOldMedia" src/media/store.ts`
