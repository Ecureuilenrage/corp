---
title: "Product Brief Distillate: corp"
type: llm-distillate
source: "product-brief-corp.md"
created: "2026-04-08T18:41:19.1640400+02:00"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: corp

## Positionnement et cadre

- Produit coeur confirme par les sources locales: runtime multi-agents persistant, local-first, oriente planification, delegation, execution, observation et relance controlee.
- `corp` est traite comme racine produit BMAD. Les artefacts doivent vivre dans `C:/Dev/PRJET/corp/_bmad-output`.
- Les concepts `KAIROS`, `ULTRAPLAN` et `COORDINATOR MODE` existent dans les notes et dans les analyses Claude Code, mais restent a transformer en primitives produit claires.
- Les analyses ne justifient pas une copie monolithique d'un repo de reference; elles justifient des extractions ou reecritures par briques.

## Sources et signaux de reuse

- Claude Code B01: forte valeur sur bootstrap trust-aware, snapshots de contexte, query loop, governance de fin de tour, engine headless/SDK.
- Claude Code B04: forte valeur sur sous-agents, task list persistante, mailbox inter-agents, plan mode, worktrees et coordination.
- Claude Code reuse: fortes briques `query_loop_skeleton`, `session_context_snapshot`, `skill_loader_minimal`, `mcp_client_minimal`, `memdir_local_minimal`, `settings/policy minimale`.
- OpenClaw batch 03: forte valeur sur control plane longue duree, request envelope, node subscriptions, session-key routing, control UI bootstrap.
- OpenClaw batch 04: forte valeur sur DSL plugin/provider, registration capture harness, package bridge pattern, boundary plugin/runtime.
- OpenClaw reuse: bons points d'entree sur session-key routing, plugin entry DSL, provider entry DSL, node subscription plane, tool-dispatch bridge; `server.impl.ts` et le runtime embedded complet sont explicitement a reecrire.
- MetaGPT B02: valeur sur `Team`, `Role`, `Action`, `Planner`, `RoleZero`, `DataInterpreter`, boucle multi-role et publication de messages.
- MetaGPT reuse: bonnes briques `Team` shell, `Role` runtime contract, `BaseLLM` registry, `tool_registry`, `Environment API registry`; la chaine "software company" complete est trop couplee.
- ChatDev B02: valeur sur `GraphManager`, `GraphTopologyBuilder`, `ExecutionStrategy`, `subgraph_loader`, dynamic edges, artifact hook.
- ChatDev reuse: tres bonnes briques `message contract`, `generic registry`, `function schema catalog`, `schema bootstrap registry`, `node registry factory`, `provider registry abstraction`, `schema exporter`.

## Hypotheses explicites retenues pour ce brief

- Le premier utilisateur cible est un operateur technique unique et avance, pas une organisation multi-tenant.
- Le V1 doit rester local-first avant toute ambition cloud large.
- Les actions sensibles doivent rester soumises a validation humaine au demarrage.
- Le premier livrable produit n'est pas une plateforme generaliste complete, mais une boucle exploitable et verifiable.
- Le scenario pilote vise une micro-entreprise locale fortement automatisee pouvant fonctionner avec quelques profits sous supervision humaine.
- La premiere surface operateur retenue pour le V1 est une CLI.
- Le runtime externe cible est Codex; aucune dependance produit a Claude Code ne doit etre supposee.

## Pistes produit deja visibles dans les notes

- Le besoin n'est pas "un simple assistant", mais un orchestrateur persistant avec policy engine, etat durable et workers specialises.
- La logique de delegation doit passer par tickets structures, budgets, outils autorises, delais, criteres de succes et politique de retry.
- Le systeme doit privilegier peu de roles persistants au debut, puis charger les expertises comme skills a la demande.
- L'utilisateur veut expliciter "qui est meilleur a quoi" entre runtimes ou modeles, mais les notes recommandent que cette table vienne d'un banc d'evaluation maison, pas d'opinions statiques.

## Requirements hints a conserver pour le PRD

- Etat durable lisible et auditable au-dela du transcript conversationnel.
- Journal des couts, approbations, artefacts, decisions, reprises et echecs.
- Delegation multi-agents observable avec ownership clair.
- Isolation suffisante des taches ou workspaces pour eviter les collisions.
- Surface d'extensions pour plugins, skills, tools, MCP ou canaux.
- Reprise de session et continuite sans rechargement manuel de contexte critique.
- Support d'une couche de planification explicite et evolutive liee a `ULTRAPLAN`.
- Support d'une posture assistant persistant liee a `KAIROS`.
- Support d'une orchestration multi-agents explicite liee a `COORDINATOR MODE`.

## Contraintes et limites deja identifiees

- La cible runtime externe retenue est Codex; aucune coexistence produit avec Claude Code ne doit etre supposee.
- Les quatre repos de reference couvrent des briques utiles, mais aucun ne doit etre traite comme architecture cible complete.
- Les analyses signalent des zones trop couplees a eviter en copie: `main.tsx` / `bootstrap/state.ts` cote Claude, `server.impl.ts` cote OpenClaw, `software_company.py` cote MetaGPT, `workflow/graph.py` cote ChatDev.
- Les notes mentionnent d'autres repos potentiellement utiles (`oh-my-openagent`, `clawhip`, `oh-my-codex`) mais ils ne sont pas analyses; il ne faut donc pas en deriver de decisions produit a ce stade.

## Scope signals

- In scope probable V1: noyau de session persistante, task runtime observable, delegation structuree, policies, artefacts, plugins/skills/outils, une boucle pilotee par un operateur.
- Out of scope probable V1: publication sensible autonome, paiement autonome, outreach autonome, multi-tenant, compatibilite exhaustive avec tous les vendors, copie integrale de runtimes existants.
- Ambition medium term: ajouter surfaces de control plane plus riches, planification plus evolutive, canaux et ecosysteme d'extensions.

## Rejected ideas ou non-decisions a garder visibles

- Ne pas prendre OpenClaw comme "cerveau central"; la note recommande de le traiter plutot comme couche canaux/skills/gateway selon besoin.
- Ne pas prendre la chaine MetaGPT "software company" complete comme V1; trop couplee a ses conventions.
- Ne pas prendre `workflow/graph.py` de ChatDev comme noyau copiable tel quel; preferer les briques topology/subgraph/scheduler.
- Ne pas faire reposer la strategie produit sur un leak ou une seule pile vendor.

## Questions ouvertes a transmettre a la prochaine etape

- Quelle forme doit prendre l'objet mission/ticket pour rester stable entre planification, delegation, execution et reprise ?
- Quelle brique devient le centre de gravite du V1: query loop, task runtime, plugin registry, ou workflow engine ?
- Quelle definition produit exacte donner a `KAIROS`, `ULTRAPLAN` et `COORDINATOR MODE` pour eviter trois concepts qui se chevauchent ?
- Quelle frontiere minimale faut-il posseder des maintenant pour les tools, skills, plugins ou canaux, et que peut-on laisser hors V1 ?
