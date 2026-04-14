---
batch_id: B06
title: REPL & UI shell
paths:
  - src/replLauncher.tsx
  - src/dialogLaunchers.tsx
  - src/interactiveHelpers.tsx
  - src/screens/**
  - src/components/**
  - src/hooks/**
  - src/context/**
  - src/history.ts
priority: moyenne
status: enriched
keywords:
  - REPL.tsx
  - PromptInput
  - Messages.tsx
  - Dialog
  - PermissionPrompt
  - useVirtualScroll
---

# B06 - REPL & UI shell

## Resume
- Couverture: 444 fichiers / 95723 lignes.
- Sous-systemes dominants: components/root (107), hooks/root (78), components/messages (41), components/permissions (39), components/PromptInput (21), components/design-system (16).
- Hubs: src/screens/REPL.tsx - 3 dependants, src/components/Settings/Config.tsx - 1 dependants, src/hooks/useVoice.ts - 2 dependants, src/components/VirtualMessageList.tsx - 2 dependants, src/components/tasks/RemoteSessionDetailDialog.tsx - 1 dependants, src/components/Messages.tsx - 2 dependants.
- La couche "UI shell" n'est pas un bloc unique reutilisable. Elle se separe en trois slices vraiment extractibles:
  - `wizard_shell_primitives`
  - `terminal_text_input_primitives`
  - `terminal_message_primitives`
- Les meilleures cibles de copie sont petites et profondes: `src/components/design-system/Dialog.tsx`, `src/components/wizard/*`, `src/components/BaseTextInput.tsx`, `src/hooks/useSearchInput.ts`, `src/hooks/useVirtualScroll.ts`, `src/components/Markdown.tsx`, `src/components/MessageResponse.tsx`, `src/components/CustomSelect/select.tsx`.
- Les pires cibles de copie sont les shells d'integration: `src/screens/REPL.tsx` (5006 lignes / 235 deps internes), `src/components/PromptInput/PromptInput.tsx` (2339 lignes), `src/components/Messages.tsx` (40 deps internes), `src/components/permissions/PermissionRequest.tsx`.

## purpose
Cartographier le shell terminal de conversation en separant:
- UI pure
- UI + state coupling
- runtime-adjacent

L'objectif pratique est de savoir quoi copier pour reconstruire un agent terminal minimal sans embarquer tout `src/ink/**`, tout `src/screens/REPL.tsx`, ni les schemas runtime Claude/Tool.

## entrypoints
- `src/replLauncher.tsx` -> `launchRepl(root, appProps, replProps, renderAndRun)`
- `src/screens/REPL.tsx` -> `REPL`, `Props`, `Screen`
- `src/components/Messages.tsx` -> `Messages`, `filterForBriefTool`, `dropTextInBriefTurns`, `computeSliceStart`, `shouldRenderStatically`
- `src/components/PromptInput/PromptInput.tsx` -> integration shell du prompt
- `src/components/permissions/PermissionRequest.tsx` -> routeur des permission requests par `Tool`
- `src/dialogLaunchers.tsx` -> `launchSnapshotUpdateDialog`, `launchInvalidSettingsDialog`, `launchAssistantSessionChooser`, `launchAssistantInstallWizard`, `launchTeleportResumeWrapper`, `launchTeleportRepoMismatchDialog`, `launchResumeChooser`
- `src/interactiveHelpers.tsx` -> `showDialog`, `showSetupDialog`, `renderAndRun`, `showSetupScreens`, `getRenderContext`

## key files
| Path | Symbols | Class | Reuse verdict |
| --- | --- | --- | --- |
| `src/screens/REPL.tsx` | `REPL`, `Props`, `Screen` | UI + state coupling | shell principal, a lire mais a ne pas copier |
| `src/components/PromptInput/PromptInput.tsx` | composant par defaut | runtime-adjacent | map d'integration, pas tranche minimale |
| `src/components/Messages.tsx` | `Messages`, `computeSliceStart`, `shouldRenderStatically` | UI + state coupling | orchestration de transcript, schema-coupled |
| `src/components/Message.tsx` | `Message`, `hasThinkingContent`, `areMessagePropsEqual` | UI + state coupling | dispatcher de types de messages |
| `src/components/MessageRow.tsx` | `MessageRow`, `isMessageStreaming`, `allToolsResolved` | UI + state coupling | row orchestration, schema-coupled |
| `src/components/VirtualMessageList.tsx` | `StickyPrompt`, `JumpHandle`, `VirtualMessageList` | UI + state coupling | reusable avec adaptation du type de message |
| `src/hooks/useVirtualScroll.ts` | `VirtualScrollResult`, `useVirtualScroll` | UI pure | hook de virtualisation le plus portable du batch |
| `src/components/Markdown.tsx` | `Markdown`, `StreamingMarkdown` | UI pure | rendu markdown terminal hautement reusable |
| `src/components/MessageResponse.tsx` | `MessageResponse` | UI pure | chrome de reponse assistant tres portable |
| `src/components/BaseTextInput.tsx` | `BaseTextInput` | UI pure | noyau d'affichage input terminal |
| `src/hooks/useTextInput.ts` | `UseTextInputProps`, `useTextInput` | UI + state coupling | puissant mais lie a l'historique et aux notifications |
| `src/hooks/useSearchInput.ts` | `useSearchInput` | UI pure | excellent petit hook de search box |
| `src/components/design-system/Dialog.tsx` | `Dialog` | UI pure | chrome de dialog portable |
| `src/components/wizard/WizardProvider.tsx` | `WizardContext`, `WizardProvider` | UI + state coupling | state machine de wizard reusable |
| `src/components/wizard/WizardDialogLayout.tsx` | `WizardDialogLayout` | UI + state coupling | layout standard pour wizard |
| `src/components/CustomSelect/select.tsx` | `OptionWithDescription`, `Select` | UI + state coupling | primitive de select terminal tres structurante |
| `src/components/permissions/PermissionDialog.tsx` | `PermissionDialog` | UI pure | chrome permission facile a exporter |
| `src/components/permissions/PermissionPrompt.tsx` | `PermissionPrompt`, `PermissionPromptOption` | UI + state coupling | prompt de choix reusable avec leger nettoyage |
| `src/context/promptOverlayContext.tsx` | `PromptOverlayProvider`, `useSetPromptOverlay*` | UI + state coupling | canal de rendu au-dessus du prompt |
| `src/context/overlayContext.tsx` | `useRegisterOverlay`, `useIsOverlayActive`, `useIsModalOverlayActive` | UI + state coupling | coordination Escape/focus, mais `AppState`-coupled |

## data flow
1. `src/replLauncher.tsx` charge `src/components/App.js` + `src/screens/REPL.js`, puis delegue le lifecycle a `renderAndRun()`.
2. `src/screens/REPL.tsx` orchestre l'etat de session, l'ecran courant (`prompt` ou `transcript`), le prompt, les overlays, les permissions, la voix, les sessions distantes et les taches de fond.
3. `src/components/Messages.tsx` transforme la liste de `RenderableMessage`, choisit rendu statique vs virtualise, puis enchaine `MessageRow` -> `Message` -> composants feuilles dans `src/components/messages/**`.
4. Les feuilles visuelles les plus utiles sont `src/components/MessageResponse.tsx` et `src/components/Markdown.tsx`; la liste scalable repose sur `src/components/VirtualMessageList.tsx` + `src/hooks/useVirtualScroll.ts`.
5. `src/components/PromptInput/PromptInput.tsx` assemble `TextInput` / `VimTextInput`, `useTextInput`, `useTypeahead`, `useHistorySearch`, `usePromptSuggestion`, `PromptInputFooterSuggestions`, et les contexts d'overlay.
6. `src/components/permissions/PermissionRequest.tsx` mappe un `Tool` concret vers un composant de permission specialise, souvent emballe dans `PermissionDialog` + `PermissionPrompt`.
7. `src/dialogLaunchers.tsx` et `src/interactiveHelpers.tsx` couvrent les dialogues hors-REPL avec le meme wrapping `AppStateProvider` + `KeybindingSetup`.

## external deps
- Ink UI
- `src/ink.ts` + `src/ink/**`
- keybindings (`src/keybindings/useKeybinding.ts`, `src/keybindings/KeybindingProviderSetup.tsx`)
- `src/state/AppState.tsx` / `src/state/AppStateStore.ts`
- `marked` pour `src/components/Markdown.tsx`
- `bun:bundle` feature gates dans les shells d'integration
- analytics / GrowthBook dans `REPL.tsx`, `PermissionPrompt.tsx`, `useGlobalKeybindings.tsx`, `usePromptSuggestion.ts`

## flags/env
- `src/screens/REPL.tsx`: `AGENT_TRIGGERS`, `AWAY_SUMMARY`, `BG_SESSIONS`, `BRIDGE_MODE`, `BUDDY`, `COMMIT_ATTRIBUTION`, `CONTEXT_COLLAPSE`, `COORDINATOR_MODE`, `HOOK_PROMPTS`, `KAIROS`, `MESSAGE_ACTIONS`, `PROACTIVE`, `TOKEN_BUDGET`, `TRANSCRIPT_CLASSIFIER`, `ULTRAPLAN`, `VOICE_MODE`, `WEB_BROWSER_TOOL`
- `src/components/PromptInput/PromptInput.tsx`: `BUDDY`, `HISTORY_PICKER`, `KAIROS`, `KAIROS_BRIEF`, `QUICK_SEARCH`, `TOKEN_BUDGET`, `TRANSCRIPT_CLASSIFIER`, `ULTRAPLAN`
- `src/components/Messages.tsx`: `KAIROS`, `KAIROS_BRIEF`, `PROACTIVE`
- `src/components/Message.tsx`: `CONNECTOR_TEXT`, `HISTORY_SNIP`
- `src/components/permissions/PermissionRequest.tsx`: `WORKFLOW_SCRIPTS`
- `src/hooks/useGlobalKeybindings.tsx`: `KAIROS`, `KAIROS_BRIEF`, `TERMINAL_PANEL`

Lecture extraction:
- Si une brique touche `VOICE_MODE`, `ULTRAPLAN`, `PROACTIVE`, `WORKFLOW_SCRIPTS` ou `MESSAGE_ACTIONS`, elle est en general runtime-adjacent.
- Les bons candidats de copie n'ont souvent aucun flag, ou seulement un flag de presentation.

## subdomains

### REPL screen
**Pure UI**
- `src/replLauncher.tsx` -> `launchRepl()`: simple lazy launcher `App + REPL`.

**UI + state coupling**
- `src/screens/REPL.tsx` -> `REPL`, `Props`, `Screen`
- `src/hooks/useGlobalKeybindings.tsx` -> `GlobalKeybindingHandlers`
- `src/hooks/useBackgroundTaskNavigation.ts` -> `useBackgroundTaskNavigation`

**Runtime-adjacent**
- `src/interactiveHelpers.tsx` -> `renderAndRun()`, `showSetupScreens()`, `getRenderContext()`
- `src/dialogLaunchers.tsx` -> `launchResumeChooser()` charge `ResumeConversation` + `App`

**Why it matters**
- `REPL.tsx` est le point ou convergent messages, prompt, permissions, transcript, sessions distantes, teammates, voix, hooks background.
- C'est un excellent fichier de cartographie, mais une mauvaise extraction directe.

**Extraction verdict**
- Copier `REPL.tsx` vers un autre terminal agentique = effort tres haut.
- Copier le pattern `launchRepl() + renderAndRun()` = effort faible.

### message rendering
**Pure UI**
- `src/components/MessageResponse.tsx` -> `MessageResponse`
- `src/components/Markdown.tsx` -> `Markdown`, `StreamingMarkdown`
- `src/context/QueuedMessageContext.tsx` -> `QueuedMessageProvider`, `useQueuedMessage`

**UI + state coupling**
- `src/hooks/useVirtualScroll.ts` -> `useVirtualScroll`
- `src/components/VirtualMessageList.tsx` -> `StickyPrompt`, `JumpHandle`, `VirtualMessageList`
- `src/components/Messages.tsx` -> `Messages`, `filterForBriefTool`, `dropTextInBriefTurns`, `computeSliceStart`, `shouldRenderStatically`
- `src/components/MessageRow.tsx` -> `MessageRow`, `isMessageStreaming`, `allToolsResolved`
- `src/components/Message.tsx` -> `Message`, `hasThinkingContent`, `areMessagePropsEqual`

**Runtime-adjacent**
- `src/components/messages/**` -> sous-types Claude/tool/result/thinking/attachment
- `src/components/permissions/PermissionRequest.tsx` est injecte inline par `Messages.tsx`

**Most reusable parts**
- `MessageResponse`: gutter assistant + protection contre les chevrons imbriques
- `Markdown` / `StreamingMarkdown`: rendu markdown terminal avec cache de tokens et streaming incremental
- `useVirtualScroll`: virtualisation generique, independante du schema Claude

**Main blockers**
- `src/types/message.ts`
- `src/utils/messages.ts`
- `src/components/messageActions.tsx`
- `src/utils/transcriptSearch.ts`
- `src/Tool.ts`, `src/commands.ts`

### prompt input
**Pure UI**
- `src/components/BaseTextInput.tsx` -> `BaseTextInput`
- `src/components/PromptInput/PromptInputFooterSuggestions.tsx` -> `SuggestionItem`, `SuggestionType`, `OVERLAY_MAX_ITEMS`, `PromptInputFooterSuggestions`
- `src/components/PromptInput/inputModes.ts` -> `prependModeCharacterToInput`, `getModeFromInput`, `getValueFromInput`, `isInputModeCharacter`

**UI + state coupling**
- `src/components/TextInput.tsx` -> wrapper standard autour de `useTextInput`
- `src/components/VimTextInput.tsx` -> variante vim-mode
- `src/hooks/useTextInput.ts` -> `UseTextInputProps`, `useTextInput`
- `src/hooks/useSearchInput.ts` -> `useSearchInput`
- `src/hooks/useHistorySearch.ts` -> `useHistorySearch`

**Runtime-adjacent**
- `src/components/PromptInput/PromptInput.tsx`
- `src/hooks/useTypeahead.tsx`
- `src/hooks/usePromptSuggestion.ts`
- `src/hooks/useCommandQueue.ts`
- `src/context/notifications.tsx`

**Most reusable parts**
- `useSearchInput` est la plus petite extraction viable pour une search box terminale.
- `BaseTextInput + useTextInput + inputModes` composent un bon noyau de prompt editor.
- `PromptInputFooterSuggestions` est un bon overlay visuel si le systeme de completion est remplace.

**Main blockers**
- `src/utils/Cursor.ts`
- `src/history.ts`
- `src/context/notifications.tsx`
- `src/types/textInputTypes.ts`
- `src/utils/imageResizer.ts`
- `src/hooks/useTypeahead.tsx` depend de commandes, suggestions shell, agents, overlay state, analytics

### dialogs/wizards
**Pure UI**
- `src/components/design-system/Dialog.tsx` -> `Dialog`
- `src/components/permissions/PermissionDialog.tsx` -> `PermissionDialog`
- `src/components/wizard/WizardNavigationFooter.tsx` -> `WizardNavigationFooter`

**UI + state coupling**
- `src/components/wizard/WizardProvider.tsx` -> `WizardContext`, `WizardProvider`
- `src/components/wizard/useWizard.ts` -> `useWizard`
- `src/components/wizard/WizardDialogLayout.tsx` -> `WizardDialogLayout`
- `src/components/CustomSelect/select.tsx` -> `OptionWithDescription`, `Select`
- `src/components/CustomSelect/SelectMulti.tsx` -> `SelectMulti`
- `src/components/design-system/FuzzyPicker.tsx` -> `FuzzyPicker`
- `src/context/modalContext.tsx` -> `ModalContext`, `useIsInsideModal`, `useModalOrTerminalSize`, `useModalScrollRef`
- `src/context/promptOverlayContext.tsx` -> `PromptOverlayProvider`, `usePromptOverlay`, `usePromptOverlayDialog`, `useSetPromptOverlay`, `useSetPromptOverlayDialog`
- `src/context/overlayContext.tsx` -> `useRegisterOverlay`, `useIsOverlayActive`, `useIsModalOverlayActive`

**Runtime-adjacent**
- `src/dialogLaunchers.tsx`
- `src/interactiveHelpers.tsx` -> `showSetupScreens()` et tout le flow onboarding/setup

**Most reusable parts**
- `Dialog` est le meilleur chrome de dialog du repo.
- `WizardProvider + useWizard + WizardDialogLayout` donnent une vraie mini-state-machine de wizard.
- `Select` / `SelectMulti` sont les primitives de navigation/selection les plus reutilisables pour des dialogs terminal.

**Main blockers**
- `src/hooks/useExitOnCtrlCDWithKeybindings.ts`
- `src/keybindings/useKeybinding.ts`
- `src/state/AppState.tsx` pour `overlayContext`
- `src/utils/config.ts` et `src/utils/imageResizer.ts` tires par `Select`
- `src/ink/instances.ts` pour l'invalidation de frame dans `overlayContext`

### permission UI
**Pure UI**
- `src/components/permissions/PermissionDialog.tsx` -> `PermissionDialog`

**UI + state coupling**
- `src/components/permissions/PermissionPrompt.tsx` -> `PermissionPrompt`, `PermissionPromptOption`, `ToolAnalyticsContext`
- `src/components/permissions/FilePermissionDialog/FilePermissionDialog.tsx` -> chrome specialise, plus couple
- `src/components/permissions/AskUserQuestionPermissionRequest/**` -> shell de questionnaire, mais tres branche sur plan/preview/image

**Runtime-adjacent**
- `src/components/permissions/PermissionRequest.tsx`
- `src/components/permissions/BashPermissionRequest/**`
- `src/components/permissions/PowerShellPermissionRequest/**`
- `src/components/permissions/FileEditPermissionRequest/**`
- `src/components/permissions/WebFetchPermissionRequest/**`
- `src/components/permissions/SkillPermissionRequest/**`
- `src/components/permissions/EnterPlanModePermissionRequest/**`
- `src/components/permissions/ExitPlanModePermissionRequest/**`

**Important boundary**
- La securisation PowerShell n'est pas dans cette couche UI.
- Ici: `src/components/permissions/PowerShellPermissionRequest/PowerShellPermissionRequest.tsx` ne fait que la presentation/decision.
- La vraie safety layer est dans B03: `src/tools/PowerShellTool/PowerShellTool.tsx`, `src/tools/PowerShellTool/powershellSecurity.ts`, `src/tools/PowerShellTool/pathValidation.ts`, `src/tools/PowerShellTool/modeValidation.ts`, `src/tools/PowerShellTool/destructiveCommandWarning.ts`, `src/tools/PowerShellTool/powershellPermissions.ts`.

### supporting hooks/contexts
**Pure UI**
- `src/context/modalContext.tsx`
- `src/context/QueuedMessageContext.tsx`
- `src/hooks/useTerminalSize.ts`

**UI + state coupling**
- `src/context/promptOverlayContext.tsx`
- `src/context/overlayContext.tsx`
- `src/context/notifications.tsx`

**Runtime-adjacent**
- `src/hooks/useBackgroundTaskNavigation.ts`
- `src/hooks/useGlobalKeybindings.tsx`
- `src/hooks/useCommandQueue.ts`
- `src/hooks/usePromptSuggestion.ts`

**Extraction note**
- Ces hooks/contextes structurent le shell plus qu'ils n'ajoutent de la presentation.
- Les plus exportables sont `modalContext`, `promptOverlayContext`, `useTerminalSize`.

## feature inventory
| Feature | Files | Class | Reuse | Coupling | Extraction difficulty |
| --- | --- | --- | --- | --- | --- |
| `wizard_shell_primitives` | `src/components/design-system/Dialog.tsx`, `src/components/wizard/*`, `src/context/modalContext.tsx`, `src/context/promptOverlayContext.tsx` | mixte | haute | moyenne | moyenne |
| `terminal_text_input_primitives` | `src/components/BaseTextInput.tsx`, `src/components/TextInput.tsx`, `src/components/VimTextInput.tsx`, `src/hooks/useTextInput.ts`, `src/hooks/useSearchInput.ts`, `src/components/PromptInput/inputModes.ts`, `src/components/PromptInput/PromptInputFooterSuggestions.tsx` | mixte | haute | moyenne | moyenne |
| `terminal_message_primitives` | `src/components/MessageResponse.tsx`, `src/components/Markdown.tsx`, `src/components/MarkdownTable.tsx`, `src/hooks/useVirtualScroll.ts`, `src/components/VirtualMessageList.tsx` | mixte | haute | moyenne | moyenne |
| `permission_prompt_chrome` | `src/components/permissions/PermissionDialog.tsx`, `src/components/permissions/PermissionPrompt.tsx`, `src/components/CustomSelect/select.tsx` | mixte | moyenne | moyenne | moyenne |
| `overlay_prompt_channels` | `src/context/promptOverlayContext.tsx`, `src/context/overlayContext.tsx` | UI + state coupling | moyenne | moyenne | moyenne |

## symbol map
| Path | Symbols to anchor on | Why it matters |
| --- | --- | --- |
| `src/replLauncher.tsx` | `launchRepl` | minimal REPL boot wrapper |
| `src/screens/REPL.tsx` | `REPL`, `Screen` | main shell entrypoint |
| `src/interactiveHelpers.tsx` | `showDialog`, `showSetupDialog`, `renderAndRun`, `showSetupScreens`, `getRenderContext` | lifecycle + one-off dialog launch |
| `src/dialogLaunchers.tsx` | `launchSnapshotUpdateDialog`, `launchAssistantInstallWizard`, `launchResumeChooser` | thin launcher pattern |
| `src/components/Messages.tsx` | `Messages`, `computeSliceStart`, `shouldRenderStatically` | transcript orchestration |
| `src/components/Message.tsx` | `Message`, `hasThinkingContent`, `areMessagePropsEqual` | message dispatcher |
| `src/components/MessageRow.tsx` | `MessageRow`, `isMessageStreaming`, `allToolsResolved` | row-level orchestration |
| `src/components/MessageResponse.tsx` | `MessageResponse` | assistant response chrome |
| `src/components/Markdown.tsx` | `Markdown`, `StreamingMarkdown` | reusable markdown renderer |
| `src/components/VirtualMessageList.tsx` | `StickyPrompt`, `JumpHandle`, `VirtualMessageList`, `stickyPromptText` | scalable transcript list |
| `src/hooks/useVirtualScroll.ts` | `VirtualScrollResult`, `useVirtualScroll` | virtualization core |
| `src/components/BaseTextInput.tsx` | `BaseTextInput` | rendering-only input core |
| `src/components/TextInput.tsx` | `TextInput` default export | standard prompt input wrapper |
| `src/components/VimTextInput.tsx` | `Props` | vim-oriented wrapper |
| `src/hooks/useTextInput.ts` | `UseTextInputProps`, `useTextInput` | terminal line editor core |
| `src/hooks/useSearchInput.ts` | `useSearchInput` | search box micro-slice |
| `src/components/PromptInput/inputModes.ts` | `prependModeCharacterToInput`, `getModeFromInput`, `getValueFromInput`, `isInputModeCharacter` | prompt mode helpers |
| `src/components/PromptInput/PromptInputFooterSuggestions.tsx` | `SuggestionItem`, `SuggestionType`, `OVERLAY_MAX_ITEMS`, `PromptInputFooterSuggestions` | overlay suggestion list |
| `src/components/design-system/Dialog.tsx` | `Dialog` | dialog chrome |
| `src/components/wizard/WizardProvider.tsx` | `WizardContext`, `WizardProvider` | wizard state |
| `src/components/wizard/useWizard.ts` | `useWizard` | wizard consumer API |
| `src/components/wizard/WizardDialogLayout.tsx` | `WizardDialogLayout` | reusable wizard frame |
| `src/components/CustomSelect/select.tsx` | `OptionWithDescription`, `Select` | choice/input select primitive |
| `src/components/CustomSelect/SelectMulti.tsx` | `SelectMultiProps`, `SelectMulti` | multi-select primitive |
| `src/components/design-system/FuzzyPicker.tsx` | `FuzzyPicker` | searchable picker built on `useSearchInput` |
| `src/components/permissions/PermissionDialog.tsx` | `PermissionDialog` | permission shell |
| `src/components/permissions/PermissionPrompt.tsx` | `PermissionPrompt`, `PermissionPromptOption`, `ToolAnalyticsContext` | decision UI with optional feedback |
| `src/components/permissions/PermissionRequest.tsx` | `PermissionRequest` | tool dispatcher |
| `src/context/promptOverlayContext.tsx` | `PromptOverlayProvider`, `usePromptOverlay`, `usePromptOverlayDialog`, `useSetPromptOverlay`, `useSetPromptOverlayDialog` | prompt-area overlay channel |
| `src/context/overlayContext.tsx` | `useRegisterOverlay`, `useIsOverlayActive`, `useIsModalOverlayActive` | Escape/focus coordination |
| `src/context/modalContext.tsx` | `ModalContext`, `useModalOrTerminalSize`, `useModalScrollRef` | modal layout sizing |
| `src/context/notifications.tsx` | `useNotifications`, `getNext` | notification queue used by prompt and shell |

## dependency map
### Pure UI foundation
- `src/components/MessageResponse.tsx` -> depends only on `src/ink.ts` and `src/components/design-system/Ratchet.tsx`
- `src/components/Markdown.tsx` -> depends on `marked`, `src/utils/markdown.ts`, `src/utils/cliHighlight.ts`, `src/hooks/useSettings.ts`
- `src/hooks/useVirtualScroll.ts` -> depends on React + `ScrollBoxHandle` + `DOMElement`
- `src/components/design-system/Dialog.tsx` -> depends on keybindings and `Pane`/`Byline`
- `src/context/modalContext.tsx` -> depends only on React + `ScrollBoxHandle`

### Prompt slice blockers
- `src/utils/Cursor.ts` is the hidden heavy dependency behind `useTextInput.ts` and `useSearchInput.ts`
- `src/history.ts` and `addToHistory()` are baked into `useTextInput.ts`
- `src/context/notifications.tsx` is also baked into `useTextInput.ts`
- `src/utils/imageResizer.ts` and paste flows appear in `TextInput.tsx`, `Select.tsx`, `SelectMulti.tsx`
- `src/hooks/useTypeahead.tsx` couples prompt UI to commands, shell completion, agent lists, session history, analytics, overlays

### Message slice blockers
- `src/types/message.ts` / `RenderableMessage` shape
- `src/utils/messages.ts`
- `src/components/messageActions.tsx`
- `src/utils/transcriptSearch.ts`
- `src/Tool.ts` and tool-specific prompt modules imported by `Messages.tsx`
- compact/brief logic in `src/services/compact/**` and `src/tools/BriefTool/**`

### Dialog/wizard slice blockers
- `src/keybindings/useKeybinding.ts`
- `src/hooks/useExitOnCtrlCDWithKeybindings.ts`
- `src/state/AppState.tsx` for `overlayContext` and setup dialog wrappers
- `src/ink/instances.ts` for frame invalidation on overlay close
- `src/components/CustomSelect/use-select-input.ts` and `src/components/CustomSelect/use-multi-select-state.ts` both register overlays

### Permission slice blockers
- `src/Tool.ts` and concrete tool classes imported by `PermissionRequest.tsx`
- `src/utils/permissions/PermissionResult.ts`, `PermissionDecision`, permission update flows
- analytics in `PermissionPrompt.tsx`
- file-diff/IDE support in `src/components/permissions/FilePermissionDialog/**`

### Runtime boundaries worth remembering
- UI permission prompts live in B06; the actual Bash/PowerShell/file safety logic lives in B03 tool code.
- Dialog launch patterns live here; trust/onboarding/session bootstrap decisions are B01.
- Task/team/background navigation hooks inside REPL depend heavily on B04 teammate runtime.

## extraction recipes
### Copy plan: prompt input
- Smallest useful slice for a search box:
  - `src/hooks/useSearchInput.ts`
  - `src/utils/Cursor.ts`
  - `src/hooks/useTerminalSize.ts`
- Smallest useful slice for a real prompt editor:
  - `src/components/BaseTextInput.tsx`
  - `src/hooks/useTextInput.ts`
  - `src/components/TextInput.tsx` or `src/components/VimTextInput.tsx`
  - `src/components/PromptInput/inputModes.ts`
  - `src/types/textInputTypes.ts`
  - `src/utils/Cursor.ts`
  - `src/hooks/renderPlaceholder.ts`
  - `src/hooks/usePasteHandler.ts`
  - `src/ink/hooks/use-declared-cursor.ts`
- Optional overlay completion UI:
  - `src/components/PromptInput/PromptInputFooterSuggestions.tsx`
  - `src/context/promptOverlayContext.tsx`
- Replace or stub first:
  - `useNotifications()`
  - `addToHistory()`
  - `markBackslashReturnUsed()`
  - env/fullscreen checks in `useTextInput.ts`
- Do not start from `src/components/PromptInput/PromptInput.tsx` unless you also want MCP, teammate, quick-search, ultraplan, prompt suggestion, history dialog, background tasks, image paste, and permission mode transitions.

### Copy plan: messages UI
- Smallest useful rendering slice:
  - `src/components/MessageResponse.tsx`
  - `src/components/Markdown.tsx`
  - `src/components/MarkdownTable.tsx`
  - `src/components/design-system/Ratchet.tsx`
- Scalable transcript slice:
  - `src/hooks/useVirtualScroll.ts`
  - `src/components/VirtualMessageList.tsx`
  - plus your own `itemKey()`, `renderItem()`, `extractSearchText()`
- Replace or stub first:
  - `RenderableMessage`
  - `messageActions` integration
  - search text extraction
  - `ScrollBoxHandle` and `DOMElement` plumbing
- Do not copy `src/components/Messages.tsx` or `src/components/Message.tsx` blindly unless your runtime message schema matches the Claude/tool/result model.

### Copy plan: dialog/wizard shell
- Smallest useful dialog shell:
  - `src/components/design-system/Dialog.tsx`
  - `src/components/wizard/WizardProvider.tsx`
  - `src/components/wizard/useWizard.ts`
  - `src/components/wizard/WizardDialogLayout.tsx`
  - `src/components/wizard/WizardNavigationFooter.tsx`
  - `src/context/modalContext.tsx`
- Choice UI add-on:
  - `src/components/CustomSelect/select.tsx`
  - `src/components/CustomSelect/SelectMulti.tsx`
  - `src/components/design-system/FuzzyPicker.tsx`
- Launcher shell:
  - `src/interactiveHelpers.tsx` -> `showDialog`, `showSetupDialog`, `renderAndRun`
  - `src/dialogLaunchers.tsx` for dynamic-import patterns
- Replace or stub first:
  - `AppStateProvider`
  - `KeybindingSetup`
  - overlay registration if your host shell handles Escape differently

### Copy plan: permission prompt chrome
- Minimal UI subset:
  - `src/components/permissions/PermissionDialog.tsx`
  - `src/components/permissions/PermissionPrompt.tsx`
  - `src/components/CustomSelect/select.tsx`
- Remove or replace:
  - `logEvent(...)`
  - `useSetAppState()`
  - tool-specific analytics context
- Do not bring `src/components/permissions/PermissionRequest.tsx` unless you also copy the corresponding tool contracts and permission result schema.

## minimal reusable slices
| Slice | Files to start with | Blocking deps | Effort |
| --- | --- | --- | --- |
| prompt input | `src/components/BaseTextInput.tsx`, `src/hooks/useTextInput.ts`, `src/components/TextInput.tsx`, `src/components/PromptInput/inputModes.ts`, `src/hooks/useSearchInput.ts` | `Cursor`, history, notifications, textInputTypes | moyenne |
| messages UI | `src/components/MessageResponse.tsx`, `src/components/Markdown.tsx`, `src/components/MarkdownTable.tsx`, `src/hooks/useVirtualScroll.ts` | `ink`, `marked`, optional `ScrollBoxHandle` | faible a moyenne |
| dialog/wizard shell | `src/components/design-system/Dialog.tsx`, `src/components/wizard/*`, `src/context/modalContext.tsx`, `src/interactiveHelpers.tsx` | keybindings, optional AppState wrappers | faible a moyenne |
| permission prompt chrome | `src/components/permissions/PermissionDialog.tsx`, `src/components/permissions/PermissionPrompt.tsx`, `src/components/CustomSelect/select.tsx` | analytics, AppState, image/config types | moyenne |

## reusable ideas
- Reutiliser les primitives profondes, pas les shells: `Dialog`, `WizardProvider`, `BaseTextInput`, `useSearchInput`, `useVirtualScroll`, `Markdown`, `MessageResponse`, `PermissionDialog`.
- Garder `PromptInput.tsx`, `Messages.tsx`, `PermissionRequest.tsx`, `REPL.tsx` comme fichiers de reference d'assemblage.
- Extraire les overlays (`promptOverlayContext`, `overlayContext`) seulement si le nouvel hote terminal a deja une vraie notion de focus modal/non modal.

## reusable features
- `terminal_text_input_primitives` - `BaseTextInput`, `useTextInput`, `useSearchInput`, `PromptInputFooterSuggestions`. (reuse: haute, coupling: moyenne)
- `terminal_message_primitives` - `MessageResponse`, `Markdown`, `useVirtualScroll`, `VirtualMessageList`. (reuse: haute, coupling: moyenne)
- `wizard_shell_primitives` - `Dialog`, `WizardProvider`, `WizardDialogLayout`, `modalContext`, `promptOverlayContext`. (reuse: haute, coupling: moyenne)
- `permission_prompt_chrome` - `PermissionDialog`, `PermissionPrompt`, `Select`. (reuse: moyenne, coupling: moyenne)

## do not copy blindly
- `src/screens/REPL.tsx`: 235 deps internes, flags multiples, forte jonction avec sessions, hooks, teammates, permissions, voice, bridge, compact.
- `src/components/PromptInput/PromptInput.tsx`: prompt shell d'integration, pas composant de base.
- `src/components/Messages.tsx`: melange virtualisation, brief mode, compact, permissions inline, schema message/tool.
- `src/components/Message.tsx` et `src/components/messages/**`: dispatch sur le schema Claude, pas sur un contrat generique.
- `src/components/permissions/PermissionRequest.tsx`: routeur code sur des classes de tools concretes (`BashTool`, `PowerShellTool`, `FileEditTool`, `WebFetchTool`, `SkillTool`, etc.).
- `src/hooks/useTypeahead.tsx`: depend du registry de commandes, du shell completion, de l'etat overlay et de l'analytics.
- `src/context/overlayContext.tsx`: depend de `AppState.activeOverlays` et force `instances.get(process.stdout)?.invalidatePrevFrame()`.
- `src/components/CustomSelect/select.tsx`: excellente primitive, mais elle embarque deja image paste/config types et overlay registration.

## copy risk
Le risque principal n'est pas le rendu terminal, mais les couplages caches:
- schema des messages
- classes de tools
- `AppState`
- keybindings
- analytics/gates
- helpers de curseur/historique

Les slices ci-dessus sont reutilisables si on remplace explicitement ces points par une couche d'adaptation.

## search hints
- `src/screens/REPL.tsx`
- `src/components/PromptInput/PromptInput.tsx`
- `src/components/Messages.tsx`
- `src/components/design-system/Dialog.tsx`
- `src/components/wizard/WizardProvider.tsx`
- `src/components/permissions/PermissionPrompt.tsx`

## exact search shortcuts
- `rg -n "export function REPL|type Screen =|feature\\('VOICE_MODE'|feature\\('MESSAGE_ACTIONS'|feature\\('ULTRAPLAN'" src/screens/REPL.tsx`
- `rg -n "launchRepl|renderAndRun|showDialog|showSetupDialog" src/replLauncher.tsx src/interactiveHelpers.tsx src/dialogLaunchers.tsx`
- `rg -n "export function Messages|computeSliceStart|shouldRenderStatically|PermissionRequest" src/components/Messages.tsx`
- `rg -n "export function MessageResponse|export function Markdown|export function StreamingMarkdown" src/components/MessageResponse.tsx src/components/Markdown.tsx`
- `rg -n "export function VirtualMessageList|export type StickyPrompt|export type JumpHandle" src/components/VirtualMessageList.tsx`
- `rg -n "export function useVirtualScroll|type VirtualScrollResult" src/hooks/useVirtualScroll.ts`
- `rg -n "export function BaseTextInput|export function useTextInput|export function useSearchInput" src/components/BaseTextInput.tsx src/hooks/useTextInput.ts src/hooks/useSearchInput.ts`
- `rg -n "prependModeCharacterToInput|getModeFromInput|getValueFromInput|isInputModeCharacter" src/components/PromptInput/inputModes.ts`
- `rg -n "SuggestionItem|SuggestionType|OVERLAY_MAX_ITEMS|PromptInputFooterSuggestions" src/components/PromptInput/PromptInputFooterSuggestions.tsx`
- `rg -n "export function Dialog|isCancelActive|confirm:no" src/components/design-system/Dialog.tsx`
- `rg -n "WizardProvider|WizardDialogLayout|WizardNavigationFooter|useWizard" src/components/wizard`
- `rg -n "export function PermissionDialog|export function PermissionPrompt|ToolAnalyticsContext" src/components/permissions/PermissionDialog.tsx src/components/permissions/PermissionPrompt.tsx`
- `rg -n "BashTool|PowerShellTool|FileEditTool|WebFetchTool|SkillTool|WORKFLOW_SCRIPTS" src/components/permissions/PermissionRequest.tsx`
- `rg -n "PromptOverlayProvider|useSetPromptOverlay|useSetPromptOverlayDialog" src/context/promptOverlayContext.tsx`
- `rg -n "useRegisterOverlay|useIsOverlayActive|useIsModalOverlayActive|NON_MODAL_OVERLAYS" src/context/overlayContext.tsx`
- `rg -n "OptionWithDescription|export function Select|export function SelectMulti|onInputModeToggle" src/components/CustomSelect`
- `rg -n "useHistorySearch|HISTORY_PICKER|usePromptSuggestion|useCommandQueue" src/hooks/useHistorySearch.ts src/hooks/usePromptSuggestion.ts src/hooks/useCommandQueue.ts`
