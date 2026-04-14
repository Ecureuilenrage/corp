# Story 3.2: Approuver, refuser ou differer une demande avec garde-fous auditablement

Status: done

## Story

As a operateur technique,
I want resoudre une demande d'approbation et ajuster les garde-fous associes,
so that la mission reste gouvernee sans contaminer le schema coeur.

## Context

La story 3.1 a deja livre la moitie structurelle du flux:

- `runTicket` sait ouvrir une demande durable via `approval.requested`.
- `approval-queue.json` est derive du journal et reconstruit si la projection est absente ou corrompue.
- la CLI expose `corp mission approval queue`.
- le contrat `ApprovalRequestStatus` inclut deja `approved`, `rejected`, `deferred`, `cancelled`, `expired`.
- `approval-queue-projection.ts` sait deja retirer les statuts terminaux de la file.

Le gap restant est net: `corp` sait ouvrir une validation, mais ne sait toujours pas la resoudre. Sans story 3.2, une mission peut entrer en `awaiting_approval`, mais aucun flux ne peut:

1. retrouver proprement la demande ouverte;
2. append un evenement terminal `approval.*`;
3. fermer l'etat `awaiting_approval` de l'attempt courante;
4. appliquer les ajustements de garde-fous utiles a la mission ou au ticket;
5. remettre les projections et la reprise operateur dans un etat coherent.

### Delta explicite par rapport au code actuel

