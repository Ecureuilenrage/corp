# Story 5.0.2: Consolider le gate check-epic-closure (findings review 5.0.1)

Status: done

## Story

As a scrum master de `corp`,
I want que `check-epic-closure.ts`, `extractStoryHeader`, le parser YAML interne et le hook pre-commit gerent correctement les cas limites remontes a la review adversariale de 5.0.1,
so that le gate ne soit pas contournable par un story file a frontmatter YAML, une fence Markdown, une section `development_status:` dupliquee, un BOM UTF-8, un `--root ""` silencieux, un epic `in-progress` sans story, ni par un hook rendu inoperant par CRLF sur Windows.

## Context

La story 5.0.1 a livre le durcissement demande par la review 5.0 (parser YAML defensif, passe pre-transition, hook opt-in, policies alignees, 263 tests verts). La review adversariale triplee de 5.0.1 (Blind Hunter + Edge Case Hunter + Acceptance Auditor) a consolide 8 findings `patch` residuels qui echappent encore au gate. Aucun des 11 AC ni des 6 defer (D-54 a D-59) de 5.0.1 n'est remis en cause: il s'agit exclusivement de trous edge-case au pourtour du durcissement deja livre.

Les findings `defer` (5 items: message "valeur vide" ambigu pour `epic-N: #comment`, test AC1 pour `#` dans scalaire quote, garde `command -v node` dans le hook, antipattern `throw "USAGE"`, sous-modules git) et les findings `dismiss` (7 items: collision epic-1/epic-10 infirmee, NBSP, redondance `isEpicRetrospectiveKey` acceptee par AC11, escapes YAML `\n\t\uXXXX` hors scope, D-59 gere par le commit utilisateur) sont explicitement hors scope de cette story.

## Acceptance Criteria

1. Given un story file dont le corps commence par un bloc frontmatter YAML `---\nStatus: done\n---\n# Titre`
   When le gate lit le status
   Then le parser detecte le frontmatter (ligne 1 = `---`), lit jusqu'a la cloture `---`, et retourne `done` (au lieu de retourner `undefined` comme aujourd'hui)

2. Given un story file dont le header (avant `## `) contient une fence ` ```yaml\nStatus: review\n``` ` sans aucune ligne `Status:` hors fence
   When le gate lit le status
   Then le contenu dans la fence est ignore et le status est traite comme `(absent)`, evitant que `Status: review` dans un bloc de code ne soit pris par erreur pour le vrai status

3. Given un `sprint-status.yaml` ou la section `development_status:` apparait deux fois
   When le gate est execute
   Then le script remonte une erreur explicite (`development_status: section dupliquee detectee (lignes A et B).`) avant toute tentative de parsing, plutot que de silencieusement ignorer la seconde section

4. Given un `sprint-status.yaml` enregistre avec un BOM UTF-8 (`\uFEFF`) en tete
   When le gate est execute
   Then le BOM est retire a la lecture du fichier et la section `development_status:` est detectee correctement

5. Given `check-epic-closure` est invoque avec `--root ""` (deux arguments, le second etant une chaine vide)
   When les arguments sont parses
   Then le script refuse l'invocation avec le message `L'option --root requiert un chemin.` au lieu de resoudre silencieusement vers `process.cwd()`

6. Given un epic `epic-N: in-progress` qui n'a aucune story `N-*` dans `development_status`
   When le gate est execute
   Then un warning `epic-N: aucune story associee dans development_status alors que l'epic est in-progress.` est emis au meme titre que le warning existant pour les epics `done` sans story

