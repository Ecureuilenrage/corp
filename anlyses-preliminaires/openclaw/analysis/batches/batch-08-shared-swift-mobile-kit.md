# Batch 08 - Shared Swift and Mobile Kit

Scope: `427` files. Dominant modules: [`apps/shared/OpenClawKit/`](../../apps/shared/OpenClawKit), [`apps/ios/Sources/`](../../apps/ios/Sources), [`apps/android/app/src/main/java/ai/openclaw/app/`](../../apps/android/app/src/main/java/ai/openclaw/app), [`Swabble/`](../../Swabble).

## purpose

This batch holds the Apple-platform shared kit, the mobile node shells that consume it, and the adjacent voice package `Swabble`. For extraction work, the most important split is between reusable shared packages and app-specific composition.

The clean seams are the generated protocol DTO pack in [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift), the gateway transport/auth/TLS layer in [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift) and [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift), the chat transport/UI abstraction in [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI), the deep-link helpers in [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift), the talk helpers in [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift) and [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift), and the generic wake-word gate in [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift).

The most dangerous files are [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift), [`apps/ios/Sources/Gateway/GatewayConnectionController.swift`](../../apps/ios/Sources/Gateway/GatewayConnectionController.swift), and [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift), because they fuse transport, reconnect policy, push/watch flows, deep links, mobile permissions, and capability routing.

## entrypoints

- [`apps/shared/OpenClawKit/Package.swift`](../../apps/shared/OpenClawKit/Package.swift): shared Swift package definition with three products: `OpenClawProtocol`, `OpenClawKit`, and `OpenClawChatUI`.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift): gateway transport entry for Apple clients.
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift): shared SwiftUI chat surface.
- [`apps/ios/Sources/OpenClawApp.swift`](../../apps/ios/Sources/OpenClawApp.swift): iOS app bootstrap.
- [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift): iOS composition root for node, operator, voice, push, and watch services.
- [`Swabble/Package.swift`](../../Swabble/Package.swift): adjacent speech/wake-word Swift package.

## key files

- [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift): generated protocol DTO set for request, response, event, config, session, tool, and node APIs.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift): WebSocket actor with request tracking, signed device identity, timeout handling, reconnect, and keepalive.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift): typed connect and response errors with recovery hints.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift): TLS pinning session and fingerprint persistence.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift): node-oriented bridge over `GatewayChannelActor`, including invoke races and canvas-host rewriting.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift): typed server-push event envelope.
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift): transport protocol that isolates chat UI from the concrete gateway implementation.
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift): chat state machine for bootstrap, send, abort, model/thinking selection, session switching, and pending tool calls.
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift): shared SwiftUI surface with message list, composer, sessions sheet, and typing/tool overlays.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift): JSON-driven tool display registry for concise UI summaries.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift): safe parser for `openclaw://agent` and `openclaw://gateway` routes, including setup-code decoding.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift): first-line JSON directive parser for TTS voice/model overrides.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift): small prompt builder for spoken-mode replies.
- [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift): generic wake-word detector over timestamped transcript segments.
- [`apps/ios/Sources/Gateway/GatewayConnectionController.swift`](../../apps/ios/Sources/Gateway/GatewayConnectionController.swift): iOS gateway discovery, trust prompt, and auto-connect coordinator.
- [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift): iOS orchestration hub over gateways, notifications, watch connectivity, voice wake, and node capabilities.

## data flow

