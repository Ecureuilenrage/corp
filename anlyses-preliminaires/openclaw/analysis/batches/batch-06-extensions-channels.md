# Batch 06 - Extensions Channels

Scope: `2620` files. Dominant modules: [`extensions/discord/`](../../extensions/discord), [`extensions/matrix/`](../../extensions/matrix), [`extensions/telegram/`](../../extensions/telegram), [`extensions/slack/`](../../extensions/slack), [`extensions/whatsapp/`](../../extensions/whatsapp).

## purpose

This batch contains the external channel adapters that let OpenClaw inhabit third-party messaging systems. The repeated architecture is `bundled entry wrapper -> setup entry wrapper -> platform plugin base -> full channel plugin -> inbound monitor/provider loop -> outbound target/session routing -> optional thread binding, setup, doctor, and security surfaces`.

For extraction work, the important split is between the reusable extension scaffolding and the platform-heavy runtime loops. The cleanest slices are the bundled entry/setup shells, the target-normalization plus outbound-session-route helpers, the setup-plugin shells, and some of the thread-binding managers. The most dangerous files are the full platform hubs such as [`extensions/discord/src/channel.ts`](../../extensions/discord/src/channel.ts), [`extensions/slack/src/channel.ts`](../../extensions/slack/src/channel.ts), [`extensions/telegram/src/channel.ts`](../../extensions/telegram/src/channel.ts), [`extensions/matrix/src/channel.ts`](../../extensions/matrix/src/channel.ts), and [`extensions/whatsapp/src/channel.ts`](../../extensions/whatsapp/src/channel.ts), because each one fuses platform SDK behavior with OpenClaw routing, approvals, security, setup, and delivery policy.

## entrypoints

- [`extensions/discord/index.ts`](../../extensions/discord/index.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts), [`extensions/telegram/index.ts`](../../extensions/telegram/index.ts), [`extensions/matrix/index.ts`](../../extensions/matrix/index.ts), [`extensions/whatsapp/index.ts`](../../extensions/whatsapp/index.ts): packaged runtime entries built with `defineBundledChannelEntry`.
- [`extensions/discord/setup-entry.ts`](../../extensions/discord/setup-entry.ts), [`extensions/slack/setup-entry.ts`](../../extensions/slack/setup-entry.ts), [`extensions/telegram/setup-entry.ts`](../../extensions/telegram/setup-entry.ts), [`extensions/matrix/setup-entry.ts`](../../extensions/matrix/setup-entry.ts), [`extensions/whatsapp/setup-entry.ts`](../../extensions/whatsapp/setup-entry.ts): packaged setup-only entries built with `defineBundledChannelSetupEntry`.
- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts): loader contract that makes the bundled entry pattern work for all of these extensions.

## key files

- [`extensions/discord/src/channel.ts`](../../extensions/discord/src/channel.ts): Discord plugin composition hub with inbound, outbound, approvals, directory, security, and subagent hook integration.
- [`extensions/slack/src/channel.ts`](../../extensions/slack/src/channel.ts): Slack plugin hub with interactive replies, outbound session routing, and security/audit integration.
- [`extensions/telegram/src/channel.ts`](../../extensions/telegram/src/channel.ts): Telegram plugin hub with thread/topic routing, binding managers, approval capability, and group-policy rules.
- [`extensions/matrix/src/channel.ts`](../../extensions/matrix/src/channel.ts): Matrix plugin hub with room/thread delivery routing, runtime-heavy helpers, onboarding, and doctor/security surfaces.
- [`extensions/whatsapp/src/channel.ts`](../../extensions/whatsapp/src/channel.ts): WhatsApp plugin hub with web auth/runtime bridging, route normalization, reactions, heartbeat, and setup-finalize behavior.
- [`extensions/discord/src/shared.ts`](../../extensions/discord/src/shared.ts), [`extensions/slack/src/shared.ts`](../../extensions/slack/src/shared.ts), [`extensions/telegram/src/shared.ts`](../../extensions/telegram/src/shared.ts), [`extensions/whatsapp/src/shared.ts`](../../extensions/whatsapp/src/shared.ts): platform-local plugin base builders that are reused by both setup-only and full channel plugins.
- [`extensions/discord/src/channel.setup.ts`](../../extensions/discord/src/channel.setup.ts), [`extensions/slack/src/channel.setup.ts`](../../extensions/slack/src/channel.setup.ts), [`extensions/telegram/src/channel.setup.ts`](../../extensions/telegram/src/channel.setup.ts), [`extensions/whatsapp/src/channel.setup.ts`](../../extensions/whatsapp/src/channel.setup.ts): setup-only plugin shells.
- [`extensions/discord/src/monitor/provider.ts`](../../extensions/discord/src/monitor/provider.ts), [`extensions/slack/src/monitor/provider.ts`](../../extensions/slack/src/monitor/provider.ts), [`extensions/telegram/src/monitor.ts`](../../extensions/telegram/src/monitor.ts), [`extensions/matrix/src/matrix/monitor/index.ts`](../../extensions/matrix/src/matrix/monitor/index.ts), [`extensions/whatsapp/src/auto-reply/monitor.ts`](../../extensions/whatsapp/src/auto-reply/monitor.ts): long-lived inbound monitor/provider loops.
- [`extensions/discord/src/outbound-session-route.ts`](../../extensions/discord/src/outbound-session-route.ts), [`extensions/matrix/src/session-route.ts`](../../extensions/matrix/src/session-route.ts), [`extensions/whatsapp/src/session-route.ts`](../../extensions/whatsapp/src/session-route.ts): outbound target to session-route translators.
- [`extensions/discord/src/monitor/thread-bindings.manager.ts`](../../extensions/discord/src/monitor/thread-bindings.manager.ts), [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts), [`extensions/matrix/src/matrix/thread-bindings.ts`](../../extensions/matrix/src/matrix/thread-bindings.ts): conversation-binding managers that bridge channel threads back to OpenClaw sessions.

