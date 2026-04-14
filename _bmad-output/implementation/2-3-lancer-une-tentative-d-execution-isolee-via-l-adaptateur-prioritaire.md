# Story 2.3: Lancer une tentative d'execution isolee via l'adaptateur prioritaire

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want lancer un ticket runnable dans un espace de travail isole,
so that l'execution progresse sans contaminer le workspace principal ni le schema coeur.

## Acceptance Criteria

1. Given un ticket a des dependances resolues et un owner defini
   When l'operateur lance son execution
   Then un espace d'isolation est cree via worktree Git ou workspace dedie equivalent avant toute mutation
   And une seule `ExecutionAttempt` active est ouverte pour ce ticket a cet instant

2. Given l'execution utilise l'adaptateur prioritaire V1
   When une tentative est ouverte
   Then l'adaptateur retenu est `codex_responses`
   And les IDs vendor, curseurs de polling et autres details OpenAI/Codex restent confines a `executionHandle.adapterState`

3. Given un ticket long est configure pour du traitement asynchrone
   When l'adaptateur utilise le mode background
   Then les changements d'etat de run sont normalises en evenements `corp`
   And aucun statut vendor brut n'est expose comme primitive coeur de `Mission` ou `Ticket`

## Tasks / Subtasks

- [x] Exposer une commande CLI mission-centrique pour lancer un ticket via l'adaptateur prioritaire (AC: 1, 2, 3)
  - [x] Ajouter une surface `corp mission ticket run` sous la CLI existante, avec parsing explicite de `--root`, `--mission-id`, `--ticket-id` et d'un opt-in `--background` pour les tickets longs, sans introduire de top-level `corp run ...`.
  - [x] Garder `apps/corp-cli` limite au parsing, a l'appel de service et au rendu; ne pas y ouvrir de worktree, ne pas y appeler `fetch`, ne pas y reconstruire des chemins `.corp/`, et ne pas y manipuler les snapshots `Mission`, `Ticket` ou `ExecutionAttempt` inline.
  - [x] Produire des erreurs deterministes en francais pour: `--mission-id` manquant, `--ticket-id` manquant, mission inconnue, ticket introuvable, ticket non runnable, owner vide, tentative active deja ouverte, workspace non initialise, secret OpenAI absent, creation d'isolation impossible et echec d'adaptateur.
  - [x] Etendre `corp mission help` pour presenter `corp mission ticket run` en francais, sans fuite vendor (`openai`, `response_id`, JSON brut, flags internes) et sans exposer encore `codex exec`, MCP ou SDK comme surfaces CLI directes.
  - [x] Apres succes, afficher une ligne d'action concise du type `Tentative ouverte: <attempt_id>` puis le resume mission mis a jour; ne pas dumper de payload vendor, de prompt brut ou de details HTTP dans la sortie operateur.

- [x] Introduire le contrat `ExecutionAttempt` V1, son stockage fichier et la regle "une tentative active maximum" (AC: 1, 2)
  - [x] Ajouter `packages/contracts/src/execution-attempt/execution-attempt.ts` avec au minimum `ExecutionAttemptStatus = requested|running|awaiting_approval|completed|failed|cancelled` et le contrat `ExecutionAttempt` comprenant `id`, `ticketId`, `adapter`, `status`, `workspaceIsolationId`, `adapterState`, `startedAt`, `endedAt`.
  - [x] Conserver `ExecutionAttempt` petit et oriente audit: les details vendor vivent dans `adapterState`; les champs coeur eventuels comme `workspaceIsolationId` ou `backgroundRequested` ne doivent jamais etre enfouis dans cette map opaque.
  - [x] Etendre `packages/storage/src/fs-layout/workspace-layout.ts` avec un helper du type `resolveExecutionAttemptStoragePaths(layout, missionId, ticketId, attemptId)` et persister le snapshot sous `.corp/missions/<missionId>/tickets/<ticketId>/attempts/<attemptId>/attempt.json`.
  - [x] Ajouter `packages/storage/src/repositories/file-execution-attempt-repository.ts` avec les seams minimums `save(...)`, `findById(...)`, `listByTicketId(...)` et `findActiveByTicketId(...)`, au lieu de scanner le journal ou de stocker les attempts dans la CLI.
  - [x] Preallouer `attemptId` prefixe `attempt_` et faire respecter la regle "une seule tentative active" par repository + statuts actifs (`requested`, `running`, `awaiting_approval`), sans ajouter de `currentAttemptId` a `Mission` ou `Ticket`.

