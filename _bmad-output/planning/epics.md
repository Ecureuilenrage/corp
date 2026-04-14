---
title: "Epics and Stories: corp V1"
status: complete
created: 2026-04-08
updated: 2026-04-08
workflowType: epics_and_stories
projectName: corp
author: darkl
date: 2026-04-08
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - C:/Dev/PRJET/corp/_bmad/bmm/config.yaml
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp-distillate.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/prd.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md
assumptions:
  - "La demande de cette fenetre vaut confirmation explicite pour produire l'artefact final d'epics et stories sans pause intermediaire de validation BMAD."
  - "La liste des documents fournie dans la demande utilisateur est consideree comme exhaustive pour cette etape; aucun ajout ni aucune exclusion supplementaire n'a ete applique."
  - "Aucun document UX dedie n'a ete identifie dans C:/Dev/PRJET/corp/_bmad-output/planning au moment de cette etape; la section UX reste donc explicitement vide."
completedAt: 2026-04-08
---

# corp - Epic Breakdown

## Overview

Ce document decompose `corp` V1 en epics et user stories directement a partir du product brief, de son distillate, du PRD, de l'architecture V1, de la base de connaissance projet et de la recherche technique precedente. Il respecte les decisions coeur deja stabilisees: centre de gravite `mission kernel + ticket runtime` persistant, contrat coeur `Mission + Ticket`, priorite `Responses API`, isolation forte par ticket, granularite fine des evenements et artefacts, `resource_budget` hors schema coeur, et premiere surface operateur V1 = CLI.

## Requirements Inventory

### Functional Requirements

FR1: Un operateur peut creer une mission persistante a partir d'un objectif explicite.
FR2: Un operateur peut reprendre une mission existante avec un resume de son etat courant.
FR3: Un operateur peut consulter l'etat global d'une mission, y compris les taches ouvertes, les validations en attente et les derniers artefacts pertinents.
FR4: Un operateur peut mettre en pause, cloturer ou relancer une mission sans perdre son historique.
FR5: Un operateur peut definir pour une mission des criteres de succes et des contraintes explicites.
FR6: Un operateur peut decomposer une mission en taches bornees et suivables.
FR7: Un operateur peut affecter chaque tache a un role, un agent ou une capacite specialisee.
FR8: Un operateur peut associer a une tache un perimetre d'action, des outils autorises et des contraintes d'usage.
FR9: Un operateur peut reprioriser, modifier ou annuler des taches en cours de mission.
FR10: Un operateur peut lancer l'execution d'une tache deleguee dans le cadre d'une mission.
FR11: Un operateur peut suivre l'avancement et les changements d'etat de chaque tache.
FR12: Un operateur peut acceder aux artefacts produits par chaque tache depuis le contexte de mission.
FR13: Un operateur peut relier une decision, un artefact ou un evenement a la tache qui l'a genere.
FR14: Un operateur peut voir lorsqu'une tache est bloquee, echoue ou requiert une action complementaire.
FR15: Un operateur peut identifier les actions classees comme sensibles avant leur execution.
FR16: Un operateur peut approuver, refuser ou differer une action sensible.
FR17: Un operateur peut consulter le contexte necessaire pour arbitrer une demande d'approbation.
FR18: Un operateur peut definir ou modifier des politiques, budgets ou garde-fous applicables a une mission ou a une tache.
FR19: Un operateur peut reprendre une mission apres interruption sans reconstruire manuellement le contexte critique.
FR20: Un operateur peut consulter un historique structure des decisions, validations, echecs, reprises et evenements de mission.
FR21: Un operateur peut identifier quel role, agent ou extension est a l'origine d'un artefact ou d'un evenement.
FR22: Un operateur peut comparer l'etat courant d'une mission a son objectif et a ses criteres de succes.
FR23: Un operateur peut relancer uniquement la partie impactee d'une mission apres un blocage ou un echec.
FR24: Un concepteur d'extension peut enregistrer un tool, skill, plugin ou canal local pour un usage controle dans une mission.
FR25: Un concepteur d'extension peut declarer les permissions ou contraintes d'usage associees a une extension.
FR26: Un operateur peut selectionner quelles extensions sont disponibles pour une mission donnee.
FR27: Un operateur peut voir quelles extensions ou quels outils ont ete mobilises dans le deroulement d'une tache.
FR28: Un operateur peut utiliser la meme logique de mission, de delegation et d'audit quelle que soit la surface operateur retenue pour le V1.

### NonFunctional Requirements

NFR1: La reprise d'une mission persistante doit restituer dans un meme flux l'objectif courant, les taches ouvertes, les validations en attente et le dernier artefact pertinent, sans reconstruction manuelle du contexte critique.
NFR2: Le produit doit permettre a un operateur unique de suivre une mission pilote de bout en bout sur un poste local sans qu'une latence ou une opacite d'etat ne bloque une decision necessaire a la boucle.
NFR3: Tout changement d'etat significatif d'une tache doit devenir visible dans le contexte de mission avant qu'une decision dependante ne soit requise.
NFR4: 100% des actions sensibles exposees par le V1 doivent exiger une approbation humaine explicite avant execution.
NFR5: Les permissions ou contraintes associees a une extension doivent etre consultables avant son activation dans une mission.
NFR6: Le produit doit conserver une trace des validations, refus et delegations suffisante pour audit posteriori.
NFR7: Les identites, secrets ou credentials eventuellement mobilises par des runtimes externes doivent etre traites comme des zones de risque; aucune hypothese de coexistence transparente ne doit etre supposee sans validation ulterieure.
NFR8: Une interruption de session ne doit pas effacer l'etat durable deja confirme d'une mission, de ses taches ou de ses artefacts.
NFR9: Une tache en echec doit rester inspectable et relancable sans forcer la recreation complete de la mission.
NFR10: Le systeme doit distinguer clairement les elements completes, en attente, bloques et rejetes afin d'eviter les reprises ambigues.
NFR11: Le journal de mission doit rester suffisamment coherent pour permettre un diagnostic a posteriori d'un blocage ou d'une decision.
NFR12: La boucle V1 doit rester operationnelle avec un ensemble minimal d'extensions locales, sans dependre d'un ecosysteme d'integrations exhaustif.
NFR13: 100% des integrations utilisees dans une mission pilote doivent etre attribuables a un evenement, une tache ou un artefact du journal.
NFR14: Le produit doit pouvoir borner l'usage d'une integration a une mission ou a une tache specifique lorsque cela est requis par la politique.

