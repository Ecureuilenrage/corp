---
title: "Architecture: corp V1"
status: complete
created: 2026-04-08
updated: 2026-04-08
workflowType: architecture
projectName: corp
author: darkl
date: 2026-04-08
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
inputDocuments:
  - C:/Dev/PRJET/corp/_bmad/bmm/config.yaml
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp-distillate.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/prd.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md
  - C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b01-core-bootstrap-session-loop.md
  - C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b04-agent-orchestration.md
  - C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/reuse/reuse-candidates.md
  - C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-03-gateway-control-plane.md
  - C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-04-plugin-platform-sdk.md
  - C:/Dev/PRJET/Openclaw/openclaw-main/analysis/reuse/reuse-candidates.md
  - C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/batches/02-agent-orchestration.md
  - C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/reuse/reuse-candidates.md
  - C:/Dev/PRJET/chatdev/ChatDev-main/analysis/batches/02-workflow-orchestration.md
  - C:/Dev/PRJET/chatdev/ChatDev-main/analysis/reuse/reuse-candidates.md
webSources:
  - https://developers.openai.com/api/docs/models/gpt-5-codex
  - https://developers.openai.com/api/docs/guides/background
  - https://developers.openai.com/api/reference/overview
  - https://developers.openai.com/codex/noninteractive
  - https://developers.openai.com/codex/sdk
  - https://developers.openai.com/codex/mcp
  - https://developers.openai.com/codex/skills
  - https://developers.openai.com/codex/plugins
  - https://developers.openai.com/codex/agent-approvals-security
assumptions:
  - "La demande de cette fenetre vaut validation explicite pour mener l'etape BMAD d'architecture jusqu'a l'artefact final, sans sous-pauses A/P/C intermediaires."
  - "Le premier bootstrap technique V1 sera plus robuste avec une pile TypeScript serveur sur Node.js LTS, sans figer encore les versions d'implementation."
  - "Le stockage local V1 utilisera un journal append-only et au moins une projection locale embarquee; le choix exact de la technologie de projection reste a figer au bootstrap."
  - "Quand un projet n'est pas dans un depot Git exploitable, l'isolation par ticket basculera sur un workspace dedie equivalent plutot que sur un worktree Git."
completedAt: 2026-04-08
---

# Architecture Decision Document - corp V1

## Resume executif

L'architecture V1 de `corp` doit rester strictement centree sur un noyau de mission persistante pilote par tickets, et non sur un shell vendor, un moteur de graphes generaliste, ou une copie d'orchestrateur existant. Le coeur produit recommande est compose de quatre primitives proprietaires: `Mission`, `Ticket`, `Journal`, `Isolation`.

Cette architecture reprend les signaux les plus solides des sources:

- Claude Code B04 pour la task list persistante, l'ownership, le blocking graph, le protocole d'approbation et l'isolation worktree.
- OpenClaw pour l'enveloppe de requete, les aides d'identite/session et les frontieres de registration.
- MetaGPT pour le shell `Team / Role / Action / Planner`, mais sans reprendre sa "software company".
- ChatDev pour le contrat message/artefact et la separation orchestration/execution, sans reprendre son moteur YAML complet.

Le runtime externe cible reste `Codex`, avec `Responses API` comme adaptateur prioritaire V1. Les details OpenAI/Codex doivent rester hors du schema coeur et vivre dans `execution_handle.adapter_state`.

## 1. Project Context Analysis

### Requirements Overview

**Fonctionnels**

Le PRD groupe les besoins V1 en six blocs architecturaux:

- cycle de vie mission/session: creation, reprise, pause, cloture, relance;
- planification et delegation: decomposition en tickets, dependances, ownership, contraintes;
- execution et flux d'artefacts: lancement, suivi, collecte, liaison evenement -> artefact -> ticket;
- supervision humaine: approbations, refus, budgets/garde-fous, arbitrage operateur;
- reprise et auditabilite: journal structure, reprise bornee, diagnostic;
- extension minimale: tools, skills, plugins/MCP ou canaux strictement necessaires au pilote.

**Non fonctionnels**

