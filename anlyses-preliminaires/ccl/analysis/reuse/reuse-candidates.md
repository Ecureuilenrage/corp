# Reuse Candidates

## Reponse rapide
- Objectif de cette passe: repondre vite a la question "si je veux recuperer une fonctionnalite precise, quels fichiers et quels symboles dois-je regarder d'abord, et quels couplages dois-je eviter ?"
- Regle generale: copier d'abord les parseurs, schemas, validateurs et merge helpers; garder les gros orchestrateurs (`main.tsx`, `REPL.tsx`, `pluginLoader.ts`, `client.ts`, `permissions.ts`) comme references d'assemblage, pas comme point de depart.
- Si une tranche importe `src/utils/auth.ts`, `src/bootstrap/state.ts`, `src/screens/REPL.tsx`, `src/utils/config.ts`, `src/utils/permissions/permissions.ts` ou `src/services/api/claude.ts`, considerez que vous avez depasse la plus petite extraction viable.

| Besoin | Features a regarder d'abord | Fichiers a copier d'abord | Symboles d'entree | Couplages a eviter |
| --- | --- | --- | --- | --- |
| `shell safety rails` | `bash_safety_layer`, `powershell_safety_layer` | Bash: `src/utils/bash/**`, `src/tools/BashTool/{readOnlyValidation,pathValidation,sedValidation,sedEditParser,modeValidation,bashPermissions}.ts`; PowerShell: `src/utils/powershell/{parser,dangerousCmdlets}.ts`, `src/tools/PowerShellTool/{readOnlyValidation,pathValidation,gitSafety,powershellPermissions,powershellSecurity}.ts` | Bash: `bashPermissionRule`, `bashToolHasPermission`, `checkPathConstraints`; PowerShell: `parsePowerShellCommand`, `deriveSecurityFlags`, `powershellToolHasPermission`, `powershellCommandIsSafe` | `BashTool.tsx`, `PowerShellTool.tsx`, `shouldUseSandbox.ts`, `bashCommandIsSafe_DEPRECATED`, sandbox/UI runtime |
| `plugin loader` | `plugin_loader_minimal`, `plugin_manifest_schema`, `plugin_dependency_resolver` | `src/utils/plugins/{schemas,pluginIdentifier,pluginVersioning,dependencyResolver}.ts` + extraction selective de `pluginLoader.ts` | `loadPluginManifest`, `createPluginFromPath`, `mergePluginSources` | marketplace, zip cache, install manager, builtin plugins, startup checks |
| `skill loader` | `skill_loader_minimal`, `bundled_skill_registry`, `dynamic_skill_loader` | extraction selective de `src/skills/loadSkillsDir.ts`; optionnel `src/skills/{bundledSkills,mcpSkillBuilders}.ts`; helpers `src/utils/{frontmatterParser,markdownConfigLoader,argumentSubstitution}.ts` | `getSkillsPath`, `parseSkillFrontmatterFields`, `createSkillCommand`, `getSkillDirCommands`, `getDynamicSkills` | `SkillTool/**`, analytics, shell inline execution, plugin-only policy, full overlay runtime |
| `MCP minimal` | `mcp_client_minimal`, `mcp_client_core` | `src/services/mcp/{types,mcpStringUtils,normalization,envExpansion}.ts` + extraction selective de `client.ts` | `McpServerConfigSchema`, `normalizeNameForMCP`, `expandEnvVarsInString`, `wrapFetchWithTimeout`, `connectToServer`, `ensureConnectedClient`, `fetchToolsForClient`, `fetchResourcesForClient`, `fetchCommandsForClient` | `config.ts`, `auth.ts`, `useManageMCPConnections.ts`, `MCPConnectionManager.tsx`, `MCPTool/**` |
| `memory stack minimale` | `memdir_local_minimal`, `portable_session_storage` | `src/memdir/{paths,memoryTypes,memoryScan}.ts`, `src/utils/{frontmatterParser,readFileInRange}.ts` | `isAutoMemoryEnabled`, `getMemoryBaseDir`, `scanMemoryFiles`, `formatMemoryManifest`, `MEMORY_TYPES`, `parseMemoryType` | `memdir.ts`, `SessionMemory/**`, `extractMemories/**`, team sync tant que vous n'avez pas OAuth |
| `settings/policy minimale` | `settings_merge_engine`, `permission_layer_minimal`, `policy_limits_cache` | `src/utils/settings/{settings,constants,settingsCache,types,validation,managedPath,internalWrites}.ts`, `src/schemas/hooks.ts`, `src/utils/permissions/{filesystem,pathValidation,PermissionMode,permissionRuleParser,permissionsLoader}.ts`, `src/utils/settings/permissionValidation.ts` | `getSettingsForSource`, `getPolicySettingsOrigin`, `settingsMergeCustomizer`, `getInitialSettings`, `getSettingsWithSources`, `validatePermissionRule`, `loadAllPermissionRulesFromDisk`, `checkEditableInternalPath`, `checkReadableInternalPath`, `isPolicyAllowed` | `permissions.ts`, `permissionSetup.ts`, `remoteManagedSettings/securityCheck.tsx`, `config.ts`, carve-outs internes non purges |
| `API client + OAuth` | `api_client_minimal`, `oauth_pkce_flow`, `oauth_secure_storage` | API: `src/services/api/{client,withRetry,errorUtils,errors,logging}.ts`, `src/constants/oauth.ts`; OAuth: `src/services/oauth/{index,auth-code-listener,crypto,client,getOauthProfile}.ts`, `src/utils/secureStorage/**`, `src/utils/{authFileDescriptor,authPortable}.ts` | API: `getAnthropicClient`, `withRetry`, `extractConnectionErrorDetails`, `classifyAPIError`; OAuth: `OAuthService`, `AuthCodeListener`, `buildAuthUrl`, `exchangeCodeForTokens`, `refreshOAuthToken`, `getSecureStorage`, `maybePersistTokenForSubprocesses` | `src/utils/auth.ts`, `src/services/api/claude.ts`, missing `src/services/oauth/types.ts`, missing `src/utils/secureStorage/types.ts`, missing `src/constants/querySource.ts`, missing `src/types/message.ts` |
| `prompt input + REPL shell` | `prompt_input_core`, `terminal_text_input_primitives`, `terminal_message_primitives`, `wizard_shell_primitives`, `repl_shell` | `src/components/{BaseTextInput,TextInput,VimTextInput}.tsx`, `src/hooks/{useTextInput,useSearchInput,renderPlaceholder,usePasteHandler}.ts`, `src/components/PromptInput/{inputModes,PromptInputFooterSuggestions}.tsx`, `src/types/textInputTypes.ts` | `BaseTextInput`, `TextInput`, `VimTextInput`, `useTextInput`, `useSearchInput`, `PromptInputFooterSuggestions`, `REPL` | `PromptInput.tsx`, `Messages.tsx`, `Message.tsx`, `PermissionRequest.tsx`, `REPL.tsx` entier |