## data flow

- Each extension runtime starts in its packaged [`index.ts`](../../extensions), which calls `defineBundledChannelEntry` from [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts).
- The bundled entry contract resolves extension-local exports such as `channel-plugin-api.js`, `runtime-api.js`, `secret-contract-api.js`, and optional `registerFull` handlers with `loadBundledEntryExportSync`.
- Setup-only flows use parallel `setup-entry.ts` files that call `defineBundledChannelSetupEntry` and expose setup plugins such as [`extensions/slack/src/channel.setup.ts`](../../extensions/slack/src/channel.setup.ts) and [`extensions/telegram/src/channel.setup.ts`](../../extensions/telegram/src/channel.setup.ts).
- Full channel plugins are usually assembled in `src/channel.ts` with `createChatChannelPlugin` from [`src/plugin-sdk/core.ts`](../../src/plugin-sdk/core.ts), plus platform-local base builders such as `createSlackPluginBase`, `createTelegramPluginBase`, `createDiscordPluginBase`, and `createWhatsAppPluginBase`.
- Once registered, platform runtime setters such as `setSlackRuntime`, `setTelegramRuntime`, `setMatrixRuntime`, and `setWhatsAppRuntime` expose host services to the adapter.
- Long-lived monitor/provider loops such as `monitorDiscordProvider`, `monitorSlackProvider`, `monitorTelegramProvider`, `monitorMatrixProvider`, and `monitorWebChannel` then translate inbound platform events into OpenClaw-facing delivery, routing, approvals, and auto-reply behavior.
- Outbound delivery and session lookup depend on target normalizers and per-platform route helpers such as `resolveDiscordOutboundSessionRoute`, `resolveMatrixOutboundSessionRoute`, `resolveWhatsAppOutboundSessionRoute`, and the Telegram-local route logic in [`extensions/telegram/src/channel.ts`](../../extensions/telegram/src/channel.ts).
- Some platforms also keep explicit conversation-binding state so a platform thread or room can stay attached to an ACP or subagent session through managers such as `createThreadBindingManager`, `createTelegramThreadBindingManager`, and `createMatrixThreadBindingManager`.

## external deps

- Each extension carries its own platform SDK and packaging boundary in files like [`extensions/discord/package.json`](../../extensions/discord/package.json), [`extensions/slack/package.json`](../../extensions/slack/package.json), [`extensions/telegram/package.json`](../../extensions/telegram/package.json), [`extensions/matrix/package.json`](../../extensions/matrix/package.json), and [`extensions/whatsapp/package.json`](../../extensions/whatsapp/package.json).
- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts) depends on `jiti` plus boundary-safe file opening to load bundled entry sidecars.
- Platform APIs leak into the adapters directly, for example `discord-api-types/v10` in [`extensions/discord/src/monitor/thread-bindings.manager.ts`](../../extensions/discord/src/monitor/thread-bindings.manager.ts) and the Matrix SDK-facing code under [`extensions/matrix/src/matrix/`](../../extensions/matrix/src/matrix).

## flags/env

- Discord config detection reads `DISCORD_BOT_TOKEN` in [`extensions/discord/src/shared.ts`](../../extensions/discord/src/shared.ts).
- Slack setup/config detection reads `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` in [`extensions/slack/src/shared.ts`](../../extensions/slack/src/shared.ts).
- Telegram config detection reads `TELEGRAM_BOT_TOKEN` in [`extensions/telegram/src/shared.ts`](../../extensions/telegram/src/shared.ts).
- WhatsApp does not have a single equivalent token env gate; linked state is inferred from persisted auth and gateway/web login flows in [`extensions/whatsapp/src/shared.ts`](../../extensions/whatsapp/src/shared.ts) and [`extensions/whatsapp/src/channel.runtime.ts`](../../extensions/whatsapp/src/channel.runtime.ts).
- Matrix setup is more config and onboarding driven than env driven, with runtime bootstrap and verification helpers under [`extensions/matrix/src/setup-core.ts`](../../extensions/matrix/src/setup-core.ts), [`extensions/matrix/src/setup-bootstrap.ts`](../../extensions/matrix/src/setup-bootstrap.ts), and [`extensions/matrix/src/onboarding.ts`](../../extensions/matrix/src/onboarding.ts).

## subdomains

### Bundled entry and setup-entry wrappers

Classification: `glue` plus `adapters`.

Anchors:

- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts)
- [`extensions/discord/index.ts`](../../extensions/discord/index.ts)
- [`extensions/slack/index.ts`](../../extensions/slack/index.ts)
- [`extensions/telegram/index.ts`](../../extensions/telegram/index.ts)
- [`extensions/matrix/index.ts`](../../extensions/matrix/index.ts)
- [`extensions/whatsapp/index.ts`](../../extensions/whatsapp/index.ts)

This is the smallest repeated pattern in the batch. It packages runtime and setup sidecars and gives each extension a stable host-facing entry seam.

### Platform plugin-base builders and setup-only plugin shells

Classification: `adapters` plus `runtime central`.

Anchors:

- [`extensions/discord/src/shared.ts`](../../extensions/discord/src/shared.ts)
- [`extensions/slack/src/shared.ts`](../../extensions/slack/src/shared.ts)
- [`extensions/telegram/src/shared.ts`](../../extensions/telegram/src/shared.ts)
- [`extensions/whatsapp/src/shared.ts`](../../extensions/whatsapp/src/shared.ts)
- [`extensions/slack/src/channel.setup.ts`](../../extensions/slack/src/channel.setup.ts)
- [`extensions/telegram/src/channel.setup.ts`](../../extensions/telegram/src/channel.setup.ts)

These files define the reusable local base for each platform. They are where capabilities, config schema, doctor, security, setup wizard, and setup adapter surfaces get composed before the full channel plugin adds inbound and outbound runtime behavior.

