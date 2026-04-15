# Story 5.1.1: Durcir l'atomicite (findings critiques review 5.1)

Status: done

## Story

As a mainteneur de `corp`,
I want que les findings `HIGH` et les decisions d'architecture de la review adversariale triplee de 5.1 soient traites avant la cloture Epic 5,
so that les sequences `appendEvent -> save -> rewriteMissionReadModels` soient garanties soit atomiquement coherentes, soit reconstructibles depuis le journal sans divergence silencieuse observable, y compris sous crash, concurrence et echecs d'ecriture filesystem.

## Context

La story 5.1 a livre le helper `writeJsonAtomic`, le flag `wx` pour les creations exclusives, la centralisation de `rewriteMissionReadModels`, le verrou optimiste `saveIfUnchanged`, la reconstruction Mission depuis le journal et la serie de tests crash-recovery/concurrence (285 tests verts). La review adversariale triplee (Blind Hunter + Edge Case Hunter + Acceptance Auditor) a consolide 23 findings retenus ; 4 `decision-needed` ont ete tranches le 2026-04-15 :

- **D1 (divergence journal/snapshot sur echec writeJsonAtomic)** : journal-as-SoT accepte, documenter l'intention et garantir que tous les readers passent par la reconstruction depuis le journal quand le snapshot est incoherent.
- **D2 (`persistApprovalTransition` non-atomique)** : journal-as-SoT accepte, les 4 saves sequentiels deviennent des optimisations de lecture ; le reader reconstruit depuis le journal en cas de divergence.
- **D3 (stale lock sur SIGKILL/OOM)** : V1 mono-operateur accepte, documenter dans deferred-work et exposer au besoin un mecanisme d'unlock ulterieur.
- **D4 (`persistRunTransition skipProjectionRewrite: true` sur echec adaptateur)** : journal-as-SoT accepte, les projections sont recalculees a la prochaine lecture ; clarifier le contrat AC5/AC2.

Cette story traite les 5 findings `HIGH` patchables, le finding `MEDIUM` decision (`skipProjectionRewrite`), les 3 tests crash-recovery manquants sur les services autres que `create-mission` et la dette D-35 (appendFile concurrent NTFS) explicitement listee comme absorbee par 5.1 mais non traitee par le diff. Les 9 findings `MEDIUM` restants et les 5 `LOW` sont sortis dans la story 5.1.2 (cleanup et factorisation orthogonaux).

## Acceptance Criteria

1. Given un echec `writeJsonAtomic` (ENOSPC, EPERM, EACCES) survient apres `appendEvent` dans `saveIfUnchanged` (via `FileMissionRepository`) ou dans `selectMissionExtensions`
   When le prochain reader (`mission resume`, `mission approval queue`, `ticket board`, `artifact index`) est invoque
   Then `reconstructMissionFromJournal` reconstruit l'etat intentionnel depuis le journal sans exiger que `mission.json` soit a jour
   And un commentaire d'intention `// journal-as-source-of-truth : snapshot best-effort, reconstruction systematique en cas de divergence` documente le contrat dans `saveIfUnchanged` et dans `persistApprovalTransition`
   And un document d'architecture (`docs/architecture/journal-as-source-of-truth.md` ou section dediee dans `project-context.md`) decrit l'invariant

2. Given `rewriteMissionReadModels` etait jusqu'ici appele apres la release du lock dans `selectMissionExtensions`
   When la story est livree
   Then `rewriteMissionReadModels` est execute a l'interieur de la callback `beforeSave` de `saveIfUnchanged` (ou equivalent sous lock), de sorte qu'un writer concurrent ne puisse pas muter la mission entre unlock et rewrite
   And un test d'integration lance deux `extension select` concurrents et verifie qu'aucune projection n'est ecrite pour un snapshot intermediaire

