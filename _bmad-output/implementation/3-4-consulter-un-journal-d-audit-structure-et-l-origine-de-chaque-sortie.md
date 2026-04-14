# Story 3.4: Consulter un journal d'audit structure et l'origine de chaque sortie

Status: done

## Story

As a operateur technique,
I want lire l'historique de mission comme une trace structuree,
so that je puisse comprendre qui a fait quoi, quand et pourquoi.

## Context

Le socle d'audit existe deja par morceaux dans le code courant, mais il n'est pas encore lisible comme une vue mission-centrique unifiee:

- `events.jsonl` est bien la source de verite append-only avec `eventId`, `type`, `missionId`, `ticketId`, `attemptId`, `occurredAt`, `actor`, `source` et `payload`;
- `artifact-index.json` enrichit deja les artefacts avec `producingEventId`, `sourceEventType`, `sourceEventOccurredAt`, `sourceActor`, `source`, `approvalId` et `decisionRef` quand ces correlations sont reconstructibles;
- `corp mission artifact show` expose deja l'origine utile d'un artefact unique, mais seulement entree par entree;
- `corp mission status`, `corp mission resume`, `corp mission ticket board` et `corp mission approval queue` donnent chacun une lecture partielle du systeme;
- `readMissionResume(...)`, `readApprovalQueue(...)` et `readMissionArtifacts(...)` savent deja reconstruire leurs projections depuis le journal quand une vue est absente, stale ou corrompue.

Le gap reel de la story 3.4 est maintenant tres cible:

1. il n'existe aucune commande `corp mission audit ...` pour lire la mission comme une chronologie structuree;
2. il n'existe aucune projection `audit-log` ou lecture resiliente equivalente pour interroger rapidement le journal sans reparcourir ad hoc tous les payloads dans la CLI;
3. l'operateur peut consulter un artefact et une queue d'approbation, mais ne peut pas encore inspecter un evenement precis en surface produit;
4. l'origine d'une sortie reste dispersee entre `ticket.owner`, `event.actor`, `event.source`, `artifact.source*` et les snapshots d'approbation, alors que l'Epic 3 demande une lecture unifiee et auditable;
5. aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`, donc aucune convention de commit locale ne peut guider la conception de la vue d'audit.

### Delta explicite par rapport au code actuel

- `apps/corp-cli/src/commands/mission-command.ts` n'expose pas encore de commande `mission audit`.
- `packages/journal/src/projections/default-projections.ts` seed seulement `mission-status`, `ticket-board`, `approval-queue`, `artifact-index` et `resume-view`.
- `packages/journal/src/event-log/file-event-log.ts` sait relire le journal, mais aucun builder ne produit encore une timeline d'audit structuree.
- `packages/mission-kernel/src/resume-service/` ne contient ni `read-mission-audit.ts`, ni lecture detaillee d'evenement.
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` reecrit les read models existants, mais aucun `audit-log` n'est regenere.
- `packages/journal/src/projections/artifact-index-projection.ts` contient deja une normalisation utile de `source`, qu'il faudra reutiliser plutot que reimplementer differemment.
- `apps/corp-cli/src/formatters/artifact-detail-formatter.ts` montre deja `Acteur`, `Source`, `Evenement producteur`, `Approval` et `Decision`, ce qui doit devenir un pivot de la vue d'audit plutot qu'une logique parallele.

### Decision de conception pour cette story

- Ajouter une surface mission-centrique `corp mission audit --mission-id <id>` avec options de lecture, pas une commande brute de dump JSONL.
- Ajouter une inspection dediee d'evenement via `corp mission audit show --mission-id <id> --event-id <event_id>`.
- Conserver `corp mission artifact show --mission-id <id> --artifact-id <artifact_id>` comme surface canonique d'inspection d'artefact; 3.4 doit s'appuyer dessus, pas la dupliquer.
- Introduire une projection `audit-log.json` derivee du journal append-only et enrichie par les snapshots/projections existants, afin de rester coherent avec le reste des read models V1.
- Garder une entree d'audit par evenement journalise, puis enrichir les cas `artifact.*`, `approval.*`, `mission.*`, `ticket.*`, `execution.*` et `workspace.*` au lieu d'inventer une timeline synthetique decoree hors journal.
- Deriver l'origine lisible d'une sortie a partir de quatre sources stables et deja disponibles:
  - `ticket.owner` pour le role/agent produit;
  - `event.actor` pour l'acteur runtime normalise;
  - `source` public normalise (ex. `execution-adapter`, `corp-cli`, `workspace-isolation`);
  - les correlations `artifactId`, `approvalId`, `producingEventId`, `relatedEventIds`, `relatedArtifactIds` quand elles existent.
