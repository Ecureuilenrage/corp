# Story 2.1: Creer un ticket delegable avec owner, dependances et contraintes explicites

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want creer un ticket borne avec owner, dependances et contraintes d'usage,
so that la delegation devienne explicite, suivable et relancable.

## Acceptance Criteria

1. Given une mission persistante existe
   When l'operateur ajoute un ticket avec type, objectif, owner, `dependsOn`, criteres de succes, capacites autorisees et references de skill pack
   Then un enregistrement `Ticket` est persiste dans la mission avec identite stable et statut initial valide
   And le ticket peut exister avant toute tentative d'execution

2. Given un ticket vient d'etre cree
   When il est journalise
   Then un evenement `ticket.created` est emis avec un niveau de granularite fin
   And les details vendor eventuels restent reserves a `executionHandle.adapterState`

## Tasks / Subtasks

- [x] Exposer une commande CLI mission-centrique pour creer un ticket delegable (AC: 1, 2)
  - [x] Ajouter une surface `corp mission ticket create` sous la CLI existante, avec parsing explicite de `--root`, `--mission-id`, `--kind`, `--goal`, `--owner`, `--depends-on` (flag repetable), `--success-criterion` (flag repetable), `--allow-capability` (flag repetable) et `--skill-pack` (flag repetable).
  - [x] Garder `apps/corp-cli` limite au parsing, a l'appel de service et au rendu; ne pas reconstruire de chemins `.corp/`, ne pas muter directement le journal ni les projections dans la commande CLI.
  - [x] Produire des erreurs deterministes en francais pour: `--mission-id` manquant, `--kind` invalide, `--goal` manquant, `--owner` manquant, aucun critere de succes, mission inconnue, dependance inconnue, mission terminale, workspace non initialise.
  - [x] Reutiliser la sortie mission-centrique existante apres succes: afficher au minimum `Ticket cree: <ticket_id>` puis le resume mission mis a jour, sans introduire un format parallele opaque.

- [x] Introduire le contrat `Ticket` V1 et les seams de stockage associes (AC: 1)
  - [x] Ajouter `packages/contracts/src/ticket/ticket.ts` avec les enums/union types minimums `TicketKind`, `TicketStatus`, `ExecutionAdapterId` et le contrat `Ticket` conforme a l'architecture.
  - [x] Initialiser un ticket avec un identifiant stable prefixe `ticket_`, un statut initial `todo`, des horodatages ISO coherents, `artifactIds: []`, `eventIds: [eventId]`, `workspaceIsolationId: null`, `executionHandle.adapter = "codex_responses"` et `executionHandle.adapterState = {}`.
  - [x] Traiter `owner`, `allowedCapabilities` et `skillPackRefs` comme des references opaques dans cette story; ne pas introduire encore de resolution de registry, de chargement de skill pack ni de verification runtime des owners.
  - [x] Etendre `packages/storage/src/fs-layout/workspace-layout.ts` avec un helper du type `resolveTicketStoragePaths(layout, missionId, ticketId)` et persister le snapshot sous une forme repo-local future-proof, recommandee ici: `.corp/missions/<missionId>/tickets/<ticketId>/ticket.json`.
  - [x] Ajouter `packages/storage/src/repositories/file-ticket-repository.ts` au lieu de lire/ecrire les tickets directement depuis la CLI ou depuis `mission-kernel`.

- [x] Creer un service dedie de creation de ticket et mettre a jour la mission dans le bon ordre (AC: 1, 2)
  - [x] Creer `packages/ticket-runtime/src/ticket-service/create-ticket.ts` comme premier slice du package `ticket-runtime`, au lieu d'enfouir la logique ticket dans `mission-kernel`.
  - [x] Charger la mission via `FileMissionRepository`, verifier qu'elle existe et refuser la creation si son statut est `completed` ou `cancelled`; ne pas auto-relancer ni auto-reouvrir une mission terminale.
  - [x] Normaliser `dependsOn`, `allowedCapabilities` et `skillPackRefs` en supprimant les blancs et les doublons tout en preservant l'ordre d'entree; chaque dependance doit referencer un ticket existant de la meme mission.
  - [x] Preallouer `ticketId` et `eventId`, construire le snapshot `Ticket`, puis construire un snapshot `Mission` mis a jour avec `ticketIds`, `eventIds`, `resumeCursor` et `updatedAt` modifies, tout en preservant `createdAt`, `artifactIds`, `policyProfileId` et le statut mission courant.
  - [x] Etendre `JournalEventRecord` pour accepter au minimum un `ticketId?: string` optionnel, puis emettre `ticket.created` avant toute mise a jour de projection, avec un payload contenant au minimum `mission` et `ticket`.

