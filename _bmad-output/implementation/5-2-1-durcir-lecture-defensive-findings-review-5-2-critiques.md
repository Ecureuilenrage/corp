# Story 5.2.1: Durcir les chemins critiques de lecture defensive (findings review 5-2, severite high)

Status: done

## Story

As a mainteneur de `corp`,
I want eliminer les pieges de reconstruction, de canonicalisation snapshot et de classification d'erreurs critiques identifies lors du code review de 5-2,
so that la V1 ne remonte pas de messages trompeurs ("Mission introuvable" pour un fichier corrompu, "Conflit d'ecriture concurrente" pour un faux diff de snapshot, reconstruction contaminee par des `payload.ticket` accidentels) et que les invariants JSoT + snapshot restent sains meme apres corruption partielle.

## Context

Cette story traite les findings `high` du code review de 5-2 (2026-04-15) qui restent ouverts apres acceptation des AC1-AC8. Elle couvre trois familles:

1. **Reconstruction journal surete** — guards pour `reconstructTicketsFromJournal` / `reconstructAttemptsFromJournal`, tolerance aux status/ARTIFACT_KINDS futurs au downgrade, compat `authorizedExtensions: null`.
2. **Atomicite + lock snapshot mission** — canonicalisation `undefined`/Date/BigInt, ordre temporel dans `selectFreshMissionSnapshot`, message "Conflit" vs `schema_invalide` sous lock, diagnostic "Mission introuvable" vs corruption.
3. **Journal append-only defensif** — throw inatteignable dans `ensureAppendOnlyEventLog`, classification EROFS/EISDIR, TOCTOU entre troncature et re-lecture, propagation brute de `readMissionEvents` vers `readTicketBoard`, fall-through post-EEXIST `writeRegisteredSkillPackIfMissing`, liste skill-pack qui explose sur une seule corruption.

Elle ne refait pas le refactor partage (Story 5.3) ni les determinismes de tri (5.5).
Epic 5 est assume ici comme un epic de hardening pre-GA accepte par exception de gouvernance BMAD: 5.2.1 n'introduit pas de nouveau FR, elle verrouille surtout NFR15, NFR16 et NFR19 pour rendre la reprise, l'audit et les diagnostics CLI fiables sous corruption partielle, downgrade et concurrence residuelle.
Le baseline de reference de cette story est la Story 5.2 en statut `review`. Si ce baseline bouge avant implementation, il faut revalider AC1-AC13 avant de coder afin d'eviter de corriger des findings sur un socle mouvant.

## Execution Lots

La story reste un seul ticket de sprint, mais elle se pilote en 3 lots sequentiels pour eviter un mini-epic implicite. Chaque lot doit etre mergeable et testable seul sur le baseline 5.2.

1. Lot A - `snapshot + lock` (AC1-AC7)
   Definition of done: plus aucun faux conflit snapshot, politique stale-lock figee et documentee, causes classees preservees, messages CLI visibles couverts par tests.
2. Lot B - `reconstruction + journal` (AC8-AC10)
   Definition of done: allow-lists actives, journal append-only durci et classe, propagation `readMissionEvents` preservee jusqu'aux readers et a la CLI.
3. Lot C - `skill-pack + CLI diagnostics` (AC11-AC13)
   Definition of done: API `listAll()` canonique livree, `list()` legacy stricte preservee, packs valides + diagnostics invalides visibles ensemble, `npm run build && npm test` vert sur le baseline 5.2.

## Acceptance Criteria

1. Given un snapshot mission sur disque et un snapshot reconstruit depuis le journal sont semantiquement identiques mais diff rent sur la materialisation `authorizedExtensions: undefined` vs cle absente, ou contiennent des valeurs `Date`/`BigInt`/`Map`/`Set` identiques
   When `saveIfUnchanged` calcule `areMissionSnapshotsEqual`
   Then la comparaison retourne `true`
   And aucun faux `"Conflit d'ecriture concurrente"` n'est leve

2. Given un fichier `mission.json.lock` existe sur disque alors qu'aucun writer n'est actif (crash precedent)
   When un writer appelle `saveIfUnchanged` ou que le bootstrap mission prepare le workspace
   Then la mitigation V1 de 5.2.1 considere un lock comme stale uniquement via son `mtime` depassant un TTL configurable (defaut 5 minutes)
   And un lock plus recent reste traite comme une concurrence legitime; aucun probing PID/hostname cross-platform n'est requis dans cette story
   And le comportement est documente dans `docs/architecture/journal-as-source-of-truth.md` avec un runbook de deblocage manuel en cas de doute
   Note: la resolution stale-lock complete (PID monitoring cross-platform / metadata `{pid, hostname, timestamp}`) reste ouverte en D-64 et est hors scope 5.2.1.

