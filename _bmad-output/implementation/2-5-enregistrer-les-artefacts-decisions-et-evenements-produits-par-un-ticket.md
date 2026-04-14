# Story 2.5: Enregistrer les artefacts, decisions et evenements produits par un ticket

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want acceder aux sorties d'un ticket depuis le contexte de mission,
so that je puisse juger l'avancement reel et comprendre d'ou viennent les resultats.

## Acceptance Criteria

1. Given une tentative produit des fichiers, rapports ou sorties structurees
   When ces sorties sont detectees puis enregistrees
   Then chaque `Artifact` reference au minimum `missionId`, `ticketId`, `producing_event_id` et, si present, `attemptId` et `workspaceIsolationId`
   And la granularite des `artifactIds` et `eventIds` reste suffisamment fine pour diagnostiquer ou relancer partiellement

2. Given des artefacts et decisions ont ete lies a un ticket
   When l'operateur consulte la mission
   Then il peut naviguer du ticket vers ses artefacts et vers l'evenement ou la decision source
   And la consultation ne depend pas du transcript brut de l'execution

## Tasks / Subtasks

- [x] Introduire le contrat `Artifact` V1, son stockage fichier et le read-side `artifact-index` officiel (AC: 1, 2)
  - [x] Ajouter `packages/contracts/src/artifact/artifact.ts` avec un contrat coeur minimal et stable comprenant au minimum `id`, `missionId`, `ticketId`, `producingEventId`, `attemptId | null`, `workspaceIsolationId | null`, `kind`, `title`, `createdAt` et des metadonnees optionnelles bornees (`label`, `path`, `mediaType`, `summary`, `payloadPath`, `sha256`, `sizeBytes` ou equivalent).
  - [x] Etendre `packages/storage/src/fs-layout/workspace-layout.ts` avec un helper du type `resolveArtifactStoragePaths(layout, missionId, ticketId, artifactId)` et persister chaque snapshot sous `.corp/missions/<missionId>/tickets/<ticketId>/artifacts/<artifactId>/artifact.json`, avec sidecar optionnel pour les payloads bornes.
  - [x] Ajouter `packages/storage/src/repositories/file-artifact-repository.ts` avec au minimum `save(...)`, `findById(...)`, `listByTicketId(...)` et `listByMissionId(...)`, plutot que de scanner le journal ou de charger des artefacts depuis la CLI.
  - [x] Conserver `Mission.artifactIds` et `Ticket.artifactIds` comme references canoniques de provenance; ne pas ajouter de `currentArtifactId`, `lastArtifactId` ou compteur persiste au schema coeur si un read-model peut le derivier.
  - [x] Creer `packages/journal/src/projections/artifact-index-projection.ts` et un read-side de reconstruction dedie (par exemple `read-mission-artifacts.ts`) qui rebuilde `artifact-index.json` depuis les snapshots d'artefacts, les tickets, la mission et le journal quand le fichier est absent, stale, corrompu ou incoherent.

- [x] Detecter et normaliser les sorties produites par l'adaptateur et par le workspace isole sans fuite vendor (AC: 1)
  - [x] Etendre `ExecutionAdapterLaunchResult` pour pouvoir retourner, en plus du `status` et de `adapterState`, un bundle de sorties normalisees exploitable par `corp` (par exemple `text outputs`, `structured outputs`, `report refs` ou equivalent), sans exposer la forme brute complete de `response.output`.
  - [x] Ajouter une couche de detection repo-locale, recommande ici comme `packages/workspace-isolation/src/workspace-artifact-detector.ts`, qui inspecte l'espace isole apres execution:
    - `git_worktree`: s'appuyer sur un diff/statut Git bornes si le workspace runtime est vraiment un repo exploitable,
    - `workspace_copy`: comparer `sourceRoot` et `workspacePath` de facon deterministe,
    - dans les deux cas, exclure `.corp/` et les metadata d'isolation pour ne pas auto-indexer le runtime lui-meme.
  - [x] Distinguer les artefacts de fichiers workspace des artefacts de sortie adapteur:
    - fichier cree ou modifie,
    - rapport texte,
    - sortie structuree JSON bornee,
    - pointeur de sortie de reponse utile au diagnostic.
  - [x] Une sortie significative = un `Artifact`; ne pas compacter toute la tentative dans un unique blob JSON opaque.
  - [x] Ne pas enregistrer d'artefact tant qu'une tentative reste `requested`, `running` ou `awaiting_approval` sans sortie concrete detectee. Pour le background deja ouvert mais non complete, l'absence d'artefact local est acceptable en 2.5.