- [x] Alimenter les projections et la reprise sans creer de read-model parallele (AC: 1, 2)
  - [x] Ajouter un helper explicite `packages/journal/src/projections/ticket-board-projection.ts` pour encapsuler la forme `{ schemaVersion: 1, tickets: [...] }` deja seedee par la Story 1.1, au lieu de manipuler `ticket-board.json` inline.
  - [x] Ajouter au board une entree contenant au minimum `ticketId`, `missionId`, `title` derive de `goal` pour rester compatible avec le formatter actuel, `status`, `owner`, `kind`, `dependsOn`, `allowedCapabilities`, `skillPackRefs` et `updatedAt`.
  - [x] Mettre a jour `mission-status.json` avec le snapshot mission enrichi et rafraichir `resume-view.json` via les helpers/read-side existants, afin que `mission status` et `mission resume` exposent immediatement le ticket ouvert au lieu du message par defaut "Aucun ticket n'existe encore...".
  - [x] Laisser `approval-queue.json` et `artifact-index.json` inchanges dans cette story; aucun artefact ni approval ne doit etre cree par `ticket create`.

- [x] Ajouter la couverture de tests et les non-regressions necessaires (AC: 1, 2)
  - [x] Ajouter un test contractuel CLI pour l'aide et la validation de `corp mission ticket create`, sans fuite `codex` / `openai` et avec messages d'erreur stables en francais.
  - [x] Ajouter un test d'integration couvrant `bootstrap -> mission create -> ticket create`, en verifiant le snapshot `Ticket`, l'update du snapshot `Mission`, l'append du journal `ticket.created`, la coherence de `mission.resumeCursor`, `mission.eventIds`, `ticket.eventIds` et `ticket-board.json`.
  - [x] Ajouter un test d'integration de validation des dependances qui rejette au minimum un `dependsOn` inconnu et une dependance issue d'une autre mission.
  - [x] Etendre les tests de reprise/lecture pour verifier qu'apres creation d'un ticket, `mission status` / `mission resume` n'affichent plus `Tickets ouverts: aucun`, et que `nextOperatorAction` pointe vers le ticket cree.

## Dev Notes

### Story Intent

Cette story ouvre l'Epic 2 en introduisant la premiere vraie unite de delegation: le `Ticket`. Elle doit rendre la decomposition de mission explicite et persistante, sans glisser encore vers la repriorisation, l'execution adaptee, le suivi avance des blocages, ni l'index d'artefacts riches des stories 2.2 a 2.5.

### Current Project State

- Le repo fournit aujourd'hui une boucle mission-centrique complete pour `bootstrap`, `create`, `status`, `resume`, `pause`, `relaunch` et `close`, avec stockage local sous `.corp/`, journal append-only et projections JSON minimales.
- Le contrat `Mission` inclut deja `ticketIds`, et `DEFAULT_PROJECTIONS` seed deja `ticket-board.json`, mais aucun contrat `Ticket`, aucun repository ticket et aucun package `ticket-runtime` n'existent encore.
- `readMissionResume` sait deja lire `ticket-board` et traiter les tickets comme `openTickets`; pour l'instant, cette projection reste vide par construction.
- Le formatter `formatMissionResume` sait deja afficher `openTickets` en utilisant `ticketId` puis `title`, ce qui permet de brancher la Story 2.1 sans refondre la sortie CLI.
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas supposer de commit history, de worktree Git ni de merge flow pour cette story.
- Aucun document UX dedie n'a ete identifie dans `C:/Dev/PRJET/corp/_bmad-output/planning`; la sortie doit donc rester alignee sur la CLI actuelle, scannable, concise et mission-centrique.

### Architecture Compliance