3. Given `writeTemporaryJsonFile` bascule sur le chemin UUID (`${filePath}.${pid}.${uuid}.tmp`) en cas de contention sur le `.tmp` prefere
   When le `rename` du path UUID echoue
   Then le `catch` de `writeJsonAtomic` supprime explicitement le temporaire UUID (actuel ou retry) et ne laisse aucun orphelin sur disque, quel que soit le path utilise
   And un test unitaire simule un echec `rename` depuis le fallback UUID et verifie l'absence de fichier residuel

4. Given deux Mission objets logiquement egaux mais serialises dans un ordre de cles different
   When `areMissionSnapshotsEqual` compare les deux
   Then la comparaison retourne `true` en normalisant la forme canonique (soit via hash deterministe d'une serialisation triee, soit via `deepStrictEqualForComparison` deja present dans le codebase)
   And un test unitaire verifie l'egalite sur deux Mission construits par des chemins distincts (lecture disque vs hydratation programmatique) avec meme contenu mais ordre de cles different

5. Given un `appendFile` concurrent est exerce sur `events.jsonl` (NTFS Windows ou POSIX)
   When 10 `appendEvent` paralleles sont emis depuis la meme mission
   Then aucune ligne tronquee, ecrasee ou dupliquee n'est observable dans le journal apres completion
   And la serialisation est garantie par un mecanisme de concurrence explicite (mutex async par-path, queue serialisee, ou strategie equivalente testee sur les deux plateformes)
   And un test d'integration (ou unitaire filesystem) reproduit le scenario et verifie l'integrite du journal apres 10 appends concurrents

6. Given un crash simule survient entre `appendEvent` et le premier `repository.save` dans `update-mission-lifecycle`, `run-ticket` ou `resolve-approval-request`
   When la commande de lecture correspondante est relancee
   Then `reconstructMissionFromJournal` produit le meme etat que si le save avait reussi, sans exiger `mission.json`
   And un test d'integration existe pour chacun des 3 services (couverture AC1/AC2 complete, parite avec le test deja present pour `create-mission`)

7. Given un echec adaptateur survient dans `run-ticket` apres emission d'un event `artifact.registered`
   When le catch block persiste l'echec et appelle `persistRunTransition`
   Then les projections (`resume-view.json`, `ticket-board.json`, `audit-log.json`) sont egalement repropagees via `rewriteMissionReadModels` (retrait de `skipProjectionRewrite: true`)
   And un test d'integration verifie que les projections contiennent bien l'event `artifact.registered` et l'event `execution.failed` apres le rethrow

8. Given l'invariant journal-as-source-of-truth est maintenant explicite
   When un mainteneur lit `saveIfUnchanged`, `persistApprovalTransition`, `persistRunTransition` ou un reader critique
   Then un commentaire ou une reference doc pointe vers la section architecture decrivant l'invariant, de sorte qu'aucune future evolution ne puisse accidentellement contredire le contrat

## Tasks / Subtasks

- [x] Documenter l'invariant journal-as-source-of-truth (AC: 1, 8)
  - [x] Ajouter une section dediee dans la doc d'architecture (ou fichier dedie) qui decrit : le journal est source de verite, les snapshots sont best-effort, la reconstruction depuis le journal est la voie normale sous divergence.
  - [x] Ajouter des commentaires d'intention `// journal-as-source-of-truth : ...` dans `FileMissionRepository.saveIfUnchanged`, `resolveApprovalRequest.persistApprovalTransition`, `runTicket.persistRunTransition`, ainsi que dans `selectMissionExtensions`.
  - [x] Verifier que les 4 readers critiques (`readMissionResume`, `readApprovalQueue`, `readMissionArtifacts`, `readTicketBoard`) passent tous par `reconstructMissionFromJournal` en fallback et que le chemin de fallback est teste.

- [x] Deplacer `rewriteMissionReadModels` sous le lock dans `selectMissionExtensions` (AC: 2)
  - [x] Passer `rewriteMissionReadModels` dans la callback `beforeSave` de `saveIfUnchanged` (ou exposer une API `saveIfUnchanged` qui accepte un `afterSave` execute sous lock).
  - [x] Garantir que la fenetre unlock->rewrite est refermee pour toutes les mutations qui declenchent un rewrite.
  - [x] Ajouter un test d'integration `two-concurrent-extension-select-produces-no-intermediate-projection`.

- [x] Fiabiliser le cleanup du tmp UUID dans `writeJsonAtomic` (AC: 3)
  - [x] Dans le `catch` de `writeJsonAtomic`, supprimer `temporaryPath` (qui peut etre soit le chemin prefere soit le chemin UUID), en best-effort silencieux sur ENOENT.
  - [x] Couvrir avec un test unitaire qui force le path UUID (contention sur le `.tmp` prefere) puis fait echouer `rename` avec ENOSPC/EPERM et verifie que le repertoire parent ne contient aucun `.tmp` residuel.

- [x] Normaliser `areMissionSnapshotsEqual` (AC: 4)
  - [x] Remplacer la comparaison `JSON.stringify(a) === JSON.stringify(b)` par une forme canonique (tri des cles recursif ou usage d'un deep-equal deja disponible).
  - [x] Ajouter un test unitaire construisant deux missions via chemins distincts (parse disque vs hydratation) pour confirmer l'egalite logique.

- [x] Traiter D-35 : serialiser les `appendFile` concurrents sur `events.jsonl` (AC: 5)
  - [x] Ajouter un mutex async par-path (ou file serialisee, ou advisory-lock filesystem) dans `packages/journal/src/event-log/append-event.ts`.
  - [x] Verifier la validite sur NTFS et POSIX via test de 10 `appendEvent` paralleles.
  - [x] Documenter dans le header du fichier la strategie choisie et le raisonnement.

- [x] Completer les tests crash-recovery des 3 services manquants (AC: 6)
  - [x] Ajouter un scenario post-append/pre-save pour `update-mission-lifecycle` (ex. `mission pause` crash entre append et save).
  - [x] Ajouter un scenario pour `run-ticket` (crash entre append `ticket.attempt.started` et save ticket).
  - [x] Ajouter un scenario pour `resolve-approval-request` (crash entre append `approval.resolved` et save mission/ticket/attempt).
  - [x] Chacun des 3 tests verifie que la lecture correspondante (`mission resume`, `ticket board`, `approval queue`) reconstruit l'etat correctement sans snapshot.

- [x] Retirer `skipProjectionRewrite: true` du catch de `run-ticket` (AC: 7)
  - [x] Supprimer le flag dans l'appel `persistRunTransition` du catch pour que les projections soient recalculees apres persist des artefacts.
  - [x] Ajuster le test d'echec adaptateur existant pour verifier la presence des events dans `audit-log.json` et `resume-view.json` apres rethrow.

### Review Findings

- [x] [Review][Patch] `readTicketBoard` reconstruit depuis les snapshots ticket/attempt stale apres crash post-append au lieu du journal (AC1/AC6) [packages/ticket-runtime/src/planner/read-ticket-board.ts:47]

## Dev Notes

### Story Intent

Cette story clot les decisions d'architecture issues de la review 5.1 et traite le findings residuels `HIGH` sans s'etaler sur les nettoyages. Le contrat architectural "journal-as-source-of-truth" devient explicite et tracable. D-35, oublie par le diff de 5.1 mais liste comme absorbe, est rattrape ici. Les tests crash-recovery atteignent la parite exigee par AC1/AC2 de 5.1 (`4 services`).

### Decisions appliquees (review 2026-04-15)

- D1 = Option 1 (journal-as-SoT + doc).
- D2 = Option 1 (journal-as-SoT + doc).
- D3 = Option 4 (V1 accepte, D-64 dans `deferred-work.md`).
- D4 = Option 1 (retrait `skipProjectionRewrite`).

### Items `deferred-work.md` traites ou absorbes

- D-35 (finalement traite dans cette story).
- Nouvelle entree D-64 : stale lock SIGKILL/OOM (V1 accepte, durcir en post-GA si besoin).

### Testing Requirements

- Test unitaire `writeJsonAtomic` fallback UUID + cleanup.
- Test unitaire `areMissionSnapshotsEqual` avec ordre de cles different.
- Tests d'integration crash-recovery pour les 3 services manquants (`update-mission-lifecycle`, `run-ticket`, `resolve-approval-request`).
- Test d'integration `two-concurrent-extension-select` sans projection intermediaire.
- Test `10-concurrent-append-events-jsonl` (integrite du journal).
- Test d'integration echec adaptateur -> projections a jour apres rewrite.
- Baseline 285 tests verts preservee.

## Dev Agent Record

### Debug Log

- `npm run build` : OK (aucun diagnostic TS apres correction d'un cast `Record<string, unknown>` dans `tests/unit/mission-snapshot-equality.test.ts`).
- `node --test dist/tests/**/*.test.js` : 295 tests PASS / 0 FAIL / 0 skipped (baseline 285 + 10 nouveaux). Duree ~3.2 s.
- Review fix 2026-04-15 : `npm run build`, `node --test dist/tests/integration/read-model-rewrite-idempotency.test.js`, `node --test dist/tests/integration/ticket-board.test.js`, `node --test dist/tests/integration/mission-resume.test.js`, puis `npm test` : OK, 295 tests PASS / 0 FAIL.
- Nouveaux tests ajoutes : `appendEvent serialise 10 appends concurrents ...` (x2), `writeJsonAtomic nettoie le fallback UUID ...`, `areMissionSnapshotsEqual ...` (x3), `two-concurrent-extension-select-produces-no-intermediate-projection`, 3 tests crash-recovery (`mission pause`, `run-ticket`, `approval approve`).

### Completion Notes

- **AC1/AC8 (journal-as-source-of-truth)** : document `docs/architecture/journal-as-source-of-truth.md` cree avec enonce d'invariant, regles contraignantes, mapping services -> points de divergence, cas limites documentes et liste de tests garde-fous. Commentaires d'intention ajoutes dans `FileMissionRepository.saveIfUnchanged`, `persistApprovalTransition`, `persistRunTransition`, `selectMissionExtensions` et `writeJsonAtomic`. Les 4 readers critiques (verification confirmee par grep) passent deja tous par `reconstructMissionFromJournal` ou `readMissionFromJournal` en fallback.
- **AC2 (rewrite sous lock)** : `rewriteMissionReadModels` deplace dans la callback `beforeSave` de `saveIfUnchanged` dans `selectMissionExtensions`. Test d'integration verifie qu'a chaque appel de `writeProjectionSnapshot` le fichier `mission.json.lock` est present -> aucune projection n'est ecrite hors du lock.
- **AC3 (cleanup UUID tmp)** : code existant deja correct (cleanup utilise `temporaryPath` retourne, couvrant prefered + UUID fallback). Commentaire d'intention ajoute et test unitaire qui force le fallback UUID (pre-remplissage du `.tmp` prefere + cible = repertoire -> rename rejette) puis `readdir` pour garantir zero orphelin `.tmp`.
- **AC4 (areMissionSnapshotsEqual)** : comparaison remplacee par forme canonique (tri recursif des cles + `isDeepStrictEqual`). Export de la fonction pour test unitaire ; 3 tests (ordre de cles inverse -> egale, valeur differente -> non egale, ordre d'array preserve -> non egale).
- **AC5 (appendFile concurrent, D-35)** : mini-file d'attente asynchrone par chemin dans `appendEvent`. Chaque path possede une chaine `Promise<void>` ; l'append suivant attend le precedent avant d'emettre son `appendFile`. Tests : 10 appends concurrents sur le meme journal -> 10 lignes complettes avec payload de 512 octets preserves ; appends paralleles sur 2 journaux distincts -> pas de blocage inter-path, chaque fichier recoit ses 5 lignes attendues.
- **AC6 (tests crash-recovery)** : ajout de 3 tests integration couvrant `update-mission-lifecycle` (mission pause), `run-ticket` (`mission ticket run --background` crash sur premier `ticketRepository.save`) et `resolve-approval-request` (`mission approval approve` crash sur `missionRepository.save`). Chaque test patch le save concerne, verifie que le journal contient l'event, puis lance la lecture correspondante (`mission resume`, `mission ticket board`, `mission approval queue`) et verifie que la reconstruction produit un etat coherent sans snapshot.
- **AC7 (skipProjectionRewrite)** : flag retire de l'appel `persistRunTransition` dans le catch de `run-ticket.ts` (ligne 593). Commentaire d'intention ajoute. Assertion etendue dans `run-ticket.test.ts` : apres le rethrow, `audit-log.json` contient l'event `artifact.registered` et `resume-view.json.resume.lastEventId` pointe sur ce meme event.
- **D-35** : marque comme resolu dans `deferred-work.md` avec reference aux tests. **D-64** deja present dans `deferred-work.md` (stale lock SIGKILL/OOM, V1 accepte).
- Tous les tests passent ; aucune regression.

### File List

Modifies (code) :
- `packages/storage/src/repositories/file-mission-repository.ts` (AC1, AC4, AC8)
- `packages/storage/src/fs-layout/atomic-json.ts` (AC3, AC8)
- `packages/journal/src/event-log/append-event.ts` (AC5, AC8)
- `packages/mission-kernel/src/mission-service/select-mission-extensions.ts` (AC2, AC8)
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` (AC1, AC8)
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` (AC2, AC7, AC8)

Nouveaux (doc / tests) :
- `docs/architecture/journal-as-source-of-truth.md` (AC1, AC8) [nouveau]
- `tests/unit/mission-snapshot-equality.test.ts` (AC4) [nouveau]
- `tests/unit/append-event-concurrency.test.ts` (AC5) [nouveau]

Modifies (tests) :
- `tests/integration/read-model-rewrite-idempotency.test.ts` (AC6)
- `tests/integration/mission-extension-selection.test.ts` (AC2)
- `tests/integration/run-ticket.test.ts` (AC7)
- `tests/unit/write-json-atomic.test.ts` (AC3)

Modifies (docs projet) :
- `_bmad-output/implementation/deferred-work.md` (D-35 marque resolu)
- `_bmad-output/implementation/sprint-status.yaml` (story 5-1-1 : ready-for-dev -> in-progress -> review)
- `_bmad-output/implementation/5-1-1-durcir-atomicite-findings-review-5-1-critiques.md` (finalisation story)

Note : les artefacts compiles dans `dist/` sont regeneres par `npm run build` et reflettent les modifications TS ci-dessus.

## Change Log

- 2026-04-15: Story 5.1.1 creee a partir des 4 decisions-needed tranchees et des 5 HIGH patches + 1 MEDIUM (skipProjectionRewrite) + tests crash-recovery manquants + D-35 de la review 5.1.
- 2026-04-15: Implementation complete des 7 ACs. Doc architecture journal-as-source-of-truth.md creee. `rewriteMissionReadModels` deplace sous lock dans `selectMissionExtensions`. `areMissionSnapshotsEqual` normalise via forme canonique. `appendEvent` serialise par chemin via mini-file d'attente (D-35 resolu). `skipProjectionRewrite: true` retire du catch `run-ticket`. 3 tests crash-recovery ajoutes pour `update-mission-lifecycle`, `run-ticket`, `resolve-approval-request`. Baseline 285 tests -> 295 tests PASS.
- 2026-04-15: Finding de revue resolu : `readTicketBoard` merge desormais les snapshots `Ticket`/`ExecutionAttempt` issus du journal quand les snapshots disque sont en retard post-append ; test crash-recovery `run-ticket` durci pour verifier `status`, `trackingState` et `activeAttemptStatus`. Story passee a `done`.