- [x] Enregistrer les artefacts dans le journal, les snapshots et les projections sans casser les invariants 2.3/2.4 (AC: 1)
  - [x] Ajouter un service explicite, recommande ici comme `packages/ticket-runtime/src/artifact-service/register-artifacts.ts`, qui:
    - prealloue des `artifact_*`,
    - persiste les snapshots d'artefacts,
    - append les evenements `artifact.detected` et `artifact.registered`,
    - met a jour `mission.artifactIds`, `ticket.artifactIds`, `mission.eventIds`, `ticket.eventIds`, `resumeCursor`, `updatedAt`,
    - reecrit les projections officielles via le seam central plutot que par ecriture inline dans la CLI.
  - [x] Faire pointer `Artifact.producingEventId` vers l'evenement qui a reellement produit ou revele la sortie utile, typiquement un evenement terminal d'execution (`execution.completed`, `execution.failed`) ou un autre evenement source explicite. Les evenements `artifact.detected` et `artifact.registered` doivent transporter cette provenance, pas la remplacer.
  - [x] Preserver la granularite fine du journal: un artefact detecte/registere important = un evenement distinct, afin de garder des `eventIds` exploitables pour audit partiel et relance ciblee future.
  - [x] Ne pas faire muter `mission.status` ou `ticket.status` uniquement parce qu'un artefact est enregistre; la story change la provenance et la lisibilite des sorties, pas la machine a etats.
  - [x] Conserver `approval-queue.json` strictement inchange dans cette story.

- [x] Exposer une navigation operateur mission-centrique vers les artefacts et leur origine, sans attendre l'Epic 3 audit (AC: 2)
  - [x] Ajouter une commande `corp mission artifact list --root <workspace> --mission-id <mission_id> [--ticket-id <ticket_id>]` pour lister les artefacts d'une mission, avec filtre optionnel par ticket.
  - [x] Ajouter une commande `corp mission artifact show --root <workspace> --mission-id <mission_id> --artifact-id <artifact_id>` pour afficher le detail d'un artefact et sa provenance utile.
  - [x] Garder la CLI limitee au parsing, a l'appel de service et au rendu. La CLI ne doit ni lire directement `artifact-index.json`, ni scanner le journal, ni reconstruire un graphe d'artefacts inline.
  - [x] `artifact list` doit exposer au minimum: `artifactId`, `ticketId`, `kind`, `title` ou `path`, `producingEventId`, `sourceEventType`, `attemptId` et `workspaceIsolationId` si presents.
  - [x] `artifact show` doit exposer un resume scannable du contexte source: `producingEventId`, `sourceEventType`, `occurredAt`, `actor`, `source`, et, si deja present dans le payload source, un `approvalId` ou une reference de decision. Ne pas introduire de browser journal generaliste ni de transcript dump.
  - [x] Etendre `corp mission help` en francais pour presenter ces nouvelles surfaces sans fuite `openai`, `response_id`, `vendorStatus`, prompt brut ou payload HTTP.

- [x] Integrer les artefacts aux surfaces `status` / `resume` / `ticket board` sans perdre la separation 2.4 (AC: 2)
  - [x] Faire en sorte que `readMissionResume(...)` consomme le read-side `artifact-index` reconstruit, plutot qu'une lecture naive du fichier de projection, afin que `lastRelevantArtifact` devienne fiable meme si la projection est stale ou corrompue.
  - [x] Garder `corp mission resume` compact: il peut afficher le dernier artefact pertinent deja prevu, mais il ne doit pas devenir un dump complet d'artefacts.
  - [x] `corp mission status` et/ou `ticket-board.json` peuvent etre enrichis avec des hints de navigation bornes (`artifactCount`, `lastArtifactId`, `lastArtifactLabel` ou equivalent) par ticket si cela aide la navigation operateur, a condition de rester derivable du read-model et de ne pas gonfler les snapshots coeur.
  - [x] Ne pas creer de projection parallele `artifact-board.json`, `event-board.json` ou `decision-board.json`; `artifact-index.json` reste la projection officielle V1 pour les sorties.
  - [x] S'assurer que chaque entree `artifact-index` porte toujours `missionId` et `ticketId`, afin d'eviter qu'un artefact sans `missionId` fuite dans les resumes de toutes les missions.

