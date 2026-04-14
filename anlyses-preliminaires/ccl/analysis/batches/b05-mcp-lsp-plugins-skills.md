---
batch_id: B05
title: MCP, LSP, plugins, skills
paths:
  - src/tools/MCPTool/**
  - src/tools/ReadMcpResourceTool/**
  - src/tools/ListMcpResourcesTool/**
  - src/tools/McpAuthTool/**
  - src/tools/LSPTool/**
  - src/tools/SkillTool/**
  - src/services/mcp/**
  - src/services/lsp/**
  - src/services/plugins/**
  - src/plugins/**
  - src/skills/**
  - src/outputStyles/**
priority: haute
status: enriched
keywords:
  - MCPConnectionManager
  - pluginLoader
  - loadSkillsDir
  - LSPServerManager
  - loadPluginMcpServers
  - loadPluginLspServers
---

# B05 - MCP, LSP, plugins, skills

## Resume
- Couverture: 140 fichiers / 51221 lignes.
- Sous-systemes dominants: `src/utils/plugins/**`, `src/services/mcp/**`, `src/skills/**`, `src/services/lsp/**`, `src/outputStyles/**`.
- Hubs reels pour reutilisation future:
  - `src/services/mcp/client.ts`
  - `src/services/mcp/config.ts`
  - `src/services/mcp/auth.ts`
  - `src/utils/plugins/pluginLoader.ts`
  - `src/utils/plugins/schemas.ts`
  - `src/skills/loadSkillsDir.ts`
  - `src/services/lsp/LSPClient.ts`
  - `src/services/lsp/LSPServerInstance.ts`
  - `src/services/lsp/LSPServerManager.ts`
- Conclusion de reutilisation:
  - le meilleur socle copiable en l'etat est surtout dans `src/utils/plugins/schemas.ts`, `src/utils/plugins/pluginIdentifier.ts`, `src/utils/plugins/pluginVersioning.ts`, `src/utils/plugins/dependencyResolver.ts`, `src/skills/bundledSkills.ts`, `src/outputStyles/loadOutputStylesDir.ts`, `src/services/lsp/LSPClient.ts`, `src/services/lsp/LSPServerInstance.ts`, `src/services/lsp/LSPServerManager.ts`
  - les gros fichiers `src/services/mcp/client.ts`, `src/services/mcp/auth.ts`, `src/services/mcp/config.ts`, `src/utils/plugins/pluginLoader.ts`, `src/skills/loadSkillsDir.ts` sont tres utiles, mais demandent une extraction selective plutot qu'un copier-coller brut
- Caveat de snapshot critique:
  - `src/services/lsp/types.ts` est importe par `src/services/lsp/LSPServerInstance.ts`, `src/services/lsp/LSPServerManager.ts`, `src/services/lsp/config.ts` et `src/utils/plugins/lspPluginIntegration.ts`, mais le fichier source n'est pas present dans ce snapshot et `analysis/manifests/import_graph.jsonl` le laisse en `resolved_target: null`
  - une extraction LSP litterale doit donc reconstruire `LspServerConfig`, `ScopedLspServerConfig` et `LspServerState`

## purpose
Ce batch couvre la surface d'extensibilite de Claude Code: connexions MCP, auth OAuth/XAA, chargement de plugins, ponts plugin -> MCP/LSP, chargement de skills utilisateur/bundle/MCP, styles de sortie et couches UI associees.

L'angle de reutilisation pertinent n'est pas "reprendre tout le runtime Claude Code", mais "extraire des tranches minimales":
- un client MCP multi-transport minimal
- un loader de plugins local/versionne
- un loader de skills fichier + bundle
- une integration LSP stdio multi-serveurs
- un loader d'output styles et, optionnellement, de hooks plugins

## entrypoints
- MCP runtime:
  - `src/services/mcp/client.ts`
  - `src/services/mcp/config.ts`
  - `src/services/mcp/auth.ts`
  - `src/services/mcp/useManageMCPConnections.ts`
- LSP runtime:
  - `src/services/lsp/LSPClient.ts`
  - `src/services/lsp/LSPServerInstance.ts`
  - `src/services/lsp/LSPServerManager.ts`
  - `src/services/lsp/manager.ts`
- Plugins:
  - `src/utils/plugins/pluginLoader.ts`
  - `src/utils/plugins/mcpPluginIntegration.ts`
  - `src/utils/plugins/lspPluginIntegration.ts`
  - `src/utils/plugins/loadPluginOutputStyles.ts`
  - `src/utils/plugins/loadPluginHooks.ts`
- Skills / output styles:
  - `src/skills/loadSkillsDir.ts`
  - `src/skills/bundledSkills.ts`
  - `src/outputStyles/loadOutputStylesDir.ts`

## key files
- MCP contracts and helpers:
  - `src/services/mcp/types.ts`
  - `src/services/mcp/mcpStringUtils.ts`
  - `src/services/mcp/normalization.ts`
  - `src/services/mcp/envExpansion.ts`
  - `src/services/mcp/headersHelper.ts`
- MCP heavy runtime:
  - `src/services/mcp/client.ts`
  - `src/services/mcp/config.ts`
  - `src/services/mcp/auth.ts`
  - `src/services/mcp/useManageMCPConnections.ts`
- LSP core:
  - `src/services/lsp/LSPClient.ts`
  - `src/services/lsp/LSPServerInstance.ts`
  - `src/services/lsp/LSPServerManager.ts`
  - `src/services/lsp/passiveFeedback.ts`
  - `src/services/lsp/LSPDiagnosticRegistry.ts`
- Plugin core:
  - `src/utils/plugins/schemas.ts`
  - `src/utils/plugins/pluginIdentifier.ts`
  - `src/utils/plugins/pluginVersioning.ts`
  - `src/utils/plugins/dependencyResolver.ts`
  - `src/utils/plugins/pluginLoader.ts`
  - `src/utils/plugins/pluginOptionsStorage.ts`
  - `src/utils/plugins/mcpPluginIntegration.ts`
  - `src/utils/plugins/lspPluginIntegration.ts`
- Skill core:
  - `src/skills/loadSkillsDir.ts`
  - `src/skills/bundledSkills.ts`
  - `src/skills/mcpSkillBuilders.ts`
- Output styles / hooks:
  - `src/outputStyles/loadOutputStylesDir.ts`
  - `src/utils/plugins/loadPluginOutputStyles.ts`
  - `src/utils/plugins/loadPluginHooks.ts`
- UI / wrappers only:
  - `src/tools/MCPTool/MCPTool.ts`
  - `src/tools/ListMcpResourcesTool/ListMcpResourcesTool.ts`
  - `src/tools/ReadMcpResourceTool/ReadMcpResourceTool.ts`
  - `src/tools/McpAuthTool/McpAuthTool.ts`
  - `src/tools/LSPTool/LSPTool.ts`
  - `src/tools/SkillTool/SkillTool.ts`
  - `src/components/mcp/**`
  - `src/components/MCPServerApprovalDialog.tsx`
  - `src/components/LspRecommendation/LspRecommendationMenu.tsx`
  - `src/components/DiagnosticsDisplay.tsx`
  - `src/components/OutputStylePicker.tsx`
  - `src/components/skills/SkillsMenu.tsx`

## data flow
- Plugin bootstrap:
  - `src/utils/plugins/pluginLoader.ts` construit l'ensemble enabled/disabled, dedupe, applique la policy et prepare les chemins de composants
  - les ponts `src/utils/plugins/mcpPluginIntegration.ts`, `src/utils/plugins/lspPluginIntegration.ts`, `src/utils/plugins/loadPluginOutputStyles.ts`, `src/utils/plugins/loadPluginCommands.ts`, `src/utils/plugins/loadPluginHooks.ts` extraient ensuite les sous-composants
- MCP:
  - `src/services/mcp/config.ts` fusionne config enterprise, user, project, local, plugin et `claude.ai`
  - `src/services/mcp/client.ts` ouvre les transports, recupere tools/resources/prompts et adapte les resultats
  - `src/services/mcp/useManageMCPConnections.ts` pousse l'etat dans `AppState` et gere la reconnexion UI
- LSP:
  - `src/services/lsp/config.ts` lit seulement les LSP venant des plugins
  - `src/services/lsp/LSPServerManager.ts` route les fichiers vers le bon serveur par extension
  - `src/services/lsp/passiveFeedback.ts` convertit `publishDiagnostics` en diagnostics Claude
- Skills:
  - `src/skills/loadSkillsDir.ts` charge les skills disque, parse le frontmatter et fabrique des `Command`
  - `src/skills/bundledSkills.ts` enregistre les skills embarquees et extrait au besoin leurs fichiers references
  - `src/tools/SkillTool/SkillTool.ts` est la couche runtime d'execution, pas le loader
- Output styles:
  - `src/outputStyles/loadOutputStylesDir.ts` charge les styles user/project
  - `src/utils/plugins/loadPluginOutputStyles.ts` ajoute les styles issus des plugins en namespace `plugin:style`

## external deps
- MCP:
  - `@modelcontextprotocol/sdk/client/*`
  - `@modelcontextprotocol/sdk/shared/*`
  - `@modelcontextprotocol/sdk/types.js`
- LSP:
  - `vscode-jsonrpc/node.js`
  - `vscode-languageserver-protocol`
- Plugins / schemas:
  - `zod/v4`
  - `lodash-es/memoize.js`
  - `ignore`
- MCP auth:
  - `axios`
  - `xss`
  - `crypto`
  - `http`

## flags/env
- MCP runtime:
  - `MCP_SKILLS` dans `src/services/mcp/client.ts` et `src/services/mcp/useManageMCPConnections.ts`
  - `CHICAGO_MCP` dans `src/services/mcp/client.ts` et `src/services/mcp/config.ts`
  - `KAIROS`, `KAIROS_CHANNELS` dans `src/services/mcp/useManageMCPConnections.ts` et `src/services/mcp/channelNotification.ts`
  - `MCP_RICH_OUTPUT` dans `src/tools/MCPTool/UI.tsx`
- Skills:
  - `EXPERIMENTAL_SKILL_SEARCH` dans `src/tools/SkillTool/SkillTool.ts`
  - `KAIROS`, `KAIROS_DREAM`, `REVIEW_ARTIFACT`, `AGENT_TRIGGERS`, `AGENT_TRIGGERS_REMOTE`, `BUILDING_CLAUDE_APPS`, `RUN_SKILL_GENERATOR` dans `src/skills/bundled/index.ts`
- Plugins / LSP:
  - pas de feature flag majeur sur le coeur du loader; l'essentiel des gates est dans settings/policy/marketplaces

## reusable ideas
- MCP:
  - reutiliser le contrat `McpServerConfigSchema` + helpers de nommage
  - extraire un `connectToServer` minimal multi-transport, sans AppState ni UI
  - garder OAuth/XAA comme addon optionnel
- Plugins:
  - reutiliser les schemas et l'identifiant `name@marketplace`
  - reutiliser la logique versionnee de cache
  - reutiliser les ponts plugin -> MCP et plugin -> LSP sans reprendre toute la marketplace
- Skills:
  - reutiliser `parseSkillFrontmatterFields` + `createSkillCommand`
  - reutiliser `bundledSkills.ts` comme registre embarque securise
- LSP:
  - reutiliser `LSPClient.ts`, `LSPServerInstance.ts`, `LSPServerManager.ts`
  - reconstruire `types.ts` manquant a partir du schema LSP
- Output styles:
  - `loadOutputStylesDir.ts` est deja une brique quasi autonome
  - `loadPluginOutputStyles.ts` est un bon addon si on garde un systeme de plugins

## reusable features
- `mcp_client_core`
  - fichiers: `src/services/mcp/types.ts`, `src/services/mcp/mcpStringUtils.ts`, `src/services/mcp/normalization.ts`, `src/services/mcp/envExpansion.ts`, extraction selective de `src/services/mcp/client.ts`
  - valeur: haute
  - coupling: haute
- `mcp_oauth_provider`
  - fichiers: `src/services/mcp/auth.ts`, `src/services/mcp/oauthPort.ts`, `src/services/mcp/xaa.ts`, `src/services/mcp/xaaIdpLogin.ts`
  - valeur: haute
  - coupling: haute
- `plugin_manifest_schema`
  - fichiers: `src/utils/plugins/schemas.ts`, `src/utils/plugins/pluginIdentifier.ts`
  - valeur: haute
  - coupling: faible
- `plugin_dependency_resolver`
  - fichiers: `src/utils/plugins/dependencyResolver.ts`, `src/utils/plugins/pluginIdentifier.ts`
  - valeur: haute
  - coupling: faible
- `plugin_mcp_integration`
  - fichiers: `src/utils/plugins/mcpPluginIntegration.ts`, `src/utils/plugins/pluginOptionsStorage.ts`, `src/utils/plugins/pluginDirectories.ts`
  - valeur: haute
  - coupling: moyenne
- `plugin_lsp_integration`
  - fichiers: `src/utils/plugins/lspPluginIntegration.ts`, `src/utils/plugins/pluginOptionsStorage.ts`, `src/utils/plugins/pluginDirectories.ts`
  - valeur: haute
  - coupling: moyenne
- `dynamic_skill_loader`
  - fichiers: `src/skills/loadSkillsDir.ts`, `src/skills/mcpSkillBuilders.ts`
  - valeur: haute
  - coupling: moyenne
- `bundled_skill_registry`
  - fichiers: `src/skills/bundledSkills.ts`
  - valeur: haute
  - coupling: faible
- `lsp_runtime_core`
  - fichiers: `src/services/lsp/LSPClient.ts`, `src/services/lsp/LSPServerInstance.ts`, `src/services/lsp/LSPServerManager.ts`
  - valeur: haute
  - coupling: faible a moyenne
- `output_style_loader`
  - fichiers: `src/outputStyles/loadOutputStylesDir.ts`, `src/utils/plugins/loadPluginOutputStyles.ts`
  - valeur: moyenne a haute
  - coupling: faible a moyenne

## copy risk
- `src/services/mcp/client.ts` est le point de couplage le plus fort de ce batch: MCP SDK + `AppState` + `Tool` runtime + analytics + proxy/mTLS + storage de resultats + UI tools.
- `src/services/mcp/auth.ts` depend du stockage securise, de l'ouverture navigateur, du callback localhost et de XAA.
- `src/services/mcp/config.ts` depend du cascadeur de settings Claude Code, des policies enterprise et de l'approbation `.mcp.json`.
- `src/utils/plugins/pluginLoader.ts` centralise marketplace, settings, builtins, cache, install state, policies et deduplication.
- `src/skills/loadSkillsDir.ts` est tres utile mais entremelant frontmatter, settings, analytics, execution shell inline, gitignore et dynamic discovery.
- `src/utils/plugins/loadPluginHooks.ts` depend directement du bootstrap state et du hot reload global.

## search hints
- `connectToServer`
- `getClaudeCodeMcpConfigs`
- `performMCPOAuthFlow`
- `createLSPServerManager`
- `loadAllPluginsCacheOnly`
- `loadPluginMcpServers`
- `loadPluginLspServers`
- `createSkillCommand`
- `registerBundledSkill`
- `getOutputStyleDirStyles`

## subdomains

### MCP config/loading/auth/connections/resources/tools
- Contracts:
  - `src/services/mcp/types.ts`
  - `src/services/mcp/mcpStringUtils.ts`
  - `src/services/mcp/normalization.ts`
  - `src/services/mcp/envExpansion.ts`
  - `src/services/mcp/headersHelper.ts`
- Config and policy:
  - `src/services/mcp/config.ts`
  - symboles: `dedupPluginMcpServers`, `filterMcpServersByPolicy`, `getProjectMcpConfigsFromCwd`, `getClaudeCodeMcpConfigs`, `getAllMcpConfigs`, `parseMcpConfig`, `shouldAllowManagedMcpServersOnly`, `setMcpServerEnabled`
- Runtime transports and discovery:
  - `src/services/mcp/client.ts`
  - symboles: `createClaudeAiProxyFetch`, `wrapFetchWithTimeout`, `connectToServer`, `ensureConnectedClient`, `fetchToolsForClient`, `fetchResourcesForClient`, `fetchCommandsForClient`, `getMcpToolsCommandsAndResources`, `processMCPResult`, `callMCPToolWithUrlElicitationRetry`, `setupSdkMcpClients`
- Auth:
  - `src/services/mcp/auth.ts`
  - symboles: `performMCPOAuthFlow`, `ClaudeAuthProvider`, `revokeServerTokens`, `wrapFetchWithStepUpDetection`
- React/app glue:
  - `src/services/mcp/useManageMCPConnections.ts`
  - `src/services/mcp/MCPConnectionManager.tsx`
- Tool wrappers:
  - `src/tools/MCPTool/MCPTool.ts`
  - `src/tools/ListMcpResourcesTool/ListMcpResourcesTool.ts`
  - `src/tools/ReadMcpResourceTool/ReadMcpResourceTool.ts`
  - `src/tools/McpAuthTool/McpAuthTool.ts`

### LSP manager/diagnostics/tooling
- Runtime core:
  - `src/services/lsp/LSPClient.ts`
  - `src/services/lsp/LSPServerInstance.ts`
  - `src/services/lsp/LSPServerManager.ts`
- Startup/singleton wrapper:
  - `src/services/lsp/manager.ts`
- Diagnostics bridge:
  - `src/services/lsp/passiveFeedback.ts`
  - `src/services/lsp/LSPDiagnosticRegistry.ts`
- Tool wrapper:
  - `src/tools/LSPTool/LSPTool.ts`
  - helpers: `src/tools/LSPTool/schemas.ts`, `src/tools/LSPTool/formatters.ts`, `src/tools/LSPTool/symbolContext.ts`, `src/tools/LSPTool/UI.tsx`
- Snapshot issue:
  - `src/services/lsp/types.ts` manque; les signatures dans `LSPServerInstance.ts`, `LSPServerManager.ts` et `src/utils/plugins/schemas.ts` suffisent toutefois a reconstruire les types

### plugin loader/versioning/cache/policy
- Contracts and ids:
  - `src/utils/plugins/schemas.ts`
  - `src/utils/plugins/pluginIdentifier.ts`
  - `src/utils/plugins/pluginVersioning.ts`
  - `src/utils/plugins/dependencyResolver.ts`
- Main loader:
  - `src/utils/plugins/pluginLoader.ts`
  - symboles: `getVersionedCachePathIn`, `copyPluginToVersionedCache`, `installFromNpm`, `gitClone`, `cachePlugin`, `loadPluginManifest`, `createPluginFromPath`, `mergePluginSources`, `loadAllPlugins`, `loadAllPluginsCacheOnly`, `cachePluginSettings`
- Policy/state/orchestration:
  - `src/utils/plugins/pluginPolicy.ts`
  - `src/utils/plugins/installedPluginsManager.ts`
  - `src/services/plugins/pluginCliCommands.ts`
  - `src/services/plugins/PluginInstallationManager.ts`
  - `src/utils/plugins/marketplaceManager.ts`
  - `src/utils/plugins/zipCache.ts`
- Important practical note:
  - `src/plugins/builtinPlugins.ts` est un registre, mais `src/plugins/bundled/index.ts` ne declare actuellement aucun builtin plugin. Cette couche est optionnelle pour une extraction.

### skill loading/bundled skills/custom skills
- File-based loader:
  - `src/skills/loadSkillsDir.ts`
  - symboles: `getSkillsPath`, `parseSkillFrontmatterFields`, `createSkillCommand`, `getSkillDirCommands`, `discoverSkillDirsForPaths`, `addSkillDirectories`, `activateConditionalSkillsForPaths`, `getDynamicSkills`
- Bundled registry:
  - `src/skills/bundledSkills.ts`
  - symboles: `registerBundledSkill`, `getBundledSkills`, `getBundledSkillExtractDir`
- MCP bridge:
  - `src/skills/mcpSkillBuilders.ts`
  - symboles: `registerMCPSkillBuilders`, `getMCPSkillBuilders`
- Runtime wrapper only:
  - `src/tools/SkillTool/SkillTool.ts`
  - symboles: `getAllCommands`, `executeForkedSkill`, `executeRemoteSkill`
- Bundled registry bootstrap:
  - `src/skills/bundled/index.ts`

### output styles and hooks
- Output style loader from user/project:
  - `src/outputStyles/loadOutputStylesDir.ts`
  - symboles: `getOutputStyleDirStyles`, `clearOutputStyleCaches`
- Plugin output styles:
  - `src/utils/plugins/loadPluginOutputStyles.ts`
  - symboles: `loadPluginOutputStyles`, `clearPluginOutputStyleCache`
- Hooks:
  - `src/utils/plugins/loadPluginHooks.ts`
  - symboles: `loadPluginHooks`, `pruneRemovedPluginHooks`, `setupPluginHookHotReload`
- Recommendation:
  - output styles sont de bonnes briques reutilisables
  - hooks plugins sont plutot un addon Claude Code, pas un socle minimal

## feature inventory

| Subfeature | Fichiers exacts | Symboles exacts | Reuse | Coupling | Notes d'extraction |
| --- | --- | --- | --- | --- | --- |
| MCP contracts | `src/services/mcp/types.ts`, `src/services/mcp/mcpStringUtils.ts`, `src/services/mcp/normalization.ts` | `McpServerConfigSchema`, `ScopedMcpServerConfig`, `buildMcpToolName`, `getMcpPrefix`, `normalizeNameForMCP` | haute | faible | Coeur de typage et nommage, tres copiable |
| MCP config merge | `src/services/mcp/config.ts` | `dedupPluginMcpServers`, `filterMcpServersByPolicy`, `getClaudeCodeMcpConfigs`, `parseMcpConfig`, `setMcpServerEnabled` | haute | haute | Utile si on veut exactement la cascade Claude Code |
| MCP auth | `src/services/mcp/auth.ts`, `src/services/mcp/oauthPort.ts`, `src/services/mcp/xaa.ts` | `performMCPOAuthFlow`, `ClaudeAuthProvider`, `revokeServerTokens`, `performCrossAppAccess` | haute | haute | A garder en addon, pas dans le MVP |
| MCP transport client | `src/services/mcp/client.ts` | `connectToServer`, `ensureConnectedClient`, `fetchToolsForClient`, `fetchResourcesForClient`, `fetchCommandsForClient`, `processMCPResult` | haute | haute | Extraire selectivement, pas copier integralement |
| MCP resource tools | `src/tools/ListMcpResourcesTool/ListMcpResourcesTool.ts`, `src/tools/ReadMcpResourceTool/ReadMcpResourceTool.ts` | `ListMcpResourcesTool`, `ReadMcpResourceTool` | moyenne | moyenne | Wrappers Claude Tool, pas coeur MCP |
| LSP runtime core | `src/services/lsp/LSPClient.ts`, `src/services/lsp/LSPServerInstance.ts`, `src/services/lsp/LSPServerManager.ts` | `createLSPClient`, `createLSPServerInstance`, `createLSPServerManager` | haute | faible a moyenne | Meilleure tranche whole-file de ce batch |
| LSP diagnostics bridge | `src/services/lsp/passiveFeedback.ts`, `src/services/lsp/LSPDiagnosticRegistry.ts` | `registerLSPNotificationHandlers`, `formatDiagnosticsForAttachment`, `registerPendingLSPDiagnostic` | moyenne | moyenne | Reutilisable si on garde un systeme d'attachments async |
| LSP tool adapter | `src/tools/LSPTool/LSPTool.ts`, `src/tools/LSPTool/formatters.ts`, `src/tools/LSPTool/schemas.ts` | `LSPTool`, `formatGoToDefinitionResult`, `lspToolInputSchema` | moyenne | moyenne | Bon adaptateur UI, pas necessaire au runtime LSP |
| Plugin schemas | `src/utils/plugins/schemas.ts` | `PluginManifestSchema`, `PluginSourceSchema`, `LspServerConfigSchema`, `InstalledPluginsFileSchemaV2` | haute | faible | La brique la plus reusable du lot |
| Plugin id/version/deps | `src/utils/plugins/pluginIdentifier.ts`, `src/utils/plugins/pluginVersioning.ts`, `src/utils/plugins/dependencyResolver.ts` | `parsePluginIdentifier`, `buildPluginId`, `calculatePluginVersion`, `resolveDependencyClosure`, `verifyAndDemote` | haute | faible | Excellent socle de loader custom |
| Plugin main loader | `src/utils/plugins/pluginLoader.ts` | `loadPluginManifest`, `createPluginFromPath`, `mergePluginSources`, `loadAllPlugins`, `loadAllPluginsCacheOnly` | haute | haute | Hub central mais dense en settings/marketplace |
| Plugin -> MCP | `src/utils/plugins/mcpPluginIntegration.ts` | `loadPluginMcpServers`, `resolvePluginMcpEnvironment`, `getPluginMcpServers`, `extractMcpServersFromPlugins` | haute | moyenne | Tres bon pont autonome si on garde `pluginOptionsStorage.ts` |
| Plugin -> LSP | `src/utils/plugins/lspPluginIntegration.ts` | `loadPluginLspServers`, `resolvePluginLspEnvironment`, `getPluginLspServers`, `extractLspServersFromPlugins` | haute | moyenne | Meme remarque que MCP, avec trou sur `types.ts` |
| Plugin hooks | `src/utils/plugins/loadPluginHooks.ts` | `loadPluginHooks`, `pruneRemovedPluginHooks`, `setupPluginHookHotReload` | moyenne | haute | Fortement branche au bootstrap/runtime |
| Plugin output styles | `src/utils/plugins/loadPluginOutputStyles.ts` | `loadPluginOutputStyles`, `clearPluginOutputStyleCache` | moyenne a haute | moyenne | Propre, tres bon addon a un loader de plugins |
| File-based skills | `src/skills/loadSkillsDir.ts` | `parseSkillFrontmatterFields`, `createSkillCommand`, `getSkillDirCommands`, `discoverSkillDirsForPaths` | haute | moyenne | Tres riche, mais a alleger pour un socle minimal |
| Bundled skill registry | `src/skills/bundledSkills.ts` | `registerBundledSkill`, `getBundledSkills`, `getBundledSkillExtractDir` | haute | faible | Une des meilleures briques direct-copy |
| Output styles dir | `src/outputStyles/loadOutputStylesDir.ts` | `getOutputStyleDirStyles`, `clearOutputStyleCaches` | haute | faible | Loader simple et reutilisable |

## symbol map

### MCP
- `ConfigScopeSchema`, `TransportSchema`, `McpServerConfigSchema`, `ScopedMcpServerConfig` in `src/services/mcp/types.ts`
- `mcpInfoFromString`, `getMcpPrefix`, `buildMcpToolName`, `getToolNameForPermissionCheck` in `src/services/mcp/mcpStringUtils.ts`
- `normalizeNameForMCP` in `src/services/mcp/normalization.ts`
- `expandEnvVarsInString` in `src/services/mcp/envExpansion.ts`
- `getMcpServerHeaders` in `src/services/mcp/headersHelper.ts`
- `connectToServer`, `ensureConnectedClient`, `fetchToolsForClient`, `fetchResourcesForClient`, `fetchCommandsForClient`, `getMcpToolsCommandsAndResources`, `processMCPResult`, `setupSdkMcpClients` in `src/services/mcp/client.ts`
- `dedupPluginMcpServers`, `filterMcpServersByPolicy`, `getProjectMcpConfigsFromCwd`, `getClaudeCodeMcpConfigs`, `parseMcpConfig`, `setMcpServerEnabled` in `src/services/mcp/config.ts`
- `performMCPOAuthFlow`, `ClaudeAuthProvider`, `revokeServerTokens`, `wrapFetchWithStepUpDetection` in `src/services/mcp/auth.ts`
- `loadPluginMcpServers`, `resolvePluginMcpEnvironment`, `getPluginMcpServers` in `src/utils/plugins/mcpPluginIntegration.ts`

### LSP
- `createLSPClient` in `src/services/lsp/LSPClient.ts`
- `createLSPServerInstance`, `LSPServerInstance` in `src/services/lsp/LSPServerInstance.ts`
- `createLSPServerManager`, `LSPServerManager` in `src/services/lsp/LSPServerManager.ts`
- `initializeLspServerManager`, `reinitializeLspServerManager`, `shutdownLspServerManager`, `waitForInitialization` in `src/services/lsp/manager.ts`
- `registerLSPNotificationHandlers`, `formatDiagnosticsForAttachment` in `src/services/lsp/passiveFeedback.ts`
- `registerPendingLSPDiagnostic`, `checkForLSPDiagnostics`, `clearAllLSPDiagnostics` in `src/services/lsp/LSPDiagnosticRegistry.ts`
- `LSPTool`, `lspToolInputSchema`, `formatGoToDefinitionResult`, `formatWorkspaceSymbolResult`, `getSymbolAtPosition` in `src/tools/LSPTool/**`

### Plugins
- `PluginManifestSchema`, `PluginSourceSchema`, `PluginHooksSchema`, `LspServerConfigSchema`, `InstalledPluginsFileSchemaV2` in `src/utils/plugins/schemas.ts`
- `parsePluginIdentifier`, `buildPluginId`, `scopeToSettingSource`, `settingSourceToScope` in `src/utils/plugins/pluginIdentifier.ts`
- `calculatePluginVersion`, `getGitCommitSha`, `getVersionFromPath`, `isVersionedPath` in `src/utils/plugins/pluginVersioning.ts`
- `qualifyDependency`, `resolveDependencyClosure`, `verifyAndDemote`, `findReverseDependents` in `src/utils/plugins/dependencyResolver.ts`
- `cachePlugin`, `loadPluginManifest`, `createPluginFromPath`, `mergePluginSources`, `loadAllPlugins`, `loadAllPluginsCacheOnly`, `clearPluginCache` in `src/utils/plugins/pluginLoader.ts`
- `loadPluginOptions`, `substitutePluginVariables`, `substituteUserConfigVariables`, `substituteUserConfigInContent` in `src/utils/plugins/pluginOptionsStorage.ts`
- `loadPluginMcpServers`, `resolvePluginMcpEnvironment`, `extractMcpServersFromPlugins`, `getPluginMcpServers` in `src/utils/plugins/mcpPluginIntegration.ts`
- `loadPluginLspServers`, `resolvePluginLspEnvironment`, `extractLspServersFromPlugins`, `getPluginLspServers` in `src/utils/plugins/lspPluginIntegration.ts`
- `loadPluginOutputStyles` in `src/utils/plugins/loadPluginOutputStyles.ts`
- `loadPluginHooks`, `setupPluginHookHotReload` in `src/utils/plugins/loadPluginHooks.ts`

### Skills / output styles
- `getSkillsPath`, `estimateSkillFrontmatterTokens`, `parseSkillFrontmatterFields`, `createSkillCommand`, `getSkillDirCommands`, `discoverSkillDirsForPaths`, `addSkillDirectories`, `activateConditionalSkillsForPaths`, `getDynamicSkills` in `src/skills/loadSkillsDir.ts`
- `registerBundledSkill`, `getBundledSkills`, `getBundledSkillExtractDir` in `src/skills/bundledSkills.ts`
- `registerMCPSkillBuilders`, `getMCPSkillBuilders` in `src/skills/mcpSkillBuilders.ts`
- `getOutputStyleDirStyles`, `clearOutputStyleCaches` in `src/outputStyles/loadOutputStylesDir.ts`

## dependency map
- `src/services/mcp/client.ts`: external `@modelcontextprotocol/sdk/*`, `p-map`, `bun:bundle`; internal `src/state/AppState.tsx`, `src/Tool.ts`, `src/services/mcp/auth.ts`, `src/services/mcp/config.ts`, `src/tools/*Mcp*`, `src/utils/mcpOutputStorage.ts`, `src/utils/toolResultStorage.ts`, `src/utils/proxy.ts`, `src/utils/mtls.ts`, `src/utils/sessionIngressAuth.ts`; extraction impact: tres haut
- `src/services/mcp/auth.ts`: external MCP auth SDK, `axios`, `http`, `crypto`, `xss`; internal `src/utils/secureStorage/**`, `src/utils/browser.ts`, `src/services/analytics/index.ts`, `src/services/mcp/oauthPort.ts`, `src/services/mcp/xaa.ts`; extraction impact: haut
- `src/services/mcp/config.ts`: internal settings cascade, plugin bridge `src/utils/plugins/mcpPluginIntegration.ts`, `src/utils/plugins/pluginLoader.ts`, `src/services/mcp/utils.ts`, `src/services/mcp/envExpansion.ts`; extraction impact: haut
- `src/services/mcp/useManageMCPConnections.ts`: depends on `src/state/AppState.tsx`, React hooks, notifications context, analytics, channel relay, `src/services/mcp/client.ts`, `src/services/mcp/config.ts`; extraction impact: runtime glue only
- `src/services/lsp/LSPClient.ts`: external `child_process`, `vscode-jsonrpc/node.js`, `vscode-languageserver-protocol`; internal only `src/utils/debug.ts`, `src/utils/errors.ts`, `src/utils/log.ts`, `src/utils/subprocessEnv.ts`; extraction impact: faible
- `src/services/lsp/LSPServerInstance.ts`: internal `src/services/lsp/LSPClient.ts`, `src/utils/cwd.ts`, `src/utils/sleep.ts`, missing `src/services/lsp/types.ts`; extraction impact: faible a moyenne
- `src/services/lsp/LSPServerManager.ts`: internal `src/services/lsp/config.ts`, `src/services/lsp/LSPServerInstance.ts`, missing `src/services/lsp/types.ts`; extraction impact: faible si on remplace `config.ts`
- `src/services/lsp/config.ts`: depends on `src/utils/plugins/pluginLoader.ts` and `src/utils/plugins/lspPluginIntegration.ts`; extraction impact: haute si on veut garder la source plugin native
- `src/utils/plugins/pluginLoader.ts`: depends on `src/plugins/builtinPlugins.ts`, settings cache, install state, marketplace manager, zip cache, telemetry, dependency resolver; import graph confirme qu'il est consomme par `loadPluginCommands.ts`, `loadPluginHooks.ts`, `loadPluginOutputStyles.ts`, `loadPluginAgents.ts`, `refresh.ts`, `PluginInstallationManager.ts`; extraction impact: haut
- `src/utils/plugins/mcpPluginIntegration.ts`: depends on `src/services/mcp/types.ts`, `src/services/mcp/envExpansion.ts`, `src/utils/plugins/pluginOptionsStorage.ts`, `src/utils/plugins/pluginDirectories.ts`, `src/utils/plugins/mcpbHandler.ts`; extraction impact: moyenne
- `src/utils/plugins/lspPluginIntegration.ts`: depends on `src/utils/plugins/schemas.ts`, `src/utils/plugins/pluginOptionsStorage.ts`, `src/utils/plugins/pluginDirectories.ts`, `src/services/mcp/envExpansion.ts`, missing `src/services/lsp/types.ts`; extraction impact: moyenne
- `src/skills/loadSkillsDir.ts`: depends on bootstrap state, analytics, settings, gitignore, frontmatter parser, markdown config loader, prompt shell execution, model parsing, signal; import graph montre aussi un cycle voulu avec `src/skills/mcpSkillBuilders.ts`; extraction impact: moyenne a haute
- `src/skills/bundledSkills.ts`: depends surtout de `src/utils/permissions/filesystem.ts` pour le root d'extraction et de types `Command` / `ToolUseContext`; extraction impact: faible
- `src/outputStyles/loadOutputStylesDir.ts`: depends on `src/utils/frontmatterParser.ts`, `src/utils/markdownConfigLoader.ts`, `src/utils/plugins/loadPluginOutputStyles.ts`; extraction impact: faible
- `src/utils/plugins/loadPluginHooks.ts`: depends on `../../bootstrap/state.ts` et sur le detecteur de changements settings; extraction impact: haute, a traiter comme addon runtime

## central vs optional modules

### Modules centraux pour un socle reutilisable
- MCP:
  - `src/services/mcp/types.ts`
  - `src/services/mcp/mcpStringUtils.ts`
  - `src/services/mcp/normalization.ts`
  - `src/services/mcp/envExpansion.ts`
- LSP:
  - `src/services/lsp/LSPClient.ts`
  - `src/services/lsp/LSPServerInstance.ts`
  - `src/services/lsp/LSPServerManager.ts`
- Plugins:
  - `src/utils/plugins/schemas.ts`
  - `src/utils/plugins/pluginIdentifier.ts`
  - `src/utils/plugins/pluginVersioning.ts`
  - `src/utils/plugins/dependencyResolver.ts`
  - `src/utils/plugins/pluginOptionsStorage.ts`
  - `src/utils/plugins/mcpPluginIntegration.ts`
  - `src/utils/plugins/lspPluginIntegration.ts`
- Skills / styles:
  - `src/skills/loadSkillsDir.ts`
  - `src/skills/bundledSkills.ts`
  - `src/skills/mcpSkillBuilders.ts`
  - `src/outputStyles/loadOutputStylesDir.ts`

### Modules optionnels mais utiles
- `src/services/mcp/auth.ts`
- `src/services/mcp/oauthPort.ts`
- `src/services/mcp/headersHelper.ts`
- `src/utils/plugins/loadPluginOutputStyles.ts`
- `src/utils/plugins/loadPluginCommands.ts`
- `src/services/lsp/passiveFeedback.ts`
- `src/services/lsp/LSPDiagnosticRegistry.ts`
- `src/plugins/builtinPlugins.ts`
- `src/services/plugins/pluginCliCommands.ts`

### Modules purement UI ou presentation
- MCP UI:
  - `src/components/mcp/MCPSettings.tsx`
  - `src/components/mcp/MCPListPanel.tsx`
  - `src/components/mcp/MCPToolListView.tsx`
  - `src/components/mcp/MCPToolDetailView.tsx`
  - `src/components/mcp/ElicitationDialog.tsx`
  - `src/components/mcp/MCPReconnect.tsx`
  - `src/components/MCPServerApprovalDialog.tsx`
- LSP / diagnostics UI:
  - `src/components/LspRecommendation/LspRecommendationMenu.tsx`
  - `src/components/DiagnosticsDisplay.tsx`
- Skills / output style UI:
  - `src/components/skills/SkillsMenu.tsx`
  - `src/components/OutputStylePicker.tsx`
- Tool UIs:
  - `src/tools/MCPTool/UI.tsx`
  - `src/tools/ListMcpResourcesTool/UI.tsx`
  - `src/tools/ReadMcpResourceTool/UI.tsx`
  - `src/tools/LSPTool/UI.tsx`
  - `src/tools/SkillTool/UI.tsx`

### Modules fortement couples au runtime Claude Code
- `src/services/mcp/client.ts`
- `src/services/mcp/auth.ts`
- `src/services/mcp/config.ts`
- `src/services/mcp/useManageMCPConnections.ts`
- `src/services/mcp/MCPConnectionManager.tsx`
- `src/services/lsp/config.ts`
- `src/services/lsp/manager.ts`
- `src/services/lsp/passiveFeedback.ts`
- `src/utils/plugins/pluginLoader.ts`
- `src/utils/plugins/loadPluginHooks.ts`
- `src/utils/plugins/marketplaceManager.ts`
- `src/tools/MCPTool/**`
- `src/tools/LSPTool/**`
- `src/tools/SkillTool/**`

## minimal reusable slices

### MCP client minimal
- Fichiers a copier tels quels:
  - `src/services/mcp/types.ts`
  - `src/services/mcp/mcpStringUtils.ts`
  - `src/services/mcp/normalization.ts`
  - `src/services/mcp/envExpansion.ts`
- Fichiers a copier en option:
  - `src/services/mcp/headersHelper.ts`
  - `src/services/mcp/oauthPort.ts`
- Fichier a extraire selectivement, pas a copier brut:
  - `src/services/mcp/client.ts`
- Symboles a lever de `src/services/mcp/client.ts` pour un client minimal:
  - `wrapFetchWithTimeout`
  - `connectToServer`
  - `ensureConnectedClient`
  - `fetchToolsForClient`
  - `fetchResourcesForClient`
  - `fetchCommandsForClient`
- Ne pas copier pour un MVP:
  - `src/tools/MCPTool/**`
  - `src/tools/ListMcpResourcesTool/**`
  - `src/tools/ReadMcpResourceTool/**`
  - `src/tools/McpAuthTool/**`
  - `src/services/mcp/useManageMCPConnections.ts`
  - `src/services/mcp/MCPConnectionManager.tsx`
  - `src/services/mcp/config.ts` si vous ne voulez pas la cascade Claude Code

### Plugin loader minimal
- Fichiers a copier tels quels:
  - `src/utils/plugins/schemas.ts`
  - `src/utils/plugins/pluginIdentifier.ts`
  - `src/utils/plugins/pluginVersioning.ts`
  - `src/utils/plugins/dependencyResolver.ts`
- Fichiers a copier si vous gardez un cache versionne et des variables plugin:
  - `src/utils/plugins/pluginDirectories.ts`
  - `src/utils/plugins/pluginOptionsStorage.ts`
  - `src/utils/plugins/walkPluginMarkdown.ts`
- Fichier a extraire selectivement:
  - `src/utils/plugins/pluginLoader.ts`
- Symboles minimum a recuperer depuis `pluginLoader.ts`:
  - `loadPluginManifest`
  - `createPluginFromPath`
  - `mergePluginSources`
- A laisser de cote pour un loader minimal:
  - `src/utils/plugins/marketplaceManager.ts`
  - `src/utils/plugins/zipCache.ts`
  - `src/utils/plugins/installedPluginsManager.ts`
  - `src/services/plugins/pluginCliCommands.ts`
  - `src/services/plugins/PluginInstallationManager.ts`
  - `src/plugins/builtinPlugins.ts` si vous n'avez pas de builtin plugins

### Skill loader minimal
- Fichiers a copier tels quels:
  - `src/skills/bundledSkills.ts`
  - `src/skills/mcpSkillBuilders.ts`
- Fichier a extraire selectivement:
  - `src/skills/loadSkillsDir.ts`
- Symboles minimum a recuperer depuis `loadSkillsDir.ts`:
  - `getSkillsPath`
  - `parseSkillFrontmatterFields`
  - `createSkillCommand`
  - `getSkillDirCommands`
- Helpers transverses a garder si vous reprenez le loader complet:
  - `src/utils/frontmatterParser.ts`
  - `src/utils/markdownConfigLoader.ts`
  - `src/utils/argumentSubstitution.ts`
  - `src/utils/model/model.ts`
  - `src/utils/effort.ts`
  - `src/utils/signal.ts`
- A laisser de cote pour un loader minimal:
  - `src/tools/SkillTool/**`
  - analytics, policy plugin-only, execution shell inline, dynamic discovery si non necessaires

### LSP integration minimale
- Fichiers a copier tels quels:
  - `src/services/lsp/LSPClient.ts`
  - `src/services/lsp/LSPServerInstance.ts`
  - `src/services/lsp/LSPServerManager.ts`
- Types a recreer localement car absents du snapshot:
  - `LspServerState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'`
  - `LspServerConfig` reconstruit depuis `src/utils/plugins/schemas.ts`
  - `ScopedLspServerConfig = LspServerConfig & { scope: string; pluginSource?: string }`
- Fichiers optionnels:
  - `src/services/lsp/passiveFeedback.ts`
  - `src/services/lsp/LSPDiagnosticRegistry.ts`
  - `src/tools/LSPTool/formatters.ts`
  - `src/tools/LSPTool/schemas.ts`
- A ne pas reprendre dans un socle minimal:
  - `src/services/lsp/config.ts` si vous ne voulez pas lier LSP au systeme de plugins
  - `src/services/lsp/manager.ts` si un singleton global n'est pas souhaitable

## extraction recipes

### MCP minimal
1. Copier `src/services/mcp/types.ts`, `src/services/mcp/mcpStringUtils.ts`, `src/services/mcp/normalization.ts`, `src/services/mcp/envExpansion.ts`.
2. Creer un `client-minimal.ts` en repartant uniquement des branches utiles de `connectToServer` dans `src/services/mcp/client.ts`:
   - garder `stdio`, `sse`, `http`, `ws`
   - retirer `sdk`, `claudeai-proxy`, Chrome/Computer Use, stockage d'outputs, analytics, AppState
3. Garder `wrapFetchWithTimeout`, `fetchToolsForClient`, `fetchResourcesForClient`, `fetchCommandsForClient`.
4. Ajouter `src/services/mcp/headersHelper.ts` uniquement si vous utilisez `headersHelper`.
5. Ajouter `src/services/mcp/auth.ts` seulement si vous avez besoin d'OAuth.
6. Reimplementer votre propre parser de config autour de `McpServerConfigSchema` au lieu de reprendre `src/services/mcp/config.ts`.

### Plugin loader minimal
1. Copier `src/utils/plugins/schemas.ts`, `src/utils/plugins/pluginIdentifier.ts`, `src/utils/plugins/pluginVersioning.ts`, `src/utils/plugins/dependencyResolver.ts`.
2. Extraire de `src/utils/plugins/pluginLoader.ts` seulement `loadPluginManifest` et `createPluginFromPath`.
3. Supprimer de ce fork minimal les branches marketplace, zip cache, builtins, install state et startup checks.
4. Si vous voulez des variables `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` / `${user_config.*}`, ajouter `src/utils/plugins/pluginDirectories.ts` et `src/utils/plugins/pluginOptionsStorage.ts`.
5. Ajouter `src/utils/plugins/mcpPluginIntegration.ts` et `src/utils/plugins/lspPluginIntegration.ts` comme bridges optionnels, pas comme prerequis du loader.

### Skill loader minimal
1. Reprendre `parseSkillFrontmatterFields` et `createSkillCommand` de `src/skills/loadSkillsDir.ts`.
2. Garder `getSkillDirCommands` seulement si vous voulez le chargement disque complet.
3. Remplacer les dependances Claude Code les moins portables:
   - analytics
   - `getAdditionalDirectoriesForClaudeMd`
   - `executeShellCommandsInPrompt`
   - policy plugin-only
4. Copier `src/skills/bundledSkills.ts` tel quel si vous voulez un registre de skills bundle et une extraction securisee des fichiers de reference.
5. Ajouter `src/skills/mcpSkillBuilders.ts` uniquement si vous voulez des skills venant de MCP.

### LSP integration minimale
1. Copier `src/services/lsp/LSPClient.ts`, `src/services/lsp/LSPServerInstance.ts`, `src/services/lsp/LSPServerManager.ts`.
2. Reconstituer `types.ts` manquant a partir de `src/utils/plugins/schemas.ts` et des signatures d'instance/manager.
3. Remplacer `src/services/lsp/config.ts` par une simple injection de config `Record<string, ScopedLspServerConfig>`.
4. Garder le routing par extension de `LSPServerManager.ts`.
5. Ajouter `src/services/lsp/passiveFeedback.ts` uniquement si vous avez deja une file d'attachments/diagnostics.
6. Ajouter `src/tools/LSPTool/formatters.ts` si vous voulez des sorties texte pretes a afficher.

## do not copy blindly
- `src/services/mcp/client.ts`
  - trop de branches runtime Claude Code: AppState, analytics, IDE bridge, proxy, mTLS, output persistence, tool adapters
- `src/services/mcp/auth.ts`
  - depend du secure storage, du navigateur local et du callback HTTP
- `src/services/mcp/config.ts`
  - contient de la logique enterprise/project approval et la fusion des sources Claude Code
- `src/services/mcp/useManageMCPConnections.ts`
  - couche React/AppState, reconnexion UI et events `list_changed`
- `src/utils/plugins/pluginLoader.ts`
  - centre de gravite trop large si on ne veut qu'un loader local
- `src/utils/plugins/loadPluginHooks.ts`
  - depend de `bootstrap/state.ts` et du hot reload settings
- `src/services/lsp/config.ts`
  - force LSP a venir des plugins
- `src/services/lsp/manager.ts`
  - singleton global adapte au demarrage Claude Code
- `src/tools/MCPTool/**`, `src/tools/LSPTool/**`, `src/tools/SkillTool/**`
  - wrappers de runtime Claude Tool, pas socle d'integration

## exact search shortcuts
- MCP transport core:
  - `rg -n "connectToServer|ensureConnectedClient|fetchToolsForClient|fetchResourcesForClient|fetchCommandsForClient|processMCPResult" src/services/mcp/client.ts`
- MCP auth:
  - `rg -n "performMCPOAuthFlow|ClaudeAuthProvider|revokeServerTokens|wrapFetchWithStepUpDetection" src/services/mcp/auth.ts`
- MCP config merge:
  - `rg -n "dedupPluginMcpServers|filterMcpServersByPolicy|getClaudeCodeMcpConfigs|parseMcpConfig|setMcpServerEnabled" src/services/mcp/config.ts`
- Plugin loader core:
  - `rg -n "loadPluginManifest|createPluginFromPath|mergePluginSources|loadAllPluginsCacheOnly|cachePlugin" src/utils/plugins/pluginLoader.ts`
- Plugin contracts:
  - `rg -n "PluginManifestSchema|PluginSourceSchema|LspServerConfigSchema|InstalledPluginsFileSchemaV2" src/utils/plugins/schemas.ts`
- Plugin id/version/deps:
  - `rg -n "parsePluginIdentifier|buildPluginId|calculatePluginVersion|resolveDependencyClosure|verifyAndDemote" src/utils/plugins/pluginIdentifier.ts src/utils/plugins/pluginVersioning.ts src/utils/plugins/dependencyResolver.ts`
- Plugin -> MCP:
  - `rg -n "loadPluginMcpServers|resolvePluginMcpEnvironment|getPluginMcpServers|extractMcpServersFromPlugins" src/utils/plugins/mcpPluginIntegration.ts`
- Plugin -> LSP:
  - `rg -n "loadPluginLspServers|resolvePluginLspEnvironment|getPluginLspServers|extractLspServersFromPlugins" src/utils/plugins/lspPluginIntegration.ts`
- Plugin hooks and output styles:
  - `rg -n "loadPluginHooks|setupPluginHookHotReload|pruneRemovedPluginHooks" src/utils/plugins/loadPluginHooks.ts`
  - `rg -n "loadPluginOutputStyles|force-for-plugin" src/utils/plugins/loadPluginOutputStyles.ts src/outputStyles/loadOutputStylesDir.ts`
- LSP core:
  - `rg -n "createLSPClient|createLSPServerInstance|createLSPServerManager" src/services/lsp`
- LSP tooling:
  - `rg -n "goToDefinition|findReferences|workspaceSymbol|prepareCallHierarchy|incomingCalls|outgoingCalls" src/tools/LSPTool`
- Skills:
  - `rg -n "parseSkillFrontmatterFields|createSkillCommand|getSkillDirCommands|discoverSkillDirsForPaths|activateConditionalSkillsForPaths" src/skills/loadSkillsDir.ts`
  - `rg -n "registerBundledSkill|getBundledSkills|getBundledSkillExtractDir" src/skills/bundledSkills.ts`
- UI-only MCP/LSP surfaces:
  - `rg -n "MCPSettings|MCPListPanel|MCPToolListView|MCPToolDetailView|MCPReconnect|MCPServerApprovalDialog|LspRecommendationMenu|DiagnosticsDisplay|OutputStylePicker|SkillsMenu" src/components`

## direct answers for future extraction
- Quels fichiers copier pour un MCP client minimal:
  - copier `src/services/mcp/types.ts`, `src/services/mcp/mcpStringUtils.ts`, `src/services/mcp/normalization.ts`, `src/services/mcp/envExpansion.ts`
  - reprendre selectivement `connectToServer`, `ensureConnectedClient`, `fetchToolsForClient`, `fetchResourcesForClient`, `fetchCommandsForClient` depuis `src/services/mcp/client.ts`
  - ajouter `src/services/mcp/headersHelper.ts` et `src/services/mcp/auth.ts` seulement si besoin
- Quels fichiers copier pour un plugin loader minimal:
  - copier `src/utils/plugins/schemas.ts`, `src/utils/plugins/pluginIdentifier.ts`, `src/utils/plugins/pluginVersioning.ts`, `src/utils/plugins/dependencyResolver.ts`
  - reprendre `loadPluginManifest` et `createPluginFromPath` depuis `src/utils/plugins/pluginLoader.ts`
  - ajouter `src/utils/plugins/pluginOptionsStorage.ts` et `src/utils/plugins/pluginDirectories.ts` si vous voulez la substitution de variables plugin
- Quels fichiers copier pour un skill loader minimal:
  - copier `src/skills/bundledSkills.ts`, `src/skills/mcpSkillBuilders.ts`
  - reprendre `parseSkillFrontmatterFields`, `createSkillCommand`, `getSkillDirCommands` depuis `src/skills/loadSkillsDir.ts`
  - garder les helpers `src/utils/frontmatterParser.ts` et `src/utils/markdownConfigLoader.ts`
- Quels modules sont centraux vs optionnels:
  - centraux: `src/services/lsp/LSPClient.ts`, `src/services/lsp/LSPServerInstance.ts`, `src/services/lsp/LSPServerManager.ts`, `src/utils/plugins/schemas.ts`, `src/utils/plugins/pluginIdentifier.ts`, `src/utils/plugins/pluginVersioning.ts`, `src/utils/plugins/dependencyResolver.ts`, `src/skills/bundledSkills.ts`, `src/outputStyles/loadOutputStylesDir.ts`
  - optionnels: `src/services/mcp/auth.ts`, `src/utils/plugins/loadPluginOutputStyles.ts`, `src/services/lsp/passiveFeedback.ts`, `src/plugins/builtinPlugins.ts`, `src/services/plugins/pluginCliCommands.ts`
- Quels modules sont fortement couples au runtime Claude Code:
  - `src/services/mcp/client.ts`
  - `src/services/mcp/auth.ts`
  - `src/services/mcp/config.ts`
  - `src/services/mcp/useManageMCPConnections.ts`
  - `src/utils/plugins/pluginLoader.ts`
  - `src/utils/plugins/loadPluginHooks.ts`
  - `src/services/lsp/config.ts`
  - `src/services/lsp/manager.ts`
  - `src/tools/MCPTool/**`
  - `src/tools/LSPTool/**`
  - `src/tools/SkillTool/**`
