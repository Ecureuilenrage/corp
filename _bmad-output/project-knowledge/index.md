# Index de connaissance projet

Ce dossier sert de base de connaissance BMAD pour le projet coeur situe dans `C:\Dev\PRJET\corp`.

## Sources fondatrices

- [Vision longue](../../ideation-projet.Md)
- [Besoins initiaux](../../besoins.md)
- [Vue d'ensemble projet](project-overview.md)

## Repositories analyses a reutiliser

- [Claude Code analysis index](../../../claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/index.md)
- [OpenClaw analysis index](../../../Openclaw/openclaw-main/analysis/index.md)
- [MetaGPT analysis index](../../../metagpt/MetaGPT-main/analysis/index.md)
- [ChatDev analysis index](../../../chatdev/ChatDev-main/analysis/index.md)

## Angles de lecture recommandes

1. Analyses historiques Claude Code: bootstrap de session, boucle de requete, outils, orchestration, MCP, memoire.
2. OpenClaw: plugin platform, gateway, runtime agent, channels, providers et UI de controle.
3. MetaGPT: orchestration d'equipe, planning, actions, provider layer, tools et knowledge flows.
4. ChatDev: grammaire de workflow, runtime agent, fonctions/outils/MCP, sessions serveur et surface YAML.

## Hypotheses de reutilisation

- Le coeur cible est un orchestrateur multi-agents persistant et local-first.
- `KAIROS`, `ULTRAPLAN` et `COORDINATOR MODE` sont des concepts de travail a clarifier dans le brief produit.
- Les analyses historiques de Claude Code servent surtout de reference pour la boucle agentique, les outils, la memoire et l'integration IDE. La cible runtime externe retenue pour `corp` est Codex.
- OpenClaw sert surtout de reference pour les skills, les channels, la gateway et certains plugins.
- MetaGPT sert surtout de reference pour les roles, SOP, planification et abstractions LLM.
- ChatDev sert surtout de reference pour les workflows declaratifs, le runtime de graphes et la surface no-code.

## Prochains artefacts BMAD cibles

- `planning/product-brief-*.md`
- `planning/prd.md`
- `planning/architecture.md`
- `planning/epics.md`
- `implementation/*.md`