- [x] Ajouter la couverture de tests et les non-regressions necessaires (AC: 1, 2)
  - [x] Ajouter un test contractuel `mission-artifact-cli.test.ts` couvrant `help`, `artifact list`, `artifact show` et les gardes de surface (`--mission-id`, `--ticket-id`, `--artifact-id`) avec messages stables en francais.
  - [x] Ajouter un scenario d'integration "foreground success + workspace outputs" qui:
    - bootstrappe un workspace,
    - cree une mission et un ticket,
    - lance `ticket run` avec un adaptateur fake qui retourne une sortie structuree,
    - simule une mutation de fichier dans l'isolation,
    - verifie l'enregistrement de plusieurs artefacts avec `artifactIds` sur `Mission` et `Ticket`, `producingEventId` renseigne, `attemptId` / `workspaceIsolationId` propages et `artifact-index.json` alimente.
  - [x] Ajouter un test de reconstruction qui supprime ou corrompt `artifact-index.json`, puis verifie que `mission artifact list`, `mission artifact show` et `mission resume` reconstruisent un index valide a partir des snapshots/journal.
  - [x] Ajouter un test de non-regression prouvant qu'un `ticket run --background` non terminal ne cree pas d'artefacts fantomes et que `artifact-index.json` ne bouge pas sans sortie concrete.
  - [x] Ajouter un test de non-regression prouvant qu'aucune donnee vendor (`responseId`, `sequenceNumber`, `vendorStatus`, prompt complet, output brut de la Responses API) n'apparait dans `artifact-index.json`, `mission artifact list`, `mission artifact show`, `mission status` ni `mission resume`.
  - [x] Verifier qu'un artefact binaire ou volumineux reste reference par metadata/chemin/empreinte, sans inline du contenu complet dans les projections.
  - [x] Conserver `npm test` vert sur l'ensemble de la suite existante, actuellement a 73 tests verts sur `C:/Dev/PRJET/corp` au 2026-04-09.

## Dev Notes

### Story Intent

Cette story active enfin la primitive `Artifact` deja prevue par le PRD et l'architecture. 2.3 a ouvert la tentative d'execution isolee et 2.4 a rendu les tickets lisibles depuis la mission. 2.5 doit maintenant rendre les sorties elles-memes consultables, attribuables et navigables depuis la mission, sans attendre encore la surface d'audit generaliste de l'Epic 3.

### Current Project State

- Le repo possede deja `Mission.artifactIds` et `Ticket.artifactIds`, mais aucun contrat `Artifact`, aucun repository d'artefacts et aucune projection d'artefacts vivante n'existent encore. `artifact-index.json` n'est aujourd'hui qu'un stub vide initialise au bootstrap. [Source: `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`; `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`; `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`]
- `readMissionResume(...)` lit deja `artifact-index.json` et sait afficher `lastRelevantArtifact` via `MissionResume`, mais ce champ reste toujours vide faute d'alimentation reelle. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`; `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`; `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`]
- `run-ticket.ts` persiste aujourd'hui l'isolation, les evenements `workspace.isolation_created`, `ticket.claimed`, `execution.requested`, `execution.background_started`, `execution.completed` et `execution.failed`, ainsi que `ExecutionAttempt`. En revanche, aucune sortie d'execution n'est transformee en artefact; les tests existants verifient meme explicitement que `artifact-index.json` reste byte-for-byte inchange apres `ticket run`. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`; `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`; `C:/Dev/PRJET/corp/tests/integration/run-ticket.test.ts`]
- `ExecutionAdapterLaunchResult` ne retourne aujourd'hui que `status` et `adapterState`. L'adaptateur `codex_responses` ne normalise pas encore les sorties textuelles/structurees exploitables par `corp`. [Source: `C:/Dev/PRJET/corp/packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`]
- `WorkspaceIsolationMetadata` expose deja `workspaceIsolationId`, `kind`, `sourceRoot` et `workspacePath`, ce qui fournit un point d'ancrage propre pour detecter des fichiers crees/modifies dans l'isolation sans reparcourir le transcript. [Source: `C:/Dev/PRJET/corp/packages/workspace-isolation/src/workspace-isolation.ts`]
- La Story 2.4 a deja etabli le pattern read-side defensif avec `read-ticket-board(...)`, la reconstruction de projection si le fichier est manquant/corrompu, et des sorties CLI scannables mission-centriques. 2.5 doit reprendre cette philosophie pour `artifact-index`. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/2-4-suivre-l-avancement-et-les-blocages-d-un-ticket-depuis-la-mission.md`; `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/read-ticket-board.ts`]
- Aucun depot Git exploitable n'est detecte a la racine de `C:/Dev/PRJET/corp`; ne pas extrapoler cette absence au workspace runtime des tickets, qui peut etre Git ou non-Git au moment de l'execution. [Source: verification locale 2026-04-09]
- Verification locale effectuee le 2026-04-09: `npm test` passe integralement avec 73 tests verts sur l'etat courant du repo. [Source: execution locale `npm test`]

