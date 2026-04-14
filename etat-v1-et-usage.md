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
