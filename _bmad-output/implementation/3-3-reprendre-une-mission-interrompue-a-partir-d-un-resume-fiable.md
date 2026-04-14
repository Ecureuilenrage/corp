# Story 3.3: Reprendre une mission interrompue a partir d'un resume fiable

Status: review

## Story

As a operateur technique,
I want reprendre une mission apres interruption sans reconstituer le contexte a la main,
so that la valeur centrale de continuite operatoire soit tangible des le V1.

## Context

La base de reprise existe deja, mais elle reste encore trop generique pour satisfaire pleinement la promesse de l'Epic 3:

- la Story 1.3 a deja introduit `corp mission status` et `corp mission resume`, la reconstruction de `resume-view.json` depuis le journal append-only, et une sortie mission-centrique compacte;
- la Story 3.1 a deja rendu la `approval-queue` durable et reconstructible, puis la Story 3.2 a ajoute la resolution `approve|reject|defer` et la resynchronisation de `resume-view`;
- `buildTicketBoardProjection(...)` expose deja `trackingState`, `blockingReasonCode`, `activeAttempt*` et `lastAttempt*`, donc une grande partie du signal de reprise existe deja dans le systeme;
- `readMissionResume(...)` sait deja rehydrater `ticket-board`, `approval-queue`, `artifact-index` et `resume-view` quand une projection est absente, stale ou corrompue.

Le gap reel est maintenant plus precis:

1. `mission resume` restitue deja l'objectif, les tickets ouverts, les validations en attente, le dernier artefact et le prochain arbitrage utile, mais il ne materialise pas encore le `dernier blocage connu` comme objet produit explicite et durable;
2. apres une pause, un echec, un rejet/differe d'approbation, ou une simple sortie operateur pendant une tentative active, l'operateur doit encore inferer une partie de la situation en lisant le ticket board ou le journal;
3. le contrat `MissionResume` ne porte pas encore de resume structure de l'interruption elle-meme, ce qui affaiblit la promesse de continuite "KAIROS" decrite dans l'architecture;
4. il n'existe aucun depot Git sous `C:/Dev/PRJET/corp`, donc aucun pattern de commit local ne peut guider l'implementation. La story doit s'appuyer sur les artefacts BMAD et le code courant.

### Delta explicite par rapport au code actuel

- `packages/contracts/src/mission/mission-resume.ts` ne porte aujourd'hui ni `lastKnownBlockage`, ni ancrage structure de reprise;
- `packages/journal/src/projections/resume-view-projection.ts` sait calculer `nextOperatorAction`, mais pas une synthese explicite du dernier blocage/interruption connu;
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` reconstruit bien `resume-view`, mais ne derive pas un bloc de continuite plus riche a partir du journal + `ticket-board` + `approval-queue` + `artifact-index`;
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts` n'affiche pas encore de ligne dediee au dernier blocage connu;
- les tests couvrent deja pause, running, approvals et reconstruction de `resume-view`, mais pas encore un contrat explicite de "dernier blocage connu" reconstruit proprement et sans fuite vendor.

### Decision de conception pour cette story

- Garder `corp mission resume` comme point d'entree principal de la reprise. Ne pas ajouter de nouvelle commande interactive ou de wizard.
- Etendre `MissionResume` avec un bloc structure de continuite, au minimum `lastKnownBlockage`, au lieu d'introduire une nouvelle projection parallele.
- Considerer `lastKnownBlockage` comme une information read-side reconstructible depuis le journal et les projections existantes, pas comme un nouvel etat mutable ecrit a part.
- Afficher explicitement `aucun` quand la mission est seulement interrompue par une sortie operateur alors qu'une tentative reste active; dans ce cas, `nextOperatorAction` continue de pointer vers le ticket en cours.
- Ne pas confondre cette story avec une reprise d'execution vendor. La reprise V1 reste une reprise operateur locale et auditable, pas une "resume API" implicite d'OpenAI/Codex.

## Acceptance Criteria

1. Given une mission a ete interrompue par un echec, une pause, une validation en attente, ou une simple sortie operateur pendant une tentative active
   When l'operateur lance `corp mission resume` ou `corp mission status`
   Then la sortie restitue l'objectif courant, les tickets ouverts, les validations en attente, le dernier artefact pertinent et un champ explicite `Dernier blocage connu`
   And ces informations proviennent uniquement d'un etat durable reconstructible depuis le journal et les projections locales

