---
title: "Technical Research: corp V1 architecture foundation"
status: complete
created: 2026-04-08
updated: 2026-04-08
workflowType: technical_research
research_type: technical
research_topic: "corp V1 architecture foundation for a Codex-backed local-first orchestration kernel"
research_goals:
  - "Clarifier la forme minimale et stable de l'objet mission/ticket pour V1."
  - "Definir la frontiere minimale d'extension a posseder des le V1."
  - "Borner le niveau de dependance acceptable vis-a-vis des surfaces API/CLI de Codex."
  - "Preparer directement l'etape BMAD d'architecture, sans passer a l'implementation."
stepsCompleted:
  - step-01-scope-confirmation
  - step-02-technology-stack-analysis
  - step-03-integration-patterns
  - step-04-architectural-patterns
  - step-05-implementation-research
  - step-06-research-synthesis
inputDocuments:
  - C:/Dev/PRJET/corp/_bmad/bmm/config.yaml
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp-distillate.md
  - C:/Dev/PRJET/corp/_bmad-output/planning/prd.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md
  - C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md
  - C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b01-core-bootstrap-session-loop.md
  - C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b04-agent-orchestration.md
  - C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/reuse/reuse-candidates.md
  - C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-03-gateway-control-plane.md
  - C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-04-plugin-platform-sdk.md
  - C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/batches/02-agent-orchestration.md
  - C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/reuse/reuse-candidates.md
  - C:/Dev/PRJET/chatdev/ChatDev-main/analysis/batches/02-workflow-orchestration.md
  - C:/Dev/PRJET/chatdev/ChatDev-main/analysis/reuse/reuse-candidates.md
webSources:
  - https://developers.openai.com/api/docs/models/gpt-5-codex
  - https://developers.openai.com/api/docs/models/all
  - https://developers.openai.com/api/docs/guides/background
  - https://developers.openai.com/codex/noninteractive
  - https://developers.openai.com/codex/sdk
  - https://developers.openai.com/codex/mcp
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/skills
  - https://developers.openai.com/codex/plugins
  - https://developers.openai.com/codex/agent-approvals-security
  - https://developers.openai.com/codex/guides/agents-sdk
assumptions:
  - "La demande utilisateur dans cette fenetre vaut confirmation explicite du scope de recherche BMAD; aucune sous-validation supplementaire n'a ete demandee."
  - "Le scenario pilote V1 reste mono-operateur, local-first, avec supervision humaine sur les actions sensibles."
  - "La premiere surface operateur V1 est une CLI `corp`, meme si l'execution externe peut passer par plusieurs adaptateurs Codex."
  - "Le runtime externe cible reste Codex; aucune hypothese de dependance produit a Claude Code n'est retenue."
  - "Les analyses locales sont la source principale pour les patrons d'architecture; la documentation OpenAI officielle borne seulement les surfaces Codex actuelles."
---

# Technical Research: corp V1 architecture foundation

## Research Overview

Cette recherche technique BMAD prepare directement l'architecture V1 de `corp` sans la produire encore. Le cadrage croise trois classes de preuves: les artefacts BMAD deja etablis dans `corp`, les analyses locales des quatre repos de reference, et la documentation officielle OpenAI/Codex actuelle pour borner proprement les surfaces externes disponibles.

La conclusion centrale est la suivante: le centre de gravite du V1 ne doit pas etre un query loop, un plugin runtime, ni un moteur de graphes generaliste. Le coeur V1 doit etre un noyau de mission persistante avec tickets structures, journal d'evenements et d'artefacts, et adaptateurs d'execution vers Codex. Les details propres a Codex, comme `threadId`, `response_id`, `codex exec`, `AGENTS.md`, `skills` ou `plugins`, doivent rester dans des couches d'adaptation et non contaminer le contrat produit coeur.

## Technical Research Scope Confirmation

Sujet confirme pour cette fenetre: preparation directe de l'architecture V1 de `corp` autour de trois inconnues critiques:

- forme de l'objet mission/ticket
- frontiere minimale d'extension
- niveau de dependance acceptable vis-a-vis des surfaces API/CLI de Codex

Methodologie appliquee:

- lecture des artefacts BMAD existants du projet
- extraction des plus petites briques reutilisables depuis les analyses locales
- verification de surface via la documentation officielle OpenAI/Codex uniquement
- formulation de decisions techniques proposees, explicites, et separees des hypotheses

## Executive Summary

Decision proposee 1, confiance haute: le centre de gravite de `corp` V1 doit etre un `mission kernel` persistant oriente tickets. Cette decision est soutenue par le PRD, par la task list persistante verrouillee avec ownership et blocking graph vue dans l'analyse B04 de Claude Code, et par les besoins de reprise, d'audit et d'approbation exposes dans les parcours V1.

Decision proposee 2, confiance haute: la forme minimale stable est un contrat a deux niveaux. `Mission` porte l'objectif, les politiques, l'index d'artefacts et la reprise. `Ticket` porte le travail delegable, l'owner, l'etat, les dependances, les contraintes et les sorties. Les identifiants propres a Codex doivent vivre dans un `execution_handle.adapter_state`, pas dans le schema coeur.

Decision proposee 3, confiance haute: la frontiere minimale d'extension V1 doit se limiter a trois seams: adaptateur d'execution, registre de capacites outillees, et skill-pack local. Les plugins generalistes, channels, control plane distribue et workflow engine declaratif complet doivent rester hors du V1.

Decision proposee 4, confiance moyenne a haute: la dependance acceptable a Codex doit etre `API-first, CLI-available, Codex-native UX optional`. Le produit peut s'appuyer sur la Responses API et, si necessaire, sur background mode pour les runs longs. `codex exec --json`, le Codex SDK et le mode MCP server sont de bons adaptateurs secondaires, mais les concepts `AGENTS.md`, `plugins`, `skills`, slash commands et `config.toml` ne doivent pas devenir des primitives coeur de `corp`.

## 1. Cadre de decision

Les artefacts BMAD existants convergent deja sur plusieurs contraintes non negotiables:

- `corp` doit rester local-first, mono-operateur au demarrage, avec supervision humaine sur les actions sensibles.
- le scenario pilote V1 est une micro-entreprise locale fortement automatisee pouvant fonctionner avec quelques profits sous supervision humaine.
- la premiere surface operateur V1 est une CLI.
- la reprise, l'audit et les artefacts doivent exister au-dela du transcript brut.
- la cible runtime externe retenue est Codex, pas Claude Code.

Les analyses de reference ajoutent une lecture plus precise:

- Claude Code B04 apporte le meilleur signal pour la delegation borneee: task list persistante, ownership, blocking graph, mailbox d'approbation, plan mode, worktree par agent.
- OpenClaw B03 et B04 apportent les meilleurs seams pour session-key, request envelope, plugin entry DSL et capture harness, mais pas un host complet a recopier.
- MetaGPT B02 apporte un shell multi-agent compact autour de `Team`, `Environment`, `Role`, `Action`, `Planner`, mais ses flows de "software company" sont trop couples pour devenir le coeur V1.
- ChatDev B02 apporte un excellent contrat de message, une couche d'artefacts workspace et des registries utiles, mais son moteur de graphe complet est trop lourd pour le pilote V1.

Inference de recherche: le V1 ne doit pas choisir entre "assistant" et "workflow engine". Il doit posseder un noyau de mission et une boucle de delegation observable, puis exposer ensuite des adaptateurs et des compositions.

## 2. Centre de gravite recommande pour V1

### Decision proposee

Le centre de gravite du V1 doit etre:

- un noyau de mission persistante
- une task runtime / ticket runtime observable
- un journal d'evenements, d'approbations et d'artefacts
- une couche d'adaptation vers Codex

Ce ne doit pas etre:

- un query loop vendor-specific
- un gros plugin host
- un moteur de workflow declaratif generaliste
- une surcouche sur des surfaces Codex natives

### Pourquoi cette decision est soutenue

