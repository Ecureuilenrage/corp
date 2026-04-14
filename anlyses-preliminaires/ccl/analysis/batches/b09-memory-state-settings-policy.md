---
batch_id: B09
title: Memory, state, settings & policy
paths:
  - src/projectOnboardingState.ts
  - src/state/**
  - src/memdir/**
  - src/migrations/**
  - src/services/SessionMemory/**
  - src/services/extractMemories/**
  - src/services/teamMemorySync/**
  - src/services/settingsSync/**
  - src/services/remoteManagedSettings/**
  - src/services/policyLimits/**
  - src/utils/settings/**
  - src/utils/permissions/**
  - src/utils/config.ts
  - src/utils/session*.ts*
  - src/schemas/**
priority: haute
status: enriched
keywords:
  - sessionStoragePortable
  - memdir
  - settings
  - remoteManagedSettings
  - permissions
---

# B09 - Memory, state, settings & policy

## Resume
- Couverture: 103 fichiers / 34206 lignes.
- Sous-domaines critiques: state runtime, stockage de session, memdir, extraction de memoire, sync memoire equipe, resolution de settings multi-source, caches policy distants, moteur de permissions.
- Hubs: `src/utils/sessionStorage.ts` (5105 lignes, 32 deps, 22 dependants), `src/utils/config.ts` (1817 lignes, 33 deps, 48 dependants), `src/utils/permissions/filesystem.ts` (1777 lignes, 24 deps, 11 dependants), `src/utils/permissions/permissionSetup.ts` (1532 lignes), `src/utils/permissions/permissions.ts` (1486 lignes), `src/services/teamMemorySync/index.ts` (1256 lignes), `src/utils/settings/settings.ts` (1015 lignes, 35 dependants).
- Gems d'extraction: `src/utils/sessionStoragePortable.ts`, `src/memdir/memoryScan.ts`, `src/memdir/teamMemPaths.ts`, `src/services/teamMemorySync/index.ts`, `src/utils/settings/settings.ts`, `src/utils/permissions/filesystem.ts`.
- Zones a haut couplage: `src/utils/sessionStorage.ts`, `src/utils/sessionRestore.ts`, `src/services/SessionMemory/sessionMemory.ts`, `src/services/extractMemories/extractMemories.ts`, `src/utils/config.ts`, `src/utils/permissions/permissions.ts`, `src/utils/permissions/permissionSetup.ts`.

## purpose
Memoire persistante, state store, settings, migrations et policy limits.

Le batch doit etre lu comme 3 piles qui se croisent:
1. `state` + `sessionStorage*`
2. `memdir` + `SessionMemory` + `extractMemories` + `teamMemorySync`
3. `settings` + `remoteManagedSettings` + `policyLimits` + `permissions`

## entrypoints
- `src/state/store.ts` - `createStore()`
- `src/state/AppStateStore.ts` - `getDefaultAppState()`
- `src/state/onChangeAppState.ts` - pont runtime -> settings/config/metadata
- `src/utils/sessionStoragePortable.ts` - lookup portable de sessions
- `src/utils/sessionStorage.ts` - transcript store complet
- `src/memdir/paths.ts` - resolution de chemins memoire
- `src/memdir/memdir.ts` - prompt/index `MEMORY.md`
- `src/services/teamMemorySync/index.ts` - sync delta + checksum
- `src/utils/settings/settings.ts` - merge engine multi-source
- `src/services/remoteManagedSettings/index.ts` - cache/polling de policy settings
- `src/services/policyLimits/index.ts` - restrictions org synchrones
- `src/utils/permissions/permissions.ts`
- `src/utils/permissions/filesystem.ts`

## key files
- `src/state/store.ts` - 34 lignes, store generique minimal
- `src/utils/sessionStoragePortable.ts` - 793 lignes, 3 deps, 4 dependants, meilleure coupe "sessions persistantes minimales"
- `src/utils/sessionStorage.ts` - 5105 lignes, monolithe transcript/session
- `src/memdir/paths.ts` - 278 lignes, resolution et guardrails memoire auto
- `src/memdir/teamMemPaths.ts` - 292 lignes, validation anti-traversal memoire equipe
- `src/memdir/memoryScan.ts` - 94 lignes, scan frontmatter-only
- `src/services/teamMemorySync/index.ts` - 1256 lignes, delta sync reutilisable
- `src/services/remoteManagedSettings/index.ts` - 638 lignes, cache-first + ETag
- `src/services/policyLimits/index.ts` - 663 lignes, cache-first + fail-open
- `src/utils/settings/settings.ts` - 1015 lignes, noyau multi-source
- `src/utils/settings/types.ts` - 1148 lignes, schema Zod settings/permissions/hooks
- `src/utils/permissions/filesystem.ts` - 1777 lignes, garde-fou path-centric
- `src/utils/permissions/permissions.ts` - 1486 lignes, pipeline complet
- `src/utils/permissions/permissionSetup.ts` - 1532 lignes, modes et stripping
- `src/utils/config.ts` - 1817 lignes, monolithe legacy/global/project

## data flow
1. `src/utils/settings/settings.ts` charge et merge `userSettings`, `projectSettings`, `localSettings`, `flagSettings`, `policySettings`.
2. `src/state/AppStateStore.ts` initialise `AppState` depuis `getInitialSettings()`.
3. `src/state/onChangeAppState.ts` persiste certains changements runtime vers `settings.ts`, `config.ts` et `sessionState.ts`.
4. `src/utils/sessionStorage.ts` journalise les echanges et `src/utils/sessionRestore.ts` reconstruit l'etat.
5. `src/memdir/paths.ts` resolve le memdir, `src/memdir/memoryScan.ts` scanne le manifeste, `src/memdir/memdir.ts` construit le prompt/index.
6. `src/services/SessionMemory/sessionMemory.ts`, `src/services/extractMemories/extractMemories.ts` et `src/services/teamMemorySync/index.ts` alimentent la memoire durable.
7. `src/services/remoteManagedSettings/index.ts` et `src/services/policyLimits/index.ts` alimentent `policySettings` et les restrictions runtime.
8. `src/utils/permissions/permissions.ts` + `src/utils/permissions/filesystem.ts` arbitrent les permissions a partir des settings, des regles et du contexte runtime.

## external deps
- `fs` / `fs/promises` / `path` pour stockage local, cache et scan
- `axios` pour `teamMemorySync`, `settingsSync`, `remoteManagedSettings`, `policyLimits`
- `zod/v4` pour settings, hooks, schemas d'API et permissions
- `lodash-es/mergeWith.js` et `lodash-es/memoize.js`
- GrowthBook / feature flags
- OAuth / first-party auth
- watchers de fichiers cote settings hot-reload
- UI React/Ink seulement dans `src/services/remoteManagedSettings/securityCheck.tsx` et autour du pipeline permission

## flags/env
- Envs memoire: `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, `CLAUDE_CODE_SIMPLE`, `CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_REMOTE_MEMORY_DIR`, `CLAUDE_COWORK_MEMORY_PATH_OVERRIDE`
- `DOWNLOAD_USER_SETTINGS`
- `KAIROS`
- `POWERSHELL_AUTO_MODE`
- `TEAMMEM`
- `TRANSCRIPT_CLASSIFIER`
- `UPLOAD_USER_SETTINGS`
- Gates clefs a chercher: `tengu_passport_quail`, `tengu_slate_thimble`, `tengu_herring_clock`, `tengu_session_memory`, `tengu_sm_config`, `tengu_enable_settings_sync_push`, `tengu_strap_foyer`, `tengu_bramble_lintel`, `tengu_moth_copse`, `tengu_coral_fern`
- Eligibility remote managed settings: `CLAUDE_CODE_ENTRYPOINT=local-agent` desactive le loader distant

## reusable ideas
- `sessionStoragePortable.ts` est la meilleure coupe pour reindexer des sessions JSONL sans embarquer le runtime CLI
- `settings.ts` offre un vrai merge engine multi-source, pas juste un loader de fichiers
- `teamMemorySync/index.ts` implemente un delta sync avec checksums, ETag, 412 retries et secret scanning
- `filesystem.ts` + `pathValidation.ts` donnent une couche de permission de chemins bien plus reutilisable que le reste du moteur de permissions
- `teamMemPaths.ts` est une bonne brique autonome pour eviter traversal, symlink escape et prefix attacks

## reusable features
- Persistent memory stack - Memoire persistante, extraction et sync. (reuse: haute, coupling: moyenne)
- Settings and policy - Settings multi-source, migrations et policy limits. (reuse: haute, coupling: moyenne)
- Portable session storage - Lookup/lecture lite de sessions JSONL. (reuse: haute, coupling: faible)
- Team memory delta sync - Sync repo-scope avec delta upload, conflict retries et secret scanning. (reuse: haute, coupling: moyenne)
- Settings merge engine - Merge/caches/validation de settings multi-source. (reuse: haute, coupling: moyenne)
- Remote managed settings cache - Cache-first ETag loader de policy settings distants. (reuse: haute, coupling: moyenne)
- Policy limits cache - Cache-first restriction loader avec evaluation synchrone. (reuse: haute, coupling: moyenne)
- Permission rule engine - Parsing/chargement/evaluation de regles de permissions. (reuse: haute, coupling: moyenne)
- Filesystem permission guard - Validation de paths, carve-outs internes et suggestions de regles. (reuse: haute, coupling: moyenne)

## copy risk
Tres bon socle, mais il faut decouper par slices.
- Copier `sessionStorage.ts`, `config.ts`, `permissions.ts` ou `permissionSetup.ts` en bloc recree vite une demi-application.
- Les gros fichiers melangent bootstrap runtime, analytics, UI prompts, OAuth/API, hooks et auto-mode classifier.

## search hints
- `sessionStoragePortable`
- `getAutoMemPath`
- `batchDeltaByBytes`
- `getSettingsForSource`
- `isPolicyAllowed`
- `isDangerousPowerShellPermission`
- `checkWritePermissionForTool`

## subdomains

| Sous-domaine | Fichiers coeur | Ce qui est reellement reutilisable | Couplage |
| --- | --- | --- | --- |
| State store | `src/state/store.ts`, `src/state/AppStateStore.ts`, `src/state/AppState.tsx`, `src/state/onChangeAppState.ts` | `createStore()` est autonome; `onChangeAppState()` est utile comme pattern de synchro runtime -> persistence | faible -> haute |
| Session storage / recovery | `src/utils/sessionStoragePortable.ts`, `src/utils/sessionStorage.ts`, `src/utils/sessionRestore.ts`, `src/utils/sessionState.ts`, `src/utils/sessionEnvironment.ts`, `src/utils/sessionFileAccessHooks.ts` | `sessionStoragePortable.ts` est la coupe minimale; le reste est couple au bootstrap/session loop | faible -> haute |
| Memdir | `src/memdir/paths.ts`, `src/memdir/teamMemPaths.ts`, `src/memdir/memoryScan.ts`, `src/memdir/memoryTypes.ts`, `src/memdir/memdir.ts`, `src/memdir/findRelevantMemories.ts` | paths, validation d'ecriture, scan de manifeste, taxonomy memoire | faible -> moyenne |
| Session memory | `src/services/SessionMemory/sessionMemory.ts`, `src/services/SessionMemory/prompts.ts`, `src/services/SessionMemory/sessionMemoryUtils.ts` | prompts/template + thresholds; pas le moteur forked complet | moyenne -> haute |
| Extracted memories | `src/services/extractMemories/extractMemories.ts`, `src/services/extractMemories/prompts.ts` | prompt de l'extracteur et policy de tools; moteur complet fortement couple | haute |
| Team memory sync | `src/services/teamMemorySync/index.ts`, `watcher.ts`, `secretScanner.ts`, `teamMemSecretGuard.ts`, `types.ts` | delta sync, retries, secret scanning, watcher optionnel | moyenne |
| Settings loading / cache / validation | `src/utils/settings/settings.ts`, `constants.ts`, `types.ts`, `validation.ts`, `settingsCache.ts`, `managedPath.ts`, `internalWrites.ts`, `changeDetector.ts`, `applySettingsChange.ts`, `pluginOnlyPolicy.ts`, `src/schemas/hooks.ts` | merge engine, cache, schema, validation, internal write suppression | moyenne |
| Migrations | `src/migrations/*.ts`, callsites dans `src/main.tsx` | chaque migration est petite et ciblable individuellement | faible |
| Policy limits / permission model | `src/services/policyLimits/index.ts`, `src/services/remoteManagedSettings/*`, `src/utils/permissions/*` | policy caches, parsing de regles, filesystem guard, mode transitions | moyenne -> haute |

## feature inventory

| Feature | Fichiers exacts | Symboles exacts | Valeur reuse | Couplage |
| --- | --- | --- | --- | --- |
| Generic state store | `src/state/store.ts` | `createStore` | haute | faible |
| AppState default + persistence bridge | `src/state/AppStateStore.ts`, `src/state/onChangeAppState.ts` | `getDefaultAppState`, `externalMetadataToAppState`, `onChangeAppState` | moyenne | haute |
| Portable session file lookup | `src/utils/sessionStoragePortable.ts` | `validateUuid`, `readSessionLite`, `resolveSessionFilePath`, `readTranscriptForLoad` | haute | faible |
| Full transcript journal | `src/utils/sessionStorage.ts` | `recordTranscript`, `loadTranscriptFile`, `restoreSessionMetadata`, `getSessionFilesLite` | haute | haute |
| Session recovery | `src/utils/sessionRestore.ts` | `restoreSessionStateFromLog`, `restoreAgentFromSession`, `restoreWorktreeForResume`, `processResumedConversation` | moyenne | haute |
| Auto-memory path resolver | `src/memdir/paths.ts` | `isAutoMemoryEnabled`, `getAutoMemPath`, `getAutoMemEntrypoint`, `isAutoMemPath` | haute | moyenne |
| Team memory path guard | `src/memdir/teamMemPaths.ts` | `PathTraversalError`, `validateTeamMemWritePath`, `validateTeamMemKey`, `isTeamMemFile` | haute | faible |
| Memory manifest scan | `src/memdir/memoryScan.ts`, `src/memdir/memoryTypes.ts` | `scanMemoryFiles`, `formatMemoryManifest`, `MEMORY_TYPES`, `parseMemoryType` | haute | faible |
| Memory prompt builder | `src/memdir/memdir.ts`, `src/memdir/teamMemPrompts.ts` | `truncateEntrypointContent`, `ensureMemoryDirExists`, `buildMemoryPrompt`, `buildCombinedMemoryPrompt`, `loadMemoryPrompt` | moyenne | moyenne |
| Session summary memory | `src/services/SessionMemory/sessionMemory.ts`, `src/services/SessionMemory/prompts.ts`, `src/services/SessionMemory/sessionMemoryUtils.ts` | `shouldExtractMemory`, `initSessionMemory`, `manuallyExtractSessionMemory`, `buildSessionMemoryUpdatePrompt`, `waitForSessionMemoryExtraction` | moyenne | haute |
| Background durable memory extraction | `src/services/extractMemories/extractMemories.ts`, `src/services/extractMemories/prompts.ts` | `createAutoMemCanUseTool`, `initExtractMemories`, `executeExtractMemories`, `drainPendingExtraction`, `buildExtractCombinedPrompt` | moyenne | haute |
| Team memory delta sync | `src/services/teamMemorySync/index.ts`, `src/services/teamMemorySync/secretScanner.ts`, `src/services/teamMemorySync/types.ts`, `src/services/teamMemorySync/watcher.ts` | `createSyncState`, `hashContent`, `batchDeltaByBytes`, `pullTeamMemory`, `pushTeamMemory`, `syncTeamMemory`, `scanForSecrets` | haute | moyenne |
| User/project settings sync | `src/services/settingsSync/index.ts` | `uploadUserSettingsInBackground`, `downloadUserSettings`, `redownloadUserSettings` | moyenne | moyenne |
| Settings merge engine | `src/utils/settings/settings.ts`, `constants.ts`, `settingsCache.ts`, `types.ts`, `validation.ts`, `managedPath.ts`, `src/schemas/hooks.ts` | `SETTING_SOURCES`, `getEnabledSettingSources`, `loadManagedFileSettings`, `getSettingsForSource`, `getInitialSettings`, `getSettingsWithSources`, `SettingsSchema`, `PermissionsSchema`, `HooksSchema` | haute | moyenne |
| Remote managed settings cache | `src/services/remoteManagedSettings/index.ts`, `syncCache.ts`, `syncCacheState.ts`, `types.ts` | `initializeRemoteManagedSettingsLoadingPromise`, `waitForRemoteManagedSettingsToLoad`, `loadRemoteManagedSettings`, `refreshRemoteManagedSettings`, `getRemoteManagedSettingsSyncFromCache` | haute | moyenne |
| Policy limits cache | `src/services/policyLimits/index.ts`, `types.ts` | `initializePolicyLimitsLoadingPromise`, `waitForPolicyLimitsToLoad`, `isPolicyAllowed`, `loadPolicyLimits`, `refreshPolicyLimits` | haute | moyenne |
| Permission rule engine | `src/utils/permissions/PermissionMode.ts`, `permissionRuleParser.ts`, `permissionsLoader.ts`, `permissions.ts`, `PermissionUpdate.ts`, `PermissionUpdateSchema.ts`, `src/utils/settings/permissionValidation.ts` | `permissionModeSchema`, `permissionRuleValueFromString`, `loadAllPermissionRulesFromDisk`, `hasPermissionsToUseTool`, `checkRuleBasedPermissions`, `applyPermissionUpdate`, `persistPermissionUpdates`, `validatePermissionRule` | haute | moyenne |
| Filesystem permission guard | `src/utils/permissions/filesystem.ts`, `pathValidation.ts` | `DANGEROUS_FILES`, `DANGEROUS_DIRECTORIES`, `checkReadPermissionForTool`, `checkWritePermissionForTool`, `checkEditableInternalPath`, `checkReadableInternalPath`, `validatePath`, `isDangerousRemovalPath` | haute | moyenne |

## symbol map

### State store
- `src/state/store.ts`
  - `createStore`
- `src/state/AppStateStore.ts`
  - `getDefaultAppState`
- `src/state/AppState.tsx`
  - `AppStateProvider`
  - `useAppState`
  - `useAppStateStore`
  - `useAppStateMaybeOutsideOfProvider`
- `src/state/onChangeAppState.ts`
  - `externalMetadataToAppState`
  - `onChangeAppState`

### Session storage / recovery
- `src/utils/sessionStoragePortable.ts`
  - `validateUuid`
  - `extractJsonStringField`
  - `extractLastJsonStringField`
  - `extractFirstPromptFromHead`
  - `readHeadAndTail`
  - `readSessionLite`
  - `sanitizePath`
  - `getProjectsDir`
  - `getProjectDir`
  - `canonicalizePath`
  - `findProjectDir`
  - `resolveSessionFilePath`
  - `readTranscriptForLoad`
- `src/utils/sessionStorage.ts`
  - `getTranscriptPath`
  - `getTranscriptPathForSession`
  - `recordTranscript`
  - `writeAgentMetadata`
  - `readAgentMetadata`
  - `hydrateRemoteSession`
  - `loadTranscriptFromFile`
  - `loadTranscriptFile`
  - `fetchLogs`
  - `loadFullLog`
  - `loadAllProjectsMessageLogs`
  - `loadSameRepoMessageLogs`
  - `saveCustomTitle`
  - `saveTaskSummary`
  - `saveAgentSetting`
  - `saveMode`
  - `saveWorktreeState`
  - `restoreSessionMetadata`
  - `getSessionFilesLite`
- `src/utils/sessionRestore.ts`
  - `restoreSessionStateFromLog`
  - `computeRestoredAttributionState`
  - `computeStandaloneAgentContext`
  - `restoreAgentFromSession`
  - `refreshAgentDefinitionsForModeSwitch`
  - `restoreWorktreeForResume`
  - `exitRestoredWorktree`
  - `processResumedConversation`
- `src/utils/sessionState.ts`
  - `setSessionStateChangedListener`
  - `setSessionMetadataChangedListener`
  - `setPermissionModeChangedListener`
  - `getSessionState`
- `src/utils/sessionEnvironment.ts`
  - `getSessionEnvDirPath`
  - `getHookEnvFilePath`
  - `clearCwdEnvFiles`
  - `invalidateSessionEnvCache`
  - `getSessionEnvironmentScript`
- `src/utils/sessionFileAccessHooks.ts`
  - `isMemoryFileAccess`
  - `registerSessionFileAccessHooks`

### Memdir / memory
- `src/memdir/paths.ts`
  - `isAutoMemoryEnabled`
  - `isExtractModeActive`
  - `getMemoryBaseDir`
  - `hasAutoMemPathOverride`
  - `getAutoMemPath`
  - `getAutoMemDailyLogPath`
  - `getAutoMemEntrypoint`
  - `isAutoMemPath`
- `src/memdir/teamMemPaths.ts`
  - `PathTraversalError`
  - `isTeamMemoryEnabled`
  - `getTeamMemPath`
  - `getTeamMemEntrypoint`
  - `validateTeamMemWritePath`
  - `validateTeamMemKey`
  - `isTeamMemPath`
  - `isTeamMemFile`
- `src/memdir/memoryScan.ts`
  - `scanMemoryFiles`
  - `formatMemoryManifest`
- `src/memdir/memoryTypes.ts`
  - `MEMORY_TYPES`
  - `parseMemoryType`
  - `TYPES_SECTION_COMBINED`
  - `TYPES_SECTION_INDIVIDUAL`
  - `WHAT_NOT_TO_SAVE_SECTION`
  - `MEMORY_DRIFT_CAVEAT`
  - `WHEN_TO_ACCESS_SECTION`
  - `TRUSTING_RECALL_SECTION`
  - `MEMORY_FRONTMATTER_EXAMPLE`
- `src/memdir/memdir.ts`
  - `ENTRYPOINT_NAME`
  - `MAX_ENTRYPOINT_LINES`
  - `MAX_ENTRYPOINT_BYTES`
  - `truncateEntrypointContent`
  - `ensureMemoryDirExists`
  - `buildMemoryLines`
  - `buildMemoryPrompt`
  - `buildSearchingPastContextSection`
  - `loadMemoryPrompt`
- `src/memdir/findRelevantMemories.ts`
  - `findRelevantMemories`
- `src/memdir/teamMemPrompts.ts`
  - `buildCombinedMemoryPrompt`

### Session memory / extraction
- `src/services/SessionMemory/sessionMemory.ts`
  - `shouldExtractMemory`
  - `initSessionMemory`
  - `manuallyExtractSessionMemory`
  - `createMemoryFileCanUseTool`
- `src/services/SessionMemory/prompts.ts`
  - `DEFAULT_SESSION_MEMORY_TEMPLATE`
  - `isSessionMemoryEmpty`
  - `buildSessionMemoryUpdatePrompt`
  - `truncateSessionMemoryForCompact`
- `src/services/SessionMemory/sessionMemoryUtils.ts`
  - `DEFAULT_SESSION_MEMORY_CONFIG`
  - `waitForSessionMemoryExtraction`
  - `getSessionMemoryContent`
  - `setSessionMemoryConfig`
  - `hasMetInitializationThreshold`
  - `hasMetUpdateThreshold`
  - `resetSessionMemoryState`
- `src/services/extractMemories/extractMemories.ts`
  - `createAutoMemCanUseTool`
  - `initExtractMemories`
  - `executeExtractMemories`
  - `drainPendingExtraction`
- `src/services/extractMemories/prompts.ts`
  - `buildExtractAutoOnlyPrompt`
  - `buildExtractCombinedPrompt`

## dependency map

| Slice | Dependances internes bloquantes | Commentaire d'extraction |
| --- | --- | --- |
| `src/state/store.ts` | aucune | Copie directe possible. |
| `src/state/AppStateStore.ts` | `src/Tool.ts`, services MCP, prompt suggestion, settings, permissions | A traiter comme consommateur d'un systeme existant, pas comme brique de base. |
| `src/utils/sessionStoragePortable.ts` | `src/utils/envUtils.ts`, `src/utils/getWorktreePathsPortable.ts`, `src/utils/hash.ts` | Meilleure extraction standalone du batch. |
| `src/utils/sessionStorage.ts` | bootstrap state, analytics, commands, session ingress, messages, toolResultStorage | Ne pas prendre sans assumer toute la boucle de session. |
| `src/memdir/paths.ts` | bootstrap state, GrowthBook, `utils/settings/settings.ts`, git/path helpers | Couplage raisonnable si vous remplacez les flags par vos propres gates. |
| `src/memdir/teamMemPaths.ts` | `paths.ts`, GrowthBook, `utils/errors.ts` | Validation de path tres recuperable. |
| `src/memdir/memoryScan.ts` | `frontmatterParser.ts`, `readFileInRange.ts`, `memoryTypes.ts` | Extraction faible risque. |
| `src/services/SessionMemory/sessionMemory.ts` | Tool runtime, postSamplingHooks, forked agent, filesystem permissions, token counting | Conserver seulement si vous gardez le runtime d'agents/outils. |
| `src/services/extractMemories/extractMemories.ts` | Tool runtime, memdir, prompts d'outils, forked agent, analytics | Idem, plus encore couple au runtime conversationnel. |
| `src/services/teamMemorySync/index.ts` | auth, repo hash, user agent, retry utils, `teamMemPaths.ts`, `secretScanner.ts` | Bonne extraction si vous acceptez un backend HTTP et OAuth/API key. |
| `src/services/settingsSync/index.ts` | auth, repo hash, `config.ts`, `settings.ts`, `internalWrites.ts`, `settingsCache.ts` | Utile seulement si vous avez deja le modele de fichiers local. |
| `src/utils/settings/settings.ts` | bootstrap allowed-setting-sources, remote managed sync cache, MDM loader, schema, validation, gitignore helper | Noyau multi-source; la piece la plus rentable cote settings. |
| `src/services/remoteManagedSettings/index.ts` | auth, retry utils, `settingsChangeDetector`, `syncCache.ts`, `syncCacheState.ts`, `securityCheck.tsx` | Retirer `securityCheck.tsx` si pas d'UI interactive. |
| `src/services/policyLimits/index.ts` | auth, privacy level, retry utils, file cache | Plus simple a isoler que `remoteManagedSettings`. |
| `src/utils/permissions/permissions.ts` | Tool types, hooks, analytics, sandbox adapter, denial tracking, classifier | Extraire en mode "engine complet" seulement. |
| `src/utils/permissions/permissionSetup.ts` | tools registry, settings, growthbook, `permissions.ts`, dangerous patterns | Necessaire pour auto-mode et stripping de regles, sinon trop lourd. |
| `src/utils/permissions/filesystem.ts` | `memdir/paths.ts`, bootstrap state, settings, plans, sessionStorage, windows path helpers | Tres utile pour un garde-fou path-centric. |
| `src/utils/permissions/pathValidation.ts` | `filesystem.ts`, sandbox adapter, path helpers | Bonne coupe minimale avec `filesystem.ts`. |
| `src/utils/config.ts` | bootstrap state, analytics, memdir, git, file locking, theme, privacy | Monolithe legacy; extraire seulement des petites fonctions ciblees. |
| `src/utils/settings/types.ts` | `src/schemas/hooks.ts`, sandbox schema, Zod | N'oubliez pas `hooks.ts` si vous gardez la validation complete. |

## symbol map - settings, policy, permissions

### Settings / migrations / policy
- `src/utils/settings/constants.ts`
  - `SETTING_SOURCES`
  - `getEnabledSettingSources`
  - `EditableSettingSource`
- `src/utils/settings/settings.ts`
  - `loadManagedFileSettings`
  - `getManagedFileSettingsPresence`
  - `parseSettingsFile`
  - `getSettingsRootPathForSource`
  - `getSettingsFilePathForSource`
  - `getRelativeSettingsFilePathForSource`
  - `getSettingsForSource`
  - `getPolicySettingsOrigin`
  - `updateSettingsForSource`
  - `settingsMergeCustomizer`
  - `getManagedSettingsKeysForLogging`
  - `getInitialSettings`
  - `getSettingsWithSources`
  - `getSettingsWithErrors`
  - `hasSkipDangerousModePermissionPrompt`
  - `hasAutoModeOptIn`
  - `getUseAutoModeDuringPlan`
  - `getAutoModeConfig`
  - `rawSettingsContainsKey`
- `src/utils/settings/settingsCache.ts`
  - `getSessionSettingsCache`
  - `setSessionSettingsCache`
  - `getCachedSettingsForSource`
  - `setCachedSettingsForSource`
  - `getCachedParsedFile`
  - `setCachedParsedFile`
  - `resetSettingsCache`
- `src/utils/settings/validation.ts`
  - `formatZodError`
  - `validateSettingsFileContent`
  - `filterInvalidPermissionRules`
- `src/utils/settings/managedPath.ts`
  - `getManagedFilePath`
  - `getManagedSettingsDropInDir`
- `src/utils/settings/internalWrites.ts`
  - `markInternalWrite`
  - `consumeInternalWrite`
  - `clearInternalWrites`
- `src/utils/settings/changeDetector.ts`
  - `initialize`
  - `dispose`
  - `subscribe`
  - `notifyChange`
  - `resetForTesting`
  - `settingsChangeDetector`
- `src/utils/settings/applySettingsChange.ts`
  - `applySettingsChange`
- `src/utils/settings/pluginOnlyPolicy.ts`
  - `isRestrictedToPluginOnly`
  - `isSourceAdminTrusted`
- `src/utils/settings/mdm/settings.ts`
  - `startMdmSettingsLoad`
  - `ensureMdmSettingsLoaded`
  - `getMdmSettings`
  - `getHkcuSettings`
  - `clearMdmSettingsCache`
  - `setMdmSettingsCache`
  - `refreshMdmSettings`
  - `parseCommandOutputAsSettings`
  - `parseRegQueryStdout`
- `src/utils/settings/mdm/rawRead.ts`
  - `fireRawRead`
  - `startMdmRawRead`
  - `getMdmRawReadPromise`
- `src/services/remoteManagedSettings/index.ts`
  - `initializeRemoteManagedSettingsLoadingPromise`
  - `computeChecksumFromSettings`
  - `isEligibleForRemoteManagedSettings`
  - `waitForRemoteManagedSettingsToLoad`
  - `clearRemoteManagedSettingsCache`
  - `loadRemoteManagedSettings`
  - `refreshRemoteManagedSettings`
  - `startBackgroundPolling`
  - `stopBackgroundPolling`
- `src/services/remoteManagedSettings/syncCacheState.ts`
  - `setSessionCache`
  - `resetSyncCache`
  - `setEligibility`
  - `getSettingsPath`
  - `getRemoteManagedSettingsSyncFromCache`
- `src/services/remoteManagedSettings/syncCache.ts`
  - `resetSyncCache`
  - `isRemoteManagedSettingsEligible`
- `src/services/remoteManagedSettings/securityCheck.tsx`
  - `checkManagedSettingsSecurity`
  - `handleSecurityCheckResult`
- `src/services/policyLimits/index.ts`
  - `_resetPolicyLimitsForTesting`
  - `initializePolicyLimitsLoadingPromise`
  - `isPolicyLimitsEligible`
  - `waitForPolicyLimitsToLoad`
  - `isPolicyAllowed`
  - `loadPolicyLimits`
  - `refreshPolicyLimits`
  - `clearPolicyLimitsCache`
  - `startBackgroundPolling`
  - `stopBackgroundPolling`
- `src/migrations/*.ts`
  - `migrateAutoUpdatesToSettings`
  - `migrateBypassPermissionsAcceptedToSettings`
  - `migrateEnableAllProjectMcpServersToSettings`
  - `migrateFennecToOpus`
  - `migrateLegacyOpusToCurrent`
  - `migrateOpusToOpus1m`
  - `migrateReplBridgeEnabledToRemoteControlAtStartup`
  - `migrateSonnet1mToSonnet45`
  - `migrateSonnet45ToSonnet46`
  - `resetAutoModeOptInForDefaultOffer`
  - `resetProToOpusDefault`
- `src/utils/config.ts`
  - `DEFAULT_GLOBAL_CONFIG`
  - `getGlobalConfig`
  - `saveGlobalConfig`
  - `getCurrentProjectConfig`
  - `saveCurrentProjectConfig`
  - `getMemoryPath`
  - `getManagedClaudeRulesDir`
  - `getUserClaudeRulesDir`
- `src/schemas/hooks.ts`
  - `HookCommandSchema`
  - `HookMatcherSchema`
  - `HooksSchema`
  - `HookCommand`
  - `BashCommandHook`
  - `PromptHook`
  - `AgentHook`
  - `HttpHook`
  - `HooksSettings`

### Permission model
- `src/utils/permissions/PermissionMode.ts`
  - `permissionModeSchema`
  - `externalPermissionModeSchema`
  - `isExternalPermissionMode`
  - `toExternalPermissionMode`
  - `permissionModeFromString`
- `src/utils/permissions/permissionRuleParser.ts`
  - `normalizeLegacyToolName`
  - `getLegacyToolNames`
  - `escapeRuleContent`
  - `unescapeRuleContent`
  - `permissionRuleValueFromString`
  - `permissionRuleValueToString`
- `src/utils/permissions/permissionsLoader.ts`
  - `shouldAllowManagedPermissionRulesOnly`
  - `shouldShowAlwaysAllowOptions`
  - `loadAllPermissionRulesFromDisk`
  - `getPermissionRulesForSource`
  - `deletePermissionRuleFromSettings`
  - `addPermissionRulesToSettings`
- `src/utils/permissions/permissions.ts`
  - `permissionRuleSourceDisplayString`
  - `getAllowRules`
  - `getDenyRules`
  - `getAskRules`
  - `createPermissionRequestMessage`
  - `toolAlwaysAllowedRule`
  - `getDenyRuleForTool`
  - `getAskRuleForTool`
  - `getDenyRuleForAgent`
  - `hasPermissionsToUseTool`
  - `checkRuleBasedPermissions`
  - `deletePermissionRule`
  - `applyPermissionRulesToPermissionContext`
  - `syncPermissionRulesFromDisk`
- `src/utils/permissions/permissionSetup.ts`
  - `isDangerousBashPermission`
  - `isDangerousPowerShellPermission`
  - `isDangerousTaskPermission`
  - `findDangerousClassifierPermissions`
  - `isOverlyBroadBashAllowRule`
  - `isOverlyBroadPowerShellAllowRule`
  - `findOverlyBroadBashPermissions`
  - `findOverlyBroadPowerShellPermissions`
  - `removeDangerousPermissions`
  - `stripDangerousPermissionsForAutoMode`
  - `restoreDangerousPermissions`
  - `transitionPermissionMode`
  - `initialPermissionModeFromCLI`
  - `parseToolListFromCLI`
  - `initializeToolPermissionContext`
  - `verifyAutoModeGateAccess`
  - `isAutoModeGateEnabled`
  - `getAutoModeUnavailableReason`
  - `getAutoModeEnabledState`
  - `getAutoModeEnabledStateIfCached`
  - `hasAutoModeOptInAnySource`
  - `isBypassPermissionsModeDisabled`
  - `createDisabledBypassPermissionsContext`
  - `prepareContextForPlanMode`
  - `transitionPlanAutoMode`
- `src/utils/permissions/filesystem.ts`
  - `DANGEROUS_FILES`
  - `DANGEROUS_DIRECTORIES`
  - `normalizeCaseForComparison`
  - `getClaudeSkillScope`
  - `relativePath`
  - `toPosixPath`
  - `isClaudeSettingsPath`
  - `getSessionMemoryDir`
  - `getSessionMemoryPath`
  - `getClaudeTempDir`
  - `getBundledSkillsRoot`
  - `getProjectTempDir`
  - `getScratchpadDir`
  - `ensureScratchpadDir`
  - `checkReadPermissionForTool`
  - `checkWritePermissionForTool`
  - `generateSuggestions`
  - `checkEditableInternalPath`
  - `checkReadableInternalPath`
- `src/utils/permissions/pathValidation.ts`
  - `formatDirectoryList`
  - `getGlobBaseDirectory`
  - `expandTilde`
  - `isPathInSandboxWriteAllowlist`
  - `isPathAllowed`
  - `validateGlobPattern`
  - `isDangerousRemovalPath`
  - `validatePath`
- `src/utils/permissions/shellRuleMatching.ts`
  - `permissionRuleExtractPrefix`
  - `matchWildcardPattern`
  - `parsePermissionRule`
- `src/utils/permissions/shadowedRuleDetection.ts`
  - `detectUnreachableRules`
- `src/utils/permissions/permissionExplainer.ts`
  - `isPermissionExplainerEnabled`
  - `generatePermissionExplanation`
- `src/utils/permissions/PermissionUpdate.ts`
  - `extractRules`
  - `hasRules`
  - `applyPermissionUpdate`
  - `applyPermissionUpdates`
  - `supportsPersistence`
  - `persistPermissionUpdate`
  - `persistPermissionUpdates`
  - `createReadRuleSuggestion`
- `src/utils/permissions/classifierDecision.ts`
  - `isAutoModeAllowlistedTool`
- `src/utils/permissions/yoloClassifier.ts`
  - `getDefaultExternalAutoModeRules`
  - `buildDefaultExternalSystemPrompt`
  - `YOLO_CLASSIFIER_TOOL_NAME`
  - `buildTranscriptEntries`
  - `buildTranscriptForClassifier`
  - `buildYoloSystemPrompt`
  - `classifyYoloAction`
  - `formatActionForClassifier`

## minimal reusable slices

### Slices recommandees
- `portable_session_storage`
  - fichiers: `src/utils/sessionStoragePortable.ts`, `src/utils/envUtils.ts`, `src/utils/getWorktreePathsPortable.ts`, `src/utils/hash.ts`
- `memory_manifest_scan`
  - fichiers: `src/memdir/memoryScan.ts`, `src/memdir/memoryTypes.ts`, `src/utils/frontmatterParser.ts`, `src/utils/readFileInRange.ts`
- `team_mem_path_guard`
  - fichiers: `src/memdir/teamMemPaths.ts`, `src/memdir/paths.ts`, `src/utils/errors.ts`
- `settings_merge_engine`
  - fichiers: `src/utils/settings/settings.ts`, `src/utils/settings/constants.ts`, `src/utils/settings/settingsCache.ts`, `src/utils/settings/types.ts`, `src/utils/settings/validation.ts`, `src/utils/settings/managedPath.ts`, `src/schemas/hooks.ts`
- `filesystem_permission_guard`
  - fichiers: `src/utils/permissions/filesystem.ts`, `src/utils/permissions/pathValidation.ts`, `src/utils/permissions/PermissionResult.ts`, `src/utils/permissions/PermissionRule.ts`, `src/utils/permissions/PermissionUpdate.ts`, `src/utils/permissions/PermissionUpdateSchema.ts`

### Reponses explicites

#### Quels fichiers copier pour une memoire persistante minimale ?
- Sessions JSONL minimales:
  - `src/utils/sessionStoragePortable.ts`
  - `src/utils/envUtils.ts`
  - `src/utils/getWorktreePathsPortable.ts`
  - `src/utils/hash.ts`
- Memdir auto-memory minimal:
  - `src/memdir/paths.ts`
  - `src/memdir/memoryTypes.ts`
  - `src/memdir/memoryScan.ts`
  - `src/utils/frontmatterParser.ts`
  - `src/utils/readFileInRange.ts`
  - optionnel: `src/memdir/teamMemPaths.ts`
- A eviter au debut:
  - `src/memdir/memdir.ts`
  - `src/services/SessionMemory/sessionMemory.ts`
  - `src/services/extractMemories/extractMemories.ts`

#### Quels fichiers copier pour une resolution de settings multi-source ?
- Noyau local-only recommande:
  - `src/utils/settings/constants.ts`
  - `src/utils/settings/settings.ts`
  - `src/utils/settings/settingsCache.ts`
  - `src/utils/settings/types.ts`
  - `src/utils/settings/validation.ts`
  - `src/utils/settings/managedPath.ts`
  - `src/utils/settings/internalWrites.ts`
  - `src/schemas/hooks.ts`
- Add-ons si necessaire:
  - MDM: `src/utils/settings/mdm/constants.ts`, `src/utils/settings/mdm/rawRead.ts`, `src/utils/settings/mdm/settings.ts`
  - remote managed settings: `src/services/remoteManagedSettings/syncCacheState.ts`, `src/services/remoteManagedSettings/syncCache.ts`, `src/services/remoteManagedSettings/index.ts`
  - hot reload: `src/utils/settings/changeDetector.ts`, `src/utils/settings/applySettingsChange.ts`

#### Quels fichiers copier pour une couche policy/permission minimale ?
- Baseline:
  - `src/utils/permissions/PermissionMode.ts`
  - `src/utils/permissions/permissionRuleParser.ts`
  - `src/utils/permissions/permissionsLoader.ts`
  - `src/utils/permissions/PermissionUpdate.ts`
  - `src/utils/permissions/PermissionUpdateSchema.ts`
  - `src/utils/settings/permissionValidation.ts`
  - `src/utils/permissions/filesystem.ts`
  - `src/utils/permissions/pathValidation.ts`
- Add-ons:
  - pipeline complet: `src/utils/permissions/permissions.ts`
  - modes + stripping: `src/utils/permissions/permissionSetup.ts`
  - classifier auto-mode: `src/utils/permissions/classifierDecision.ts`, `src/utils/permissions/yoloClassifier.ts`

## extraction recipes

### Recipe 1 - Portable session index sans runtime CLI
- Copier:
  - `src/utils/sessionStoragePortable.ts`
  - `src/utils/envUtils.ts`
  - `src/utils/getWorktreePathsPortable.ts`
  - `src/utils/hash.ts`
- Adapter:
  - `getClaudeConfigHomeDir()` vers votre home/config root
  - `getWorktreePathsPortable()` si vous n'avez pas git worktrees
- Garder tels quels:
  - `validateUuid`
  - `readSessionLite`
  - `resolveSessionFilePath`
  - `readTranscriptForLoad`
- Difficulte: faible

### Recipe 2 - Memdir local minimal
- Copier:
  - `src/memdir/paths.ts`
  - `src/memdir/memoryTypes.ts`
  - `src/memdir/memoryScan.ts`
  - `src/utils/frontmatterParser.ts`
  - `src/utils/readFileInRange.ts`
- Stubber/remplacer:
  - GrowthBook dans `paths.ts`
  - `getInitialSettings()` si vous n'importez pas tout `settings.ts`
- Ajouter ensuite seulement si necessaire:
  - `src/memdir/memdir.ts`
  - `src/memdir/teamMemPaths.ts`
- Difficulte: faible -> moyenne

### Recipe 3 - Team memory sync delta
- Copier:
  - `src/services/teamMemorySync/index.ts`
  - `src/services/teamMemorySync/secretScanner.ts`
  - `src/services/teamMemorySync/types.ts`
  - `src/memdir/teamMemPaths.ts`
- Optionnel:
  - `src/services/teamMemorySync/watcher.ts`
  - `src/services/teamMemorySync/teamMemSecretGuard.ts`
- Remplacer:
  - auth headers / OAuth
  - `getRepoRemoteHash()`
  - analytics
- Ne pas casser:
  - logique `entryChecksums`
  - `batchDeltaByBytes()`
  - conflit `412` + `fetchTeamMemoryHashes()`
  - secret scanning avant upload
- Difficulte: moyenne

### Recipe 4 - Settings multi-source local-first
- Copier:
  - `src/utils/settings/settings.ts`
  - `src/utils/settings/constants.ts`
  - `src/utils/settings/settingsCache.ts`
  - `src/utils/settings/types.ts`
  - `src/utils/settings/validation.ts`
  - `src/utils/settings/managedPath.ts`
  - `src/utils/settings/internalWrites.ts`
  - `src/schemas/hooks.ts`
- Decidez explicitement si vous gardez:
  - plugin base settings
  - `policySettings`
  - `flagSettings`
  - MDM
  - remote managed settings
- Point critique:
  - l'ordre de merge global n'est pas symetrique avec `policySettings`
  - `policySettings` est "first source wins": remote -> HKLM/plist -> managed file -> HKCU
- Difficulte: moyenne

### Recipe 5 - Policy cache distant sans UI
- Copier:
  - `src/services/remoteManagedSettings/index.ts`
  - `src/services/remoteManagedSettings/syncCache.ts`
  - `src/services/remoteManagedSettings/syncCacheState.ts`
  - `src/services/remoteManagedSettings/types.ts`
- Retirer si besoin:
  - `src/services/remoteManagedSettings/securityCheck.tsx`
  - `settingsChangeDetector.notifyChange()` si vous n'avez pas de hot reload
- Garder:
  - loading promise initiale
  - cache-first
  - checksum/ETag
  - stale cache fallback
- Difficulte: moyenne

### Recipe 6 - Permission layer minimale orientee filesystem
- Copier:
  - `src/utils/permissions/filesystem.ts`
  - `src/utils/permissions/pathValidation.ts`
  - `src/utils/permissions/PermissionMode.ts`
  - `src/utils/permissions/permissionRuleParser.ts`
  - `src/utils/permissions/permissionsLoader.ts`
  - `src/utils/settings/permissionValidation.ts`
- Ajouter ensuite:
  - `src/utils/permissions/permissions.ts` pour le pipeline complet
  - `src/utils/permissions/permissionSetup.ts` pour les modes et le stripping auto-mode
- Point critique:
  - `filesystem.ts` autorise plusieurs carve-outs internes par convention runtime
  - ne gardez que ceux qui existent dans votre application
- Difficulte: moyenne

## do not copy blindly
- `src/utils/sessionStorage.ts`
  - depend de `bootstrap/state.ts`, analytics, session ingress, messages, tool results, commands
- `src/utils/sessionRestore.ts`
  - recolle AppState, worktrees, attribution, agents et session logs
- `src/memdir/memdir.ts`
  - melange prompting, analytics, flags et conventions UX `MEMORY.md`
- `src/services/SessionMemory/sessionMemory.ts`
  - colle sur le runtime d'outils (`FileReadTool`, `FileEditTool`, `forkedAgent`, hooks post-sampling)
- `src/services/extractMemories/extractMemories.ts`
  - depend d'un agent forked, d'un set de tools autorises et de conventions de messages runtime
- `src/services/remoteManagedSettings/securityCheck.tsx`
  - couche UI interactive
- `src/utils/config.ts`
  - monolithe global/project config, locking, history legacy, memoire, onboarding, auth et telemetry
- `src/utils/permissions/permissions.ts`
  - contient plus qu'un moteur de regles: hooks, sandbox, async agents, auto-mode classifier, denial tracking
- `src/utils/permissions/permissionSetup.ts`
  - fortement lie aux modes de Claude Code et a ses tool names exacts
- `src/utils/permissions/filesystem.ts`
  - purgez les carve-outs internes (`session memory`, `scratchpad`, `project temp`, `.claude/launch.json`, memdir auto) si votre runtime ne partage pas ces conventions

## exact search shortcuts

```bash
rg -n "createStore|getDefaultAppState|externalMetadataToAppState|onChangeAppState" src/state/store.ts src/state/AppStateStore.ts src/state/onChangeAppState.ts
rg -n "validateUuid|readSessionLite|resolveSessionFilePath|readTranscriptForLoad" src/utils/sessionStoragePortable.ts
rg -n "recordTranscript|loadTranscriptFile|restoreSessionMetadata|getSessionFilesLite|saveMode|saveWorktreeState" src/utils/sessionStorage.ts
rg -n "restoreSessionStateFromLog|restoreAgentFromSession|restoreWorktreeForResume|processResumedConversation" src/utils/sessionRestore.ts
rg -n "isAutoMemoryEnabled|getAutoMemPath|getAutoMemEntrypoint|isAutoMemPath" src/memdir/paths.ts
rg -n "PathTraversalError|validateTeamMemWritePath|validateTeamMemKey|isTeamMemFile" src/memdir/teamMemPaths.ts
rg -n "scanMemoryFiles|formatMemoryManifest|MEMORY_TYPES|parseMemoryType" src/memdir/memoryScan.ts src/memdir/memoryTypes.ts
rg -n "buildMemoryPrompt|loadMemoryPrompt|truncateEntrypointContent|ensureMemoryDirExists" src/memdir/memdir.ts
rg -n "shouldExtractMemory|initSessionMemory|manuallyExtractSessionMemory|createMemoryFileCanUseTool" src/services/SessionMemory/sessionMemory.ts
rg -n "buildSessionMemoryUpdatePrompt|truncateSessionMemoryForCompact" src/services/SessionMemory/prompts.ts
rg -n "createAutoMemCanUseTool|initExtractMemories|executeExtractMemories|drainPendingExtraction" src/services/extractMemories/extractMemories.ts
rg -n "createSyncState|batchDeltaByBytes|pullTeamMemory|pushTeamMemory|syncTeamMemory" src/services/teamMemorySync/index.ts
rg -n "scanForSecrets|getSecretLabel|redactSecrets" src/services/teamMemorySync/secretScanner.ts
rg -n "uploadUserSettingsInBackground|downloadUserSettings|redownloadUserSettings" src/services/settingsSync/index.ts
rg -n "loadManagedFileSettings|getSettingsForSource|getInitialSettings|getSettingsWithSources|getPolicySettingsOrigin|getAutoModeConfig" src/utils/settings/settings.ts
rg -n "startMdmSettingsLoad|getMdmSettings|getHkcuSettings|refreshMdmSettings" src/utils/settings/mdm/settings.ts
rg -n "initializeRemoteManagedSettingsLoadingPromise|waitForRemoteManagedSettingsToLoad|loadRemoteManagedSettings|refreshRemoteManagedSettings" src/services/remoteManagedSettings/index.ts
rg -n "initializePolicyLimitsLoadingPromise|isPolicyAllowed|ESSENTIAL_TRAFFIC_DENY_ON_MISS|allow_product_feedback" src/services/policyLimits/index.ts
rg -n "permissionRuleValueFromString|permissionRuleValueToString" src/utils/permissions/permissionRuleParser.ts
rg -n "loadAllPermissionRulesFromDisk|getPermissionRulesForSource|addPermissionRulesToSettings" src/utils/permissions/permissionsLoader.ts
rg -n "hasPermissionsToUseTool|checkRuleBasedPermissions|applyPermissionRulesToPermissionContext|syncPermissionRulesFromDisk" src/utils/permissions/permissions.ts
rg -n "isDangerousPowerShellPermission|isOverlyBroadPowerShellAllowRule|findOverlyBroadPowerShellPermissions|stripDangerousPermissionsForAutoMode" src/utils/permissions/permissionSetup.ts
rg -n "checkReadPermissionForTool|checkWritePermissionForTool|checkEditableInternalPath|checkReadableInternalPath" src/utils/permissions/filesystem.ts
rg -n "validatePath|validateGlobPattern|isDangerousRemovalPath" src/utils/permissions/pathValidation.ts
rg -n "HookCommandSchema|HookMatcherSchema|HooksSchema" src/schemas/hooks.ts
```

## Notes d'analyse
- `src/utils/sessionStoragePortable.ts` est explicitement documente comme "Pure Node.js" et partage entre CLI et extension VS Code. C'est le signal le plus fort du batch pour une extraction faible risque.
- `src/utils/settings/settings.ts` a une subtilite importante: l'ordre global de merge suit les sources actives, mais `policySettings` est lui-meme resolu en interne via un ordre "premiere source gagnante": remote -> MDM admin -> managed file/drop-ins -> HKCU.
- `src/memdir/paths.ts` exclut volontairement `projectSettings` pour `autoMemoryDirectory`; c'est un guardrail de securite, pas un oubli.
- `src/services/teamMemorySync/index.ts` a des semantiques a ne pas perdre:
  - pull ecrase local par cle
  - push est un delta upload
  - les deletions locales ne se propagent pas
  - conflit `412` resolve via `entryChecksums`, pas via merge de contenu
- `src/services/policyLimits/index.ts` est majoritairement fail-open, sauf `ESSENTIAL_TRAFFIC_DENY_ON_MISS` qui fail-closed en essential-traffic-only.
- `src/utils/permissions/filesystem.ts` et `src/utils/permissions/permissionSetup.ts` repondent deja a une partie de "ou est exactement la securisation PowerShell ?" pour B09:
  - `permissionSetup.ts` pour les regles PowerShell dangereuses / trop larges
  - la validation semantique de commandes PowerShell reste principalement en B03