3. Given le journal contient des events non autoritaires (`MISSION_AUTHORITATIVE_EVENT_TYPES`) plus recents que le dernier event autoritaire
   When `selectFreshMissionSnapshot` compare `storedMission` au `missionFromJournal`
   Then la comparaison n'utilise plus `resumeCursor !== lastEventId` seul
   And le snapshot le plus recent est selectionne via un crit re monotone (timestamp sur le dernier event autoritaire, a defaut eventId)

4. Given un event legacy porte `authorizedExtensions: null`
   When `validateMission` / `hydrateMission` lisent ce payload
   Then le champ est accepte comme equivalent a l'absence (`undefined`)
   And la mission n'est pas rejetee en `schema_invalide`
   And un test couvre explicitement ce cas

5. Given un snapshot mission persiste contient un `status` ou un `ARTIFACT_KIND` inconnu de la version courante (downgrade)
   When `validateMission` / `validateArtifact` lisent ce document
   Then les chemins de lecture snapshot/journal utilisent explicitement un mode `strict=false` par defaut pour ces discriminants ouverts
   And une valeur inconnue reste lisible comme string brute avec un warning structurel attache au diagnostic, plutot qu'un rejet `schema_invalide`
   And les chemins d'ecriture et les validations avant persistance restent en `strict=true` et continuent de rejeter ces valeurs
   And le document reste utilisable par les readers existants; le reconstruction depuis journal n'echoue pas

6. Given `mission.json` est corrompu ET le journal est vide
   When `readMissionResume` essaie de produire un resume
   Then l'erreur remontee est la cause originelle classee (`CorruptedPersistedDocumentError` ou `InvalidPersistedDocumentError`)
   And le message n'est pas remplace par "Mission introuvable" ou "Journal mission irreconciliable"

7. Given le lock `mission.json.lock` est detenu par le writer courant
   When `findById` lit le snapshot et le fichier est corrompu
   Then l'appelant amont de `saveIfUnchanged` re oit une erreur classee `CorruptedPersistedDocumentError` OU un "Conflit d'ecriture concurrente" coherent avec sa logique retry
   And aucune combinaison ne laisse le lock en place (finally unlink), meme quand l'erreur primaire vient du `writeJsonAtomic` et non du `findById`
   And l'erreur primaire (ex. `ENOSPC` ecriture) n'est jamais ecrasee par une erreur secondaire (`EACCES` sur `unlink(lockPath)`)

8. Given `reconstructTicketsFromJournal` itere les events
   When un event non autoritaire (ex. `ticket.reprioritized` portant `previousTicket`, ou event custom contenant accidentellement un champ `ticket`) apparait
   Then seul un event type explicite dans une allow-list `TICKET_AUTHORITATIVE_EVENT_TYPES` met a jour l'etat ticket
   And `reconstructAttemptsFromJournal` filtre par `missionId` (meme signature/contrat que `reconstructTicketsFromJournal`)

9. Given `ensureAppendOnlyEventLog` examine un journal existant
   When le fichier se termine sans newline finale sur une ligne JSON syntaxiquement et semantiquement valide
   Then la validation accepte le fichier sans re-lecture couteuse (pas de `readEventLog` apres `truncateJournal`)
   And une erreur I/O non-ENOENT non-EEXIST lors du `writeFile(..., flag: "wx")` (ex. EROFS, EISDIR, EACCES, EPERM) est classee `EventLogReadError.fileSystem` et non propagee brute
   And le throw final "derniere ligne complete sans newline finale" disparait en tant que branche inatteignable

10. Given `readMissionEvents` est appele par `readTicketBoard` sans wrapper local
    When `readEventLog` l ve une erreur OS
    Then la classification `EventLogReadError`/`isClassifiedReadError` traverse la chaine jusqu'a la CLI
    And aucun `SyntaxError`/`EACCES:` brut ne fuit dans les commandes `ticket board`/`mission resume`

11. Given `writeRegisteredSkillPackIfMissing` traite un `EEXIST` (manifest deja publie)
    When la lecture `findByPackRef` subsequente echoue pour une autre cause (corruption, schema, I/O)
    Then l'erreur remontee cite la cause reelle (non "Dir orpheline non revendiquable")
    And la retry/attente eventuelle preserve la classification

