# Batch 05 - UI Control Surfaces

Scope: `318` files. Main concentration: [`ui/src/ui/`](../../ui/src/ui), [`ui/src/i18n/`](../../ui/src/i18n), [`src/tui/`](../../src/tui).

## purpose

This batch covers the operator-facing browser and terminal surfaces that sit on top of the gateway. For extraction work, the important split is between transport clients, state-sync glue, schema-driven editors, and presentation-heavy shells.

The best seams are the browser gateway client in [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts), the bootstrap loader in [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts), the schema-analysis and config-form stack under [`ui/src/ui/views/config-form.*`](../../ui/src/ui/views), the slash-command and browser speech helpers under [`ui/src/ui/chat/`](../../ui/src/ui/chat), and the TUI gateway client in [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts). The most dangerous files are [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts), [`ui/src/ui/app-render.ts`](../../ui/src/ui/app-render.ts), [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts), and [`src/tui/tui.ts`](../../src/tui/tui.ts), because each one fuses transport state, persistence, navigation, and rendering.

## entrypoints

- [`ui/src/main.ts`](../../ui/src/main.ts): browser boot entry.
- [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts): Lit app shell that owns almost all browser control state.
- [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts): bootstrap fetch for assistant identity and base-path aware control-UI metadata.
- [`src/tui/tui.ts`](../../src/tui/tui.ts): terminal UI root and event loop.
- [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts): gateway-backed RPC and event client for the TUI.

## key files

- [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts): bounded browser WebSocket client with device identity, device-token retry, RPC request tracking, and reconnect policy.
- [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts): event-to-state synchronizer for chat, presence, approvals, sessions, health, and update notifications.
- [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts): smallest control-UI-specific bootstrap seam.
- [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts): mutable config state shell for schema, raw text, hashes, and save/apply flows.
- [`ui/src/ui/views/config.ts`](../../ui/src/ui/views/config.ts): config page wrapper that scopes sections, computes diffs, and delegates actual field rendering.
- [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts): JSON-schema normalization layer that turns gateway schemas into a form-renderable subset.
- [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts): schema-driven field renderer and search-aware section filter.
- [`ui/src/ui/controllers/chat.ts`](../../ui/src/ui/controllers/chat.ts): browser chat state mutation shell for history, send, abort, and incoming event handling.
- [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts): large chat surface with attachment handling, slash menu, search, pinning, deletion, and export.
- [`ui/src/ui/chat/slash-command-executor.ts`](../../ui/src/ui/chat/slash-command-executor.ts): client-side slash-command execution engine over gateway RPC.
- [`ui/src/ui/chat/slash-commands.ts`](../../ui/src/ui/chat/slash-commands.ts): metadata bridge from builtin chat commands to UI completions.
- [`ui/src/ui/chat/speech.ts`](../../ui/src/ui/chat/speech.ts): browser-native STT and TTS facade.
- [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts): TUI RPC client and gateway auth resolution.
- [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts): slash-like command router for the TUI.
- [`src/tui/tui-event-handlers.ts`](../../src/tui/tui-event-handlers.ts): event stream assembler and terminal-side run lifecycle handling.
- [`src/tui/tui-session-actions.ts`](../../src/tui/tui-session-actions.ts): TUI-side session and agent refresh logic.

## data flow

- Browser startup begins in [`ui/src/main.ts`](../../ui/src/main.ts), which loads the control UI shell in [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts).
- The app shell resolves onboarding mode in `resolveOnboardingMode`, loads persisted settings, and pushes rendering into [`ui/src/ui/app-render.ts`](../../ui/src/ui/app-render.ts).
- Browser gateway transport lives in [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts). `GatewayBrowserClient` opens the WebSocket, sends the `hello` envelope, manages request promises, and retries auth with a stored device token when `shouldRetryWithDeviceToken` allows it.
- [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts) wraps that client for the app shell: `connectGateway` attaches callbacks, `handleGatewayEvent` fans events into the right controllers, and `applySnapshot` seeds initial presence, health, and session defaults.
- Config flows are split between mutable state in [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts) and rendering logic in [`ui/src/ui/views/config.ts`](../../ui/src/ui/views/config.ts), [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts), and [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts).
- Browser chat flows split similarly: [`ui/src/ui/controllers/chat.ts`](../../ui/src/ui/controllers/chat.ts) owns history/send/abort/event mutation while [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts) and [`ui/src/ui/chat/`](../../ui/src/ui/chat) render grouped messages, slash menus, tool cards, exports, and browser speech affordances.
- TUI startup in [`src/tui/tui.ts`](../../src/tui/tui.ts) resolves the initial agent and session key, creates [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts), then composes handlers from [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts), [`src/tui/tui-event-handlers.ts`](../../src/tui/tui-event-handlers.ts), and [`src/tui/tui-session-actions.ts`](../../src/tui/tui-session-actions.ts).

