---
batch_id: B02
title: Command system & CLI transports
paths:
  - src/commands.ts
  - src/commands/**
  - src/cli/**
  - src/types/command.ts
priority: moyenne
status: enriched
keywords:
  - getCommands
  - getSkillToolCommands
  - isBridgeSafeCommand
  - StructuredIO
  - RemoteIO
---

# B02 - Command system & CLI transports

## Resume
- Couverture: 228 fichiers / 39853 lignes.
- La couche "commandes" se separe en 4 plans distincts:
  - registre des slash commands: `src/commands.ts`
  - contrats et dispatch runtime: `src/types/command.ts`, `src/utils/processUserInput/processSlashCommand.tsx`, `src/main.tsx:2622`
  - transports headless/SDK: `src/cli/print.ts`, `src/cli/structuredIO.ts`, `src/cli/remoteIO.ts`, `src/cli/transports/**`
  - sous-commandes `commander`: `src/main.tsx:3894+`, `src/cli/handlers/**`
- Le meilleur potentiel de reutilisation n'est pas le fichier `src/commands.ts` brut, mais 3 tranches plus nettes:
  - contrats `Command` / `PromptCommand` / `LocalCommand` / `LocalJSXCommand`
  - squelette de registre avec `load()` lazy et resolution par alias
  - transport NDJSON `StructuredIO` avec bifurcation locale/distante
- Les plus gros couplages a traiter avant extraction sont:
  - `ToolUseContext`, `AppState`, hooks, compaction et messages transcript
  - loaders dynamiques skills/plugins/MCP
  - protocoles SDK/control schemas, session lifecycle et session ingress
  - filtrage de mode reparti entre `src/commands.ts`, `src/main.tsx` et `src/hooks/useReplBridge.tsx`

## purpose
Cartographier precisement le systeme de commandes slash, les sous-commandes CLI et les transports non interactifs pour pouvoir extraire un shell agentique plus petit. Le point central a retenir est que `src/commands.ts` n'est pas "le CLI", mais seulement le registre des slash commands; le vrai CLI `commander` vit dans `src/main.tsx`, et le runtime headless/SDK vit dans `src/cli/print.ts` + `src/cli/structuredIO.ts`.

## entrypoints
- `src/commands.ts`: assemble le registre des commandes builtin, skills, plugins, workflows et filtres safe-mode.
- `src/types/command.ts`: contrat unifie des commandes `prompt`, `local` et `local-jsx`.
- `src/utils/processUserInput/processSlashCommand.tsx`: dispatch runtime selon `command.type`.
- `src/main.tsx`: filtre headless `commandsHeadless` a `2622` et enregistre les sous-commandes `commander` a partir de `3894`.
- `src/cli/print.ts`: point d'entree `--print` / SDK, selection `StructuredIO` vs `RemoteIO`.
- `src/cli/structuredIO.ts`: coeur du protocole NDJSON / `control_request` / `control_response`.
- `src/cli/remoteIO.ts`: adaptation du protocole vers session ingress / WebSocket / SSE / Hybrid / bridge.

## key files
- `src/commands.ts`: registre central. Symboles clefs: `COMMANDS`, `loadAllCommands`, `getCommands`, `getMcpSkillCommands`, `getSkillToolCommands`, `getSlashCommandToolSkills`, `REMOTE_SAFE_COMMANDS`, `BRIDGE_SAFE_COMMANDS`, `isBridgeSafeCommand`, `filterCommandsForRemoteMode`.
- `src/types/command.ts`: types centraux. Symboles clefs: `PromptCommand`, `LocalCommandResult`, `LocalJSXCommandContext`, `CommandAvailability`, `CommandBase`, `Command`, `getCommandName`, `isCommandEnabled`.
- `src/utils/processUserInput/processSlashCommand.tsx`: dispatch effectif. Symboles clefs: `getMessagesForSlashCommand`, `processPromptSlashCommand`, `getMessagesForPromptSlashCommand`, `formatCommandLoadingMetadata`.
- `src/main.tsx`: vrai registry des sous-commandes `commander`, filtre headless a `2584-2628`, bypass print-mode a `3875-3890`.
- `src/cli/print.ts`: normalisation input -> stream JSON via `getStructuredIO`, hot reload plugins/skills, rehydratation `getCommands(cwd())`.
- `src/cli/structuredIO.ts`: parseur de lignes, gestion des requetes/reponses de controle, permission bridge, sandbox ask callback, MCP tunnel.
- `src/cli/remoteIO.ts`: selection du transport reseau, auth headers, token refresh, bridge echo, branche `CCRClient`.
- `src/cli/transports/transportUtils.ts`: `getTransportForUrl`, selection SSE -> Hybrid -> WebSocket.
- `src/cli/transports/SerialBatchEventUploader.ts`: primitive generique de batching/retry/backpressure.
- `src/cli/transports/WorkerStateUploader.ts`: uploader de patchs coalesces avec retry.
- `src/skills/loadSkillsDir.ts`: fabrique de commandes `prompt` pour les skills disque/bundled. Symboles clefs: `createSkillCommand`, `getSkillDirCommands`, `getDynamicSkills`.
- `src/utils/plugins/loadPluginCommands.ts`: fabrique de commandes `prompt` pour plugins/skills plugins. Symboles clefs: `getPluginCommands`, `getPluginSkills`.
- `src/commands/createMovedToPluginCommand.ts`: pattern de commande builtin qui redirige vers un plugin.

## data flow
1. `src/commands.ts:258-318` construit les descripteurs builtin memoizes via `COMMANDS()`.
2. `src/commands.ts:353-458` charge les commandes dynamiques:
   - skills disque
   - plugin skills
   - bundled skills
   - builtin plugin skills
   - workflow commands si `WORKFLOW_SCRIPTS`
   - plugin prompt commands
3. `src/commands.ts:476-517` filtre par `availability` et `isEnabled()`, puis injecte les `dynamicSkills` avant les builtin commands.
4. `src/utils/processUserInput/processSlashCommand.tsx:525-777` dispatch:
   - `local-jsx` via `command.load().then(mod => mod.call(onDone, ...))`
   - `local` via `await command.load(); await mod.call(args, context)`
   - `prompt` via `command.getPromptForCommand(...)` ou fork sub-agent si `context === 'fork'`
5. `src/main.tsx:2620-2622` recalcule encore un sous-ensemble headless:
   - toutes les `prompt` sauf `disableNonInteractive`
   - seulement les `local` avec `supportsNonInteractive`
6. `src/cli/print.ts:5199-5232` choisit `StructuredIO` ou `RemoteIO`.
7. `src/cli/structuredIO.ts` gere le protocole de controle, les permissions, elicitation et le tunnel MCP.
8. `src/cli/remoteIO.ts` branche un transport reseau concret et optionnellement `CCRClient`.

## external deps
- `commander`: sous-commandes CLI en dehors du registre slash.
- `zod`: validation des payloads `control_response`, permissions et MCP.
- `@modelcontextprotocol/sdk`: types MCP / JSON-RPC dans `StructuredIO`.
- `stream` / `PassThrough`: pont `RemoteIO` -> `StructuredIO`.
- `crypto.randomUUID`: correlation des `control_request`.
- `bun:bundle feature(...)`: dead-code elimination et gates compile/runtime.
- `React` / `Ink`: uniquement pour les commandes `local-jsx` et certains handlers CLI.

## flags/env
- Gates du registre `src/commands.ts`:
  - `WORKFLOW_SCRIPTS` pour `getWorkflowCommands`
  - `MCP_SKILLS` pour `getMcpSkillCommands`
  - `PROACTIVE`, `KAIROS`, `KAIROS_BRIEF`, `KAIROS_GITHUB_WEBHOOKS`
  - `BRIDGE_MODE`, `DAEMON`, `VOICE_MODE`, `ULTRAPLAN`, `TORCH`, `UDS_INBOX`, `FORK_SUBAGENT`, `BUDDY`, `CCR_REMOTE_SETUP`
- Gates par commande:
  - `DISABLE_COMPACT` dans `src/commands/compact/index.ts:9`
  - `DISABLE_INSTALL_GITHUB_APP_COMMAND` dans `src/commands/install-github-app/index.ts:9`
  - `USER_TYPE` dans `src/commands/files/index.ts:7` et plusieurs commandes internes
- Gates remote transport:
  - `CLAUDE_CODE_USE_CCR_V2` dans `src/cli/remoteIO.ts` et `src/cli/transports/transportUtils.ts`
  - `CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2` dans `src/cli/transports/transportUtils.ts:38-41`
  - `CLAUDE_CODE_ENVIRONMENT_KIND=bridge` dans `src/cli/remoteIO.ts:96`
  - `CLAUDE_CODE_ENVIRONMENT_RUNNER_VERSION` dans `src/cli/remoteIO.ts:60-78`
- Gates de mode:
  - `-p` / `--print` dans `src/main.tsx:968` et `src/main.tsx:2584-2622`
  - mode remote/bridge via `getIsRemoteMode()` dans `src/commands/session/index.ts`

## reusable ideas
- Union discriminee tres nette entre `prompt`, `local` et `local-jsx`.
- Meme nom logique avec plusieurs implementations selon le mode, exemple `src/commands/context/index.ts`.
- `load()` lazy sur les commandes lourdes pour garder le registre leger.
- Allowlists explicites pour surfaces distantes (`REMOTE_SAFE_COMMANDS`, `BRIDGE_SAFE_COMMANDS`) plutot qu'un heuristique implicite.
- Usines de commandes markdown vers `PromptCommand` reutilisables (`createSkillCommand`, plugin loaders).
- Lazy import des handlers `commander` pour ne pas payer le cout de tous les subcommands en print mode.
- Petites primitives de transport generiques (`SerialBatchEventUploader`, `WorkerStateUploader`) extractibles presque telles quelles.

## reusable features
- `command_registry`: haute valeur, coupling moyenne. Bon pour un shell agentique avec catalogue de slash commands et loaders lazy.
- `command_contract_types`: haute valeur, coupling faible. La meilleure tranche a copier d'abord.
- `structured_io_transport`: haute valeur, coupling moyenne. Bonne base pour un SDK headless ou un bridge IDE.
- `batched_event_uploader`: haute valeur, coupling faible. Reutilisable hors Claude Code.
- `cli_transports`: valeur moyenne, coupling moyenne. Utile comme reference d'integration plus large, moins comme copie brute.

## copy risk
Couplage moyen a eleve si on essaye de copier `src/commands.ts` ou `src/cli/structuredIO.ts` sans retailler les dependances runtime. Couplage faible a moyen pour les contrats et les primitives de batching. Le piege principal est que le filtrage de mode et de securite n'est pas centralise dans un seul fichier.

## search hints
- `getCommands`
- `getMessagesForSlashCommand`
- `commandsHeadless`
- `StructuredIO`
- `RemoteIO`
- `program.command(`

## subdomains
- `command registry`: catalogue des slash commands builtin + dynamiques.
- `command contracts`: contrat des commandes et champs de filtrage.
- `prompt commands`: commandes qui injectent du prompt ou de la meta dans la conversation.
- `local commands`: commandes JS qui renvoient un resultat texte/compact/skip.
- `local-jsx commands`: commandes UI Ink, souvent modales, jamais bridge-safe.
- `CLI transports`: headless/stdio/reseau pour `--print`, SDK et bridge.
- `commander subcommands`: CLI hors conversation, separe des slash commands.

## layer map
| Layer | Fichiers centraux | Symboles exacts | Notes d'extraction |
| --- | --- | --- | --- |
| Slash command registry | `src/commands.ts` | `COMMANDS`, `loadAllCommands`, `getCommands`, `findCommand`, `getCommand` | Copiable si on remplace les loaders dynamiques |
| Command contracts | `src/types/command.ts` | `PromptCommand`, `LocalCommandResult`, `CommandBase`, `Command` | Meilleure tranche low-risk |
| Prompt command materializers | `src/skills/loadSkillsDir.ts`, `src/utils/plugins/loadPluginCommands.ts` | `createSkillCommand`, `getPluginCommands`, `getPluginSkills` | Reutilisable pour commandes markdown-driven |
| Slash command runtime | `src/utils/processUserInput/processSlashCommand.tsx` | `getMessagesForSlashCommand`, `getMessagesForPromptSlashCommand` | Couplage fort au transcript et au contexte de session |
| Mode filtering | `src/commands.ts`, `src/main.tsx`, `src/hooks/useReplBridge.tsx` | `filterCommandsForRemoteMode`, `isBridgeSafeCommand`, `commandsHeadless` | Filtrage disperse, ne pas supposer un point unique |
| Headless transport | `src/cli/print.ts`, `src/cli/structuredIO.ts` | `getStructuredIO`, `StructuredIO` | Bonne base d'extraction |
| Remote transport | `src/cli/remoteIO.ts`, `src/cli/transports/**` | `RemoteIO`, `getTransportForUrl`, `CCRClient` | Plus lourd a extraire |
| Commander subcommands | `src/main.tsx`, `src/cli/handlers/**` | `program.command(...)` | Hors registre slash; important pour separer les concerns |

## command registry

### Builtin registry
- `src/commands.ts:258-318` definit `COMMANDS = memoize((): Command[] => [...])`.
- Chaque entree est un descripteur `Command` objet, pas une classe ni une factory uniforme.
- `src/commands.ts:348-350` derive `builtInCommandNames` depuis `name` + `aliases`.
- `src/commands.ts:190-202` expose `usageReport` comme shim lazy pour `/insights`, bon exemple de deferral d'un module tres lourd.
- `src/commands.ts:225-254` maintient `INTERNAL_ONLY_COMMANDS`, utile pour editions produit internes mais a supprimer dans une extraction reuse.

### Dynamic command sources
- `src/commands.ts:353-398` regroupe les skills via `getSkills(cwd)`:
  - `getSkillDirCommands(cwd)`
  - `getPluginSkills()`
  - `getBundledSkills()`
  - `getBuiltinPluginSkillCommands()`
- `src/commands.ts:401-405` branche `getWorkflowCommands` derriere `WORKFLOW_SCRIPTS`.
- `src/commands.ts:449-468` fusionne les couches dans cet ordre:
  - `bundledSkills`
  - `builtinPluginSkills`
  - `skillDirCommands`
  - `workflowCommands`
  - `pluginCommands`
  - `pluginSkills`
  - `COMMANDS()`
- Cet ordre est important car `src/commands.ts:504-516` insere ensuite les `dynamicSkills` juste avant le premier builtin command.

### Filtering and lookup
- `src/commands.ts:476-517` applique `meetsAvailabilityRequirement(_) && isCommandEnabled(_)` a chaque appel de `getCommands(cwd)`.
- `src/commands.ts:491-498` dedupe les `dynamicSkills` par `name`, puis les re-insere avant les builtin commands.
- `src/commands.ts:688-708` resout une commande par:
  - `name`
  - `getCommandName(cmd)` si `userFacingName()` existe
  - `aliases`
- `src/commands.ts:523-535` separe `clearCommandMemoizationCaches()` et `clearCommandsCache()`.
- `src/cli/print.ts:1823-1829` et `1756-1770` montrent les deux usages concrets:
  - invalidation skill hot reload
  - refresh plugin state en mode headless

### Registry views for model/tooling
- `src/commands.ts:547-559` `getMcpSkillCommands(mcpCommands)` ne passe pas par `getCommands()`. C'est un cas a part important.
- `src/commands.ts:563-580` `getSkillToolCommands(cwd)` retourne les `prompt` non builtin, model-invocable, avec description/`whenToUse`.
- `src/commands.ts:586-607` `getSlashCommandToolSkills(cwd)` retourne une vue plus "skills catalog" des `prompt` commandes.
- Cette separation est importante pour un shell agentique: une meme commande peut etre visible:
  - a l'utilisateur
  - au modele
  - au skill tool
  - au bridge mobile
  - au remote mode
  sans etre exposee identiquement partout.

## command contracts

### Types centraux
- `src/types/command.ts:16` `LocalCommandResult`
  - `text`
  - `compact`
  - `skip`
- `src/types/command.ts:25` `PromptCommand`
  - clefs d'extraction fortes: `getPromptForCommand`, `source`, `allowedTools`, `disableNonInteractive`, `hooks`, `skillRoot`, `context`, `agent`, `effort`, `paths`, `disableModelInvocation`, `userInvocable`
- `src/types/command.ts:62` `LocalCommandCall`
- `src/types/command.ts:70` `LocalCommandModule`
- `src/types/command.ts:74` `LocalCommand`
  - critere headless central: `supportsNonInteractive`
- `src/types/command.ts:80` `LocalJSXCommandContext`
  - type puissant mais fortement couple au runtime principal
- `src/types/command.ts:100` `ResumeEntrypoint`
- `src/types/command.ts:117` `LocalJSXCommandOnDone`
- `src/types/command.ts:131` `LocalJSXCommandCall`
- `src/types/command.ts:140` `LocalJSXCommandModule`
- `src/types/command.ts:144` `LocalJSXCommand`
  - critere central: `load()` qui renvoie un module UI lazy
- `src/types/command.ts:169` `CommandAvailability`
  - valeurs exactes: `'claude-ai' | 'console'`
- `src/types/command.ts:175` `CommandBase`
  - champs d'extraction importants: `availability`, `isEnabled`, `isHidden`, `aliases`, `disableModelInvocation`, `userInvocable`, `loadedFrom`, `kind`, `immediate`, `isSensitive`, `userFacingName`
- `src/types/command.ts:205` `Command`
- `src/types/command.ts:209` `getCommandName`
- `src/types/command.ts:214` `isCommandEnabled`

### Contrat minimal utile a extraire
Pour un futur shell agentique, le noyau minimal a garder est:
- `CommandBase.name`
- `CommandBase.description`
- `CommandBase.aliases`
- `CommandBase.isEnabled`
- `CommandBase.isHidden`
- `PromptCommand.getPromptForCommand`
- `LocalCommand.supportsNonInteractive`
- `LocalCommand.load`
- `LocalJSXCommand.load`
- `Command.type`

Le reste peut devenir optionnel ou etre re-specialise:
- `LocalJSXCommandContext` peut etre remplace par un `CommandExecutionContext` plus petit.
- `PromptCommand.source`, `loadedFrom`, `pluginInfo`, `skillRoot`, `paths` sont utiles si on veut garder un catalogue multi-origines.

## prompt commands vs local commands
| Kind | Fichiers / exemples | Execution runtime | Headless | Remote / bridge | Reuse note |
| --- | --- | --- | --- | --- | --- |
| `prompt` | `src/commands/review.ts`, `src/commands/statusline.tsx`, `src/skills/loadSkillsDir.ts`, `src/utils/plugins/loadPluginCommands.ts` | `processSlashCommand.tsx:723-730` puis `827-885` | Oui sauf `disableNonInteractive` | `isBridgeSafeCommand()` retourne `true` pour tous les `prompt` | Meilleur format pour skills / macros / recipes |
| `local` | `src/commands/compact/index.ts`, `src/commands/advisor.ts`, `src/commands/files/index.ts`, `src/commands/context/index.ts` | `processSlashCommand.tsx:657-721` | Oui si `supportsNonInteractive` et si `main.tsx:2622` les garde | Seulement si l'objet est present dans `BRIDGE_SAFE_COMMANDS` | Bon format pour commandes non UI a resultat structure |
| `local-jsx` | `src/commands/plugin/index.tsx`, `src/commands/mcp/index.ts`, `src/commands/session/index.ts`, `src/commands/install-github-app/index.ts`, `src/commands/remote-setup/index.ts` | `processSlashCommand.tsx:551-655` | Non | Toujours bloquees par `isBridgeSafeCommand()` | A eviter dans une extraction minimaliste si on ne reprend pas Ink |

### Exemples structurants
- `src/commands/context/index.ts:4-22`
  - `context` interactive: `type: 'local-jsx'`
  - `contextNonInteractive` headless: `type: 'local'`
  - meme `name: 'context'`, activation selon `getIsNonInteractiveSession()`
- `src/commands/review.ts:34-55`
  - `/review`: `prompt`, pure expansion locale
  - `/ultrareview`: `local-jsx`, chemin distant sur le web
- `src/commands/statusline.tsx:5-15`
  - `prompt` avec `allowedTools`
  - `disableNonInteractive: true`
- `src/commands/advisor.ts:96-107`
  - `local` tres petit
  - `load: () => Promise.resolve({ call })`
  - excellent squelette minimal

## transports CLI

### Important: `src/commands.ts` n'est pas le CLI `commander`
- Le registre slash commande la conversation.
- Les sous-commandes `claude mcp`, `claude auth`, `claude plugin`, `claude doctor`, etc. vivent dans `src/main.tsx`.
- `src/main.tsx:3875-3890` saute explicitement l'enregistrement des 52 subcommands en mode `--print`.
- `src/main.tsx:3894+`, `4100+`, `4148+`, `4267+` montrent les vrais points d'entree `commander`.
- Les handlers lourds sont lazy-loades:
  - `src/cli/handlers/mcp.tsx`
  - `src/cli/handlers/plugins.ts`
  - `src/cli/handlers/auth.ts`
  - `src/cli/handlers/util.tsx`
  - `src/cli/handlers/agents.ts`
  - `src/cli/handlers/autoMode.ts`

### Point d'entree headless
- `src/cli/print.ts` est le transport principal pour `--print`.
- `src/cli/print.ts:5199-5232` convertit une string simple en flux `SDKUserMessage`, puis choisit:
  - `new StructuredIO(...)`
  - `new RemoteIO(...)` si `sdkUrl` est fourni
- `src/cli/print.ts:1760-1770` rehydrate `currentCommands` apres refresh plugin.
- `src/cli/print.ts:1823-1829` clear le cache commandes lors des changements de skills.
- `src/cli/print.ts:3091-3120` renvoie une liste de commandes formattees apres reload plugins.

## structured IO / remote IO

### `StructuredIO`
- Fichier central: `src/cli/structuredIO.ts`
- Classe: `StructuredIO` a `135`
- Roles principaux:
  - parser un flux NDJSON ligne par ligne
  - ignorer `keep_alive`
  - appliquer `update_environment_variables`
  - resoudre les `control_response`
  - deduper les reponses tardives/dupliquees par `toolUseID`
  - exposer `sendRequest()` promise-based
  - construire `CanUseToolFn` avec race hooks vs prompt SDK
  - fournir `createSandboxAskCallback()` via un faux outil `SandboxNetworkAccess`
  - fournir `sendMcpMessage()` pour tunnel JSON-RPC
- Symboles les plus importants:
  - `SANDBOX_NETWORK_ACCESS_TOOL_NAME`
  - `StructuredIO.processLine()` a `333`
  - `StructuredIO.write()` a `465`
  - `StructuredIO.sendRequest()` a `469`
  - `StructuredIO.createCanUseTool()` a `533`
  - `StructuredIO.createHookCallback()` a `661`
  - `StructuredIO.handleElicitation()` a `694`
  - `StructuredIO.createSandboxAskCallback()` a `731`
  - `StructuredIO.sendMcpMessage()` a `758`

### `RemoteIO`
- Fichier central: `src/cli/remoteIO.ts`
- Classe: `RemoteIO` a `35`
- `RemoteIO` etend `StructuredIO` et ajoute:
  - acquisition/relecture de token session ingress
  - `getTransportForUrl(...)`
  - piping `transport.setOnData(...)` -> `PassThrough`
  - branche `CCRClient` si `CLAUDE_CODE_USE_CCR_V2`
  - listeners `setInternalEventWriter`, `setInternalEventReader`, `setCommandLifecycleListener`, `setSessionStateChangedListener`, `setSessionMetadataChangedListener`
  - bridge keepalive/debug echo
- Symboles les plus importants:
  - `RemoteIO.constructor()` a `44`
  - `RemoteIO.flushInternalEvents()` a `217`
  - `RemoteIO.internalEventsPending` a `221`
  - `RemoteIO.write()` a `231`

### Selection du transport concret
- `src/cli/transports/transportUtils.ts:12-16` documente l'ordre exact:
  - `SSETransport` si `CLAUDE_CODE_USE_CCR_V2`
  - `HybridTransport` si `CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2`
  - `WebSocketTransport` par defaut
- `src/cli/transports/ccrClient.ts` est le coeur du protocole CCR v2, mais c'est une dependance lourde, pas la plus petite extraction viable.

### Sous-tranches transport tres reutilisables
- `src/cli/ndjsonSafeStringify.ts`
  - helper simple pour encoder du JSON en NDJSON sans casser certains separators Unicode
- `src/cli/transports/SerialBatchEventUploader.ts`
  - batching serie
  - retry exponentiel
  - backpressure
  - flush bloquant
- `src/cli/transports/WorkerStateUploader.ts`
  - 1 in-flight PUT + 1 pending patch
  - coalescence des updates
  - retry avec absorption des patchs arrives pendant le retry

## lazy loading des commandes
- `src/commands.ts:188-202` utilise un shim lazy pour `/insights`.
- `src/commands.ts` utilise des `require(...)` conditionnels derriere `feature(...)` pour couper les imports lourds:
  - `PROACTIVE`
  - `KAIROS`
  - `BRIDGE_MODE`
  - `VOICE_MODE`
  - `WORKFLOW_SCRIPTS`
  - `CCR_REMOTE_SETUP`
  - etc.
- Les commandes `local` et `local-jsx` utilisent presque toutes `load: () => import('./...')`.
- `src/commands/advisor.ts:105-106` montre la variante minimale `Promise.resolve({ call })`.
- `src/skills/loadSkillsDir.ts` et `src/utils/plugins/loadPluginCommands.ts` construisent des `prompt` commands a la volee au moment du scan disque/plugin.
- `src/main.tsx:3904`, `4114`, `4154`, `4272`, `4281`, `4293` lazy-loadent les handlers `commander`.
- Danger de snapshot:
  - `src/commands.ts:401-405` reference `./tools/WorkflowTool/createWorkflowCommand.js`
  - ce fichier est absent du snapshot courant
  - donc la couche workflow est une dependance d'extraction incomplete ici

## feature inventory
| Commande / famille | Type | Fichiers exacts | Role | Interet extraction |
| --- | --- | --- | --- | --- |
| `/context` | `local-jsx` + `local` | `src/commands/context/index.ts`, `src/commands/context/context.tsx`, `src/commands/context/context-noninteractive.ts` | meme commande, UX differente selon le mode | meilleur exemple de dual registration |
| `/compact` | `local` | `src/commands/compact/index.ts`, `src/commands/compact/compact.ts` | compaction headless-compatible | squelette de commande non UI |
| `/advisor` | `local` | `src/commands/advisor.ts` | config locale simple | exemple minimal de `LocalCommand` |
| `/files` | `local` | `src/commands/files/index.ts`, `src/commands/files/files.ts` | liste les fichiers en contexte | commande texte bridge-safe |
| `/review` | `prompt` | `src/commands/review.ts` | review locale via prompt/gh | bon exemple de builtin prompt command |
| `/ultrareview` | `local-jsx` | `src/commands/review.ts`, `src/commands/review/ultrareviewCommand.tsx` | review distante/web | montre la separation local vs remote UX |
| `/mcp` | `local-jsx` | `src/commands/mcp/index.ts`, `src/commands/mcp/mcp.tsx` | gestion MCP | commande immediate UI |
| `/plugin` | `local-jsx` | `src/commands/plugin/index.tsx`, `src/commands/plugin/plugin.tsx` | marketplace / settings plugins | alias + `immediate: true` |
| `/session` / `/remote` | `local-jsx` | `src/commands/session/index.ts`, `src/commands/session/session.tsx` | QR/url de session remote | exemple de commande visible seulement en remote mode |
| `/install-github-app` | `local-jsx` | `src/commands/install-github-app/index.ts`, `src/commands/install-github-app/install-github-app.tsx` | wizard GitHub Actions | bon exemple de `availability` |
| `/web-setup` | `local-jsx` | `src/commands/remote-setup/index.ts`, `src/commands/remote-setup/remote-setup.tsx` | onboarding remote web | bon exemple de `availability` + policy + GrowthBook |
| `/statusline` | `prompt` | `src/commands/statusline.tsx` | fait appeler l'AgentTool pour configurer la status line | montre `allowedTools` + `disableNonInteractive` |
| Skills disque / bundled | `prompt` genere | `src/skills/loadSkillsDir.ts` | markdown -> commande | pattern cle pour shell agentique extensible |
| Commandes plugins | `prompt` genere | `src/utils/plugins/loadPluginCommands.ts` | plugin markdown -> commande | pattern cle pour ecosysteme plugin |
| Adaptateur "moved to plugin" | `prompt` | `src/commands/createMovedToPluginCommand.ts` | compat layer builtin -> plugin | pattern de migration reutilisable |

## symbol map
| Fichier | Symboles exacts | Pourquoi ils comptent |
| --- | --- | --- |
| `src/commands.ts` | `usageReport`, `INTERNAL_ONLY_COMMANDS`, `COMMANDS`, `builtInCommandNames`, `getSkills`, `getWorkflowCommands`, `loadAllCommands`, `getCommands`, `clearCommandMemoizationCaches`, `clearCommandsCache`, `getMcpSkillCommands`, `getSkillToolCommands`, `getSlashCommandToolSkills`, `REMOTE_SAFE_COMMANDS`, `BRIDGE_SAFE_COMMANDS`, `isBridgeSafeCommand`, `filterCommandsForRemoteMode`, `findCommand`, `getCommand`, `formatDescriptionWithSource` | Carte complete du registre et de ses sous-vues |
| `src/types/command.ts` | `LocalCommandResult`, `PromptCommand`, `LocalCommandCall`, `LocalCommandModule`, `LocalJSXCommandContext`, `ResumeEntrypoint`, `LocalJSXCommandOnDone`, `LocalJSXCommandCall`, `LocalJSXCommandModule`, `CommandAvailability`, `CommandBase`, `Command`, `getCommandName`, `isCommandEnabled` | Contrat canonique |
| `src/utils/processUserInput/processSlashCommand.tsx` | `getMessagesForSlashCommand`, `processPromptSlashCommand`, `getMessagesForPromptSlashCommand`, `formatCommandLoadingMetadata` | Dispatch runtime reel |
| `src/main.tsx` | `commandsHeadless`, `program.command(...)`, print-mode bypass | Filtrage de mode et separation CLI/slash |
| `src/cli/print.ts` | `getStructuredIO`, `refreshPluginState`, skill change subscription | Glue headless/SDK |
| `src/cli/structuredIO.ts` | `StructuredIO`, `processLine`, `sendRequest`, `createCanUseTool`, `createHookCallback`, `handleElicitation`, `createSandboxAskCallback`, `sendMcpMessage` | Protocole IO structure |
| `src/cli/remoteIO.ts` | `RemoteIO`, `flushInternalEvents`, `internalEventsPending`, `write` | Extension remote |
| `src/cli/transports/transportUtils.ts` | `getTransportForUrl` | Point unique de selection reseau |
| `src/cli/transports/SerialBatchEventUploader.ts` | `RetryableError`, `SerialBatchEventUploader` | Primitive extraction-ready |
| `src/cli/transports/WorkerStateUploader.ts` | `WorkerStateUploader` | Primitive extraction-ready |
| `src/skills/loadSkillsDir.ts` | `createSkillCommand`, `getSkillDirCommands`, `getDynamicSkills` | Fabrique des prompt commands markdown |
| `src/utils/plugins/loadPluginCommands.ts` | `getPluginCommands`, `getPluginSkills` | Variante plugin-aware de la fabrique |

## dependency map

### Registry and command contracts
- `src/commands.ts` depend de:
  - `src/types/command.ts`
  - skills loaders
  - plugin loaders
  - bundled skills
  - feature flags `feature(...)`
  - auth/provider state pour `availability`
- `src/types/command.ts` depend surtout de types runtime:
  - `ToolUseContext`
  - `CompactionResult`
  - `ScopedMcpServerConfig`
  - types IDE/theme/settings/hooks/plugin

### Runtime dispatch
- `src/utils/processUserInput/processSlashCommand.tsx` depend de:
  - constructions de messages user/system/meta
  - hook registration
  - state de compaction
  - permission engine
  - forked subagent runtime
  - `context.options.commands`

### Headless / transports
- `src/cli/print.ts` depend de:
  - `getCommands(cwd())`
  - sandbox manager
  - plugin refresh
  - MCP config diff
  - current agents/state headless
- `src/cli/structuredIO.ts` depend de:
  - schemas SDK/control
  - permission engine
  - session lifecycle emitters
  - command lifecycle notifications
  - hooks runtime
  - MCP tunnel
- `src/cli/remoteIO.ts` depend de:
  - session ingress auth token
  - cleanup registry
  - session storage listeners
  - `CCRClient`
  - transports WebSocket / SSE / Hybrid

### Commander CLI
- `src/main.tsx` depend de:
  - `commander`
  - tous les handlers CLI lazy-loades
  - settings/bootstrap au parse time
- Les handlers `src/cli/handlers/**` ont chacun leurs propres dependances domaine.

## central files for common changes

### Enregistrer une nouvelle commande
- Nouvelle builtin slash command:
  - descripteur: `src/commands/<nom>/index.ts` ou `src/commands/<nom>.ts`
  - implementation: module cible du `load()`
  - enregistrement: `src/commands.ts:258-318`
- Nouvelle commande markdown/skill:
  - `src/skills/loadSkillsDir.ts:317-344`
- Nouvelle commande plugin:
  - `src/utils/plugins/loadPluginCommands.ts:300-326`
- Si la commande est migree vers plugin:
  - `src/commands/createMovedToPluginCommand.ts`
- Si la commande a des alias ou un nom affiche different:
  - `src/types/command.ts:175-205` via `aliases` et `userFacingName()`

### Filtrer les commandes par mode
- Filtrage remote mode:
  - `src/commands.ts:619-685`
  - `REMOTE_SAFE_COMMANDS`
  - `filterCommandsForRemoteMode`
- Filtrage bridge inbound:
  - `src/commands.ts:651-675`
  - `BRIDGE_SAFE_COMMANDS`
  - `isBridgeSafeCommand`
  - `src/hooks/useReplBridge.tsx:314`
- Filtrage headless:
  - `src/main.tsx:2620-2622`
  - champs contractuels: `disableNonInteractive`, `supportsNonInteractive`
- Filtrage par auth/provider:
  - `availability` dans `src/types/command.ts:169-205`
- Filtrage par activation locale:
  - `isEnabled()` / `isHidden()`

### Brancher un transport non interactif
- Point d'entree:
  - `src/cli/print.ts:5199-5232`
- Transport stdio/NDJSON:
  - `src/cli/structuredIO.ts`
- Transport distant:
  - `src/cli/remoteIO.ts`
  - `src/cli/transports/transportUtils.ts`
- Primitives annexes:
  - `src/cli/ndjsonSafeStringify.ts`
  - `src/cli/transports/SerialBatchEventUploader.ts`
  - `src/cli/transports/WorkerStateUploader.ts`
- Si on veut aussi le protocole session ingress complet:
  - `src/cli/transports/ccrClient.ts`

## extraction recipes

### Recipe 1: minimal command registry
- Copier:
  - `src/types/command.ts`
  - les helpers `findCommand`, `getCommand`, `getCommandName`, `isCommandEnabled` inspires de `src/commands.ts`
  - 1 ou 2 exemples simples comme `src/commands/advisor.ts` et `src/commands/compact/index.ts`
- Retirer d'abord:
  - `getSkills`
  - `getPluginCommands`
  - `getWorkflowCommands`
  - `INTERNAL_ONLY_COMMANDS`
  - `REMOTE_SAFE_COMMANDS`
  - `BRIDGE_SAFE_COMMANDS`
- Remplacer:
  - `ToolUseContext` par un contexte plus petit
  - feature flags par un simple tableau de commandes builtin
- Difficulte:
  - moyenne

### Recipe 2: prompt-command factory
- Copier:
  - la logique `createSkillCommand` de `src/skills/loadSkillsDir.ts:317-344`
  - la logique de construction plugin dans `src/utils/plugins/loadPluginCommands.ts:300-326`
- Garder:
  - `type: 'prompt'`
  - `allowedTools`
  - `argumentHint`
  - `argNames`
  - `userInvocable`
  - `loadedFrom`
- Simplifier:
  - hooks
  - `skillRoot`
  - `paths`
  - substitution d'env/plugin vars
- Difficulte:
  - moyenne

### Recipe 3: structured IO headless
- Copier:
  - `src/cli/structuredIO.ts`
  - `src/cli/ndjsonSafeStringify.ts`
  - la normalisation `getStructuredIO` de `src/cli/print.ts:5199-5232`
- Stubber:
  - permission hooks
  - session state notifications
  - MCP tunnel si non necessaire
- Garder:
  - `processLine`
  - `sendRequest`
  - dedupe des `control_response`
  - `createSandboxAskCallback` si besoin de permission reseau
- Difficulte:
  - moyenne a elevee

### Recipe 4: remote transport minimal
- Copier:
  - `src/cli/remoteIO.ts`
  - `src/cli/transports/transportUtils.ts`
  - un seul transport concret (`WebSocketTransport` ou `SSETransport`)
- Reporter a plus tard:
  - `CCRClient`
  - listeners session metadata/state
  - bridge debug echo
- Difficulte:
  - elevee

## minimal reusable slices

### Minimal reusable slice: command registry
- Fichiers a prendre:
  - `src/types/command.ts`
  - sous-ensemble de `src/commands.ts`
  - 2 a 5 descripteurs simples `src/commands/**/index.ts`
- Symboles a garder:
  - `Command`
  - `getCommandName`
  - `isCommandEnabled`
  - `findCommand`
  - `getCommand`
- Symboles a laisser hors slice initiale:
  - `getMcpSkillCommands`
  - `getSkillToolCommands`
  - `getSlashCommandToolSkills`
  - `REMOTE_SAFE_COMMANDS`
  - `BRIDGE_SAFE_COMMANDS`
- Taille minimale viable:
  - builtin commands + lazy `load()` + resolution par alias
- Difficulte d'extraction:
  - moyenne

### Minimal reusable slice: command contract types
- Fichier source:
  - `src/types/command.ts`
- Copier quasi tel quel:
  - `CommandBase`
  - `PromptCommand`
  - `LocalCommandResult`
  - `Command`
  - `getCommandName`
  - `isCommandEnabled`
- Retailler:
  - `LocalJSXCommandContext`
  - imports `CompactionResult`, `ScopedMcpServerConfig`, IDE/theme/settings
- Taille minimale viable:
  - union de types + 2 helpers
- Difficulte d'extraction:
  - faible

### Minimal reusable slice: structured IO transport
- Fichiers a prendre:
  - `src/cli/structuredIO.ts`
  - `src/cli/ndjsonSafeStringify.ts`
  - `src/cli/print.ts:5199-5232` comme glue
- Ajouter ensuite si besoin:
  - `src/cli/remoteIO.ts`
  - `src/cli/transports/transportUtils.ts`
- Retailler:
  - hooks permission
  - lifecycle session
  - MCP tunnel
  - mutation directe de `process.env`
- Taille minimale viable:
  - stdin/stdout NDJSON + `sendRequest()` + `control_response` correlation
- Difficulte d'extraction:
  - moyenne a elevee

### Optional reusable slice: batched event uploader
- Fichiers a prendre:
  - `src/cli/transports/SerialBatchEventUploader.ts`
  - `src/cli/transports/WorkerStateUploader.ts`
- Ce qui est deja bien decouple:
  - policy de retry
  - jitter/backpressure
  - coalescence
- Difficulte d'extraction:
  - faible

## strong couplings to runtime principal
- `src/main.tsx:2622` refiltre les commandes headless hors de `src/commands.ts`. Copier seulement le registre ne suffit pas.
- `src/commands.ts:651-685` utilise des `Set<Command>` bases sur les objets descripteurs eux-memes. Si on clone/reconstruit les commandes, les allowlists ne matchent plus.
- `src/utils/processUserInput/processSlashCommand.tsx` depend du transcript Claude Code:
  - messages `createUserMessage`
  - tags `<local-command-stdout>`
  - compaction / hooks / meta messages
- `src/types/command.ts` couple `LocalJSXCommandContext` a:
  - MCP config dynamique
  - IDE install state
  - theme
  - `resume(...)`
  - mutation `setMessages(...)`
- `src/cli/structuredIO.ts` melange transport, permissions, hooks, sandbox prompts, mutations d'env, lifecycle session et MCP tunnel.
- `src/cli/remoteIO.ts` depend de:
  - token session ingress
  - session id bootstrap
  - cleanup registry
  - `CCRClient`
  - session storage/internal events
- `src/commands.ts:547-559` garde les MCP skill commands hors de `getCommands()`. Une extraction naive les perdra.
- `src/commands.ts:401-405` depend d'un `WorkflowTool` absent du snapshot.

## do not copy blindly
- Ne pas copier `src/commands.ts` tel quel si vous ne reprenez pas skills/plugins/workflows.
- Ne pas supposer que toutes les slash commands vivent dans `src/commands.ts`; les sous-commandes `commander` vivent dans `src/main.tsx`.
- Ne pas supposer que `supportsNonInteractive` suffit; le runtime headless repasse par `src/main.tsx:2622`.
- Ne pas supposer que `prompt` = user-visible skill; `disableModelInvocation`, `userInvocable`, `loadedFrom` et `source` changent la surface d'exposition.
- Ne pas copier `StructuredIO` sans verifier si vous voulez vraiment:
  - muter `process.env`
  - gerer les permissions out-of-band
  - exposer un tunnel MCP
- Ne pas copier `RemoteIO` si vous n'avez pas de session ingress, tokens refreshables et protocoles bridge/CCR.
- Ne pas reprendre les allowlists remote/bridge en copiant juste les noms de commande; ici la logique est object-identity based.

## exact search shortcuts
- `rg -n "const COMMANDS|loadAllCommands|getCommands\\(|getMcpSkillCommands|getSkillToolCommands|getSlashCommandToolSkills|REMOTE_SAFE_COMMANDS|BRIDGE_SAFE_COMMANDS|isBridgeSafeCommand|filterCommandsForRemoteMode" src/commands.ts`
- `rg -n "export type LocalCommandResult|export type PromptCommand|export type LocalJSXCommandContext|export type CommandBase|export type Command =|getCommandName|isCommandEnabled" src/types/command.ts`
- `rg -n "getMessagesForSlashCommand|case 'local-jsx'|case 'local'|case 'prompt'|getMessagesForPromptSlashCommand|context === 'fork'" src/utils/processUserInput/processSlashCommand.tsx`
- `rg -n "supportsNonInteractive|disableNonInteractive|commandsHeadless" src/main.tsx`
- `rg -n "function getStructuredIO|new RemoteIO|new StructuredIO|refreshPluginState|getCommands\\(cwd\\(|clearCommandsCache" src/cli/print.ts`
- `rg -n "class StructuredIO|processLine\\(|control_response|createCanUseTool|createSandboxAskCallback|sendMcpMessage" src/cli/structuredIO.ts`
- `rg -n "class RemoteIO|getTransportForUrl|CCRClient|flushInternalEvents|internalEventsPending" src/cli/remoteIO.ts`
- `rg -n "getTransportForUrl|CLAUDE_CODE_USE_CCR_V2|CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2|SSETransport|HybridTransport|WebSocketTransport" src/cli/transports/transportUtils.ts`
- `rg -n "type: 'local-jsx'|type: 'local'|type: 'prompt'|supportsNonInteractive|disableNonInteractive|immediate" src/commands/**/index.ts src/commands/*.ts*`
- `rg -n "type: 'prompt'|loadedFrom|userInvocable|disableModelInvocation|getPromptForCommand" src/skills/loadSkillsDir.ts src/utils/plugins/loadPluginCommands.ts`
- `rg -n "program\\.command\\('|import\\('./cli/handlers" src/main.tsx`
- `rg -n "WORKFLOW_SCRIPTS|WorkflowTool" src/commands.ts src/tools`
