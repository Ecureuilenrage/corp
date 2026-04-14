---
inputDocuments:
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp-distillate.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md
documentCounts:
  briefs: 2
  research: 0
  brainstorming: 0
  projectDocs: 2
workflowType: prd
projectName: corp
author: darkl
date: 2026-04-08
status: complete
completedAt: 2026-04-08
classification:
  projectType: developer_tool
  domain: general
  complexity: high
  projectContext: brownfield
  rationale:
    - Le produit cible un operateur technique avance et expose un noyau d'orchestration plutot qu'une application grand public.
    - Le domaine n'est pas sectoriel ou reglemente dans les sources chargees; il est donc traite comme general.
    - La complexite est elevee a cause de l'etat durable, de la delegation multi-agents, des politiques, de l'audit et des reprises.
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
---

# Product Requirements Document - corp

**Author:** darkl
**Date:** 2026-04-08

## Executive Summary

`corp` est un coeur d'orchestration multi-agents persistant, local-first, concu pour un operateur technique unique qui doit piloter des boucles longues sans perdre la maitrise de l'etat, des politiques, des budgets, des approbations et des artefacts. Le V1 ne cherche pas a couvrir toute la surface d'une plateforme agentique generaliste. Il doit prouver une boucle exploitable et relancable de planification, delegation, execution, observation et reprise d'une mission bornee, avec validation humaine sur les actions sensibles.

Le probleme cible est la fragmentation actuelle des runtimes agentiques. Les briques utiles existent deja dans plusieurs repos de reference, mais l'etat durable reste disperse, les delegations sont peu auditables, les reprises sont fragiles et les grandes piles sont trop couplees pour etre reprises telles quelles. `corp` repond a ce manque en faisant du noyau de controle le produit: session persistante, tickets de delegation structures, journal d'artefacts et d'approbations, et couche de planification explicite.

### Ce Qui Rend Ce Produit Distinct

`corp` se differencie par une strategie d'assemblage minimale et verifiable: reutiliser des patterns credibles observes dans les analyses historiques de Claude Code ainsi que chez OpenClaw, MetaGPT et ChatDev sans copier leurs orchestrateurs monolithiques. Le V1 se concentre sur quatre primitives produit: etat durable lisible au-dela du transcript, delegation multi-agents avec responsable explicite, reprise de session sans reconstruction manuelle du contexte critique, et frontiere d'extensions explicite pour tools, skills, plugins et canaux.

Le produit est borne de facon volontaire. Il privilegie un operateur avance, une boucle unique exploitable et un regime de controle humain sur les actions sensibles. Cette borne permet de rendre concrets `KAIROS` comme posture d'assistance persistante, `ULTRAPLAN` comme couche de planification evolutive, et `COORDINATOR MODE` comme surface d'orchestration explicite, sans promettre des capacites encore non validees.

## Classification Du Projet

- Type de projet: outil developpeur local-first centre sur un runtime d'orchestration
- Domaine: general, sans verticale sectorielle reglementee etayee par les sources chargees
- Complexite: elevee, due a l'etat durable, la delegation multi-agents, les politiques, l'audit et la reprise
- Contexte projet: brownfield BMAD sur une base de connaissance existante et un brief deja etabli

## Hypotheses Explicites

- Le premier utilisateur du V1 est un operateur technique unique et avance, pas une equipe multi-tenant.
- La valeur du V1 sera jugee sur une seule boucle pilote exploitable et non sur une couverture fonctionnelle large.
- Les actions sensibles restent derriere validation humaine pendant toute la phase V1.
- Le scenario pilote du V1 est une micro-entreprise locale fortement automatisee pouvant fonctionner avec quelques profits sous supervision humaine.
- La premiere surface operateur du V1 est une CLI.
- Le runtime externe cible est Codex via API et surfaces ouvertes; aucune dependance produit a Claude Code n'est visee.

## Criteres De Succes

### User Success

Le V1 est reussi si un operateur technique unique peut ouvrir ou reprendre une mission bornee sans reconstruire manuellement le contexte critique, puis la faire progresser dans une boucle complete: planifier, deleguer, executer, observer, arbitrer et relancer. L'utilisateur doit voir clairement qui porte chaque tache, quels artefacts ont ete produits, quelles decisions ont ete prises et quelles actions attendent une approbation.