- [`apps/shared/OpenClawKit/Package.swift`](../../apps/shared/OpenClawKit/Package.swift) exposes three layers. `OpenClawProtocol` is the DTO contract pack, `OpenClawKit` is the transport/runtime/helper layer, and `OpenClawChatUI` is the chat UI layer on top of a protocol-based transport.
- Generated DTOs in [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift) define the websocket handshake, frames, snapshots, and RPC parameter/result shapes.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift) uses those DTOs to open the websocket, build connect payloads, sign device identity when required, and emit `GatewayPush` values.
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift) wraps `GatewayChannelActor` for node-facing operations, invoke request bridging, snapshot waiting, and canvas-host management.
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift) defines the small contract the shared chat UI expects. [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift) then consumes any transport that satisfies it.
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift) is a thin SwiftUI shell around the view model and reusable message/composer subviews.
- iOS consumes the shared package through controllers like [`apps/ios/Sources/Gateway/GatewayConnectionController.swift`](../../apps/ios/Sources/Gateway/GatewayConnectionController.swift), [`apps/ios/Sources/Chat/IOSGatewayChatTransport.swift`](../../apps/ios/Sources/Chat/IOSGatewayChatTransport.swift), and [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift).
- Android mirrors several of the same concerns in Kotlin files like [`apps/android/app/src/main/java/ai/openclaw/app/chat/ChatController.kt`](../../apps/android/app/src/main/java/ai/openclaw/app/chat/ChatController.kt) and [`apps/android/app/src/main/java/ai/openclaw/app/gateway/GatewaySession.kt`](../../apps/android/app/src/main/java/ai/openclaw/app/gateway/GatewaySession.kt), which is a good signal that the reusable seams are the contract and transport layers, not the iOS app shell.
- [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift) sits beside the mobile kit as an orthogonal speech utility package with its own CLI and core speech pipeline.

## external deps

- [`apps/shared/OpenClawKit/Package.swift`](../../apps/shared/OpenClawKit/Package.swift) depends on `ElevenLabsKit` and `textual`.
- `OpenClawKit` and iOS shell code also depend heavily on Apple frameworks such as `Foundation`, `Security`, `URLSessionWebSocketTask`, `AVFoundation`, `Contacts`, `CoreLocation`, `CoreMotion`, `Photos`, `ReplayKit`, and `UserNotifications`.
- [`Swabble/Package.swift`](../../Swabble/Package.swift) depends on `Commander` and `swift-testing`.

## flags/env

- This batch is mostly keychain, URL, defaults, and plist driven rather than env-driven.
- TLS trust state is persisted by [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift) through `GatewayTLSStore`.
- Device auth and identity are persisted by [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthStore.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthStore.swift) and [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceIdentity.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceIdentity.swift).
- Deep-link behavior is driven by the `openclaw://` scheme and setup-code payloads in [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift).
- iOS onboarding, gateway discovery, and push state are further shaped by defaults and plist-backed stores under [`apps/ios/Sources/Gateway/`](../../apps/ios/Sources/Gateway) and [`apps/ios/Config/`](../../apps/ios/Config).

## subdomains

### Generated gateway protocol DTO pack

Classification: `runtime central`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/AnyCodable.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/AnyCodable.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/WizardHelpers.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/WizardHelpers.swift)

This is the contract layer. It is large, but it is structurally clean because it is generated and data-only. It is the best starting point if another Apple client needs protocol compatibility without inheriting the whole app.

### Shared gateway transport, auth, and TLS

Classification: `runtime central` plus `adapters`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift)

This subdomain is the reusable Apple transport seam. `GatewayChannelActor` is the core runtime; the error and TLS files are supporting dependencies, not optional extras.

### Node session bridge and canvas/invoke relay

Classification: `runtime central`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/BridgeFrames.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/BridgeFrames.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/Capabilities.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/Capabilities.swift)

This is the node-facing runtime shell that sits one layer above the channel actor. It is useful, but noticeably more OpenClaw-specific than the channel actor because it knows about bridge invoke payloads, snapshots, and canvas capability rewriting.

### Chat transport abstraction and shared SwiftUI chat

Classification: `UI` plus `glue`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift)

This is the best Apple UI seam in the repo. The key design choice is that the shared UI depends on the small `OpenClawChatTransport` protocol instead of directly on the websocket actor.

### Mobile node command DTOs and Apple helpers

Classification: `adapters`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceCommands.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceCommands.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/LocationCommands.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/LocationCommands.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/WatchCommands.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/WatchCommands.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/CanvasA2UICommands.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/CanvasA2UICommands.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift)

These files are mostly DTOs and small helper layers for capability payloads. They are easier to transplant than the iOS services that implement them.

### Talk mode, directives, and speech presentation helpers

Classification: `glue`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkSystemSpeechSynthesizer.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkSystemSpeechSynthesizer.swift)

This subdomain contains small, policy-oriented helpers rather than a huge runtime. The directive parser and prompt builder are especially transplantable.

### Deep links and setup-code parsing

Classification: `adapters`.

Anchors:

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/ShareToAgentDeepLink.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ShareToAgentDeepLink.swift)
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/ShareGatewayRelaySettings.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ShareGatewayRelaySettings.swift)

These are small but useful parser and routing helpers for mobile onboarding and content-sharing flows.

