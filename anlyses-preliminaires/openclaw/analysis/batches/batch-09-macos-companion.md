# Batch 09 - macOS Companion

Scope: `363` files. Main concentration: [`apps/macos/Sources/OpenClaw/`](../../apps/macos/Sources/OpenClaw), [`apps/macos/Sources/OpenClawDiscovery/`](../../apps/macos/Sources/OpenClawDiscovery), [`apps/macos/Sources/OpenClawMacCLI/`](../../apps/macos/Sources/OpenClawMacCLI), and [`apps/macos/Sources/OpenClawIPC/`](../../apps/macos/Sources/OpenClawIPC).

## purpose

This batch contains the native macOS shell around the gateway: menu bar bootstrap, launchd supervision, remote gateway discovery and tunneling, native exec approvals, desktop chat and canvas panels, and the companion CLI.

For reuse work, the most important split is between clean desktop-facing seams and app-specific composition hubs. The cleanest seams are the desktop IPC contract in [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift), the discovery stack in [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift), [`apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift), and [`apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift), the endpoint and tunnel layer in [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift), [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift), and [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift), the launchd supervisor in [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift) and [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift), the exec-approval bridge in [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift) and [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift), and the desktop web chat or canvas wrappers in [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift), [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift), [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift), and [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift).

The dangerous hubs are [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift), [`apps/macos/Sources/OpenClaw/Onboarding.swift`](../../apps/macos/Sources/OpenClaw/Onboarding.swift), [`apps/macos/Sources/OpenClaw/AppState.swift`](../../apps/macos/Sources/OpenClaw/AppState.swift), [`apps/macos/Sources/OpenClaw/TalkModeRuntime.swift`](../../apps/macos/Sources/OpenClaw/TalkModeRuntime.swift), and [`apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift`](../../apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift), because they fuse process lifecycle, gateway policies, onboarding, permissions, voice, pairing, node runtime, and UI state in one place.

## entrypoints

- [`apps/macos/Package.swift`](../../apps/macos/Package.swift): package definition for `OpenClawIPC`, `OpenClawDiscovery`, `OpenClaw`, and `OpenClawMacCLI`.
- [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift): menu bar app bootstrap, startup wiring, and lifecycle root.
- [`apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift`](../../apps/macos/Sources/OpenClawMacCLI/EntryPoint.swift): CLI dispatch for `discover`, `connect`, and `wizard`.
- [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift): the public discovery entry point reused by settings, onboarding, and CLI.

## key files

- [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift): shared desktop IPC contract for permissions, shell, notifications, canvas, node actions, and camera or screen capture.
- [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift): single shared `GatewayChannelActor` owner with retry policy, snapshot cache, push fan-out, and typed RPC helpers.
- [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift): resolution of the effective local or remote gateway endpoint, token or password source, and remote-tunnel state.
- [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift): SSH tunnel lifecycle with port reuse and restart backoff.
- [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift): observable Tailscale status bridge used by remote-mode resolution.
- [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift): local gateway attach-or-start policy and launchd-backed supervision.
- [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift): gateway launch-agent shell around `openclaw gateway install`, `uninstall`, `status`, and `restart`.
- [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift): Bonjour browser plus wide-area and Tailscale Serve fallbacks, service resolution, and local-filtering logic.
- [`apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift`](../../apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift): remote onboarding probe and auth-issue mapper.
- [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift): local UNIX socket client/server for prompt requests plus host-side execution path.
- [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift): policy evaluation shell over allowlists, host-env sanitization, and skill trust.
- [`apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift`](../../apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift): validation and allow or prompt decision path for host exec requests.
- [`apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift): gateway-push adapter that turns `exec.approval.requested` events into native prompt decisions.
- [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift): `MacGatewayChatTransport` plus window or panel wrapper over the shared SwiftUI chat kit.
- [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift): simple show or toggle state shell for desktop web chat windows and panels.
- [`apps/macos/Sources/OpenClaw/CanvasManager.swift`](../../apps/macos/Sources/OpenClaw/CanvasManager.swift): native canvas panel lifecycle, A2UI auto-navigation, snapshot, and eval wrapper.
- [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift): custom URL scheme and MIME resolution for local canvas files.
- [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift): sandboxed file serving for the canvas panel with index fallback and resource scaffolding.
- [`apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift): direct gateway connect or health probe CLI.
- [`apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift): discovery CLI over `GatewayDiscoveryModel`.
- [`apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift): interactive wizard client with device-auth-signed connect flow.

## data flow

