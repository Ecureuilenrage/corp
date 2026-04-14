# Story 5.2: Durcir la lecture defensive et la validation de schema cross-repositories

Status: ready-for-dev

## Story

As a mainteneur de `corp`,
I want que chaque repository valide le schema d'un document persiste avant de l'exposer au domaine et distingue les erreurs OS des erreurs logiques,
so that un fichier corrompu ou un filesystem en erreur produise un message deterministe au lieu d'un objet partiel ou d'un crash runtime.

## Context

Les code reviews Epic 1, 3 et 4 signalent plusieurs points de lecture non defensive qui peuvent produire silencieusement un objet partiel (`findById` cast `as Mission` sans validation) ou confondre des erreurs distinctes (ENOENT, EACCES, EIO, SyntaxError) dans un unique bloc catch generique rapportant "workspace non initialise" ou "irreconciliable". Ces patterns existent dans les repositories de mission, capability et skill-pack, dans `readEventLog`, `readApprovalQueue` et `read-mission-audit`.

## Acceptance Criteria

1. Given un fichier `mission.json`, `ticket.json`, `registered-capability.json` ou `registered-skill-pack.json` est corrompu, incomplet, ou suit un schema anterieur incompatible
   When son repository le lit via `findById` ou equivalent
   Then un garde runtime (`isMission`, `isRegisteredCapability`, `isRegisteredSkillPack`) rejette le document
   And l'erreur produit un message deterministe identifiant le fichier et la raison (champ manquant, type incorrect)

2. Given `events.jsonl` est absent apres bootstrap (supprime manuellement)
   When une commande de lecture du journal (`mission status`, `mission audit`, `ticket board`) est invoquee
   Then `readEventLog` produit un message distinct pour `ENOENT` ("journal manquant, relancer bootstrap")
   And la commande ne crashe plus avec une erreur OS brute

3. Given `events.jsonl` ou un fichier de projection est inaccessible (`EACCES`) ou en erreur IO (`EIO`, `EMFILE`)
   When la commande est invoquee
   Then le code distingue ces erreurs et produit un message specifique (ex. "permissions insuffisantes sur le journal", "erreur IO sur la projection")
   And aucun `EACCES` n'est reporte comme "irreconciliable" ou "ref manquante" sans cause reelle

4. Given `read-mission-audit.ts` ou `readApprovalQueue` contenait un bare catch avalant toute erreur
   When la story est terminee
   Then les blocs catch distinguent explicitement les codes `FILE_SYSTEM_ERROR_CODES` etendu (`ENOENT`, `EACCES`, `EIO`, `EMFILE`, `EPERM`, `ENOSPC`)
   And une erreur inconnue est propagee au lieu d'etre ecrasee par un message generique

5. Given un fichier JSON corrompu syntaxiquement est lu par `findByPackRef` ou `findByCapabilityId`
   When le parser rencontre `SyntaxError`
   Then une erreur domaine explicite est levee ("fichier de registre corrompu pour X") et le processus ne crashe plus avec un stack trace runtime brut

## Tasks / Subtasks

- [ ] Definir les validateurs runtime partages (AC: 1)
  - [ ] Extraire ou confirmer `isMission`, `isTicket`, `isExecutionAttempt`, `isApprovalRequest`, `isArtifact`, `isRegisteredCapability`, `isRegisteredSkillPack` dans `packages/contracts/` (partage avec Story 5.3).
  - [ ] Chaque validateur verifie au minimum: champs obligatoires presents, types scalaires corrects, discriminants unions valides.
  - [ ] Ecrire des tests unitaires par validateur couvrant un cas valide, un champ manquant, un champ de mauvais type.

- [ ] Consommer les validateurs dans les repositories (AC: 1)
  - [ ] `FileMissionRepository.findById` invoque `isMission` apres `JSON.parse`.
  - [ ] `FileTicketRepository.findById` invoque `isTicket`.
  - [ ] `FileCapabilityRegistryRepository.findByCapabilityId` invoque `isRegisteredCapability`.
  - [ ] `FileSkillPackRegistryRepository.findByPackRef` invoque `isRegisteredSkillPack`.
  - [ ] En cas d'echec de validation, throw `InvalidPersistedDocumentError` avec chemin du fichier et raison.

- [ ] Etendre `FILE_SYSTEM_ERROR_CODES` et distinguer les erreurs filesystem (AC: 2, 3, 4)
  - [ ] Ajouter `EACCES`, `EIO`, `EMFILE`, `EPERM`, `ENOSPC` a la liste.
  - [ ] Dans `readEventLog`, distinguer `ENOENT` (journal absent), `EACCES` (permissions), autres (propager).
  - [ ] Dans `readApprovalQueue`, idem.
  - [ ] Dans `read-mission-audit.ts` et `ensureMissionAuditWorkspaceInitialized`, supprimer le bare catch et appliquer le meme pattern que dans `ensureCapabilityWorkspaceInitialized` (corrige en 4.5).

- [ ] Capturer `SyntaxError` au parse JSON (AC: 5)
  - [ ] Dans les 4 repositories ci-dessus, entourer `JSON.parse` d'un catch specifique `SyntaxError` qui throw `CorruptedPersistedDocumentError`.
  - [ ] Le message doit citer le fichier et suggerer la commande de recovery (ex. `corp mission bootstrap --root <path>` ou restauration manuelle).

- [ ] Ajouter les tests d'erreur defensive (AC: 1, 2, 3, 4, 5)
  - [ ] Test: supprimer `events.jsonl` apres bootstrap, invoquer `mission status`, verifier message `ENOENT` distinct.
  - [ ] Test: rendre `audit-log.json` lecture seule (chmod 000 sur POSIX equivalent), verifier message `EACCES` distinct.
  - [ ] Test: injecter `{` dans `mission.json`, verifier message `CorruptedPersistedDocumentError`.
  - [ ] Test: injecter un `mission.json` sans champ `missionId`, verifier message `InvalidPersistedDocumentError`.
  - [ ] Test: injecter un `registered-capability.json` sans `provider`, verifier que `findByCapabilityId` echoue proprement.

## Dev Notes

### Story Intent

Cette story ne change pas le contrat persistant ni la surface CLI. Elle durcit le passage du disque au domaine pour que tout document invalide ou toute erreur OS produise un message actionnable plutot qu'un crash ou une lecture silencieuse d'un objet partiel.

### Dependance avec 5.3

La factorisation des type guards est pilotee par la Story 5.3. Cette story 5.2 consomme les guards partages; l'ordre recommande est 5.3 avant 5.2 ou parallele avec merge coordine.

### Items deferred-work.md absorbes

D-06, D-08, D-18, D-34, D-38, D-44, D-48.

### NFR cible

NFR16 (Lecture defensive): 100% des lectures de documents persistes invalides, absents ou inaccessibles dans les repositories cibles doivent echouer avec une erreur deterministe classee par type (`schema_invalide`, `json_corrompu`, `ENOENT`, `EACCES`, `EIO` ou equivalent), verification faite par tests repository et CLI.

### Testing Requirements

- Test unitaire de chaque validateur (cas valide + cas invalides).
- Test d'integration pour chaque repository (JSON corrompu, schema invalide, fichier manquant).
- Test d'erreur pour `readEventLog` et `readApprovalQueue` sur ENOENT, EACCES.