- [x] Creer la couche `workspace-isolation` V1 avant toute mutation ticket/mission (AC: 1)
  - [x] Introduire `packages/workspace-isolation/src/` comme premier seam explicite d'isolation, plutot que de melanger `git worktree`, copie fallback et metadata dans `ticket-runtime` ou dans la CLI.
  - [x] Etendre le `WorkspaceLayout` courant avec un `isolationsDir` repo-local dedie, recommande ici sous la forme `.corp/isolations/<isoId>/`.
  - [x] Implementer une strategie duale: preferer un worktree Git quand le workspace operateur cible est vraiment un repo Git exploitable; sinon creer un workspace dedie equivalent sous `.corp/isolations/<isoId>/workspace/`.
  - [x] Pour le fallback non Git, copier le workspace operateur en excluant au minimum `.corp/` pour eviter la recursion de l'etat runtime et la contamination des projections dans l'espace isole.
  - [x] Persister une metadata d'isolation (par exemple `isolation.json`) contenant au minimum `workspaceIsolationId`, `kind`, `sourceRoot`, `workspacePath`, `createdAt` et un indicateur de retention, puis emettre `workspace.isolation_created` une fois la creation physique reussie.
  - [x] Creer l'isolation avant toute mutation de `ticket.status`, `mission.status`, `mission.eventIds` ou `ExecutionAttempt.status`; si la creation echoue, la commande doit sortir sans journaliser une pseudo execution partielle.
  - [x] Dans cette story, retenir l'espace isole par defaut apres ouverture de tentative; ne pas implementer encore de merge automatique, de cleanup destructif ni de suppression opportuniste basee sur un diff.

- [x] Ajouter un service `run-ticket` qui orchestre validation, claim, tentative, adaptateur et transitions normalisees (AC: 1, 2, 3)
  - [x] Creer `packages/ticket-runtime/src/ticket-service/run-ticket.ts` comme service principal, et extraire au besoin des helpers dedies pour eviter une fonction monolithique.
  - [x] Charger la mission via `FileMissionRepository`, le ticket via `FileTicketRepository` et le plan courant via `buildTicketBoardProjection(...)` ou un seam partage equivalent afin de verifier que le ticket cible est bien `todo`, runnable et rattache a la mission courante.
  - [x] Refuser l'ouverture d'une execution si la mission est `blocked`, `awaiting_approval`, `failed`, `completed` ou `cancelled`; dans cette story, les statuts autorises pour demarrer une tentative sont `ready` ou `running`.
  - [x] Verifier explicitement que `ticket.owner` reste renseigne et que le ticket n'a aucune dependance non resolue; ne pas se contenter d'un appel CLI "optimiste" qui ignorerait le board calcule en 2.2.
  - [x] Reutiliser le pattern deja etabli en 1.2, 1.4, 2.1 et 2.2: validation stricte -> preallocation des IDs -> creation d'isolation -> append du journal -> persistance des snapshots -> projections -> resume, tout en factorisant les transitions successives dans des helpers explicites pour ne pas dupliquer la logique.
  - [x] Materialiser au minimum les transitions/event types suivants lorsque pertinents: `ticket.claimed`, `execution.requested`, `execution.background_started`, `execution.completed`, `execution.failed`; ne pas inventer de nouveaux statuts coeur pour coller a des statuts vendor.
  - [x] Faire evoluer les snapshots de maniere coherente:
    - `ticket.status`: `todo -> claimed -> in_progress` pour une tentative active, `done` pour une completion terminale, `failed` pour un echec terminal
    - `ticket.workspaceIsolationId`: renseigne avec `iso_*` des l'ouverture de tentative
    - `ticket.executionHandle.adapter`: reste `codex_responses`
    - `mission.status`: `running` tant qu'une tentative active existe, retour a `ready` apres une completion reussie si aucune autre tentative active n'existe, `failed` en cas d'echec terminal immediat
    - `mission.resumeCursor`, `mission.eventIds`, `ticket.eventIds`, `ticket.updatedAt`, `mission.updatedAt`: alignes sur le dernier evenement emis
  - [x] Ne jamais auto-cloturer la mission quand un ticket finit `done`; la fermeture explicite reste du ressort de `corp mission close`.
  - [x] En cas d'erreur reseau ou d'echec d'adaptateur apres `execution.requested`, convertir l'echec en `execution.failed` normalise et persister un `ExecutionAttempt` terminal plutot que de laisser le ticket dans un entre-deux non reconstructible.

- [x] Ajouter l'adaptateur prioritaire `codex_responses` comme seam testable, sans fuite vendor (AC: 2, 3)
  - [x] Introduire `packages/execution-adapters/codex-responses/src/` comme premier adaptateur concret V1, avec une interface explicite de lancement et, si necessaire, de recuperation d'une tentative de fond deja ouverte.
  - [x] Utiliser les primitives natives Node.js (`fetch`, `AbortController`) ou un transport injecte pour les tests; ne pas ajouter de dependance npm externe ou de SDK proprietaire juste pour cette story.
  - [x] Lire le secret OpenAI depuis l'environnement/local secret store au bord de l'adaptateur; ne jamais le stocker dans `Mission`, `Ticket`, `ExecutionAttempt`, le journal ou les projections.
  - [x] Rendre le `model` configurable a la frontiere de l'adaptateur (env/config locale ou seam explicite) au lieu de dependre d'un alias potentiellement stale dans le coeur. Le contrat coeur ne doit dependre d'aucun nom de modele codex exact.
  - [x] Mapper les statuts vendor de la `Responses API` vers les statuts `corp`:
    - `queued` -> `requested`
    - `in_progress` -> `running`
    - statut final de succes -> `completed`
    - statut final d'echec -> `failed`
    - annulation explicite -> `cancelled`
  - [x] Persister `response_id`, curseur de polling, sequence number de stream ou autres metadonnees vendor uniquement dans `ExecutionAttempt.adapterState` et `ticket.executionHandle.adapterState`, mis a jour via un helper partage pour eviter les divergences.
  - [x] Si `--background` est active, envoyer une requete compatible avec les contraintes officielles des Responses stockees, persister assez d'etat pour `retrieve` ou `cancel` plus tard, puis normaliser l'ouverture de run via des evenements `corp` sans exposer `queued` / `in_progress` comme statuts coeur.
  - [x] Ne pas implementer ni exposer `codex exec`, `codex mcp-server`, le SDK Codex ou des workflows `AGENTS.md` dans cette story; ces adaptateurs restent hors implementation concrete V1 ici.

