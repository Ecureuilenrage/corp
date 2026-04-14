# Story 2.6: Corriger les guards de statuts terminaux et le filtre des tickets ouverts

Status: review

## Story

As a operateur technique,
I want que les operations sur les tickets respectent strictement les statuts terminaux du contrat canonique,
so that un ticket done ou failed ne puisse pas etre annule, mute ou affiche comme ouvert, preservant ainsi l'integrite du journal et des projections.

## Acceptance Criteria

1. Given un ticket est en statut `done` ou `failed`
   When l'operateur tente de l'annuler via `corp mission ticket cancel`
   Then la commande echoue avec un message d'erreur deterministe en francais
   And ni le journal, ni la mission, ni les projections ne sont mutes

2. Given un ticket est en statut `failed`, `claimed`, `in_progress` ou `blocked`
   When l'operateur tente de le modifier via `corp mission ticket update`
   Then la commande echoue avec un message d'erreur deterministe en francais
   And ni le journal, ni la mission, ni les projections ne sont mutes

3. Given une mission contient des tickets en statut `failed`
   When l'operateur consulte `corp mission resume`
   Then les tickets `failed` n'apparaissent pas dans la section "Tickets ouverts"
   And `nextOperatorAction` ne pointe pas vers un ticket definitivement en echec

4. Given un ticket a un statut inconnu ou non gere par le board
   When le ticket board est construit
   Then ce ticket n'est jamais marque `runnable: true`
   And seuls les tickets `todo` avec dependances resolues peuvent etre marques runnable

## Context

Cette story corrige 4 bugs critiques identifies lors de la code review adversariale de l'Epic 2 (stories 2-1 a 2-5). Ces bugs concernent tous le meme theme: les listes de statuts terminaux sont incompletes ou implicites dans le code actuel.

### Findings adresses

- **C4** (critical/bug): `cancel-ticket.ts:57` â€” seul `cancelled` est rejete; `done` et `failed` sont acceptes en violation de l'architecture 3.3
- **C5** (critical/bug): `update-ticket.ts:68` â€” seuls `done` et `cancelled` sont gardes; un ticket `failed`, `claimed`, `in_progress` ou `blocked` peut etre mute sous l'agent qui l'execute
- **C9** (critical/bug): `read-mission-resume.ts:261-266` â€” la liste d'exclusion des openTickets omet `"failed"`; un ticket failed apparait dans "Tickets ouverts" et pollue `nextOperatorAction`
- **C11** (critical/bug): `build-ticket-board.ts:229-240` â€” tout statut non gere tombe dans `return { runnable: true }`; un statut futur serait incorrectement lance par le dispatcher
- **H15** (high/missing-test): aucun test pour cancel done/failed (masque le bug C4)
- **M** (medium/missing-test): mutation de tickets claimed/in_progress non testee
- **M** (medium/spec-deviation): `update-ticket.ts` â€” `status` implicitement preserve par spread, sans guard explicite

## Tasks / Subtasks

- [x] Centraliser les listes de statuts terminaux dans le contrat (AC: 1, 2, 3, 4)
  - [x] Ajouter dans `packages/contracts/src/ticket/ticket.ts` des constantes exportees `TERMINAL_TICKET_STATUSES` (= `["done", "failed", "cancelled"]`) et `NON_UPDATABLE_TICKET_STATUSES` (= `["done", "failed", "cancelled", "claimed", "in_progress", "blocked"]`) afin que chaque module consomme une source unique de verite.
  - [x] Documenter dans un commentaire TSDoc la semantique: terminal = aucune operation de mutation possible; non-updatable = seules les transitions de statut via run/cancel sont autorisees, pas les updates de contenu.

- [x] Corriger le guard de `cancel-ticket.ts` (AC: 1)
  - [x] Remplacer le guard `ticket.status === "cancelled"` par une verification contre `TERMINAL_TICKET_STATUSES` (done, failed, cancelled).
  - [x] Produire un message d'erreur deterministe en francais distinct pour chaque cas: "Le ticket X est deja termine (statut: done)" / "Le ticket X est deja en echec (statut: failed)" / "Le ticket X est deja annule".
  - [x] Verifier que ni le journal, ni mission.ticketIds, ni les projections ne sont mutes en cas de rejet.