12. Given `FileSkillPackRegistryRepository.list()` rencontre au moins une entree corrompue parmi N entrees
    When la liste est demandee
    Then le repository expose `listAll(): Promise<{ valid: RegisteredSkillPack[]; invalid: SkillPackListDiagnostic[] }>` comme API canonique de lecture multi-pack
    And `list()` reste un wrapper legacy strict qui preserve le throw historique si `invalid.length > 0`, avec documentation de deprecation
    And la CLI `corp skill-pack list` s'appuie sur `listAll()` pour surfacer les diagnostics sans masquer les packs sains

13. Given la story est terminee
    When la suite de tests est lancee
    Then les tests couvrent chaque critere AC1 a AC12 (unitaires + integration ou contract)
    And les messages CLI visibles impactes par AC6, AC7, AC10 et AC12 sont verrouilles par tests contract ou integration
    And la baseline technique de 5.2 en statut `review` (`npm test`, 326 tests verts au moment de la redaction) reste verte avec les nouveaux tests
    And au minimum un test couvre: canonicalisation `undefined`, `selectFreshMissionSnapshot` timestamp tie-break, corruption + journal vide = cause preservee, allow-list `TICKET_AUTHORITATIVE_EVENT_TYPES`, tolerance status futur, liste skill-pack avec entree corrompue.

## Tasks / Subtasks

- [x] AC1: Canonicalisation snapshot mission
  - [x] Reecrire `canonicalize` dans `packages/storage/src/repositories/file-mission-repository.ts` en utilisant un replacer explicite: `undefined` -> cle supprimee, tri recursif des cles, Date -> ISO, BigInt -> string, Map/Set rejetes (non attendus).
  - [x] Tests `tests/unit/file-mission-repository.test.ts`: equivalence `{a:undefined}` vs `{}`, deux missions identiques avec ordre de cles different, snapshot hydrate vs reconstruit.

- [x] AC2: Lockfile orphelin (patch minimal + doc)
  - [x] Au bootstrap mission (`ensure-mission-workspace.ts`) et/ou juste avant l'acquisition du lock, detecter un `mission.json.lock` dont le `mtime` depasse un TTL configurable (default 5 min) et le supprimer avec log explicite.
  - [x] Conserver le conflit courant pour tout lock en-dessous du seuil; ne pas embarquer de probing PID/hostname cross-platform dans 5.2.1.
  - [x] Ajouter une section "Deblocage manuel d'un lock stale" dans `docs/architecture/journal-as-source-of-truth.md`.
  - [x] Laisser D-64 ouvert pour la detection TTL/PID complete post-GA.

- [x] AC3: `selectFreshMissionSnapshot` ordre temporel
  - [x] Dans `packages/ticket-runtime/src/planner/read-ticket-board.ts`, remplacer la comparaison `resumeCursor !== lastEventId` par une selection basee sur le dernier event autoritaire (timestamp monotone; eventId en tie-break).
  - [x] Test `tests/unit/select-fresh-mission-snapshot.test.ts` (ou equivalent): journal se terminant par un event non-autoritaire ne doit pas preferer un `missionFromJournal` plus ancien.

- [x] AC4: Compat `authorizedExtensions: null`
  - [x] `validateMission` (`persisted-document-guards.ts`) accepte `null` comme equivalent d'absent; rejet uniquement si type different (string, number, tableau non-string, etc.).
  - [x] `hydrateMission` normalise `null` -> `undefined`.
  - [x] Test guard: `{ authorizedExtensions: null }` -> valide; `{ authorizedExtensions: 42 }` -> invalide.

- [x] AC5: Tolerance status/ARTIFACT_KIND futurs
  - [x] Dans `persisted-document-guards.ts`, isoler les unions "ouvertes" (status mission, status ticket, ARTIFACT_KINDS) derriere un mode `strict=false` documente.
  - [x] En mode non-strict (default pour lectures snapshot/journal), un discriminant inconnu n'est pas `schema_invalide`; la valeur brute reste lisible et un warning structurel est expose au diagnostic sans interrompre la lecture.
  - [x] En mode strict (writes / validation avant persistance), le rejet est conserve.
  - [x] Tests: mission persistee avec `status: "archived_v2"` hypothetique est lue sans throw.
  - [x] Note dans Dev Notes: "politique forward-compat" -- documente aussi dans `docs/architecture/journal-as-source-of-truth.md`.

