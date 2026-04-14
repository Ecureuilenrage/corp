# Story 1.4: Mettre en pause, relancer ou cloturer une mission sans perdre l'historique

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want faire evoluer explicitement le cycle de vie d'une mission,
so that la mission reste pilotable dans le temps sans effacer son historique.

## Acceptance Criteria

1. Given une mission est en cours, bloquee ou en attente d'approbation
   When l'operateur la met en pause, la relance ou la cloture
   Then la mission change d'etat via des transitions autorisees par le noyau V1
   And les tickets, artefacts, approbations et evenements existants restent preserves

2. Given une transition de cycle de vie est demandee
   When la mutation est appliquee
   Then un evenement de mission correspondant est ecrit avant mise a jour des projections
   And l'etat affiche en CLI reste coherent avec l'historique journalise

## Tasks / Subtasks

- [x] Exposer une surface CLI mission-centrique pour les transitions de cycle de vie (AC: 1, 2)
  - [x] Ajouter `corp mission pause`, `corp mission relaunch` et `corp mission close` a l'aide CLI existante, avec `--mission-id` obligatoire pour les trois commandes.
  - [x] Exiger `--outcome completed|cancelled` pour `corp mission close` afin de rester aligne sur le contrat `MissionStatus` existant et d'eviter un pseudo-statut `closed`.
  - [x] Garder `apps/corp-cli` limite au parsing, a l'appel de service et au rendu du resultat; aucune logique de transition, de validation de statut ou de chemin fichier ne doit vivre dans la CLI.

- [x] Introduire un service unique de transition de cycle de vie dans le `mission-kernel` (AC: 1, 2)
  - [x] Centraliser les transitions autorisees dans une table explicite et testee plutot que disperser des `if` de statut dans plusieurs commandes.
  - [x] Charger la mission via `FileMissionRepository`, valider l'action demandee contre l'etat courant, puis construire un nouveau snapshot `Mission` avec `status`, `eventIds`, `resumeCursor` et `updatedAt` mis a jour, en preservant `createdAt`, `ticketIds`, `artifactIds` et `policyProfileId`.
  - [x] Rejeter de facon deterministe les transitions impossibles ou deja terminales; ne jamais traiter une demande invalide comme un no-op silencieux.

- [x] Journaliser les transitions avant toute projection et persister le snapshot mis a jour (AC: 1, 2)
  - [x] Emettre un evenement `mission.paused`, `mission.relaunched`, `mission.completed` ou `mission.cancelled` avant toute reecriture de `mission-status.json` ou `resume-view.json`.
  - [x] Conserver `payload.mission` dans chaque evenement de cycle de vie pour que `readMissionResume` puisse continuer a reconstruire la mission a partir du journal append-only sans branche speciale.
  - [x] Ajouter au payload les metadonnees minimales utiles a l'audit (`previousStatus`, `nextStatus`, `trigger: operator`, et si necessaire un `reason` optionnel), sans etendre le schema coeur `Mission`.
  - [x] Reutiliser le repository fichier et les writers de projections existants; ne pas introduire un second mecanisme de persistence ou une nouvelle projection read-model parallele.

- [x] Garder la lecture `status` / `resume` coherente apres les transitions (AC: 2)
  - [x] Faire evoluer la derivation de `nextOperatorAction` pour qu'une mission `blocked`, `completed` ou `cancelled` ne renvoie plus le message par defaut "Aucun ticket n'existe encore..." lorsqu'il devient trompeur.
  - [x] Reutiliser `formatMissionResume` comme sortie principale apres une mutation de cycle de vie, afin que l'operateur voie immediatement le nouvel etat mission dans le meme format que `status` / `resume`.
  - [x] Laisser `ticket-board`, `approval-queue` et `artifact-index` intacts; ces projections peuvent rester vides au scope actuel mais elles ne doivent jamais etre reinitialisees ou nettoyees par une transition mission.

