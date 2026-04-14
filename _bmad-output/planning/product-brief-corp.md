---
title: "Product Brief: corp"
status: "complete"
created: "2026-04-08T18:41:19.1640400+02:00"
updated: "2026-04-08T18:41:19.1640400+02:00"
inputs:
  - "C:/Dev/PRJET/corp/ideation-projet.Md"
  - "C:/Dev/PRJET/corp/besoins.md"
  - "C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md"
  - "C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md"
  - "C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/index.md"
  - "C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b01-core-bootstrap-session-loop.md"
  - "C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b04-agent-orchestration.md"
  - "C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/reuse/reuse-candidates.md"
  - "C:/Dev/PRJET/Openclaw/openclaw-main/analysis/index.md"
  - "C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-03-gateway-control-plane.md"
  - "C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-04-plugin-platform-sdk.md"
  - "C:/Dev/PRJET/Openclaw/openclaw-main/analysis/reuse/reuse-candidates.md"
  - "C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/index.md"
  - "C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/batches/02-agent-orchestration.md"
  - "C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/reuse/reuse-candidates.md"
  - "C:/Dev/PRJET/chatdev/ChatDev-main/analysis/index.md"
  - "C:/Dev/PRJET/chatdev/ChatDev-main/analysis/batches/02-workflow-orchestration.md"
  - "C:/Dev/PRJET/chatdev/ChatDev-main/analysis/reuse/reuse-candidates.md"
assumptions:
  - "Le premier utilisateur cible est un operateur fondateur ou developpeur avance qui pilote lui-meme le systeme."
  - "Le V1 reste local-first et conserve les actions sensibles derriere validation humaine."
  - "KAIROS, ULTRAPLAN et COORDINATOR MODE sont des axes produit a clarifier, pas des fonctions deja figees."
  - "Le scenario pilote du V1 est une micro-entreprise locale fortement automatisee qui peut fonctionner avec quelques profits sous supervision humaine."
  - "La premiere surface operateur du V1 est une CLI."
  - "La cible runtime externe retenue est Codex; Claude Code n'est pas une dependance produit."
---

# Product Brief: corp

## Resume executif

`corp` vise a devenir un runtime multi-agents persistant, local-first, capable de planifier, deleguer, executer, observer et relancer des travaux de maniere controlee depuis un poste de travail unique. Le besoin central ne porte pas sur un simple assistant conversationnel, mais sur un coeur produit qui garde la maitrise de l'etat durable, des policies, des budgets, des approbations et des artefacts quand plusieurs agents, outils et canaux cooperent.

Les analyses de reference montrent que le marche open source propose deja des briques fortes mais fragmentees. Les analyses historiques de Claude Code restent utiles comme source de patterns pour la boucle de session et l'orchestration, mais `corp` ne vise pas une dependance produit a Claude Code. La cible runtime externe retenue est Codex. OpenClaw apporte un control plane longue duree, une surface gateway, et une frontiere plugin/SDK exploitable. MetaGPT apporte un modele equipe-role-action-planificateur utile pour la delegation structuree. ChatDev apporte un moteur declaratif centre sur graphes et workflows YAML. `corp` ne doit pas recopier ces piles en bloc; il doit assembler leurs briques reutilisables dans un coeur proprietaire plus cohese et plus auditable.

Le premier objectif produit est donc simple: prouver une boucle exploitable de coordination multi-agents pour un operateur avance, avec etat persistant, delegation structuree, isolation de contexte et journal d'artefacts. Dans ce cadre, `KAIROS` represente l'assistant persistant, `ULTRAPLAN` la couche de planification evolutive, et `COORDINATOR MODE` la surface d'orchestration multi-agents que le produit devra rendre concrete.

## Le probleme

Aujourd'hui, un operateur qui veut orchestrer un travail agentique longue duree doit jongler entre plusieurs runtimes qui gerent chacun une partie du probleme: boucle de session, outillage, plugins, control plane, roles, workflows, memoire, canaux et approbations. Cette fragmentation cree quatre douleurs majeures:

- l'etat durable est disperse entre sessions, scripts, outils et providers;
- les delegations multi-agents sont souvent implicites, peu auditables et difficiles a reprendre;
- les politiques de securite, de permissions et de validation humaine ne restent pas au centre;
- les briques reutilisables existent, mais les gros orchestrateurs sont trop couples pour etre repris tels quels.

Les analyses confirment ce constat. Les analyses historiques de Claude Code exposent de bonnes briques autour de `query.ts`, de la session et des worktrees, mais leur bootstrap global reste tres couple. OpenClaw offre un excellent noyau plugin/gateway, mais son `server.impl.ts` est trop central pour etre copie brut. MetaGPT montre comment structurer des roles, des actions et un planner, mais sa chaine "software company" est fortement dependante de ses conventions documentaires. ChatDev propose une topologie de graphes et de sous-graphes interessante, mais son `GraphExecutor` embarque deja une large partie du runtime agentique.

