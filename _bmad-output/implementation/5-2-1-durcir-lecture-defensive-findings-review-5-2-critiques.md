# Story 5.2.1: Durcir les chemins critiques de lecture defensive (findings review 5-2, severite high)

Status: ready-for-dev

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

## Acceptance Criteria

1. Given un snapshot mission sur disque et un snapshot reconstruit depuis le journal sont semantiquement identiques mais diff rent sur la materialisation `authorizedExtensions: undefined` vs cle absente, ou contiennent des valeurs `Date`/`BigInt`/`Map`/`Set` identiques
   When `saveIfUnchanged` calcule `areMissionSnapshotsEqual`
   Then la comparaison retourne `true`
   And aucun faux `"Conflit d'ecriture concurrente"` n'est leve

2. Given un fichier `mission.json.lock` existe sur disque alors qu'aucun writer n'est actif (crash precedent)
   When un writer appelle `saveIfUnchanged`
   Then le bootstrap ou le writer detecte le lock orphelin via un check `stat.mtime` ou marqueur `{pid, hostname, timestamp}` et le supprime si clairement stale
   And le comportement est documente dans `docs/architecture/journal-as-source-of-truth.md` avec un runbook de deblocage manuel en cas de doute
   Note: la resolution TTL complete (PID monitoring cross-platform) reste ouverte en D-64 et est hors scope 5.2.1.

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
   Then le champ est tolere (warning structurellement exploitable) plutot que de rejeter en `schema_invalide`
   And le document reste utilisable par les readers existants; le reconstruction depuis journal n'echoue pas
   And la story documente explicitement la politique "forward-compat tolerante"

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
    Then le retour expose un resultat structure `{ valid: RegisteredSkillPack[]; invalid: SkillPackListDiagnostic[] }` OU conserve le throw actuel mais en documentant explicitement l'intention dans le code
    And la CLI peut surfacer les diagnostics sans masquer les packs sains
    (Decision prise dans la story: option A = resultat structure pour preserver la visibilite multi-pack.)

13. Given la story est terminee
    When la suite de tests est lancee
    Then les tests couvrent chaque critere AC1 a AC12 (unitaires + integration ou contract)
    And la baseline post-5.2 (`npm test`, 326 tests verts) reste verte avec les nouveaux tests
    And au minimum un test couvre: canonicalisation `undefined`, `selectFreshMissionSnapshot` timestamp tie-break, corruption + journal vide = cause preservee, allow-list `TICKET_AUTHORITATIVE_EVENT_TYPES`, tolerance status futur, liste skill-pack avec entree corrompue.

## Tasks / Subtasks

- [ ] AC1: Canonicalisation snapshot mission
  - [ ] Reecrire `canonicalize` dans `packages/storage/src/repositories/file-mission-repository.ts` en utilisant un replacer explicite: `undefined` -> cle supprimee, tri recursif des cles, Date -> ISO, BigInt -> string, Map/Set rejetes (non attendus).
  - [ ] Tests `tests/unit/file-mission-repository.test.ts`: equivalence `{a:undefined}` vs `{}`, deux missions identiques avec ordre de cles different, snapshot hydrate vs reconstruit.

- [ ] AC2: Lockfile orphelin (patch minimal + doc)
  - [ ] Au bootstrap mission (`ensure-mission-workspace.ts`), detecter un `mission.json.lock` dont `mtime` est anterieur a un seuil (configurable, default 5 min) et le supprimer avec log explicite.
  - [ ] Ajouter une section "Deblocage manuel d'un lock stale" dans `docs/architecture/journal-as-source-of-truth.md`.
  - [ ] Laisser D-64 ouvert pour la detection TTL/PID complete post-GA.

- [ ] AC3: `selectFreshMissionSnapshot` ordre temporel
  - [ ] Dans `packages/ticket-runtime/src/planner/read-ticket-board.ts`, remplacer la comparaison `resumeCursor !== lastEventId` par une selection basee sur le dernier event autoritaire (timestamp monotone; eventId en tie-break).
  - [ ] Test `tests/unit/select-fresh-mission-snapshot.test.ts` (ou equivalent): journal se terminant par un event non-autoritaire ne doit pas preferer un `missionFromJournal` plus ancien.

- [ ] AC4: Compat `authorizedExtensions: null`
  - [ ] `validateMission` (`persisted-document-guards.ts`) accepte `null` comme equivalent d'absent; rejet uniquement si type different (string, number, tableau non-string, etc.).
  - [ ] `hydrateMission` normalise `null` -> `undefined`.
  - [ ] Test guard: `{ authorizedExtensions: null }` -> valide; `{ authorizedExtensions: 42 }` -> invalide.

- [ ] AC5: Tolerance status/ARTIFACT_KIND futurs
  - [ ] Dans `persisted-document-guards.ts`, isoler les unions "ouvertes" (status mission, status ticket, ARTIFACT_KINDS) derriere un mode `strict=false` documente.
  - [ ] En mode non-strict (default pour lectures snapshot), un discriminant inconnu n'est pas `schema_invalide`; un warning structurel est expose (champ documente sur le type d'erreur) mais la lecture continue.
  - [ ] En mode strict (writes), rejet conserve.
  - [ ] Tests: mission persistee avec `status: "archived_v2"` hypothetique est lue sans throw.
  - [ ] Note dans Dev Notes: "politique forward-compat" -- documente aussi dans `docs/architecture/journal-as-source-of-truth.md`.

