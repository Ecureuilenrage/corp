# Story 1.2: Creer une mission persistante avec objectif et criteres de succes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want creer une mission persistante avec objectif, criteres de succes et contraintes initiales,
so that le systeme puisse piloter une boucle de travail bornee et explicite.

## Acceptance Criteria

1. Given la CLI V1 est disponible
   When l'operateur cree une mission avec titre, objectif, criteres de succes et policy profile initial
   Then un enregistrement `Mission` local est persiste avec identite stable, statut initial et horodatages
   And la mission initialise ses index de tickets, artefacts et evenements sans embarquer de champs vendor-specifiques

2. Given une mission vient d'etre creee
   When l'etat est journalise
   Then un evenement fin `mission.created` est ecrit avant toute projection de lecture
   And le point de reprise operateur peut ensuite etre calcule a partir du journal

## Tasks / Subtasks

- [x] Exposer une commande CLI mission-centrique pour creer une mission (AC: 1, 2)
  - [x] Ajouter une sous-commande `corp mission create` distincte du bootstrap, avec parsing explicite de `--root`, `--title`, `--objective`, `--success-criterion` (flag repetable) et `--policy-profile`.
  - [x] Rejeter les invocations invalides avec des messages deterministes en francais: titre manquant, objectif manquant, aucun critere de succes, policy profile vide, workspace non initialise.
  - [x] Garder `apps/corp-cli` limite a l'entree/sortie CLI et deleguer toute la creation de mission au `mission-kernel`.

- [x] Introduire le contrat `Mission` V1 minimal et ses regles d'initialisation (AC: 1)
  - [x] Ajouter un type/contrat `Mission` conforme a l'architecture: `id`, `title`, `objective`, `status`, `successCriteria`, `policyProfileId`, `ticketIds`, `artifactIds`, `eventIds`, `resumeCursor`, `createdAt`, `updatedAt`.
  - [x] Initialiser la mission avec un identifiant stable prefixe `mission_`, un statut initial `ready`, des tableaux vides pour `ticketIds` et `artifactIds`, un premier `eventId`, et `createdAt === updatedAt`.
  - [x] Traiter `policyProfileId` comme une reference textuelle opaque dans cette story; ne pas embarquer encore un objet policy complet ni un `resource_budget`.

- [x] Persister localement la mission sans casser le socle fichier deja pose (AC: 1)
  - [x] Etendre la couche `storage` pour gerer un espace missions dedie, recommande sous `.corp/missions/<missionId>/mission.json`, tout en gardant ce choix encapsule derriere un repository/seam.
  - [x] Reutiliser et etendre `resolveWorkspaceLayout` / `ensureWorkspaceLayout` au lieu de recreer des chemins en dur dans la CLI ou dans les tests.
  - [x] Ne pas introduire de base SQLite, de dependance externe de persistence, ni de format vendor pour cette story; rester aligne sur le pattern local `jsonl` / `json` etabli par la Story 1.1.

- [x] Journaliser `mission.created` avant toute projection et initialiser les vues de lecture minimales (AC: 2)
  - [x] Ajouter un append d'evenement `mission.created` avec au minimum `eventId`, `type`, `missionId`, `occurredAt`, `actor`, `source` et une charge utile suffisante pour reconstruire l'etat initial de mission.
  - [x] Construire l'operation de creation dans l'ordre suivant: valider l'entree, preallouer `missionId` / `eventId`, append du journal, persistance du snapshot mission, mise a jour des projections.
  - [x] Garder la projection `mission-status` sous la forme `{ schemaVersion, mission }` et `resume-view` sous la forme `{ schemaVersion, resume }`, sans casser les shapes seeded par la Story 1.1.
  - [x] Laisser `ticket-board`, `approval-queue` et `artifact-index` dans leur etat vide initialise tant qu'aucun ticket, approval ou artefact n'existe.

- [x] Ajouter la couverture de tests necessaire a la creation de mission et a la non-regression du bootstrap (AC: 1, 2)
  - [x] Ajouter un test contractuel CLI qui valide l'aide et la surface `corp mission create` sans fuite de vocabulaire vendor.
  - [x] Ajouter un test d'integration qui verifie la persistance du record `Mission`, la presence d'un unique evenement `mission.created`, la coherence entre `resumeCursor` et le premier `eventId`, et l'initialisation des index vides.
  - [x] Ajouter un test d'echec pour un workspace non initialise qui demande explicitement a l'operateur de lancer `corp mission bootstrap` avant `corp mission create`.
  - [x] Conserver un test de non-regression garantissant que `corp mission bootstrap` reste idempotent et compatible avec l'extension du layout de stockage.