### Architecture Compliance

- Le contrat coeur V1 reste borne a `Mission`, `Ticket`, `ExecutionAttempt`, `Event` et `Artifact`. 2.5 doit donc introduire un vrai contrat `Artifact`, pas juste surcharger `MissionResumeArtifact` comme pseudo schema persistant. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract]
- L'architecture impose que tout artefact reference l'evenement producteur et que toute transition significative produise un evenement avant toute projection. 2.5 doit garder cette provenance explicite au coeur du design. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - Additional Requirements; 4.1 Domain Consistency Rules]
- Les projections officielles V1 sont `mission status`, `ticket board`, `approval queue`, `artifact index`, `resume view`. 2.5 doit enrichir `artifact-index.json`, pas inventer un read-model concurrent. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model; 4.5 Enforcement Guidelines]
- Les details OpenAI/Codex doivent rester confines a `executionHandle.adapterState` ou `ExecutionAttempt.adapterState`. `artifact-index.json` et les surfaces CLI ne doivent pas devenir un second canal de fuite vendor. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]
- Les adaptateurs executent et traduisent, mais la mutation de `Mission`, `Ticket`, `Artifact` et des projections doit rester centralisee dans les services `corp`, pas dans `apps/corp-cli` ni dans l'adaptateur lui-meme. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.2 Architectural Boundaries]
- L'Epic 3 portera l'audit structure et la navigation generaliste dans le journal. 2.5 doit donc exposer une provenance utile a travers les artefacts sans ouvrir un navigateur de journal complet. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3; Story 3.4]

### Product And Epic Guardrails

- Le PRD demande qu'un operateur puisse acceder aux artefacts produits par chaque tache depuis le contexte de mission et comprendre qui a fait quoi sans repartir du transcript brut. 2.5 est la story qui materialise enfin cette promesse cote execution. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Execution & Artifact Flow; Reprise Et Auditabilite; FR12; FR13; FR14; Resultats Mesurables]
- L'Epic 2 veut relier decisions, artefacts et evenements aux tickets. 2.5 doit donc s'appuyer sur les `eventIds` et la provenance du journal deja en place, plutot que d'introduire un systeme ad hoc de notes manuelles ou de parsing de transcript. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.5]
- La Story 2.5 ne doit pas anticiper la queue d'approbation fonctionnelle ou la vue d'audit generaliste. Elle peut exposer un `approvalId` ou une reference de decision si ces donnees existent deja dans un evenement source, mais elle ne doit pas creer de nouveau domaine `Decision` ou `ApprovalRequest`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 3.1; Story 3.2; Story 3.4]

### Previous Story Intelligence