Le moment de valeur attendu n'est pas un effet "assistant magique", mais un sentiment de controle retrouve: la mission continue d'exister comme objet pilotable au-dela du transcript. L'operateur doit pouvoir interrompre la boucle, revenir plus tard et reprendre avec un niveau de confiance suffisant pour continuer sans relecture exhaustive ni chasse manuelle aux fichiers.

### Validation Produit

La reussite produit du V1 est une validation de noyau, pas une validation de marche a grande echelle. `corp` doit prouver qu'un coeur proprietaire local-first apporte une valeur distincte face a l'empilement d'outils agents existants. Le critere cle est l'adoption reelle par l'operateur fondateur pour au moins un scenario de travail recurrent juge assez important pour meriter persistance, delegation et audit. Le scenario pilote retenu est celui d'une micro-entreprise locale fortement automatisee, capable de fonctionner avec quelques profits sous supervision humaine.

Le V1 est considere comme suffisamment prometteur pour passer a l'etape suivante si la boucle pilote est repetable, si la valeur de reprise est evidente et si les briques reutilisees depuis les repos de reference peuvent etre defendues comme des choix produit coherents plutot que comme une simple integration opportuniste.

### Reussite Technique

Le systeme doit maintenir un etat durable lisible pour la session, les taches, les artefacts, les approbations et les echecs. Chaque delegation doit creer un objet suivi avec responsable explicite, statut, budget ou contrainte de ressources si applicable, et criteres de succes explicites. Les actions sensibles doivent rester bloquees derriere validation humaine.

La V1 doit aussi montrer une isolation de contexte suffisante pour limiter les collisions entre travaux, ainsi qu'une reprise robuste apres interruption. Enfin, le produit doit demontrer qu'il s'appuie sur des patterns credibles observes dans les analyses historiques de Claude Code, OpenClaw, MetaGPT et ChatDev, sans reprendre leurs composants les plus couples comme architecture cible.

### Resultats Mesurables

- Une mission pilote bornee peut etre executee de bout en bout sur un seul poste de travail dans la boucle V1 cible.
- Une session interrompue peut etre reprise sans reconstitution manuelle du contexte critique.
- Toute tache deleguee dans le pilote dispose d'un responsable, d'un statut et d'au moins un artefact ou evenement de suivi.
- Toute action sensible exposee par le pilote passe par un etat d'approbation explicite avant execution.
- Le pilote laisse un journal consultable des decisions, artefacts, echecs et reprises suffisant pour comprendre l'etat courant sans repartir du transcript brut.
- Le PRD, puis l'architecture suivante, peuvent rattacher au moins un pattern ou une contrainte cle a chacun des quatre repos de reference analyses.

## Portee Produit

### MVP - Minimum Viable Product

Le MVP se limite a une seule boucle exploitable pour le noyau d'orchestration local-first. Cette boucle couvre: creation ou reprise d'une session persistante, formulation d'une mission bornee, decomposition minimale en taches delegables, affectation a des agents ou roles specialises, execution observable, collecte d'artefacts, points d'approbation pour les actions sensibles, puis reprise ou relance de la mission apres interruption ou echec.

Le MVP inclut egalement une frontiere explicite pour tools, skills, plugins ou canaux, mais seulement au niveau necessaire pour faire fonctionner cette boucle pilote. Il n'inclut pas la compatibilite exhaustive avec tous les runtimes tiers, ni un moteur de workflow declaratif generaliste, ni un control plane cloud complet.

### Fonctions De Croissance (Post-MVP)

Apres validation du MVP, la couche growth pourra etendre la planification evolutive `ULTRAPLAN`, enrichir la surface `COORDINATOR MODE`, ajouter des comparateurs ou bancs d'evaluation de runtimes et modeles, ouvrir une registry d'extensions plus large, et formaliser davantage la gouvernance des budgets, retries et politiques. Une UI de controle plus riche, des canaux additionnels et des strategies de workflow plus declaratives appartiennent aussi a cette phase.

### Vision (Future)