Les contraintes structurantes, deja confirmees par le brief, le PRD et la recherche technique, sont:

- local-first;
- mono-operateur en V1;
- supervision humaine sur les actions sensibles;
- surface operateur V1 = CLI;
- support de plusieurs taches paralleles sur le meme projet;
- etat durable lisible hors transcript brut;
- granularite tres fine des `event_ids` et `artifact_ids`;
- `resource_budget` hors schema coeur V1;
- dependance Codex = API-first, CLI-available, surfaces Codex-native optionnelles.

### Scale & Complexity

- Domaine principal: backend orchestration local-first avec CLI operateur.
- Niveau de complexite: eleve.
- Nature du produit: noyau d'execution et de gouvernance, pas simple assistant conversationnel.
- Principaux concerns transverses: identite stable, reprise, journalisation, isolation, approbation, frontiere d'extension, normalisation multi-adaptateurs.

### Technical Constraints & Dependencies

- `corp` ne doit pas faire reposer son coeur produit sur Claude Code.
- `corp` doit pouvoir orchestrer plusieurs tickets paralleles sur un meme projet avec isolation forte.
- Les details Codex doivent rester remplacables via adaptateurs.
- Les extensions V1 doivent etre declaratives et testables sans host geant.
- Le pilote V1 doit rester borne a une boucle exploitable, pas a une plateforme exhaustive.

### Cross-Cutting Concerns Identified

- la reprise n'est credible que si l'etat utile est materialise;
- l'audit n'est credible que si chaque mutation passe par un journal fin;
- le parallele n'est credible que si l'isolation par ticket est explicite;
- l'extensibilite n'est credible que si les seams sont petits, testables et non intrusifs;
- l'integration Codex n'est saine que si le coeur `corp` n'absorbe pas les contrats vendor.

## 2. Starter Template Evaluation

### Decision

**Aucun starter monolithique n'est retenu comme base d'architecture V1.**

### Rationale for Selection

Cette decision est volontaire:

- le centre de gravite V1 est un `mission kernel` + `ticket runtime` persistant, pas une application web CRUD ni une CLI lineaire;
- aucun starter standard n'apporte les invariants critiques de `corp`: journal fin, isolation par ticket, projection de reprise, adaptateurs d'execution, frontiere skill/capability;
- choisir trop tot un starter applicatif risquerait de figer de mauvaises frontieres avant meme d'avoir protege le contrat coeur.

### Technical Baseline Conserved

Sans basculer en implementation, l'architecture retient seulement ces bornes:

- pile serveur recommandee: TypeScript sur Node.js LTS;
- justification: les seams les plus reutilisables des analyses Claude/OpenClaw sont TypeScript, et le Codex SDK officiel requiert Node.js 18 ou plus;
- position BMAD: le premier story de bootstrap devra creer un workspace minimal et non imposer une architecture par framework.

### Consequence

Le prochain artefact BMAD n'est pas "generer le code" mais "decouper en epics/stories" sur la base des modules ci-dessous. Le bootstrap technique n'est qu'une sous-consequence de l'architecture, pas son point de depart.

## 3. Core Architectural Decisions

### 3.1 Decision Table

| Domaine | Decision proposee | Statut | Evidence principale |
| --- | --- | --- | --- |
| Centre de gravite | `Mission kernel` + `ticket runtime` persistant | Confirme | Brief, PRD, recherche technique |
| Contrat coeur | `Mission + Ticket`, details Codex en `execution_handle.adapter_state` | Confirme | Recherche technique, arbitrages utilisateur |
| Surface operateur | CLI `corp` | Confirme | Brief, PRD, arbitrages utilisateur |
| Runtime externe | `Responses API` prioritaire; `codex exec` et SDK secondaires | Confirme | Arbitrages utilisateur + docs OpenAI/Codex |
| Long runs | `background=true` accepte pour les taches longues | Confirme | Arbitrages utilisateur + docs officielles |
| Frontiere extension | `ExecutionAdapter + CapabilityRegistry + SkillPack` | Confirme | Recherche technique, arbitrages utilisateur |
| Isolation parallele | worktree Git par ticket quand possible, sinon workspace dedie equivalent | Proposee forte | Claude B04 + arbitrage utilisateur |
| Journal | append-only, fin, type "boite noire d'avion" | Confirme | PRD, arbitrages utilisateur |
| Budget | `resource_budget` hors schema coeur; seulement journal/evenements/projections | Confirme | Arbitrages utilisateur |
| Workflow engine | petit graphe de dependances `depends_on[]`, pas de moteur YAML generaliste V1 | Proposee forte | PRD + recherche technique + ChatDev reuse |

