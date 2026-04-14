# Ultra-plan corp — état des lieux, écarts et plan d'usage

## 1. Ce que tu as réellement aujourd'hui

**corp V1 est un noyau d'orchestration local-first, en TypeScript/Node.js 20+, livré fonctionnellement à 100 % au 2026-04-14.**

| Couche | Statut | Où c'est dans le code |
|---|---|---|
| CLI opérateur `corp` | Livré | `apps/corp-cli/src/` (commandes `mission-command.ts`, `extension-command.ts` + 15 formatters) |
| Contrats canoniques (Mission, Ticket, ExecutionAttempt, Event, Artifact, Approval, Extension) | Livré | `packages/contracts/` |
| Mission kernel (lifecycle, resume, approvals, policies) | Livré | `packages/mission-kernel/` |
| Ticket runtime (planner, dispatcher, dépendances, artifacts) | Livré | `packages/ticket-runtime/` |
| Journal append-only + 5 projections (mission-status, ticket-board, approval-queue, artifact-index, resume-view, audit-log) | Livré | `packages/journal/` |
| Storage local (repositories, projection-store, fs-layout `.corp/`) | Livré | `packages/storage/` |
| Isolation workspace (worktree Git ou copie) | Livré | `packages/workspace-isolation/` |
| Execution adapter `codex_responses` (OpenAI Responses API + `gpt-5-codex`) | Livré | `packages/execution-adapters/codex-responses/` |
| Capability registry workspace-scoped | Livré | `packages/capability-registry/` |
| Skill-pack registry metadata-first | Livré | `packages/skill-pack/` |
| Tests unit/integration/contract | 246 tests verts | `tests/` |

### Couverture fonctionnelle
- **FR1-FR28** (28 requirements PRD) : tous couverts par les Epics 1 → 4
- **NFR1-NFR14** (performance, sécu, fiabilité, intégration) : tous respectés
- **4 épics, 24 stories**, toutes `done` dans `sprint-status.yaml`

---

## 2. Alignement avec la documentation amont

| Document | Rôle | Conformité livraison |
|---|---|---|
| `product-brief-corp.md` | Vision (runtime multi-agents persistant local-first) | **Partielle** : V1 est le *noyau de contrôle*, pas le runtime multi-agents complet |
| `product-brief-corp-distillate.md` | Distillate tokenisé pour PRD | **OK** |
| `prd.md` | 28 FR + 14 NFR sur une boucle V1 bornée (CLI, Codex, supervision humaine) | **100 %** |
| `technical-research-v1-architecture-foundation.md` | Forme Mission/Ticket, frontière extension, dépendance Codex | **OK** (Responses API retenue) |
| `architecture.md` | 5 couches, contrat coeur, isolation, journal append-only | **OK** sur la structure livrée |
| `epics.md` | Epics 1-4 + stories | **OK** (toutes `done`) |
| `ideation-projet.Md` (vision large) | KAIROS, ULTRAPLAN, COORDINATOR, router multi-modèles, Telegram, Stripe, 5 agents… | **10-15 %** (seules les primitives de base) |
| `besoins.md` | OAuth Codex + OAuth Claude, KAIROS/ULTRAPLAN, 3 repos non analysés (oh-my-openagent, clawhip, oh-my-codex) | **Ignoré** délibérément pour V1 |

---

## 3. Ce qui **manque** (par couche)

### A. Dette technique transversale — 53 items déférés (D-01 → D-53)
Signalée 3 fois dans les retros sans traitement structurel. Items récurrents :
- **Atomicité d'écriture** : journal/projections non atomiques (D-01, D-07, D-17, D-29, D-35, D-49)
- **Type guards dupliqués** entre `audit-log-projection.ts` et `read-mission-audit.ts` (D-11, D-31, D-53)
- **TOCTOU** sur `access()+writeFile`/`statSync` (D-05, D-20, D-27, D-43, D-49, D-50)
- **JSON parse sans validation de schéma** (D-06, D-44)
- **Spécifique Windows** : noms réservés CON/PRN/NUL/AUX/COM*/LPT*, chemins UNC, `appendFile` concurrent NTFS (D-22, D-37, D-46)
- **Ergonomie** : `--root "   "` accepté (D-09), `limit: -1` retourne tout (D-32), `rootDir` undefined → cwd silencieux (D-33)
- **Symlinks** : `path.resolve` ne suit pas, bypass frontière skill-pack (D-24, D-40)
- **Fuite de chemins absolus locaux** dans le brief envoyé à OpenAI (D-42)

