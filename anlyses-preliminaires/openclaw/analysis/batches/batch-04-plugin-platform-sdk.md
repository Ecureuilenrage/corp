# Batch 04 - Plugin Platform and SDK

Scope: `875` files. Main concentration: [`src/plugin-sdk/`](../../src/plugin-sdk), [`src/plugins/`](../../src/plugins), [`packages/plugin-sdk/`](../../packages/plugin-sdk), [`packages/memory-host-sdk/`](../../packages/memory-host-sdk), plus a thin shared layer in [`extensions/shared/`](../../extensions/shared).

## purpose

This batch defines the real extension boundary of OpenClaw. It owns the public plugin entry DSL, provider onboarding helpers, bundled channel entry loader, plugin registration API, runtime injection surface, and the package-export bridges that let extension authors consume the same contracts from `openclaw/plugin-sdk`, `@openclaw/plugin-sdk`, and `@openclaw/memory-host-sdk`.

This is one of the best extraction zones in the repo, but only if you separate the author-facing seams from the host-specific registry/runtime glue. The smallest reusable parts are not the huge registries; they are the entry builders, capture harnesses, and package bridge patterns around them.

## entrypoints

- [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts): canonical entry helper for generic plugins.
- [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts): single-provider entry DSL with auth/catalog wiring.
- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts): bundled channel entry + setup loader with source fallback.
- [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts): injected runtime facade exposed to plugins.
- [`src/plugins/runtime/runtime-registry-loader.ts`](../../src/plugins/runtime/runtime-registry-loader.ts): bootstrap gate that ensures the plugin registry is loaded at the required scope.
- [`packages/plugin-sdk/src/plugin-entry.ts`](../../packages/plugin-sdk/src/plugin-entry.ts): package bridge into the canonical source tree.
- [`packages/memory-host-sdk/src/engine.ts`](../../packages/memory-host-sdk/src/engine.ts): package bridge into the memory-host implementation that lives outside this batch.

## key files

- [`src/plugins/types.ts`](../../src/plugins/types.ts): main contract hub for `OpenClawPluginApi`, `OpenClawPluginDefinition`, `ProviderPlugin`, and the provider/runtime type graph.
- [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts): builds the registration surface that plugins receive.
- [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts): lightweight capture harness for testing and contract validation.
- [`src/plugins/registry.ts`](../../src/plugins/registry.ts): full registration sink and runtime registry assembly.
- [`src/plugins/loader.ts`](../../src/plugins/loader.ts): module loading, aliasing, activation, and runtime creation glue.
- [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts): process-global registry state and pinning logic.
- [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts): alias resolution between `src/`, `dist/`, and package subpaths.
- [`src/plugins/runtime/runtime-plugin-boundary.ts`](../../src/plugins/runtime/runtime-plugin-boundary.ts): loads plugin-owned runtime sidecars safely through manifest metadata.
- [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts): turns Zod-like config schemas into runtime-safe parse/json-schema objects.
- [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts): minimal cached-lazy helper used by the entry DSL.

## data flow

- Extension authors import helpers from [`packages/plugin-sdk/src/`](../../packages/plugin-sdk/src), which mainly re-export canonical implementations from [`src/plugin-sdk/`](../../src/plugin-sdk).
- Entry modules normalize themselves through [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts), or [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts).
- The loader path in [`src/plugins/loader.ts`](../../src/plugins/loader.ts) resolves manifests, plugin roots, alias maps, and runtime factories, then builds a registration API via [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts).
- Plugin registrations are accumulated into the runtime registry in [`src/plugins/registry.ts`](../../src/plugins/registry.ts) and tracked globally through [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts).
- When plugin code needs host functionality, [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts) injects a late-bound runtime surface with lazy accessors for config, tasks, channels, media, auth, and optional gateway-bound subagent methods.
- Bundled channel plugins add an extra boundary: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts) can fall back from `dist/extensions/*` to `extensions/*` source trees, while still enforcing plugin-root boundary checks.
- Contract tests under [`src/plugins/contracts/`](../../src/plugins/contracts) keep the public SDK, package subpaths, and bundled-entry boundaries from drifting silently.

