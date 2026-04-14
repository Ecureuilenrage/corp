# Story 2.8: Corriger le flow d'execution ticket â€” transitions, adaptateur et atomicite

Status: review

## Story

As a operateur technique,
I want que l'execution d'un ticket suive correctement toutes les transitions de statut prevues par l'architecture et distingue clairement echec et annulation,
so that le journal, les projections et le board refletent fidelement l'etat reel de chaque tentative.

## Acceptance Criteria

1. Given un ticket est lance en mode foreground
   When l'adaptateur commence a executer
   Then le ticket transite par `todo -> claimed -> in_progress -> done` (ou `failed`)
   And l'etat `in_progress` est observable dans le journal et les projections pendant l'execution

2. Given un ticket est execute via un adaptateur quelconque
   When le snapshot du ticket est mis a jour avec `executionHandle`
   Then `executionHandle.adapter` reflete l'identifiant reel de l'adaptateur utilise (pas un hardcode)
   And le champ est coherent avec `attempt.adapter`

3. Given l'adaptateur retourne un statut `cancelled`
   When la tentative est finalisee
   Then `attempt.status` est `cancelled`, `ticket.status` est `cancelled` (pas `failed`)
   And l'evenement emis est `execution.cancelled` (pas `execution.failed`)
   And la mission n'est pas mise a `failed` pour une simple annulation

4. Given l'adaptateur echoue (exception ou statut `failed`)
   When la tentative est finalisee
   Then la mission n'est mise a `failed` que si aucune autre tentative active n'existe sur d'autres tickets
   And si d'autres tentatives actives existent, la mission reste `running`

5. Given la detection d'artefacts est demandee apres l'execution
   When le mode est `background` (tentative encore active, pas de resultat terminal)
   Then `detectTicketArtifacts` n'est pas appele
   And `artifact-index.json` reste inchange jusqu'a la completion effective

## Context

Cette story corrige les problemes de transition de statut, d'integration adaptateur et de semantique d'echec/annulation identifies dans la code review de la Story 2-3. Les corrections assurent la coherence entre le contrat canonique Ticket (architecture 3.3) et l'implementation reelle.

### Findings adresses

- **C6** (critical/spec-deviation): `run-ticket.ts:220-226, 484-534` â€” le ticket ne transite jamais par `in_progress` en foreground; passe de `claimed` directement a `done`
- **C7** (critical/architecture-violation): `ticket-service-support.ts:136-147` â€” `applyExecutionHandleSnapshot` hardcode `"codex_responses"` au lieu d'utiliser l'identifiant reel de l'adaptateur
- **C8** (critical/bug): `run-ticket.ts:143-175` â€” 3x `persistRunTransition` avec `rewriteMissionReadModels` avant terminal, creant des snapshots intermediaires incoherents en cas de crash (partiellement adresse par Story 2-7 pour la frequence des reecritures)
- **H4** (high/bug): `run-ticket.ts:536-577` â€” adaptateur retournant `cancelled` â†’ ticket/mission mis a `failed`, evenement `execution.failed` emis (confusion semantique)
- **H5** (high/spec-deviation): `run-ticket.ts:297-348` â€” echec adaptateur â†’ mission `failed` sans verifier si d'autres tentatives actives existent
- **M** (medium/spec-deviation): `run-ticket.ts:366-386` â€” `detectTicketArtifacts` appele en mode background avec outputs partiels
- **M** (medium/bug): `codex-responses-adapter.ts:102-113` â€” pas de timeout/AbortController sur les requetes `fetch`
- **M** (medium/bug): `workspace-isolation.ts:50-53` â€” comparaison chemin Git fragile sur Windows (style POSIX vs Win32)

## Tasks / Subtasks

- [x] Ajouter la transition `in_progress` dans le flow foreground (AC: 1)
  - [x] Dans `run-ticket.ts`, apres l'emission de `execution.requested` et avant l'appel a l'adaptateur, emettre un evenement `ticket.in_progress` et transitionner le ticket de `claimed` a `in_progress`.
  - [x] Utiliser `persistRunTransition` avec `ticketStatus: "in_progress"` et `missionStatus: "running"` (la mission devrait deja etre `running` a ce stade).
  - [x] Verifier que le board et le resume refletent `in_progress` si l'execution est longue ou si un concurrent lit les projections.
  - [x] En mode background, la transition `in_progress` doit aussi etre emise au moment ou l'adaptateur confirme le lancement (pas a la soumission initiale).

- [x] Passer l'identifiant reel de l'adaptateur a `applyExecutionHandleSnapshot` (AC: 2)
  - [x] Modifier `applyExecutionHandleSnapshot` dans `ticket-service-support.ts` pour accepter un parametre `adapterId: string` au lieu de hardcoder `"codex_responses"`.
  - [x] Dans `run-ticket.ts`, passer `adapter.id` (ou `resolvedAdapter.id`) a ce helper.
  - [x] Verifier que `ticket.executionHandle.adapter` et `attempt.adapter` ont la meme valeur apres un run.

