# Story 5.2: Durcir la lecture defensive et la validation de schema cross-repositories

Status: review

## Story

As a mainteneur de `corp`,
I want que chaque lecture de document persiste valide explicitement le schema et classe les erreurs disque avant exposition au domaine,
so that un fichier corrompu, obsolete, absent ou inaccessible produise un diagnostic deterministe au lieu d'un objet partiel, d'une projection irreconciliable trompeuse ou d'un crash runtime.

## Context

Epic 5 durcit la V1 avant GA sans introduire de nouveau FR. La Story 5.1, puis 5.1.1 et 5.1.2, ont consolide l'invariant `journal-as-source-of-truth`: `events.jsonl` est l'autorite, les snapshots JSON et projections sont des vues best-effort reconstructibles. Cette story 5.2 est le pendant lecture: tout passage disque -> domaine doit etre explicite, valide et diagnosable.

La pre-redaction 5.2 ciblait deja `mission.json`, `ticket.json`, capability, skill-pack, `readEventLog`, `readApprovalQueue` et `read-mission-audit`. L'analyse du code courant et des findings 5.1 ajoute trois points importants:

- les repositories `ExecutionAttempt` et `Artifact` lisent aussi des snapshots JSON via `JSON.parse(...) as T` et doivent suivre le meme contrat;
- `FileSkillPackRegistryRepository.list()` avale encore les entrees corrompues silencieusement, ce qui rend une liste partielle invisible;
- `ensureAppendOnlyEventLog` traite `EEXIST` comme benin sans verifier qu'un journal existant n'est pas tronque.

## Acceptance Criteria

1. Given un snapshot persiste `mission.json`, `ticket.json`, `attempt.json`, `artifact.json`, `capability.json` ou `skill-pack.json` est syntaxiquement corrompu
   When le repository correspondant le lit via `findById`, `findByCapabilityId`, `findByPackRef`, `listByMissionId`, `listByTicketId` ou un helper interne equivalent
   Then la lecture leve une erreur domaine deterministe `json_corrompu` avec le chemin du fichier et l'entite concernee
   And aucun `SyntaxError` brut ni stack trace Node ne fuite jusqu'a la CLI

2. Given un de ces snapshots est syntaxiquement valide mais ne respecte pas le contrat runtime attendu
   When le repository tente de l'exposer comme `Mission`, `Ticket`, `ExecutionAttempt`, `Artifact`, `RegisteredCapability` ou `RegisteredSkillPack`
   Then un guard runtime rejette le document avec une erreur `schema_invalide`
   And le message cite au minimum le fichier, le type attendu et une raison lisible (`champ manquant`, `type incorrect`, `statut inconnu`, `discriminant invalide`)
   And aucun `as T` non valide ne retourne un objet partiel au service applicatif

3. Given `events.jsonl` est absent apres bootstrap ou supprime manuellement
   When une commande de lecture mission-centrique est invoquee (`mission status`, `mission resume`, `mission audit`, `mission approval queue`, `mission artifact list`, `mission ticket board`)
   Then le diagnostic distingue `ENOENT` comme journal manquant avec une action explicite (`relancer bootstrap` ou restaurer le journal)
   And l'erreur n'est pas remappee en "Workspace mission non initialise", "projection irreconciliable" ou "Mission introuvable" si le workspace existe par ailleurs

4. Given `events.jsonl`, une projection ou un snapshot est inaccessible ou en erreur I/O (`EACCES`, `EPERM`, `EIO`, `EMFILE`, `ENOSPC`)
   When un reader ou un repository rencontre cette erreur
   Then le code produit un message classe `erreur_fichier` ou equivalent, en conservant le code OS et le chemin si disponible
   And les erreurs inconnues sont propagees au lieu d'etre avalees par un bare catch generique

5. Given `events.jsonl` existe mais contient une ligne JSON invalide, une ligne valide avec un mauvais schema d'event, ou une derniere ligne tronquee par un ancien `ENOSPC`
   When `readEventLog` ou `ensureAppendOnlyEventLog` examine le journal
   Then la ligne invalide est signalee avec son numero et le journal concerne
   And `ensureAppendOnlyEventLog` ne considere plus un fichier existant comme sain sans validation minimale
   And seule une derniere ligne clairement incomplete peut etre tronquee jusqu'au dernier newline valide; une ligne complete mais semantiquement invalide reste une erreur explicite

