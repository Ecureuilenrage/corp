# Batch 03 - Gateway Control Plane

Scope: `991` files. Main concentration: [`src/gateway/`](../../src/gateway), [`src/channels/`](../../src/channels), [`src/cron/`](../../src/cron), [`src/acp/`](../../src/acp), [`src/routing/`](../../src/routing).

## purpose

This batch is the long-lived control-plane runtime that turns the rest of OpenClaw into an addressable assistant host. It owns HTTP and WebSocket serving, request dispatch, operator/auth envelopes, chat/session fanout, node subscriptions, channel/plugin runtime bridging, control UI serving, and ACP control-plane state.

For extraction work, the important split is between the reusable control-plane kernels and the startup coordinator that glues the entire host together. The cleanest slices here are the request envelope, the node subscription manager, the control-UI static serving pattern, and the session-key routing helpers. The most dangerous area is [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts), which is a nexus for config, secrets, plugins, sessions, channels, cron, discovery, update checks, and UI runtime state.

## entrypoints

- [`src/gateway/server.ts`](../../src/gateway/server.ts): lazy public boot surface for the gateway.
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts): real startup coordinator and highest-leverage gateway file in the batch.
- [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts): RPC dispatcher and core method registry.
- [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts): chat-run, session-subscriber, and agent-event fanout surface.
- [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts): HTTP server, WS server, broadcaster, plugin-route registry pinning, and chat runtime-state assembly.

## key files

- [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts): derives bind/auth/control-UI/Tailscale runtime config and rejects unsafe startup combinations.
- [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts): canonical gateway method/event inventory.
- [`src/gateway/server-ws-runtime.ts`](../../src/gateway/server-ws-runtime.ts): WebSocket handler attachment layer.
- [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts): plugin loading plus internal gateway dispatch bridge for plugin-owned subagents.
- [`src/gateway/server-channels.ts`](../../src/gateway/server-channels.ts): channel lifecycle manager with restart policy and optional plugin runtime helpers.
- [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts): safe static/UI bootstrap serving plus avatar routing.
- [`src/gateway/node-registry.ts`](../../src/gateway/node-registry.ts): connected-node registry and invoke request/response tracking.
- [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts): per-session node subscription map and event fanout helper.
- [`src/channels/plugins/index.ts`](../../src/channels/plugins/index.ts): channel plugin registry and match helper barrel.
- [`src/channels/plugins/types.ts`](../../src/channels/plugins/types.ts): shared channel contract surface.
- [`src/routing/session-key.ts`](../../src/routing/session-key.ts): agent/session-key normalization and translation helpers.
- [`src/acp/control-plane/manager.ts`](../../src/acp/control-plane/manager.ts): ACP session-manager singleton surface.
- [`src/acp/control-plane/manager.core.ts`](../../src/acp/control-plane/manager.core.ts): actual ACP control-plane/session runtime manager.

## data flow

- [`src/gateway/server.ts`](../../src/gateway/server.ts) does almost nothing except lazy-import [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) and expose `startGatewayServer`.
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) reads config snapshots, auto-enables startup plugins, prepares runtime secrets, merges auth/Tailscale overrides, derives runtime bind/auth/UI config, resolves startup plugin IDs, and constructs HTTP/WS runtime state through [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts).
- Runtime state creation pins plugin route/channel registries, creates HTTP servers, attaches plugin and hook HTTP handlers, creates the WebSocket server, and initializes the shared broadcaster, chat-run state, and preauth connection budget.
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) then wires the long-lived pieces: node registry, node subscriptions, session event subscribers, session message subscribers, channel manager, discovery, maintenance timers, cron service, sidecars, plugin fallback context, and WS handlers.
- Requests flow through [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts), which authorizes the method, enforces write budgets for sensitive operations, and dispatches to the merged handler map under a plugin-runtime gateway request scope.
- Session/chat fanout flows through [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts), transcript/session utilities under [`src/gateway/session-*.ts`](../../src/gateway), and node/session event bridges assembled in [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts).
- Channel startup and plugin-owned gateway extensions depend on [`src/gateway/server-channels.ts`](../../src/gateway/server-channels.ts), [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts), and the contracts exported from [`src/channels/plugins/`](../../src/channels/plugins).