## external deps

- `jiti` in [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`src/plugins/loader.ts`](../../src/plugins/loader.ts), and [`src/plugins/runtime/runtime-plugin-boundary.ts`](../../src/plugins/runtime/runtime-plugin-boundary.ts) for mixed `src`/`dist` loading.
- `zod` in [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts) for schema parsing and JSON-schema export.
- Node builtins `fs`, `path`, `module`, `url`, and `crypto` across the loaders, boundary checks, and alias resolution paths.
- Package export maps in [`package.json`](../../package.json), [`packages/plugin-sdk/package.json`](../../packages/plugin-sdk/package.json), and [`packages/memory-host-sdk/package.json`](../../packages/memory-host-sdk/package.json).

## flags/env

- `OPENCLAW_DISABLE_BUNDLED_ENTRY_SOURCE_FALLBACK` is handled directly by [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts) and disables the fallback from built channel entries to source trees.
- `NODE_ENV` changes `src` vs `dist` alias preference in [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts) through `resolvePluginSdkAliasCandidateOrder(...)`.
- `process.argv[1]`, `cwd`, and `moduleUrl` are used as implicit loader inputs by [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts) and [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts); copying those files without preserving equivalent package-root detection changes runtime behavior.
- Explicit `env` overrides passed into [`src/plugins/runtime/load-context.ts`](../../src/plugins/runtime/load-context.ts) affect plugin auto-enable and channel/plugin resolution during registry boot.

## subdomains

### Entry DSL and schema normalization (`runtime central`)

Anchors: [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts), [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts), [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts), [`src/plugins/types.ts`](../../src/plugins/types.ts)

This is the smallest author-facing seam in the batch. It turns a plugin author's `id / name / description / configSchema / register(...)` declaration into a stable entry object, and it adds optional provider-specific auth/catalog scaffolding on top.

### Bundled channel entry boundary (`adapters`)

Anchors: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts), [`src/plugin-sdk/root-alias.cjs`](../../src/plugin-sdk/root-alias.cjs), [`extensions/discord/index.ts`](../../extensions/discord/index.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts)

This layer exists specifically for bundled channel plugins. It resolves runtime/setup sidecars, enforces plugin-root boundaries, and keeps bundled entries working both from built artifacts and from source checkouts.

### Registration API and capture harness (`runtime central`)

Anchors: [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts), [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts), [`src/plugins/registry.ts`](../../src/plugins/registry.ts), [`src/plugin-sdk/testing.ts`](../../src/plugin-sdk/testing.ts)

This is the writable center of plugin registration. `api-builder.ts` creates the registration surface, `captured-registration.ts` records declarations without spinning up the full host, and `registry.ts` is the full host-owned sink for tools, hooks, channels, providers, services, HTTP routes, and memory capabilities.

### Runtime facade and registry bootstrap (`glue`)

Anchors: [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts), [`src/plugins/runtime/load-context.ts`](../../src/plugins/runtime/load-context.ts), [`src/plugins/runtime/runtime-registry-loader.ts`](../../src/plugins/runtime/runtime-registry-loader.ts), [`src/plugins/runtime/runtime-plugin-boundary.ts`](../../src/plugins/runtime/runtime-plugin-boundary.ts), [`src/plugins/loader.ts`](../../src/plugins/loader.ts), [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts)

This layer connects plugin code back to the host. It creates the injected runtime surface, loads plugin-owned runtime sidecars, and keeps a process-global registry snapshot pinned or swapped depending on gateway/bootstrap scope.

### Package export bridges (`infra`)