## external deps

- Browser UI depends on [`ui/package.json`](../../ui/package.json), especially `lit`, `vite`, `marked`, `dompurify`, and `@create-markdown/preview`.
- Browser chat rendering also depends on browser globals such as `WebSocket`, `navigator.language`, `navigator.userAgent`, `speechSynthesis`, `SpeechRecognition`, `crypto.subtle`, `window.localStorage`, and `navigator.clipboard`.
- The TUI depends on `@mariozechner/pi-tui`, imported directly in [`src/tui/tui.ts`](../../src/tui/tui.ts) and [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts).
- Both browser and TUI surfaces depend on shared gateway protocol contracts under [`src/gateway/`](../../src/gateway) and session-key helpers under [`src/routing/session-key.ts`](../../src/routing/session-key.ts).

## flags/env

- `?onboarding=1` is parsed by `resolveOnboardingMode` in [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts).
- `window.__OPENCLAW_CONTROL_UI_BASE_PATH__` influences control-UI routing and bootstrap fetches in [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts) and [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts).
- Device identity and device-token retry in [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts) only work in secure browser contexts where `crypto.subtle` is available.
- TUI gateway auth resolution in [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts) reads gateway config and supports `OPENCLAW_GATEWAY_TOKEN` and `OPENCLAW_GATEWAY_PASSWORD` via the shared gateway auth resolvers.

## subdomains

### Browser app shell and tab composition

Classification: `UI` plus `glue`.

Anchors:

- [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts)
- [`ui/src/ui/app-render.ts`](../../ui/src/ui/app-render.ts)
- [`ui/src/ui/app-lifecycle.ts`](../../ui/src/ui/app-lifecycle.ts)
- [`ui/src/ui/app-settings.ts`](../../ui/src/ui/app-settings.ts)

This is the highest-level browser shell. It is valuable for understanding how all panels compose, but it is not the right extraction boundary because it centralizes persisted settings, gateway status, chat state, config state, nodes, skills, sessions, usage, and visual layout.

### Browser gateway client and event sync

Classification: `runtime central` plus `adapters`.

Anchors:

- [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts)
- [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts)
- [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts)
- [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts)

This subdomain contains the cleanest browser-side transport seam. The core split is between the generic WebSocket/RPC client in `GatewayBrowserClient`, the control-UI-specific event reducer in `connectGateway` and `handleGatewayEvent`, and the small bootstrap JSON fetcher in `loadControlUiBootstrapConfig`.

### Schema-driven config editor stack

Classification: `UI` plus `glue`.

Anchors:

- [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts)
- [`ui/src/ui/views/config.ts`](../../ui/src/ui/views/config.ts)
- [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts)
- [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts)
- [`ui/src/ui/views/config-form.node.ts`](../../ui/src/ui/views/config-form.node.ts)
- [`ui/src/ui/views/config-form.shared.ts`](../../ui/src/ui/views/config-form.shared.ts)

This is the strongest browser-only reuse seam. It converts gateway schema snapshots into a searchable form UI and keeps raw-text editing as a fallback when schemas are partially unsupported.

### Browser chat transcript, slash commands, and speech affordances

Classification: `UI` plus `glue`.

Anchors:

- [`ui/src/ui/controllers/chat.ts`](../../ui/src/ui/controllers/chat.ts)
- [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts)
- [`ui/src/ui/chat/slash-command-executor.ts`](../../ui/src/ui/chat/slash-command-executor.ts)
- [`ui/src/ui/chat/slash-commands.ts`](../../ui/src/ui/chat/slash-commands.ts)
- [`ui/src/ui/chat/grouped-render.ts`](../../ui/src/ui/chat/grouped-render.ts)
- [`ui/src/ui/chat/speech.ts`](../../ui/src/ui/chat/speech.ts)

This subdomain is presentation-heavy, but it contains a few bounded slices: slash-command metadata, slash-command local execution over RPC, browser STT/TTS wrappers, and grouped message rendering helpers.

### Operator panels for skills, nodes, approvals, sessions, and usage

Classification: `UI` plus `glue`.

Anchors:

