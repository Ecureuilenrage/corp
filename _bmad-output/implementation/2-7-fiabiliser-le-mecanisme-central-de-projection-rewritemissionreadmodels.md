# Story 2.7: Fiabiliser le mecanisme central de projection rewriteMissionReadModels

Status: review

## Story

As a operateur technique,
I want que les projections de lecture soient toujours coherentes apres chaque operation de mutation,
so that tout consommateur (CLI, agent autonome, pipeline) puisse lire un etat fiable directement depuis les fichiers de projection.

## Acceptance Criteria

1. Given une operation de mutation (ticket create, update, cancel, run, artifact register) vient de se terminer
   When les projections sont rafraichies
   Then `resume-view.json` est ecrit sur disque avec les openTickets, lastEventId et nextOperatorAction a jour
   And les cinq projections (`mission-status`, `ticket-board`, `resume-view`, `artifact-index`, `approval-queue`) sont coherentes entre elles

2. Given `readMissionStatus` est appele
   When il a besoin du ticket board et du resume
   Then le ticket board n'est lu/reconstruit qu'une seule fois
   And aucune race condition ne peut survenir entre deux lectures independantes du meme fichier

3. Given une erreur I/O survient pendant la lecture du ticket board (permissions, disque plein, JSON corrompu)
   When l'erreur est remontee a l'operateur
   Then le message d'erreur distingue les vraies erreurs FS de la corruption de projection
   And l'operateur peut diagnostiquer la cause reelle sans confusion

4. Given `rewriteMissionReadModels` est appele pendant un flow multi-etapes (ex: ticket run)
   When les projections sont ecrites
   Then seules les projections pertinentes pour l'operation en cours sont ecrites
   And `artifact-index.json` n'est pas reecrit lors d'un `ticket create` (conformement a la spec 2-1)

## Context

Cette story corrige le mecanisme central `rewriteMissionReadModels` qui est appele par toutes les operations de mutation des stories 2-1 a 2-5. Les problemes identifies affectent la coherence des projections, la performance et le diagnostic d'erreur.

### Findings adresses

- **C1** (critical/bug): `ticket-service-support.ts:130-134` â€” `resume-view.json` n'est jamais ecrit par `rewriteMissionReadModels`; tout consommateur qui lit directement la projection voit un etat obsolete
- **C3** (medium/spec-deviation): `ticket-service-support.ts:180-188` â€” `artifact-index.json` est ecrit par `ticket create` alors que la spec 2-1 l'interdit; peut ecraser un index existant de Story 2-5
- **C10** (critical/bug): `read-mission-status.ts:20-35` â€” `readTicketBoard` est appele deux fois (une fois dans `readMissionResume`, une fois dans `readMissionStatus`); race condition potentielle + double I/O
- **H** (high/bug): `read-ticket-board.ts:50-78` â€” catch generique remplace toutes les erreurs par "Projection ticket-board irreconciliable", masquant les vraies erreurs FS
- **M** (medium): `rewriteMissionReadModels` appele 4x pendant un run et 2xN pour N artefacts â€” performance degradee et snapshots intermediaires incherents visibles sur disque
- **M** (medium): `isProjectionUpToDate` via `JSON.stringify` â€” fragile a l'ordre des cles

## Tasks / Subtasks

- [x] Ajouter l'ecriture de `resume-view.json` dans `rewriteMissionReadModels` (AC: 1)
  - [x] Dans `ticket-service-support.ts`, apres les ecritures de `mission-status`, `ticket-board` et `artifact-index`, ajouter un appel a `buildResumeViewProjection` suivi de `writeProjectionSnapshot("resume-view", ...)`.
  - [x] Importer `buildResumeViewProjection` depuis `packages/journal/src/projections/resume-view-projection.ts`.
  - [x] Passer les memes `missionEvents` et `openTickets` (derivees du board fraichement construit) au builder de resume-view.
  - [x] Verifier qu'apres un `ticket create`, `resume-view.json` sur disque contient le ticket dans `openTickets` et `lastEventId` pointe vers `ticket.created`.