### Full channel plugin composition

Classification: `runtime central` plus `adapters`.

Anchors:

- [`extensions/discord/src/channel.ts`](../../extensions/discord/src/channel.ts)
- [`extensions/slack/src/channel.ts`](../../extensions/slack/src/channel.ts)
- [`extensions/telegram/src/channel.ts`](../../extensions/telegram/src/channel.ts)
- [`extensions/matrix/src/channel.ts`](../../extensions/matrix/src/channel.ts)
- [`extensions/whatsapp/src/channel.ts`](../../extensions/whatsapp/src/channel.ts)
- [`src/plugin-sdk/core.ts`](../../src/plugin-sdk/core.ts)

This is where `createChatChannelPlugin` becomes concrete. Messaging, allowlists, directory lookups, approvals, group policies, target parsing, thread binding, and setup surfaces are merged into one platform plugin object.

### Inbound monitor and provider loops

Classification: `runtime central`.

Anchors:

- [`extensions/discord/src/monitor/provider.ts`](../../extensions/discord/src/monitor/provider.ts)
- [`extensions/slack/src/monitor/provider.ts`](../../extensions/slack/src/monitor/provider.ts)
- [`extensions/telegram/src/monitor.ts`](../../extensions/telegram/src/monitor.ts)
- [`extensions/matrix/src/matrix/monitor/index.ts`](../../extensions/matrix/src/matrix/monitor/index.ts)
- [`extensions/whatsapp/src/auto-reply/monitor.ts`](../../extensions/whatsapp/src/auto-reply/monitor.ts)
- [`extensions/whatsapp/src/inbound/monitor.ts`](../../extensions/whatsapp/src/inbound/monitor.ts)

These are the platform-heavy long-lived loops. They convert SDK events or web session updates into OpenClaw inbound messages, replies, approvals, typing, and runtime status.

### Target normalization and outbound session routing

Classification: `adapters`.

Anchors:

- [`extensions/discord/src/outbound-session-route.ts`](../../extensions/discord/src/outbound-session-route.ts)
- [`extensions/slack/src/target-parsing.ts`](../../extensions/slack/src/target-parsing.ts)
- [`extensions/telegram/src/normalize.ts`](../../extensions/telegram/src/normalize.ts)
- [`extensions/matrix/src/session-route.ts`](../../extensions/matrix/src/session-route.ts)
- [`extensions/matrix/src/matrix/target-ids.ts`](../../extensions/matrix/src/matrix/target-ids.ts)
- [`extensions/whatsapp/src/session-route.ts`](../../extensions/whatsapp/src/session-route.ts)

This is one of the better extraction seams in the batch. It translates platform targets into stable session routes and delivery identities with much less coupling than the full monitor loops.

### Conversation and thread binding managers

Classification: `runtime central` plus `infra`.

Anchors:

- [`extensions/discord/src/monitor/thread-bindings.manager.ts`](../../extensions/discord/src/monitor/thread-bindings.manager.ts)
- [`extensions/discord/src/monitor/thread-bindings.state.ts`](../../extensions/discord/src/monitor/thread-bindings.state.ts)
- [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts)
- [`extensions/matrix/src/matrix/thread-bindings.ts`](../../extensions/matrix/src/matrix/thread-bindings.ts)
- [`extensions/matrix/src/matrix/thread-bindings-shared.ts`](../../extensions/matrix/src/matrix/thread-bindings-shared.ts)

These files keep a channel thread or room bound to an OpenClaw session over time. They are reusable in principle, but only if the target host also wants explicit session-binding state instead of stateless routing.

### Setup, onboarding, doctor, and security policy surfaces

Classification: `adapters` plus `infra`.

Anchors:

- [`extensions/discord/src/setup-adapter.ts`](../../extensions/discord/src/setup-adapter.ts)
- [`extensions/slack/src/setup-core.ts`](../../extensions/slack/src/setup-core.ts)
- [`extensions/telegram/src/setup-core.ts`](../../extensions/telegram/src/setup-core.ts)
- [`extensions/matrix/src/setup-core.ts`](../../extensions/matrix/src/setup-core.ts)
- [`extensions/discord/src/doctor.ts`](../../extensions/discord/src/doctor.ts)
- [`extensions/whatsapp/src/security-fix.ts`](../../extensions/whatsapp/src/security-fix.ts)

This subdomain is about safe configuration and operator workflows: setup wizards, config patching, doctor checks, allowlist warnings, and security remediation before runtime starts failing in confusing ways.

### Custom `registerFull` hooks and platform sidecars

Classification: `glue`.

Anchors:

- [`extensions/discord/index.ts`](../../extensions/discord/index.ts)
- [`extensions/slack/index.ts`](../../extensions/slack/index.ts)
- [`extensions/matrix/index.ts`](../../extensions/matrix/index.ts)
- [`extensions/feishu/index.ts`](../../extensions/feishu/index.ts)
- [`extensions/qqbot/index.ts`](../../extensions/qqbot/index.ts)

This area contains the most extension-specific glue. It registers subagent hooks, HTTP routes, gateway methods, document tools, and framework commands that sit beside the core channel plugin contract.

## feature inventory

### Bundled runtime entry wrapper

- Goal: package an extension as a host-loadable bundled channel entry that can safely load its plugin, secrets, runtime setter, and optional full-registration sidecars.
- Open first: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`extensions/discord/index.ts`](../../extensions/discord/index.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts)
- Pivot symbols: `defineBundledChannelEntry`, `loadBundledEntryExportSync`, `defineBundledChannelSetupEntry`
- Strictly required modules: boundary-safe entry loader, runtime setter export, extension-local plugin export, optional secrets export
- Dangerous couplings: relies on the monorepo/bundled-layout assumptions, Jiti loader config, and plugin root boundary rules from batch 04
- Reuse strategy: `adapter`

### Setup-only plugin shell