## external deps

- `ws` powers the WebSocket server created in [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts).
- Node HTTP and filesystem primitives underpin HTTP serving, static control-UI delivery, and gateway runtime assembly.
- `@mariozechner/pi-coding-agent` is used directly in [`src/gateway/server-methods/chat.ts`](../../src/gateway/server-methods/chat.ts) for session/chat runtime behavior.
- The control UI surface depends on built assets served through [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts).
- Skills RPC reaches remote services such as ClawHub via [`src/gateway/server-methods/skills.ts`](../../src/gateway/server-methods/skills.ts).

## flags/env

- `OPENCLAW_GATEWAY_PORT` is forced inside [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) so downstream runtime derivations use the actual startup port.
- `OPENCLAW_SKIP_CHANNELS` and `OPENCLAW_SKIP_PROVIDERS` are checked in [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) to prune startup secret surfaces.
- `OPENCLAW_TEST_MINIMAL_GATEWAY` gates a reduced test boot path in [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts).
- `OPENCLAW_SKIP_CANVAS_HOST` disables canvas-host exposure through [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts).
- `OPENCLAW_GATEWAY_TOKEN` and `OPENCLAW_GATEWAY_PASSWORD` participate in auth resolution and startup safety checks through [`src/gateway/auth.ts`](../../src/gateway/auth.ts) and [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts).
- Tailscale and control-UI origin safety are coordinated by [`src/gateway/startup-auth.ts`](../../src/gateway/startup-auth.ts), [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts), and [`src/gateway/startup-control-ui-origins.ts`](../../src/gateway/startup-control-ui-origins.ts).

## subdomains

### Gateway bootstrap and runtime assembly

Classification: `runtime central` plus `infra`.

Anchors:

- [`src/gateway/server.ts`](../../src/gateway/server.ts)
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts)
- [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts)
- [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts)
- [`src/gateway/server-close.ts`](../../src/gateway/server-close.ts)
- [`src/gateway/server-startup.ts`](../../src/gateway/server-startup.ts)

This is the orchestration kernel for the whole host. It is powerful but not a good early copy target because it is where config, auth, secrets, plugins, channels, cron, discovery, updates, and UI serving all converge.

### Request dispatch, auth envelope, and method inventory

Classification: `runtime central` plus `glue`.

Anchors:

- [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts)
- [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts)
- [`src/gateway/method-scopes.ts`](../../src/gateway/method-scopes.ts)
- [`src/gateway/role-policy.ts`](../../src/gateway/role-policy.ts)
- [`src/gateway/protocol/index.ts`](../../src/gateway/protocol/index.ts)

This is the cleanest "control-plane shell" in the batch. It turns method names into authorized handler invocations and is much more reusable than the full server bootstrap.

### Chat/session fanout and WS control runtime

Classification: `runtime central`.

Anchors:

- [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts)
- [`src/gateway/server-ws-runtime.ts`](../../src/gateway/server-ws-runtime.ts)
- [`src/gateway/server/ws-connection.ts`](../../src/gateway/server/ws-connection.ts)
- [`src/gateway/session-utils.ts`](../../src/gateway/session-utils.ts)
- [`src/gateway/chat-abort.ts`](../../src/gateway/chat-abort.ts)

This is where the gateway stops being a plain RPC server and becomes a live session/event broker. It tracks active runs, subscribers, tool recipients, transcript updates, and node/client event delivery.

### Plugin/channel bridge and internal gateway dispatch

Classification: `adapters` plus `runtime central`.

Anchors:

- [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts)
- [`src/gateway/server-channels.ts`](../../src/gateway/server-channels.ts)
- [`src/channels/plugins/index.ts`](../../src/channels/plugins/index.ts)
- [`src/channels/plugins/types.ts`](../../src/channels/plugins/types.ts)
- [`src/gateway/server-plugin-bootstrap.ts`](../../src/gateway/server-plugin-bootstrap.ts)