### Additional Requirements

- Aucun starter monolithique n'est retenu pour le V1; le premier lot doit initialiser un workspace minimal compatible avec TypeScript sur Node.js LTS.
- La premiere surface operateur V1 reste la CLI `corp`; elle doit passer par les services applicatifs sans connaitre les details vendor.
- Le contrat coeur V1 reste borne a `Mission`, `Ticket`, `ExecutionAttempt`, `Event` et `Artifact`.
- Aucun identifiant ou champ OpenAI/Codex ne doit fuiter hors de `executionHandle.adapterState` ou d'un `ExecutionAttempt`.
- L'adaptateur prioritaire V1 est `Responses API`; `codex exec` et le Codex SDK restent des adaptateurs secondaires acceptes, mais non requis dans le premier lot.
- L'isolation des tickets mutateurs doit utiliser un worktree Git quand possible, sinon un workspace dedie equivalent, cree avant execution et conserve si des changements existent.
- Le V1 doit utiliser un petit graphe de dependances `dependsOn[]`, avec au maximum une tentative active par ticket a un instant donne.
- Le journal doit etre append-only, a granularite fine, et alimenter des projections locales de lecture, au minimum `mission status`, `ticket board`, `approval queue`, `artifact index` et `resume view`.
- `resource_budget` reste hors schema coeur V1 et ne doit vivre que dans le journal et, si besoin, dans les projections calculees.
- La frontiere minimale d'extension V1 reste limitee a `ExecutionAdapter + CapabilityRegistry + SkillPack`.
- Toute extension V1 doit pouvoir etre declaree et validee sans boot d'un host complet.
- Tout artefact doit referencer l'evenement producteur; toute transition significative doit produire un evenement avant toute projection.

### UX Design Requirements

- Aucun document UX dedie n'a ete identifie dans `C:/Dev/PRJET/corp/_bmad-output/planning` pour cette etape; aucune exigence UX additionnelle n'a donc ete extraite.

### FR Coverage Map

FR1: Epic 1 - Creer une mission persistante locale depuis la CLI.
FR2: Epic 1 - Reprendre une mission existante via une vue de resume fiable.
FR3: Epic 1 - Consulter l'etat global de mission et ses informations critiques.
FR4: Epic 1 - Mettre en pause, relancer ou cloturer une mission sans perdre l'historique.
FR5: Epic 1 - Definir objectif, criteres de succes et contraintes initiales de mission.
FR6: Epic 2 - Decomposer une mission en tickets delegables.
FR7: Epic 2 - Affecter chaque ticket a un owner ou a une capacite specialisee.
FR8: Epic 2 - Declarer le perimetre d'action et les contraintes d'usage d'un ticket.
FR9: Epic 2 - Reprioriser, modifier ou annuler des tickets en cours.
FR10: Epic 2 - Lancer l'execution d'un ticket via l'adaptateur prioritaire.
FR11: Epic 2 - Suivre l'avancement et les changements d'etat de chaque ticket.
FR12: Epic 2 - Acceder aux artefacts produits par les tickets depuis la mission.
FR13: Epic 2 - Relier decisions, artefacts et evenements a leur ticket source.
FR14: Epic 2 - Identifier les tickets bloques, en echec ou en attente d'action.
FR15: Epic 3 - Identifier les actions sensibles avant execution.
FR16: Epic 3 - Approuver, refuser ou differer une action sensible.
FR17: Epic 3 - Consulter le contexte necessaire pour arbitrer une approbation.
FR18: Epic 3 - Definir et modifier policies, garde-fous et observations budgetaires.
FR19: Epic 3 - Reprendre une mission apres interruption sans reconstruire le contexte critique.
FR20: Epic 3 - Consulter un historique structure des decisions, validations, echecs, reprises et evenements.
FR21: Epic 3 - Identifier le role, l'agent ou l'extension a l'origine d'un artefact ou d'un evenement.
FR22: Epic 3 - Comparer l'etat courant a l'objectif et aux criteres de succes.
FR23: Epic 3 - Relancer uniquement la partie impactee apres blocage ou echec.
FR24: Epic 4 - Enregistrer des extensions locales gouvernees pour usage mission.
FR25: Epic 4 - Declarer les permissions et contraintes d'usage des extensions.
FR26: Epic 4 - Selectionner les extensions autorisees pour une mission.
FR27: Epic 4 - Tracer quelles extensions ou quels outils ont ete utilises par ticket.
FR28: Epic 4 - Conserver une logique mission/delegation/audit coherente sur la surface operateur V1.

## Epic List

### Epic 1: Mission persistante pilotable en CLI
Permettre a l'operateur d'initialiser le noyau V1 local-first, de creer une mission persistante, d'en consulter l'etat utile et de la faire evoluer dans son cycle de vie sans perdre l'historique.
**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Epic 2: Delegation et execution isolees par ticket
Permettre a l'operateur de decomposer une mission en tickets delegables, de les lancer via l'adaptateur prioritaire, de suivre leur progression et de recuperer des artefacts relies a des evenements fins.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14

