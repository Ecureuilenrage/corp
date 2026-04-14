# Story 5.1: Rendre atomiques les ecritures du journal, des projections et des registres

Status: ready-for-dev

## Story

As a mainteneur de `corp`,
I want que toute sequence `appendEvent -> save -> rewriteMissionReadModels` survive a un crash sans laisser journal et read-models divergents,
so that le journal append-only reste la source de verite et les projections restent reconstruibles sans intervention manuelle.

## Context

Les code reviews Epic 1, 3 et 4 ont signale a trois reprises le meme pattern de non-atomicite entre l'append au journal, le save du snapshot (`mission.json`, `ticket.json`) et la reconstruction des projections (`resume-view.json`, `audit-log.json`, `approval-queue.json`, etc.). La retrospective Epic 4 confirme que cette dette est "en 3eme occurrence sans traitement structurel" et "deviendra bloquante si une phase GA apparait".

Cette story traite le lot atomicite identifie dans la proposition d'Epic 5:

- Non-atomicite entre journal-fichier et read-model apres un crash (D-01).
- TOCTOU des helpers de creation de fichiers (D-05).
- Non-atomicite de `resolve-approval-request` avec 3 saves successifs (D-07).
- Ecritures `writeProjectionSnapshot` non atomiques sur Windows (D-17, D-29).
- `appendFile` concurrent sur `events.jsonl` specifique Windows NTFS (D-35).
- Divergence journal/read-model dans le catch block de `run-ticket.ts` apres un echec adaptateur (D-36).
- TOCTOU dans `save()` du registre skill-pack entre `findByPackRef` et `mkdir` (D-43).
- TOCTOU dans `selectMissionExtensions` entre deux processus concurrents (D-49).
- TOCTOU dans `run-ticket.ts` entre les deux `ensureTicketExtensionsAllowedByMission` (D-50).

## Acceptance Criteria

1. Given un crash simule survient entre `appendEvent` et `repository.save` dans `create-mission`, `update-mission-lifecycle`, `run-ticket` ou `resolve-approval-request`
   When la commande est relancee
   Then soit le journal et les projections restent coherents par re-execution deterministe, soit `readMissionResume` reconstruit l'etat a partir du journal sans exiger de snapshot
   And aucun read-model ne reste en divergence silencieuse apres redemarrage

2. Given un crash simule survient entre `repository.save` et `rewriteMissionReadModels`
   When la commande est relancee
   Then `rewriteMissionReadModels` est idempotent et produit les memes projections qu'une execution complete en un seul pass
   And un test d'integration couvre ce scenario pour Mission, Ticket et ApprovalRequest

3. Given deux processus CLI concurrents ecrivent `audit-log.json`, `resume-view.json`, `approval-queue.json`, `artifact-index.json` ou un snapshot de registre capability/skill-pack
   When les ecritures sont interleaves sur Windows NTFS ou POSIX
   Then les fichiers de projection utilisent un pattern temp-file + rename atomique (`*.tmp` -> `rename`)
   And aucun JSON tronque ne peut etre observe par un lecteur concurrent, meme en cas d'echec `rename`

4. Given un helper de creation de fichier est invoque (`ensureAppendOnlyEventLog`, `writeFileIfMissing`)
   When un second processus tente la meme creation simultanement
   Then le helper utilise un flag exclusif (`wx` ou equivalent) pour fermer la fenetre TOCTOU
   And les cas `EEXIST` sont traites comme resultat benin

5. Given `run-ticket.ts` echoue dans l'adaptateur apres avoir emis des events d'artefacts
   When le bloc catch persiste l'echec
   Then `persistRunTransition` est appele avec les `eventIds`/`artifactIds` a jour avant le re-throw
   And `mission.json` / `ticket.json` ne restent pas desynchronises avec le journal apres un echec adaptateur

6. Given deux appels `extension select` concurrents sur la meme mission, ou deux `registerSkillPack` concurrents sur le meme `packRef`, ou deux `ensureTicketExtensionsAllowedByMission` entre-temps mute
   When la fenetre TOCTOU est declenchee
   Then le comportement est soit un merge serialise deterministe, soit un echec explicite "conflit d'ecriture concurrente" pour le perdant, jamais un dernier-writer-gagne silencieux

## Tasks / Subtasks