## Couplages transverses a surveiller
- `src/main.tsx`, `src/screens/REPL.tsx`, `src/utils/config.ts`, `src/utils/auth.ts`, `src/services/api/claude.ts`, `src/services/mcp/config.ts`, `src/utils/permissions/permissions.ts`, `src/utils/plugins/pluginLoader.ts` entier sont les centres de gravite qui font exploser la taille des extractions.
- Les contracts manquants dans la fuite sont de vrais blockers si vous essayez de copier trop haut dans la pile: `src/services/oauth/types.ts`, `src/utils/secureStorage/types.ts`, `src/constants/querySource.ts`, `src/types/message.ts`, `src/services/sessionTranscript/sessionTranscript.ts`.
- Les feature flags changent plusieurs chemins critiques. Les plus visibles dans cette passe: `TREE_SITTER_BASH_SHADOW`, `VOICE_MODE`, `TRANSCRIPT_CLASSIFIER`, `CLAUDE_CODE_SYNC_PLUGIN_INSTALL`, `CLAUDE_CODE_DISABLE_POLICY_SKILLS`.
- Quand un module melange runtime + UI, la meilleure extraction consiste presque toujours a:
  - garder les types/schemas/utilitaires purs tels quels
  - extraire 2 ou 3 fonctions centrales du gros orchestrateur
  - rebrancher localement auth, storage, logs et transport

