# Story 2.4: Suivre l'avancement et les blocages d'un ticket depuis la mission

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want voir l'etat de chaque ticket et ses raisons de blocage,
so that je sache quoi arbitrer ou relancer en priorite.

## Acceptance Criteria

1. Given des tickets sont en cours, bloques, en attente d'approbation ou termines
   When l'operateur consulte la mission ou le board des tickets
   Then la CLI affiche pour chaque ticket son statut, son owner, ses dependances et son motif de blocage si pertinent
   And les etats `todo`, `claimed`, `in_progress`, `blocked`, `awaiting_approval`, `done`, `failed`, `cancelled` restent clairement distingues

2. Given un ticket depend d'autres tickets
   When le dispatcher evalue son eligibilite
   Then ce ticket ne devient runnable que lorsque ses prerequis sont resolus
   And toute transition visible provient d'un evenement journalise au prealable

## Tasks / Subtasks

- [x] Exposer une surface CLI mission-centrique de suivi des tickets sans casser la reprise existante (AC: 1)
  - [x] Ajouter une commande explicite `corp mission ticket board` sous la CLI existante, avec parsing strict de `--root` et `--mission-id`, plutot que d'exiger une lecture directe de `ticket-board.json` par l'operateur.
  - [x] Faire de `corp mission status` la vue mission detaillee orientee supervision, incluant un bloc lisible `Etat des tickets` derive du board, tout en gardant `corp mission resume` compact et centre sur le prochain arbitrage utile.
  - [x] Garder `apps/corp-cli` limite au parsing, a l'appel de service et au rendu; ne pas y lire les JSON de projection inline, ne pas y recalculer les dependances et ne pas y inferrer des statuts depuis `adapterState`.
  - [x] Etendre `corp mission help` pour presenter `corp mission ticket board` et le positionnement clair `status = vue mission detaillee`, `resume = vue de reprise compacte`, sans fuite vendor et sans nouvelle commande top-level hors namespace `mission`.
  - [x] Produire des erreurs deterministes en francais pour: `--mission-id` manquant sur `ticket board`, workspace non initialise, mission inconnue, projection `ticket-board` irreconciliable sans source de reconstruction suffisante.
  - [x] Garantir une sortie standard scannable et stable: une ligne par ticket avec statut explicite, owner, dependances et motif de blocage/progression si pertinent, sans dump JSON brut, sans `response_id`, sans `vendorStatus`, sans curseur de stream, sans payload d'evenement.

- [x] Introduire un service read-side dedie pour lire et, si besoin, reconstruire le board ticket mission-local (AC: 1, 2)
  - [x] Ajouter un seam de lecture explicite, recommande ici sous la forme `packages/ticket-runtime/src/planner/read-ticket-board.ts`, plutot que de dupliquer la logique dans `mission-command.ts`.
  - [x] Charger la mission via `FileMissionRepository`, les tickets via `FileTicketRepository.listByMissionId(...)` et les tentatives via `FileExecutionAttemptRepository`, afin de reconstituer une vue de suivi mission-locale sans scanner l'ensemble du workspace.
  - [x] Si `ticket-board.json` est absent, stale, d'un `schemaVersion` inattendu ou rattache a une autre mission, reconstruire la projection depuis les snapshots mission/ticket/attempt existants, a l'image de la logique defensive deja utilisee par `readMissionResume(...)`.
  - [x] Preserver `mission.ticketIds` comme ordre canonique de lecture et de rendu; ne jamais reordonner le board par date, par statut ou par heuristique de priorite cachee.
  - [x] Si un read-side compose est utile pour `corp mission status`, introduire un helper mission-centrique (par exemple `read-mission-status.ts`) qui assemble `resume + ticket board` sans faire de la CLI la couche d'orchestration.

