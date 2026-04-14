# Story 3.1: Ouvrir une file d'approbation pour les actions sensibles

Status: review

## Story

As a operateur technique,
I want que les actions sensibles s'arretent avant execution pour demander validation,
so that le V1 reste sous supervision humaine explicite.

## Context

L'Epic 3 demarre sur une base qui possede deja plusieurs prealables utiles:

- `Mission`, `Ticket` et `ExecutionAttempt` acceptent deja le statut `awaiting_approval`.
- `DEFAULT_PROJECTIONS` seed deja `approval-queue.json`, mais cette projection n'est aujourd'hui qu'un placeholder vide.
- `MissionResume` sait deja exposer `pendingApprovals`, et le resume privilegie deja une validation en attente si cette liste est peuplee.
- `runTicket` sait deja recevoir un resultat adapteur avec `status: "awaiting_approval"`, mais il ne cree ni `approval.requested`, ni `approvalId`, ni contexte d'arbitrage durable.

Le gap reel est donc precis: la boucle d'execution peut s'arreter en `awaiting_approval`, mais `corp` ne materialise pas encore la demande d'approbation comme objet produit auditable, reconstructible et consultable par l'operateur.

Cette story doit introduire la plus petite primitive d'approbation exploitable du V1:

1. une demande d'approbation normalisee et liee a `missionId`, `ticketId`, `attemptId`;
2. un evenement `approval.requested` append-only avant toute reecriture de projection;
3. une projection `approval-queue` calculee depuis le journal;
4. une vue CLI mission-centrique pour lire la file.

Cette story ne doit pas deriver vers 3.2:

- pas de `approve|reject|defer` dans cette fenetre;
- pas d'editeur de policies/budgets;
- pas de source de verite mutable hors journal pour les approvals.

### Delta explicite par rapport au code actuel

- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` journalise `workspace.isolation_created`, `ticket.claimed`, `execution.requested`, `ticket.in_progress`, puis des evenements `execution.*`, mais aucun `approval.*`.
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` relit actuellement `approval-queue.json` tel quel au lieu de le reconstruire.
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` depend d'une projection `approval-queue` deja correcte et echoue si elle est absente/corrompue.
- `apps/corp-cli/src/commands/mission-command.ts` n'expose aucune commande `mission approval ...`.

### Pourquoi maintenant

- L'Epic 2 a deja stabilise l'append du journal, la reecriture des read models, la reprise, l'index d'artefacts et les tests de regression autour de `runTicket`.
- L'architecture exige une vraie `approval queue` et des evenements `approval.*` pour rendre la supervision humaine credible.
- Le resume operateur sait deja prioriser `pendingApprovals`; une fois la queue reelle, l'experience s'ameliore sans refonte UX majeure.

## Acceptance Criteria

1. Given une policy de mission ou de ticket marque une action comme sensible
   When l'execution atteint cette action et que l'adaptateur signale un arret manuel
   Then la tentative est mise en pause avant execution effective
   And un evenement `approval.requested` est journalise avant toute reecriture de projection
   And une demande d'approbation avec `approvalId` stable est liee a la mission, au ticket et a la tentative concernes

2. Given une demande d'approbation est creee
   When l'operateur consulte la mission via CLI
   Then `mission status` et `mission resume` signalent qu'une validation est en attente
   And une vue de file detaillee expose l'action demandee, les garde-fous applicables et les references d'evenements/artefacts utiles a l'arbitrage

3. Given une demande d'approbation est presente dans une mission
   When les read models sont reecrits ou reconstruits
   Then `approval-queue.json` est derive du journal et n'est pas traite comme source de verite
   And le ticket reste en statut `awaiting_approval`
   And la tentative reste en statut `awaiting_approval`

4. Given une execution non sensible complete, echoue, ou reste seulement `requested|running`
   When les projections sont rafraichies
   Then la file d'approbation n'ajoute aucun faux positif
   And `mission resume` ne montre pas de validation en attente

5. Given `approval-queue.json` est absent, stale ou corrompu
   When l'operateur lit la mission ou la file d'approbation
   Then la projection peut etre reconstruite depuis le journal
   And le contenu reste coherent avec `resume-view`

## Tasks / Subtasks

- [x] Definir le contrat d'approbation et la projection de file (AC: 1, 2, 3, 5)
  - [x] Ajouter un contrat explicite du type `ApprovalRequest` / `ApprovalQueueEntry` dans `packages/contracts/src/approval/approval-request.ts` avec au minimum: `approvalId`, `missionId`, `ticketId`, `attemptId`, `status`, `title`, `actionType`, `actionSummary`, `guardrails`, `relatedEventIds`, `relatedArtifactIds`, `createdAt`, `updatedAt`
  - [x] Ajouter `packages/journal/src/projections/approval-queue-projection.ts` pour reconstruire la file a partir des evenements `approval.*`
  - [x] Garder le schema pret pour 3.2 (`approved`, `rejected`, `deferred`, `cancelled`, `expired`) meme si 3.1 n'emet que `requested`
  - [x] Ne pas changer les noms de champs deja attendus par `MissionResumeApproval` (`approvalId`, `title`, `status`, `missionId`) sauf si une retro-compatibilite explicite est preservee

- [x] Materialiser une demande d'approbation dans `runTicket` sans fuite vendor (AC: 1, 3, 4)
  - [x] Etendre `ExecutionAdapterLaunchResult` dans `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts` avec un champ optionnel `approvalRequest` normalise, requis quand `status === "awaiting_approval"`
  - [x] Enrichir le contexte d'execution passe a l'adaptateur avec `mission.policyProfileId`, `ticket.allowedCapabilities` et `ticket.skillPackRefs` afin qu'un adaptateur puisse decider ou decrire la sensibilite sans nouveau champ coeur
  - [x] Dans `packages/ticket-runtime/src/ticket-service/run-ticket.ts`, separer le branchement actif:
  - [x] `requested|running` conservent `execution.background_started`
  - [x] `awaiting_approval` append `approval.requested`, cree `approvalId`, passe `Mission.status`, `Ticket.status` et `ExecutionAttempt.status` a `awaiting_approval`, puis persiste avant la reecriture des projections
  - [x] Ne pas reutiliser `execution.background_started` comme source d'audit pour le cas approval; le journal doit faire apparaitre explicitement l'ouverture de la demande
  - [x] Conserver tous les identifiants et statuts vendor dans `executionHandle.adapterState` / `ExecutionAttempt.adapterState`; la charge utile `approvalRequest` doit rester strictement produit

- [x] Recalculer `approval-queue` et la reprise mission a partir du journal (AC: 2, 3, 5)
  - [x] Modifier `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` pour reconstruire `approval-queue` avec le nouveau builder au lieu de relire une projection stale
  - [x] Ajouter une lecture resiliente de la queue (`readApprovalQueue` ou equivalent) qui reconstruit depuis le journal quand la projection est absente, stale ou corrompue
  - [x] Rebrancher `packages/mission-kernel/src/resume-service/read-mission-resume.ts` sur cette lecture resiliente afin que `mission resume` ne depende pas d'une queue preexistante
  - [x] Preserver la logique actuelle de resume compact: la queue detaillee vit dans sa commande dediee, pas dans un dump multiline de `mission resume`

- [x] Exposer la file dans la CLI sans implementer sa resolution (AC: 2)
  - [x] Ajouter `corp mission approval queue --mission-id <id>` dans `apps/corp-cli/src/commands/mission-command.ts`
  - [x] Ajouter `apps/corp-cli/src/formatters/approval-queue-formatter.ts` avec un rendu texte sobre et deterministe affichant: `approvalId`, ticket, attempt, action demandee, garde-fous, references d'evenements et references d'artefacts
  - [x] Mettre a jour `apps/corp-cli/src/formatters/help-formatter.ts`
  - [x] Si la queue est vide, afficher explicitement `Aucune validation en attente.`

- [x] Couvrir le flux par des tests deterministes et sans reseau (AC: 1, 2, 3, 4, 5)
  - [x] Ajouter `tests/unit/approval-queue-projection.test.ts` pour le replay du journal, le tri (`createdAt|approvalId`) et le filtrage des statuts terminaux
  - [x] Etendre `tests/unit/formatters.test.ts` avec le formatter de queue et le cas ou `mission resume` privilegie une validation en attente
  - [x] Ajouter un test d'integration dedie (`tests/integration/approval-queue.test.ts`) ou un bloc cible dans `tests/integration/run-ticket.test.ts` couvrant un adaptateur qui retourne `awaiting_approval` avec `approvalRequest`
  - [x] Verifier que le journal contient `approval.requested`, que `Mission.status`, `Ticket.status` et `ExecutionAttempt.status` valent `awaiting_approval`, et que `approval-queue.json` contient la demande
  - [x] Ajouter des tests de reconstruction quand `approval-queue.json` est absent/corrompu
  - [x] Ajouter `tests/contract/mission-approval-queue-cli.test.ts` pour la surface CLI et l'aide
  - [x] Preserver les regressions existantes qui prouvent qu'un run normal ne mute pas la queue

## Dev Notes

### Story Intent

Cette story ouvre la file d'approbation, mais ne la resout pas encore. Le but est de rendre visible, durable et auditable le moment ou `corp` doit s'arreter avant une action sensible. La story est reussie si l'operateur peut identifier une demande d'approbation reelle avec assez de contexte pour arbitrer plus tard, meme apres redemarrage ou corruption d'une projection.

### Current Project State

- `approval-queue.json` est deja cree au bootstrap mais n'est jamais reconstruit a partir du journal.
- `runTicket` sait deja manipuler `awaiting_approval`, ce qui reduit le besoin de refondre le flux complet d'execution.
- `MissionResume` et ses formatters savent deja afficher une synthese `Validations en attente: ...`.
- Aucun module `approval-queue-projection.ts`, aucune commande CLI `mission approval queue`, aucun contrat `ApprovalRequest` n'existent aujourd'hui.
- `artifact-index-projection.ts` sait deja extraire `approvalId` et `decisionRef` depuis la charge utile d'un evenement source. Reutiliser ce levier plutot que dupliquer des champs arbitrairement dans le schema d'artefact.
- Le projet tourne sur Node `>=20.0.0`, TypeScript `^5.9.3`, `node:test`, `assert/strict`, sans dependance externe de test.

### Baseline Intelligence From Epic 2

- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` est deja la frontiere canonique pour `workspace.isolation_created`, `ticket.claimed`, `execution.requested`, `ticket.in_progress`, `execution.*` et l'enregistrement des artefacts. Inserer l'ouverture d'approbation ici plutot que depuis la CLI.
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` est deja l'endroit canonique pour reecrire `mission-status`, `ticket-board`, `artifact-index` et `resume-view`. Etendre ce pattern a `approval-queue`, ne pas introduire un circuit parallele.
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` reconstruit deja `resume-view` quand la projection est stale. Le meme niveau de resilence est attendu pour la queue.
- Les tests d'integration autour de `runTicket` utilisent deja `setRunTicketDependenciesForTesting`. Reutiliser cette DI pour simuler le chemin `awaiting_approval`.
- Les tests existants prouvent explicitement qu'un run normal laisse `approval-queue.json` intact. Ces gardes doivent rester vrais hors chemin sensible.

