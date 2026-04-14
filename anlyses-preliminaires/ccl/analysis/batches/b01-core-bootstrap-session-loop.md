---
batch_id: B01
title: Core bootstrap & session loop
paths:
  - src/main.tsx
  - src/setup.ts
  - src/query.ts
  - src/QueryEngine.ts
  - src/context.ts
  - src/cost-tracker.ts
  - src/costHook.ts
  - src/entrypoints/**
  - src/bootstrap/**
priority: haute
status: enriched
keywords:
  - profileCheckpoint
  - startMdmRawRead
  - prepareApiRequest
  - startDeferredPrefetches
  - fetchSystemPromptParts
  - buildQueryConfig
  - handleStopHooks
---

# B01 - Core bootstrap & session loop

## Resume
- Couverture: 16 fichiers / 14529 lignes.
- Sous-systemes dominants: entrypoints/root (5), entrypoints/sdk (3), root/QueryEngine (1), bootstrap/root (1), root/context (1), root/cost-tracker (1).
- Le flux reel part de `src/entrypoints/cli.tsx`, enchaine les side-effects top-level de `src/main.tsx`, verrouille l'init trust-safe dans `src/entrypoints/init.ts`, initialise la session dans `src/setup.ts`, puis bifurque vers `launchRepl(...)` ou `runHeadless(...)`.
- La meilleure seam reusable n'est pas `main.tsx` mais `src/query.ts` + `src/query/config.ts`/`deps.ts`/`tokenBudget.ts`; `src/QueryEngine.ts` est surtout un adaptateur SDK/headless.
- Le plus fort couplage est `src/bootstrap/state.ts`: singleton de session, cwd stable, trust flags, latches de mode, caches de prompt, hooks, channels, couts.
- Plusieurs imports references par cette zone manquent dans le leak et doivent etre traites comme dependances externes: `src/query/transitions.js`, `src/services/contextCollapse/**`, `src/entrypoints/sdk/runtimeTypes.js`, `src/entrypoints/sdk/controlTypes.js`, `src/entrypoints/sdk/settingsTypes.generated.js`, `src/entrypoints/sdk/toolTypes.js`.

## purpose
Demarrage CLI, staging des prefetches critiques, resolution du contexte de session, bootstrap trust-aware, puis boucle agentique `model -> tools -> attachments -> continue/stop`.

## entrypoints
- `src/entrypoints/cli.tsx` - routeur ultra-fin a imports dynamiques et fast paths.
- `src/main.tsx` - orchestrateur principal CLI/session.
- `src/entrypoints/init.ts` - init globale memoized executee depuis `preAction`.
- `src/setup.ts` - bootstrap de session concret apres resolution des flags.
- `src/query.ts` - boucle de requete iterative.
- `src/QueryEngine.ts` - couche headless/SDK autour de `query()`.
- `src/entrypoints/mcp.ts` - entree annexe minimale pour servir le registry de tools en MCP stdio.
- `src/entrypoints/agentSdkTypes.ts` - facade SDK publique; utile comme contrat, pas comme runtime.
- `src/entrypoints/sdk/coreSchemas.ts` / `src/entrypoints/sdk/controlSchemas.ts` - schemas runtime du protocole SDK.

## key files
- `src/main.tsx` - 4684 lignes - orchestration de bootstrap, trust, MCP, resume/remote et choix REPL/headless.
- `src/entrypoints/sdk/coreSchemas.ts` - 1889 lignes - contrat runtime des messages SDK.
- `src/bootstrap/state.ts` - 1758 lignes - singleton de session et latches transverses.
- `src/query.ts` - 1729 lignes - coeur du turn loop.
- `src/QueryEngine.ts` - 1295 lignes - wrapper SDK/headless, transcript et normalisation.
- `src/entrypoints/sdk/controlSchemas.ts` - 663 lignes - control plane SDK.
- `src/setup.ts` - 477 lignes - bring-up de session.
- `src/entrypoints/agentSdkTypes.ts` - 443 lignes - facade/stubs SDK.
- `src/entrypoints/init.ts` - 305 lignes - init trust-safe.
- `src/context.ts` - 175 lignes - contexte memoized git/CLAUDE.md/date.
- `src/utils/queryContext.ts` - 174 lignes - assembleur du prefixe de prompt cache-safe.
- `src/query/stopHooks.ts` - 416 lignes - governance de fin de tour.

## data flow
1. `src/entrypoints/cli.tsx` applique des patches d'env top-level puis route les fast paths.
2. `src/main.tsx` lance les warmups critiques (`startMdmRawRead`, `startKeychainPrefetch`) avant le gros graphe d'imports.
3. `main()` derive le mode de session, charge tres tot `--settings` / `--setting-sources`, puis appelle `run()`.
4. `run()` installe `preAction`; `preAction` attend les prefetches critiques puis execute `init()`.
5. `init()` fait l'init trust-safe: configs, env safe, graceful shutdown, proxy/MTLS, preconnect API, scratchpad, cleanup registrations.
6. L'action principale parse les flags runtime, construit le `toolPermissionContext`, charge les tools, puis lance `setup()` en parallele avec `getCommands()` / `getAgentDefinitionsWithOverrides()` si le cwd final est deja connu.
7. `setup()` fixe `cwd` / sessionId / hook snapshot / worktree / watchers / plugin hooks / sinks.
8. Apres trust, `main.tsx` initialise LSP, prefetch quota/bootstrap/MCP, puis choisit `launchRepl(...)` ou `runHeadless(...)`.
9. `QueryEngine.submitMessage(...)` preprocess le prompt, persiste le transcript et delegue a `query()`.
10. `queryLoop(...)` fait tourner le cycle `stream model -> execute tools -> attachments -> stop hooks -> continuation/terminal`.

## external deps
- `@commander-js/extra-typings` - parse CLI et `preAction`.
- `@anthropic-ai/sdk` - types/messages streaming.
- `@modelcontextprotocol/sdk` - MCP server et types SDK.
- `@opentelemetry/*` - telemetry initialisee apres trust.
- `chalk`, `lodash-es`, `react`, `bun:bundle`.

## flags/env
- Routing/entrypoints: `ABLATION_BASELINE`, `BRIDGE_MODE`, `BYOC_ENVIRONMENT_RUNNER`, `DAEMON`, `DIRECT_CONNECT`, `DUMP_SYSTEM_PROMPT`, `KAIROS`, `LODESTONE`, `SELF_HOSTED_RUNNER`, `SSH_REMOTE`.
- Bootstrap session: `BG_SESSIONS`, `TEAMMEM`, `UDS_INBOX`, `COMMIT_ATTRIBUTION`, `CLAUDE_CODE_SIMPLE`, `CLAUDE_CODE_SYNC_PLUGIN_INSTALL`, `CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS`.
- Query loop: `CACHED_MICROCOMPACT`, `CONTEXT_COLLAPSE`, `EXPERIMENTAL_SKILL_SEARCH`, `HISTORY_SNIP`, `REACTIVE_COMPACT`, `TOKEN_BUDGET`, `TEMPLATES`, `CHICAGO_MCP`.
- UX/modes: `KAIROS_BRIEF`, `KAIROS_CHANNELS`, `PROACTIVE`, `WEB_BROWSER_TOOL`, `CCR_MIRROR`.

## reusable ideas
- Side-effects top-level tres courts, puis attente explicite en `preAction`.
- Separation stricte entre init trust-safe et init post-trust.
- `buildQueryConfig()` et `productionDeps()` comme seams de decouplage du coeur de boucle.
- Ecriture du transcript avant la premiere reponse modele pour rendre le resume robuste.
- Parallelisation `setup()` / `getCommands()` / `getAgentDefinitionsWithOverrides()` quand le cwd final est stable.

## reusable features
- `bootstrap_parallel_prefetch` - overlap des prefetches critiques avec l'import graph. (reuse: haute, coupling: moyenne)
- `session_context_snapshot` - `getSystemContext()`, `getUserContext()`, `fetchSystemPromptParts()`. (reuse: haute, coupling: moyenne)
- `session_bootstrap_runtime` - `init()` + `setup()` + `renderAndRun()` pour amener une session jusqu'au premier turn. (reuse: haute, coupling: moyenne)
- `query_loop_skeleton` - squelette iteratif de `query.ts` avec deps injectees. (reuse: haute, coupling: moyenne)
- `sdk_query_engine_adapter` - wrapper `QueryEngine` pour clients headless/SDK. (reuse: moyenne, coupling: haute)
- `main_session_loop` - vue umbrella du flux complet `main.tsx`. (reuse: moyenne, coupling: haute)

## copy risk
Couplage eleve au runtime de session, au singleton `bootstrap/state`, aux settings multi-sources, a `ToolUseContext`, a `AppState`, et aux branches `feature(...)`.

## search hints
- `profileCheckpoint`
- `startMdmRawRead`
- `prepareApiRequest`
- `startDeferredPrefetches`
- `fetchSystemPromptParts`
- `buildQueryConfig`
- `handleStopHooks`

## subdomains

| Subdomain | Fichiers pivots | Ce que la zone fait vraiment | Extraction signal |
| --- | --- | --- | --- |
| startup side-effects | `src/entrypoints/cli.tsx`, `src/main.tsx` | Patches d'env top-level, fast paths, prefetches critiques avant heavy imports. | Reusable si vous voulez un bootstrap multi-mode rapide. |
| init order | `src/entrypoints/init.ts`, `src/main.tsx` | Separe ce qui peut tourner avant trust de ce qui doit attendre trust. | Tres bonne base pour un runtime "safe first, full later". |
| session context | `src/context.ts`, `src/utils/queryContext.ts`, `src/bootstrap/state.ts` | Memoize git status, CLAUDE.md, current date, prompt injection, prefixe cache-safe. | Bon candidat de copie avec adaptation. |
| session bootstrap | `src/setup.ts`, `src/bootstrap/state.ts`, `src/interactiveHelpers.tsx` | SessionId, cwd stable, worktree, snapshots de hooks, watchers, sinks, prefetchs de session. | Reusable en sous-blocs, pas en bloc monolithique. |
| query loop | `src/query.ts`, `src/query/*.ts` | Boucle iterative a etat explicite avec recoveries, tools, attachments, stop hooks, budget. | Meilleure brique "copiable avec adaptation". |
| streaming orchestration | `src/QueryEngine.ts`, `src/entrypoints/sdk/coreSchemas.ts` | Transforme le flux de `query()` en messages SDK stables et persistables. | Utile pour SDK/headless, tres couple aux types maison. |

## feature inventory

| Feature / seam | Fichiers exacts | Symboles exacts | Notes extraction |
| --- | --- | --- | --- |
| Fast-path entry router | `src/entrypoints/cli.tsx` | `main`, top-level env patches, `void main()` | Bon pattern si vous avez plusieurs surfaces de lancement. |
| Top-level critical prefetch | `src/main.tsx` | `startMdmRawRead`, `startKeychainPrefetch` | A remplacer par vos propres warmups critiques. |
| CLI/runtime init gate | `src/main.tsx`, `src/entrypoints/init.ts` | `initializeEntrypoint`, `eagerLoadSettings`, `run`, `init`, `initializeTelemetryAfterTrust` | Coeur du "safe init now, trustful init later". |
| Session bootstrap | `src/setup.ts` | `setup` | Le vrai "session bring-up". |
| Session context snapshot | `src/context.ts`, `src/utils/queryContext.ts` | `getGitStatus`, `getSystemContext`, `getUserContext`, `fetchSystemPromptParts` | Fort potentiel de copie. |
| Global session state leaf | `src/bootstrap/state.ts` | `getInitialState`, `switchSession`, `setOriginalCwd`, `setProjectRoot`, `registerHookCallbacks` | A reduire avant tout reuse. |
| Query control skeleton | `src/query.ts`, `src/query/config.ts`, `src/query/deps.ts`, `src/query/tokenBudget.ts` | `query`, `queryLoop`, `buildQueryConfig`, `productionDeps`, `checkTokenBudget` | Principal candidat d'extraction. |
| Post-turn governance | `src/query/stopHooks.ts` | `handleStopHooks` | Peut devenir un hook stage generique. |
| Headless session engine | `src/QueryEngine.ts` | `QueryEngine`, `submitMessage`, `interrupt`, `ask` | Wrapper de transcript + normalisation, pas le coeur de generation. |
| SDK/public protocol | `src/entrypoints/agentSdkTypes.ts`, `src/entrypoints/sdk/coreSchemas.ts`, `src/entrypoints/sdk/controlSchemas.ts` | `query`, `tool`, `createSdkMcpServer`, `SDKMessageSchema`, `SDKControlRequestSchema` | `agentSdkTypes.ts` expose surtout des stubs. |
| Minimal MCP host | `src/entrypoints/mcp.ts` | `startMCPServer` | Entree annexe simple pour re-servir la tool registry comme MCP stdio. |

## symbol map

| Symbole | Fichier | Role structurel | Reuse note |
| --- | --- | --- | --- |
| `main` | `src/entrypoints/cli.tsx` | Routeur de fast paths et chargeur tardif du vrai CLI. | Copiable si plusieurs sous-modes. |
| `startDeferredPrefetches` | `src/main.tsx` | Warmups post-render non bloquants. | Tres copiable. |
| `eagerLoadSettings` | `src/main.tsx` | Charge `--settings` / `--setting-sources` avant `init()`. | Pattern cle pour filtrer les settings des le debut. |
| `initializeEntrypoint` | `src/main.tsx` | Derive `CLAUDE_CODE_ENTRYPOINT` depuis argv/mode. | Reusable si plusieurs clients. |
| `run` | `src/main.tsx` | Monte Commander et la quasi-totalite du bootstrap runtime. | Ne pas copier integralement. |
| `init` | `src/entrypoints/init.ts` | Init memoized et idempotente. | Excellente base de "bootstrap once". |
| `initializeTelemetryAfterTrust` | `src/entrypoints/init.ts` | Decale la telemetry apres trust / managed settings. | Tres bon pattern trust-aware. |
| `setup` | `src/setup.ts` | Bootstrap de session concret. | Extraire par sous-blocs. |
| `getSystemContext` | `src/context.ts` | Snapshot memoized du contexte systeme/git. | Facilement recyclable. |
| `getUserContext` | `src/context.ts` | Snapshot memoized du contexte workspace/utilisateur. | Facilement recyclable. |
| `fetchSystemPromptParts` | `src/utils/queryContext.ts` | Assemble le prefixe cache-safe de prompt. | Une des meilleures seams B01. |
| `getInitialState` | `src/bootstrap/state.ts` | Definit l'etat global de session. | Trop gros pour etre copie tel quel. |
| `switchSession` | `src/bootstrap/state.ts` | Bascule atomique sessionId + projectDir. | Copiable apres reduction du singleton. |
| `handlePlanModeTransition` / `handleAutoModeTransition` | `src/bootstrap/state.ts` | Latches de notifications de mode. | Reusable si modes persistants. |
| `query` / `queryLoop` | `src/query.ts` | API generator et boucle iterative de turn. | Principal coeur extractible. |
| `buildQueryConfig` | `src/query/config.ts` | Snapshot immuable des gates runtime. | Tres copiable. |
| `productionDeps` | `src/query/deps.ts` | Injection de dependances I/O du coeur. | Tres copiable. |
| `handleStopHooks` | `src/query/stopHooks.ts` | Governance de fin de tour. | A brancher sur votre propre hook bus. |
| `QueryEngine.submitMessage` | `src/QueryEngine.ts` | Adaptateur headless/SDK autour de `query()`. | Utile si vous avez besoin d'un protocole de streaming stable. |
| `ask` | `src/QueryEngine.ts` | One-shot wrapper qui clone le file cache. | Couche pratique, pas obligatoire pour l'extraction du coeur. |
| `SDKMessageSchema` / `SDKResultMessageSchema` | `src/entrypoints/sdk/coreSchemas.ts` | Contrat runtime des messages sortants. | Reusable meme sans garder le runtime Claude Code. |

## real initialization order

### Path commun

1. `src/entrypoints/cli.tsx` est evalue:
   - `COREPACK_ENABLE_AUTO_PIN=0`
   - heap remote optionnel
   - ablation baseline optionnelle
   - route les fast paths ou importe `../main.js`
2. `src/main.tsx` est evalue:
   - `profileCheckpoint('main_tsx_entry')`
   - `startMdmRawRead()`
   - `startKeychainPrefetch()`
3. `main()`:
   - pose `NoDefaultCurrentDirectoryInExePath`
   - installe warning handlers / SIGINT / reset cursor
   - reroute certains argv (`cc://`, `--handle-uri`, `assistant`, `ssh`)
   - derive `isNonInteractive`, `clientType`, `CLAUDE_CODE_ENTRYPOINT`
   - appelle `eagerLoadSettings()`
4. `run()` cree Commander puis `preAction`.
5. `preAction`:
   - attend `ensureMdmSettingsLoaded()` + `ensureKeychainPrefetchCompleted()`
   - execute `await init()`
   - initialise sinks et migrations
   - lance `loadRemoteManagedSettings()` et `loadPolicyLimits()`
6. `init()`:
   - `enableConfigs()`
   - `applySafeConfigEnvironmentVariables()`
   - `setupGracefulShutdown()`
   - configure MTLS / proxy / shell Windows
   - `preconnectAnthropicApi()`
   - initialise les loading promises de policy/managed settings
   - prepare scratchpad et cleanups
7. L'action principale:
   - parse flags runtime
   - cree `toolPermissionContext`
   - lit stdin/prompt, charge les tools
   - lance `setup()` et, si pas de worktree, `getCommands()` / `getAgentDefinitionsWithOverrides()` en parallele
8. `setup()`:
   - `switchSession(...)` si besoin
   - `setCwd(cwd)`
   - `captureHooksConfigSnapshot()`
   - `initializeFileChangedWatcher(cwd)`
   - cree worktree/tmux eventuellement
   - precharge plugin hooks / session memory / sinks / release notes / apiKeyHelper
   - valide le mode bypass permissions

### Divergence interactive

9. Cree `root` Ink et execute `showSetupScreens(...)`.
10. Si trust refuse, le flux s'arrete avant LSP/API calls supplementaires.
11. `initializeLspServerManager()` seulement apres trust.
12. Lance les prefetches quota/bootstrap/MCP et `processSessionStartHooks('startup')`.
13. Construit `initialState` puis appelle `launchRepl(...)`.
14. `interactiveHelpers.renderAndRun(...)` appelle `startDeferredPrefetches()` juste apres `root.render(...)`.

### Divergence headless / SDK

9. `applyConfigEnvironmentVariables()`.
10. `initializeTelemetryAfterTrust()`.
11. Cree `headlessStore`.
12. Connecte les MCPs avant `runHeadless(...)`.
13. Appelle `startDeferredPrefetches()` immediatement dans `main.tsx`.
14. `runHeadless(...)` passe ensuite par `ask()` / `QueryEngine`.

### Dans `QueryEngine` puis `queryLoop`

1. `submitMessage(...)` reconstruit `systemPrompt`, `userContext`, `systemContext` via `fetchSystemPromptParts(...)`.
2. `processUserInput(...)` produit slash-command effects + messages user.
3. `recordTranscript(messages)` est fait avant la premiere reponse modele.
4. `yield buildSystemInitMessage(...)`.
5. `queryLoop(...)` snapshot `buildQueryConfig()` + `productionDeps()` + `State`.
6. Chaque iteration fait:
   - preparation messages/system prompt
   - compaction/collapse/budget pre-stream
   - stream modele
   - execution tools / attachments / queued commands
   - stop hooks / token budget / max turns
   - `continue` avec un nouveau `State` ou `Terminal`

## dependency map

| Axe | Dependances exactes | Observation |
| --- | --- | --- |
| settings | `eagerLoadSettings`, `loadSettingsFromFlag`, `loadSettingSourcesFromFlag`, `applySafeConfigEnvironmentVariables`, `applyConfigEnvironmentVariables`, `loadRemoteManagedSettings`, `loadPolicyLimits`, `getInitialSettings` | Le bootstrap filtre les settings avant presque toute autre lecture. |
| API/auth | `preconnectAnthropicApi`, `fetchBootstrapData`, `checkQuotaStatus`, `prefetchPassesEligibility`, `prepareApiRequest`, `queryModelWithStreaming` | Bootstrap et query loop sont deja concus pour overlapper auth/network et temps d'import. |
| state | `src/bootstrap/state.ts`, `createStore`, `getAppState`/`setAppState`, `recordTranscript` | La zone depend a la fois d'un singleton global et d'un store React/runtime. |
| permissions | `initialPermissionModeFromCLI`, `initializeToolPermissionContext`, `checkAndDisableBypassPermissions`, `verifyAutoModeGateAccess`, `wrappedCanUseTool` | Les decisions de permission sont preparees tres tot puis re-appliquees au niveau turn. |
| tools/MCP | `getTools`, `prefetchAllMcpResources`, `getMcpToolsCommandsAndResources`, `StreamingToolExecutor`, `runTools` | Le bootstrap assemble le pool; la boucle l'exploite. |
| UI/protocol | `showSetupScreens`, `launchRepl`, `renderAndRun`, `SDKMessageSchema`, `SDKControlRequestSchema` | Le bootstrap interactif et l'adaptateur SDK sont deux couches separees sur le meme coeur. |

## extraction recipes

### Startup prefetch

Copier presque tel quel:
- `src/entrypoints/init.ts`
- `src/context.ts`
- `src/utils/queryContext.ts`
- le sous-ensemble `startDeferredPrefetches` + attente des prefetches critiques de `src/main.tsx`

Adapter:
- `startMdmRawRead()` / `startKeychainPrefetch()` -> vos propres warmups
- CLAUDE.md / git status -> votre contexte projet
- GrowthBook / remote managed settings -> votre couche de flags/settings

### Session bootstrap

Copier comme reference:
- `src/setup.ts: setup`
- `src/bootstrap/state.ts: switchSession`, `setOriginalCwd`, `setProjectRoot`

Adapter fort:
- worktree/tmux
- teammate snapshot / TEAMMEM
- plugin hot reload / release notes
- validations exactes de bypass permissions

### Query loop skeleton

Copier presque tel quel:
- `src/query.ts`
- `src/query/config.ts`
- `src/query/deps.ts`
- `src/query/tokenBudget.ts`

Reecrire:
- types de messages
- `deps.callModel`
- `runTools`
- `handleStopHooks`
- compaction/collapse si vous n'avez pas ces sous-systemes

## minimal reusable slices

### startup prefetch
- Fichiers minimaux: `src/entrypoints/init.ts`, `src/context.ts`, `src/utils/queryContext.ts`, `startDeferredPrefetches()` depuis `src/main.tsx`
- Resultat: init idempotente, contexte memoized, separation trust-safe / post-trust

### session bootstrap
- Fichiers minimaux: sous-ensemble de `src/setup.ts` + mini-port de `src/bootstrap/state.ts`
- Resultat: sessionId stable, cwd/projectRoot coherents, point d'extension pour watchers/worktree

### query loop skeleton
- Fichiers minimaux: `src/query.ts`, `src/query/config.ts`, `src/query/deps.ts`, `src/query/tokenBudget.ts`
- Couche 2 optionnelle: `src/query/stopHooks.ts`, `src/QueryEngine.ts`

## do not copy blindly

- `src/main.tsx` entier: c'est un orchestrateur produit, pas une library extraction-friendly.
- `src/bootstrap/state.ts` entier: singleton mutable geant, avec responsabilites heterogenes.
- `src/entrypoints/agentSdkTypes.ts`: facade publique largement composee de stubs `not implemented`.
- Les branches `feature('...')` sans avoir le meme pipeline Bun/DCE.
- Le modele de confiance de `-p/--print`: ici il bypass le trust dialog.
- Les imports absents du leak: `src/query/transitions.js`, `src/services/contextCollapse/**`, `src/entrypoints/sdk/runtimeTypes.js`, `src/entrypoints/sdk/controlTypes.js`, `src/entrypoints/sdk/settingsTypes.generated.js`, `src/entrypoints/sdk/toolTypes.js`.

## exact search shortcuts

```bash
rg -n "COREPACK_ENABLE_AUTO_PIN|CLAUDE_CODE_SIMPLE|void main\\(" src/entrypoints/cli.tsx
rg -n "main_tsx_entry|startMdmRawRead|startKeychainPrefetch" src/main.tsx
rg -n "export function startDeferredPrefetches|eagerLoadSettings|initializeEntrypoint|export async function main|async function run\\(" src/main.tsx
rg -n "program.hook\\('preAction'|showSetupScreens\\(|initializeLspServerManager\\(|fetchBootstrapData\\(|prefetchAllMcpResources\\(" src/main.tsx
rg -n "export async function setup|captureHooksConfigSnapshot|initializeFileChangedWatcher|createWorktreeForSession|saveWorktreeState|loadPluginHooks|prefetchApiKeyFromApiKeyHelperIfSafe" src/setup.ts
rg -n "export const init|initializeTelemetryAfterTrust|applySafeConfigEnvironmentVariables|preconnectAnthropicApi|setShellIfWindows" src/entrypoints/init.ts
rg -n "getGitStatus|getSystemContext|getUserContext" src/context.ts
rg -n "fetchSystemPromptParts|buildSideQuestionFallbackParams" src/utils/queryContext.ts
rg -n "export async function\\* query|async function\\* queryLoop|buildQueryConfig|productionDeps|createBudgetTracker|handleStopHooks" src/query.ts src/query/*.ts
rg -n "export class QueryEngine|async \\*submitMessage|buildSystemInitMessage|processUserInput\\(|export async function\\* ask" src/QueryEngine.ts
rg -n "getInitialState|export function getSessionId|export function switchSession|setOriginalCwd|setProjectRoot|setSessionBypassPermissionsMode|setSessionTrustAccepted|handlePlanModeTransition|handleAutoModeTransition|registerHookCallbacks|getAllowedChannels|setAllowedChannels" src/bootstrap/state.ts
rg -n "SDKMessageSchema|SDKResultMessageSchema|SDKControlInitializeRequestSchema|SDKControlRequestSchema|SDKControlResponseSchema" src/entrypoints/sdk/*.ts
rg -n '"source": "src/query.ts".*"./query/transitions.js"|\"source\": \"src/setup.ts\".*contextCollapse|\"source\": \"src/entrypoints/agentSdkTypes.ts\".*runtimeTypes' analysis/manifests/import_graph.jsonl
```