A terme, `corp` vise un systeme d'exploitation agentique personnel et evolutif. `KAIROS` devient l'assistant persistant qui garde la continuite operatoire, `ULTRAPLAN` devient la couche de planification et de gouvernance extensible dans le temps, et `COORDINATOR MODE` devient le langage d'orchestration partage entre agents, outils, artefacts et futures surfaces de controle. Cette vision reste conditionnee par la validation de la boucle V1, et ne doit pas etre confondue avec le scope livre maintenant.

## Parcours Utilisateurs

### Parcours 1 - Operateur Principal, Boucle De Succes

Camille est fondateur-technique et pilote seul plusieurs chantiers assistes par IA. Son probleme n'est pas de lancer un prompt de plus, mais de reprendre des travaux longs sans perdre le fil entre contexte, sous-taches, artefacts et validations. Il ouvre `corp` pour lancer une mission bornee, par exemple preparer un livrable de recherche ou d'implementation locale. Le systeme lui permet de creer ou reprendre une session persistante, de formaliser l'objectif, de decomposer la mission en tickets de delegation et d'affecter chaque ticket a un role ou agent specialise.

Au fil de l'execution, Camille suit l'etat des tickets, consulte les artefacts remontes, arbitre les decisions et debloque uniquement les actions sensibles qui exigent son accord. Le moment de valeur arrive lorsqu'il constate que la mission reste lisible comme systeme de travail, et non comme suite de transcripts. A la fin du parcours, il dispose d'une mission cloturable ou relancable avec un historique exploitable.

### Parcours 2 - Operateur Principal, Interruption Et Reprise

Camille interrompt une mission en cours parce qu'une execution echoue, qu'un contexte local change ou qu'il doit quitter son poste. Lorsqu'il revient, son attente n'est pas de relire l'historique complet, mais de retrouver rapidement l'etat utile: objectif courant, tickets ouverts, dernier artefact pertinent, erreurs observees, validations en attente et prochaine decision a prendre.

`corp` repond a cette attente en presentant une reprise explicite. Camille identifie la tache bloquee, comprend pourquoi elle a echoue, ajuste la consigne ou la politique si necessaire, puis relance uniquement la portion de travail concernee. Le point critique de ce parcours est la confiance: si la reprise exige de recomposer manuellement l'etat, la promesse produit est rompue. Si la reprise est claire et bornee, le systeme prouve sa valeur centrale.

### Parcours 3 - Concepteur D'Extension Locale

Nora est une developpeuse avancee qui veut raccorder un tool, un skill ou un plugin local a la boucle V1. Elle n'attend pas encore une marketplace complete; elle a besoin d'une frontiere d'integration explicite pour declarer ce que l'extension fait, quelles permissions elle demande, et dans quel type de mission elle peut etre invoquee.

Son parcours commence par la declaration d'une extension compatible avec le noyau d'orchestration. Elle verifie ensuite que cette extension peut etre referencee dans une mission, appelee par un agent autorise et tracee dans le journal global. La valeur pour Nora est de pouvoir etendre `corp` sans contourner la gouvernance du systeme. Ce parcours revele que l'extensibilite du V1 doit etre reelle mais minimale, orientee execution et audit plutot que distribution a grande echelle.

### Parcours 4 - Mode Audit Et Diagnostic

Dans le V1, ce parcours peut etre porte par le meme humain que l'operateur principal. Camille passe en mode diagnostic lorsqu'une mission a produit un resultat incomplet, contradictoire ou risque. Son besoin n'est plus de faire avancer la mission immediatement, mais de comprendre ce qui s'est passe: quel agent a fait quoi, avec quels outils, quels artefacts ont ete produits, quelle decision a change la trajectoire et quelle validation a manque ou a ete refusee.

Le parcours reussi si `corp` lui donne une lecture chronologique et structuree de la mission, suffisamment detaillee pour arbitrer la suite sans fouille manuelle dans des fichiers disperses. Ce mode d'usage revele l'importance du journal d'evenements, de la trace d'approbation et du lien entre taches et artefacts. Sans cela, le noyau n'est pas verifiable et la delegation reste opaque.

### Synthese Des Exigences Revelees Par Les Parcours

Les parcours ci-dessus revelent un socle commun de capacites pour le V1: session persistante, objet mission explicite, tickets de delegation structures, statuts et responsables visibles, reprise bornee apres interruption, journal d'evenements et d'artefacts, validation humaine sur actions sensibles et frontiere d'extension suffisamment claire pour brancher des outils locaux sans casser la gouvernance.

