# Story 2.10: Combler les gaps de tests et corriger les bugs edge-case restants

Status: review

## Story

As a operateur technique,
I want que les chemins d'erreur, les edge cases et les operations secondaires soient couverts par des tests fiables et que les bugs restants soient corriges,
so that l'Epic 2 soit suffisamment robuste pour servir de fondation aux Epics 3 et 4.

## Acceptance Criteria

1. Given une dependance inconnue est validee par `validateTicketDependencies`
   When la validation itere sur les missions existantes
   Then la recherche est bornee en I/O (pas O(M*T) lectures fichier)
   And un timeout ou une limite de missions iterees est en place

2. Given un ticket utilise `--before-ticket` ou `--after-ticket` avec son propre ID (auto-reference)
   When `move-ticket` traite la commande
   Then le message d'erreur est "Le ticket ne peut pas etre deplace par rapport a lui-meme"
   And le check auto-reference est atteint avant le check cross-mission

3. Given un graphe de dependances forme un cycle a 3 noeuds (A -> B -> C -> A)
   When la validation de cycle est executee
   Then le cycle est detecte et rejete avec un message d'erreur explicite

4. Given toutes les stories 2-1 a 2-5 sont implementees
   When la suite de tests est executee
   Then chaque chemin d'erreur documente dans les specs a au moins un test contractuel ou d'integration
   And les formatters CLI ont au moins un test unitaire verifiant leur sortie

5. Given les comparaisons d'objets sont utilisees pour detecter les no-op ou les projections perimees
   When deux objets ont le meme contenu mais dans un ordre de cles ou de liste different
   Then la comparaison est insensible a l'ordre des cles JSON et trie les listes avant comparaison

## Context

Cette story regroupe les bugs de moindre severite et les gaps de tests structurels identifies lors de la code review adversariale de l'Epic 2, qui ne rentrent pas dans les stories correctives 2-6 a 2-9. Elle vise a consolider la robustesse avant de passer aux Epics 3 et 4.

### Findings adresses

**Bugs a corriger:**
- **H1** (high/bug): `validate-ticket-dependencies.ts:38-44` - `findOwningMissionId` fait O(M*T) I/O pour chaque dependance inconnue sans limite
- **H2** (high/bug): `validate-ticket-dependencies.ts:92` - detection de cycles fragile a 3+ noeuds avec tickets cancelled filtres avant traversee
- **H3** (high/bug): `move-ticket.ts:145` - check auto-reference est dead code; le message d'erreur est trompeur ("n'appartient pas a la mission" au lieu de "lui-meme")
- **M** (medium/bug): `update-ticket.ts:115` - comparaison no-op via `JSON.stringify` sensible a l'ordre des listes; un reordonnement de `dependsOn` produit un faux evenement `ticket.updated`
- **M** (medium/bug): `read-ticket-board.ts:124-129` - `isProjectionUpToDate` via `JSON.stringify` fragile a l'ordre des cles
- **M** (medium/bug): `read-mission-artifacts.ts:186-191` - meme probleme pour la comparaison de projection artifact-index
- **M** (medium/bug): `validate-ticket-dependencies.ts:28-33` - dependance sur ticket `cancelled` rejetee a la creation mais non specifiee dans la story; asymetrie non documentee avec `failed`
- **L** (low/bug): `file-ticket-repository.ts:53-68` - `findOwningMissionId` non securise sur noms de repertoires invalides