6. Given `readApprovalQueue`, `readMissionArtifacts`, `readMissionAudit`, `readMissionResume` ou `readTicketBoard` reconstruit depuis le journal
   When une erreur de lecture classee survient dans le journal, une projection ou un snapshot
   Then le reader conserve la cause classee au lieu de la remplacer par un fallback generique
   And les readers JSoT continuent a reconstruire depuis le journal quand un snapshot est absent, obsolete ou invalide mais que le journal reste exploitable

7. Given `FileSkillPackRegistryRepository.list()` rencontre un skill-pack corrompu ou invalide
   When la liste est demandee par le registre ou la CLI
   Then l'entree corrompue n'est plus ignoree silencieusement
   And le comportement est soit un echec explicite avec le `packRef` et le chemin, soit un resultat structure qui expose les diagnostics; ne pas retourner une liste partielle sans signal

8. Given la story est terminee
   When la suite de tests est lancee
   Then les tests unitaires couvrent chaque guard et chaque classe d'erreur ciblee
   And les tests integration/contract couvrent au moins: JSON corrompu, schema invalide, journal manquant, journal tronque, erreur filesystem normalisee, et liste skill-pack corrompue
   And la baseline post-5.1.2 (`npm test`, 309 tests verts dans la story precedente) reste verte avec les nouveaux tests.

## Tasks / Subtasks

- [x] Creer la taxonomie d'erreurs de lecture defensive (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] Ajouter un module partage cote storage/journal, par exemple `packages/storage/src/repositories/persisted-document-errors.ts` et/ou `packages/journal/src/event-log/event-log-errors.ts`.
  - [x] Modeliser au minimum: `CorruptedPersistedDocumentError` (`json_corrompu`), `InvalidPersistedDocumentError` (`schema_invalide`), `EventLogReadError` (`journal_manquant`, `journal_invalide`, `erreur_fichier`).
  - [x] Conserver `cause`, `filePath`, `entityLabel`, `documentId` si disponible et `code` OS si l'erreur vient du filesystem.
  - [x] Eviter les messages qui masquent la cause reelle: pas de `catch { throw new Error(...) }` sauf si le code a deja classe l'erreur.

- [x] Ajouter des guards runtime canoniques pour documents persistes (AC: 1, 2)
  - [x] Localisation recommandee: `packages/contracts/src/guards/` ou fichiers colocalises dans `packages/contracts/src/<domain>/`.
  - [x] Guards requis: `isMission`, `isTicket`, `isExecutionAttempt`, `isArtifact`, `isRegisteredCapability`, `isRegisteredSkillPack`, `isJournalEventRecord` exporte si necessaire.
  - [x] Verifier les champs obligatoires, les types scalaires, les arrays de strings, les branches `null` documentees et les unions de statuts/discriminants.
  - [x] Pour `Mission`, garder la compatibilite explicite avec `hydrateMission`: `authorizedExtensions` peut etre absent uniquement comme compat documentee, mais une valeur presente de mauvais type doit etre rejetee.
  - [x] Ne pas attendre la Story 5.3 pour ce lot: les guards crees ici deviennent la source canonique pour les documents persistes. La Story 5.3 devra les reutiliser plutot que les dupliquer.

- [x] Centraliser le parse JSON defensif des repositories (AC: 1, 2, 4)
  - [x] Ajouter un helper `readPersistedJsonDocument(filePath, label)` ou equivalent qui lit, parse en `unknown`, transforme `SyntaxError` en `CorruptedPersistedDocumentError` et laisse passer/classe les erreurs OS.
  - [x] Ajouter un helper `assertValidPersistedDocument(value, guard, label, filePath)` ou equivalent.
  - [x] Le helper ne doit pas ajouter de dependance externe (pas de Zod/Ajv pour cette story). TypeScript + guards maison suffisent et respectent le package actuel.