- [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift) boots `OpenClawApp`, installs the menu bar scene, and starts long-lived managers such as `GatewayProcessManager.shared`, `ControlChannel.shared`, `ExecApprovalsPromptServer.shared`, `ExecApprovalsGatewayPrompter.shared`, `MacNodeModeCoordinator.shared`, and `PresenceReporter.shared`.
- The effective gateway URL is resolved by [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift) from app state, config, environment overrides, launchd snapshots, Tailscale state, and optional SSH tunnels.
- [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift) consumes that resolved config, owns one `GatewayChannelActor`, caches the last `HelloOk` snapshot, and exposes typed request helpers to the rest of the app.
- Local mode goes through [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift) and [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift), which either attach to an existing gateway or ask the CLI-managed launch agent to install or restart it.
- Remote mode flows through [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift), [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift), and [`apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift`](../../apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift).
- Discovery surfaces like settings, onboarding, and the CLI read [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift), which combines Bonjour, wide-area DNS-SD, and Tailscale Serve probes into one `DiscoveredGateway` list.
- Desktop chat uses [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift) and [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift) on top of the shared `OpenClawChatUI` transport contract from batch 08.
- Desktop canvas uses [`apps/macos/Sources/OpenClaw/CanvasManager.swift`](../../apps/macos/Sources/OpenClaw/CanvasManager.swift), [`apps/macos/Sources/OpenClaw/CanvasWindowController.swift`](../../apps/macos/Sources/OpenClaw/CanvasWindowController.swift), [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift), and the request or response DTOs in [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift).
- Exec approvals arrive either as gateway push events handled by [`apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift) or as local socket requests handled by [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift), then flow through `ExecApprovalEvaluator.evaluate` and `ExecHostRequestEvaluator.evaluate`.
- [`apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift), [`apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift), and [`apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift) reuse the same discovery and gateway protocol stack without pulling in the whole menu bar UI.

## external deps

- [`apps/macos/Package.swift`](../../apps/macos/Package.swift) depends on `MenuBarExtraAccess`, `swift-subprocess`, `swift-log`, `Sparkle`, `Peekaboo`, [`apps/shared/OpenClawKit`](../../apps/shared/OpenClawKit), and [`Swabble`](../../Swabble).
- Native surfaces depend on `AppKit`, `SwiftUI`, `WebKit`, `Network`, `Security`, and `URLSessionWebSocketTask`.
- Discovery and remote-mode helpers also depend on host tools and network services such as `ssh`, `dig`, `tailscale status --json`, the Tailscale local API at `http://100.100.100.100/api/data`, and launchd or `launchctl`.

## flags/env

- [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift) explicitly handles `--attach-only`, `--no-launchd`, and `--chat` or `--webchat`.
- [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift) gives precedence to `OPENCLAW_GATEWAY_TOKEN` and `OPENCLAW_GATEWAY_PASSWORD` over config or launchd snapshot values.
- [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift) uses the marker `~/.openclaw/disable-launchagent` to disable writes to the gateway launch agent.
- [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift) reads the Tailscale local API and falls back to interface scanning via `TailscaleNetwork.detectTailnetIPv4()`.
- [`apps/macos/Sources/OpenClaw/LaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/LaunchAgentManager.swift) writes the app autostart plist under `~/Library/LaunchAgents/`.

## subdomains

### Desktop IPC contract

Classification: `runtime central` plus `adapters`.

Anchors:

- [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift)
- [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift)
- [`apps/macos/Sources/OpenClaw/CanvasA2UIActionMessageHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasA2UIActionMessageHandler.swift)

This is the cleanest batch-09 seam. `OpenClawIPC.Request` and `Response` define a desktop-local contract for permissions, notifications, shell execution, canvas operations, node commands, and media capture without pulling in the menu bar shell.

### Gateway endpoint, tunnel, and shared channel stack

Classification: `runtime central`.

Anchors:

- [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift)
- [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift)
- [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift)
- [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift)
- [`apps/macos/Sources/OpenClaw/ControlChannel.swift`](../../apps/macos/Sources/OpenClaw/ControlChannel.swift)

This is the core desktop runtime seam for talking to the gateway. It is reusable, but only if the target host is willing to adopt OpenClaw gateway semantics or write a substantial adapter.

### Local launchd supervision and attach-or-start policy

Classification: `infra` plus `glue`.

Anchors:

- [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift)
- [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift)
- [`apps/macos/Sources/OpenClaw/GatewayEnvironment.swift`](../../apps/macos/Sources/OpenClaw/GatewayEnvironment.swift)
- [`apps/macos/Sources/OpenClaw/LaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/LaunchAgentManager.swift)

This subdomain is useful if the target host also wants a local daemon supervised from a desktop shell. The OpenClaw-specific part is the CLI contract used to install, uninstall, or restart the gateway service.

### Discovery and remote onboarding

Classification: `adapters` plus `glue`.

Anchors:

- [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift)
- [`apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift)
- [`apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift)
- [`apps/macos/Sources/OpenClawDiscovery/TailscaleNetwork.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleNetwork.swift)
- [`apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift`](../../apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift)

