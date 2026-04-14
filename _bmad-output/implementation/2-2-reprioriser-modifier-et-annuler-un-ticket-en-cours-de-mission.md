# Story 2.2: Reprioriser, modifier et annuler un ticket en cours de mission

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want ajuster un ticket pendant qu'une mission evolue,
so that le plan reste exploitable sans casser l'historique ni le contrat coeur.

## Acceptance Criteria

1. Given une mission contient plusieurs tickets
   When l'operateur modifie l'objectif, les contraintes, l'ordre de traitement ou annule un ticket
   Then la vue de planification et le set de tickets executables sont recalcules sans detruire l'historique existant
   And chaque mutation produit un evenement de ticket explicite

2. Given un ticket est annule
   When le dispatcher reevalue la mission
   Then ce ticket n'apparait plus dans le set runnable du V1
   And les tickets dependants refleteront clairement leur etat ou leur blocage en projection

## Tasks / Subtasks

- [x] Exposer des commandes CLI mission-centriques pour modifier, reprioriser et annuler un ticket (AC: 1, 2)
  - [x] Ajouter trois surfaces explicites sous la CLI existante: `corp mission ticket update`, `corp mission ticket move` et `corp mission ticket cancel`, au lieu d'etendre `create` avec des comportements implicites.
  - [x] Etendre `corp mission help` pour presenter ces trois commandes en francais, sans fuite vendor et sans introduire de top-level `corp ticket ...`.
  - [x] Pour `ticket update`, parser au minimum `--root`, `--mission-id`, `--ticket-id`, `--goal`, `--owner`, `--success-criterion` (repetable, remplace la liste), `--depends-on` (repetable, remplace la liste), `--allow-capability` (repetable, remplace la liste), `--skill-pack` (repetable, remplace la liste), `--clear-depends-on`, `--clear-allow-capability` et `--clear-skill-pack`.
  - [x] Pour `ticket move`, parser `--root`, `--mission-id`, `--ticket-id` et exactement une strategie de deplacement parmi `--before-ticket <ticket_id>`, `--after-ticket <ticket_id>`, `--to-front` ou `--to-back`.
  - [x] Pour `ticket cancel`, parser `--root`, `--mission-id`, `--ticket-id` et un `--reason` optionnel purement auditif.
  - [x] Produire des erreurs deterministes en francais pour: `--ticket-id` manquant, commande sans mutation demandee, combinaison d'options incompatible, ticket introuvable, reference d'ordre inconnue, auto-reference, cycle de dependances, dependance cross-mission, dependance deja `cancelled`, tentative de mise a jour d'un ticket `done` ou `cancelled`, tentative d'annulation d'un ticket deja `cancelled`.
  - [x] Apres succes, afficher une ligne d'action explicite puis le resume mission mis a jour:
    - `Ticket mis a jour: <ticket_id>`
    - `Ticket deplace: <ticket_id>`
    - `Ticket annule: <ticket_id>`

- [x] Introduire des services dedies de mutation de ticket et garder la CLI limitee au parsing/rendu (AC: 1, 2)
  - [x] Creer des services explicites sous `packages/ticket-runtime/src/ticket-service/`, recommandes ici sous la forme `update-ticket.ts`, `move-ticket.ts` et `cancel-ticket.ts`, plutot que d'enfouir la logique dans `mission-command.ts`.
  - [x] Charger la mission via `FileMissionRepository`, charger le ticket cible via `FileTicketRepository`, verifier qu'ils appartiennent a la meme mission, puis calculer une mutation normalisee avant toute ecriture.
  - [x] Conserver immuables `ticket.id`, `ticket.missionId`, `ticket.kind`, `ticket.createdAt`, `ticket.executionHandle.adapter`, `ticket.artifactIds` et `mission.id`; ne muter que les champs explicitement permis par la story.
  - [x] Pour `ticket update`, autoriser la mutation de `goal`, `owner`, `successCriteria`, `dependsOn`, `allowedCapabilities` et `skillPackRefs`, avec trim, deduplication et preservation de l'ordre d'entree.
  - [x] Pour `ticket move`, utiliser `mission.ticketIds` comme ordre canonique du plan et deplacer uniquement la position logique du ticket cible dans cette liste, sans introduire de champ `priority`, `rank` ou `sequence` dans le contrat coeur `Ticket`.
  - [x] Pour `ticket cancel`, mettre `ticket.status` a `cancelled`, conserver le snapshot sur disque et en audit, et ne jamais supprimer le dossier `.corp/missions/<missionId>/tickets/<ticketId>/`.
  - [x] Rejeter les no-op apres normalisation: si une commande n'entraine aucun changement reel sur le snapshot ticket/mission, elle doit echouer explicitement et ne produire ni evenement ni reecriture.