- [ ] Factoriser un helper `writeJsonAtomic(path, value)` (AC: 3)
  - [ ] Ecrire dans `${path}.tmp` puis `rename` vers `path` (atomique sur NTFS et POSIX).
  - [ ] En cas d'echec `rename`, supprimer le fichier temporaire et remonter l'erreur d'origine.
  - [ ] Consommer ce helper dans `file-projection-store.ts`, `writeProjectionSnapshot`, le registre capability (`file-capability-registry-repository.ts`), le registre skill-pack et les repositories mission/ticket/approval.
  - [ ] Un test unitaire verifie qu'un `rename` echoue laisse le fichier cible intact.

- [ ] Remplacer `access()` + `writeFile` par flag `wx` dans les helpers de creation exclusive (AC: 4)
  - [ ] `ensureAppendOnlyEventLog`, `writeFileIfMissing`, `ensureMissionWorkspaceInitialized`, `ensureCapabilityWorkspaceInitialized`, `ensureSkillPackWorkspaceInitialized`.
  - [ ] Traiter `EEXIST` comme succes sans avertissement.

- [ ] Rendre `rewriteMissionReadModels` idempotent et appele systematiquement apres persist (AC: 1, 2)
  - [ ] Auditer les 4 services applicatifs concernes (`create-mission`, `update-mission-lifecycle`, `run-ticket`, `resolve-approval-request`) pour garantir l'ordre `append -> save -> rewrite`.
  - [ ] Dans `resolve-approval-request.ts`, regrouper les 3 saves successifs en un seul `persistApprovalTransition` qui ecrit dans un ordre stable et declenche `rewriteMissionReadModels` une fois a la fin.
  - [ ] Ajouter un test de crash-recovery: supprimer les read-models apres save, relancer la commande de lecture, verifier que la reconstruction est fidele.

- [ ] Durcir le catch block de `run-ticket.ts` (AC: 5)
  - [ ] Avant re-throw, appeler `persistRunTransition` avec les `eventIds`/`artifactIds` deja collectes.
  - [ ] Garantir que le journal contient `ticket.attempt.failed` avant que mission.json/ticket.json refletent l'echec.
  - [ ] Test d'integration: simuler une exception adaptateur apres emission d'un artefact, verifier que l'artefact est persiste ET que mission.json pointe bien vers l'eventId.

- [ ] Traiter les TOCTOU concurrents sur `extension select`, `skill-pack register` et `run-ticket` (AC: 6)
  - [ ] `selectMissionExtensions`: detecter un changement de version de mission entre la lecture et l'ecriture (ex. `mission.revision` ou hash du snapshot); en cas de conflit, echec explicite ou retry.
  - [ ] `FileSkillPackRegistryRepository.save()`: utiliser `mkdir` avec `recursive: false` et traiter `EEXIST` comme "unchanged" si le contenu est egal, "concurrent" sinon.
  - [ ] `run-ticket.ts`: relire le ticket juste avant `adapter.launch` pour fermer la fenetre entre les deux `ensureTicketExtensionsAllowedByMission`.

- [ ] Ajouter les tests crash-recovery et concurrency (AC: 1, 2, 3, 5, 6)
  - [ ] Crash-recovery: injecter un `process.exit(1)` simule apres `appendEvent` et verifier que la re-execution est deterministe.
  - [ ] Concurrency `writeFile`: lancer 10 saves concurrents et verifier absence de JSON tronque.
  - [ ] Concurrency `extension select`: lancer 2 appels paralleles et verifier que le comportement respecte AC6.

## Dev Notes

### Story Intent

Cette story durcit la couche d'ecriture sans modifier le contrat coeur Mission/Ticket ni les surfaces CLI existantes. L'objectif est que toute sequence de mutation reste coherente ou reconstructible sous crash ou concurrence. Les TOCTOU qui etaient acceptes "V1 mono-operateur" deviennent ici l'objet du traitement car Epic 5 vise la GA.

### Items deferred-work.md absorbes

D-01, D-05, D-07, D-17, D-29, D-35, D-36, D-43, D-49, D-50.

### NFR cible

NFR15 (Coherence post-crash): 100% des tests de crash/recovery appliques aux flux mutateurs critiques doivent soit retrouver un etat de mission coherent au redemarrage, soit declencher une reconstruction deterministe depuis le journal, sans divergence silencieuse observable par l'operateur.

### Testing Requirements

- Test unitaire de `writeJsonAtomic` (rename reussi / echec / fichier temp nettoye).
- Test d'integration crash-recovery pour les 4 services applicatifs.
- Test de concurrence pour les projections et les registres (10 saves paralleles).
- Baseline 246 tests verts preservee comme gate de regression.