- [ ] AC6: Corruption mission + journal vide -> cause preservee
  - [ ] Dans `packages/mission-kernel/src/resume-service/read-mission-resume.ts`, modifier la branche `!baseMission && missionEvents.length === 0`: si une `CorruptedPersistedDocumentError`/`InvalidPersistedDocumentError` a ete capturee lors de `readStoredMissionSnapshot`, la propager au lieu de lever "Mission introuvable".
  - [ ] Test integration: mission.json corrompu + events.jsonl vide -> message cite `json_corrompu` et chemin, pas "Mission introuvable".

- [ ] AC7: `findById` corrompu sous lock
  - [ ] Dans `file-mission-repository.ts`, `saveIfUnchanged`: toute erreur primaire du try (`findById` OU `writeJsonAtomic`) est preservee; le `finally { unlink(lockPath) }` catch et log les erreurs secondaires (`EACCES` sur unlink) sans ecraser la primaire.
  - [ ] Si `findById` remonte `Corrupted/Invalid`, le caller re oit cette classification (non remappee en "Conflit").
  - [ ] Tests: injecter corruption dans `findById` sous lock simule, verifier que la classification traverse et que le lock est libere.

- [ ] AC8: Allow-list de reconstruction
  - [ ] Definir `TICKET_AUTHORITATIVE_EVENT_TYPES` et `ATTEMPT_AUTHORITATIVE_EVENT_TYPES` dans `packages/journal/src/reconstruction/mission-reconstruction.ts`.
  - [ ] `reconstructTicketsFromJournal` itere uniquement les types allow-listes; payload `ticket` dans un type hors liste ignore.
  - [ ] `reconstructAttemptsFromJournal` accepte un parametre `missionId` et filtre les events.
  - [ ] Tests: event `ticket.reprioritized` avec `previousTicket` ne regresse pas l'etat courant; event cross-mission ignore.

- [ ] AC9: `ensureAppendOnlyEventLog` durcissement
  - [ ] Supprimer le throw final inatteignable dans `validateExistingAppendOnlyEventLog` (`packages/journal/src/event-log/file-event-log.ts`).
  - [ ] Classifier les erreurs de `writeFile(..., { flag: "wx" })` autres que `EEXIST`/`ENOENT` via `EventLogReadError.fileSystem`.
  - [ ] Eviter la re-lecture complete apres `truncateJournal`: re-valider uniquement la derniere ligne ou accepter la troncature comme integre.
  - [ ] Tests: simuler `EROFS`/`EISDIR` sur writeFile, verifier classification.

- [ ] AC10: `readMissionEvents` classification end-to-end
  - [ ] Dans `read-ticket-board.ts`, wrapper l'appel a `readMissionEvents` via `isClassifiedReadError`/`isEventLogReadError`.
  - [ ] Test contract: `ticket board` avec journal EACCES renvoie message classe (pas de fuite `EACCES:` brut).

- [ ] AC11: `writeRegisteredSkillPackIfMissing` diagnostic propre
  - [ ] Dans `file-skill-pack-registry-repository.ts`, apres `isAlreadyExistsError`, preserver les erreurs suivantes de `findByPackRef` avec leur classification (non "Dir orpheline non revendiquable").
  - [ ] Test: manifest EEXIST + `findByPackRef` remonte `InvalidPersistedDocumentError` -> erreur classee avec packRef.

- [ ] AC12: `list()` skill-pack resultat structure
  - [ ] Ajouter une API `listAll(): Promise<{ valid: RegisteredSkillPack[]; invalid: SkillPackDiagnostic[] }>` ou equivalent; conserver `list()` legacy (throw) avec deprecation doc.
  - [ ] CLI `corp skill-pack list` surface les diagnostics (si l'exposer cote CLI est hors scope, au moins ne masquer aucun pack sain).
  - [ ] Test: 3 packs dont 1 corrompu -> resultat structure; tests existants `list()` migrer ou preserver via flag.

- [ ] AC13: Suite de tests
  - [ ] Tests integration / contract: mission corrompue + journal vide, `select-fresh` timestamp tiebreak, compat `authorizedExtensions: null`, tolerance status futur, allow-list ticket reconstruction, list() skill-pack structure.
  - [ ] `npm run build && npm test` vert; baseline >= 326 + nouveaux tests.

## Dev Notes

### Story Intent

Appliquer les patches `high` du code review 5-2 en preservant la JSoT et la surface CLI. Ne pas changer le schema persistant. La story durcit les frontieres: canonicalisation, classification d'erreurs, allow-lists de reconstruction.

### Guardrails de scope

- Ne pas refactoriser les helpers workspace communs: Story 5.3.
- Ne pas changer les tris/filtrage deterministes: Story 5.5.
- Ne pas introduire de dependance externe (pas de zod/ajv).
- Ne pas traiter les findings medium/low: Story 5.2.2.

### Findings couverts

Decision-needed: 1, 2 (partiel), 3, 4, 5, 6, 7, 10 (via AC5 tolerance status).
Patches: P1 (ensureAppendOnlyEventLog throw), P2 (EROFS/EISDIR), P3 (readMissionResume cause - delegue en 5.2.2 mais AC6 couvre la propagation), P4 (reconstructTickets allow-list), P5 (reconstructAttempts mission filter), P6 (writeRegisteredSkillPackIfMissing), P7 (readMissionEvents classification), P8 (mission corrompu + journal vide).

### References

- `_bmad-output/implementation/5-2-durcir-la-lecture-defensive-et-la-validation-de-schema.md` - section `Review Findings`.
- `_bmad-output/implementation/deferred-work.md` - D-64 (lock TTL post-GA).
- `docs/architecture/journal-as-source-of-truth.md` - invariants JSoT.

## Change Log

- 2026-04-15: Creation story 5.2.1 depuis le code review de 5-2. Couvre les findings `high` (decisions 1-7 + patches critiques). Report e les patches medium/low vers 5.2.2.