- [x] Introduire un recalcul partage de planification et de runnability, sans nouveau read-model parallele (AC: 1, 2)
  - [x] Ajouter un helper de lecture mission-locale du type `listByMissionId(missionId)` dans `FileTicketRepository`, au lieu de scanner tous les tickets de toutes les missions pour reconstruire un plan local.
  - [x] Remplacer l'upsert incremental ad hoc du `ticket-board` par un builder partage qui reconstruit la projection complete a partir de `mission.ticketIds` et des snapshots `Ticket`.
  - [x] Faire de `ticket-board.json` la vue de planification V1 existante a enrichir, au lieu de creer un nouveau fichier de projection pour le runnable set.
  - [x] Enrichir chaque entree du board avec des metadonnees de planification suffisantes pour 2.2, recommandees ici comme:
    - `planOrder`
    - `runnable`
    - `blockedByTicketIds`
    - `planningState` avec au minimum une distinction entre `runnable`, `waiting_on_dependencies`, `blocked_by_cancelled_dependency` et `not_runnable_status`
  - [x] Calculer le set runnable de facon deterministe et minimale pour le V1 courant:
    - un ticket est runnable seulement si `status === "todo"`
    - toutes ses dependances existent encore dans la mission
    - toutes ses dependances ont le statut `done`
  - [x] Traiter tout autre cas comme non runnable, sans inventer encore une machine d'etat d'execution riche:
    - ticket `cancelled` ou `done`
    - ticket `claimed`, `in_progress`, `awaiting_approval`, `blocked` ou `failed`
    - dependance non resolue
    - dependance `cancelled`
  - [x] Detecter et rejeter toute tentative de mise a jour qui introduit une boucle dans le graphe `dependsOn`; la story 2.2 doit poser le premier garde-fou de graphe, pas laisser l'invalidite se propager au dispatcher futur.
  - [x] Refactorer `create-ticket.ts` pour reutiliser ce builder de planification partage apres creation, afin que les tickets crees en 2.1 et les tickets modifies en 2.2 produisent le meme `ticket-board` enrichi.

- [x] Journaliser les mutations dans le bon ordre et rafraichir les projections existantes sans detruire l'historique (AC: 1, 2)
  - [x] Continuer a suivre le pattern etabli dans 1.2, 1.4 et 2.1: validation stricte -> calcul du snapshot cible -> append du journal -> persistance des snapshots -> reconstruction du board -> regeneration du resume -> rendu CLI.
  - [x] Ajouter des evenements de ticket explicites et auditablement distincts:
    - `ticket.updated`
    - `ticket.reprioritized`
    - `ticket.cancelled`
  - [x] Pour `ticket.updated`, stocker au minimum dans le payload: `mission`, `ticket`, `previousTicket`, `changedFields`, `trigger: "operator"`.
  - [x] Pour `ticket.reprioritized`, stocker au minimum: `mission`, `ticket`, `previousOrder`, `nextOrder`, `orderedTicketIds`, `trigger: "operator"`.
  - [x] Pour `ticket.cancelled`, stocker au minimum: `mission`, `ticket`, `previousStatus`, `reason?`, `trigger: "operator"`.
  - [x] Ajouter le nouvel `eventId` a `mission.eventIds`, a `ticket.eventIds`, mettre `mission.resumeCursor` sur ce nouvel evenement et aligner `mission.updatedAt` / `ticket.updatedAt` sur l'horodatage de mutation.
  - [x] Ne pas generer d'evenements synthetiques en cascade pour les tickets dependants bloques par une annulation dans cette story; leur impact doit etre visible dans la projection, pas transforme en fan-out evenementiel premature.
  - [x] Continuer a laisser `approval-queue.json` et `artifact-index.json` inchanges dans cette story.