### Epic 3: Supervision humaine, reprise ciblee et audit
Permettre a l'operateur de garder le controle des actions sensibles, de reprendre une mission interrompue, de diagnostiquer l'historique de travail et de relancer uniquement la partie impactee.
**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23

### Epic 4: Extensions locales gouvernees pour la boucle V1
Permettre a un concepteur d'extension et a l'operateur d'enregistrer, d'autoriser et de tracer les seams V1 (`ExecutionAdapter`, `CapabilityRegistry`, `SkillPack`) sans sortir du contrat coeur ni du regime d'audit.
**FRs covered:** FR24, FR25, FR26, FR27, FR28

### Epic 5: Hardening transverse V1 pre-GA
Absorber la dette transversale accumulee sur Epics 1-4 (53 items `D-01` a `D-53` de `deferred-work.md` + 3 actions process recurrentes) pour rendre le V1 GA-ready sans elargir le perimetre fonctionnel.
**FRs couverts:** aucun (durcissement des FR1-FR28 existants).
**NFRs couvertes:** NFR15, NFR16, NFR17, NFR18, NFR19, NFR20, NFR21, NFR22.

## Epic 1: Mission persistante pilotable en CLI

L'operateur peut initialiser le socle local-first de `corp`, creer une mission persistante, retrouver un resume fiable et faire evoluer la mission en CLI sans perdre l'etat utile ni l'historique.

### Story 1.1: Initialiser la CLI V1 et le stockage local de mission

As a operateur technique,
I want initialiser un socle CLI local-first pour `corp`,
So that une mission puisse exister comme objet persistant plutot que comme simple transcript.

**Acceptance Criteria:**

**Given** un workspace local vierge pour `corp`
**When** l'operateur initialise le socle V1
**Then** le workspace minimal requis pour la CLI, le journal et les projections locales est cree de facon deterministe
**And** ce bootstrap reste compatible avec la baseline TypeScript sur Node.js LTS retenue par l'architecture

**Given** le socle V1 a ete initialise
**When** l'operateur ouvre la surface CLI
**Then** la CLI expose un point d'entree centre mission plutot qu'un shell vendor-specifique
**And** aucun starter monolithique externe n'est requis pour demarrer le lot V1

### Story 1.2: Creer une mission persistante avec objectif et criteres de succes

As a operateur technique,
I want creer une mission persistante avec objectif, criteres de succes et contraintes initiales,
So that le systeme puisse piloter une boucle de travail bornee et explicite.

**Acceptance Criteria:**

**Given** la CLI V1 est disponible
**When** l'operateur cree une mission avec titre, objectif, criteres de succes et policy profile initial
**Then** un enregistrement `Mission` local est persiste avec identite stable, statut initial et horodatages
**And** la mission initialise ses index de tickets, artefacts et evenements sans embarquer de champs vendor-specifiques

**Given** une mission vient d'etre creee
**When** l'etat est journalise
**Then** un evenement fin `mission.created` est ecrit avant toute projection de lecture
**And** le point de reprise operateur peut ensuite etre calcule a partir du journal

### Story 1.3: Consulter l'etat courant et le resume de reprise d'une mission

As a operateur technique,
I want rouvrir une mission existante et voir son etat utile dans un meme flux,
So that je puisse reprendre sans relire le transcript brut.

**Acceptance Criteria:**

**Given** une mission existe avec journal et projections locales
**When** l'operateur demande l'etat ou la reprise de cette mission
**Then** la CLI restitue l'objectif courant, les tickets ouverts, les validations en attente et le dernier artefact pertinent dans un meme flux
**And** la sortie met en avant le prochain arbitrage utile pour l'operateur

**Given** la projection `resume view` est absente ou douteuse
**When** la mission est reprise
**Then** la vue de reprise est reconstruite a partir du journal append-only avant affichage
**And** la reconstruction n'exige aucune reconstitution manuelle du contexte critique

### Story 1.4: Mettre en pause, relancer ou cloturer une mission sans perdre l'historique

As a operateur technique,
I want faire evoluer explicitement le cycle de vie d'une mission,
So that la mission reste pilotable dans le temps sans effacer son historique.

**Acceptance Criteria:**

**Given** une mission est en cours, bloquee ou en attente d'approbation
**When** l'operateur la met en pause, la relance ou la cloture
**Then** la mission change d'etat via des transitions autorisees par le noyau V1
**And** les tickets, artefacts, approbations et evenements existants restent preserves

**Given** une transition de cycle de vie est demandee
**When** la mutation est appliquee
**Then** un evenement de mission correspondant est ecrit avant mise a jour des projections
**And** l'etat affiche en CLI reste coherent avec l'historique journalise

## Epic 2: Delegation et execution isolees par ticket

L'operateur peut decouper une mission en tickets delegables, les parametrer avec des contraintes explicites, les lancer dans des espaces isoles et suivre leurs artefacts et evenements depuis le contexte de mission.

### Story 2.1: Creer un ticket delegable avec owner, dependances et contraintes explicites

As a operateur technique,
I want creer un ticket borne avec owner, dependances et contraintes d'usage,
So that la delegation devienne explicite, suivable et relancable.

**Acceptance Criteria:**

**Given** une mission persistante existe
**When** l'operateur ajoute un ticket avec type, objectif, owner, `dependsOn`, criteres de succes, capacites autorisees et references de skill pack
**Then** un enregistrement `Ticket` est persiste dans la mission avec identite stable et statut initial valide
**And** le ticket peut exister avant toute tentative d'execution

**Given** un ticket vient d'etre cree
**When** il est journalise
**Then** un evenement `ticket.created` est emis avec un niveau de granularite fin
**And** les details vendor eventuels restent reserves a `executionHandle.adapterState`