### iOS app composition shell

Classification: `UI` plus `glue`.

Anchors:

- [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift)
- [`apps/ios/Sources/Gateway/GatewayConnectionController.swift`](../../apps/ios/Sources/Gateway/GatewayConnectionController.swift)
- [`apps/ios/Sources/Chat/IOSGatewayChatTransport.swift`](../../apps/ios/Sources/Chat/IOSGatewayChatTransport.swift)
- [`apps/ios/Sources/OpenClawApp.swift`](../../apps/ios/Sources/OpenClawApp.swift)

These files prove how the shared package is used in a real app, but they are not clean early extraction targets because they own too many platform services and UX flows at once.

### Swabble wake-word and speech utility package

Classification: `adapters` plus `infra`.

Anchors:

- [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift)
- [`Swabble/Sources/SwabbleCore/Speech/SpeechPipeline.swift`](../../Swabble/Sources/SwabbleCore/Speech/SpeechPipeline.swift)
- [`Swabble/Sources/SwabbleCore/Hooks/HookExecutor.swift`](../../Swabble/Sources/SwabbleCore/Hooks/HookExecutor.swift)
- [`Swabble/Package.swift`](../../Swabble/Package.swift)

Within `Swabble`, the strongest reusable seam is the wake-word gate, not the whole CLI/service package.

## feature inventory

### Swift gateway protocol DTO pack

- Goal: publish a stable Swift contract for websocket frames, snapshots, session/config/tool RPC payloads, and node APIs.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift)
- Pivot symbols: `GATEWAY_PROTOCOL_VERSION`, `ConnectParams`, `HelloOk`, `RequestFrame`, `ResponseFrame`, `EventFrame`, `Snapshot`, `SessionsListParams`, `SessionsPatchParams`, `ConfigSchemaResponse`, `ToolCatalogEntry`, `ToolCatalogGroup`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/AnyCodable.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/AnyCodable.swift)
- Dangerous coupling: generated from the OpenClaw gateway schema, so you should regenerate instead of editing by hand when the protocol evolves
- Strategy: `copier`

### Apple gateway channel with auth recovery and TLS pinning

- Goal: reusable websocket actor with typed connect errors, device identity support, TLS pinning, keepalive, request timeouts, and push fan-out.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift)
- Pivot symbols: `GatewayConnectOptions`, `GatewayAuthSource`, `GatewayChannelActor`, `GatewayConnectAuthError`, `GatewayResponseError`, `GatewayDecodingError`, `GatewayTLSParams`, `GatewayTLSStore`, `GatewayTLSPinningSession`, `GatewayPush`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthPayload.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthPayload.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthStore.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthStore.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceIdentity.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceIdentity.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/ThrowingContinuationSupport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ThrowingContinuationSupport.swift)
- Dangerous coupling: assumes OpenClaw websocket handshake semantics, auth detail codes, and operator/device identity flow
- Strategy: `adapter`

### Node session bridge over the channel actor

- Goal: expose node-oriented connect, invoke, snapshot, canvas-host, and event-stream behavior on top of the lower-level channel.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift)
- Pivot symbols: `GatewayNodeSession`, `invokeWithTimeout`, `currentCanvasHostUrl`, `refreshNodeCanvasCapability`, `canonicalizeCanvasHostUrl`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/BridgeFrames.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/BridgeFrames.swift)
- Dangerous coupling: bridge invoke contracts, canvas capability URLs, and OpenClaw node runtime assumptions
- Strategy: `adapter`

### Shared chat transport, state machine, and SwiftUI surface

- Goal: embed a reusable Apple chat UI that can talk to any backend implementing a small transport protocol.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift)
- Pivot symbols: `OpenClawChatTransport`, `OpenClawChatTransportEvent`, `OpenClawChatViewModel`, `OpenClawChatView`, `OpenClawChatMessage`, `OpenClawChatMessageContent`, `OpenClawChatUsage`, `ChatPayloadDecoding.decode`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatComposer.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatComposer.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatMessageViews.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatMessageViews.swift)
- Dangerous coupling: still expects OpenClaw-style history/send/abort/session/model RPC semantics unless you implement a compatible adapter
- Strategy: `adapter`

### Tool display registry

