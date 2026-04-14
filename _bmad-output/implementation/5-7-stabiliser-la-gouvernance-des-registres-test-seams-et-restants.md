# Story 5.7: Stabiliser la gouvernance des registres, test seams et restants

Status: ready-for-dev

## Story

As a mainteneur de `corp`,
I want que les approbations revalident les registres workspace, que les test seams soient isoles par contexte et que les guards edge-case residuels soient corriges,
so that les decisions restent coherentes sous mutation concurrente du registre, que les tests paralleles ne fuient pas entre eux, et que les derniers ecarts signales sur Epic 4 soient fermes avant GA.

## Context

Cette story cloture l'Epic 5 en traitant les items residuels identifies dans les retros Epic 3 et Epic 4 qui ne rentrent pas naturellement dans les stories 5.1-5.6. Elle couvre:

- `resolve-approval-request.ts` ne revalide pas le registre workspace au moment de la resolution (D-51).
- `RegisteredCapability.localRefs` est obligatoire meme pour les capabilities MCP-backed (D-26).
- `validateExtensionRegistration` sans `baseDir`/`sourcePath` accepte silencieusement les refs manquantes (D-23).
- Symlink cyclique produit un diagnostic trompeur (D-24).
- `statSync` synchrone dans un pipeline async (D-20).
- `packages/capability-registry` sans `package.json` (D-25).
- Test seam mutable au niveau module dans `run-ticket.ts` (`setRunTicketDependenciesForTesting`) (D-30).
- `deepStrictEqualForComparison` peut boucler sur refs circulaires (D-47).
- `isExecutionAttempt` rejette `workspaceIsolationId: null` (D-16).
- `statSync` dans `validateResolvedLocalRef` masque les erreurs `EACCES` (D-48, residuel apres Story 5.2).
- Compat workspaces pre-3.4 documentee (D-15) - deja traitee mais validation d'alignement avec Story 5.0.
- `O(n) rebuild` a chaque lecture audit (D-19): documente comme "V1 acceptable" avec justification.

## Acceptance Criteria

1. Given une demande d'approbation reference une extension autorisee au moment de `extension select`
   When l'operateur resout l'approbation alors que l'extension a ete deregistree entre-temps
   Then `resolve-approval-request` revalide contre le registre workspace (capabilites ET skill packs)
   And refuse l'approbation avec un message deterministe "extension deregistree entre select et approve"
   And le run ne peut plus echouer silencieusement au preflight apres une approbation deja validee

2. Given `RegisteredCapability.localRefs` etait obligatoire pour toute capability
   When la story est terminee
   Then `localRefs` est optionnel pour les capabilities de type `mcp` (et reste obligatoire pour les capabilities de type `local`)
   And le contrat `registered-capability.ts` documente la semantique par type
   And les capabilities MCP ne portent plus un `localRefs: []` semantiquement trompeur

3. Given `validateExtensionRegistration` est appelee sans `baseDir`/`sourcePath`
   When une registration avec des `localRefs` manquants est validee
   Then la semantique "verification filesystem opt-in" est documentee explicitement dans la signature publique
   And un guard interdit l'usage sans `sourcePath` dans la CLI (le CLI passe toujours `sourcePath`)

4. Given `setRunTicketDependenciesForTesting` (ou un equivalent module-level) existait comme singleton mutable
   When des tests paralleles overrident les dependances
   Then l'override vit dans un contexte de test isole (factory, arrange-per-test, DI)
   And aucun test seam mutable global ne subsiste dans `run-ticket.ts`
   And un test de concurrence de tests paralleles verifie qu'aucun leak ne se produit entre eux