- [`ui/src/ui/controllers/skills.ts`](../../ui/src/ui/controllers/skills.ts)
- [`ui/src/ui/views/skills.ts`](../../ui/src/ui/views/skills.ts)
- [`ui/src/ui/controllers/nodes.ts`](../../ui/src/ui/controllers/nodes.ts)
- [`ui/src/ui/controllers/exec-approvals.ts`](../../ui/src/ui/controllers/exec-approvals.ts)
- [`ui/src/ui/views/nodes.ts`](../../ui/src/ui/views/nodes.ts)
- [`ui/src/ui/views/nodes-exec-approvals.ts`](../../ui/src/ui/views/nodes-exec-approvals.ts)
- [`ui/src/ui/views/sessions.ts`](../../ui/src/ui/views/sessions.ts)
- [`ui/src/ui/views/usage.ts`](../../ui/src/ui/views/usage.ts)

These panels are mostly thin control surfaces over gateway RPC methods. They are useful if a future host wants the same operator affordances, but they are more OpenClaw-specific than the transport or config seams.

### TUI gateway client and terminal session runtime

Classification: `runtime central` plus `UI`.

Anchors:

- [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts)
- [`src/tui/tui.ts`](../../src/tui/tui.ts)
- [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts)
- [`src/tui/tui-event-handlers.ts`](../../src/tui/tui-event-handlers.ts)
- [`src/tui/tui-session-actions.ts`](../../src/tui/tui-session-actions.ts)

This is the terminal-side mirror of the browser transport and session control logic. The clean seam is `GatewayChatClient`; the dangerous seam is the full `runTui` assembly because it owns layout, lifecycle, keyboard handling, overlays, local shell, and gateway coupling.

## feature inventory

### Browser gateway WebSocket client with device identity retry

- Goal: reusable browser RPC client that negotiates gateway auth, tracks in-flight requests, detects sequence gaps, and retries once with a stored device token on trusted endpoints.
- Open first: [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts), [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts)
- Pivot symbols: `GatewayBrowserClient`, `GatewayRequestError`, `shouldRetryWithDeviceToken`, `resolveGatewayErrorDetailCode`, `isNonRecoverableAuthError`, `connectGateway`, `handleGatewayEvent`, `applySnapshot`
- Strictly required modules: [`ui/src/ui/device-auth.ts`](../../ui/src/ui/device-auth.ts), [`ui/src/ui/device-identity.ts`](../../ui/src/ui/device-identity.ts), [`src/gateway/protocol/client-info.js`](../../src/gateway/protocol/client-info.js), [`src/gateway/protocol/connect-error-details.js`](../../src/gateway/protocol/connect-error-details.js)
- Dangerous coupling: assumes the OpenClaw `hello` envelope, operator role/scopes, browser-local device identity signing, and `stateVersion`/`seq` event semantics
- Strategy: `adapter`

### Control-UI bootstrap identity loader

- Goal: fetch one small bootstrap JSON file and apply assistant identity plus base-path-aware metadata before the socket finishes connecting.
- Open first: [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts)
- Pivot symbols: `loadControlUiBootstrapConfig`, `ControlUiBootstrapState`
- Strictly required modules: [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts), [`ui/src/ui/assistant-identity.ts`](../../ui/src/ui/assistant-identity.ts), [`ui/src/ui/navigation.ts`](../../ui/src/ui/navigation.ts)
- Dangerous coupling: assumes the gateway serves `CONTROL_UI_BOOTSTRAP_CONFIG_PATH` and the browser surface owns `basePath`
- Strategy: `copier`

### Schema analyzer and config-form renderer

- Goal: turn runtime JSON schema snapshots into an editable subset, preserve unsupported-path warnings, and render searchable sectioned forms.
- Open first: [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts), [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts), [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts)
- Pivot symbols: `analyzeConfigSchema`, `renderConfigForm`, `SECTION_META`, `applyConfigSchema`, `applyConfigSnapshot`, `updateConfigFormValue`, `removeConfigFormValue`, `ensureAgentConfigEntry`
- Strictly required modules: [`ui/src/ui/views/config-form.node.ts`](../../ui/src/ui/views/config-form.node.ts), [`ui/src/ui/views/config-form.shared.ts`](../../ui/src/ui/views/config-form.shared.ts), [`ui/src/ui/controllers/config/form-utils.ts`](../../ui/src/ui/controllers/config/form-utils.ts), [`ui/src/ui/controllers/config/form-coerce.ts`](../../ui/src/ui/controllers/config/form-coerce.ts)
- Dangerous coupling: assumes OpenClaw's schema hints, section taxonomy, raw/hash snapshot protocol, and gateway methods `config.get`, `config.schema`, `config.set`, `config.apply`, `update.run`
- Strategy: `adapter`

### Chat slash-command model and browser speech facade