2. Given `resume-view.json` ou une projection amont (`ticket-board`, `approval-queue`, `artifact-index`) est absente, stale ou corrompue
   When la mission est reprise
   Then `readMissionResume(...)` reconstruit la vue a partir du journal append-only et des snapshots encore fiables
   And la projection `resume-view` reecrite contient bien le resume enrichi
   And la reprise n'exige ni recreation de mission ni relecture exhaustive du transcript

3. Given l'interruption la plus recente correspond a une validation en attente, un ticket bloque, un ticket en echec ou une pause mission
   When le resume est derive
   Then `lastKnownBlockage` expose au minimum un `kind`, un `summary`, un `missionStatus`, un `occurredAt`
   And il renseigne `ticketId`, `attemptId`, `approvalId`, `reasonCode` et `sourceEventId` seulement quand ces informations sont effectivement reconstructibles
   And aucun identifiant ou statut vendor brut (`responseId`, `pollCursor`, `vendorStatus`, `requires_action`, etc.) n'apparait dans le resume ou la CLI

4. Given la mission est seulement interrompue par une sortie operateur alors qu'une tentative background ou foreground reste `requested|running`
   When l'operateur reprend la mission
   Then `lastKnownBlockage` vaut explicitement `null` au niveau contrat et `aucun` au niveau CLI
   And `nextOperatorAction` reste centre sur le suivi du ticket actif
   And l'etat durable deja confirme avant interruption reste intact et inspectable

5. Given l'operateur reprend une mission en lecture
   When `corp mission resume` ou `corp mission status` est execute
   Then aucune nouvelle entree de journal n'est ajoutee
   And aucune mutation de statut mission/ticket/attempt n'est faite implicitement
   And la surface reste compacte pour `resume`, detaillee pour `status`, et strictement en francais

## Tasks / Subtasks

- [x] Etendre le contrat de reprise sans casser les lecteurs existants (AC: 1, 2, 3, 4)
  - [x] Ajouter dans `packages/contracts/src/mission/mission-resume.ts` un type explicite du style `MissionResumeBlockage` avec au minimum: `kind`, `summary`, `missionStatus`, `occurredAt`, `reasonCode?`, `ticketId?`, `attemptId?`, `approvalId?`, `sourceEventId?`
  - [x] Etendre `MissionResume` avec `lastKnownBlockage: MissionResumeBlockage | null`
  - [x] Garder `schemaVersion: 1` pour `resume-view` si la retro-compatibilite reste tenable; si une autre decision s'impose, documenter le pourquoi dans la story implementation et rendre la detection stale explicite
  - [x] Lire les anciens `resume-view.json` sans `lastKnownBlockage` comme des snapshots encore valides mais incomplets, puis les re-ecrire au prochain recalcul

- [x] Deriver le dernier blocage connu a partir du journal et des read models existants (AC: 1, 2, 3, 4)
  - [x] Factoriser une logique pure partageable depuis `packages/journal/src/projections/resume-view-projection.ts` (ou un helper voisin) pour calculer `lastKnownBlockage`
  - [x] Definir un ordre de priorite stable pour la derivation:
  - [x] approvals pending -> `approval_pending`
  - [x] ticket failed -> `ticket_failed`
  - [x] ticket blocked / dependency blocked -> `ticket_blocked`
  - [x] mission paused/failed sans blocage ticket plus precis -> `mission_lifecycle`
  - [x] aucune situation bloquante explicite -> `null`
  - [x] Reutiliser `ApprovalQueueEntry.relatedEventIds`, `TicketBoardEntry.blockingReasonCode`, `trackingState`, `lastAttempt*` et les derniers evenements mission pour peupler un resume fiable
  - [x] Si l'ancrage evenementiel exact n'est pas fiable, laisser `sourceEventId` a `null` plutot que d'inventer un mauvais event id

- [x] Rebrancher la construction et la reconstruction de `resume-view` sur ce contrat enrichi (AC: 1, 2, 3, 4, 5)
  - [x] Mettre a jour `buildResumeViewProjection(...)` dans `packages/journal/src/projections/resume-view-projection.ts` pour integrer `lastKnownBlockage`
  - [x] Mettre a jour `packages/mission-kernel/src/resume-service/read-mission-resume.ts` pour construire le meme resume enrichi lors d'une reconstruction read-side
  - [x] Preserver la regle actuelle: `resume-view` reste reconstruit si le snapshot mission, `ticket-board`, `approval-queue`, `artifact-index` ou `resume-view` lui-meme est douteux
  - [x] Ne jamais emettre d'evenement `mission.resume_requested` ou de mutation implicite `mission.relaunched` dans cette story