### 3.2 Product Primitives

Les trois labels produits sont convertis en primitives architecturelles claires:

- `KAIROS`: couche de continuite operateur. Elle fournit resume, reprise, lecture du prochain point de decision et contexte de mission recentre.
- `ULTRAPLAN`: service de planification evolutive qui cree et reordonne les tickets, sans devenir un moteur de graphes generaliste V1.
- `COORDINATOR MODE`: boucle d'orchestration qui planifie, claim, execute, bloque, relance et soumet a approbation.

Dans V1, ces trois notions vivent dans le meme produit et le meme noyau. Elles ne deviennent pas encore trois runtimes distincts.

### 3.3 Canonical Domain Contract

Le contrat coeur recommande est volontairement petit.

#### Mission

Responsabilites:

- porte l'objectif operateur et les criteres de succes;
- porte le statut global et les policies par defaut;
- indexe les tickets, artefacts et evenements;
- fournit le point de reprise operateur.

Champs minimaux recommandes:

```json
{
  "id": "mission_...",
  "title": "string",
  "objective": "string",
  "status": "draft|ready|running|blocked|awaiting_approval|completed|failed|cancelled",
  "successCriteria": ["string"],
  "policyProfileId": "policy_profile_...",
  "ticketIds": ["ticket_..."],
  "artifactIds": ["artifact_..."],
  "eventIds": ["event_..."],
  "resumeCursor": "event_...",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### Ticket

Responsabilites:

- represente l'unite de travail delegable et relancable;
- porte ownership, dependances, criteres de succes, contraintes, isolement;
- reference un ou plusieurs `execution_attempts`.

Champs minimaux recommandes:

```json
{
  "id": "ticket_...",
  "missionId": "mission_...",
  "kind": "research|plan|implement|review|operate",
  "goal": "string",
  "status": "todo|claimed|in_progress|blocked|awaiting_approval|done|failed|cancelled",
  "owner": "role_or_agent_id",
  "dependsOn": ["ticket_..."],
  "successCriteria": ["string"],
  "allowedCapabilities": ["cap_..."],
  "skillPackRefs": ["skill_..."],
  "workspaceIsolationId": "iso_...",
  "executionHandle": {
    "adapter": "codex_responses|codex_exec|codex_sdk",
    "adapterState": {}
  },
  "artifactIds": ["artifact_..."],
  "eventIds": ["event_..."],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### ExecutionAttempt

Cette sous-entite est necessaire pour rendre le journal vraiment utile.

Responsabilites:

- distinguer plusieurs essais d'un meme ticket;
- capter l'etat de run, le curseur de reprise, les IDs vendor et les metadonnees de polling/streaming;
- relier chaque artefact et evenement a un essai concret.

Champs minimaux recommandes:

```json
{
  "id": "attempt_...",
  "ticketId": "ticket_...",
  "adapter": "codex_responses|codex_exec|codex_sdk",
  "status": "requested|running|awaiting_approval|completed|failed|cancelled",
  "adapterState": {},
  "startedAt": "timestamp",
  "endedAt": "timestamp|null"
}
```

#### Event

Le journal V1 est la source de verite d'audit.

Regles:

- granularite fine obligatoire;
- un evenement par transition significative;
- evenement toujours relie a `mission_id`, `ticket_id` et, si pertinent, `attempt_id`, `artifact_id`, `approval_id`;
- IDs opaques, triables temporellement si possible;
- conservation append-only.

Exemples d'evenements V1:

- `mission.created`
- `mission.resume_requested`
- `ticket.created`
- `ticket.claimed`
- `ticket.blocked`
- `execution.requested`
- `execution.background_started`
- `execution.polled`
- `execution.completed`
- `execution.failed`
- `approval.requested`
- `approval.approved`
- `approval.rejected`
- `artifact.detected`
- `artifact.registered`
- `workspace.isolation_created`
- `workspace.isolation_retained`
- `capability.invoked`
- `budget.observed`
- `budget.threshold_exceeded`

#### Artifact

Responsabilites:

- representer toute sortie utile et consultable;
- relier une sortie au ticket, a la tentative, a l'evenement source et au workspace;
- rester exploitable meme si le transcript est perdu.

Exemples:

- fichier cree ou modifie;
- diff local;
- rapport structure;
- resume intermediaire;
- sortie JSON schema-validee;
- transcript d'approbation;
- pointeur vers response finale vendor.

### 3.4 Architectural Rule About Vendor Data

**Aucun identifiant OpenAI/Codex ne doit sortir de `execution_handle.adapter_state` ou d'un `ExecutionAttempt`.**

Implications:

- pas de `threadId`, `response_id`, `session_id` ou equivalent dans `Mission` ou `Ticket`;
- pas de fuite des flags CLI ou des details JSONL dans le contrat coeur;
- `corp` reste libre de remplacer ou d'ajouter des adaptateurs sans re-schema du noyau.

### 3.5 Execution Strategy

Le V1 doit utiliser un ordonnanceur simple et robuste:

- petit graphe de tickets via `depends_on[]`;
- plusieurs tickets executables en parallele si dependances resolues et isolation disponible;
- une tentative active maximum par ticket a un instant donne en V1;
- reprise prioritairement par ticket, pas par mission entiere;
- pas de DSL workflow complet en V1.

### 3.6 Codex Integration Boundary

#### Primary adapter: Responses API

Justification officielle:

- la doc modele officielle confirme que `GPT-5-Codex` est disponible dans la `Responses API` uniquement;
- `background=true` est documente pour les runs longs, avec polling sur les statuts `queued` et `in_progress`;
- la doc d'authentification officielle confirme que l'API OpenAI utilise des API keys en Bearer auth, avec headers `OpenAI-Organization` et `OpenAI-Project` si necessaire.

Decision:

- `Responses API` est l'adaptateur de reference V1;
- `corp` doit parler a OpenAI via API key serveur/locale, jamais via un OAuth imagine pour l'API OpenAI;
- `background=true` est autorise seulement pour les tickets longs, car il stocke les donnees de reponse environ 10 minutes et n'est pas compatible ZDR.

#### Secondary adapters accepted

- `codex exec --json`
  - utile pour automatisation locale et CI;
  - expose un flux JSONL d'evenements et supporte `resume`.
- `Codex SDK`
  - controle programmatique plus flexible que le mode non interactif;
  - permet `startThread()` puis `resumeThread(threadId)`;
  - impose une pile Node.js 18+.

#### Optional Codex-native surfaces

- `skills`
- `plugins`
- `MCP`
- `AGENTS.md`

Ces surfaces peuvent accelerer des usages, mais elles ne sont pas des primitives coeur `corp`.

### 3.7 Authentication Clarification

Point volontairement precis:

- pour l'API OpenAI utilisee par `Responses API`, le mecanisme officiel documente est l'API key via `Authorization: Bearer ...`;
- la documentation Codex MCP mentionne une authentification OAuth pour certains serveurs MCP via `codex mcp login <server-name>`;
- cette OAuth MCP ne doit pas etre confondue avec l'authentification de `corp` a l'API OpenAI;
- V1 ne doit donc pas supposer un "OAuth Codex/OpenAI" pour les appels `Responses API`.

Conclusion d'architecture:

- auth OpenAI V1 = secret operateur / secret de service local;
- auth MCP externe = concern du serveur MCP, hors coeur `corp`.

### 3.8 Isolation Strategy for Parallel Tickets

Decision recommandee:

- **isolation Git worktree par ticket** quand le projet cible vit dans un depot Git;
- **workspace dedie equivalent** sinon.

Justification:

- Claude B04 montre que l'isolation worktree par agent est la meilleure brique pour limiter collisions et permettre cleanup conditionnel;
- le pilote V1 doit supporter plusieurs tickets paralleles sur le meme projet;
- l'audit devient plus lisible quand chaque ticket possede son propre espace de mutation.

Regles:

- un ticket mutateur n'ecrit jamais directement dans le workspace principal;
- l'espace d'isolation est cree avant execution, journalise, et conserve si des changements existent;
- le merge/reconciliation ne fait pas partie du coeur V1 automatique: il passe par une decision operateur ou un story specifique ulterieur.

### 3.9 Journal and Projection Model

Le journal fin est obligatoire, mais les commandes operateur ont besoin de lectures rapides. L'architecture recommande donc:

- un **journal append-only** pour la verite d'audit;
- des **projections locales** pour `mission status`, `approval queue`, `ticket board`, `artifact index`, `resume view`.

Regle importante:

- `resource_budget` ne vit que dans le journal et, si necessaire, dans les projections calculees;
- il n'existe pas comme champ de schema coeur sur `Mission` ou `Ticket`.

### 3.10 Five-Layer Target Architecture

```text
corp CLI
  -> Coordinator Application Services
    -> Mission Kernel + Ticket Runtime
      -> Event / Approval / Artifact Journal
        -> ExecutionAdapter + CapabilityRegistry + SkillPack
          -> Workspace Isolation + Local Storage + Codex / MCP / Local Tools
```

Responsabilites:

1. `corp CLI`
   - interface operateur;
   - create/reprise/plan/run/status/audit/approve.
2. `Coordinator Application Services`
   - orchestre la boucle produit;
   - ne contient pas de details vendor.
3. `Mission Kernel + Ticket Runtime`
   - schema coeur, statuts, dependances, ownership, reprise.
4. `Journal`
   - append-only, trace fine, projections de lecture.
5. `Adapters and Extensions`
   - execution externe, capabilities, skills, MCP, workspace isolation.

## 4. Implementation Patterns & Consistency Rules

Cette section ne force pas encore l'implementation; elle empeche surtout les futurs agents de diverger.

### 4.1 Domain Consistency Rules

Tous les agents devront respecter les invariants suivants:

- un `Ticket` n'existe jamais sans `Mission`;
- toute transition de statut doit produire un evenement avant toute projection;
- tout artefact doit referencer l'evenement producteur;
- toute tentative vendor doit etre encapsulee dans `ExecutionAttempt`;
- aucun champ vendor ne doit fuiter hors `adapterState`;
- aucune action sensible ne doit s'executer sans `ApprovalRequest` resolue si la policy le demande;
- toute execution mutatrice doit posseder une isolation de workspace explicite;
- le journal est source de verite; les vues de lecture sont reconstruisibles.

### 4.2 Naming Patterns

**IDs**

- `mission_*`
- `ticket_*`
- `attempt_*`
- `event_*`
- `artifact_*`
- `approval_*`
- `cap_*`
- `skill_*`
- `iso_*`

**Event types**

- pattern recommande: `domain.action`
- exemples: `ticket.claimed`, `approval.requested`, `artifact.registered`

**Module names**

- dossiers en `kebab-case`;
- types/metiers en `PascalCase`;
- fonctions et champs de code en `camelCase`.

### 4.3 Format Patterns

**Journal**

- format logique: un evenement = un enregistrement immutable;
- horodatage obligatoire;
- correlation minimale: `missionId`, `ticketId`, `attemptId?`, `eventId`, `actor`, `source`.

**Approvals**

- `requested -> approved|rejected|expired|cancelled`
- la projection d'approbations en attente ne doit jamais etre la source de verite; seule la paire d'evenements fait foi.

**Artifacts**

- un artefact peut etre `detected`, puis `registered`, puis eventuellement `promoted`;
- les artefacts lourds restent references par chemin/URI locale, pas copies sans raison dans les projections.

### 4.4 Process Patterns

**Resume**

- la reprise d'une mission lit d'abord la projection `resume view`;
- si la projection est absente ou douteuse, elle est reconstruite depuis le journal;
- la reprise operateur pointe vers le prochain arbitrage utile, pas vers le transcript complet.

**Execution**

- l'adaptateur emet uniquement des evenements normalises;
- les traductions vendor -> `corp` se font dans l'adaptateur, jamais dans la CLI.

**Workspace changes**

- un detecteur de changements de workspace inspire du `WorkspaceArtifactHook` de ChatDev doit alimenter le registre d'artefacts;
- le detecteur n'est pas autorise a redefinir le statut d'un ticket sans passer par le coordinateur.

### 4.5 Enforcement Guidelines

Les futurs agents devront pouvoir verifier automatiquement:

- absence de champs Codex/OpenAI dans le schema coeur;
- presence d'un evenement pour chaque transition de statut;
- presence d'une isolation root pour chaque ticket mutateur;
- presence du lien `artifact -> producing_event`;
- presence des projections `mission status`, `ticket board`, `approval queue`, `resume view`.

## 5. Project Structure & Boundaries

L'arborescence ci-dessous est une cible d'architecture, pas un engagement d'implementation immediate.

### 5.1 Complete Project Directory Structure

```text
corp/
|-- apps/
|   `-- corp-cli/
|       |-- src/
|       |   |-- commands/
|       |   |-- formatters/
|       |   `-- index.ts
|       `-- tests/
|-- packages/
|   |-- contracts/
|   |   |-- src/
|   |   |   |-- mission/
|   |   |   |-- ticket/
|   |   |   |-- journal/
|   |   |   |-- approvals/
|   |   |   `-- artifacts/
|   |   `-- tests/
|   |-- mission-kernel/
|   |   |-- src/
|   |   |   |-- mission-service/
|   |   |   |-- resume-service/
|   |   |   `-- policy-service/
|   |   `-- tests/
|   |-- ticket-runtime/
|   |   |-- src/
|   |   |   |-- planner/
|   |   |   |-- dispatcher/
|   |   |   |-- ticket-service/
|   |   |   `-- dependency-graph/
|   |   `-- tests/
|   |-- journal/
|   |   |-- src/
|   |   |   |-- event-log/
|   |   |   |-- approval-log/
|   |   |   |-- artifact-index/
|   |   |   `-- projections/
|   |   `-- tests/
|   |-- storage/
|   |   |-- src/
|   |   |   |-- repositories/
|   |   |   |-- projection-store/
|   |   |   `-- fs-layout/
|   |   `-- tests/
|   |-- workspace-isolation/
|   |   |-- src/
|   |   |   |-- worktree/
|   |   |   |-- isolated-workspace/
|   |   |   `-- cleanup/
|   |   `-- tests/
|   |-- execution-adapters/
|   |   |-- codex-responses/
|   |   |   |-- src/
|   |   |   `-- tests/
|   |   |-- codex-exec/
|   |   |   |-- src/
|   |   |   `-- tests/
|   |   `-- codex-sdk/
|   |       |-- src/
|   |       `-- tests/
|   |-- capability-registry/
|   |   |-- src/
|   |   |   |-- registry/
|   |   |   |-- policies/
|   |   |   `-- validation/
|   |   `-- tests/
|   |-- skill-pack/
|   |   |-- src/
|   |   |   |-- loader/
|   |   |   |-- metadata/
|   |   |   `-- references/
|   |   `-- tests/
|   `-- observability/
|       |-- src/
|       |   |-- tracing/
|       |   |-- audit-queries/
|       |   `-- export/
|       `-- tests/
|-- scenarios/
|   `-- pilot-v1/
|-- docs/
|   |-- architecture/
|   `-- adr/
|-- .agents/
|   `-- skills/
|-- _bmad/
|-- _bmad-output/
`-- tests/
    |-- integration/
    |-- contract/
    `-- e2e/
```

### 5.2 Architectural Boundaries

**CLI boundary**

- la CLI ne parle qu'aux services applicatifs;
- elle ne connait ni les details OpenAI, ni les formats JSONL vendor.

**Kernel boundary**

- `mission-kernel` et `ticket-runtime` portent les invariants coeur;
- ils ne manipulent pas directement les secrets OpenAI ni les worktrees.

**Journal boundary**

- le journal recoit des faits normalises;
- il ne pilote pas l'orchestration.

**Adapter boundary**

- les adaptateurs executent, pollent, streament, traduisent, mais ne mutent jamais `Mission` ou `Ticket` directement;
- ils publient des evenements normalises.

**Isolation boundary**

- seul `workspace-isolation` peut ouvrir, nettoyer, conserver ou supprimer un environnement de ticket;
- toute ecriture mutatrice passe par cette couche.

**Extension boundary**

- `CapabilityRegistry` et `SkillPack` declarent l'utilisable;
- toute extension est soumise aux policies et approvals du coeur.

### 5.3 Requirements to Structure Mapping

| Bloc de requirements | Modules principaux |
| --- | --- |
| Mission & Session Lifecycle | `apps/corp-cli`, `packages/mission-kernel`, `packages/storage`, `packages/journal` |
| Planning & Delegation | `packages/ticket-runtime`, `packages/mission-kernel`, `packages/contracts` |
| Execution & Artifact Flow | `packages/execution-adapters`, `packages/journal`, `packages/workspace-isolation` |
| Supervision & Validation Humaine | `apps/corp-cli`, `packages/journal`, `packages/mission-kernel` |
| Reprise & Auditabilite | `packages/journal`, `packages/storage`, `packages/observability` |
| Surface d'Extension | `packages/capability-registry`, `packages/skill-pack`, `packages/execution-adapters` |

### 5.4 Internal Data Flow

```text
Operator CLI
  -> Mission command / Ticket command
    -> Coordinator service
      -> Journal append
      -> Projection update
      -> Dispatcher selects runnable tickets
      -> Isolation manager allocates workspace
      -> Execution adapter runs Codex
      -> Adapter emits normalized events
      -> Artifact detector registers outputs
      -> Approval gate pauses if needed
      -> Resume view refreshes
```

### 5.5 External Integration Points

- OpenAI `Responses API` via `codex-responses`;
- Codex CLI via `codex-exec`;
- Codex SDK via `codex-sdk`;
- MCP servers via `CapabilityRegistry` / adapter configuration;
- local skill packs via `SkillPack`.

Les plugins Codex restent hors perimetre coeur V1. Si `corp` decide plus tard de distribuer ses skills sous forme de plugin Codex, cela restera une couche de packaging, pas une dependance architecturelle.

## 6. Architecture Validation Results

### 6.1 Coherence Validation

L'architecture est coherente avec les artefacts amont pour les raisons suivantes:

- le centre de gravite respecte le brief et le PRD;
- la frontiere minimale d'extension reprend exactement la recherche technique;
- la dependance Codex reste API-first et vendor-bornee;
- l'isolation forte par ticket repond a l'arbitrage utilisateur et au besoin de parallele;
- le journal fin et les projections de reprise repondent directement a FR19-F23 et aux exigences d'audit.

### 6.2 Requirements Coverage Validation

**FR1-F4 Mission lifecycle**

- couverts par `Mission`, `resume view`, `mission-kernel`, `journal`.

**FR5-F9 Planning & delegation**

- couverts par `Ticket`, `dependsOn[]`, `dispatcher`, `planner`, `owner`, `allowedCapabilities`.

**FR10-F14 Execution & artifacts**

- couverts par `ExecutionAttempt`, adaptateurs, journal, artifact index, workspace isolation.

**FR15-F18 Supervision humaine**

- couverts par `ApprovalRequest`, events `approval.*`, policies, CLI operateur.

**FR19-F23 Reprise & audit**

- couverts par journal append-only, projections de reprise, artifact linkage, observability.

**FR24-F28 Extension & integration**

- couverts par `ExecutionAdapter`, `CapabilityRegistry`, `SkillPack`, et frontiere MCP optionnelle.

### 6.3 Non-Functional Coverage Validation

**Local-first**

- supporte par stockage embarque, journal local, CLI locale, worktrees/workspaces locaux.

**Security**

- supporte par policies, approval gate, boundaries de capabilities et isolation de workspace.

**Parallelisme**

- supporte par ticket runtime + isolation par ticket + tentatives distinctes.

**Resume**

- supporte par projections calculees depuis journal.

**Auditability**

- supporte par granularite fine d'evenements et d'artefacts.

### 6.4 Gaps and Non-Decisions Kept Explicit

Ces points restent volontairement ouverts ou deferes:

- technologie exacte de projection locale embarquee;
- commande de bootstrap precise;
- format physique definitif du journal sur disque;
- strategie de merge/reconciliation automatique entre worktrees;
- eventuelle UI locale post-CLI;
- distribution plugin Codex ou marketplace.

### 6.5 Readiness Assessment

**Statut global:** pret pour la prochaine etape BMAD de decomposition en epics/stories V1.

**Statut non vise dans cette fenetre:** pas de passage a l'implementation.

**Confiance globale:** haute sur la structure du noyau, moyenne sur les choix techniques de stockage/bootstrapping qui restent a figer dans les stories.

## 7. Hypotheses Explicites

- La pile la plus naturelle pour V1 est TypeScript serveur sur Node.js LTS, mais ce n'est pas encore une decision d'implementation irreversible.
- Une projection embarquee locale sera necessaire en plus du journal; la technologie est encore ouverte.
- Pour les projets non Git, une isolation equivalente au worktree sera suffisante pour le pilote si elle preserve les memes garanties de non-collision et de cleanup.
- Les adaptateurs secondaires (`codex-exec`, SDK) sont utiles, mais `Responses API` reste suffisant pour ouvrir le pilote V1.

## 8. Questions Ouvertes Restantes

- Fige-t-on des maintenant le support V1 minimal a `Responses API` seul, ou garde-t-on `codex-exec` comme adaptateur de secours des le premier lot ?
- Veut-on figer la projection locale V1 sur SQLite, ou garder ce choix pour le premier story de bootstrap ?
- Quel niveau de resume doit etre calcule automatiquement apres chaque evenement: par ticket seulement, ou aussi par mission et par file d'approbation ?
- Quelle part du replanning `ULTRAPLAN` doit etre deterministe en V1, et quelle part peut rester delegatee au runtime externe ?

## 9. Sources De Reference

### Artefacts BMAD

- `C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp.md`
- `C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp-distillate.md`
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md`
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`

### Analyses de reference

- `C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b01-core-bootstrap-session-loop.md`
- `C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b04-agent-orchestration.md`
- `C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/reuse/reuse-candidates.md`
- `C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-03-gateway-control-plane.md`
- `C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-04-plugin-platform-sdk.md`
- `C:/Dev/PRJET/Openclaw/openclaw-main/analysis/reuse/reuse-candidates.md`
- `C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/batches/02-agent-orchestration.md`
- `C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/reuse/reuse-candidates.md`
- `C:/Dev/PRJET/chatdev/ChatDev-main/analysis/batches/02-workflow-orchestration.md`
- `C:/Dev/PRJET/chatdev/ChatDev-main/analysis/reuse/reuse-candidates.md`

### Documentation officielle verifiee

- `https://developers.openai.com/api/docs/models/gpt-5-codex`
- `https://developers.openai.com/api/docs/guides/background`
- `https://developers.openai.com/api/reference/overview`
- `https://developers.openai.com/codex/noninteractive`
- `https://developers.openai.com/codex/sdk`
- `https://developers.openai.com/codex/mcp`
- `https://developers.openai.com/codex/skills`
- `https://developers.openai.com/codex/plugins`
- `https://developers.openai.com/codex/agent-approvals-security`

## Architecture Conclusion

`corp` V1 doit etre bati comme un noyau mission/ticket persistant, gouverne par journal et isolation, avec `Responses API` comme adaptateur prioritaire vers Codex. Cette architecture preserve l'independance produit, rend la reprise credible, garde l'audit au centre, et borne l'extensibilite a trois seams minimaux.

La prochaine fenetre BMAD doit partir de cet artefact pour produire la decomposition en epics/stories ou l'artefact BMAD suivant decide par l'utilisateur. Elle ne doit pas reouvrir les decisions coeur deja stabilisees ici sans contradiction documentee.