- Goal: expose a setup-focused plugin that carries setup wizard and setup adapter surfaces without starting the full channel runtime.
- Open first: [`extensions/slack/src/channel.setup.ts`](../../extensions/slack/src/channel.setup.ts), [`extensions/telegram/src/channel.setup.ts`](../../extensions/telegram/src/channel.setup.ts), [`extensions/whatsapp/src/channel.setup.ts`](../../extensions/whatsapp/src/channel.setup.ts)
- Pivot symbols: `slackSetupPlugin`, `telegramSetupPlugin`, `whatsappSetupPlugin`, `discordSetupPlugin`
- Strictly required modules: platform plugin-base builder, setup adapter, setup wizard surface, setup-entry wrapper
- Dangerous couplings: still depends on each platform's config schema and setup mutation policy, so it is not a generic setup framework by itself
- Reuse strategy: `copier` with adaptation

### Channel plugin composition template

- Goal: assemble one platform plugin from capabilities, config, security, approvals, directory, setup, routing, and outbound behavior.
- Open first: [`src/plugin-sdk/core.ts`](../../src/plugin-sdk/core.ts), [`extensions/discord/src/channel.ts`](../../extensions/discord/src/channel.ts), [`extensions/slack/src/channel.ts`](../../extensions/slack/src/channel.ts)
- Pivot symbols: `createChatChannelPlugin`, `createChannelPluginBase`, `discordPlugin`, `slackPlugin`, `telegramPlugin`, `matrixPlugin`, `whatsappPlugin`
- Strictly required modules: plugin-base builder, config adapter, setup adapter, target normalizers, outbound/session routing, approvals, security, directory resolver, runtime setter
- Dangerous couplings: each platform hub fuses many host contracts at once, so this is a template/reference seam rather than a drop-in library
- Reuse strategy: `adapter`

### Inbound monitor/provider loop

- Goal: keep a live platform connection running and translate external events into OpenClaw inbound messages, replies, approvals, typing, and runtime status.
- Open first: [`extensions/discord/src/monitor/provider.ts`](../../extensions/discord/src/monitor/provider.ts), [`extensions/slack/src/monitor/provider.ts`](../../extensions/slack/src/monitor/provider.ts), [`extensions/telegram/src/monitor.ts`](../../extensions/telegram/src/monitor.ts), [`extensions/matrix/src/matrix/monitor/index.ts`](../../extensions/matrix/src/matrix/monitor/index.ts), [`extensions/whatsapp/src/auto-reply/monitor.ts`](../../extensions/whatsapp/src/auto-reply/monitor.ts)
- Pivot symbols: `monitorDiscordProvider`, `monitorSlackProvider`, `monitorTelegramProvider`, `monitorMatrixProvider`, `monitorWebChannel`, `monitorWebInbox`
- Strictly required modules: platform SDK client/runtime, inbound parser, outbound reply sender, security or approval helpers, runtime setter
- Dangerous couplings: these loops are tightly bound to each provider's event model, retry model, and transport semantics; cross-platform reuse is low unless you stay in the same provider family
- Reuse strategy: `adapter` for same-platform forks, `reecrire` for different platforms

### Target normalization and outbound session routing

- Goal: turn platform-specific target strings into normalized outbound identities and the correct OpenClaw session key or peer route.
- Open first: [`extensions/discord/src/outbound-session-route.ts`](../../extensions/discord/src/outbound-session-route.ts), [`extensions/slack/src/target-parsing.ts`](../../extensions/slack/src/target-parsing.ts), [`extensions/matrix/src/session-route.ts`](../../extensions/matrix/src/session-route.ts), [`extensions/whatsapp/src/session-route.ts`](../../extensions/whatsapp/src/session-route.ts)
- Pivot symbols: `resolveDiscordOutboundSessionRoute`, `normalizeSlackMessagingTarget`, `resolveMatrixOutboundSessionRoute`, `resolveWhatsAppOutboundSessionRoute`, `normalizeTelegramMessagingTarget`
- Strictly required modules: plugin-sdk routing helpers, platform target parser or normalizer, and sometimes session-store metadata for threaded or room-scoped delivery
- Dangerous couplings: Matrix and Telegram variants depend on richer conversation metadata and binding behavior than the smaller WhatsApp or Discord variants
- Reuse strategy: `adapter`

### Thread-binding manager pattern

- Goal: keep a platform thread or room attached to an ACP or subagent session over time, with persistence, sweeper behavior, and optional farewell messages.
- Open first: [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts), [`extensions/matrix/src/matrix/thread-bindings.ts`](../../extensions/matrix/src/matrix/thread-bindings.ts), [`extensions/discord/src/monitor/thread-bindings.manager.ts`](../../extensions/discord/src/monitor/thread-bindings.manager.ts)
- Pivot symbols: `createTelegramThreadBindingManager`, `createMatrixThreadBindingManager`, `createThreadBindingManager`
- Strictly required modules: session-binding adapter contract, persistence layer, target/session metadata, and platform send helpers for bind or unbind side effects
- Dangerous couplings: Discord uses REST plus webhook and thread lifecycle assumptions; Matrix uses room/thread state and auth-root files; Telegram persists global shared state on `globalThis`
- Reuse strategy: `adapter`

### Setup, doctor, and security policy pack

- Goal: make each platform safely configurable, repairable, and diagnosable before runtime starts or when policy drift appears.
- Open first: [`extensions/discord/src/setup-adapter.ts`](../../extensions/discord/src/setup-adapter.ts), [`extensions/slack/src/setup-core.ts`](../../extensions/slack/src/setup-core.ts), [`extensions/telegram/src/doctor.ts`](../../extensions/telegram/src/doctor.ts), [`extensions/whatsapp/src/security-fix.ts`](../../extensions/whatsapp/src/security-fix.ts)
- Pivot symbols: `discordSetupAdapter`, `slackSetupAdapter`, `telegramSetupAdapter`, `matrixSetupAdapter`, `whatsappSetupAdapter`, `discordDoctor`, `slackDoctor`, `telegramDoctor`, `matrixDoctor`, `whatsappDoctor`, `collectDiscordSecurityAuditFindings`, `collectSlackSecurityAuditFindings`, `collectTelegramSecurityAuditFindings`, `applyWhatsAppSecurityConfigFixes`
- Strictly required modules: platform config adapter, config schema, allowlist and group-policy logic, secret contract helpers, setup wizard or onboarding surface
- Dangerous couplings: these rules are deeply shaped by each platform's auth model, config shape, and operator workflow expectations
- Reuse strategy: `adapter`