### Recommended Normalized Approval Payload

Utiliser une charge utile produit explicite et stable. Exemple recommande:

```json
{
  "approval": {
    "approvalId": "approval_...",
    "missionId": "mission_...",
    "ticketId": "ticket_...",
    "attemptId": "attempt_...",
    "status": "requested",
    "title": "Validation requise pour une action sensible",
    "actionType": "workspace_write",
    "actionSummary": "Modification de fichiers dans le workspace isole",
    "guardrails": [
      "policy_profile: policy_profile_local",
      "allowed_capabilities: fs.read, cli.run"
    ],
    "relatedEventIds": ["event_..."],
    "relatedArtifactIds": ["artifact_..."],
    "createdAt": "2026-04-10T19:14:15.7947651+02:00",
    "updatedAt": "2026-04-10T19:14:15.7947651+02:00"
  }
}
```

Ce shape est une recommendation de story, pas un contrat public fige. Les invariants a preserver sont:

- `approvalId` stable et opaque
- references mission/ticket/attempt explicites
- contexte d'arbitrage produit-normalise
- aucune fuite de `responseId`, `threadId`, `vendorStatus`, etc.

### Architecture Compliance

- Toute transition de statut doit produire un evenement avant toute projection. [Source: architecture.md - 4.1 Domain Consistency Rules]
- Le journal append-only reste la source de verite; les projections sont reconstruisibles. [Source: architecture.md - 3.9 Journal and Projection Model]
- Aucune action sensible ne doit s'executer sans `ApprovalRequest` resolue si la policy le demande. [Source: architecture.md - 4.1 Domain Consistency Rules]
- Les details OpenAI/Codex ne doivent pas sortir de `execution_handle.adapter_state` ou de `ExecutionAttempt`. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- `resource_budget` ne doit pas devenir un champ natif de `Mission` ou `Ticket`. [Source: architecture.md - 3.9 Journal and Projection Model]
- La surface operateur V1 reste une CLI et doit rester lisible, mission-centrique et sans exposition de secrets vendor. [Source: architecture.md - 3.10 Five-Layer Target Architecture]