- Le PRD demande explicitement une mission persistante, des taches delegables, une reprise bornee et un journal structure.
- L'analyse B04 de Claude Code identifie la `persistent task list` comme la meilleure extraction pour deleguer du travail sans copier tout le runtime d'agent.
- OpenClaw montre que les request envelopes, session keys et registries sont utiles, mais que `server.impl.ts` et la facade runtime complete sont des zones a reecrire.
- MetaGPT montre que `Team + Environment` et `Role.run(with_message=...)` sont de bonnes coquilles de delegation, mais pas une solution de produit prete a reprendre telle quelle.
- ChatDev montre que la separation orchestration / execution / artifact hooks est saine, mais que `workflow/graph.py` emporte deja trop de runtime pour le V1.

### Consequence pour la prochaine architecture

L'architecture suivante devra commencer par modeller:

- l'objet `Mission`
- l'objet `Ticket`
- l'enveloppe d'evenement
- l'index d'artefacts
- l'adaptateur d'execution Codex

Avant de modeliser:

- des sous-graphes declaratifs
- un plugin marketplace
- une UI locale riche
- un control plane distribue

## 3. Forme minimale de l'objet mission/ticket

### 3.1 Contraintes minimales soutenues par les sources

Les sources soutiennent deja fortement les besoins suivants:

- identite stable et persistence
- owner / assignee explicite
- statut lisible
- dependances ou blocking graph
- criteres de succes et contraintes
- approbations et politiques
- artefacts relies a la tache
- reprise sans reconstruction manuelle
- isolation suffisante du contexte de travail

Preuves locales utiles:

- Claude Code B04: task list persistante, `createTask`, `updateTask`, `blockTask`, `claimTask`, ownership, blocking graph, mailbox protocol.
- MetaGPT B02: `Message`, `Task`, `TaskResult`, `MessageQueue`, `Role.run`, `Team.run_project`.
- ChatDev B02: contrat `Message`, `TaskInputBuilder`, `WorkspaceArtifactHook`, `AttachmentStore`.
- OpenClaw B03: `session-key routing pack` pour stabiliser les identites de run et de session a travers plusieurs surfaces.

### 3.2 Decision proposee

Le contrat coeur doit avoir deux niveaux:

1. `Mission` = enveloppe persistante pilotee par l'operateur
2. `Ticket` = unite delegable et repriseable

`Mission` ne doit pas etre un simple conteneur de transcripts.
`Ticket` ne doit pas etre un simple "prompt a lancer".

### 3.3 Proposition de forme canonique

Le schema suivant est une proposition de recherche technique pour l'architecture suivante. Il ne vaut pas encore schema final d'implementation.