- Goal: support local slash-command execution, completion metadata, grouped transcript rendering, and optional browser-native STT/TTS.
- Open first: [`ui/src/ui/chat/slash-command-executor.ts`](../../ui/src/ui/chat/slash-command-executor.ts), [`ui/src/ui/chat/slash-commands.ts`](../../ui/src/ui/chat/slash-commands.ts), [`ui/src/ui/chat/speech.ts`](../../ui/src/ui/chat/speech.ts)
- Pivot symbols: `executeSlashCommand`, `SlashCommandResult`, `SLASH_COMMANDS`, `getSlashCommandCompletions`, `parseSlashCommand`, `startStt`, `stopStt`, `speakText`, `stopTts`, `renderMessageGroup`, `renderStreamingGroup`
- Strictly required modules: [`src/auto-reply/commands-registry.shared.js`](../../src/auto-reply/commands-registry.shared.js), [`src/auto-reply/commands-registry.types.js`](../../src/auto-reply/commands-registry.types.js), [`ui/src/ui/chat/message-extract.ts`](../../ui/src/ui/chat/message-extract.ts), [`ui/src/ui/chat/tool-cards.ts`](../../ui/src/ui/chat/tool-cards.ts)
- Dangerous coupling: slash commands assume OpenClaw RPC names like `sessions.patch`, `sessions.compact`, `agents.list`, and `chat.abort`; speech helpers assume browser APIs and markdown conventions from the chat renderer
- Strategy: `adapter`

### Skills, exec approvals, sessions, and node panels

- Goal: provide operator panels that wrap gateway RPC with minimal local state and expose filtering, status tabs, and editable approval policies.
- Open first: [`ui/src/ui/controllers/skills.ts`](../../ui/src/ui/controllers/skills.ts), [`ui/src/ui/controllers/exec-approvals.ts`](../../ui/src/ui/controllers/exec-approvals.ts), [`ui/src/ui/views/skills.ts`](../../ui/src/ui/views/skills.ts), [`ui/src/ui/views/nodes-exec-approvals.ts`](../../ui/src/ui/views/nodes-exec-approvals.ts), [`ui/src/ui/views/sessions.ts`](../../ui/src/ui/views/sessions.ts)
- Pivot symbols: `loadSkills`, `searchClawHub`, `loadClawHubDetail`, `installSkill`, `installFromClawHub`, `loadExecApprovals`, `saveExecApprovals`, `resolveExecApprovalsState`, `renderExecApprovals`, `renderSkills`, `renderSessions`
- Strictly required modules: gateway methods for `skills.*`, `node.list`, `exec.approvals.*`, `sessions.list`, plus UI helper files under [`ui/src/ui/views/skills-shared.ts`](../../ui/src/ui/views/skills-shared.ts) and [`ui/src/ui/views/nodes-shared.ts`](../../ui/src/ui/views/nodes-shared.ts)
- Dangerous coupling: ClawHub-specific marketplace flows, gateway-side approvals schema, and OpenClaw session metadata shape
- Strategy: `adapter`

### TUI gateway client and command/session shell

- Goal: terminal-side gateway client with explicit auth resolution plus reusable command, session-refresh, and event-stream handling around one chat log surface.
- Open first: [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts), [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts), [`src/tui/tui-event-handlers.ts`](../../src/tui/tui-event-handlers.ts), [`src/tui/tui-session-actions.ts`](../../src/tui/tui-session-actions.ts)
- Pivot symbols: `GatewayChatClient`, `resolveGatewayConnection`, `createCommandHandlers`, `createEventHandlers`, `createSessionActions`, `resolveTuiSessionKey`, `resolveInitialTuiAgentId`, `resolveGatewayDisconnectState`
- Strictly required modules: [`src/gateway/client.js`](../../src/gateway/client.js), [`src/gateway/call.js`](../../src/gateway/call.js), [`src/gateway/auth-surface-resolution.js`](../../src/gateway/auth-surface-resolution.js), [`src/routing/session-key.js`](../../src/routing/session-key.js), [`@mariozechner/pi-tui`](../../package.json)
- Dangerous coupling: OpenClaw gateway RPC names, TUI component contracts, agent/session naming conventions, and config-backed auth resolution
- Strategy: `adapter`

## symbol map

### Browser gateway and bootstrap

- [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts): `GatewayBrowserClient`, `GatewayRequestError`, `resolveGatewayErrorDetailCode`, `isNonRecoverableAuthError`, `shouldRetryWithDeviceToken`, `CONTROL_UI_OPERATOR_ROLE`, `CONTROL_UI_OPERATOR_SCOPES`
- [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts): `connectGateway`, `handleGatewayEvent`, `applySnapshot`, `resolveControlUiClientVersion`
- [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts): `loadControlUiBootstrapConfig`, `ControlUiBootstrapState`

### Config editor stack

