# Story 5.1.2: Cleanup atomicite (findings MEDIUM/LOW review 5.1)

Status: done

## Story

As a mainteneur de `corp`,
I want que les findings `MEDIUM` et `LOW` residuels de la review adversariale triplee de 5.1 soient traites sans s'etaler sur les correctifs d'architecture de 5.1.1,
so that la couche d'ecriture atomique reste factorisee, sans code mort, sans messages d'erreur fragiles, et avec les helpers TOCTOU uniformement durcis.

## Context

La story 5.1 a livre le durcissement atomicite de l'Epic 5. La review adversariale a retenu 23 findings ; 9 `HIGH` + 4 `decision-needed` + 3 tests manquants sont traites par la story 5.1.1. Les 14 findings restants (9 `MEDIUM` + 5 `LOW`) sont regroupes ici car ils constituent un lot de nettoyage orthogonal aux correctifs d'atomicite critiques : helpers `access()` residuels, polling fragile, factorisation de helpers duplique, message d'erreur regresse, dead code, test retry Windows manquant.

Aucun de ces findings ne remet en cause l'architecture ; ils ameliorent la robustesse, la lisibilite et la couverture. Les findings `defer` listes D-60 a D-63 dans `deferred-work.md` ne sont PAS dans cette story (hors scope ou couverts par story 5.2 lecture defensive).

## Acceptance Criteria

1. Given `ensureMissionWorkspaceInitialized` est defini dans `create-mission.ts` et `update-mission-lifecycle.ts` avec le pattern `access() + writeFile`
   When la story est livree
   Then les deux helpers utilisent le pattern exclusif `writeFile({flag: "wx"})` avec traitement benign de `EEXIST`, aligne sur `ensureAppendOnlyEventLog` et `writeFileIfMissing`
   And un test unitaire couvre deux initialisations concurrentes produisant une seule creation effective

2. Given `waitForConcurrentSkillPackWrite` polle actuellement 5x10ms puis echoue
   When un writer concurrent met plus de 50 ms a terminer, ou si le writer est mort apres avoir cree la dir sans ecrire le fichier
   Then le polling utilise une fenetre bornee plus generate (ex. 500 ms total, backoff exponentiel) et tente de claim la dir orpheline via `writeFile(flag: "wx")` apres expiration
   And l'erreur finale distingue "conflit d'ecriture concurrente legitime" (contenu different apparu) de "dir orpheline non revendiquable"

3. Given `reconstructMissionFromJournal` accepte aujourd'hui tout payload contenant un champ `mission` passant `isMission()`
   When un event non pertinent (ex. payload avec `previousMission`, ou autres formes imbriquees) est rencontre
   Then la reconstruction filtre par types d'event explicitement autoritaires pour l'etat mission (liste: `mission.created`, `mission.updated`, `mission.paused`, `mission.resumed`, `mission.closed`, `approval.*`, et equivalents documentes)
   And un test unitaire confirme qu'un event non autoritaire contenant un `mission` embeddé n'affecte pas la reconstruction

4. Given le catch de `run-ticket` utilise aujourd'hui `mission.ticketIds` issu du snapshot lu avant mutations
   When `missionHasOtherActiveAttempts` est appele depuis le catch
   Then la variable `latestMission` deja chargee (L433) est utilisee a la place, pour que les tickets ajoutes en concurrence soient visibles
   And un test d'integration exerce le scenario (2 runTicket concurrents, un qui echoue) et verifie le statut mission final

5. Given `readMissionResume` contient aujourd'hui un double null-check inatteignable
   When la story est livree
   Then la branche `if (!baseMission) throw ...` posterieure au `if (!storedMission && !missionFromJournal) throw ...` est supprimee
   And la couverture existante continue a passer sans regression

6. Given `extractStoryHeader` retourne aujourd'hui le contenu accumule du frontmatter quand celui-ci n'est pas ferme
   When un fichier story tronque commencant par `---` est rencontre
   Then `extractStoryHeader` retourne une chaine vide (ou leve une erreur explicite `"frontmatter non ferme"`)
   And un test unitaire couvre le cas `---` d'ouverture sans fermeture