- [x] Rafraichir les projections utiles et la reprise sans creer de read-model attempt parallele (AC: 1, 3)
  - [x] Continuer a s'appuyer sur `mission-status`, `ticket-board` et `resume-view`; ne pas creer `attempt-board.json`, `run-board.json` ou tout autre read-model parallele juste pour 2.3.
  - [x] Faire en sorte que `ticket-board.json` refleche immediatement les nouveaux statuts `claimed`, `in_progress`, `failed` et `done` via le champ `status` deja expose, sans re-designer encore l'affichage board complet qui appartient a la Story 2.4.
  - [x] Etendre `deriveNextOperatorAction(...)` de maniere minimale pour qu'un ticket `claimed` ou `in_progress` affiche une consigne de suivi explicite du type `Suivez le ticket en cours: <title>.`, au lieu du message trompeur `Aucun ticket n'est runnable...`.
  - [x] Garder `approval-queue.json` et `artifact-index.json` inchanges dans cette story; l'absence de mutation de ces projections fait partie du contrat tant que les Epics 2.5 et 3.1+ ne sont pas materialises.
  - [x] S'assurer que `readMissionResume(...)` reste capable de reconstruire un resume fiable depuis le journal + les projections si `resume-view.json` est stale ou manquant apres l'ouverture d'une tentative.

- [x] Ajouter la couverture de tests et les non-regressions necessaires (AC: 1, 2, 3)
  - [x] Ajouter un test contractuel `mission-ticket-run-cli.test.ts` pour l'aide et les gardes de surface de `corp mission ticket run`, avec messages d'erreur stables en francais et sans fuite vendor.
  - [x] Ajouter un scenario d'integration "foreground success" couvrant `bootstrap -> mission create -> ticket create -> ticket run`, avec adaptateur fake/injecte, en verifiant l'isolation creee, le snapshot `ExecutionAttempt`, la transition `ticket.claimed -> execution.requested -> execution.completed`, `ticket.status = done`, `mission.status = ready` et la coherence des `eventIds`.
  - [x] Ajouter un scenario d'integration "background start" verifiant qu'un `queued`/`in_progress` vendor devient une tentative `running`, un ticket `in_progress`, une mission `running`, et que `response_id` / curseurs restent confines a `adapterState`.
  - [x] Ajouter un test de garde prouvant qu'une seconde execution est refusee tant qu'une tentative `requested|running|awaiting_approval` existe deja pour le meme ticket.
  - [x] Ajouter un test de non-regression pour un ticket non runnable (dependance non resolue, statut non `todo`, mission `blocked`/`failed`) qui echoue sans muter journal, mission, ticket, attempts ni projections.
  - [x] Ajouter un test d'integration sur le fallback non Git (workspace dedie) et, si faisable localement de maniere deterministe, un test sur le chemin Git worktree; sinon, isoler la detection Git et couvrir unitairement la decision worktree vs fallback.
  - [x] Etendre `mission-resume.test.ts` pour verifier qu'apres lancement d'un ticket `in_progress`, le resume n'oriente plus vers la replanification mais vers le suivi du ticket en cours.
  - [x] Verifier explicitement que `approval-queue.json` et `artifact-index.json` restent byte-for-byte inchanges apres `ticket run`.
  - [x] Conserver `npm test` vert sur l'ensemble de la suite existante, actuellement a 55 tests verts sur `C:/Dev/PRJET/corp` au 2026-04-09.

## Dev Notes

### Story Intent

Cette story ouvre la premiere vraie tranche d'execution de l'Epic 2. Elle doit rendre un ticket runnable effectivement lancable dans un espace isole, avec une tentative d'execution auditable et un adaptateur `codex_responses` testable, sans pour autant deriver vers le board de suivi riche (2.4), l'indexation d'artefacts (2.5), la queue d'approbation (Epic 3) ni la plateforme d'extensions (Epic 4).

### Current Project State

- Le repo fournit aujourd'hui une boucle mission-centrique complete pour `bootstrap`, `create`, `status`, `resume`, `pause`, `relaunch`, `close`, `ticket create`, `ticket update`, `ticket move` et `ticket cancel`, avec stockage local sous `.corp/`, journal append-only et projections JSON minimales.
- Le contrat `Ticket` inclut deja `workspaceIsolationId`, `executionHandle.adapter` et `executionHandle.adapterState`, ainsi que les statuts `claimed`, `in_progress`, `blocked`, `awaiting_approval`, `done`, `failed`, `cancelled`, mais aucune commande CLI actuelle ne materialise encore de tentative d'execution.
- `buildTicketBoardProjection(...)` sait deja calculer le runnable set V1 a partir de `mission.ticketIds`, du graphe `dependsOn[]` et du statut `todo`; cette logique doit etre reutilisee pour refuser le lancement d'un ticket non runnable plutot que reevaluer les dependances dans la CLI. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`]
- `readMissionResume(...)` et `deriveNextOperatorAction(...)` priorisent aujourd'hui le prochain ticket runnable puis la replanification, mais ne distinguent pas encore un ticket deja en cours d'execution d'un plan simplement bloque. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`; `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`]
- Aucun contrat `ExecutionAttempt`, aucun repository d'attempt, aucun package `workspace-isolation` et aucun package `execution-adapters` n'existent encore dans le repo actuel.
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas conclure pour autant que le workspace operateur cible ne sera jamais Git. La logique d'isolation doit inspecter le `--root` runtime a l'execution, pas le repo `corp` lui-meme.
- Aucun document UX dedie n'a ete identifie dans `C:/Dev/PRJET/corp/_bmad-output/planning`; la sortie doit donc rester alignee sur la CLI actuelle, scannable, concise et mission-centrique.
- Verification locale effectuee le 2026-04-09: `npm test` passe en entier avec 55 tests verts sur l'etat courant du repo.