- Le contrat coeur a respecter pour `Ticket` vient du document d'architecture: `id`, `missionId`, `kind`, `goal`, `status`, `owner`, `dependsOn`, `successCriteria`, `allowedCapabilities`, `skillPackRefs`, `workspaceIsolationId`, `executionHandle`, `artifactIds`, `eventIds`, `createdAt`, `updatedAt`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract]
- Le V1 doit utiliser un petit graphe `dependsOn[]` et garder une seule tentative active maximum par ticket a un instant donne. Cette story ne cree pas encore la tentative, mais elle doit poser un ticket compatible avec ce modele. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.5 Execution Strategy]
- Aucun detail OpenAI/Codex ne doit fuiter hors `executionHandle.adapterState`; aucun `response_id`, `threadId` ou autre identifiant vendor ne doit etre ajoute au schema coeur ou au resume. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]
- Toute transition significative doit produire un evenement avant toute projection. La creation de ticket doit donc suivre le meme ordre que les stories 1.2 et 1.4: append du journal avant mise a jour de `mission-status`, `ticket-board` ou `resume-view`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules]
- La CLI reste une couche d'interface operateur; la logique ticket doit vivre dans les services applicatifs (`ticket-runtime`, repositories, projections), pas dans `apps/corp-cli`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- Le mapping requirements -> structure cible place planning/delegation dans `packages/ticket-runtime`, pas dans `mission-kernel`. La Story 2.1 est donc le bon moment pour creer ce package minimal. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.1 Complete Project Directory Structure; 5.3 Requirements to Structure Mapping]

### Product And Epic Guardrails

- Le PRD demande que chaque tache deleguee dispose d'un responsable explicite, d'un statut, de criteres de succes et d'un suivi lisible. Un ticket sans owner ou sans criteres de succes rate deja la promesse produit du V1. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Reussite Technique; Resultats Mesurables; Planning & Delegation]
- L'Epic 2 commence par rendre la delegation explicite. Cette story ne doit pas anticiper la repriorisation/modification/annulation complete des tickets (Story 2.2), l'execution isolee (Story 2.3), le suivi des blocages (Story 2.4) ni l'enregistrement d'artefacts riche (Story 2.5). [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.1; Story 2.2; Story 2.3; Story 2.4; Story 2.5]
- Le ticket doit pouvoir exister avant toute tentative d'execution; ne pas creer d'`ExecutionAttempt`, d'isolation de workspace ni de polling vendor dans cette story. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 2.1 Acceptance Criteria; Story 2.3 Acceptance Criteria]
- La delegation doit rester auditable. `ticket.created` doit donc etre un evenement fin et explicite, pas un effet de bord silencieux d'une reecriture de mission. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Execution & Artifact Flow; Reprise Et Auditabilite]

### Previous Story Intelligence