- [x] Distinguer semantiquement `cancelled` de `failed` dans la finalisation (AC: 3)
  - [x] Dans `finalizeAdapterOutcome` de `run-ticket.ts`, ajouter un cas explicite pour `adapterResult.status === "cancelled"`:
    - `attempt.status = "cancelled"`
    - `ticket.status = "cancelled"` (pas `"failed"`)
    - `event.type = "execution.cancelled"` (pas `"execution.failed"`)
    - `mission.status`: ne pas forcer `"failed"`; evaluer via `missionHasOtherActiveAttempts` comme pour `completed`.
  - [x] Ajouter `"execution.cancelled"` au contrat des types d'evenements si absent.
  - [x] Mettre a jour le board pour que `cancelled` via adaptateur soit correctement distingue de `failed` dans le `planningState`.

- [x] Verifier les tentatives actives avant de mettre la mission a `failed` (AC: 4)
  - [x] Dans le bloc `catch` de `run-ticket.ts` (echec adaptateur exception), avant de forcer `missionStatus: "failed"`, appeler `missionHasOtherActiveAttempts` ou equivalent.
  - [x] Si d'autres tentatives sont actives, garder `missionStatus: "running"`.
  - [x] Appliquer la meme logique dans `finalizeAdapterOutcome` pour le cas `failed` (non-exception).

- [x] Ne pas detecter les artefacts en mode background (AC: 5)
  - [x] Dans `run-ticket.ts`, ajouter un guard avant `detectTicketArtifacts`: si `transitionResult.event.type === "execution.background_started"`, ne pas appeler la detection/enregistrement d'artefacts.
  - [x] La detection d'artefacts en background sera geree par le mecanisme de polling (hors scope de cette story corrective).

- [x] Corriger les bugs secondaires (AC: 1, 2)
  - [x] `codex-responses-adapter.ts`: ajouter un `AbortController` avec un timeout configurable (env `CORP_CODEX_RESPONSES_TIMEOUT_MS`, defaut 300000ms = 5min) au `fetch`.
  - [x] `workspace-isolation.ts`: normaliser le chemin retourne par `git rev-parse --show-toplevel` en convertissant les chemins POSIX (`/c/Dev/...`) en chemins Windows natifs avant comparaison. Utiliser `path.resolve()` sur le resultat apres remplacement du prefixe POSIX.

- [x] Ajouter la couverture de tests (AC: 1, 2, 3, 4, 5)
  - [x] Test d'integration: run foreground verifier que le journal contient un evenement `ticket.in_progress` entre `ticket.claimed` et `execution.completed`.
  - [x] Test d'integration: run foreground verifier que `ticket.executionHandle.adapter` correspond a l'adaptateur injecte (pas `"codex_responses"` hardcode).
  - [x] Test d'integration: simuler un adaptateur retournant `status: "cancelled"` verifier que `attempt.status === "cancelled"`, `ticket.status === "cancelled"`, event type === `"execution.cancelled"`.
  - [x] Test d'integration: simuler un echec adaptateur (throw) avec un autre ticket en cours sur la meme mission verifier que `mission.status` reste `"running"`.
  - [x] Test d'integration: run background verifier que `artifact-index.json` n'est pas modifie.
  - [x] Test contractuel CLI: run sur une mission `completed` message d'erreur deterministe.
  - [x] Test contractuel CLI: run sur un ticket `done` message d'erreur deterministe.
  - [x] Test contractuel CLI: run sur un ticket sans owner message d'erreur deterministe.

## Dev Notes

### Architecture Compliance

- L'architecture 3.3 definit les transitions de statut ticket: `todo -> claimed -> in_progress -> blocked|awaiting_approval|done|failed|cancelled`. L'absence de `in_progress` en foreground viole cette specification.
- L'architecture 3.4 exige qu'aucun identifiant vendor ne fuie hors de `adapterState`. Le hardcode de `"codex_responses"` ne fuit pas de vendor data, mais il fausse le contrat `executionHandle.adapter`.
- L'architecture 3.6 distingue `Responses API` comme adaptateur prioritaire V1 mais le support multi-adaptateur est prevu. Le hardcode compromet cette extensibilite.

### Implementation Guardrails

- Ne pas modifier le contrat canonique `Ticket` (pas de nouveau champ).
- Ne pas modifier la logique de creation de ticket (Story 2-1).
- Ne pas implementer le polling background complet (hors scope de cette story corrective).
- Les modifications de `persistRunTransition` doivent rester backward-compatible avec les appelants existants.
- Le timeout du fetch ne doit pas bloquer le process; utiliser `AbortController.abort()` avec gestion propre de l'erreur `AbortError`.

### Dependencies

- Story 2-7 (rewriteMissionReadModels) devrait etre implementee avant ou en parallele, car elle adresse la frequence des reecritures de projections pendant un run (C8). Si 2-7 n'est pas encore faite, les modifications de frequence dans cette story doivent rester compatibles.