This is the best remote-setup seam in the batch. The discovery model is relatively self-contained, but its service types, TXT fields, and auth-issue mapping are OpenClaw-specific.

### Exec approvals bridge

Classification: `runtime central` plus `adapters`.

Anchors:

- [`apps/macos/Sources/OpenClaw/ExecApprovals.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovals.swift)
- [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift)
- [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift)
- [`apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift`](../../apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift)
- [`apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift)

This is one of the most reusable policy stacks in the batch. It cleanly separates the prompt transport, host request validation, allowlist evaluation, and gateway event bridge.

### Desktop web chat wrapper

Classification: `UI` plus `glue`.

Anchors:

- [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift)
- [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift)

This is a small desktop shell over the shared SwiftUI chat from batch 08. The reuse seam is not the full app, but the way `MacGatewayChatTransport` and `WebChatSwiftUIWindowController` wrap an existing chat transport into native panel or window behavior.

### Canvas panel and local-scheme loader

Classification: `UI` plus `adapters`.

Anchors:

- [`apps/macos/Sources/OpenClaw/CanvasManager.swift`](../../apps/macos/Sources/OpenClaw/CanvasManager.swift)
- [`apps/macos/Sources/OpenClaw/CanvasWindowController.swift`](../../apps/macos/Sources/OpenClaw/CanvasWindowController.swift)
- [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift)
- [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift)
- [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift)

This subdomain is a good example of a desktop-native wrapper around a filesystem-backed canvas concept. The simplest reusable seam is the local URL scheme plus safe file-serving policy.

### macOS CLI surface

Classification: `adapters` plus `infra`.

Anchors:

