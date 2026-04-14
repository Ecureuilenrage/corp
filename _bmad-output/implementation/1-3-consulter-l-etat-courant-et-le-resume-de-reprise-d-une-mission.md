# Story 1.3: Consulter l'etat courant et le resume de reprise d'une mission

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want rouvrir une mission existante et voir son etat utile dans un meme flux,
so that je puisse reprendre sans relire le transcript brut.

## Acceptance Criteria

1. Given une mission existe avec journal et projections locales
   When l'operateur demande l'etat ou la reprise de cette mission
   Then la CLI restitue l'objectif courant, les tickets ouverts, les validations en attente et le dernier artefact pertinent dans un meme flux
   And la sortie met en avant le prochain arbitrage utile pour l'operateur

2. Given la projection `resume view` est absente ou douteuse
   When la mission est reprise
   Then la vue de reprise est reconstruite a partir du journal append-only avant affichage
   And la reconstruction n'exige aucune reconstitution manuelle du contexte critique

## Tasks / Subtasks

- [x] Exposer une surface CLI read-only pour l'etat et la reprise de mission (AC: 1, 2)
  - [x] Ajouter `corp mission status --root <workspace> --mission-id <mission_id>` et `corp mission resume --root <workspace> --mission-id <mission_id>` en les faisant reposer sur le meme service applicatif.
  - [x] Exiger `--mission-id` de facon explicite; ne pas inferer automatiquement "la mission courante" et ne pas introduire de selection interactive dans cette story.
  - [x] Garder `apps/corp-cli` limite au parsing, a l'appel de service et au formatage; la logique de reprise ne doit pas vivre dans la commande CLI.

- [x] Introduire un service de lecture/reprise centre mission dans le `mission-kernel` (AC: 1, 2)
  - [x] Charger la mission demandee depuis `.corp/missions/<missionId>/mission.json` via un repository/seam explicite, sans reconstruire de chemins en dur dans la CLI.
  - [x] Lire le journal append-only et les projections locales utiles pour produire un objet de resume normalise contenant au minimum `missionId`, `title`, `objective`, `status`, `successCriteria`, `openTickets`, `pendingApprovals`, `lastRelevantArtifact`, `lastEventId`, `updatedAt` et `nextOperatorAction`.
  - [x] Reutiliser les projections existantes `mission-status`, `ticket-board`, `approval-queue`, `artifact-index` et `resume-view` au lieu d'introduire un nouveau fichier de lecture parallele.

- [x] Definir une regle de confiance et de reconstruction pour `resume-view` (AC: 2)
  - [x] Considerer `resume-view` comme douteuse si le fichier est absent, invalide en JSON, d'un `schemaVersion` inattendu, avec `resume` nul alors qu'une mission existe, avec un `missionId` incoherent, ou avec un `lastEventId` qui ne correspond pas au dernier evenement journalise pour la mission.
  - [x] Reconstruire la vue de reprise a partir du journal append-only avant affichage, en supportant a minima `mission.created` comme base de reconstruction pour l'Epic 1.
  - [x] Reecrire `resume-view.json` avec la vue reconstruite une fois la coherence retablie, sans ajouter d'evenement de lecture dans le journal pour cette story.

- [x] Rendre la sortie CLI exploitable en un seul scan operateur (AC: 1)
  - [x] Afficher dans un meme flux lisible l'identite de mission, l'objectif, le statut, les criteres de succes, les tickets ouverts, les validations en attente, le dernier artefact pertinent et le prochain arbitrage utile.
  - [x] Lorsque les projections `ticket-board`, `approval-queue` ou `artifact-index` sont encore vides au scope actuel, afficher explicitement `aucun` ou l'equivalent, plutot que d'inventer des donnees ou de masquer la section.
  - [x] Garder les messages et l'aide en francais, mission-centriques, sans fuite de vocabulaire vendor ni renvoi au transcript brut.