### Implementation Guardrails

- 3.1 ouvre la file seulement. Ne pas implementer `approve`, `reject`, `defer` ici.
- Ne pas introduire de repository mutable d'approbations comme source de verite en 3.1. La file doit etre reconstruite depuis le journal.
- Ne pas ajouter `approvalPolicy`, `sandboxProfile`, `resourceBudget` ou une structure vendor-specifique au schema coeur `Mission` / `Ticket` pour "faire passer" la story.
- Ne pas dependre des prompts interactifs ou des approvals natives de Codex pour satisfaire le besoin produit. `corp` doit posseder son propre evenement `approval.requested` et sa propre queue durable.
- Ne pas casser le rendu compact de `mission resume`; reserver le detail a `mission approval queue`.
- Ne pas modifier `dist/` manuellement.
- Ne pas ajouter de dependance npm externe.
- Garder tous les nouveaux fichiers en ASCII et les noms de modules en `kebab-case`.
- Si un run background ouvre une approbation, persister l'etat local immediatement. Ne jamais compter sur la retention vendor pour retrouver une validation en attente.

### File Structure Requirements

**Modules coeur/projection**
- `packages/contracts/src/approval/approval-request.ts` (nouveau)
- `packages/journal/src/projections/approval-queue-projection.ts` (nouveau)
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`

**CLI**
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/approval-queue-formatter.ts` (nouveau)
- `apps/corp-cli/src/formatters/help-formatter.ts`

**Tests**
- `tests/unit/approval-queue-projection.test.ts` (nouveau)
- `tests/unit/formatters.test.ts`
- `tests/integration/approval-queue.test.ts` (nouveau) ou extension ciblee de `tests/integration/run-ticket.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/contract/mission-approval-queue-cli.test.ts` (nouveau)

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Simuler le chemin sensible via `setRunTicketDependenciesForTesting`; ne pas faire d'appel reseau reel.
- Verifier explicitement l'ordre des evenements dans le journal quand une approbation s'ouvre.
- Verifier que `approval-queue.json` est reconstruit depuis le journal quand il manque ou est corrompu.
- Verifier qu'un run non sensible continue de laisser la queue intacte.
- Verifier que la commande CLI detaillee n'expose ni `responseId`, ni `vendorStatus`, ni autre detail vendor brut.

### Scope Exclusions

- Resolution d'une demande d'approbation (`approve|reject|defer`)
- Modification des policies, budgets ou garde-fous persistants
- Journal d'audit complet de decision (3.4)
- Reprise ciblee post-approbation ou polling background complet
- Refactor large de la structure des adaptateurs ou migration du contrat adapteur hors de son emplacement actuel, sauf necessite demonstrable