- [`apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift)
- [`apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift)
- [`apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift)
- [`apps/macos/Sources/OpenClawMacCLI/GatewayConfig.swift`](../../apps/macos/Sources/OpenClawMacCLI/GatewayConfig.swift)

The CLI pack is useful as a stripped-down integration example: discovery, direct gateway connect, and wizard progression without any menu bar or SwiftUI shell.

### Menu bar, onboarding, voice, and node composition shell

Classification: `UI` plus `glue`.

Anchors:

- [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift)
- [`apps/macos/Sources/OpenClaw/Onboarding.swift`](../../apps/macos/Sources/OpenClaw/Onboarding.swift)
- [`apps/macos/Sources/OpenClaw/AppState.swift`](../../apps/macos/Sources/OpenClaw/AppState.swift)
- [`apps/macos/Sources/OpenClaw/TalkModeRuntime.swift`](../../apps/macos/Sources/OpenClaw/TalkModeRuntime.swift)
- [`apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift`](../../apps/macos/Sources/OpenClaw/NodeMode/MacNodeModeCoordinator.swift)

These files are indispensable for understanding how the companion works, but they are the worst early extraction targets because too many services and policies converge here.

## feature inventory

### Desktop IPC request and response contract

- Goal: reuse a typed desktop-local protocol for canvas, shell, notification, permission, node, camera, and screen-record requests.
- Open first: [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift)
- Pivot symbols: `Capability`, `CameraFacing`, `NotificationPriority`, `NotificationDelivery`, `CanvasPlacement`, `CanvasShowStatus`, `CanvasShowResult`, `CanvasA2UICommand`, `Request`, `Response`
- Strictly required modules: none beyond Foundation and CoreGraphics
- Dangerous coupling: medium-low; the enum cases still reflect OpenClaw feature names such as `agent`, `canvasA2UI`, and `nodeInvoke`
- Strategy: `copier`

### Gateway endpoint resolution, tunnel, and shared channel runtime

- Goal: resolve the effective local or remote control endpoint, optionally start or reuse an SSH tunnel, and expose one shared websocket client with retry helpers.
- Open first: [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift), [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift), [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift)
- Pivot symbols: `GatewayEndpointState`, `GatewayEndpointStore`, `GatewayEndpointStore.Deps`, `GatewayEndpointStore.subscribe`, `GatewayEndpointStore.ensureRemoteControlTunnel`, `GatewayEndpointStore.requireConfig`, `GatewayEndpointStore.maybeFallbackToTailnet`, `RemoteTunnelManager.ensureControlTunnel`, `GatewayConnection`, `GatewayConnection.request`, `GatewayConnection.subscribe`, `GatewayConnection.healthOK`, `GatewayConnection.sendAgent`, `GatewayConnection.chatSend`, `GatewayAgentInvocation`
- Strictly required modules: [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift), [`apps/macos/Sources/OpenClaw/GatewayRemoteConfig.swift`](../../apps/macos/Sources/OpenClaw/GatewayRemoteConfig.swift), [`apps/macos/Sources/OpenClaw/OpenClawConfigFile.swift`](../../apps/macos/Sources/OpenClaw/OpenClawConfigFile.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift)
- Dangerous coupling: hardcoded OpenClaw method names, local or remote mode semantics, Tailscale-aware host selection, and gateway-auth fallback policy
- Strategy: `adapter`

### Launchd-backed local gateway supervisor

- Goal: attach to an existing local gateway or install and restart the launch-agent-managed gateway when the desktop shell needs it.
- Open first: [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift), [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift)
- Pivot symbols: `GatewayProcessManager`, `GatewayProcessManager.Status`, `setActive`, `ensureLaunchAgentEnabledIfNeeded`, `startIfNeeded`, `attachExistingGatewayIfAvailable`, `GatewayLaunchAgentManager.isLaunchAgentWriteDisabled`, `GatewayLaunchAgentManager.set`, `GatewayLaunchAgentManager.kickstart`, `GatewayLaunchAgentManager.launchdConfigSnapshot`, `LaunchAgentManager.plistContents`
- Strictly required modules: [`apps/macos/Sources/OpenClaw/GatewayEnvironment.swift`](../../apps/macos/Sources/OpenClaw/GatewayEnvironment.swift), [`apps/macos/Sources/OpenClaw/CommandResolver.swift`](../../apps/macos/Sources/OpenClaw/CommandResolver.swift), [`apps/macos/Sources/OpenClaw/PortGuardian.swift`](../../apps/macos/Sources/OpenClaw/PortGuardian.swift), [`apps/macos/Sources/OpenClaw/ShellExecutor.swift`](../../apps/macos/Sources/OpenClaw/ShellExecutor.swift)
- Dangerous coupling: depends on the OpenClaw CLI daemon-management commands and on specific launchd labels, file paths, and health endpoints
- Strategy: `adapter`

### Gateway discovery with wide-area and Tailscale fallbacks

- Goal: discover candidate gateways across Bonjour, wide-area DNS-SD, and Tailscale Serve, then collapse them into one user-facing list.
- Open first: [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift), [`apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift), [`apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift)
- Pivot symbols: `GatewayDiscoveryModel`, `GatewayDiscoveryModel.DiscoveredGateway`, `GatewayDiscoveryModel.start`, `GatewayDiscoveryModel.refreshRemoteFallbackNow`, `WideAreaGatewayBeacon`, `WideAreaGatewayDiscovery.discover`, `TailscaleServeGatewayBeacon`, `TailscaleServeGatewayDiscovery.discover`, `TailscaleServeGatewayDiscovery.resolveExecutablePath`, `TailscaleServeGatewayDiscovery.commandEnvironment`, `TailscaleNetwork.detectTailnetIPv4`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawBonjour.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawBonjour.swift), [`apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift`](../../apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift) if you also want remote onboarding status
- Dangerous coupling: OpenClaw service types, TXT-key conventions such as `tailnetDns` and `gatewayPort`, and trust assumptions about the Tailscale resolver
- Strategy: `adapter`

### Native exec-approval socket and policy bridge

- Goal: bridge gateway-side or local exec-approval requests into native prompts, allowlist policy evaluation, and optional host-side execution.
- Open first: [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift), [`apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift`](../../apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift)
- Pivot symbols: `ExecApprovalPromptRequest`, `ExecHostRequest`, `ExecApprovalsSocketClient.requestDecision`, `ExecApprovalsPromptServer`, `ExecApprovalsPromptPresenter.prompt`, `ExecApprovalsSocketPathGuard`, `ExecApprovalEvaluation`, `ExecApprovalEvaluator.evaluate`, `ExecHostRequestEvaluator.validateRequest`, `ExecHostRequestEvaluator.evaluate`, `ExecApprovalsGatewayPrompter`
- Strictly required modules: [`apps/macos/Sources/OpenClaw/ExecApprovals.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovals.swift), [`apps/macos/Sources/OpenClaw/ExecAllowlistMatcher.swift`](../../apps/macos/Sources/OpenClaw/ExecAllowlistMatcher.swift), [`apps/macos/Sources/OpenClaw/ExecCommandResolution.swift`](../../apps/macos/Sources/OpenClaw/ExecCommandResolution.swift), [`apps/macos/Sources/OpenClaw/HostEnvSanitizer.swift`](../../apps/macos/Sources/OpenClaw/HostEnvSanitizer.swift), [`apps/macos/Sources/OpenClaw/HostEnvSecurityPolicy.generated.swift`](../../apps/macos/Sources/OpenClaw/HostEnvSecurityPolicy.generated.swift)
- Dangerous coupling: the security model is OpenClaw-specific and expects `ExecSecurity`, `ExecAsk`, gateway event names, allowlist grammar, and the generated host-env policy
- Strategy: `adapter`