- La Story 2.3 a formalise `ExecutionAttempt`, `workspaceIsolationId`, le seam `workspace-isolation` et la normalisation `codex_responses`. 2.5 doit capitaliser dessus pour relier un artefact a une tentative et a un espace isole reel, au lieu d'inventer des identifiants paralleles. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`]
- La Story 2.3 a aussi verrouille un garde important: `artifact-index.json` et `approval-queue.json` ne devaient pas bouger pendant `ticket run`. 2.5 est donc le premier endroit legitime pour modifier `artifact-index`, mais `approval-queue.json` doit rester stable. [Source: `C:/Dev/PRJET/corp/tests/integration/run-ticket.test.ts`]
- La Story 2.4 a etabli la separation claire `status` detaille / `resume` compact / `ticket board` supervision, ainsi qu'un pattern de reconstruction defensive des projections. 2.5 doit suivre exactement la meme discipline pour les surfaces artefact. [Source: `C:/Dev/PRJET/corp/_bmad-output/implementation/2-4-suivre-l-avancement-et-les-blocages-d-un-ticket-depuis-la-mission.md`]
- `rewriteMissionReadModels(...)` centralise deja la reecriture de `mission-status` et `ticket-board`. 2.5 doit l'etendre ou la composer pour garder un point central de rafraichissement des read-models, au lieu d'ecrire `artifact-index.json` depuis plusieurs services. [Source: `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`]
- `readMissionResume.filterMissionEntities(...)` laisse passer des entites sans `missionId`; cela renforce l'exigence 2.5 de toujours persister `missionId` sur chaque artefact et chaque entree de `artifact-index`. [Source: `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`]

### Artifact Model And Detection Requirements

Le contrat artefact de cette story doit traiter les points suivants comme non negociables:

- Chaque artefact persiste doit porter:
  - `id`
  - `missionId`
  - `ticketId`
  - `producingEventId`
  - `attemptId | null`
  - `workspaceIsolationId | null`
  - `kind`
  - `title`
  - `createdAt`
- Les metadonnees optionnelles recommandees pour l'usage CLI/read-side sont:
  - `label`
  - `path`
  - `mediaType`
  - `summary`
  - `payloadPath`
  - `sha256`
  - `sizeBytes`
  - `sourceEventType`
  - `sourceEventOccurredAt`
- `producingEventId` doit pointer vers l'evenement qui a reellement produit ou revele la sortie. Les evenements `artifact.detected` et `artifact.registered` servent a tracer la detection et la persistance, mais ne doivent pas effacer la provenance originale.
- Un artefact n'est pas un transcript brut. Pour des sorties lourdes ou binaires, stocker un chemin et des metadata, pas le contenu complet inline dans les projections.
- La detection doit couvrir au minimum:
  - fichiers workspace crees/modifies dans l'isolation,
  - sortie texte utile de l'adaptateur quand une reponse foreground se termine,
  - sortie structuree bornee si l'adaptateur en retourne une.
- Pour le chemin `git_worktree`, preferer un diff/statut Git borne. Pour le chemin `workspace_copy`, preferer une comparaison deterministe entre `sourceRoot` et `workspacePath`. Dans les deux cas, exclure `.corp/` et les metadata d'isolation.
- Ne pas enregistrer un artefact purement parce qu'un `responseId` existe. Il faut une sortie consultable pour l'operateur, pas un simple handle vendor.

### CLI Contract Requirements

- Surface recommandee:
  - `corp mission artifact list --root <workspace> --mission-id <mission_id> [--ticket-id <ticket_id>]`
  - `corp mission artifact show --root <workspace> --mission-id <mission_id> --artifact-id <artifact_id>`
- `corp mission help` doit presenter ces commandes avec un wording francais stable et mission-centrique.
- Messages d'erreur deterministes attendus pour:
  - `--mission-id` manquant sur `artifact list`
  - `--mission-id` manquant sur `artifact show`
  - `--artifact-id` manquant sur `artifact show`
  - `--ticket-id` inconnu si filtre par ticket
  - workspace non initialise
  - mission inconnue
  - artefact introuvable ou non rattache a la mission
  - projection `artifact-index` irreconciliable
- `artifact list` doit rester scannable sur une ligne par artefact; ne pas dumper un JSON complet.
- `artifact show` peut afficher un preview borne si un payload texte existe, mais ne doit jamais afficher:
  - prompt complet
  - headers HTTP
  - payload JSON brut complet de la Responses API
  - `responseId`, `sequenceNumber`, `vendorStatus` comme primitives coeur
- `corp mission status` peut aider la navigation en montrant des hints artefactiques bornees; `corp mission resume` doit rester oriente reprise.