- [x] Corriger le guard de `update-ticket.ts` (AC: 2)
  - [x] Remplacer le guard `ticket.status === "done" || ticket.status === "cancelled"` par une verification contre `NON_UPDATABLE_TICKET_STATUSES`.
  - [x] Produire un message d'erreur deterministe en francais: "Le ticket X ne peut pas etre modifie dans son statut actuel (statut: Y). Seuls les tickets en statut todo ou awaiting_approval peuvent etre mis a jour."
  - [x] Garder `status` explicitement immutable dans l'update: ajouter un guard qui rejette toute tentative de mutation directe de `ticket.status` via update (meme si ce champ n'est pas encore dans les options parsees).

- [x] Corriger le filtre des tickets ouverts dans le resume (AC: 3)
  - [x] Dans `read-mission-resume.ts`, ajouter `"failed"` a la liste d'exclusion des openTickets: `["done", "completed", "cancelled", "closed", "failed"]`.
  - [x] Verifier que `deriveNextOperatorAction` dans `resume-view-projection.ts` ne pointe jamais vers un ticket `failed` comme prochain arbitrage. Si un ticket failed est le seul restant, l'action doit orienter vers la replanification.

- [x] Corriger le guard runnable dans build-ticket-board (AC: 4)
  - [x] Ajouter un guard explicite `if (ticket.status !== "todo") { return { runnable: false, planningState: "not_runnable_status", ... } }` avant le return final dans la logique de calcul du board.
  - [x] S'assurer que tout statut inconnu ou futur est traite comme non-runnable par defaut (fail-safe).

- [x] Ajouter la couverture de tests (AC: 1, 2, 3, 4)
  - [x] Test contractuel CLI: `corp mission ticket cancel` sur un ticket `done` â†’ message d'erreur, exit code non-zero, journal inchange.
  - [x] Test contractuel CLI: `corp mission ticket cancel` sur un ticket `failed` â†’ idem.
  - [x] Test contractuel CLI: `corp mission ticket update --goal "new"` sur un ticket `claimed` â†’ message d'erreur, journal inchange.
  - [x] Test contractuel CLI: `corp mission ticket update --goal "new"` sur un ticket `in_progress` â†’ message d'erreur, journal inchange.
  - [x] Test d'integration: apres creation d'un ticket en statut `failed` (via manipulation directe du snapshot pour cette story), verifier que `mission resume` ne le liste pas dans openTickets.
  - [x] Test d'integration: construire un board avec un ticket ayant un statut forge non standard (ex: `"on_hold"`) et verifier qu'il n'est pas marque runnable.
  - [x] Etendre les tests existants de `cancel-ticket.test.ts` pour couvrir les cas `done` et `failed`.
  - [x] Etendre les tests existants de `update-ticket.test.ts` pour couvrir les cas `claimed`, `in_progress`, `blocked`, `failed`.

## Dev Notes

### Architecture Compliance

- Les listes de statuts terminaux doivent etre coherentes avec l'architecture 3.3 qui definit `done`, `failed` et `cancelled` comme terminaux.
- Le guard runnable doit etre coherent avec l'architecture 3.5 qui impose un ordonnanceur simple base sur `dependsOn[]` et un seul statut initial runnable (`todo`).

### Implementation Guardrails

- Ne pas modifier les transitions de statut elles-memes (ca releve des stories 2.2 et 2.3).
- Ne pas introduire de nouveaux statuts.
- Ne pas modifier la logique de `dependsOn` ni le calcul du graphe de dependances.
- Les tests doivent utiliser le style existant: `node:test`, `assert/strict`, `mkdtemp`.

### Recommended File Touch Points