## Dev Notes

### Story Intent

Cette story transforme le socle CLI local-first en premiere vraie primitive produit: une mission persistante, portable et lisible hors transcript. Elle doit creer l'objet `Mission` et le premier evenement de journal, sans absorber la reprise riche, les transitions de cycle de vie, les tickets, ni l'execution via adaptateur.

### Current Project State

- Le projet contient un bootstrap minimal livre par la Story 1.1: CLI `corp`, journal append-only vide et projections JSON minimales. Il n'existe pas encore de contrat `Mission`, de repository mission, ni de commande de creation.
- Le layout de workspace actuellement gere par le code est limite a `.corp/journal/events.jsonl` et `.corp/projections/*.json`.
- Le projet n'est pas initialise comme depot Git exploitable; il n'y a donc pas d'intelligence commit a reutiliser dans cette story.
- La pile effective actuelle est `Node >=20`, `TypeScript ^5.9.3`, compilation `CommonJS`, `strict: true`, tests via `node:test` et `assert/strict`.

### Architecture Compliance

- La CLI doit continuer a parler uniquement aux services applicatifs; elle ne doit pas porter la logique metier de creation de mission ni la structure du journal. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- Le contrat `Mission` a suivre est celui du document d'architecture, qui fait foi sur la recherche technique lorsqu'un detail diverge. Ici, utiliser `policyProfileId` comme champ de reference dans `Mission`, et non un objet policy embarque dans le schema coeur. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 3.3 Proposition de forme canonique]
- Le journal append-only reste la source de verite. Toute transition significative doit produire un evenement avant projection; cette story doit donc produire `mission.created` avant d'alimenter `mission-status` ou `resume-view`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules]
- Aucun identifiant OpenAI/Codex, aucune notion `threadId`, `response_id`, `session_id`, ni aucun detail vendor ne doit apparaitre dans `Mission`, dans la CLI ou dans les projections de cette story. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]
- `resource_budget` reste hors schema coeur V1; ne pas le glisser dans `Mission` ou dans les projections "par commodite". [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.1 Decision Table; 3.9 Journal and Projection Model]

### Previous Story Intelligence

- Reutiliser le pattern existant plutot que de contourner le socle pose en 1.1: `bootstrapMissionWorkspace`, `resolveWorkspaceLayout`, `ensureWorkspaceLayout`, `ensureAppendOnlyEventLog`, `seedProjectionStore`, `DEFAULT_PROJECTIONS`. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-1-initialiser-la-cli-v1-et-le-stockage-local-de-mission.md` - Completion Notes List; File List; `C:/Dev/PRJET/corp/packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`; `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`; `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`]
- Le code en place assume une surface CLI et des messages utilisateur en francais; garder cette convention pour `mission create`, l'aide et les erreurs. [Source: `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`; `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`]
- Les tests actuels utilisent exclusivement `node:test`, `assert/strict`, `mkdtemp`, `rm` et le build TypeScript natif; ne pas introduire Jest/Vitest pour cette story. [Source: `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`; `C:/Dev/PRJET/corp/tests/integration/bootstrap-workspace.test.ts`]
- Le stockage effectif deja livre est fichier-based (`jsonl` / `json`) et encapsule derriere `journal` / `storage`; cette story doit prolonger ce pattern, pas le remplacer. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-1-initialiser-la-cli-v1-et-le-stockage-local-de-mission.md` - Completion Notes List]

### Implementation Guardrails

