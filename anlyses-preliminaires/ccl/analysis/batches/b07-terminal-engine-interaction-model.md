---
batch_id: B07
title: Terminal engine & interaction model
paths:
  - src/ink.ts
  - src/ink/**
  - src/keybindings/**
  - src/vim/**
  - src/native-ts/**
  - src/moreright/**
priority: moyenne
status: enriched
keywords:
  - renderSync
  - parseMultipleKeypresses
  - resolveKeyWithChordState
  - transition
  - createYogaLayoutNode
---

# B07 - Terminal engine & interaction model

## Resume
- Couverture: 121 fichiers / 28725 lignes.
- Sous-systemes dominants: ink/root (43), ink/components (18), keybindings/root (14), ink/hooks (12), ink/events (10), ink/termio (9).
- Hubs structurels:
  - `src/ink.ts` -> 20 dependants internes / 38 imports internes.
  - `src/ink/ink.tsx` -> 31 deps internes directes, vrai orchestrateur runtime.
  - `src/ink/screen.ts` -> 9 dependants internes, coeur buffer/diff.
  - `src/ink/render-node-to-output.ts` -> 14 deps internes, coeur du painter.
  - `src/keybindings/KeybindingProviderSetup.tsx` -> 10 deps internes, shell d'integration.
  - `src/keybindings/resolver.ts` -> entree pure du matching.
  - `src/vim/transitions.ts` -> entree pure de la machine d'etat Vim.
- Ce batch n'est pas une couche unique a recopier telle quelle. Il se separe en 5 briques de valeur:
  - `terminal_rendering_primitives`
  - `terminal_input_parser`
  - `terminal_focus_selection`
  - `keybinding_resolver_core`
  - `vim_interaction_model`
- Meilleures cibles de copie:
  - `src/ink/screen.ts`
  - `src/ink/output.ts`
  - `src/ink/focus.ts`
  - `src/ink/selection.ts`
  - `src/ink/parse-keypress.ts`
  - `src/ink/terminal-querier.ts`
  - `src/keybindings/parser.ts`
  - `src/keybindings/match.ts`
  - `src/keybindings/resolver.ts`
  - `src/vim/types.ts`
  - `src/vim/transitions.ts`
  - `src/vim/motions.ts`
  - `src/vim/operators.ts`
  - `src/vim/textObjects.ts`
- Pires cibles de copie aveugle:
  - `src/ink/ink.tsx`
  - `src/ink/components/App.tsx`
  - `src/ink.ts`
  - `src/keybindings/KeybindingProviderSetup.tsx`
  - `src/keybindings/loadUserBindings.ts`
  - `src/keybindings/defaultBindings.ts`

## purpose
Produire une cartographie exploitable pour extraire plus tard des morceaux precis du moteur terminal, des keybindings et du mode Vim, sans embarquer par erreur le runtime complet Ink/Claude.

Le but pratique n'est pas "comprendre la TUI", mais repondre vite a des questions de copie ciblee:
- quels fichiers prendre pour un resolver de raccourcis avec chords
- quelle est la plus petite extraction viable du mode Vim
- ou sont les primitives de rendu terminal reelles
- ou passent les evenements terminal avant d'arriver au DOM et aux hooks
- quelles parties sont purement UI, runtime, ou simples references

## entrypoints
- `src/ink.ts`
  - facade publique. Re-exporte `render`, `createRoot`, les hooks, les events, `FocusManager`, `measureElement`, `supportsTabStatus`, `wrapText`.
- `src/ink/root.ts`
  - vraies entrees de montage: `renderSync`, `wrappedRender`, `createRoot`.
  - gere la map `instances` par `stdout`.
- `src/ink/ink.tsx`
  - classe `Ink`.
  - orchestre diff frame par frame, alt-screen, selection, surlignage, patch console/stderr, cursor native, drain stdin.
- `src/ink/components/App.tsx`
  - pont TTY/readable/raw-mode -> parseur d'entree -> event emitter -> dispatch DOM -> queries terminales.
- `src/ink/renderer.ts`
  - `createRenderer(node, stylePool)` construit un `Frame` a partir du DOM et du painter.
- `src/ink/parse-keypress.ts`
  - `parseMultipleKeypresses(...)` est l'entree la plus reusable du pipeline d'events terminal.
- `src/ink/terminal-querier.ts`
  - `TerminalQuerier`, `decrqm`, `da1`, `da2`, `kittyKeyboard`, `cursorPosition`, `oscColor`, `xtversion`.
- `src/keybindings/resolver.ts`
  - `resolveKey`, `resolveKeyWithChordState`, `getBindingDisplayText`, `keystrokesEqual`.
- `src/keybindings/KeybindingProviderSetup.tsx`
  - shell d'integration chord + hot reload + interception globale.
- `src/vim/transitions.ts`
  - `transition(state, input, ctx)` est la source de verite du mode NORMAL Vim.
- `src/ink/layout/yoga.ts`
  - `YogaLayoutNode`, `createYogaLayoutNode()`, frontiere entre l'API layout Ink et le port TS de Yoga.

## key files
| Path | Symbols | Class | Reuse verdict |
| --- | --- | --- | --- |
| `src/ink.ts` | `render`, `createRoot`, `useInput`, `useSelection`, `FocusManager` | facade | reference, utile pour comprendre l'API exposee |
| `src/ink/root.ts` | `renderSync`, `createRoot`, `wrappedRender` | runtime shell | reprise partielle |
| `src/ink/ink.tsx` | `Ink`, `onRender`, `enterAlternateScreen`, `copySelection`, `dispatchKeyboardEvent` | orchestrateur | ne pas copier tel quel |
| `src/ink/components/App.tsx` | `App`, `handleReadable`, `processKeysInBatch`, `handleMouseEvent` | runtime shell | reference / integration seulement |
| `src/ink/renderer.ts` | `createRenderer`, `RenderOptions`, `Renderer` | rendering core | reprise partielle |
| `src/ink/render-node-to-output.ts` | `renderNodeToOutput`, `didLayoutShift`, `getScrollHint`, `consumeFollowScroll` | painter | reprise partielle, pas blind copy |
| `src/ink/output.ts` | `Output` | rendering core | bon candidat de copie partielle |
| `src/ink/screen.ts` | `createScreen`, `diff`, `diffEach`, `shiftRows`, `StylePool` | rendering core | excellent candidat de copie |
| `src/ink/parse-keypress.ts` | `parseMultipleKeypresses`, `INITIAL_STATE`, `DECRPM_STATUS` | terminal parser | excellent candidat de copie |
| `src/ink/terminal-querier.ts` | `TerminalQuerier`, `xtversion`, `decrqm`, `oscColor` | terminal helper | copiable presque tel quel |
| `src/ink/focus.ts` | `FocusManager`, `getRootNode`, `getFocusManager` | interaction core | copiable tel quel |
| `src/ink/selection.ts` | `createSelectionState`, `selectWordAt`, `getSelectedText`, `applySelectionOverlay` | interaction core | copiable partiellement avec `screen.ts` |
| `src/keybindings/parser.ts` | `parseKeystroke`, `parseChord`, `parseBindings` | keybinding core | copiable avec petit adapter de types |
| `src/keybindings/match.ts` | `getKeyName`, `matchesKeystroke`, `matchesBinding` | keybinding core | copiable avec adapter `Key` |
| `src/keybindings/resolver.ts` | `resolveKey`, `resolveKeyWithChordState` | keybinding core | excellente slice |
| `src/keybindings/KeybindingContext.tsx` | `KeybindingProvider`, `useRegisterKeybindingContext` | React integration | reprise partielle |
| `src/keybindings/KeybindingProviderSetup.tsx` | `KeybindingSetup`, `ChordInterceptor` | React integration | reference / integration host-specific |
| `src/vim/types.ts` | `VimState`, `CommandState`, `PersistentState`, `createInitialVimState` | vim core | copiable |
| `src/vim/transitions.ts` | `transition`, `TransitionContext` | vim core | copiable |
| `src/vim/motions.ts` | `resolveMotion`, `isInclusiveMotion`, `isLinewiseMotion` | vim core | copiable avec `Cursor` |
| `src/vim/operators.ts` | `executeOperatorMotion`, `executePaste`, `executeOpenLine` | vim core | copiable avec `Cursor` et adapters |
| `src/vim/textObjects.ts` | `findTextObject` | vim core | copiable |
| `src/native-ts/yoga-layout/index.ts` | `Node`, `loadYoga`, `getYogaCounters` | native helper | copiable si besoin explicite de Yoga TS |
| `src/native-ts/color-diff/index.ts` | `ColorDiff`, `ColorFile` | native helper | hors coeur B07, reference |
| `src/native-ts/file-index/index.ts` | `FileIndex`, `yieldToEventLoop` | native helper | utile ailleurs, pas moteur terminal |
| `src/moreright/useMoreRight.tsx` | `useMoreRight` | stub | placeholder seulement |

## data flow
1. `src/ink.ts` expose la facade publique, mais le vrai montage passe par `src/ink/root.ts`.
2. `src/ink/root.ts` cree ou reutilise une instance `Ink` par `stdout`, preserve un microtask boundary, puis delegue les renders a `Ink.render(...)`.
3. `src/ink/ink.tsx` monte `src/ink/components/App.tsx`, maintient `frontFrame`/`backFrame`, selection, search highlight, focus, alt-screen, et declenche `onRender()`.
4. `src/ink/components/App.tsx` active raw mode, bracketed paste, focus reporting, extended keys, puis lit `stdin` en mode `readable`.
5. `src/ink/parse-keypress.ts` + `src/ink/termio/tokenize.ts` transforment les chunks d'entree en `ParsedInput[]`: touches, souris, reponses terminal, paste, focus.
6. `App.tsx` route ces parse events vers:
  - `internal_eventEmitter` (`InputEvent`) pour les hooks `useInput`
  - `dispatchKeyboardEvent` pour le DOM event dispatcher
  - `handleMouseEvent(...)` pour hover/click/selection
  - `TerminalQuerier.onResponse(...)` pour les queries terminales
7. `Ink.onRender()` appelle `renderer(...)`, qui s'appuie sur `renderNodeToOutput(...)`, `Output`, `Screen`, puis applique overlays de selection/search, genere un `diff`, l'optimise, et l'envoie via `writeDiffToTerminal(...)`.
8. `src/keybindings/**` et `src/vim/**` ne pilotent pas le terminal eux-memes: ils vivent au-dessus du pipeline `InputEvent` / `useInput` et consomment deja des frappes normalisees.

## external deps
- React / react-reconciler
- `@alcalzone/ansi-tokenize` pour `src/ink/output.ts` et `src/ink/screen.ts`
- `indent-string`, `chalk`, `cli-boxes` dans la couche de rendering UI
- `diff` + `highlight.js` dans `src/native-ts/color-diff/index.ts`
- `chokidar` dans `src/keybindings/loadUserBindings.ts`
- `semver` dans `src/ink/terminal.ts`
- Node core: `stream`, `buffer`, `fs`, `path`

## flags/env
- `src/keybindings/defaultBindings.ts`
  - `KAIROS`
  - `KAIROS_BRIEF`
  - `MESSAGE_ACTIONS`
  - `QUICK_SEARCH`
  - `TERMINAL_PANEL`
  - `VOICE_MODE`
- `src/keybindings/loadUserBindings.ts`
  - GrowthBook gate `tengu_keybinding_customization_release`
  - user file `~/.claude/keybindings.json`
- `src/ink/components/App.tsx`
  - `CLAUDE_CODE_ACCESSIBILITY`
- `src/ink/terminal.ts`
  - `TERM_PROGRAM`
  - `TERM_PROGRAM_VERSION`
  - `TERM`
  - `TMUX`
  - `WT_SESSION`
  - `KITTY_WINDOW_ID`
  - `ZED_TERM`
  - `VTE_VERSION`
  - `ConEmuANSI`, `ConEmuPID`, `ConEmuTask`
- `src/ink/termio/osc.ts`
  - `TMUX`
  - `STY`
  - `SSH_CONNECTION`
  - `LC_TERMINAL`

Lecture extraction:
- Si une brique depend de `TMUX`, `WT_SESSION`, `TERM_PROGRAM`, `KITTY_WINDOW_ID`, c'est souvent du capability/runtime shell, pas une primitive pure.
- Si une brique depend de `GrowthBook`, `notifications`, `~/.claude`, c'est une integration produit, pas un noyau reutilisable.

## copy verdict
- Copier tel quel:
  - `src/ink/focus.ts`
  - `src/ink/terminal-querier.ts`
  - `src/native-ts/yoga-layout/enums.ts` + `src/native-ts/yoga-layout/index.ts` si vous avez besoin d'un Yoga pure TS synchrone
  - `src/moreright/useMoreRight.tsx` seulement comme no-op placeholder
- Reprendre partiellement:
  - `src/ink/screen.ts`
  - `src/ink/output.ts`
  - `src/ink/selection.ts`
  - `src/ink/parse-keypress.ts`
  - `src/keybindings/parser.ts`
  - `src/keybindings/match.ts`
  - `src/keybindings/resolver.ts`
  - `src/vim/types.ts`
  - `src/vim/transitions.ts`
  - `src/vim/motions.ts`
  - `src/vim/operators.ts`
  - `src/vim/textObjects.ts`
- Reference seulement:
  - `src/ink.ts`
  - `src/ink/ink.tsx`
  - `src/ink/components/App.tsx`
  - `src/keybindings/KeybindingProviderSetup.tsx`
  - `src/keybindings/loadUserBindings.ts`
  - `src/keybindings/defaultBindings.ts`
  - `src/native-ts/color-diff/index.ts`
  - `src/native-ts/file-index/index.ts`

## subdomains

### rendering engine
- Fichiers pivots:
  - `src/ink/root.ts`
  - `src/ink/ink.tsx`
  - `src/ink/renderer.ts`
  - `src/ink/render-node-to-output.ts`
  - `src/ink/output.ts`
  - `src/ink/screen.ts`
  - `src/ink/frame.ts`
  - `src/ink/log-update.ts`
- Symboles a retenir:
  - `renderSync`, `createRoot`, `wrappedRender`
  - `Ink.onRender`, `Ink.repaint`, `Ink.forceRedraw`, `Ink.invalidatePrevFrame`
  - `createRenderer`
  - `renderNodeToOutput`
  - `Output`
  - `createScreen`, `diff`, `diffEach`, `shiftRows`, `markNoSelectRegion`
- Frontieres utiles:
  - `src/ink/root.ts` est la frontiere de montage.
  - `src/ink/renderer.ts` est la frontiere frame builder.
  - `src/ink/output.ts` et `src/ink/screen.ts` sont les vraies primitives de rendu reutilisables.
- Couplages:
  - `src/ink/ink.tsx` depend de `App.tsx`, du dispatcher DOM, du painter, de `selection.ts`, de `searchHighlight.ts`, de `terminal.ts`, et de plusieurs invariants alt-screen.
  - `src/ink/render-node-to-output.ts` depend du DOM custom Ink, des rects caches, du layout Yoga, et de `Output`.
- Verdict:
  - La plus petite extraction viable cote rendu n'est pas `Ink`.
  - La bonne extraction commence a `screen.ts` + `output.ts`.
  - `renderer.ts` et `render-node-to-output.ts` ne valent la peine que si vous reprenez aussi le DOM Ink custom.

### layout
- Fichiers pivots:
  - `src/ink/layout/node.ts`
  - `src/ink/layout/engine.ts`
  - `src/ink/layout/yoga.ts`
  - `src/native-ts/yoga-layout/enums.ts`
  - `src/native-ts/yoga-layout/index.ts`
  - `src/ink/dom.ts`
  - `src/ink/measure-text.ts`
- Symboles a retenir:
  - `LayoutNode`
  - `LayoutMeasureMode`
  - `createLayoutNode`
  - `YogaLayoutNode`
  - `createYogaLayoutNode`
  - `Node`, `loadYoga`, `getYogaCounters`
  - `createNode`, `markDirty`, `scheduleRenderFrom`
- Ce qui est vraiment copiable:
  - `src/native-ts/yoga-layout/**` est une brique de valeur autonome si vous voulez un port Yoga pur TypeScript.
  - `src/ink/layout/node.ts` est une bonne interface d'adaptation.
  - `src/ink/layout/yoga.ts` est une couche d'adaptation propre entre les deux.
- Ce qui est specifique a ce repo:
  - `src/ink/dom.ts` relie les noeuds React/Ink au layout et aux dirty flags.
  - `measureTextNode` et `measureRawAnsiNode` embarquent les conventions du painter Ink.
- Verdict:
  - `native-ts/yoga-layout` peut etre copie tel quel si votre projet a vraiment besoin d'un moteur flex terminal.
  - `dom.ts` ne doit pas etre copie aveuglement: il est colle au reconciler et au render path.

### terminal events
- Fichiers pivots:
  - `src/ink/components/App.tsx`
  - `src/ink/parse-keypress.ts`
  - `src/ink/termio/tokenize.ts`
  - `src/ink/termio/csi.ts`
  - `src/ink/terminal-querier.ts`
  - `src/ink/events/input-event.ts`
  - `src/ink/events/dispatcher.ts`
  - `src/ink/terminal.ts`
  - `src/ink/termio/osc.ts`
- Symboles a retenir:
  - `parseMultipleKeypresses`
  - `INITIAL_STATE`
  - `TerminalResponse`
  - `InputEvent`
  - `Dispatcher.dispatchDiscrete`
  - `TerminalQuerier.onResponse`
  - `supportsExtendedKeys`
  - `writeDiffToTerminal`
- Ce qui est extractible:
  - `parse-keypress.ts` + `termio/tokenize.ts` + `termio/csi.ts` forment un parser terminal de bonne qualite.
  - `terminal-querier.ts` est presque autonome.
  - `events/input-event.ts` donne le contrat `Key` minimal attendu par le resolver de raccourcis.
- Ce qui est colle au runtime:
  - `App.tsx` gere raw mode, listeners `readable`, bracketed paste, terminal focus, extended keys, timers, mouse tracking, and React discrete updates.
  - C'est un shell de runtime, pas une primitive.
- Verdict:
  - Extraire le parser d'evenements = oui.
  - Copier `App.tsx` = non, sauf si vous reconstituez aussi le reconciler Ink et le modele d'events DOM custom.

### focus/selection
- Fichiers pivots:
  - `src/ink/focus.ts`
  - `src/ink/selection.ts`
  - `src/ink/hit-test.ts`
  - `src/ink/node-cache.ts`
  - `src/ink/hooks/use-selection.ts`
- Symboles a retenir:
  - `FocusManager`
  - `createSelectionState`
  - `startSelection`, `updateSelection`, `finishSelection`, `clearSelection`
  - `selectWordAt`, `selectLineAt`, `extendSelection`
  - `getSelectedText`
  - `captureScrolledRows`
  - `applySelectionOverlay`
  - `dispatchClick`, `dispatchHover`
- Ce qui est vraiment bon:
  - `focus.ts` est presque pur.
  - `selection.ts` est un gros bloc, mais il depend surtout de `screen.ts` et `layout/geometry.ts`.
  - La logique de selection ligne/mot/copie soft-wrap-aware est une vraie brique de reuse.
- Couplages:
  - `hit-test.ts` depend de `nodeCache`.
  - `use-selection.ts` depend de `instances.get(process.stdout)` donc du runtime Ink.
- Verdict:
  - `focus.ts` est copiable tel quel.
  - `selection.ts` est une bonne extraction partielle si vous reprenez `screen.ts`.
  - `use-selection.ts` est reference seulement.

### keybinding resolver
- Fichiers pivots:
  - `src/keybindings/parser.ts`
  - `src/keybindings/match.ts`
  - `src/keybindings/resolver.ts`
  - `src/keybindings/reservedShortcuts.ts`
  - `src/keybindings/validate.ts`
  - `src/keybindings/KeybindingContext.tsx`
  - `src/keybindings/KeybindingProviderSetup.tsx`
- Symboles a retenir:
  - `parseKeystroke`, `parseChord`, `parseBindings`
  - `getKeyName`, `matchesKeystroke`, `matchesBinding`
  - `resolveKey`, `resolveKeyWithChordState`, `getBindingDisplayText`, `keystrokesEqual`
  - `KeybindingProvider`, `useRegisterKeybindingContext`
  - `KeybindingSetup`, `ChordInterceptor`
- Realite d'extraction:
  - Le vrai noyau reusable est `parser.ts` + `match.ts` + `resolver.ts`.
  - `reservedShortcuts.ts` et `validate.ts` sont des extras utiles si vous voulez un user config.
  - `KeybindingProviderSetup.tsx` ajoute hot reload, notifications, watcher, timeout de chord, et interception globale `useInput`.
- Couplage notable:
  - `parser.ts`, `match.ts`, `resolver.ts` importent `./types.js`, mais `src/keybindings/types.ts` n'apparait pas dans ce fork.
  - Le noyau reste simple a reconstruire: il faut au minimum `ParsedKeystroke`, `Chord`, `ParsedBinding`, `KeybindingContextName`.
  - `match.ts` et `resolver.ts` consomment le type `Key` de `src/ink/events/input-event.ts`.
- Verdict:
  - C'est l'une des meilleures extractions B07.
  - Copier le resolver sans le shell React est recommande.

### vim state/motions/operators
- Fichiers pivots:
  - `src/vim/types.ts`
  - `src/vim/transitions.ts`
  - `src/vim/motions.ts`
  - `src/vim/operators.ts`
  - `src/vim/textObjects.ts`
  - `src/utils/Cursor.ts`
  - `src/utils/intl.ts`
  - `src/utils/stringUtils.ts`
- Symboles a retenir:
  - `VimState`, `CommandState`, `PersistentState`, `RecordedChange`
  - `createInitialVimState`, `createInitialPersistentState`
  - `transition`
  - `resolveMotion`, `isInclusiveMotion`, `isLinewiseMotion`
  - `executeOperatorMotion`, `executeOperatorFind`, `executePaste`, `executeOpenLine`
  - `findTextObject`
- Ce qui est reutilisable:
  - `types.ts` + `transitions.ts` decrivent une machine d'etat propre et portable.
  - `motions.ts` est petite et pure.
  - `textObjects.ts` est portable.
- Vrai bloqueur:
  - `operators.ts` et `motions.ts` s'appuient fortement sur `Cursor`.
  - `Cursor` expose les primitives semantiques sur lesquelles tout repose:
    - `left`, `right`, `up`, `down`
    - `downLogicalLine`, `upLogicalLine`
    - `nextVimWord`, `prevVimWord`, `endOfVimWord`
    - `nextWORD`, `prevWORD`, `endOfWORD`
    - `firstNonBlankInLogicalLine`, `startOfLogicalLine`, `endOfLogicalLine`
    - `startOfLastLine`, `goToLine`, `findCharacter`
- Verdict:
  - Le mode Vim est tres copiable, mais pas sans un adapter `Cursor`.
  - Copier `transitions.ts` seul n'apporte pas grand-chose; la vraie slice est `types.ts` + `transitions.ts` + `motions.ts` + `operators.ts` + `textObjects.ts` + `Cursor`.

### native helpers
- Fichiers pivots:
  - `src/native-ts/yoga-layout/enums.ts`
  - `src/native-ts/yoga-layout/index.ts`
  - `src/native-ts/color-diff/index.ts`
  - `src/native-ts/file-index/index.ts`
  - `src/moreright/useMoreRight.tsx`
- Lecture precise:
  - `src/native-ts/yoga-layout/**` est directement lie a la couche layout B07.
  - `src/native-ts/color-diff/index.ts` n'est pas le moteur terminal; c'est un port TS du diff colore natif, utile pour du `RawAnsi`.
  - `src/native-ts/file-index/index.ts` est un index fuzzy de fichiers, sans lien direct avec le moteur terminal ou Vim.
  - `src/moreright/useMoreRight.tsx` est un no-op placeholder, pas une sous-brique moteur.
- Verdict:
  - Pour B07, seule la branche `yoga-layout` est une vraie sous-brique coeur.
  - `color-diff`, `file-index` et `moreright` doivent surtout servir de references ou de candidats hors batch.

## feature inventory
- Montage/public facade Ink via `src/ink.ts` et `src/ink/root.ts`.
- DOM terminal custom avec dirty flags et layout nodes via `src/ink/dom.ts`.
- Port TS de Yoga branche sur l'API `LayoutNode`.
- Painter DOM -> output buffer via `src/ink/render-node-to-output.ts`.
- Buffer ecran, pools de styles/hyperliens, diff incremental via `src/ink/screen.ts`.
- Composition d'operations de rendu avec clipping, shifts, clear et blit via `src/ink/output.ts`.
- Diff terminal et writeback via `src/ink/terminal.ts` et `src/ink/log-update.ts`.
- Parseur d'entree terminal supportant bracketed paste, kitty CSI-u, modifyOtherKeys, souris, reponses terminal et focus.
- Query engine terminal sans timeout base sur DA1 sentinel via `src/ink/terminal-querier.ts`.
- Focus manager type DOM via `src/ink/focus.ts`.
- Selection texte plein ecran avec overlays, copie soft-wrap-aware, drag-scroll et follow-scroll via `src/ink/selection.ts`.
- Hit testing de nodes rendus et bubbling click/hover via `src/ink/hit-test.ts`.
- Resolver de keybindings contextuels avec chords et unbinds.
- Shell React de keybindings avec hot reload user config et interception pre-handler.
- Machine d'etat Vim pour NORMAL/INSERT, counts, operators, find, text objects, dot-repeat, paste, join, indent.

## symbol map

### facade and mount
- `src/ink.ts`
  - `render`, `createRoot`, `useInput`, `useSelection`, `useTerminalFocus`, `FocusManager`
- `src/ink/root.ts`
  - `renderSync`, `wrappedRender`, `createRoot`, `Instance`, `Root`

### rendering engine
- `src/ink/ink.tsx`
  - `Ink`
  - `drainStdin`
  - methods worth searching: `onRender`, `pause`, `resume`, `repaint`, `forceRedraw`, `enterAlternateScreen`, `exitAlternateScreen`, `dispatchClick`, `dispatchHover`, `dispatchKeyboardEvent`, `copySelection`, `clearTextSelection`, `captureScrolledRows`, `moveSelectionFocus`, `setSelectionBgColor`
- `src/ink/renderer.ts`
  - `createRenderer`
  - `RenderOptions`
  - `Renderer`
- `src/ink/render-node-to-output.ts`
  - `renderNodeToOutput`
  - `resetLayoutShifted`, `didLayoutShift`
  - `resetScrollHint`, `getScrollHint`
  - `resetScrollDrainNode`, `getScrollDrainNode`
  - `consumeFollowScroll`
  - `buildCharToSegmentMap`
  - `applyStylesToWrappedText`
- `src/ink/output.ts`
  - `Output`
  - `Operation`
  - `Clip`
- `src/ink/screen.ts`
  - `CharPool`
  - `HyperlinkPool`
  - `StylePool`
  - `createScreen`, `resetScreen`, `migrateScreenPools`
  - `setCellAt`, `setCellStyleId`
  - `blitRegion`, `clearRegion`, `shiftRows`
  - `diff`, `diffEach`
  - `markNoSelectRegion`
- `src/ink/render-to-screen.ts`
  - `renderToScreen`
  - `scanPositions`
  - `applyPositionedHighlight`

### layout and DOM
- `src/ink/dom.ts`
  - `createNode`, `appendChildNode`, `insertBeforeNode`, `removeChildNode`
  - `markDirty`, `scheduleRenderFrom`
  - `clearYogaNodeReferences`
  - `findOwnerChainAtRow`
- `src/ink/layout/node.ts`
  - `LayoutNode`
  - `LayoutMeasureMode`
  - `LayoutDisplay`
  - `LayoutOverflow`
- `src/ink/layout/yoga.ts`
  - `YogaLayoutNode`
  - `createYogaLayoutNode`
- `src/native-ts/yoga-layout/index.ts`
  - `Node`
  - `loadYoga`
  - `getYogaCounters`

### terminal events
- `src/ink/components/App.tsx`
  - `App`
  - `handleMouseEvent`
  - methods worth searching: `handleSetRawMode`, `handleReadable`, `processInput`, `processKeysInBatch`
- `src/ink/parse-keypress.ts`
  - `DECRPM_STATUS`
  - `INITIAL_STATE`
  - `parseMultipleKeypresses`
  - `TerminalResponse`
  - `ParsedKey`, `ParsedMouse`, `ParsedResponse`, `ParsedInput`
- `src/ink/terminal-querier.ts`
  - `TerminalQuerier`
  - `decrqm`, `da1`, `da2`, `kittyKeyboard`, `cursorPosition`, `oscColor`, `xtversion`
- `src/ink/events/input-event.ts`
  - `Key`
  - `InputEvent`
- `src/ink/events/dispatcher.ts`
  - `Dispatcher`

### focus and selection
- `src/ink/focus.ts`
  - `FocusManager`
  - `getRootNode`
  - `getFocusManager`
- `src/ink/selection.ts`
  - `SelectionState`
  - `createSelectionState`
  - `startSelection`, `updateSelection`, `finishSelection`, `clearSelection`
  - `selectWordAt`, `findPlainTextUrlAt`, `selectLineAt`, `extendSelection`
  - `moveFocus`, `shiftSelection`, `shiftAnchor`, `shiftSelectionForFollow`
  - `hasSelection`, `selectionBounds`, `isCellSelected`
  - `getSelectedText`
  - `captureScrolledRows`
  - `applySelectionOverlay`
- `src/ink/hit-test.ts`
  - `hitTest`
  - `dispatchClick`
  - `dispatchHover`

### keybindings
- `src/keybindings/parser.ts`
  - `parseKeystroke`, `parseChord`, `parseBindings`
  - `keystrokeToString`, `chordToString`
  - `keystrokeToDisplayString`, `chordToDisplayString`
- `src/keybindings/match.ts`
  - `getKeyName`, `matchesKeystroke`, `matchesBinding`
- `src/keybindings/resolver.ts`
  - `resolveKey`, `resolveKeyWithChordState`
  - `getBindingDisplayText`
  - `keystrokesEqual`
- `src/keybindings/KeybindingContext.tsx`
  - `KeybindingProvider`
  - `useKeybindingContext`
  - `useOptionalKeybindingContext`
  - `useRegisterKeybindingContext`
- `src/keybindings/KeybindingProviderSetup.tsx`
  - `KeybindingSetup`
  - `ChordInterceptor`
- `src/keybindings/validate.ts`
  - `validateUserConfig`, `validateBindings`, `checkReservedShortcuts`, `formatWarnings`
- `src/keybindings/reservedShortcuts.ts`
  - `NON_REBINDABLE`, `TERMINAL_RESERVED`, `MACOS_RESERVED`, `getReservedShortcuts`

### vim
- `src/vim/types.ts`
  - `VimState`, `CommandState`, `PersistentState`, `RecordedChange`
  - `OPERATORS`, `SIMPLE_MOTIONS`, `FIND_KEYS`, `TEXT_OBJ_SCOPES`, `TEXT_OBJ_TYPES`
  - `createInitialVimState`, `createInitialPersistentState`
- `src/vim/transitions.ts`
  - `TransitionContext`, `TransitionResult`, `transition`
- `src/vim/motions.ts`
  - `resolveMotion`, `isInclusiveMotion`, `isLinewiseMotion`
- `src/vim/operators.ts`
  - `OperatorContext`
  - `executeOperatorMotion`, `executeOperatorFind`, `executeOperatorTextObj`
  - `executeLineOp`, `executeX`, `executeReplace`, `executeToggleCase`, `executeJoin`, `executePaste`, `executeIndent`, `executeOpenLine`, `executeOperatorG`, `executeOperatorGg`
- `src/vim/textObjects.ts`
  - `findTextObject`

## dependency map
- `terminal_rendering_primitives`
  - minimal noyau: `src/ink/screen.ts`, `src/ink/output.ts`, `src/ink/layout/geometry.ts`, `src/ink/stringWidth.ts`, `src/ink/widest-line.ts`, `src/ink/bidi.ts`, `src/utils/intl.ts`, `src/utils/sliceAnsi.ts`
  - optionnel: `src/ink/render-node-to-output.ts`, `src/ink/renderer.ts`, `src/ink/frame.ts`
  - bloquants: DOM Ink custom, node cache, styles/painter si vous voulez reprendre le rendu de components React
- `terminal_input_parser`
  - minimal noyau: `src/ink/parse-keypress.ts`, `src/ink/termio/tokenize.ts`, `src/ink/termio/csi.ts`, `src/ink/termio/ansi.ts`
  - optionnel: `src/ink/events/input-event.ts`, `src/ink/terminal-querier.ts`
  - bloquants: aucun fort si vous acceptez d'adapter votre event loop
- `terminal_focus_selection`
  - minimal noyau: `src/ink/focus.ts`, `src/ink/selection.ts`, `src/ink/layout/geometry.ts`, `src/ink/screen.ts`
  - optionnel: `src/ink/hit-test.ts`, `src/ink/node-cache.ts`
  - bloquants: `selection.ts` attend un `Screen` exact et les regions `noSelect`
- `keybinding_resolver_core`
  - minimal noyau: `src/keybindings/parser.ts`, `src/keybindings/match.ts`, `src/keybindings/resolver.ts`
  - optionnel: `src/keybindings/reservedShortcuts.ts`, `src/keybindings/validate.ts`
  - bloquants: reconstruire `types.ts` absent du fork, et adapter le type `Key`
- `vim_interaction_model`
  - minimal noyau: `src/vim/types.ts`, `src/vim/transitions.ts`, `src/vim/motions.ts`, `src/vim/operators.ts`, `src/vim/textObjects.ts`
  - deps minimales en plus: `src/utils/Cursor.ts`, `src/utils/intl.ts`, `src/utils/stringUtils.ts`
  - bloquants: sans `Cursor`, les operators ne sont pas exploitables
- `ts_yoga_layout_port`
  - minimal noyau: `src/native-ts/yoga-layout/enums.ts`, `src/native-ts/yoga-layout/index.ts`
  - optionnel: `src/ink/layout/node.ts`, `src/ink/layout/yoga.ts`
  - bloquants: aucun si vous n'avez besoin que de Yoga; sinon il faut votre propre adapter

## extraction recipes

### recipe: keybinding resolver core
- Copier:
  - `src/keybindings/parser.ts`
  - `src/keybindings/match.ts`
  - `src/keybindings/resolver.ts`
- Reconstituer localement:
  - `ParsedKeystroke`
  - `Chord`
  - `ParsedBinding`
  - `KeybindingContextName`
  - un type `Key` compatible avec `src/ink/events/input-event.ts`
- Garder si besoin:
  - `src/keybindings/reservedShortcuts.ts`
  - `src/keybindings/validate.ts`
- Ne pas reprendre par defaut:
  - `src/keybindings/KeybindingProviderSetup.tsx`
  - `src/keybindings/loadUserBindings.ts`
  - `src/keybindings/defaultBindings.ts`
- Difficulte:
  - faible pour le noyau
  - moyenne si vous voulez aussi hot reload + contexts React

### recipe: vim interaction model
- Copier:
  - `src/vim/types.ts`
  - `src/vim/transitions.ts`
  - `src/vim/motions.ts`
  - `src/vim/operators.ts`
  - `src/vim/textObjects.ts`
- Ajouter:
  - `src/utils/Cursor.ts`
  - `src/utils/intl.ts`
  - `src/utils/stringUtils.ts`
- Adapter:
  - `OperatorContext`
  - vos callbacks `setText`, `setOffset`, `enterInsert`, `setRegister`, `recordChange`
- Ne pas supposer:
  - que le mode Vim de ce repo est independant du modele texte; il est tres tied a `Cursor`
- Difficulte:
  - moyenne si vous avez deja un editeur texte grapheme-aware
  - haute si votre editeur n'a pas d'equivalent de `Cursor`

### recipe: terminal rendering helpers
- Copier d'abord:
  - `src/ink/screen.ts`
  - `src/ink/output.ts`
  - `src/ink/layout/geometry.ts`
  - `src/ink/stringWidth.ts`
  - `src/ink/widest-line.ts`
  - `src/ink/bidi.ts`
  - `src/utils/intl.ts`
  - `src/utils/sliceAnsi.ts`
- Ajouter seulement si vous avez aussi un DOM custom:
  - `src/ink/frame.ts`
  - `src/ink/renderer.ts`
  - `src/ink/render-node-to-output.ts`
  - `src/ink/node-cache.ts`
  - `src/ink/dom.ts`
- Ne pas commencer par:
  - `src/ink/ink.tsx`
- Difficulte:
  - moyenne pour `screen.ts` + `output.ts`
  - haute si vous voulez reprendre tout le painter React/DOM terminal

### recipe: terminal input parser
- Copier:
  - `src/ink/parse-keypress.ts`
  - `src/ink/termio/tokenize.ts`
  - `src/ink/termio/csi.ts`
  - `src/ink/termio/ansi.ts`
- Ajouter si besoin de queries:
  - `src/ink/terminal-querier.ts`
  - `src/ink/termio/osc.ts`
- Ajouter si besoin d'un contrat de key normalized:
  - `src/ink/events/input-event.ts`
- Difficulte:
  - faible a moyenne

### recipe: focus + selection
- Copier:
  - `src/ink/focus.ts`
  - `src/ink/selection.ts`
  - `src/ink/layout/geometry.ts`
  - `src/ink/screen.ts`
- Ajouter si vous voulez pointer/click:
  - `src/ink/hit-test.ts`
  - `src/ink/node-cache.ts`
- Difficulte:
  - faible pour focus
  - moyenne pour selection

### recipe: Yoga TS adapter
- Copier:
  - `src/native-ts/yoga-layout/enums.ts`
  - `src/native-ts/yoga-layout/index.ts`
- Ajouter si vous voulez conserver l'API Ink:
  - `src/ink/layout/node.ts`
  - `src/ink/layout/yoga.ts`
  - `src/ink/layout/engine.ts`
- Difficulte:
  - faible si vous voulez juste un moteur Yoga
  - moyenne si vous voulez l'API `LayoutNode` Ink intacte

## do not copy blindly
- `src/ink/ink.tsx`
  - trop de responsabilites: frame lifecycle, selection overlay, alt-screen, diff writeback, cursor native, hover, clicks, search highlights, patch console.
- `src/ink/components/App.tsx`
  - shell TTY/readable/raw-mode tres specifique, avec timers, souris, focus reporting, reassert terminal modes.
- `src/keybindings/KeybindingProviderSetup.tsx`
  - colle a `useInput`, notifications, watcher user config, hot reload et ordre d'enregistrement des listeners.
- `src/keybindings/loadUserBindings.ts`
  - depend de `~/.claude/keybindings.json`, `chokidar`, analytics, feature gate GrowthBook.
- `src/keybindings/defaultBindings.ts`
  - map produit, feature-flaggee, peu portable.
- `src/ink.ts`
  - facade melangeant design-system et moteur terminal.
- `src/ink/hooks/use-selection.ts`
  - depend de `instances.get(process.stdout)`.
- `src/native-ts/color-diff/index.ts`
  - utile pour diff colore, pas pour reconstruire le moteur terminal.
- `src/native-ts/file-index/index.ts`
  - excellente brique ailleurs, mais elle n'appartient pas a la couche terminal/keybindings/Vim.

## minimal reusable slices

### slice: keybinding resolver
- Fichiers minimum:
  - `src/keybindings/parser.ts`
  - `src/keybindings/match.ts`
  - `src/keybindings/resolver.ts`
- Adapter requis:
  - `Key` input shape
  - `types.ts` manquant dans ce fork
- Reuse verdict:
  - haute valeur
  - extraction faible a moyenne
- Usage ideal:
  - TUI custom
  - editor terminal
  - palette de commandes avec chords

### slice: vim interaction model
- Fichiers minimum:
  - `src/vim/types.ts`
  - `src/vim/transitions.ts`
  - `src/vim/motions.ts`
  - `src/vim/operators.ts`
  - `src/vim/textObjects.ts`
  - `src/utils/Cursor.ts`
- Adapter requis:
  - `OperatorContext`
  - stockage register / undo / dot repeat
- Reuse verdict:
  - haute valeur
  - extraction moyenne
- Usage ideal:
  - text input terminal avance
  - mini editeur ligne/textarea

### slice: terminal rendering helpers
- Fichiers minimum:
  - `src/ink/screen.ts`
  - `src/ink/output.ts`
  - `src/ink/layout/geometry.ts`
  - `src/ink/stringWidth.ts`
  - `src/ink/widest-line.ts`
  - `src/ink/bidi.ts`
  - `src/utils/intl.ts`
  - `src/utils/sliceAnsi.ts`
- Adapter requis:
  - votre propre source d'operations de rendu
- Reuse verdict:
  - haute valeur si vous avez deja votre arbre de rendu
  - extraction moyenne
- Usage ideal:
  - diff terminal incremental
  - rendu de buffers ANSI / texte avec clipping et blits

## exact search shortcuts
- `rg -n "renderSync|createRoot|wrappedRender" src/ink/root.ts`
- `rg -n "class Ink|onRender|enterAlternateScreen|dispatchKeyboardEvent|copySelection|forceRedraw" src/ink/ink.tsx`
- `rg -n "handleSetRawMode|handleReadable|processKeysInBatch|handleMouseEvent|TerminalQuerier" src/ink/components/App.tsx`
- `rg -n "parseMultipleKeypresses|parseTerminalResponse|parseMouseEvent|INITIAL_STATE|DECRPM_STATUS" src/ink/parse-keypress.ts`
- `rg -n "createTokenizer|x10Mouse|emitSequence" src/ink/termio/tokenize.ts`
- `rg -n "ENABLE_KITTY_KEYBOARD|ENABLE_MODIFY_OTHER_KEYS|PASTE_START|FOCUS_IN|FOCUS_OUT" src/ink/termio/csi.ts`
- `rg -n "decrqm|da1|xtversion|TerminalQuerier|onResponse" src/ink/terminal-querier.ts`
- `rg -n "createRenderer|prevFrameContaminated|getScrollHint|getScrollDrainNode" src/ink/renderer.ts`
- `rg -n "renderNodeToOutput|didLayoutShift|consumeFollowScroll|applyStylesToWrappedText|buildCharToSegmentMap" src/ink/render-node-to-output.ts`
- `rg -n "class Output|writeLineToScreen|clip|unclip|shift|get\\(" src/ink/output.ts`
- `rg -n "createScreen|StylePool|diffEach|blitRegion|shiftRows|markNoSelectRegion" src/ink/screen.ts`
- `rg -n "class FocusManager|focusNext|handleNodeRemoved|getFocusManager" src/ink/focus.ts`
- `rg -n "createSelectionState|selectWordAt|getSelectedText|captureScrolledRows|applySelectionOverlay" src/ink/selection.ts`
- `rg -n "dispatchClick|dispatchHover|hitTest" src/ink/hit-test.ts`
- `rg -n "LayoutNode|LayoutMeasureMode|LayoutOverflow" src/ink/layout/node.ts`
- `rg -n "YogaLayoutNode|createYogaLayoutNode" src/ink/layout/yoga.ts`
- `rg -n "class Node|loadYoga|getYogaCounters" src/native-ts/yoga-layout/index.ts`
- `rg -n "parseKeystroke|parseChord|parseBindings|keystrokeToDisplayString" src/keybindings/parser.ts`
- `rg -n "getKeyName|matchesKeystroke|matchesBinding" src/keybindings/match.ts`
- `rg -n "resolveKey|resolveKeyWithChordState|keystrokesEqual|getBindingDisplayText" src/keybindings/resolver.ts`
- `rg -n "KeybindingProvider|useRegisterKeybindingContext|invokeAction" src/keybindings/KeybindingContext.tsx`
- `rg -n "KeybindingSetup|ChordInterceptor|CHORD_TIMEOUT_MS|loadKeybindingsSyncWithWarnings" src/keybindings/KeybindingProviderSetup.tsx`
- `rg -n "VimState|CommandState|PersistentState|createInitialVimState|MAX_VIM_COUNT" src/vim/types.ts`
- `rg -n "transition|fromIdle|fromOperator|fromFind|fromIndent" src/vim/transitions.ts`
- `rg -n "resolveMotion|isInclusiveMotion|isLinewiseMotion" src/vim/motions.ts`
- `rg -n "executeOperatorMotion|executeOperatorFind|executePaste|executeOpenLine|executeJoin" src/vim/operators.ts`
- `rg -n "findTextObject|findQuoteObject|findBracketObject" src/vim/textObjects.ts`
- `rg -n "class Cursor|firstNonBlankInLogicalLine|downLogicalLine|nextVimWord|startOfLastLine|goToLine" src/utils/Cursor.ts`
- `rg -n "setClipboard|wrapForMultiplexer|supportsTabStatus|link" src/ink/termio/osc.ts`
- `rg -n "useMoreRight" src/moreright/useMoreRight.tsx`