### Architecture Compliance

- Le contrat coeur V1 reste borne a `Mission`, `Ticket`, `ExecutionAttempt`, `Event` et `Artifact`; cette story doit introduire `ExecutionAttempt` sans gonfler inutilement `Mission` ou `Ticket` de champs runtime doublons. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Additional Requirements; `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract]
- Une seule tentative active maximum par ticket est autorisee en V1. Cette contrainte doit etre enforcee par un seam explicite de repository/service, pas seulement par une convention de CLI. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 2.3 Acceptance Criteria; `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.5 Execution Strategy]
- Aucun identifiant OpenAI/Codex ne doit sortir de `executionHandle.adapterState` ou d'un `ExecutionAttempt`; aucun `response_id`, `threadId`, `sequence_number` ou detail HTTP ne doit devenir un champ coeur de `Mission`, `Ticket` ou une primitive de resume. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]
- Toute execution mutatrice doit posseder une isolation de workspace explicite creee avant execution. Le workspace principal ne doit jamais etre modifie directement par un ticket mutateur. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.8 Workspace Isolation Strategy; 4.1 Domain Consistency Rules]
- `Responses API` est l'adaptateur prioritaire V1; `codex exec`, SDK et MCP restent des adaptateurs secondaires acceptes mais non requis pour ouvrir le pilote. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.6 Codex Integration Boundary; `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.6 Decision de recherche recommandee]
- Le journal reste append-only et les projections officielles V1 restent `mission status`, `ticket board`, `approval queue`, `artifact index`, `resume view`; 2.3 doit enrichir les snapshots et evenements sans introduire un `attempt board` parallele. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.5 Enforcement Guidelines]
- Les adaptateurs executent/pollent/traduisent, mais ne mutent jamais `Mission` ou `Ticket` directement; la mutation des snapshots doit rester centralisee dans `ticket-runtime`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.2 Architectural Boundaries]

### Product And Epic Guardrails

- Le PRD demande une execution observable, des artefacts relies aux taches et une reprise sans relire le transcript. Cette story doit donc produire des evenements et des statuts utiles des le lancement d'une tentative, pas juste un "fire and forget" opaque. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Execution & Artifact Flow; Reprise Et Auditabilite; Resultats Mesurables]
- L'Epic 2 veut permettre a l'operateur de lancer les tickets dans des espaces isoles puis de suivre leur progression. La Story 2.3 ouvre l'execution; la Story 2.4 s'occupera du board et du suivi detaille, la Story 2.5 de l'indexation des artefacts. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.3; Story 2.4; Story 2.5]
- Les actions sensibles doivent rester derriere validation humaine au niveau produit, mais l'Epic 3 n'a pas encore introduit la queue d'approbation. 2.3 ne doit donc pas inventer un faux systeme d'approval parallele ni muter `approval-queue.json` en avance. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Reussite Technique; Securite; `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3]
- La delegation runnable calculee en 2.2 devient ici un vrai garde-fou d'execution: ne pas relancer un ticket juste parce que la CLI le cible si son plan ou son statut l'en empechent. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md` - Plan Ordering And Runnable Set Rules; CLI Contract Requirements]
- Les details vendor doivent rester optionnels et remplacables: `corp` doit appeler Codex, mais ne doit pas "devenir" un profil, plugin ou workflow implicite Codex. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.4 Interpretation pratique pour `corp`; 5.5 Risques identifies]

### Previous Story Intelligence

- Reutiliser le pattern deja etabli en 1.2, 1.4, 2.1 et 2.2: validation stricte -> calcul des snapshots cibles -> append du journal -> persistance -> projections -> rendu CLI. Ne pas introduire un raccourci qui ferait muter des projections ou des fichiers d'attempt avant journal. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md`; `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md`; `C:/Dev/PRJET/corp/_bmad-output/implementation/2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites.md`; `C:/Dev/PRJET/corp/_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md`]
- `ticket-service-support.ts` fournit deja les seams de validation partages (`ensureMissionWorkspaceInitialized`, `requireTicketInMission`, `rewriteMissionReadModels`, normalisation des listes). Etendre ce support plutot que recopier la logique `mission/ticket/projections` dans un nouveau service. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`]
- `buildTicketBoardProjection(...)` et `ticket-board-projection.ts` sont deja la source de verite read-side pour `runnable`, `planOrder` et `planningState`; 2.3 doit exploiter cette projection logique, pas recreer un second calcul de runnability. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`; `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`]
- `JournalEventRecord` ne supporte aujourd'hui que `ticketId?: string` en correlation optionnelle. 2.3 est le bon moment pour introduire `attemptId?: string` afin que les events d'execution restent reconstructibles. [Source: `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`; `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`]
- `MissionResumeTicket` reste volontairement souple, ce qui permet deja de remonter les statuts `claimed` / `in_progress` et, si utile, quelques metadonnees de tentative sans casser le formatter actuel. [Source: `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`]
- `dist/` est un artefact de build; ne pas le modifier manuellement. Toute nouvelle logique doit vivre sous `apps/`, `packages/` ou `tests/`. [Source: observation du repo `C:/Dev/PRJET/corp`]