- [x] Rendre la reprise et le resume utiles face au replanning, sans anticiper la Story 2.4 (AC: 1, 2)
  - [x] Faire en sorte que `readMissionResume` et `resume-view` consomment le board enrichi, sans nouveau cache de planification.
  - [x] Modifier `deriveNextOperatorAction` pour prioriser le premier ticket runnable plutot que le premier ticket simplement ouvert.
  - [x] Si aucun ticket n'est runnable mais qu'il reste des tickets ouverts, produire un `nextOperatorAction` qui oriente clairement l'operateur vers la replanification ou le debloquage, plutot que vers un ticket impossible a executer.
  - [x] Laisser l'affichage detaillant tous les motifs de blocage a la Story 2.4; dans 2.2, la reprise doit seulement devenir plus juste et plus utile, pas se transformer en board complet.

- [x] Ajouter la couverture de tests et les non-regressions necessaires (AC: 1, 2)
  - [x] Ajouter des tests contractuels pour l'aide et la validation de `ticket update`, `ticket move` et `ticket cancel`, avec messages d'erreur stables en francais.
  - [x] Ajouter un test d'integration couvrant un scenario multi-tickets ou l'operateur modifie un ticket, le deplace dans le plan, puis constate le recalcul de `mission.ticketIds`, de `ticket-board.json` et de `resume-view.json`.
  - [x] Ajouter un test d'integration couvrant l'annulation d'un ticket prerequis, en verifiant:
    - le statut `cancelled` du ticket cible
    - sa disparition du set runnable
    - le blocage visible des tickets dependants dans `ticket-board.json`
    - l'absence de suppression du snapshot historique
  - [x] Ajouter un test de non-regression qui prouve qu'une mutation sans effet ne cree ni evenement supplementaire, ni reecriture mission/ticket, ni changement de projection.
  - [x] Ajouter un test de validation du graphe qui rejette au minimum une auto-dependance, une boucle a deux tickets et une dependance vers un ticket deja `cancelled`.
  - [x] Etendre les tests de reprise/lecture pour verifier que `nextOperatorAction` choisit le premier ticket runnable, et qu'en absence de runnable il oriente vers la replanification plutot que vers un ticket impossible.

## Dev Notes

### Story Intent

Cette story transforme le `Ticket` cree en 2.1 en unite de planification vivante. L'objectif n'est pas encore d'executer un ticket ni d'afficher un board complet; il s'agit de permettre au plan de mission d'evoluer sans perdre l'audit, en gardant un ordre canonique, des mutations explicites et une evaluation deterministe du runnable set.

### Current Project State

- Le repo fournit aujourd'hui une boucle mission-centrique complete pour `bootstrap`, `create`, `status`, `resume`, `pause`, `relaunch`, `close` et `ticket create`, avec stockage local sous `.corp/`, journal append-only et projections JSON minimales.
- La Story 2.1 est deja materialisee dans le code: `Ticket` existe, `packages/ticket-runtime/src/ticket-service/create-ticket.ts` existe, `ticket-board.json` est alimente et `npm test` est vert sur une base de 41 tests au 2026-04-09.
- `ticket-runtime` ne contient encore qu'un seul service de creation; les sous-dossiers `planner/` et `dependency-graph/` cibles par l'architecture n'existent pas encore.
- `ticket-board-projection.ts` ne porte aujourd'hui que les champs de resume minimums (`title`, `status`, `owner`, `kind`, `dependsOn`, etc.) et ne calcule ni ordre canonique de plan, ni set runnable, ni motif de blocage.
- `readMissionResume` considere actuellement comme "ouverts" tous les tickets dont le statut n'est pas terminal et `deriveNextOperatorAction` choisit le premier ticket ouvert, pas le premier ticket reellement runnable.
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas supposer de commit history, de worktree Git ni de merge flow pour cette story.
- Aucun document UX dedie n'a ete identifie dans `C:/Dev/PRJET/corp/_bmad-output/planning`; la sortie doit donc rester alignee sur la CLI actuelle, scannable, concise et mission-centrique.