### Desktop web chat wrapper around the shared SwiftUI kit

- Goal: embed the shared Apple chat UI inside native macOS windows or anchored panels without rewriting chat state or transcript decoding.
- Open first: [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift), [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift)
- Pivot symbols: `MacGatewayChatTransport`, `MacGatewayChatTransport.mapPushToTransportEvent`, `WebChatSwiftUIWindowController`, `presentAnchored`, `WebChatManager`, `show`, `togglePanel`, `preferredSessionKey`
- Strictly required modules: [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatTransport.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatViewModel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI/ChatView.swift), [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift)
- Dangerous coupling: transport calls assume OpenClaw gateway methods such as `chat.history`, `chat.send`, `sessions.list`, `sessions.patch`, and `models.list`
- Strategy: `adapter`

### Canvas scheme, safe file serving, and native panel shell

- Goal: host a filesystem-backed local canvas inside a native panel with a custom URL scheme, safe path resolution, scaffold fallback, and A2UI navigation support.
- Open first: [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift), [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift), [`apps/macos/Sources/OpenClaw/CanvasManager.swift`](../../apps/macos/Sources/OpenClaw/CanvasManager.swift)
- Pivot symbols: `CanvasScheme`, `CanvasScheme.makeURL`, `CanvasScheme.mimeType`, `CanvasSchemeHandler`, `CanvasManager`, `showDetailed`, `eval`, `snapshot`, `CanvasPlacement`, `CanvasShowResult`, `CanvasShowStatus`
- Strictly required modules: [`apps/macos/Sources/OpenClaw/CanvasWindowController.swift`](../../apps/macos/Sources/OpenClaw/CanvasWindowController.swift), [`apps/macos/Sources/OpenClaw/CanvasA2UIActionMessageHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasA2UIActionMessageHandler.swift), [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift)
- Dangerous coupling: `CanvasManager` depends on `GatewayConnection` snapshot state and OpenClaw-specific `canvashosturl` or A2UI behavior, so the smallest portable seam is the scheme plus file handler, not the whole manager
- Strategy: `adapter`

### macOS debug CLI for discovery, connect, and wizard progression

- Goal: expose the companion runtime through a small CLI that can discover gateways, connect directly, and step through the wizard without opening the menu bar app.
- Open first: [`apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/ConnectCommand.swift), [`apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/DiscoverCommand.swift), [`apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift`](../../apps/macos/Sources/OpenClawMacCLI/WizardCommand.swift)
- Pivot symbols: `ConnectOptions`, `ConnectOutput`, `SnapshotStore`, `runConnect`, `DiscoveryOptions`, `DiscoveryOutput`, `runDiscover`, `WizardCliOptions`, `runWizardCommand`, `GatewayWizardClient`, `GatewayWizardClient.connect`, `GatewayWizardClient.request`
- Strictly required modules: [`apps/macos/Sources/OpenClawMacCLI/GatewayConfig.swift`](../../apps/macos/Sources/OpenClawMacCLI/GatewayConfig.swift), [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift), [`apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/GatewayChannel.swift)
- Dangerous coupling: the wizard client hardcodes the gateway connect challenge, device-auth signing, operator role, and protocol version expectations
- Strategy: `adapter`

### Menu bar composition shell

- Goal: study how the macOS app composes startup, onboarding, prompts, voice, node mode, settings, and panels around one menu bar entrypoint.
- Open first: [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift), [`apps/macos/Sources/OpenClaw/Onboarding.swift`](../../apps/macos/Sources/OpenClaw/Onboarding.swift), [`apps/macos/Sources/OpenClaw/AppState.swift`](../../apps/macos/Sources/OpenClaw/AppState.swift)
- Pivot symbols: `OpenClawApp`, `AppDelegate`, `applicationDidFinishLaunching`, `OnboardingController`, `OnboardingView`, `AppState`, `MacNodeModeCoordinator`, `TalkModeRuntime`
- Strictly required modules: too many to carry cheaply; this is effectively the rest of [`apps/macos/Sources/OpenClaw/`](../../apps/macos/Sources/OpenClaw)
- Dangerous coupling: the whole app converges here, including startup ordering, state persistence, voice, onboarding, remote mode, permissions, and panel management
- Strategy: `reecrire`

## symbol map

### Desktop IPC and panel contracts

- `Capability`
- `NotificationPriority`
- `NotificationDelivery`
- `CanvasPlacement`
- `CanvasShowStatus`
- `CanvasShowResult`
- `CanvasA2UICommand`
- `Request`
- `Response`
- `CanvasScheme`
- `CanvasSchemeHandler`