- [x] Enrichir `TicketBoardProjection` avec les metadonnees minimales necessaires au suivi d'avancement et aux motifs de blocage (AC: 1, 2)
  - [x] Etendre `TicketBoardEntry` pour exposer, en plus des champs existants, des metadonnees structurees de suivi recommandees ici comme:
    - un resume de dependances avec statut par prerequis (`dependencyStatuses` ou equivalent),
    - un code/etat de suivi lisible (`trackingState` ou equivalent) distinct du `status` coeur,
    - un motif structure de blocage ou de progression (`statusReasonCode`, `blockingReasonCode` ou equivalent),
    - un resume minimal de tentative active/derniere tentative (`activeAttemptId`, `activeAttemptStatus`, `lastAttemptId` ou equivalent) quand ces donnees existent.
  - [x] Conserver `status` comme source de verite brute du ticket et ne jamais le remplacer par un label UI ambigu; `todo`, `claimed`, `in_progress`, `blocked`, `awaiting_approval`, `done`, `failed`, `cancelled` doivent tous rester discernables.
  - [x] Garder `ticket-board.json` comme unique projection officielle de planification/suivi ticket en V1; ne pas creer `attempt-board.json`, `run-board.json`, `status-board.json` ou tout autre read-model parallele.
  - [x] Si des donnees de tentative sont projetees, n'y exposer que des champs coeur utiles au suivi (`attemptId`, `status`, `startedAt`, `endedAt`, `backgroundRequested`, `workspaceIsolationId`) et jamais `adapterState`, `response_id`, `pollCursor`, `sequence_number`, `model` ni details HTTP.

- [x] Durcir la logique de runnability et de motifs de blocage a partir des snapshots et tentatives deja en place (AC: 1, 2)
  - [x] Reutiliser `mission.ticketIds`, `Ticket.status`, `dependsOn[]` et `ExecutionAttempt.status` pour distinguer clairement:
    - ticket runnable,
    - ticket en cours (`claimed` / `in_progress`),
    - ticket bloque par prerequis non termines,
    - ticket bloque par prerequis `cancelled`,
    - ticket bloque par prerequis `failed`,
    - ticket en `awaiting_approval`,
    - ticket terminal `done|failed|cancelled`.
  - [x] Continuer a faire de la regle V1 la source de verite: un ticket n'est runnable que si `status === "todo"` et que tous ses prerequis sont `done`; toute autre combinaison doit etre visible comme non runnable avec un motif explicite.
  - [x] Traiter `blocked` comme un statut coeur prioritaire lorsqu'il est deja present sur le ticket, au lieu de l'ecraser par une inference de dependance plus faible.
  - [x] Ne pas inventer d'evenements synthetiques `ticket.runnable`, `ticket.unblocked`, `ticket.board_viewed` ou similaires juste pour l'UI; les transitions visibles dans le board doivent etre derivees des evenements deja journalises (`ticket.updated`, `ticket.cancelled`, `execution.completed`, `execution.failed`, etc.).
  - [x] Ne pas faire dependre la lisibilite des blocages d'un transcript brut ou de `adapterState`; le motif visible doit etre reconstructible a partir des snapshots coeur et de la projection ticket.