Anchors: [`packages/plugin-sdk/package.json`](../../packages/plugin-sdk/package.json), [`packages/plugin-sdk/src/plugin-entry.ts`](../../packages/plugin-sdk/src/plugin-entry.ts), [`packages/plugin-sdk/src/testing.ts`](../../packages/plugin-sdk/src/testing.ts), [`packages/plugin-sdk/src/runtime-doctor.ts`](../../packages/plugin-sdk/src/runtime-doctor.ts), [`packages/plugin-sdk/src/text-runtime.ts`](../../packages/plugin-sdk/src/text-runtime.ts)

Most files here are intentionally boring one-line export bridges into [`src/plugin-sdk/`](../../src/plugin-sdk), but they are the reason the SDK feels stable to extension authors. `runtime-doctor.ts` and `text-runtime.ts` are the notable exceptions: they publish curated, narrower surfaces instead of blind re-exports.

### Memory-host SDK package bridge (`infra`)

Anchors: [`packages/memory-host-sdk/package.json`](../../packages/memory-host-sdk/package.json), [`packages/memory-host-sdk/src/engine.ts`](../../packages/memory-host-sdk/src/engine.ts), [`packages/memory-host-sdk/src/engine-foundation.ts`](../../packages/memory-host-sdk/src/engine-foundation.ts), [`src/memory-host-sdk/engine.ts`](../../src/memory-host-sdk/engine.ts)

In this batch, `packages/memory-host-sdk` is only the packaging shell. The actual host-engine implementation is outside this batch under [`src/memory-host-sdk/`](../../src/memory-host-sdk) and must be analyzed with batch 07 before treating it as an independent extraction.

## feature inventory

### Generic plugin entry DSL

