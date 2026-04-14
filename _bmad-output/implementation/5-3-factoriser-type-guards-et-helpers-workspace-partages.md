# Story 5.3: Factoriser les type guards et helpers workspace partages

Status: ready-for-dev

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

- [ ] Choisir le package d'accueil pour les guards (AC: 1)
  - [ ] Decider entre `packages/contracts/src/guards/` (proche des types) ou nouveau `packages/shared-guards` (plus explicite).
  - [ ] Documenter le choix en ADR court ou en commentaire de module.

- [ ] Extraire les 7 type guards vers le module partage (AC: 1)
  - [ ] Copier les definitions actuelles, les consolider en cas de divergences mineures, et expliciter chaque branche (notamment la branche `null` de `workspaceIsolationId` qui sera finalisee en Story 5.7).
  - [ ] Remplacer les definitions privees dans `audit-log-projection.ts` et `read-mission-audit.ts` par un `import` unique.
  - [ ] Ajouter des tests unitaires par guard (cas positif, champs manquants, types errones).

- [ ] Factoriser `ensureMissionWorkspaceInitialized` (AC: 2)
  - [ ] Deplacer l'implementation vers un module partage (ex. `packages/mission-kernel/src/storage/ensure-mission-workspace.ts` exporte).
  - [ ] Unifier le contrat: verifier la presence de `events.jsonl`, `resume-view.json`, `mission-status.json`, `ticket-board.json`, `approval-queue.json`, `artifact-index.json`, `audit-log.json`, `capabilitiesDir`, `skillPacksDir` selon l'etat attendu.
  - [ ] Consommer l'helper unique dans `create-mission.ts`, `update-mission-lifecycle.ts`, `read-mission-resume.ts`.
  - [ ] Regression test: scenario pre-Epic 4 workspace sans certaines projections -> message d'erreur specifique conformement a la politique Story 5.0.

- [ ] Factoriser `normalizeOpaqueReferences` (AC: 3)
  - [ ] Deplacer la helper vers `packages/contracts/src/extension/` ou `packages/shared-utils/`.
  - [ ] Consommer dans le registre d'extension et dans le ticket runtime.
  - [ ] Documenter le contrat (trim, dedupe, preservation de l'ordre).

- [ ] Regression tests (AC: 4)
  - [ ] Lancer `npm test` et verifier 246 tests verts maintenus.
  - [ ] Ajouter un test d'import croise verifiant qu'aucun consommateur ne reimplemente localement les guards ou helpers extraits.

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