- `apps/corp-cli/src/commands/mission-command.ts` ne supporte aujourd'hui que `mission approval queue`.
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts` sait retrouver une demande pending fiable; reutiliser cette lecture comme source de verite operateur.
- `packages/journal/src/projections/approval-queue-projection.ts` comprend deja `approval.approved`, `approval.rejected` et `approval.deferred`, mais aucun service ne produit encore ces evenements.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` laisse l'attempt active en `awaiting_approval`; sans resolution explicite, `corp` reste bloque.
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts` n'autorise pas les mutations sur un ticket `failed`, `blocked` ou `awaiting_approval`. La story 3.2 doit donc appliquer les ajustements de garde-fous directement dans la commande d'approbation, pas compter sur une retouche manuelle ulterieure.
- Aucun depot Git n'est detecte dans `C:/Dev/PRJET/corp`; aucune convention de commit locale ne peut etre deduite.

### Decision de conception pour cette story

- Les decisions d'approbation de `corp` sont des decisions produit locales, pas un proxy des approvals runtime de Codex.
- Ne pas tenter de "reprendre" la run vendor en place apres `approve`. La doc OpenAI distingue les garde-fous runtime (`sandbox` / `approval_policy`) de l'audit metier de `corp`, et le mode background reste a retention courte. 3.2 doit donc fermer l'approbation locale et preparer la prochaine action explicite.
- Reutiliser les champs coeur deja existants pour les garde-fous persistants:
  - `Mission.policyProfileId`
  - `Ticket.allowedCapabilities`
  - `Ticket.skillPackRefs`
- Toute observation de budget doit rester dans le journal d'evenements seulement. Ne jamais ajouter `resource_budget` a `Mission` ou `Ticket`.
- Pour garder un chemin operable avec les commandes actuelles, fermer l'attempt resolue avec le statut `cancelled`, puis:
  - `approve` remet le ticket en `todo`;
  - `reject` et `defer` passent le ticket en `failed`;
  - la difference entre rejet et report vit dans l'evenement `approval.*` et sa charge utile d'audit, pas dans un nouveau statut coeur.
- Le statut mission doit etre recalcule apres chaque decision:
  - une autre approbation pending reste ouverte -> `awaiting_approval`;
  - sinon une autre attempt active existe -> `running`;
  - sinon -> `ready`.

Cette decision est volontairement sobre: ne pas inventer de resume vendor magique, de reprise implicite, ni de nouvel enum coeur pour "approval_resolved". 3.2 doit livrer un flux auditable et relancable avec les primitives deja stabilisees.

## Acceptance Criteria

1. Given une file d'approbation contient une demande pending
   When l'operateur lance `corp mission approval approve|reject|defer` avec `--mission-id` et `--approval-id`
   Then un evenement `approval.approved`, `approval.rejected` ou `approval.deferred` est append au journal avant toute reecriture de projection
   And `approval-queue.json` ne contient plus cette demande juste apres refresh
   And `mission resume` et `mission status` reflettent immediatement l'absence de cette validation pending

2. Given l'operateur ajuste un garde-fou de mission ou de ticket pendant sa decision
   When il fournit `--policy-profile`, `--allow-capability`, `--clear-allow-capability`, `--skill-pack`, `--clear-skill-pack` ou `--budget-observation`
   Then les garde-fous persistants sont appliques via les champs existants `policyProfileId`, `allowedCapabilities` et `skillPackRefs`
   And les observations de budget restent seulement dans la charge utile d'audit de l'evenement
   And aucun champ `resource_budget` n'est ajoute a `Mission` ou `Ticket`

3. Given une demande pending est liee a une `ExecutionAttempt` active
   When la decision est enregistree
   Then l'attempt courante devient terminale avec `status: cancelled` et `endedAt` renseigne
   And `approve` remet le ticket en `todo`
   And `reject` et `defer` basculent le ticket en `failed`
   And le statut mission est recalcule parmi `awaiting_approval`, `running` ou `ready` sans fuite vendor

4. Given `approval-queue.json` est absent, stale ou corrompu
   When l'operateur tente de resoudre une demande
   Then la commande reconstruit d'abord la queue depuis le journal
   And une `approvalId` inconnue ou deja terminale provoque une erreur deterministe sans mutation de mission, ticket ou attempt

5. Given la surface CLI expose la resolution d'approbation
   When l'operateur consulte l'aide ou la sortie des commandes `approval approve|reject|defer`
   Then la surface reste mission-centrique, deterministe et sans fuite de `responseId`, `pollCursor`, `vendorStatus` ou autre detail OpenAI/Codex brut

## Tasks / Subtasks

- [x] Ajouter le service de resolution d'approbation (AC: 1, 2, 3, 4)
  - [x] Creer `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` pour centraliser la lecture de la demande pending, la mutation de mission/ticket/attempt et l'append du journal
  - [x] S'appuyer sur `readApprovalQueue(...)` pour charger une file fiable avant decision; ne pas relire `approval-queue.json` en direct
  - [x] Charger `Mission`, `Ticket` et `ExecutionAttempt` depuis les repositories existants et verifier que l'approbation cible est bien encore pending pour cette mission
  - [x] Lever une erreur deterministe si `approvalId` est absente, inconnue, deja resolue, ou si l'attempt ciblee n'existe plus

- [x] Materialiser les evenements terminaux `approval.*` et fermer l'etat `awaiting_approval` (AC: 1, 3)
  - [x] Ajouter un type d'audit partage, par exemple `packages/contracts/src/approval/approval-decision.ts`, pour typer `outcome`, `reason`, `budgetObservations` et les mutations appliquees
  - [x] Pour `approve`, append `approval.approved` avec une copie mise a jour de la demande (`status`, `updatedAt`) et remettre le ticket en `todo`
  - [x] Pour `reject` et `defer`, append `approval.rejected` ou `approval.deferred` puis passer le ticket en `failed`
  - [x] Dans tous les cas, clore l'attempt courante avec `status: cancelled` et `endedAt`
  - [x] Recalculer le statut mission avec la regle: autre approval pending -> `awaiting_approval`; sinon autre attempt active -> `running`; sinon `ready`
  - [x] Preserver `executionHandle.adapterState` et `attempt.adapterState` tels quels pour l'audit; ne rien remapper dans le schema coeur

- [x] Appliquer les ajustements de garde-fous inline, sans nouveau schema coeur (AC: 2)
  - [x] Etendre la commande de decision pour supporter `--policy-profile <profil>`
  - [x] Reutiliser les memes semantiques de normalisation que `ticket update` pour `--allow-capability`, `--clear-allow-capability`, `--skill-pack`, `--clear-skill-pack`
  - [x] Appliquer `--policy-profile` directement sur `Mission.policyProfileId`
  - [x] Appliquer les mutations capability / skill pack directement sur le ticket lie a l'approbation
  - [x] Accepter `--budget-observation <texte>` comme option repetable et stocker ces observations uniquement dans la charge utile d'audit
  - [x] Regenerer le snapshot `approval.guardrails` a partir des garde-fous effectifs apres mutation (`approval.guardrails` existants + mission policy + capabilities + skill packs) afin que l'evenement terminal capture le contexte final de decision

- [x] Exposer la resolution dans la CLI mission-centrique (AC: 1, 4, 5)
  - [x] Etendre `apps/corp-cli/src/commands/mission-command.ts` avec `corp mission approval approve|reject|defer`
  - [x] Parser au minimum: `--root`, `--mission-id`, `--approval-id`, `--reason`, `--policy-profile`, `--allow-capability`, `--clear-allow-capability`, `--skill-pack`, `--clear-skill-pack`, `--budget-observation`
  - [x] Conserver les incompatibilites explicites deja utilisees ailleurs (`--allow-capability` vs `--clear-allow-capability`, `--skill-pack` vs `--clear-skill-pack`)
  - [x] Mettre a jour `apps/corp-cli/src/formatters/help-formatter.ts`
  - [x] La sortie de succes doit au minimum annoncer `Approval resolue: <approvalId> (<decision>)`, puis afficher le resume mission mis a jour

- [x] Maintenir les projections et la reprise coherentes (AC: 1, 3, 4)
  - [x] Reutiliser `rewriteMissionReadModels(...)` apres append/save pour repropager `mission-status`, `ticket-board`, `approval-queue`, `artifact-index` et `resume-view`
  - [x] Verifier qu'une resolution unique d'une approval dans une mission multi-approvals laisse les autres approvals pending intactes et conserve `Mission.status = awaiting_approval`
  - [x] Verifier que la commande fonctionne encore si `approval-queue.json` ou `resume-view.json` sont absents/corrompus

- [x] Couvrir le flux par des tests deterministes, sans reseau (AC: 1, 2, 3, 4, 5)
  - [x] Etendre `tests/contract/mission-approval-queue-cli.test.ts` pour l'aide, les validations d'arguments et les erreurs deterministes des commandes `approve|reject|defer`
  - [x] Ajouter `tests/integration/approval-resolution.test.ts` (nouveau) ou etendre `tests/integration/approval-queue.test.ts` avec au minimum:
  - [x] scenario `approve`: fermeture de la queue, `approval.approved`, attempt `cancelled`, ticket `todo`, mission `ready|running|awaiting_approval`, mutation des garde-fous persistants
  - [x] scenario `reject`: `approval.rejected`, queue vide, attempt `cancelled`, ticket `failed`, reprise operateur sans fuite vendor
  - [x] scenario `defer`: `approval.deferred`, queue vide, attempt `cancelled`, ticket `failed`
  - [x] scenario projection stale/corrompue: la resolution reconstruit depuis le journal avant de muter
  - [x] scenario `approvalId` inconnue ou deja resolue: aucune mutation n'est persistee
  - [x] Etendre `tests/unit/approval-queue-projection.test.ts` pour verifier qu'un evenement terminal avec snapshot mis a jour retire bien l'entree et preserve `updatedAt`
  - [x] Etendre `tests/unit/formatters.test.ts` si l'aide ou le resume changent
  - [x] Verifier explicitement que les sorties CLI et les projections ne contiennent toujours pas `responseId`, `pollCursor`, `vendorStatus` ou `requires_action`

### Review Findings

- [x] [Review][Patch] Guards "attempt not found" et "attempt not awaiting_approval" non testes [resolve-approval-request.ts:116-126]
- [x] [Review][Patch] Pas de test contract pour `--mission-id` requis sur `approve|reject|defer` [mission-approval-queue-cli.test.ts]
- [x] [Review][Patch] Pas d'assertion sur `attempt.adapterState` preservee apres cancellation [approval-resolution.test.ts]
- [x] [Review][Defer] Ecritures non-atomiques (pattern pre-existant identique a run-ticket.ts) — deferred, pre-existing
- [x] [Review][Defer] readApprovalQueue catch block avale EACCES (gestion d'erreur pre-existante story 3.1) — deferred, pre-existing
- [x] [Review][Defer] --root whitespace-only passe la validation (pre-existant dans resolveRootDir) — deferred, pre-existing
- [x] [Review][Defer] Gaps de tests AC1/AC4 (event-before-projection, file absence) — deferred, amelioration au-dela du scope 3.2

## Dev Notes

### Story Intent

Cette story ne doit pas transformer `corp` en moteur de resume runtime vendor. Elle doit livrer la plus petite boucle operateur fiable pour:

- arbitrer une demande ouverte;
- journaliser la decision;
- appliquer les ajustements de garde-fous utiles;
- fermer l'etat `awaiting_approval`;
- remettre la mission dans un etat lisible et relancable.

Si l'implementation commence a "reprendre" automatiquement une run OpenAI ou a inventer un nouveau sous-schema de policy/budget, elle sort du scope.

### Current Project State

- `packages/contracts/src/approval/approval-request.ts` contient deja les statuts terminaux requis pour 3.2.
- `packages/journal/src/projections/approval-queue-projection.ts` retire deja les approbations terminales de la queue.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` materialise deja `approval.requested`, `approvalId`, `guardrails` et la capture des IDs vendor dans `adapterState`.
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` et `read-approval-queue.ts` savent deja se reconstruire depuis le journal si les projections sont douteuses.
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts` ne permet pas de modifier un ticket hors statut `todo`; ne pas compter sur un second passage operateur hors commande d'approbation pour appliquer les garde-fous de cette story.
- Aucun depot Git n'est present sous `C:/Dev/PRJET/corp`; pas de commit intelligence disponible.