- [x] Brancher les validators dans les repositories de snapshots (AC: 1, 2, 4)
  - [x] `packages/storage/src/repositories/file-mission-repository.ts`: `findById` parse en `unknown`, valide `isMission`, puis appelle `hydrateMission`.
  - [x] `packages/storage/src/repositories/file-ticket-repository.ts`: `findById` valide `isTicket`; `readMissionSnapshot` valide `isMission` avant d'utiliser `ticketIds`.
  - [x] `packages/storage/src/repositories/file-execution-attempt-repository.ts`: `findById` valide `isExecutionAttempt`; `listByTicketId` propage l'erreur avec `attemptId`.
  - [x] `packages/storage/src/repositories/file-artifact-repository.ts`: `readArtifactSnapshot` valide `isArtifact`; `listByTicketId` et `listByMissionId` ne retournent pas une liste partielle silencieuse si une entree est invalide.
  - [x] `packages/storage/src/repositories/file-capability-registry-repository.ts`: `findByCapabilityId` valide `isRegisteredCapability`; conserver le message existant "fichier de registre corrompu" mais le structurer via la nouvelle erreur.
  - [x] `packages/storage/src/repositories/file-skill-pack-registry-repository.ts`: `findByPackRef` valide `isRegisteredSkillPack`; `list()` ne doit plus faire `catch { continue; }` sans diagnostic.

- [x] Durcir `readEventLog` et `ensureAppendOnlyEventLog` (AC: 3, 4, 5, 6)
  - [x] `readEventLog` doit classer `ENOENT`, `EACCES`, `EPERM`, `EIO`, `EMFILE`, `ENOSPC` et conserver le chemin du journal.
  - [x] Remplacer si possible `readFile(...).split(...)` par un parsing ligne-a-ligne pour reduire le pic memoire de D-60, tout en conservant l'API publique `Promise<JournalEventRecord[]>`.
  - [x] Le parser doit indiquer le numero de ligne pour JSON invalide et schema invalide.
  - [x] `ensureAppendOnlyEventLog` doit valider un fichier existant: fichier vide OK; fichier non vide doit finir par newline ou etre tronque uniquement sur derniere ligne incomplete; une ligne complete invalide doit rester une erreur.
  - [x] Ajouter des tests unitaires pour journal vide, journal sain, ligne JSON invalide, schema invalide, derniere ligne tronquee, `ENOENT`, `EACCES/EPERM` simule.

- [x] Normaliser les erreurs dans les readers mission-centriques (AC: 3, 4, 6)
  - [x] `packages/mission-kernel/src/resume-service/read-approval-queue.ts`: etendre `FILE_SYSTEM_ERROR_CODES` a `ENOENT`, `EACCES`, `EPERM`, `EIO`, `EMFILE`, `ENOSPC`; ne pas convertir `ENOENT journal` en projection irreconciliable.
  - [x] `packages/mission-kernel/src/resume-service/read-mission-audit.ts`: remplacer `ensureMissionAuditWorkspaceInitialized` bare catch par une classification explicite; propager les erreurs journal classees.
  - [x] `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`: remplacer le catch global qui masque tout en `Projection artifact-index irreconciliable`; conserver les erreurs classees de journal/snapshot.
  - [x] `packages/mission-kernel/src/resume-service/read-mission-resume.ts`: remplacer le catch global autour de `readMissionEvents`; conserver le message historique seulement pour un journal semantiquement irreconciliable, pas pour `ENOENT/EACCES/EIO`.
  - [x] `packages/ticket-runtime/src/planner/read-ticket-board.ts`: inclure `EACCES` et `EIO`; `ensureTicketBoardWorkspaceInitialized` ne doit pas masquer permission/IO en "workspace non initialise".
  - [x] Extraire si utile un helper pur de formatage `formatFileSystemReadError` pour tester les codes OS sans `chmod 000` non portable.

- [x] Ajouter les tests de non-regression defensive-read (AC: 1 a 8)
  - [x] Tests unitaires de chaque guard: cas valide, champ manquant, mauvais type, discriminant/statut inconnu.
  - [x] Tests repositories: JSON corrompu et schema invalide pour mission, ticket, attempt, artifact, capability, skill-pack.
  - [x] Tests `readEventLog`: journal absent, permission/IO simulee, ligne invalide, schema event invalide, derniere ligne tronquee.
  - [x] Tests integration/contract CLI portables: supprimer `events.jsonl` apres bootstrap puis invoquer `mission status` ou `mission audit`; verifier message `journal manquant` et absence de stack brute.
  - [x] Test skill-pack: entree corrompue dans `.corp/skill-packs/<packRef>/skill-pack.json` puis `list()` ou commande CLI equivalente; verifier diagnostic explicite au lieu de liste partielle.
  - [x] Eviter les tests `chmod 000` obligatoires sur Windows; preferer injection/mocking de fonctions fs ou helper pur pour simuler `EACCES`, `EIO`, `EMFILE`, `ENOSPC`.