### Project Structure Notes

- `packages/execution-adapters/` et `packages/workspace-isolation/` n'existent pas encore dans le repo actuel. Cette story doit poser ces deux seams minimaux au lieu d'etendre indument `mission-kernel` ou `ticket-runtime` avec des responsabilites vendor / filesystem.
- Le repo compile tous les fichiers `apps/**/*.ts`, `packages/**/*.ts` et `tests/**/*.ts` via un unique `tsconfig.json`. Les nouveaux modules doivent donc rester compatibles avec la baseline TypeScript/CommonJS existante et les tests continuent de vivre a la racine `tests/`, comme dans les stories 1.x et 2.1-2.2.
- Le bootstrap seed deja toutes les projections V1 minimales. 2.3 ne doit pas modifier la liste de projections seeded uniquement pour introduire les attempts; l'ajout d'une nouvelle projection ne serait justifie que si elle etait explicitement requise par le PRD/architecture, ce qui n'est pas le cas ici.

### Execution Attempt Requirements

Le contrat `ExecutionAttempt` introduit dans cette story doit au minimum respecter les choix suivants:

- `id`: identifiant stable prefixe `attempt_`.
- `ticketId`: identifiant `ticket_*` existant.
- `adapter`: `codex_responses` pour la premiere implementation concrete.
- `status`: une valeur parmi `requested|running|awaiting_approval|completed|failed|cancelled`.
- `workspaceIsolationId`: identifiant `iso_*` cree avant la tentative.
- `adapterState`: map opaque vendor-scoped contenant uniquement des details externes (`response_id`, curseur, sequence number, status vendor, etc.).
- `startedAt`: horodatage ISO d'ouverture.
- `endedAt`: `null` tant que la tentative n'est pas terminale; horodatage ISO a la terminaison.

Regles associees:

- une tentative n'est jamais createe sans ticket et sans isolation preallouee;
- une tentative active est derivee des statuts `requested|running|awaiting_approval`;
- aucune tentative ne doit ecrire directement dans le workspace principal;
- si la logique a besoin d'une correlation supplementaire mission-local, preferer le chemin de stockage et les events plutot que de dupliquer de nombreux champs coeur.

### Workspace Isolation Requirements

- Etendre le layout runtime avec un dossier d'isolations distinct du stockage mission/ticket, recommande ici sous `.corp/isolations/`.
- Creer un `workspaceIsolationId` prefixe `iso_` avant toute mutation `ticket.claimed` ou `execution.requested`.
- Dans le cas Git:
  - preferer un worktree dedie par ticket/tentative;
  - conserver la metadata reliant `iso_*` au repo source et au chemin cree;
  - ne jamais supposer que le repo source est celui de `corp`.
- Dans le cas non Git:
  - creer un workspace dedie equivalent sous `.corp/isolations/<isoId>/workspace/`;
  - copier le contenu utile du workspace operateur en excluant `.corp/`;
  - ne pas reinitialiser ni symlink-er le journal/projections dans cet espace.
- `ticket.workspaceIsolationId` devient la reference coeur du ticket vers son isolation courante.
- L'isolation doit rester consultable/auditable apres l'ouverture de la tentative; le nettoyage automatique est hors scope ici.

### Adapter Requirements

- L'adaptateur concret de cette story est `codex_responses`; les autres surfaces (`codex exec`, SDK, MCP) peuvent etre preparees en interfaces ou TODOs documentes, mais pas branchees comme chemins d'execution reels.
- L'adaptateur doit accepter un transport testable et un `model` configure a la frontiere, au lieu de dependre d'un alias hardcode dans le coeur.
- Les secrets et headers OpenAI vivent au bord de l'adaptateur; ni la CLI, ni `ticket-runtime`, ni `mission-kernel` ne doivent connaitre l'authentification HTTP.
- Les statuts vendor doivent etre normalises avant de remonter dans les services coeur. `Mission` et `Ticket` ne doivent voir que des statuts `corp`.
- `ExecutionAttempt.adapterState` est la source de verite par tentative pour les details vendor; `ticket.executionHandle.adapterState` ne doit en etre qu'un miroir courant, mis a jour via un helper central pour rester coherent.
- Si l'implementation choisit d'ajouter un seam `retrieve(...)` ou `cancel(...)` des maintenant pour preparer le background mode, ce seam doit rester dans l'adaptateur et ne pas apparaitre comme commande CLI publique dans cette story.

### Mission And Ticket Status Requirements