- [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts): `ConfigState`, `loadConfig`, `loadConfigSchema`, `applyConfigSchema`, `applyConfigSnapshot`, `saveConfig`, `applyConfig`, `runUpdate`, `updateConfigFormValue`, `removeConfigFormValue`, `findAgentConfigEntryIndex`, `ensureAgentConfigEntry`, `openConfigFile`
- [`ui/src/ui/views/config.ts`](../../ui/src/ui/views/config.ts): `ConfigProps`, `renderConfig`, `resetConfigViewStateForTests`
- [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts): `ConfigSchemaAnalysis`, `analyzeConfigSchema`
- [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts): `ConfigFormProps`, `SECTION_META`, `renderConfigForm`

### Chat and transcript surface

- [`ui/src/ui/controllers/chat.ts`](../../ui/src/ui/controllers/chat.ts): `ChatState`, `ChatEventPayload`, `loadChatHistory`, `sendChatMessage`, `abortChatRun`, `handleChatEvent`
- [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts): `ChatProps`, `renderChat`, `resetChatViewState`, `cleanupChatModuleState`
- [`ui/src/ui/chat/slash-command-executor.ts`](../../ui/src/ui/chat/slash-command-executor.ts): `SlashCommandResult`, `SlashCommandContext`, `executeSlashCommand`
- [`ui/src/ui/chat/slash-commands.ts`](../../ui/src/ui/chat/slash-commands.ts): `SlashCommandCategory`, `SlashCommandDef`, `SLASH_COMMANDS`, `CATEGORY_LABELS`, `getSlashCommandCompletions`, `parseSlashCommand`
- [`ui/src/ui/chat/grouped-render.ts`](../../ui/src/ui/chat/grouped-render.ts): `renderReadingIndicatorGroup`, `renderStreamingGroup`, `renderMessageGroup`, `SKIP_DELETE_CONFIRM_KEY`
- [`ui/src/ui/chat/message-extract.ts`](../../ui/src/ui/chat/message-extract.ts): `extractText`, `extractTextCached`, `extractThinking`, `extractThinkingCached`, `extractRawText`, `formatReasoningMarkdown`
- [`ui/src/ui/chat/tool-cards.ts`](../../ui/src/ui/chat/tool-cards.ts): `extractToolCards`, `renderToolCardSidebar`
- [`ui/src/ui/chat/speech.ts`](../../ui/src/ui/chat/speech.ts): `isSttSupported`, `startStt`, `stopStt`, `isSttActive`, `isTtsSupported`, `speakText`, `stopTts`, `isTtsSpeaking`
- [`ui/src/ui/chat/export.ts`](../../ui/src/ui/chat/export.ts): `exportChatMarkdown`, `buildChatMarkdown`

### Operator panels

- [`ui/src/ui/controllers/skills.ts`](../../ui/src/ui/controllers/skills.ts): `SkillsState`, `setClawHubSearchQuery`, `loadSkills`, `updateSkillEdit`, `updateSkillEnabled`, `saveSkillApiKey`, `installSkill`, `searchClawHub`, `loadClawHubDetail`, `closeClawHubDetail`, `installFromClawHub`
- [`ui/src/ui/views/skills.ts`](../../ui/src/ui/views/skills.ts): `SkillsProps`, `SkillsStatusFilter`, `renderSkills`
- [`ui/src/ui/controllers/nodes.ts`](../../ui/src/ui/controllers/nodes.ts): `NodesState`, `loadNodes`
- [`ui/src/ui/controllers/exec-approvals.ts`](../../ui/src/ui/controllers/exec-approvals.ts): `ExecApprovalsFile`, `ExecApprovalsSnapshot`, `ExecApprovalsTarget`, `loadExecApprovals`, `applyExecApprovalsSnapshot`, `saveExecApprovals`, `updateExecApprovalsFormValue`, `removeExecApprovalsFormValue`
- [`ui/src/ui/views/nodes.ts`](../../ui/src/ui/views/nodes.ts): `NodesProps`, `renderNodes`
- [`ui/src/ui/views/nodes-exec-approvals.ts`](../../ui/src/ui/views/nodes-exec-approvals.ts): `resolveExecApprovalsState`, `renderExecApprovals`
- [`ui/src/ui/views/sessions.ts`](../../ui/src/ui/views/sessions.ts): `SessionsProps`, `renderSessions`
- [`ui/src/ui/views/usage.ts`](../../ui/src/ui/views/usage.ts): `renderUsage`

### TUI transport and session shell

- [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts): `GatewayConnectionOptions`, `ChatSendOptions`, `GatewayEvent`, `GatewaySessionList`, `GatewayAgentsList`, `GatewayModelChoice`, `GatewayChatClient`, `resolveGatewayConnection`
- [`src/tui/tui.ts`](../../src/tui/tui.ts): `resolveTuiSessionKey`, `resolveInitialTuiAgentId`, `resolveGatewayDisconnectState`, `createBackspaceDeduper`, `isIgnorableTuiStopError`, `stopTuiSafely`, `drainAndStopTuiSafely`, `resolveCtrlCAction`, `runTui`
- [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts): `createCommandHandlers`
- [`src/tui/tui-event-handlers.ts`](../../src/tui/tui-event-handlers.ts): `createEventHandlers`
- [`src/tui/tui-session-actions.ts`](../../src/tui/tui-session-actions.ts): `createSessionActions`