### Event And Projection Requirements

- Nouveaux evenements recommandes:
  - `artifact.detected`
  - `artifact.registered`
- Ces evenements doivent porter dans leur payload au minimum:
  - le snapshot `artifact`
  - `producingEventId`
  - un `trigger` explicite
  - les snapshots `mission` et `ticket` mis a jour
- `artifact-index.json` doit devenir la projection officielle des sorties avec, pour chaque entree, les champs minimums de navigation mission/ticket/attempt/evenement.
- Le read-side artefact doit pouvoir reconstruire l'index depuis:
  - la mission
  - les tickets de la mission
  - les artefacts persistants
  - le journal, pour retrouver le contexte de l'evenement source si necessaire
- `mission-status.json` reste centre sur le snapshot mission.
- `ticket-board.json` peut etre enrichi de hints artefactiques derives, mais il ne devient pas la source de verite des artefacts.
- `resume-view.json` doit consommer `lastRelevantArtifact` depuis l'index reconstruit.
- `approval-queue.json` reste strictement inchange.

### Implementation Guardrails

- Ne pas ajouter de dependance npm externe; la baseline Node 20 + TypeScript actuelle suffit.
- Ne pas stocker de donnees vendor brutes dans `artifact-index.json`, dans les snapshots coeur ou dans les sorties CLI.
- Ne pas inventer un nouveau domaine `Decision`; en 2.5, la provenance d'une decision passe par les evenements source et, si present, par un identifiant d'approbation ou de decision present dans cet evenement.
- Ne pas faire d'artefact une copie exhaustive du fichier si un chemin, une empreinte et un resume suffisent.
- Ne pas muter `Mission` ou `Ticket` avec des champs de confort UI (`artifactCount`, `lastArtifactTitle`, etc.) si ces donnees peuvent vivre dans le read-side.
- Ne pas faire dependre la navigation artefact de la retention vendor d'une response background. L'operateur doit pouvoir consulter les sorties depuis l'etat local `corp`.
- Ne pas rescanner ou auto-indexer le workspace principal hors isolation.
- Ne pas toucher `dist/` manuellement et ne pas court-circuiter `npm test`.

### Recommended File Touch Points