- Goal: convert tool name plus args into compact emoji/title/detail summaries using a resource-backed registry instead of hardcoded UI logic.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift)
- Pivot symbols: `ToolDisplaySummary`, `ToolDisplayRegistry`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawKitResources.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawKitResources.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json)
- Dangerous coupling: low; only mildly tied to OpenClaw tool naming conventions
- Strategy: `copier`

### Talk directives and spoken prompt helpers

- Goal: parse first-line JSON voice directives, select normalized provider config, and build the spoken-mode system prompt.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift)
- Pivot symbols: `TalkDirective`, `TalkDirectiveParseResult`, `TalkDirectiveParser`, `TalkProviderConfigSelection`, `TalkConfigParsing`, `TalkPromptBuilder`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawKit/AnyCodable.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/AnyCodable.swift), optionally [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkSystemSpeechSynthesizer.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkSystemSpeechSynthesizer.swift)
- Dangerous coupling: provider config naming still reflects OpenClaw talk-mode payloads, but the parser itself is small and portable
- Strategy: `copier`

### Deep link and setup-code parser

- Goal: parse agent-send deep links and gateway connect setup codes with loopback safety rules.
- Open first: [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift)
- Pivot symbols: `DeepLinkRoute`, `GatewayConnectDeepLink`, `AgentDeepLink`, `DeepLinkParser`, `GatewayConnectDeepLink.fromSetupCode`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawKit/LoopbackHost.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/LoopbackHost.swift)
- Dangerous coupling: low-medium; only the exact URL scheme and query names are product-specific
- Strategy: `copier`

### Swabble wake-word gate

- Goal: identify the command text that follows a trigger phrase using timestamped speech segments and minimum post-trigger gap rules.
- Open first: [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift)
- Pivot symbols: `WakeWordSegment`, `WakeWordGateConfig`, `WakeWordGateMatch`, `WakeWordGate.match`, `WakeWordGate.commandText`, `WakeWordSpeechSegments`
- Strictly required modules: none beyond Foundation, with optional `Speech` bridge for `WakeWordSpeechSegments`
- Dangerous coupling: very low; this is generic speech glue, not OpenClaw-specific runtime
- Strategy: `copier`

## symbol map

### Protocol models

- [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift): `GATEWAY_PROTOCOL_VERSION`, `ConnectParams`, `HelloOk`, `RequestFrame`, `ResponseFrame`, `EventFrame`, `Snapshot`, `SessionsListParams`, `SessionsPatchParams`, `ConfigSchemaResponse`, `ToolsCatalogResult`

### Shared gateway runtime

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift): `WebSocketTasking`, `WebSocketTaskBox`, `WebSocketSessioning`, `WebSocketSessionBox`, `GatewayConnectOptions`, `GatewayAuthSource`, `GatewayChannelActor`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift): `GatewayConnectAuthDetailCode`, `GatewayConnectRecoveryNextStep`, `GatewayConnectAuthError`, `GatewayResponseError`, `GatewayDecodingError`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift): `GatewayTLSParams`, `GatewayTLSStore`, `GatewayTLSPinningSession`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift): `GatewayPush`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift): `GatewayNodeSession`, `invokeWithTimeout`

### Shared chat UI

- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift): `OpenClawChatTransportEvent`, `OpenClawChatTransport`
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift): `OpenClawChatViewModel`
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift): `OpenClawChatView`
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift): `OpenClawChatUsageCost`, `OpenClawChatUsage`, `OpenClawChatMessageContent`, `OpenClawChatMessage`, `OpenClawChatHistoryPayload`, `OpenClawChatSendResponse`
- [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift): `ChatPayloadDecoding`

### Helpers and small seams

