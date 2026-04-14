# Story 5.0.1: Durcir le gate de cloture d'epic (findings review 5.0)

Status: review

## Story

As a scrum master de `corp`,
I want que le gate `check-epic-closure` et la politique associee resistent aux cas limites identifies a la review de 5.0,
so that le gate ne puisse etre silencieusement desarme par une annotation YAML, une valeur quotee, une indentation par tab, un epic encore `in-progress` pret a clore, ou un hook pre-commit absent.

## Context

Story 5.0 a livre le gate de cloture d'epic (`scripts/check-epic-closure.ts`) et les politiques `_bmad/policies/epic-closure.md` + `_bmad/policies/workspace-compat.md`. La review adversariale (Blind Hunter + Edge Case Hunter + Acceptance Auditor) a remonte 12 correctifs unitaires, 2 decisions de portee et 6 durcissements defensifs. Cette story absorbe l'ensemble pour que le gate soit mecaniquement fiable avant la suite de l'Epic 5.

Les deux decisions de portee ont ete tranchees au moment de creer la story:

- Portee AC1: etendre le script pour detecter aussi les epics `in-progress` dont toutes les stories sont `done` au tracker mais dont un story file est desynchronise ou la retro n'est pas `done`. La spec 5.0 dit "refuser la transition `in-progress -> done`", l'implementation livree ne couvrait que les epics deja `done`.
- Hook pre-commit: fournir un hook opt-in cable sous `.githooks/check-epic-closure.sh` avec une doc d'activation dans `_bmad/policies/epic-closure.md`, et eviter l'appel `npm run build` a chaque commit en permettant d'appeler directement `dist/scripts/check-epic-closure.js`.

## Acceptance Criteria

1. Given un `sprint-status.yaml` contenant `epic-N: done # note`
   When le gate est execute
   Then la valeur `done` est comparee correctement (le commentaire est strippe avant comparaison) et l'epic est inspecte comme tout autre epic `done`

2. Given un `sprint-status.yaml` contenant `epic-N: "done"` ou `epic-N: 'done'`
   When le gate est execute
   Then le scalaire quote est unwrappe et reconnu comme `done`

3. Given un `sprint-status.yaml` contenant deux entrees `epic-N: done` dans la section `development_status`
   When le gate est execute
   Then l'epic est inspecte une seule fois et n'apparait qu'une fois dans la liste des epics verifies ou des erreurs

4. Given un `sprint-status.yaml` dont la section `development_status` est indentee par tabulation ou avec 3+ espaces
   When le gate est execute
   Then le script remonte une erreur explicite (`indentation invalide dans development_status, attendu 2 espaces`) plutot que de passer silencieusement

5. Given un epic `epic-N: in-progress` dont toutes les stories `N-*` sont `done` au tracker mais dont un story file declare `Status: review`, ou dont la retro n'est pas `done`
   When le gate est execute
   Then le script sort != 0 avec un message distinct ("epic pret a clore mais desynchronise") citant chaque ecart, pour que la transition soit bloquee avant l'ecriture fautive

6. Given un epic `epic-N: done` dont une story file referenced est absente
   When le gate est execute
   Then le script sort != 0 avec un message explicite et un test d'integration couvre ce scenario ENOENT

7. Given `check-epic-closure` est invoque avec `--root=<path>`
   When les arguments sont parses
   Then la forme `=` est acceptee comme equivalente a `--root <path>`

8. Given un hook `pre-commit` opt-in est fourni
   When un mainteneur active `.githooks/` via `git config core.hooksPath .githooks`
   Then le hook execute `node dist/scripts/check-epic-closure.js` (sans rebuild systematique) et bloque les commits qui contiennent `epic-N: done` desynchronise
   And la procedure d'activation est documentee dans `_bmad/policies/epic-closure.md`

9. Given la politique `_bmad/policies/workspace-compat.md` reference les patterns 4.5/4.3/4.4
   When un mainteneur lit la section "Cas historiques"
   Then l'entree pour 4.4 decrit un scenario "workspace legacy" concret (registre/projection manquant et message attendu) au meme niveau de detail que 4.5 et 4.3

10. Given le script emet des erreurs pour une meme story quand le tracker n'est pas `done` ET la lecture du story file echoue
    When le gate est execute
    Then une seule erreur est produite par story (pas de double-remontee confondante)

11. Given la fonction `isEpicRetrospectiveKey` etait declaree dans `scripts/check-epic-closure.ts` sans etre appelee
    When la story est cloturee
    Then le dead code est supprime OU la fonction est effectivement utilisee

