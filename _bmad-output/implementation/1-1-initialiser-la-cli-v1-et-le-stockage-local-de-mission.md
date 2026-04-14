# Story 1.1: Initialiser la CLI V1 et le stockage local de mission

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operateur technique,
I want initialiser un socle CLI local-first pour `corp`,
so that une mission puisse exister comme objet persistant plutot que comme simple transcript.

## Acceptance Criteria

1. Given un workspace local vierge pour `corp`
   When l'operateur initialise le socle V1
   Then le workspace minimal requis pour la CLI, le journal et les projections locales est cree de facon deterministe
   And ce bootstrap reste compatible avec la baseline TypeScript sur Node.js LTS retenue par l'architecture

2. Given le socle V1 a ete initialise
   When l'operateur ouvre la surface CLI
   Then la CLI expose un point d'entree centre mission plutot qu'un shell vendor-specifique
   And aucun starter monolithique externe n'est requis pour demarrer le lot V1

## Tasks / Subtasks

- [x] Initialiser le workspace minimal du lot V1 sans starter monolithique (AC: 1, 2)
  - [x] Creer le premier squelette de code sous `C:/Dev/PRJET/corp` en restant aligne sur la structure cible d'architecture, sans imposer de framework applicatif externe.
  - [x] Poser le point d'entree CLI `corp` et l'organisation minimale des commandes/formateurs cote CLI autour d'une logique mission-centrique.
  - [x] Garder la CLI separee des details vendor et des adaptateurs Codex des le bootstrap.

- [x] Poser le socle de stockage local requis par le noyau V1 (AC: 1)
  - [x] Creer la couche locale necessaire au journal append-only et au stockage des projections de lecture.
  - [x] Prevoir les familles minimales de projections attendues en V1: `mission status`, `ticket board`, `approval queue`, `artifact index`, `resume view`.
  - [x] Garder le journal comme source de verite et les projections comme vues reconstruisibles.

- [x] Poser les seams minimaux necessaires aux stories suivantes sans devancer leur scope (AC: 1, 2)
  - [x] Initialiser uniquement les emplacements/modules requis pour garder une frontiere nette entre CLI, services applicatifs, journal et stockage local.
  - [x] Ne pas implementer dans cette story la creation de `Mission`, le `Ticket runtime`, les `ExecutionAdapter`, les approvals, ni l'isolation par ticket.
  - [x] Ne laisser aucun champ ou vocabulaire OpenAI/Codex fuiter dans la surface coeur du bootstrap.

- [x] Verifier le bootstrap par des tests et checks de structure (AC: 1, 2)
  - [x] Couvrir l'initialisation deterministe depuis un workspace vide.
  - [x] Couvrir l'existence du point d'entree CLI mission-centrique.
  - [x] Couvrir la presence du journal local et des projections minimales requises, sans hypothese de reseau ni de credentials provider.

## Dev Notes

### Story Intent

Cette story ouvre l'Epic 1 et sert uniquement a installer le socle CLI + stockage local-first. Elle ne doit pas absorber la creation de mission persistante, qui appartient a la Story 1.2, ni les sujets de delegation/execution qui appartiennent aux epics suivants.

### Current Project State

- Le dossier `C:/Dev/PRJET/corp` contient aujourd'hui des artefacts BMAD et des documents source, mais aucun workspace d'implementation existant.
- Aucun depot Git exploitable n'a ete detecte a la racine du projet au moment de la creation de cette story.
- Aucun artefact d'implementation precedent ni `sprint-status.yaml` n'etait disponible pour reutiliser des patterns deja etablis.

### Architecture Compliance