- [x] Ajouter la couverture de tests et les non-regressions associees (AC: 1, 2)
  - [x] Ajouter un test contractuel pour l'aide CLI et la surface `status` / `resume`, avec verification de l'absence de vocabulaire `codex` / `openai`.
  - [x] Ajouter un test d'integration qui cree une mission, appelle la lecture d'etat, et verifie la restitution de l'objectif, du `missionId`, du `lastEventId`, des sections vides attendues et du `nextOperatorAction`.
  - [x] Ajouter un test d'integration qui supprime ou corrompt `resume-view.json`, puis verifie qu'un `mission resume` reconstruit la projection a partir du journal avant d'afficher la sortie.
  - [x] Ajouter des tests d'erreur deterministes pour `--mission-id` manquant, mission inconnue et workspace non initialise.

## Dev Notes

### Story Intent

Cette story doit rendre la mission persistante consultable et repriseable comme objet de travail, pas seulement comme fichier cree. Elle ferme la boucle minimale "bootstrap -> create -> reopen/read" de l'Epic 1, sans absorber les transitions de cycle de vie de la Story 1.4 ni les sujets ticket/runtime des epics suivants.

### Current Project State

- Le socle actuel fournit `corp mission bootstrap` et `corp mission create`, avec un stockage fichier sous `.corp/`, un journal append-only `events.jsonl`, un snapshot mission par dossier et cinq projections JSON minimales.
- Le fichier `resume-view.json` existe deja, mais sa forme actuelle reste minimale: `missionId`, `title`, `status`, `lastEventId`, `updatedAt`. Il ne restitue pas encore l'objectif, les sections tickets/approvals/artifacts ni le prochain arbitrage utile.
- A ce stade, aucun domaine `Ticket`, `ApprovalRequest` ou `Artifact` concret n'est implemente. Les projections `ticket-board`, `approval-queue` et `artifact-index` sont vides par construction et doivent etre lues comme telles.
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas supposer de commit history ou de worktree Git pour cette story.
- La pile effective actuelle est `Node >=20`, `TypeScript ^5.9.3`, compilation `CommonJS`, `strict: true`, tests via `node:test` et `assert/strict`.

### Architecture Compliance

- La reprise operateur doit lire d'abord `resume view`; si la projection est absente ou douteuse, elle doit etre reconstruite depuis le journal avant affichage. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 4.4 Process Patterns]
- Le journal append-only reste la source de verite. Les projections restent des vues reconstruisibles; cette story ne doit donc pas faire confiance aveuglement a `resume-view.json`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules]
- La CLI `corp` reste une surface operateur qui parle a des services applicatifs, pas un lieu pour implementer la logique de resume. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- La reprise doit pointer vers le prochain arbitrage utile, pas vers le transcript complet. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 4.4 Process Patterns]
- Aucun detail vendor OpenAI/Codex ne doit apparaitre dans la sortie CLI, dans le schema coeur ou dans les projections de cette story. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]
- Ne pas introduire `resource_budget` dans `Mission`, `resume-view` ou une nouvelle projection "par commodite". [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.1 Decision Table; 3.9 Journal and Projection Model]

### Product And Epic Guardrails

- La promesse produit du V1 est une reprise lisible sans reconstruction manuelle; si l'operateur doit encore fouiller les JSON ou le transcript pour comprendre quoi faire, la story rate sa cible. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Criteres De Succes; Parcours 2]
- L'Epic 1 couvre la mission persistante pilotable en CLI. La Story 1.3 doit ajouter la lecture/reprise, mais pas encore les mutations de cycle de vie de la Story 1.4. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 1; Story 1.3; Story 1.4]
- La sortie doit rester utilisable meme avant l'arrivee des tickets et approvals des epics suivants; les sections absentes doivent etre visibles comme vides, pas reportees a plus tard. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 1.3 Acceptance Criteria; NFR1]

### Previous Story Intelligence

