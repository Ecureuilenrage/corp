# Story 3.5: Comparer l'etat courant aux criteres de succes et relancer uniquement la partie impactee

Status: review

## Story

As a operateur technique,
I want comparer l'etat courant de la mission aux criteres de succes puis relancer uniquement la branche impactee,
so that je puisse reprendre la mission sans rejouer inutilement les tickets sains.

## Context

L'epic 3 dispose deja des briques qui rendent cette story realiste sans refonte:

- `corp mission status` et `corp mission resume` exposent deja objectif, criteres de succes, tickets ouverts, blocage connu, approvals en attente et prochaine action utile;
- `ticket-board.json` encode deja `dependsOn`, `runnable`, `blockedByTicketIds`, `dependencyStatuses`, `trackingState`, `statusReasonCode`, `blockingReasonCode` et les tentatives active/precedente;
- `runTicket(...)` est deja le seam canonique qui cree un `ExecutionAttempt`, reecrit les read models et applique les guards d'execution;
- `corp mission relaunch` existe deja, mais il relance aujourd'hui la mission a l'echelle globale et ne doit pas etre detourne pour une reprise ciblee.

Le vrai delta produit de 3.5 est donc limite et net:

1. l'operateur ne dispose d'aucune commande `corp mission compare` pour voir l'ecart entre l'objectif, les criteres de succes et l'etat observable de la mission;
2. aucune lecture read-side ne derive encore une "branche impactee" a partir du graphe de dependances et des statuts actuels;
3. la seule relance de mission disponible est globale, alors que l'AC demande une reprise bornee et auditable;
4. la comparaison doit rester structurelle et explicable: aucun LLM ne doit "evaluer" semantiquement les criteres de succes libres;
5. aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`; ne pas supposer de conventions de commit ou de hooks locaux.

### Delta explicite par rapport au code actuel

- `apps/corp-cli/src/commands/mission-command.ts` expose `status`, `resume`, `pause`, `relaunch`, `close`, `ticket`, `artifact`, `audit` et `approval`, mais pas `mission compare`.
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts` sait montrer l'objectif, les criteres de succes, le blocage connu et la prochaine action, mais pas un rendu `attendu vs observe` ni une branche de reprise ciblee.
- `packages/ticket-runtime/src/planner/build-ticket-board.ts` et `read-ticket-board.ts` calculent deja l'etat de dependance necessaire; il faut les reutiliser, pas recreer un deuxieme moteur de graphes.
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts` traite `mission.relaunched` a l'echelle mission entiere. Cette semantique doit rester intacte.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` sait deja rerunner un ticket en echec si la mission est en echec et empeche les tentatives concurrentes. C'est le seul seam acceptable pour creer une nouvelle tentative ciblee.
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` reecrit deja `mission-status`, `ticket-board`, `approval-queue`, `artifact-index`, `audit-log` et `resume-view`. Toute reprise ciblee doit rester coherente avec ce pipeline.
- `guide-utilisation.md` documente la relance globale, mais pas encore un flow `comparer puis relancer la branche impactee`.

### Decision de conception pour cette story

- Ajouter une commande read-only `corp mission compare --root <workspace> --mission-id <mission_id>`.
- Ajouter une commande d'action `corp mission compare relaunch --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id> [--background]`.
- Conserver `corp mission relaunch` comme relance globale de cycle de vie; ne pas l'etendre avec `--ticket-id`.
- Deriver l'ecart a partir de donnees locales et deterministes: objectif, criteres de succes, mission status, resume view, approval queue, ticket board, artefacts recents.
- Deriver la branche impactee a partir du graphe `dependsOn` du `ticket-board`: une racine actionable et les descendants concernes. En V1, une commande = une racine selectionnee.
- La relance ciblee ne doit creer une nouvelle `ExecutionAttempt` que pour la racine rerunnable. Les descendants restent inchanges jusqu'a ce que les dependances les rendent a nouveau executables.
- Si tous les tickets sont termines, la comparaison doit afficher `validation operateur requise` plutot que de declarer automatiquement les criteres de succes satisfaits.

## Acceptance Criteria

1. Given une mission contient au moins un ticket `failed`, `blocked` ou indirectement bloque par dependance
   When l'operateur lance `corp mission compare --mission-id <mission_id>`
   Then le systeme affiche un rendu explicite entre l'attendu (objectif + criteres de succes) et l'observe (etat mission, tickets, approvals, artefacts, blocage)
   And l'operateur peut identifier la branche de tickets a reevaluer ou a reprendre.

2. Given seul un sous-ensemble de la mission doit etre relance
   When la comparaison calcule la branche impactee
   Then la selection de racine et des tickets impactes est deterministe a partir du `ticket-board`, des dependances et des approvals
   And la sortie distingue clairement la racine rerunnable, les descendants impactes et les tickets non impactes.

3. Given l'operateur relance une branche impactee via `corp mission compare relaunch --ticket-id <ticket_id>`
   When le ticket selectionne est une racine rerunnable valide
   Then une nouvelle `ExecutionAttempt` est creee uniquement pour ce ticket
   And les tickets, approvals, artefacts et evenements non impactes restent inchanges et consultables.

4. Given l'operateur tente de relancer un ticket qui n'est pas une racine valide
   When le ticket est en attente d'approbation, encore bloque par dependance, deja en execution, ou seulement descendant d'un autre ticket en echec
   Then la commande echoue avec un message explicite
   And aucune mutation de mission, ticket, approval, artefact ou journal n'est produite.

5. Given une mission semble terminee ou qu'aucune branche rerunnable n'est disponible
   When l'operateur lance `corp mission compare`
   Then le systeme n'affirme pas semantiquement que les criteres de succes sont atteints
   And il indique soit une validation operateur requise, soit l'approbation/le blocage qui empeche toute relance ciblee.

6. Given les read models requis sont absents, stale ou corrompus
   When `corp mission compare` ou `corp mission compare relaunch` est execute
   Then le systeme reconstruit les vues locales necessaires depuis le journal et les snapshots fiables
   And la comparaison reste read-only tant qu'aucune relance n'est demandee.

7. Given la comparaison et la relance ciblee manipulent des executions via adaptateur
   When la CLI affiche le diagnostic ou la branche impactee
   Then aucun champ vendor interne (`adapterState`, `responseId`, `threadId`, `pollCursor`, `vendorStatus`, `requires_action`) n'est expose.

## Tasks / Subtasks

- [x] Definir le contrat produit de comparaison mission (AC: 1, 2, 5, 7)
  - [x] Ajouter un type de sortie stable pour l'attendu, l'observe, les gaps et la branche impactee; creer un contrat dedie dans `packages/contracts` seulement si cela clarifie reellement les frontieres.
  - [x] Modeliser explicitement `gaps[]`, `impactedBranch.rootTicketId`, `impactedBranch.impactedTicketIds[]`, `relaunchable`, `blockingReasons[]` et un indicateur `operatorValidationRequired`.
  - [x] Garder une surface publique sans donnees vendor ni payload brut.

- [x] Implementer la lecture read-side `compare` en reutilisant les vues existantes (AC: 1, 2, 5, 6, 7)
  - [x] Creer `packages/mission-kernel/src/resume-service/read-mission-compare.ts`.
  - [x] Reutiliser `readMissionResume(...)`, `readMissionStatus(...)`, `readApprovalQueue(...)`, `readMissionArtifacts(...)` et `readTicketBoard(...)` au lieu de reparcourir le workspace de facon ad hoc.
  - [x] Reconstruire les vues absentes ou stale selon le pattern deja utilise par `read-mission-resume.ts`.
  - [x] Produire un diagnostic purement local, deterministe et read-only.

- [x] Implementer l'algorithme de racine actionable et de branche impactee (AC: 1, 2, 4, 5)
  - [x] Utiliser `dependsOn`, `blockedByTicketIds`, `dependencyStatuses`, `trackingState`, `statusReasonCode` et `blockingReasonCode` du `ticket-board`.
  - [x] Rendre rerunnable un ticket `failed` ou `blocked` seulement si aucune dependance ni approval ne le bloque encore et qu'aucune tentative active n'existe.
  - [x] Refuser la relance directe d'un ticket descendant si la vraie cause se trouve en amont; guider l'operateur vers la racine correcte.
  - [x] Si tous les tickets sont `done`, remonter un diagnostic `validation operateur requise` sans relance automatique.
- [x] Implementer la relance ciblee sans casser la relance globale (AC: 3, 4, 6)
  - [x] Creer `packages/mission-kernel/src/mission-service/relaunch-impacted-branch.ts` (ou nom equivalent) pour valider la racine, verifier l'etat mission et deleguer a `runTicket(...)`.
  - [x] Reutiliser les guards de cycle de vie existants si la mission doit quitter un etat `failed`, `blocked` ou `awaiting_approval`, sans changer la semantique de `corp mission relaunch`.
  - [x] Faire transiter toute nouvelle tentative par `runTicket(...)` afin de conserver les guards existants et la reecriture centrale des read models.
  - [x] Garantir qu'une relance ciblee n'efface ni approval ni artefact ni historique hors branche.

- [x] Exposer la surface CLI et la documentation (AC: 1, 2, 3, 4, 5, 7)
  - [x] Etendre `apps/corp-cli/src/commands/mission-command.ts` avec `mission compare` et `mission compare relaunch`.
  - [x] Ajouter `apps/corp-cli/src/formatters/mission-compare-formatter.ts` pour un rendu lisible `attendu / observe / gaps / branche impactee`.
  - [x] Mettre a jour `apps/corp-cli/src/formatters/help-formatter.ts`.
  - [x] Mettre a jour `C:/Dev/PRJET/corp/guide-utilisation.md` avec les nouveaux exemples et la difference entre relance globale et relance ciblee.

- [x] Couvrir la story par des tests deterministes et hors reseau (AC: 1 a 7)
  - [x] Ajouter `tests/contract/mission-compare-cli.test.ts` pour la surface CLI, l'aide et les erreurs d'arguments.
  - [x] Ajouter `tests/integration/mission-compare.test.ts` pour le diagnostic, les racines rerunnables, les rejections et la relance d'une seule branche.
  - [x] Etendre les tests existants autour de `run-ticket`, `ticket-board`, `resume` et `approval` si un comportement shared est touche.
  - [x] Verifier explicitement l'absence de mutation lors de `compare` seul et l'absence de fuite vendor dans toutes les sorties.

## Dev Notes

### Story Intent

Cette story ne doit pas inventer un `juge intelligent` des criteres de succes. Le but est d'aider l'operateur a comparer ce qui etait attendu a ce qui est observable dans le systeme, puis a reprendre proprement la partie du graphe qui est reellement impactee.

Le livrable attendu est donc double:
- une lecture de diagnostic structurante et explicable;
- une action de relance ciblee bornee, auditable et compatible avec les garde-fous existants.

Si la solution rejoue toute la mission, bypass `runTicket(...)`, ou deduit semantiquement que les criteres sont `atteints` sans validation operateur, alors la story rate sa cible.

### Current Project State

- `apps/corp-cli/src/commands/mission-command.ts` contient deja la plupart des commandes mission-side, dont `status`, `resume`, `relaunch`, `ticket`, `artifact`, `audit` et `approval`.
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts` expose deja objectif, criteres de succes, blocage, approvals, dernier artefact, dernier evenement et prochaine action.
- `apps/corp-cli/src/formatters/mission-status-formatter.ts` compose deja `formatMissionResume(...)` et `formatTicketBoard(...)`.
- `packages/contracts/src/mission/mission.ts` porte `successCriteria: string[]`.
- `packages/contracts/src/mission/mission-resume.ts` porte deja les donnees read-side utiles, notamment `successCriteria`, `lastKnownBlockage` et `nextOperatorAction`.
- `packages/journal/src/projections/ticket-board-projection.ts` encode deja les relations de dependances et l'etat de runnability.
- `packages/ticket-runtime/src/planner/build-ticket-board.ts` est le coeur actuel de derivation des blocages, dependances et racines.
- `packages/ticket-runtime/src/planner/read-ticket-board.ts` sait deja reconstruire `ticket-board.json` si la projection manque ou est stale.
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` applique deja le pattern de lecture resiliente.
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts` traite `relaunch` a l'echelle mission entiere.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` est le seul seam de creation de tentative et doit le rester.
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` reecrit les read models mission apres mutation.
- `guide-utilisation.md` documente la relance globale actuelle.

### Root Selection Rules

Utiliser des regles de selection simples, auditablement explicables et compatibles avec le `ticket-board`:

- ticket `failed` + dependances satisfaites + aucune tentative active = racine relaunchable candidate;
- ticket `blocked` avec cause locale explicite = candidat seulement si le blocage n'est plus une dependance ni une approval en attente;
- ticket avec approval en attente ou `awaiting_approval` = visible dans la branche, mais non relaunchable tant que l'approval n'est pas resolue;
- ticket dont le `statusReasonCode` ou `blockingReasonCode` indique une cause amont (`dependency_failed`, `dependency_pending`, `dependency_cancelled`, `dependency_missing`) = pas une racine; il faut remonter vers l'ancetre causal;
- ticket `done` ou `cancelled` = jamais racine rerunnable en V1.

En cas d'ambiguite entre plusieurs causes, preferer une erreur deterministe et explicite plutot qu'une relance implicite de plusieurs branches.

### Recommended Gap And Branch Shape

Le rendu `compare` doit etre court, deterministe et exploitable. Une structure de sortie recommande ressemble a ceci:

```json
{
  "missionId": "mission_demo",
  "expected": {
    "objective": "Completer la mission",
    "successCriteria": [
      "Tous les tickets critiques sont traites",
      "Les validations sensibles sont resolues"
    ]
  },
  "observed": {
    "missionStatus": "failed",
    "lastKnownBlockage": "Le ticket ticket_codegen a echoue",
    "pendingApprovalCount": 0,
    "openTicketIds": ["ticket_codegen", "ticket_publish"],
    "nextOperatorAction": "Diagnostiquez la cause puis relancez ou cloturez."
  },
  "gaps": [
    {
      "code": "ticket_failed",
      "summary": "Un ticket critique a echoue",
      "ticketId": "ticket_codegen"
    }
  ],
  "impactedBranch": {
    "rootTicketId": "ticket_codegen",
    "impactedTicketIds": ["ticket_codegen", "ticket_publish"],
    "relaunchable": true,
    "blockingReasons": []
  },
  "operatorValidationRequired": false
}
```

Invariants a conserver:

- `compare` ne deduit pas qu'un critere libre est `satisfait` uniquement parce que tous les tickets sont `done`;
- `impactedTicketIds` est derive du graphe `dependsOn`, pas d'un tri opportuniste sur les tickets ouverts;
- la relance n'utilise qu'une racine actionable a la fois;
- les descendants impactes sont listes pour le diagnostic, pas relances de force en cascade;
- si une approbation bloque encore la branche, `relaunchable=false` et la raison doit etre lisible.

### Architecture Compliance

- Le journal append-only et les projections locales restent la source de verite read-side. [Source: architecture.md - 3.9 Journal and Projection Model]
- Une transition write-side doit produire ses evenements puis reecrire les vues; `compare` seul ne doit rien emettre. [Source: architecture.md - 4.1 Domain Consistency Rules]
- Les details vendor doivent rester confines a `adapterState` et ne jamais fuiter dans la surface CLI. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- La strategie d'execution est graphe de tickets + une tentative active max par ticket; la reprise doit rester ticket-centric, pas mission-wide par defaut. [Source: architecture.md - 3.5 Execution Strategy]
- La CLI `corp` reste l'interface operateur; la logique metier de comparaison et relance ciblee doit vivre dans les services, pas dans les formatters. [Source: architecture.md - 5.2 / 5.3]

### Previous Story Intelligence

- Story 1.4 a deja fixe la semantique de `corp mission relaunch` comme reprise globale de cycle de vie. Ne pas la casser ni l'ambiguiser avec un `--ticket-id`.
- Story 2.3 a etabli que `runTicket(...)` est le seam canonique de creation d'une tentative et qu'il gere deja les guards essentiels (`mission failed`, tentative active, adaptateur prioritaire).
- Story 2.4 a deja construit `ticket-board` comme representation canonique des dependances, blocages et tickets runnables. Reprendre cette logique au lieu de recalculer un graphe parallele.
- Story 3.3 a montre le pattern attendu pour une lecture resiliente et strictement read-only basee sur les projections locales et leur reconstruction.
- Story 3.4 a renforce une discipline cle: aucune fuite vendor dans les sorties CLI, projections ou artefacts lisibles par l'operateur.
- Le code actuel sait deja conserver les artefacts, approvals et evenements non impactes; la story 3.5 doit exploiter cette inertie au lieu de reinitialiser la mission.

### Implementation Guardrails

- Ne pas surcharger `corp mission relaunch` avec `--ticket-id`; la relance ciblee doit vivre sous `corp mission compare relaunch`.
- Ne pas introduire de comparaison semantique LLM ou d'evaluation automatique du texte libre des criteres de succes.
- Ne pas bypass `runTicket(...)`, `readTicketBoard(...)` ou `rewriteMissionReadModels(...)`.
- Ne pas creer de nouvelle tentative pour tous les tickets impactes; une relance ciblee V1 ne lance que la racine selectionnee.
- Ne pas effacer, clore ou reinitialiser les approvals, artefacts, audits ou evenements hors branche.
- Ne pas emettre d'evenement de lecture type `mission.compared`.
- Ne pas exposer `adapterState`, `responseId`, `threadId`, `pollCursor`, `vendorStatus` ou equivalent dans le contrat, la CLI ou les tests snapshots.
- Ne pas modifier `dist/` manuellement et ne pas ajouter de dependance npm externe.
- Garder les nouveaux fichiers en ASCII et les noms de modules en `kebab-case`.
- Si un ticket est bloque par approval ou dependance, guider l'operateur vers la cause amont plutot que d'autoriser une relance trompeuse.

### File Structure Requirements

**CLI**
- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/mission-compare-formatter.ts` (nouveau)
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/guide-utilisation.md`

**Mission kernel / read-side**
- `packages/mission-kernel/src/resume-service/read-mission-compare.ts` (nouveau)
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/mission-kernel/src/resume-service/read-mission-status.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts` (a reutiliser si utile pour enrichir le diagnostic)