## Shell safety rails

### Bash minimal
- Copier d'abord:
  - `src/utils/bash/**`
  - `src/tools/BashTool/readOnlyValidation.ts`
  - `src/tools/BashTool/pathValidation.ts`
  - `src/tools/BashTool/sedValidation.ts`
  - `src/tools/BashTool/sedEditParser.ts`
  - `src/tools/BashTool/modeValidation.ts`
  - `src/tools/BashTool/bashPermissions.ts`
- Symboles a regarder d'abord:
  - `src/tools/BashTool/bashPermissions.ts#bashPermissionRule`
  - `src/tools/BashTool/bashPermissions.ts#bashToolHasPermission`
  - `src/tools/BashTool/pathValidation.ts#checkPathConstraints`
- Point d'entree recommande: `bashToolHasPermission()`; c'est la vraie orchestration de parse, read-only, contraintes de chemin et matching de regles.
- Regle de copie: conserver l'ordre de decision "parse/normalisation -> read-only -> path constraints -> mode validation -> permission match". Si vous inversez `checkPathConstraints()` et le matching de regles, vous changez le comportement de deny/ask.
- Ne pas copier en premier:
  - `src/tools/BashTool/BashTool.tsx`
  - `src/tools/BashTool/shouldUseSandbox.ts`
  - `src/tools/BashTool/bashSecurity.ts` comme source unique de verite
- Raccourci de recherche:
```text
rg -n "bashPermissionRule|bashToolHasPermission|checkPathConstraints|bashCommandIsSafe_DEPRECATED|shouldUseSandbox" src/tools/BashTool
```

### PowerShell minimal
- Copier d'abord:
  - `src/utils/powershell/parser.ts`
  - `src/utils/powershell/dangerousCmdlets.ts`
  - `src/tools/PowerShellTool/readOnlyValidation.ts`
  - `src/tools/PowerShellTool/pathValidation.ts`
  - `src/tools/PowerShellTool/gitSafety.ts`
  - `src/tools/PowerShellTool/powershellPermissions.ts`
  - `src/tools/PowerShellTool/powershellSecurity.ts`
- Symboles a regarder d'abord:
  - `src/utils/powershell/parser.ts#parsePowerShellCommand`
  - `src/utils/powershell/parser.ts#deriveSecurityFlags`
  - `src/tools/PowerShellTool/powershellPermissions.ts#powershellPermissionRule`
  - `src/tools/PowerShellTool/powershellPermissions.ts#powershellToolHasPermission`
  - `src/tools/PowerShellTool/pathValidation.ts#checkPathConstraints`
  - `src/tools/PowerShellTool/powershellSecurity.ts#powershellCommandIsSafe`
- Point d'entree recommande: `powershellToolHasPermission()`; il fait volontairement les deny/ask rules avant la verification de parse, puis pousse les decisions de securite et de chemins sur l'AST parse une seule fois.
- Ne pas copier en premier:
  - `src/tools/PowerShellTool/PowerShellTool.tsx`
  - la politique sandbox Windows telle quelle
  - les wrappers UI de permission
- Couplage dangereux: `src/tools/PowerShellTool/powershellSecurity.ts` renvoie `ask` sur AST invalide; si vous retirez `parsePowerShellCommand()` ou la resolution case-insensitive, vous perdez le garde-fou le plus important.
- Raccourci de recherche:
```text
rg -n "parsePowerShellCommand|deriveSecurityFlags|powershellToolHasPermission|powershellCommandIsSafe|checkPathConstraints" src/utils/powershell src/tools/PowerShellTool
```

## Plugin loader
- Copier d'abord:
  - `src/utils/plugins/schemas.ts`
  - `src/utils/plugins/pluginIdentifier.ts`
  - `src/utils/plugins/pluginVersioning.ts`
  - `src/utils/plugins/dependencyResolver.ts`
  - extraction selective de `src/utils/plugins/pluginLoader.ts`
- Symboles a regarder d'abord:
  - `src/utils/plugins/pluginLoader.ts#loadPluginManifest`
  - `src/utils/plugins/pluginLoader.ts#createPluginFromPath`
  - `src/utils/plugins/pluginLoader.ts#mergePluginSources`