## Tasks / Subtasks

- [x] Durcir le parser YAML interne (AC: 1, 2, 3, 4)
  - [x] Stripper les commentaires inline (`value # note` -> `value`) avant comparaison, en preservant les `#` a l'interieur de chaines quotees.
  - [x] Unwrapper les scalaires quotes `"..."` et `'...'` avant comparaison.
  - [x] Detecter les cles dupliquees dans `development_status` et appliquer "last-wins" en remontant un warning deterministe.
  - [x] Rejeter explicitement toute ligne non conforme a 2 espaces d'indentation (tabs ou >2 espaces) avec un message d'erreur dedie.

- [x] Etendre la couverture du gate aux epics `in-progress` pret-a-clore (AC: 5)
  - [x] Ajouter une passe "pre-transition": pour chaque epic `in-progress`, si toutes les stories `N-*` sont `done` au tracker, verifier les story files et la retro; en cas de desynchronisation, remonter une erreur distincte des desynchronisations historiques.
  - [x] Ajouter un test d'integration: epic `in-progress` + stories `done` au tracker + une story file en `review` -> exit != 0 avec message distinct.
  - [x] Ajouter un test d'integration: epic `in-progress` + stories `done` + retro `required` -> exit != 0.

- [x] Couvrir le cas story file manquant (AC: 6)
  - [x] Ajouter un test d'integration: epic `done` dont une story file est absente -> exit != 0 et message explicite.

- [x] Accepter `--root=<value>` (AC: 7)
  - [x] Etendre `parseRootDirFromArgs` pour splitter sur `=` avant l'unknown-arg.

- [x] Cabler le hook pre-commit opt-in (AC: 8)
  - [x] Ajouter `.githooks/pre-commit` invoquant `node dist/scripts/check-epic-closure.js` (sans rebuild) et documenter l'activation via `git config core.hooksPath .githooks` dans `_bmad/policies/epic-closure.md`.
  - [x] Preciser que le hook suppose un `dist/` a jour (rebuild avant commit si necessaire) et ajouter une verification facultative.

- [x] Ameliorer la reference 4.4 dans workspace-compat.md (AC: 9)
  - [x] Remplacer la mention abstraite par un scenario "workspace legacy" concret citant le registre ou la projection manquant et le message francais attendu.

- [x] Nettoyer les residus (AC: 10, 11)
  - [x] Ajouter un `continue` apres la premiere erreur de story pour eviter la double-remontee (ou refactorer le flot de validation pour emettre une erreur consolidee).
  - [x] Supprimer `isEpicRetrospectiveKey` OU l'utiliser effectivement dans le filtre des entrees.

- [x] Absorber les findings defer/low (D-54 a D-59) (AC: aucune critique, hygiene)
  - [x] D-54: alerter si un epic `done` n'a aucune story associee.
  - [x] D-55/D-56: extraire `Status:` uniquement dans la section de header (avant la premiere ligne `## ` ou `---`) pour eviter les matches dans les blocs de code ou les doubles lignes.
  - [x] D-57: accepter un chemin commencant par `--` via `--root=<path>`.
  - [x] D-58: remplacer `[^:#]+` par un pattern qui remonte une erreur sur caracteres inattendus plutot que de les ignorer silencieusement.
  - [x] D-59: commiter le story file 5.0 lors de la cloture de l'epic 5 ou au plus tard avant la merge de 5.0.1.

## Dev Notes

### Story Intent

Cette story ne modifie pas le runtime `corp`. Elle durcit le gate BMAD livre par 5.0 pour qu'il ne puisse pas etre desarme silencieusement par une edition YAML plausible, et pour qu'il attrape la transition `in-progress -> done` avant l'ecriture fautive comme l'AC1 de 5.0 le demandait.

### Dependances

