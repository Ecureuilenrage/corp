# OpenClaw Preliminary Repo Map

Generated from the code in `C:\Dev\PRJET\Openclaw\openclaw-main` on `2026-04-08`.

## scope

- Inventory coverage is `12174 / 12174` source-manifest-config files, with `0` unassigned paths in [`analysis/manifests/domain_map.json`](manifests/domain_map.json).
- Source definition used for coverage: code, manifests and automation files with extensions recorded in [`analysis/manifests/domain_map.json`](manifests/domain_map.json), plus root `Dockerfile*` and `Makefile`; Markdown and binary assets are intentionally excluded.
- The repo is a pnpm monorepo rooted at [`package.json`](../package.json) and [`pnpm-workspace.yaml`](../pnpm-workspace.yaml), with major code in [`src/`](../src), [`extensions/`](../extensions), [`ui/`](../ui), [`apps/`](../apps), [`packages/`](../packages), [`scripts/`](../scripts) and [`vendor/a2ui/`](../vendor/a2ui).

## primary tech

- Node.js ESM + TypeScript core runtime: [`openclaw.mjs`](../openclaw.mjs), [`src/entry.ts`](../src/entry.ts), [`src/index.ts`](../src/index.ts), [`src/library.ts`](../src/library.ts)
- pnpm workspace with packaged SDK + extensions: [`packages/plugin-sdk/`](../packages/plugin-sdk), [`extensions/`](../extensions)
- Lit + Vite control UI: [`ui/package.json`](../ui/package.json), [`ui/src/main.ts`](../ui/src/main.ts), [`ui/src/ui/app.ts`](../ui/src/ui/app.ts)
- Swift companions and shared kit: [`apps/shared/OpenClawKit/Package.swift`](../apps/shared/OpenClawKit/Package.swift), [`apps/ios/Sources/OpenClawApp.swift`](../apps/ios/Sources/OpenClawApp.swift), [`apps/macos/Package.swift`](../apps/macos/Package.swift), [`Swabble/Package.swift`](../Swabble/Package.swift)
- Very large plugin surface: bundled channels, provider plugins, memory/media plugins and browser automation under [`extensions/`](../extensions)

## canonical entrypoints

- CLI launcher: [`openclaw.mjs`](../openclaw.mjs)
- TypeScript CLI bootstrap: [`src/entry.ts`](../src/entry.ts)
- Package root export shim: [`src/index.ts`](../src/index.ts)
- Lazy library export surface: [`src/library.ts`](../src/library.ts)
- Gateway boot surface: [`src/gateway/server.ts`](../src/gateway/server.ts) -> [`src/gateway/server.impl.ts`](../src/gateway/server.impl.ts)
- Control UI boot: [`ui/src/main.ts`](../ui/src/main.ts) -> [`ui/src/ui/app.ts`](../ui/src/ui/app.ts)
- Plugin SDK public entry helpers: [`packages/plugin-sdk/src/plugin-entry.ts`](../packages/plugin-sdk/src/plugin-entry.ts), [`packages/plugin-sdk/src/provider-entry.ts`](../packages/plugin-sdk/src/provider-entry.ts)
- iOS app boot: [`apps/ios/Sources/OpenClawApp.swift`](../apps/ios/Sources/OpenClawApp.swift)
- macOS app boot: [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../apps/macos/Sources/OpenClaw/MenuBar.swift)
- macOS CLI boot: [`apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift`](../apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift)

## highest-value hubs

These are the best “start here” files when you need the repo’s real control points.

- [`src/config/config.ts`](../src/config/config.ts): highest indegree hub for runtime configuration and startup fan-in
- [`src/shared/string-coerce.ts`](../src/shared/string-coerce.ts): ubiquitous normalization helper used across core, plugins and UI-adjacent flows
- [`src/plugin-sdk/text-runtime.ts`](../src/plugin-sdk/text-runtime.ts): most reused SDK text/runtime contract for extensions
- [`src/plugin-sdk/config-runtime.ts`](../src/plugin-sdk/config-runtime.ts): shared SDK config/runtime bridge
- [`src/runtime.ts`](../src/runtime.ts): central runtime contract reused across gateway, agents and plugins
- [`src/plugins/types.ts`](../src/plugins/types.ts): main plugin contract hub
- [`src/channels/plugins/types.ts`](../src/channels/plugins/types.ts): channel plugin contract hub
- [`src/routing/session-key.ts`](../src/routing/session-key.ts): session routing hub across gateway and channels
- [`src/agents/pi-embedded-runner/run/attempt.ts`](../src/agents/pi-embedded-runner/run/attempt.ts): deepest agent execution fan-out
- [`src/gateway/server.impl.ts`](../src/gateway/server.impl.ts): widest gateway fan-out and startup coordinator

