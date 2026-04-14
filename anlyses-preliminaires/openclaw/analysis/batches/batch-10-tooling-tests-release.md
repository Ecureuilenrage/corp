# Batch 10 - Tooling, Tests and Release

Scope: `768` files. Main concentration: [`scripts/`](../../scripts), [`test/`](../../test), root `vitest.*` files, [`.github/workflows/`](../../.github/workflows), and release-oriented root metadata.

## purpose

This batch is the operational shell around the product: Vitest lane routing, full-suite sharding, isolated test-home setup, gateway E2E helpers, release and publish guardrails, TypeScript topology analyzers, package-boundary helpers, and protocol code generation.

For extraction work, the useful split is not "tests versus scripts" but "bounded operational engines versus monorepo policy glue". The cleanest bounded engines are the Vitest process runner in [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs), [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs), and [`scripts/pnpm-runner.mjs`](../../scripts/pnpm-runner.mjs), the shared isolated-home harness in [`test/setup.shared.ts`](../../test/setup.shared.ts), [`test/test-env.ts`](../../test/test-env.ts), and [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts), the gateway E2E harness in [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts), the calver and dist-tag planner in [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs), the plugin release selection helpers in [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts) and [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts), the topology analyzer in [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts) and [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts), and the extension boundary scaffold in [`scripts/lib/extension-package-boundary.ts`](../../scripts/lib/extension-package-boundary.ts).

The dangerous hubs are [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs), [`scripts/release-check.ts`](../../scripts/release-check.ts), [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts), and [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts), because they encode OpenClaw-specific path taxonomy, package layout, runtime resets, extension manifests, bundled assets, release conventions, and gateway assumptions in one place.

## entrypoints

- [`scripts/test-projects.mjs`](../../scripts/test-projects.mjs): root test orchestrator for explicit targets, changed-path routing, and full-suite sharding.
- [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs): Vitest child-process wrapper with Node flags, stderr filtering, and cross-platform spawn policy.
- [`scripts/release-check.ts`](../../scripts/release-check.ts): packed-release validation for npm artifacts, bundled extensions, control UI assets, and appcast metadata.
- [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts): npm publish and tag guardrail for the main package.
- [`scripts/plugin-npm-release-check.ts`](../../scripts/plugin-npm-release-check.ts): publishable plugin-package selection and metadata validation.
- [`scripts/plugin-clawhub-release-check.ts`](../../scripts/plugin-clawhub-release-check.ts): ClawHub-specific plugin publish validation and version-gate entrypoint.
- [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts): CLI for public-surface usage and ownership reports.
- [`scripts/protocol-gen.ts`](../../scripts/protocol-gen.ts): JSON schema generator for gateway protocol frames.
- [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts): generated Swift DTO writer for Apple clients.
- [`test/global-setup.ts`](../../test/global-setup.ts): Vitest global setup for isolated-home lifecycle.

## key files

- [`scripts/test-projects.mjs`](../../scripts/test-projects.mjs): orchestration shell around heavy-check locking, include-file generation, and parallel shard execution.
- [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs): core routing engine that maps changed files and explicit paths into Vitest lanes.
- [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs): low-level Vitest spawn helper plus stderr noise suppression.
- [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs): cross-platform process-group cleanup and forwarded-signal policy.
- [`vitest.scoped-config.ts`](../../vitest.scoped-config.ts): reusable builder for scoped Vitest configs with include-file narrowing and per-lane ordering.
- [`vitest.extensions.config.ts`](../../vitest.extensions.config.ts): extension-root config builder that excludes channel and provider-specific lanes from the broad extensions lane.
- [`test/setup.shared.ts`](../../test/setup.shared.ts): idempotent shared setup that installs warning filters and one isolated home per worker.
- [`test/test-env.ts`](../../test/test-env.ts): isolated-home and live-test environment staging, including copied auth state and config sanitization.
- [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts): plugin-registry seeding plus runtime cache cleanup after each test.
- [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts): async helper for per-test temp homes with extra env overrides.
- [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts): spawn, connect, probe, and tear down a minimal local gateway for E2E suites.
- [`scripts/release-check.ts`](../../scripts/release-check.ts): bundle, pack, appcast, and bundled-extension release validator.
- [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs): generic calver parser and npm dist-tag mirror planner.
- [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts): plugin publishable-package discovery and git-range selection logic.
- [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts): ClawHub-aware plugin selection and remote published-version checks.
- [`scripts/lib/extension-package-boundary.ts`](../../scripts/lib/extension-package-boundary.ts): extension package-boundary path map and tsconfig generator.
- [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts): report CLI over the TypeScript program-level analyzer.
- [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts): symbol ownership and public-surface usage analyzer.
- [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts): reusable scope model for plugin-sdk or custom public entrypoints.
- [`scripts/protocol-gen.ts`](../../scripts/protocol-gen.ts): JSON schema emitter from `ProtocolSchemas`.
- [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts): generated Swift `GatewayModels.swift` writer.

## data flow