- Extensions optionnelles:
  - `src/utils/plugins/pluginDirectories.ts`
  - `src/utils/plugins/pluginOptionsStorage.ts`
  - `src/utils/plugins/walkPluginMarkdown.ts`
  - `src/utils/plugins/{mcpPluginIntegration,lspPluginIntegration}.ts`
- Ce que ces symboles vous donnent vraiment:
  - `loadPluginManifest()` gere le fallback sans `plugin.json`
  - `createPluginFromPath()` reconstruit un `LoadedPlugin` a partir du disque et autodetecte `commands/`, `agents/`, `skills/`, `output-styles/`
  - `mergePluginSources()` encode la precedence reelle: session `--plugin-dir` > marketplace > builtin, sauf verrouillage par managed settings
- Ne pas copier en premier:
  - `loadAllPlugins()` et `loadAllPluginsCacheOnly()` si vous ne voulez pas le runtime complet
  - `marketplaceManager.ts`
  - `zipCache.ts`
  - `installedPluginsManager.ts`
  - `PluginInstallationManager.ts`
  - `builtinPlugins.ts` si vous n'avez pas de builtin plugins
- Couplage dangereux: `mergePluginSources()` depend de la semantique "managed settings win over --plugin-dir". Si votre produit n'a pas cette policy, simplifiez explicitement ce point au lieu de garder un comportement incompris.
- Raccourci de recherche:
```text
rg -n "loadPluginManifest|createPluginFromPath|mergePluginSources|loadAllPlugins|loadPluginSettings" src/utils/plugins/pluginLoader.ts
```

## Skill loader
- Copier d'abord:
  - extraction selective de `src/skills/loadSkillsDir.ts`
  - `src/skills/bundledSkills.ts` si vous voulez un registre bundle
  - `src/skills/mcpSkillBuilders.ts` seulement si vous voulez des prompts MCP
  - `src/utils/frontmatterParser.ts`
  - `src/utils/markdownConfigLoader.ts`
  - `src/utils/argumentSubstitution.ts`
- Symboles a regarder d'abord:
  - `src/skills/loadSkillsDir.ts#getSkillsPath`
  - `src/skills/loadSkillsDir.ts#parseSkillFrontmatterFields`
  - `src/skills/loadSkillsDir.ts#createSkillCommand`
  - `src/skills/loadSkillsDir.ts#getSkillDirCommands`
  - `src/skills/loadSkillsDir.ts#getDynamicSkills`
  - `src/skills/bundledSkills.ts#getBundledSkills`
- Point d'entree recommande:
  - pour un loader disque pur: `getSkillDirCommands()`
  - pour transformer un markdown en commande: `parseSkillFrontmatterFields()` puis `createSkillCommand()`
- Couplages a eviter:
  - `src/tools/SkillTool/**`
  - analytics
  - `getAdditionalDirectoriesForClaudeMd()`
  - `executeShellCommandsInPrompt`
  - policy plugin-only si vous ne la reproduisez pas
- Point de vigilance: `bundledSkills.ts` depend de `getBundledSkillsRoot()` dans `src/utils/permissions/filesystem.ts`; le nonce de chemin est la defense qui evite les collisions/lectures squattees.
- Raccourci de recherche:
```text
rg -n "getSkillsPath|parseSkillFrontmatterFields|createSkillCommand|getSkillDirCommands|getDynamicSkills|getBundledSkills" src/skills
```

## MCP minimal
- Copier d'abord:
  - `src/services/mcp/types.ts`
  - `src/services/mcp/mcpStringUtils.ts`
  - `src/services/mcp/normalization.ts`
  - `src/services/mcp/envExpansion.ts`
  - extraction selective de `src/services/mcp/client.ts`
- Symboles a regarder d'abord:
  - `src/services/mcp/types.ts#McpServerConfigSchema`
  - `src/services/mcp/normalization.ts#normalizeNameForMCP`
  - `src/services/mcp/envExpansion.ts#expandEnvVarsInString`
  - `src/services/mcp/client.ts#wrapFetchWithTimeout`
  - `src/services/mcp/client.ts#connectToServer`
  - `src/services/mcp/client.ts#ensureConnectedClient`
  - `src/services/mcp/client.ts#fetchToolsForClient`
  - `src/services/mcp/client.ts#fetchResourcesForClient`
  - `src/services/mcp/client.ts#fetchCommandsForClient`