7. Given la fonction `unwrapQuotedScalar` recoit `"foo\\\""` (scalaire double-quote contenant un backslash echappe suivi d'un guillemet echappe, representant `foo\"`)
   When le scalaire est unwrappe
   Then le resultat est `foo\"` et non `foo"` (l'ordre des remplacements `\\\\` puis `\\"` est corrige pour ne pas corrompre les backslashes)

8. Given le fichier `.githooks/pre-commit` est extrait sur un poste Windows ou `core.autocrlf=true`
   When git extrait le fichier
   Then `.gitattributes` force `eol=lf` pour `.githooks/**` et pour `scripts/**.sh`, preservant le shebang `#!/bin/sh` et l'executabilite msys du hook

## Tasks / Subtasks

- [x] Durcir `extractStoryHeader` pour le frontmatter et les fences Markdown (AC: 1, 2)
  - [x] Detecter un frontmatter: si la premiere ligne non vide est exactement `---`, lire jusqu'a la ligne suivante `---` comme header, puis continuer la lecture normale du corps jusqu'au premier `## ` en ignorant les occurrences intermediaires de `---`.
  - [x] Tracker les fences Markdown (` ``` ` ou ` ~~~ `) dans le header: les lignes a l'interieur d'une fence ne sont pas ajoutees a `headerContents`. Fermer la fence sur la meme marque.
  - [x] Ajouter un test d'integration: story file avec frontmatter YAML uniquement (AC1) -> lu comme `done`.
  - [x] Ajouter un test d'integration: story file dont la seule ligne `Status:` avant `## ` est dans une fence ` ```yaml ` (AC2) -> traite comme `(absent)` et erreur explicite.

- [x] Detecter les sections `development_status:` dupliquees (AC: 3)
  - [x] Apres `findIndex`, rechercher une seconde occurrence exacte de `development_status:`; si presente, `throw` avec le message `development_status: section dupliquee detectee (lignes A et B).`.
  - [x] Ajouter un test d'integration avec deux sections `development_status:` consecutives.

- [x] Stripper le BOM UTF-8 a la lecture du sprint-status (AC: 4)
  - [x] Apres `readFile(sprintStatusPath, "utf8")`, retirer `\uFEFF` s'il est en tete.
  - [x] Ajouter un test d'integration en ecrivant `"\uFEFF"` devant le contenu fixture.

- [x] Refuser `--root ""` (AC: 5)
  - [x] Ajouter une garde `nextArg === ""` dans la branche `--root <value>` de `parseRootDirFromArgs`.
  - [x] Ajouter un test d'integration: `runCheck(rootDir, ["--root", ""])` -> exit 1 et message explicite.

- [x] Warning `in-progress` sans story (AC: 6)
  - [x] Ajouter dans `checkEpicClosure` une passe sur les entrees `epic-N: in-progress` dont `storyEntries.length === 0`: pousser le warning `epic-N: aucune story associee dans development_status alors que l'epic est in-progress.`.
  - [x] Ajouter un test d'integration.

- [x] Corriger l'ordre des remplacements dans `unwrapQuotedScalar` (AC: 7)
  - [x] Refacto en scan lineaire qui traite chaque escape une fois (resout le risque d'inversion d'ordre des passes regex).
  - [x] Ajouter un test d'integration via un fixture exercant `"foo\\\""` -> `foo\"`.

- [x] Creer `.gitattributes` forcant LF sur les hooks (AC: 8)
  - [x] Ajouter `.gitattributes` au niveau repo racine avec les entrees:
    - `.githooks/** text eol=lf`
    - `scripts/**.sh text eol=lf`
  - [x] Documenter la regle dans `_bmad/policies/epic-closure.md` (section "Hook git optionnel").
  - [x] Verifier via `git check-attr` qu'une extraction Windows preserverait LF (`git check-attr -a .githooks/pre-commit` retourne `text: set` + `eol: lf`).

- [x] Rebuild + regression (toutes AC)
  - [x] `npm run build` puis `npm test` -> suite complete verte (272 tests, 0 fail).

### Review Findings

- [x] [Review][Patch] Reconnaitre les fences Markdown indentees dans le header [scripts/check-epic-closure.ts:321]
- [x] [Review][Patch] Detecter les sections development_status dupliquees avec commentaire inline [scripts/check-epic-closure.ts:144]
- [x] [Review][Patch] Limiter `.gitattributes` aux patterns LF demandes [.gitattributes:1]

## Dev Notes

### Story Intent

Cette story ne modifie pas le runtime `corp` ni le contrat AC de 5.0/5.0.1. Elle consolide le perimetre du gate BMAD livre par 5.0.1 pour fermer 8 trous edge-case identifies a la review adversariale, sans elargir le scope.

### Dependances

Prerequis: 5.0.1 (mecanisation durcie du gate). Pas de dependance sur 5.1+. Aucun impact sur Mission/Ticket/Extension.

### Testing Requirements

Tests d'integration sur les scenarios suivants, ajoutes a `tests/integration/check-epic-closure.test.ts`:

1. Story file avec frontmatter YAML uniquement -> lu comme `done`.
2. Story file dont le seul `Status:` avant `## ` est dans une fence -> traite comme `(absent)`.
3. `sprint-status.yaml` avec deux sections `development_status:` -> erreur explicite.
4. `sprint-status.yaml` prefixe d'un BOM UTF-8 -> parse correct.
5. `runCheck(rootDir, ["--root", ""])` -> exit 1 et message explicite.
6. Epic `in-progress` avec zero story -> warning emis.
7. `unwrapQuotedScalar("\"foo\\\\\\\"\"")` -> `foo\"` (test unitaire direct ou fixture e2e).
8. `.gitattributes` present avec les entrees hooks (verification du fichier uniquement, pas de test comportemental Windows).

Suite globale `npm test` doit rester verte.

### NFR cible

NFR22 (Gate BMAD de cloture) consolide: 0% de chemin de contournement via frontmatter YAML, fence Markdown, section dupliquee, BOM, `--root ""`, ni via un hook rendu inoperant par CRLF sur Windows. Les epics `in-progress` orphelins de stories deviennent visibles au meme titre que les epics `done` orphelins.

## Dev Agent Record

### Implementation Plan

- Ecrire d'abord 8 tests d'integration rouges (un par AC) couvrant frontmatter, fence, section dupliquee, BOM, `--root ""`, in-progress sans story, escape `\\\"`, et presence de `.gitattributes`.
- Appliquer les patches cibles sur `scripts/check-epic-closure.ts`: refactor `extractStoryHeader` (frontmatter + fence tracking), `parseDevelopmentStatusEntries` (duplicate section + BOM), `unwrapQuotedScalar` (ordre), `parseRootDirFromArgs` (empty string), `checkEpicClosure` (warning in-progress sans story).
- Creer `.gitattributes` au niveau repo + maj de `_bmad/policies/epic-closure.md`.
- Rebuild `dist/` et faire tourner `npm test`.

### Debug Log

- 2026-04-15: build TypeScript ok apres refactor de `extractStoryHeader`, ajout de la detection de section `development_status:` dupliquee, du strip BOM, de la garde `--root ""`, du warning `in-progress` orphelin, du linear scan `unwrapQuotedScalar`, et de la creation `.gitattributes`.
- 2026-04-15: `node --test dist/tests/integration/check-epic-closure.test.js` -> 25/25 verts (17 tests existants + 8 nouveaux). `npm test` -> 271/271 verts.
- 2026-04-15: `git check-attr -a .githooks/pre-commit` confirme `text: set` + `eol: lf`.
- 2026-04-15: findings review corriges: fences Markdown indentees, section `development_status:` dupliquee avec commentaire inline, et suppression du `* text=auto` global. `npm test` -> 272/272 verts.

### Completion Notes

- AC1: `extractStoryHeader` detecte un frontmatter YAML (premiere ligne non-vide = `---`) et lit son contenu jusqu'a la cloture `---` avant de continuer le header normal jusqu'au premier `## `.
- AC2: les fences Markdown ` ``` ` et ` ~~~ ` (3+ marqueurs, avec 0 a 3 espaces d'indentation) sont trackees dans le header; les lignes a l'interieur d'une fence ne sont pas exposees au scan `Status:`. Les tests fence-only et fence indentee verifient que la sortie reporte bien `Status: (absent)`.
- AC3: ajout d'un second `findIndex` apres le premier `development_status:`; si un second match existe, y compris avec commentaire inline, throw `development_status: section dupliquee detectee (lignes A et B).` avant tout parsing.
- AC4: `checkEpicClosure` retire `\uFEFF` en tete du contenu raw avant de le transmettre au parser.
- AC5: `parseRootDirFromArgs` refuse `nextArg === ""` au meme titre que `undefined`/`--*`.
- AC6: passe additionnelle dans `checkEpicClosure` qui, pour chaque epic `in-progress` sans story `N-*`, pousse un warning symetrique a celui des epics `done` orphelins.
- AC7: refacto de `unwrapQuotedScalar` en scan lineaire single-pass qui consomme chaque escape (`\\` ou `\"`) une seule fois, eliminant le risque d'inversion d'ordre entre les passes regex. Test fixture exercant `"foo\\\""` confirme le resultat `foo\"`.
- AC8: `.gitattributes` cree a la racine avec `.githooks/** text eol=lf` et `scripts/**.sh text eol=lf`, sans regle globale `* text=auto`. Section "Compatibilite Windows (CRLF)" ajoutee dans `_bmad/policies/epic-closure.md`.
- Regression: 272 tests verts (vs 263 avant), 0 fail. Aucun runtime `corp` modifie.

## File List

- `_bmad-output/implementation/5-0-2-consolider-le-gate-epic-closure-findings-review-5-0-1.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `scripts/check-epic-closure.ts`
- `tests/integration/check-epic-closure.test.ts`
- `dist/scripts/check-epic-closure.js`
- `dist/tests/integration/check-epic-closure.test.js`
- `.gitattributes`
- `_bmad/policies/epic-closure.md`

## Change Log

- `2026-04-14`: creation de la story 5.0.2 suite a la review adversariale triplee de 5.0.1 (8 findings `patch` consolides; 5 findings `defer` et 7 findings `dismiss` documentes hors scope).
- `2026-04-15`: implementation des 8 AC (frontmatter + fences, section dupliquee, BOM, `--root ""`, warning `in-progress` orphelin, refacto `unwrapQuotedScalar` en scan lineaire, `.gitattributes` LF). Suite de tests: 271 verts (8 nouveaux), 0 fail. Status -> review.
- `2026-04-15`: correction des 3 findings de code review et validation `npm test`: 272 verts, 0 fail. Status -> done.