### Custom `registerFull` hook pattern

- Goal: hang extra extension-specific sidecars off the bundled entry without bloating the core channel plugin contract.
- Open first: [`extensions/discord/index.ts`](../../extensions/discord/index.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts), [`extensions/matrix/index.ts`](../../extensions/matrix/index.ts), [`extensions/feishu/index.ts`](../../extensions/feishu/index.ts), [`extensions/qqbot/index.ts`](../../extensions/qqbot/index.ts)
- Pivot symbols: `loadDiscordSubagentHooksModule`, `registerSlackPluginHttpRoutes`, `registerFeishuDocTools`, `registerFeishuChatTools`, `getFrameworkCommands`, `registerChannelTool`, `registerRemindTool`
- Strictly required modules: bundled entry loader plus whichever sidecar modules are lazily imported for commands, gateway methods, HTTP routes, or subagent hooks
- Dangerous couplings: this is where platform-specific host mutations happen; copying blindly can register gateway methods or commands your target host does not want
- Reuse strategy: `copier` with adaptation

## symbol map

### Entry and setup wrappers

- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts): `loadBundledEntryExportSync`, `defineBundledChannelEntry`, `defineBundledChannelSetupEntry`
- [`extensions/discord/index.ts`](../../extensions/discord/index.ts): `loadDiscordSubagentHooksModule`
- [`extensions/slack/index.ts`](../../extensions/slack/index.ts): `registerSlackPluginHttpRoutes`
- [`extensions/feishu/index.ts`](../../extensions/feishu/index.ts): `registerFeishuDocTools`, `registerFeishuChatTools`, `registerFeishuWikiTools`, `registerFeishuDriveTools`, `registerFeishuPermTools`, `registerFeishuBitableTools`
- [`extensions/qqbot/index.ts`](../../extensions/qqbot/index.ts): `resolveQQBotAccount`, `sendDocument`, `getFrameworkCommands`, `registerChannelTool`, `registerRemindTool`

### Plugin-base builders and full plugins

- [`src/plugin-sdk/core.ts`](../../src/plugin-sdk/core.ts): `createChatChannelPlugin`, `createChannelPluginBase`
- [`extensions/discord/src/shared.ts`](../../extensions/discord/src/shared.ts): `createDiscordPluginBase`, `discordConfigAdapter`
- [`extensions/slack/src/shared.ts`](../../extensions/slack/src/shared.ts): `buildSlackSetupLines`, `setSlackChannelAllowlist`, `createSlackPluginBase`, `slackConfigAdapter`
- [`extensions/telegram/src/shared.ts`](../../extensions/telegram/src/shared.ts): `findTelegramTokenOwnerAccountId`, `formatDuplicateTelegramTokenReason`, `createTelegramPluginBase`, `telegramConfigAdapter`
- [`extensions/whatsapp/src/shared.ts`](../../extensions/whatsapp/src/shared.ts): `loadWhatsAppChannelRuntime`, `whatsappSetupWizardProxy`, `createWhatsAppSetupWizardProxy`, `createWhatsAppPluginBase`
- [`extensions/discord/src/channel.ts`](../../extensions/discord/src/channel.ts): `discordPlugin`
- [`extensions/slack/src/channel.ts`](../../extensions/slack/src/channel.ts): `slackPlugin`
- [`extensions/telegram/src/channel.ts`](../../extensions/telegram/src/channel.ts): `telegramPlugin`
- [`extensions/matrix/src/channel.ts`](../../extensions/matrix/src/channel.ts): `matrixPlugin`
- [`extensions/whatsapp/src/channel.ts`](../../extensions/whatsapp/src/channel.ts): `whatsappPlugin`

### Setup and runtime surfaces

- [`extensions/discord/src/channel.runtime.ts`](../../extensions/discord/src/channel.runtime.ts): `discordSetupWizard`
- [`extensions/slack/src/setup-core.ts`](../../extensions/slack/src/setup-core.ts): `slackSetupAdapter`, `createSlackSetupWizardBase`, `createSlackSetupWizardProxy`
- [`extensions/slack/src/setup-surface.ts`](../../extensions/slack/src/setup-surface.ts): `slackSetupWizard`
- [`extensions/slack/src/channel.setup.ts`](../../extensions/slack/src/channel.setup.ts): `slackSetupPlugin`
- [`extensions/telegram/src/setup-core.ts`](../../extensions/telegram/src/setup-core.ts): `telegramSetupAdapter`
- [`extensions/telegram/src/setup-surface.ts`](../../extensions/telegram/src/setup-surface.ts): `telegramSetupWizard`
- [`extensions/telegram/src/channel.setup.ts`](../../extensions/telegram/src/channel.setup.ts): `telegramSetupPlugin`
- [`extensions/matrix/src/setup-core.ts`](../../extensions/matrix/src/setup-core.ts): `matrixSetupAdapter`
- [`extensions/matrix/src/onboarding.ts`](../../extensions/matrix/src/onboarding.ts): `matrixOnboardingAdapter`
- [`extensions/whatsapp/src/setup-core.ts`](../../extensions/whatsapp/src/setup-core.ts): `whatsappSetupAdapter`
- [`extensions/whatsapp/src/setup-surface.ts`](../../extensions/whatsapp/src/setup-surface.ts): `whatsappSetupWizard`
- [`extensions/whatsapp/src/channel.setup.ts`](../../extensions/whatsapp/src/channel.setup.ts): `whatsappSetupPlugin`