```json
{
  "mission": {
    "id": "mission_...",
    "title": "string",
    "objective": "string",
    "status": "draft|ready|running|blocked|awaiting_approval|completed|failed|cancelled",
    "success_criteria": ["string"],
    "policy_profile": {
      "default_approval_policy": "manual_sensitive",
      "default_sandbox_profile": "workspace_write",
      "allowed_capabilities": ["string"]
    },
    "session_locator": {
      "kind": "local_session",
      "key": "string"
    },
    "ticket_ids": ["ticket_..."],
    "artifact_ids": ["artifact_..."],
    "event_ids": ["event_..."],
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "ticket": {
    "id": "ticket_...",
    "mission_id": "mission_...",
    "kind": "research|plan|implement|review|operate",
    "goal": "string",
    "status": "todo|claimed|in_progress|blocked|awaiting_approval|done|failed|cancelled",
    "owner": "role_or_agent_id",
    "depends_on": ["ticket_..."],
    "success_criteria": ["string"],
    "inputs": ["artifact_or_context_ref"],
    "constraints": {
      "allowed_capabilities": ["string"],
      "approval_policy": "manual_sensitive|never|on_request",
      "sandbox_profile": "read_only|workspace_write|danger_full_access"
    },
    "execution_handle": {
      "adapter": "codex_responses|codex_exec|codex_mcp",
      "adapter_state": {}
    },
    "artifact_ids": ["artifact_..."],
    "event_ids": ["event_..."],
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

### 3.4 Points importants de cette proposition

- `Mission` porte les politiques par defaut, la reprise et la lisibilite operateur.
- `Ticket` porte la delegation executable.
- `execution_handle.adapter_state` est le seul endroit ou des identifiants propres a Codex doivent apparaitre.
- `threadId`, `response_id`, `session_id`, `conversationId` ou tout identifiant homologue ne doivent pas devenir des champs coeur du produit.
- `allowed_capabilities`, `approval_policy` et `sandbox_profile` doivent etre traites comme des contraintes explicites, pas comme des conventions implicites.

### 3.5 Ce qu'il faut explicitement laisser hors du contrat coeur

- la forme exacte des evenements JSONL de `codex exec`
- la structure de `config.toml`
- la hierarchie `AGENTS.md`
- les details de plugin bundle Codex
- les details d'un futur moteur DAG ou subgraph

### 3.6 Niveau de confiance

- Forme a deux niveaux `Mission` + `Ticket`: haute
- Champ `execution_handle.adapter_state` pour contenir la variance vendor: haute
- Liste exacte des statuts V1: moyenne, a figer dans l'architecture

## 4. Frontiere minimale d'extension

### 4.1 Decision proposee

Le V1 doit posseder seulement trois seams d'extension explicites:

1. `Execution adapter`
2. `Capability registry`
3. `Skill pack`

### 4.2 Ce que recouvre chaque seam

#### A. Execution adapter

But:

- lancer
- reprendre
- interrompre
- collecter les evenements et artefacts

Exemples soutenus par les sources:

- adaptateur Codex via Responses API
- adaptateur Codex via `codex exec`
- adaptateur Codex via `codex mcp-server`

Justification:

- la documentation Codex expose plusieurs surfaces valides, mais elles ne doivent pas fuir dans le noyau mission/ticket.

#### B. Capability registry

But:

- declarer les capacites disponibles pour un ticket
- porter les politiques et timeouts
- brancher tools locaux et MCP servers

Pieces de preuve:

- OpenClaw B04: `definePluginEntry`, `api-builder`, `captured-registration` montrent qu'une bonne frontiere commence par une declaration et une capture de registration, pas par une facade runtime geante.
- ChatDev: `generic_registry`, `schema_bootstrap_registry`, `provider_registry_abstraction` montrent l'utilite d'un registre compact et composable.
- Codex MCP docs: les serveurs peuvent etre configures localement ou par URL, avec `enabled_tools`, `disabled_tools`, `tool_timeout_sec`, `required`.

Inference:

- V1 n'a pas besoin d'un systeme plugin "distribution-grade".
- V1 a besoin d'une declaration locale et testable de capacites autorisees.

#### C. Skill pack

But:

- factoriser des workflows textuels ou semi-deterministes
- attacher des references et scripts optionnels
- charger l'expertise a la demande

Pieces de preuve:

- ChatDev reuse: `skill_frontmatter_loader` est un seam simple et peu couple.
- Codex skills docs: une skill est un dossier avec `SKILL.md` et scripts/references optionnels; Codex charge d'abord les metadonnees puis le contenu complet si besoin.
- Le brief et le PRD demandent explicitement une surface skills/outils/plugins/canaux, mais sans ecosysteme exhaustif en V1.

### 4.3 Ce qui doit rester hors V1

- plugin marketplace
- channels et control plane distribues
- app integrations generalistes type "platform host"
- workflow engine YAML complet
- surface UI d'extension riche

### 4.4 Regle structurante

Toute extension V1 doit pouvoir etre testee sans boot du host complet.

Cette regle vient directement des meilleures briques OpenClaw:

- `captured-registration.ts`
- `buildPluginApi(...)`
- separation entre entry DSL et runtime facade

Inference appliquee a `corp`:

- l'architecture suivante doit prevoir un mode de `capture` ou de `validation` de registration pour les adaptateurs, tools et skills.

## 5. Niveau de dependance acceptable vis-a-vis de Codex API/CLI

### 5.1 Decision proposee

Politique cible:

- coeur produit: vendor-aware mais vendor-decoupled
- execution externe: Codex comme runtime cible principal
- surface technique preferee: Responses API
- surfaces locales acceptees: CLI, SDK, MCP server
- surfaces Codex-native de personnalisation: optionnelles, jamais coeur

### 5.2 Ce que les docs officielles confirment

- `GPT-5-Codex` est optimise pour les taches de coding agentique et n'est disponible que dans la `Responses API`.
- Le guide `Background mode` confirme que les runs longs peuvent etre lances avec `background=true` puis recuperes par polling, avec statuts `queued` et `in_progress`.
- `codex exec` est documente comme mode non interactif stable, exploitable en scripts et CI, avec sortie JSONL et reprise de session.
- Le `Codex SDK` TypeScript est annonce comme plus flexible et plus complet que le mode non interactif.
- Le guide `Use Codex with the Agents SDK` montre que `codex mcp-server` expose seulement deux outils, `codex()` et `codex-reply()`, pour piloter des threads persistants.
- Les docs `AGENTS.md`, `Skills`, `Plugins` et `MCP` montrent que Codex possede deja des surfaces de personnalisation et d'integration, mais a sa propre logique de resolution, de config et de distribution.

### 5.3 Matrice de dependance proposee

| Niveau | Surface Codex | Usage recommande dans `corp` V1 | Statut |
| --- | --- | --- | --- |
| A | Responses API + `gpt-5-codex` | Execution principale des tickets cloud ou hybrides | Recommande |
| A | Background mode Responses | Runs longs, polling simple, reprise de jobs asynchrones | Recommande si necessaire |
| B | `codex exec --json` + resume | Automatisation locale, CI, bootstrap rapide du pilote CLI | Accepte |
| B | Codex SDK | Integrations locales plus riches, gestion programmatique de threads | Accepte |
| B | `codex mcp-server` | Orchestration multi-agent ou bridge avec Agents SDK | Accepte si utile |
| C | `AGENTS.md`, skills, plugins, slash commands, `config.toml` | Ergonomie ou accelerants operateur | Optionnel |
| D | TUI, layouts, conventions d'UI Codex, semantique interne des events non normalises | Primitive coeur du produit | A eviter |

### 5.4 Interpretation pratique pour `corp`

`corp` doit garder sa propre CLI, son propre store mission/ticket et son propre journal. Le produit peut appeler Codex, mais ne doit pas "devenir" un profil ou un plugin Codex.

Autrement dit:

- la CLI V1 de `corp` est la surface operateur
- Codex est une capacite d'execution externe
- les objets produits `Mission`, `Ticket`, `Artifact`, `ApprovalRequest` et `Event` appartiennent a `corp`

### 5.5 Risques identifies

Risque 1:

- Si `corp` depend de `AGENTS.md`, des skills repo-scoped ou du plugin system Codex pour definir son comportement coeur, la logique produit devient trop implicite et trop liee a la resolution locale de Codex.

Risque 2:

- Si `corp` s'accroche a `codex exec` comme seule forme d'execution, il herite trop directement de la semantique CLI, des flags, de la structure JSONL et des contraintes Git/sandbox de l'outil.

Risque 3:

- Si `corp` s'accroche a `background=true`, il doit assumer la contrainte de retention applicative et l'incompatibilite ZDR indiquees par la doc OpenAI.

### 5.6 Decision de recherche recommandee

Pour l'architecture suivante:

- prendre `Responses API` comme reference contractuelle principale pour le runtime externe
- traiter `codex exec`, le SDK et `codex mcp-server` comme adaptateurs de mise en oeuvre
- interdire les champs Codex-specifiques au niveau du contrat coeur

Niveau de confiance:

- API-first, CLI-available: haute
- choix exact du premier adaptateur concret a livrer en V1: moyenne

## 6. Consequences directes pour l'architecture BMAD suivante

L'etape d'architecture suivante devra partir des decisions ci-dessous comme proposition de base:

- Le noyau produit est un `mission kernel` persistant.
- Le centre de gravite V1 est le ticket runtime observable.
- L'execution externe passe par un `ExecutionAdapter` vers Codex.
- Les details propres a Codex vivent dans `adapter_state`.
- La frontiere minimale d'extension se limite a `ExecutionAdapter`, `CapabilityRegistry`, `SkillPack`.
- Le V1 n'a pas besoin d'un moteur de graphes complet; un dispatcher de tickets avec dependances suffit.
- Le V1 n'a pas besoin d'un plugin host complet; une declaration locale et testable de capacites suffit.
- Le V1 doit posseder un journal d'evenements et d'artefacts des le debut.

Une architecture candidate coherente, a investiguer dans la prochaine fenetre, serait donc en cinq couches:

1. `Operator CLI`
2. `Mission and Ticket Kernel`
3. `Event, Approval and Artifact Journal`
4. `Execution and Capability Adapters`
5. `Storage and Resume State`

## 7. Hypotheses explicites retenues dans cette recherche

- La demande utilisateur tient lieu de confirmation de scope BMAD pour cette fenetre.
- Le premier pilote peut fonctionner avec un seul adaptateur Codex actif a la fois.
- La valeur V1 provient d'abord de la reprise, de l'audit et de la delegation, pas d'une orchestration DAG riche.
- Le premier lot d'extensions V1 peut rester local et repo-scoped.
- Les actions sensibles a superviser concernent au minimum ecriture workspace et acces reseau hors profil de confiance.

## 8. Questions ouvertes restantes

- Quel premier adaptateur concret doit etre priorise pour V1: `Responses API`, `codex exec`, ou `codex mcp-server` ?
- Faut-il inclure un `resource_budget` dans le schema coeur V1 ou le garder dans le journal d'evenements au debut ?
- Quelle granularite de `artifact_ids` et de `event_ids` est suffisante pour la reprise sans rendre le schema trop lourd ?
- Une isolation worktree par ticket est-elle necessaire des le pilote V1, ou un simple `workspace_write` borne par mission suffit-il ?
- Souhaite-t-on des tickets strictement lineaires avec `depends_on[]`, ou un petit graphe de dependances suffit-il sans moteur declaratif complet ?
- Si `background=true` est utilise cote API, quelle posture de retention et de gouvernance des donnees accepte-t-on pour le pilote ?

## 9. Sources de reference

### Sources locales BMAD et analyses

- `C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp.md`
- `C:/Dev/PRJET/corp/_bmad-output/planning/product-brief-corp-distillate.md`
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/index.md`
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b01-core-bootstrap-session-loop.md`
- `C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/batches/b04-agent-orchestration.md`
- `C:/Dev/PRJET/claude-code-leak-03-2026/claude-code-leak-fork-main/analysis/reuse/reuse-candidates.md`
- `C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-03-gateway-control-plane.md`
- `C:/Dev/PRJET/Openclaw/openclaw-main/analysis/batches/batch-04-plugin-platform-sdk.md`
- `C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/batches/02-agent-orchestration.md`
- `C:/Dev/PRJET/metagpt/MetaGPT-main/analysis/reuse/reuse-candidates.md`
- `C:/Dev/PRJET/chatdev/ChatDev-main/analysis/batches/02-workflow-orchestration.md`
- `C:/Dev/PRJET/chatdev/ChatDev-main/analysis/reuse/reuse-candidates.md`

### Documentation officielle OpenAI / Codex verifiee le 2026-04-08

- `https://developers.openai.com/api/docs/models/gpt-5-codex`
- `https://developers.openai.com/api/docs/models/all`
- `https://developers.openai.com/api/docs/guides/background`
- `https://developers.openai.com/codex/noninteractive`
- `https://developers.openai.com/codex/sdk`
- `https://developers.openai.com/codex/mcp`
- `https://developers.openai.com/codex/guides/agents-md`
- `https://developers.openai.com/codex/skills`
- `https://developers.openai.com/codex/plugins`
- `https://developers.openai.com/codex/agent-approvals-security`
- `https://developers.openai.com/codex/guides/agents-sdk`

## Technical Research Conclusion

Cette recherche soutient une orientation claire pour `corp` V1: posseder un noyau mission/ticket persistant, puis traiter Codex comme runtime externe via des adaptateurs explicites. Le pilote V1 n'a pas besoin d'imiter un IDE agentique complet, ni de reprendre un host plugin ou un workflow engine entier. Il doit prouver qu'une mission locale peut etre planifiee, delegatee, reprise et auditee de facon plus fiable qu'un empilement de sessions et d'outils non unifies.

La fenetre suivante peut donc passer a une seule etape BMAD d'architecture, avec un point de depart deja borne: `mission kernel` coeur, `ExecutionAdapter` vers Codex, frontiere d'extension minimale, et isolement strict des details vendor dans des couches d'adaptation.