- [x] Mettre a jour la documentation de dette si necessaire (AC: 8)
  - [x] Marquer comme traites les items absorbes dans `_bmad-output/implementation/deferred-work.md` uniquement si les tests correspondants existent.
  - [x] Items cibles: D-06, D-08, D-18, D-34, D-38, D-44, D-48, D-61, D-63; D-60 seulement si le parsing ligne-a-ligne ou une borne memoire est reellement livree.

### Review Findings

Code review 2026-04-15 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor confirme AC1-3, AC5-8 satisfaits; AC4 satisfait sauf 1 bare-catch mineur. Les findings ci-dessous sont triés par classification.

#### Decisions requises (11)

- [ ] [Review][Decision] Canonicalize snapshot mission incomplet — `areMissionSnapshotsEqual`/`canonicalize` dans `file-mission-repository.ts` ne gère pas Date/BigInt/Map/Set/Symbol ni la différence entre clé absente et valeur `undefined`. Un snapshot hydraté (compat `authorizedExtensions: undefined`) vs reconstruit peut être faussement déclaré différent et déclencher "Conflit d'ecriture concurrente" bloquant. Choix: replacer JSON.stringify explicite, ou accepter le risque et documenter.
- [ ] [Review][Decision] Lockfile orphelin non détecté — `writeFile(lockPath, "", { flag: "wx" })` dans `saveIfUnchanged` ne détecte pas un crash précédent → deadlock permanent ("Conflit d'ecriture concurrente") jusqu'à suppression manuelle. Choix: TTL/stat-mtime check au bootstrap, cleanup au démarrage, ou rester manuel et documenter dans le runbook.
- [ ] [Review][Decision] `selectFreshMissionSnapshot` préfère journal sans ordre temporel — `storedMission.resumeCursor !== lastEventId` ignore les events non autoritaires filtrés (`MISSION_AUTHORITATIVE_EVENT_TYPES`); `missionFromJournal` peut être plus ancien que `storedMission`. Risque: board réutilise un snapshot périmé. [`packages/ticket-runtime/src/planner/read-ticket-board.ts`]
- [ ] [Review][Decision] `validateMission` rejette `authorizedExtensions: null` — AC2 exige rejet mauvais type mais des missions legacy peuvent porter `null` (compat côté `hydrateMission`). Choix: traiter `null` ≡ absent (compat lecture) ou maintenir rejet strict et migrer. [`packages/contracts/src/guards/persisted-document-guards.ts`]
- [ ] [Review][Decision] `FileSkillPackRegistryRepository.list()` explose sur une seule entrée corrompue — nouveau comportement valide AC7 mais régresse vs ancien `catch { continue }`. Choix: garder échec dur (actuel), ou exposer `{valid[], invalid[]}` structuré pour ne pas masquer les packs sains. [`packages/storage/src/repositories/file-skill-pack-registry-repository.ts`]
- [ ] [Review][Decision] Guards rejettent tout status/ARTIFACT_KIND futur — un downgrade du binaire après qu'une mission ait été persistée avec un statut futur bloque la lecture ("Journal mission irreconciliable"). Choix: tolérance (warning + skip) ou rejet strict (maintenu). [`persisted-document-guards.ts`]
- [ ] [Review][Decision] `findById` sous lock remonte `schema_invalide` au lieu de "Conflit d'ecriture concurrente" — l'amont de `saveIfUnchanged` attend le message "Conflit" pour sa logique retry; un fichier corrompu sous lock casse la séquence. [`file-mission-repository.ts`]
- [ ] [Review][Decision] `mergeTicketsById`/`mergeAttemptsById` écrasent sur eventId sans timestamp — un event plus ancien avec eventId nouveau provoque régression vers état passé. Choix: comparer par timestamp, maintenir eventId, ou allow-list strict des `payload.ticket`. [`read-ticket-board.ts`]
- [ ] [Review][Decision] Test `ticket-board.test.ts` flip `on_hold`→`todo` / `runnable: true` — changement sémantique non documenté dans la story. À confirmer comme intentionnel, ou revert.
- [ ] [Review][Decision] BOM UTF-8 en tête de `mission.json`/`ticket.json` cause `SyntaxError` → `json_corrompu` sur un fichier légitime édité sous Windows. Choix: strip BOM dans `readPersistedJsonDocument` ou documenter contrainte.
- [ ] [Review][Decision] `readPayloadPreview` bare-catch masque EACCES/EIO (AC4) — preview best-effort avale toute erreur silencieusement. Choix: classer `isFileSystemReadError` vs null seulement pour ENOENT, ou documenter l'exception AC4. [`read-mission-artifacts.ts`]