5. Given un type guard `isExecutionAttempt` rejetait `workspaceIsolationId: null`
   When un attempt porte legitimement `workspaceIsolationId: null`
   Then le guard accepte la branche `null` documentee (absence d'isolation worktree)
   And les entries d'audit ne perdent plus l'`attemptId` associe

6. Given `deepStrictEqualForComparison` est appele sur un objet potentiellement cyclique
   When une reference circulaire apparait (cas mutation en memoire)
   Then la recursion est bornee par un `WeakSet` de cycles deja visites
   And la fonction retourne un resultat deterministe sans boucler indefiniment

7. Given un symlink cyclique ou un `ELOOP` survient dans `validateResolvedLocalRef`
   When `statSync` est invoquee
   Then l'erreur `ELOOP` est distinguee de `ENOENT` et produit un diagnostic specifique `symlink_cycle`
   And les erreurs `EACCES` restantes sont separees de "ref manquante" (coherent avec Story 5.2)

8. Given `packages/capability-registry` n'a pas de `package.json` propre
   When la story est terminee
   Then soit un `package.json` minimal est ajoute (et les imports sont mis a jour), soit l'absence est explicitement documentee comme choix architectural du monorepo avec justification
   And le choix retenu est coherent avec les autres packages du monorepo

9. Given D-19 (O(n) rebuild a chaque lecture audit) n'est pas adresse
   When la story est fermee
   Then D-19 est explicitement documente dans la section "V1 acceptable" avec justification (ex. "journal < 1000 events dans le scenario pilote V1; optimisation post-GA si depasse 10 000")

## Tasks / Subtasks

- [ ] Revalider le registre workspace dans `resolve-approval-request` (AC: 1)
  - [ ] Apres verification des refs contre `mission.authorizedExtensions`, revalider la presence de chaque ref dans le registre capability et skill-pack.
  - [ ] Si une ref n'existe plus, refuser l'approbation avec message explicite.
  - [ ] Journaliser un event `approval.refused.extension_deregistered` avec raison.
  - [ ] Test: scenario select -> deregister -> approve -> echec deterministe.

- [ ] Rendre `localRefs` optionnel pour les capabilities MCP (AC: 2)
  - [ ] Modifier le contrat `RegisteredCapability` dans `packages/contracts/` avec union discriminee sur `type` (`local` requiert `localRefs`, `mcp` ne les requiert pas).
  - [ ] Mettre a jour les validateurs, le registre, la CLI.
  - [ ] Test: enregistrer une capability MCP sans `localRefs` -> accepte; enregistrer une capability locale sans `localRefs` -> rejete.

- [ ] Documenter la semantique `baseDir`/`sourcePath` de `validateExtensionRegistration` (AC: 3)
  - [ ] Commentaires JSDoc sur la signature publique.
  - [ ] Test: appel CLI sans `sourcePath` -> erreur de guard interne.

- [ ] Remplacer le test seam module-level dans `run-ticket.ts` (AC: 4)
  - [ ] Refactorer `runTicket` pour accepter les dependances comme parametres ou via une factory (pas de singleton mutable).
  - [ ] Supprimer `setRunTicketDependenciesForTesting` ou le confiner a un scope per-test (`using` / `afterEach` cleanup).
  - [ ] Test: lancer 2 tests paralleles qui overrident des dependances differentes -> aucun leak.

- [ ] Accepter la branche `null` dans `isExecutionAttempt` (AC: 5)
  - [ ] Modifier le guard partage (factore en Story 5.3) pour accepter `workspaceIsolationId: string | null`.
  - [ ] Test: attempt avec `workspaceIsolationId: null` -> guard retourne true; attempt avec type incorrect -> retourne false.

- [ ] Borner la recursion de `deepStrictEqualForComparison` (AC: 6)
  - [ ] Introduire un `WeakSet` de paires deja comparees.
  - [ ] Comportement sur cycle: retourner `true` si les deux objets ont le meme cycle, sinon `false`.
  - [ ] Test: objets avec cycles identiques; objets avec cycles divergents.

- [ ] Distinguer `ELOOP` et `EACCES` dans `validateResolvedLocalRef` (AC: 7)
  - [ ] Ajouter des branches explicites pour `ELOOP` -> `symlink_cycle` et `EACCES` -> `permission_denied`.
  - [ ] Test: symlink cyclique -> diagnostic specifique; fichier sans permission -> diagnostic specifique.

- [ ] Resoudre le statut de `packages/capability-registry` sans `package.json` (AC: 8)
  - [ ] Comparer avec les autres packages du monorepo.
  - [ ] Decider: ajouter un `package.json` minimal, ou documenter en `README.md` du package que c'est intentionnel.
  - [ ] Appliquer la decision de facon coherente.

- [ ] Rediger la section "V1 acceptable" pour D-19 (AC: 9)
  - [ ] Ajouter un paragraphe explicite dans le fichier `_bmad-output/implementation/deferred-work.md` sous un nouveau titre "Items conserves comme V1 acceptable apres Epic 5".
  - [ ] Documenter la justification (volume attendu V1, plan d'optimisation post-GA).

- [ ] Revue finale du statut de tous les items D-01 a D-53 (AC: 9)
  - [ ] Ajouter une table de tracabilite dans `deferred-work.md` indiquant pour chaque item : story 5.x qui le traite, ou "V1 acceptable" avec justification.
  - [ ] Verifier que 48+ items sont effectivement absorbes par Epic 5.

## Dev Notes

### Story Intent

Story de cloture de l'Epic 5. Traite les items residuels qui ne rentrent pas dans les lots thematiques 5.1-5.6, mecanise la revalidation de registre sur approbation, et produit la table de tracabilite finale D-01 -> D-53 -> Story 5.x.

### Items deferred-work.md absorbes

D-15 (validation), D-16, D-19 (documente comme V1 acceptable), D-20, D-23, D-24, D-25, D-26, D-30, D-47, D-48, D-51.

### NFR cible

NFR21 (Revalidation et isolement des seams): 100% des resolutions d'approbation impliquant une extension precedemment selectionnee doivent revalider la presence de cette extension dans le registre workspace au moment de la decision, et 0 seam de test mutable global ne doit subsister dans les chemins critiques cibles.

### Testing Requirements

- Test de scenario select -> deregister -> approve (AC1).
- Tests contractuels sur la distinction capability local vs MCP (AC2).
- Tests de concurrence de tests paralleles sur `run-ticket` (AC4).
- Tests edge-cases sur `isExecutionAttempt`, `deepStrictEqualForComparison`, `validateResolvedLocalRef` (AC5, AC6, AC7).
- Mise a jour de `deferred-work.md` avec table de tracabilite D-01 -> D-53.
- Baseline 246 tests verts preservee. Objectif Epic 5 complet: ~300+ tests verts une fois toutes les stories 5.x fusionnees.