- Les lectures `mission audit` et `mission audit show` doivent rester strictement read-only: pas de nouvel evenement `mission.audit_viewed`, pas de mutation implicite de mission/ticket/attempt, seulement une reconstruction de projection si elle est stale ou absente.

## Acceptance Criteria

1. Given une mission a deja produit des executions, artefacts, validations, transitions de cycle de vie ou reprises
   When l'operateur lance `corp mission audit --mission-id <mission_id>`
   Then le systeme expose une chronologie structuree triee de facon deterministe par `occurredAt` puis `eventId`
   And chaque entree conserve `missionId`, `ticketId`, `attemptId`, `artifactId`, `approvalId`, `actor` et `source` lorsque ces correlations sont reconstructibles
   And la vue repose sur le journal append-only et ses projections locales, pas sur une interpretation ad hoc du transcript

2. Given l'operateur veut focaliser le diagnostic
   When il utilise `--ticket-id <ticket_id>` et/ou `--limit <n>` sur `corp mission audit`
   Then la vue reste mission-centrique et deterministe
   And le filtrage n'invente ni ne supprime des correlations essentielles pour les entrees retenues
   And une valeur de `limit` invalide echoue avec un message d'erreur explicite

3. Given l'operateur inspecte un artefact ou un evenement et demande son origine
   When il utilise `corp mission artifact show --artifact-id <artifact_id>` ou `corp mission audit show --event-id <event_id>`
   Then il peut identifier le role, l'agent ou l'extension a l'origine de cette sortie via `ticket.owner`, `actor`, `source` et les liens d'audit disponibles
   And aucun detail brut `responseId`, `pollCursor`, `vendorStatus`, `threadId`, `adapterState` ou equivalent OpenAI/Codex n'apparait dans la CLI ou la projection

4. Given `audit-log.json` est absent, stale ou corrompu
   When l'operateur lance `corp mission audit` ou `corp mission audit show`
   Then la projection est reconstruite depuis `events.jsonl`, les snapshots mission/ticket et les projections encore fiables
   And la lecture ne cree aucune nouvelle ligne dans `events.jsonl`
   And aucune mutation implicite de statut mission/ticket/attempt n'est faite

5. Given le journal contient des types d'evenements futurs ou encore peu connus par la story
   When la vue d'audit les rencontre
   Then ces evenements restent visibles avec un libelle de secours base sur `event.type`
   And ils conservent leurs correlations de base (`eventId`, `occurredAt`, `missionId`, `ticketId`, `attemptId`, `actor`, `source`) au lieu d'etre ignores

## Tasks / Subtasks

- [x] Definir une projection d'audit normalisee et compacte (AC: 1, 4, 5)
  - [x] Creer `packages/journal/src/projections/audit-log-projection.ts` avec `MissionAuditEntry` et `AuditLogProjection`
  - [x] Donner a `MissionAuditEntry` un shape minimal, stable et sans fuite vendor, par exemple:
  - [x] `entryId`, `occurredAt`, `eventId`, `eventType`, `kind`, `title`, `summary`, `missionId`, `ticketId?`, `attemptId?`, `artifactId?`, `approvalId?`, `actor`, `source`, `ticketOwner?`, `relatedEventIds[]`, `relatedArtifactIds[]`
  - [x] Construire les entrees uniquement a partir du journal, en enrichissant depuis `Ticket`, `Artifact` et les payloads produits deja persistes
  - [x] Ne pas stocker le `payload` brut ni `adapterState` dans la projection d'audit
  - [x] Garantir l'ordre stable `occurredAt|eventId`