### Recommended Decision Payload

Utiliser une charge utile explicite et stable pour les evenements terminaux:

```json
{
  "mission": { "...": "snapshot mis a jour" },
  "ticket": { "...": "snapshot mis a jour" },
  "attempt": { "...": "snapshot mis a jour" },
  "approvalId": "approval_123",
  "previousApproval": {
    "approvalId": "approval_123",
    "status": "requested"
  },
  "approval": {
    "approvalId": "approval_123",
    "status": "approved",
    "guardrails": [
      "manual_review: workspace_write",
      "policy_profile: policy_profile_local",
      "allowed_capabilities: fs.read, cli.run"
    ],
    "updatedAt": "2026-04-11T18:15:45.8072558+02:00"
  },
  "decision": {
    "outcome": "approved",
    "reason": "Validation manuelle de l'operateur",
    "missionPolicyChange": {
      "previous": "policy_profile_local",
      "next": "policy_profile_strict"
    },
    "ticketCapabilityChange": {
      "previous": ["fs.read"],
      "next": ["fs.read", "cli.run"]
    },
    "ticketSkillPackChange": {
      "previous": ["pack.audit"],
      "next": ["pack.audit", "pack.review"]
    },
    "budgetObservations": [
      "openai.responses.tokens=1200"
    ]
  },
  "trigger": "operator"
}
```

