# Vue d'ensemble projet

## Intention actuelle

Le projet coeur vise un runtime multi-agents persistant, local-first, capable de planifier, deleguer, executer, observer et relancer des travaux de maniere controlee.

## Concepts deja identifies

- `KAIROS`: assistant persistant autonome.
- `ULTRAPLAN`: couche de planification evolutive et potentiellement cloud.
- `COORDINATOR MODE`: orchestration multi-agents avec delegation structuree.

## Contraintes et questions ouvertes

- Partir sur `Codex` comme runtime externe cible et ne pas supposer de coexistence produit avec `Claude Code`.
- Garder les actions sensibles derriere validation humaine au debut.
- Favoriser un coeur proprietaire pour l'etat durable, les policies, les budgets, les reprises et l'audit.

## Cartographie de reuse

- Analyses historiques Claude Code:
  boucle de session, couche outils, permissions, orchestration, MCP, memoire, integration IDE.
- OpenClaw:
  channels, gateway, plugins, skills, UI de controle, surfaces desktop/mobile.
- MetaGPT:
  roles, team orchestration, action planning, provider abstraction, knowledge and RAG seams.
- ChatDev:
  workflow topology, runtime declaratif, fonctions/outils/MCP, API serveur et workbench frontend.

## Sequence BMAD recommandee

1. Produire un product brief centre sur le probleme, la proposition de valeur et le perimetre V1.
2. Deriver une architecture cible a partir du brief et de la cartographie des 4 repos.
3. Ecrire un PRD concentre sur une seule boucle produit exploitable.
4. Decouper en epics et stories une fois le coeur V1 stabilise.

## Decision provisoire

Le dossier `corp` est traite comme racine produit BMAD.