- Point d'entree recommande: construire un `client-minimal.ts` qui ne reprend que les branches `stdio`, `sse`, `http`, `ws` de `connectToServer()`.
- Pourquoi ces symboles:
  - `wrapFetchWithTimeout()` conserve les GET longue duree et injecte l'en-tete `Accept` attendu pour le streamable HTTP
  - `fetchToolsForClient()` / `fetchResourcesForClient()` / `fetchCommandsForClient()` donnent la plus petite discovery utile
  - `normalizeNameForMCP()` fixe le nommage `mcp__server__tool`
- Ne pas copier en premier:
  - `src/services/mcp/config.ts`
  - `src/services/mcp/auth.ts`
  - `src/services/mcp/useManageMCPConnections.ts`
  - `src/services/mcp/MCPConnectionManager.tsx`
  - `src/tools/{MCPTool,ListMcpResourcesTool,ReadMcpResourceTool}/**`
- Raccourci de recherche:
```text
rg -n "McpServerConfigSchema|normalizeNameForMCP|expandEnvVarsInString|wrapFetchWithTimeout|connectToServer|fetchToolsForClient|fetchResourcesForClient|fetchCommandsForClient" src/services/mcp
```

## Memory stack minimale
- Si vous voulez seulement une memoire locale indexable, ne partez pas de `memory_stack`; partez de `memdir_local_minimal`.
- Copier d'abord:
  - `src/memdir/paths.ts`
  - `src/memdir/memoryTypes.ts`
  - `src/memdir/memoryScan.ts`
  - `src/utils/frontmatterParser.ts`
  - `src/utils/readFileInRange.ts`
- Symboles a regarder d'abord:
  - `src/memdir/paths.ts#isAutoMemoryEnabled`
  - `src/memdir/paths.ts#getMemoryBaseDir`
  - `src/memdir/paths.ts#getAutoMemDailyLogPath`
  - `src/memdir/memoryScan.ts#scanMemoryFiles`
  - `src/memdir/memoryScan.ts#formatMemoryManifest`
  - `src/memdir/memoryTypes.ts#MEMORY_TYPES`
  - `src/memdir/memoryTypes.ts#parseMemoryType`
- Ajouter ensuite seulement si necessaire:
  - `src/memdir/memdir.ts`
  - `src/memdir/teamMemPaths.ts`
  - `src/services/teamMemorySync/**`
- Couplages a eviter:
  - `src/services/SessionMemory/sessionMemory.ts`
  - `src/services/extractMemories/extractMemories.ts`
  - team sync avant d'avoir OAuth/auth headers
- Point de vigilance: `paths.ts` depend de flags/settings (GrowthBook + `getInitialSettings()`); si vous voulez juste scanner un repertoire, remplacez cette logique par un resolver de chemin plus simple.
- Raccourci de recherche:
```text
rg -n "isAutoMemoryEnabled|getMemoryBaseDir|getAutoMemDailyLogPath|scanMemoryFiles|formatMemoryManifest|MEMORY_TYPES|parseMemoryType" src/memdir
```

## Settings / policy minimale
- Traitement recommande:
  - tranche 1: resolution multi-source des settings
  - tranche 2: validation et chargement des regles de permission
  - tranche 3: cache policy distant uniquement si vous avez deja auth
- Copier d'abord pour la tranche settings:
  - `src/utils/settings/{settings,constants,settingsCache,types,validation,managedPath,internalWrites}.ts`
  - `src/schemas/hooks.ts`
- Copier d'abord pour la tranche permission:
  - `src/utils/permissions/{filesystem,pathValidation,PermissionMode,permissionRuleParser,permissionsLoader}.ts`
  - `src/utils/settings/permissionValidation.ts`