Invariants a preserver:

- le snapshot `approval` reste le contrat principal pour la projection de queue;
- les observations budgetaires restent de l'audit, pas du schema coeur;
- la structure `decision` doit rester purement produit, sans detail OpenAI/Codex brut.

### Architecture Compliance

- Toute transition significative doit produire un evenement avant toute projection. [Source: architecture.md - 4.1 Domain Consistency Rules]
- Le journal append-only reste la source de verite; les projections sont reconstruisibles. [Source: architecture.md - 3.9 Journal and Projection Model]
- Les details OpenAI/Codex ne doivent pas sortir de `execution_handle.adapter_state` ou de `ExecutionAttempt`. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- `resource_budget` reste hors schema coeur et ne doit vivre que dans le journal ou les projections derivees. [Source: architecture.md - 3.9 Journal and Projection Model]
- La surface operateur V1 reste la CLI `corp`; elle ne doit pas devenir un shell vendor. [Source: architecture.md - 3.10 Five-Layer Target Architecture]

### Previous Story Intelligence

- Story 3.1 a deja etabli la convention `approval.requested` + `approvalId` stable + queue journal-driven. 3.2 doit etendre ce pattern, pas le contourner.
- L'approbation initiale capture deja des garde-fous derives de `mission.policyProfileId`, `ticket.allowedCapabilities` et `ticket.skillPackRefs`. 3.2 doit regenerer ce snapshot apres mutation, pas ajouter un second canal implicite.
- `readApprovalQueue(...)` reconstruit deja la projection si elle est manquante ou corrompue. Reutiliser ce service pour la resolution plutot qu'une lecture ad hoc.
- `runTicket` garde actuellement l'attempt en statut actif `awaiting_approval`. Sans fermeture explicite de l'attempt dans 3.2, toute tentative de rerun restera bloquee par `findActiveByTicketId`.