- [x] Ajouter la couverture de tests et les non-regressions associees (AC: 1, 2)
  - [x] Ajouter un test contractuel couvrant l'aide CLI et les erreurs deterministes pour `pause`, `relaunch` et `close`, sans fuite de vocabulaire vendor.
  - [x] Ajouter un test d'integration couvrant au minimum le parcours public `ready -> blocked -> ready -> completed` en verifiant a chaque etape le `status`, le dernier `eventId`, `resumeCursor`, la conservation de `createdAt` et l'append de `eventIds`.
  - [x] Ajouter un test d'integration pour `close --outcome cancelled` et un test de refus pour des transitions interdites, par exemple `relaunch` apres `completed` ou `pause` apres `cancelled`.
  - [x] Ajouter une non-regression qui supprime ou corrompt `resume-view.json` apres une transition de cycle de vie, puis verifie que `mission resume` reconstruit correctement la mission a partir du journal enrichi de ces nouveaux evenements.

## Dev Notes

### Story Intent

Cette story clot l'Epic 1 sur sa dimension "cycle de vie mission" sans faire glisser le scope vers les tickets, l'execution adaptee ou la file d'approbation complete des epics suivants. L'objectif est d'ajouter des mutations de statut explicites, auditables et relisibles par la CLI, en restant dans le pattern deja etabli par les Stories 1.2 et 1.3: journal append-only, snapshot mission, projections reconstruites, resume operateur scannable.

### Current Project State

- La CLI expose aujourd'hui `corp mission bootstrap`, `create`, `status` et `resume`; aucun verbe de mutation de cycle de vie n'existe encore.
- Le contrat `MissionStatus` courant est deja aligne sur l'architecture: `draft|ready|running|blocked|awaiting_approval|completed|failed|cancelled`. Aucune valeur `paused` ou `closed` n'existe dans le schema coeur actuel.
- `createMission` suit deja l'ordre attendu par l'architecture: validation, preallocation d'IDs, append du journal, persistance du snapshot mission, mise a jour des projections `mission-status` et `resume-view`.
- `readMissionResume` reconstruit deja la mission a partir du journal en scannant les evenements qui embarquent `payload.mission`; la Story 1.4 doit s'appuyer sur ce mecanisme, pas le contourner.
- `FileMissionRepository.save()` sait deja reecrire le snapshot mission sur disque; la story peut le reutiliser pour les transitions sans ajouter de repository secondaire.
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas supposer de commit history ou de worktrees Git pour cette story.
- Aucun document UX dedie n'a ete identifie dans `C:/Dev/PRJET/corp/_bmad-output/planning`; la story doit donc rester alignee sur la sortie CLI existante, mission-centrique et lisible en un seul scan.

### Architecture Compliance

- Le document d'architecture fait foi sur le contrat coeur: ne pas ajouter `paused` ni `closed` a `MissionStatus`. La pause operateur doit etre modelisee via une transition explicite compatible avec les statuts deja approuves. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract]
- Toute transition significative doit produire un evenement avant toute projection. La Story 1.4 doit donc suivre le meme ordre que `createMission` au lieu de mettre a jour d'abord `mission.json` ou `resume-view.json`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules]
- Les types d'evenements doivent suivre le pattern `domain.action`; utiliser donc des noms comme `mission.paused`, `mission.relaunched`, `mission.completed`, `mission.cancelled`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 4.2 Naming Patterns]
- La reprise operateur continue de lire `resume view` en premier puis de reconstruire depuis le journal si necessaire; toute mutation de cycle de vie doit rester visible dans ce flux, pas dans un transcript brut ni dans un format ad hoc. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 4.4 Process Patterns]
- La CLI ne parle qu'aux services applicatifs; elle ne doit connaitre ni la forme des evenements JSONL, ni la structure physique de `.corp/`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.2 Architectural Boundaries]
- Aucun detail vendor OpenAI/Codex ne doit apparaitre dans la CLI, dans `Mission`, dans les nouveaux evenements ou dans les projections de cette story. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]