## dependency map

### Internal dependencies you really need

- Browser gateway extraction depends on [`src/gateway/protocol/client-info.js`](../../src/gateway/protocol/client-info.js), [`src/gateway/protocol/connect-error-details.js`](../../src/gateway/protocol/connect-error-details.js), [`src/gateway/device-auth.js`](../../src/gateway/device-auth.js), and the local browser helpers in [`ui/src/ui/device-auth.ts`](../../ui/src/ui/device-auth.ts) and [`ui/src/ui/device-identity.ts`](../../ui/src/ui/device-identity.ts).
- Config-form extraction depends on [`ui/src/ui/views/config-form.shared.ts`](../../ui/src/ui/views/config-form.shared.ts), [`ui/src/ui/views/config-form.node.ts`](../../ui/src/ui/views/config-form.node.ts), [`ui/src/ui/controllers/config/form-utils.ts`](../../ui/src/ui/controllers/config/form-utils.ts), and [`ui/src/ui/controllers/config/form-coerce.ts`](../../ui/src/ui/controllers/config/form-coerce.ts).
- Slash-command extraction depends on the builtin command registry in [`src/auto-reply/commands-registry.shared.js`](../../src/auto-reply/commands-registry.shared.js) plus session and thinking helpers in [`ui/src/ui/session-key.ts`](../../ui/src/ui/session-key.ts) and [`ui/src/ui/thinking.ts`](../../ui/src/ui/thinking.ts).
- TUI extraction depends on the gateway client and auth resolution modules under [`src/gateway/`](../../src/gateway), the routing helpers in [`src/routing/session-key.js`](../../src/routing/session-key.js), and multiple TUI-local helper modules such as [`src/tui/tui-formatters.ts`](../../src/tui/tui-formatters.ts) and [`src/tui/tui-stream-assembler.ts`](../../src/tui/tui-stream-assembler.ts).

### External dependencies

- Browser UI: `lit`, `marked`, `dompurify`, `@create-markdown/preview`
- TUI: `@mariozechner/pi-tui`
- Browser runtime APIs: `WebSocket`, `crypto.subtle`, `localStorage`, `SpeechRecognition`, `speechSynthesis`, `clipboard`

### Runtime and config assumptions

- Browser transport assumes OpenClaw's `hello-ok` shape, operator role/scopes, and reconnect semantics.
- Config editor assumes gateway methods `config.get`, `config.schema`, `config.set`, `config.apply`, `update.run`, and hash-based optimistic concurrency.
- Skills and approvals panels assume gateway methods `skills.*`, `exec.approvals.*`, `node.list`, and session metadata that matches OpenClaw's control plane.
- TUI auth resolution assumes the same config and secret-provider policy as the CLI and gateway.

### Glue you can rewrite to lower coupling

- The app-wide event reducer in [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts) can be replaced with a much smaller host-specific dispatcher if you only need chat or presence.
- The section taxonomy and icons in [`ui/src/ui/views/config.ts`](../../ui/src/ui/views/config.ts) and [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts) can be simplified without losing the schema-normalization core.
- The TUI command router in [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts) can keep its selector and patch patterns while swapping out most OpenClaw-specific commands.

## extraction recipes

### Recipe: reuse the browser RPC client but not the full control UI

- Copy [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts), [`ui/src/ui/device-auth.ts`](../../ui/src/ui/device-auth.ts), [`ui/src/ui/device-identity.ts`](../../ui/src/ui/device-identity.ts), [`ui/src/ui/string-coerce.ts`](../../ui/src/ui/string-coerce.ts), and [`ui/src/ui/uuid.ts`](../../ui/src/ui/uuid.ts).
- Keep `GatewayBrowserClient`, `GatewayRequestError`, `shouldRetryWithDeviceToken`, and `resolveGatewayErrorDetailCode`.
- Replace `CONTROL_UI_OPERATOR_ROLE`, `CONTROL_UI_OPERATOR_SCOPES`, and the OpenClaw `hello-ok` payload shape with your host-specific equivalents.
- Rewrite the event reducer instead of copying [`ui/src/ui/app-gateway.ts`](../../ui/src/ui/app-gateway.ts) wholesale.

### Recipe: transplant the config-form stack into another operator console

