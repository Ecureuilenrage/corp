# Story 5.2.2: Cleanup validation, diagnostics et polish (findings review 5-2, severites medium/low)

Status: review

## Story

As a mainteneur de `corp`,
I want appliquer les patches non critiques du code review de 5-2 (classification d'erreurs mineures, typings sound, diagnostics preserves, hardening guards contre pollution prototype),
so that la taxonomie d'erreurs reste propre, les guards soient surs et les messages operateur ne masquent jamais silencieusement une corruption.

## Context

Cette story complete 5.2.1 avec les findings medium et low du code review de 5-2 (2026-04-15). Elle est decoupee pour rester centree sur du cleanup atomique sans re-ouvrir les decisions d'architecture resolues en 5.2.1.

Trois regroupements:
1. **Classification et diagnostics d'erreurs** — preserver `cause`/stack, EBUSY/ETIMEDOUT, JSON.parse catch unknown, stream error async, `normalizeTicketBoardReadError`, `readStoredResumeView`, `readApprovalQueue` re-read, `projectionsError=ENOENT`.
2. **Typing sound et guards durcis** — `PersistedDocumentValidator<T>`, `hasOwnProperty` vs `in record`, `InvalidPersistedDocumentError.cause`, `validateExecutionHandle` messages, `isEventLogFileSystemError` redondant.
3. **Quality polish et confirmations** — BOM UTF-8, `readPayloadPreview` bare-catch classification, test flip `on_hold`->`todo` (demande confirmation), commentaire drift "Story 5.1.1", tie-break timestamp dans `mergeTicketsById`/`mergeAttemptsById`.

## Acceptance Criteria

1. Given un document JSON persiste commence par un BOM UTF-8 (`\uFEFF`)
   When `readPersistedJsonDocument` lit le fichier
   Then le BOM est strip avant `JSON.parse`
   And aucun `json_corrompu` n'est leve pour un document par ailleurs valide
   And un test couvre le cas explicite (mission.json + BOM).

2. Given un artefact existe sur disque mais son `payloadPath` n'est pas lisible (EACCES/EIO)
   When `readPayloadPreview` (`read-mission-artifacts.ts`) tente la preview
   Then seule une ENOENT est retournee `null` silencieusement
   And toute autre classe (`isFileSystemReadError` vrai) est propagee ou surfacee comme diagnostic structurel
   And la documentation AC4 de la story 5-2 est completee pour cette exception.

3. Given un champ `ticket.status` ou `attempt.status` arrive avec un eventId plus grand mais un timestamp anterieur
   When `mergeTicketsById`/`mergeAttemptsById` (`read-ticket-board.ts`) combinent stored et journal
   Then la version retenue est celle dont le timestamp est le plus recent (tiebreak eventId)
   And aucun test ne regresse vers un etat passe.

4. Given le test `tests/integration/ticket-board.test.ts` assertait `entry.runnable: false` / `status: on_hold` avant 5-2 et assertait maintenant `true` / `todo`
   When la story est terminee
   Then soit le flip est explicite avec un commentaire cite dans le code de production justifiant la transition, soit il est reverte en test et le code metier est aligne sur le contrat precedent
   And la decision est documentee dans le Dev Agent Record.

5. Given une valeur `ticket.status` inconnue apparait dans un snapshot lu sous le regime tolerant de 5.2.1 AC5
   When un test couvre la tolerance
   Then la politique est validee (voir 5.2.1 AC5) et pas traitee ici.

6. Given `PersistedDocumentValidator<T>` et `assertValidPersistedDocument<T>`
   When TypeScript compile le code
   Then `T` est reellement verifie: `PersistedDocumentValidator<T> = (value: unknown) => ValidationResult<T>` avec `ValidationResult<T>` union `{ ok: true; value: T }` | `{ ok: false; reason: string }`
   And `assertValidPersistedDocument<T>` utilise un vrai type predicate aligne sur le validator.

7. Given un guard `validateString`/`validateOptionalString`/etc. recoit un objet dont la propriete est heritee du prototype (ex. `Object.create({id:"x"})`)
   When le guard verifie la presence du champ
   Then la verification utilise `Object.prototype.hasOwnProperty.call(record, fieldName)` (ou equivalent resistant pollution prototype) et non `in record`
   And un test couvre un payload `Object.create({id:"x"})` -> rejet.

8. Given `InvalidPersistedDocumentError` est construite a partir d'un `ValidationResult`
   When l'erreur est instantiee
   Then le champ `cause` est defini (reference a la raison ou a l'erreur originelle si disponible)
   And il est symetrique avec `CorruptedPersistedDocumentError` et `PersistedDocumentFileSystemError`.

9. Given `validateExecutionHandle` re oit un champ absent vs un type incorrect
   When la validation echoue
   Then les messages sont coherents avec les autres validators: `champ manquant` si absent, `type incorrect` si type faux
   And un test unitaire verifie les deux messages.

10. Given `JSON.parse` l ve une erreur non-`SyntaxError` (scenario theorique realm exotique / monkey-patch)
    When `parseJournalEventLine` ou `readPersistedJsonDocument` attrapent
    Then le catch est `catch (error: unknown)` + `instanceof SyntaxError` et tout autre cas est classifie via `normalizeEventLogReadError`/`normalizePersistedDocumentReadError`.

11. Given le stream `readline` sur `events.jsonl` emet un event `error` async apres la fin de l'iteration
    When `readEventLog` termine
    Then l'erreur est capturee et transformee en `EventLogReadError` classee
    And aucun `unhandledRejection` ne fuit.

12. Given `normalizeEventLogReadError` recoit une erreur non-errno non-Error
    When la normalisation se produit
    Then la cause et le stack sont preserves (`new Error(message, { cause: error })`), non remplaces par `new Error(String(error))`.

13. Given `isEventLogFileSystemError` existe en doublon de `isFileSystemReadError`
    When la story est terminee
    Then la fonction est soit supprimee (callers migres vers `isFileSystemReadError`), soit reecrite comme wrapper explicite documente.

14. Given une erreur OS avec code `EBUSY` ou `ETIMEDOUT` arrive sur un read (frequent sous Windows / AV-scan)
    When `isFileSystemReadError` classifie
    Then ces codes sont ajoutes a `FILE_SYSTEM_READ_ERROR_CODES` et classes `erreur_fichier`.

15. Given `readApprovalQueue` relit le journal deux fois (`readMissionSnapshotForApprovalQueue` puis `readEventLog`)
    When la story est terminee
    Then le journal est lu une seule fois et les events sont passes en parametre (pas de re-lecture), ou une note explicite justifie la double lecture et couvre le drift potentiel par un test.

16. Given `projectionsError` est `ENOENT` mais le journal existe
    When `ensureApprovalQueueWorkspaceInitialized` classe la situation
    Then le message n'est plus "Workspace mission non initialise" mais soit un auto-recreate du dossier projections, soit une erreur classee `erreur_fichier` avec le path precis.

17. Given une `TypeError` ou autre erreur inattendue se produit dans `readMissionResume` ou `normalizeTicketBoardReadError`
    When le catch generique se declenche
    Then l'erreur secondaire est construite avec `new Error(msg, { cause: error })`
    And le stack original reste inspectable via `.cause`.

18. Given `readStoredResumeView` avale silencieusement un `SyntaxError`
    When la projection est corrompue
    Then la fonction retourne une erreur classee `CorruptedPersistedDocumentError` au lieu de `null` silencieux, ou logge explicitement la corruption avant fallback journal
    And un test couvre le cas.

19. Given le commentaire `Story 5.1.1 AC4` dans `file-mission-repository.ts` refere a la story 5.1.1 pour du code modifie en 5-2
    When la story est terminee
    Then le commentaire est soit supprime (code explicite de soi-meme), soit mis a jour pour refleter le contexte 5-2.

20. Given la story est terminee
    When `npm run build && npm test` est lance
    Then les tests passent et la baseline (post-5.2.1) reste verte avec les nouveaux tests.

## Tasks / Subtasks

- [x] AC1: Strip BOM dans `readPersistedJsonDocument` (`packages/storage/src/repositories/persisted-document-errors.ts`). Test unitaire: `\uFEFF{"id":"m-1"}`.
- [x] AC2: `readPayloadPreview` classifier ENOENT -> null, autres -> propagation/diagnostic. Test: payload EACCES -> pas de null silencieux.
- [x] AC3: Tie-break timestamp dans `mergeTicketsById`/`mergeAttemptsById` (`read-ticket-board.ts`). Test: eventId plus grand mais timestamp anterieur.
- [x] AC4: Confirmation flip `on_hold`->`todo`. Etapes: (a) relire le diff de `ticket-board.test.ts` + code metier associe; (b) si intentionnel, ajouter commentaire de justification + reference story; (c) sinon, revert test et aligner code. Documenter dans Dev Agent Record.
- [x] AC6: Reecrire `PersistedDocumentValidator<T>` et `assertValidPersistedDocument<T>` avec typage sound. Adapter tous les callers. Tests type-level (`tsc --noEmit` doit rejeter un mismatch).
- [x] AC7: Remplacer `in record` par `Object.prototype.hasOwnProperty.call` dans `persisted-document-guards.ts`. Test: `Object.create({id:"x"})` -> invalide.
- [x] AC8: `InvalidPersistedDocumentError` porte `cause` (chainage raison ou validation result original). Test.
- [x] AC9: Unifier messages `validateExecutionHandle` avec autres validators. Tests unitaires deux messages.
- [x] AC10: `catch (error: unknown)` + `instanceof SyntaxError` dans parse JSON. Tests.
- [x] AC11: Souscrire a `error` sur le stream readline + transformer en `EventLogReadError`. Test simule EBADF post-iteration.
- [x] AC12: `normalizeEventLogReadError` preserve cause/stack pour non-errno non-Error. Test.
- [x] AC13: Supprimer/wrapper `isEventLogFileSystemError`. Migrer callers.
- [x] AC14: Ajouter `EBUSY`, `ETIMEDOUT` a `FILE_SYSTEM_READ_ERROR_CODES`. Test unitaire.
- [x] AC15: `readApprovalQueue` une seule lecture du journal. Test: compter les invocations ou passer events en parametre.
- [x] AC16: `ensureApprovalQueueWorkspaceInitialized` distinguer journal-present + projections-ENOENT. Test: mode degrade OK.
- [x] AC17: `new Error(msg, { cause })` dans readers mission-centriques. Tests: verifier `.cause` via assertion.
- [x] AC18: `readStoredResumeView` ne plus avaler SyntaxError silencieusement. Test.
- [x] AC19: Nettoyer commentaire `Story 5.1.1 AC4` dans `file-mission-repository.ts`.
- [x] AC20: `npm run build && npm test` vert; baseline post-5.2.1 preservee.

### Review Findings

Revue adversariale parallele (Blind Hunter + Edge Case Hunter + Acceptance Auditor) executee le 2026-04-20. Tous les AC1..AC20 sont attestes `met` par l'Acceptance Auditor. Total: 0 decision, 8 patchs, 15 defer, 5 dismiss.

#### Patches

- [ ] [Review][Patch] `readMissionResume` n'aligne pas le rethrow sur `isPersistedDocumentReadError` comme `readMissionEventsSafely` — toute erreur non-`EventLogReadError` est enveloppee dans un generic `Error`, perdant la classification des `PersistedDocumentReadError` potentiellement remontees par les sous-lectures. Mirror du pattern `read-ticket-board.ts:readMissionEventsSafely`. [packages/mission-kernel/src/resume-service/read-mission-resume.ts:89-98]
- [ ] [Review][Patch] `validateOpenStringUnion` encode "strict par defaut" via `options.strict !== false` (double negation) — trois valeurs implicites (`undefined`, `true`, `false`) et tout futur `null` accidentel retombe en mode lenient. Utiliser un flag positif explicite (`lenient === true` ou `mode: "strict" | "lenient"`). [packages/contracts/src/guards/persisted-document-guards.ts:405]
- [ ] [Review][Patch] Test `read-mission-resume.test.ts` monkey-patche `missionReconstructionModule.readMissionEvents` via `require(...)` — fonctionne sous CommonJS, casse sous native ESM (live binding). Bypass le pattern `setXDependenciesForTesting` introduit ailleurs dans le meme diff. Introduire `setReadMissionResumeDependenciesForTesting` et l'utiliser. [tests/unit/read-mission-resume.test.ts:2578-2594]
- [ ] [Review][Patch] `STRUCTURAL_VALIDATION_WARNINGS` est un `Symbol()` module-local — deux copies du module produisent des Symboles distincts, les warnings "disparaissent" silencieusement entre attach et get (hoisted mocks, dual-bundler). Utiliser `Symbol.for("corp.structural_validation_warnings")`. [packages/contracts/src/guards/persisted-document-guards.ts:29]
- [ ] [Review][Patch] Test "capture une erreur async du stream" attend un seul `setImmediate` pour verifier `unhandledRejection === false` — un tick de la queue microtask peut ne pas suffire dans node:test. Drainer avec `setTimeout(r, 0)` ou `process.nextTick` + `setImmediate` en cascade pour eviter un faux positif CI. [tests/unit/event-log-defensive-read.test.ts:1889-1936]
- [ ] [Review][Patch] `normalizePersistedDocumentReadError` retourne `error as Error` pour tout `isMissingFileError` vrai — le predicat `isMissingFileError` ne demande pas `instanceof Error`, donc un objet errno-like exotique est rendu avec un cast mensonger. Ajouter un garde `error instanceof Error` avant retour as-is, sinon wrap. [packages/storage/src/repositories/persisted-document-errors.ts:1378-1380]
- [ ] [Review][Patch] `readStoredResumeView` ne classe que `SyntaxError` en `CorruptedPersistedDocumentError` — un `TypeError` issu d'un `JSON.parse` monkey-patche (scenario teste ailleurs en AC10) ou toute autre erreur non-FS non-ENOENT remonte brute au `readMissionResume` sans wrap `readError` et sans fallback journal. Classifier tout non-FS non-ENOENT comme corruption (ou englober dans un try/catch cote appelant). [packages/mission-kernel/src/resume-service/read-mission-resume.ts:237-275, site d'appel 140-141]
- [ ] [Review][Patch] Tests `JSON.parse = () => { throw rootCause; }` dans `event-log-defensive-read.test.ts` et `persisted-document-repositories.test.ts` — remplacent globalement `JSON.parse` avec un restore via `t.after`. Sous `--concurrency > 1` ou apres un unhandled rejection qui court-circuite `t.after`, la corruption fuit vers les autres tests. Encapsuler dans un helper `withStubbedJsonParse(fn)` qui garantit le restore meme sous rejection. [tests/unit/event-log-defensive-read.test.ts, tests/unit/persisted-document-repositories.test.ts]

#### Defer

- [x] [Review][Defer] `readApprovalQueue` appelle `readEventLog` hors du `try { formatApprovalQueueReadError(...) }` — deferred, narrow: les erreurs `EventLogReadError` sont deja classifiees et le catch existant rethrow via `isClassifiedReadError`. Impact residuel limite aux erreurs opaques que AC11/AC12 ont justement normalisees. [packages/mission-kernel/src/resume-service/read-approval-queue.ts:79-86]
- [x] [Review][Defer] `canonicalize` skip des valeurs `undefined` — change la semantique d'egalite (`{foo: undefined}` vs `{}`) dans `areMissionSnapshotsEqual`. Deferred: guardrail 5-2-2 interdit de retoucher `canonicalize` (scope 5-2-1). [packages/storage/src/repositories/file-mission-repository.ts:1216-1223]
- [x] [Review][Defer] `canonicalize` throw `TypeError` sur `Map`/`Set` mais accepte `Buffer`/`Uint8Array`/`Symbol`/`WeakMap`/fonctions — hardening partiel. Deferred: scope 5-2-1. [packages/storage/src/repositories/file-mission-repository.ts:195-230]
- [x] [Review][Defer] TOCTOU entre `readLockStat`/`removeLockFile`/`createLockFile` + resolution `mtime` 2s sur FAT/exFAT/shares Windows — race sur `cleanupStaleMissionLocks`. Deferred, D-64 documente. [packages/storage/src/repositories/file-mission-repository.ts:266-295]
- [x] [Review][Defer] `releaseMissionLock` rethrow lock-release error sur succes primaire — caller voit `save failed` alors que la mission a ete ecrite; lock orphelin possible. Deferred: scope 5-2-1. [packages/storage/src/repositories/file-mission-repository.ts:1300-1315]
- [x] [Review][Defer] `stripUtf8Bom` ne gere que le BOM UTF-8 — un fichier UTF-16 LE (default PowerShell `Out-File`) decode en mojibake et remonte en "Lecture irreconciliable" generic. Deferred: AC1 scope explicite UTF-8 seulement. [packages/storage/src/repositories/persisted-document-errors.ts:1398-1402]
- [x] [Review][Defer] `isClassifiedReadError` duplique dans `read-approval-queue.ts` et `read-ticket-board.ts` — drift risk. Deferred: scope Story 5-3 (factoriser type-guards et helpers partages). [packages/mission-kernel/src/resume-service/read-approval-queue.ts:238, packages/ticket-runtime/src/planner/read-ticket-board.ts]
- [x] [Review][Defer] `resolveMissionLockStaleTtlMs` + `Number.parseInt(rawValue, 10)` accepte `"1.5s"` -> `1` (ms) et `"5m"` -> `5` silencieusement; aucun floor minimal contre les TTL degenerees. Deferred: scope 5-2-1 (le mecanisme a ete introduit la); necessite un floor et une validation regex. [packages/storage/src/repositories/file-mission-repository.ts:253-264]
- [x] [Review][Defer] `ensureAppendOnlyEventLog` ne relit plus le journal apres truncation (validation in-memory du prefix) — race possible avec un writer concurrent dont l'append arrive entre `readFile` et `truncate`, silently tronque. Deferred: decision 5-2-1 explicite (`Validation post-truncation remplacee par validation in-memory ... acceptable V1`). [packages/journal/src/event-log/file-event-log.ts:135-146]
- [x] [Review][Defer] Globales mutables `eventLogDependenciesForTesting` / `readApprovalQueueDependenciesForTesting` / `ticketBoardDependenciesForTesting` — fuite entre tests concurrents possible. Deferred: D-30 pre-existant (meme pattern partage avec les autres modules). [packages/journal/src/event-log/file-event-log.ts, packages/mission-kernel/src/resume-service/read-approval-queue.ts, packages/ticket-runtime/src/planner/read-ticket-board.ts]
- [x] [Review][Defer] `parseJournalEventLine` ne strip pas le BOM UTF-8 — un journal sauve via un editeur Windows avec BOM fait echouer toutes les lectures des la premiere ligne. Deferred: AC1 scope explicite JSON documents seulement. [packages/journal/src/event-log/file-event-log.ts:198-218]
- [x] [Review][Defer] `toStoredAttemptCursor` retourne `eventId: ""` synthetique — tie-break systematique en faveur du journal meme quand stored porte une tentative legitime. Deferred: edge design mineure, impact sur scenarios de retry in-place. [packages/ticket-runtime/src/planner/read-ticket-board.ts:533-549]
- [x] [Review][Defer] `buildTicketCursors`/`buildAttemptCursors` overwrite sur chaque iteration sans garde-fou d'ordering — si le journal contient des events avec timestamps non-monotones (clock skew entre processus), le cursor reflete le dernier ecrit, pas le plus recent occurred. Deferred: scope Story 5-5 (determinisme projections/tris/filtres). [packages/ticket-runtime/src/planner/read-ticket-board.ts:564-602]
- [x] [Review][Defer] `compareMissionFreshness` utilise `String.prototype.localeCompare` sans collator fixe — locale Turc (`I`/`İ`) peut reordonner differemment les eventIds ASCII entre hotes. Deferred: scope Story 5-5 (determinisme). [packages/ticket-runtime/src/planner/read-ticket-board.ts:551-562]
- [x] [Review][Defer] `toStoredTicketCursor` pour `ticket.eventIds=[]` retourne `""` — perd systematiquement en tie-break, potentiellement discard un stored snapshot legitime. Deferred: edge design mineure (stored avec eventIds vide est deja un etat corrompu/migration). [packages/ticket-runtime/src/planner/read-ticket-board.ts:508-513]

#### Dismissed (5)

- `getEventLogDependencies`/`getReadApprovalQueueDependencies`/`getTicketBoardDependencies` rebuild d'objet par appel — micro-perf, pas de bug.
- AC14 over-delivre `EROFS` et `EISDIR` au-dela du `EBUSY`/`ETIMEDOUT` demande — extension additive benigne, coherente avec les autres codes FS deja classes.
- Diff de revue inclut des hunks 5-2-1 (`canonicalize` etendu, `cleanupStaleMissionLocks`, lock stale TTL) — explique par l'absence de commit intermediaire entre 5-2-1 et 5-2-2, pas de violation de scope reelle.
- `assertValidPersistedDocument<T>` soundness compile-time via le parametre `PersistedDocumentValidator<T>` (runtime trust sur `value as T`) — conforme au wording AC6 "T est reellement verifie"; le narrowing runtime n'est pas demande.
- Contrat des predicats publics `isMission`/`isTicket`/`isArtifact` relache (`validate*(value, { strict: false })`) — policy confirmee conforme 5-2-1 AC5: la tolerance des discriminants inconnus est intentionnellement etendue aux predicats publics. Le test `isMission({ ...createMission(), status: "archived_v2" }), true` cimente le contrat. Decision: 2026-04-20 revue 5-2-2.

## Dev Notes

### Story Intent

Polish et durcissement incremental des classes d'erreur et guards introduits en 5-2. Aucune decision d'architecture nouvelle; toute ambiguite a ete resolue en 5.2.1.

### Guardrails de scope

- Pas de nouvelle dependance.
- Ne pas refactoriser les helpers partages (Story 5.3).
- Ne pas changer le schema persistant ni la surface CLI (sauf exposition optionnelle du diagnostic multi-pack discute en 5.2.1 AC12).
- Ne pas retoucher `canonicalize`, `selectFreshMissionSnapshot`, tolerance status: couverts en 5.2.1.

### Findings couverts

Patches: P9 (`readApprovalQueue` re-read), P10 (projectionsError ENOENT), P11 (`normalizeTicketBoardReadError` cause), P12 (`PersistedDocumentValidator<T>` non-sound), P13 (`validateExecutionHandle` message), P14 (guards `hasOwnProperty`), P15 (`InvalidPersistedDocumentError` cause), P16 (JSON.parse unknown), P17 (stream async), P18 (`normalizeEventLogReadError` stack), P19 (`isEventLogFileSystemError` redondant), P20 (EBUSY/ETIMEDOUT), P21 (commentaire drift), P22 (`readStoredResumeView` SyntaxError).
Decisions: 8 (merge ordre), 9 (flip on_hold), 10 (BOM), 11 (readPayloadPreview).

### Jugement patch full vs minimal

- **Lockfile orphelin**: minimal + doc (5.2.1 AC2); TTL complet = D-64 post-GA.
- **`readPayloadPreview`**: minimal (ENOENT null; autres classes remontees). Le patch complet (diagnostic structure) est hors scope lecture best-effort.
- **Flip test `on_hold`->`todo`**: minimal conditionne -- commenter si intentionnel, revert si oubli. Full patch non pertinent tant que l'intention n'est pas confirmee.
- **Tous les autres**: full patch. Effort marginal vs nettete de la surface d'erreur.

### References

- `_bmad-output/implementation/5-2-durcir-la-lecture-defensive-et-la-validation-de-schema.md` -- section `Review Findings`.
- `_bmad-output/implementation/5-2-1-durcir-lecture-defensive-findings-review-5-2-critiques.md` -- prerequis; 5.2.2 suit 5.2.1 dans le sprint.
- `_bmad-output/implementation/deferred-work.md` -- D-65 a D-72 (items definitivement hors scope).

## Dev Agent Record

### Implementation Plan

- Durcir la couche de validation/persisted-document avant de toucher les readers mission-centriques pour mutualiser `ValidationResult<T>`, les causes et la lecture BOM-safe.
- Corriger ensuite les readers sensibles (`event-log`, `approval-queue`, `mission-resume`, `ticket-board`, `readPayloadPreview`) avec des tests directs sur les erreurs classees et la fraicheur des snapshots.
- Verrouiller les regressions avec des tests unitaires/integration supplementaires puis rerun complet `npm test`.

### Debug Log

- 2026-04-20T21:08:08+02:00: Story prise en charge, sprint-status passe a `in-progress`, inspection du diff existant et des hotspots 5.2.2.
- 2026-04-20T21:12:00+02:00: Reprise de `ValidationResult<T>`, `PersistedDocumentValidator<T>`, guards own-property et causes des erreurs persisted-document.
- 2026-04-20T21:15:00+02:00: Readers defensive-read corriges (`readPayloadPreview`, `readEventLog`, `readApprovalQueue`, `readMissionResume`, `readTicketBoard`) avec nouvelles injections/tests unitaires.
- 2026-04-20T21:21:58+02:00: `npm test` vert (364 tests), story prete pour review.

### Completion Notes

- BOM UTF-8, `PersistedDocumentValidator<T>` sound, `InvalidPersistedDocumentError.cause`, `validateExecutionHandle` et les guards `hasOwnProperty` sont maintenant couverts au niveau source + tests.
- `readPayloadPreview` ne masque plus que `ENOENT`; les autres erreurs disque remontent en `erreur_fichier`, et le finding AC4 de la story 5.2 a ete marque traite.
- `readEventLog` capture les erreurs async du stream, normalise les `JSON.parse` inattendus sans double wrapping, et preserve la cause pour les erreurs opaques.
- `readApprovalQueue` lit le journal une seule fois, recree `projections/` si absent alors que le journal est sain, et `readMissionResume` expose explicitement une corruption `resume-view` sans perdre le fallback journal.
- Decision AC4: le flip `on_hold` -> `todo` n'a pas ete retenu. Le contrat tolerant sur les statuts fantomes est preserve, les tests `ticket-board`/`mission-resume` restent alignes sur un ticket non runnable et lisible.
- Validation finale executee: `npm test` (364 tests verts).

## File List

- `_bmad-output/implementation/5-2-2-cleanup-lecture-defensive-findings-review-5-2-medium-low.md`
- `_bmad-output/implementation/5-2-durcir-la-lecture-defensive-et-la-validation-de-schema.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `packages/contracts/src/guards/persisted-document-guards.ts`
- `packages/journal/src/event-log/event-log-errors.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/fs-layout/file-system-read-errors.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/storage/src/repositories/persisted-document-errors.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `tests/typecheck/persisted-document-validator.typecheck.ts`
- `tests/unit/event-log-defensive-read.test.ts`
- `tests/unit/file-system-read-errors.test.ts`
- `tests/unit/persisted-document-guards.test.ts`
- `tests/unit/persisted-document-repositories.test.ts`
- `tests/unit/read-approval-queue.test.ts`
- `tests/unit/read-mission-artifacts.test.ts`
- `tests/unit/read-mission-resume.test.ts`
- `tests/unit/read-ticket-board-merge.test.ts`
- `dist/packages/contracts/src/guards/persisted-document-guards.js`
- `dist/packages/journal/src/event-log/event-log-errors.js`
- `dist/packages/journal/src/event-log/file-event-log.js`
- `dist/packages/mission-kernel/src/resume-service/read-approval-queue.js`
- `dist/packages/mission-kernel/src/resume-service/read-mission-artifacts.js`
- `dist/packages/mission-kernel/src/resume-service/read-mission-resume.js`
- `dist/packages/storage/src/fs-layout/file-system-read-errors.js`
- `dist/packages/storage/src/repositories/file-mission-repository.js`
- `dist/packages/storage/src/repositories/persisted-document-errors.js`
- `dist/packages/ticket-runtime/src/planner/read-ticket-board.js`
- `dist/tests/typecheck/persisted-document-validator.typecheck.js`
- `dist/tests/unit/event-log-defensive-read.test.js`
- `dist/tests/unit/file-system-read-errors.test.js`
- `dist/tests/unit/persisted-document-guards.test.js`
- `dist/tests/unit/persisted-document-repositories.test.js`
- `dist/tests/unit/read-approval-queue.test.js`
- `dist/tests/unit/read-mission-artifacts.test.js`
- `dist/tests/unit/read-mission-resume.test.js`
- `dist/tests/unit/read-ticket-board-merge.test.js`

## Change Log

- 2026-04-15: Creation story 5.2.2 depuis le code review de 5-2. Couvre les findings `medium` et `low` avec jugement explicite patch full vs minimal.
- 2026-04-20: Implementation completee. Validation defensive, readers mission-centriques et suite de tests consolides; story passee en `review`.