- `packages/contracts/src/ticket/ticket.ts` â€” constantes de statuts terminaux
- `packages/ticket-runtime/src/ticket-service/cancel-ticket.ts` â€” guard
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts` â€” guard
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` â€” filtre openTickets
- `packages/journal/src/projections/resume-view-projection.ts` â€” deriveNextOperatorAction
- `packages/ticket-runtime/src/planner/build-ticket-board.ts` â€” guard runnable
- `tests/contract/mission-ticket-cancel-cli.test.ts` â€” etendre
- `tests/contract/mission-ticket-update-cli.test.ts` â€” etendre
- `tests/integration/cancel-ticket.test.ts` â€” etendre
- `tests/integration/update-ticket.test.ts` â€” etendre
- `tests/integration/ticket-board.test.ts` â€” etendre
- `tests/integration/mission-resume.test.ts` â€” etendre

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`.
- Chaque guard corrige doit avoir au moins un test contractuel CLI et un test d'integration.
- Les tests doivent verifier l'absence de mutation du journal et des projections en cas de rejet.

### References

- Code review adversariale Epic 2 (2026-04-10) â€” Findings C4, C5, C9, C11, H15
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` â€” 3.3 Canonical Domain Contract, 3.5 Execution Strategy
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` â€” NFR10 (distinction statuts), NFR9 (tache en echec inspectable)

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Centraliser les statuts `terminal` et `non-updatable` dans le contrat ticket pour supprimer les listes divergentes entre services et projections.
- Durcir `cancel-ticket`, `update-ticket`, `read-mission-resume`, `resume-view-projection` et `build-ticket-board` avec des guards fail-safe et des messages deterministes en francais.
- Etendre la couverture contrat/integration sur les rejets sans mutation, le resume des tickets `failed` et le traitement non-runnable des statuts inconnus.

### Debug Log References

- 2026-04-10: lecture complete du workflow `bmad-dev-story`, de la story 2.6, de `sprint-status.yaml`, du PRD, de l'architecture et des fichiers runtime/tests references dans la story.
- 2026-04-10: passage de la story 2.6 a `in-progress` dans `sprint-status.yaml` avant implementation.
- 2026-04-10: ajout des tests rouges sur `cancel`, `update`, `mission resume` et `ticket board`, puis execution ciblee apres build avec 8 echecs attendus sur 31 tests cibles.
- 2026-04-10: implementation des constantes de statuts, des guards runtime/projections, du filtre `failed` pour le resume et du fail-safe `non-runnable` pour les statuts inconnus du board.
- 2026-04-10: validations executees avec succes via `npm run build`, `node --test "dist/tests/contract/mission-ticket-cancel-cli.test.js" "dist/tests/contract/mission-ticket-update-cli.test.js" "dist/tests/integration/cancel-ticket.test.js" "dist/tests/integration/update-ticket.test.js" "dist/tests/integration/mission-resume.test.js" "dist/tests/integration/ticket-board.test.js"` (31 tests verts) puis `npm test` (86 tests verts).

### Completion Notes List

- Les statuts terminaux et non modifiables sont maintenant centralises dans `packages/contracts/src/ticket/ticket.ts` via `TERMINAL_TICKET_STATUSES` et `NON_UPDATABLE_TICKET_STATUSES`, avec TSDoc sur leur semantique.
- `cancel-ticket.ts` rejette desormais `done`, `failed` et `cancelled` avec des messages distincts et deterministes, sans mutation du journal, des snapshots mission/ticket ni des projections en cas de rejet.
- `update-ticket.ts` interdit les updates de contenu sur `done`, `failed`, `cancelled`, `claimed`, `in_progress` et `blocked`, et rejette explicitement toute tentative de mutation directe du champ `status`.
- `read-mission-resume.ts` exclut maintenant `failed` des `openTickets`, tandis que `resume-view-projection.ts` oriente vers la replanification si des tickets en echec existent sans ticket actionable.
- `build-ticket-board.ts` traite tout statut non `todo` restant, y compris un statut inconnu forge dans un snapshot, comme `not_runnable_status` par defaut.
- La couverture de tests a ete etendue en contrat et integration sur `cancel`, `update`, `mission resume` et `ticket board`; `npm test` passe integralement avec 86 tests verts.

## File List

- `_bmad-output/implementation/2-6-corriger-les-guards-de-statuts-terminaux-et-le-filtre-des-tickets-ouverts.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `packages/contracts/src/ticket/ticket.ts`
- `packages/ticket-runtime/src/ticket-service/cancel-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `tests/contract/mission-ticket-cancel-cli.test.ts`
- `tests/contract/mission-ticket-update-cli.test.ts`
- `tests/integration/cancel-ticket.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/ticket-board.test.ts`

## Change Log

- 2026-04-10: story 2.6 implementee, tests cibles ajoutes, `node --test` cible vert sur 31 tests et `npm test` complet vert sur 86 tests; statut passe a `review`.