Prerequis: 5.0 (mecanisation du gate, policies, tests d'integration) est la base. Aucun impact sur le coeur Mission/Ticket/Extension.

### Testing Requirements

Tests d'integration sur les scenarios suivants:
1. Commentaire YAML inline sur `epic-N`.
2. Valeur quotee `"done"` / `'done'`.
3. Cle dupliquee (double entry `epic-N: done`).
4. Indentation par tab ou >2 espaces.
5. Epic `in-progress` pret-a-clore avec story file desynchronisee.
6. Epic `in-progress` pret-a-clore avec retro `required`.
7. Story file manquant (ENOENT).
8. `--root=<path>` accepte.
9. Hook `.githooks/pre-commit` execute et bloque un commit qui desynchronise.

Suite globale `npm test` doit rester verte.

### NFR cible

NFR22 (Gate BMAD de cloture) renforce: 100% des transitions `epic-* -> done` bloquees avant ecriture fautive via le hook et la passe "pre-transition"; 0% de chemin de desarmement silencieux pour les formes YAML valides et les indentations non conformes.

## Dev Agent Record

### Implementation Plan

- Ecrire d'abord les tests d'integration couvrant les cas limites remontes par la review 5.0, y compris le hook pre-commit opt-in et les findings D-54 a D-58.
- Refactorer `scripts/check-epic-closure.ts` autour d'un parser `development_status` defensif, d'une lecture de header Markdown bornee, et d'une validation distincte des epics `done` historiques vs `in-progress` pret-a-clore.
- Mettre a jour les policies `_bmad/policies/epic-closure.md` et `_bmad/policies/workspace-compat.md`, ajouter `.githooks/pre-commit`, reconstruire `dist/`, puis valider par `npm test`.

### Debug Log

- `2026-04-14`: passage de la story `5-0-1-durcir-le-gate-de-cloture-d-epic-findings-review` en `in-progress` dans `sprint-status.yaml` et ajout d'une matrice de 17 tests d'integration rouges couvrant AC1-11, D-54 a D-58 et le hook opt-in.
- `2026-04-14`: refactorisation de `scripts/check-epic-closure.ts` pour parser `development_status` de facon defensive (commentaires inline, quotes, cles dupliquees, indentation stricte, erreurs de format), lire `Status:` uniquement dans le header Markdown et inspecter aussi les epics `in-progress` pret-a-clore.
- `2026-04-14`: ajout de `.githooks/pre-commit`, mise a jour de `_bmad/policies/epic-closure.md` (activation `core.hooksPath`, appel direct de `dist/`, contrat pre-transition) et de `_bmad/policies/workspace-compat.md` (scenario 4.4 concret sur `ticket-board`).
- `2026-04-14`: validations executees avec succes via `npm run build`, `node --test "dist/tests/integration/check-epic-closure.test.js"` et `npm test` (263 tests verts).

### Completion Notes

- Le gate `check-epic-closure` ne peut plus etre desarme silencieusement par `done # note`, `"done"`, `'done'`, une indentation par tab/3 espaces, une cle dupliquee ou une entree `development_status` mal formee: ces cas sont soit normalises explicitement, soit rejetes avec un diagnostic stable en francais.
- Le script couvre maintenant les epics historiques `done` et les epics `in-progress` pret-a-clore; il bloque donc la transition avant l'ecriture fautive avec le message distinct `epic pret a clore mais desynchronise` quand un story file ou la retrospective n'est pas `done`.
- La validation des story files est bornee au header Markdown, les erreurs ENOENT sont explicites, et la validation n'emet plus de double-remontee pour une meme story quand le tracker est deja invalide.
- Un hook opt-in `.githooks/pre-commit` appelle directement `node dist/scripts/check-epic-closure.js --root=<repo>` sans rebuild systematique, avec garde explicite si `dist/` manque ou n'est pas a jour.
- Les policies BMAD sont alignees avec le comportement livre: `epic-closure.md` documente l'activation du hook et la passe pre-transition, `workspace-compat.md` explicite enfin le precedent 4.4 avec un scenario legacy concret sur `ticket-board`.
- Le story file 5.0 est toujours present dans le working tree et reference dans la file list de cette story pour etre embarque dans le meme lot de commit/merge que 5.0.1, conformement au suivi D-59.

## File List

- `_bmad-output/implementation/5-0-1-durcir-le-gate-de-cloture-d-epic-findings-review.md`
- `_bmad-output/implementation/5-0-mecaniser-la-gouvernance-de-cloture-d-epic-bmad.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `.githooks/pre-commit`
- `_bmad/policies/epic-closure.md`
- `_bmad/policies/workspace-compat.md`
- `dist/scripts/check-epic-closure.js`
- `dist/tests/integration/check-epic-closure.test.js`
- `scripts/check-epic-closure.ts`
- `tests/integration/check-epic-closure.test.ts`

## Change Log

- `2026-04-14`: creation de la story 5.0.1 suite aux findings review de 5.0 (12 patches + 2 decisions + 6 defers absorbes en un seul lot).
- `2026-04-14`: durcissement livre du gate `check-epic-closure` (parser YAML defensif, passe pre-transition, hook pre-commit opt-in, policies alignees, tests d'integration et regression complete verte).