- [x] Rendre le rendu operateur scannable sans melanger supervision detaillee et reprise compacte (AC: 1)
  - [x] Introduire un formatter dedie au board, recommande ici comme `apps/corp-cli/src/formatters/ticket-board-formatter.ts`, et si necessaire un formatter `mission-status` qui compose resume + section board sans dupliquer les regles de presentation.
  - [x] Pour chaque ticket, afficher au minimum:
    - son identifiant ou son ordre canonique,
    - son statut coeur,
    - son owner,
    - ses dependances,
    - son motif de blocage ou de progression si pertinent.
  - [x] Utiliser un wording francais stable et actionnable pour les motifs visibles, par exemple: prerequis en attente, prerequis annule, prerequis en echec, ticket en cours, ticket en attente d'approbation, ticket termine.
  - [x] Garder `corp mission resume` centre sur l'objectif, les tickets ouverts, les validations en attente et le prochain arbitrage utile; ne pas le transformer en dump complet de board.
  - [x] Si aucun ticket n'existe, conserver un message explicite du type `Aucun ticket n'existe encore.`; si des tickets existent mais qu'aucun n'est runnable, le rendu doit l'expliquer sans ambiguite.

- [x] Ajouter la couverture de tests et les non-regressions necessaires (AC: 1, 2)
  - [x] Ajouter un test contractuel CLI pour `corp mission ticket board` et mettre a jour l'aide `mission help`, avec messages d'erreur stables en francais et sans fuite `codex`, `openai`, `response_id`, `vendorStatus` ni JSON brut.
  - [x] Ajouter un test d'integration `status + board` couvrant une mission contenant au minimum des tickets `todo`, `in_progress`, `done`, `failed` et `cancelled`, afin de verifier la distinction visuelle et le motif de blocage/progression rendu pour chacun.
  - [x] Ajouter un scenario couvrant un ticket dependant d'un prerequis `done`, puis `cancelled`, puis `failed`, pour verifier que le board expose un motif de blocage structure differencie et que le ticket ne devient runnable qu'une fois ses prerequis reellement resolus.
  - [x] Ajouter un test de reconstruction qui supprime ou corrompt `ticket-board.json`, puis verifie que `corp mission ticket board` et `corp mission status` peuvent rebuilder une projection valide a partir des snapshots mission/ticket/attempt.
  - [x] Ajouter un test de non-regression prouvant qu'aucune donnee vendor stockee dans `ExecutionAttempt.adapterState` n'apparait dans `mission status`, `mission resume`, `ticket board` ni `ticket-board.json`.
  - [x] Etendre les tests existants de `mission status` / `mission resume` pour verifier que `status` devient la vue detaillee avec board, tandis que `resume` reste synthetique et oriente arbitrage.
  - [x] Conserver `npm test` vert sur l'ensemble de la suite existante, actuellement a 66 tests verts sur `C:/Dev/PRJET/corp` au 2026-04-09.

## Dev Notes

### Story Intent

Cette story transforme la projection `ticket-board` en vraie surface operateur de supervision. 2.2 a pose le runnable set minimal et 2.3 a ouvert les tentatives d'execution. 2.4 doit maintenant rendre ces etats lisibles depuis la mission, sans introduire encore l'index d'artefacts riche de 2.5 ni les mecanismes d'approbation complets de l'Epic 3.

### Current Project State

- Le repo fournit aujourd'hui une boucle mission-centrique complete pour `bootstrap`, `create`, `status`, `resume`, `pause`, `relaunch`, `close`, `ticket create`, `ticket update`, `ticket move`, `ticket cancel` et `ticket run`, avec stockage local sous `.corp/`, journal append-only, projections JSON et adaptation `codex_responses`.
- `buildTicketBoardProjection(...)` existe deja et calcule `planOrder`, `runnable`, `blockedByTicketIds` et `planningState`, mais le board reste une projection surtout technique et non une vraie vue operateur de suivi. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`; `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`]
- `corp mission status` et `corp mission resume` utilisent encore le meme formatter `formatMissionResume(...)`. Il n'existe pas encore de vue detaillee `status` ni de commande `corp mission ticket board`. [Source: `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`; `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`]
- La Story 2.3 a deja introduit `ExecutionAttempt`, son repository fichier et le service `run-ticket`, avec des tickets pouvant etre `claimed`, `in_progress`, `done` ou `failed` en fonction des evenements d'execution. [Source: `C:/Dev/PRJET/corp/packages/contracts/src/execution-attempt/execution-attempt.ts`; `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-execution-attempt-repository.ts`; `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`]
- `readMissionResume(...)` sait reconstruire `resume-view.json` quand la projection est absente, stale ou corrompue; 2.4 doit reprendre cette philosophie defensive pour le board, sans inventer un bypass CLI. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`]
- Aucune vraie projection d'artefacts ni d'approvals n'est encore materialisee au-dela des stubs `artifact-index.json` et `approval-queue.json`; ces fichiers ne doivent pas etre redefines dans cette story.
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas supposer de commit history ni de worktree local a cette racine pour la story 2.4.
- Verification locale effectuee le 2026-04-09: `npm test` passe en entier avec 66 tests verts sur l'etat courant du repo.

### Architecture Compliance

- Le contrat coeur V1 reste borne a `Mission`, `Ticket`, `ExecutionAttempt`, `Event` et `Artifact`; 2.4 doit enrichir la lecture operateur sans etendre le schema coeur avec des champs de presentation ad hoc. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract]
- Les projections officielles V1 restent `mission status`, `ticket board`, `approval queue`, `artifact index`, `resume view`; 2.4 doit enrichir `ticket-board` et ses consommateurs, pas introduire une projection concurrente. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.5 Enforcement Guidelines]
- La CLI reste une couche d'interface. La lecture et la reconstruction du board doivent vivre dans des services/read-side dedies, pas dans `apps/corp-cli`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- Toute transition visible doit provenir d'un evenement journalise avant projection. 2.4 ne doit donc pas fabriquer des etats UI qui ne seraient pas derivables de l'historique mission/ticket/attempt. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 4.1 Domain Consistency Rules; 4.4 Process Patterns]
- Les details vendor OpenAI/Codex doivent rester confines a `executionHandle.adapterState` ou a `ExecutionAttempt.adapterState`; ils ne doivent pas remonter dans le board ou les sorties CLI. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]
- Le mapping requirements -> structure cible place planning/delegation dans `packages/ticket-runtime`, avec `planner/` comme seam attendu; un read-side `ticket board` y est donc legitime. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.1 Complete Project Directory Structure; 5.3 Requirements to Structure Mapping]

### Product And Epic Guardrails

- Le PRD demande que l'operateur puisse suivre l'etat des taches, identifier ce qui est bloque, echoue ou requiert une action, puis reprendre sans relire le transcript brut. 2.4 doit materialiser ce besoin en CLI, pas seulement dans les fichiers de projection. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Parcours 1; Parcours 2; Execution & Artifact Flow; Reprise Et Auditabilite; FR11; FR14]
- L'Epic 2 veut permettre de suivre la progression et les blocages depuis la mission. 2.4 doit donc rendre la lecture du `ticket-board` utile pour un operateur humain, tout en restant alignee avec les choix d'ordre canonique et de runnability poses en 2.2 puis 2.3. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.2; Story 2.3; Story 2.4]
- La Story 2.4 ne doit pas devenir l'index d'artefacts ou de decisions; la navigation riche vers les sorties d'execution appartient a la Story 2.5. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 2.5 Acceptance Criteria]
- La Story 2.4 ne doit pas anticiper le systeme complet d'approbations de l'Epic 3. Elle peut afficher `awaiting_approval` si ce statut existe, mais ne doit pas introduire une queue d'approbation parallele ni des evenements `approval.*`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3; Story 3.1; Story 3.2]

### Previous Story Intelligence

- La Story 2.2 a etabli `mission.ticketIds` comme ordre canonique du plan, ainsi que la projection `ticket-board` enrichie du runnable set minimal. 2.4 doit reutiliser ce socle au lieu de le contourner. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md`]
- La Story 2.3 a introduit les statuts actifs `claimed` et `in_progress`, le repository `ExecutionAttempt`, la normalisation des etats d'execution et le message de reprise `Suivez le ticket en cours...`; 2.4 doit donner a cette information une vraie surface de suivi par ticket. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`]
- `deriveNextOperatorAction(...)` distingue deja approvals, ticket actif et prochain ticket runnable. 2.4 ne doit pas casser cette logique; elle doit la completer avec un rendu board plus detaille, pas la remplacer par un second systeme d'arbitrage. [Source: `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`]
- `rewriteMissionReadModels(...)` reecrit deja `mission-status` et `ticket-board` apres les mutations ticket/run. 2.4 doit rester compatible avec ce point central de projection et ne pas brancher un rendu a partir de snapshots divergents. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`]
- `FileExecutionAttemptRepository.listByTicketId(...)` et `findActiveByTicketId(...)` offrent deja un seam fiable pour enrichir la lecture operateur avec l'etat courant d'une tentative, sans rescanner le journal ni parser des traces vendor. [Source: `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-execution-attempt-repository.ts`]

### Ticket Board And Tracking Requirements

Le board operateur de cette story doit traiter les regles suivantes comme contrat de lecture V1:

- `mission.ticketIds` reste l'ordre canonique d'affichage.
- `ticket-board.json` reste la projection officielle de suivi ticket V1.
- `status` du ticket reste la source de verite brute et doit toujours etre affiche ou derivable tel quel.
- Les motifs visibles doivent etre derives de facon deterministe a partir de `Ticket.status`, `dependsOn[]` et, si necessaire, `ExecutionAttempt.status`.
- Si un ticket a des prerequis:
  - il est runnable seulement si tous sont `done` et que son propre `status === "todo"`;
  - il est bloque par annulation si au moins un prerequis est `cancelled`;
  - il est bloque par echec si au moins un prerequis est `failed`;
  - il est en attente de prerequis si certains prerequis ne sont pas encore `done` mais ne sont ni `failed` ni `cancelled`.
- Si un ticket est `claimed` ou `in_progress`, le board doit le signaler comme actif, pas comme simplement "non runnable".
- Si un ticket est `awaiting_approval`, le board doit l'exposer explicitement comme tel, meme si l'Epic 3 n'est pas encore materialise.
- Si un ticket est `done`, `failed` ou `cancelled`, le board doit le garder visible pour l'audit au lieu de le cacher des vues detaillees.
- Aucune donnee de board ne doit dependre d'un transcript, d'un JSONL vendor ou de `adapterState`.

### Mission Status And CLI Contract Requirements

- `corp mission status` doit devenir la vue mission detaillee et inclure une section board lisible ticket par ticket.
- `corp mission resume` reste la vue compacte de reprise et ne doit pas se transformer en dump exhaustif de board.
- `corp mission ticket board` devient la vue explicite "board only" pour le suivi de tickets.
- `corp mission ticket board` doit exiger `--mission-id` et accepter `--root`.
- L'aide `corp mission help` doit presenter clairement les trois surfaces:
  - `status` = etat utile detaille de mission
  - `resume` = reprise operateur compacte
  - `ticket board` = supervision ticket par ticket
- Les sorties CLI doivent rester textuelles, scannables et mission-centriques; ne pas introduire de mode `--json`, de table ANSI complexe, ni de top-level `corp board`.
- Les messages d'erreur doivent rester stables, francais et actionnables.

### Event And Projection Requirements

- Ne pas creer de nouveaux evenements purement lies a l'affichage ou a la reconstruction du board.
- Les transitions visibles dans le board doivent etre explicables par des evenements deja appendes (`ticket.updated`, `ticket.cancelled`, `ticket.claimed`, `execution.requested`, `execution.completed`, `execution.failed`, etc.).
- Si `ticket-board.json` doit etre reconstruit, la reconstruction doit reposer sur les snapshots mission/ticket/attempt et reecrire la projection de facon deterministe.
- `mission-status.json` continue de refleter le snapshot mission le plus recent; 2.4 ne doit pas lui faire porter des donnees detaillees ticket par ticket.
- `resume-view.json` peut continuer a consommer le board enrichi, mais ne doit pas dupliquer toute la semantique de suivi ticket.
- `approval-queue.json` et `artifact-index.json` doivent rester strictement inchanges dans cette story.
- Si des metadonnees de tentative sont projetees dans `ticket-board.json`, elles doivent rester normalisees sur les statuts coeur `requested|running|awaiting_approval|completed|failed|cancelled` et ne jamais exposer `queued` / `in_progress` vendor.

### Implementation Guardrails

- Ne pas ajouter de dependance npm externe; la baseline Node 20 + TypeScript actuelle suffit.
- Ne pas creer un nouveau read-model parallele pour les attempts, les blocages ou les resumes operateur.
- Ne pas introduire de lecture directe du journal dans la CLI si un repository/projection suffit.
- Ne pas exposer ni persister dans le board des secrets, headers, prompts complets, `response_id`, curseurs, sequence numbers ou model names vendor.
- Ne pas casser la sortie compacte de `corp mission resume`.
- Ne pas transformer `MissionResumeTicket` en contrat rigide cassant; si des champs supplementaires sont utiles au resume, les ajouter de facon compatible avec la souplesse actuelle.
- Ne pas auto-mutuer le statut d'un ticket juste pour "faire joli" dans le board; l'etat affiche doit suivre le snapshot coeur.
- Ne pas introduire encore la navigation artefact -> evenement -> ticket; cela appartient a 2.5.
- Ne pas toucher `dist/` manuellement et ne pas court-circuiter `npm test`.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `apps/corp-cli/src/formatters/ticket-board-formatter.ts`
- `apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/contracts/src/execution-attempt/execution-attempt.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/storage/src/repositories/file-execution-attempt-repository.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/contract/mission-resume-cli.test.ts`
- `tests/contract/mission-ticket-board-cli.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/integration/cancel-ticket.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/integration/ticket-board.test.ts`

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`, sans Jest/Vitest ni mock externe.
- Verifier que `corp mission help` mentionne `corp mission ticket board` et continue de distinguer `status` / `resume` sans fuite vendor.
- Verifier que `corp mission ticket board` exige `--mission-id`, echoue proprement si le workspace n'est pas initialise et retourne une erreur stable si la mission est inconnue.
- Verifier qu'un board contenant des tickets `todo`, `claimed`, `in_progress`, `done`, `failed`, `cancelled` reste clairement distingue en CLI et en projection.
- Verifier qu'un ticket dependant d'un prerequis non `done` n'est jamais marque runnable, et que le motif de blocage differe entre prerequis en attente, prerequis annule et prerequis en echec.
- Verifier qu'un ticket `claimed` ou `in_progress` est rendu comme "en cours" et non comme simplement "non runnable".
- Verifier que `corp mission status` expose le board detaille alors que `corp mission resume` reste synthetique.
- Verifier que la suppression/corruption de `ticket-board.json` declenche une reconstruction valide via le service read-side.
- Verifier explicitement qu'aucune valeur provenant de `ExecutionAttempt.adapterState` n'apparait dans le rendu CLI ni dans la projection board enrichie.
- Conserver `npm test` vert sur l'ensemble de la suite existante, actuellement a 66 tests verts.

