---
batch_id: B08
title: Bridge, remote & IDE integration
paths:
  - src/bridge/**
  - src/remote/**
  - src/server/**
  - src/upstreamproxy/**
  - src/utils/teleport/**
  - src/utils/githubRepoPathMapping.ts
priority: haute
status: enriched
keywords:
  - bridgeMain
  - initReplBridge
  - initBridgeCore
  - initEnvLessBridgeCore
  - bridgeMessaging
  - RemoteSessionManager
  - DirectConnectSessionManager
  - startUpstreamProxyRelay
---

# B08 - Bridge, remote & IDE integration

## Resume
- Couverture: 45 fichiers / 15955 lignes.
- Sous-domaines: `src/bridge/` (31 fichiers / 12613 lignes), `src/remote/` (4 / 1127), `src/server/` (3 / 358), `src/upstreamproxy/` (2 / 740), `src/utils/teleport/` (4 / 955), `src/utils/githubRepoPathMapping.ts` (1 / 162).
- Hubs de dependances internes: `src/bridge/types.ts` (8 dependants), `src/bridge/debugUtils.ts` (8), `src/bridge/sessionIdCompat.ts` (6), `src/utils/teleport/api.ts` (6), `src/bridge/replBridge.ts` (4).
- Points denses en dependances: `src/bridge/bridgeMain.ts` (37 deps internes), `src/bridge/initReplBridge.ts` (27), `src/bridge/replBridge.ts` (25), `src/bridge/remoteBridgeCore.ts` (22), `src/bridge/createSession.ts` (12).
- Decoupage utile pour la reutilisation: le protocole pur est concentre dans `src/bridge/bridgeMessaging.ts`, `src/bridge/types.ts`, `src/bridge/sessionIdCompat.ts`, `src/bridge/workSecret.ts`, `src/server/types.ts`, `src/upstreamproxy/relay.ts`; le glue runtime est surtout dans `src/bridge/initReplBridge.ts`, `src/bridge/replBridge.ts`, `src/bridge/remoteBridgeCore.ts`, `src/bridge/bridgeMain.ts`, `src/utils/teleport/api.ts`.

## purpose
Comprendre les mecanismes reutilisables pour:
- piloter un agent depuis un IDE ou un client externe,
- relayer des messages et callbacks de permission sur des sessions distantes,
- reutiliser un minimum viable de bridge/protocol/runtime sans emporter tout le shell REPL.

## subdomains
| Sous-domaine | Fichiers exacts | Role principal | Reutilisabilite |
| --- | --- | --- | --- |
| `bridge core` | `src/bridge/bridgeMain.ts`, `src/bridge/initReplBridge.ts`, `src/bridge/replBridge.ts`, `src/bridge/remoteBridgeCore.ts`, `src/bridge/createSession.ts`, `src/bridge/sessionRunner.ts`, `src/bridge/bridgeApi.ts` | orchestration du bridge, register/poll/reconnect, spawn child CLI, creation/archive de sessions | moyenne a haute, mais couplage eleve |
| `bridge messaging` | `src/bridge/bridgeMessaging.ts`, `src/bridge/types.ts`, `src/bridge/replBridgeTransport.ts`, `src/bridge/sessionIdCompat.ts`, `src/bridge/workSecret.ts`, `src/bridge/flushGate.ts`, `src/bridge/inboundMessages.ts`, `src/bridge/inboundAttachments.ts` | contrat wire-level, routage `control_request`/`control_response`, dedup UUID, adaptation v1/v2 | haute |
| `permission callbacks` | `src/bridge/bridgePermissionCallbacks.ts`, `src/remote/remotePermissionBridge.ts`, `src/remote/RemoteSessionManager.ts`, `src/server/directConnectManager.ts` | transport des prompts `can_use_tool`, reponse allow/deny, cancellation, adaptation UI locale | haute |
| `remote session management` | `src/remote/RemoteSessionManager.ts`, `src/remote/SessionsWebSocket.ts`, `src/remote/sdkMessageAdapter.ts`, `src/utils/teleport/api.ts` | client distant pour `/v1/sessions/*`, WebSocket subscribe, POST events, adaptation vers le REPL | haute |
| `direct connect server` | `src/server/createDirectConnectSession.ts`, `src/server/directConnectManager.ts`, `src/server/types.ts` | client leger pour un serveur local/direct connect parlant NDJSON sur WebSocket | haute |
| `teleport helpers` | `src/utils/teleport/api.ts`, `src/utils/teleport/environments.ts`, `src/utils/teleport/environmentSelection.ts`, `src/utils/teleport/gitBundle.ts`, `src/utils/githubRepoPathMapping.ts` | API Sessions/Environments, selection d'environnement, seed bundle git, mapping repo->clone locale | moyenne a haute |
| `upstream proxy` | `src/upstreamproxy/upstreamproxy.ts`, `src/upstreamproxy/relay.ts` | tunnel CONNECT local -> WebSocket CCR avec codec protobuf minimal | moyenne |

## entrypoints
- `src/bridge/bridgeMain.ts` -> `bridgeMain`, `runBridgeHeadless`, `runBridgeLoop`: entree CLI/headless pour un bridge permanent ou multi-session.
- `src/bridge/initReplBridge.ts` -> `initReplBridge`: wrapper REPL qui lit auth, settings, policy, git et choisit v1 env-based vs v2 env-less.
- `src/bridge/replBridge.ts` -> `initBridgeCore`: coeur env-based bootstrap-free, configurable via callbacks injectees.
- `src/bridge/remoteBridgeCore.ts` -> `initEnvLessBridgeCore`: coeur env-less/v2 base sur `POST /v1/code/sessions/{id}/bridge`.
- `src/remote/RemoteSessionManager.ts` -> `RemoteSessionManager`: client remote pour une session CCR via WebSocket subscribe + POST event.
- `src/server/createDirectConnectSession.ts` -> `createDirectConnectSession`: bootstrap d'une session directe sur un serveur local.
- `src/server/directConnectManager.ts` -> `DirectConnectSessionManager`: client WebSocket direct-connect.
- `src/upstreamproxy/upstreamproxy.ts` -> `initUpstreamProxy`: wiring container-side du proxy upstream.
- `src/upstreamproxy/relay.ts` -> `startUpstreamProxyRelay`: relais TCP CONNECT -> WebSocket.

## key files
- `src/bridge/bridgeMain.ts` - orchestration CLI complete: args, registration, resume, spawn mode, logger, poll loop.
- `src/bridge/replBridge.ts` - coeur env-based reutilisable si on veut conserver register/poll/reconnect/heartbeat.
- `src/bridge/remoteBridgeCore.ts` - alternative env-less pour IDE/client moderne: pas de poll loop, seulement session + `/bridge`.
- `src/bridge/bridgeMessaging.ts` - meilleur point d'extraction pour le protocole bridge pur.
- `src/bridge/replBridgeTransport.ts` - adaptation transport v1/v2 derriere une seule interface.
- `src/remote/RemoteSessionManager.ts` - plus petite couche "remote session live" exploitable telle quelle.
- `src/server/directConnectManager.ts` - variante ultra-legere si vous controlez le serveur distant.
- `src/upstreamproxy/relay.ts` - slice reseau tres compacte et assez autonome.
- `src/utils/teleport/api.ts` - surface HTTP principale pour sessions distantes et titres.

## data flow
- Bridge env-based:
  `initReplBridge` -> `initBridgeCore` -> `createBridgeApiClient.registerBridgeEnvironment` -> `pollForWork` -> `decodeWorkSecret` -> `createV1ReplTransport` ou `createV2ReplTransport` -> `handleIngressMessage` / `handleServerControlRequest` -> `sessionRunner.createSessionSpawner`.
- Bridge env-less:
  `initReplBridge` -> `initEnvLessBridgeCore` -> `createCodeSession` -> `fetchRemoteCredentials` -> `createV2ReplTransport` -> `createTokenRefreshScheduler` -> `rebuildTransport`.
- Remote session viewer:
  `RemoteSessionManager.connect` -> `SessionsWebSocket.connect` -> `handleControlRequest(can_use_tool)` / `onMessage` -> `sendEventToRemoteSession`.
- Direct connect:
  `createDirectConnectSession` -> `DirectConnectSessionManager.connect` -> NDJSON WebSocket -> `control_request` / `control_response` / `interrupt`.
- Upstream proxy:
  `initUpstreamProxy` -> `startUpstreamProxyRelay` -> `relay.encodeChunk` / `relay.decodeChunk` -> serveur CCR `/v1/code/upstreamproxy/ws`.

## protocol surfaces
| Surface | Endpoints / messages | Fichiers exacts |
| --- | --- | --- |
| Environments bridge v1 | `POST /v1/environments/bridge`, `GET .../work/poll`, `POST .../ack`, `POST .../stop`, `POST .../heartbeat`, `POST .../bridge/reconnect`, `POST /v1/sessions/{id}/events`, `POST /v1/sessions/{id}/archive` | `src/bridge/bridgeApi.ts`, `src/bridge/types.ts`, `src/bridge/createSession.ts` |
| Session ingress / compat | `ws(s)://.../v1|v2/session_ingress/ws/{sessionId}`, compat `session_*` <-> infra `cse_*` | `src/bridge/workSecret.ts`, `src/bridge/sessionIdCompat.ts` |
| CCR v2 / env-less | `POST /v1/code/sessions`, `POST /v1/code/sessions/{id}/bridge`, `POST /worker/register`, `GET /worker/events/stream`, `POST /worker/events`, `PUT /worker/state`, `POST /worker/events/{id}/delivery` | `src/bridge/remoteBridgeCore.ts`, `src/bridge/replBridgeTransport.ts`, `src/bridge/workSecret.ts` |
| Sessions API remote | `GET /v1/sessions`, `GET /v1/sessions/{id}`, `PATCH /v1/sessions/{id}`, `POST /v1/sessions/{id}/events`, `wss://.../v1/sessions/ws/{id}/subscribe` | `src/utils/teleport/api.ts`, `src/remote/SessionsWebSocket.ts`, `src/remote/RemoteSessionManager.ts` |
| Direct connect NDJSON | `POST {serverUrl}/sessions` -> `{session_id, ws_url}`, puis messages NDJSON `user`, `control_request`, `control_response`, `interrupt` | `src/server/createDirectConnectSession.ts`, `src/server/directConnectManager.ts`, `src/server/types.ts` |
| Upstream proxy | WebSocket `/v1/code/upstreamproxy/ws` + `UpstreamProxyChunk { bytes data = 1; }` | `src/upstreamproxy/relay.ts`, `src/upstreamproxy/upstreamproxy.ts` |

## feature inventory
| Slice | Fichiers exacts | Symboles exacts | Protocole pur ou glue | Valeur pour extraction |
| --- | --- | --- | --- | --- |
| Bridge core env-based | `src/bridge/initReplBridge.ts`, `src/bridge/replBridge.ts`, `src/bridge/bridgeApi.ts`, `src/bridge/createSession.ts`, `src/bridge/sessionRunner.ts`, `src/bridge/bridgePointer.ts` | `initReplBridge`, `initBridgeCore`, `createBridgeApiClient`, `createBridgeSession`, `createSessionSpawner`, `readBridgePointerAcrossWorktrees` | surtout glue runtime | utile si vous voulez la meme resilience qu'ici |
| Bridge messaging | `src/bridge/bridgeMessaging.ts`, `src/bridge/types.ts`, `src/bridge/replBridgeTransport.ts`, `src/bridge/sessionIdCompat.ts`, `src/bridge/workSecret.ts`, `src/bridge/flushGate.ts` | `handleIngressMessage`, `handleServerControlRequest`, `BoundedUUIDSet`, `makeResultMessage`, `ReplBridgeTransport`, `sameSessionId`, `buildCCRv2SdkUrl`, `FlushGate` | majoritairement protocole pur | meilleure extraction minimale pour IDE |
| Permission callbacks | `src/bridge/bridgePermissionCallbacks.ts`, `src/remote/remotePermissionBridge.ts`, `src/remote/RemoteSessionManager.ts`, `src/server/directConnectManager.ts` | `BridgePermissionCallbacks`, `isBridgePermissionResponse`, `createSyntheticAssistantMessage`, `createToolStub`, `respondToPermissionRequest` | contrat + adaptateurs | bonne slice pour approval distante |
| Remote session management | `src/remote/RemoteSessionManager.ts`, `src/remote/SessionsWebSocket.ts`, `src/remote/sdkMessageAdapter.ts`, `src/utils/teleport/api.ts` | `RemoteSessionManager`, `SessionsWebSocket`, `convertSDKMessage`, `sendEventToRemoteSession`, `updateSessionTitle` | mixte | tres reutilisable pour piloter un agent distant |
| Direct connect minimal | `src/server/createDirectConnectSession.ts`, `src/server/directConnectManager.ts`, `src/server/types.ts` | `createDirectConnectSession`, `DirectConnectSessionManager`, `connectResponseSchema` | plutot protocole + petit glue | meilleure option si vous controlez le backend |
| Teleport helpers | `src/utils/teleport/api.ts`, `src/utils/teleport/environments.ts`, `src/utils/teleport/environmentSelection.ts`, `src/utils/teleport/gitBundle.ts` | `prepareApiRequest`, `fetchCodeSessionsFromSessionsAPI`, `fetchEnvironments`, `getEnvironmentSelectionInfo`, `createAndUploadGitBundle` | glue HTTP / auth / bootstrap | utile pour discovery + seed repo |
| Upstream proxy relay | `src/upstreamproxy/relay.ts`, `src/upstreamproxy/upstreamproxy.ts` | `encodeChunk`, `decodeChunk`, `startUpstreamProxyRelay`, `initUpstreamProxy` | `relay.ts` est presque pur, `upstreamproxy.ts` est runtime | slice reseau reutilisable a part |

## symbol map
| Fichier | Symboles importants | Notes de reutilisation |
| --- | --- | --- |
| `src/bridge/initReplBridge.ts` | `initReplBridge`, `deriveTitle` | wrapper REPL; lit auth, policy, git, titre, flags, puis delegue au coeur v1/v2 |
| `src/bridge/replBridge.ts` | `BridgeCoreParams`, `BridgeCoreHandle`, `initBridgeCore` | coeur env-based injecte pour eviter de tirer tout le shell |
| `src/bridge/remoteBridgeCore.ts` | `EnvLessBridgeParams`, `initEnvLessBridgeCore`, `fetchRemoteCredentials`, `archiveSession` | coeur env-less adapte au flow `/v1/code/sessions/{id}/bridge` |
| `src/bridge/bridgeApi.ts` | `createBridgeApiClient`, `BridgeFatalError`, `validateBridgeId`, `isExpiredErrorType`, `isSuppressible403` | client Environments API et compat Sessions API |
| `src/bridge/bridgeMessaging.ts` | `handleIngressMessage`, `handleServerControlRequest`, `extractTitleText`, `makeResultMessage`, `BoundedUUIDSet` | meilleure couche pour parsing/routage/callbacks |
| `src/bridge/replBridgeTransport.ts` | `ReplBridgeTransport`, `createV1ReplTransport`, `createV2ReplTransport` | abstraction unique des transports read/write |
| `src/bridge/workSecret.ts` | `decodeWorkSecret`, `buildSdkUrl`, `buildCCRv2SdkUrl`, `sameSessionId`, `registerWorker` | primitives wire-level tres copiable |
| `src/bridge/sessionRunner.ts` | `PermissionRequest`, `createSessionSpawner`, `safeFilenameId` | glue de spawn child CLI `--print`, utile seulement si vous gardez le runtime Claude |
| `src/bridge/createSession.ts` | `createBridgeSession`, `getBridgeSession`, `archiveBridgeSession`, `updateBridgeSessionTitle` | client HTTP Sessions API pour le bridge |
| `src/bridge/bridgePointer.ts` | `BRIDGE_POINTER_TTL_MS`, `writeBridgePointer`, `readBridgePointerAcrossWorktrees`, `clearBridgePointer` | slice utile pour resume local, pas pour le protocole |
| `src/bridge/bridgeEnabled.ts` | `isBridgeEnabled`, `isEnvLessBridgeEnabled`, `isCcrMirrorEnabled` | gate runtime/flags, non essentiel au protocole |
| `src/remote/RemoteSessionManager.ts` | `RemoteSessionManager`, `RemoteSessionCallbacks`, `RemotePermissionResponse`, `createRemoteSessionConfig` | client distant le plus exploitable tel quel |
| `src/remote/SessionsWebSocket.ts` | `SessionsWebSocket`, `SessionsWebSocketCallbacks`, `sendControlRequest`, `sendControlResponse`, `reconnect` | WebSocket subscribe avec retries/ping |
| `src/remote/sdkMessageAdapter.ts` | `convertSDKMessage`, `isSessionEndMessage`, `isSuccessResult`, `getResultText` | adaptation SDK -> messages REPL |
| `src/remote/remotePermissionBridge.ts` | `createSyntheticAssistantMessage`, `createToolStub` | pont minimal pour afficher une permission distante dans l'UI locale |
| `src/server/createDirectConnectSession.ts` | `DirectConnectError`, `createDirectConnectSession` | bootstrap direct-connect en 1 POST |
| `src/server/directConnectManager.ts` | `DirectConnectSessionManager`, `DirectConnectConfig`, `DirectConnectCallbacks` | client NDJSON direct-connect |
| `src/server/types.ts` | `connectResponseSchema`, `SessionInfo`, `SessionIndexEntry` | contrat du serveur direct-connect |
| `src/upstreamproxy/relay.ts` | `encodeChunk`, `decodeChunk`, `startUpstreamProxyRelay`, `startNodeRelay` | slice presque autonome pour tunnel CONNECT over WebSocket |
| `src/upstreamproxy/upstreamproxy.ts` | `SESSION_TOKEN_PATH`, `initUpstreamProxy`, `getUpstreamProxyEnv` | runtime container CCR, pas une slice IDE |
| `src/utils/teleport/api.ts` | `prepareApiRequest`, `CodeSessionSchema`, `fetchCodeSessionsFromSessionsAPI`, `fetchSession`, `sendEventToRemoteSession`, `updateSessionTitle` | HTTP API distante principale |
| `src/utils/teleport/environments.ts` | `fetchEnvironments`, `createDefaultCloudEnvironment` | discovery / bootstrap d'environnements |
| `src/utils/teleport/environmentSelection.ts` | `getEnvironmentSelectionInfo` | resolution settings -> environment |
| `src/utils/teleport/gitBundle.ts` | `createAndUploadGitBundle` | seed bundle pour sessions remote avec repo |
| `src/utils/githubRepoPathMapping.ts` | `updateGithubRepoPathMapping`, `getKnownPathsForRepo`, `validateRepoAtPath`, `removePathFromRepo` | helper de selection repo clone local; utile pour attach UX, pas pour le bridge |

## dependency map
| Slice | Dependances internes bloquantes | Dependances externes / runtime | Commentaire d'extraction |
| --- | --- | --- | --- |
| Bridge protocol minimal | `src/entrypoints/agentSdkTypes.ts`, `src/entrypoints/sdk/controlTypes.ts`, `src/cli/transports/SSETransport.ts`, `src/cli/transports/HybridTransport.ts`, `src/cli/transports/ccrClient.ts`, `src/utils/sessionIngressAuth.ts`, `src/utils/sessionState.ts` | WebSocket/SSE, HTTP worker endpoints, `axios` | le vrai couplage est surtout transport/auth, pas l'algorithme de routage |
| Env-based bridge core | `src/bootstrap/state.ts`, `src/utils/auth.ts`, `src/utils/config.ts`, `src/utils/git.ts`, `src/utils/worktree.ts`, `src/utils/sessionStorage.ts`, `src/services/policyLimits/index.ts` | OAuth, analytics, process signals, filesystem/git | extraction chere si vous ne gardez pas le shell actuel |
| Env-less bridge core | `src/bridge/replBridgeTransport.ts`, `src/bridge/jwtUtils.ts`, `src/bridge/envLessBridgeConfig.ts`, `src/bridge/codeSessionApi.ts`, `src/bridge/bridgeMessaging.ts` | `axios`, CCR v2 endpoints, token refresh scheduler | meilleur coeur pour un IDE moderne si le backend expose `/bridge` |
| Remote session client | `src/utils/teleport/api.ts`, `src/utils/messages.ts`, `src/utils/messages/mappers.ts` | Sessions API + OAuth + org UUID, WebSocket subscribe | remplacez surtout `prepareApiRequest` et l'adaptation UI |
| Direct connect | `src/server/types.ts`, `src/remote/RemoteSessionManager.ts` pour le type `RemotePermissionResponse` | `fetch`, `WebSocket`, serveur local parlant NDJSON | faible surface, extraction simple si vous avez deja votre serveur |
| Upstream proxy relay | `src/utils/mtls.ts`, `src/utils/proxy.ts`, `src/utils/debug.ts` | `node:net` ou `Bun.listen`, `ws`, CONNECT, protobuf bytes | `relay.ts` s'isole bien; `upstreamproxy.ts` reste tres CCR/container-specifique |
| Teleport helpers | `src/services/oauth/client.ts`, `src/utils/auth.ts`, `src/services/api/filesApi.ts`, `src/services/analytics/growthbook.ts`, `src/utils/git.ts` | OAuth, Files API, git executable | bien pour tooling remote, pas pour un protocole pur |

## protocole pur vs glue runtime vs slices IDE
| Classification | Pieces exactes | Pourquoi |
| --- | --- | --- |
| Protocole pur | `src/bridge/bridgeMessaging.ts`, `src/bridge/types.ts`, `src/bridge/sessionIdCompat.ts`, `src/bridge/workSecret.ts`, `src/bridge/flushGate.ts`, `src/server/types.ts`, `src/upstreamproxy/relay.ts` | contient surtout des schemas, state machines courtes, codecs, type guards, adaptation d'IDs et wrappers de flux |
| Glue runtime | `src/bridge/initReplBridge.ts`, `src/bridge/replBridge.ts`, `src/bridge/remoteBridgeCore.ts`, `src/bridge/bridgeMain.ts`, `src/bridge/bridgeUI.ts`, `src/bridge/bridgeEnabled.ts`, `src/bridge/bridgePointer.ts`, `src/bridge/trustedDevice.ts`, `src/utils/teleport/api.ts`, `src/utils/teleport/environments.ts`, `src/utils/teleport/environmentSelection.ts`, `src/utils/teleport/gitBundle.ts`, `src/upstreamproxy/upstreamproxy.ts` | lit auth/settings/growthbook, touche process/env/fs/git, gere les retries et la UX REPL |
| Reutilisable pour piloter un agent depuis un IDE | `src/bridge/bridgeMessaging.ts`, `src/bridge/replBridgeTransport.ts`, `src/remote/RemoteSessionManager.ts`, `src/remote/SessionsWebSocket.ts`, `src/remote/sdkMessageAdapter.ts`, `src/server/directConnectManager.ts`, `src/server/createDirectConnectSession.ts`, `src/remote/remotePermissionBridge.ts` | couvre l'essentiel: envoyer des turns, recevoir les events, relayer les callbacks de permission, brancher un transport simple |

## extraction recipes
### bridge protocol minimal
- Objectif: conserver le contrat de messages, les callbacks `control_request`/`control_response`, la dedup UUID et l'abstraction transport, sans embarquer le shell complet.
- Copier d'abord: `src/bridge/bridgeMessaging.ts`, `src/bridge/types.ts`, `src/bridge/sessionIdCompat.ts`, `src/bridge/workSecret.ts`, `src/bridge/flushGate.ts`.
- Ajouter si vous voulez garder les transports existants: `src/bridge/replBridgeTransport.ts`, `src/cli/transports/SSETransport.ts`, `src/cli/transports/HybridTransport.ts`, `src/cli/transports/ccrClient.ts`, `src/utils/sessionIngressAuth.ts`, `src/utils/sessionState.ts`.
- Remplacer/stubber: `src/services/analytics/index.ts`, `src/utils/debug.ts`, `src/utils/errors.ts`, `src/utils/slowOperations.ts`, `src/utils/displayTags.ts`.
- Ne pas copier au debut: `src/bridge/initReplBridge.ts`, `src/bridge/bridgeMain.ts`, `src/bridge/bridgeUI.ts`, `src/bridge/bridgeEnabled.ts`, `src/bridge/trustedDevice.ts`.
- Difficulte d'extraction: moyenne si vous gardez l'interface `ReplBridgeTransport`; haute si vous gardez aussi le spawn/poll/reconnect env-based.

### remote session manager minimal
- Objectif: un client IDE capable de se connecter a une session distante existante, recevoir les events, relayer les permissions et envoyer des messages.
- Copier: `src/remote/RemoteSessionManager.ts`, `src/remote/SessionsWebSocket.ts`, `src/remote/sdkMessageAdapter.ts`, `src/remote/remotePermissionBridge.ts`.
- Soit copier `src/utils/teleport/api.ts`, soit reimplementer seulement `prepareApiRequest`, `sendEventToRemoteSession`, `updateSessionTitle`.
- Garder les symboles pivot: `RemoteSessionManager.connect`, `RemoteSessionManager.sendMessage`, `RemoteSessionManager.respondToPermissionRequest`, `SessionsWebSocket.sendControlRequest`, `convertSDKMessage`.
- Si vous pilotez un backend local au lieu de CCR: remplacer `RemoteSessionManager` par `DirectConnectSessionManager`.
- Difficulte d'extraction: moyenne; le vrai verrou est l'auth OAuth + `orgUUID`, pas la logique sessionnelle.

### permission callback bridge
- Objectif: brancher une permission distante `can_use_tool` sur un moteur local de permissions/approvals.
- Copier le contrat: `src/bridge/bridgePermissionCallbacks.ts`.
- Copier les adaptateurs wire-level: `src/bridge/bridgeMessaging.ts` pour `handleServerControlRequest`, `src/remote/remotePermissionBridge.ts` pour fabriquer un faux `AssistantMessage`, puis `src/remote/RemoteSessionManager.ts` ou `src/server/directConnectManager.ts` selon votre transport.
- Reimplementer localement le glue montre dans `src/hooks/useReplBridge.tsx` et `src/hooks/toolPermission/handlers/interactiveHandler.ts`: une map `request_id -> handler`, puis `sendRequest`, `sendResponse`, `cancelRequest`, `onResponse`.
- Conserver le payload exact: `{ behavior: 'allow' | 'deny', updatedInput?, updatedPermissions?, message? }`.
- Attention: `set_permission_mode` et les callbacks de politique ne sont pas dans `BridgePermissionCallbacks`; ils passent par `handleServerControlRequest` et exigent un verdict runtime.
- Difficulte d'extraction: moyenne; l'API de callbacks est petite, mais il faut soigner les races avec les approvals locales et les annulations.

## minimal reusable slices
| Slice candidate | Fichiers exacts | Pourquoi c'est la plus petite extraction viable | Difficulte |
| --- | --- | --- | --- |
| `bridge_protocol_minimal` | `src/bridge/bridgeMessaging.ts`, `src/bridge/types.ts`, `src/bridge/sessionIdCompat.ts`, `src/bridge/workSecret.ts`, `src/bridge/flushGate.ts` | donne le coeur message/control/cancel/result sans le runtime bridge complet | moyenne |
| `permission_callback_bridge` | `src/bridge/bridgePermissionCallbacks.ts`, `src/remote/remotePermissionBridge.ts`, `src/remote/RemoteSessionManager.ts` ou `src/server/directConnectManager.ts` | permet de piloter les approvals depuis un IDE ou un client remote | moyenne |
| `remote_session_client` | `src/remote/RemoteSessionManager.ts`, `src/remote/SessionsWebSocket.ts`, `src/remote/sdkMessageAdapter.ts` | client live minimal pour une session distante avec control requests | moyenne |
| `direct_connect_transport` | `src/server/createDirectConnectSession.ts`, `src/server/directConnectManager.ts`, `src/server/types.ts` | variante la plus simple si vous possedez le backend | faible a moyenne |
| `teleport_session_api` | `src/utils/teleport/api.ts` | regroupe lecture/liste/update/envoi d'evenements sur les sessions | moyenne |
| `upstreamproxy_relay` | `src/upstreamproxy/relay.ts` | tunnel CONNECT over WebSocket tres compact, quasi autonome | moyenne |

## do not copy blindly
- `src/bridge/initReplBridge.ts` et `src/bridge/replBridge.ts` sont explicitement ecrits pour eviter de tirer `src/commands.ts`; le moindre import vers `sessionStorage`, `messages`, `auth` ou `config` peut reintroduire tout le shell React/REPL dans votre bundle.
- `src/bridge/bridgeMain.ts` couple le bridge a `git`, `worktree`, `policyLimits`, `analytics`, `trustedDevice`, `secureStorage`, gestion de signaux et UX terminale; ce n'est pas une bonne base de plugin IDE minimal.
- `src/bridge/sessionRunner.ts` suppose que le worker est un process `claude --print` avec `CLAUDE_CODE_SESSION_ACCESS_TOKEN`, `CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2` et parfois `CLAUDE_CODE_USE_CCR_V2`; si votre agent n'est pas ce binaire, remplacez la couche spawn.
- `src/bridge/remoteBridgeCore.ts` et `src/bridge/replBridgeTransport.ts` supposent l'existence de `CCRClient`, `SSETransport`, `worker_epoch` et des endpoints `/worker/*`; inutile si votre backend ne parle que Sessions API ou direct-connect.
- `src/utils/teleport/api.ts` est tres reutilisable, mais il est verrouille par `prepareApiRequest()` sur OAuth Claude.ai + `orgUUID`; il n'est pas plug-and-play pour un mode API key ou self-hosted.
- `src/upstreamproxy/upstreamproxy.ts` est du runtime CCR container-specifique: token sur `/run/ccr/session_token`, `prctl(PR_SET_DUMPABLE, 0)`, bundle CA local, variables `HTTPS_PROXY`/`SSL_CERT_FILE`; si vous ne copiez qu'une partie, prenez plutot `src/upstreamproxy/relay.ts`.
- `src/bridge/bridgePointer.ts` est utile pour `--continue`, mais depend de `sessionStoragePortable` et d'une lecture worktree-aware; ne pas le prendre pour un "protocole bridge".
- `src/server/directConnectManager.ts` est un client, pas le serveur; le vrai backend direct-connect n'est pas dans ce batch.

## reusable ideas
- Utiliser `bridgeMessaging.ts` comme noyau commun de parsing/routage, puis brancher votre propre transport IDE.
- Preferer `RemoteSessionManager` si vous voulez attacher un IDE a une session distante existante sans reprendre le runtime de bridge complet.
- Preferer `DirectConnectSessionManager` si vous controlez un serveur leger parlant NDJSON et n'avez pas besoin des APIs bridge/environments.
- Reprendre `upstreamproxy/relay.ts` tel quel pour un tunnel CONNECT-over-WS si vous avez besoin d'un proxy sidecar.

## reusable features
- `ide_bridge` - Bridge complet CLI <-> IDE/clients externes; forte valeur, forte extraction.
- `remote_sessions` - Surface broad Sessions/Teleport deja existante.
- `bridge_protocol_minimal` - Protocole de bridge, control messages et adaptation v1/v2 sans le shell.
- `permission_callback_bridge` - Contrat de callbacks de permission et adaptateurs allow/deny/cancel.
- `remote_session_client` - Client live de session distante pour IDE/assistant.
- `direct_connect_transport` - Bootstrap + transport direct-connect leger.
- `teleport_session_api` - Surface HTTP Sessions/Environments pour discovery et messaging.
- `upstreamproxy_relay` - Relay CONNECT-over-WS reutilisable hors du shell principal.

## external deps
- `axios` pour `bridgeApi.ts`, `createSession.ts`, `remoteBridgeCore.ts`, `utils/teleport/api.ts`, `utils/teleport/environments.ts`.
- `WebSocket` natif Bun/DOM ou package `ws` pour `SessionsWebSocket.ts`, `directConnectManager.ts`, `upstreamproxy/relay.ts`.
- `SSETransport`, `HybridTransport`, `CCRClient` depuis `src/cli/transports/**` pour les transports bridge v1/v2.
- `zod/v4` et `lazySchema` pour `server/types.ts`, `bridgePointer.ts`, `utils/teleport/api.ts`.
- `git` et Files API pour `utils/teleport/gitBundle.ts`.
- `Bun.listen` ou `node:net` pour `upstreamproxy/relay.ts`; `bun:ffi` Linux seulement pour `upstreamproxy/upstreamproxy.ts`.

## flags/env
- Build flags: `BRIDGE_MODE`, `CCR_AUTO_CONNECT`, `CCR_MIRROR`, `KAIROS`.
- GrowthBook/feature values: `tengu_ccr_bridge`, `tengu_bridge_repl_v2`, `tengu_bridge_initial_history_cap`, `tengu_bridge_min_version`, `tengu_bridge_repl_v2_config`, `tengu_cobalt_harbor`, `tengu_ccr_mirror`, `tengu_ccr_bundle_max_bytes`, trusted-device gate dans `src/bridge/trustedDevice.ts`.
- Env bridge: `CLAUDE_BRIDGE_OAUTH_TOKEN`, `CLAUDE_BRIDGE_BASE_URL`, `CLAUDE_BRIDGE_SESSION_INGRESS_URL`, `CLAUDE_BRIDGE_USE_CCR_V2`, `CLAUDE_TRUSTED_DEVICE_TOKEN`, `CLAUDE_CODE_CCR_MIRROR`.
- Env child/worker: `CLAUDE_CODE_SESSION_ACCESS_TOKEN`, `CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2`, `CLAUDE_CODE_USE_CCR_V2`, `CLAUDE_CODE_ENVIRONMENT_KIND`.
- Env upstream proxy: `CLAUDE_CODE_REMOTE`, `CCR_UPSTREAM_PROXY_ENABLED`, `CLAUDE_CODE_REMOTE_SESSION_ID`, `ANTHROPIC_BASE_URL`, plus `HTTPS_PROXY`/`SSL_CERT_FILE` exposes par `getUpstreamProxyEnv`.

## copy risk
Le protocole et les adaptateurs de session sont reutilisables, mais le bridge complet est fortement couple au runtime REPL, a l'auth Claude.ai, au worker child `claude --print` et aux transports B02. La bonne strategie est de copier petit, puis de remonter seulement les dependances absolument necessaires.

## exact search shortcuts
- `rg -n "handleIngressMessage|handleServerControlRequest|BoundedUUIDSet|makeResultMessage" src/bridge/bridgeMessaging.ts`
- `rg -n "initBridgeCore|reconnectEnvironmentWithSession|lastTransportSequenceNum|tryReconnectInPlace" src/bridge/replBridge.ts`
- `rg -n "initEnvLessBridgeCore|rebuildTransport|recoverFromAuthFailure|outboundOnly" src/bridge/remoteBridgeCore.ts`
- `rg -n "createV1ReplTransport|createV2ReplTransport|getLastSequenceNum|reportState" src/bridge/replBridgeTransport.ts`
- `rg -n "decodeWorkSecret|buildSdkUrl|buildCCRv2SdkUrl|registerWorker|sameSessionId" src/bridge/workSecret.ts`
- `rg -n "/v1/environments/bridge|/work/poll|/bridge/reconnect|sendPermissionResponseEvent" src/bridge/bridgeApi.ts`
- `rg -n "/v1/code/sessions|/bridge|worker_epoch|auth_401_recovery|proactive_refresh" src/bridge/remoteBridgeCore.ts src/bridge/codeSessionApi.ts`
- `rg -n "createSessionSpawner|PermissionRequest|CLAUDE_CODE_SESSION_ACCESS_TOKEN|CLAUDE_CODE_USE_CCR_V2" src/bridge/sessionRunner.ts`
- `rg -n "writeBridgePointer|readBridgePointerAcrossWorktrees|BRIDGE_POINTER_TTL_MS" src/bridge/bridgePointer.ts`
- `rg -n "RemoteSessionManager|respondToPermissionRequest|cancelSession|createRemoteSessionConfig" src/remote/RemoteSessionManager.ts`
- `rg -n "SessionsWebSocket|sendControlRequest|sendControlResponse|scheduleReconnect|4001" src/remote/SessionsWebSocket.ts`
- `rg -n "convertSDKMessage|isSessionEndMessage|isSuccessResult|getResultText" src/remote/sdkMessageAdapter.ts`
- `rg -n "createSyntheticAssistantMessage|createToolStub" src/remote/remotePermissionBridge.ts`
- `rg -n "createDirectConnectSession|DirectConnectSessionManager|connectResponseSchema" src/server/*.ts`
- `rg -n "sendEventToRemoteSession|fetchSession|fetchCodeSessionsFromSessionsAPI|updateSessionTitle" src/utils/teleport/api.ts`
- `rg -n "createAndUploadGitBundle|refs/seed/stash|refs/seed/root|seed_bundle_file_id" src/utils/teleport/gitBundle.ts`
- `rg -n "fetchEnvironments|createDefaultCloudEnvironment|getEnvironmentSelectionInfo" src/utils/teleport/*.ts`
- `rg -n "encodeChunk|decodeChunk|startUpstreamProxyRelay|CONNECT" src/upstreamproxy/relay.ts`
- `rg -n "initUpstreamProxy|getUpstreamProxyEnv|SESSION_TOKEN_PATH|CCR_UPSTREAM_PROXY_ENABLED" src/upstreamproxy/upstreamproxy.ts`
- Couplage permission bridge hors batch: `rg -n "replBridgePermissionCallbacks|pendingPermissionHandlers|sendRequest\\(|onResponse\\(" src/hooks/useReplBridge.tsx src/hooks/toolPermission/handlers/interactiveHandler.ts`

## search hints
- `bridgeMessaging`
- `initBridgeCore`
- `initEnvLessBridgeCore`
- `RemoteSessionManager`
- `DirectConnectSessionManager`
- `startUpstreamProxyRelay`