Les noms peuvent varier legerement, mais les responsabilites suivantes doivent exister de maniere explicite:

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `apps/corp-cli/src/formatters/ticket-board-formatter.ts`
- `apps/corp-cli/src/formatters/artifact-list-formatter.ts`
- `apps/corp-cli/src/formatters/artifact-detail-formatter.ts`
- `packages/contracts/src/artifact/artifact.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/journal/src/projections/default-projections.ts`
- `packages/journal/src/projections/artifact-index-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-artifact-repository.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts`
- `packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts.ts`
- `packages/workspace-isolation/src/workspace-artifact-detector.ts`
- `tests/contract/mission-artifact-cli.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/artifact-index.test.ts`

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`, `rm`, `readFile`, `writeFile`, sans Jest/Vitest ni mock externe.
- Verifier que `corp mission help` mentionne `mission artifact list` et `mission artifact show` en francais, sans fuite vendor.
- Verifier qu'un `ticket run` foreground nominal qui produit:
  - une sortie structuree adapteur,
  - au moins un fichier modifie dans l'isolation,
  cree plusieurs artefacts distincts, chacun relies a `missionId`, `ticketId`, `producingEventId`, `attemptId` et `workspaceIsolationId` quand disponibles.
- Verifier que `Mission.artifactIds` et `Ticket.artifactIds` sont mis a jour de facon coherente, et que `artifact-index.json` expose les memes artefacts.
- Verifier que `mission artifact list --ticket-id <ticket_id>` filtre correctement et ne remonte pas les artefacts des autres tickets.
- Verifier que `mission artifact show` expose la provenance source sans transcript et echoue proprement si l'artefact n'appartient pas a la mission.
- Verifier que `mission resume` affiche enfin un `Dernier artefact pertinent` utile apres une tentative qui produit des sorties.
- Verifier que la corruption ou la suppression de `artifact-index.json` declenche une reconstruction valide pour `artifact list`, `artifact show` et `mission resume`.
- Verifier qu'un lancement `--background` non terminal ne genere pas d'artefact fantome ni de fuite d'index.
- Verifier qu'aucune donnee de `adapterState` vendor n'apparait dans `artifact-index.json`, `mission artifact list`, `mission artifact show`, `mission status` ni `mission resume`.
- Conserver `npm test` vert sur l'ensemble de la suite existante, actuellement a 73 tests verts.

### Scope Exclusions

- Hors scope: browser de journal/audit generaliste, chronologie complete des evenements et lecture "qui a fait quoi" a l'echelle mission (Story 3.4).
- Hors scope: queue d'approbation fonctionnelle, arbitrage humain et mutations `approval.*` (Epic 3).
- Hors scope: polling background permanent ou reprise automatique d'une response stockee pour en extraire des artefacts plus tard.
- Hors scope: merge/reconciliation automatique du workspace isole vers le workspace principal.
- Hors scope: registry de capabilities, skill packs et extensions gouvernees (Epic 4).
- Hors scope: stockage distant, upload cloud ou politique de retention avancee des artefacts.

### Latest Technical Information

- Verification officielle OpenAI faite le 2026-04-09: la reference `Responses` documente `POST /v1/responses`, le parametre `background`, des `input` structures et un champ `metadata` map pour attacher des correlations bornees. 2.5 peut continuer a exploiter ces metadonnees de correlation, mais doit normaliser les artefacts cote `corp` au lieu de dependre de la forme brute de `response.output`. [Source: `https://platform.openai.com/docs/api-reference/responses`]
- Verification officielle OpenAI faite le 2026-04-09: le guide `Background mode` precise que les responses background stockent les donnees environ 10 minutes pour permettre le polling et qu'il faut continuer a sonder tant que le statut est `queued` ou `in_progress`. 2.5 ne doit donc pas rendre la navigation artefact dependante de cette retention vendor transitoire. [Source: `https://developers.openai.com/api/docs/guides/background`]
- Verification officielle OpenAI faite le 2026-04-09: la page `Models` recommande `gpt-5.4` comme point de depart general pour les usages complexes/coding et rappelle que les derniers modeles sont exposes via la `Responses API` et les SDKs. Cela renforce l'exigence de garder le contrat artefact independant d'un alias modele fige. [Source: `https://developers.openai.com/api/docs/models`]
- Verification officielle OpenAI faite le 2026-04-09: la page `GPT-5-Codex` confirme que ce modele est disponible dans la `Responses API` uniquement et que son snapshot sous-jacent est regulierement mis a jour. 2.5 ne doit donc pas encoder un nom de modele ou une shape vendor dans les artefacts coeur. [Source: `https://developers.openai.com/api/docs/models/gpt-5-codex`]

### Hypotheses Explicites

- La surface CLI minimale suffisante pour 2.5 est `artifact list` + `artifact show`; un navigateur de journal complet reste hors scope.
- Les artefacts immediatement disponibles en 2.5 viendront principalement des completions foreground et des mutations de fichiers detectees dans l'isolation. Les runs background non termines peuvent legitimement ne produire aucun artefact local immediat.
- La provenance d'une decision dans 2.5 passe par les evenements source et, si present, par un `approvalId` ou identifiant proche; aucun agregat `Decision` autonome n'est requis.
- Le stockage d'artefacts sous le dossier de chaque ticket est le compromis V1 le plus simple pour garder la provenance ticket-locale reconstructible.
- `artifact-index.json` est une projection de lecture; la source de verite reste le triplet snapshots d'artefacts + snapshots mission/ticket + journal.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2; Story 2.3; Story 2.4; Story 2.5; Epic 3
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Execution & Artifact Flow; Reprise Et Auditabilite; FR12; FR13; FR14; Resultats Mesurables
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 4.5 Enforcement Guidelines; 5.2 Architectural Boundaries
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 2. Centre de gravite recommande; 3.3 Proposition de forme canonique; 5.2 Ce que les docs officielles confirment; 5.6 Decision de recherche recommandee
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-4-suivre-l-avancement-et-les-blocages-d-un-ticket-depuis-la-mission.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/ticket-board-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-mission-repository.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-ticket-repository.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/workspace-isolation/src/workspace-isolation.ts`
- `C:/Dev/PRJET/corp/tests/integration/run-ticket.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/mission-resume.test.ts`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/tsconfig.json`
- `https://platform.openai.com/docs/api-reference/responses`
- `https://developers.openai.com/api/docs/guides/background`
- `https://developers.openai.com/api/docs/models`
- `https://developers.openai.com/api/docs/models/gpt-5-codex`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Introduire le contrat `Artifact`, son stockage ticket-local et le read-side `artifact-index` reconstructible.
- Brancher la detection de sorties adapteur + workspace isole au flux `run-ticket`, avec evenements `artifact.detected` / `artifact.registered` et mise a jour coherente de `mission.artifactIds` / `ticket.artifactIds`.
- Exposer une navigation mission-centrique `artifact list` / `artifact show` et integrer le dernier artefact pertinent aux surfaces `status` / `resume`.
- Verrouiller le tout par des tests d'integration et de non-regression sur la provenance, la reconstruction et l'absence de fuite vendor.