### Gateway endpoint, connection, and launchd control

- `GatewayEndpointState`
- `GatewayEndpointStore`
- `GatewayEndpointStore.Deps`
- `GatewayConnection`
- `GatewayAgentChannel`
- `GatewayAgentInvocation`
- `RemoteTunnelManager`
- `TailscaleService`
- `GatewayProcessManager`
- `GatewayLaunchAgentManager`
- `LaunchAgentManager`
- `ControlChannel`

### Discovery and remote setup

- `GatewayDiscoveryModel`
- `GatewayDiscoveryModel.LocalIdentity`
- `GatewayDiscoveryModel.DiscoveredGateway`
- `WideAreaGatewayBeacon`
- `WideAreaGatewayDiscovery`
- `TailscaleServeGatewayBeacon`
- `TailscaleServeGatewayDiscovery`
- `TailscaleNetwork`
- `RemoteGatewayAuthIssue`
- `RemoteGatewayProbeSuccess`
- `RemoteGatewayProbe`

### Exec approvals and host execution

- `ExecSecurity`
- `ExecAsk`
- `ExecApprovalDecision`
- `ExecApprovalsStore`
- `ExecApprovalPromptRequest`
- `ExecHostRequest`
- `ExecHostError`
- `ExecApprovalsSocketClient`
- `ExecApprovalsPromptServer`
- `ExecApprovalsPromptPresenter`
- `ExecApprovalsSocketPathGuard`
- `ExecApprovalEvaluation`
- `ExecApprovalEvaluator`
- `ExecHostRequestEvaluator`
- `ExecApprovalsGatewayPrompter`

### Desktop chat, canvas, and CLI wrappers

- `MacGatewayChatTransport`
- `WebChatSwiftUIWindowController`
- `WebChatManager`
- `CanvasManager`
- `runConnect`
- `runDiscover`
- `runWizardCommand`
- `GatewayWizardClient`

### Composition hubs

- `OpenClawApp`
- `AppDelegate`
- `AppState`
- `OnboardingController`
- `OnboardingView`
- `TalkModeRuntime`
- `MacNodeModeCoordinator`

## dependency map

### Internal dependencies you really need

- The gateway desktop runtime is a stack, not isolated files: [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift), [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift), [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift), and [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift) move together.
- The exec-approval runtime also moves as a pack: [`apps/macos/Sources/OpenClaw/ExecApprovals.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovals.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift), [`apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift`](../../apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift), and [`apps/macos/Sources/OpenClaw/HostEnvSanitizer.swift`](../../apps/macos/Sources/OpenClaw/HostEnvSanitizer.swift).
- The web chat wrapper depends on batch-08 shared Swift code in [`apps/shared/OpenClawKit/Sources/OpenClawChatUI/`](../../apps/shared/OpenClawKit/Sources/OpenClawChatUI) plus the gateway runtime in [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift).
- The canvas wrapper depends on [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift), [`apps/macos/Sources/OpenClaw/CanvasWindowController.swift`](../../apps/macos/Sources/OpenClaw/CanvasWindowController.swift), and the gateway runtime if you keep A2UI auto-navigation.

### External dependencies

- `OpenClawKit`, `OpenClawProtocol`, and `OpenClawChatUI` are hard dependencies for the gateway and chat surfaces.
- `AppKit`, `SwiftUI`, `WebKit`, `Network`, and `Security` are required for most native macOS slices.
- `MenuBarExtraAccess`, `Sparkle`, and `Peekaboo` matter only for the full app shell, not for the smaller extraction slices.
- `ssh`, `dig`, `launchctl`, `tailscale status --json`, and the Tailscale local API are external runtime dependencies for remote or discovery slices.

### Runtime and config assumptions

- The companion reads `gateway.auth.*`, `gateway.remote.*`, launchd snapshots, `OPENCLAW_GATEWAY_TOKEN`, and `OPENCLAW_GATEWAY_PASSWORD` through [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift).
- Connection mode comes from persisted app state and defaults in [`apps/macos/Sources/OpenClaw/AppState.swift`](../../apps/macos/Sources/OpenClaw/AppState.swift).
- Discovery assumes the OpenClaw service type defined in [`apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawBonjour.swift`](../../apps/shared/OpenClawKit/Sources/OpenClawKit/OpenClawBonjour.swift) plus OpenClaw TXT keys such as `tailnetDns`, `gatewayPort`, and `cliPath`.
- The exec-approval path assumes the gateway emits `exec.approval.requested` and accepts `exec.approval.resolve`.

### Glue you can rewrite to lower coupling

- [`apps/macos/Sources/OpenClaw/ControlChannel.swift`](../../apps/macos/Sources/OpenClaw/ControlChannel.swift) is mostly a state wrapper over [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift).
- [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift) is thin window or panel glue around the shared chat kit.
- [`apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift`](../../apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift) can be rewritten if the target host uses different onboarding rules or auth messaging.
- [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift) can be split into a generic attach-or-start loop plus a host-specific daemon-control adapter.

## extraction recipes

### Recipe: publish the desktop IPC contract as a standalone package

- Carry [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift) alone first.
- Keep `Capability`, `Request`, `Response`, `CanvasPlacement`, and `CanvasShowResult` together so callers do not drift across ad hoc JSON payloads.
- Rewrite or delete the enum cases you do not need, but keep the typed shell around them.

### Recipe: reuse remote discovery without the menu bar app

- Start from [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift), [`apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift), [`apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift), and [`apps/macos/Sources/OpenClawDiscovery/TailscaleNetwork.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleNetwork.swift).
- Replace `OpenClawBonjour` constants and TXT parsing rules with a host-local discovery contract if the future project is not protocol-compatible with OpenClaw.
- Add [`apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift`](../../apps/macos/Sources/OpenClaw/RemoteGatewayProbe.swift) only if you also want onboarding diagnostics.