**Tests manquants a ajouter:**
- **H12** (high/missing-test): test non-regression missionA dans `create-ticket.test.ts` passe de maniere accidentelle
- **H13** (high/missing-test): aucun test d'integration standalone pour `ticket move` (`--before-ticket`, `--after-ticket`, `--to-back`)
- **H14** (high/missing-test): cycle de dependances a 3 noeuds non teste
- **H16** (high/missing-test): aucun test pour le path `execution.failed` (adapter throw) - tests specifiques aux guards CLI
- **H17** (high/missing-test): aucun test unitaire pour `mapResponseStatus`, `normalizeResponseOutputs`, `buildRequestBody` de l'adaptateur
- **H18** (high/missing-test): gardes CLI manquantes: owner vide, statut ticket non-todo, mission terminale pour run
- **H19** (high/missing-test): chaine de blocages (A -> B -> C avec B bloque) non testee
- **H20** (high/missing-test): mission avec zero ticket, pas de test contractuel pour le board vide
- **M** (medium/missing-test): formatters sans test unitaire (`ticket-board-formatter`, `mission-status-formatter`, `mission-resume-formatter`, `artifact-list-formatter`, `artifact-detail-formatter`)
- **M** (medium/missing-test): `corp mission status` detail du board non verifie ligne par ligne
- **M** (medium/missing-test): missions `blocked`/`failed` acceptent un ticket (testing requirement de la spec 2-1 non couvert)
- **M** (medium/missing-test): `successCriteria` avec doublons: asymetrie dedupe non testee
- **L** (low/missing-test): `cancelled` non teste au niveau contract CLI pour cancel-ticket
- **L** (low/missing-test): artefact binaire/volumineux (> MAX_STORED_JSON_LENGTH) non teste
- **L** (low/missing-test): non-vendor sur `mission status` non verifie

## Tasks / Subtasks

- [x] Corriger la performance de `findOwningMissionId` (AC: 1)
  - [x] Dans `validate-ticket-dependencies.ts`, ajouter un early-return: si le nombre de missions dans `missionsDir` depasse un seuil (ex: 50), lever une erreur "Trop de missions pour une recherche exhaustive" au lieu de scanner toutes les missions.
  - [x] Alternativement, maintenir un index leger en memoire des `ticketId -> missionId` construit a partir de `mission.ticketIds` de chaque mission deja chargee, pour eviter de relire les tickets individuellement.
  - [x] Dans `file-ticket-repository.ts`, `findOwningMissionId`: ajouter un guard pour ignorer les entrees de repertoire dont le nom ne commence pas par `mission_` ou qui contiennent des caracteres interdits.

- [x] Corriger le dead code auto-reference dans `move-ticket.ts` (AC: 2)
  - [x] Deplacer le check `referenceTicketId === ticketId` **avant** le calcul de `orderWithoutTarget` (avant ligne 133).
  - [x] Le message d'erreur doit etre: "Le ticket X ne peut pas etre deplace par rapport a lui-meme."
  - [x] Verifier que ce check fonctionne pour `--before-ticket` et `--after-ticket`.

- [x] Renforcer la detection de cycles a 3+ noeuds (AC: 3)
  - [x] Dans `introducesDependencyCycle`, verifier que la traversee du graphe visite correctement tous les noeuds atteignables, y compris ceux dont les tickets sont `cancelled` (un ticket cancelled dans une chaine de dependances doit quand meme etre traverse pour la detection de cycle).
  - [x] Ajouter un set `visited` pour eviter les boucles infinies en cas de graphe corrompu.

- [x] Remplacer les comparaisons `JSON.stringify` par des comparaisons structurelles (AC: 5)
  - [x] Creer un helper `deepStrictEqualForComparison(a, b): boolean` dans un fichier utilitaire (ex: `packages/ticket-runtime/src/utils/structural-compare.ts`) qui compare deux objets de maniere insensible a l'ordre des cles et trie les tableaux de strings avant comparaison.
  - [x] Remplacer `JSON.stringify(normalizedTicket) === JSON.stringify(ticket)` dans `update-ticket.ts` par ce helper.
  - [x] Remplacer `JSON.stringify(storedBoard) === JSON.stringify(rebuiltBoard)` dans `read-ticket-board.ts` par ce helper.
  - [x] Remplacer `JSON.stringify(storedProjection) === JSON.stringify(rebuiltProjection)` dans `read-mission-artifacts.ts` par ce helper.