This subdomain hosts two different reuse ideas: channel lifecycle management and internal gateway dispatch for plugins. Both are useful, but both are coupled to active plugin registries and channel contracts.

### Node/device connectivity and subscription plane

Classification: `adapters` plus `infra`.

Anchors:

- [`src/gateway/node-registry.ts`](../../src/gateway/node-registry.ts)
- [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
- [`src/gateway/server-mobile-nodes.ts`](../../src/gateway/server-mobile-nodes.ts)
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts)

This area is smaller and cleaner than the bootstrap core. The node subscription manager is especially extractable because it is just a dual-index fanout structure with almost no host assumptions.

### Control UI static and bootstrap HTTP surface

Classification: `UI` plus `adapters`.

Anchors:

- [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts)
- [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts)
- [`src/gateway/control-ui-routing.ts`](../../src/gateway/control-ui-routing.ts)
- [`src/gateway/control-ui-shared.ts`](../../src/gateway/control-ui-shared.ts)
- [`src/gateway/control-ui-csp.ts`](../../src/gateway/control-ui-csp.ts)

This layer is a portable pattern for serving a browser control plane safely, but it assumes a very specific asset layout and bootstrap contract with the `ui/` package.

### Session-key routing bridge

Classification: `runtime central`.

Anchors:

- [`src/routing/session-key.ts`](../../src/routing/session-key.ts)
- [`src/sessions/session-key-utils.ts`](../../src/sessions/session-key-utils.ts)
- [`src/routing/account-id.ts`](../../src/routing/account-id.ts)

This is one of the better small slices in the batch. It codifies how agent IDs, main keys, peer keys, and thread suffixes are built and normalized across gateway, sessions, and channels.

### ACP control plane and runtime options

Classification: `runtime central`.

Anchors:

- [`src/acp/control-plane/manager.ts`](../../src/acp/control-plane/manager.ts)
- [`src/acp/control-plane/manager.core.ts`](../../src/acp/control-plane/manager.core.ts)
- [`src/acp/control-plane/runtime-options.ts`](../../src/acp/control-plane/runtime-options.ts)
- [`src/acp/control-plane/runtime-cache.ts`](../../src/acp/control-plane/runtime-cache.ts)

This subdomain is sizeable and cohesive, but it is only reusable if the target host also wants OpenClaw-like ACP sessions and runtime handles.

## feature inventory

### Gateway bootstrap coordinator

- Goal: build a running control-plane server from config snapshots, auth/secrets state, plugin startup, channel lifecycle, sidecars, maintenance timers, and WS runtime.
- Open first: [`src/gateway/server.ts`](../../src/gateway/server.ts), [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts), [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts), [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts)
- Pivot symbols: `startGatewayServer`, `GatewayServerOptions`, `resolveGatewayRuntimeConfig`, `createGatewayRuntimeState`, `createGatewayCloseHandler`, `startGatewaySidecars`
- Strictly required modules: config snapshot IO, gateway auth/runtime-config resolution, secrets runtime activation, plugin startup/bootstrap, channel manager, HTTP/WS runtime state
- Dangerous couplings: startup writes config, mutates env, pins active plugin registries, prepares runtime secret snapshots, seeds control-UI allowed origins, starts discovery/update/tailscale/canvas/cron sidecars
- Reuse strategy: `reecrire`

### Request dispatch envelope

- Goal: authorize RPC methods, apply write-rate budgets, wrap handler execution in a gateway request scope, and dispatch to core or extra handlers.
- Open first: [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts), [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts), [`src/gateway/method-scopes.ts`](../../src/gateway/method-scopes.ts)
- Pivot symbols: `coreGatewayHandlers`, `handleGatewayRequest`, `listGatewayMethods`, `GATEWAY_EVENTS`
- Strictly required modules: handler map assembly, role/scope policy, protocol error helpers, plugin runtime gateway request scope
- Dangerous couplings: method names, scope names, and write-rate-limited methods are product decisions, not generic infrastructure defaults
- Reuse strategy: `adapter`