### B. Écarts de gouvernance d'artefacts (3ème occurrence non corrigée)
- `epic-4` encore `in-progress` dans `sprint-status.yaml` alors que les 5 stories sont `done`
- Story `4.2` affiche `Status: review` dans son fichier alors qu'elle est `done` dans le tracker
- `epic-4-retrospective` valeur `optional` par défaut (même erreur qu'en Epic 3)
- **Pas de rétro V1 globale** (les 4 rétros par épic existent, pas la synthèse)

### C. Adaptateurs d'exécution secondaires prévus dans `architecture.md` mais **non livrés**
- `codex-exec` (CLI `codex exec --json`) — mentionné comme dossier cible, jamais implémenté
- `codex-sdk` (SDK TypeScript) — idem
- Seul `codex-responses` (adaptateur prioritaire) existe

### D. Fonctions mentionnées dans la doc mais non implémentées
- **Polling background** : `--background` existe en CLI, mais OpenAI conserve les réponses ~10 min et *le polling n'est pas implémenté* (documenté dans `guide-utilisation.md:143`)
- **Package `observability/`** (tracing, audit-queries, export) listé dans `architecture.md:610-615` — pas créé
- **Pas de `package.json`** par package (monorepo avec imports relatifs, D-25)
- **Politique de compatibilité workspaces** appliquée ad-hoc story par story, jamais documentée comme règle BMAD

### E. Tout le scope "vision large" (ideation-projet.Md) — **hors V1**
| Concept | Statut |
|---|---|
| `KAIROS` (daemon persistant autonome, wake-ups) | ❌ Pas de daemon long-vivant |
| `ULTRAPLAN` (planification auto, replanning) | ❌ Découpage en tickets manuel |
| `COORDINATOR MODE` (multi-agents parallèles actifs) | ❌ 1 seul owner, 1 seule `ExecutionAttempt` active |
| Router multi-modèles (Opus 4.6 orchestrateur / GPT-5.4 runner / Gemini synthèse/tri) | ❌ Uniquement `gpt-5-codex` |
| Banc d'éval maison (`models/capabilities.yaml` mesuré) | ❌ Aucun |
| Canal Telegram (long polling, approvals mobiles) | ❌ |
| IMAP/SMTP, Stripe Payment Links, webhooks | ❌ Hors scope V1 |
| Worker image (Nano Banana) | ❌ |
| Pipeline audit skills tiers (4 étages : gel commit, scan statique, 2 LLM, approval) | ❌ Skill-packs locaux confiance seulement |
| Mémoire `memory/global` + `memory/ventures/<id>` (DECISIONS, ASSUMPTIONS, LEARNINGS…) | ❌ |
| 5 rôles persistants (orchestrateur, scout, builder, growth, risk) | ❌ |
| SQLite pour état machine + markdown pour mémoire humaine | ❌ (actuellement JSON + JSONL seulement) |
| 3 domaines de confiance (code / web public / skills tiers) | ❌ |
| Venture loop avec kill à 72h sans signal | ❌ |

### F. Repos mentionnés dans `besoins.md` **non analysés**
- `oh-my-openagent`, `clawhip`, `oh-my-codex` — évoqués mais pas dans `anlyses-preliminaires/` (qui contient chatdev, metapgt, openclaw)

---

## 4. Ce qu'il reste à faire — plan par ordre de priorité

### 🔥 P0 — Cloture propre V1 (quelques heures)
1. Passer `epic-4: done` dans `_bmad-output/implementation/sprint-status.yaml:71`
2. Passer `Status: done` dans le story file `4.2`
3. Marquer `epic-4-retrospective: done`
4. **Arbitrer formellement V1 : GA tel quel, ou Epic 5 de hardening** (action 6 de la rétro Epic 4)

### 🛠️ P1 — Si tu choisis "Epic 5 hardening" avant GA (1-2 semaines)
Lots cohérents à extraire des 53 items deferred :
- **H-1 Atomicité** : `temp-file + rename` pour toutes les projections (D-17, D-29, D-35)
- **H-2 Validation schémas** : guards runtime sur tous les `JSON.parse` de repositories (D-06, D-44)
- **H-3 Windows-safe** : `assertSafeStorageIdentifier` rejette CON/PRN/NUL + caractères réservés (D-37, D-46)
- **H-4 Factorisation type guards** : extraire dans `packages/contracts/` (D-11, D-31, D-53)
- **H-5 CLI safety** : trim `--root`, rejet `limit < 0`, guard ENOENT sur `readEventLog` (D-09, D-32, D-34, D-18)
- **H-6 Symlinks/frontières** : `fs.realpath()` avant compare `rootDir` (D-24, D-40)
- **H-7 Redaction** : masquer les chemins absolus locaux dans le brief OpenAI (D-42)

### 🚀 P2 — V2 : choisir une direction (gros sujets)
D'après la rétro Epic 4 et `etat-v1-et-usage.md:110-113`, trois candidats naturels :

**Option A — `KAIROS` daemon + canal Telegram** (assistant persistant)
- Daemon long-vivant (service utilisateur WSL2 ou Windows)
- Wake-ups programmés, heartbeat
- Telegram long-polling pour approvals mobiles
- Refactor : rendre les 5 projections event-driven push, pas pull-on-demand

**Option B — Router multi-modèles + banc d'éval**
- Nouveaux adaptateurs : Claude Opus 4.6, Gemini 3.1 Pro/Flash-Lite, GPT-5.4 (Responses API avec tool_search)
- Fichier `models/capabilities.yaml` rempli par banc d'éval maison (30 tâches : 10 research, 10 build, 5 growth, 5 risk)
- Critères de routage : succès, exactitude outils, coût, latence, taux de reprise

**Option C — `ULTRAPLAN` couche planification auto**
- Un agent `planner` qui génère automatiquement les tickets depuis un objectif
- Re-planning en boucle quand un ticket échoue
- Gating : plan → review humaine → exécution

**Option D (complémentaire)** — Adaptateurs secondaires manquants
- Compléter `codex-exec` et `codex-sdk` déjà anticipés dans l'arbo architecture

### 📚 P3 — BMAD workflows pertinents maintenant
Conformément à `etat-v1-et-usage.md:115-122` :
- `bmad-retrospective` — **rétro V1 globale** (manque)
- `bmad-product-brief` V2 — dans une nouvelle fenêtre pour arbitrer Option A/B/C
- `bmad-technical-research` — sur daemon persistant OU routeur selon l'option retenue
- `bmad-document-project` — utile maintenant que le code existe, pour les futurs agents de dev

---

## 5. Comment tu peux l'utiliser **dès aujourd'hui**

### Setup 3 minutes
```bash
cd /path/to/corp
npm run build
export OPENAI_API_KEY="sk-..."
alias corp="node $(pwd)/dist/apps/corp-cli/src/index.js"

corp mission bootstrap --root ./workspace-demo
```

### Les 10 patterns concrets (depuis `playbook-operateur-corp-v1.md`)
1. **Audit express d'un repo** — 2 tickets `research` + `review`
2. **Refactor borné** — 3 tickets `plan` → `implement` → `review` chaînés par `depends-on`
3. **Chasse de régression** — ticket `research` (hypothèses) → `implement` (correctif)
4. **Revue sécurité locale** — 2 tickets `research` + `review`
5. **Note d'architecture** — `research` (reconstruction) → `plan` (cible)
6. **Triage backlog** — `research` (inventaire) → `plan` (priorisation)
7. **Capability locale gouvernée** — `validate` + `capability register` + `mission extension select --allow-capability X`
8. **Skill pack local** — `validate` + `skill-pack register` + `mission extension select --skill-pack X`
9. **Reprise ancienne mission** — `resume` + `status` + `audit` + `compare`
10. **Relance ciblée** — `compare relaunch --ticket-id <racine>`

### Commandes du quotidien (à garder sous la main)
```
corp mission bootstrap
corp mission create --title --objective --success-criterion --policy-profile
corp mission status | resume | audit | compare | pause | relaunch | close
corp mission ticket create | board | update | move | cancel | run [--background]
corp mission artifact list | show
corp mission approval queue | approve | reject | defer
corp mission extension select --allow-capability --skill-pack
corp extension validate | capability register | skill-pack register | skill-pack show
```

### Variables d'env utiles
- `OPENAI_API_KEY` (requis)
- `CORP_CODEX_RESPONSES_MODEL` (défaut `gpt-5-codex`)
- `CORP_CODEX_RESPONSES_TIMEOUT_MS` (défaut 300000)
- `OPENAI_BASE_URL` (proxy/local)

### Quand ne **pas** sortir corp
- Question simple sans suivi (prompt shell suffit)
- Tâche < 30 min sans reprise nécessaire
- Actions publication/paiement/outreach autonome (hors scope V1)

---

## 6. Synthèse stratégique : le vrai choix

Selon la rétro Epic 4 et `playbook-operateur-corp-v1.md:622-627`, ce n'est plus un choix technique mais un choix produit :

1. **Déclarer V1 GA-ready** sur le périmètre fonctionnel, fermer la dette en l'acceptant avec justification écrite par item, puis ouvrir V2 sur un des axes A/B/C
2. **Planifier Epic 5 hardening** avant GA (lots H-1 → H-7), puis V2

**Recommandation opérationnelle** : fais le P0 (4 items de gouvernance), lance un **test pilote réel** sur une vraie tâche que tu repousses depuis longtemps (action 1 de `etat-v1-et-usage.md:108`), puis décide A/B/C à froid avec une rétro V1 globale.

Le V1 actuel vaut déjà tout seul pour **gérer des chantiers de 30 min à plusieurs jours avec reprise, audit, isolation git, approvals, extensions gouvernées** — c'est-à-dire ~80 % de la valeur d'un "copilote de chantier" sans aucun scope cloud, mobile ou multi-agents autonomes.