- [x] Corriger le test accidentel de non-regression missionA (AC: 4)
  - [x] Dans `create-ticket.test.ts`, lire `initialMissionA` **apres** la creation du ticket de missionB (pas avant), pour capturer le vrai etat de missionA au moment des tentatives d'echec.
  - [x] Ajouter un assert explicite: `assert.strictEqual(finalMissionA.updatedAt, initialMissionA.updatedAt, "missionA.updatedAt ne doit pas changer apres un echec de dependance invalide")`.

- [x] Ajouter les tests d'integration standalone pour `ticket move` (AC: 4)
  - [x] Creer `tests/integration/move-ticket.test.ts` avec les scenarios:
    - `--to-front`: le ticket devient premier dans `mission.ticketIds` et le board.
    - `--to-back`: le ticket devient dernier.
    - `--before-ticket X`: le ticket est place juste avant X dans l'ordre.
    - `--after-ticket X`: le ticket est place juste apres X dans l'ordre.
    - Auto-reference: erreur deterministe.
    - Ticket de reference inconnu: erreur deterministe.
  - [x] Verifier apres chaque operation: `mission.ticketIds` (ordre), `ticket-board.json` (planOrder), evenement `ticket.moved`.

- [x] Ajouter le test de cycle a 3 noeuds (AC: 3, 4)
  - [x] Etendre `tests/integration/update-ticket.test.ts` avec un scenario: creer 3 tickets A, B, C. Faire dependre A de B, B de C. Tenter de faire dependre C de A. Verifier le rejet avec message de cycle.

- [x] Ajouter les tests de chaine de blocages (AC: 4)
  - [x] Etendre `tests/integration/ticket-board.test.ts` avec: ticket A (todo) depend de B (blocked) qui depend de C (todo). Verifier que A est `waiting_on_dependencies`, B est `blocked`, C est `runnable`.

- [x] Ajouter le test de board mission vide (AC: 4)
  - [x] Ajouter a `tests/contract/mission-ticket-board-cli.test.ts`: `corp mission ticket board` sur une mission sans tickets -> sortie contenant "Aucun ticket n'existe encore."

- [x] Ajouter les tests unitaires pour les formatters (AC: 4)
  - [x] Creer `tests/unit/formatters.test.ts` couvrant:
    - `formatTicketBoard`: board vide, board avec 1 ticket, board avec tickets en statuts mixtes, ticket avec beaucoup de dependances.
    - `formatMissionStatus`: mission sans tickets, mission avec tickets mixtes, presence du bloc "Etat des tickets".
    - `formatMissionResume`: resume avec openTickets, resume sans openTickets, nextOperatorAction present.
    - `formatArtifactList`: liste vide, liste avec artefacts mixtes.
    - `formatArtifactDetail`: artefact avec payload, artefact sans payload, artefact avec metadata.

- [x] Ajouter les tests unitaires pour l'adaptateur (AC: 4)
  - [x] Creer `tests/unit/codex-responses-adapter.test.ts` couvrant:
    - `mapResponseStatus`: chaque statut vendor (`completed`, `failed`, `cancelled`, `in_progress`, `queued`, `undefined`) -> statut corp attendu.
    - `normalizeResponseOutputs`: output_text vide, output_text present, structured output.
    - `buildRequestBody`: options minimales, options avec background=true.

- [x] Ajouter les tests manquants pour les missions blocked/failed acceptant un ticket (AC: 4)
  - [x] Etendre `tests/integration/create-ticket.test.ts` avec: creer un ticket sur une mission `blocked` -> succes, mission reste `blocked`. Idem pour mission `failed`.

- [x] Ajouter les tests manquants pour les gardes CLI de run (AC: 4)
  - [x] Etendre `tests/contract/mission-ticket-run-cli.test.ts` avec:
    - Run sur mission `completed` -> erreur
    - Run sur mission `cancelled` -> erreur
    - Run sur mission `blocked` -> erreur (si garde existe)
    - Run sur ticket `done` -> erreur
    - Run sur ticket sans owner -> erreur