- [x] AC6: Corruption mission + journal vide -> cause preservee
  - [x] Dans `packages/mission-kernel/src/resume-service/read-mission-resume.ts`, modifier la branche `!baseMission && missionEvents.length === 0`: si une `CorruptedPersistedDocumentError`/`InvalidPersistedDocumentError` a ete capturee lors de `readStoredMissionSnapshot`, la propager au lieu de lever "Mission introuvable".
  - [x] Test integration: mission.json corrompu + events.jsonl vide -> message cite `json_corrompu` et chemin, pas "Mission introuvable".

- [x] AC7: `findById` corrompu sous lock
  - [x] Dans `file-mission-repository.ts`, `saveIfUnchanged`: toute erreur primaire du try (`findById` OU `writeJsonAtomic`) est preservee; le `finally { unlink(lockPath) }` catch et log les erreurs secondaires (`EACCES` sur unlink) sans ecraser la primaire.
  - [x] Si `findById` remonte `Corrupted/Invalid`, le caller re oit cette classification (non remappee en "Conflit").
  - [x] Tests: injecter corruption dans `findById` sous lock simule, verifier que la classification traverse et que le lock est libere.

- [x] AC8: Allow-list de reconstruction
  - [x] Definir `TICKET_AUTHORITATIVE_EVENT_TYPES` et `ATTEMPT_AUTHORITATIVE_EVENT_TYPES` dans `packages/journal/src/reconstruction/mission-reconstruction.ts`.
  - [x] `reconstructTicketsFromJournal` itere uniquement les types allow-listes; payload `ticket` dans un type hors liste ignore.
  - [x] `reconstructAttemptsFromJournal` accepte un parametre `missionId` et filtre les events.
  - [x] Tests: event `ticket.reprioritized` avec `previousTicket` ne regresse pas l'etat courant; event cross-mission ignore.

- [x] AC9: `ensureAppendOnlyEventLog` durcissement
  - [x] Supprimer le throw final inatteignable dans `validateExistingAppendOnlyEventLog` (`packages/journal/src/event-log/file-event-log.ts`).
  - [x] Classifier les erreurs de `writeFile(..., { flag: "wx" })` autres que `EEXIST`/`ENOENT` via `EventLogReadError.fileSystem`.
  - [x] Eviter la re-lecture complete apres `truncateJournal`: re-valider uniquement la derniere ligne ou accepter la troncature comme integre.
  - [x] Tests: simuler `EROFS`/`EISDIR` sur writeFile, verifier classification.

- [x] AC10: `readMissionEvents` classification end-to-end
  - [x] Dans `read-ticket-board.ts`, wrapper l'appel a `readMissionEvents` via `isClassifiedReadError`/`isEventLogReadError`.
  - [x] Test contract: `ticket board` avec journal EACCES renvoie message classe (pas de fuite `EACCES:` brut).

- [x] AC11: `writeRegisteredSkillPackIfMissing` diagnostic propre
  - [x] Dans `file-skill-pack-registry-repository.ts`, apres `isAlreadyExistsError`, preserver les erreurs suivantes de `findByPackRef` avec leur classification (non "Dir orpheline non revendiquable").
  - [x] Test: manifest EEXIST + `findByPackRef` remonte `InvalidPersistedDocumentError` -> erreur classee avec packRef.

- [x] AC12: `list()` skill-pack resultat structure
  - [x] Ajouter une API canonique `listAll(): Promise<{ valid: RegisteredSkillPack[]; invalid: SkillPackListDiagnostic[] }>`; faire de `list()` un wrapper legacy strict documente comme deprecated.
  - [x] `list()` continue de throw si `invalid.length > 0`; la CLI `corp skill-pack list` consomme `listAll()` pour exposer les diagnostics sans masquer les packs sains.
  - [x] Test: 3 packs dont 1 corrompu -> `listAll()` retourne `2 valid + 1 invalid`; les tests existants `list()` preservent le comportement strict.

- [x] AC13: Suite de tests
  - [x] Tests integration / contract: mission corrompue + journal vide, `select-fresh` timestamp tiebreak, compat `authorizedExtensions: null`, tolerance status futur, allow-list ticket reconstruction, list() skill-pack structure.
  - [x] Tests contract / integration sur les messages CLI visibles: pas de "Mission introuvable" trompeur, pas de `EACCES:` brut, diagnostics multi-pack surfacables.
  - [x] `npm run build && npm test` vert; baseline de reference = story 5.2 en `review` (326 tests au moment de la redaction) + nouveaux tests.

## Dev Notes

### Story Intent

