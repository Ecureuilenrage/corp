# Reuse Candidates

Cross-batch refresh for future reuse work from `openclaw-main`.

This pass re-checked the real code behind the candidate seams, not only the batch docs. The ranking below is optimized for one question:

`If I want one precise OpenClaw capability from this repo, which files and symbols should I inspect first, and which couplings should I avoid importing into a target project?`

Validated against:

- [`analysis/index.md`](../index.md)
- all batch docs under [`analysis/batches/`](../batches)
- [`analysis/manifests/feature_catalog.jsonl`](../manifests/feature_catalog.jsonl)
- [`analysis/manifests/import_graph.jsonl`](../manifests/import_graph.jsonl)
- direct code reads in the source tree under [`src/`](../../src), [`ui/`](../../ui), [`extensions/`](../../extensions), and [`qa/`](../../qa)

## quick corrections from the code

- There is no self-contained graph+YAML workflow engine inside this repo. The closest real seam is the Lobster adapter in [`extensions/lobster/src/lobster-runner.ts`](../../extensions/lobster/src/lobster-runner.ts), but the actual workflow engine is loaded dynamically from the installed `@clawdbot/lobster` package.
- The smallest reusable workflow-shaped assets that do live in this repo are the managed task-flow state shell in [`src/tasks/`](../../src/tasks) and the markdown-backed YAML scenario pack in [`qa/scenarios/`](../../qa/scenarios).
- The full embedded agent runtime centered on [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts) is still a `reecrire` target, not a first-copy target.
- The full gateway bootstrap centered on [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) is still a `reecrire` target, not a reusable kernel.

## need to first brick map

- Workflow engine based on graphs + YAML: start with item 10, but expect a rewrite of the engine itself.
- Node registry + executors: start with item 4.
- Provider abstraction: start with items 2 and 3.
- WebSocket/session execution layer: start with item 7.
- Function calling / tool dispatch: start with item 6.
- Frontend console to drive workflows: start with item 8.
- Schema/config registry: start with items 2 and 9.
- YAML examples/templates: start with item 10.
- Agent runtime minimal: see the rewrite-first section after the top 10.

## top 10 extraction bricks

### 1. Session-key routing bridge

- Need covered: stable agent/session identity across gateway, channels, threads, and future subagents.
- Read first:
  - [`src/routing/session-key.ts`](../../src/routing/session-key.ts)
  - [`src/sessions/session-key-utils.ts`](../../src/sessions/session-key-utils.ts)
  - [`src/routing/account-id.ts`](../../src/routing/account-id.ts)
- Critical symbols:
  - `toAgentRequestSessionKey`
  - `toAgentStoreSessionKey`
  - `resolveAgentIdFromSessionKey`
  - `buildAgentMainSessionKey`
  - `buildAgentPeerSessionKey`
  - `resolveThreadSessionKeys`
  - `parseAgentSessionKey`
- Minimal dependencies:
  - [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts)
  - [`src/routing/account-id.ts`](../../src/routing/account-id.ts)
  - optionally [`src/channels/chat-type.ts`](../../src/channels/chat-type.ts) if you keep thread/group helpers untouched
- Couplings to avoid:
  - [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts)
  - [`src/gateway/session-utils.ts`](../../src/gateway/session-utils.ts)
  - channel-specific routing managers under [`extensions/*/`](../../extensions)
- Coupling: `medium-low`
- Strategy: `adapter`
- Why first: this is the cleanest cross-batch identity seam in the repo, and many later extractions become easier once the session-key grammar is stabilized locally.

### 2. Generic plugin entry DSL plus config-schema kernel