7. Given le test `writeJsonAtomic` de rename-fail utilise aujourd'hui une collision de type `EISDIR`
   When la story est livree
   Then un test supplementaire stub `rename` pour lever `EPERM` (ou `EACCES`/`EBUSY`) 2 fois puis reussir, verifiant que le retry transient aboutit et que le fichier cible contient bien le contenu attendu
   And un second test verifie que l'epuisement des retries produit une erreur non-transient et supprime le temporaire

8. Given `reconstructMissionFromJournal` emet aujourd'hui `"Impossible de reconstruire la mission"` au lieu du message original `"Impossible de reconstruire la reprise"` utilise avant le refactor
   When la story est livree
   Then le message d'erreur original est restaure, ou bien les callers (incluant la CLI) adaptent leur surface pour rester iso-fonctionnelles avec la story 5.1
   And un test existant de lecture depuis journal verifie le message d'erreur surface a l'operateur

9. Given `isAlreadyExistsError` est aujourd'hui duplique dans `file-event-log.ts`, `file-projection-store.ts`, `file-mission-repository.ts`
   When la story est livree
   Then l'utilitaire est exporte une seule fois depuis `packages/storage/src/fs-layout/atomic-json.ts` (ou un module utilitaire dedie) et les 3 consommateurs l'importent
   And un grep confirme qu'il n'existe plus qu'une seule definition

10. Given `readMissionSnapshotFromJournalOrThrow` est aujourd'hui duplique dans 4 fichiers read-service (`read-approval-queue.ts`, `read-mission-artifacts.ts`, `read-ticket-board.ts`, `read-mission-resume.ts` utilise `reconstructMissionFromJournal` directement)
   When la story est livree
   Then le helper est exporte une seule fois depuis `packages/journal/src/reconstruction/mission-reconstruction.ts` et les 4 readers l'importent
   And la couverture existante des readers continue a passer

## Tasks / Subtasks

- [x] Durcir `ensureMissionWorkspaceInitialized` avec le flag `wx` (AC: 1)
  - [x] Remplacer `access() + writeFile` par `writeFile({flag: "wx"})` + `EEXIST` benign dans `create-mission.ts` et `update-mission-lifecycle.ts`.
  - [x] Ajouter un test unitaire de creation concurrente.

- [x] Durcir `waitForConcurrentSkillPackWrite` (AC: 2)
  - [x] Remplacer le polling 5x10ms par un schema borne plus robuste (backoff exponentiel, timeout total 500 ms ou plus).
  - [x] A l'expiration, tenter de revendiquer la dir orpheline via `writeFile(flag: "wx")`.
  - [x] Ajuster le contrat d'erreur pour distinguer conflit legitime vs orpheline non revendiquable.
  - [x] Ajouter/ajuster le test `skill-pack-registration` couvrant les deux cas.

- [x] Filtrer `reconstructMissionFromJournal` par event types autoritaires (AC: 3)
  - [x] Maintenir une constante exhaustive des event types qui peuvent porter un `mission` autoritaire dans `mission-reconstruction.ts`.
  - [x] Ajouter un test unitaire avec un event non autoritaire qui contient un champ `mission` dans son payload.

- [x] Corriger la lecture de `ticketIds` dans le catch de `run-ticket` (AC: 4)
  - [x] Remplacer `mission.ticketIds` par `latestMission.ticketIds` (deja en scope via L433).
  - [x] Ajouter un test d'integration avec 2 runTicket concurrents.

- [x] Retirer le double null-check mort dans `readMissionResume` (AC: 5)
  - [x] Supprimer la branche inatteignable et verifier qu'aucune regression n'apparait.

- [x] Durcir `extractStoryHeader` sur frontmatter non ferme (AC: 6)
  - [x] Retourner `""` ou lever une erreur explicite quand le frontmatter s'ouvre sans se fermer.
  - [x] Ajouter un test unitaire.

- [x] Couvrir la branche retry transient de `writeJsonAtomic` (AC: 7)
  - [x] Ajouter un test stubbant `rename` pour lever EPERM deux fois puis reussir.
  - [x] Ajouter un test stubbant `rename` pour epuiser le budget retry et verifier la suppression du tmp + non-retry.

- [x] Restaurer le message d'erreur original de reconstruction (AC: 8)
  - [x] Soit remettre `"Impossible de reconstruire la reprise"` dans `mission-reconstruction.ts`, soit exposer deux messages selon le contexte (resume vs audit-log vs ticket-board).
  - [x] Ajuster le test d'erreur correspondant.