- Reutiliser les seams deja poses en 1.1 et 1.2 plutot que de contourner le socle: `resolveWorkspaceLayout`, `bootstrapMissionWorkspace`, `createFileMissionRepository`, `appendEvent`, `DEFAULT_PROJECTIONS`, `createMissionStatusProjection`, `createResumeViewProjection`. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-1-initialiser-la-cli-v1-et-le-stockage-local-de-mission.md` - Completion Notes List; File List; `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md` - Previous Story Intelligence; File List]
- Le code actuel stocke deja les missions dans `.corp/missions/<missionId>/mission.json`; cette story doit etendre le repository fichier pour la lecture plutot que lire le JSON directement depuis la CLI. [Source: `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-mission-repository.ts`]
- `createMission` ecrit deja `mission-status.json` et `resume-view.json`; la logique de story 1.3 doit prolonger ces projections, pas les remplacer par un second systeme de cache. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/create-mission.ts`]
- Les tests existants montrent le style a conserver: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, sans Jest/Vitest ni helpers externes. [Source: `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`; `C:/Dev/PRJET/corp/tests/contract/mission-create-cli.test.ts`; `C:/Dev/PRJET/corp/tests/integration/create-mission.test.ts`]
- `dist/` est un artefact de build; ne pas le modifier manuellement. Toute nouvelle logique doit vivre sous `apps/`, `packages/` ou `tests/`. [Source: observation du repo `C:/Dev/PRJET/corp`]

### Implementation Guardrails

- Ne pas implementer de selection implicite de mission. Exiger `--mission-id` et produire une erreur deterministe si le flag manque ou si la mission n'existe pas.
- Ne pas introduire de nouvelle projection read-model parallele. La story doit s'appuyer sur `mission-status`, `ticket-board`, `approval-queue`, `artifact-index` et `resume-view`.
- Ne pas "resoudre" l'absence de tickets/approvals/artifacts en modelisant tout Epic 2 ou Epic 3. Dans cette story, ces sections peuvent rester vides mais doivent etre affichees proprement.
- Ne pas ajouter de base SQLite, de dependance npm supplementaire ou de parser externe pour cette lecture. Le pattern local `jsonl` / `json` pose en 1.1 et 1.2 reste la reference.
- Ne pas enregistrer d'evenement `mission.resume_requested`, `mission.status_viewed` ou equivalent dans cette story. La lecture/reconstruction doit rester une operation read-side sur les artefacts existants.
- Ne pas propager un transcript brut, un payload vendor ou tout le contenu du journal en sortie CLI. La commande doit produire un resume operateur, pas un dump d'audit.
- Ne pas casser les racines des projections (`mission`, `tickets`, `approvals`, `artifacts`, `resume`) ni leur `schemaVersion`.
- Si `resume-view.json` est absent ou corrompu mais que le journal et le snapshot mission sont exploitables, reconstruire et continuer. Si le journal est lui-meme inexploitable, echouer explicitement plutot que fabriquer un etat fictif.
- Garder une seule source de logique pour `mission status` et `mission resume`; l'alias CLI peut diverger de vocabulaire, pas de comportement metier.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/storage/src/projection-store/file-projection-store.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `tests/contract/mission-resume-cli.test.ts`
- `tests/integration/mission-resume.test.ts`

### Resume Contract Requirements

Le service de reprise doit exposer un resume normalise, meme si certaines sections sont encore vides au scope actuel. Le minimum attendu pour cette story est:

- `missionId`: identifiant stable `mission_*`.
- `title`: titre de mission.
- `objective`: objectif courant.
- `status`: statut mission lisible (`ready` au minimum sur le flux actuel).
- `successCriteria`: liste ordonnee des criteres de succes.
- `openTickets`: liste vide tant qu'aucun ticket n'existe encore, puis derivee de `ticket-board`.
- `pendingApprovals`: liste vide tant qu'aucune approval n'existe encore, puis derivee de `approval-queue`.
- `lastRelevantArtifact`: `null` tant qu'aucun artefact n'existe encore, puis derive du dernier element pertinent de `artifact-index`.
- `lastEventId`: dernier `event_*` connu pour la mission.
- `updatedAt`: horodatage le plus recent exploitable pour la mission reprise.
- `nextOperatorAction`: phrase courte, determinee a partir de l'etat observe.