- Un ticket n'est lancable que si:
  - il appartient a la mission cible;
  - son `owner` est non vide;
  - son `status` courant est `todo`;
  - il est `runnable === true` dans le board/planner actuel;
  - aucune tentative active n'existe deja pour lui.
- Une mission ne peut lancer une tentative que depuis `ready` ou `running`.
- Un lancement nominal doit suivre cette progression logique:
  - creation d'isolation
  - `ticket.claimed`
  - `execution.requested`
  - puis `execution.background_started` ou `execution.completed` ou `execution.failed`
- `mission.status` doit:
  - devenir `running` tant qu'au moins une tentative active existe;
  - revenir a `ready` lorsqu'une tentative se termine en succes et qu'aucune autre tentative active n'existe;
  - devenir `failed` en cas d'echec terminal immediat;
  - ne jamais devenir `completed` automatiquement.
- `ticket.status` doit:
  - passer a `claimed`, puis `in_progress` pour une tentative active;
  - passer a `done` en succes terminal;
  - passer a `failed` en echec terminal;
  - ne pas reutiliser de statuts vendor comme `queued` ou `processing`.

### CLI Contract Requirements

- Garder la surface mission-centrique; ne pas introduire de top-level `corp run` ni de sous-menu vendor.
- `corp mission ticket run` doit exiger `--mission-id` et `--ticket-id`.
- `--background` est un opt-in explicite pour les tickets longs; ne pas inferer silencieusement un mode background sans laisser de trace dans la tentative/evenement.
- Ne pas exposer dans la CLI de flags techniques vendor du type `--model`, `--response-id`, `--stream`, `--jsonl`, `--resume-token`, `--api-key`.
- En succes, la sortie standard reste courte:
  - `Tentative ouverte: <attempt_id>`
  - puis le resume mission reconstruit
- En echec, les erreurs doivent rester stables, francaises et actionnables; ne pas remonter un stack trace HTTP ou un dump JSON vendor.
- Ne pas introduire de commande publique `ticket poll`, `ticket cancel-run`, `ticket attach`, `ticket artifact` dans cette story.

### Event And Projection Requirements

- `JournalEventRecord` doit evoluer pour accepter au minimum `attemptId?: string` optionnel sans casser les evenements existants 1.x / 2.1 / 2.2.
- L'ordre minimal a respecter est:
  - creation physique de l'isolation
  - append de l'evenement `workspace.isolation_created`
  - append des evenements d'execution/ticket selon la transition
  - persistance des snapshots et projections correspondants
- Les payloads d'execution doivent rester reconstructibles et contenir au minimum les snapshots coeur utiles (`mission`, `ticket`, `attempt`) ainsi qu'un `trigger` explicite (`operator`, `adapter`, `system`) lorsque pertinent.
- Les evenements recommandes de cette story sont:
  - `workspace.isolation_created`
  - `ticket.claimed`
  - `execution.requested`
  - `execution.background_started`
  - `execution.completed`
  - `execution.failed`
- `mission-status.json` doit toujours refleter le snapshot mission le plus recent.
- `ticket-board.json` doit refleter le statut courant du ticket lance et continuer de calculer la runnability a partir des statuts `todo` / `done`.
- `resume-view.json` doit etre regenere a partir des projections existantes via `readMissionResume(...)`, pas edite inline par la CLI.
- `approval-queue.json` et `artifact-index.json` doivent rester inchanges dans cette story.
- Ne pas introduire de projection dediee aux attempts tant qu'aucune exigence produit n'en impose la lecture directe.

### Implementation Guardrails