### Architecture Compliance

- Le contrat coeur `Ticket` recommande par l'architecture reste petit: `id`, `missionId`, `kind`, `goal`, `status`, `owner`, `dependsOn`, `successCriteria`, `allowedCapabilities`, `skillPackRefs`, `workspaceIsolationId`, `executionHandle`, `artifactIds`, `eventIds`, `createdAt`, `updatedAt`. Cette story ne doit pas le gonfler avec un champ `priority`, `rank`, `queuePosition` ou autre doublon du plan. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract]
- Le V1 doit utiliser un petit graphe `dependsOn[]` et un dispatcher simple. La Story 2.2 est le premier endroit ou l'on doit commencer a proteger ce graphe contre les cycles et a en deriver un runnable set minimal. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.5 Execution Strategy]
- Toute transition significative doit produire un evenement avant toute projection. Les mutations `update`, `move` et `cancel` doivent donc append leur evenement avant de reecrire mission, ticket ou board. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules]
- La CLI reste une couche d'interface. La logique de mutation ticket, de validation de graphe et de recalcul de plan doit vivre dans `ticket-runtime`, pas dans `apps/corp-cli`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- Les projections officielles V1 restent `mission status`, `ticket board`, `approval queue`, `artifact index`, `resume view`. Cette story doit enrichir `ticket board`, pas introduire un nouveau read-model concurrent pour le runnable set. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.5 Enforcement Guidelines]
- Le mapping requirements -> structure cible place planning/delegation dans `packages/ticket-runtime`, avec `planner/`, `dispatcher/` et `dependency-graph/` comme seams attendus. La Story 2.2 doit poser ces briques minimales avant la Story 2.3. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.1 Complete Project Directory Structure; 5.3 Requirements to Structure Mapping]

### Product And Epic Guardrails

- Le PRD demande qu'un operateur puisse reprioriser, modifier ou annuler des taches en cours de mission. Cette story doit rendre ce replanning reel, pas seulement editable en JSON a la main. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Planning & Delegation; FR9]
- L'Epic 2 veut garder la delegation explicite, suivable et relancable. Cette story doit donc preserver l'historique des tickets et de leurs evenements, meme lorsqu'un ticket est annule. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.2]
- La Story 2.2 ne doit pas anticiper l'ouverture d'`ExecutionAttempt`, l'isolation de workspace, les details `Responses API`, le polling ou les IDs vendor. Tout cela appartient a la Story 2.3. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 2.3 Acceptance Criteria]
- La Story 2.2 ne doit pas devenir la story du board complet operateur. L'affichage detaille des statuts, owners, dependances et motifs de blocage appartient a la Story 2.4, meme si 2.2 doit deja fournir les bonnes donnees en projection. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 2.4 Acceptance Criteria]
- La Story 2.2 ne doit pas empiquer sur l'indexation riche d'artefacts, decisions et evenements de sortie; cela appartient a la Story 2.5. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 2.5 Acceptance Criteria]

### Previous Story Intelligence

- Reutiliser le pattern deja etabli en 1.2, 1.4 et 2.1: validation stricte -> calcul des snapshots -> append du journal -> persistance -> projections -> rendu CLI. Ne pas introduire ici un "shortcut" qui mettrait a jour les projections avant le journal. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md`; `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md`; `C:/Dev/PRJET/corp/_bmad-output/implementation/2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites.md`]
- `create-ticket.ts` normalise deja les listes opaques et valide `dependsOn` contre la mission courante. Extraire ou mutualiser cette logique si besoin, plutot que reecrire une seconde version divergente. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/create-ticket.ts`]
- `TicketBoardProjection` est actuellement enrichi par `upsertTicketBoardEntry(ticket)`, ce qui suffisait pour 2.1 mais ne suffit plus des qu'un ordre canonique, un runnable set et des blocages doivent etre recalcules globalement. La Story 2.2 doit passer a une reconstruction complete du board. [Source: `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`]
- `MissionResumeTicket` est volontairement souple (`[key: string]: unknown`). Cette souplesse peut etre reutilisee pour faire remonter des metadonnees `runnable` / `planningState` sans casser le formatter actuel ni ajouter un nouveau contrat coeur. [Source: `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`]
- `deriveNextOperatorAction` privilegie aujourd'hui la premiere approval puis le premier ticket ouvert. La Story 2.2 doit corriger ce biais en preferant le premier ticket runnable, sinon le resume orientera l'operateur vers une action impossible. [Source: `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`]
- `dist/` est un artefact de build; ne pas le modifier manuellement. Toute nouvelle logique doit vivre sous `apps/`, `packages/` ou `tests/`. [Source: observation du repo `C:/Dev/PRJET/corp`]