### Recipe: reuse the gateway endpoint and tunnel stack

- Carry [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift), [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift), [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift), and [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift).
- Shim config loading through `GatewayEndpointStore.Deps` instead of copying `AppStateStore` and `OpenClawConfigFile` wholesale.
- Trim `GatewayConnection` down to the subset of request helpers your target desktop actually needs.

### Recipe: reuse the exec-approval bridge in another desktop host

- Carry [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift), [`apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift`](../../apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift), and the required config or allowlist files from [`apps/macos/Sources/OpenClaw/ExecApprovals.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovals.swift).
- Keep the socket transport and policy evaluator together; they are the real reusable core.
- Replace OpenClaw-specific gateway event names and approval-store persistence first.

### Recipe: embed macOS chat or canvas surfaces without the full app

- For chat, carry [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift) and [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift) plus the batch-08 shared chat kit.
- For canvas, start smaller: [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift), [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift), and [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift).
- Add [`apps/macos/Sources/OpenClaw/CanvasManager.swift`](../../apps/macos/Sources/OpenClaw/CanvasManager.swift) only if you explicitly want gateway-driven auto-navigation and anchored panel behavior.

## do not copy blindly

- Do not copy [`apps/macos/Sources/OpenClaw/MenuBar.swift`](../../apps/macos/Sources/OpenClaw/MenuBar.swift), [`apps/macos/Sources/OpenClaw/Onboarding.swift`](../../apps/macos/Sources/OpenClaw/Onboarding.swift), or [`apps/macos/Sources/OpenClaw/AppState.swift`](../../apps/macos/Sources/OpenClaw/AppState.swift) into another product. They are composition roots, not reusable bricks.
- Do not copy [`apps/macos/Sources/OpenClaw/GatewayConnection.swift`](../../apps/macos/Sources/OpenClaw/GatewayConnection.swift) without auditing every hardcoded RPC method name and every local or remote retry branch.
- Do not copy [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift) blindly: it mixes config resolution, launchd fallback, environment precedence, remote tunnel startup, and Tailscale host logic.
- Do not copy the exec-approval stack without [`apps/macos/Sources/OpenClaw/HostEnvSecurityPolicy.generated.swift`](../../apps/macos/Sources/OpenClaw/HostEnvSecurityPolicy.generated.swift) and the allowlist or security helpers it expects.
- Do not copy the discovery pack if the target host does not control the Bonjour service type or Tailscale DNS trust model; the fallback scanners assume OpenClaw's conventions.
- Do not copy [`apps/macos/Sources/OpenClaw/CanvasManager.swift`](../../apps/macos/Sources/OpenClaw/CanvasManager.swift) if you only need local file serving; the manager itself is coupled to gateway snapshot state and menu bar anchoring.

## minimal reusable slices

### Slice: desktop IPC contract

- Files: [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift)
- Carry together: `Request`, `Response`, `Capability`, `CanvasPlacement`, `CanvasShowResult`
- Replace with shims: none
- Strategy: `copier`

### Slice: gateway discovery fallback pack

- Files: [`apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift`](../../apps/macos/Sources/OpenClawDiscovery/GatewayDiscoveryModel.swift), [`apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/WideAreaGatewayDiscovery.swift), [`apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleServeGatewayDiscovery.swift), [`apps/macos/Sources/OpenClawDiscovery/TailscaleNetwork.swift`](../../apps/macos/Sources/OpenClawDiscovery/TailscaleNetwork.swift)
- Carry together: `GatewayDiscoveryModel`, `WideAreaGatewayDiscovery`, `TailscaleServeGatewayDiscovery`, `TailscaleNetwork`
- Replace with shims: service type constants and TXT-key parsing
- Strategy: `adapter`

### Slice: remote endpoint and tunnel pack

- Files: [`apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift`](../../apps/macos/Sources/OpenClaw/GatewayEndpointStore.swift), [`apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift`](../../apps/macos/Sources/OpenClaw/RemoteTunnelManager.swift), [`apps/macos/Sources/OpenClaw/TailscaleService.swift`](../../apps/macos/Sources/OpenClaw/TailscaleService.swift)
- Carry together: `GatewayEndpointStore`, `GatewayEndpointState`, `RemoteTunnelManager`, `TailscaleService`
- Replace with shims: config source, SSH target parsing, and any non-OpenClaw auth configuration rules
- Strategy: `adapter`

### Slice: launchd gateway supervisor

- Files: [`apps/macos/Sources/OpenClaw/GatewayProcessManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayProcessManager.swift), [`apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift`](../../apps/macos/Sources/OpenClaw/GatewayLaunchAgentManager.swift), [`apps/macos/Sources/OpenClaw/GatewayEnvironment.swift`](../../apps/macos/Sources/OpenClaw/GatewayEnvironment.swift)
- Carry together: `GatewayProcessManager`, `GatewayLaunchAgentManager`, `GatewayEnvironment`
- Replace with shims: daemon-management CLI and health endpoint contract
- Strategy: `adapter`