#### Patches (22)

- [ ] [Review][Patch] `ensureAppendOnlyEventLog` throw inatteignable + double re-lecture journal après troncature [`packages/journal/src/event-log/file-event-log.ts`]
- [ ] [Review][Patch] `ensureAppendOnlyEventLog` EROFS/EISDIR non classés — re-throw brut au lieu de `EventLogReadError.fileSystem` [`file-event-log.ts`]
- [ ] [Review][Patch] `readMissionResume` catch générique perd `.cause` — `TypeError`/OOM avalés en "Journal mission irreconciliable" sans `{ cause }` [`packages/mission-kernel/src/resume-service/read-mission-resume.ts`]
- [ ] [Review][Patch] `reconstructTicketsFromJournal` sans allow-list des types d'event — payload `ticket` accidentel (ex. `previousTicket`) accepté comme source de vérité [`packages/journal/src/reconstruction/mission-reconstruction.ts`]
- [ ] [Review][Patch] `reconstructAttemptsFromJournal` ne filtre pas par `missionId` — contamination possible si events cross-mission [`mission-reconstruction.ts`]
- [ ] [Review][Patch] `writeRegisteredSkillPackIfMissing` fall-through trompeur post-EEXIST — jette "Dir orpheline non revendiquable" si `findByPackRef` échoue ensuite [`file-skill-pack-registry-repository.ts`]
- [ ] [Review][Patch] `readMissionEvents` exporté propage `EventLogReadError` brut vers `readTicketBoard` (pas de classification) [`mission-reconstruction.ts`/`read-ticket-board.ts`]
- [ ] [Review][Patch] Mission corrompu + journal vide → "Mission introuvable" au lieu de `schema_invalide` [`read-mission-resume.ts`]
- [ ] [Review][Patch] `readApprovalQueue` relit le journal deux fois (drift possible entre appels) [`packages/mission-kernel/src/resume-service/read-approval-queue.ts`]
- [ ] [Review][Patch] `projectionsError=ENOENT` remappé en "Workspace non initialisé" alors que journal présent [`read-approval-queue.ts`]
- [ ] [Review][Patch] `normalizeTicketBoardReadError` perd `.cause` sur TypeError non-classé [`read-ticket-board.ts`]
- [ ] [Review][Patch] `PersistedDocumentValidator<T>` et `assertValidPersistedDocument<T>`: typage non-sound (T non vérifié) — permet d'asserter le mauvais type sans erreur compilation [`packages/storage/src/repositories/persisted-document-errors.ts`]
- [ ] [Review][Patch] `validateExecutionHandle` message "champ manquant" vs "type incorrect" incohérent avec les autres validators [`persisted-document-guards.ts`]
- [ ] [Review][Patch] Guards utilisent `in record` — accepte propriétés héritées (`Object.create({id:"x"})`) → pollution prototype possible [`persisted-document-guards.ts`]
- [ ] [Review][Patch] `InvalidPersistedDocumentError` ne porte pas `cause` (asymétrique avec `Corrupted` et `FileSystem`) [`persisted-document-errors.ts`]
- [ ] [Review][Patch] `JSON.parse` dans `file-event-log.ts` ne catche que `SyntaxError` — une `TypeError` (realm exotique) fuit brute [`file-event-log.ts`]
- [ ] [Review][Patch] Stream error async post-itération non propagé en `EventLogReadError` [`file-event-log.ts`]
- [ ] [Review][Patch] `normalizeEventLogReadError` `new Error(String(error))` perd stack + cause [`packages/journal/src/event-log/event-log-errors.ts`]
- [ ] [Review][Patch] `isEventLogFileSystemError` duplique `isFileSystemReadError` — simplifier [`event-log-errors.ts`]
- [ ] [Review][Patch] `FILE_SYSTEM_READ_ERROR_CODES` manque `EBUSY` et `ETIMEDOUT` (fréquents sous Windows) [`packages/storage/src/fs-layout/file-system-read-errors.ts`]
- [ ] [Review][Patch] Commentaire `Story 5.1.1 AC4` dans code 5.2 — drift doc [`file-mission-repository.ts`]
- [ ] [Review][Patch] `readStoredResumeView` avale `SyntaxError` silencieusement → null sans diagnostic [`read-mission-resume.ts`]