- [x] Reutiliser une normalisation publique unique de `source` et de provenance (AC: 1, 3, 5)
  - [x] Extraire ou partager la logique de normalisation deja presente dans `packages/journal/src/projections/artifact-index-projection.ts`
  - [x] Eviter deux mappings divergents entre `artifact-index` et `audit-log`
  - [x] Conserver le principe produit suivant:
  - [x] `actor=adapter` + `source` contenant `codex` ou `openai` -> surface publique `execution-adapter`
  - [x] `corp-cli`, `workspace-isolation`, `ticket-runtime` restent lisibles comme sources locales
  - [x] `ticket.owner` doit etre remonte comme contexte d'origine quand un ticket existe

- [x] Integrer `audit-log` au bootstrap et a la reecriture des read models (AC: 1, 4)
  - [x] Ajouter `audit-log` a `packages/journal/src/projections/default-projections.ts`
  - [x] Etendre `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` pour reecrire `audit-log` a chaque mutation write-side significative
  - [x] Garder `events.jsonl` comme source de verite; `audit-log.json` reste une projection reconstructible
  - [x] Verifier que les checks d'initialisation de workspace restent coherents avec la nouvelle projection

- [x] Ajouter une lecture resiliente d'audit cote mission-kernel (AC: 1, 2, 4, 5)
  - [x] Creer `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
  - [x] Supporter une lecture liste avec options `missionId`, `ticketId?`, `limit?`
  - [x] Supporter une lecture detail evenement par `eventId`
  - [x] Reutiliser `readEventLog(...)`, le repository des tickets et, si utile, `readMissionArtifacts(...)` / `artifact-index` pour enrichir les correlations
  - [x] Si la projection est absente/corrompue/desynchronisee, la reconstruire puis reessayer la lecture
  - [x] En cas d'evenement introuvable, renvoyer une erreur deterministe sans mutation de l'etat

- [x] Exposer une surface CLI d'audit mission-centrique (AC: 1, 2, 3, 4)
  - [x] Etendre `apps/corp-cli/src/commands/mission-command.ts` avec:
  - [x] `corp mission audit --root <workspace> --mission-id <mission_id> [--ticket-id <ticket_id>] [--limit <n>]`
  - [x] `corp mission audit show --root <workspace> --mission-id <mission_id> --event-id <event_id>`
  - [x] Ajouter `apps/corp-cli/src/formatters/audit-log-formatter.ts` pour la timeline
  - [x] Ajouter `apps/corp-cli/src/formatters/audit-entry-detail-formatter.ts` pour le detail d'evenement
  - [x] Mettre a jour `apps/corp-cli/src/formatters/help-formatter.ts`
  - [x] Mettre a jour `C:/Dev/PRJET/corp/guide-utilisation.md` avec la nouvelle surface d'audit

- [x] Reutiliser l'inspection d'artefact existante au lieu de la dupliquer (AC: 3)
  - [x] Garder `apps/corp-cli/src/formatters/artifact-detail-formatter.ts` comme rendu canonique pour l'origine d'un artefact
  - [x] N'ajuster `readMissionArtifactDetail(...)` ou le formatter que si un petit delta est necessaire pour aligner le vocabulaire avec la vue d'audit
  - [x] Faire apparaitre dans la timeline les `artifactId` et `producingEventId` afin que l'operateur puisse pivoter naturellement entre `mission audit` et `mission artifact show`

- [x] Couvrir la story avec des tests deterministes et sans reseau (AC: 1, 2, 3, 4, 5)
  - [x] Ajouter `tests/unit/audit-log-projection.test.ts` (nouveau) pour l'ordre chronologique, l'extraction des correlations, la normalisation publique de source et le fallback sur les types inconnus
  - [x] Etendre `tests/unit/formatters.test.ts` avec le rendu de timeline et le detail d'evenement
  - [x] Ajouter `tests/contract/mission-audit-cli.test.ts` (nouveau) pour l'aide, les validations d'arguments, la surface francaise et l'absence de fuite vendor
  - [x] Ajouter `tests/integration/mission-audit.test.ts` (nouveau) avec au minimum:
  - [x] timeline couvrant `mission.created`, `ticket.created`, `workspace.isolation_created`, `execution.requested`, `ticket.in_progress`, `approval.*`, `artifact.registered`, `mission.paused`, `mission.relaunched`
  - [x] reconstruction quand `audit-log.json` est absent ou corrompu
  - [x] `mission audit show` sur un `eventId` existant avec correlations `ticketId`, `attemptId`, `approvalId` ou `artifactId`
  - [x] garantie read-only: journal avant/apres lecture identique
  - [x] scenario `--ticket-id` et `--limit`
  - [x] verification explicite qu'aucune sortie CLI ni `audit-log.json` ne contiennent `responseId`, `pollCursor`, `vendorStatus`, `threadId` ou `adapterState`

## Dev Notes

### Story Intent

Cette story ne doit pas ajouter un "debug dump" brut du journal. Elle doit livrer une lecture operateur:

- chronologique;
- stable;
- mission-centrique;
- suffisamment detaillee pour diagnostiquer qui a agi, sur quel ticket, via quelle source, et avec quels artefacts/approvals lies;
- sans fuite vendor ni transcript brut.

Si l'implementation force l'operateur a lire `events.jsonl` a la main ou a recouper manuellement `ticket-board`, `approval-queue` et `artifact-index`, la story rate sa cible.

### Current Project State

- `packages/journal/src/event-log/append-event.ts` fixe deja le contrat minimal du journal (`eventId`, `type`, `missionId`, `ticketId?`, `attemptId?`, `occurredAt`, `actor`, `source`, `payload`).
- `packages/journal/src/event-log/file-event-log.ts` sait deja relire et valider `events.jsonl`.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` produit deja les evenements coeur d'execution (`workspace.isolation_created`, `ticket.claimed`, `execution.requested`, `ticket.in_progress`, `execution.completed|failed|cancelled`, `approval.requested`).
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` produit deja `approval.approved|rejected|deferred`.
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts` produit deja `artifact.detected` et `artifact.registered`.
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts` produit deja `mission.paused`, `mission.relaunched`, `mission.completed`, `mission.cancelled`.
- `apps/corp-cli/src/formatters/artifact-detail-formatter.ts` expose deja une partie de la provenance utile d'un artefact.
- Le projet reste sur `Node >=20.0.0`, `TypeScript ^5.9.3`, `node:test`, `assert/strict`, sans dependance externe de test.
- Aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`; ne pas supposer de conventions de commit ou de hooks locaux.