### Product And Epic Guardrails

- Le PRD et l'Epic 1 demandent qu'une mission reste pilotable au-dela du transcript, y compris lorsqu'elle est interrompue ou cloturee. Si l'operateur doit encore editer des JSON a la main pour figer ou relancer une mission, la story rate sa cible. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - User Success; Parcours 1; Parcours 2; FR4]
- La Story 1.4 doit finir la boucle mission-centrique de l'Epic 1, mais elle ne doit pas anticiper le modele ticket/runtime de l'Epic 2 ni la file d'approbation operationnelle de l'Epic 3. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 1; Story 1.4; Epic 2; Epic 3]
- La promesse de preservation d'historique implique qu'aucune transition ne supprime, reinitialise ou ecrase les traces deja confirmees de la mission. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 1.4 Acceptance Criteria; `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Fiabilite Et Reprise]

### Previous Story Intelligence

- Reutiliser le pattern etabli en 1.2: une mutation mission doit passer par `mission-kernel`, emettre un evenement complet dans `events.jsonl`, puis reecrire le snapshot mission et les projections critiques. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md` - Implementation Guardrails; Event And Projection Requirements]
- Reutiliser le pattern etabli en 1.3: la lecture operateur reste mission-centrique, scannable, et soutenue par `readMissionResume` + `formatMissionResume`; ne pas introduire un formateur alternatif juste pour les transitions de cycle de vie. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission.md` - Implementation Guardrails; CLI Requirements]
- `readMissionResume` reconstruit deja `resume-view` si la projection est absente, invalide ou stale. Les nouveaux evenements de cycle de vie doivent donc rester compatibles avec cette reconstruction par simple lecture de `payload.mission`. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`]
- `resume-view-projection.ts` derive aujourd'hui `nextOperatorAction` surtout a partir des tickets et approvals. Cette logique doit etre etendue avec prudence pour tenir compte des nouveaux statuts mission sans casser le cas nominal "aucun ticket encore". [Source: `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`]
- `dist/` est un artefact de build; ne pas le modifier manuellement. Toute nouvelle logique doit vivre sous `apps/`, `packages/` ou `tests/`. [Source: observation du repo `C:/Dev/PRJET/corp`]

### Lifecycle Status Modeling Guardrail

Le point le plus sensible de cette story est l'ecart apparent entre le vocabulaire produit ("mettre en pause") et le contrat coeur actuel (qui ne contient pas `paused`). La regle a suivre pour cette story est donc:

- modeliser la pause operateur comme une transition vers `status = "blocked"` au niveau du schema `Mission`;
- conserver la semantique explicite de la pause dans le type d'evenement `mission.paused` et dans le payload d'audit (`previousStatus`, `nextStatus`, `trigger`);
- ne pas ajouter `paused` a `MissionStatus`, ne pas inventer une projection speciale de pause, et ne pas remplacer `blocked` par un vocabulaire parallelle;
- ne pas introduire non plus un statut `closed`: la cloture doit aboutir a `completed` ou `cancelled`, explicites et deja prevus par l'architecture.

Cette regle evite de casser le contrat courant tout en gardant une trace auditable de l'intention operateur.

### Transition Matrix Requirements

Le service de cycle de vie doit centraliser au minimum les transitions suivantes:

- `pause`: `ready|running|awaiting_approval|failed -> blocked`
- `relaunch`: `blocked|failed|awaiting_approval -> ready`
- `close --outcome completed`: `ready|running|blocked|awaiting_approval|failed -> completed`
- `close --outcome cancelled`: `ready|running|blocked|awaiting_approval|failed -> cancelled`

Regles complementaires:

- `completed` et `cancelled` sont terminaux pour cette story; ils doivent refuser `pause`, `relaunch` et un second `close`.
- `pause` sur une mission deja `blocked` doit echouer explicitement; `relaunch` sur une mission deja `ready` doit echouer explicitement.
- Le statut `running` existe dans le contrat coeur, mais aucun runtime concret ne le produit encore dans le scope actuel. Le service peut donc le supporter comme etat source si une mission chargee l'utilise, sans etendre cette story en runtime d'execution.
- Le statut `draft` reste hors du flux public actuel; si une mission `draft` apparait, preferer un rejet deterministe plutot qu'un comportement implicite.

### Implementation Guardrails

- Ne pas ajouter `paused` ou `closed` a `packages/contracts/src/mission/mission.ts`; la Story 1.4 doit respecter le contrat approuve, pas le redefinir.
- Ne pas introduire de commande interactive, de confirmation TTY ou de selection implicite de mission. Les trois commandes doivent exiger `--mission-id`; `close` doit exiger `--outcome`.
- Ne pas auto-bootstrap silencieusement un workspace non initialise. Conserver le pattern d'erreur explicite vers `corp mission bootstrap`.
- Ne pas muter, nettoyer ou reinitialiser `ticketIds`, `artifactIds`, `approval-queue.json`, `ticket-board.json` ou `artifact-index.json` pendant une transition de cycle de vie.
- Ne pas faire de `resume-view.json` la source de verite pour les mutations. Le service doit lire `mission.json` + journal, puis reecrire les projections a la fin.
- Ne pas ecrire un evenement de transition sans embarquer le snapshot mission mis a jour dans `payload.mission`; sinon la reconstruction `readMissionResume` deviendra incomplete ou exigera un traitement special.
- Ne pas basculer une mission sur `running` lors de `relaunch` dans cette story. Sans dispatcher ni runtime ticket, le retour a `ready` est le choix le plus stable et le plus honnete.
- Ne pas garder le `nextOperatorAction` par defaut pour les statuts terminaux ou bloques si le message devient faux. L'operateur doit lire une action utile ou l'absence d'action utile.
- Si un contexte d'audit supplementaire est ajoute (`reason`, `trigger`, `previousStatus`, `nextStatus`), il doit vivre dans le payload d'evenement, pas dans le schema coeur `Mission`.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/projections/mission-status-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/mission-service/create-mission.ts`
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `tests/contract/mission-lifecycle-cli.test.ts`
- `tests/integration/mission-lifecycle.test.ts`
- `tests/integration/mission-resume.test.ts`

### CLI Contract Requirements

- `corp mission help` doit documenter `pause`, `relaunch` et `close`.
- `corp mission pause --root <workspace> --mission-id <mission_id>` doit produire une erreur deterministe si `--mission-id` manque, si la mission est inconnue, si le workspace n'est pas initialise ou si la transition est interdite.
- `corp mission relaunch --root <workspace> --mission-id <mission_id>` doit suivre les memes regles d'erreur deterministes.
- `corp mission close --root <workspace> --mission-id <mission_id> --outcome <completed|cancelled>` doit refuser une valeur d'outcome absente ou invalide avec un message stable en francais.
- Apres succes, la sortie CLI recommandee est le resume mission mis a jour dans le meme format que `mission status` / `mission resume`, afin d'eviter des formats divergents.

### Event And Projection Requirements

- Chaque transition de cycle de vie alloue un nouvel `event_*`, l'ajoute a `mission.eventIds`, positionne `mission.resumeCursor` sur ce nouvel `eventId`, et met a jour `mission.updatedAt`.
- `mission.createdAt` doit rester intact apres toutes les transitions de cette story.
- `mission-status.json` doit toujours refleter le dernier snapshot mission persiste.
- `resume-view.json` doit etre reecrit avec le nouveau statut mission, le nouveau `lastEventId`, le nouvel `updatedAt` et un `nextOperatorAction` coherent avec l'etat.
- Les evenements doivent rester append-only. Aucune correction d'une transition precedente ne doit reecrire les lignes deja journalisees.
- Les projections `ticket-board`, `approval-queue` et `artifact-index` ne doivent pas etre recreees ni reseedees par une transition mission.

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, sans Jest/Vitest.
- Verifier que l'aide CLI mentionne `pause`, `relaunch` et `close` sans fuite `codex` / `openai`.
- Verifier qu'une mission creee en 1.2 peut etre mise en pause, relancee puis cloturee, avec journal enrichi et projections coherentes.
- Verifier qu'un `pause` reussi fait passer la mission a `blocked`, qu'un `relaunch` la remet a `ready`, et qu'un `close --outcome completed|cancelled` la place dans un etat terminal conforme au contrat.
- Verifier que `mission status` et `mission resume` restent lisibles apres ces transitions et n'affichent pas un `nextOperatorAction` trompeur pour les statuts bloques ou termines.
- Verifier les refus deterministes pour les transitions interdites et pour `--outcome` manquant/invalide.
- Verifier qu'une projection `resume-view` absente ou stale apres une transition de cycle de vie est reconstruite correctement depuis le journal.

### Scope Exclusions

- Hors scope: creation, edition, priorisation ou execution de tickets; ces sujets appartiennent a l'Epic 2.
- Hors scope: workflow complet d'approbation, arbitrage detaille et journal d'audit riche; ces sujets appartiennent a l'Epic 3.
- Hors scope: ajout d'un statut `paused`, `closed` ou de metadonnees permanentes de "raison de pause" dans le schema coeur `Mission`.
- Hors scope: suppression physique, archivage, purge ou migration du stockage mission.
- Hors scope: auto-relance d'execution, dispatcher, runtime `running` concret ou toute orchestration au niveau ticket.

### Latest Technical Information

- Le repo actuel epingle `Node >=20.0.0`, `TypeScript ^5.9.3` et `@types/node ^24.5.2`; cette story doit rester dans cette baseline au lieu d'ajouter un nouvel outillage ou une dependance externe. [Source: `C:/Dev/PRJET/corp/package.json`]
- La compilation cible `ES2022`, `CommonJS`, `moduleResolution: Node`, avec `strict: true` et `noEmitOnError: true`; toute nouvelle logique doit rester compatible avec cette configuration. [Source: `C:/Dev/PRJET/corp/tsconfig.json`]
- Les APIs Node natives deja presentes (`node:fs/promises`, `node:crypto`, `node:test`) suffisent pour cette story; aucune bibliotheque de state machine, de CLI parsing ou de persistence n'est justifiee ici. [Source: `C:/Dev/PRJET/corp/package.json`; `C:/Dev/PRJET/corp/tsconfig.json`; observation du code courant]

### Hypotheses Explicites

- Pour rester conforme a l'architecture, la pause operateur sera representee par `status = "blocked"` au niveau mission, et non par un nouveau statut `paused`.
- Dans le scope actuel, `relaunch` remet la mission a `ready`, pas a `running`, car aucun runtime d'execution mission/ticket n'existe encore pour materialiser un `running` honnete.
- La cloture doit exiger un outcome explicite `completed` ou `cancelled`; le produit parle de "cloturer" au niveau UX, mais le schema coeur doit rester explicite au niveau stockage.
- Le mecanisme de reconstruction `readMissionResume` continuera de s'appuyer sur `payload.mission`; chaque evenement de cycle de vie doit donc transporter le snapshot mission complet.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Overview; Epic 1; Story 1.3; Story 1.4; Epic 2; Epic 3
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - User Success; Parcours 1; Parcours 2; Exigences Specifiques A L'Outil Developpeur; Mission & Session Lifecycle; Fiabilite Et Reprise
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 1. Project Context Analysis; 3.3 Canonical Domain Contract; 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 4.2 Naming Patterns; 4.4 Process Patterns; 5.2 Architectural Boundaries
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 3.3 Proposition de forme canonique; 5.4 Interpretation pratique pour `corp`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes.md` - Implementation Guardrails; Event And Projection Requirements; File List
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission.md` - Implementation Guardrails; CLI Requirements; Testing Requirements
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/mission-status-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/create-mission.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/projection-store/file-projection-store.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-mission-repository.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-create-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/mission-resume-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/create-mission.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/mission-resume.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Introduire `updateMissionLifecycle` comme service unique de transition, avec matrice explicite `pause` / `relaunch` / `close`, rejection deterministe et ordre `journal -> snapshot mission -> mission-status -> resume`.
- Etendre la CLI `corp mission` avec `pause`, `relaunch` et `close`, en gardant `apps/corp-cli` limite au parsing strict (`--mission-id`, `--outcome`) et au rendu via `formatMissionResume`.
- Couvrir les parcours lifecycle par des tests contractuels et d'integration, y compris la reconstruction de `resume-view` depuis le journal apres corruption.

### Debug Log References

- 2026-04-09: analyse du contrat `MissionStatus`, du PRD, de l'architecture et du code courant pour cadrer l'ecart entre le verbe produit "pause" et l'absence de statut `paused` dans le schema coeur.
- 2026-04-09: verification du pattern technique deja en place (`createMission`, `readMissionResume`, projections locales, repository fichier) pour imposer la reutilisation plutot qu'une nouvelle couche de persistence.
- 2026-04-09: ajout des tests rouges pour la surface CLI lifecycle, le parcours `ready -> blocked -> ready -> completed`, les etats terminaux et la reconstruction `resume-view` apres transition.
- 2026-04-09: implementation du service `updateMissionLifecycle`, branchement CLI des commandes `pause`, `relaunch`, `close` et ajustement de `nextOperatorAction` pour les statuts bloques ou terminaux.
- 2026-04-09: validation complete par `npm test` apres compilation TypeScript et execution de 25 tests verts.

### Completion Notes List

- `corp mission pause`, `corp mission relaunch` et `corp mission close` sont exposes en CLI avec aide mise a jour, `--mission-id` obligatoire et `--outcome completed|cancelled` strict pour `close`.
- Le nouveau service `updateMissionLifecycle` centralise la matrice de transitions autorisees, ecrit des evenements append-only enrichis (`previousStatus`, `nextStatus`, `trigger`, `payload.mission`) puis persiste le snapshot mission et la projection `mission-status`.
- Le rendu `resume-view` reste coherent apres transition grace a `formatMissionResume` et a des messages `nextOperatorAction` utiles pour `blocked`, `completed` et `cancelled`.
- Une non-regression confirme que `mission resume` reconstruit correctement la mission depuis le journal apres corruption de `resume-view.json`.
- Risque residuel documente: les statuts source `running`, `awaiting_approval` et `failed` sont supportes par la matrice de transition de cette story, mais ils ne sont pas encore materialises naturellement par un parcours mission CLI bout en bout. Leur concretisation est attendue surtout via l'Epic 2 (`Story 2.3` pour l'execution isolee, `Story 2.4` pour le suivi des tickets et etats visibles) et l'Epic 3 (`Story 3.1` et `Story 3.2` pour l'attente d'approbation, `Story 3.3` et `Story 3.5` pour reprise et relance apres echec). Une couverture mission e2e supplementaire sera utile lorsque ces stories seront implementees.
- Validation executee: `npm test` (build TypeScript + 25 tests verts).

### File List

- `_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `tests/contract/mission-lifecycle-cli.test.ts`
- `tests/integration/mission-lifecycle.test.ts`
- `tests/integration/mission-resume.test.ts`

## Change Log

- 2026-04-09: implementation des transitions mission `pause`, `relaunch` et `close`, avec evenements audites, CLI mission-centrique, tests lifecycle et story passee en `review`.