- Carry [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts), [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts), [`ui/src/ui/views/config-form.node.ts`](../../ui/src/ui/views/config-form.node.ts), [`ui/src/ui/views/config-form.shared.ts`](../../ui/src/ui/views/config-form.shared.ts), and the form mutation helpers in [`ui/src/ui/controllers/config/form-utils.ts`](../../ui/src/ui/controllers/config/form-utils.ts).
- Keep `analyzeConfigSchema`, `renderConfigForm`, `updateConfigFormValue`, and `removeConfigFormValue`.
- Rewrite the outer [`ui/src/ui/views/config.ts`](../../ui/src/ui/views/config.ts) wrapper if your host does not share OpenClaw's section taxonomy or raw/apply/update workflow.
- Adapt the gateway snapshot/hash protocol in [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts) rather than copying it unchanged.

### Recipe: reuse slash-command metadata and executor ideas

- Copy [`ui/src/ui/chat/slash-commands.ts`](../../ui/src/ui/chat/slash-commands.ts) and [`ui/src/ui/chat/slash-command-executor.ts`](../../ui/src/ui/chat/slash-command-executor.ts).
- Keep `SLASH_COMMANDS`, `getSlashCommandCompletions`, `parseSlashCommand`, and `executeSlashCommand`.
- Replace imports from [`src/auto-reply/commands-registry.shared.js`](../../src/auto-reply/commands-registry.shared.js) with your own command registry if your host does not share OpenClaw slash commands.
- Rewrite command cases that depend on `sessions.patch`, `sessions.compact`, `agents.list`, `kill`, or `steer`.

### Recipe: reuse browser speech without the rest of chat

- Copy only [`ui/src/ui/chat/speech.ts`](../../ui/src/ui/chat/speech.ts).
- Keep `startStt`, `stopStt`, `speakText`, and `stopTts`.
- Optionally copy the markdown cleanup helper by keeping `stripMarkdown` private.
- Do not copy [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts) just to get STT/TTS.

### Recipe: reuse the TUI gateway client in another terminal app

- Copy [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts) first.
- Keep `GatewayChatClient`, `resolveGatewayConnection`, `sendChat`, `abortChat`, `loadHistory`, `listSessions`, `listAgents`, and `patchSession`.
- Replace auth resolution helpers under [`src/gateway/`](../../src/gateway) if your host does not share OpenClaw gateway auth policy.
- Pull command and session helpers from [`src/tui/tui-command-handlers.ts`](../../src/tui/tui-command-handlers.ts) and [`src/tui/tui-session-actions.ts`](../../src/tui/tui-session-actions.ts) only after you have a compatible terminal component model.

## do not copy blindly

- Do not copy [`ui/src/ui/app.ts`](../../ui/src/ui/app.ts) or [`ui/src/ui/app-render.ts`](../../ui/src/ui/app-render.ts) into another host. They are composition hubs, not reusable seams.
- Do not copy [`ui/src/ui/views/chat.ts`](../../ui/src/ui/views/chat.ts) as a whole. It mixes ephemeral browser state, local session caches, attachment UX, slash menu state, pinned/deleted message state, focus mode, and markdown export.
- Do not copy [`src/tui/tui.ts`](../../src/tui/tui.ts) without also auditing its assumptions about keyboard handling, overlays, local shell integration, session naming, and reconnect behavior.
- Do not copy the browser gateway client without checking secure-context and trusted-endpoint assumptions in [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts). The device-identity and device-token retry logic will break or weaken security if transplanted carelessly.
- Do not copy the config editor without understanding raw-mode fallback and unsupported schema paths. `analyzeConfigSchema` intentionally collapses some unions and treats others as unsupported.
- Do not copy skills and ClawHub panels unless your host also has compatible marketplace RPC and config-backed install/update behavior.

## minimal reusable slices

### Slice: browser bootstrap identity loader

- Strategy: `copier`
- Files: [`ui/src/ui/controllers/control-ui-bootstrap.ts`](../../ui/src/ui/controllers/control-ui-bootstrap.ts), [`ui/src/ui/assistant-identity.ts`](../../ui/src/ui/assistant-identity.ts), [`ui/src/ui/navigation.ts`](../../ui/src/ui/navigation.ts), [`src/gateway/control-ui-contract.ts`](../../src/gateway/control-ui-contract.ts)
- Carry together: `loadControlUiBootstrapConfig`, `normalizeAssistantIdentity`, `normalizeBasePath`
- Replace with shim: the exact bootstrap JSON path if your server uses another route

### Slice: browser gateway transport client