### Story 2.2: Reprioriser, modifier et annuler un ticket en cours de mission

As a operateur technique,
I want ajuster un ticket pendant qu'une mission evolue,
So that le plan reste exploitable sans casser l'historique ni le contrat coeur.

**Acceptance Criteria:**

**Given** une mission contient plusieurs tickets
**When** l'operateur modifie l'objectif, les contraintes, l'ordre de traitement ou annule un ticket
**Then** la vue de planification et le set de tickets executables sont recalcules sans detruire l'historique existant
**And** chaque mutation produit un evenement de ticket explicite

**Given** un ticket est annule
**When** le dispatcher reevalue la mission
**Then** ce ticket n'apparait plus dans le set runnable du V1
**And** les tickets dependants refleteront clairement leur etat ou leur blocage en projection

### Story 2.3: Lancer une tentative d'execution isolee via l'adaptateur prioritaire

As a operateur technique,
I want lancer un ticket runnable dans un espace de travail isole,
So that l'execution progresse sans contaminer le workspace principal ni le schema coeur.

**Acceptance Criteria:**

**Given** un ticket a des dependances resolues et un owner defini
**When** l'operateur lance son execution
**Then** un espace d'isolation est cree via worktree Git ou workspace dedie equivalent avant toute mutation
**And** une seule `ExecutionAttempt` active est ouverte pour ce ticket a cet instant

**Given** l'execution utilise l'adaptateur prioritaire V1
**When** une tentative est ouverte
**Then** l'adaptateur retenu est `codex_responses`
**And** les IDs vendor, curseurs de polling et autres details OpenAI/Codex restent confines a `executionHandle.adapterState`

**Given** un ticket long est configure pour du traitement asynchrone
**When** l'adaptateur utilise le mode background
**Then** les changements d'etat de run sont normalises en evenements `corp`
**And** aucun statut vendor brut n'est expose comme primitive coeur de `Mission` ou `Ticket`

### Story 2.4: Suivre l'avancement et les blocages d'un ticket depuis la mission

As a operateur technique,
I want voir l'etat de chaque ticket et ses raisons de blocage,
So that je sache quoi arbitrer ou relancer en priorite.

**Acceptance Criteria:**

**Given** des tickets sont en cours, bloques, en attente d'approbation ou termines
**When** l'operateur consulte la mission ou le board des tickets
**Then** la CLI affiche pour chaque ticket son statut, son owner, ses dependances et son motif de blocage si pertinent
**And** les etats `todo`, `claimed`, `in_progress`, `blocked`, `awaiting_approval`, `done`, `failed`, `cancelled` restent clairement distingues

**Given** un ticket depend d'autres tickets
**When** le dispatcher evalue son eligibilite
**Then** ce ticket ne devient runnable que lorsque ses prerequis sont resolus
**And** toute transition visible provient d'un evenement journalise au prealable

### Story 2.5: Enregistrer les artefacts, decisions et evenements produits par un ticket

As a operateur technique,
I want acceder aux sorties d'un ticket depuis le contexte de mission,
So that je puisse juger l'avancement reel et comprendre d'ou viennent les resultats.

**Acceptance Criteria:**

**Given** une tentative produit des fichiers, rapports ou sorties structurees
**When** ces sorties sont detectees puis enregistrees
**Then** chaque `Artifact` reference au minimum `missionId`, `ticketId`, `producing_event_id` et, si present, `attemptId` et `workspaceIsolationId`
**And** la granularite des `artifactIds` et `eventIds` reste suffisamment fine pour diagnostiquer ou relancer partiellement

**Given** des artefacts et decisions ont ete lies a un ticket
**When** l'operateur consulte la mission
**Then** il peut naviguer du ticket vers ses artefacts et vers l'evenement ou la decision source
**And** la consultation ne depend pas du transcript brut de l'execution

### Story 2.6: Corriger les guards de statuts terminaux et le filtre des tickets ouverts

As a operateur technique,
I want que les operations sur les tickets respectent strictement les statuts terminaux du contrat canonique,
So that un ticket done ou failed ne puisse pas etre annule, mute ou affiche comme ouvert.

**Acceptance Criteria:**

**Given** un ticket est en statut `done` ou `failed`
**When** l'operateur tente de l'annuler
**Then** la commande echoue avec un message d'erreur deterministe et rien n'est mute

**Given** une mission contient des tickets `failed`
**When** l'operateur consulte le resume
**Then** les tickets `failed` n'apparaissent pas dans les tickets ouverts

### Story 2.7: Fiabiliser le mecanisme central de projection rewriteMissionReadModels

As a operateur technique,
I want que les projections de lecture soient toujours coherentes apres chaque operation de mutation,
So that tout consommateur puisse lire un etat fiable directement depuis les fichiers de projection.

**Acceptance Criteria:**

**Given** une operation de mutation vient de se terminer
**When** les projections sont rafraichies
**Then** `resume-view.json` est ecrit sur disque avec les donnees a jour
**And** les cinq projections sont coherentes entre elles

### Story 2.8: Corriger le flow d'execution ticket — transitions, adaptateur et atomicite

As a operateur technique,
I want que l'execution d'un ticket suive correctement toutes les transitions de statut,
So that le journal et les projections refletent fidelement l'etat reel de chaque tentative.

**Acceptance Criteria:**

**Given** un ticket est lance en mode foreground
**When** l'adaptateur execute
**Then** le ticket transite par `todo -> claimed -> in_progress -> done`
**And** l'etat `in_progress` est observable dans le journal

### Story 2.9: Corriger la detection et l'enregistrement d'artefacts