- Ne pas faire d'auto-bootstrap silencieux dans `corp mission create`. Si le workspace `.corp` n'existe pas ou est incomplet, echouer proprement avec une consigne explicite vers `corp mission bootstrap`.
- Ne pas centraliser toute la logique dans `apps/corp-cli/src/commands/mission-command.ts` ni reutiliser `bootstrap-mission-workspace.ts` comme fourre-tout. Introduire au moins un service/repository dedie a la creation de mission.
- Ne pas sur-implementer la reprise: cette story peut initialiser une `resume-view` minimale, mais pas la vue riche multi-tickets reservee a la Story 1.3.
- Ne pas ajouter de `Ticket`, `ExecutionAttempt`, `ApprovalRequest`, adaptateur `Responses API` ou isolation de workspace par ticket dans cette story.
- Ne pas modifier les cles racine des projections seeded (`mission`, `tickets`, `approvals`, `artifacts`, `resume`) pour eviter de casser les tests et le contrat implicite du bootstrap V1.
- Une invocation `corp mission create` doit produire exactement une mission et exactement un evenement `mission.created`; pas de retries caches ni de duplication silencieuse dans le journal.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/mission-kernel/src/mission-service/create-mission.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/projections/mission-status-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `tests/contract/mission-create-cli.test.ts`
- `tests/integration/create-mission.test.ts`

### Data Contract Requirements

La mission creee dans cette story doit au minimum respecter les choix suivants:

- `id`: identifiant stable prefixe `mission_`.
- `title`: string non vide.
- `objective`: string non vide.
- `status`: `ready` a la creation.
- `successCriteria`: tableau non vide de strings, dans l'ordre fourni par l'operateur.
- `policyProfileId`: string reference, issu du flag CLI.
- `ticketIds`: `[]`.
- `artifactIds`: `[]`.
- `eventIds`: tableau contenant le premier `event_*`.
- `resumeCursor`: egal au premier `event_*` au moment de la creation.
- `createdAt` / `updatedAt`: meme timestamp ISO au moment initial.

Si un detail d'implementation impose un arbitrage, la regle a suivre est: garder le schema coeur minimal, explicite et vendor-decoupled, puis repousser le reste aux stories suivantes.

### Event And Projection Requirements

- L'evenement `mission.created` doit etre suffisamment riche pour reconstruire l'etat initial sans lire un transcript externe.
- Le journal reste append-only; ne pas reouvrir ou reecrire les lignes precedentes pour "corriger" l'etat.
- `mission-status.json` doit pouvoir refleter la mission creee tout en conservant `schemaVersion: 1`.
- `resume-view.json` peut rester minimale a ce stade, mais doit deja contenir assez d'information pour identifier la mission creee et le dernier evenement connu.
- `ticket-board.json`, `approval-queue.json` et `artifact-index.json` doivent rester vides mais valides apres creation de mission.
- Le succes de la commande ne doit etre annonce qu'une fois le journal, le snapshot mission et les projections critiques coherents.

### CLI Requirements

- Etendre l'aide `corp mission help` pour presenter `corp mission create`.
- Garder les messages CLI centre mission et exempts de vocabulaire provider (`codex`, `openai`, etc.).
- Recommander une sortie concise apres succes, par exemple: identifiant de mission cree, chemin du workspace mission, et prochaine action suggeree.
- Ne pas exiger de dependance a un reseau, a des credentials ou a un provider externe pour creer une mission.

### Testing Requirements

- Verifier que `corp mission create` apparait dans l'aide et respecte les conventions de sortie en francais.
- Verifier la creation d'un snapshot mission sous le layout local attendu.
- Verifier qu'un seul evenement `mission.created` est ajoute au journal et qu'il precede toute lecture projetee dans le flot applicatif.
- Verifier que `mission-status` et `resume-view` sont coherents avec le `missionId` / `eventId` initial.
- Verifier que la creation echoue proprement si le bootstrap n'a pas ete execute.
- Verifier que `corp mission bootstrap` continue a passer apres l'introduction du stockage mission.

### Scope Exclusions

- Hors scope: listing de toutes les missions, selection interactive de mission, reprise riche multi-missions et navigation avancee.
- Hors scope: tickets, dependances, owners, dispatcher, approvals, budgets observes, audit detaille, worktrees et adaptateurs d'execution.
- Hors scope: policy engine complet; dans cette story, seul le stockage de `policyProfileId` comme reference stable est requis.
- Hors scope: migration vers SQLite, RDBMS, ou tout autre changement d'architecture de persistence non necessaire a la mission V1.

### Latest Technical Information