### Chat/session broadcast plane

- Goal: maintain active chat runs and deliver transcript, tool, and agent events to the correct WS clients and subscribed nodes.
- Open first: [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts), [`src/gateway/server-ws-runtime.ts`](../../src/gateway/server-ws-runtime.ts), [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts)
- Pivot symbols: `createChatRunRegistry`, `createChatRunState`, `createSessionEventSubscriberRegistry`, `createSessionMessageSubscriberRegistry`, `createToolEventRecipientRegistry`, `createAgentEventHandler`, `attachGatewayWsHandlers`
- Strictly required modules: WS connection layer, session/transcript utilities, agent event stream, node send functions, request context
- Dangerous couplings: direct dependency on `@mariozechner/pi-coding-agent`, session transcript shape, auto-reply dispatch, media offload, and OpenClaw-specific chat protocols
- Reuse strategy: `adapter`

### Plugin/channel gateway bridge

- Goal: load gateway-aware plugins, expose internal gateway dispatch to plugin-owned subagents, and manage channel accounts with restart/bootstrap hooks.
- Open first: [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts), [`src/gateway/server-channels.ts`](../../src/gateway/server-channels.ts), [`src/channels/plugins/index.ts`](../../src/channels/plugins/index.ts), [`src/channels/plugins/types.ts`](../../src/channels/plugins/types.ts)
- Pivot symbols: `loadGatewayPlugins`, `createGatewaySubagentRuntime`, `setFallbackGatewayContextResolver`, `createChannelManager`, `listChannelPlugins`, `getChannelPlugin`
- Strictly required modules: plugin loader/runtime, active plugin registry pinning, channel registry/contracts, session-key routing helpers, channel runtime helpers
- Dangerous couplings: global fallback gateway context singleton, active plugin registry pinning, startup-only plugin selection, and real plugin runtime surfaces
- Reuse strategy: `adapter`

### Node registry and session subscriptions