Ils montrent aussi ce qui n'est pas encore requis pour cette version: multi-tenant, support organisationnel complexe, marketplace publique, ou interface de supervision a grande echelle. Le PRD reste donc centre sur le controle operateur et la lisibilite du travail orchestre, pas sur la sophistication prematuree des canaux ou de la distribution.

## Exigences Domaine

Le domaine retenu pour ce PRD n'est pas une verticale reglementee comme la sante ou la finance. Aucune exigence sectorielle specifique n'est donc figee a ce stade. En revanche, le produit opere dans un espace sensible: orchestration locale d'agents, de tools et d'extensions capables d'agir sur le poste de travail ou sur des ressources connectees.

### Compliance & Regulatory

- Aucune obligation sectorielle specifique n'est soutenue par les sources chargees pour le V1.
- Les exigences minimales a prendre en compte relevent de la gouvernance interne: permissions explicites, journal d'approbation et tracabilite suffisante des actions sensibles.

### Technical Constraints

- Le local-first impose que l'etat durable reste exploitable meme sans infrastructure cloud centrale.
- Le runtime externe cible retenu est Codex; aucune dependance produit a Claude Code ne doit etre supposee dans le V1.
- Les permissions, budgets, politiques et traces d'execution doivent rester des primitives du noyau plutot que des conventions applicatives.
- L'isolation des taches ou workspaces doit etre suffisante pour limiter les collisions de travail et les effets de bord.

### Integration Requirements

- Le V1 doit exposer une frontiere d'extension claire pour les tools, skills, plugins ou canaux necessaires a la boucle pilote.
- Cette frontiere doit privilegier la declaration, l'invocation controlee et la tracabilite plutot qu'un ecosysteme d'integration exhaustif.
- Les composants trop couples identifies dans les repos analyses doivent etre traites comme sources de contraintes ou de patterns, pas comme dependances a embarquer telles quelles.

### Risk Mitigations

- Risque principal: perte de confiance si la reprise de session exige une reconstruction manuelle du contexte.
  Mitigation: etat durable explicite pour mission, taches, artefacts, decisions et approbations.
- Risque principal: delegation opaque ou non auditable.
  Mitigation: tickets structures avec responsables, statuts et evenements relies.
- Risque principal: surface d'extension trop large trop tot.
  Mitigation: limiter le V1 aux integrations necessaires a la boucle pilote et garder les autres comme horizons post-MVP.

## Innovation & Novel Patterns

### Axes D'Innovation Detectes

L'innovation detectee ne tient pas a une technologie isolee, mais a une recomposition produit. `corp` propose de traiter l'orchestration agentique comme un noyau de controle local-first avec etat durable, reprise, gouvernance et delegation structuree. Cette posture se distingue des assistants conversationnels lineaires et des orchestrateurs monolithiques trop couples. Pour un outil developpeur, cela releve bien d'un signal `new paradigm` soutenu par les sources disponibles.

La nouveaute du V1 tient aussi a la clarification de trois notions souvent floues dans les notes: `KAIROS` comme posture d'assistance persistante, `ULTRAPLAN` comme planification evolutive, et `COORDINATOR MODE` comme orchestration explicite. Le PRD ne suppose pas encore un DSL ou un moteur generique complet; il demande d'abord de prouver qu'une boucle unique devient plus fiable et plus relancable quand ces primitives existent.

### Contexte De Marche Et Paysage Concurrentiel

Les analyses de reference montrent un paysage riche mais fragmente. Les analyses historiques de Claude Code apportent une boucle de session et une orchestration de sous-agents convaincantes comme source de patterns. Codex constitue la cible runtime externe retenue. OpenClaw apporte un control plane et une frontiere plugin et provider utiles. MetaGPT structure bien les roles, actions et planners. ChatDev montre la valeur des topologies de workflow. Aucun de ces repos ne couvre a lui seul la proposition `corp` telle qu'exprimee dans le brief: un centre de gravite produit unique, local-first, borne sur l'auditabilite et la reprise.

### Approche De Validation

La validation de l'innovation ne doit pas passer par un discours theorique. Elle doit passer par une demonstration simple: un operateur execute une mission pilote bornee, l'interrompt, la reprend et constate que le systeme garde le controle de l'etat mieux qu'un empilement d'outils agents non unifies. Si cette demonstration echoue, la these d'innovation n'est pas validee, meme si la pile technique reste impressionnante.

