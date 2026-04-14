---
batch_id: B03
title: Tool system: shell/file/web/search
paths:
  - src/Tool.ts
  - src/tools.ts
  - src/tools/BashTool/**
  - src/tools/PowerShellTool/**
  - src/tools/FileEditTool/**
  - src/tools/FileReadTool/**
  - src/tools/FileWriteTool/**
  - src/tools/NotebookEditTool/**
  - src/tools/WebFetchTool/**
  - src/tools/WebSearchTool/**
  - src/tools/GrepTool/**
  - src/tools/GlobTool/**
priority: haute
status: enriched
keywords:
  - getAllBaseTools
  - bashPermissions
  - pathValidation
---

# B03 - Tool system: shell/file/web/search

## Resume
- Batch critique pour reconstruire le coeur outillage local: securisation shell, edition de fichiers, recherche locale, fetch/search web.
- Frontiere de contrat: `src/Tool.ts` (`ToolPermissionContext`, `ToolUseContext`, `Tool`, `buildTool`) et `src/tools.ts` (`getAllBaseTools`, `assembleToolPool`, `getMergedTools`).
- Cibles d'extraction prioritaires:
  - Bash safety layer: `src/tools/BashTool/bashPermissions.ts`, `src/tools/BashTool/readOnlyValidation.ts`, `src/tools/BashTool/pathValidation.ts`, `src/utils/bash/**`
  - PowerShell safety layer: `src/tools/PowerShellTool/powershellPermissions.ts`, `src/tools/PowerShellTool/readOnlyValidation.ts`, `src/tools/PowerShellTool/pathValidation.ts`, `src/utils/powershell/parser.ts`
  - File edit pipeline: `src/tools/FileEditTool/FileEditTool.ts`, `src/tools/FileEditTool/types.ts`, `src/tools/FileEditTool/utils.ts`, `src/components/permissions/FilePermissionDialog/**`
  - Web/search tools: `src/tools/WebFetchTool/WebFetchTool.ts`, `src/tools/WebSearchTool/WebSearchTool.ts`, `src/tools/GrepTool/GrepTool.ts`, `src/tools/GlobTool/GlobTool.ts`
- Portabilite:
  - Haute: schemas Zod, parseurs shell, extracteurs de prefixes, helpers de diff/patch.
  - Moyenne: moteurs de permission Bash/PowerShell, validateurs de chemins, file edit pipeline.
  - Faible: runtime `exec(...)`, UI Ink/React de permission, integration `queryModelWithStreaming`, `queryHaiku`, `getURLMarkdownContent`.

## purpose
Produire une note de reverse engineering reutilisable, avec les symboles exacts et les dependances minimales, pour extraire vite les sous-systemes shell/file/web/search sans recopier le runtime complet.

## subdomains
- Tool contracts et registry: `src/Tool.ts`, `src/tools.ts`
- Bash runtime et safety rails: `src/tools/BashTool/**`, `src/utils/bash/**`, `src/utils/shell/**`
- PowerShell runtime et safety rails: `src/tools/PowerShellTool/**`, `src/utils/powershell/**`
- File mutation: `src/tools/FileEditTool/**`, `src/tools/FileWriteTool/**`, `src/tools/NotebookEditTool/**`
- File read et local search: `src/tools/FileReadTool/**`, `src/tools/GrepTool/**`, `src/tools/GlobTool/**`, `src/utils/ripgrep.ts`, `src/utils/glob.ts`
- Web tools: `src/tools/WebFetchTool/**`, `src/tools/WebSearchTool/**`
- Permission rails et diff UI: `src/utils/permissions/**`, `src/components/permissions/**`

## layer map
- Tool contracts: `src/Tool.ts`, `src/tools.ts`
  - Forme commune des tools, contexte de permission, registry de chargement.
- Prompts: `src/tools/*/prompt.ts`
  - Contraintes de comportement modele, guidance d'usage, consignes d'evitement des autres tools.
- Schemas/types: `fullInputSchema`, `inputSchema`, `outputSchema`, `types.ts`
  - Validation d'entree/sortie, champs caches internes, variantes exposees au modele.
- Execution runtime: `*.Tool.ts[x]`
  - `validateInput`, `checkPermissions`, `call`, `runShellCommand`, `runPowerShellCommand`, `writeTextContent`.
- Permission rails: `src/utils/permissions/**`, `src/tools/*Permissions.ts`, `src/components/permissions/**`
  - Matching des regles, auto-allow read-only, auto-ask/deny, suggestions de scopes.
- Diff/rendering: `src/tools/FileEditTool/utils.ts`, `src/components/permissions/FilePermissionDialog/**`, `FileWriteToolDiff.tsx`, `NotebookEditToolDiff.tsx`
  - Preview de patch, extrait de diff, integration IDE.
- Shell parsing: `src/utils/bash/**`, `src/utils/powershell/parser.ts`
  - AST, extraction de sous-commandes, prefixes, redirections, flags de securite.

## entrypoints
- `src/Tool.ts`
  - `ToolPermissionContext` (l.123), `getEmptyToolPermissionContext` (l.140), `ToolUseContext` (l.158), `Tool` (l.362), `buildTool` (l.783)
- `src/tools.ts`
  - `getAllBaseTools` (l.193), `assembleToolPool` (l.345), `getMergedTools` (l.383), `getPowerShellTool` (l.150)
- `src/tools/BashTool/BashTool.tsx`
  - `fullInputSchema` (l.227), `inputSchema` (l.254), `outputSchema` (l.279), `BashTool` (l.420), `runShellCommand` (l.826)
- `src/tools/PowerShellTool/PowerShellTool.tsx`
  - `fullInputSchema` (l.228), `inputSchema` (l.237), `outputSchema` (l.245), `PowerShellTool` (l.272), `runPowerShellCommand` (l.663)
- `src/tools/FileEditTool/FileEditTool.ts`
  - `FileEditTool` (l.86), `validateInput` (l.137), `call` (l.387), `readFileForEdit` (l.599)
- `src/tools/FileWriteTool/FileWriteTool.ts`
  - `FileWriteTool` (l.94), `validateInput` (l.153), `call` (l.223)
- `src/tools/NotebookEditTool/NotebookEditTool.ts`
  - `NotebookEditTool` (l.90), `validateInput` (l.176), `call` (l.295)
- `src/tools/FileReadTool/FileReadTool.ts`
  - `FileReadTool` (l.337), `validateInput` (l.418), `call` (l.496), `callInner` (l.804)
- `src/tools/GrepTool/GrepTool.ts`
  - `GrepTool` (l.160), `call` (l.310)
- `src/tools/GlobTool/GlobTool.ts`
  - `GlobTool` (l.57), `call` (l.154)
- `src/tools/WebFetchTool/WebFetchTool.ts`
  - `WebFetchTool` (l.66), `webFetchToolInputToPermissionRuleContent` (l.50)
- `src/tools/WebSearchTool/WebSearchTool.ts`
  - `makeToolSchema` (l.76), `WebSearchTool` (l.152), `mapToolResultToToolResultBlockParam` (l.401)

## key files
- `src/tools/BashTool/bashPermissions.ts`
  - Coeur des decisions Bash: prefix extraction, wrappers, env stripping, speculative classifier, `bashToolHasPermission`.
- `src/tools/BashTool/readOnlyValidation.ts`
  - Coeur read-only Bash: allowlists, flag parsing, `checkReadOnlyConstraints`.
- `src/tools/BashTool/pathValidation.ts`
  - Extraction de chemins et operations, `PATH_EXTRACTORS`, `COMMAND_OPERATION_TYPE`, `checkPathConstraints`.
- `src/utils/bash/ast.ts`
  - AST/security Bash, `parseForSecurityFromAst`, `checkSemantics`.
- `src/utils/powershell/parser.ts`
  - Parseur PowerShell structurant statements, pipelines, redirections, variables et security flags.
- `src/tools/PowerShellTool/readOnlyValidation.ts`
  - Allowlist cmdlets read-only et refus des expansions runtime dangereuses.
- `src/tools/PowerShellTool/pathValidation.ts`
  - Validation de chemins PowerShell, deny de suppressions sensibles, provider paths, sequential statement hazards.
- `src/tools/FileEditTool/utils.ts`
  - Patch/diff/snippet/normalization pour edition de fichiers.
- `src/components/permissions/FilePermissionDialog/usePermissionHandler.ts`
  - Lien entre preview diff, options de scope et generation de suggestions.
- `src/tools/WebFetchTool/utils.ts`
  - Validation URL, redirects autorises, timeout, markdown conversion, prompt secondaire.

## data flow
- `src/tools.ts` assemble le pool de tools selon platforme et feature flags.
- Chaque tool cree via `buildTool(...)` expose le meme pipeline:
  - schema d'entree/sortie
  - prompt
  - `validateInput`
  - `checkPermissions`
  - `call`
  - UI de rendu et UI de permission
- Les tools shell passent par parseurs + validateurs + matcher de permissions avant `exec(...)`.
- Les tools fichiers passent par `checkReadPermissionForTool`/`checkWritePermissionForTool`, par `readFileState`, puis par write atomique et mise a jour d'etat de lecture.
- Les tools web passent par regles de domaine, validation URL/provider, puis par fetch/search adapte au backend interne.

## tool contracts
- `src/Tool.ts`
  - `buildTool` normalise la surface contractuelle et porte la logique commune de validation stricte, rendu, permissions et telemetry.
  - `ToolPermissionContext` porte les regles `alwaysAllowRules`, `alwaysDenyRules`, `alwaysAskRules`, plus `shouldAvoidPermissionPrompts`, `awaitAutomatedChecksBeforeDialog`, `prePlanMode`.
- `src/tools.ts`
  - `getAllBaseTools` injecte Bash, FileRead, FileEdit, FileWrite, NotebookEdit, WebFetch, WebSearch, Grep/Glob, plus PowerShell si `isPowerShellToolEnabled()`.
  - `CLAUDE_CODE_SIMPLE` reduit le set de tools expose.
- Points de contrat importants pour extraction:
  - `inputSchema` peut etre plus petit que `fullInputSchema` pour cacher des champs internes (`_simulatedSedEdit` dans Bash).
  - `shouldDefer: true` est utilise par `WebFetchTool`, `WebSearchTool`, `NotebookEditTool`.
  - `isReadOnly` synchrone n'est pas toujours la verite complete: le vrai auto-allow peut etre decide plus tard dans `checkPermissions`.

## feature inventory
- Registry multi-tool avec chargement conditionnel PowerShell et web.
- Bash shell execution avec timeout, backgrounding et sandbox decision.
- Bash read-only classifier par commandes, flags et wrappers.
- Bash path extraction par operation type et par commande.
- Bash `sed -i` detection, parsing, preview et reroutage permission UI.
- Bash destructive warning distinct du refus de securite.
- Bash parser hybride: tree-sitter si dispo, fallback regex sinon.
- PowerShell native parsing en statements/pipelines/redirections.
- PowerShell read-only allowlist et refus des expansions de variables.
- PowerShell path validation aware des PSDrives, provider paths, module-qualified cmdlets et sequential cwd changes.
- PowerShell permission matcher case-insensitive, prefix-based et resilient aux aliases/abbreviations.
- FileEdit diff-centric avec stale-read guard, match counting et patch preview.
- FileWrite create/update avec stale-read guard et preview diff.
- NotebookEdit cell-aware avec `replace`/`insert`, `cell_type`, `parseCellId`, diff par cellule.
- FileRead multi-format: texte, image, pdf, notebook, `file_unchanged`.
- Grep local via ripgrep avec ignores et modes de sortie.
- Glob local via wrapper `glob(...)` et `truncated`.
- WebFetch avec validation URL/domain, redirects permis, cache, markdown extraction et secondary prompt.
- WebSearch avec schema interne modele, `max_uses`, streaming provider et remapping des resultats.
- Permission UI specialisee par tool, avec suggestions de regles et diff IDE.

## symbol map
- Contracts
  - `src/Tool.ts`: `ToolPermissionContext`, `ToolUseContext`, `Tool`, `buildTool`
  - `src/tools.ts`: `getAllBaseTools`, `assembleToolPool`, `getMergedTools`
- Bash validators/parsers/executors
  - `src/tools/BashTool/BashTool.tsx`: `detectBlockedSleepPattern`, `validateInput`, `checkPermissions`, `call`, `runShellCommand`
  - `src/tools/BashTool/bashPermissions.ts`: `permissionRuleExtractPrefix`, `bashPermissionRule`, `stripSafeWrappers`, `stripWrappersFromArgv`, `stripAllLeadingEnvVars`, `bashToolCheckExactMatchPermission`, `bashToolCheckPermission`, `bashToolHasPermission`
  - `src/tools/BashTool/readOnlyValidation.ts`: `isCommandSafeViaFlagParsing`, `checkReadOnlyConstraints`
  - `src/tools/BashTool/pathValidation.ts`: `PATH_EXTRACTORS`, `COMMAND_OPERATION_TYPE`, `createPathChecker`, `checkPathConstraints`
  - `src/tools/BashTool/sedValidation.ts`: `sedCommandIsAllowedByAllowlist`, `extractSedExpressions`, `checkSedConstraints`
  - `src/tools/BashTool/sedEditParser.ts`: `isSedInPlaceEdit`, `parseSedEditCommand`, `applySedSubstitution`
  - `src/tools/BashTool/modeValidation.ts`: `checkPermissionMode`, `getAutoAllowedCommands`
  - `src/tools/BashTool/bashSecurity.ts`: `stripSafeHeredocSubstitutions`, `hasSafeHeredocSubstitution`, `bashCommandIsSafe_DEPRECATED`
  - `src/tools/BashTool/destructiveCommandWarning.ts`: `getDestructiveCommandWarning`
  - `src/utils/bash/ast.ts`: `parseForSecurityFromAst`, `checkSemantics`
  - `src/utils/bash/parser.ts`: `extractCommandArguments`, `PARSE_ABORTED`
  - `src/utils/bash/commands.ts`: `splitCommandWithOperators`, `getCommandSubcommandPrefix`, `extractOutputRedirections`
  - `src/utils/bash/shellQuote.ts`: `tryParseShellCommand`, `tryQuoteShellArgs`, `quote`
  - `src/utils/bash/treeSitterAnalysis.ts`: `extractDangerousPatterns`, `analyzeCommand`
- PowerShell validators/parsers/executors
  - `src/tools/PowerShellTool/PowerShellTool.tsx`: `detectBlockedSleepPattern`, `isWindowsSandboxPolicyViolation`, `validateInput`, `checkPermissions`, `call`, `runPowerShellCommand`
  - `src/tools/PowerShellTool/powershellPermissions.ts`: `powershellPermissionRule`, `powershellToolCheckExactMatchPermission`, `powershellToolCheckPermission`, `powershellToolHasPermission`
  - `src/tools/PowerShellTool/readOnlyValidation.ts`: `CMDLET_ALLOWLIST`, `hasSyncSecurityConcerns`, `isReadOnlyCommand`, `isAllowlistedCommand`
  - `src/tools/PowerShellTool/pathValidation.ts`: `dangerousRemovalDeny`, `isDangerousRemovalRawPath`, `checkPathConstraints`
  - `src/tools/PowerShellTool/modeValidation.ts`: `isSymlinkCreatingCommand`, `checkPermissionMode`
  - `src/tools/PowerShellTool/powershellSecurity.ts`: `powershellCommandIsSafe`
  - `src/tools/PowerShellTool/gitSafety.ts`: `isGitInternalPathPS`, `isDotGitPathPS`
  - `src/tools/PowerShellTool/clmTypes.ts`: `CLM_ALLOWED_TYPES`, `isClmAllowedType`
  - `src/utils/powershell/parser.ts`: `parsePowerShellCommand`, `deriveSecurityFlags`, `getAllCommandNames`, `getAllRedirections`, `getVariablesByScope`, `hasDirectoryChange`, `getFileRedirections`
  - `src/utils/powershell/dangerousCmdlets.ts`: `FILEPATH_EXECUTION_CMDLETS`, `DANGEROUS_SCRIPT_BLOCK_CMDLETS`, `MODULE_LOADING_CMDLETS`, `NETWORK_CMDLETS`, `ALIAS_HIJACK_CMDLETS`, `WMI_CIM_CMDLETS`, `ARG_GATED_CMDLETS`
- File tools, diff, UI
  - `src/tools/FileEditTool/types.ts`: `inputSchema`, `hunkSchema`, `gitDiffSchema`, `outputSchema`
  - `src/tools/FileEditTool/FileEditTool.ts`: `backfillObservableInput`, `validateInput`, `call`, `readFileForEdit`
  - `src/tools/FileEditTool/utils.ts`: `applyEditToFile`, `getPatchForEdit`, `getPatchForEdits`, `getSnippetForPatch`, `getEditsForPatch`, `normalizeFileEditInput`, `areFileEditsEquivalent`
  - `src/tools/FileWriteTool/FileWriteTool.ts`: `validateInput`, `call`
  - `src/tools/NotebookEditTool/NotebookEditTool.ts`: `validateInput`, `call`, `parseCellId`
  - `src/components/permissions/FilePermissionDialog/FilePermissionDialog.tsx`: `FilePermissionDialog`
  - `src/components/permissions/FilePermissionDialog/useFilePermissionDialog.ts`: `useFilePermissionDialog`
  - `src/components/permissions/FilePermissionDialog/usePermissionHandler.ts`: `PERMISSION_HANDLERS`
  - `src/components/permissions/FilePermissionDialog/permissionOptions.tsx`: `getFilePermissionOptions`
  - `src/components/permissions/FilePermissionDialog/ideDiffConfig.ts`: `createSingleEditDiffConfig`
  - `src/components/permissions/FileWritePermissionRequest/FileWriteToolDiff.tsx`: `FileWriteToolDiff`
  - `src/components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx`: `NotebookEditToolDiff`
- Search/web
  - `src/tools/FileReadTool/FileReadTool.ts`: `registerFileReadListener`, `isBlockedDevicePath`, `readImageWithTokenBudget`, `callInner`
  - `src/tools/GrepTool/GrepTool.ts`: `GrepTool`, `call`
  - `src/tools/GlobTool/GlobTool.ts`: `GlobTool`, `call`
  - `src/tools/WebFetchTool/WebFetchTool.ts`: `webFetchToolInputToPermissionRuleContent`, `WebFetchTool`
  - `src/tools/WebFetchTool/utils.ts`: `validateURL`, `checkDomainBlocklist`, `isPermittedRedirect`, `getWithPermittedRedirects`, `getURLMarkdownContent`, `applyPromptToMarkdown`
  - `src/tools/WebFetchTool/preapproved.ts`: `PREAPPROVED_HOSTS`, `isPreapprovedHost`
  - `src/tools/WebSearchTool/WebSearchTool.ts`: `makeToolSchema`, `makeOutputFromSearchResponse`, `queryModelWithStreaming`, `mapToolResultToToolResultBlockParam`

## dependency map
- Bash safety layer
  - Minimal noyau portable: `src/utils/bash/**`, `src/tools/BashTool/readOnlyValidation.ts`, `src/tools/BashTool/pathValidation.ts`, `src/tools/BashTool/sedValidation.ts`, `src/tools/BashTool/sedEditParser.ts`
  - Couplages: `ToolPermissionContext`, matcher de regles, `exec(...)`, UI de permission, feature flags tree-sitter/classifier.
- PowerShell safety layer
  - Minimal noyau portable: `src/utils/powershell/parser.ts`, `src/utils/powershell/dangerousCmdlets.ts`, `src/tools/PowerShellTool/readOnlyValidation.ts`, `src/tools/PowerShellTool/pathValidation.ts`, `src/tools/PowerShellTool/gitSafety.ts`
  - Couplages: permission rules, `exec(...)`, detection presence `powershell.exe`, mode validation, UI de permission.
- File edit pipeline
  - Minimal noyau portable: `src/tools/FileEditTool/types.ts`, `src/tools/FileEditTool/utils.ts`
  - Dependances bloquantes pour extraction complete: `readFileState`, `writeTextContent`, `checkWritePermissionForTool`, `diagnosticTracker`, diff UI.
- Web/search tools
  - Grep/Glob: faible coupling, juste wrappers `ripGrep`/`glob` + permission filesystem read.
  - WebFetch: depend fortement de `getURLMarkdownContent`, `queryHaiku`, validation de domaines et persistence binaire.
  - WebSearch: depend fortement du provider de modeles et du format interne `web_search_tool_result`.

## external deps
- Shell local et runtime de process: `src/utils/Shell.ts`, `src/utils/shell/resolveDefaultShell.ts`, `src/utils/shell/powershellDetection.ts`
- Filesystem/permissions: `src/utils/permissions/filesystem.ts`, `src/utils/permissions/permissions.ts`, `src/utils/permissions/PermissionUpdate.ts`
- UI Ink/React pour permission et diff: `src/components/permissions/**`
- Local search backends: `src/utils/ripgrep.ts`, `src/utils/glob.ts`
- Web backends internes: `getURLMarkdownContent`, `queryHaiku`, `queryModelWithStreaming`

## flags/env
- `CLAUDE_CODE_SIMPLE`
  - Reduit le pool de tools et modifie certains prompts/comportements.
- `WEB_BROWSER_TOOL`
  - Gate de chargement du browser/web tooling dans `src/tools.ts`.
- `TREE_SITTER_BASH`, `TREE_SITTER_BASH_SHADOW`
  - Activent/ombrent l'analyse tree-sitter dans `src/tools/BashTool/bashPermissions.ts`.
- `tengu_read_dedup_killswitch`
  - Killswitch de dedup dans `src/tools/FileReadTool/FileReadTool.ts`.
- `isPowerShellToolEnabled()`
  - Gate de platforme/runtime pour exposer `PowerShellTool`.

## permission rails
- Frontiere commune filesystem
  - `src/utils/permissions/filesystem.ts`: `matchingRuleForInput`, `pathInAllowedWorkingPath`, `checkReadPermissionForTool`, `checkWritePermissionForTool`
  - `src/utils/permissions/permissions.ts`: `getRuleByContentsForTool`, `getRuleByContentsForToolName`
  - `src/utils/permissions/PermissionUpdate.ts`: `applyPermissionUpdate`, `applyPermissionUpdates`
- Routing UI
  - `src/components/permissions/PermissionRequest.tsx`: `permissionComponentForTool` route Bash, PowerShell, WebFetch, FileEdit, FileWrite, NotebookEdit, FileRead/Grep/Glob vers des composants distincts.
- Shell permission UX
  - `src/components/permissions/BashPermissionRequest/BashPermissionRequest.tsx`
    - re-route les `sed -i` vers `SedEditPermissionRequest`
    - expose prefixes editables et warnings destructifs
  - `src/components/permissions/PowerShellPermissionRequest/PowerShellPermissionRequest.tsx`
    - construit aussi des prefixes editables a partir du parse statique
  - `src/components/permissions/useShellPermissionFeedback.ts`
    - logique partagee d'accept/reject/focus pour Bash et PowerShell
- File permission UX
  - `src/components/permissions/FilePermissionDialog/FilePermissionDialog.tsx`
  - `src/components/permissions/FilePermissionDialog/useFilePermissionDialog.ts`
  - `src/components/permissions/FilePermissionDialog/usePermissionHandler.ts`
  - `src/components/permissions/FilePermissionDialog/permissionOptions.tsx`
  - `src/components/permissions/FilePermissionDialog/ideDiffConfig.ts`
- Web permission UX
  - `src/components/permissions/WebFetchPermissionRequest/WebFetchPermissionRequest.tsx`
    - ecrit des regles persistantes `domain:<hostname>` dans les settings locaux.
- Point critique d'extraction
  - Les validateurs shell/fichier ne suffisent pas: le comportement final depend toujours du format de regles, du matching prioritaire deny/ask/allow et des composants UI capables d'emettre des `PermissionUpdate`.

## Bash safety rails: garde-fous et points de decision
- Garde-fous exacts
  - `src/tools/BashTool/BashTool.tsx`
    - `detectBlockedSleepPattern` bloque les longs `sleep` au premier plan.
    - `validateInput` applique ce blocage avant execution.
    - `preparePermissionMatcher` construit un matcher conservateur a partir du parse.
  - `src/tools/BashTool/bashPermissions.ts`
    - `stripSafeWrappers` et `stripWrappersFromArgv` ignorent les wrappers connus sans perdre le vrai binaire cible.
    - `BINARY_HIJACK_VARS` et `stripAllLeadingEnvVars` retirent les variables d'environnement susceptibles de detourner la resolution du binaire.
    - `permissionRuleExtractPrefix` derive des prefixes stables pour les regles utilisateur.
    - `bashToolCheckExactMatchPermission` et `bashToolCheckPermission` appliquent matching exact puis prefix/wildcard.
    - `bashToolHasPermission` orchestre le flux complet de decision.
    - `MAX_SUBCOMMANDS_FOR_SECURITY_CHECK` et `MAX_SUGGESTED_RULES_FOR_COMPOUND` bornent l'analyse et les suggestions pour les commandes composees.
    - `isNormalizedGitCommand`, `isNormalizedCdCommand`, `commandHasAnyCd` traitent explicitement les combinaisons `cd && git`.
  - `src/tools/BashTool/readOnlyValidation.ts`
    - `checkReadOnlyConstraints` est la vraie source read-only Bash.
    - `isCommandSafeViaFlagParsing` gere les outils dont la securite depend de flags precis.
  - `src/tools/BashTool/pathValidation.ts`
    - `PATH_EXTRACTORS` + `COMMAND_OPERATION_TYPE` + `checkPathConstraints` font la jonction entre syntaxe et policy filesystem.
  - `src/tools/BashTool/sedValidation.ts` et `src/tools/BashTool/sedEditParser.ts`
    - separer detection `sed -i`, verification syntaxique et simulation de substitution est important pour reutiliser la preview sans reimporter tout BashTool.
  - `src/tools/BashTool/modeValidation.ts`
    - `checkPermissionMode` auto-allow certains edits quand le mode de permission le permet.
  - `src/tools/BashTool/destructiveCommandWarning.ts`
    - warning UX seulement, pas frontiere de securite.
- Points de decision critiques
  - ordre deny/ask avant les allow path-based pour eviter les bypass de regles larges
  - stripping des wrappers et variables avant extraction du prefixe
  - distinction commande read-only vs commande a effets via parsing de flags
  - traitement separe `sed -i` pour obtenir diff/preview plutot qu'un yes/no brut
  - fallback regex si tree-sitter indisponible ou non active
  - speculative classifier: optimisation/UI, pas noyau portable minimal
- Portable vs runtime interne
  - Portable:
    - `src/utils/bash/ast.ts`
    - `src/utils/bash/parser.ts`
    - `src/utils/bash/commands.ts`
    - `src/utils/bash/shellQuote.ts`
    - `src/tools/BashTool/readOnlyValidation.ts`
    - `src/tools/BashTool/pathValidation.ts`
    - `src/tools/BashTool/sedValidation.ts`
    - `src/tools/BashTool/sedEditParser.ts`
  - Dependant du runtime interne:
    - `src/tools/BashTool/BashTool.tsx`
    - `src/tools/BashTool/shouldUseSandbox.ts`
    - UI `BashPermissionRequest`
    - speculative classifier et telemetry
- Note d'architecture
  - `src/tools/BashTool/shouldUseSandbox.ts` aide a choisir un mode d'execution, mais les commentaires du code montrent que la vraie frontiere de securite reste le moteur de permissions. Ne pas extraire uniquement le sandbox chooser.

## PowerShell safety rails: garde-fous et points de decision
- Garde-fous exacts
  - `src/tools/PowerShellTool/PowerShellTool.tsx`
    - `detectBlockedSleepPattern` bloque les sleeps bloquants, comme cote Bash.
    - `isWindowsSandboxPolicyViolation` protege les combinaisons de policy sandbox non supportees.
    - `checkPermissions` passe toujours par `powershellToolHasPermission`.
  - `src/utils/powershell/parser.ts`
    - parse statements, pipelines, redirections, variables, alias et flags de securite.
    - `deriveSecurityFlags`, `getFileRedirections`, `hasDirectoryChange`, `getVariablesByScope` sont les points les plus reutilisables.
  - `src/tools/PowerShellTool/readOnlyValidation.ts`
    - `CMDLET_ALLOWLIST` encode la lecture pure.
    - `hasSyncSecurityConcerns` fait un fast reject avant les verifications plus couteuses.
    - `isReadOnlyCommand` et `isAllowlistedCommand` sont les decisions read-only principales.
    - garde-fous critiques contre expansions `$VAR` / `$env:VAR`, script-path ambigu, PATHEXT, pipeline tails et redirections fichier.
  - `src/tools/PowerShellTool/pathValidation.ts`
    - `dangerousRemovalDeny` et `isDangerousRemovalRawPath` imposent un hard deny sur certaines suppressions.
    - `checkPathConstraints` traite PSDrives, provider paths `FileSystem::`, arrays de chemins, leaf-only params et effets de `Set-Location`.
  - `src/tools/PowerShellTool/powershellPermissions.ts`
    - matching case-insensitive
    - gestion des module-qualified cmdlets
    - fallback sur decomposition de commandes composees
    - `powershellToolHasPermission` est le vrai orchestrateur.
  - `src/tools/PowerShellTool/gitSafety.ts`
    - garde-fous specifiques `.git` et chemins internes Git.
  - `src/tools/PowerShellTool/powershellSecurity.ts`
    - blocage des motifs cmdlets/script blocks/modules/reseau/dangerous aliases a partir du parse.
- Points de decision critiques
  - distinction cmdlet natif vs script local portant un nom semblable
  - gestion case-insensitive et prefixes d'abbreviation PowerShell
  - rejet blanket des expansions de variables quand elles peuvent deformer la securite statique
  - sequential statement hazard: un `Set-Location` modifie l'interpretation des statements suivants
  - provider paths et chemins module-qualifies doivent etre normalises avant policy
  - unicode dashes / whitespace PowerShell ne doivent pas casser la detection de parametres
- Portable vs runtime interne
  - Portable:
    - `src/utils/powershell/parser.ts`
    - `src/utils/powershell/dangerousCmdlets.ts`
    - `src/tools/PowerShellTool/readOnlyValidation.ts`
    - `src/tools/PowerShellTool/pathValidation.ts`
    - `src/tools/PowerShellTool/gitSafety.ts`
  - Dependant du runtime interne:
    - `src/tools/PowerShellTool/PowerShellTool.tsx`
    - `getCachedPowerShellPath()` et le bridge `exec(..., 'powershell', ...)`
    - UI `PowerShellPermissionRequest`
    - feature gate `isPowerShellToolEnabled()`

## FileEdit / FileWrite / NotebookEdit
- Points d'entree exacts
  - `src/tools/FileEditTool/FileEditTool.ts`: `validateInput`, `call`, `readFileForEdit`
  - `src/tools/FileWriteTool/FileWriteTool.ts`: `validateInput`, `call`
  - `src/tools/NotebookEditTool/NotebookEditTool.ts`: `validateInput`, `call`
- Dependances minimales
  - schemas: `src/tools/FileEditTool/types.ts`
  - patch/diff: `src/tools/FileEditTool/utils.ts`
  - IO: abstraction lecture/ecriture texte, plus ecriture notebook JSON
  - permissions: `checkWritePermissionForTool`
  - coherency: snapshot type `readFileState`
- Ce que fait exactement `FileEditTool`
  - refuse les fichiers notebook
  - exige une lecture precedente du fichier
  - compare avec `readFileState` pour bloquer les ecritures stale
  - bloque les edits sur secrets/team memory
  - compte les occurrences et refuse l'ambiguite si `replace_all` est faux
  - applique un patch textuel via `applyEditToFile`
  - produit preview/snippet via `getPatchForEdit`, `getSnippetForPatch`
- Ce que fait exactement `FileWriteTool`
  - distinction create/update
  - garde UNC path pour eviter la fuite NTLM
  - lecture prealable obligatoire si le fichier existe deja
  - stale check equivalent au FileEdit
  - re-ecrit le contenu complet via `writeTextContent`
- Ce que fait exactement `NotebookEditTool`
  - force l'extension `.ipynb`
  - supporte `replace` et `insert`
  - impose `cell_type` pour les insertions
  - s'appuie sur `parseCellId`
  - parse volontairement le JSON sans memoization, a cause d'un risque de mutation d'objet cache
  - calcule un diff par cellule dans `NotebookEditToolDiff.tsx`
- Risques d'extraction
  - Sans `readFileState`, on perd la protection contre stale writes.
  - Sans `FilePermissionDialog`, on perd la meilleure ergonomie de preview et les suggestions de scopes.
  - Sans les checks UNC/team memory/settings, l'extraction devient sensiblement moins sure.

## FileRead / Grep / Glob
- `src/tools/FileReadTool/FileReadTool.ts`
  - `BLOCKED_DEVICE_PATHS` et `isBlockedDevicePath` eviteront les lectures dangereuses de pseudo-fichiers/peripheriques.
  - `registerFileReadListener` fournit un point d'observabilite utile si vous reconstruisez le pipeline autour des edits.
  - `callInner` gere texte, image, pdf, notebook et `file_unchanged`.
  - `readImageWithTokenBudget` est specifique au runtime IA, peu portable.
- `src/tools/GrepTool/GrepTool.ts`
  - wrapper `ripGrep(...)`, schema simple, `output_mode`, `head_limit`
  - tient compte des ignores projet/plugin et normalise les patterns de chemin
  - slice la plus simple a reemployer pour la recherche locale.
- `src/tools/GlobTool/GlobTool.ts`
  - wrapper minimal autour de `glob(...)`
  - bonne cible de copie si vous avez juste besoin de listing robuste + `truncated`.

## WebFetch / WebSearch
- `src/tools/WebFetchTool/WebFetchTool.ts`
  - contrat simple `url` + `prompt`
  - permissions par domaine via `domain:<hostname>`
  - `shouldDefer: true`
- `src/tools/WebFetchTool/utils.ts`
  - `validateURL`, `checkDomainBlocklist`, `isPermittedRedirect`, `getWithPermittedRedirects`
  - constantes importantes: `MAX_URL_LENGTH`, `MAX_HTTP_CONTENT_LENGTH`, `FETCH_TIMEOUT_MS`, `MAX_REDIRECTS`, `MAX_MARKDOWN_LENGTH`
  - `getURLMarkdownContent` fait le vrai fetch + conversion
  - `applyPromptToMarkdown` appelle un modele secondaire pour condenser/filtrer
- `src/tools/WebFetchTool/preapproved.ts`
  - `PREAPPROVED_HOSTS` ne vaut que pour le tool WebFetch GET; ce n'est pas une policy reseau globale.
- `src/tools/WebSearchTool/WebSearchTool.ts`
  - `makeToolSchema` encode `max_uses: 8`
  - `isEnabled` depend du provider/modele
  - `allowed_domains` et `blocked_domains` sont mutuellement exclusifs
  - `queryModelWithStreaming` et `web_search_tool_result` sont les dependances runtime les plus difficiles a extraire
- Risques d'extraction
  - `WebFetchTool` reste extractible si vous remplacez `getURLMarkdownContent` et `queryHaiku`.
  - `WebSearchTool` est surtout une faccade sur une capacite de modele interne; la partie la plus portable est le contrat et le post-traitement, pas le moteur de recherche lui-meme.

## reusable ideas
- separer strictement contrat tool / validation / permission / execution / UI
- faire des parseurs shell reutilisables et les brancher ensuite sur plusieurs policies
- representer l'edition de fichier comme un pipeline diff-first plutot que comme un write brut
- traiter les regles de permission comme des donnees (`contents`) derivables depuis l'input du tool

## minimal reusable slices
- Bash static safety core
  - `src/utils/bash/**`
  - `src/tools/BashTool/readOnlyValidation.ts`
  - `src/tools/BashTool/pathValidation.ts`
  - `src/tools/BashTool/sedValidation.ts`
  - `src/tools/BashTool/sedEditParser.ts`
- PowerShell static safety core
  - `src/utils/powershell/parser.ts`
  - `src/utils/powershell/dangerousCmdlets.ts`
  - `src/tools/PowerShellTool/readOnlyValidation.ts`
  - `src/tools/PowerShellTool/pathValidation.ts`
  - `src/tools/PowerShellTool/gitSafety.ts`
- File edit core
  - `src/tools/FileEditTool/types.ts`
  - `src/tools/FileEditTool/utils.ts`
  - optionnel: `src/components/permissions/FilePermissionDialog/**`
- Local search core
  - `src/tools/GrepTool/GrepTool.ts`
  - `src/tools/GlobTool/GlobTool.ts`
  - `src/utils/ripgrep.ts`
  - `src/utils/glob.ts`

## extraction recipes
### Bash safety layer
1. Copier `src/utils/bash/**` puis `src/tools/BashTool/readOnlyValidation.ts`, `pathValidation.ts`, `sedValidation.ts`, `sedEditParser.ts`, `modeValidation.ts`, `bashPermissions.ts`.
2. Remplacer `ToolPermissionContext` par un format minimal portant seulement allow/ask/deny rules.
3. Stubber le speculative classifier et les hooks UI.
4. Garder l'ordre de decision: normalisation/wrappers -> read-only -> path constraints -> mode validation -> permission match.
5. Ne brancher `BashTool.tsx` qu'apres avoir une implementation d'execution fiable.

### PowerShell safety layer
1. Copier `src/utils/powershell/parser.ts`, `dangerousCmdlets.ts`, puis `src/tools/PowerShellTool/readOnlyValidation.ts`, `pathValidation.ts`, `gitSafety.ts`, `powershellPermissions.ts`, `powershellSecurity.ts`.
2. Garder la resolution case-insensitive, la detection script-vs-cmdlet et les rejections d'expansions `$...`.
3. Refaire un `PermissionContext` minimal identique a Bash pour mutualiser le moteur de regles.
4. Remplacer `runPowerShellCommand` par votre propre bridge d'execution; ne copiez pas aveuglement la politique sandbox Windows.

### File edit pipeline
1. Copier `src/tools/FileEditTool/types.ts` et `src/tools/FileEditTool/utils.ts` pour recuperer schemas, normalisation et diff.
2. Reimplementer un petit `readFileState` avec hash/mtime/contenu lu.
3. Ajouter seulement ensuite `src/tools/FileEditTool/FileEditTool.ts`, `src/tools/FileWriteTool/FileWriteTool.ts`, `src/tools/NotebookEditTool/NotebookEditTool.ts`.
4. Si besoin d'une UX complete, copier `src/components/permissions/FilePermissionDialog/**`, `FileWriteToolDiff.tsx`, `NotebookEditToolDiff.tsx`.
5. Conserver les checks UNC, stale state et read-before-write; ce sont des protections structurelles, pas du polish.

### Web/search tools
1. Pour la recherche locale, copier d'abord `GrepTool`, `GlobTool`, `ripgrep.ts`, `glob.ts`; c'est la tranche la plus autonome.
2. Pour WebFetch, copier `WebFetchTool.ts`, `utils.ts`, `preapproved.ts` puis remplacer `getURLMarkdownContent` et `queryHaiku` par vos backends.
3. Pour WebSearch, reutiliser le schema et le post-traitement (`makeToolSchema`, `makeOutputFromSearchResponse`, `mapToolResultToToolResultBlockParam`) mais prevoir de rebrancher totalement le provider.

## reusable features
- Bash safety rails - Validation shell, read-only, validation de chemins, `sed -i` parsing et avertissements destructifs. (reuse: haute, coupling: moyenne)
- PowerShell safety rails - Parseur PowerShell, allowlist read-only, validation de chemins, matching case-insensitive et garde-fous script/cmdlet. (reuse: haute, coupling: moyenne)
- File edit pipeline - Schemas d'edition, patch/snippet helpers, stale-write guards et previews de diff. (reuse: haute, coupling: moyenne)
- Web/search tools - Grep/Glob tres extractibles; WebFetch partiellement extractible; WebSearch surtout utile comme faccade contractuelle. (reuse: haute, coupling: faible a moyenne)

## do not copy blindly
- `src/tools/BashTool/shouldUseSandbox.ts`
  - Ce n'est pas la frontiere de securite. Copier seulement cela donne une fausse impression de protection.
- `src/tools/BashTool/bashSecurity.ts`
  - `bashCommandIsSafe_DEPRECATED` n'est pas la source moderne de verite.
- `src/tools/BashTool/BashTool.tsx` et `src/tools/PowerShellTool/PowerShellTool.tsx`
  - Trop orchestration-heavy pour une premiere extraction; extraire d'abord les validateurs et parseurs.
- `src/tools/PowerShellTool/PowerShellTool.tsx:isReadOnly`
  - Precheck synchrone seulement; la vraie decision read-only complete vit dans le flux async de permission.
- `src/tools/FileEditTool/FileEditTool.ts`, `src/tools/FileWriteTool/FileWriteTool.ts`, `src/tools/NotebookEditTool/NotebookEditTool.ts`
  - Sans `readFileState`, vous perdez la garantie anti-stale.
- `src/tools/WebFetchTool/preapproved.ts`
  - La liste preapproved n'est pas une allowlist reseau generale.
- `src/tools/WebSearchTool/WebSearchTool.ts`
  - Le coeur utile n'est pas le transport interne vers le modele, mais la forme du contrat et le post-traitement.
- `src/components/permissions/**`
  - Haute valeur UX, mais couplage fort a Ink/React, au format `PermissionResult` et a la persistance de settings.

## copy risk
Valeur tres haute, mais les couplages dangereux sont: format de regles de permission, `readFileState`, bridge `exec(...)`, parseurs shell, et APIs internes web/modeles. Extraire par noyaux statiques d'abord, puis rebrancher le runtime.

## exact search shortcuts
- `rg -n "ToolPermissionContext|ToolUseContext|buildTool|getAllBaseTools|assembleToolPool|getMergedTools" src/Tool.ts src/tools.ts`
- `rg -n "bashToolHasPermission|bashToolCheckPermission|checkReadOnlyConstraints|checkPathConstraints|parseSedEditCommand|checkSedConstraints" src/tools/BashTool src/utils/bash`
- `rg -n "stripSafeWrappers|stripAllLeadingEnvVars|BINARY_HIJACK_VARS|isNormalizedGitCommand|commandHasAnyCd" src/tools/BashTool/bashPermissions.ts`
- `rg -n "powershellToolHasPermission|powershellToolCheckPermission|isReadOnlyCommand|isAllowlistedCommand|checkPathConstraints|powershellCommandIsSafe" src/tools/PowerShellTool src/utils/powershell`
- `rg -n "deriveSecurityFlags|getFileRedirections|getVariablesByScope|hasDirectoryChange|COMMON_ALIASES" src/utils/powershell/parser.ts`
- `rg -n "FileEditTool|FileWriteTool|NotebookEditTool|readFileState|writeTextContent|parseCellId" src/tools/FileEditTool src/tools/FileWriteTool src/tools/NotebookEditTool`
- `rg -n "applyEditToFile|getPatchForEdit|getPatchForEdits|getSnippetForPatch|getEditsForPatch|normalizeFileEditInput" src/tools/FileEditTool/utils.ts`
- `rg -n "checkReadPermissionForTool|checkWritePermissionForTool|matchingRuleForInput|pathInAllowedWorkingPath|applyPermissionUpdate|applyPermissionUpdates" src/utils/permissions`
- `rg -n "permissionComponentForTool|BashPermissionRequest|PowerShellPermissionRequest|WebFetchPermissionRequest|FilePermissionDialog" src/components/permissions`
- `rg -n "FileReadTool|registerFileReadListener|readImageWithTokenBudget|file_unchanged|BLOCKED_DEVICE_PATHS" src/tools/FileReadTool`
- `rg -n "GrepTool|output_mode|head_limit|ripGrep|getFileReadIgnorePatterns|normalizePatternsToPath" src/tools/GrepTool src/utils/ripgrep.ts`
- `rg -n "GlobTool|truncated|glob\\(" src/tools/GlobTool src/utils/glob.ts`
- `rg -n "WebFetchTool|getURLMarkdownContent|applyPromptToMarkdown|validateURL|checkDomainBlocklist|isPermittedRedirect|PREAPPROVED_HOSTS" src/tools/WebFetchTool`
- `rg -n "WebSearchTool|makeToolSchema|max_uses|queryModelWithStreaming|web_search_tool_result|mapToolResultToToolResultBlockParam" src/tools/WebSearchTool`

## search hints
- `getAllBaseTools`
- `bashPermissions`
- `powershellPermissions`
- `readFileState`
- `getURLMarkdownContent`