- Goal: track connected nodes, invoke node commands over WS, and fan events only to nodes subscribed to a given session.
- Open first: [`src/gateway/node-registry.ts`](../../src/gateway/node-registry.ts), [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
- Pivot symbols: `NodeRegistry`, `createNodeSubscriptionManager`
- Strictly required modules: only the gateway WS client shape for `NodeRegistry`; the subscription manager itself has no meaningful dependency beyond JSON serialization
- Dangerous couplings: event names such as `node.invoke.request` and node session metadata are gateway-protocol-specific
- Reuse strategy: `copier` for `createNodeSubscriptionManager`, `adapter` for `NodeRegistry`

### Control UI static server and bootstrap contract

- Goal: serve the browser control UI safely, with CSP, bootstrap JSON, base-path routing, avatar indirection, and SPA fallback.
- Open first: [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts), [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts), [`src/gateway/control-ui-routing.ts`](../../src/gateway/control-ui-routing.ts), [`src/gateway/control-ui-shared.ts`](../../src/gateway/control-ui-shared.ts)
- Pivot symbols: `handleControlUiAvatarRequest`, `handleControlUiHttpRequest`
- Strictly required modules: boundary-safe file open helpers, CSP builder, base-path routing helpers, assistant identity/avatar resolution
- Dangerous couplings: assumes a specific built asset tree, a specific bootstrap JSON contract, and OpenClaw avatar/identity semantics
- Reuse strategy: `adapter`

### Tools catalog and skills control-plane handlers

- Goal: expose operator-facing RPC for tool inventory, skills status/search/detail, and skill install/update flows.
- Open first: [`src/gateway/server-methods/tools-catalog.ts`](../../src/gateway/server-methods/tools-catalog.ts), [`src/gateway/server-methods/skills.ts`](../../src/gateway/server-methods/skills.ts)
- Pivot symbols: `buildToolsCatalogResult`, `toolsCatalogHandlers`, `skillsHandlers`
- Strictly required modules: agent/workspace resolution, core tool catalog, plugin tool resolution, ClawHub client helpers, config writes for `skills.update`
- Dangerous couplings: `skills.install` and `skills.update` mutate local workspace/config state; tool grouping assumes OpenClaw's tool catalog and plugin metadata
- Reuse strategy: `adapter`

### Session-key routing helpers

- Goal: normalize agent IDs and translate among request keys, store keys, peer keys, main keys, and thread-session suffixes.
- Open first: [`src/routing/session-key.ts`](../../src/routing/session-key.ts), [`src/sessions/session-key-utils.ts`](../../src/sessions/session-key-utils.ts)
- Pivot symbols: `normalizeMainKey`, `toAgentRequestSessionKey`, `toAgentStoreSessionKey`, `resolveAgentIdFromSessionKey`, `buildAgentMainSessionKey`, `buildAgentPeerSessionKey`, `buildGroupHistoryKey`, `resolveThreadSessionKeys`
- Strictly required modules: account-id normalization and the shared parser in [`src/sessions/session-key-utils.ts`](../../src/sessions/session-key-utils.ts)
- Dangerous couplings: the key shape is a repository-wide contract; partial extraction causes subtle incompatibilities between sessions, gateway, and channels
- Reuse strategy: `adapter`

### ACP session manager and runtime options

- Goal: run ACP-backed sessions with runtime caching, actor-queued turns, runtime option normalization, and observability over ACP session state.
- Open first: [`src/acp/control-plane/manager.ts`](../../src/acp/control-plane/manager.ts), [`src/acp/control-plane/manager.core.ts`](../../src/acp/control-plane/manager.core.ts), [`src/acp/control-plane/runtime-options.ts`](../../src/acp/control-plane/runtime-options.ts)
- Pivot symbols: `getAcpSessionManager`, `AcpSessionManager`, `normalizeRuntimeOptions`, `mergeRuntimeOptions`, `buildRuntimeControlSignature`
- Strictly required modules: ACP runtime types, session identity helpers, runtime cache, task executor, routing/session-key helpers, ACP runtime error boundary helpers
- Dangerous couplings: this is tightly coupled to OpenClaw ACP session metadata, task lifecycle, runtime cache eviction, and ACP runtime-handle semantics
- Reuse strategy: `reecrire`

## symbol map

### Bootstrap and runtime-state assembly

- [`src/gateway/server.ts`](../../src/gateway/server.ts): `startGatewayServer`
- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts): `GatewayServer`, `GatewayServerOptions`, `startGatewayServer`
- [`src/gateway/server-runtime-config.ts`](../../src/gateway/server-runtime-config.ts): `GatewayRuntimeConfig`, `resolveGatewayRuntimeConfig`
- [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts): `createGatewayRuntimeState`
- [`src/gateway/server-close.ts`](../../src/gateway/server-close.ts): `createGatewayCloseHandler`
- [`src/gateway/server-startup.ts`](../../src/gateway/server-startup.ts): `startGatewaySidecars`

### Request dispatch and method inventory

- [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts): `coreGatewayHandlers`, `handleGatewayRequest`
- [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts): `listGatewayMethods`, `GATEWAY_EVENTS`
- [`src/gateway/server-methods/tools-catalog.ts`](../../src/gateway/server-methods/tools-catalog.ts): `buildToolsCatalogResult`, `toolsCatalogHandlers`
- [`src/gateway/server-methods/skills.ts`](../../src/gateway/server-methods/skills.ts): `skillsHandlers`

### Chat, WS, and node event delivery

- [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts): `createChatRunRegistry`, `createChatRunState`, `createSessionEventSubscriberRegistry`, `createSessionMessageSubscriberRegistry`, `createToolEventRecipientRegistry`, `createAgentEventHandler`
- [`src/gateway/server-ws-runtime.ts`](../../src/gateway/server-ws-runtime.ts): `attachGatewayWsHandlers`
- [`src/gateway/node-registry.ts`](../../src/gateway/node-registry.ts): `NodeRegistry`
- [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts): `createNodeSubscriptionManager`

### Plugin/channel bridge and routing