- Need covered: minimal extension boundary and minimal schema/config contract for plugins or providers.
- Read first:
  - [`src/plugin-sdk/plugin-entry.ts`](../../src/plugin-sdk/plugin-entry.ts)
  - [`src/plugin-sdk/lazy-value.ts`](../../src/plugin-sdk/lazy-value.ts)
  - [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts)
  - [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Critical symbols:
  - `definePluginEntry`
  - `createCachedLazyValueGetter`
  - `buildPluginConfigSchema`
  - `emptyPluginConfigSchema`
  - `OpenClawPluginDefinition`
  - `OpenClawPluginApi`
  - `OpenClawPluginConfigSchema`
- Minimal dependencies:
  - `zod`
  - a local replacement for the small subset of contracts currently imported from [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Couplings to avoid:
  - the full contract hub in [`src/plugins/types.ts`](../../src/plugins/types.ts)
  - the runtime facade in [`src/plugins/runtime/index.ts`](../../src/plugins/runtime/index.ts)
  - the global registry state in [`src/plugins/runtime.ts`](../../src/plugins/runtime.ts)
- Coupling: `medium`
- Strategy: `adapter`
- Why first: this is still the smallest author-facing seam that gives a target project a clean extension declaration story without pulling in gateway bootstrap or runtime singletons.

### 3. Single-provider abstraction shell

- Need covered: minimal provider abstraction with auth metadata, env-var discovery, and a provider catalog hook.
- Read first:
  - [`src/plugin-sdk/provider-entry.ts`](../../src/plugin-sdk/provider-entry.ts)
  - [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts)
  - [`src/plugins/provider-api-key-auth.ts`](../../src/plugins/provider-api-key-auth.ts)
  - [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Critical symbols:
  - `defineSingleProviderPluginEntry`
  - `resolveWizardSetup`
  - `resolveEnvVars`
  - `createProviderApiKeyAuthMethod`
  - `buildSingleProviderApiKeyCatalog`
  - `ProviderAuthMethod`
  - `ProviderCatalogContext`
  - `ProviderCatalogResult`
  - `ProviderPluginCatalog`
- Minimal dependencies:
  - item 2
  - a reduced provider contract extracted from [`src/plugins/types.ts`](../../src/plugins/types.ts)
- Couplings to avoid:
  - auth-profile persistence under [`src/agents/auth-profiles/`](../../src/agents/auth-profiles)
  - provider-specific runtime overlays under [`extensions/openai/`](../../extensions/openai), [`extensions/google/`](../../extensions/google), [`extensions/xai/`](../../extensions/xai), [`extensions/anthropic/`](../../extensions/anthropic)
  - model-config assumptions inside [`src/plugin-sdk/provider-catalog-shared.ts`](../../src/plugin-sdk/provider-catalog-shared.ts)
- Coupling: `medium-high`
- Strategy: `adapter`
- Why first: this is the best code-confirmed starting point for "provider abstraction minimale" without inheriting the whole OpenClaw model or auth stack.

### 4. Node registry plus subscription plane, with executors as a second wave

- Need covered: connected node tracking, node invoke requests, and session-scoped fanout.
- Read first:
  - [`src/gateway/node-registry.ts`](../../src/gateway/node-registry.ts)
  - [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
- Read second if you truly need executors:
  - [`src/node-host/plugin-node-host.ts`](../../src/node-host/plugin-node-host.ts)
  - [`src/node-host/invoke.ts`](../../src/node-host/invoke.ts)
  - [`src/node-host/invoke-types.ts`](../../src/node-host/invoke-types.ts)
  - [`src/node-host/runner.ts`](../../src/node-host/runner.ts)
- Critical symbols:
  - `NodeRegistry`
  - `register`
  - `unregister`
  - `invoke`
  - `handleInvokeResult`
  - `createNodeSubscriptionManager`
  - `ensureNodeHostPluginRegistry`
  - `listRegisteredNodeHostCapsAndCommands`
  - `invokeRegisteredNodeHostCommand`
  - `handleInvoke`
  - `buildNodeInvokeResultParams`
- Minimal dependencies:
  - [`src/gateway/server/ws-types.ts`](../../src/gateway/server/ws-types.ts) for `NodeRegistry`
  - JSON serialization and timers for [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
- Couplings to avoid:
  - [`src/node-host/invoke-system-run.ts`](../../src/node-host/invoke-system-run.ts)
  - exec-approval policy under [`src/infra/exec-approvals.ts`](../../src/infra/exec-approvals.ts)
  - full runtime bootstrap through [`src/node-host/runner.ts`](../../src/node-host/runner.ts)
  - plugin-registry loading if you only need a neutral node registry
- Coupling: `medium` for registry/subscriptions, `high` for executors
- Strategy:
  - `copier` for [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
  - `adapter` for [`src/gateway/node-registry.ts`](../../src/gateway/node-registry.ts)
  - `reecrire` or heavy `adapter` for the executor side
- Why first: the dual-index subscription manager is one of the cleanest small kernels in the whole repo, while the executor side is only worth adding after the control plane contract is already stable.

### 5. Gateway request-dispatch envelope

- Need covered: minimal server-side RPC/control-plane dispatch layer.
- Read first:
  - [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts)
  - [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts)
  - [`src/gateway/method-scopes.ts`](../../src/gateway/method-scopes.ts)
  - [`src/gateway/role-policy.ts`](../../src/gateway/role-policy.ts)
  - [`src/gateway/server-methods/types.ts`](../../src/gateway/server-methods/types.ts)
- Critical symbols:
  - `authorizeGatewayMethod`
  - `coreGatewayHandlers`
  - `handleGatewayRequest`
  - `listGatewayMethods`
  - `GATEWAY_EVENTS`
  - `GatewayRequestContext`
  - `GatewayRequestHandler`
- Minimal dependencies:
  - [`src/gateway/protocol/index.ts`](../../src/gateway/protocol/index.ts)
  - [`src/plugins/runtime/gateway-request-scope.ts`](../../src/plugins/runtime/gateway-request-scope.ts)
  - [`src/gateway/control-plane-rate-limit.ts`](../../src/gateway/control-plane-rate-limit.ts)
- Couplings to avoid:
  - [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts)
  - the full handler inventory if the target project only needs a much smaller method map
  - OpenClaw operator scope names as-is if your auth model differs
- Coupling: `medium-high`
- Strategy: `adapter`
- Why first: this is the cleanest reusable control-plane shell in batch 03, and it stays much smaller than the full gateway server.

### 6. Function-calling and tool-dispatch bridge

- Need covered: minimal function calling, tool schema adaptation, and one-shot HTTP tool dispatch without the full embedded run loop.
- Read first:
  - [`src/gateway/tools-invoke-http.ts`](../../src/gateway/tools-invoke-http.ts)
  - [`src/gateway/tool-resolution.ts`](../../src/gateway/tool-resolution.ts)
  - [`src/agents/tools/common.ts`](../../src/agents/tools/common.ts)
  - [`src/agents/pi-tool-definition-adapter.ts`](../../src/agents/pi-tool-definition-adapter.ts)
  - [`src/agents/pi-embedded-runner/tool-schema-runtime.ts`](../../src/agents/pi-embedded-runner/tool-schema-runtime.ts)
- Critical symbols:
  - `handleToolsInvokeHttpRequest`
  - `resolveGatewayScopedTools`
  - `ToolInputError`
  - `ToolAuthorizationError`
  - `textResult`
  - `jsonResult`
  - `toToolDefinitions`
  - `toClientToolDefinitions`
  - `normalizeProviderToolSchemas`
  - `logProviderToolSchemaDiagnostics`
- Minimal dependencies:
  - an `AnyAgentTool`-compatible host contract
  - [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts) only if you want OpenClaw's stock inventory
  - [`src/gateway/http-utils.ts`](../../src/gateway/http-utils.ts) and config loading only if you keep the HTTP surface
- Couplings to avoid:
  - [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts) as your first import if all you need is tool dispatch
  - [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts)
  - shared-secret gateway auth assumptions in [`src/gateway/tools-invoke-http.ts`](../../src/gateway/tools-invoke-http.ts)
- Coupling: `medium-high`
- Strategy: `adapter`
- Why first: the code confirms a real split between "tool dispatch bridge" and the much larger attempt/runtime loop. For a target project, this is the right boundary to study before touching the full runner.

### 7. WebSocket plus session execution layer

- Need covered: live session fanout, request/response WS plumbing, and session-scoped subscribers.
- Read first:
  - [`src/gateway/server/ws-connection.ts`](../../src/gateway/server/ws-connection.ts)
  - [`src/gateway/server-ws-runtime.ts`](../../src/gateway/server-ws-runtime.ts)
  - [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts)
  - [`src/gateway/client.ts`](../../src/gateway/client.ts)
- Critical symbols:
  - `attachGatewayWsConnectionHandler`
  - `attachGatewayWsHandlers`
  - `createChatRunRegistry`
  - `createChatRunState`
  - `createSessionEventSubscriberRegistry`
  - `createSessionMessageSubscriberRegistry`
  - `createToolEventRecipientRegistry`
  - `createAgentEventHandler`
  - `GatewayClient`
- Minimal dependencies:
  - `ws`
  - gateway protocol event names
  - request context types from [`src/gateway/server-methods/types.ts`](../../src/gateway/server-methods/types.ts)
- Couplings to avoid:
  - [`src/gateway/session-utils.ts`](../../src/gateway/session-utils.ts)
  - [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts)
  - direct transcript semantics from the full agent runtime if you only need generic session fanout
- Coupling: `high`
- Strategy: `adapter`
- Why first: this is the minimal code-confirmed place to study OpenClaw's "session execution layer" without swallowing the full gateway bootstrap.

### 8. Frontend console minimale

- Need covered: browser console to drive workflows or sessions without pulling the whole OpenClaw UI.
- Read first:
  - [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts)
  - [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts)
  - [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts)
  - [`extensions/qa-lab/web/src/app.ts`](../../extensions/qa-lab/web/src/app.ts)
  - [`extensions/qa-lab/web/src/ui-render.ts`](../../extensions/qa-lab/web/src/ui-render.ts)
- Critical symbols:
  - `GatewayBrowserClient`
  - `GatewayRequestError`
  - `shouldRetryWithDeviceToken`
  - `loadControlUiBootstrapConfig`
  - `createQaLabApp`
  - `renderQaLabUi`
- Minimal dependencies:
  - [`ui/src/ui/device-auth.ts`](../../ui/src/ui/device-auth.ts)
  - [`ui/src/ui/device-identity.ts`](../../ui/src/ui/device-identity.ts)
  - [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts)
  - browser `fetch`, `WebSocket`, and `crypto.subtle`
- Couplings to avoid:
  - [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts)
  - [`ui/src/ui/app-render.ts`](../../ui/src/ui/app-render.ts)
  - [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts)
  - all operator panels under [`ui/src/ui/views/`](../../ui/src/ui/views) if the goal is only a workflow-driving console
- Coupling: `medium-high`
- Strategy: `adapter`
- Why first: the browser gateway client is the best transport seam, while QA Lab already demonstrates a much smaller task/report UI than the full control console.

### 9. Schema and config registry minimal

- Need covered: minimal schema/config registry and plugin discovery metadata.
- Read first:
  - [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts)
  - [`src/plugins/manifest-registry.ts`](../../src/plugins/manifest-registry.ts)
  - [`src/plugins/setup-registry.ts`](../../src/plugins/setup-registry.ts)
- Critical symbols:
  - `buildPluginConfigSchema`
  - `emptyPluginConfigSchema`
  - `loadPluginManifestRegistry`
  - `resolveManifestContractPluginIds`
  - `resolveManifestContractOwnerPluginId`
  - `PluginManifestRecord`
  - `resolvePluginSetupRegistry`
  - `resolvePluginSetupProvider`
  - `clearPluginSetupRegistryCache`
- Minimal dependencies:
  - `zod` for [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts)
  - `jiti`, discovery, manifest parsing, and loader aliasing for [`src/plugins/setup-registry.ts`](../../src/plugins/setup-registry.ts)
- Couplings to avoid:
  - [`src/config/io.ts`](../../src/config/io.ts)
  - the full plugin runtime bootstrap
  - treating [`src/plugins/manifest-registry.ts`](../../src/plugins/manifest-registry.ts) as a "small registry"; it is already a policy-heavy discovery layer
- Coupling: `medium-high`
- Strategy:
  - `copier` for [`src/plugins/config-schema.ts`](../../src/plugins/config-schema.ts)
  - `adapter` for [`src/plugins/manifest-registry.ts`](../../src/plugins/manifest-registry.ts)
  - `adapter` or `reecrire` for [`src/plugins/setup-registry.ts`](../../src/plugins/setup-registry.ts)
- Why first: the code confirms a real split between a tiny schema kernel and two much larger discovery/setup registries. That split matters if a target project wants just enough plugin metadata without inheriting OpenClaw's config pipeline.

### 10. Managed task-flow shell plus reusable YAML templates

- Need covered: the closest code-confirmed workflow reuse story in the repo.
- Read first:
  - [`src/tasks/task-flow-registry.types.ts`](../../src/tasks/task-flow-registry.types.ts)
  - [`src/tasks/task-flow-registry.ts`](../../src/tasks/task-flow-registry.ts)
  - [`src/tasks/task-executor.ts`](../../src/tasks/task-executor.ts)
  - [`extensions/lobster/src/lobster-taskflow.ts`](../../extensions/lobster/src/lobster-taskflow.ts)
  - [`extensions/lobster/src/lobster-runner.ts`](../../extensions/lobster/src/lobster-runner.ts)
  - [`extensions/qa-lab/src/scenario-catalog.ts`](../../extensions/qa-lab/src/scenario-catalog.ts)
  - [`qa/scenarios/index.md`](../../qa/scenarios/index.md)
  - [`qa/scenarios/subagent-fanout-synthesis.md`](../../qa/scenarios/subagent-fanout-synthesis.md)
  - [`qa/scenarios/lobster-invaders-build.md`](../../qa/scenarios/lobster-invaders-build.md)
  - [`docs/tools/lobster.md`](../../docs/tools/lobster.md)
- Critical symbols:
  - `TaskFlowRecord`
  - `TaskFlowStatus`
  - `deriveTaskFlowStatusFromTask`
  - `createTaskFlowForTask`
  - `updateFlowRecordByIdExpectedRevision`
  - `requestFlowCancel`
  - `runManagedLobsterFlow`
  - `resumeManagedLobsterFlow`
  - `createEmbeddedLobsterRunner`
  - `resolveLobsterCwd`
  - `readQaScenarioPack`
  - `readQaBootstrapScenarioCatalog`
  - `readQaScenarioById`
  - `QA_PACK_FENCE_RE`
  - `QA_SCENARIO_FENCE_RE`
- Minimal dependencies:
  - task-flow store/runtime internals under [`src/tasks/`](../../src/tasks)
  - `yaml` and `zod` for the QA scenario pack
  - `@clawdbot/lobster` for the actual Lobster workflow engine path
- Couplings to avoid:
  - assuming the workflow engine itself lives in this repo
  - relying on [`extensions/lobster/README.md`](../../extensions/lobster/README.md) as the source of truth when the code in [`extensions/lobster/src/lobster-runner.ts`](../../extensions/lobster/src/lobster-runner.ts) says otherwise
  - dragging the whole task runtime if all you need is the markdown+YAML scenario format
- Coupling: `medium-high` for the flow shell, `high` for the Lobster engine boundary
- Strategy:
  - `adapter` for the managed task-flow shell
  - `copier` for the QA markdown+YAML template format
  - `reecrire` for any true graph+YAML engine you want to own inside the target project
- Why first: this is the closest code-confirmed answer to "workflow engine + YAML + reusable templates," but the repo only contains the OpenClaw-side shell, not the full engine.

## important but not a first-copy brick

### Agent runtime minimal

- Status: `reecrire`
- Read first:
  - [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts)
  - [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts)
  - [`src/agents/pi-tools.ts`](../../src/agents/pi-tools.ts)
  - [`src/acp/control-plane/manager.ts`](../../src/acp/control-plane/manager.ts) if ACP compatibility matters
- Critical symbols:
  - `runEmbeddedPiAgent`
  - `backfillSessionKey`
  - `runEmbeddedAttempt`
  - `resolveToolLoopDetectionConfig`
  - `getAcpSessionManager`
  - `AcpSessionManager`
- Why it stays out of the top 10 first extractions:
  - [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts) is the highest-outdegree file in the import graph.
  - The attempt loop depends directly on `@mariozechner/pi-coding-agent`, prompt builders, provider stream selection, transcript repair, tool schema normalization, sandbox policy, session write locks, and plugin runtime contributions.
  - The outer coordinator in [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts) is cleaner than the attempt loop, but it still assumes OpenClaw auth profiles, model selection, runtime plugins, lane scheduling, and compaction behavior.
- Practical recommendation:
  - extract items 1, 3, 6, and 7 first
  - then design a smaller target-project-native runtime loop
  - use [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts) and [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts) as architecture references, not as copy targets

## transverse technical hubs

### hubs worth treating as boundaries

- [`src/config/config.ts`](../../src/config/config.ts): highest indegree in the repo. Pulling this in means accepting the whole OpenClaw config shape very quickly.
- [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts): high-fanout but low-risk helper hub. Often worth copying locally instead of importing indirectly through larger modules.
- [`src/plugins/types.ts`](../../src/plugins/types.ts): the main contract mega-hub. Avoid dragging it wholesale into the target project; carve smaller local contracts instead.
- [`src/routing/session-key.ts`](../../src/routing/session-key.ts): identity hub. If the target project wants OpenClaw-compatible session naming, this is the foundational seam.
- [`src/plugins/manifest-registry.ts`](../../src/plugins/manifest-registry.ts): discovery-policy hub. Useful, but already much more than a plain registry.
- [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts): frontend transport hub. Strong seam, but it bakes in OpenClaw's hello/auth envelope.

### hubs to avoid as first extraction targets

- [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts): highest outdegree file in the repo.
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts): gateway startup nexus for config, secrets, plugins, WS, UI, discovery, maintenance, and sidecars.
- [`src/gateway/session-utils.ts`](../../src/gateway/session-utils.ts): session/transcript-heavy aggregation hub.
- [`src/config/io.ts`](../../src/config/io.ts): looks central, but it hides validation, migration, manifest checks, runtime snapshots, and write-back policy.
- [`src/node-host/invoke.ts`](../../src/node-host/invoke.ts): mixes secure execution policy, approval flows, output capture, and plugin command dispatch.

## recurring dangerous couplings

- The contract hub coupling:
  - [`src/plugins/types.ts`](../../src/plugins/types.ts)
  - Danger: one import quietly brings in provider, gateway, channel, media, and runtime contracts.
- The startup coordinator coupling:
  - [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts)
  - Danger: looks like an easy "server entrypoint," but it is actually the whole host.
- The embedded-runtime coupling:
  - [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts)
  - Danger: prompt system, tool loop, providers, sessions, sandbox, MCP, and transcript repair all meet here.
- The config pipeline coupling:
  - [`src/config/io.ts`](../../src/config/io.ts)
  - Danger: you inherit repo-wide filesystem and validation policy, not just parsing.
- The external workflow-engine boundary:
  - [`extensions/lobster/src/lobster-runner.ts`](../../extensions/lobster/src/lobster-runner.ts)
  - Danger: the real engine is outside the repo in `@clawdbot/lobster`.

## prompts that still deserve a dedicated follow-up batch

- `batch-07` sub-batch: Lobster embedded adapter versus external engine boundary
  - Focus files:
    - [`extensions/lobster/src/lobster-runner.ts`](../../extensions/lobster/src/lobster-runner.ts)
    - [`extensions/lobster/src/lobster-taskflow.ts`](../../extensions/lobster/src/lobster-taskflow.ts)
    - [`extensions/lobster/src/lobster-tool.ts`](../../extensions/lobster/src/lobster-tool.ts)
  - Why: current batch coverage is enough to spot the seam, but not enough to design a safe extraction plan for the external `@clawdbot/lobster` runtime.

- `batch-07` sub-batch: QA Lab scenario pack plus mini-console
  - Focus files:
    - [`extensions/qa-lab/src/scenario-catalog.ts`](../../extensions/qa-lab/src/scenario-catalog.ts)
    - [`extensions/qa-lab/web/src/app.ts`](../../extensions/qa-lab/web/src/app.ts)
    - [`extensions/qa-lab/web/src/ui-render.ts`](../../extensions/qa-lab/web/src/ui-render.ts)
    - [`qa/scenarios/`](../../qa/scenarios)
  - Why: this is one of the best workflow-template seams in the repo, but it is not currently isolated as its own dedicated extraction doc.

- `batch-03` sub-batch: WS handshake, auth envelope, and sequence/stateVersion semantics
  - Focus files:
    - [`src/gateway/server/ws-connection.ts`](../../src/gateway/server/ws-connection.ts)
    - [`src/gateway/client.ts`](../../src/gateway/client.ts)
    - [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts)
    - [`src/gateway/protocol/`](../../src/gateway/protocol)
  - Why: compatibility here will depend on exact frame semantics, not just on high-level "use websockets".

- `batch-02` and `batch-03` cross-batch: minimal tool dispatch versus full agent runtime
  - Focus files:
    - [`src/gateway/tools-invoke-http.ts`](../../src/gateway/tools-invoke-http.ts)
    - [`src/gateway/tool-resolution.ts`](../../src/gateway/tool-resolution.ts)
    - [`src/agents/pi-tool-definition-adapter.ts`](../../src/agents/pi-tool-definition-adapter.ts)
    - [`src/agents/tools/common.ts`](../../src/agents/tools/common.ts)
    - [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts)
  - Why: this is the highest-value place to split "tool bridge" from "full runner," and it deserves its own prompt.

- `batch-04` sub-batch: manifest/setup registry minimization
  - Focus files:
    - [`src/plugins/manifest-registry.ts`](../../src/plugins/manifest-registry.ts)
    - [`src/plugins/setup-registry.ts`](../../src/plugins/setup-registry.ts)
    - [`src/plugins/discovery.ts`](../../src/plugins/discovery.ts)
    - [`src/plugins/manifest.ts`](../../src/plugins/manifest.ts)
  - Why: the current docs identify the seam, but not yet the smallest safe subset for a target project.

- `batch-02` sub-batch: rewrite plan for a minimal embedded runtime in a target project
  - Focus files:
    - [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts)
    - [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts)
    - [`src/agents/pi-tools.ts`](../../src/agents/pi-tools.ts)
    - [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts)
  - Why: this should be treated as an architecture-translation prompt, not as a copy prompt.

## current bottom line

- Best first extractions from `openclaw-main`:
  - session-key routing
  - plugin entry DSL
  - provider entry DSL
  - node subscription plane
  - tool-dispatch bridge
- Best "read but do not copy first" zones:
  - full gateway bootstrap
  - full embedded attempt loop
  - full config IO pipeline
  - Lobster engine internals beyond the adapter boundary
- Best reusable templates:
  - [`qa/scenarios/index.md`](../../qa/scenarios/index.md)
  - [`qa/scenarios/subagent-fanout-synthesis.md`](../../qa/scenarios/subagent-fanout-synthesis.md)
  - [`qa/scenarios/lobster-invaders-build.md`](../../qa/scenarios/lobster-invaders-build.md)