### Plan Ordering And Runnable Set Rules

Les regles suivantes doivent etre traitees comme le contrat de planification V1 de cette story:

- `mission.ticketIds` devient l'ordre canonique du plan mission.
- Le `ticket-board` est la vue de planification officielle de cette story; ne pas creer de fichier `runnable-set.json`, `planner-view.json` ou equivalent.
- Un ticket est runnable seulement si:
  - son `status` vaut `todo`
  - toutes ses dependances existent dans la mission
  - toutes ses dependances ont `status === "done"`
- Un ticket n'est pas runnable si:
  - son `status` vaut `claimed`, `in_progress`, `blocked`, `awaiting_approval`, `failed`, `done` ou `cancelled`
  - au moins une dependance n'est pas `done`
  - au moins une dependance est `cancelled`
- Les tickets dependants d'un prerequis `cancelled` doivent rester auditables et modifiables, mais doivent apparaitre comme non runnables et clairement bloques en projection.
- L'annulation d'un ticket ne doit pas supprimer son historique, ni l'enlever de `mission.ticketIds`, ni effacer son snapshot sur disque.
- Le fait qu'un ticket soit deplace dans le plan ne change pas la realite de ses dependances; un ticket peut donc etre plus haut dans l'ordre tout en restant non runnable.

### Ticket Mutation Requirements

- `ticket update` peut modifier:
  - `goal`
  - `owner`
  - `successCriteria`
  - `dependsOn`
  - `allowedCapabilities`
  - `skillPackRefs`
- `ticket update` ne peut pas modifier:
  - `id`
  - `missionId`
  - `kind`
  - `createdAt`
  - `executionHandle.adapter`
  - `artifactIds`
- Les listes mutables doivent etre normalisees par trim + deduplication tout en preservant l'ordre d'entree.
- `successCriteria` doit rester non vide apres mutation.
- `dependsOn` doit rester:
  - mission-local
  - sans auto-reference
  - sans cycle
  - sans dependance nouvellement pointee vers un ticket deja `cancelled`
- `ticket move` ne doit modifier que:
  - `mission.ticketIds`
  - `mission.eventIds`
  - `mission.resumeCursor`
  - `mission.updatedAt`
  - `ticket.eventIds`
  - `ticket.updatedAt`
- `ticket cancel` doit:
  - mettre `ticket.status` a `cancelled`
  - append un nouvel evenement
  - conserver `goal`, `owner`, `successCriteria`, `dependsOn`, `allowedCapabilities`, `skillPackRefs` pour l'audit
  - ne jamais supprimer le ticket du stockage

### Mission Linkage Requirements

- Toute mutation de ticket doit ajouter un nouvel `eventId` a `mission.eventIds`.
- `mission.resumeCursor` doit pointer vers ce nouvel `eventId`.
- `mission.updatedAt` doit etre aligne sur l'horodatage de la mutation.
- `mission.status` ne doit pas changer juste parce qu'un ticket est modifie, deplace ou annule.
- `mission.createdAt`, `mission.artifactIds` et `mission.policyProfileId` doivent etre preserves.
- `mission.ticketIds` ne change que pour `ticket move`; `ticket update` et `ticket cancel` ne doivent pas reordonner le plan implicitement.

### CLI Contract Requirements