Appliquer les patches `high` du code review 5-2 en preservant la JSoT et la surface CLI. Epic 5 est traite comme un epic de hardening pre-GA, pas comme un nouveau slice fonctionnel. La valeur operateur attendue ici est une reprise fiable, un audit fiable et des diagnostics CLI non trompeurs sous corruption partielle, downgrade ou concurrence residuelle.

### Guardrails de scope

- Ne pas refactoriser les helpers workspace communs: Story 5.3.
- Ne pas changer les tris/filtrage deterministes: Story 5.5.
- Ne pas introduire de dependance externe (pas de zod/ajv).
- Ne pas traiter les findings medium/low: Story 5.2.2.

### Decisions figees avant dev

- AC2: mitigation stale-lock V1 = TTL sur `mtime` configurable (defaut 5 min). Pas de probing PID/hostname cross-platform dans 5.2.1.
- AC5: lectures snapshot/journal en `strict=false` pour les discriminants ouverts; writes/validation avant persistance en `strict=true`.
- AC12: `listAll()` devient l'API canonique multi-pack; `list()` reste legacy stricte et peut throw si des entrees invalides existent.

### Baseline de reference

- La base technique de 5.2.1 est la Story 5.2 en statut `review` au moment du demarrage.
- Si 5.2 bouge avant implementation, revalider AC1-AC13 et les tests minimaux avant de coder ou de merger un lot.
- En l'absence d'artefact UX dedie, les messages CLI vises par AC6, AC7, AC10 et AC12 font foi et doivent etre proteges par tests contract/integration.

### Findings couverts

Decision-needed: 1, 2 (partiel), 3, 4, 5, 6, 7, 10 (via AC5 tolerance status).
Patches: P1 (ensureAppendOnlyEventLog throw), P2 (EROFS/EISDIR), P3 (readMissionResume cause - delegue en 5.2.2 mais AC6 couvre la propagation), P4 (reconstructTickets allow-list), P5 (reconstructAttempts mission filter), P6 (writeRegisteredSkillPackIfMissing), P7 (readMissionEvents classification), P8 (mission corrompu + journal vide).

### References

- `_bmad-output/implementation/5-2-durcir-la-lecture-defensive-et-la-validation-de-schema.md` - section `Review Findings`.
- `_bmad-output/implementation/deferred-work.md` - D-64 (lock TTL post-GA).
- `docs/architecture/journal-as-source-of-truth.md` - invariants JSoT.

## Change Log

- 2026-04-16: Implementation complete et passage en review. Livraison du nettoyage stale-lock TTL, des warnings structurels forward-compat, des allow-lists journal, de `corp extension skill-pack list`, des tests AC1-AC13 et de la documentation JSoT associee.
- 2026-04-16: Retouche suite au report d'implementation readiness: decisions AC2/AC5/AC12 figees, lots d'execution A/B/C ajoutes, baseline 5.2 + attentes CLI visibles explicitees.
- 2026-04-15: Creation story 5.2.1 depuis le code review de 5-2. Couvre les findings `high` (decisions 1-7 + patches critiques). Report e les patches medium/low vers 5.2.2.

## Dev Agent Record

### Summary

- Hardening applique sur les lectures snapshot/journal: discriminants ouverts toleres en lecture avec warnings structurels, `authorizedExtensions: null` normalise, et propagation des causes originales sur snapshot mission corrompu.
- Durcissement concurence/journal: canonicalisation snapshot, cleanup stale-lock TTL avant bootstrap/save, allow-lists `TICKET_AUTHORITATIVE_EVENT_TYPES` / `ATTEMPT_AUTHORITATIVE_EVENT_TYPES`, et classification I/O journal jusqu'a la CLI.
- Registre skill-pack et CLI: `listAll()` canonique, `list()` legacy stricte conservee, nouvelle commande `corp extension skill-pack list` alignee sur la namespace extension existante, et diagnostic reel preserve apres `EEXIST`.

### Validation

- `npm run build`
- `npm test` (`346` tests verts)

## File List