- [x] Exposer la continuite operateur dans la CLI sans degrader la lisibilite (AC: 1, 3, 4, 5)
  - [x] Ajouter dans `apps/corp-cli/src/formatters/mission-resume-formatter.ts` une ligne `Dernier blocage connu: ...`
  - [x] Rendre le resume compact et deterministe:
  - [x] approval -> afficher `approvalId`, `ticketId`, `attemptId` et un resume court de l'action si disponibles
  - [x] ticket failed/blocked -> afficher `ticketId`, eventuel `attemptId`, et une raison stabilisee issue de `reasonCode` / `blockingReasonCode`
  - [x] aucun blocage -> afficher explicitement `aucun`
  - [x] Laisser `apps/corp-cli/src/formatters/mission-status-formatter.ts` s'appuyer sur `formatMissionResume(...)` puis le board detaille, sans dupliquer la logique de blocage

- [x] Couvrir la story par des tests deterministes et sans reseau (AC: 1, 2, 3, 4, 5)
  - [x] Etendre `tests/unit/formatters.test.ts` pour le rendu du nouveau champ `Dernier blocage connu`
  - [x] Etendre `tests/integration/mission-resume.test.ts` avec au minimum:
  - [x] scenario mission pausee -> `lastKnownBlockage.kind = mission_lifecycle` et resume CLI explicite
  - [x] scenario approval pending -> `lastKnownBlockage.kind = approval_pending`, ids visibles cote produit, aucune fuite vendor
  - [x] scenario execution failed -> `lastKnownBlockage.kind = ticket_failed`, dernier artefact toujours visible si present
  - [x] scenario tentative active `requested|running` apres sortie operateur -> `lastKnownBlockage = null`, `nextOperatorAction` pointe vers le ticket actif
  - [x] scenario `resume-view` ancien/corrompu + projection amont stale -> reecriture correcte du resume enrichi
  - [x] Etendre `tests/integration/mission-lifecycle.test.ts`, `tests/integration/approval-queue.test.ts` et/ou `tests/integration/run-ticket.test.ts` seulement si cela reduit la duplication de fixtures
  - [x] Ajouter ou ajuster `tests/contract/mission-resume-cli.test.ts` pour garantir la surface francaise et l'absence de `responseId`, `pollCursor`, `vendorStatus`, `requires_action`

## Dev Notes

### Story Intent

Cette story ne doit pas "reprendre" une execution vendor. Elle doit rendre la reprise operateur tangible et fiable en un seul scan:

- que reste-t-il d'ouvert;
- quelle validation attend encore;
- quel est le dernier artefact utile;
- quel est le dernier blocage connu;
- quelle est la prochaine action utile.

Si l'implementation force l'operateur a lire le transcript brut, a croiser manuellement `ticket-board` et `approval-queue`, ou a deduire le dernier blocage a partir du journal brut, elle rate la cible.

### Current Project State