#### Reportés (8)

- [x] [Review][Defer] Duplication `isClassifiedReadError` ×3 readers — deferred, scope 5.3 (factorisation helpers)
- [x] [Review][Defer] Duplication pattern `journalError/projectionsError/missionsError` ×5 readers — deferred, scope 5.3
- [x] [Review][Defer] `ensureTicketBoardWorkspaceInitialized` duplication inline — deferred, scope 5.3
- [x] [Review][Defer] `shouldReconstruct` re-parcourt journal O(n) inutile — deferred, perf pré-existant non bloquant
- [x] [Review][Defer] `waitForConcurrentSkillPackWrite` ne détecte pas writer mort (polling 500ms) — deferred, design pré-existant 4.x
- [x] [Review][Defer] `MISSION_AUTHORITATIVE_EVENT_TYPES` évolution future non surveillée — deferred, policy à définir
- [x] [Review][Defer] `pickLatestTimestamp` `localeCompare` non déterministe — deferred, scope 5.5 (projections déterministes)
- [x] [Review][Defer] `ticketsById` ordre d'insertion non déterministe — deferred, scope 5.5

## Dev Notes

### Story Intent

Ne pas changer le schema persistant ni la surface fonctionnelle de la CLI. Cette story durcit les frontieres de lecture: parse JSON en `unknown`, validation runtime, classification des erreurs, puis exposition au domaine. Un reader peut reconstruire depuis le journal, mais seulement si le journal est sain et lisible.

### Guardrails de scope

- Ne pas introduire `zod`, `ajv` ou une nouvelle dependance de validation: le monorepo n'a aujourd'hui que TypeScript et `@types/node`.
- Ne pas faire le refactor global de la Story 5.3 (`audit-log-projection.ts` vs `read-mission-audit.ts`, helpers workspace generaux, normalisation opaque references), sauf reutilisation directe des guards crees ici.
- Ne pas traiter la compatibilite Windows des identifiants reserves (`CON`, `NUL`, `:` etc.): Story 5.4.
- Ne pas modifier les tris/filtering/audit semantics (`localeCompare`, `--ticket-id`, `limit <= 0`): Story 5.5.
- Ne pas modifier le format de brief adaptateur ou les fuites de chemins/vendor: Story 5.6.
- Ne pas reverter les changements non committes issus de 5.1.1/5.1.2; ils sont le contexte vivant de cette story.

### Current Code Hotspots

- `packages/storage/src/repositories/file-mission-repository.ts:84`: `hydrateMission(JSON.parse(storedMission) as Mission)` sans validation runtime.
- `packages/storage/src/repositories/file-ticket-repository.ts:45` et `:108`: casts `as Ticket` / `as Mission` apres parse.
- `packages/storage/src/repositories/file-execution-attempt-repository.ts:56`: cast `as ExecutionAttempt`.
- `packages/storage/src/repositories/file-artifact-repository.ts:101`: cast `as Artifact`.
- `packages/storage/src/repositories/file-capability-registry-repository.ts:93`: cast `as RegisteredCapability`; `SyntaxError` deja mappe mais schema valide non verifie.
- `packages/storage/src/repositories/file-skill-pack-registry-repository.ts:103`: cast `as RegisteredSkillPack`; `list()` ignore toutes les erreurs aux lignes 129-134.
- `packages/journal/src/event-log/file-event-log.ts:19-40`: `readEventLog` lit tout le fichier, parse ligne par ligne apres split, mais ne classe pas `ENOENT/EACCES/EIO`.
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts:44` et `:86-94`: codes FS incomplets et fallback generique.
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts:181-190`: bare catch d'initialisation workspace.
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts:114-119`: catch global qui masque les causes.
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts:67-75`: catch global autour de la lecture journal.
- `packages/ticket-runtime/src/planner/read-ticket-board.ts:41` et `:183-193`: codes FS incomplets et `access()` bare catch.