As a operateur technique,
I want que tous les artefacts produits par un ticket soient detectes et enregistres de maniere fiable,
So that la trace d'audit reste complete et que les artefacts ne soient jamais perdus silencieusement.

**Acceptance Criteria:**

**Given** l'adaptateur echoue avec une exception
**When** le bloc catch persiste l'echec
**Then** les artefacts produits avant le crash sont detectes et enregistres

### Story 2.10: Combler les gaps de tests et corriger les bugs edge-case restants

As a operateur technique,
I want que les chemins d'erreur et les edge cases soient couverts par des tests fiables,
So that l'Epic 2 soit suffisamment robuste pour servir de fondation aux Epics 3 et 4.

**Acceptance Criteria:**

**Given** toutes les stories 2-1 a 2-9 sont implementees
**When** la suite de tests est executee
**Then** chaque chemin d'erreur a au moins un test contractuel ou d'integration

## Epic 3: Supervision humaine, reprise ciblee et audit

L'operateur peut garder les actions sensibles sous approbation, reprendre une mission interrompue a partir d'un resume fiable, diagnostiquer le journal et relancer uniquement la branche impactee par un echec ou un blocage.

### Story 3.1: Ouvrir une file d'approbation pour les actions sensibles

As a operateur technique,
I want que les actions sensibles s'arretent avant execution pour demander validation,
So that le V1 reste sous supervision humaine explicite.

**Acceptance Criteria:**

**Given** une policy de mission ou de ticket marque une action comme sensible
**When** l'execution atteint cette action
**Then** la tentative est mise en pause avant execution effective
**And** une demande d'approbation est creee avec un lien vers la mission, le ticket et la tentative concernes

**Given** une demande d'approbation est creee
**When** elle est affichee a l'operateur
**Then** le contexte d'arbitrage inclut l'action demandee, les garde-fous applicables et les artefacts ou evenements pertinents
**And** le ticket passe a l'etat `awaiting_approval` via un evenement journalise

### Story 3.2: Approuver, refuser ou differer une demande avec garde-fous auditablement

As a operateur technique,
I want resoudre une demande d'approbation et ajuster les garde-fous associes,
So that la mission reste gouvernee sans contaminer le schema coeur.

**Acceptance Criteria:**

**Given** une file d'approbation contient des demandes en attente
**When** l'operateur approuve, refuse ou differe une demande depuis la CLI
**Then** la decision est materialisee par un evenement `approval.*` correspondant
**And** la projection `approval queue` reflete le nouvel etat immediatement apres append du journal

**Given** l'operateur ajuste une policy, un budget observe ou un garde-fou de mission ou de ticket
**When** cette modification est enregistree
**Then** la mutation reste auditable et rattachee a la mission ou au ticket vise
**And** `resource_budget` ne devient pas un champ natif de `Mission` ou `Ticket`

### Story 3.3: Reprendre une mission interrompue a partir d'un resume fiable

As a operateur technique,
I want reprendre une mission apres interruption sans reconstituer le contexte a la main,
So that la valeur centrale de continuite operatoire soit tangible des le V1.

**Acceptance Criteria:**

**Given** une mission a ete interrompue par un echec, une pause ou une sortie operateur
**When** l'operateur demande une reprise
**Then** la reprise restitue l'objectif courant, les tickets ouverts, les validations en attente, le dernier artefact pertinent et le dernier blocage connu
**And** ces informations proviennent d'une projection reconstruisible depuis le journal

**Given** l'etat durable avait ete confirme avant interruption
**When** la mission est reprise
**Then** cet etat reste intact et inspectable
**And** la reprise n'impose pas de recreation de mission ni de relecture exhaustive de transcripts

### Story 3.4: Consulter un journal d'audit structure et l'origine de chaque sortie

As a operateur technique,
I want lire l'historique de mission comme une trace structuree,
So that je puisse comprendre qui a fait quoi, quand et pourquoi.

**Acceptance Criteria:**

**Given** une mission a deja produit des executions, artefacts et validations
**When** l'operateur ouvre la vue d'audit
**Then** le systeme expose une chronologie structuree des evenements, echecs, reprises, validations et artefacts
**And** chaque entree conserve les correlations utiles entre `missionId`, `ticketId`, `attemptId`, `artifactId`, `approvalId`, `actor` et `source` lorsque disponibles

**Given** l'operateur inspecte un artefact ou un evenement
**When** il demande son origine
**Then** il peut identifier le role, l'agent ou l'extension a l'origine de cette sortie
**And** la lecture d'audit repose sur le journal append-only et ses projections, pas sur une interpretation ad hoc du transcript

### Story 3.5: Comparer l'etat courant aux criteres de succes et relancer uniquement la partie impactee

As a operateur technique,
I want mesurer l'ecart entre l'etat courant et l'objectif de mission puis relancer seulement la branche necessaire,
So that les echecs restent bornes et auditables.

**Acceptance Criteria:**

**Given** une mission contient un ticket bloque ou en echec
**When** l'operateur compare l'etat courant a l'objectif et aux criteres de succes
**Then** le systeme montre explicitement l'ecart entre ce qui est attendu et ce qui est observe
**And** l'operateur peut identifier la branche de tickets a reprendre

**Given** seule une partie de la mission doit etre relancee
**When** l'operateur relance le sous-ensemble impacte
**Then** une nouvelle `ExecutionAttempt` n'est creee que pour les tickets concernes
**And** les tickets, artefacts et approbations non impactes restent inchanges et consultables

## Epic 4: Extensions locales gouvernees pour la boucle V1

Un concepteur d'extension et l'operateur peuvent declarer, valider, autoriser et tracer les seams V1 sans transformer `corp` en host de plugins generaliste ni remettre en cause le contrat `Mission + Ticket`.