- Garder la surface mission-centrique; ne pas introduire de top-level `corp ticket`.
- `ticket update` doit exiger `--mission-id` et `--ticket-id`, puis au moins une mutation reelle.
- `ticket move` doit exiger `--mission-id`, `--ticket-id` et exactement une strategie de deplacement.
- `ticket cancel` doit exiger `--mission-id` et `--ticket-id`; `--reason` reste optionnel.
- Les flags `--clear-depends-on`, `--clear-allow-capability` et `--clear-skill-pack` doivent etre mutuellement exclusifs avec leurs flags de remplacement respectifs pour eviter les ambiguities.
- `--before-ticket` et `--after-ticket` doivent pointer vers un ticket de la meme mission, different du ticket deplace.
- La sortie standard doit rester courte et mission-centrique:
  - une ligne d'action `Ticket mis a jour|deplace|annule: <ticket_id>`
  - puis le resume mission mis a jour via `formatMissionResume(...)`
- Ne pas introduire de mode interactif, de selection implicite de mission, de patch JSON en ligne, ni de sous-menu CLI.

### Event And Projection Requirements

- Les evenements restent append-only et un enregistrement JSONL = un evenement immutable.
- `JournalEventRecord` actuel suffit pour 2.2 avec `missionId`, `ticketId`, `eventId`, `occurredAt`, `actor`, `source`, `payload`; ne pas introduire encore `attemptId` dans cette story.
- Les payloads de mutation doivent toujours contenir le snapshot `mission` cible et le snapshot `ticket` cible pour rester reconstructibles.
- `ticket-board.json` doit continuer a vivre sous la forme `{ schemaVersion: 1, tickets: [...] }`, enrichie des champs de planification au niveau des entrees.
- `mission-status.json` doit refleter le snapshot mission mis a jour apres chaque mutation.
- `resume-view.json` doit etre regenere a partir des projections existantes via `readMissionResume`, pas edite inline par la CLI.
- Les tickets dependants d'un ticket annule doivent apparaitre comme non runnables et bloques en projection, mais ne doivent pas recevoir de mutation de snapshot ou d'evenement dedie dans cette story.
- Les tickets `cancelled` doivent rester presents dans `ticket-board.json` pour l'audit, tout en etant exclus du runnable set et du resume "tickets ouverts".

### Implementation Guardrails

- Ne pas ajouter de champ `priority`, `rank`, `queueIndex` ou `sortableOrder` au contrat coeur `Ticket`; reutiliser `mission.ticketIds`.
- Ne pas creer de nouveau fichier de projection pour la planification; enrichir `ticket-board` et `resume-view`.
- Ne pas supprimer un ticket annule du stockage, de `mission.ticketIds` ou du journal.
- Ne pas introduire `ExecutionAttempt`, `workspaceIsolationId` effectif, worktree, polling, background mode, MCP ou toute logique d'adaptateur reseau dans cette story.
- Ne pas auto-mutuer le statut des tickets dependants a `blocked`; leur blocage doit etre derive en projection uniquement dans 2.2.
- Ne pas faire scanner tous les tickets de toutes les missions pour recalculer un seul plan mission; ajouter un seam repository mission-local si necessaire.
- Ne pas muter les projections directement depuis la CLI; toute transformation doit passer par des helpers/services dedies.
- Ne pas toucher `dist/` manuellement et ne pas ajouter de dependance npm externe; la baseline Node/TypeScript actuelle suffit.
- En l'absence d'`ExecutionAttempt` dans le repo actuel, les garde-fous de mutation doivent s'appuyer sur le `status` courant du ticket et sur les contraintes de graphe, pas sur des objets runtime inexistants.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/contracts/src/ticket/ticket.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/move-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/cancel-ticket.ts`
- `packages/ticket-runtime/src/planner/`
- `packages/ticket-runtime/src/dependency-graph/`
- `tests/contract/mission-ticket-update-cli.test.ts`
- `tests/contract/mission-ticket-move-cli.test.ts`
- `tests/contract/mission-ticket-cancel-cli.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/integration/cancel-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`, sans Jest/Vitest ni helpers externes.
- Verifier que `corp mission help` mentionne `ticket update`, `ticket move` et `ticket cancel` sans fuite vendor.
- Verifier que `ticket update` rejette une commande sans mutation reelle, ainsi que les combinaisons `--clear-*` incompatibles.
- Verifier que `ticket move` rejette les references inconnues, self-target, cross-mission et les deplacements no-op.
- Verifier que `ticket cancel` garde le snapshot ticket sur disque et ne modifie pas `mission.status`.
- Verifier que `mission.ticketIds` devient effectivement la source de verite de l'ordre du plan apres `ticket move`.
- Verifier que `ticket-board.json` expose `planOrder`, `runnable`, `blockedByTicketIds` et `planningState` de facon coherente avec les snapshots tickets.
- Verifier qu'un ticket `cancelled` disparait du runnable set et des tickets ouverts, mais reste visible dans le `ticket-board`.
- Verifier qu'un ticket dependant d'un prerequis `cancelled` devient non runnable avec un motif distinct de la simple dependance non resolue.
- Verifier qu'une boucle de dependances est rejetee sans muter journal, mission, ticket ni projections.
- Verifier que `nextOperatorAction` choisit le premier ticket runnable, puis un message de replanification lorsqu'aucun ticket runnable n'existe.
- Conserver `npm test` vert sur l'ensemble de la suite existante, y compris les scenarios 2.1 deja implantes.