- Ne pas ajouter de dependance npm externe; la baseline Node 20 + TypeScript actuelle suffit pour `fetch`, `child_process`, `fs.cp`, `AbortController` et les tests.
- Ne pas utiliser le SDK OpenAI officiel comme prerequis d'implementation. Le coeur doit rester compatible avec un transport HTTP simple et testable.
- Ne pas supposer que le workspace runtime sera un repo Git; le fallback non Git est un chemin V1 de premiere classe, pas un cas d'erreur secondaire.
- Ne pas muter le workspace principal directement; toute execution mutatrice passe par `workspace-isolation`.
- Ne pas exposer de statuts vendor bruts (`queued`, `in_progress`, etc.) dans `Mission`, `Ticket`, `MissionResume` ou les projections coeur.
- Ne pas logger ni persister de secrets, headers, prompt complet, transcript brut ou payload HTTP complet dans les snapshots et projections coeur.
- Ne pas introduire de systeme d'approbation, de queue runtime, de daemon de polling continu ou de registry de capabilities dans cette story.
- Ne pas implementer encore la detection et l'enregistrement des artefacts produits par l'isolation ou par la reponse vendor; cela appartient a la Story 2.5.
- Ne pas toucher `dist/` manuellement et ne pas court-circuiter `npm test`.
- Si le secret OpenAI manque ou que la configuration adapter est invalide, echouer avant creation d'isolation et avant append du journal.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/contracts/src/ticket/ticket.ts`
- `packages/contracts/src/execution-attempt/execution-attempt.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/storage/src/repositories/file-execution-attempt-repository.ts`
- `packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/workspace-isolation/src/`
- `packages/execution-adapters/codex-responses/src/`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/contract/mission-ticket-run-cli.test.ts`
- `tests/integration/bootstrap-workspace.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`, sans Jest/Vitest ni librairie de mock externe.
- Verifier que `corp mission help` mentionne `corp mission ticket run` en francais, sans fuite `codex`, `openai`, `response_id` ni syntaxe vendor.
- Verifier qu'un lancement foreground nominal:
  - cree une isolation exploitable;
  - persiste une `ExecutionAttempt`;
  - emet `workspace.isolation_created`, `ticket.claimed`, `execution.requested`, `execution.completed`;
  - place le ticket a `done`;
  - remet la mission a `ready` si aucune autre tentative active n'existe.
- Verifier qu'un lancement background:
  - utilise `--background`;
  - persiste le `response_id` et les curseurs utiles uniquement dans `adapterState`;
  - normalise `queued` / `in_progress` sans fuite vendor dans les statuts coeur;
  - place la mission a `running` et le ticket a `in_progress`.
- Verifier qu'une seconde tentative sur le meme ticket est rejetee tant qu'une tentative active existe deja.
- Verifier qu'un ticket non runnable, un ticket deja `claimed|in_progress|done|failed|cancelled` ou une mission `blocked|failed|completed|cancelled` refusent `ticket run` sans muter journal, attempts, snapshots ou projections.
- Verifier le fallback non Git sur un workspace temporaire et, si l'environnement local le permet de maniere deterministe, un chemin Git worktree distinct; sinon, couvrir unitairement la decision worktree vs fallback.
- Verifier que `approval-queue.json` et `artifact-index.json` restent strictement inchanges apres `ticket run`.
- Etendre `mission-resume.test.ts` pour verifier qu'un ticket `claimed` ou `in_progress` donne une consigne de suivi explicite au lieu de la replanification.
- Conserver `npm test` vert sur l'ensemble de la suite existante (55 tests verts de reference avant implementation de 2.3).

### Scope Exclusions

- Hors scope: board operateur detaille, suivi exhaustif des blocages et affichage riche des statuts ticket par ticket (Story 2.4).
- Hors scope: detection, enregistrement et navigation des artefacts produits par l'execution (Story 2.5).
- Hors scope: queue d'approbation, arbitrage humain, policies de validation explicites et events `approval.*` (Epic 3).
- Hors scope: relance partielle selective d'une branche de tickets apres echec ou comparaison aux criteres de succes (Story 3.5).
- Hors scope: `CapabilityRegistry`, `SkillPack` runtime, extensions ou plugins locaux reels (Epic 4).
- Hors scope: `codex exec`, Codex SDK, MCP server et autres adaptateurs concrets hors `codex_responses`.
- Hors scope: merge/reconciliation automatique du workspace isole vers le workspace principal.
- Hors scope: daemon de polling permanent, streaming interactif de run et UI locale de supervision.

### Latest Technical Information

- Le repo actuel epingle `Node >=20.0.0`, `TypeScript ^5.9.3` et une compilation `ES2022` / `CommonJS` / `strict`; toute nouvelle couche `execution-adapters` ou `workspace-isolation` doit rester compatible avec cette baseline et sans dependance externe. [Source: `C:/Dev/PRJET/corp/package.json`; `C:/Dev/PRJET/corp/tsconfig.json`]
- Verification officielle OpenAI faite le 2026-04-09: le guide `Background mode` documente l'ouverture de Responses avec `background=true`, le polling via `responses.retrieve(...)` tant que le statut reste `queued` ou `in_progress`, et l'annulation via `responses.cancel(...)`. La meme page precise aussi que le background mode requiert des responses stockees; il ne faut donc pas combiner ce chemin avec une requete explicitement stateless. [Source: `https://developers.openai.com/api/docs/guides/background`]
- Verification officielle OpenAI faite le 2026-04-09: la page `All models` montre que les aliases et snapshots codex evoluent rapidement (`GPT-5-Codex`, `GPT-5.1-Codex`, `GPT-5.2-Codex`, `GPT-5.3-Codex`, etc.). L'implementation 2.3 doit donc rendre le modele configurable a la frontiere adapter plutot que de figer un nom stale dans le coeur. [Source: `https://developers.openai.com/api/docs/models/all`]
- La recherche technique et l'architecture BMAD existantes restent coherentes avec cette verification officielle: `Responses API` est l'adaptateur prioritaire V1, `background=true` est reserve aux runs longs, et les details vendor doivent rester confines a `adapterState`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.6 Codex Integration Boundary; `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.2 Ce que les docs officielles confirment; 5.6 Decision de recherche recommandee]

### Hypotheses Explicites

- La premiere surface CLI d'execution V1 est `corp mission ticket run`, afin de rester alignee avec la posture mission-centrique et les stories 2.1/2.2.
- `--background` est l'opt-in minimal retenu pour les tickets longs; aucun champ permanent n'est ajoute au contrat coeur `Ticket` pour memoriser ce choix en 2.3.
- `ExecutionAttempt` persiste explicitement `workspaceIsolationId` pour garder une correlation historique stable entre tentative et isolation, meme si le ticket est relance plus tard.
- Le fallback non Git retenu pour V1 est un workspace dedie sous `.corp/isolations/<isoId>/workspace/`, obtenu par copie du workspace operateur en excluant `.corp/`.
- `ExecutionAttempt.adapterState` est la source de verite per-attempt pour les details vendor; `ticket.executionHandle.adapterState` n'est qu'un miroir courant/dernier et doit etre maintenu via un helper unique.
- Une tentative foreground qui se termine en succes remet la mission a `ready` si aucune autre tentative active n'existe; la mission n'est jamais auto-cloturee.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Overview; Additional Requirements; Epic 2; Story 2.1; Story 2.2; Story 2.3; Story 2.4; Story 2.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Reussite Technique; Resultats Mesurables; Parcours 1; Parcours 2; Planning & Delegation; Execution & Artifact Flow; Reprise Et Auditabilite; Securite; Fiabilite Et Reprise
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; ExecutionAttempt; 3.4 Architectural Rule About Vendor Data; 3.5 Execution Strategy; 3.6 Codex Integration Boundary; 3.8 Workspace Isolation Strategy; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 4.1 Domain Consistency Rules; 4.3 Format Patterns; 4.4 Process Patterns; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 3.3 Proposition de forme canonique; 4.1 Decision proposee; 5.2 Ce que les docs officielles confirment; 5.4 Interpretation pratique pour `corp`; 5.5 Risques identifies; 5.6 Decision de recherche recommandee
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/create-mission.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/projection-store/file-projection-store.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-mission-repository.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-ticket-repository.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/dependency-graph/validate-ticket-dependencies.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-ticket-create-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-ticket-update-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/bootstrap-workspace.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/create-ticket.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/mission-resume.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/update-ticket.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`
- `https://developers.openai.com/api/docs/guides/background`
- `https://developers.openai.com/api/docs/models/all`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Introduire `ExecutionAttempt`, son repository fichier et le layout `.corp/isolations/` pour tracer une tentative auditable reliee a un `iso_*`.
- Ajouter `corp mission ticket run`, le service `run-ticket` et l'adaptateur `codex_responses` avec validation stricte, confinement des details vendor dans `adapterState` et transitions journalisees.
- Couvrir le flux par des tests `node:test` sur la surface CLI, le fallback non Git, la normalisation background/foreground, la reprise mission et la garde "une tentative active max".