### Monitor/provider loops and routing helpers

- [`extensions/discord/src/monitor/provider.ts`](../../extensions/discord/src/monitor/provider.ts): `monitorDiscordProvider`, `resolveDiscordRuntimeGroupPolicy`
- [`extensions/slack/src/monitor/provider.ts`](../../extensions/slack/src/monitor/provider.ts): `monitorSlackProvider`, `resolveSlackRuntimeGroupPolicy`
- [`extensions/telegram/src/monitor.ts`](../../extensions/telegram/src/monitor.ts): `monitorTelegramProvider`
- [`extensions/matrix/src/matrix/monitor/index.ts`](../../extensions/matrix/src/matrix/monitor/index.ts): `monitorMatrixProvider`
- [`extensions/whatsapp/src/auto-reply/monitor.ts`](../../extensions/whatsapp/src/auto-reply/monitor.ts): `monitorWebChannel`
- [`extensions/whatsapp/src/inbound/monitor.ts`](../../extensions/whatsapp/src/inbound/monitor.ts): `monitorWebInbox`
- [`extensions/discord/src/outbound-session-route.ts`](../../extensions/discord/src/outbound-session-route.ts): `ResolveDiscordOutboundSessionRouteParams`, `resolveDiscordOutboundSessionRoute`
- [`extensions/matrix/src/session-route.ts`](../../extensions/matrix/src/session-route.ts): `resolveMatrixOutboundSessionRoute`
- [`extensions/whatsapp/src/session-route.ts`](../../extensions/whatsapp/src/session-route.ts): `resolveWhatsAppOutboundSessionRoute`

### Target parsing, delivery targeting, and thread bindings

- [`extensions/slack/src/target-parsing.ts`](../../extensions/slack/src/target-parsing.ts): `normalizeSlackMessagingTarget`
- [`extensions/telegram/src/normalize.ts`](../../extensions/telegram/src/normalize.ts): `normalizeTelegramMessagingTarget`
- [`extensions/matrix/src/matrix/target-ids.ts`](../../extensions/matrix/src/matrix/target-ids.ts): `normalizeMatrixMessagingTarget`
- [`extensions/discord/src/normalize.ts`](../../extensions/discord/src/normalize.ts): `normalizeDiscordMessagingTarget`
- [`extensions/whatsapp/src/normalize-target.ts`](../../extensions/whatsapp/src/normalize-target.ts): `normalizeWhatsAppMessagingTarget`
- [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts): `TelegramThreadBindingRecord`, `TelegramThreadBindingManager`, `createTelegramThreadBindingManager`, `getTelegramThreadBindingManager`, `setTelegramThreadBindingIdleTimeoutBySessionKey`, `setTelegramThreadBindingMaxAgeBySessionKey`
- [`extensions/matrix/src/matrix/thread-bindings.ts`](../../extensions/matrix/src/matrix/thread-bindings.ts): `createMatrixThreadBindingManager`
- [`extensions/matrix/src/matrix/thread-bindings-shared.ts`](../../extensions/matrix/src/matrix/thread-bindings-shared.ts): `MatrixThreadBindingRecord`, `MatrixThreadBindingManager`, `setMatrixThreadBindingIdleTimeoutBySessionKey`, `setMatrixThreadBindingMaxAgeBySessionKey`
- [`extensions/discord/src/monitor/thread-bindings.manager.ts`](../../extensions/discord/src/monitor/thread-bindings.manager.ts): `createThreadBindingManager`

### Doctor, security, and policy surfaces

- [`extensions/discord/src/doctor.ts`](../../extensions/discord/src/doctor.ts): `discordDoctor`
- [`extensions/slack/src/doctor.ts`](../../extensions/slack/src/doctor.ts): `slackDoctor`
- [`extensions/telegram/src/doctor.ts`](../../extensions/telegram/src/doctor.ts): `telegramDoctor`
- [`extensions/matrix/src/doctor.ts`](../../extensions/matrix/src/doctor.ts): `matrixDoctor`
- [`extensions/whatsapp/src/doctor.ts`](../../extensions/whatsapp/src/doctor.ts): `whatsappDoctor`
- [`extensions/discord/src/security-audit.ts`](../../extensions/discord/src/security-audit.ts): `collectDiscordSecurityAuditFindings`
- [`extensions/slack/src/security-audit.ts`](../../extensions/slack/src/security-audit.ts): `collectSlackSecurityAuditFindings`
- [`extensions/telegram/src/security-audit.ts`](../../extensions/telegram/src/security-audit.ts): `collectTelegramSecurityAuditFindings`
- [`extensions/telegram/src/group-access.ts`](../../extensions/telegram/src/group-access.ts): `resolveTelegramRuntimeGroupPolicy`
- [`extensions/whatsapp/src/runtime-group-policy.ts`](../../extensions/whatsapp/src/runtime-group-policy.ts): `resolveWhatsAppRuntimeGroupPolicy`
- [`extensions/whatsapp/src/security-fix.ts`](../../extensions/whatsapp/src/security-fix.ts): `applyWhatsAppSecurityConfigFixes`

## dependency map

### Internal dependencies you must carry together

- Bundled entries depend on [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), extension-local runtime/plugin exports, and the package layout assumptions encoded by the loader.
- Setup-only plugin shells depend on the same platform base builders as the full channel plugins. Copying only `channel.setup.ts` without `shared.ts`, `setup-core.ts`, and the config schema does not buy much.
- Full channel hubs depend on many internal surfaces at once: config adapters, setup adapters, allowlists, target parsers, directory resolution, security, approvals, runtime setters, and often doctor/onboarding helpers.
- Monitor/provider loops depend on the platform runtime setter and on many extension-local inbound/outbound helpers. They are not separable from the rest of the adapter without a serious rewrite.
- Thread-binding managers depend on the plugin-sdk conversation-binding contract plus storage, platform send helpers, and duration or sweeper policy.