### Recommended File Touch Points

- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` â€” transitions, finalisation, guard background
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` â€” applyExecutionHandleSnapshot
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts` â€” timeout fetch
- `packages/workspace-isolation/src/workspace-isolation.ts` â€” normalisation chemin Windows
- `packages/journal/src/event-log/append-event.ts` â€” nouveau type `execution.cancelled` si absent
- `tests/integration/run-ticket.test.ts` â€” etendre significativement
- `tests/contract/mission-ticket-run-cli.test.ts` â€” etendre

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`.
- Les tests d'integration doivent injecter des stubs d'adaptateur via `setRunTicketDependenciesForTesting` ou equivalent.
- Chaque transition de statut corrigee doit avoir un test d'integration verifiant le journal, le snapshot ticket et le snapshot mission.

### Scope Exclusions

- Hors scope: implementation complete du polling background.
- Hors scope: retry automatique apres echec adaptateur.
- Hors scope: support de nouveaux adaptateurs (codex_exec, codex_sdk).

### References

- Code review adversariale Epic 2 (2026-04-10) â€” Findings C6, C7, C8, H4, H5
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` â€” 3.3 Ticket status, 3.4 Vendor data rule, 3.5 Execution Strategy, 3.6 Codex Integration Boundary
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`

## Dev Agent Record

### Debug Log

- 2026-04-10: lecture complete du workflow `bmad-dev-story`, de la story 2.8, de `sprint-status.yaml`, de la config BMAD, de l'architecture 3.3/3.5/3.6 et des seams runtime/tests references par la story.
- 2026-04-10: passage de la story 2.8 a `in-progress`, puis ajout des tests rouges sur `run-ticket` (foreground/background, `cancelled`, mission avec tentative active, guard artefacts background, timeout adapteur, normalisation Windows) et sur les contrats CLI `mission ticket run`.
- 2026-04-10: implementation de `ticket.in_progress`, propagation de l'identifiant reel d'adaptateur dans `executionHandle`, distinction `execution.cancelled` vs `execution.failed`, garde `missionHasOtherActiveAttempts`, guard background sur `detectTicketArtifacts`, timeout `AbortController` pour `codex-responses` et normalisation Windows des chemins Git POSIX.
- 2026-04-10: validations executees avec succes via `npm run build`, `node --test "dist/tests/integration/run-ticket.test.js" "dist/tests/contract/mission-ticket-run-cli.test.js"` puis `npm test` (97 tests verts).

### Completion Notes List

- `run-ticket` emet maintenant `ticket.in_progress` en foreground avant l'appel adapteur et en background au moment de la confirmation de lancement, avec reecriture des projections pour rendre l'etat observable dans le journal, le board et le resume.
- `applyExecutionHandleSnapshot` recoit desormais l'identifiant reel de l'adaptateur; les snapshots `ticket.executionHandle.adapter` restent coherents avec `attempt.adapter` et les tests injectent `codex_exec` pour prouver l'absence de hardcode.
- La finalisation distingue maintenant strictement `cancelled` de `failed`: `execution.cancelled` est emis, le ticket reste `cancelled`, et la mission redevient `ready` ou reste `running` au lieu d'etre forcee a `failed`.
- Les chemins d'echec adapteur, qu'ils viennent d'un `throw` ou d'un statut `failed`, consultent `missionHasOtherActiveAttempts` avant de degrader la mission; en presence d'une autre tentative active, la mission reste `running`.
- La detection d'artefacts est explicitement court-circuitee tant que l'evenement terminal n'existe pas en background; le test d'integration verifie aussi que `detectTicketArtifacts` n'est pas appelee.
- `createCodexResponsesAdapterFromEnvironment` supporte maintenant `CORP_CODEX_RESPONSES_TIMEOUT_MS` avec `AbortController` et nettoyage du timer, et `resolvePreferredIsolationKind` convertit les chemins Git de style `/c/...` en chemins Windows natifs avant comparaison.
- Aucun fichier de contrat evenementiel supplementaire n'a du etre modifie pour `execution.cancelled`, car `JournalEventRecord.type` acceptait deja la nouvelle valeur; le board distinguait deja `cancelled` des lors que le statut ticket etait corrige.

## File List

- `_bmad-output/implementation/2-8-corriger-le-flow-d-execution-ticket-transitions-adaptateur-et-atomicite.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/workspace-isolation/src/workspace-isolation.ts`
- `tests/contract/mission-ticket-run-cli.test.ts`
- `tests/integration/run-ticket.test.ts`

## Change Log

- 2026-04-10: story 2.8 implementee; transitions `ticket.in_progress` et `execution.cancelled` corrigees, identifiant adapteur reel propage, garde mission active et timeout/normalisation Windows ajoutes, puis validations cibles + `npm test` complet verts (97 tests).