### Debug Log References

- 2026-04-09: lecture complete de `sprint-status.yaml`, puis selection de `2-5-enregistrer-les-artefacts-decisions-et-evenements-produits-par-un-ticket` comme premiere story `backlog` en ordre de lecture.
- 2026-04-09: analyse croisee de l'Epic 2, du PRD, de l'architecture, de la recherche technique, des stories 2.3 et 2.4 et du code reel (`run-ticket`, `read-ticket-board`, `readMissionResume`, formatters CLI, default projections) pour ancrer la story sur les seams deja en place.
- 2026-04-09: verification locale de l'etat courant via `npm test` dans `C:/Dev/PRJET/corp`, avec 73 tests verts avant creation de cette story.
- 2026-04-09: verification officielle complementaire des docs OpenAI sur `Responses`, `Background mode`, `Models` et `GPT-5-Codex` pour borner les exigences de retention locale, de neutralite vendor et de normalisation des sorties.
- 2026-04-10: implementation du contrat `Artifact`, du repository fichier, de la projection `artifact-index` reconstructible et du read-side `read-mission-artifacts` pour servir `resume`, `artifact list` et `artifact show`.
- 2026-04-10: raccordement du flux `run-ticket` aux sorties adapteur normalisees, a la detection workspace (`workspace_copy` / `git_worktree`) et au service `register-artifacts` avec evenements `artifact.detected` / `artifact.registered`.
- 2026-04-10: ajout des tests `mission-artifact-cli.test.ts` et `artifact-index.test.ts`, puis execution complete de `npm test` avec 79 tests verts.

### Completion Notes List

- Contrat `Artifact` V1 ajoute avec stockage ticket-local, sidecars payload bornes et projection `artifact-index.json` reconstruite automatiquement si manquante, stale ou corrompue.
- `run-ticket` enregistre maintenant les sorties foreground significatives sous forme d'artefacts distincts relies a `missionId`, `ticketId`, `producingEventId`, `attemptId` et `workspaceIsolationId`, sans changer la machine a etats mission/ticket.
- Les sorties adapteur sont normalisees en texte / JSON borne / reference diagnostique, les mutations de workspace isole sont detectees localement, et aucune donnee vendor brute ne fuit vers `artifact-index`, `mission artifact list`, `mission artifact show`, `mission status` ou `mission resume`.
- La CLI mission expose `artifact list` et `artifact show` avec messages stables en francais, provenance scannable, preview borne quand un payload texte/JSON existe, et reprise compacte via `Dernier artefact pertinent`.
- `npm test` passe integralement apres implementation avec 79 tests verts.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/artifact-detail-formatter.ts`
- `apps/corp-cli/src/formatters/artifact-list-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `packages/contracts/src/artifact/artifact.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/journal/src/projections/artifact-index-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-artifact-repository.ts`
- `packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts.ts`
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/workspace-isolation/src/workspace-artifact-detector.ts`
- `tests/contract/mission-artifact-cli.test.ts`
- `tests/integration/artifact-index.test.ts`

## Change Log

- 2026-04-09: contexte complet de la Story 2.5 cree et statut passe a `ready-for-dev`.
- 2026-04-10: story implementee, tests artefacts ajoutes, `npm test` vert et story prete pour review.