### External dependencies

- Platform SDKs, HTTP clients, browser or web session stacks, and provider-specific protocol types are hard dependencies for real monitor/runtime reuse.
- `jiti` and the package-layout loader behavior are hard dependencies for the bundled-entry loader contract.

### Runtime and singleton assumptions

- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts) keeps Jiti loaders and loaded module exports cached globally.
- Runtime setters such as `setSlackRuntime`, `setTelegramRuntime`, `setMatrixRuntime`, and `setWhatsAppRuntime` imply per-process shared runtime state rather than pure functional adapters.
- Telegram thread bindings use a `globalThis`-backed shared state store in [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts).
- Discord and Matrix thread-binding managers assume persistent state files and/or long-lived runtime tokens are available.
- WhatsApp setup and runtime surfaces assume persistent linked auth state instead of purely ephemeral config.

### Glue you can rewrite

- `registerFull` sidecars in extension `index.ts` files are host mutations, not fundamental adapter primitives. Rewrite them freely in a new host.
- Doctor, setup-surface text, and onboarding flows are product/operator UX layers and can be rewritten without affecting the core routing or monitor patterns.
- Platform-specific HTTP routes, slash-command bridges, and document tools should usually be regenerated for the target host rather than copied verbatim.

## extraction recipes

### Recipe A - extract the bundled channel entry plus setup shell

- Carry: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), one representative runtime entry such as [`extensions/slack/index.ts`](../../extensions/slack/index.ts), and one setup entry such as [`extensions/slack/setup-entry.ts`](../../extensions/slack/setup-entry.ts)
- Keep together: `defineBundledChannelEntry`, `defineBundledChannelSetupEntry`, `loadBundledEntryExportSync`, the extension-local `plugin` and `runtime` export refs
- Replace with shims: your host's plugin API type and any package-layout or source-fallback policy that differs from OpenClaw
- Best use: hosts that want extension packages to publish a stable runtime entry and a stable setup entry without hand-writing loaders per platform
- Strategy: `adapter`

### Recipe B - extract target normalization and outbound session routing

- Carry: [`extensions/discord/src/outbound-session-route.ts`](../../extensions/discord/src/outbound-session-route.ts), [`extensions/whatsapp/src/session-route.ts`](../../extensions/whatsapp/src/session-route.ts), or the richer Matrix/Telegram variants if you need thread-aware routing
- Keep together: `resolveDiscordOutboundSessionRoute`, `resolveWhatsAppOutboundSessionRoute`, `normalizeSlackMessagingTarget`, `normalizeTelegramMessagingTarget`, `normalizeMatrixMessagingTarget`
- Replace with shims: your session-key builder and any platform target parser that differs
- Best use: a host that already knows how to send to a channel but needs stable session keys or peer routing for outbound messages
- Strategy: `adapter`

### Recipe C - extract the Telegram-style thread-binding manager

- Carry: [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts)
- Keep together: `createTelegramThreadBindingManager`, `getTelegramThreadBindingManager`, `setTelegramThreadBindingIdleTimeoutBySessionKey`, `setTelegramThreadBindingMaxAgeBySessionKey`
- Replace with shims: the session-binding adapter registration, persistence path rules, and farewell-send behavior if you need it
- Best use: agentic chat hosts that need a durable mapping between one external conversation thread and one long-lived session
- Strategy: `adapter`

### Recipe D - extract the setup-plugin shell for one platform

- Carry: [`extensions/slack/src/channel.setup.ts`](../../extensions/slack/src/channel.setup.ts), [`extensions/slack/src/setup-core.ts`](../../extensions/slack/src/setup-core.ts), [`extensions/slack/src/setup-surface.ts`](../../extensions/slack/src/setup-surface.ts), [`extensions/slack/src/shared.ts`](../../extensions/slack/src/shared.ts)
- Keep together: `slackSetupPlugin`, `slackSetupAdapter`, `slackSetupWizard`, `createSlackPluginBase`
- Replace with shims: config patching and operator prompt text
- Best use: a future host that wants one platform adapter to expose setup and diagnostics before the full runtime is linked
- Strategy: `adapter`

### Recipe E - extract the doctor/security policy pack

- Carry: one focused platform bundle such as [`extensions/discord/src/doctor.ts`](../../extensions/discord/src/doctor.ts), [`extensions/discord/src/security-audit.ts`](../../extensions/discord/src/security-audit.ts), [`extensions/discord/src/shared.ts`](../../extensions/discord/src/shared.ts)
- Keep together: doctor adapter, security audit or fix functions, config adapter, and the platform-specific config schema/allowlist policy helpers they rely on
- Replace with shims: your target host's config path and remediation text
- Best use: extension ecosystems where supportability and safe config drift handling matter as much as raw message transport
- Strategy: `adapter`

### Recipe F - extract the `registerFull` sidecar hook pattern

- Carry: one of [`extensions/discord/index.ts`](../../extensions/discord/index.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts), [`extensions/matrix/index.ts`](../../extensions/matrix/index.ts), [`extensions/feishu/index.ts`](../../extensions/feishu/index.ts), or [`extensions/qqbot/index.ts`](../../extensions/qqbot/index.ts)
- Keep together: the local lazy-loader helpers plus the host mutation calls such as `api.on`, `api.registerGatewayMethod`, or `api.registerCommand`
- Replace with shims: the host-specific event or command registration API
- Best use: hosts that want to keep the core channel contract small while still letting some extensions bolt on extra sidecars
- Strategy: `copier` with adaptation

## do not copy blindly