Regle de derivation minimale pour `nextOperatorAction`:

- si des approvals sont en attente: demander l'arbitrage explicite;
- sinon si des tickets ouverts ou bloques existent: pointer vers le prochain ticket ou blocage;
- sinon, dans le scope actuel, indiquer explicitement qu'aucun ticket n'existe encore et que la prochaine etape probable releve de la suite Epic 1 / Epic 2.

### Reconstruction Requirements

- Pour l'Epic 1, la reconstruction doit supporter au minimum `mission.created` comme point de depart du resume journal-based.
- La reconstruction doit lire le journal de la mission dans l'ordre append-only et retenir le dernier `eventId` applicable a la mission.
- Si un evenement journalise embarque `payload.mission`, cette representation doit servir de base de reconstruction pour l'etat mission au scope actuel.
- `mission-status` peut etre utilise comme vue pratique, mais il ne suffit pas a lui seul pour declarer `resume-view` fiable sans verification du `lastEventId`.
- `resume-view.json` reste, a ce stade, une projection unique du dernier resume calcule. Il est acceptable qu'elle reflete la mission consultee le plus recemment, a condition que `missionId` soit explicite et que le service sache la reconstruire a la demande.

### CLI Requirements

- Etendre l'aide `corp mission help` pour presenter `status` et `resume`.
- Garder des erreurs deterministes en francais pour:
  - `--mission-id` manquant
  - mission inconnue
  - workspace non initialise
  - projection/journal irreconciliables
- La sortie doit tenir en un seul flux scannable par operateur, avec des labels stables et sans surcharge verbale.
- Ne pas introduire de mode interactif, de pagination, de prompt de selection ou de listing multi-missions dans cette story.

### Testing Requirements

- Verifier que `corp mission help` mentionne `status` et `resume` sans fuite vendor.
- Verifier qu'une mission creee en 1.2 peut etre reouverte par `mission status` et `mission resume` avec restitution de l'objectif et des criteres de succes.
- Verifier que les sections `tickets`, `approvals` et `dernier artefact` restent affichees et vides quand aucun domaine aval n'existe encore.
- Verifier qu'une projection `resume-view` absente, corrompue ou stale est reconstruite avant sortie CLI.
- Verifier que le fichier `resume-view.json` est reecrit avec la vue reconstruite.
- Verifier que l'erreur "mission inconnue" ne degrade ni le journal ni les projections.
- Conserver la suite `npm test` verte avec build TypeScript prealable.

### Scope Exclusions

- Hors scope: pause, relance et cloture de mission; ces transitions appartiennent a la Story 1.4.
- Hors scope: creation, edition, priorisation ou execution de tickets; ces sujets appartiennent a l'Epic 2.
- Hors scope: file d'approbation operationnelle, audit chronologique riche et relance ciblee; ces sujets appartiennent a l'Epic 3.
- Hors scope: selection automatique d'une mission par "derniere mission creee" ou "mission unique du workspace".
- Hors scope: refonte du stockage en base de donnees, migration de format ou event-sourcing complet multi-epics.

### Latest Technical Information

- Le repo actuel epingle `Node >=20.0.0`, `TypeScript ^5.9.3` et `@types/node ^24.5.2`; rester aligne sur cette baseline au lieu d'ajouter un outillage supplementaire. [Source: `C:/Dev/PRJET/corp/package.json`]
- La compilation cible `ES2022`, `CommonJS`, `moduleResolution: Node`, avec `strict: true` et `noEmitOnError: true`; toute nouvelle implementation doit respecter cette configuration. [Source: `C:/Dev/PRJET/corp/tsconfig.json`]
- Cette story ne touche pas encore aux adaptateurs Codex/OpenAI; aucune nouvelle dependance externe ni verification API n'est requise pour livrer la lecture/reprise locale. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.4 Interpretation pratique pour `corp`]