### Mitigation Des Risques

Le principal risque est de confondre innovation et surface produit excessive. La mitigation retenue dans ce PRD est stricte: une seule boucle V1, aucune promesse de couverture exhaustive des runtimes, pas de marketplace complete, et pas d'autonomie sensible sans validation humaine. Le deuxieme risque est d'utiliser les repos de reference comme architecture cible implicite; la mitigation consiste a les traiter comme reservoirs de patterns et de contraintes, pas comme systemes a recopier.

## Exigences Specifiques A L'Outil Developpeur

### Vue D'Ensemble Du Type Produit

`corp` doit etre traite comme un outil developpeur local-first, oriente pilotage de missions agentiques sur poste de travail. La valeur ne repose pas sur une interface marketing ou sur une distribution grand public, mais sur une surface d'usage fiable pour un operateur avance, une extensibilite controlee et une lisibilite forte de l'etat du systeme.

### Contraintes Structurantes

Le produit doit privilegier un noyau unique et coherent avant toute strategie multi-runtime ou multi-shell. Les sources chargees soutiennent la necessite d'un moteur de session et d'orchestration durable, d'une frontiere d'extensions claire, et d'une isolation suffisante des taches. Elles ne soutiennent pas encore le choix definitif d'un shell principal unique, d'un protocole public stable ou d'une compatibilite complete entre runtimes tiers; ces points restent donc des contraintes de conception, pas des decisions acquises.

### Matrice De Langages

Le V1 ne doit pas viser une matrice multi-langages complete. Il doit d'abord fournir une seule pile d'implementation et d'usage suffisamment stable pour valider la boucle pilote. La question d'exposer plus tard des SDK ou bindings additionnels est explicitement hors du scope MVP et devra dependre de l'architecture retenue apres validation du noyau.

### Modalites D'Installation

Le produit doit pouvoir etre installe, initialise et relance de facon deterministe sur un poste local unique. Le PRD n'impose pas encore un mode de distribution final unique, mais il impose la contrainte suivante: le bootstrap du V1 doit etre assez simple pour ne pas masquer la valeur produit derriere une procedure d'installation fragile. Le choix entre package manager, distribution binaire, ou shell embarque reste ouvert.

### Surface Produit

Le V1 doit exposer au minimum deux surfaces claires:

- une surface operateur pour creer, reprendre et piloter une mission;
- une surface d'extension pour declarer ou invoquer tools, skills, plugins ou canaux necessaires a cette mission.

La surface operateur retenue pour le V1 est une CLI. Une TUI ou une UI locale minimale pourront etre evaluees plus tard. En revanche, toute surface doit respecter les memes primitives de session, delegation, approbation et audit.

### Exemples Canoniques Et Contrats D'Usage

Le V1 doit etre demonstrable par des scenarios d'usage reproductibles de la boucle pilote. Pour ce stade, les `code examples` attendus sont moins des snippets SDK publics qu'un petit nombre d'exemples canoniques montrant comment une mission est creee, deleguee, reprise et auditee. Ces exemples serviront de contrats d'usage pour verifier que la surface produit reste coherente.

### Adoption Et Migration

L'adoption initiale ne porte pas sur une migration vendor-to-vendor exhaustive. Elle porte sur le passage d'un empilement manuel de sessions, scripts et outils agents a un noyau unique de pilotage persistant. Le PRD doit donc viser une adoption incrementale: rendre utile la boucle V1 sans exiger que l'utilisateur remplace des le premier jour tout son environnement existant.

### Questions A Transmettre A L'Architecture

- Quelle forme prend l'objet mission et ticket au niveau du contrat interne.
- Quel niveau de dependance est acceptable vis-a-vis des surfaces API et CLI de Codex.
- Quel mecanisme minimal garantit la persistence et la reprise sans coupler excessivement le noyau a une pile tierce.

## Cadrage Et Developpement Phase

### Strategie MVP

**Approche MVP:** MVP de validation du probleme et de la boucle d'usage. L'objectif n'est pas de montrer toutes les fonctions imaginables d'un orchestrateur agentique, mais de prouver qu'une mission bornee devient pilotable, relancable et auditable quand l'etat durable, la delegation structuree et la validation humaine sont placees au coeur du produit.