### Recommended Event Coverage

La V1 doit gerer explicitement au moins les types d'evenements aujourd'hui emises par le code courant:

- mission:
  - `mission.created`
  - `mission.paused`
  - `mission.relaunched`
  - `mission.completed`
  - `mission.cancelled`
- ticket:
  - `ticket.created`
  - `ticket.updated`
  - `ticket.reprioritized`
  - `ticket.cancelled`
  - `ticket.claimed`
  - `ticket.in_progress`
- execution:
  - `execution.requested`
  - `execution.background_started`
  - `execution.completed`
  - `execution.failed`
  - `execution.cancelled`
- approvals:
  - `approval.requested`
  - `approval.approved`
  - `approval.rejected`
  - `approval.deferred`
- artifacts / workspace:
  - `artifact.detected`
  - `artifact.registered`
  - `workspace.isolation_created`

Tout type inconnu doit rester visible avec un fallback produit sobre.

### Recommended Audit Entry Shape

Utiliser un shape produit compact et stable. Exemple recommande:

```json
{
  "entryId": "event_approval_requested",
  "occurredAt": "2026-04-11T22:16:58.5005271+02:00",
  "eventId": "event_approval_requested",
  "eventType": "approval.requested",
  "kind": "approval",
  "title": "Validation requise pour une action sensible",
  "summary": "Validation en attente pour le ticket ticket_alpha",
  "missionId": "mission_demo",
  "ticketId": "ticket_alpha",
  "attemptId": "attempt_123",
  "approvalId": "approval_123",
  "artifactId": null,
  "actor": "adapter",
  "source": "execution-adapter",
  "ticketOwner": "agent_dev",
  "relatedEventIds": ["event_execution_requested"],
  "relatedArtifactIds": []
}
```

Invariants a preserver:

- une entree d'audit reste ancree sur un `eventId` reel du journal;
- `source` doit etre public et stable;
- `ticketOwner` est un enrichissement utile, pas une source de verite autonome;
- aucun `payload` brut, `adapterState`, `responseId`, `threadId`, `pollCursor` ou `vendorStatus` ne doit sortir dans la projection;
- si une correlation n'est pas fiable, la laisser absente plutot que l'inventer.