- [x] Ajouter le test non-vendor sur `mission status` (AC: 4)
  - [x] Etendre les tests d'integration existants pour verifier `doesNotMatch(/codex|openai|response_id|thread_id/i)` sur la sortie de `corp mission status`.

- [x] Documenter l'asymetrie dependance cancelled vs failed (AC: 4)
  - [x] Ajouter un commentaire dans `validate-ticket-dependencies.ts` expliquant pourquoi une dependance sur un ticket `cancelled` est rejetee a la creation (le ticket ne sera jamais `done`, donc le dependant serait bloque indefiniment), alors qu'un ticket `failed` est accepte (il pourrait etre relance).

## Dev Notes

### Architecture Compliance

- Les corrections de performance (H1) et de cycle (H2) touchent la logique de graphe de dependances, qui doit rester coherente avec l'architecture 3.5 (petit graphe `dependsOn[]`).
- Le helper de comparaison structurelle doit etre place dans un utilitaire partage, pas dans un module specifique.

### Implementation Guardrails

- Ne pas modifier les transitions de statut (releve des stories 2-6 et 2-8).
- Ne pas modifier la logique de rewriteMissionReadModels (releve de la story 2-7).
- Les nouveaux fichiers de test doivent suivre le style existant: `node:test`, `assert/strict`, `mkdtemp`.
- Les tests unitaires ne doivent pas dependre de l'etat du filesystem global; utiliser des repertoires temporaires.
- Le seuil de missions pour `findOwningMissionId` doit etre raisonnable (50-100) et configurable via constante.

### Dependencies

- Stories 2-6, 2-7, 2-8, 2-9 devraient idealement etre implementees avant cette story, car certains tests valident des comportements corriges dans ces stories. Si implementee en parallele, marquer les tests concernes comme `skip` avec un commentaire referant la story bloquante.

### Recommended File Touch Points

**Corrections de code:**
- `packages/ticket-runtime/src/dependency-graph/validate-ticket-dependencies.ts` - performance, cycle 3+
- `packages/ticket-runtime/src/ticket-service/move-ticket.ts` - dead code auto-reference
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts` - comparaison structurelle
- `packages/ticket-runtime/src/planner/read-ticket-board.ts` - comparaison structurelle
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts` - comparaison structurelle
- `packages/storage/src/repositories/file-ticket-repository.ts` - guard noms de repertoires

**Nouveaux fichiers de test:**
- `tests/integration/move-ticket.test.ts` - nouveau
- `tests/unit/formatters.test.ts` - nouveau
- `tests/unit/codex-responses-adapter.test.ts` - nouveau
- `packages/ticket-runtime/src/utils/structural-compare.ts` - nouveau helper

**Fichiers de test a etendre:**
- `tests/integration/create-ticket.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/integration/ticket-board.test.ts`
- `tests/contract/mission-ticket-board-cli.test.ts`
- `tests/contract/mission-ticket-run-cli.test.ts`

### Testing Requirements