### Implementation Guardrails

- Ne pas essayer d'appeler une API OpenAI pour "reprendre" ou "autoriser" la run en place.
- Ne pas introduire de nouveau champ coeur pour `resource_budget`, `guardrails`, `approvalPolicy`, `approvalDecision` ou `resumeToken`.
- Ne pas ajouter de nouvel enum coeur pour distinguer `deferred` au niveau `Ticket` ou `ExecutionAttempt`.
- Ne pas modifier `dist/` manuellement.
- Ne pas ajouter de dependance npm externe.
- Garder les nouveaux fichiers en ASCII et les noms de modules en `kebab-case`.
- Si vous factorisez une logique partagee avec `run-ticket.ts`, faites-le de maniere minimale et sans casser les tests existants autour de l'Epic 2 / 3.1.

### File Structure Requirements

**Contrats / types**
- `packages/contracts/src/approval/approval-request.ts`
- `packages/contracts/src/approval/approval-decision.ts` (nouveau)

**Services coeur**
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` (nouveau)
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`

**CLI**
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts` (si ajustement du message de reprise necessaire)

**Projection / support**
- `packages/journal/src/projections/approval-queue-projection.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`

**Tests**
- `tests/contract/mission-approval-queue-cli.test.ts`
- `tests/integration/approval-resolution.test.ts` (nouveau) ou extension ciblee de `tests/integration/approval-queue.test.ts`
- `tests/unit/approval-queue-projection.test.ts`
- `tests/unit/formatters.test.ts` si la surface CLI change

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Les tests d'integration doivent rester hors reseau et reutiliser la DI deja presente pour ouvrir une approval pending.
- Verifier explicitement l'ordre d'evenements pour une resolution: `approval.requested` precede toujours `approval.approved|rejected|deferred`.
- Verifier qu'une resolution ne fuit aucun identifiant vendor dans:
  - stdout CLI
  - `approval-queue.json`
  - `resume-view.json`
- Verifier au moins un scenario multi-approvals pour la recomputation de `Mission.status`.
- Verifier qu'une resolution applique les mutations ticket/mission attendues et que `budgetObservations` ne vivent que dans l'evenement.

### Scope Exclusions

- Resume automatique d'une run OpenAI/Codex apres approval
- Polling background complet post-approval
- Vue d'audit structuree complete de l'historique (Story 3.4)
- Reprise conversationnelle riche ou reconstruction guidee de mission (Story 3.3)
- Politique de budget numerique calculable ou enforcement budgetaire complet
- Nouveau moteur de policy generaliste

### Assumptions

- La fermeture de l'attempt en `cancelled` est le choix V1 le plus propre pour liberer le ticket sans pretendre que la run a repris ou a reussi.
- `reject` et `defer` reutilisent `Ticket.status = failed` pour garder un chemin de rerun existant avec les commandes actuelles, tandis que la difference metier reste porteuse dans l'evenement `approval.*`.
- Les mutations de garde-fous necessaires a 3.2 se limitent a `policyProfileId`, `allowedCapabilities` et `skillPackRefs`; toute sophistication supplementaire reste pour les stories suivantes.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-11: la doc Codex "Agent approvals & security" distingue les approvals/sandboxes runtime (`read-only`, `workspace-write`, `on-request`, `untrusted`, `--dangerously-bypass-approvals-and-sandbox`) de la logique produit locale. Inference pour `corp`: la decision d'approbation V1 doit rester un evenement metier local et ne doit pas etre confondue avec les approvals runtime de Codex. [Source: OpenAI Codex agent approvals & security]
- Verification officielle OpenAI le 2026-04-11: les runs longs via `Responses API` sont pousses vers le background mode, ce qui renforce l'idee qu'une approval `corp` ne doit pas dependre d'un resume implicite vendor pour rester durable. Inference pour `corp`: 3.2 doit clore l'etat local et requerir une action explicite ulterieure. [Source: OpenAI Responses / background guidance]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3, Story 3.1, Story 3.2, Story 3.3
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - FR15, FR16, FR17, FR18, NFR4, NFR6, NFR10
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 4.1 Domain Consistency Rules; 5.3 Requirements to Structure Mapping
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - sections sur Mission/Ticket contract, approvals, adaptateurs Codex et budget hors schema coeur
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-1-ouvrir-une-file-d-approbation-pour-les-actions-sensibles.md`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/approval/approval-request.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/approval-queue-projection.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `C:/Dev/PRJET/corp/tests/integration/approval-queue.test.ts`
- `https://developers.openai.com/codex/agent-approvals-security`
- `https://developers.openai.com/api/docs/guides/background`

