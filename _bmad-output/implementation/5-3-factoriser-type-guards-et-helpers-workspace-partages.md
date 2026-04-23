# Story 5.3: Factoriser les type guards et helpers workspace partages

Status: done

## Story

As a mainteneur de `corp`,
I want que les type guards du contrat coeur et les helpers d'initialisation du workspace existent en une seule definition partagee,
so that les contrats runtime ne derivent plus silencieusement entre packages et la dette de duplication cesse de croitre a chaque nouvelle projection.

## Context

Les retros Epic 3 et Epic 4 signalent a deux reprises la meme duplication:

- `isApprovalRequest`, `isArtifact`, `isTicket`, `isExecutionAttempt`, `isWorkspaceIsolationMetadata`, `isApprovalDecision` et `isCapabilityInvocationDetails` sont dupliques entre `packages/journal/.../audit-log-projection.ts` et `packages/mission-kernel/.../read-mission-audit.ts`. La story 4.5 a extrait `CapabilityInvocationDetails` dans `packages/contracts`, mais les guards runtime restent copies.
- `ensureMissionWorkspaceInitialized` existe en trois implementations differentes dans `create-mission.ts`, `update-mission-lifecycle.ts` et `read-mission-resume.ts`. La version de `create-mission` verifie `resume-view`, les deux autres non.
- `normalizeOpaqueExtensionReference` (registre d'extension) et `normalizeOpaqueReferences` (ticket runtime) font tous les deux trim + dedupe sans lien de dependance partage.

## Acceptance Criteria

1. Given les type guards `isApprovalRequest`, `isArtifact`, `isTicket`, `isExecutionAttempt`, `isWorkspaceIsolationMetadata`, `isApprovalDecision`, `isCapabilityInvocationDetails` etaient dupliques
   When la story est terminee
   Then une seule definition de chaque guard vit dans un module partage (ex. `packages/contracts/src/guards/` ou `packages/shared-guards/`)
   And `audit-log-projection.ts` et `read-mission-audit.ts` importent la definition unique

2. Given `ensureMissionWorkspaceInitialized` existait en trois copies avec comportement divergent sur la verification de `resume-view`
   When la story est terminee
   Then une seule implementation factoree est consommee par `create-mission.ts`, `update-mission-lifecycle.ts` et `read-mission-resume.ts`
   And cette implementation unique inclut la verification `resume-view` (comportement historique de `create-mission`) comme contrat commun

3. Given `normalizeOpaqueExtensionReference` et `normalizeOpaqueReferences` font trim + dedupe
   When la story est terminee
   Then une seule helper `normalizeOpaqueReferences(values: string[]): string[]` est partagee entre le registre d'extension et le ticket runtime
   And une divergence de normalisation (ex. casse ou espaces) ne peut plus etre introduite dans un seul des deux chemins

4. Given la factorisation est appliquee
   When les tests sont relances
   Then la baseline de 246 tests verts est preservee
   And aucun comportement observable ne change dans la CLI ou dans le journal brut

## Tasks / Subtasks

- [x] Choisir le package d'accueil pour les guards (AC: 1)
  - [x] Decider entre `packages/contracts/src/guards/` (proche des types) ou nouveau `packages/shared-guards` (plus explicite).
  - [x] Documenter le choix en ADR court ou en commentaire de module.

- [x] Extraire les 7 type guards vers le module partage (AC: 1)
  - [x] Copier les definitions actuelles, les consolider en cas de divergences mineures, et expliciter chaque branche (notamment la branche `null` de `workspaceIsolationId` qui sera finalisee en Story 5.7).
  - [x] Remplacer les definitions privees dans `audit-log-projection.ts` et `read-mission-audit.ts` par un `import` unique.
  - [x] Ajouter des tests unitaires par guard (cas positif, champs manquants, types errones).

- [x] Factoriser `ensureMissionWorkspaceInitialized` (AC: 2)
  - [x] Deplacer l'implementation vers un module partage (ex. `packages/mission-kernel/src/storage/ensure-mission-workspace.ts` exporte).
  - [x] Unifier le contrat: verifier la presence de `events.jsonl`, `resume-view.json`, `mission-status.json`, `ticket-board.json`, `approval-queue.json`, `artifact-index.json`, `audit-log.json`, `capabilitiesDir`, `skillPacksDir` selon l'etat attendu.
  - [x] Consommer l'helper unique dans `create-mission.ts`, `update-mission-lifecycle.ts`, `read-mission-resume.ts`.
  - [x] Regression test: scenario pre-Epic 4 workspace sans certaines projections -> message d'erreur specifique conformement a la politique Story 5.0.

- [x] Factoriser `normalizeOpaqueReferences` (AC: 3)
  - [x] Deplacer la helper vers `packages/contracts/src/extension/` ou `packages/shared-utils/`.
  - [x] Consommer dans le registre d'extension et dans le ticket runtime.
  - [x] Documenter le contrat (trim, dedupe, preservation de l'ordre).

- [x] Regression tests (AC: 4)
  - [x] Lancer `npm test` et verifier 246 tests verts maintenus.
  - [x] Ajouter un test d'import croise verifiant qu'aucun consommateur ne reimplemente localement les guards ou helpers extraits.

## Dev Notes

### Story Intent

Purement refactoring. Aucun comportement CLI modifie, aucun schema persistant touche. L'enjeu est de supprimer 3 sources de derive silencieuse avant que les Stories 5.1, 5.2, 5.4, 5.5, 5.6 et 5.7 n'elargissent la surface de changement.

### Ordre d'execution recommande

Cette story doit s'executer avant 5.1 et 5.2 pour leur fournir les validateurs et helpers partages, ou au minimum en parallele avec merge coordine.

### Items deferred-work.md absorbes

D-03, D-11, D-21, D-31, D-53.

### NFR cible

NFR17 (Source canonique unique): pour chaque guard et helper workspace cible par Epic 5, il doit exister exactement une implementation canonique importee par tous les consommateurs concernes, avec 0 duplication locale residuelle dans les packages assainis par la story.

### Testing Requirements

- Tests unitaires par guard extrait (cas valide + cas invalides).
- Test d'import croise sur le monorepo (ex. grep de la signature privee) pour garantir qu'aucun consommateur ne re-implemente localement.
- `npm test` 246 verts maintenu.

## Dev Agent Record

### Implementation Plan

- Heberger les guards partages dans `packages/contracts/src/guards/` pour rester co-localise aux types et reutiliser les patterns deja presents dans `persisted-document-guards.ts`.
- Factoriser le controle du workspace dans `packages/mission-kernel/src/mission-service/ensure-mission-workspace.ts` en separant l'initialisation idempotente du controle de presence des fichiers/projections requis.
- Centraliser la normalisation opaque dans `packages/contracts/src/extension/extension-registration.ts`, puis rebrancher les consommateurs runtime et registre sur cette definition unique.
- Ajouter des tests unitaires dedies et un test anti-regression de reimplementation locale avant validation complete.

### Debug Log

- 2026-04-20: Story prise en charge, contexte BMAD charge, duplication confirmee entre `audit-log-projection.ts`, `read-mission-audit.ts`, `read-mission-resume.ts`, `ticket-service-support.ts` et `extension-registration.ts`.
- 2026-04-20: Premier passage trop strict sur `readMissionResume` corrige pour conserver la reparation automatique de `resume-view` sans recreer silencieusement `events.jsonl`.

### Completion Notes

- Guards runtime canonicalises dans `packages/contracts/src/guards/persisted-document-guards.ts`, puis consommes par `audit-log-projection`, `read-mission-audit`, `approval-queue-projection`, `artifact-index-projection` et `resolve-approval-request`.
- `normalizeOpaqueReferences(values: string[]): string[]` est maintenant la source canonique dans `packages/contracts/src/extension/extension-registration.ts`, re-exportee par le runtime ticket et reutilisee par la projection d'audit.
- `ensureMissionWorkspaceInitialized` unifie desormais l'initialisation idempotente des projections, la verification du layout complet (`resume-view`, `capabilitiesDir`, `skillPacksDir`, etc.) et la lecture defensive qui preserve le diagnostic `journal_manquant`.
- Couverture ajoutee sur les nouveaux guards, sur le layout legacy pre-Epic 4 et sur l'absence de reimplementation locale.
- Validation finale: `npm test` vert avec 370 tests passes.

## File List

- _bmad-output/implementation/5-3-factoriser-type-guards-et-helpers-workspace-partages.md
- _bmad-output/implementation/sprint-status.yaml
- packages/contracts/src/guards/persisted-document-guards.ts
- packages/contracts/src/extension/extension-registration.ts
- packages/journal/src/projections/audit-log-projection.ts
- packages/journal/src/projections/approval-queue-projection.ts
- packages/journal/src/projections/artifact-index-projection.ts
- packages/mission-kernel/src/approval-service/resolve-approval-request.ts
- packages/mission-kernel/src/mission-service/ensure-mission-workspace.ts
- packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts
- packages/mission-kernel/src/resume-service/read-mission-audit.ts
- packages/mission-kernel/src/resume-service/read-mission-resume.ts
- packages/ticket-runtime/src/ticket-service/ticket-service-support.ts
- tests/unit/ensure-mission-workspace.test.ts
- tests/unit/persisted-document-guards.test.ts
- tests/unit/read-mission-resume.test.ts
- tests/unit/shared-runtime-factorization.test.ts
- dist/packages/contracts/src/guards/persisted-document-guards.js
- dist/packages/contracts/src/extension/extension-registration.js
- dist/packages/journal/src/projections/audit-log-projection.js
- dist/packages/journal/src/projections/approval-queue-projection.js
- dist/packages/journal/src/projections/artifact-index-projection.js
- dist/packages/mission-kernel/src/approval-service/resolve-approval-request.js
- dist/packages/mission-kernel/src/mission-service/ensure-mission-workspace.js
- dist/packages/mission-kernel/src/mission-service/update-mission-lifecycle.js
- dist/packages/mission-kernel/src/resume-service/read-mission-audit.js
- dist/packages/mission-kernel/src/resume-service/read-mission-resume.js
- dist/packages/ticket-runtime/src/ticket-service/ticket-service-support.js
- dist/tests/unit/ensure-mission-workspace.test.js
- dist/tests/unit/persisted-document-guards.test.js
- dist/tests/unit/read-mission-resume.test.js
- dist/tests/unit/shared-runtime-factorization.test.js

## Change Log

- 2026-04-20: Story passee en `in-progress` et plan d'implementation initialise.
- 2026-04-20: Guards runtime, helper workspace et normalisation opaque factorises vers des sources canoniques partagees, avec tests et regeneration `dist`.
- 2026-04-20: Code review adversariale (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Findings consignes ci-dessous.
- 2026-04-20: Correction YOLO. Decision-needed resolus (guards strict par defaut, `cleanupLocks` opt-in, `readDecisionFromPayload` tolerant, `isMission` audit renomme `isAuditMissionShape`, precedence journal ENOENT restauree). Patches appliques (NFR17: 4e copie `ensureMissionWorkspaceInitialized` supprimee et 6 callers rewires, guard `Object.isExtensible`, call counter test, factorisation test etendu). `npm test` 370/370.

### Review Findings

**Decision-needed (tous resolus en correction YOLO 2026-04-20)**

- [x] [Review][Decision] Guards runtime `isMission/isTicket/isArtifact/isExecutionAttempt` acceptent desormais des discriminants inconnus — **Resolution** : guards remis en mode strict (`validateX(value)` sans `{strict:false}`). La lenience `{strict:false, warnings}` reste opt-in explicite pour les reads defensifs repository, alignee sur l'intent Epic 5 (durcir la lecture). Test aligne (`isMission({status:"archived_v2"})` retourne `false`).
- [x] [Review][Decision] `assertWorkspaceReady` impose `capabilitiesDir` + `skillPacksDir` sur tous les callers — **Dismiss** : AC2 du spec enumere explicitement ces deux repertoires dans les verifications requises. V1 non deployee encore, donc pas de workspace legacy a migrer. Comportement conserve tel quel.
- [x] [Review][Decision] `cleanupStaleMissionLocks` declenche inconditionnellement — **Resolution** : nouveau flag `cleanupLocks?: boolean` (default `false`). Les commandes read (resume/status/compare) restent pures ; les commandes write opt-in explicitement (`cleanupLocks: true`). Le cleanup est enveloppe dans `runLockCleanup(...)` qui classifie les erreurs filesystem via `createFileSystemReadError` et tolere ENOENT sur le repertoire missions.
- [x] [Review][Decision] `isApprovalDecision` strict drop des records malformes — **Resolution** : `readDecisionFromPayload` dans `read-mission-audit.ts` n'utilise plus le guard strict. Extraction fine-grained tolerante : outcome valide preserve, chaque champ optionnel accepte s'il est bien forme, ignore sinon. Le guard canonique `isApprovalDecision` reste strict pour les reads repository.
- [x] [Review][Decision] `isMission` survit en copie locale dans `audit-log-projection.ts` — **Resolution** : local renomme en `isAuditMissionShape` avec docstring explicitant le fork delibere (audit privilegie la fidelite journalistique, le guard canonique est strict pour les reads repository). Test de factorisation etendu pour assert `function isMission(` absent du fichier.
- [x] [Review][Decision] Diagnostic `EventLogReadError.missing` masque — **Resolution** : reordering dans `assertWorkspaceReady` : un ENOENT sur le journal (source of truth canonique) merite toujours le diagnostic dedie, meme si d'autres projections manquent. Retire la condition `&& !missingNonJournalEntry`.
- [x] [Review][Decision] Suppression de `LIFECYCLE_SKIP_PROJECTIONS` — **Dismiss** : comportement equivalent. Un `resume-view` seme par lifecycle avec le default a `resume: null` est immediatement detecte comme suspicious par `isResumeViewSuspicious` (`!projection.resume` => true), puis reconstruit et ecrase par `readMissionResume` en fin de lifecycle. Aucun observable diverge.

**Patch (tous appliques)**

- [x] [Review][Patch] **NFR17 FAIL** — 4e copie de `ensureMissionWorkspaceInitialized` supprimee de `ticket-service-support.ts`. Les 6 callers (`run-ticket.ts`, `create-ticket.ts`, `update-ticket.ts`, `move-ticket.ts`, `cancel-ticket.ts`, `select-mission-extensions.ts`) importent maintenant le helper canonique avec `cleanupLocks: true`. Test de factorisation etendu pour assert `function ensureMissionWorkspaceInitialized(` absent de `ticket-service-support.ts` et que chaque caller importe bien depuis `mission-service/ensure-mission-workspace`.
- [x] [Review][Patch] `attachStructuralValidationWarnings` — Ajout de `if (!Object.isExtensible(value)) return value;` avant `Object.defineProperty`. Un candidat frozen/non-extensible est renvoye tel quel sans lever TypeError.
- [x] [Review][Patch] Test `read-mission-resume.test.ts` require() monkey-patch — Ajout d'un compteur `mockInvocationCount` et assertion finale `assert.equal(mockInvocationCount, 1)` avec commentaire expliquant la protection contre une migration ESM future.
- [x] [Review][Patch] Test de factorisation etendu — 6 nouveaux callers verifies, `function isMission(` absent de `audit-log-projection.ts`, `function ensureMissionWorkspaceInitialized(` absent de `ticket-service-support.ts`.
- [x] [Review][Patch] Export `normalizeOpaqueReferences` — deplace apres le bloc d'imports dans `ticket-service-support.ts`.
- [x] [Review][Patch] `npm test` : 370/370 verts.

**Deferred (pre-existants ou hors scope immediat)**

- [x] [Review][Defer] Equivalence de `normalizeOpaqueReferences` canonique vs `normalizeTrimmedList({dedupe:true})` historique non prouvee — deferred, ajouter un test de parite
- [x] [Review][Defer] Dette de typage : `ValidationResult<T>` generique + cast `as unknown as Mission` final affaiblissent la soundness du pipeline de validation — deferred, pre-existant assoupli par le refactor
- [x] [Review][Defer] Ordre d'evaluation `initializeJournal:false` + journal absent — deferred, theorique si bootstrap cree toujours un journal vide
- [x] [Review][Defer] `assertWorkspaceReady` ne distingue pas « fichier a la place d'un repertoire » (`access()` tolere les fichiers) — deferred, general hardening
- [x] [Review][Defer] `readStoredResumeView` ne funnelise pas les erreurs non-classifiees via `isRecoverablePersistedDocumentError` (asymetrie vs `readStoredMissionSnapshot`) — deferred, pattern pre-existant
- [x] [Review][Defer] `isStringArrayValue` accepte les arrays sparse — deferred, theorique (JSON ne produit pas de holes)
- [x] [Review][Defer] `validateOpenStringUnion` double-negation (`options.strict !== false`) — deferred, trap cognitif pour callers futurs, pas de bug fonctionnel actuel
- [x] [Review][Defer] `packages/contracts/src/guards/persisted-document-guards.ts` importe `import type` depuis `packages/workspace-isolation/` — deferred, verifier tsconfig `references` pour prevenir un cycle