- `apps/corp-cli/src/commands/extension-command.ts`
- `apps/corp-cli/src/formatters/extension-skill-pack-list-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `docs/architecture/journal-as-source-of-truth.md`
- `packages/contracts/src/guards/persisted-document-guards.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/reconstruction/mission-reconstruction.ts`
- `packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`
- `packages/mission-kernel/src/mission-service/ensure-mission-workspace.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/fs-layout/file-system-read-errors.ts`
- `packages/storage/src/repositories/file-artifact-repository.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/storage/src/repositories/file-skill-pack-registry-repository.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `tests/contract/mission-extension-cli.test.ts`
- `tests/contract/mission-ticket-board-cli.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/skill-pack-register-cli.test.ts`
- `tests/integration/ticket-board.test.ts`
- `tests/unit/event-log-defensive-read.test.ts`
- `tests/unit/file-mission-repository.test.ts`
- `tests/unit/mission-reconstruction-authoritative-events.test.ts`
- `tests/unit/mission-snapshot-equality.test.ts`
- `tests/unit/persisted-document-guards.test.ts`
- `tests/unit/persisted-document-repositories.test.ts`
- `tests/unit/select-fresh-mission-snapshot.test.ts`
- `tests/unit/skill-pack-registration.test.ts`

### Review Findings

- [x] [Review][Decision→Patch] `validateExecutionAttempt` n'applique pas `validateOpenStringUnion` contrairement a Mission/Ticket/Artifact — CORRIGE — La politique forward-compat AC5 (strict=false en lecture) n'est pas appliquee aux discriminants `status` et `adapter` de `ExecutionAttempt`. Un status ou adapter inconnu (downgrade) fait que `tryReadAttemptSnapshot` retourne `null`, perdant silencieusement la tentative lors de la reconstruction journal. Incoherent avec l'invariant 6 de journal-as-source-of-truth.md. [packages/contracts/src/guards/persisted-document-guards.ts:161-179, packages/journal/src/reconstruction/mission-reconstruction.ts]
- [x] [Review][Patch] `createRecoverableMissionReadError` code mort redondant — CORRIGE. Fonction supprimee, erreur passee directement avec typage explicite `CorruptedPersistedDocumentError | InvalidPersistedDocumentError`. [packages/mission-kernel/src/resume-service/read-mission-resume.ts]
- [x] [Review][Patch] `resolveMissionLockStaleTtlMs` accepte TTL=0ms — CORRIGE. Condition changee de `>= 0` a `> 0` pour override et env var. TTL=0 retombe sur le defaut 5 min. [packages/storage/src/repositories/file-mission-repository.ts]
- [x] [Review][Defer] TOCTOU sur nettoyage lock stale — race entre stat/unlink/writeFile(wx) permettant a deux processus de supprimer simultanement un lock stale et d'acquerir chacun un lock. Limitation connue, couverte par D-64. [packages/storage/src/repositories/file-mission-repository.ts] — deferred, D-64 scope
- [x] [Review][Defer] Variables globales mutables pour injection de test — `setEventLogDependenciesForTesting` et `setReadTicketBoardDependenciesForTesting` mutent un singleton global. Fuite entre tests paralleles possible. Pattern pre-existant (D-30). [packages/journal/src/event-log/file-event-log.ts, packages/ticket-runtime/src/planner/read-ticket-board.ts] — deferred, pre-existing
- [x] [Review][Defer] `removeStaleMissionLockIfNeeded` erreur EACCES/EPERM sur stat non distinguee — Un lock avec permissions corrompues fait echouer le bootstrap au lieu d'un warning. [packages/storage/src/repositories/file-mission-repository.ts:266-288] — deferred, polish futur
- [x] [Review][Defer] `readMissionEventsSafely` ne reclassifie pas les erreurs non-filesystem — TypeError ou erreurs de parsing non classifiees remontent brutes. Les erreurs non-FS sont des erreurs de programmation, pas operationnelles. [packages/ticket-runtime/src/planner/read-ticket-board.ts] — deferred, 5.2.2
- [x] [Review][Defer] `listAll` ignore les repertoires orphelins sans manifeste — Un repertoire skill-pack sans `skill-pack.json` n'apparait ni dans `valid` ni dans `invalid`. Diagnostic manquant. [packages/storage/src/repositories/file-skill-pack-registry-repository.ts:140-174] — deferred, polish futur
- [x] [Review][Defer] Validation post-truncation remplacee par validation in-memory — Apres truncation d'une derniere ligne corrompue, le journal n'est plus relu depuis le disque. Validation du prefix en memoire suffisante en V1. [packages/journal/src/event-log/file-event-log.ts] — deferred, acceptable V1
- [x] [Review][Defer] `validateBufferedEventLog` double la consommation memoire — `readFile` + `split("\n")` cree un tableau additionnel a partir du contenu deja charge. Impact negligeable sauf journaux tres volumineux. [packages/journal/src/event-log/file-event-log.ts:175-192] — deferred, perf post-GA