## La solution

`corp` doit fournir un noyau d'orchestration local-first qui unifie quatre capacites:

1. un etat persistant de session, de taches et d'artefacts;
2. une delegation multi-agents structuree par tickets, ownership, budgets et criteres de succes;
3. une couche de planification et de reprise explicite, capable d'evoluer dans le temps;
4. une frontiere d'extensions claire pour outils, skills, plugins, canaux et futurs adaptateurs providers.

Le produit doit s'appuyer sur des briques deja observees dans les analyses, pas sur des promesses abstraites. Cote analyses historiques de Claude Code et pile Codex, les briques les plus utiles sont la boucle de query, les snapshots de contexte, la memoire locale, les worktrees et la gouvernance de fin de tour. Cote OpenClaw, les briques les plus prometteuses sont le shell de control plane, le routage par session-key, la gestion des subscriptions, et le DSL d'entree plugin/provider. Cote MetaGPT, la valeur vient du contrat `Team` / `Role` / `Action` / `Planner`, plus que de la chaine logicielle complete. Cote ChatDev, la valeur vient de la separation `GraphManager` / `ExecutionStrategy` / `subgraph_loader`, plus que du runtime entier.

## Ce qui rend corp different

- `corp` est pense comme un coeur proprietaire de controle, pas comme une surcouche fragile au-dessus d'un runtime tiers.
- Le produit privilegie des extractions minimales et verifiables plutot que la copie de gros orchestrateurs couples.
- La delegation vise des tickets structures et auditables, pas une conversation libre continue entre agents.
- Le positionnement initial est volontairement borne: un seul operateur, une boucle controlee, des validations humaines sur les actions sensibles.

## Qui cela sert

Le premier utilisateur cible est un builder technique avance: fondateur solo, operateur IA, ou developpeur qui veut piloter des boucles longues de recherche, planification, execution et suivi sans perdre le controle du systeme. Cet utilisateur a besoin de vitesse, mais surtout de reprise, de lisibilite et de confiance dans l'etat du systeme.

A moyen terme, `corp` peut s'etendre a des equipes reduites qui veulent partager un meme noyau d'orchestration et un meme registre de plugins ou skills. Cette extension n'est pas necessaire pour valider le V1.

## Criteres de succes

- Un operateur peut relancer une session persistante sans reconstituer manuellement le contexte critique.
- Une mission bornee peut etre planifiee, deleguee, suivie et reprise avec traces de taches, statuts et artefacts.
- Les actions sensibles restent derriere approbation humaine dans le V1.
- Le produit demontre au moins une brique ou un pattern reutilise ou traduit de facon credible depuis chacun des quatre repos de reference.
- Les concepts `KAIROS`, `ULTRAPLAN` et `COORDINATOR MODE` sont convertis en primitives produit comprenables plutot qu'en labels flous.

## Scope initial

Dans le perimetre V1:

- noyau local-first avec etat durable de session, taches et artefacts;
- delegation multi-agents structuree et observable;
- isolation de contexte suffisante pour limiter les collisions de travail;
- frontiere explicite pour plugins, skills, outils et canaux;
- une boucle produit exploitable: planifier, deleguer, executer, observer, relancer.

Hors scope V1:

- automatisation autonome des actions sensibles comme publication, paiement ou outbound non valide;
- promesse de compatibilite totale avec tous les runtimes tiers;
- copie monolithique des quatre repos analyses;
- multi-tenant SaaS, operations cloud complexes, ou packaging commercial fige.

## Vision

Si `corp` reussit, il devient un systeme d'exploitation agentique personnel et evolutif. `KAIROS` devient la couche d'assistance persistante, `ULTRAPLAN` la couche de planification et de gouvernance qui peut depasser le simple poste local, et `COORDINATOR MODE` la langue commune pour orchestrer agents, outils et artefacts sans perdre l'auditabilite du systeme. La promesse n'est pas de remplacer tous les runtimes existants, mais de leur donner un centre de gravite produit unique, local-first et controle.

## Questions ouvertes

- Quelle forme doit prendre l'objet mission/ticket pour rester stable entre planification, delegation, execution et reprise ?
- Quelle frontiere minimale doit etre possedee des maintenant par `corp` pour les tools, skills, plugins ou canaux ?
- Quel niveau d'autonomie economique et operationnelle du scenario "entreprise qui fonctionne seule avec quelques profits" doit etre vise des le pilote V1, et lequel doit rester hors scope ?
- Quel niveau minimum de journal d'audit et de reprise est non negociable pour considerer le V1 credible ?