- Reutiliser le pattern deja etabli en 1.2 et 1.4: validation stricte -> preallocation des IDs -> append du journal -> persistance du snapshot -> projection(s) -> rendu CLI. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md` - Implementation Guardrails; Event And Projection Requirements; `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md` - Implementation Guardrails; Event And Projection Requirements]
- Reutiliser les seams deja en place au lieu de recreer un stockage parallele: `resolveWorkspaceLayout`, `FileMissionRepository`, `appendEvent`, `writeProjectionSnapshot`, `readMissionResume`, `formatMissionResume`. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission.md` - Previous Story Intelligence; Recommended File Touch Points]
- `readMissionResume` filtre deja `ticket-board` par `missionId` et considere comme ouverts les statuts autres que `done`, `completed`, `cancelled`, `closed`. Un ticket cree en `todo` apparaitra donc naturellement comme ticket ouvert, sans nouvelle logique de resume. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`]
- `resume-view-projection.ts` derive deja `nextOperatorAction` a partir du premier ticket ouvert et prefere `title` a `ticketId` si disponible. Deriver `title` depuis `goal` dans le board suffit a rendre la reprise plus utile sans etendre le contrat coeur `Ticket`. [Source: `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`; `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`]
- `dist/` est un artefact de build; ne pas le modifier manuellement. Toute nouvelle logique doit vivre sous `apps/`, `packages/` ou `tests/`. [Source: observation du repo `C:/Dev/PRJET/corp`]

### Project Structure Notes

- `packages/ticket-runtime/` n'existe pas encore dans le repo actuel. Cette story doit creer le dossier et son premier `src/ticket-service/` minimal au lieu de transformer `mission-kernel` en fourre-tout.
- `packages/contracts/src/ticket/` n'existe pas non plus; le contrat coeur `Ticket` doit y etre introduit maintenant.
- `ticket-board.json` existe deja comme projection seedee, mais aucun helper `ticket-board-projection.ts` n'encapsule encore sa forme. La Story 2.1 doit combler ce gap pour eviter des manipulations JSON ad hoc.

### Ticket Contract Requirements

Le ticket cree dans cette story doit au minimum respecter les choix suivants:

- `id`: identifiant stable prefixe `ticket_`.
- `missionId`: identifiant `mission_*` existant.
- `kind`: une valeur parmi `research|plan|implement|review|operate`.
- `goal`: string non vide.
- `status`: `todo` a la creation.
- `owner`: string non vide, opaque.
- `dependsOn`: tableau de `ticket_*` deja existants dans la meme mission.
- `successCriteria`: tableau non vide de strings, dans l'ordre normalise.
- `allowedCapabilities`: tableau de strings opaques.
- `skillPackRefs`: tableau de strings opaques.
- `workspaceIsolationId`: `null` tant qu'aucune tentative d'execution n'existe encore.
- `executionHandle.adapter`: `codex_responses` par defaut pour rester aligne sur l'adaptateur prioritaire V1.
- `executionHandle.adapterState`: `{}` a la creation.
- `artifactIds`: `[]`.
- `eventIds`: tableau contenant le premier `event_*` de creation.
- `createdAt` / `updatedAt`: meme timestamp ISO au moment initial.

Si un detail d'implementation force un arbitrage, la regle a suivre est: garder le schema coeur petit, explicite, vendor-decoupled, et repousser toute richesse runtime aux stories 2.3+.

### Mission Linkage Requirements

- La creation d'un ticket doit ajouter `ticket.id` a `mission.ticketIds`.
- Le meme `eventId` de `ticket.created` doit etre ajoute a `mission.eventIds`.
- `mission.resumeCursor` doit pointer sur cet `eventId`.
- `mission.updatedAt` doit etre mis a jour sur l'horodatage de creation du ticket.
- `mission.createdAt`, `mission.artifactIds`, `mission.policyProfileId` et le `mission.status` courant doivent etre preserves.
- La mission ne doit pas changer de statut juste parce qu'un ticket est cree; ne pas introduire de transition implicite vers `running` ou `ready`.

### CLI Contract Requirements

- Etendre l'aide `corp mission help` pour presenter `corp mission ticket create`.
- Garder la surface mission-centrique; ne pas introduire un top-level `corp ticket ...` dans cette story.
- Exiger explicitement `--mission-id`, `--kind`, `--goal`, `--owner` et au moins un `--success-criterion`.
- Autoriser `--depends-on`, `--allow-capability` et `--skill-pack` en flags repetables.
- Produire des erreurs deterministes en francais pour les cas invalides et ne jamais lancer une creation partielle.
- Apres succes, afficher `Ticket cree: <ticket_id>` puis un resume mission mis a jour afin que l'operateur voie immediatement l'effet de la delegation sur la mission.
- Ne pas introduire de mode interactif, de selection implicite de mission, ni de listing complet de tickets dans cette story.

### Event And Projection Requirements

- `JournalEventRecord` doit evoluer pour supporter les evenements lies a un ticket sans casser la compatibilite des evenements mission-only deja existants; un champ optionnel `ticketId?: string` est suffisant pour 2.1.
- L'evenement `ticket.created` doit contenir au minimum `eventId`, `type`, `missionId`, `ticketId`, `occurredAt`, `actor`, `source` et un payload riche avec `mission` et `ticket`.
- Les evenements restent append-only. Aucune creation de ticket ne doit reecrire une ligne precedente du journal.
- `ticket-board.json` doit rester sur la racine `{ schemaVersion: 1, tickets: [...] }`.
- `mission-status.json` doit refleter le snapshot mission mis a jour apres creation du ticket.
- `resume-view.json` doit etre rafraichi de sorte que `openTickets` contienne le ticket cree et que `lastEventId` pointe sur `ticket.created`.
- `approval-queue.json` et `artifact-index.json` doivent rester inchanges dans cette story.

### Implementation Guardrails

- Ne pas implementer `ExecutionAttempt`, polling, background mode, MCP, worktree ou toute isolation effective dans cette story; cela appartient a la Story 2.3.
- Ne pas introduire de repriorisation, d'edition ou d'annulation de ticket; cela appartient a la Story 2.2.
- Ne pas faire de validation runtime de `owner`, `allowedCapabilities` ou `skillPackRefs` contre des registres inexistants; ce sont des references opaques a ce stade.
- Ne pas autoriser de dependances cross-mission ni creer automatiquement des tickets manquants pour satisfaire `dependsOn`.
- Ne pas creer un second cache ou un second board pour les tickets. Reutiliser `ticket-board.json` deja seedee.
- Ne pas etendre `Mission` avec des details vendor ou avec des metadonnees `ticket` dupliquees au-dela de `ticketIds`.
- Ne pas toucher `dist/` manuellement et ne pas ajouter de dependance npm externe pour cette story; la baseline Node/TypeScript actuelle suffit.
- Si la mission est `completed` ou `cancelled`, echouer explicitement; ne pas auto-relancer la mission ni modifier son statut pour "faire passer" la creation du ticket.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/contracts/src/ticket/ticket.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/mission-status-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/contract/mission-ticket-create-cli.test.ts`
- `tests/integration/create-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`, sans Jest/Vitest ni helpers externes.
- Verifier que `corp mission help` mentionne `corp mission ticket create` sans fuite vendor.
- Verifier qu'un ticket cree persiste sous le layout local attendu et qu'il reference la bonne mission.
- Verifier que `mission.ticketIds`, `mission.eventIds`, `mission.resumeCursor` et `mission.updatedAt` sont mis a jour apres creation d'un ticket.
- Verifier qu'un unique evenement `ticket.created` est ajoute au journal, avec `ticketId` top-level et un payload coherent contenant `mission` + `ticket`.
- Verifier que `ticket-board.json` contient l'entree du ticket cree avec `title` derive de `goal`.
- Verifier qu'apres creation de ticket, `mission status` et `mission resume` affichent le ticket ouvert et un `nextOperatorAction` oriente ticket plutot que le message par defaut "Aucun ticket n'existe encore...".
- Verifier qu'une dependance inconnue et une dependance cross-mission echouent explicitement sans muter journal, mission ni projections.
- Verifier qu'une mission `completed` ou `cancelled` refuse la creation de nouveau ticket sans modifier son historique.