- [x] Rendre l'ecriture d'`artifact-index.json` conditionnelle (AC: 4)
  - [x] Ajouter un parametre optionnel `skipArtifactIndex?: boolean` a `rewriteMissionReadModels`.
  - [x] Dans `create-ticket.ts`, passer `{ skipArtifactIndex: true }` pour ne pas ecrire `artifact-index.json` lors d'un `ticket create`.
  - [x] Dans les autres appelants (update, cancel, move, run, register-artifacts), garder le comportement actuel (ecriture de `artifact-index`).

- [x] Eliminer le double appel `readTicketBoard` dans `readMissionStatus` (AC: 2)
  - [x] Modifier `readMissionResume` pour retourner le `ticketBoard` construit dans son resultat (champ additionnel).
  - [x] Modifier `readMissionStatus` pour reutiliser le board retourne par `readMissionResume` au lieu d'appeler `readTicketBoard` une seconde fois.
  - [x] Verifier qu'un seul appel a `readTicketBoard` est effectue pour `corp mission status`.

- [x] Ameliorer le diagnostic d'erreur dans `readTicketBoard` (AC: 3)
  - [x] Remplacer le `catch` generique par un catch qui preserve le type d'erreur original.
  - [x] Pour les erreurs avec `code` POSIX (`ENOENT`, `EPERM`, `EMFILE`, `ENOSPC`), remonter un message specifique: "Erreur fichier: <message original>".
  - [x] Pour les erreurs de parsing JSON (`SyntaxError`), remonter: "Projection ticket-board corrompue: <fichier>".
  - [x] Ne garder le message "irreconciliable" que pour les erreurs de reconstruction logique (inccoherence journal/snapshot).

- [x] Reduire la frequence des reecritures pendant un flow multi-etapes (AC: 4)
  - [x] Pour `run-ticket.ts`: deplacer l'appel `rewriteMissionReadModels` de chaque `persistRunTransition` vers un seul appel en fin de flow (apres `execution.completed` ou `execution.failed`). Les etapes intermediaires (`workspace.isolation_created`, `ticket.claimed`, `execution.requested`) doivent persister journal + snapshots mais pas les projections.
  - [x] Pour `register-artifacts.ts`: accumuler les artefacts et appeler `rewriteMissionReadModels` une seule fois apres le lot complet (pas 2xN fois).
  - [x] Ajouter un parametre `skipProjectionRewrite?: boolean` a `persistRunTransition` pour controler si les projections sont ecrites a chaque etape.

- [x] Ajouter la couverture de tests (AC: 1, 2, 3, 4)
  - [x] Test d'integration: apres `ticket create`, lire `resume-view.json` depuis le disque et verifier qu'il contient le ticket dans `openTickets`.
  - [x] Test d'integration: apres `ticket create`, lire `artifact-index.json` et verifier qu'il n'a pas ete modifie (timestamp inchange ou contenu identique au seed initial).
  - [x] Test d'integration: verifier que `corp mission status` ne produit qu'un seul appel a `readTicketBoard` (ou a minima que le resultat est coherent et ne contient pas de doublons).
  - [x] Test unitaire: simuler une erreur EPERM dans `readTicketBoard` et verifier que le message d'erreur mentionne "Erreur fichier" et non "irreconciliable".
  - [x] Test unitaire: simuler un JSON corrompu dans `ticket-board.json` et verifier que le message mentionne "corrompue".

## Dev Notes

### Architecture Compliance

- L'architecture 3.9 exige des projections locales pour `mission status`, `ticket board`, `approval queue`, `artifact index` et `resume view`. L'absence de `resume-view` dans `rewriteMissionReadModels` viole cette exigence.
- L'architecture 4.1 exige que toute transition produise un evenement avant toute projection. Cet ordre est deja respecte; cette story ne le modifie pas.
- La reduction de frequence des reecritures est une optimisation de performance qui ne change pas la semantique: les projections finales restent identiques.

### Implementation Guardrails

- Ne pas modifier la logique de construction des projections (resume-view-projection, ticket-board-projection, etc.) â€” seulement le moment et la frequence d'appel.
- Ne pas casser la compatibilite des appelants existants de `rewriteMissionReadModels`.
- Les tests intermediaires doivent passer a chaque etape de refactoring.
- Garder la signature de `rewriteMissionReadModels` backward-compatible via parametres optionnels.