### Story 4.1: Publier le contrat de registration des extensions V1

As a concepteur d'extension locale,
I want disposer d'un contrat de declaration testable pour les seams V1,
So that je puisse preparer une extension sans boot d'un host complet.

**Acceptance Criteria:**

**Given** un concepteur veut enregistrer un `ExecutionAdapter`, une capability ou un `SkillPack`
**When** il redige la declaration d'extension V1
**Then** le contrat capture l'identite, le type de seam, les permissions ou contraintes, les metadonnees requises et les references locales utiles
**And** la declaration peut etre validee en isolation

**Given** une declaration d'extension V1 est validee
**When** elle est comparee au perimetre V1
**Then** elle n'introduit ni marketplace, ni control plane distribue, ni plugin host generaliste
**And** elle respecte la frontiere minimale `ExecutionAdapter + CapabilityRegistry + SkillPack`

### Story 4.2: Enregistrer une capability locale avec permissions et contraintes explicites

As a concepteur d'extension locale,
I want enregistrer une capability locale gouvernee par policy,
So that une mission puisse l'utiliser de maniere controlee et auditable.

**Acceptance Criteria:**

**Given** une capability locale ou MCP-backed doit etre exposee au noyau V1
**When** sa registration est chargee
**Then** `CapabilityRegistry` stocke ses permissions, ses contraintes d'usage et les informations de validation necessaires
**And** toute registration incomplete ou invalide est rejetee avant usage mission

**Given** une capability enregistree est invoquee plus tard par un ticket
**When** l'invocation se produit
**Then** un evenement auditable relie l'usage de cette capability a la mission et au ticket concernes
**And** l'invocation reste soumise aux approvals et policies du coeur

### Story 4.3: Charger un skill pack local dans le cadre d'une mission

As a concepteur d'extension locale,
I want charger un skill pack local avec metadonnees et references optionnelles,
So that l'expertise soit activable a la demande sans agrandir le coeur V1.

**Acceptance Criteria:**

**Given** un dossier local de skill pack respecte le format retenu
**When** il est discoverable par `corp`
**Then** ses metadonnees deviennent consultables sans charger prematurement tous les contenus associes
**And** les references ou scripts optionnels restent lies au skill pack local

**Given** un ticket autorise un `SkillPackRef`
**When** l'operateur ou le planner y fait appel
**Then** le skill pack peut etre mobilise sans modifier le contrat coeur `Mission + Ticket`
**And** son usage reste borne au contexte local et repo-scoped du V1

### Story 4.4: Selectionner les extensions autorisees par mission et tracer leur usage en CLI

As a operateur technique,
I want choisir quelles extensions sont disponibles pour une mission et voir lesquelles ont ete utilisees,
So that l'extensibilite reste gouvernee et lisible.

**Acceptance Criteria:**

**Given** une mission dispose d'extensions locales enregistrees
**When** l'operateur selectionne les extensions autorisees pour cette mission
**Then** seules ces extensions deviennent disponibles pour les tickets de la mission
**And** une extension non autorisee ne peut pas etre invoquee par l'execution

**Given** des tickets ont utilise des extensions au cours d'une mission
**When** l'operateur consulte la CLI de mission ou d'audit
**Then** il voit quelles extensions, capabilities ou skills ont ete mobilises par ticket
**And** la logique de mission, de delegation, d'approbation et d'audit reste coherente sur toute la surface operateur V1

## Epic 5: Hardening transverse V1 pre-GA

Un operateur technique et un mainteneur de `corp` peuvent conclure que la V1 est GA-ready: la dette transversale accumulee sur Epics 1-4 est traitee en lot coherent (atomicite ecritures, lecture defensive, factorisation guards, compatibilite Windows, determinisme projections, confidentialite brief, gouvernance registres) et la gouvernance BMAD est mecanisee pour empecher la recurrence des ecarts de cloture d'epic. Aucun nouveau FR n'est introduit. Tous les items sont traces vers `_bmad-output/implementation/deferred-work.md`.

### Story 5.0: Mecaniser la gouvernance de cloture d'epic BMAD

As a scrum master de `corp`,
I want que la cloture d'un epic soit mecaniquement conditionnee a la synchronisation des artefacts BMAD,
So that les ecarts de gouvernance signales sur trois retrospectives consecutives ne se reproduisent plus.

**Acceptance Criteria:**

**Given** un epic a toutes ses stories en statut `done` dans `sprint-status.yaml` mais une story de cet epic conserve `Status: review` dans son story file
**When** un script de verification de cloture est execute sur l'epic
**Then** il refuse la transition `epic-N: in-progress -> done` avec un message deterministe citant la story desynchronisee
**And** la meme verification echoue aussi quand une retrospective d'epic n'a pas le statut `done`

**Given** un nouvel epic est ajoute a `sprint-status.yaml`
**When** son entry `epic-N-retrospective` est initialisee
**Then** la valeur par defaut est `required` (plus jamais `optional`)
**And** la regle est documentee dans `_bmad/` comme politique BMAD du projet `corp`

**Given** un registre runtime nouveau est introduit dans un epic futur
**When** un workspace cree par un lot anterieur est rencontre
**Then** la politique documentee "compat workspaces pour nouveau registre" (pattern 4.5/4.3/4.4) est appliquee avec re-bootstrap deterministe
**And** la politique vit dans `_bmad/` plutot que d'etre reproduite dans chaque story

### Story 5.1: Rendre atomiques les ecritures du journal, des projections et des registres

As a mainteneur de `corp`,
I want que toute sequence append-event -> save -> rewrite-read-models survive a un crash sans divergence,
So that le journal reste la source de verite et les projections restent reconstruibles.

**Acceptance Criteria:**