### Scope Exclusions

- Hors scope: reprioriser, modifier ou annuler un ticket existant.
- Hors scope: ouvrir une tentative d'execution, allouer une isolation de workspace, lancer un adaptateur ou stocker des IDs vendor reels.
- Hors scope: suivre les blocages, l'avancement detaille ou les reasons codes de runtime.
- Hors scope: creer des artefacts, decisions ou approvals rattaches au ticket.
- Hors scope: registrer ou resoudre de vraies capabilities / skill packs / plugins; seuls leurs refs opaques sont stockes ici.
- Hors scope: refonte de la CLI en top-level `ticket`, migration vers base de donnees, ou redesign du format de resume.

### Latest Technical Information

- Le repo actuel epingle `Node >=20.0.0`, `TypeScript ^5.9.3` et `@types/node ^24.5.2`; cette story doit rester dans cette baseline sans ajout de dependance externe. [Source: `C:/Dev/PRJET/corp/package.json`]
- La compilation cible `ES2022`, `CommonJS`, `moduleResolution: Node`, avec `strict: true` et `noEmitOnError: true`; tout nouveau module `ticket-runtime` ou `ticket` doit rester compatible avec cette configuration. [Source: `C:/Dev/PRJET/corp/tsconfig.json`]
- L'adaptateur prioritaire V1 est `Responses API`, mais cette story ne fait encore aucun appel reseau. Le seul effet attendu est de reserver la place de l'adaptateur dans `executionHandle.adapter`, avec details vendor confines a `adapterState`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.6 Codex Integration Boundary; `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.4 Interpretation pratique pour `corp`]

### Hypotheses Explicites

- La premiere surface CLI ticket reste `corp mission ticket create` pour conserver la posture mission-centrique du V1.
- Le stockage recommande `.corp/missions/<missionId>/tickets/<ticketId>/ticket.json` est retenu ici pour rester coherent avec la persistance mission actuelle et laisser de la place aux attempts/artefacts futurs.
- `executionHandle.adapter` vaut `codex_responses` des la creation, mais `adapterState` reste vide tant qu'aucune tentative n'a ete ouverte.
- Les missions `blocked` ou `failed` peuvent accepter la creation d'un ticket supplementaire sans changer automatiquement de statut; les missions `completed` et `cancelled` doivent la refuser.
- `title` dans `ticket-board` est un champ de projection derive de `goal`, pas une nouvelle propriete obligatoire du contrat coeur `Ticket`.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Overview; Epic 2; Story 2.1; Story 2.2; Story 2.3; Story 2.4; Story 2.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Reussite Technique; Resultats Mesurables; Planning & Delegation; Execution & Artifact Flow; Reprise Et Auditabilite
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.5 Execution Strategy; 3.6 Codex Integration Boundary; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 4.1 Domain Consistency Rules; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 3.3 Proposition de forme canonique; 4.1 Decision proposee; 5.4 Interpretation pratique pour `corp`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md` - Previous Story Intelligence; Implementation Guardrails; Event And Projection Requirements
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission.md` - Previous Story Intelligence; Implementation Guardrails; Recommended File Touch Points; Testing Requirements
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md` - Previous Story Intelligence; Implementation Guardrails; Event And Projection Requirements
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/index.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/mission-status-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/create-mission.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/projection-store/file-projection-store.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-mission-repository.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-cli-surface.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-create-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-resume-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-lifecycle-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/create-mission.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/mission-resume.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/mission-lifecycle.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Introduire le contrat coeur `Ticket`, son repository fichier et le helper de layout associe pour persister les snapshots sous `.corp/missions/<missionId>/tickets/<ticketId>/ticket.json`.
- Ajouter le service `packages/ticket-runtime/src/ticket-service/create-ticket.ts` pour orchestrer validation stricte, preallocation des IDs, append journal `ticket.created`, persistance mission/ticket et rafraichissement des projections existantes.
- Etendre la CLI mission-centrique avec `corp mission ticket create`, puis verrouiller la surface via tests contractuels et d'integration couvrant erreurs deterministes, reprise et non-regressions.