- Le centre de gravite V1 reste `mission kernel + ticket runtime` persistant; cette story ne doit poser que le socle necessaire a ce centre de gravite. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - Resume executif; 3.1 Decision Table]
- La premiere surface operateur V1 est la CLI `corp`, et la CLI ne doit parler qu'aux services applicatifs, jamais directement a des details vendor. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.1 Decision Table; 5.2 Architectural Boundaries]
- Aucun starter monolithique n'est retenu; le bootstrap doit rester minimal et compatible TypeScript sur Node.js LTS. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 2. Starter Template Evaluation]
- Le journal V1 est append-only et les projections locales sont obligatoires pour `mission status`, `ticket board`, `approval queue`, `artifact index`, `resume view`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model]
- `resource_budget` reste hors schema coeur V1 et ne doit pas apparaitre comme champ natif dans le bootstrap du coeur. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.1 Decision Table; 3.9 Journal and Projection Model]
- Les details vendor restent hors du schema coeur; aucun identifiant OpenAI/Codex ne doit apparaitre dans la surface CLI/bootstrap de cette story. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4 Architectural Rule About Vendor Data]

### Product And Epic Guardrails

- Le V1 doit prouver une boucle exploitable et relancable de mission persistante, pas une plateforme generaliste complete. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Portee Produit]
- La valeur attendue vient d'un etat durable lisible, d'un journal consultable et d'une reprise credible hors transcript brut. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Criteres De Succes; Exigences Non Fonctionnelles]
- L'Epic 1 couvre la mission persistante pilotable en CLI; la Story 1.1 doit seulement initialiser le socle permettant aux stories 1.2 a 1.4 d'ajouter creation, reprise et cycle de vie de mission. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 1; Story 1.1; Story 1.2; Story 1.3; Story 1.4]

### Previous Story Intelligence

- Aucune story precedente applicable: la Story 1.1 est le premier artefact d'implementation du lot V1 dans ce projet.

### Project Structure Notes

- Comme aucun code produit n'existe encore, cette story doit creer seulement le plus petit sous-ensemble utile de la structure cible, dans le repo `C:/Dev/PRJET/corp`, sans creer prematurement tout l'arbre d'architecture. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.1 Complete Project Directory Structure]
- Les zones les plus probables a initialiser des cette story sont `apps/corp-cli/`, `packages/journal/`, `packages/storage/` et, uniquement si necessaire pour garder des frontieres propres, `packages/contracts/` ou `packages/mission-kernel/`. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.1 Complete Project Directory Structure; 5.3 Requirements to Structure Mapping]
- Ne pas initialiser de logique concrete pour `packages/execution-adapters/`, `packages/workspace-isolation/`, `packages/capability-registry/` ou `packages/skill-pack/` dans cette story, sauf placeholders strictement necessaires pour garder les seams futurs lisibles. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries]
- Les artefacts BMAD restent dans `_bmad-output`; le code produit doit vivre dans l'arborescence applicative du projet. [Source: observation du repo `C:/Dev/PRJET/corp` + `C:/Dev/PRJET/corp/_bmad-output`]

### Technical Requirements

- Garder une separation nette entre `Operator CLI`, services applicatifs, journal et stockage local, conformement a l'architecture en cinq couches. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.10 Five-Layer Target Architecture]
- Le bootstrap doit etre vendor-decoupled: `corp` garde sa propre CLI, son propre store mission/ticket et son propre journal; Codex reste une capacite externe pour des stories ulterieures. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.4 Interpretation pratique pour `corp`]
- Cette story doit preparer un socle local-first compatible avec une future persistance `Mission + Ticket`, sans encore implementer ces comportements metier. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - Executive Summary; 3.3 Proposition de forme canonique]

### Testing Requirements

- Ajouter des tests de bootstrap ou smoke tests qui prouvent qu'un workspace vide peut etre initialise de facon deterministe. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 1.1 Acceptance Criteria]
- Verifier que la surface CLI ouverte par le bootstrap est mission-centrique et non une facade vendor. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Story 1.1 Acceptance Criteria; `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 5.2 Architectural Boundaries]
- Verifier que le journal local et les projections minimales existent sans imposer de reseau, de credentials OpenAI, ni d'adaptateur d'execution actif. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 5.4 Interpretation pratique pour `corp`; `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.9 Journal and Projection Model]

### Scope Exclusions