**Given** un crash simule survient entre `appendEvent` et `repository.save` dans `create-mission`, `update-mission-lifecycle`, `run-ticket` ou `resolve-approval-request`
**When** la commande est relancee
**Then** le journal et les projections restent coherents ou `readMissionResume` reconstruit l'etat a partir du journal sans exiger de snapshot
**And** aucun read-model ne reste en divergence silencieuse apres le redemarrage

**Given** deux processus CLI concurrents ecrivent `audit-log.json`, `resume-view.json` ou un snapshot de registre
**When** les ecritures sont interleaves sur Windows NTFS
**Then** les fichiers de projection utilisent un pattern temp-file + rename atomique
**And** aucun JSON tronque ne peut etre observe par un lecteur concurrent

**Given** un helper de creation de fichier est invoque dans `ensureAppendOnlyEventLog` ou `writeFileIfMissing`
**When** un second processus tente la meme creation simultanement
**Then** le helper utilise un flag exclusif (`wx` ou equivalent) pour fermer la fenetre TOCTOU
**And** les cas `EEXIST` sont traites comme resultat benin et non comme erreur

**Items `deferred-work.md` absorbes:** D-01, D-05, D-07, D-17, D-29, D-35, D-36, D-43, D-49, D-50.

### Story 5.2: Durcir la lecture defensive et la validation de schema cross-repositories

As a mainteneur de `corp`,
I want que chaque repository valide le schema d'un document persiste avant de l'exposer au domaine,
So that un fichier corrompu produise un message deterministe au lieu d'un objet partiel.

**Acceptance Criteria:**

**Given** un fichier `mission.json`, `ticket.json`, capability ou skill-pack est corrompu ou suit un schema anterieur
**When** son repository le lit
**Then** un garde runtime (`isMission`, `isRegisteredCapability`, `isRegisteredSkillPack`) rejette le document avec un message d'erreur explicite
**And** aucun `as T` non valide n'est retourne au service applicatif

**Given** `events.jsonl` est absent, inaccessible (EACCES) ou en erreur IO (EIO) au moment de la lecture
**When** une commande de lecture du journal est invoquee
**Then** le code produit un message distinct pour ENOENT, EACCES, EIO au lieu du fallback generique "Workspace non initialise"
**And** `readEventLog` ne crashe plus quand `events.jsonl` est supprime apres bootstrap

**Given** un bare catch existait dans `read-mission-audit.ts` ou `readApprovalQueue`
**When** la story est terminee
**Then** les blocs catch distinguent `FILE_SYSTEM_ERROR_CODES` etendu (EACCES, EIO, EMFILE, EPERM, ENOSPC)
**And** aucun EACCES n'est reporte comme "irreconciliable" ou "ref manquante" sans cause reelle

**Items `deferred-work.md` absorbes:** D-06, D-08, D-18, D-34, D-38, D-44, D-48.

### Story 5.3: Factoriser les type guards et helpers workspace partages

As a mainteneur de `corp`,
I want que les type guards et helpers d'initialisation du workspace existent en une definition unique,
So that les contrats runtime ne derivent plus silencieusement entre packages.

**Acceptance Criteria:**

**Given** les type guards `isApprovalRequest`, `isArtifact`, `isTicket`, `isExecutionAttempt`, `isWorkspaceIsolationMetadata`, `isApprovalDecision`, `isCapabilityInvocationDetails` etaient dupliques entre `audit-log-projection.ts` et `read-mission-audit.ts`
**When** la story est terminee
**Then** une seule definition de chaque guard vit dans un module partage (ex. `packages/contracts` ou `packages/shared-guards`)
**And** les deux consommateurs importent la definition unique

**Given** `ensureMissionWorkspaceInitialized` existait en trois copies (create-mission, update-lifecycle, read-mission-resume)
**When** la story est terminee
**Then** une seule implementation factoree est consommee par les trois services
**And** la variante qui verifiait `resume-view` reste le comportement unique

**Given** `normalizeOpaqueExtensionReference` et `normalizeOpaqueReferences` font tous deux trim + dedupe
**When** la story est terminee
**Then** une seule helper est partagee entre le registre d'extension et le ticket runtime
**And** aucune divergence de normalisation n'est possible entre les deux chemins

**Items `deferred-work.md` absorbes:** D-03, D-11, D-21, D-31, D-53.

### Story 5.4: Durcir la compatibilite Windows pour identifiants et chemins

As a mainteneur de `corp`,
I want que les identifiants de stockage et les comparaisons d'extensions soient deterministes entre OS,
So que la CLI produise un message clair plutot qu'une erreur filesystem opaque sur Windows.

**Acceptance Criteria:**

**Given** un identifiant de storage contient un caractere reserve Windows (`:`, `<`, `>`, `|`, `?`, `*`, `"`) ou un nom reserve (`CON`, `PRN`, `NUL`, `AUX`, `COM1-9`, `LPT1-9`)
**When** `assertSafeStorageIdentifier` est invoquee
**Then** l'identifiant est rejete avec un message deterministe "Identifiant invalide"
**And** aucun `mkdir`/`writeFile` en aval ne produit plus une erreur OS opaque

**Given** deux `packRef` ou `capabilityRef` differant seulement par la casse sont enregistres sur un filesystem case-insensitive
**When** le registre les compare
**Then** la comparaison suit une regle de normalisation documentee (ex. casefold) et detecte la collision
**And** `Pack.Triage` et `pack.triage` ne peuvent coexister comme enregistrements distincts

**Given** un chemin UNC Windows (`\\\\server\\share\\...`) est passe a `isAbsoluteReference`
**When** le code s'execute sur un runtime POSIX de CI
**Then** la regex de secours reconnait le chemin comme absolu
**And** `validateResolvedLocalRef` produit un diagnostic specifique plutot qu'un faux "ref manquante"