### Architecture Constraints

- Le journal est source de verite; les snapshots sont best-effort. Toute nouvelle logique de lecture doit respecter `docs/architecture/journal-as-source-of-truth.md`.
- Les readers critiques (`readMissionResume`, `readApprovalQueue`, `readMissionArtifacts`, `readTicketBoard`) doivent garder leur fallback de reconstruction depuis journal quand le snapshot est absent ou obsolete.
- La CLI ne lit pas les fichiers `.corp/` directement; les diagnostics doivent etre produits dans les services/repositories puis surfaces par les commandes existantes.
- Les details vendor restent hors des contrats coeur; ne pas ajouter de champ OpenAI/Codex aux snapshots pour diagnostiquer une erreur.

### Previous Story Intelligence

- 5.1.1 a documente JSoT et ajoute les tests crash-recovery. Ne pas casser les chemins `readMissionSnapshotFromJournalOrThrow`, `reconstructMissionFromJournal`, `readMissionEvents`.
- 5.1.2 a centralise `isAlreadyExistsError`, ajoute `ensure-mission-workspace.ts`, filtre les events autoritaires, et porte la baseline a 309 tests verts. Reutiliser ces helpers au lieu de les dupliquer.
- Les fichiers `dist/` sont generes par `npm run build`; modifier les sources TS et laisser le build regenerer `dist/` si le workflow local le demande.

### Testing Requirements

- Lancer au minimum `npm run build` puis `npm test`.
- Les tests d'erreurs OS doivent etre portables Windows/POSIX: privilegier helper pur ou injection de dependance plutot que `chmod 000` comme unique preuve.
- Pour chaque nouvelle erreur domaine, tester a la fois le type/classement (`code`) et le message operateur.
- Les tests CLI/contract ne doivent pas dependre de l'ordre exact des stack traces; verifier l'absence de `SyntaxError`, `EACCES:` brut ou stack Node dans la sortie.

### References