### Scope Exclusions

- Hors scope: ouvrir une `ExecutionAttempt`, allouer une isolation de workspace ou lancer un adaptateur d'execution.
- Hors scope: definir le board operateur complet avec affichage detaille des motifs de blocage; seule la donnee de projection et un resume utile sont requis ici.
- Hors scope: creer un nouvel index d'artefacts, de decisions ou d'approbations.
- Hors scope: ajouter un moteur de workflow declaratif, une queue runtime ou un host plugin.
- Hors scope: supprimer des tickets, purger le journal, compacter l'historique ou rewriter des evenements existants.
- Hors scope: introduire une base de donnees, SQLite, ou toute migration de stockage plus large que les snapshots JSON existants.

### Latest Technical Information

- Le repo actuel epingle `Node >=20.0.0`, `TypeScript ^5.9.3` et `@types/node ^24.5.2`; cette story doit rester dans cette baseline sans ajout de dependance externe. [Source: `C:/Dev/PRJET/corp/package.json`]
- La compilation cible `ES2022`, `CommonJS`, `moduleResolution: Node`, avec `strict: true` et `noEmitOnError: true`; tout nouveau module `planner/`, `dependency-graph/` ou `ticket-service/` doit rester compatible avec cette configuration. [Source: `C:/Dev/PRJET/corp/tsconfig.json`]
- Cette story ne depend d'aucune evolution d'API externe ou d'aucun appel reseau. Les references OpenAI/Codex restent pertinentes pour l'architecture generale, mais ne doivent pas influencer l'implementation locale de 2.2. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md`; `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md`]

### Hypotheses Explicites