- Hors scope de cette story: creation d'une `Mission` persistante, statut de mission, `mission.created`, reprise de mission, cycle de vie de mission. Ces sujets appartiennent aux Stories 1.2 a 1.4. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Stories 1.2, 1.3, 1.4]
- Hors scope de cette story: tickets, dependances, execution via `Responses API`, `ExecutionAttempt`, approvals, audit detaille, extensions et isolation worktree/workspace par ticket. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 2, Epic 3, Epic 4]
- Hors scope de cette story: figer des decisions d'implementation deja laissees ouvertes par l'architecture si elles ne sont pas indispensables au bootstrap minimal. [Source: `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 6.4 Gaps and Non-Decisions Kept Explicit]

### Hypotheses Explicites

- Si un choix concret de package manager, de workspace tooling ou de test runner devient necessaire pour livrer le bootstrap, il doit rester le plus minimal possible, compatible Node.js LTS, et ne pas imposer de starter monolithique non soutenu par les artefacts amont.
- Si un format physique concret pour le journal local ou les projections devient necessaire pour faire exister le bootstrap, ce choix doit rester encapsule derriere les seams `journal` et `storage`, car la technologie exacte n'est pas encore stabilisee dans l'architecture.

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Overview; Additional Requirements; Epic 1; Story 1.1; Stories 1.2 a 1.4
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Executive Summary; Criteres De Succes; Portee Produit; Exigences Fonctionnelles; Exigences Non Fonctionnelles; Exigences Specifiques A L'Outil Developpeur
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - Resume executif; 2. Starter Template Evaluation; 3.1 Decision Table; 3.4 Architectural Rule About Vendor Data; 3.9 Journal and Projection Model; 3.10 Five-Layer Target Architecture; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.3 Requirements to Structure Mapping; 6.4 Gaps and Non-Decisions Kept Explicit
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - Executive Summary; 3.3 Proposition de forme canonique; 5.4 Interpretation pratique pour `corp`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md` - Intention actuelle; Contraintes et questions ouvertes

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Retenir un workspace minimal TypeScript sur Node.js LTS via `npm`, sans starter monolithique ni framework applicatif externe.
- Poser une frontiere nette `apps/corp-cli -> packages/mission-kernel -> packages/journal -> packages/storage`.
- Initialiser un journal local append-only vide et cinq projections JSON minimales, sans introduire de `Mission`, de `Ticket runtime` ou de details vendor.

### Debug Log References

- `npm install`
- `npm test` rouge: echec TypeScript attendu tant que les modules CLI et bootstrap n'existaient pas.
- `npm test` vert: build `tsc` puis 4 tests Node reussis apres implementation et correction du script de test.

### Completion Notes List

- Workspace minimal V1 cree autour de `apps/corp-cli`, `packages/mission-kernel`, `packages/journal` et `packages/storage`, avec baseline TypeScript/Node.js LTS et sans starter externe.
- Point d'entree `corp` ajoute avec une surface mission-centrique `corp mission bootstrap --root <workspace>` et une aide CLI sans vocabulaire vendor.
- Journal local initialise comme fichier append-only vide `events.jsonl` et projections minimales creees sous `.corp/projections/` pour `mission-status`, `ticket-board`, `approval-queue`, `artifact-index` et `resume-view`.
- Le bootstrap reste dans le scope de la story: aucune creation de `Mission`, aucun runtime de ticket, aucun adaptateur d'execution, aucune approval et aucune isolation par ticket n'ont ete implementes.
- Decision locale documentee: `npm` + `typescript` + `@types/node` ont ete retenus comme outillage minimal; le journal et les projections utilisent des fichiers locaux (`jsonl`/`json`) encapsules derriere les seams `journal` et `storage`.
- Validation executee par `npm test`, incluant le build TypeScript et 4 tests de bootstrap/CLI.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/index.ts`
- `package-lock.json`
- `package.json`
- `packages/journal/src/event-log/file-event-log.ts`
- `packages/journal/src/projections/default-projections.ts`
- `packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/projection-store/file-projection-store.ts`
- `tests/contract/mission-cli-surface.test.ts`
- `tests/integration/bootstrap-workspace.test.ts`
- `tsconfig.json`

### Change Log

- 2026-04-08: implementation de la Story 1.1 avec bootstrap TypeScript/Node.js LTS, CLI `corp` mission-centrique, journal local vide et projections minimales V1.