- `_bmad-output/planning/epics.md` - Epic 5, Story 5.2: lecture defensive et schema cross-repositories.
- `_bmad-output/planning/prd.md` - NFR16 Lecture defensive; NFR15 Coherence post-crash; FR19-FR23 Reprise & audit.
- `_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 5.2 Architectural Boundaries.
- `docs/architecture/journal-as-source-of-truth.md` - invariant JSoT et readers critiques.
- `_bmad-output/implementation/deferred-work.md` - D-06, D-08, D-18, D-34, D-38, D-44, D-48, D-60, D-61, D-63.
- `_bmad-output/implementation/5-1-1-durcir-atomicite-findings-review-5-1-critiques.md` - decisions JSoT et tests crash-recovery.
- `_bmad-output/implementation/5-1-2-cleanup-atomicite-findings-review-5-1-medium-low.md` - helpers recents et baseline 309 tests.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-04-15: `npm run build` - PASS.
- 2026-04-15: `node --test dist/tests/unit/persisted-document-guards.test.js dist/tests/unit/persisted-document-repositories.test.js dist/tests/unit/event-log-defensive-read.test.js dist/tests/contract/defensive-read-cli.test.js` - PASS.
- 2026-04-15: `node --test dist/tests/integration/mission-resume.test.js dist/tests/integration/ticket-board.test.js dist/tests/unit/file-ticket-repository.test.js dist/tests/unit/skill-pack-registration.test.js dist/tests/unit/exclusive-file-creation.test.js` - PASS.
- 2026-04-15: `npm test` - PASS, 326 tests.

### Completion Notes List

- Ajout d'une taxonomie runtime pour les lectures persistantes: `json_corrompu`, `schema_invalide`, `journal_manquant`, `journal_invalide`, `erreur_fichier`, avec chemin, identifiant documentaire, cause et code OS lorsque disponible.
- Ajout de guards canoniques sans nouvelle dependance pour `Mission`, `Ticket`, `ExecutionAttempt`, `Artifact`, `RegisteredCapability`, `RegisteredSkillPack` et export du guard `isJournalEventRecord`.
- Branchement des repositories de snapshots sur parse JSON en `unknown` + validation runtime; les listes repositories ne retournent plus de listes partielles silencieuses sur entree invalide.
- `readEventLog` parse maintenant ligne-a-ligne, classe les erreurs journal, et `ensureAppendOnlyEventLog` valide les journaux existants en tronquant uniquement une derniere ligne incomplete.
- Les readers mission-centriques preservent les erreurs classees et continuent a reconstruire depuis le journal quand un snapshot est absent/corrompu/invalide mais que le journal reste exploitable.
- Deferred work mis a jour pour D-06, D-08, D-18, D-34, D-38, D-44, D-60, D-61 et D-63. D-48 reste ouvert car non traite ni teste dans ce lot.

### File List

- `_bmad-output/implementation/5-2-durcir-la-lecture-defensive-et-la-validation-de-schema.md`
- `_bmad-output/implementation/deferred-work.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `packages/contracts/src/guards/persisted-document-guards.ts`
- `packages/journal/src/event-log/event-log-errors.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/reconstruction/mission-reconstruction.ts`
- `packages/storage/src/fs-layout/file-system-read-errors.ts`
- `packages/storage/src/repositories/persisted-document-errors.ts`
- `packages/storage/src/repositories/file-artifact-repository.ts`
- `packages/storage/src/repositories/file-capability-registry-repository.ts`
- `packages/storage/src/repositories/file-execution-attempt-repository.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/storage/src/repositories/file-skill-pack-registry-repository.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `tests/contract/defensive-read-cli.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/ticket-board.test.ts`
- `tests/unit/event-log-defensive-read.test.ts`
- `tests/unit/persisted-document-guards.test.ts`
- `tests/unit/persisted-document-repositories.test.ts`
- `dist/packages/contracts/src/guards/persisted-document-guards.js`
- `dist/packages/journal/src/event-log/event-log-errors.js`
- `dist/packages/journal/src/event-log/file-event-log.js`
- `dist/packages/journal/src/reconstruction/mission-reconstruction.js`
- `dist/packages/storage/src/fs-layout/file-system-read-errors.js`
- `dist/packages/storage/src/repositories/persisted-document-errors.js`
- `dist/packages/storage/src/repositories/file-artifact-repository.js`
- `dist/packages/storage/src/repositories/file-capability-registry-repository.js`
- `dist/packages/storage/src/repositories/file-execution-attempt-repository.js`
- `dist/packages/storage/src/repositories/file-mission-repository.js`
- `dist/packages/storage/src/repositories/file-skill-pack-registry-repository.js`
- `dist/packages/storage/src/repositories/file-ticket-repository.js`
- `dist/packages/mission-kernel/src/resume-service/read-approval-queue.js`
- `dist/packages/mission-kernel/src/resume-service/read-mission-artifacts.js`
- `dist/packages/mission-kernel/src/resume-service/read-mission-audit.js`
- `dist/packages/mission-kernel/src/resume-service/read-mission-resume.js`
- `dist/packages/ticket-runtime/src/planner/read-ticket-board.js`
- `dist/tests/contract/defensive-read-cli.test.js`
- `dist/tests/integration/mission-resume.test.js`
- `dist/tests/integration/ticket-board.test.js`
- `dist/tests/unit/event-log-defensive-read.test.js`
- `dist/tests/unit/persisted-document-guards.test.js`
- `dist/tests/unit/persisted-document-repositories.test.js`

## Change Log

- 2026-04-15: Story 5.2 recontextualisee depuis la pre-redaction. Ajout des cibles code exactes, de la taxonomie d'erreurs defensive-read, de l'invariant JSoT post-5.1.1/5.1.2, et des limites de scope avec 5.3-5.7.
- 2026-04-15: Implementation terminee. Ajout taxonomie d'erreurs, guards runtime, parse JSON defensif cross-repositories, durcissement `readEventLog`/`ensureAppendOnlyEventLog`, preservation des causes classees dans les readers mission-centriques, tests unitaires/integration/contract, et mise a jour de la dette absorbee.