**Mission kernel / write-side**
- `packages/mission-kernel/src/mission-service/relaunch-impacted-branch.ts` (nouveau ou equivalent)
- `packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts` (ne pas changer la relance globale, eventuellement partager des guards communs)

**Planner / runtime**
- `packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`

**Contracts**
- `packages/contracts/src/mission/mission.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/contracts/src/ticket/ticket.ts`
- Ajouter un contrat dedie `mission-compare.ts` seulement si cela clarifie vraiment les frontieres inter-packages.

**Tests**
- `tests/contract/mission-compare-cli.test.ts` (nouveau)
- `tests/integration/mission-compare.test.ts` (nouveau)
- `tests/integration/run-ticket.test.ts`
- `tests/integration/approval-resolution.test.ts`
- `tests/unit/formatters.test.ts`
- `tests/unit/ticket-board.test.ts` si la logique de branche est factorisee au niveau planner

### Testing Requirements

- Conserver `node:test` et `assert/strict`; ne pas introduire Jest/Vitest.
- Garder tous les tests hors reseau et reutiliser la DI/dependances de test existantes.
- Verifier qu'un `compare` pur ne modifie ni `events.jsonl` ni les snapshots mission.
- Verifier la reconstruction quand `ticket-board.json`, `resume-view.json` ou une vue derivee de compare est absente/stale/corrompue.
- Verifier un cas `failed` simple: la racine en echec est rerunnable, les descendants sont listes comme impactes.
- Verifier un cas `approval pending`: la branche est visible mais non relaunchable tant que l'approbation n'est pas resolue.
- Verifier un cas `dependency_failed` ou `dependency_pending`: la relance directe du descendant est refusee avec indication de la vraie racine amont.
- Verifier un cas `tous les tickets done`: `operatorValidationRequired=true`, aucun auto-success semantique, aucune relance proposee.
- Verifier qu'une relance ciblee cree une nouvelle tentative uniquement pour la racine choisie et laisse le reste intact.
- Verifier que la surface CLI n'expose jamais `adapterState`, `responseId`, `threadId`, `pollCursor`, `vendorStatus` ou `requires_action`.