- Root `pnpm test` flows into [`scripts/test-projects.mjs`](../../scripts/test-projects.mjs), which acquires the local heavy-check lock, parses explicit or changed targets through [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs), writes include files when needed, and either runs one Vitest config or fans out multiple shards in parallel.
- Each shard or direct run eventually goes through [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs), [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs), and [`scripts/pnpm-runner.mjs`](../../scripts/pnpm-runner.mjs), which decide Node flags, child-process layout, signal forwarding, and stderr filtering.
- Root `vitest.*` configs consume builders like [`vitest.scoped-config.ts`](../../vitest.scoped-config.ts) and [`vitest.extensions.config.ts`](../../vitest.extensions.config.ts) to turn include globs, setup files, and lane order into concrete Vitest project configs.
- Worker setup goes through [`test/setup.ts`](../../test/setup.ts), [`test/setup.shared.ts`](../../test/setup.shared.ts), and [`test/test-env.ts`](../../test/test-env.ts), which isolate the home directory, copy or sanitize live auth state when explicitly running live tests, and install warning suppression.
- Runtime-heavy suites additionally load [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts), which seeds a lazy default plugin registry and drains session, file-lock, plugin-discovery, and model caches after each test.
- Gateway E2E tests use [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts) to spawn `dist/index.js gateway`, generate a temporary config, connect node clients, and poll for health or chat completion.
- Release validation flows through [`scripts/release-check.ts`](../../scripts/release-check.ts), [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts), [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs), [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts), and [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts), which inspect package metadata, git ranges, tarball contents, dist-tag policy, and published versions before CI or release jobs proceed.
- Public-surface analysis goes through [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts), [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts), and [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts), which load a TypeScript program, enumerate public entrypoints, classify consumer ownership, and emit text or JSON reports.
- Protocol code generation reads [`src/gateway/protocol/schema.js`](../../src/gateway/protocol/schema.js) via [`scripts/protocol-gen.ts`](../../scripts/protocol-gen.ts) and [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts) to produce JSON schema and Swift DTO outputs consumed by Apple clients.

## external deps

- Test orchestration depends on `vitest`, `pnpm`, `tsx`, and Node child-process primitives.
- Topology analysis depends on the TypeScript compiler API via `typescript`.
- Release guards depend on `git`, `npm`, tarball inspection, and packaging metadata already present in the repo.
- Some test and live-test paths rely on `/bin/bash`, `JSON5`, and the local filesystem layout of `~/.openclaw`, `~/.claude`, `~/.codex`, and related auth state.
- Gateway E2E helpers depend on a built `dist/index.js`, the gateway protocol client in [`src/gateway/client.js`](../../src/gateway/client.js), and local websocket or HTTP reachability.

## flags/env