- Type: `runtime central`
- Purpose: normalize plugin entry declarations and defer config-schema resolution until actually read.
- Open first: [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts), [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts), [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Central symbols: `definePluginEntry`, `createCachedLazyValueGetter`, `buildPluginConfigSchema`, `emptyPluginConfigSchema`, `OpenClawPluginDefinition`, `OpenClawPluginApi`
- Strictly required modules: [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts), [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts), a local replacement for the subset of [`src/plugins/types.ts`](../../src/plugins/types.ts) that defines plugin contracts
- Blocking couplings: [`src/plugins/types.ts`](../../src/plugins/types.ts) pulls in agent auth, gateway handlers, channel contracts, config types, speech/media providers, and runtime types far beyond the minimal DSL
- Smallest viable extraction: copy the entry builder + lazy helper, then rewrite the imported contract types to your host's own plugin API instead of dragging the whole OpenClaw type hub
- Strategy: `adapter`

### Single-provider plugin entry DSL

- Type: `runtime central`
- Purpose: register one provider with consistent auth methods, env-var discovery, onboarding wizard metadata, and model catalog generation
- Open first: [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts), [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts), [`src/plugins/provider-api-key-auth.ts`](../../src/plugins/provider-api-key-auth.ts), [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Central symbols: `defineSingleProviderPluginEntry`, `resolveWizardSetup`, `resolveEnvVars`, `createProviderApiKeyAuthMethod`, `buildSingleProviderApiKeyCatalog`
- Strictly required modules: [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts), [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts), [`src/plugins/provider-api-key-auth.ts`](../../src/plugins/provider-api-key-auth.ts), provider-related types from [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Blocking couplings: auth flows assume OpenClaw auth-profile storage, onboarding prompt semantics, and config patch conventions; the catalog helpers also assume OpenClaw model/provider config shapes
- Smallest viable extraction: keep the declaration ergonomics and the env-var aggregation pattern, but replace auth-profile writes and catalog DTOs with host-local equivalents
- Strategy: `adapter`

### Bundled channel entry loader with source fallback

- Type: `adapters`
- Purpose: load bundled channel modules, optional setup sidecars, secrets sidecars, and runtime setters from either built output or source trees while enforcing plugin-root boundaries
- Open first: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts), [`src/plugin-sdk/root-alias.cjs`](../../src/plugin-sdk/root-alias.cjs), [`extensions/discord/index.ts`](../../extensions/discord/index.ts)
- Central symbols: `defineBundledChannelEntry`, `defineBundledChannelSetupEntry`, `loadBundledEntryExportSync`, `resolveBundledEntryModuleCandidates`, `resolveLoaderPackageRoot`, `resolvePluginSdkScopedAliasMap`
- Strictly required modules: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts), [`src/infra/boundary-file-read.ts`](../../src/infra/boundary-file-read.ts), channel plugin contract types, and the loader alias shim in [`src/plugin-sdk/root-alias.cjs`](../../src/plugin-sdk/root-alias.cjs)
- Blocking couplings: assumes OpenClaw package-root detection, `dist/extensions/<plugin>` layout, the `openclaw/plugin-sdk` alias map, and the channel plugin runtime contract
- Smallest viable extraction: keep the boundary-safe dynamic loader algorithm, but replace package-root detection and alias wiring with your own repo layout rules
- Strategy: `adapter`

### Registration capture harness

- Type: `runtime central`
- Purpose: validate and unit-test plugin declarations without booting the full host registry or gateway
- Open first: [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts), [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts), [`src/plugin-sdk/testing.ts`](../../src/plugin-sdk/testing.ts)
- Central symbols: `buildPluginApi`, `createCapturedPluginRegistration`, `capturePluginRegistration`
- Strictly required modules: [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts), [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts), the subset of plugin contract types needed for providers/tools/CLI registration
- Blocking couplings: the stock implementation depends on the large `OpenClawPluginApi` surface, but the capture logic itself is intentionally narrow and easy to trim
- Smallest viable extraction: copy `api-builder.ts` and `captured-registration.ts`, then delete unsupported handlers from the local API type instead of bringing the entire OpenClaw registration matrix
- Strategy: `copier`

### Plugin runtime facade and scoped registry bootstrap

- Type: `glue`
- Purpose: expose trusted host runtime capabilities to plugins and ensure the registry is loaded at the correct scope before code uses channel/provider/plugin surfaces
- Open first: [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts), [`src/plugins/runtime/runtime-registry-loader.ts`](../../src/plugins/runtime/runtime-registry-loader.ts), [`src/plugins/runtime/runtime-plugin-boundary.ts`](../../src/plugins/runtime/runtime-plugin-boundary.ts), [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts), [`src/plugins/loader.ts`](../../src/plugins/loader.ts)
- Central symbols: `createPluginRuntime`, `setGatewaySubagentRuntime`, `clearGatewaySubagentRuntime`, `ensurePluginRegistryLoaded`, `resolvePluginRuntimeLoadContext`, `createCachedPluginBoundaryModuleLoader`, `setActivePluginRegistry`, `getActivePluginRegistry`
- Strictly required modules: [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts), its lazy-runtime dependencies, [`src/plugins/runtime/load-context.ts`](../../src/plugins/runtime/load-context.ts), [`src/plugins/runtime/runtime-registry-loader.ts`](../../src/plugins/runtime/runtime-registry-loader.ts), [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts), and [`src/plugins/loader.ts`](../../src/plugins/loader.ts)
- Blocking couplings: the runtime surface reaches deep into config, media, events, tasks, gateway subagents, web search, and plugin registry state; the process-global singleton behavior is also OpenClaw-specific
- Smallest viable extraction: do not copy the whole runtime facade unless you already want an OpenClaw-like host; instead, lift the late-binding patterns and rebuild a smaller host runtime around your own services
- Strategy: `reecrire`

### Package export bridge pattern

- Type: `infra`
- Purpose: publish a curated SDK package that points at canonical source files while keeping author-facing imports stable
- Open first: [`packages/plugin-sdk/package.json`](../../packages/plugin-sdk/package.json), [`packages/plugin-sdk/src/plugin-entry.ts`](../../packages/plugin-sdk/src/plugin-entry.ts), [`packages/plugin-sdk/src/runtime-doctor.ts`](../../packages/plugin-sdk/src/runtime-doctor.ts), [`packages/plugin-sdk/src/text-runtime.ts`](../../packages/plugin-sdk/src/text-runtime.ts)
- Central symbols: package `exports`, one-line `export * from "../../../src/..."` bridges, curated bridges in `runtime-doctor.ts` and `text-runtime.ts`
- Strictly required modules: [`packages/plugin-sdk/package.json`](../../packages/plugin-sdk/package.json), representative bridge files under [`packages/plugin-sdk/src/`](../../packages/plugin-sdk/src), and the canonical implementation files they target
- Blocking couplings: relative bridge paths assume the package sits inside the same monorepo as the canonical `src/` tree; if you move the package, every bridge breaks
- Smallest viable extraction: keep the pattern, not necessarily the exact file layout; one bridge package per stable public surface is enough
- Strategy: `copier`

## symbol map

### Entry builders

- `definePluginEntry` in [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts)
- `defineSingleProviderPluginEntry` in [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts)
- `defineBundledChannelEntry` and `defineBundledChannelSetupEntry` in [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts)

### Schema and lazy helpers

- `createCachedLazyValueGetter` in [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts)
- `buildPluginConfigSchema` and `emptyPluginConfigSchema` in [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts)
- `readConfiguredProviderCatalogEntries`, `supportsNativeStreamingUsageCompat`, and `applyProviderNativeStreamingUsageCompat` in [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts)

### Public contract hubs

- `OpenClawPluginApi`, `OpenClawPluginDefinition`, `ProviderPlugin`, `OpenClawPluginConfigSchema`, and `PluginLogger` in [`src/plugins/types.ts`](../../src/plugins/types.ts)
- `PluginRuntime` in [`src/plugins/runtime/types.ts`](../../src/plugins/runtime/types.ts)
- `BuildPluginApiParams` in [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts)

### Registry and capture

- `buildPluginApi` in [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts)
- `createCapturedPluginRegistration` and `capturePluginRegistration` in [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts)
- `createPluginRegistry` in [`src/plugins/registry.ts`](../../src/plugins/registry.ts)
- `setActivePluginRegistry` and `getActivePluginRegistry` in [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts)

### Loader and boundary helpers

- `loadBundledEntryExportSync` in [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts)
- `resolvePluginSdkAliasFile`, `resolveLoaderPackageRoot`, and `resolvePluginSdkScopedAliasMap` in [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts)
- `ensurePluginRegistryLoaded` in [`src/plugins/runtime/runtime-registry-loader.ts`](../../src/plugins/runtime/runtime-registry-loader.ts)
- `resolvePluginRuntimeRecord`, `resolvePluginRuntimeRecordByEntryBaseNames`, and `createCachedPluginBoundaryModuleLoader` in [`src/plugins/runtime/runtime-plugin-boundary.ts`](../../src/plugins/runtime/runtime-plugin-boundary.ts)

### Runtime injection

- `createPluginRuntime`, `setGatewaySubagentRuntime`, and `clearGatewaySubagentRuntime` in [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts)
- `resolvePluginRuntimeLoadContext` and `createPluginRuntimeLoaderLogger` in [`src/plugins/runtime/load-context.ts`](../../src/plugins/runtime/load-context.ts)

## dependency map

### Internal required dependencies

- Contract hub: [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Registry and loader glue: [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts), [`src/plugins/registry.ts`](../../src/plugins/registry.ts), [`src/plugins/loader.ts`](../../src/plugins/loader.ts), [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts)
- Entry DSL support: [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts), [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts), [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts)
- Boundary and alias support: [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts), [`src/infra/boundary-file-read.ts`](../../src/infra/boundary-file-read.ts), [`src/plugin-sdk/root-alias.cjs`](../../src/plugin-sdk/root-alias.cjs)

### External dependencies

- `jiti` for mixed-source/distro module loading
- `zod` for config-schema support
- Node `fs`, `path`, `module`, `url`, `crypto` builtins

### Runtime and config dependencies

- [`src/config/config.ts`](../../src/config/config.ts) and related config types for nearly every host-owned registration or runtime path
- [`src/agents/auth-profiles/`](../../src/agents/auth-profiles) and [`src/agents/model-auth-env.js`](../../src/agents/model-auth-env.js) for provider auth helpers
- [`src/channels/plugins/`](../../src/channels/plugins) for bundled channel entry contracts
- [`src/gateway/server-methods/types.ts`](../../src/gateway/server-methods/types.ts) and gateway method scopes through the plugin type hub

### Glue you can rewrite to reduce coupling

- Replace [`src/plugins/types.ts`](../../src/plugins/types.ts) with a much smaller local contract package if you only need plugin entries and provider registration
- Replace [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts) with a loader tuned to your own monorepo/package layout
- Replace the process-global registry state in [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts) if you do not need OpenClaw's pinned channel/http registry semantics
- Replace package bridges in [`packages/plugin-sdk/src/`](../../packages/plugin-sdk/src) with build-time export mapping if your public package does not share the same source tree

## extraction recipes

### Recipe: extract only the generic entry DSL

- Carry together: [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts), [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts)
- Rewrite immediately: the imports from [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Keep behavior: lazy config-schema evaluation and stable declaration shape
- Drop safely: provider auth, registry boot, gateway/runtime helpers
- Strategy: `adapter`

### Recipe: extract the single-provider authoring surface

- Carry together: [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts), [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts)
- Usually also needed: [`src/plugins/provider-api-key-auth.ts`](../../src/plugins/provider-api-key-auth.ts) and selected provider-auth helpers
- Rewrite immediately: auth-profile storage, onboarding prompt plumbing, model/provider config DTOs
- Keep behavior: env-var aggregation, wizard choice shaping, single-provider catalog defaults
- Strategy: `adapter`

### Recipe: extract a test-only registration capture harness

- Carry together: [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts), [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts), [`src/plugin-sdk/testing.ts`](../../src/plugin-sdk/testing.ts)
- Replace with shims: runtime and config objects passed into `buildPluginApi(...)`
- Keep behavior: capturing providers, CLI registrations, tools, and media/speech providers without loading the full host
- Drop safely: full registry state in [`src/plugins/registry.ts`](../../src/plugins/registry.ts)
- Strategy: `copier`

### Recipe: extract the bundled channel loader algorithm

- Carry together: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts), [`src/plugin-sdk/root-alias.cjs`](../../src/plugin-sdk/root-alias.cjs)
- Usually also needed: [`src/infra/boundary-file-read.ts`](../../src/infra/boundary-file-read.ts)
- Rewrite immediately: package-root detection, alias maps, and your plugin root conventions
- Keep behavior: source fallback, boundary-safe module loading, runtime/setup sidecar resolution
- Strategy: `adapter`

### Recipe: extract only the package bridge pattern

- Carry together: [`packages/plugin-sdk/package.json`](../../packages/plugin-sdk/package.json) and a minimal subset of bridge files such as [`packages/plugin-sdk/src/plugin-entry.ts`](../../packages/plugin-sdk/src/plugin-entry.ts) and [`packages/plugin-sdk/src/testing.ts`](../../packages/plugin-sdk/src/testing.ts)
- Rewrite immediately: relative export targets if the public package will no longer live beside the canonical `src/` tree
- Keep behavior: stable public import surface with thin bridges
- Strategy: `copier`

## do not copy blindly

- Do not copy [`src/plugins/types.ts`](../../src/plugins/types.ts) unless you really want OpenClaw's whole plugin contract universe; it drags channel, gateway, auth, runtime, speech, media, and config coupling into every extracted feature.
- Do not copy [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts) as a drop-in host runtime unless your new project also has subagents, taskflow, media runtimes, web-search runtime, and a compatible process-global registry model.
- Do not copy [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts) without also inspecting [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts); the loader logic depends on OpenClaw's `src`/`dist`/package-root conventions.
- Do not treat [`packages/memory-host-sdk/`](../../packages/memory-host-sdk) as the memory engine itself; in this batch it is only a bridge package into [`src/memory-host-sdk/`](../../src/memory-host-sdk), which is analyzed with batch 07.
- Do not assume the package bridges are harmless if you move directories around; files like [`packages/plugin-sdk/src/plugin-entry.ts`](../../packages/plugin-sdk/src/plugin-entry.ts) are hard-wired to relative monorepo paths.
- Do not skip the contract tests in [`src/plugins/contracts/`](../../src/plugins/contracts); they are the strongest signal about which public surfaces OpenClaw is actively trying to keep stable.

## minimal reusable slices

### Slice A - lazy plugin entry kernel

- Files: [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts), [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts)
- Add one shim: a local plugin contract type file replacing the subset used from [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Best use: defining tools/services/providers in another host runtime
- Strategy: `adapter`

### Slice B - provider declaration convenience layer

- Files: [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts), [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts), [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts)
- Add shims for: auth store, onboarding prompt API, model/provider config shapes
- Best use: any project exposing many provider plugins behind one uniform setup path
- Strategy: `adapter`

### Slice C - plugin registration capture testkit

- Files: [`src/plugins/api-builder.ts`](../../src/plugins/api-builder.ts), [`src/plugins/captured-registration.ts`](../../src/plugins/captured-registration.ts)
- Optional public wrapper: [`src/plugin-sdk/testing.ts`](../../src/plugin-sdk/testing.ts)
- Best use: contract tests for plugin declarations
- Strategy: `copier`

### Slice D - package bridge scaffold

- Files: [`packages/plugin-sdk/package.json`](../../packages/plugin-sdk/package.json), [`packages/plugin-sdk/src/plugin-entry.ts`](../../packages/plugin-sdk/src/plugin-entry.ts), [`packages/plugin-sdk/src/testing.ts`](../../packages/plugin-sdk/src/testing.ts)
- Best use: keep a small author-facing SDK package stable while canonical code stays elsewhere
- Strategy: `copier`

### Slice E - bundled channel sidecar loader

- Files: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`src/plugins/sdk-alias.ts`](../../src/plugins/sdk-alias.ts), [`src/plugin-sdk/root-alias.cjs`](../../src/plugin-sdk/root-alias.cjs)
- Add one shim: your host-specific package-root and alias resolution rules
- Best use: monorepos that need bundled plugins to work both from source and build output
- Strategy: `adapter`

## exact search shortcuts

- `rg "definePluginEntry|createCachedLazyValueGetter|buildPluginConfigSchema|emptyPluginConfigSchema" src/plugin-sdk src/plugins`
- `rg "defineSingleProviderPluginEntry|createProviderApiKeyAuthMethod|buildSingleProviderApiKeyCatalog|readConfiguredProviderCatalogEntries" src/plugin-sdk src/plugins`
- `rg "defineBundledChannelEntry|defineBundledChannelSetupEntry|loadBundledEntryExportSync|OPENCLAW_DISABLE_BUNDLED_ENTRY_SOURCE_FALLBACK" src/plugin-sdk src/plugins extensions`
- `rg "buildPluginApi|createCapturedPluginRegistration|capturePluginRegistration" src/plugins src/plugin-sdk src/test-utils`
- `rg "createPluginRuntime|setGatewaySubagentRuntime|clearGatewaySubagentRuntime|ensurePluginRegistryLoaded" src/plugins src/gateway src/node-host`
- `rg "resolvePluginRuntimeRecord|createCachedPluginBoundaryModuleLoader|resolvePluginSdkAliasFile|resolveLoaderPackageRoot" src/plugins`
- `rg "export \\* from \\\"\\.\\.\\/\\.\\.\\/\\.\\.\\/src/plugin-sdk|export \\* from \\\"\\.\\.\\/\\.\\.\\/\\.\\.\\/src/memory-host-sdk" packages/plugin-sdk packages/memory-host-sdk`
