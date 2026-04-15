# Story 5.2.2: Cleanup validation, diagnostics et polish (findings review 5-2, severites medium/low)

Status: ready-for-dev

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

- [ ] AC1: Strip BOM dans `readPersistedJsonDocument` (`packages/storage/src/repositories/persisted-document-errors.ts`). Test unitaire: `\uFEFF{"id":"m-1"}`.
- [ ] AC2: `readPayloadPreview` classifier ENOENT -> null, autres -> propagation/diagnostic. Test: payload EACCES -> pas de null silencieux.
- [ ] AC3: Tie-break timestamp dans `mergeTicketsById`/`mergeAttemptsById` (`read-ticket-board.ts`). Test: eventId plus grand mais timestamp anterieur.
- [ ] AC4: Confirmation flip `on_hold`->`todo`. Etapes: (a) relire le diff de `ticket-board.test.ts` + code metier associe; (b) si intentionnel, ajouter commentaire de justification + reference story; (c) sinon, revert test et aligner code. Documenter dans Dev Agent Record.
- [ ] AC6: Reecrire `PersistedDocumentValidator<T>` et `assertValidPersistedDocument<T>` avec typage sound. Adapter tous les callers. Tests type-level (`tsc --noEmit` doit rejeter un mismatch).
- [ ] AC7: Remplacer `in record` par `Object.prototype.hasOwnProperty.call` dans `persisted-document-guards.ts`. Test: `Object.create({id:"x"})` -> invalide.
- [ ] AC8: `InvalidPersistedDocumentError` porte `cause` (chainage raison ou validation result original). Test.
- [ ] AC9: Unifier messages `validateExecutionHandle` avec autres validators. Tests unitaires deux messages.
- [ ] AC10: `catch (error: unknown)` + `instanceof SyntaxError` dans parse JSON. Tests.
- [ ] AC11: Souscrire a `error` sur le stream readline + transformer en `EventLogReadError`. Test simule EBADF post-iteration.
- [ ] AC12: `normalizeEventLogReadError` preserve cause/stack pour non-errno non-Error. Test.
- [ ] AC13: Supprimer/wrapper `isEventLogFileSystemError`. Migrer callers.
- [ ] AC14: Ajouter `EBUSY`, `ETIMEDOUT` a `FILE_SYSTEM_READ_ERROR_CODES`. Test unitaire.
- [ ] AC15: `readApprovalQueue` une seule lecture du journal. Test: compter les invocations ou passer events en parametre.
- [ ] AC16: `ensureApprovalQueueWorkspaceInitialized` distinguer journal-present + projections-ENOENT. Test: mode degrade OK.
- [ ] AC17: `new Error(msg, { cause })` dans readers mission-centriques. Tests: verifier `.cause` via assertion.
- [ ] AC18: `readStoredResumeView` ne plus avaler SyntaxError silencieusement. Test.
- [ ] AC19: Nettoyer commentaire `Story 5.1.1 AC4` dans `file-mission-repository.ts`.
- [ ] AC20: `npm run build && npm test` vert; baseline post-5.2.1 preservee.

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

## Change Log

- 2026-04-15: Creation story 5.2.2 depuis le code review de 5-2. Couvre les findings `medium` et `low` avec jugement explicite patch full vs minimal.