### Scope Exclusions

- Hors scope: indexation et navigation riche des artefacts produits par un ticket (Story 2.5).
- Hors scope: queue d'approbation fonctionnelle, arbitrage humain complet et evenements `approval.*` (Epic 3).
- Hors scope: relance selective d'une branche de tickets apres echec global de mission (Story 3.5).
- Hors scope: ajout d'un read-model attempt dedie, d'un daemon de polling permanent ou d'une UI TUI/web.
- Hors scope: exposition de details vendor OpenAI/Codex dans les sorties operateur.
- Hors scope: merge/reconciliation d'isolation workspace, cleanup automatique ou nouvelles mutations runtime.

### Latest Technical Information

- Le repo actuel epingle `Node >=20.0.0`, `TypeScript ^5.9.3`, `ES2022`, `CommonJS`, `strict: true` et `noEmitOnError: true`; toute nouvelle lecture/projection/formatter 2.4 doit rester compatible avec cette baseline sans dependance externe. [Source: `C:/Dev/PRJET/corp/package.json`; `C:/Dev/PRJET/corp/tsconfig.json`]
- Verification officielle OpenAI faite le 2026-04-09: le guide `Background mode` confirme que les runs en fond se pilotent avec `background=true`, que le polling se poursuit tant que le statut reste `queued` ou `in_progress`, et que l'annulation passe par `responses.cancel(...)`. 2.4 doit continuer a afficher seulement des statuts coeur normalises (`requested`, `running`, etc.), jamais ces statuts vendor bruts. [Source: `https://developers.openai.com/api/docs/guides/background`]
- La meme page officielle precise aussi qu'un run background stocke les donnees de reponse environ 10 minutes pour permettre le polling et n'est pas compatible ZDR; toute surface operateur 2.4 doit donc rester centree sur l'etat `corp` reconstruit localement plutot que sur des semantiques de retention vendor. [Source: `https://developers.openai.com/api/docs/guides/background`]
- Verification officielle OpenAI faite le 2026-04-09: la page `All models` liste plusieurs familles Codex (`GPT-5-Codex`, `GPT-5.3-Codex`, `GPT-5.2-Codex`, `GPT-5.1 Codex`, `GPT-5.1-Codex-Max`, `GPT-5.1 Codex mini`) et marque `codex-mini-latest` comme deprecated. 2.4 ne doit donc ni figer ni afficher un alias modele vendor comme information coeur de board. [Source: `https://developers.openai.com/api/docs/models/all`]
- La page officielle `GPT-5-Codex` indique egalement que `GPT-5-Codex` est disponible via la `Responses API` et que son snapshot sous-jacent est regulierement mis a jour. Cette volatilite renforce la regle 2.4: le board operateur suit l'etat `corp`, pas un alias modele vendor. [Source: `https://developers.openai.com/api/docs/models/gpt-5-codex`]