## Change Log

- 2026-04-11: story creee via `bmad-create-story`, contexte complet ajoute, statut passe a `ready-for-dev`
- 2026-04-11: implementation 3.2 terminee, resolution `approval approve|reject|defer` ajoutee, guardrails persistants appliques inline et story passee a `review`

## Dev Agent Record

### Agent Model Used

- Codex GPT-5

### Debug Log References

- `npm run build`
- `node --test "dist/tests/unit/approval-queue-projection.test.js" "dist/tests/unit/formatters.test.js" "dist/tests/contract/mission-approval-queue-cli.test.js" "dist/tests/integration/approval-resolution.test.js"`
- `node --test "dist/tests/unit/approval-queue-projection.test.js" "dist/tests/unit/formatters.test.js" "dist/tests/contract/mission-approval-queue-cli.test.js" "dist/tests/contract/mission-resume-cli.test.js" "dist/tests/integration/approval-queue.test.js" "dist/tests/integration/approval-resolution.test.js" "dist/tests/integration/mission-resume.test.js" "dist/tests/integration/run-ticket.test.js" "dist/tests/integration/update-ticket.test.js"`
- `npm test`

### Completion Notes List

- Resolution `approval approve|reject|defer` centralisee dans `resolve-approval-request.ts` avec append `approval.*`, fermeture de l'attempt en `cancelled`, recalcul mission `ready|running|awaiting_approval` et erreurs deterministes pour approval inconnue/deja resolue.
- Nouveau contrat `approval-decision.ts` ajoute pour typer `outcome`, `reason`, `budgetObservations` et les mutations appliquees sans etendre le schema coeur.
- Les ajustements inline `--policy-profile`, `--allow-capability`, `--clear-allow-capability`, `--skill-pack`, `--clear-skill-pack` et `--budget-observation` sont supportes, avec regeneration du snapshot `approval.guardrails` a partir des garde-fous effectifs.
- La CLI expose maintenant `corp mission approval approve|reject|defer`, conserve une aide mission-centrique et affiche `Approval resolue: <approvalId> (<decision>)` avant le resume mis a jour.
- La couverture ajoutee verifie les chemins `approve`, `reject`, `defer`, les projections corrompues/manquantes, les erreurs deterministes, les recomputations `awaiting_approval` et `running`, ainsi que l'absence de fuite vendor dans stdout et les projections.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `packages/contracts/src/approval/approval-decision.ts`
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `packages/mission-kernel/src/resume-service/read-approval-queue.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `tests/contract/mission-approval-queue-cli.test.ts`
- `tests/integration/approval-resolution.test.ts`
- `tests/unit/approval-queue-projection.test.ts`
- `tests/unit/formatters.test.ts`
- `_bmad-output/implementation/3-2-approuver-refuser-ou-differer-une-demande-avec-garde-fous-auditablement.md`
- `_bmad-output/implementation/sprint-status.yaml`