### Debug Log References

- 2026-04-09: lecture complete de `sprint-status.yaml` puis selection de `2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire` comme premiere story `backlog` en ordre de lecture.
- 2026-04-09: analyse croisee de l'Epic 2, du PRD, de l'architecture, de la recherche technique, des stories 2.1 et 2.2 et du code reel pour identifier les seams existants (`ticket-board`, `resume-view`, `workspaceIsolationId`, `executionHandle`, `buildTicketBoardProjection`).
- 2026-04-09: verification locale de l'etat courant via `npm test` dans `C:/Dev/PRJET/corp`, avec 55 tests verts avant creation de cette story.
- 2026-04-09: verification officielle complementaire des docs OpenAI sur le `Background mode` et la page `All models` pour borner les exigences `Responses API`, polling et model alias sans figer d'information stale.
- 2026-04-09: implementation de `ExecutionAttempt`, du repository fichier, du layout `isolationsDir`, de `workspace-isolation` et du service `run-ticket` avec journalisation `workspace.isolation_created`, `ticket.claimed`, `execution.requested`, `execution.background_started`, `execution.completed` et `execution.failed`.
- 2026-04-09: ajout de l'adaptateur `codex_responses` a transport injecte, d'un model configurable a la frontiere et d'un helper partage pour mirrorer `adapterState` vers `ticket.executionHandle`.
- 2026-04-09: validation finale via tests cibles (`mission-ticket-run-cli`, `run-ticket`, `mission-resume`, `bootstrap-workspace`) puis `npm test` vert a 66 tests.

### Completion Notes List

- Ajout de `corp mission ticket run` avec parsing `--root`, `--mission-id`, `--ticket-id`, opt-in `--background`, aide CLI en francais et messages d'erreur deterministes sans fuite vendor.
- Introduction de `ExecutionAttempt`, du repository fichier associe, de `resolveExecutionAttemptStoragePaths(...)` et de la regle "une tentative active maximum" enforcee avant toute relance du meme ticket.
- Creation de `packages/workspace-isolation/src/workspace-isolation.ts` avec strategie duale `git_worktree|workspace_copy`, metadata `isolation.json`, exclusion de `.corp/` au fallback et emission de `workspace.isolation_created` avant toute mutation d'execution.
- Ajout du service `run-ticket` avec validation mission/ticket/board, claim, tentative `attempt_*`, confinement des details vendor dans `adapterState`, transition foreground/background, echec adapte et mise a jour coherente des snapshots/projections.
- Extension minimale de `deriveNextOperatorAction(...)` pour orienter le resume vers `Suivez le ticket en cours: ...` quand un ticket est `claimed` ou `in_progress`.
- Ajout et mise a jour des tests de surface et d'integration; `npm test` passe maintenant en entier avec 66 tests verts.

### File List

- `_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `packages/contracts/src/execution-attempt/execution-attempt.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-execution-attempt-repository.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/workspace-isolation/src/workspace-isolation.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/contract/mission-ticket-run-cli.test.ts`
- `tests/integration/bootstrap-workspace.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/run-ticket.test.ts`

## Change Log

- 2026-04-09: implementation complete de la Story 2.3 (`corp mission ticket run`, `ExecutionAttempt`, `workspace-isolation`, adaptateur `codex_responses`, projections/reprise et couverture de tests) puis passage au statut `review`.