### Hypotheses Explicites

- `corp mission status` devient la vue mission detaillee, tandis que `corp mission resume` reste la vue compacte de reprise.
- `corp mission ticket board` est la surface CLI explicite la plus simple pour satisfaire l'exigence "mission ou board des tickets" sans surcharger `resume`.
- La projection `ticket-board.json` peut etre enrichie avec des metadonnees de lecture operateur, a condition de ne pas devenir un doublon du schema coeur ni de `ExecutionAttempt.adapterState`.
- Une projection ticket enrichie peut rester la source de verite read-side pour le suivi, sans introduire de board attempt separe.
- Les statuts `awaiting_approval` et `blocked` doivent etre traites des maintenant comme citoyens de premiere classe dans le rendu, meme si leur generation complete arrivera plus tard dans la roadmap.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.2; Story 2.3; Story 2.4; Story 2.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Parcours 1; Parcours 2; Execution & Artifact Flow; Reprise Et Auditabilite; FR11; FR14; Resultats Mesurables
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 4.1 Domain Consistency Rules; 4.4 Process Patterns; 4.5 Enforcement Guidelines; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 3.3 Proposition de forme canonique; 4.1 Decision proposee; 5.2 Ce que les docs officielles confirment; 5.4 Interpretation pratique pour `corp`; 5.6 Decision de recherche recommandee
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/execution-attempt/execution-attempt.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-execution-attempt-repository.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-ticket-repository.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-resume-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/mission-resume.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/run-ticket.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/cancel-ticket.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/update-ticket.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`
- `https://developers.openai.com/api/docs/guides/background`
- `https://developers.openai.com/api/docs/models/all`
- `https://developers.openai.com/api/docs/models/gpt-5-codex`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Ajouter une lecture mission-locale du board ticket et la brancher a une nouvelle surface CLI `corp mission ticket board`, puis distinguer clairement `status` et `resume` au niveau des formatters.
- Enrichir `TicketBoardProjection` a partir des snapshots `Ticket` + `ExecutionAttempt` pour afficher des motifs de blocage/progression structures sans fuite vendor ni read-model parallele.
- Verrouiller l'ensemble avec des tests contractuels et d'integration sur le rendu, la reconstruction de projection, les transitions de runnability et l'absence de fuite `adapterState`.