- [`apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift): `ToolDisplaySummary`, `ToolDisplayRegistry`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift): `TalkDirective`, `TalkDirectiveParseResult`, `TalkDirectiveParser`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift): `TalkProviderConfigSelection`, `TalkConfigParsing`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift): `TalkPromptBuilder`
- [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift): `DeepLinkRoute`, `GatewayConnectDeepLink`, `AgentDeepLink`, `DeepLinkParser`
- [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift): `WakeWordSegment`, `WakeWordGateConfig`, `WakeWordGateMatch`, `WakeWordGate`, `WakeWordSpeechSegments`

### App shells

- [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift): `NodeAppModel`
- [`apps/ios/Sources/Gateway/GatewayConnectionController.swift`](../../apps/ios/Sources/Gateway/GatewayConnectionController.swift): `GatewayConnectionController`
- [`apps/android/app/src/main/java/ai/openclaw/app/chat/ChatController.kt`](../../apps/android/app/src/main/java/ai/openclaw/app/chat/ChatController.kt): `ChatController`

## dependency map

### Internal dependencies you really need

- `OpenClawChatUI` depends on both [`apps/shared/OpenClawKit/Sources/OpenClawKit/`](../../apps/shared/OpenClawKit/Sources/OpenClawKit) and [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol).
- `GatewayChannelActor` depends on device auth and identity helpers plus continuation support; those are not optional if you want the same auth behavior.
- `GatewayNodeSession` depends on `GatewayChannelActor` and bridge frame types, so it is a second-layer extraction, not a first one.
- `ToolDisplayRegistry` depends on the packaged JSON resource file, not just the Swift code.

### External dependencies

- `ElevenLabsKit` for speech types and players
- `textual` for chat markdown rendering
- Apple frameworks: `Foundation`, `Security`, `CryptoKit`, `SwiftUI`, `URLSessionWebSocketTask`, `AVFoundation`, `Contacts`, `CoreLocation`, `CoreMotion`, `Photos`, `ReplayKit`, `UserNotifications`
- `Commander` and `swift-testing` inside `Swabble`

### Runtime and config assumptions

- Gateway transport assumes OpenClaw websocket frames, auth detail codes, device-token pairing, and snapshot-first connection behavior.
- Chat UI assumes OpenClaw-style history, send, abort, sessions, models, and health operations unless you provide a compatible adapter.
- iOS shells assume UserDefaults and Keychain layouts plus OpenClaw-specific gateway discovery and voice-wake flows.

### Glue you can rewrite to lower coupling

- Replace `GatewayNodeSession` with a thinner facade if you only need request/response RPC rather than node invoke and canvas capability logic.
- Keep `OpenClawChatTransport` but rewrite the concrete transport implementation such as [`apps/ios/Sources/Chat/IOSGatewayChatTransport.swift`](../../apps/ios/Sources/Chat/IOSGatewayChatTransport.swift).
- Reuse DTO and helper packs from `OpenClawKit` while rewriting the iOS shell in [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift).

## extraction recipes

### Recipe: publish the Swift gateway contract pack on its own

- Copy [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol) as a standalone Swift package.
- Keep `GatewayModels.swift` generated and treat it as source-of-truth output, not hand-maintained code.
- Export `AnyCodable` with it so the protocol DTOs keep their loose payload support.

### Recipe: reuse Apple gateway transport without the iOS app shell

- Copy [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift), and the device auth helpers.
- Keep `GatewayChannelActor` and its typed error/TLS support together.
- Rewrite the connect options and recovery policy only if your host does not use OpenClaw's operator/device identity model.

### Recipe: embed the shared chat UI in another Apple client

- Carry [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI) plus the minimal supporting pieces from [`apps/shared/OpenClawKit/Sources/OpenClawKit/`](../../apps/shared/OpenClawKit/Sources/OpenClawKit) and [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol).
- Implement your own `OpenClawChatTransport` rather than copying [`apps/ios/Sources/Chat/IOSGatewayChatTransport.swift`](../../apps/ios/Sources/Chat/IOSGatewayChatTransport.swift) verbatim unless your backend is identical.
- Start with `OpenClawChatViewModel` and only add `OpenClawChatView` when you are ready to accept the SwiftUI surface.

### Recipe: reuse tool display or talk helpers as standalone utilities

- Copy [`apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift) with [`apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json) if you need concise tool summaries.
- Copy [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift), and [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift) together if you need voice-mode prompting and directive parsing.

### Recipe: reuse mobile deep-link or wake-word seams

- Copy [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift) with [`apps/shared/OpenClawKit/Sources/OpenClawKit/LoopbackHost.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/LoopbackHost.swift) for setup-code and route parsing.
- Copy [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift) alone for wake-word gating; there is no need to copy the whole `Swabble` CLI.

## do not copy blindly

- Do not copy [`apps/ios/Sources/Model/NodeAppModel.swift`](../../apps/ios/Sources/Model/NodeAppModel.swift). It is an app shell, not a reusable SDK seam.
- Do not copy [`apps/ios/Sources/Gateway/GatewayConnectionController.swift`](../../apps/ios/Sources/Gateway/GatewayConnectionController.swift) unless you also want Bonjour discovery, trust prompts, defaults layout, and OpenClaw-specific auto-connect policy.
- Do not copy [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift) if your client does not need node invoke bridging or canvas capability handling.
- Do not edit [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift) manually after copying. Regenerate it instead.
- Do not copy the entire `Swabble` package just to get wake-word detection. [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift) is the bounded slice.