- [x] Factoriser `isAlreadyExistsError` (AC: 9)
  - [x] Exporter depuis `atomic-json.ts` (ou module utilitaire).
  - [x] Remplacer les 3 copies locales par l'import.

- [x] Factoriser `readMissionSnapshotFromJournalOrThrow` (AC: 10)
  - [x] Exporter depuis `mission-reconstruction.ts`.
  - [x] Remplacer les 4 copies locales dans les readers (audit-log, approval-queue, artifacts, ticket-board).

### Review Findings

- [x] [Review][Patch] Le claim de dir orpheline skill-pack peut ecraser un manifeste concurrent au lieu de declarer un conflit [packages/storage/src/repositories/file-skill-pack-registry-repository.ts:181]
- [x] [Review][Patch] Le catch de `runTicket` detecte `latestMission.ticketIds` mais persiste encore une mission basee sur le snapshot obsolete [packages/ticket-runtime/src/ticket-service/run-ticket.ts:516]
- [x] [Review][Patch] `readMissionResume` ne preserve pas le message `"Impossible de reconstruire la reprise"` quand la lecture du journal echoue [packages/mission-kernel/src/resume-service/read-mission-resume.ts:67]
- [x] [Review][Patch] `reconstructMissionFromJournal` ignore `skill_pack.used` alors que cet event porte un snapshot mission post-transition [packages/journal/src/reconstruction/mission-reconstruction.ts:50]

## Dev Notes

### Story Intent

Cette story traite exclusivement les findings MEDIUM et LOW de review 5.1 sans redesign architectural. Elle peut etre executee apres 5.1.1 car les patches sont orthogonaux ; neanmoins, elle ne depend pas formellement de 5.1.1 (les fichiers touches sont majoritairement disjoints, a l'exception de `mission-reconstruction.ts` qui beneficiera du filtre par type en meme temps que le commentaire d'intention ajoute par 5.1.1).

### Decisions appliquees (review 2026-04-15)

N/A : pas de decision-needed dans ce lot, toutes etaient regroupees dans 5.1.1.

### Items `deferred-work.md` acceptes hors scope

D-60 (readEventLog unbounded), D-61 (ensureAppendOnlyEventLog validation de fichier existant), D-62 (renameWithTransientRetry backoff lineaire + DX), D-63 (list() skill-pack avale les corrompues). Tous sont soit des sujets performance/defensive-read traites dans la story 5-2, soit du DX secondaire.

### Testing Requirements

- Test unitaire concurrent `ensureMissionWorkspaceInitialized` (AC1).
- Test `skill-pack-registration` couvrant dir orpheline non revendiquable et orpheline revendiquable (AC2).
- Test unitaire `reconstructMissionFromJournal` avec event non autoritaire portant `mission` embedded (AC3).
- Test integration `run-ticket` avec 2 appels concurrents pour AC4.
- Tests unitaires `extractStoryHeader` frontmatter non ferme (AC6).
- Tests unitaires `writeJsonAtomic` retry transient succes + retry budget epuise (AC7).
- Test surface de message d'erreur `reconstructMissionFromJournal` (AC8).
- Baseline tests verts preservee apres 5.1.1 (>= 285 + additions de 5.1.1).

## Dev Agent Record

### Debug Log

- Suite complete `npm test` a la fin de la story : 307 tests / 0 echec.
- AC4 : deux `latestMission` fetches dans `run-ticket.ts` — le fetch interne a ete promu au scope externe (`let latestMission: Mission | null = null`) pour que le catch lise la version la plus fraiche. Fallback sur `mission.ticketIds` si le fetch lui-meme echoue avant assignation.
- AC10 : le helper `readMissionSnapshotFromJournalOrThrow` existait en 2 copies (pas 4). `read-ticket-board.ts` et `read-mission-resume.ts` utilisent `reconstructMissionFromJournal` directement sans wrapper "Mission introuvable", leur surface reste orthogonale.

### Completion Notes