## manifest set

- [`analysis/manifests/file_inventory.jsonl`](manifests/file_inventory.jsonl): one row per covered source/manifests/config file with batch assignment
- [`analysis/manifests/import_graph.jsonl`](manifests/import_graph.jsonl): per-file import records with internal resolution where possible
- [`analysis/manifests/domain_map.json`](manifests/domain_map.json): source definition, exact file-to-batch map and coverage proof
- [`analysis/manifests/system_summary.json`](manifests/system_summary.json): metrics, entrypoints, workspace metadata and hub summaries
- [`analysis/manifests/feature_catalog.jsonl`](manifests/feature_catalog.jsonl): curated reusable feature shortlist

## batch map

- [`batch-01-core-runtime-cli`](batches/batch-01-core-runtime-cli.md): `2267` files. CLI, config, shared infra, runtime bootstrap.
- [`batch-02-agent-runtime-tools`](batches/batch-02-agent-runtime-tools.md): `1769` files. Embedded agent runtime, tools, auth profiles, auto-reply.
- [`batch-03-gateway-control-plane`](batches/batch-03-gateway-control-plane.md): `991` files. Gateway server, channel runtime wiring, routing and sessions.
- [`batch-04-plugin-platform-sdk`](batches/batch-04-plugin-platform-sdk.md): `875` files. Plugin contracts, SDK helpers, runtime registration.
- [`batch-05-ui-control-surfaces`](batches/batch-05-ui-control-surfaces.md): `318` files. Lit control UI and TUI.
- [`batch-06-extensions-channels`](batches/batch-06-extensions-channels.md): `2620` files. Messaging channel adapters.
- [`batch-07-extensions-providers-memory-media`](batches/batch-07-extensions-providers-memory-media.md): `1623` files. Providers, browser, memory, speech, media.
- [`batch-08-shared-swift-mobile-kit`](batches/batch-08-shared-swift-mobile-kit.md): `427` files. Shared Swift kit, iOS, Android, Swabble.
- [`batch-09-macos-companion`](batches/batch-09-macos-companion.md): `363` files. macOS app, menu bar runtime, approvals, onboarding.
- [`batch-10-tooling-tests-release`](batches/batch-10-tooling-tests-release.md): `768` files. Scripts, Vitest matrix, CI and release automation.
- [`batch-11-vendor-a2ui`](batches/batch-11-vendor-a2ui.md): `153` files. Vendored A2UI specs/renderers/eval tooling.

## recommended deep-dive order

1. [`batch-04-plugin-platform-sdk`](batches/batch-04-plugin-platform-sdk.md)
   Reason: OpenClaw’s extension model is the main reuse seam; this batch explains how channels/providers/tools are actually registered.
2. [`batch-01-core-runtime-cli`](batches/batch-01-core-runtime-cli.md)
   Reason: configuration, CLI and shared infra are the highest-indegree cross-cutting dependencies.
3. [`batch-03-gateway-control-plane`](batches/batch-03-gateway-control-plane.md)
   Reason: most user-visible runtime behavior converges in the gateway server and method handlers.
4. [`batch-02-agent-runtime-tools`](batches/batch-02-agent-runtime-tools.md)
   Reason: agent execution, tool calling, subagents and model failover live here.
5. [`batch-06-extensions-channels`](batches/batch-06-extensions-channels.md)
   Reason: messaging surface reuse depends on understanding the bundled channel pattern.
6. [`batch-07-extensions-providers-memory-media`](batches/batch-07-extensions-providers-memory-media.md)
   Reason: provider adapters, browser automation and memory are major reusable subsystems.
7. [`batch-05-ui-control-surfaces`](batches/batch-05-ui-control-surfaces.md)
   Reason: fastest route to a control console or chat/config UX.
8. [`batch-08-shared-swift-mobile-kit`](batches/batch-08-shared-swift-mobile-kit.md)
   Reason: shared node/mobile kit is reusable, but less central than the TS runtime.
9. [`batch-09-macos-companion`](batches/batch-09-macos-companion.md)
   Reason: highly valuable if you want desktop-local orchestration or approvals.
10. [`batch-10-tooling-tests-release`](batches/batch-10-tooling-tests-release.md)
    Reason: useful once you need repeatable validation, sharding or release workflows.
11. [`batch-11-vendor-a2ui`](batches/batch-11-vendor-a2ui.md)
    Reason: vendor subtree is isolated and usually only matters if you want Canvas/A2UI internals.

## reuse shortcut

- Start with [`analysis/reuse/reuse-candidates.md`](reuse/reuse-candidates.md) when the goal is extraction or adaptation rather than understanding the full repo.
- Start with [`analysis/manifests/feature_catalog.jsonl`](manifests/feature_catalog.jsonl) when you need machine-readable feature candidates for another agent.