- Symboles a regarder d'abord:
  - `src/utils/settings/settings.ts#getSettingsForSource`
  - `src/utils/settings/settings.ts#getPolicySettingsOrigin`
  - `src/utils/settings/settings.ts#settingsMergeCustomizer`
  - `src/utils/settings/settings.ts#getInitialSettings`
  - `src/utils/settings/settings.ts#getSettingsWithSources`
  - `src/utils/settings/settings.ts#getAutoModeConfig`
  - `src/utils/settings/permissionValidation.ts#validatePermissionRule`
  - `src/utils/permissions/permissionsLoader.ts#loadAllPermissionRulesFromDisk`
  - `src/utils/permissions/filesystem.ts#checkEditableInternalPath`
  - `src/utils/permissions/filesystem.ts#checkReadableInternalPath`
  - `src/services/policyLimits/index.ts#isPolicyAllowed`
- Point critique a ne pas perdre:
  - `policySettings` suit un ordre "first source wins": remote -> MDM/plist/HKLM -> managed file -> HKCU
  - le merge global des autres sources suit, lui, l'ordre habituel low -> high priority
- Couplages a purger:
  - les carve-outs internes dans `filesystem.ts` pour `session memory`, `scratchpad`, `project temp`, `auto memory`, `.claude/launch.json`, `bundled skills`
  - `permissions.ts` et `permissionSetup.ts` si vous ne reprenez pas l'auto-mode, les hooks et les tools Claude Code exacts
  - `remoteManagedSettings/securityCheck.tsx` si vous n'avez pas d'UI interactive
- Raccourci de recherche:
```text
rg -n "getSettingsForSource|getPolicySettingsOrigin|settingsMergeCustomizer|getInitialSettings|getSettingsWithSources|getAutoModeConfig" src/utils/settings/settings.ts
rg -n "validatePermissionRule|loadAllPermissionRulesFromDisk|checkEditableInternalPath|checkReadableInternalPath|isPolicyAllowed" src/utils/settings/permissionValidation.ts src/utils/permissions src/services/policyLimits/index.ts
```

## API client + OAuth

### API client minimal
- Copier d'abord:
  - `src/services/api/client.ts`
  - `src/services/api/withRetry.ts`
  - `src/services/api/errorUtils.ts`
  - `src/services/api/errors.ts`
  - `src/services/api/logging.ts`
  - `src/constants/oauth.ts`
- Symboles a regarder d'abord:
  - `src/services/api/client.ts#getAnthropicClient`
  - `src/services/api/client.ts#CLIENT_REQUEST_ID_HEADER`
  - `src/services/api/withRetry.ts#withRetry`
  - `src/services/api/withRetry.ts#getRetryDelay`
  - `src/services/api/withRetry.ts#categorizeRetryableAPIError`
  - `src/services/api/errorUtils.ts#extractConnectionErrorDetails`
  - `src/services/api/errors.ts#classifyAPIError`
- Point d'entree recommande:
  - `getAnthropicClient()` pour la fabrique provider-aware
  - `withRetry()` pour la boucle de backoff/fallback
- Couplages a eviter:
  - `src/services/api/claude.ts`
  - `src/utils/auth.ts`
  - `src/bootstrap/state.ts`
  - tout ce qui importe `src/constants/querySource.ts` ou `src/types/message.ts` sans les recreer

### OAuth minimal
- Copier d'abord:
  - `src/services/oauth/index.ts`
  - `src/services/oauth/auth-code-listener.ts`
  - `src/services/oauth/crypto.ts`
  - `src/services/oauth/client.ts`
  - `src/services/oauth/getOauthProfile.ts`
  - `src/constants/oauth.ts`
  - `src/utils/secureStorage/**`
  - `src/utils/authFileDescriptor.ts`
  - `src/utils/authPortable.ts`
- Symboles a regarder d'abord:
  - `src/services/oauth/index.ts#OAuthService`
  - `src/services/oauth/auth-code-listener.ts#AuthCodeListener`
  - `src/services/oauth/crypto.ts#generateCodeVerifier`
  - `src/services/oauth/crypto.ts#generateCodeChallenge`
  - `src/services/oauth/crypto.ts#generateState`
  - `src/services/oauth/client.ts#buildAuthUrl`
  - `src/services/oauth/client.ts#exchangeCodeForTokens`
  - `src/services/oauth/client.ts#refreshOAuthToken`
  - `src/services/oauth/client.ts#fetchProfileInfo`
  - `src/services/oauth/client.ts#getOrganizationUUID`
  - `src/services/oauth/client.ts#populateOAuthAccountInfoIfNeeded`
  - `src/utils/secureStorage/index.ts#getSecureStorage`
  - `src/utils/authFileDescriptor.ts#maybePersistTokenForSubprocesses`
  - `src/utils/authFileDescriptor.ts#getOAuthTokenFromFileDescriptor`