### Scope Exclusions

- Evaluation semantique automatique du texte libre des criteres de succes
- Relance de plusieurs racines en une seule commande
- Replanification automatique du graphe complet
- TUI ou interface graphique de diagnostic
- Export machine JSON public si la CLI formatee suffit pour V1
- Mutation implicite de la mission lors d'un simple `compare`
- Reprise d'une execution vendor a partir d'un handle externe hors des read models locaux

### Assumptions

- Le graphe `dependsOn` du `ticket-board` reste la source la plus fiable pour calculer la branche impactee.
- Une branche impactee peut etre representee en V1 par une racine actionable et ses descendants dependants.
- La validation finale des criteres de succes reste une responsabilite operateur meme si toutes les vues read-side semblent au vert.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-12: la page modele `GPT-5-Codex` confirme une disponibilite via la `Responses API` uniquement. Inference produit: la relance ciblee doit rester branchee sur l'adaptateur et les services existants, sans introduire de chemin vendor parallele dans `corp`. [Source: https://developers.openai.com/api/docs/models/gpt-5-codex]
- Verification officielle OpenAI le 2026-04-12: la doc `Agent approvals & security` de Codex expose des modes runtime comme `read-only`, `workspace-write`, `on-request`, `never` et `danger-full-access`. Inference produit: ces controles d'execution ne remplacent pas les approvals et garde-fous metier de `corp`; la branche impactee doit etre calculee depuis l'etat local mission/ticket/approval. [Source: https://developers.openai.com/codex/agent-approvals-security]
- Verification officielle OpenAI le 2026-04-12: la doc `Background mode guide` rappelle qu'un traitement background conserve un contexte vendor pour une duree bornee (ordre de grandeur ~10 minutes pour les reponses stockees). Inference produit: la reprise `corp` ne doit jamais dependre d'une continuation vendor fragile; l'etat de relance doit rester entierement reconstructible depuis le workspace local. [Source: https://developers.openai.com/api/docs/guides/background]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 3, Story 3.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - FR22, FR23, NFR6, NFR11, NFR13
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4, 3.5, 3.9, 4.1, 5.2, 5.3
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-4-suivre-l-avancement-et-les-blocages-d-un-ticket-depuis-la-mission.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-3-reprendre-une-mission-interrompue-a-partir-d-un-resume-fiable.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/3-4-consulter-un-journal-d-audit-structure-et-l-origine-de-chaque-sortie.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/execution-attempt/execution-attempt.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/update-mission-lifecycle.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `https://developers.openai.com/api/docs/models/gpt-5-codex`
- `https://developers.openai.com/codex/agent-approvals-security`
- `https://developers.openai.com/api/docs/guides/background`

## Change Log

- 2026-04-12: story creee via `bmad-create-story`, contexte complet ajoute, guardrails, references et contraintes formalises, statut passe a `ready-for-dev`.
- 2026-04-12: ajout du contrat `mission-compare`, du diagnostic read-only `corp mission compare`, de la relance ciblee `corp mission compare relaunch`, de la reconstruction resiliente des projections et de la couverture de tests associee.

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `npm run build`
- `node --test "dist/tests/contract/mission-ticket-run-cli.test.js" "dist/tests/contract/mission-compare-cli.test.js" "dist/tests/integration/mission-compare.test.js" "dist/tests/unit/formatters.test.js"`
- `npm test`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Contrat `packages/contracts/src/mission/mission-compare.ts` ajoute pour serialiser l'attendu, l'observe, les gaps, la branche impactee et `operatorValidationRequired` sans fuite vendor.
- `read-mission-compare.ts` derive la branche impactee depuis `ticket-board`, reconstruit les vues absentes/corrompues pour `compare`, et garde le diagnostic strictement read-only.
- `relaunch-impacted-branch.ts` valide la racine selectionnee, refuse les descendants/approvals encore pendings, reutilise les guards lifecycle existants et cree une seule nouvelle tentative via `runTicket(...)`.
- La CLI et la documentation exposent `corp mission compare` / `corp mission compare relaunch`, avec distinction explicite vis-a-vis de `corp mission relaunch`.
- Les tests couvrent le diagnostic failed, l'approval pending non relaunchable, le refus d'un descendant, la validation operateur requise, la reconstruction des projections et la relance d'une seule branche.

### File List

- apps/corp-cli/src/commands/mission-command.ts
- apps/corp-cli/src/formatters/help-formatter.ts
- apps/corp-cli/src/formatters/mission-compare-formatter.ts
- guide-utilisation.md
- packages/contracts/src/mission/mission-compare.ts
- packages/mission-kernel/src/mission-service/relaunch-impacted-branch.ts
- packages/mission-kernel/src/resume-service/read-approval-queue.ts
- packages/mission-kernel/src/resume-service/read-mission-artifacts.ts
- packages/mission-kernel/src/resume-service/read-mission-compare.ts
- packages/mission-kernel/src/resume-service/read-mission-resume.ts
- packages/ticket-runtime/src/planner/read-ticket-board.ts
- packages/ticket-runtime/src/ticket-service/run-ticket.ts
- tests/contract/mission-compare-cli.test.ts
- tests/contract/mission-ticket-run-cli.test.ts
- tests/integration/mission-compare.test.ts
- tests/unit/formatters.test.ts