**Contraintes de ressources:** le scope doit rester compatible avec un effort initial tres concentre porte par un operateur fondateur ou une equipe tres reduite. Toute exigence qui supposerait des equipes dediees a la plateforme, au cloud, au multi-tenant ou a un ecosysteme de distribution doit etre consideree hors du MVP.

### Contenu Du MVP (Phase 1)

**Parcours couverts:**

- creation ou reprise d'une mission persistante par l'operateur principal;
- delegation de taches bornees a des agents ou roles specialises;
- observation, arbitrage et approbation des actions sensibles;
- reprise apres interruption ou echec avec etat lisible;
- lecture d'un journal d'artefacts et de decisions pour audit minimal.

**Capacites indispensables:**

- session persistante locale avec etat de mission durable;
- objet mission et ticket explicite avec responsable, statut et criteres de succes;
- execution observable et artefacts relies aux taches;
- points d'approbation humains sur les actions sensibles;
- reprise ciblee d'une mission sans relecture exhaustive du transcript;
- frontiere minimale d'extension pour les tools, skills, plugins ou canaux necessaires au pilote.

### Phases Post-MVP

**Phase 2 (Post-MVP):**

- planification plus riche autour de `ULTRAPLAN`;
- orchestration multi-agents plus expressive dans `COORDINATOR MODE`;
- registry d'extensions plus large et politiques plus fines de budgets, retries et permissions;
- surfaces de controle plus riches pour pilotage et observation.

**Phase 3 (Expansion):**

- assistance persistante plus ambitieuse autour de `KAIROS`;
- control plane plus large, potentiellement distribue ou partage;
- compatibilite accrue avec plusieurs runtimes et providers;
- workflows plus declaratifs et ecosysteme d'extensions etendu.

### Strategie De Mitigation Des Risques

**Risques techniques:** le risque majeur est de sous-estimer la difficulte de maintenir un etat durable propre tout en gardant l'isolation de taches et une reprise fiable. Mitigation: limiter le MVP a une seule boucle, a un seul cas pilote et a des primitives de noyau explicitement tracees.

**Risques produit:** le risque majeur est qu'un noyau tres ambitieux reste abstrait s'il n'incarne pas une mission utile des le V1. Mitigation: choisir une boucle pilote concrete et juger le produit sur la reprise, la lisibilite et la delegation plutot que sur une surface de features.

**Risques de ressources:** le risque majeur est la derive de scope vers un clone de plateforme generale. Mitigation: repousser les ambitions cloud, multi-tenant, marketplace, compatibilite exhaustive et automatisation sensible autonome aux phases ulterieures.

## Exigences Fonctionnelles

### Mission & Session Lifecycle

- FR1: Un operateur peut creer une mission persistante a partir d'un objectif explicite.
- FR2: Un operateur peut reprendre une mission existante avec un resume de son etat courant.
- FR3: Un operateur peut consulter l'etat global d'une mission, y compris les taches ouvertes, les validations en attente et les derniers artefacts pertinents.
- FR4: Un operateur peut mettre en pause, cloturer ou relancer une mission sans perdre son historique.

### Planning & Delegation

- FR5: Un operateur peut definir pour une mission des criteres de succes et des contraintes explicites.
- FR6: Un operateur peut decomposer une mission en taches bornees et suivables.
- FR7: Un operateur peut affecter chaque tache a un role, un agent ou une capacite specialisee.
- FR8: Un operateur peut associer a une tache un perimetre d'action, des outils autorises et des contraintes d'usage.
- FR9: Un operateur peut reprioriser, modifier ou annuler des taches en cours de mission.

### Execution & Artifact Flow

- FR10: Un operateur peut lancer l'execution d'une tache deleguee dans le cadre d'une mission.
- FR11: Un operateur peut suivre l'avancement et les changements d'etat de chaque tache.
- FR12: Un operateur peut acceder aux artefacts produits par chaque tache depuis le contexte de mission.
- FR13: Un operateur peut relier une decision, un artefact ou un evenement a la tache qui l'a genere.
- FR14: Un operateur peut voir lorsqu'une tache est bloquee, echoue ou requiert une action complementaire.