### Architecture Compliance

- Le journal append-only reste la source de verite; les projections sont reconstruisibles. [Source: architecture.md - 3.9 Journal and Projection Model]
- Toute transition significative doit produire un evenement avant toute projection. [Source: architecture.md - 4.1 Domain Consistency Rules]
- Les details OpenAI/Codex ne doivent pas sortir de `executionHandle.adapterState` ou de `ExecutionAttempt.adapterState`. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- La surface operateur V1 reste la CLI `corp`; elle ne doit pas devenir un shell vendor. [Source: architecture.md - 3.10 Five-Layer Target Architecture]
- L'auditabilite et la reprise doivent reposer sur un journal fin, des correlations `event -> artifact -> ticket` et des projections locales lisibles. [Source: architecture.md - 5.3 Requirements to Structure Mapping]

### Previous Story Intelligence

- Story 3.1 a deja rendu la queue d'approbation reconstructible et mission-centrique; reutiliser `approvalId`, `relatedEventIds` et `relatedArtifactIds` plutot que reconstruire un second modele d'approbation.
- Story 3.2 a deja formalise des evenements `approval.approved|rejected|deferred` avec une charge utile `decision`; l'audit doit savoir les resumer sans exposer le payload brut.
- Story 3.3 a deja montre le bon pattern pour une lecture read-side enrichie: projection reconstructible, zero mutation write-side, pas de nouvelle commande interactive inutile.
- `artifact-index-projection.ts` sait deja relier un artefact a son evenement producteur, a sa source publique, et a des references d'approbation/decision. C'est le seam a prolonger pour 3.4.
- Les tests existants de l'Epic 3 verifient deja l'absence de fuite vendor dans `resume`, `approval queue` et `artifact show`; conserver exactement cette discipline.

### Implementation Guardrails

- Ne pas ajouter de commande de dump brut du journal type `corp mission events raw`.
- Ne pas exposer `event.payload` en CLI ou dans `audit-log.json`.
- Ne pas stocker `adapterState` ni aucun identifiant OpenAI/Codex dans la projection d'audit.
- Ne pas emettre de nouvel evenement de lecture comme `mission.audit_viewed` ou `mission.event_inspected`.
- Ne pas introduire un package `observability/` geant si les besoins de 3.4 tiennent dans `packages/journal` + `packages/mission-kernel` + `apps/corp-cli`.
- Ne pas dupliquer la logique de preview d'artefact; `artifact show` reste la vue dediee.
- Ne pas modifier `dist/` manuellement.
- Ne pas ajouter de dependance npm externe.
- Garder les nouveaux fichiers en ASCII et les noms de modules en `kebab-case`.
- Si un evenement ne rentre pas proprement dans un resume "joli", preferer un fallback vrai et compact plutot qu'une interpretation incertaine.

### File Structure Requirements

**Projection / journal**
- `packages/journal/src/projections/audit-log-projection.ts` (nouveau)
- `packages/journal/src/projections/default-projections.ts`
- `packages/journal/src/projections/artifact-index-projection.ts` (pour partager la normalisation de provenance)

**Services read-side**
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts` (nouveau)
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`