- **AC9 (factorisation `isAlreadyExistsError`)** : le helper est maintenant exporte depuis `packages/storage/src/fs-layout/atomic-json.ts` et 5 consommateurs importent la meme definition (`file-event-log`, `file-projection-store`, `file-mission-repository`, `file-skill-pack-registry-repository`, `file-capability-registry-repository`). Grep verifie : 1 seule definition residuelle.
- **AC10 (factorisation `readMissionSnapshotFromJournalOrThrow`)** : helper centralise dans `packages/journal/src/reconstruction/mission-reconstruction.ts` et importe par `read-approval-queue.ts` + `read-mission-artifacts.ts`.
- **AC1 (TOCTOU `ensureMissionWorkspaceInitialized`)** : helper partage dans `packages/mission-kernel/src/mission-service/ensure-mission-workspace.ts` ; `create-mission.ts` et `update-mission-lifecycle.ts` s'y attachent avec `skipProjections` parametre. Trois tests unitaires couvrent les 20 appels concurrents, l'erreur friendly et le skip `resume-view`.
- **AC2 (`waitForConcurrentSkillPackWrite`)** : backoff exponentiel 10→20→40→80→160 ms cap, budget total 500 ms. Claim atomique de dir orpheline via creation exclusive du manifeste cible (`writeFile` avec `flag: "wx"`). Erreur distincte pour conflit legitime vs orpheline non revendiquable.
- **AC3 (filtre autoritaire)** : 22 types d'event autorises (cycle de vie mission, ticket, execution, approval, artifact). Guard `MISSION_AUTHORITATIVE_EVENT_TYPES.has(event.type)` applique.
- **AC4 (`ticketIds` dans le catch)** : `latestMission` promu au scope externe dans `run-ticket.ts`. Test d'integration "deux tentatives concurrentes" valide le status propagation.
- **AC5 (null-check mort)** : branche inatteignable `if (!baseMission)` apres `??` supprimee dans `read-mission-resume.ts` ; typage TS toujours narrow via le check restant.
- **AC6 (frontmatter non ferme)** : `extractStoryHeader` retourne `""` quand le frontmatter ouvre sans fermer. Test integration check-epic-closure confirme que `Status: done` encapsule dans un frontmatter tronque n'est plus lu comme autoritaire.
- **AC7 (retry transient `writeJsonAtomic`)** : mocks `t.mock.method(fsPromises, "rename", ...)` via `import = require()` pour acceder au meme cache CJS que `atomic-json.ts`. Deux tests : EPERM x2 puis succes, et EPERM persistant x10 avec nettoyage tmp.
- **AC8 (message d'erreur original)** : `reconstructMissionFromJournal` accepte `{ errorContextNoun: string }` ; resume flow passe `"la reprise"` pour restaurer le wording historique. Test unit dedie.

### File List

- packages/journal/src/event-log/file-event-log.ts
- packages/journal/src/reconstruction/mission-reconstruction.ts
- packages/mission-kernel/src/mission-service/create-mission.ts
- packages/mission-kernel/src/mission-service/ensure-mission-workspace.ts (nouveau)
- packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts
- packages/mission-kernel/src/resume-service/read-approval-queue.ts
- packages/mission-kernel/src/resume-service/read-mission-artifacts.ts
- packages/mission-kernel/src/resume-service/read-mission-resume.ts
- packages/storage/src/fs-layout/atomic-json.ts
- packages/storage/src/projection-store/file-projection-store.ts
- packages/storage/src/repositories/file-capability-registry-repository.ts
- packages/storage/src/repositories/file-mission-repository.ts
- packages/storage/src/repositories/file-skill-pack-registry-repository.ts
- packages/ticket-runtime/src/ticket-service/run-ticket.ts
- scripts/check-epic-closure.ts
- tests/integration/check-epic-closure.test.ts
- tests/integration/run-ticket.test.ts
- tests/unit/ensure-mission-workspace.test.ts (nouveau)
- tests/unit/mission-reconstruction-authoritative-events.test.ts (nouveau)
- tests/unit/skill-pack-registration.test.ts
- tests/unit/write-json-atomic.test.ts

## Change Log

- 2026-04-15: Story 5.1.2 creee a partir des 9 MEDIUM patches + 5 LOW patches de la review 5.1, scope de cleanup orthogonal aux correctifs architecturaux de 5.1.1.
- 2026-04-15: Implementation des 10 ACs livree. Ajout de 3 fichiers (ensure-mission-workspace helper + 2 tests unitaires), modification de 17 fichiers existants. Suite complete npm test : 307 tests / 0 echec.
- 2026-04-15: Review 5.1.2 corrigee. 4 findings patch resolus ; suite complete npm test : 309 tests / 0 echec.