- Le repo de code actuel epingle `Node >=20.0.0` et `TypeScript ^5.9.3`; s'aligner sur cette baseline au lieu d'ajouter des polyfills ou bibliotheques utilitaires superflues. [Source: `C:/Dev/PRJET/corp/package.json`]
- La compilation actuelle est `CommonJS` cible `ES2022` avec `strict: true`; les nouveaux modules de cette story doivent rester compatibles avec cette configuration. [Source: `C:/Dev/PRJET/corp/tsconfig.json`]
- Pour les identifiants et l'horodatage, privilegier les API Node natives disponibles dans la baseline actuelle plutot qu'une dependance tierce. [Source: `C:/Dev/PRJET/corp/package.json`; inference a partir de la baseline Node >=20]

### Hypotheses Explicites

- Le statut initial retenu pour une mission fraichement creee est `ready`, car la mission est configuree mais n'a pas encore demarre d'execution ticket.
- Le chemin recommande `.corp/missions/<missionId>/mission.json` est une contrainte de story pour rester coherent avec le pattern fichier local deja en place; il ne prejuge pas d'une architecture de stockage plus large post-V1.
- `policyProfileId` reste une simple reference opaque dans cette story; sa resolution concrete sera traitee plus tard par le `policy-service`.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Overview; Additional Requirements; Epic 1; Story 1.2; Story 1.3; Story 1.4
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Criteres De Succes; Mission & Session Lifecycle; Planning & Delegation; Exigences Non Fonctionnelles
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.1 Decision Table; 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 4.1 Domain Consistency Rules; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - Executive Summary; 3.3 Proposition de forme canonique; 5.4 Interpretation pratique pour `corp`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-1-initialiser-la-cli-v1-et-le-stockage-local-de-mission.md` - Story Intent; Current Project State; Completion Notes List; File List
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/bootstrap-workspace.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Introduire le contrat `Mission` minimal et un service de creation cote `mission-kernel`, sans etendre prematurment le perimetre du runtime ticket.
- Etendre le layout local et le stockage fichier pour persister la mission, puis ajouter l'append d'evenement `mission.created`.
- Mettre a jour `mission-status` et une `resume-view` minimale, et couvrir le tout par des tests CLI + integration + non-regression bootstrap.

### Debug Log References

- `npm test` rouge: `tests/integration/bootstrap-workspace.test.ts` exposait l'absence de `missionsDir` dans `BootstrapMissionWorkspaceResult`.
- `npm test` rouge: le helper `writeProjectionSnapshot` attendait un type `ProjectionSnapshot` trop strict pour les nouvelles projections `mission-status` et `resume-view`.
- `npm test` vert: build TypeScript puis 9 tests Node passes apres ajout de `mission create`, du contrat `Mission`, du repository fichier mission, de l'append `mission.created` et des projections minimales.

### Completion Notes List

- La CLI expose maintenant `corp mission create` avec parsing explicite de `--root`, `--title`, `--objective`, `--success-criterion` repetable et `--policy-profile`, plus des erreurs deterministes en francais.
- La logique de creation a ete deplacee dans `mission-kernel` avec un service dedie, gardant `apps/corp-cli` limite a l'entree/sortie et a l'orchestration CLI.
- Un contrat `Mission` V1 minimal a ete introduit avec `policyProfileId` opaque, statut initial `ready`, identifiants `mission_*` / `event_*`, et index vides pour tickets et artefacts.
- Le stockage local a ete etendu avec `.corp/missions/<missionId>/mission.json` via un repository fichier, sans ajouter de dependance externe ni casser le bootstrap existant.
- La creation de mission suit l'ordre impose par la story: validation, preallocation `missionId` / `eventId`, append du journal `mission.created`, persistance du snapshot mission, puis mise a jour de `mission-status` et `resume-view`.
- Les projections seeded `ticket-board`, `approval-queue` et `artifact-index` restent inchangees et vides apres creation de mission.
- La couverture de tests a ete etendue avec aide/surface CLI, validations d'erreur, creation d'une mission complete et non-regression du bootstrap idempotent avec le nouveau layout missions.
- Validation finale executee via `npm test` avec 9 tests passes.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/projections/mission-status-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/mission-service/create-mission.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/projection-store/file-projection-store.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/contract/mission-create-cli.test.ts`
- `tests/integration/bootstrap-workspace.test.ts`
- `tests/integration/create-mission.test.ts`

### Change Log

- 2026-04-08: contexte complet de la Story 1.2 cree et statut passe a `ready-for-dev`.
- 2026-04-09: implementation complete de `corp mission create`, contrat `Mission` V1, persistance fichier mission, evenement `mission.created`, projections minimales et couverture de tests associee; statut passe a `review`.