## minimal reusable slices

### Slice: Swift protocol models

- Strategy: `copier`
- Files: [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift), [`apps/shared/OpenClawKit/Sources/OpenClawProtocol/AnyCodable.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawProtocol/AnyCodable.swift)
- Carry together: `ConnectParams`, `HelloOk`, `RequestFrame`, `ResponseFrame`, `EventFrame`
- Replace with shim: regeneration pipeline, not hand edits

### Slice: Apple gateway channel

- Strategy: `adapter`
- Files: [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayPush.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthPayload.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthPayload.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthStore.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceAuthStore.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceIdentity.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeviceIdentity.swift)
- Carry together: `GatewayChannelActor`, `GatewayConnectAuthError`, `GatewayTLSStore`
- Replace with shim: auth detail-code mapping if your gateway differs

### Slice: chat transport plus view model

- Strategy: `adapter`
- Files: [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatModels.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatPayloadDecoding.swift)
- Carry together: `OpenClawChatTransport`, `OpenClawChatViewModel`, `OpenClawChatMessage`
- Replace with shim: concrete transport implementation

### Slice: tool display registry

- Strategy: `copier`
- Files: [`apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/ToolDisplay.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/Resources/tool-display.json), [`apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawKitResources.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawKitResources.swift)
- Carry together: `ToolDisplayRegistry.resolve`, `ToolDisplaySummary`
- Replace with shim: the resource loading bundle if your package layout changes

### Slice: talk directive and prompt pack

- Strategy: `copier`
- Files: [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkDirective.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkConfigParsing.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/TalkPromptBuilder.swift)
- Carry together: `TalkDirectiveParser.parse`, `TalkConfigParsing.selectProviderConfig`, `TalkPromptBuilder.build`
- Replace with shim: provider naming if you do not use OpenClaw talk configs

### Slice: deep-link parser

- Strategy: `copier`
- Files: [`apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/DeepLinks.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/LoopbackHost.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/LoopbackHost.swift)
- Carry together: `GatewayConnectDeepLink.fromSetupCode`, `DeepLinkParser.parse`
- Replace with shim: URL scheme and query-name policy

### Slice: wake-word gate

- Strategy: `copier`
- Files: [`Swabble/Sources/SwabbleKit/WakeWordGate.swift`](../../Swabble/Sources/SwabbleKit/WakeWordGate.swift)
- Carry together: `WakeWordGate.match`, `WakeWordGate.commandText`
- Replace with shim: nothing, unless your speech segment type differs

## exact search shortcuts

- `rg -n "GATEWAY_PROTOCOL_VERSION|ConnectParams|HelloOk|RequestFrame|EventFrame|ConfigSchemaResponse" apps/shared/OpenClawKit/Sources/OpenClawProtocol/GatewayModels.swift`
- `rg -n "GatewayConnectOptions|GatewayAuthSource|GatewayChannelActor|sendConnect|request\\(" apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`
- `rg -n "GatewayConnectAuthError|GatewayResponseError|GatewayDecodingError|GatewayConnectAuthDetailCode" apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayErrors.swift`
- `rg -n "GatewayTLSParams|GatewayTLSStore|GatewayTLSPinningSession" apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayTLSPinning.swift`
- `rg -n "GatewayNodeSession|invokeWithTimeout|refreshNodeCanvasCapability|currentCanvasHostUrl" apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayNodeSession.swift`
- `rg -n "OpenClawChatTransport|OpenClawChatTransportEvent|OpenClawChatViewModel|OpenClawChatView" apps/shared/OpenClawKit/Sources/OpenClawChatUI`
- `rg -n "ToolDisplayRegistry|ToolDisplaySummary|TalkDirectiveParser|TalkConfigParsing|TalkPromptBuilder|DeepLinkParser" apps/shared/OpenClawKit/Sources/OpenClawKit`
- `rg -n "WakeWordGate|WakeWordGateConfig|WakeWordGateMatch|WakeWordSpeechSegments" Swabble/Sources/SwabbleKit/WakeWordGate.swift`