- `mission.ticketIds` peut etre promu en ordre canonique du plan sans casser la compatibilite des stories precedentes.
- `ticket move` est la surface CLI recommandee pour la repriorisation, afin de garder `ticket update` focalise sur les champs du snapshot.
- Les metadonnees `planOrder`, `runnable`, `blockedByTicketIds` et `planningState` vivent uniquement en projection, pas dans le schema coeur `Ticket`.
- En 2.2, un ticket dependant d'un prerequis `cancelled` doit rester modifiable ou annulable, meme s'il n'est pas runnable.
- La base actuelle ne contient pas encore de tickets `done` produits par execution reelle; les garde-fous poses ici doivent toutefois rester coherents si ces statuts apparaissent dans les stories suivantes.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.1; Story 2.2; Story 2.3; Story 2.4; Story 2.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Parcours 1; Planning & Delegation; Execution & Artifact Flow; Reprise Et Auditabilite; FR9; FR10-F14
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.5 Execution Strategy; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 4.1 Domain Consistency Rules; 4.5 Enforcement Guidelines; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 3.3 Proposition de forme canonique; 5.4 Interpretation pratique pour `corp`; 6. Consequences directes pour l'architecture BMAD suivante
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-ticket-repository.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `C:/Dev/PRJET/corp/tests/integration/create-ticket.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Introduire les surfaces CLI `ticket update`, `ticket move` et `ticket cancel`, avec parsing explicite, messages d'erreur stables et rendu mission-centrique branche sur des services dedies.
- Ajouter un runtime ticket partage (`ticket-service-support`, validation de graphe, builder de planning) pour recalculer `ticket-board.json` depuis `mission.ticketIds` et les snapshots mission-locaux.
- Etendre la suite `node:test` avec contrats CLI, scenarios d'integration `update/move/cancel`, non-regressions no-op, validation de graphe et evolution de `nextOperatorAction`, puis valider avec `npm test`.

### Debug Log References

- 2026-04-09: analyse complete du `sprint-status.yaml` puis selection de `2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission` comme premiere story `backlog` en ordre de lecture.
- 2026-04-09: analyse croisee de l'Epic 2, du PRD, de l'architecture, de la recherche technique et du code reel 2.1 pour ancrer la story sur les seams deja poses (`Ticket`, `ticket-board`, `readMissionResume`, `create-ticket`).
- 2026-04-09: verification du baseline repo via `npm test` dans `C:/Dev/PRJET/corp` avec 41 tests verts avant creation de cette story.
- 2026-04-09: implementation des services `update-ticket`, `move-ticket`, `cancel-ticket`, du builder `build-ticket-board`, de `listByMissionId(...)` et du garde-fou de graphe sur les dependances ticket.
- 2026-04-09: branchement CLI/help vers les nouvelles commandes mission-centriques et alignement de `deriveNextOperatorAction` sur le premier ticket runnable ou sur un message explicite de replanification.
- 2026-04-09: ajout des tests 2.2 (`mission-ticket-update-cli`, `mission-ticket-move-cli`, `mission-ticket-cancel-cli`, `update-ticket`, `cancel-ticket`) puis validation finale via `npm test` avec 55 tests verts.

### Completion Notes List

- Ajout des commandes `corp mission ticket update`, `corp mission ticket move` et `corp mission ticket cancel`, avec validation deterministe en francais et sorties `Ticket mis a jour|deplace|annule` suivies du resume mission reconstruit.
- Introduction d'un runtime ticket dedie (`update-ticket.ts`, `move-ticket.ts`, `cancel-ticket.ts`, `ticket-service-support.ts`) et d'une validation de graphe qui rejette auto-reference, cycle a deux tickets, dependance cross-mission et dependance deja `cancelled`.
- Remplacement du `ticket-board` incremental par un builder partage base sur `mission.ticketIds`, enrichi avec `planOrder`, `runnable`, `blockedByTicketIds` et `planningState`, puis reutilise par `create-ticket` et toutes les mutations 2.2.
- Evolution de la reprise operateur pour choisir le premier ticket runnable et, lorsqu'aucun ticket ouvert n'est executable, orienter explicitement vers la replanification ou le debloquage.
- Couverture ajoutee sur les contrats CLI, le replanning multi-tickets, l'annulation avec historique conserve, la non-regression no-op, la validation du graphe et la reprise runnable; `npm test` passe en entier (55 tests).

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/ticket-runtime/src/dependency-graph/validate-ticket-dependencies.ts`
- `packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/cancel-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/move-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `tests/contract/mission-ticket-cancel-cli.test.ts`
- `tests/contract/mission-ticket-move-cli.test.ts`
- `tests/contract/mission-ticket-update-cli.test.ts`
- `tests/integration/cancel-ticket.test.ts`
- `tests/integration/create-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/update-ticket.test.ts`
- `_bmad-output/implementation/2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission.md`
- `_bmad-output/implementation/sprint-status.yaml`

## Change Log

- 2026-04-09: contexte complet de la Story 2.2 cree et statut passe a `ready-for-dev`.
- 2026-04-09: implementation 2.2 terminee, projections de planning enrichies, reprise runnable ajoutee, couverture etendue et story passee a `review`.