### Debug Log References

- 2026-04-09: lecture complete de `sprint-status.yaml`, puis selection de `2-4-suivre-l-avancement-et-les-blocages-d-un-ticket-depuis-la-mission` comme premiere story `backlog` en ordre de lecture.
- 2026-04-09: analyse croisee de l'Epic 2, du PRD, de l'architecture, de la recherche technique, des stories 2.2 et 2.3 et du code reel (`build-ticket-board`, `readMissionResume`, `run-ticket`, CLI formatters) pour ancrer la story sur les seams deja en place.
- 2026-04-09: verification locale de l'etat courant via `npm test` dans `C:/Dev/PRJET/corp`, avec 66 tests verts avant creation de cette story.
- 2026-04-09: verification officielle complementaire des docs OpenAI sur `Background mode`, `All models` et `GPT-5-Codex` pour borner les exigences de normalisation d'etat et d'absence de fuite vendor.
- 2026-04-09: implementation du read-side `read-ticket-board`, enrichissement de `TicketBoardProjection`, ajout des formatters `mission-status` / `ticket-board` et branchement de `corp mission ticket board` dans la CLI sans lecture inline des JSON.
- 2026-04-09: durcissement de la reconstruction defensive de `ticket-board.json` depuis les snapshots mission/ticket/attempt, puis conservation stricte de l'ordre canonique `mission.ticketIds` et des motifs de blocage derives des snapshots coeur.
- 2026-04-09: execution de `npm test` apres alignement des tests historiques et des nouveaux tests Story 2.4, avec 73 tests verts sur `C:/Dev/PRJET/corp`.