### Assumptions

- Le chemin minimal le plus sain pour 3.1 consiste a faire remonter une demande d'approbation via l'adaptateur, puis a la normaliser dans `runTicket`; un moteur de policy complet reste hors scope a ce stade.
- `Mission.status` doit passer a `awaiting_approval` quand une validation est ouverte, meme si d'autres tickets actifs existent encore; 3.2 arbitrera la logique de retour vers `running|ready`.
- La queue d'approbation reste mission-globale et journal-driven; aucun stockage par ticket d'une source de verite mutable n'est necessaire pour livrer 3.1.

### Latest Technical Notes

- Verification documentaire officielle OpenAI le 2026-04-10: la doc `Responses API` indique que `background=true` conserve les donnees de reponse environ 10 minutes pour le polling. Inference produit: une validation en attente ne doit jamais dependre uniquement d'un etat vendor distant; `corp` doit la persister dans son propre journal local. [Source: OpenAI data controls guide]
- Verification documentaire officielle OpenAI le 2026-04-10: la doc Codex distingue des modes runtime comme `on-request`, `untrusted`, `never`, `workspace-write`, `read-only`. Inference produit: ces controles de sandbox/approbation runtime ne remplacent pas la queue d'approbation metier de `corp`; ils restent des garde-fous d'execution, pas la source d'audit produit. [Source: OpenAI Codex approvals & security]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3, Story 3.1, Story 3.2
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - FR15, FR16, FR17, NFR4, NFR6
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - sections sur mission/ticket contract, approbations, adaptateurs Codex, retention background
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-11-corriger-bugs-tests-et-ecarts-epic-2.md` - patterns de DI, run flow, tests de regression
- `C:/Dev/PRJET/corp/guide-utilisation.md` - structure `.corp/`, commandes actuelles, projection `approval-queue.json`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/artifact-index-projection.ts`
- `https://developers.openai.com/codex/agent-approvals-security`
- `https://developers.openai.com/api/docs/guides/your-data`

## Change Log

- 2026-04-10: story creee via `bmad-create-story`, contexte complet ajoute, statut passe a `ready-for-dev`
- 2026-04-10: implementation 3.1 terminee, file d'approbation journal-driven ajoutee, story passee a `review`

## Dev Agent Record

### Agent Model Used

- Codex GPT-5

### Debug Log References

- `npm run build`
- `node --test "dist/tests/unit/approval-queue-projection.test.js" "dist/tests/unit/formatters.test.js" "dist/tests/unit/codex-responses-adapter.test.js" "dist/tests/contract/mission-approval-queue-cli.test.js" "dist/tests/integration/approval-queue.test.js" "dist/tests/integration/mission-resume.test.js"`
- `npm test`

### Completion Notes List

- Contrat `ApprovalRequest` ajoute avec compatibilite `MissionResumeApproval` et statuts prets pour 3.2 sans exposer de details vendor.
- `runTicket` materialise maintenant `approval.requested`, persiste un `approvalId` stable, laisse ticket/attempt/mission en `awaiting_approval` et n'ouvre pas `execution.background_started` sur ce chemin.
- `approval-queue.json` est maintenant reconstruite depuis le journal dans les read models et via une lecture resiliente partagee avec `mission resume` et `mission status`.
- Commande CLI `corp mission approval queue` ajoutee avec formatter dedie, aide mise a jour et rendu explicite quand la file est vide.
- Couverture ajoutee pour projection, formatter, contrat CLI, integration approval queue, priorisation du resume et regression complete verte via `npm test`.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/approval-queue-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-1-ouvrir-une-file-d-approbation-pour-les-actions-sensibles.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/sprint-status.yaml`
- `packages/contracts/src/approval/approval-request.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/journal/src/projections/approval-queue-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `tests/contract/mission-approval-queue-cli.test.ts`
- `tests/integration/approval-queue.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/unit/approval-queue-projection.test.ts`
- `tests/unit/codex-responses-adapter.test.ts`
- `tests/unit/formatters.test.ts`