### Slice: exec-approval bridge

- Files: [`apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsSocket.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalEvaluation.swift), [`apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift`](../../apps/macos/Sources/OpenClaw/ExecHostRequestEvaluator.swift), [`apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovalsGatewayPrompter.swift), [`apps/macos/Sources/OpenClaw/ExecApprovals.swift`](../../apps/macos/Sources/OpenClaw/ExecApprovals.swift)
- Carry together: socket transport, prompt presenter, evaluator, and approval-config types
- Replace with shims: gateway event names, persistence, and any host-specific allowlist grammar
- Strategy: `adapter`

### Slice: desktop chat wrapper

- Files: [`apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift`](../../apps/macos/Sources/OpenClaw/WebChatSwiftUI.swift), [`apps/macos/Sources/OpenClaw/WebChatManager.swift`](../../apps/macos/Sources/OpenClaw/WebChatManager.swift)
- Carry together: `MacGatewayChatTransport`, `WebChatSwiftUIWindowController`, `WebChatManager`
- Replace with shims: `GatewayConnection` request helpers or the full transport implementation
- Strategy: `adapter`

### Slice: canvas scheme and file-serving shell

- Files: [`apps/macos/Sources/OpenClaw/CanvasScheme.swift`](../../apps/macos/Sources/OpenClaw/CanvasScheme.swift), [`apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift`](../../apps/macos/Sources/OpenClaw/CanvasSchemeHandler.swift), [`apps/macos/Sources/OpenClawIPC/IPC.swift`](../../apps/macos/Sources/OpenClawIPC/IPC.swift)
- Carry together: `CanvasScheme`, `CanvasSchemeHandler`, `CanvasPlacement`, `CanvasShowResult`
- Replace with shims: bundled scaffold resource lookup and any A2UI messaging
- Strategy: `adapter`

## exact search shortcuts

- `rg -n "GatewayEndpointStore|ensureRemoteControlTunnel|maybeFallbackToTailnet|GatewayConnection|sendAgent|chatSend" apps/macos/Sources/OpenClaw`
- `rg -n "GatewayDiscoveryModel|WideAreaGatewayDiscovery|TailscaleServeGatewayDiscovery|RemoteGatewayProbe|TailscaleNetwork" apps/macos/Sources/OpenClawDiscovery apps/macos/Sources/OpenClaw`
- `rg -n "ExecApprovalPromptRequest|ExecApprovalsSocketClient|ExecApprovalEvaluator|ExecHostRequestEvaluator|exec.approval.requested" apps/macos/Sources/OpenClaw`
- `rg -n "WebChatManager|MacGatewayChatTransport|WebChatSwiftUIWindowController|CanvasManager|CanvasScheme|CanvasSchemeHandler" apps/macos/Sources/OpenClaw apps/macos/Sources/OpenClawIPC`
- `rg -n "GatewayProcessManager|GatewayLaunchAgentManager|LaunchAgentManager|--attach-only|--no-launchd|--chat" apps/macos/Sources/OpenClaw`
- `rg -n "runConnect|runDiscover|runWizardCommand|GatewayWizardClient" apps/macos/Sources/OpenClawMacCLI`
- `rg -n "Capability|Request|CanvasShowResult|CanvasA2UICommand" apps/macos/Sources/OpenClawIPC/IPC.swift`