- Strategy: `adapter`
- Files: [`ui/src/ui/gateway.ts`](../../ui/src/ui/gateway.ts), [`ui/src/ui/device-auth.ts`](../../ui/src/ui/device-auth.ts), [`ui/src/ui/device-identity.ts`](../../ui/src/ui/device-identity.ts), [`ui/src/ui/string-coerce.ts`](../../ui/src/ui/string-coerce.ts), [`ui/src/ui/uuid.ts`](../../ui/src/ui/uuid.ts)
- Carry together: `GatewayBrowserClient`, `GatewayRequestError`, `shouldRetryWithDeviceToken`
- Replace with shim: protocol detail readers, role/scopes, and any host-specific `hello` payload types

### Slice: schema analysis plus form mutation helpers

- Strategy: `adapter`
- Files: [`ui/src/ui/views/config-form.analyze.ts`](../../ui/src/ui/views/config-form.analyze.ts), [`ui/src/ui/views/config-form.render.ts`](../../ui/src/ui/views/config-form.render.ts), [`ui/src/ui/views/config-form.node.ts`](../../ui/src/ui/views/config-form.node.ts), [`ui/src/ui/views/config-form.shared.ts`](../../ui/src/ui/views/config-form.shared.ts), [`ui/src/ui/controllers/config.ts`](../../ui/src/ui/controllers/config.ts), [`ui/src/ui/controllers/config/form-utils.ts`](../../ui/src/ui/controllers/config/form-utils.ts), [`ui/src/ui/controllers/config/form-coerce.ts`](../../ui/src/ui/controllers/config/form-coerce.ts)
- Carry together: `analyzeConfigSchema`, `renderConfigForm`, `updateConfigFormValue`, `removeConfigFormValue`
- Replace with shim: RPC calls and section metadata

### Slice: slash-command completion and local execution

- Strategy: `adapter`
- Files: [`ui/src/ui/chat/slash-commands.ts`](../../ui/src/ui/chat/slash-commands.ts), [`ui/src/ui/chat/slash-command-executor.ts`](../../ui/src/ui/chat/slash-command-executor.ts), [`ui/src/ui/session-key.ts`](../../ui/src/ui/session-key.ts), [`ui/src/ui/thinking.ts`](../../ui/src/ui/thinking.ts)
- Carry together: `SLASH_COMMANDS`, `getSlashCommandCompletions`, `parseSlashCommand`, `executeSlashCommand`
- Replace with shim: builtin command registry and gateway RPC names

### Slice: browser speech facade

- Strategy: `copier`
- Files: [`ui/src/ui/chat/speech.ts`](../../ui/src/ui/chat/speech.ts)
- Carry together: `startStt`, `stopStt`, `speakText`, `stopTts`
- Replace with shim: nothing, unless your UI needs custom markdown-to-speech cleanup

### Slice: TUI gateway client

- Strategy: `adapter`
- Files: [`src/tui/gateway-chat.ts`](../../src/tui/gateway-chat.ts), [`src/routing/session-key.js`](../../src/routing/session-key.js), [`src/gateway/client.js`](../../src/gateway/client.js)
- Carry together: `GatewayChatClient`, `resolveGatewayConnection`
- Replace with shim: auth-policy resolution and gateway protocol DTOs

## exact search shortcuts

- `rg -n "GatewayBrowserClient|shouldRetryWithDeviceToken|GatewayRequestError" ui/src/ui/gateway.ts`
- `rg -n "connectGateway|handleGatewayEvent|applySnapshot|resolveControlUiClientVersion" ui/src/ui/app-gateway.ts`
- `rg -n "loadControlUiBootstrapConfig|CONTROL_UI_BOOTSTRAP_CONFIG_PATH" ui/src/ui/controllers/control-ui-bootstrap.ts src/gateway/control-ui-contract.ts`
- `rg -n "analyzeConfigSchema|renderConfigForm|SECTION_META|updateConfigFormValue|ensureAgentConfigEntry" ui/src/ui/views/config-form.analyze.ts ui/src/ui/views/config-form.render.ts ui/src/ui/controllers/config.ts`
- `rg -n "executeSlashCommand|SLASH_COMMANDS|getSlashCommandCompletions|parseSlashCommand" ui/src/ui/chat/slash-command-executor.ts ui/src/ui/chat/slash-commands.ts`
- `rg -n "startStt|speakText|stopTts|isTtsSupported" ui/src/ui/chat/speech.ts`
- `rg -n "loadSkills|searchClawHub|loadExecApprovals|saveExecApprovals|renderSessions" ui/src/ui/controllers/skills.ts ui/src/ui/controllers/exec-approvals.ts ui/src/ui/views/skills.ts ui/src/ui/views/sessions.ts`
- `rg -n "GatewayChatClient|resolveGatewayConnection|createCommandHandlers|createEventHandlers|createSessionActions" src/tui/gateway-chat.ts src/tui/tui-command-handlers.ts src/tui/tui-event-handlers.ts src/tui/tui-session-actions.ts`