### Recommended File Touch Points

- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` â€” rewriteMissionReadModels + persistRunTransition
- `packages/mission-kernel/src/resume-service/read-mission-status.ts` â€” elimination double appel
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` â€” retourner le board dans le resultat
- `packages/ticket-runtime/src/planner/read-ticket-board.ts` â€” amelioration du diagnostic d'erreur
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts` â€” passer skipArtifactIndex
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` â€” reduire frequence reecritures
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts` â€” batching des reecritures
- `tests/integration/create-ticket.test.ts` â€” etendre
- `tests/integration/run-ticket.test.ts` â€” etendre
- `tests/integration/ticket-board.test.ts` â€” etendre

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`.
- Chaque correction doit avoir au moins un test d'integration verifiant l'etat du fichier de projection sur disque.
- Les tests de diagnostic d'erreur peuvent etre unitaires (injection d'erreur).

### Scope Exclusions

- Hors scope: introduire une transaction atomique ou un rollback mecanique (amelioration future).
- Hors scope: changer le format des projections JSON.
- Hors scope: ajouter de nouvelles projections non listees dans l'architecture.

### References

- Code review adversariale Epic 2 (2026-04-10) â€” Findings C1, C3, C10, H (readTicketBoard catch)
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` â€” 3.9 Journal and Projection Model, 4.1 Domain Consistency Rules

## Dev Agent Record

### Debug Log References

- 2026-04-10: lecture complete du workflow `bmad-dev-story`, de la story 2.7, de `sprint-status.yaml`, de la config BMAD et des seams runtime/kernel/tests references par la story.
- 2026-04-10: passage de la story 2.7 a `in-progress` dans `sprint-status.yaml`, puis ajout des tests rouges sur `create-ticket`, `run-ticket`, `mission status` et `ticket-board`.
- 2026-04-10: implementation de `buildResumeViewProjection`, extension de `rewriteMissionReadModels`, elimination du double `readTicketBoard`, durcissement des diagnostics `readTicketBoard`, et reduction des rewrites intermediaires dans `run-ticket` / `register-artifacts`.
- 2026-04-10: validations executees avec succes via `npm run build`, `node --test "dist/tests/integration/create-ticket.test.js" "dist/tests/integration/run-ticket.test.js" "dist/tests/integration/mission-resume.test.js" "dist/tests/integration/ticket-board.test.js"`, `node --test "dist/tests/integration/artifact-index.test.js"` puis `npm test` (90 tests verts).

### Completion Notes List

- `rewriteMissionReadModels` ecrit maintenant `resume-view.json` en s'appuyant sur un builder centralise qui derive `lastEventId`, `openTickets` et `nextOperatorAction` a partir du board et des evenements mission, sans changer le format des projections.
- L'ecriture d'`artifact-index.json` est devenue optionnelle via `skipArtifactIndex`; `ticket create` preserve ainsi l'index existant, tandis que les autres flows gardent le comportement attendu.
- `readMissionResume` retourne desormais le board qu'il a deja lu, et `readMissionStatus` le reutilise au lieu de relire `ticket-board.json`, supprimant le double I/O et le risque de race.
- `readTicketBoard` distingue maintenant les erreurs fichier (`Erreur fichier: ...`), la corruption JSON de `ticket-board.json` (`Projection ticket-board corrompue: ...`) et les vraies incoherences logiques (`irreconciliable`).
- `run-ticket` n'ecrit plus les projections a chaque transition intermediaire, et `register-artifacts` rebatch les artefacts pour ne reecrire les projections qu'une seule fois en fin de lot.
- La couverture de tests a ete etendue sur les nouveaux guardrails de rewrite et de diagnostic; toutes les validations demandees sont vertes, y compris `npm test`.

## File List

- `_bmad-output/implementation/2-7-fiabiliser-le-mecanisme-central-de-projection-rewritemissionreadmodels.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/mission-kernel/src/resume-service/read-mission-status.ts`
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `tests/integration/create-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/integration/ticket-board.test.ts`

## Change Log

- 2026-04-10: story 2.7 implementee, rewrites centralises fiabilises, diagnostics `ticket-board` precises, tests cibles + artefacts verts, puis `npm test` complet vert (90 tests).