### Completion Notes List

- Ajout de la commande `corp mission ticket board`, distinction claire entre `status` detaille et `resume` compact, et aide CLI enrichie avec positionnement explicite des trois surfaces.
- Introduction de `read-ticket-board` et `read-mission-status` pour reconstruire defensivement `ticket-board.json` a partir des snapshots mission/ticket/attempt, sans faire de la CLI une couche d'orchestration.
- Enrichissement de `ticket-board.json` avec `dependencyStatuses`, `trackingState`, `statusReasonCode`, `blockingReasonCode` et des resumes minimaux de tentative, sans fuite de `adapterState` ni de champs vendor.
- Normalisation du suivi runtime pour conserver les statuts coeur de tentative (`requested`, `awaiting_approval`, `completed`, etc.) et rendre les motifs de blocage/progression lisibles dans `status`, `resume` et `ticket board`.
- Ajout et extension des tests contractuels et d'integration couvrant l'aide, les erreurs deterministes, la reconstruction de projection, la distinction des statuts coeur, les motifs de blocage differencies et l'absence de fuite vendor.

### File List

- apps/corp-cli/src/commands/mission-command.ts
- apps/corp-cli/src/formatters/help-formatter.ts
- apps/corp-cli/src/formatters/mission-status-formatter.ts
- apps/corp-cli/src/formatters/ticket-board-formatter.ts
- packages/journal/src/projections/resume-view-projection.ts
- packages/journal/src/projections/ticket-board-projection.ts
- packages/mission-kernel/src/resume-service/read-mission-resume.ts
- packages/mission-kernel/src/resume-service/read-mission-status.ts
- packages/ticket-runtime/src/planner/build-ticket-board.ts
- packages/ticket-runtime/src/planner/read-ticket-board.ts
- packages/ticket-runtime/src/ticket-service/run-ticket.ts
- packages/ticket-runtime/src/ticket-service/ticket-service-support.ts
- tests/contract/mission-resume-cli.test.ts
- tests/contract/mission-ticket-board-cli.test.ts
- tests/integration/cancel-ticket.test.ts
- tests/integration/create-ticket.test.ts
- tests/integration/mission-resume.test.ts
- tests/integration/run-ticket.test.ts
- tests/integration/ticket-board.test.ts
- tests/integration/update-ticket.test.ts

## Change Log

- 2026-04-09: contexte complet de la Story 2.4 cree et statut passe a `ready-for-dev`.
- 2026-04-09: implementation complete de la Story 2.4, surfaces CLI `status` / `resume` / `ticket board` distinguees, projection `ticket-board` enrichie et reconstruction defensive ajoutee.
- 2026-04-09: couverture de tests et non-regressions etendues; `npm test` passe avec 73 tests verts, puis statut passe a `review`.