### Debug Log References

- 2026-04-09: analyse du sprint status et identification de `2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites` comme premiere story `backlog` en ordre de lecture.
- 2026-04-09: analyse croisee du PRD, de l'architecture, de la recherche technique, des stories 1.2 a 1.4 et du code reel pour ancrer la story dans les seams existantes (`ticketIds`, `ticket-board`, `resume-view`, repositories fichier).
- 2026-04-09: ajout des tests rouges pour `corp mission ticket create`, confirmation de l'echec initial au build faute de contrat `Ticket`, puis implementation du flux ticket V1.
- 2026-04-09: execution de `npm run build`, `node --test "dist/tests/contract/mission-ticket-create-cli.test.js" "dist/tests/integration/create-ticket.test.js" "dist/tests/integration/mission-resume.test.js"` et `npm test`, tous verts.

### Completion Notes List

- Ajout de la commande `corp mission ticket create` avec parsing mission-centrique, erreurs deterministes en francais et rendu final `Ticket cree: <ticket_id>` suivi du resume mission mis a jour.
- Introduction du contrat `Ticket` V1, du stockage fichier dedie, du service `create-ticket`, du champ optionnel `ticketId` dans le journal et du helper `ticket-board-projection` sans read-model parallele.
- La creation de ticket met a jour `mission.ticketIds`, `mission.eventIds`, `mission.resumeCursor`, `mission-status.json`, `ticket-board.json` et `resume-view.json`, tout en gardant `approval-queue.json` et `artifact-index.json` inchanges.
- Les dependances inconnues et cross-mission sont rejetees explicitement; les missions `completed` et `cancelled` refusent toute creation de ticket sans muter leur historique.
- Validation executee avec succes via `npm run build`, les tests cibles ticket/reprise et `npm test` (41 tests verts).

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `_bmad-output/implementation/2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `packages/contracts/src/ticket/ticket.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-ticket-repository.ts`
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/contract/mission-ticket-create-cli.test.ts`
- `tests/integration/create-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`

## Change Log

- 2026-04-09: contexte complet de la Story 2.1 cree et statut passe a `ready-for-dev`.
- 2026-04-09: implementation complete de `corp mission ticket create`, du contrat `Ticket` V1, du repository/service ticket, des projections ticket/reprise et de la couverture de tests associee; statut passe a `review`.