- [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts): `setFallbackGatewayContext`, `setFallbackGatewayContextResolver`, `setPluginSubagentOverridePolicies`, `createGatewaySubagentRuntime`, `loadGatewayPlugins`
- [`src/gateway/server-channels.ts`](../../src/gateway/server-channels.ts): `createChannelManager`
- [`src/channels/plugins/index.ts`](../../src/channels/plugins/index.ts): `getChannelPlugin`, `getLoadedChannelPlugin`, `listChannelPlugins`, `resolveChannelEntryMatch`, `resolveChannelMatchConfig`
- [`src/channels/plugins/types.ts`](../../src/channels/plugins/types.ts): `ChannelId`, `ChannelPlugin`, `ChannelMessageCapability`
- [`src/routing/session-key.ts`](../../src/routing/session-key.ts): `DEFAULT_AGENT_ID`, `DEFAULT_MAIN_KEY`, `normalizeMainKey`, `toAgentRequestSessionKey`, `toAgentStoreSessionKey`, `resolveAgentIdFromSessionKey`, `buildAgentMainSessionKey`, `buildAgentPeerSessionKey`, `buildGroupHistoryKey`, `resolveThreadSessionKeys`

### UI and ACP surfaces

- [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts): `ControlUiRootState`, `handleControlUiAvatarRequest`, `handleControlUiHttpRequest`
- [`src/acp/control-plane/manager.ts`](../../src/acp/control-plane/manager.ts): `getAcpSessionManager`, `__testing`
- [`src/acp/control-plane/manager.core.ts`](../../src/acp/control-plane/manager.core.ts): `AcpSessionManager`
- [`src/acp/control-plane/runtime-options.ts`](../../src/acp/control-plane/runtime-options.ts): `validateRuntimeOptionPatch`, `normalizeRuntimeOptions`, `mergeRuntimeOptions`, `resolveRuntimeOptionsFromMeta`, `buildRuntimeControlSignature`

## dependency map

### Internal dependencies you must carry together

- Bootstrap orchestration depends on config snapshot IO, auth resolution, secrets runtime snapshots, plugin startup/bootstrap, channel runtime management, HTTP/WS runtime-state creation, close-handling, and a large tail of maintenance/discovery/startup helpers.
- Request dispatch depends on method-scope policy, role policy, protocol validators/error shapes, and the plugin-runtime gateway request scope so plugin-owned subagents can dispatch back through the gateway.
- Chat/session fanout depends on transcript/session utilities, agent event emitters, WS connection handlers, node send functions, and the chat/session model imported by [`src/gateway/server-methods/chat.ts`](../../src/gateway/server-methods/chat.ts).
- Plugin/channel bridging depends on active plugin registry pinning, gateway plugin bootstrap, channel plugin registry/contracts, channel runtime helpers, and session-key routing.
- Control UI serving depends on control-UI asset root resolution, safe/boundary file opening, CSP hashing, assistant identity resolution, and the shared base-path/avatar contract with the `ui` package.
- ACP control-plane code depends on ACP runtime types, session-identity helpers, task execution, runtime cache, and session metadata conventions.

### External dependencies

- `ws` is a hard dependency for the current WS control plane.
- Node HTTP/filesystem primitives are hard dependencies for runtime-state assembly and control-UI serving.
- `@mariozechner/pi-coding-agent` is effectively a hard dependency for the current chat/session handler stack.
- Remote skills/search flows depend on ClawHub-related helpers.

### Runtime and singleton assumptions

- Gateway startup mutates `process.env.OPENCLAW_GATEWAY_PORT` and reads many runtime globals directly.
- Active plugin route/channel registries are pinned globally during runtime-state creation.
- Fallback gateway context in [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts) is held in a global singleton so non-WS paths can still dispatch gateway methods.
- Startup behavior assumes secrets runtime snapshots, auth bootstrap, session migration, and plugin auto-enable can all run in-process before the server starts serving requests.

### Glue you can rewrite

- Method tables in [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts) and [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts) are host-specific inventories and should usually be regenerated rather than copied wholesale.
- Discovery, update checks, Tailscale exposure, canvas host, and startup session migration are orchestration glue, not part of a reusable minimal gateway kernel.
- Most handler files under [`src/gateway/server-methods/`](../../src/gateway/server-methods) are application endpoints, not generic framework code.