- Style existant: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`.
- Chaque finding reference doit avoir au moins un test qui le couvre.
- Les tests unitaires de formatters doivent verifier la sortie exacte (array de strings) sans dependre de la CLI.
- Les tests de l'adaptateur doivent etre purement unitaires (pas de requete HTTP reelle).

### Scope Exclusions

- Hors scope: implementation d'un index persistant ticketId -> missionId (la solution retenue est un guard de seuil).
- Hors scope: refactoring complet de la detection de cycles (le renforcement doit etre minimal et cible).
- Hors scope: tests e2e complets de la boucle d'orchestration (releve de l'Epic 3+).

### References

- Code review adversariale Epic 2 (2026-04-10) - Findings H1, H2, H3, H12-H22, et tous les findings medium/low de tests manquants
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.5 Execution Strategy, 4.2 Naming Patterns
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites.md` - Testing Requirements
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md` - Testing Requirements

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Borner et securiser `findOwningMissionId` avec un seuil configurable, un filtrage strict des repertoires et un index memoire `ticketId -> missionId` derive de `mission.ticketIds`.
- Introduire un helper de comparaison structurelle partage pour les no-op `ticket update` et les projections `ticket-board` / `artifact-index`.
- Completer la couverture demandee par la story sur `move`, les cycles a 3 noeuds, la chaine de blocages, les gardes CLI `run`, le board vide, les formatters et l'adaptateur `codex_responses`.
- Valider via build, suites ciblees sur les nouveaux scenarios, puis `npm test` complet avant passage en `review`.

### Debug Log References

- 2026-04-10: chargement du skill `bmad-dev-story`, de la config BMAD, de la story 2.10 et de `sprint-status.yaml`, puis passage de la story en `in-progress`.
- 2026-04-10: analyse des correctifs deja presents dans l'epic, puis implementation du helper `structural-compare`, du lookup borne/securise dans `file-ticket-repository` et du guard auto-reference positionne avant `orderWithoutTarget` dans `move-ticket`.
- 2026-04-10: ajout des tests unitaires `formatters`, `codex-responses-adapter`, `file-ticket-repository`, du nouveau scenario d'integration `move-ticket`, puis extension des suites `create-ticket`, `update-ticket`, `ticket-board`, `artifact-index`, `mission-resume`, `mission-ticket-board-cli` et `mission-ticket-run-cli`.
- 2026-04-10: validations executees via `npm run build`, une passe ciblee des tests modifies, puis `npm test` complet vert (132 tests).

### Completion Notes List

- `findOwningMissionId` est maintenant borne a 50 missions valides max, ignore les repertoires `mission_` invalides et construit une map memoire `ticketId -> missionId` a partir des `mission.ticketIds`, ce qui supprime les lectures `ticket.json` mission par mission pour les dependances inconnues.
- `move-ticket` verifie explicitement l'auto-reference avant le calcul intermediaire de l'ordre, et les tests standalone verrouillent `--to-front`, `--to-back`, `--before-ticket`, `--after-ticket`, les erreurs deterministes et le contrat d'evenement `ticket.reprioritized` deja etabli par la story 2.2.
- `deepStrictEqualForComparison` remplace les comparaisons `JSON.stringify` sensibles a l'ordre dans `update-ticket`, `read-ticket-board` et `read-mission-artifacts`; les reordonnancements de listes de strings sont traites comme des no-op, et les projections equivalentes ne sont plus reecrites quand seul l'ordre des cles JSON change.
- La couverture de robustesse a ete etendue sur les missions `blocked`/`failed` acceptant un ticket, les cycles a 3 noeuds, la chaine `A -> B -> C` avec `B` bloque, le board vide, les gardes `run`, l'absence de fuite `response_id/thread_id`, les formatters CLI et les helpers purs de l'adaptateur `codex_responses`.
- L'asymetrie `cancelled` vs `failed` est maintenant documentee dans `validate-ticket-dependencies.ts`, et toutes les validations finales demandees par la story sont vertes.

## File List

- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/ticket-runtime/src/dependency-graph/validate-ticket-dependencies.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/move-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `packages/ticket-runtime/src/utils/structural-compare.ts`
- `tests/contract/mission-ticket-board-cli.test.ts`
- `tests/contract/mission-ticket-run-cli.test.ts`
- `tests/integration/artifact-index.test.ts`
- `tests/integration/create-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/move-ticket.test.ts`
- `tests/integration/ticket-board.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/unit/codex-responses-adapter.test.ts`
- `tests/unit/file-ticket-repository.test.ts`
- `tests/unit/formatters.test.ts`

## Change Log

- 2026-04-10: story 2.10 implementee, correctifs structurels + couverture ciblee ajoutes, puis `npm test` execute avec succes (132 tests verts) avant passage du statut a `review`.