- `readMissionResume(...)` reconstruit deja `resume-view` si la projection est absente, invalide, stale, ou desynchronisee des autres read models.
- `readApprovalQueue(...)` et `readMissionArtifacts(...)` resynchronisent deja leurs projections depuis le journal quand elles sont douteuses.
- `buildTicketBoardProjection(...)` expose deja `trackingState`, `blockingReasonCode`, `activeAttemptId`, `activeAttemptStatus`, `lastAttemptId`, `lastAttemptStatus`, `lastAttemptStartedAt`, `lastAttemptEndedAt`.
- `updateMissionLifecycle(...)` journalise deja `mission.paused`, `mission.relaunched`, `mission.completed`, `mission.cancelled`, puis rehydrate `resume-view`.
- `run-ticket.ts` et `resolve-approval-request.ts` couvrent deja les cas `execution.failed`, `approval.requested`, `approval.approved`, `approval.rejected`, `approval.deferred`.
- Aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`. Ne pas supposer de conventions de commit ou de hooks locaux.
- La baseline technique reste `Node >=20`, `TypeScript ^5.9.3`, `node:test`, `assert/strict`, sans dependance externe de test.

### Recommended Blockage Shape

Utiliser un shape produit court, stable et sans details vendor. Exemple recommande:

```json
{
  "lastKnownBlockage": {
    "kind": "approval_pending",
    "summary": "Validation en attente pour une action sensible du ticket ticket_alpha",
    "missionStatus": "awaiting_approval",
    "ticketId": "ticket_alpha",
    "attemptId": "attempt_123",
    "approvalId": "approval_123",
    "reasonCode": "approval_requested",
    "sourceEventId": "event_approval_requested",
    "occurredAt": "2026-04-11T22:16:58.5005271+02:00"
  }
}
```

Invariants a preserver:

- `summary` doit etre court, stable, et lisible par un operateur sans journal brut;
- `kind` et `reasonCode` doivent rester produits, pas vendor;
- `lastKnownBlockage` vaut `null` si aucun blocage explicite n'est etabli;
- `sourceEventId` est optionnel et ne doit jamais etre renseigne au hasard;
- aucun champ `responseId`, `threadId`, `pollCursor`, `vendorStatus` ou equivalent ne doit sortir du schema produit.

### Architecture Compliance

- La reprise operateur lit d'abord `resume view`; si la projection est absente ou douteuse, elle est reconstruite depuis le journal. [Source: architecture.md - 4.4 Process Patterns]
- Le journal append-only reste la source de verite; les projections restent reconstruisibles. [Source: architecture.md - 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules]
- La reprise operateur doit pointer vers le prochain arbitrage utile, pas vers le transcript complet. [Source: architecture.md - 4.4 Process Patterns]
- La reprise doit rester prioritairement centree ticket et contexte operateur, pas "mission entiere a relancer". [Source: architecture.md - 3.5 Execution Strategy]
- Les details OpenAI/Codex doivent rester confines a `executionHandle.adapterState` et `ExecutionAttempt.adapterState`. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- Ne pas creer de projection supplementaire pour la continuite V1; `resume-view` reste la vue de reprise canonique. [Source: architecture.md - 3.9 Journal and Projection Model; 5.3 Requirements to Structure Mapping]

### Previous Story Intelligence

- Story 1.3 a deja pose la bonne frontiere: CLI = parsing/formatage, `mission-kernel` = lecture/reconstruction, `journal`/`storage` = verite et projections. 3.3 doit prolonger ce seam, pas l'eviter.
- Story 3.1 a deja etabli la priorite d'une validation en attente dans `nextOperatorAction`. 3.3 doit enrichir cette reprise, pas remplacer la logique d'arbitrage.
- Story 3.2 resynchronise deja `resume-view` apres resolution d'approbation. Le nouveau champ de continuite doit suivre la meme logique de reconstruction, y compris quand la queue est stale/corrompue.
- `buildTicketBoardProjection(...)` offre deja des signaux de blocage suffisants pour une V1 (`blockingReasonCode`, `trackingState`, tentatives actives/dernieres) sans nouveau write model.
- Les tests existants prouvent deja que `mission resume` reste read-only et que `resume-view` peut etre reconstruit. Conserver cette discipline.

### Implementation Guardrails

- Ne pas ajouter de nouvelle commande `mission continue`, `mission restart`, `mission recover` ou autre surface interactive.
- Ne pas emettre de nouvel evenement read-side (`mission.resume_requested`, `mission.status_viewed`, etc.).
- Ne pas auto-relancer une mission, un ticket, une approval ou un job vendor en executant `mission resume`.
- Ne pas introduire un fichier `interruption-view.json`, `continuity-view.json` ou autre projection parallele.
- Ne pas faire remonter les details OpenAI/Codex hors de `adapterState`.
- Ne pas modifier `dist/` manuellement.
- Ne pas ajouter de dependance npm externe.
- Garder les nouveaux fichiers en ASCII et les modules en `kebab-case`.
- Si le choix entre exactitude et exhaustivite se pose, preferer un `lastKnownBlockage` plus court mais vrai, plutot qu'un resume "riche" qui invente une causalite.
- Ne pas deborder sur la Story 3.4 (vue d'audit structuree complete) ni sur la Story 3.5 (relance ciblee de la branche impactee).

### File Structure Requirements

**Contrat / projection**
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/journal/src/projections/resume-view-projection.ts`