- [`extensions/discord/src/channel.ts`](../../extensions/discord/src/channel.ts), [`extensions/slack/src/channel.ts`](../../extensions/slack/src/channel.ts), [`extensions/telegram/src/channel.ts`](../../extensions/telegram/src/channel.ts), [`extensions/matrix/src/channel.ts`](../../extensions/matrix/src/channel.ts), and [`extensions/whatsapp/src/channel.ts`](../../extensions/whatsapp/src/channel.ts) are not safe blind-copy targets. Each one is a convergence point for platform SDK behavior plus OpenClaw routing, approvals, security, and config policy.
- Monitor/provider loops such as [`extensions/discord/src/monitor/provider.ts`](../../extensions/discord/src/monitor/provider.ts) and [`extensions/whatsapp/src/auto-reply/monitor.ts`](../../extensions/whatsapp/src/auto-reply/monitor.ts) are bound to platform event semantics, reconnect logic, and side effects.
- [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts) encodes path-boundary, Jiti, and source-fallback behavior that is easy to break if your package layout differs.
- Thread-binding managers are only safe to transplant if you also preserve the same session-binding contract and lifecycle assumptions.
- Setup wizards, doctor flows, and security fixes mutate config and/or persisted auth state. They need a trust and recovery review before reuse.
- `registerFull` logic in [`extensions/feishu/index.ts`](../../extensions/feishu/index.ts) and [`extensions/qqbot/index.ts`](../../extensions/qqbot/index.ts) registers extra tools and commands that may be inappropriate in another host.

## minimal reusable slices

### Slice: bundled channel entry plus setup wrapper

- Paths: [`src/plugin-sdk/channel-entry-contract.ts`](../../src/plugin-sdk/channel-entry-contract.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts), [`extensions/slack/setup-entry.ts`](../../extensions/slack/setup-entry.ts)
- Central symbols: `defineBundledChannelEntry`, `defineBundledChannelSetupEntry`, `loadBundledEntryExportSync`
- Why minimal: this is the smallest repeatable packaging seam across the batch
- Strategy: `adapter`

### Slice: outbound target normalization and route helpers

- Paths: [`extensions/discord/src/outbound-session-route.ts`](../../extensions/discord/src/outbound-session-route.ts), [`extensions/whatsapp/src/session-route.ts`](../../extensions/whatsapp/src/session-route.ts), [`extensions/slack/src/target-parsing.ts`](../../extensions/slack/src/target-parsing.ts)
- Central symbols: `resolveDiscordOutboundSessionRoute`, `resolveWhatsAppOutboundSessionRoute`, `normalizeSlackMessagingTarget`
- Why minimal: useful even when you do not want the full inbound monitor stack
- Strategy: `adapter`

### Slice: Telegram thread-binding manager

- Paths: [`extensions/telegram/src/thread-bindings.ts`](../../extensions/telegram/src/thread-bindings.ts)
- Central symbols: `createTelegramThreadBindingManager`, `getTelegramThreadBindingManager`, `setTelegramThreadBindingIdleTimeoutBySessionKey`
- Why minimal: it is the clearest durable conversation-binding manager in the batch and less platform-entangled than the Discord variant
- Strategy: `adapter`

### Slice: setup-plugin shell

- Paths: [`extensions/telegram/src/channel.setup.ts`](../../extensions/telegram/src/channel.setup.ts), [`extensions/telegram/src/setup-core.ts`](../../extensions/telegram/src/setup-core.ts), [`extensions/telegram/src/setup-surface.ts`](../../extensions/telegram/src/setup-surface.ts), [`extensions/telegram/src/shared.ts`](../../extensions/telegram/src/shared.ts)
- Central symbols: `telegramSetupPlugin`, `telegramSetupAdapter`, `telegramSetupWizard`, `createTelegramPluginBase`
- Why minimal: gives you a setup and diagnostics surface for one channel before you commit to the full runtime
- Strategy: `adapter`

### Slice: `registerFull` sidecar hook template

- Paths: [`extensions/discord/index.ts`](../../extensions/discord/index.ts), [`extensions/slack/index.ts`](../../extensions/slack/index.ts)
- Central symbols: `loadDiscordSubagentHooksModule`, `registerSlackPluginHttpRoutes`
- Why minimal: useful when a channel adapter needs one or two extra host hooks without bloating the main plugin contract
- Strategy: `copier` with adaptation

## exact search shortcuts

- `rg "defineBundledChannelEntry|defineBundledChannelSetupEntry|loadBundledEntryExportSync" src/plugin-sdk extensions`
- `rg "createChatChannelPlugin|create[A-Za-z]+PluginBase|SetupPlugin|SetupWizard" extensions/discord/src extensions/slack/src extensions/telegram/src extensions/matrix/src extensions/whatsapp/src`
- `rg "monitorDiscordProvider|monitorSlackProvider|monitorTelegramProvider|monitorMatrixProvider|monitorWebChannel|monitorWebInbox" extensions/discord/src extensions/slack/src extensions/telegram/src extensions/matrix/src extensions/whatsapp/src`
- `rg "normalize[A-Za-z]+MessagingTarget|resolve[A-Za-z]+OutboundSessionRoute|resolve[A-Za-z]+InboundConversation|parse[A-Za-z]+ExplicitTarget" extensions/discord/src extensions/slack/src extensions/telegram/src extensions/matrix/src extensions/whatsapp/src`
- `rg "createThreadBindingManager|createTelegramThreadBindingManager|createMatrixThreadBindingManager|set[A-Za-z]+ThreadBinding.*SessionKey" extensions/discord/src extensions/telegram/src extensions/matrix/src`
- `rg "Doctor|SecurityAudit|resolve[A-Za-z]+RuntimeGroupPolicy|applyWhatsAppSecurityConfigFixes" extensions/discord/src extensions/slack/src extensions/telegram/src extensions/matrix/src extensions/whatsapp/src`
- `rg "registerGatewayMethod|registerCommand|subagent_spawning|subagent_ended|registerSlackPluginHttpRoutes|registerFeishu" extensions`