**Items `deferred-work.md` absorbes:** D-22, D-37, D-45, D-46, D-52.

### Story 5.5: Rendre deterministes les projections, tris et filtres de lecture

As a operateur technique,
I want que les tris, filtres et bornes de lecture produisent le meme resultat quelle que soit la locale ou l'entree,
So que l'audit et les projections restent verifiables.

**Acceptance Criteria:**

**Given** un tri chronologique est applique a des evenements datables en ISO-8601
**When** le code s'execute sous une locale non-standard
**Then** la comparaison utilise `<`/`>` lexicographique (ou `localeCompare` force a la locale `"en"`) et n'inverse aucun ordre
**And** `audit-log-projection.ts` ne depend plus de la locale par defaut du runtime

**Given** une commande d'audit est appelee avec `--ticket-id T1`
**When** la projection est filtree
**Then** les evenements mission-level (`mission.created`, `mission.paused`, etc.) sont inclus comme contexte conformement a AC2 de 3.4
**And** la semantique "mission-centrique + filtree ticket" est documentee dans l'aide CLI

**Given** un appel d'audit ou de board recoit `limit <= 0`, un `--root` whitespace-only ou un `rootDir` undefined
**When** le parser CLI est execute
**Then** la valeur est rejetee avant tout acces filesystem avec un message deterministe
**And** `path.resolve(undefined)` ne retombe plus silencieusement sur `process.cwd()`

**Given** un payload audit contient plusieurs objets imbriques avec `approvalId` et `decisionRef` repartis
**When** `readSourceReferences` scanne le payload
**Then** toutes les references sont collectees et aucune n'est perdue par court-circuit sur le premier objet
**And** `filterMissionEntities` exclut les entites sans `missionId` quand le filtre est applique

**Items `deferred-work.md` absorbes:** D-02, D-04, D-09, D-12, D-14, D-28, D-32, D-33, D-39.

### Story 5.6: Borner la confidentialite et la securite du brief adaptateur

As a mainteneur de `corp`,
I want qu'aucun chemin absolu local, aucun identifiant vendor brut et aucune metadonnee non echappee ne fuite dans un brief externe,
So que les artefacts envoyes a un adaptateur externe restent defendables.

**Acceptance Criteria:**

**Given** un `ExecutionAdapter` construit un brief destine a un API externe
**When** ce brief est assemble
**Then** aucun chemin absolu local (`rootDir`, `references[]`, `metadataFile`, `scripts[]`, `workspacePath`) n'est concatene en clair
**And** les chemins sont exprimes en reference relative au `rootDir` de la mission ou masques

**Given** un skill pack ou une capability porte `displayName`, `description` ou un chemin contenant `\n`, `|` ou un caractere de formatage du brief
**When** `formatSkillPackSummary` ou l'equivalent capability assemble le brief
**Then** la valeur est echappee avant concatenation
**And** le format du brief ne peut pas etre corrompu par une metadonnee adversariale

**Given** un adaptateur vendor porte un nom contenant `anthropic_api`, `azure_openai_proxy` ou un futur identifiant
**When** `toPublicSource` est invoquee
**Then** la normalisation suit une allowlist explicite des sources publiques et replace toute source non-allowlistee par `execution-adapter`
**And** aucun identifiant vendor brut ne fuite dans la CLI ou les projections

**Given** `assertSkillPackLocalBoundary` compare un `rootDir` et une cible potentiellement symlinkee
**When** la verification est effectuee
**Then** `fs.realpath` est utilisee avant comparaison pour resoudre les symlinks
**And** un lien symbolique sortant du `rootDir` est detecte et rejete

**Items `deferred-work.md` absorbes:** D-13, D-40, D-41, D-42.

### Story 5.7: Stabiliser la gouvernance des registres, test seams et restants

As a mainteneur de `corp`,
I want que les approbations revalident les registres workspace et que les seams de test soient isoles par contexte,
So que les decisions restent coherentes sous mutation concurrente du registre et que les tests paralleles ne fuient pas entre eux.

**Acceptance Criteria:**

**Given** une demande d'approbation reference une extension autorisee au moment de `extension select`
**When** l'operateur resout l'approbation alors que l'extension a ete deregistree entre-temps
**Then** `resolve-approval-request` revalide contre le registre workspace et refuse l'approbation avec un message deterministe
**And** le run ne peut plus echouer "au preflight" apres une approbation deja validee

**Given** `RegisteredCapability.localRefs` etait obligatoire pour toute capability
**When** la story est terminee
**Then** `localRefs` est optionnel pour les capabilities MCP-backed (et obligatoire pour les capabilities locales)
**And** le contrat `registered-capability.ts` documente la semantique par type

**Given** `setRunTicketDependenciesForTesting` ou un equivalent existe comme singleton module-level
**When** des tests paralleles overrident les dependances
**Then** l'override vit dans un contexte de test isole (factory ou arrange per-test) et ne peut plus fuiter entre tests
**And** aucun test seam mutable global ne subsiste dans `run-ticket.ts`

**Given** un type guard `isExecutionAttempt` rejetait `workspaceIsolationId: null`
**When** un attempt porte legitimement `workspaceIsolationId: null`
**Then** le guard accepte la branche null documentee
**And** les entries d'audit ne perdent plus l'`attemptId` associe

**Items `deferred-work.md` absorbes:** D-15, D-16, D-19, D-20, D-23, D-24, D-25, D-26, D-30, D-47, D-48, D-51. Les items restants (ex. D-19 optimisation O(n) au-dela de quelques milliers d'evenements) sont explicitement documentes comme "V1 acceptable" avec justification dans la story.