**Lecture / reconstruction**
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`

**CLI**
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `apps/corp-cli/src/formatters/mission-status-formatter.ts` (uniquement si necessaire pour l'ordre / separation des sections)

**Tests**
- `tests/unit/formatters.test.ts`
- `tests/contract/mission-resume-cli.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/mission-lifecycle.test.ts`
- `tests/integration/approval-queue.test.ts`
- `tests/integration/run-ticket.test.ts`

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Aucun appel reseau: reutiliser `setRunTicketDependenciesForTesting(...)` pour les chemins `running`, `awaiting_approval`, `failed`.
- Verifier qu'un `mission resume` n'ajoute aucune ligne au journal avant/apres lecture.
- Verifier qu'un snapshot `resume-view` ancien sans `lastKnownBlockage` reste lisible puis est reecrit au format enrichi.
- Verifier qu'une mission `blocked` par `mission.paused` expose un blocage lifecycle coherent.
- Verifier qu'une approval pending expose un blocage approval coherent, sans details vendor.
- Verifier qu'un ticket failed expose un blocage ticket coherent tout en preservant `lastRelevantArtifact` si un artefact a ete detecte.
- Verifier qu'une tentative active `requested|running` apres sortie operateur affiche `Dernier blocage connu: aucun` et garde `nextOperatorAction` centre sur le ticket en cours.
- Verifier que `mission status` reste detaille et `mission resume` reste compact.

### Scope Exclusions

- Vue d'audit chronologique complete de la mission (Story 3.4)
- Relance ciblee d'une branche impactee apres echec (Story 3.5)
- Resume automatique d'un job OpenAI/Codex ou polling background complet
- Nouveau moteur de lifecycle mission
- Toute mutation write-side supplementaire juste pour "tracer la lecture de reprise"

### Assumptions

- Le dernier blocage connu peut rester `null` quand l'interruption est seulement une sortie operateur avec tentative active encore suivable.
- Le journal et les projections actuelles contiennent deja assez de signal pour une V1 credible sans nouveaux evenements write-side.
- Une extension backward-compatible de `MissionResume` est preferable a un nouveau schema ou une nouvelle projection tant que la lecture reste fiable.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-11: le guide `Background mode` indique que les taches longues sont executees de maniere asynchrone, que les developpeurs doivent poller l'objet `response`, et que les donnees sont conservees environ 10 minutes pour ce polling. Inference produit: la reprise `corp` ne doit jamais dependre de cette retention vendor courte; l'ancrage de continuite doit rester local et journal-driven. [Source: OpenAI Background mode]
- Verification officielle OpenAI le 2026-04-11: la doc `Agent approvals & security` distingue explicitement les modes runtime `read-only`, `workspace-write`, `on-request`, `untrusted`, `never` et `danger-full-access`. Inference produit: ces controles runtime ne remplacent ni la queue d'approbation metier de `corp`, ni le resume de reprise produit; `lastKnownBlockage` doit rester purement produit. [Source: OpenAI Codex agent approvals & security]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3; Story 3.1; Story 3.2; Story 3.3; Story 3.4; Story 3.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Parcours 2; FR19; FR20; FR22; FR23; NFR1; NFR10
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data; 3.5 Execution Strategy; 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 4.4 Process Patterns; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - Proposition de forme canonique; sections reprise, mission/ticket, adaptateurs Codex
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-1-ouvrir-une-file-d-approbation-pour-les-actions-sensibles.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-2-approuver-refuser-ou-differer-une-demande-avec-garde-fous-auditablement.md`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `https://developers.openai.com/api/docs/guides/background`
- `https://developers.openai.com/codex/agent-approvals-security`

## Change Log

- 2026-04-11: story creee via `bmad-create-story`, contexte complet ajoute, statut passe a `ready-for-dev`
- 2026-04-11: implementation terminee, `lastKnownBlockage` ajoute au contrat/read-side/CLI, tests story et regression completes au vert

## Dev Agent Record

### Agent Model Used

- Codex (GPT-5, session CLI)

### Debug Log References

- `npm run build`
- `node --test "dist/tests/unit/formatters.test.js" "dist/tests/contract/mission-resume-cli.test.js" "dist/tests/integration/mission-resume.test.js"`
- `node --test "dist/tests/integration/mission-resume.test.js"`
- `npm test`

### Completion Notes List

- Contrat `MissionResume` enrichi avec `MissionResumeBlockage` et lecture backward-compatible des anciens `resume-view.json` sans `lastKnownBlockage`.
- Derivation read-side centralisee dans `resume-view-projection.ts` avec priorite stable: approval pending, ticket failed, ticket blocked, lifecycle mission, sinon `null`.
- CLI `mission resume` et `mission status` affichent explicitement `Dernier blocage connu` sans fuite vendor et conservent `resume` compact / `status` detaille.
- Tests etendus pour le rendu CLI, la lecture read-only, la reconstruction sur projection stale/corrompue, les approvals pending, les tentatives actives et les echecs avec artefact.
- Regression complete verte via `npm test` (171 tests).

### File List

- `packages/contracts/src/mission/mission-resume.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `tests/unit/formatters.test.ts`
- `tests/contract/mission-resume-cli.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/create-mission.test.ts`