**Support write-side**
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`

**CLI**
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/audit-log-formatter.ts` (nouveau)
- `apps/corp-cli/src/formatters/audit-entry-detail-formatter.ts` (nouveau)
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/artifact-detail-formatter.ts` (uniquement si un petit alignement de vocabulaire est necessaire)
- `C:/Dev/PRJET/corp/guide-utilisation.md`

**Tests**
- `tests/unit/audit-log-projection.test.ts` (nouveau)
- `tests/unit/formatters.test.ts`
- `tests/contract/mission-audit-cli.test.ts` (nouveau)
- `tests/integration/mission-audit.test.ts` (nouveau)
- `tests/integration/artifact-index.test.ts` (seulement si un ajustement mineur est necessaire pour l'alignement d'origine)

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Les tests doivent rester hors reseau; reutiliser la DI deja presente (`setRunTicketDependenciesForTesting(...)`) pour simuler les chemins `completed`, `awaiting_approval`, `failed`.
- Verifier explicitement que `mission audit` n'ajoute aucune ligne a `events.jsonl`.
- Verifier qu'une projection `audit-log.json` ancienne/corrompue est relue puis reecrite correctement.
- Verifier au moins un scenario de timeline complete avec:
  - creation mission
  - creation ticket
  - run ticket
  - approval pending puis resolution
  - artefact enregistre
  - pause puis relaunch mission
- Verifier que `mission audit show --event-id ...` renvoie un detail lisible et correle.
- Verifier que `mission artifact show` reste compatible et continue d'identifier `Acteur`, `Source`, `Evenement producteur`, `Approval` et `Decision` sans fuite vendor.
- Verifier les filtres `--ticket-id` et `--limit`.
- Verifier que la timeline et le detail n'exposent jamais `responseId`, `threadId`, `pollCursor`, `vendorStatus`, `adapterState` ou `requires_action`.

### Scope Exclusions

- Export CSV/JSON public de l'audit
- Recherche full-text sur `events.jsonl`
- Visualisation graphique ou TUI d'audit
- Reprise ciblee d'une branche de tickets (Story 3.5)
- Resume automatique d'une run vendor ou polling background complet
- Moteur d'inference "why chain" plus riche que les correlations deja persistees

### Assumptions

- Une chronologie triee par `occurredAt|eventId` est suffisante pour le V1.
- L'origine operateur d'une sortie peut etre rendue credible en combinant `ticket.owner`, `actor`, `source` public et les references d'artefacts/approvals, sans introduire un nouveau registre d'identites.
- Une projection `audit-log` compacte est preferable a une lecture CLI ad hoc sur `events.jsonl`, tant pour la robustesse que pour la coherence avec les autres vues.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-11: la fiche modele `GPT-5-Codex` indique qu'il est "available in the Responses API only". Inference produit: la vue d'audit `corp` ne doit jamais faire remonter des primitives vendor comme schema coeur; elles restent confinees aux adaptateurs et aux `adapterState`. [Source: OpenAI GPT-5-Codex model page]
- Verification officielle OpenAI le 2026-04-11: la doc Codex `Agent approvals & security` expose des modes runtime comme `workspace-write`, `on-request` et `untrusted`. Inference produit: ces controles runtime ne remplacent pas la lecture d'audit metier locale de `corp`; la provenance affichee doit rester basee sur le journal produit et les projections locales. [Source: OpenAI Codex agent approvals & security]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3; Story 3.1; Story 3.2; Story 3.3; Story 3.4; Story 3.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Parcours 2; Parcours 4; FR20; FR21; NFR6; NFR11; NFR13
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - sections sur journal d'evenements/artefacts, dependance Codex et auditabilite
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-1-ouvrir-une-file-d-approbation-pour-les-actions-sensibles.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-2-approuver-refuser-ou-differer-une-demande-avec-garde-fous-auditablement.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-3-reprendre-une-mission-interrompue-a-partir-d-un-resume-fiable.md`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/artifact-detail-formatter.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/append-event.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/event-log/file-event-log.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/default-projections.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/artifact-index-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `https://developers.openai.com/api/docs/models/gpt-5-codex`
- `https://developers.openai.com/codex/agent-approvals-security`

## Change Log

- 2026-04-11: story creee via `bmad-create-story`, contexte complet ajoute, statut passe a `ready-for-dev`
- 2026-04-11: implementation completee, projection `audit-log` ajoutee, CLI `mission audit` livree et story passee a `review`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- 2026-04-11T23:44:07+02:00 - Story 3.4 et `sprint-status.yaml` passes en `in-progress`
- 2026-04-11T23:46:00+02:00 - `npm run build` rouge attendu apres ajout de `tests/unit/audit-log-projection.test.ts`
- 2026-04-11T23:49:00+02:00 - `node --test dist/tests/unit/audit-log-projection.test.js` vert apres creation de `audit-log-projection.ts`
- 2026-04-11T23:53:00+02:00 - `node --test dist/tests/contract/mission-audit-cli.test.js` et `node --test dist/tests/integration/mission-audit.test.js` verts apres branchement CLI/read-side
- 2026-04-11T23:57:14+02:00 - `npm test` vert (182 tests)

### Completion Notes List

