# corp V1 — ce que tu as entre les mains

## Ce qu'est réellement `corp` aujourd'hui

`corp` est une **CLI locale en TypeScript/Node.js** qui permet à un opérateur technique unique (toi) de piloter des missions longues exécutées par **Codex** (API OpenAI Responses avec `gpt-5-codex`), en gardant le contrôle sur l'état, les approbations et les artefacts produits.

Ce n'est **pas** (encore) le runtime multi-agents complet décrit dans `ideation-projet.Md`. C'est le **noyau de contrôle** qui est fini à date d'aujourd'hui (2026-04-14), après 4 épiques livrés :

- **Epic 1** — Mission persistante pilotable en CLI (créer, resume, pause, cloture)
- **Epic 2** — Délégation via tickets isolés (worktree Git, exécution via adaptateur `codex_responses`, artefacts)
- **Epic 3** — Supervision humaine, reprise ciblée, audit (queue d'approbations, `mission compare`, relance branche impactée)
- **Epic 4** — Extensions locales gouvernées (`ExecutionAdapter`, `CapabilityRegistry`, `SkillPack`)

## Comment ça fonctionne — le modèle mental

```
Mission (objectif + critères de succès)
   └── Tickets (unités délégables, kind: research/plan/implement/review/operate)
         └── ExecutionAttempt (tentative isolée dans un worktree)
               ├── Events (journal append-only, source de vérité)
               └── Artifacts (fichiers produits + outputs structurés)
```

Tout passe par le journal `.corp/journal/events.jsonl`. Les projections (`resume-view.json`, `ticket-board.json`, `audit-log.json`, etc.) sont reconstructibles depuis ce journal. C'est ça qui te donne la **reprise sans reconstruction manuelle**.

## Comment l'utiliser maintenant — démarrage en 3 minutes

```bash
# 1. Compiler et configurer
cd C:\Dev\PRJET\corp
npm run build
export OPENAI_API_KEY="sk-..."
alias corp="node $(pwd)/dist/apps/corp-cli/src/index.js"

# 2. Bootstrap workspace (une fois)
corp mission bootstrap

# 3. Créer ta première mission réelle
corp mission create \
  --title "..." \
  --objective "..." \
  --success-criterion "..." \
  --policy-profile default
```

## 5 exemples concrets d'usage, maintenant

### Exemple 1 — Audit de code sur un repo tiers

```bash
corp mission create --title "Audit sécurité repo X" \
  --objective "Identifier les failles OWASP top 10 dans le dépôt" \
  --success-criterion "Liste priorisée de findings avec localisation fichier:ligne"

corp mission ticket create --kind research \
  --goal "Cartographier les endpoints HTTP et les points d'entrée user-controlled" \
  --owner codex-agent \
  --success-criterion "Tableau endpoints/auth/validation"

corp mission ticket create --kind review \
  --goal "Analyser les requêtes SQL et la validation des inputs" \
  --depends-on <ticket1> \
  --success-criterion "Liste de findings SQLi potentiels"
```

Tu obtiens un rapport versionné, des artefacts reliables aux events, et tu peux reprendre le lendemain sans relire la conversation.

### Exemple 2 — Refonte d'un module, par étapes contrôlées

Un ticket `plan` qui produit le plan, un ticket `implement` qui dépend du plan, un ticket `review` qui dépend de l'implémentation. Chaque ticket tourne dans **son propre worktree Git**, donc zéro contamination du workspace principal. Tu lances, tu pars faire autre chose, tu reviens avec `corp mission resume` et tu vois exactement quoi faire ensuite.

### Exemple 3 — Recherche longue avec checkpoints

Lance un ticket `research` avec `--background` pour une question qui demande plusieurs minutes, puis vérifie `mission audit` pour voir chaque appel adaptateur et artefact produit. Parfait pour "analyse ces 50 fichiers et dis-moi quelles sont les 3 incohérences architecturales majeures".

### Exemple 4 — Mission en étapes avec approbations sensibles

Définis via skill-pack un workflow où un ticket `operate` (déploiement, modif config prod) reste bloqué en `awaiting_approval`. Tu valides manuellement avec la queue d'approbations. Tout est tracé dans l'audit log.

### Exemple 5 — Diagnostic + relance ciblée

Quand un ticket échoue :

```bash
corp mission compare --mission-id <ID>
# voir l'écart attendu/observé et la branche impactée
corp mission compare relaunch --mission-id <ID> --ticket-id <ROOT_TICKET>
```

Seul le sous-arbre concerné redémarre, les artefacts valides restent intacts.

## Ce que la V1 **n'a pas encore** (important pour tes attentes)

`/ultraplan` et les concepts de `ideation-projet.Md` correspondent à des couches **pas livrées** :

| Concept | Statut V1 |
|---|---|
| `ULTRAPLAN` (couche planification évolutive) | ❌ Pas implémenté. La planification V1 = découpage manuel en tickets + `dependsOn` |
| `KAIROS` (assistant persistant autonome) | ❌ Pas de daemon long-vivant, tu lances les commandes à la main |
| `COORDINATOR MODE` (multi-agents en parallèle) | ❌ Un seul owner par ticket, une seule `ExecutionAttempt` active |
| Routeur multi-modèles (Claude/Gemini/GPT) | ❌ Uniquement Codex `gpt-5-codex` |
| Telegram / approbations mobiles | ❌ CLI seulement |
| Stripe / IMAP / SMTP | ❌ Hors scope V1 |
| Skills tiers avec audit pipeline | ❌ Skill packs locaux uniquement |

## Ce que je te recommande de faire maintenant

1. **Test pilote immédiat** — Suis `guide-utilisation.md` de bout en bout sur une mission réelle (pas un ticket-jouet) : choisis une tâche que tu repousses depuis longtemps, transforme-la en mission, fais-la exécuter par Codex, vérifie que tu peux pause/reprise/audit.
2. **Retro Epic 4** (`_bmad-output/implementation/epic-4-retro-2026-04-14.md`) — daté d'aujourd'hui. Lis-la pour voir les "deferred work" et bugs connus avant d'attaquer la V2.
3. **Décider la V2** — Les trois candidats naturels selon ton `ideation-projet.Md` :
   - Daemon persistant (`KAIROS`) + canal Telegram pour approbations mobiles
   - Routeur de modèles + banc d'éval (Opus 4.6 orchestrateur / GPT-5.4 runner / Gemini pour synthèse longue)
   - Couche planification (`ULTRAPLAN`) : un agent qui génère automatiquement les tickets depuis un objectif

## Workflows BMAD pertinents à ce stade

Maintenant que les 4 épiques V1 sont livrés, les prochains pas BMAD logiques :

- **`bmad-retrospective`** — Rétro globale V1 (tu as déjà les retros par épic, mais pas de synthèse)
- **`bmad-product-brief`** (nouvelle fenêtre) — Brief V2 : quelle couche étendre en priorité ?
- **`bmad-technical-research`** — Recherche technique sur daemon persistant OU routeur multi-modèles, selon l'orientation V2
- **`bmad-document-project`** — Maintenant que le code existe vraiment, tu peux générer la doc projet pour les futurs agents de dev

---

## ULTRAPLAN — Synthèse 2026-04-14 (comparaison doc vs code vs analyses externes)

### Verdict global

v1 **fonctionnellement livré** : 4 epics, 25 stories + 6 correctives, **246 tests verts**, FR1-28 et NFR1-14 couvertes. Le PRD est aligné avec le livré. Ce qui reste n'est **plus du scope v1** mais soit de la **dette technique répertoriée**, soit de la **vision v2 explicitement déférée**.

### État réel des packages (`C:\Dev\PRJET\corp\packages\`)

| Package | Rôle | État | Tests |
|---|---|---|---|
| `contracts` | Modèles Mission/Ticket/Artifact/Approval/Extension | ✅ | ✅ |
| `mission-kernel` | Orchestration (create, bootstrap, lifecycle, approvals, resume) | ✅ | ✅ |
| `ticket-runtime` | Exécution isolée, artefacts, tentatives | ✅ | ✅ |
| `journal` | Event log append-only + projections | ✅ | ✅ |
| `storage` | Persistance fichiers workspace | ✅ | ✅ |
| `capability-registry` | Validation/enregistrement capabilities + guardrails | ✅ | ✅ |
| `skill-pack` | Loader metadata-first | ✅ | ✅ |
| `execution-adapters` | Adaptateur Codex Responses API | ✅ (Codex uniquement) | ✅ |
| `workspace-isolation` | Worktree Git pour tentatives | 🟡 peu de failover si git indispo | minimal |
| `corp-cli` (app) | Router commandes + formatters | ✅ | ✅ |

Aucun TODO/FIXME/throw "not implemented" repérable dans le code.

### Surface CLI complète (28 commandes)

```
corp mission bootstrap|create|pause|relaunch|close|status|resume|compare|audit
corp mission compare relaunch --ticket-id <T>
corp mission ticket create|update|move|cancel|run|board
corp mission approval queue|approve|reject|defer
corp mission artifact list|show
corp mission extension select [--allow-capability|--skill-pack]
corp extension validate|capability register|skill-pack register|skill-pack show
```

### Reste à faire — dette technique (`_bmad-output/implementation/deferred-work.md`, 53 items D-01 à D-53)

Quatre zones cycliques (mentionnées dans **3 rétros successives sans résolution**) :

1. **Atomicité écriture (16 items)** — journal/projections non-atomiques sur NTFS, TOCTOU `access→write` (D-01, D-05, D-07, D-17, D-27, D-29, D-35, D-43)
2. **Duplication/normalisation (11 items)** — 6 type guards dupliqués entre `audit-log-projection.ts` et `read-mission-audit.ts`, `toPublicSource` ne masque qu'OpenAI/Codex (D-11, D-13, D-21, D-31, D-53)
3. **Edge cases locales/schema (13 items)** — `localeCompare` locale-sensible sur ISO timestamps, noms Windows réservés non-rejetés (CON/NUL/PRN), JSON deserializé sans Zod (D-04, D-06, D-28, D-37, D-44, D-46)
4. **Logique spécifique (13 items)** — `--ticket-id` exclut events mission-level, migration workspaces pré-3.4, divergence journal/read-model après crash (D-12, D-14, D-15, D-16, D-18, D-34)

### Reste à faire — dette **process** (persistante, 3 rétros consécutives)

- `sprint-status.yaml` ↔ story files ↔ retrospective pas synchronisés avant clôture
- Epic reste `in-progress` alors que toutes ses stories sont `done`
- Retrospective marquée `optional` au lieu de `done`

**Rien d'automatisé pour fermer ça — à mécaniser en priorité.**

### Décision bloquante ouverte (retro epic-4, actions 4-5)

- **Option A** — Fermer v1 tel quel, `deferred-work.md` comme "known limitations mono-opérateur" + mini-hardening sur 8 items critiques (type guards dupliqués, projections atomiques, ENOENT migration, noms Windows réservés, `appendFile` concurrent, localeCompare, TOCTOU, test seams).
- **Option B** — Planifier **Epic 5 hardening transversal** avant GA (traitement complet des 53 items).

**Recommandation** : **Option A + mécanique de clôture d'epic** (script cohérence sprint-status/stories/retro). Option B reportable après premier pilote réel.

### Différences PRD → réel

Zéro divergence fonctionnelle sur les parcours 1-4 du PRD. Seuls les **concepts de vision** (KAIROS, ULTRAPLAN, COORDINATOR MODE, multi-modèles) sont deferrés — c'était explicite dès le PRD.

### Idées transférables (analyses `Openclaw/analysis`, `MetaGPT-main/analysis`, `ChatDev-main/analysis`)

Pour v2 uniquement — à ne PAS introduire maintenant :

1. **Mission = DAG déclaratif YAML** (ChatDev `workflow/graph_manager.py` + `cycle_manager.py`) → cycles, splits dynamiques, majority vote
2. **Ticket = Message contract sérialisable** (ChatDev `entity/messages.py`) → audit rejouable natif
3. **SkillPack via frontmatter `SKILL.md`** (ChatDev `AgentSkillManager`) → standardisation
4. **ProviderRegistry pattern** (ChatDev `runtime/node/agent/providers/`) → bascule Claude/Gemini sans réécrire `execution-adapters`
5. **Lazy plugin loading** (Openclaw `OPENCLAW_STATE_DIR` + `src/config/sessions/store.ts`) → CLI légère quand le registry grossit
6. **Role runtime `_observe → _think → _act`** (MetaGPT `metagpt/roles/`) → base conceptuelle de `COORDINATOR MODE`
7. **Memory stack sérialisable** (MetaGPT `memory/memory.py` + ChatDev `MemoryManager`) → audit vérifié retrievable par `session_id + ticket_id`
8. **CycleDetector + MajorityVoteStrategy** (ChatDev `workflow/topology_builder.py`) → workflows parallèles avec consensus

**Anti-patterns à éviter** :
- Config singleton global (MetaGPT `_CONFIG_CACHE`) — chaque mission doit rester isolée
- Plugin bundled par défaut (Openclaw `use_mgx=True`) — couplage implicite
- Copier `GraphExecutor.py` brut de ChatDev — embarque memory/tools/logger implicitement

### Prochaines actions dans l'ordre

1. **Cette semaine** — Trancher Option A vs B (retro epic-4). Si A, lister explicitement les 8 items à traiter ; si B, ouvrir Epic 5.
2. **+1 jour** — Script de cohérence clôture d'epic (`sprint-status.yaml` ↔ stories ↔ retro). Bloque `epic: done` si retro `optional`.
3. **+3 jours** — Pilote réel sur mission non-triviale (voir `playbook-operateur-corp-v1.md`, 10 missions-types).
4. **Ensuite** — `bmad-product-brief` v2 orienté par le résultat du pilote (KAIROS ? routeur multi-modèles ? ULTRAPLAN ?).

### Synthèse en une phrase

**v1 est prêt pour utilisation pilote immédiate par un opérateur solo** ; la vraie question n'est plus « que coder » mais **« fermer v1 proprement (process + 8 items critiques) OU investir dans Epic 5 durcissement avant d'ouvrir v2 »**.