### Supervision Et Validation Humaine

- FR15: Un operateur peut identifier les actions classees comme sensibles avant leur execution.
- FR16: Un operateur peut approuver, refuser ou differer une action sensible.
- FR17: Un operateur peut consulter le contexte necessaire pour arbitrer une demande d'approbation.
- FR18: Un operateur peut definir ou modifier des politiques, budgets ou garde-fous applicables a une mission ou a une tache.

### Reprise Et Auditabilite

- FR19: Un operateur peut reprendre une mission apres interruption sans reconstruire manuellement le contexte critique.
- FR20: Un operateur peut consulter un historique structure des decisions, validations, echecs, reprises et evenements de mission.
- FR21: Un operateur peut identifier quel role, agent ou extension est a l'origine d'un artefact ou d'un evenement.
- FR22: Un operateur peut comparer l'etat courant d'une mission a son objectif et a ses criteres de succes.
- FR23: Un operateur peut relancer uniquement la partie impactee d'une mission apres un blocage ou un echec.

### Surface D'Extension Et D'Integration

- FR24: Un concepteur d'extension peut enregistrer un tool, skill, plugin ou canal local pour un usage controle dans une mission.
- FR25: Un concepteur d'extension peut declarer les permissions ou contraintes d'usage associees a une extension.
- FR26: Un operateur peut selectionner quelles extensions sont disponibles pour une mission donnee.
- FR27: Un operateur peut voir quelles extensions ou quels outils ont ete mobilises dans le deroulement d'une tache.
- FR28: Un operateur peut utiliser la meme logique de mission, de delegation et d'audit quelle que soit la surface operateur retenue pour le V1.

## Exigences Non Fonctionnelles

### Performance

- Pour le pilote V1, la reprise d'une mission persistante doit restituer dans un meme flux l'objectif courant, les taches ouvertes, les validations en attente et le dernier artefact pertinent, sans reconstruction manuelle du contexte critique.
- Le produit doit permettre a un operateur unique de suivre une mission pilote de bout en bout sur un poste local sans qu'une latence ou une opacite d'etat ne bloque une decision necessaire a la boucle.
- Tout changement d'etat significatif d'une tache doit devenir visible dans le contexte de mission avant qu'une decision dependante ne soit requise.

### Securite

- 100% des actions sensibles exposees par le V1 doivent exiger une approbation humaine explicite avant execution.
- Les permissions ou contraintes associees a une extension doivent etre consultables avant son activation dans une mission.
- Le produit doit conserver une trace des validations, refus et delegations suffisante pour audit posteriori.
- Les identites, secrets ou credentials eventuellement mobilises par des runtimes externes doivent etre traites comme des zones de risque; aucune hypothese de coexistence transparente ne doit etre supposee sans validation ulterieure.

### Fiabilite Et Reprise

- Une interruption de session ne doit pas effacer l'etat durable deja confirme d'une mission, de ses taches ou de ses artefacts.
- Une tache en echec doit rester inspectable et relancable sans forcer la recreation complete de la mission.
- Le systeme doit distinguer clairement les elements completes, en attente, bloques et rejetes afin d'eviter les reprises ambigues.
- Le journal de mission doit rester suffisamment coherent pour permettre un diagnostic a posteriori d'un blocage ou d'une decision.

### Integration

- La boucle V1 doit rester operationnelle avec un ensemble minimal d'extensions locales, sans dependre d'un ecosysteme d'integrations exhaustif.
- 100% des integrations utilisees dans une mission pilote doivent etre attribuables a un evenement, une tache ou un artefact du journal.
- Le produit doit pouvoir borner l'usage d'une integration a une mission ou a une tache specifique lorsque cela est requis par la politique.

## Questions Ouvertes

- Quelle forme produit doit prendre l'objet mission et ticket pour rester stable entre planification, delegation, execution et reprise ?
- Quelle frontiere minimale d'extension faut-il posseder des maintenant pour les tools, skills, plugins ou canaux, et que peut-on laisser hors V1 ?
- Quel niveau d'autonomie economique et operationnelle du scenario de micro-entreprise locale rentable faut-il viser des le pilote V1, et lequel doit rester hors scope ?
- Quel niveau de dependance est acceptable vis-a-vis des surfaces API et CLI de Codex des la premiere architecture ?