- Projection `audit-log` ajoutee avec timeline stable `occurredAt|eventId`, correlations `ticket/attempt/artifact/approval` et fallback sobre pour les types d'evenements inconnus.
- Normalisation publique de provenance partagee entre `artifact-index` et `audit-log`, avec protection explicite contre les fuites vendor (`responseId`, `pollCursor`, `vendorStatus`, `adapterState`, `threadId`).
- Lecture read-only resiliente implementee via `readMissionAudit(...)` et `readMissionAuditEventDetail(...)`, y compris reconstruction quand `audit-log.json` est absent, stale ou corrompu.
- Surface CLI `corp mission audit` et `corp mission audit show` livree avec formatters dedies, aide CLI et guide utilisateur mis a jour.
- Couverture ajoutee sur projection, formatters, surface CLI et scenario d'integration complet; regression totale validee via `npm test`.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/audit-entry-detail-formatter.ts`
- `apps/corp-cli/src/formatters/audit-log-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `guide-utilisation.md`
- `packages/journal/src/projections/artifact-index-projection.ts`
- `packages/journal/src/projections/audit-log-projection.ts`
- `packages/journal/src/projections/default-projections.ts`
- `packages/mission-kernel/src/mission-service/create-mission.ts`
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `tests/contract/mission-audit-cli.test.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/integration/mission-audit.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/unit/audit-log-projection.test.ts`
- `tests/unit/formatters.test.ts`

### Review Findings

- [x] [Review][Defer] `--ticket-id` filtre les evenements mission-level (mission.created, mission.paused, mission.relaunched) — deferred, decision produit a prendre sur la semantique du filtre ticket vs contexte mission
- [x] [Review][Patch] Dead code `isApprovalDecision` + `void isApprovalDecision;` dans audit-log-projection.ts [audit-log-projection.ts:721-730] — fixed
- [x] [Review][Patch] `limit=0` passe programmatiquement a `readMissionAudit` retourne tout au lieu de rien (`slice(-0) === slice(0)`) [read-mission-audit.ts:80] — fixed
- [x] [Review][Patch] Cast inutile `as AuditLogProjection` dans ticket-service-support.ts [ticket-service-support.ts:287] — fixed
- [x] [Review][Defer] Type guards dupliques entre `audit-log-projection.ts` et `read-mission-audit.ts` (~6 fonctions identiques) — deferred, pre-existing pattern cross-package
- [x] [Review][Defer] `readSourceReferences` nested scan court-circuite sur le 1er objet imbrique, peut perdre `decisionRef` — deferred, pre-existing dans artifact-index-projection.ts
- [x] [Review][Defer] `toPublicSource` ne masque que openai/codex, autre nom de vendor passerait en clair — deferred, pre-existing dans artifact-index-projection.ts

#### Review 2 (2026-04-12, Claude Opus 4.6 — Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] [Review][Patch] AC3: `artifact show` ne montre pas `ticket.owner` — petit delta d'alignement vocabulaire avec la vue audit [artifact-index-projection.ts, artifact-detail-formatter.ts] — fixed
- [x] [Review][Patch] `readSourceEventIds` lit `payload.eventId` sans filtre — risque d'auto-reference dans `relatedEventIds` [audit-log-projection.ts:483] — fixed
- [x] [Review][Patch] `isApprovalDecision` type guard trop permissif — accepte tout objet avec un champ `outcome` [read-mission-audit.ts:531-538] — fixed
- [x] [Review][Defer] Compat workspaces pre-3.4: `ensureMissionWorkspaceInitialized` verifie `audit-log.json` — deferred, pattern pre-existing, re-bootstrap resout
- [x] [Review][Defer] `isExecutionAttempt` rejette `workspaceIsolationId: null` — deferred, pre-existing cross-package
- [x] [Review][Defer] Ecritures non-atomiques sur Windows (`writeProjectionSnapshot`) — deferred, concern infra pre-existing
- [x] [Review][Defer] `toPublicSource` laisse passer les sources non reconnues — deferred, pre-existing (deja deferred review 1)
- [x] [Review][Defer] Erreurs OS brutes non catchees dans `readEventLog` — deferred, concern infra pre-existing
- [x] [Review][Defer] `--ticket-id` filtre les evenements mission-level — deferred, deja deferred review 1
- [x] [Review][Defer] O(n) rebuild a chaque lecture audit — deferred, par conception V1