### Hypotheses Explicites

- Pour l'Epic 1, un resume fiable peut etre reconstruit a partir du journal + des projections existantes sans attendre les domaines tickets/approvals/artifacts complets.
- Le `nextOperatorAction` peut rester simple et deterministe tant que la mission n'a pas encore de tickets: l'important est de rendre l'absence de travail aval explicite et lisible.
- La story suppose que le snapshot mission persiste sous `.corp/missions/<missionId>/mission.json` reste la convention de stockage active tant qu'aucune autre story ne la remplace explicitement.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Overview; Additional Requirements; Epic 1; Story 1.2; Story 1.3; Story 1.4; NFR1
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Criteres De Succes; Parcours 2; Exigences Fonctionnelles FR2, FR3; Exigences Non Fonctionnelles
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 4.1 Domain Consistency Rules; 4.4 Process Patterns; 5.2 Architectural Boundaries
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - Executive Summary; 3.3 Proposition de forme canonique; 5.4 Interpretation pratique pour `corp`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-1-initialiser-la-cli-v1-et-le-stockage-local-de-mission.md` - Completion Notes List; File List
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md` - Previous Story Intelligence; Implementation Guardrails; References
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/index.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/create-mission.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-mission-repository.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/projection-store/file-projection-store.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/mission-status-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-create-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/bootstrap-workspace.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/create-mission.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Etendre le contrat `resume-view` pour porter un resume normalise complet tout en gardant `schemaVersion: 1` et la racine `resume`.
- Introduire `readMissionResume` dans le `mission-kernel` pour charger la mission par repository, lire les projections existantes, verifier la coherence du journal et reconstruire `resume-view` si necessaire.
- Garder `apps/corp-cli` au niveau parsing/formatage en ajoutant `mission status`, `mission resume` et un formateur de sortie operateur unique.

### Debug Log References

- 2026-04-09: `npm test` rouge apres ajout des tests 1.3, comme attendu avant implementation des commandes `status` / `resume` et de l'enrichissement `resume-view`.
- 2026-04-09: `npm test` vert apres ajout du service `readMissionResume`, des helpers de lecture repository/projection/journal, du formateur CLI et des tests de reconstruction de `resume-view` (build TypeScript + 16 tests).

### Completion Notes List

- La CLI expose maintenant `corp mission status` et `corp mission resume`, avec `--mission-id` obligatoire, une aide mise a jour et une sortie mission-centrique scannable en un seul flux.
- Le `mission-kernel` lit la mission via `FileMissionRepository`, verifie `resume-view`, s'appuie sur `mission-status`, `ticket-board`, `approval-queue`, `artifact-index` et reconstruit `resume-view` depuis le journal append-only si la projection est absente, invalide ou stale.
- Le contrat de `resume-view` a ete enrichi pour inclure objectif, criteres, sections vides, dernier artefact, `lastEventId`, `updatedAt` et `nextOperatorAction`, sans modifier `schemaVersion` ni ajouter d'evenement de lecture.
- La couverture de tests inclut l'aide CLI, les erreurs deterministes (`--mission-id`, mission inconnue, workspace non initialise), la reprise scannable, et la reconstruction de `resume-view` absente ou stale.

### File List

- `_bmad-output/implementation/1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission.md`
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/projection-store/file-projection-store.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `tests/contract/mission-resume-cli.test.ts`
- `tests/integration/create-mission.test.ts`
- `tests/integration/mission-resume.test.ts`

## Change Log

- 2026-04-09: implementation complete de `corp mission status` / `corp mission resume`, enrichissement du contrat `resume-view`, reconstruction read-side depuis le journal append-only et couverture de tests associee; statut passe a `review`.