- Blockers a traiter explicitement:
  - `src/services/oauth/types.ts` manque
  - `src/utils/secureStorage/types.ts` manque
- Raccourci de recherche:
```text
rg -n "getAnthropicClient|withRetry|getRetryDelay|classifyAPIError" src/services/api
rg -n "OAuthService|AuthCodeListener|buildAuthUrl|exchangeCodeForTokens|refreshOAuthToken|getSecureStorage|maybePersistTokenForSubprocesses" src/services/oauth src/utils/secureStorage src/utils/authFileDescriptor.ts
```

## Prompt input + REPL shell
- Si vous voulez recuperer un vrai editeur de prompt, partez de `prompt_input_core`, pas de `REPL.tsx`.
- Copier d'abord:
  - `src/components/BaseTextInput.tsx`
  - `src/components/TextInput.tsx`
  - `src/components/VimTextInput.tsx`
  - `src/hooks/useTextInput.ts`
  - `src/hooks/useSearchInput.ts`
  - `src/hooks/renderPlaceholder.ts`
  - `src/hooks/usePasteHandler.ts`
  - `src/components/PromptInput/inputModes.ts`
  - `src/components/PromptInput/PromptInputFooterSuggestions.tsx`
  - `src/types/textInputTypes.ts`
- Symboles a regarder d'abord:
  - `src/components/BaseTextInput.tsx#BaseTextInput`
  - `src/components/TextInput.tsx#default`
  - `src/components/VimTextInput.tsx#default`
  - `src/hooks/useTextInput.ts#useTextInput`
  - `src/hooks/useSearchInput.ts#useSearchInput`
  - `src/components/PromptInput/PromptInputFooterSuggestions.tsx#PromptInputFooterSuggestions`
  - `src/screens/REPL.tsx#REPL`
- Assemblage recommande:
  - tranche 1: prompt input pur
  - tranche 2: messages UI (`MessageResponse`, `Markdown`, `useVirtualScroll`)
  - tranche 3: dialogs/wizards (`Dialog`, `WizardProvider`)
  - tranche 4: prendre `REPL.tsx` comme carte de composition, pas comme premier fichier copie
- Couplages a eviter:
  - `src/components/PromptInput/PromptInput.tsx`
  - `src/components/Messages.tsx`
  - `src/components/Message.tsx`
  - `src/components/permissions/PermissionRequest.tsx`
  - `src/screens/REPL.tsx` entier
- Pourquoi: `PromptInput.tsx` et `REPL.tsx` tirent MCP, teammates, quick-search, history, overlays, permission mode transitions, bridge, voice et hooks de session; la valeur reusable est en dessous, dans `BaseTextInput`, `useTextInput` et `useSearchInput`.
- Raccourci de recherche:
```text
rg -n "BaseTextInput|useTextInput|useSearchInput|PromptInputFooterSuggestions|PromptInput|REPL" src/components src/hooks src/screens/REPL.tsx
```

## Recommandations finales par difficulte
- Faible:
  - `portable_session_storage`
  - `memdir_local_minimal`
  - `plugin_manifest_schema`
  - `plugin_dependency_resolver`
  - `prompt_input_core`
- Moyenne:
  - `bash_safety_layer`
  - `powershell_safety_layer`
  - `plugin_loader_minimal`
  - `skill_loader_minimal`
  - `mcp_client_minimal`
  - `settings_merge_engine`
  - `permission_layer_minimal`
  - `api_client_minimal`
  - `oauth_pkce_flow`
  - `oauth_secure_storage`
- Haute:
  - `repl_shell`
  - `mcp_layer`
  - `memory_stack`
  - tout ce qui repart de `main.tsx`, `REPL.tsx`, `utils/auth.ts`, `permissions.ts` ou `api/claude.ts`