## extraction recipes

### Recipe A - extract the request-dispatch shell

- Carry: [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts), [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts), [`src/gateway/method-scopes.ts`](../../src/gateway/method-scopes.ts), [`src/gateway/role-policy.ts`](../../src/gateway/role-policy.ts)
- Keep together: `handleGatewayRequest`, `coreGatewayHandlers` replacement, method inventory, auth/scope envelope, write-budget hooks
- Replace with shims: the actual handler map, protocol validators, and plugin request-scope integration if your host does not use the same plugin runtime
- Best use: a control plane that already has its own business handlers but needs a clear request authorization and dispatch envelope
- Strategy: `adapter`

### Recipe B - extract the node subscription manager

- Carry: [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
- Keep together: `createNodeSubscriptionManager`
- Replace with shims: event names and any custom payload serializer if you do not want JSON.stringify on send
- Best use: multi-node or multi-client hosts that need per-session fanout without introducing a broker
- Strategy: `copier`

### Recipe C - extract the session-key routing helper pack

- Carry: [`src/routing/session-key.ts`](../../src/routing/session-key.ts), [`src/sessions/session-key-utils.ts`](../../src/sessions/session-key-utils.ts), [`src/routing/account-id.ts`](../../src/routing/account-id.ts)
- Keep together: `toAgentRequestSessionKey`, `toAgentStoreSessionKey`, `buildAgentMainSessionKey`, `buildAgentPeerSessionKey`, `resolveThreadSessionKeys`
- Replace with shims: your own chat-type/account-id normalization rules if they differ
- Best use: agentic systems that need stable keys across gateway requests, background sessions, thread branches, and per-agent storage
- Strategy: `adapter`

### Recipe D - extract the control-UI static server

- Carry: [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts), [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts), [`src/gateway/control-ui-routing.ts`](../../src/gateway/control-ui-routing.ts), [`src/gateway/control-ui-shared.ts`](../../src/gateway/control-ui-shared.ts), [`src/gateway/control-ui-csp.ts`](../../src/gateway/control-ui-csp.ts)
- Keep together: bootstrap config route, avatar route, CSP handling, SPA fallback, base-path normalization
- Replace with shims: assistant identity/avatar policy and the concrete location of built assets
- Best use: a local operator console that must be served by the same process as the control plane
- Strategy: `adapter`

### Recipe E - extract the plugin subagent dispatch bridge

- Carry: [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts) selectively
- Keep together: `createGatewaySubagentRuntime`, fallback gateway context setter, synthetic operator client creation, dispatch wrapper
- Replace with shims: plugin loader, active registry handling, model-override policy, and handler dispatch integration
- Best use: hosts where plugin-owned code needs to call back into control-plane RPC without exposing raw internal objects
- Strategy: `adapter`

## do not copy blindly

- [`src/gateway/server.impl.ts`](../../src/gateway/server.impl.ts) is the worst blind-copy target in the batch. It mixes startup config writes, secret activation, plugin registry pinning, discovery, cron, WS, UI, node, and maintenance concerns.
- [`src/gateway/server-runtime-state.ts`](../../src/gateway/server-runtime-state.ts) pins active plugin route and channel registries globally. Copying only half of that behavior creates subtle runtime leaks.
- [`src/gateway/server-plugins.ts`](../../src/gateway/server-plugins.ts) uses global singleton fallback context and plugin subagent override policy state. This is safe only if you also keep the same lifecycle assumptions.
- [`src/gateway/server-chat.ts`](../../src/gateway/server-chat.ts) depends on the OpenClaw chat/session model, transcript rewriting, media storage, and agent runtime semantics. It is a design reference more than a copy target.
- [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts) only works safely if you also preserve boundary-safe file open helpers and the expected UI asset layout.
- [`src/routing/session-key.ts`](../../src/routing/session-key.ts) defines a contract that is reused across gateway, channels, and session storage. Partial extraction without updating all call sites creates hard-to-debug mismatches.
- [`src/gateway/server-methods/skills.ts`](../../src/gateway/server-methods/skills.ts) installs skills and mutates config. Copying it into another host without reviewing trust and write policies is dangerous.
- [`src/acp/control-plane/manager.core.ts`](../../src/acp/control-plane/manager.core.ts) is large, stateful, and tightly coupled to ACP runtime/session identity logic. Treat it as architecture source material unless the target host also adopts ACP.

## minimal reusable slices

### Slice: node subscription manager

- Paths: [`src/gateway/server-node-subscriptions.ts`](../../src/gateway/server-node-subscriptions.ts)
- Central symbols: `createNodeSubscriptionManager`
- Why minimal: it is almost standalone and already implements the right dual-index data structure for session-based fanout
- Strategy: `copier`

### Slice: session-key routing pack

- Paths: [`src/routing/session-key.ts`](../../src/routing/session-key.ts), [`src/sessions/session-key-utils.ts`](../../src/sessions/session-key-utils.ts), [`src/routing/account-id.ts`](../../src/routing/account-id.ts)
- Central symbols: `toAgentRequestSessionKey`, `toAgentStoreSessionKey`, `buildAgentPeerSessionKey`, `resolveThreadSessionKeys`
- Why minimal: it solves a real cross-cutting problem and is much smaller than the surrounding gateway/session runtime
- Strategy: `adapter`

### Slice: request-dispatch envelope

- Paths: [`src/gateway/server-methods.ts`](../../src/gateway/server-methods.ts), [`src/gateway/server-methods-list.ts`](../../src/gateway/server-methods-list.ts), [`src/gateway/method-scopes.ts`](../../src/gateway/method-scopes.ts)
- Central symbols: `handleGatewayRequest`, `listGatewayMethods`, `GATEWAY_EVENTS`
- Why minimal: it gives another host a clean control-plane envelope without forcing full OpenClaw startup orchestration
- Strategy: `adapter`

### Slice: control-UI static serving shell

- Paths: [`src/gateway/control-ui.ts`](../../src/gateway/control-ui.ts), [`src/gateway/control-ui-routing.ts`](../../src/gateway/control-ui-routing.ts), [`src/gateway/control-ui-shared.ts`](../../src/gateway/control-ui-shared.ts)
- Central symbols: `handleControlUiHttpRequest`, `handleControlUiAvatarRequest`
- Why minimal: useful when the host process must serve a local operator UI and enforce its own CSP/base-path rules
- Strategy: `adapter`

### Slice: tools catalog handler

- Paths: [`src/gateway/server-methods/tools-catalog.ts`](../../src/gateway/server-methods/tools-catalog.ts)
- Central symbols: `buildToolsCatalogResult`, `toolsCatalogHandlers`
- Why minimal: small handler surface that can be transplanted if the new host already has a core tool catalog and plugin tool metadata
- Strategy: `adapter`

## exact search shortcuts

- `rg "startGatewayServer|resolveGatewayRuntimeConfig|createGatewayRuntimeState|startGatewaySidecars" src/gateway`
- `rg "handleGatewayRequest|coreGatewayHandlers|listGatewayMethods|GATEWAY_EVENTS" src/gateway`
- `rg "createChatRunState|createSessionEventSubscriberRegistry|createSessionMessageSubscriberRegistry|createAgentEventHandler" src/gateway/server-chat.ts src/gateway`
- `rg "createGatewaySubagentRuntime|loadGatewayPlugins|createChannelManager|listChannelPlugins" src/gateway src/channels/plugins`
- `rg "createNodeSubscriptionManager|class NodeRegistry|node.invoke.request" src/gateway`
- `rg "handleControlUiHttpRequest|handleControlUiAvatarRequest|CONTROL_UI_BOOTSTRAP_CONFIG_PATH" src/gateway`
- `rg "toAgentStoreSessionKey|buildAgentPeerSessionKey|resolveThreadSessionKeys|normalizeMainKey" src/routing src/sessions`
- `rg "AcpSessionManager|normalizeRuntimeOptions|buildRuntimeControlSignature" src/acp/control-plane`