- [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs) uses `OPENCLAW_VITEST_INCLUDE_FILE` for include-file narrowing and `OPENCLAW_TEST_PROJECTS_LEAF_SHARDS` to expand full-suite shards into leaf configs.
- [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs) honors `OPENCLAW_VITEST_ENABLE_MAGLEV` when deciding whether to inject `--no-maglev`.
- [`test/setup.shared.ts`](../../test/setup.shared.ts) sets `VITEST=true`, defaults `OPENCLAW_PLUGIN_MANIFEST_CACHE_MS`, and raises the process listener budget.
- [`test/test-env.ts`](../../test/test-env.ts) responds to `LIVE`, `OPENCLAW_LIVE_TEST`, `OPENCLAW_LIVE_GATEWAY`, `OPENCLAW_LIVE_USE_REAL_HOME`, `OPENCLAW_LIVE_TEST_QUIET`, and `OPENCLAW_LIVE_TEST_NORMALIZE_CONFIG`.
- [`test/test-env.ts`](../../test/test-env.ts) also forces or clears `OPENCLAW_TEST_FAST`, `OPENCLAW_STRICT_FAST_REPLY_CONFIG`, `OPENCLAW_ALLOW_SLOW_REPLY_TESTS`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`, `OPENCLAW_GATEWAY_PORT`, `OPENCLAW_BRIDGE_*`, `OPENCLAW_CANVAS_HOST_PORT`, and token-bearing env vars to keep tests isolated.
- [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts) uses `OPENCLAW_NPM_RELEASE_SKIP_PACK_CHECK` to bypass packed tarball validation.
- [`scripts/lib/local-heavy-check-runtime.mjs`](../../scripts/lib/local-heavy-check-runtime.mjs) honors `OPENCLAW_LOCAL_CHECK`, `OPENCLAW_LOCAL_CHECK_MODE`, `OPENCLAW_HEAVY_CHECK_LOCK_TIMEOUT_MS`, `OPENCLAW_HEAVY_CHECK_LOCK_POLL_MS`, `OPENCLAW_HEAVY_CHECK_LOCK_PROGRESS_MS`, `OPENCLAW_HEAVY_CHECK_STALE_LOCK_MS`, and `OPENCLAW_TSGO_PPROF_DIR`.

## subdomains

### Vitest lane routing and shard orchestration

Classification: `infra`.

Anchors:

- [`scripts/test-projects.mjs`](../../scripts/test-projects.mjs)
- [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs)
- [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs)
- [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs)
- [`scripts/lib/vitest-batch-runner.mjs`](../../scripts/lib/vitest-batch-runner.mjs)

This is the operational center of the batch. It is highly reusable as a pattern, but the lane taxonomy and path-routing heuristics are tied to OpenClaw's repo structure.

### Scoped Vitest config builders

Classification: `infra` plus `glue`.

Anchors:

- [`vitest.scoped-config.ts`](../../vitest.scoped-config.ts)
- [`vitest.extensions.config.ts`](../../vitest.extensions.config.ts)
- [`vitest.shared.config.ts`](../../vitest.shared.config.ts)
- [`vitest.pattern-file.ts`](../../vitest.pattern-file.ts)

This subdomain converts repo-specific include roots and setup files into repeatable Vitest project configs. The builder API is portable; the path lists and default runner are not.

### Shared isolated-home and runtime-reset test harness

Classification: `infra`.

Anchors:

- [`test/setup.ts`](../../test/setup.ts)
- [`test/setup.shared.ts`](../../test/setup.shared.ts)
- [`test/global-setup.ts`](../../test/global-setup.ts)
- [`test/test-env.ts`](../../test/test-env.ts)
- [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts)
- [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts)

This is the cleanest test-isolation seam in the batch. It combines home-directory isolation, live-config staging, and runtime cache cleanup so tests never touch the developer's real state.

### Gateway E2E harness

Classification: `adapters` plus `infra`.

Anchors:

- [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts)
- [`test/gateway.multi.e2e.test.ts`](../../test/gateway.multi.e2e.test.ts)
- [`src/gateway/test-helpers.e2e.js`](../../src/gateway/test-helpers.e2e.js)

This is a bounded harness for spinning up a real local gateway and attaching test clients. It is reusable if the target host keeps the same gateway protocol or is willing to provide a thin adapter.

### Pack and release guardrails

Classification: `infra` plus `glue`.

Anchors:

- [`scripts/release-check.ts`](../../scripts/release-check.ts)
- [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts)
- [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs)
- [`scripts/lib/bundled-extension-manifest.ts`](../../scripts/lib/bundled-extension-manifest.ts)
- [`scripts/runtime-postbuild.mjs`](../../scripts/runtime-postbuild.mjs)

This subdomain validates that the packed release artifact still contains the expected runtime outputs, matches versioning policy, and keeps bundled extensions and appcast metadata coherent.

### Plugin publish selection and ClawHub policy

Classification: `infra`.

Anchors:

- [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts)
- [`scripts/plugin-npm-release-check.ts`](../../scripts/plugin-npm-release-check.ts)
- [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts)
- [`scripts/plugin-clawhub-release-check.ts`](../../scripts/plugin-clawhub-release-check.ts)
- [`scripts/plugin-clawhub-release-plan.ts`](../../scripts/plugin-clawhub-release-plan.ts)

This is one of the more extraction-friendly operational seams in the batch. The git-range selection and published-version checks are generic enough to transplant if the target repo also ships plugin-like packages from one tree.

### TypeScript public-surface topology analyzer

Classification: `infra`.

Anchors:

- [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts)
- [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts)
- [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts)
- [`scripts/lib/ts-topology/reports.ts`](../../scripts/lib/ts-topology/reports.ts)
- [`test/scripts/ts-topology.test.ts`](../../test/scripts/ts-topology.test.ts)

This is a strong reverse-engineering and refactor-support tool. The main coupling is the built-in plugin-sdk scope and the repo ownership classification rules.

### Extension package-boundary scaffolding

Classification: `infra`.

Anchors:

- [`scripts/lib/extension-package-boundary.ts`](../../scripts/lib/extension-package-boundary.ts)
- [`extensions/tsconfig.package-boundary.base.json`](../../extensions/tsconfig.package-boundary.base.json)

This subdomain codifies the minimum import surface extension packages are allowed to use. The concept is reusable; the alias tables are deeply OpenClaw-specific.

### Protocol schema and Swift model generation

Classification: `adapters` plus `infra`.

Anchors:

- [`scripts/protocol-gen.ts`](../../scripts/protocol-gen.ts)
- [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts)
- [`src/gateway/protocol/schema.js`](../../src/gateway/protocol/schema.js)
- [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift)

This is a good codegen pattern if the target host already has a stable JSON-schema-like source contract. The generated file locations and naming are still OpenClaw-specific.

## feature inventory

### Changed-target Vitest routing and shard execution

- Goal: map explicit targets or changed files to the smallest viable Vitest lane, then run configs in parallel with include files and process-group cleanup.
- Open first: [`scripts/test-projects.mjs`](../../scripts/test-projects.mjs), [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs), [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs)
- Pivot symbols: `acquireLocalHeavyCheckLockSync`, `FULL_SUITE_CONFIG_WEIGHT`, `resolveParallelFullSuiteConcurrency`, `orderFullSuiteSpecsForParallelRun`, `parseTestProjectsArgs`, `resolveChangedTargetArgs`, `buildFullSuiteVitestRunPlans`, `createVitestRunSpecs`, `writeVitestIncludeFile`, `resolveVitestNodeArgs`, `resolveVitestCliEntry`, `resolveVitestSpawnParams`, `installVitestProcessGroupCleanup`, `runVitestBatch`
- Strictly required modules: [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs), [`scripts/pnpm-runner.mjs`](../../scripts/pnpm-runner.mjs), [`scripts/lib/local-heavy-check-runtime.mjs`](../../scripts/lib/local-heavy-check-runtime.mjs)
- Dangerous coupling: path classifiers like `isChannelSurfaceTestFile`, `isPluginSdkLightTarget`, extension-root tests, and config-name weights all assume the OpenClaw monorepo layout
- Strategy: `adapter`

### Scoped Vitest config builder

- Goal: build reusable Vitest configs that accept env-driven include lists, CLI narrowing, per-lane ordering, optional non-isolated runners, and consistent setup-file injection.
- Open first: [`vitest.scoped-config.ts`](../../vitest.scoped-config.ts), [`vitest.extensions.config.ts`](../../vitest.extensions.config.ts)
- Pivot symbols: `createScopedVitestConfig`, `resolveVitestIsolation`, `createExtensionsVitestConfig`, `loadIncludePatternsFromEnv`, `resolveScopedProjectGroupOrder`
- Strictly required modules: [`vitest.pattern-file.ts`](../../vitest.pattern-file.ts), [`vitest.shared.config.ts`](../../vitest.shared.config.ts), [`vitest.unit-fast-paths.mjs`](../../vitest.unit-fast-paths.mjs)
- Dangerous coupling: default setup files include [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts), and the extension lane excludes many OpenClaw-specific roots
- Strategy: `adapter`

### Shared isolated-home and worker runtime setup

- Goal: run tests against a disposable home and state tree while keeping plugin-registry, lock, and session caches deterministic across workers.
- Open first: [`test/setup.shared.ts`](../../test/setup.shared.ts), [`test/test-env.ts`](../../test/test-env.ts), [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts), [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts)
- Pivot symbols: `installSharedTestSetup`, `withIsolatedTestHome`, `installTestEnv`, `withTempHome`, `createTestRegistryForSetup`, `createStubPlugin`, `installDefaultPluginRegistry`, `resetPluginRuntimeStateForTest`, `setActivePluginRegistry`
- Strictly required modules: [`src/infra/warning-filter.js`](../../src/infra/warning-filter.js), [`src/plugins/runtime.js`](../../src/plugins/runtime.js), [`src/config/sessions/store-cache.js`](../../src/config/sessions/store-cache.js), [`src/infra/file-lock.js`](../../src/infra/file-lock.js)
- Dangerous coupling: the harness actively clears OpenClaw session stores, plugin discovery caches, model caches, and token-bearing env vars; copying it blindly can silently erase or rewrite host-specific state
- Strategy: `adapter`

### Gateway E2E harness

- Goal: spin up a minimal gateway, connect test clients, post HTTP hooks, and wait for node or chat state transitions in real integration suites.
- Open first: [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts)
- Pivot symbols: `spawnGatewayInstance`, `stopGatewayInstance`, `postJson`, `connectNode`, `waitForNodeStatus`, `waitForChatFinalEvent`, `extractFirstTextBlock`
- Strictly required modules: [`src/gateway/client.js`](../../src/gateway/client.js), [`src/gateway/test-helpers.e2e.js`](../../src/gateway/test-helpers.e2e.js), [`src/infra/device-identity.js`](../../src/infra/device-identity.js), built `dist/index.js`
- Dangerous coupling: the harness starts the real OpenClaw gateway binary and assumes gateway method names, env toggles such as `OPENCLAW_TEST_MINIMAL_GATEWAY`, and `HelloOk` or `node.list` semantics
- Strategy: `adapter`

### Generic calver publish plan and dist-tag policy

- Goal: parse OpenClaw-style calver versions, compare them safely, and decide `latest` versus `beta` tags plus mirror-tag auth requirements.
- Open first: [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs)
- Pivot symbols: `parseReleaseVersion`, `compareReleaseVersions`, `resolveNpmPublishPlan`, `resolveNpmDistTagMirrorAuth`, `shouldRequireNpmDistTagMirrorAuth`
- Strictly required modules: none beyond Node stdlib
- Dangerous coupling: version format is opinionated but explicit; the core planner is otherwise portable
- Strategy: `copier`

### Packed-release and main-package publish validator

- Goal: verify packed tarball contents, bundled-extension metadata, appcast Sparkle version rules, repository metadata, tag freshness, and dist-tag auth before release.
- Open first: [`scripts/release-check.ts`](../../scripts/release-check.ts), [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts)
- Pivot symbols: `collectBundledExtensionManifestErrors`, `collectBundledExtensionRootDependencyMirrorErrors`, `collectMissingPackPaths`, `collectForbiddenPackPaths`, `collectPackUnpackedSizeErrors`, `collectAppcastSparkleVersionErrors`, `runPackedBundledChannelEntrySmoke`, `collectReleasePackageMetadataErrors`, `collectReleaseTagErrors`, `resolveNpmCommandInvocation`, `shouldSkipPackedTarballValidation`
- Strictly required modules: [`scripts/lib/bundled-extension-manifest.ts`](../../scripts/lib/bundled-extension-manifest.ts), [`scripts/runtime-postbuild.mjs`](../../scripts/runtime-postbuild.mjs), [`scripts/lib/plugin-sdk-entries.mjs`](../../scripts/lib/plugin-sdk-entries.mjs), [`scripts/lib/bundled-plugin-build-entries.mjs`](../../scripts/lib/bundled-plugin-build-entries.mjs), [`scripts/sparkle-build.ts`](../../scripts/sparkle-build.ts)
- Dangerous coupling: required tarball paths, forbidden prefixes, Sparkle floors, and control-UI assets are all specific to OpenClaw's distribution shape
- Strategy: `adapter`

### Plugin publish discovery and git-range selection

- Goal: discover publishable plugin packages, validate package metadata, and select changed or explicit packages for npm or ClawHub release.
- Open first: [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts), [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts)
- Pivot symbols: `collectPublishablePluginPackages`, `parsePluginReleaseArgs`, `resolveSelectedPublishablePluginPackages`, `collectChangedExtensionIdsFromGitRange`, `resolveChangedPublishablePluginPackages`, `collectClawHubPublishablePluginPackages`, `resolveSelectedClawHubPublishablePluginPackages`, `collectClawHubVersionGateErrors`, `collectPluginClawHubReleasePlan`
- Strictly required modules: [`packages/plugin-package-contract/src/index.ts`](../../packages/plugin-package-contract/src/index.ts), [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs), Git and npm CLI availability
- Dangerous coupling: package discovery assumes `extensions/<id>/package.json`, OpenClaw package.json metadata keys, and ClawHub shared-input paths
- Strategy: `adapter`

### TypeScript topology analyzer

- Goal: inspect a repo's public entrypoints, classify who consumes each export, and rank candidates for move-back, single-owner sharing, or dead public surface.
- Open first: [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts), [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts), [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts)
- Pivot symbols: `main`, `analyzeTopology`, `filterRecordsForReport`, `createPluginSdkScope`, `createFilesystemPublicSurfaceScope`, `renderTextReport`
- Strictly required modules: [`scripts/lib/ts-topology/context.ts`](../../scripts/lib/ts-topology/context.ts), [`scripts/lib/ts-topology/types.ts`](../../scripts/lib/ts-topology/types.ts), `typescript`
- Dangerous coupling: ownership classification is repo-structure-sensitive, and the built-in `plugin-sdk` scope assumes `src/plugin-sdk/*.ts`
- Strategy: `adapter`

### Extension package-boundary scaffold

- Goal: generate and validate package-boundary tsconfig files for extension packages that should only import from the sanctioned host surface.
- Open first: [`scripts/lib/extension-package-boundary.ts`](../../scripts/lib/extension-package-boundary.ts)
- Pivot symbols: `collectBundledExtensionIds`, `collectExtensionsWithTsconfig`, `collectOptInExtensionPackageBoundaries`, `readExtensionPackageBoundaryTsconfig`, `renderExtensionPackageBoundaryTsconfig`, `EXTENSION_PACKAGE_BOUNDARY_BASE_PATHS`, `EXTENSION_PACKAGE_BOUNDARY_XAI_PATHS`
- Strictly required modules: [`extensions/tsconfig.package-boundary.base.json`](../../extensions/tsconfig.package-boundary.base.json)
- Dangerous coupling: alias maps point into OpenClaw dist outputs, `packages/plugin-sdk`, and extension-local boundary stubs
- Strategy: `adapter`

### Protocol JSON schema and Swift DTO generation

- Goal: emit machine-readable gateway schema and generated Swift protocol models from one source contract.
- Open first: [`scripts/protocol-gen.ts`](../../scripts/protocol-gen.ts), [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts)
- Pivot symbols: `writeJsonSchema`, `generate`, `swiftType`, `emitStruct`, `emitGatewayFrame`, `ProtocolSchemas`, `PROTOCOL_VERSION`, `ErrorCodes`
- Strictly required modules: [`src/gateway/protocol/schema.js`](../../src/gateway/protocol/schema.js)
- Dangerous coupling: output paths, naming, and `AnyCodable` conventions are specific to OpenClaw's Apple clients
- Strategy: `adapter`

## symbol map

### Vitest orchestration

- [`scripts/test-projects.mjs`](../../scripts/test-projects.mjs): `acquireLocalHeavyCheckLockSync`, `FULL_SUITE_CONFIG_WEIGHT`, `resolveParallelFullSuiteConcurrency`, `orderFullSuiteSpecsForParallelRun`, `main`
- [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs): `parseTestProjectsArgs`, `resolveChangedTargetArgs`, `buildVitestRunPlans`, `buildFullSuiteVitestRunPlans`, `createVitestRunSpecs`, `writeVitestIncludeFile`, `resolveUnitFastTestIncludePattern`
- [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs): `resolveVitestNodeArgs`, `resolveVitestCliEntry`, `resolveVitestSpawnParams`, `shouldSuppressVitestStderrLine`
- [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs): `shouldUseDetachedVitestProcessGroup`, `resolveVitestProcessGroupSignalTarget`, `forwardSignalToVitestProcessGroup`, `installVitestProcessGroupCleanup`
- [`scripts/lib/vitest-batch-runner.mjs`](../../scripts/lib/vitest-batch-runner.mjs): `runVitestBatch`, `isDirectScriptRun`

### Test environment and runtime cleanup

- [`test/setup.shared.ts`](../../test/setup.shared.ts): `installSharedTestSetup`
- [`test/test-env.ts`](../../test/test-env.ts): `installTestEnv`, `withIsolatedTestHome`, `loadProfileEnv`, `stageLiveTestState`
- [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts): `withTempHome`
- [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts): `createTestRegistryForSetup`, `createStubPlugin`, `resolveDefaultPluginRegistryProxy`, `installDefaultPluginRegistry`

### Gateway E2E harness

- [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts): `spawnGatewayInstance`, `stopGatewayInstance`, `postJson`, `connectNode`, `waitForNodeStatus`, `waitForChatFinalEvent`

### Release and publish policy

- [`scripts/release-check.ts`](../../scripts/release-check.ts): `collectBundledExtensionManifestErrors`, `collectBundledExtensionRootDependencyMirrorErrors`, `collectMissingPackPaths`, `collectForbiddenPackPaths`, `collectPackUnpackedSizeErrors`, `collectAppcastSparkleVersionErrors`, `runPackedBundledChannelEntrySmoke`
- [`scripts/openclaw-npm-release-check.ts`](../../scripts/openclaw-npm-release-check.ts): `parseReleaseVersion`, `compareReleaseVersions`, `resolveNpmPublishPlan`, `resolveNpmDistTagMirrorAuth`, `shouldSkipPackedTarballValidation`, `parseReleaseTagVersion`, `utcCalendarDayDistance`, `collectReleasePackageMetadataErrors`, `collectReleaseTagErrors`, `resolveNpmCommandInvocation`
- [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs): `parseReleaseVersion`, `compareReleaseVersions`, `resolveNpmPublishPlan`, `resolveNpmDistTagMirrorAuth`, `shouldRequireNpmDistTagMirrorAuth`
- [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts): `collectPublishablePluginPackages`, `parsePluginReleaseArgs`, `collectChangedExtensionIdsFromGitRange`, `resolveChangedPublishablePluginPackages`, `resolveSelectedPublishablePluginPackages`, `collectPluginReleasePlan`
- [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts): `collectClawHubPublishablePluginPackages`, `resolveSelectedClawHubPublishablePluginPackages`, `collectClawHubVersionGateErrors`, `isPluginVersionPublishedOnClawHub`, `collectPluginClawHubReleasePlan`

### Topology, boundaries, and codegen

- [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts): `main`, `parseArgs`, `resolveScope`
- [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts): `analyzeTopology`, `filterRecordsForReport`
- [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts): `createPluginSdkScope`, `createFilesystemPublicSurfaceScope`
- [`scripts/lib/extension-package-boundary.ts`](../../scripts/lib/extension-package-boundary.ts): `collectBundledExtensionIds`, `collectOptInExtensionPackageBoundaries`, `renderExtensionPackageBoundaryTsconfig`
- [`scripts/protocol-gen.ts`](../../scripts/protocol-gen.ts): `writeJsonSchema`
- [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts): `generate`, `swiftType`, `emitStruct`, `emitGatewayFrame`

## dependency map

### Internal dependencies that are truly central

- Vitest orchestration depends on [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs), [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs), [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs), [`scripts/pnpm-runner.mjs`](../../scripts/pnpm-runner.mjs), and many `vitest.*-paths.mjs` classifiers.
- Shared test setup depends on [`test/test-env.ts`](../../test/test-env.ts), [`src/infra/warning-filter.js`](../../src/infra/warning-filter.js), and the cache-reset helpers referenced by [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts).
- Release checks depend on [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs), [`scripts/lib/bundled-extension-manifest.ts`](../../scripts/lib/bundled-extension-manifest.ts), [`scripts/runtime-postbuild.mjs`](../../scripts/runtime-postbuild.mjs), and package or bundle inventory helpers.
- Topology analysis depends on [`scripts/lib/ts-topology/context.ts`](../../scripts/lib/ts-topology/context.ts), [`scripts/lib/ts-topology/types.ts`](../../scripts/lib/ts-topology/types.ts), and TypeScript program traversal.

### External dependencies

- `vitest`, `typescript`, `tsx`, `JSON5`
- `git`, `npm`, `pnpm`, `/bin/bash`
- Built release outputs under `dist/`

### Runtime and config dependencies

- Test harnesses mutate `HOME`, `USERPROFILE`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_TEST_HOME`, and related env vars.
- Live-test staging copies data from `~/.openclaw`, `~/.claude`, `~/.codex`, `~/.gemini`, and `~/.minimax`.
- Gateway E2E harness expects a built gateway binary plus the gateway token and hook-token config shape used by OpenClaw.
- Release checks assume the OpenClaw pack layout, control UI asset paths, plugin-sdk dist outputs, and appcast versioning policy.

### Glue that can be rewritten to shrink coupling

- Replace the OpenClaw-specific path classifiers in [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs) with a target-host lane table.
- Replace the default plugin registry and cache drains in [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts) with host-specific test doubles.
- Replace OpenClaw-specific required tarball paths and forbidden prefixes in [`scripts/release-check.ts`](../../scripts/release-check.ts) with a project-local manifest.
- Replace the built-in `plugin-sdk` scope in [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts) with a host-specific entrypoint list.

## extraction recipes

### Recipe: generic Vitest process runner

- Carry: [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs), [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs), [`scripts/pnpm-runner.mjs`](../../scripts/pnpm-runner.mjs)
- Keep together: `resolveVitestNodeArgs`, `resolveVitestSpawnParams`, `installVitestProcessGroupCleanup`, `spawnPnpmRunner`
- Replace with shims: the stderr suppression list and any pnpm path discovery rules you do not need
- Result: a cross-platform Vitest launcher with reliable signal forwarding and Windows-safe pnpm invocation

### Recipe: isolated test-home harness

- Carry: [`test/setup.shared.ts`](../../test/setup.shared.ts), [`test/test-env.ts`](../../test/test-env.ts), [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts)
- Keep together: `installSharedTestSetup`, `installTestEnv`, `withIsolatedTestHome`, `withTempHome`
- Replace with shims: OpenClaw-specific env keys, config sanitization, and auth-profile staging
- Result: deterministic test isolation without leaking the developer's real home or secrets

### Recipe: generic calver publish planner

- Carry: [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs)
- Keep together: `parseReleaseVersion`, `compareReleaseVersions`, `resolveNpmPublishPlan`, `resolveNpmDistTagMirrorAuth`
- Replace with shims: version regex if the target project uses a different calver or channel naming scheme
- Result: a tiny reusable publish-policy helper that does not pull the rest of the release stack

### Recipe: public-surface topology CLI

- Carry: [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts), [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts), [`scripts/lib/ts-topology/context.ts`](../../scripts/lib/ts-topology/context.ts), [`scripts/lib/ts-topology/reports.ts`](../../scripts/lib/ts-topology/reports.ts), [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts), [`scripts/lib/ts-topology/types.ts`](../../scripts/lib/ts-topology/types.ts)
- Keep together: `analyzeTopology`, `createFilesystemPublicSurfaceScope`, `renderTextReport`, `main`
- Replace with shims: repo ownership classification and any built-in scope shortcuts
- Result: a standalone CLI for finding duplicated or weakly owned exports before refactors

### Recipe: plugin release selection engine

- Carry: [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts), [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts), [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs)
- Keep together: `parsePluginReleaseArgs`, `collectPublishablePluginPackages`, `collectChangedExtensionIdsFromGitRange`, `resolveSelectedPublishablePluginPackages`, `collectClawHubVersionGateErrors`
- Replace with shims: package discovery root, repo metadata keys, and remote registry endpoint
- Result: a reusable selection or planning engine for plugin-like packages in one monorepo

## do not copy blindly

- [`scripts/test-projects.test-support.mjs`](../../scripts/test-projects.test-support.mjs) embeds OpenClaw's exact lane taxonomy. If you copy it verbatim, changed-file routing will silently misclassify targets in another repo.
- [`test/setup-openclaw-runtime.ts`](../../test/setup-openclaw-runtime.ts) mutates global plugin runtime state and clears caches after every test. In another host, that can hide race conditions or wipe unrelated singleton state.
- [`test/test-env.ts`](../../test/test-env.ts) copies real auth data during live-test mode. Blind reuse can leak or mutate developer credentials.
- [`scripts/release-check.ts`](../../scripts/release-check.ts) hardcodes required tarball paths, pack-size budgets, and Sparkle or appcast rules. Those rules are release-policy glue, not portable runtime logic.
- [`scripts/lib/extension-package-boundary.ts`](../../scripts/lib/extension-package-boundary.ts) hardcodes alias targets into OpenClaw dist outputs and extension stubs. Reusing the file unchanged will produce invalid boundary configs elsewhere.
- [`scripts/protocol-gen-swift.ts`](../../scripts/protocol-gen-swift.ts) writes directly into OpenClaw Apple package paths. Copy the generator shape, not the output contract or file paths.

## minimal reusable slices

### Slice: Vitest process-group runner

- Copy status: `copiable avec adaptation`
- Minimal files: [`scripts/run-vitest.mjs`](../../scripts/run-vitest.mjs), [`scripts/vitest-process-group.mjs`](../../scripts/vitest-process-group.mjs), [`scripts/pnpm-runner.mjs`](../../scripts/pnpm-runner.mjs)
- Why viable: this is the smallest complete runner that preserves signal forwarding, pnpm resolution, and child stderr filtering

### Slice: Isolated test home helper

- Copy status: `copiable avec adaptation`
- Minimal files: [`test/setup.shared.ts`](../../test/setup.shared.ts), [`test/test-env.ts`](../../test/test-env.ts), [`test/helpers/temp-home.ts`](../../test/helpers/temp-home.ts)
- Why viable: you can transplant the home-isolation pattern before deciding whether to keep OpenClaw's runtime-reset layer

### Slice: Calver publish planner

- Copy status: `copiable tel quel`
- Minimal files: [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs)
- Why viable: the helper is bounded, has no repo-local imports, and already separates parse, compare, and dist-tag policy

### Slice: TypeScript topology analyzer

- Copy status: `copiable avec adaptation`
- Minimal files: [`scripts/ts-topology.ts`](../../scripts/ts-topology.ts), [`scripts/lib/ts-topology/analyze.ts`](../../scripts/lib/ts-topology/analyze.ts), [`scripts/lib/ts-topology/context.ts`](../../scripts/lib/ts-topology/context.ts), [`scripts/lib/ts-topology/reports.ts`](../../scripts/lib/ts-topology/reports.ts), [`scripts/lib/ts-topology/scope.ts`](../../scripts/lib/ts-topology/scope.ts), [`scripts/lib/ts-topology/types.ts`](../../scripts/lib/ts-topology/types.ts)
- Why viable: the scope abstraction already lets you retarget the tool without keeping the rest of OpenClaw

### Slice: Plugin release selection helpers

- Copy status: `copiable avec adaptation`
- Minimal files: [`scripts/lib/plugin-npm-release.ts`](../../scripts/lib/plugin-npm-release.ts), [`scripts/lib/plugin-clawhub-release.ts`](../../scripts/lib/plugin-clawhub-release.ts), [`scripts/lib/npm-publish-plan.mjs`](../../scripts/lib/npm-publish-plan.mjs)
- Why viable: the core value is git-range selection plus metadata validation, which survives if you rewrite the package-discovery rules

### Slice: Gateway E2E spawn harness

- Copy status: `a reecrire partiellement`
- Minimal files: [`test/helpers/gateway-e2e-harness.ts`](../../test/helpers/gateway-e2e-harness.ts)
- Why viable: the harness is self-contained, but only after replacing the concrete gateway binary, protocol client, and env toggles

## exact search shortcuts

- `rg -n "parseTestProjectsArgs|resolveChangedTargetArgs|buildFullSuiteVitestRunPlans|createVitestRunSpecs|writeVitestIncludeFile" scripts/test-projects.mjs scripts/test-projects.test-support.mjs`
- `rg -n "resolveVitestNodeArgs|resolveVitestSpawnParams|installVitestProcessGroupCleanup|shouldUseDetachedVitestProcessGroup" scripts/run-vitest.mjs scripts/vitest-process-group.mjs`
- `rg -n "createScopedVitestConfig|createExtensionsVitestConfig|resolveScopedProjectGroupOrder" vitest.scoped-config.ts vitest.extensions.config.ts`
- `rg -n "installSharedTestSetup|installTestEnv|withIsolatedTestHome|withTempHome" test/setup.shared.ts test/test-env.ts test/helpers/temp-home.ts`
- `rg -n "createTestRegistryForSetup|installDefaultPluginRegistry|resetPluginRuntimeStateForTest|setActivePluginRegistry" test/setup-openclaw-runtime.ts`
- `rg -n "spawnGatewayInstance|connectNode|waitForNodeStatus|waitForChatFinalEvent" test/helpers/gateway-e2e-harness.ts`
- `rg -n "collectBundledExtensionManifestErrors|collectPackUnpackedSizeErrors|collectAppcastSparkleVersionErrors|runPackedBundledChannelEntrySmoke" scripts/release-check.ts`
- `rg -n "parseReleaseVersion|resolveNpmPublishPlan|collectReleaseTagErrors|resolveNpmCommandInvocation" scripts/openclaw-npm-release-check.ts scripts/lib/npm-publish-plan.mjs`
- `rg -n "collectPublishablePluginPackages|parsePluginReleaseArgs|collectChangedExtensionIdsFromGitRange|collectClawHubVersionGateErrors" scripts/lib/plugin-npm-release.ts scripts/lib/plugin-clawhub-release.ts`
- `rg -n "analyzeTopology|createFilesystemPublicSurfaceScope|renderTextReport|collectOptInExtensionPackageBoundaries|renderExtensionPackageBoundaryTsconfig" scripts/ts-topology.ts scripts/lib/ts-topology scripts/lib/extension-package-boundary.ts`
- `rg -n "writeJsonSchema|generate|emitGatewayFrame|ProtocolSchemas|PROTOCOL_VERSION" scripts/protocol-gen.ts scripts/protocol-gen-swift.ts src/gateway/protocol/schema.js`
