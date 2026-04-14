# Story 5.0.2: Consolider le gate check-epic-closure (findings review 5.0.1)

Status: ready-for-dev

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

- [ ] Durcir `extractStoryHeader` pour le frontmatter et les fences Markdown (AC: 1, 2)
  - [ ] Detecter un frontmatter: si la premiere ligne non vide est exactement `---`, lire jusqu'a la ligne suivante `---` comme header, puis continuer la lecture normale du corps jusqu'au premier `## ` en ignorant les occurrences intermediaires de `---`.
  - [ ] Tracker les fences Markdown (` ``` ` ou ` ~~~ `) dans le header: les lignes a l'interieur d'une fence ne sont pas ajoutees a `headerContents`. Fermer la fence sur la meme marque.
  - [ ] Ajouter un test d'integration: story file avec frontmatter YAML uniquement (AC1) -> lu comme `done`.
  - [ ] Ajouter un test d'integration: story file dont la seule ligne `Status:` avant `## ` est dans une fence ` ```yaml ` (AC2) -> traite comme `(absent)` et erreur explicite.

- [ ] Detecter les sections `development_status:` dupliquees (AC: 3)
  - [ ] Apres `findIndex`, rechercher une seconde occurrence exacte de `development_status:`; si presente, `throw` avec le message `development_status: section dupliquee detectee (lignes A et B).`.
  - [ ] Ajouter un test d'integration avec deux sections `development_status:` consecutives.

- [ ] Stripper le BOM UTF-8 a la lecture du sprint-status (AC: 4)
  - [ ] Apres `readFile(sprintStatusPath, "utf8")`, retirer `\uFEFF` s'il est en tete.
  - [ ] Ajouter un test d'integration en ecrivant `"\uFEFF"` devant le contenu fixture.

- [ ] Refuser `--root ""` (AC: 5)
  - [ ] Ajouter une garde `nextArg === ""` dans la branche `--root <value>` de `parseRootDirFromArgs`.
  - [ ] Ajouter un test d'integration: `runCheck(rootDir, ["--root", ""])` -> exit 1 et message explicite.

- [ ] Warning `in-progress` sans story (AC: 6)
  - [ ] Ajouter dans `checkEpicClosure` une passe sur les entrees `epic-N: in-progress` dont `storyEntries.length === 0`: pousser le warning `epic-N: aucune story associee dans development_status alors que l'epic est in-progress.`.
  - [ ] Ajouter un test d'integration.

- [ ] Corriger l'ordre des remplacements dans `unwrapQuotedScalar` (AC: 7)
  - [ ] Inverser l'ordre: `replace(/\\\\/g, "\\")` AVANT `replace(/\\"/g, "\"")` (ou utiliser un scan lineaire qui traite chaque escape une fois).
  - [ ] Ajouter un test unitaire (ou d'integration via un fixture) exercant `"foo\\\""` -> `foo\"`.

- [ ] Creer `.gitattributes` forcant LF sur les hooks (AC: 8)
  - [ ] Ajouter `.gitattributes` au niveau repo racine avec les entrees:
    - `.githooks/** text eol=lf`
    - `scripts/**.sh text eol=lf`
  - [ ] Documenter la regle dans `_bmad/policies/epic-closure.md` (section "Hook git optionnel").
  - [ ] Verifier via `git check-attr` qu'une extraction Windows preserverait LF (verification manuelle suffisante, pas de test automatise Windows-only).

- [ ] Rebuild + regression (toutes AC)
  - [ ] `npm run build` puis `npm test` -> suite complete verte (>= 263 tests).

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

_(a completer au fil de l'implementation)_

### Completion Notes

_(a completer apres validation)_

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
