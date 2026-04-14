# Guide d'utilisation — corp V1

## Prerequis

### 1. Compiler le projet

```bash
npm run build
```

Cela genere les fichiers compiles dans `dist/`. La CLI n'est utilisable qu'apres compilation.

### 2. Verifier la cle API OpenAI

La variable d'environnement `OPENAI_API_KEY` doit etre definie. Pour verifier :

```bash
echo $OPENAI_API_KEY
```

Si elle est vide, la definir avant d'executer un ticket :

```bash
export OPENAI_API_KEY="sk-..."
```

### 3. Lancer la CLI

Toutes les commandes suivent le format :

```bash
node dist/apps/corp-cli/src/index.js <commande> [options]
```

Par commodite, ce guide utilise l'alias `corp`. Pour le creer :

```bash
# Option 1 : alias de session
alias corp="node $(pwd)/dist/apps/corp-cli/src/index.js"

# Option 2 : npm link (global)
npm link
```

---

## Test pilote pas a pas

Ce guide decrit un test bout-en-bout : creer une mission, ajouter des tickets, en executer un via Codex, puis consulter les resultats.

### Etape 1 — Initialiser le workspace

```bash
corp mission bootstrap
```

Cela cree le repertoire `.corp/` dans le dossier courant avec la structure de stockage (journal, projections, missions, isolations, capabilities, skill-packs).

> **Note :** `--root <chemin>` permet de specifier un autre repertoire racine. Par defaut, c'est le repertoire courant.

**Resultat attendu :** un message de confirmation et le dossier `.corp/` cree a la racine.

### Etape 2 — Creer une mission

```bash
corp mission create \
  --title "Mission pilote V1" \
  --objective "Valider le flow mission-ticket-execution de bout en bout avec un appel reel a Codex" \
  --success-criterion "Un ticket est execute avec succes via l'adaptateur codex_responses" \
  --success-criterion "Les artefacts produits sont detectes et enregistres" \
  --success-criterion "Les projections (resume-view, ticket-board, artifact-index) sont coherentes" \
  --policy-profile "default"
```

**Resultat attendu :** la CLI affiche l'ID de la mission creee (format `mission_<uuid>`). **Noter cet ID**, il sera necessaire pour toutes les commandes suivantes.

### Etape 3 — Verifier l'etat de la mission

```bash
corp mission status --mission-id <MISSION_ID>
```

Cela affiche l'etat detaille de la mission : objectif, criteres de succes, statut, et section ticket board (vide pour l'instant).

```bash
corp mission resume --mission-id <MISSION_ID>
```

Version compacte orientee operateur : affiche la prochaine action recommandee.

### Etape 4 — Creer un premier ticket (simple)

Commencer par un ticket leger pour valider le flow sans risque :

```bash
corp mission ticket create \
  --mission-id <MISSION_ID> \
  --kind research \
  --goal "Lister les fichiers TypeScript presents a la racine du projet et decrire brievement leur role" \
  --owner "codex-agent" \
  --success-criterion "Une liste des fichiers .ts est produite avec une description d'une ligne chacun"
```

**Resultat attendu :** la CLI affiche l'ID du ticket cree (format `ticket_<uuid>`). **Noter cet ID.**

### Etape 5 — Consulter le ticket board

```bash
corp mission ticket board --mission-id <MISSION_ID>
```

Le ticket doit apparaitre en statut `todo` et marque `runnable: true` (pas de dependances non resolues).

### Etape 6 — Executer le ticket

#### Mode foreground (recommande pour le premier test)

```bash
corp mission ticket run \
  --mission-id <MISSION_ID> \
  --ticket-id <TICKET_ID>
```

Le ticket va :
1. Creer un espace d'isolation (worktree Git si le projet est un repo, sinon copie du workspace)
2. Transiter par les statuts : `todo` -> `claimed` -> `in_progress` -> `done` (ou `failed`)
3. Appeler l'API Codex Responses avec le modele `gpt-5-codex`
4. Detecter et enregistrer les artefacts produits

**Duree estimee :** variable selon la complexite du ticket et la charge de l'API. Le timeout par defaut est de 5 minutes.

#### Mode background (pour les tickets longs)

```bash
corp mission ticket run \
  --mission-id <MISSION_ID> \
  --ticket-id <TICKET_ID> \
  --background
```

Le ticket est lance en arriere-plan. La CLI retourne immediatement. L'execution se fait cote serveur OpenAI.

> **Attention :** en mode background, OpenAI conserve les donnees de reponse environ 10 minutes seulement. Le polling n'est pas encore implemente dans le V1.

### Etape 7 — Verifier les resultats

Apres execution, enchainer ces commandes pour inspecter l'etat :

```bash
# Statut de la mission (vue detaillee avec ticket board)
corp mission status --mission-id <MISSION_ID>

# Resume operateur (vue compacte, prochaine action)
corp mission resume --mission-id <MISSION_ID>

# Ticket board seul
corp mission ticket board --mission-id <MISSION_ID>

# Liste des artefacts
corp mission artifact list --mission-id <MISSION_ID>

# Detail d'un artefact specifique
corp mission artifact show \
  --mission-id <MISSION_ID> \
  --artifact-id <ARTIFACT_ID>

# Timeline d'audit mission-centrique
corp mission audit --mission-id <MISSION_ID>

# Detail d'un evenement precis
corp mission audit show \
  --mission-id <MISSION_ID> \
  --event-id <EVENT_ID>
```

**Ce qu'il faut verifier :**
- Le ticket est en statut `done` (ou `failed` avec un motif)
- Les artefacts produits sont listes dans `artifact list`
- La timeline `mission audit` relie les evenements, validations et artefacts sans relire `events.jsonl` a la main
- Le `mission resume` pointe vers la prochaine action utile
- Le `ticket board` montre un etat coherent

### Etape 8 — Creer un deuxieme ticket avec dependance

Pour tester le graphe de dependances :

```bash
corp mission ticket create \
  --mission-id <MISSION_ID> \
  --kind implement \
  --goal "Creer un fichier HELLO.md contenant un message de bienvenue base sur l'analyse du ticket precedent" \
  --owner "codex-agent" \
  --success-criterion "Un fichier HELLO.md est cree dans le workspace" \
  --depends-on <TICKET_1_ID>
```

Le ticket board doit montrer ce ticket comme `runnable: true` seulement si le premier ticket est `done`.

### Etape 9 — Tester les commandes de cycle de vie

```bash
# Mettre la mission en pause
corp mission pause --mission-id <MISSION_ID>

# Verifier le statut (doit etre blocked/paused)
corp mission status --mission-id <MISSION_ID>

# Relancer la mission
corp mission relaunch --mission-id <MISSION_ID>

# Cloturer la mission (quand tous les tests sont finis)
corp mission close --mission-id <MISSION_ID> --outcome completed
```

### Etape 10 - Comparer l'etat courant puis relancer uniquement la branche impactee

Quand une mission est en echec, bloquee ou en attente d'approbation, commencer par un diagnostic cible :

```bash
corp mission compare --mission-id <MISSION_ID>
```

La sortie compare :
- l'attendu : objectif et criteres de succes
- l'observe : statut mission, tickets ouverts, approvals, blocage et prochaine action
- les ecarts detectes
- la branche impactee : racine, descendants impactes et tickets non impactes

Si une seule racine est relaunchable, relancer uniquement cette racine :

```bash
corp mission compare relaunch \
  --mission-id <MISSION_ID> \
  --ticket-id <ROOT_TICKET_ID>
```

Pour une execution longue, la relance ciblee accepte aussi `--background`.

Points importants :
- `corp mission relaunch` reste une relance globale du cycle de vie mission
- `corp mission compare relaunch` ne cree une nouvelle tentative que pour la racine choisie
- les descendants impactes restent inchanges tant que leurs dependances ne les rendent pas de nouveau executables
- si `compare` affiche `Validation operateur requise`, cela ne signifie pas que les criteres libres sont automatiquement satisfaits

Exemples utiles :

```bash
# Diagnostiquer une mission en echec
corp mission compare --mission-id <MISSION_ID>

# Relancer uniquement le ticket racine calcule par le diagnostic
corp mission compare relaunch \
  --mission-id <MISSION_ID> \
  --ticket-id <TICKET_ID>

# La relance globale reste distincte
corp mission relaunch --mission-id <MISSION_ID>
```

---

## Tests automatises

### Lancer la suite complete

```bash
npm test
```

Cette commande compile le projet puis execute tous les tests (unitaires, integration, contractuels). Tous les tests doivent passer avant de considerer une story comme validee.

### Lancer les tests par Epic

#### Epic 1 a 3 — Mission, tickets, approbation et audit

```bash
npm run build && node --test \
  "dist/tests/unit/*.test.js" \
  "dist/tests/integration/*.test.js" \
  "dist/tests/contract/mission-*.test.js"
```

#### Epic 4 — Extensions

```bash
npm run build && node --test \
  "dist/tests/unit/skill-pack-registration.test.js" \
  "dist/tests/unit/capability-registry-registration.test.js" \
  "dist/tests/unit/extension-registration-validation.test.js" \
  "dist/tests/unit/audit-log-projection.test.js" \
  "dist/tests/unit/formatters.test.js" \
  "dist/tests/integration/skill-pack-register-cli.test.js" \
  "dist/tests/integration/mission-extension-selection.test.js" \
  "dist/tests/integration/run-ticket-skill-pack-loading.test.js" \
  "dist/tests/integration/capability-register-cli.test.js" \
  "dist/tests/integration/capability-invocation-audit.test.js" \
  "dist/tests/integration/extension-registration-file-loading.test.js" \
  "dist/tests/contract/extension-validate-cli.test.js" \
  "dist/tests/contract/mission-extension-cli.test.js"
```

### Test pilote des extensions V1 (stories 4.1 - 4.4)

Ce test manuel valide la surface auteur `corp extension validate`, puis l'enregistrement runtime capability-only et skill-pack du workspace.

#### Prerequis

```bash
npm run build
alias corp="node $(pwd)/dist/apps/corp-cli/src/index.js"
```

#### 1 — Verifier que l'aide expose la surface extension

```bash
corp
```

La sortie doit mentionner `corp extension validate --file <path>`, `corp extension capability register --root <workspace> --file <path>`, `corp extension skill-pack register --root <workspace> --file <path>` et `corp extension skill-pack show --root <workspace> --pack-ref <ref>` en plus des commandes mission.

#### 2 — Valider les manifestes valides (trois seams)

```bash
# Capability locale
corp extension validate --file ./tests/fixtures/extensions/valid-capability-local.json

# Execution adapter
corp extension validate --file ./tests/fixtures/extensions/valid-execution-adapter.json

# Skill pack
corp extension validate --file ./tests/fixtures/extensions/valid-skill-pack.json

# Capability MCP-backed
corp extension validate --file ./tests/fixtures/extensions/valid-capability-mcp.json
```

**Resultat attendu :** chaque commande affiche `Validation extension: ok` avec le type de seam et l'identifiant public.

#### 3 — Tester les rejets sur manifestes invalides

```bash
# Manifeste hors scope (marketplace)
corp extension validate --file ./tests/fixtures/extensions/invalid-marketplace.json

# Manifeste avec ref distante
corp extension validate --file ./tests/fixtures/extensions/invalid-remote-ref.json

# Manifeste avec ref locale manquante
corp extension validate --file ./tests/fixtures/extensions/invalid-missing-local-ref.json
```

**Resultat attendu :** chaque commande affiche `Validation extension: echec` avec des diagnostics structures (`code + path + message`).

#### 4 — Confirmer l'isolation (pas de `.corp/` cree)

```bash
# Depuis un repertoire vierge
cd /tmp && mkdir test-ext && cd test-ext
cp -r <chemin-projet>/tests/fixtures/extensions .
node <chemin-projet>/dist/apps/corp-cli/src/index.js extension validate --file ./extensions/valid-skill-pack.json
ls -la   # .corp/ ne doit PAS exister
cd - && rm -rf /tmp/test-ext
```

#### Ce qu'il faut verifier

- La validation est offline, sans reseau et sans `.corp/`
- Les trois seams (`execution_adapter`, `capability`, `skill_pack`) sont acceptes
- Les manifestes MCP-backed acceptent `mcpServerName` + `mcpToolName`
- Les champs hors scope V1 sont rejetes avec des diagnostics explicites
- Aucune fuite vendor (`responseId`, `apiKey`, `pollCursor`) dans les sorties

#### 5 â€” Enregistrer une capability valide dans un workspace initialise

```bash
mkdir -p /tmp/corp-ext-register
corp mission bootstrap --root /tmp/corp-ext-register

# Capability locale
corp extension capability register \
  --root /tmp/corp-ext-register \
  --file ./tests/fixtures/extensions/valid-capability-local.json

# Capability MCP-backed
corp extension capability register \
  --root /tmp/corp-ext-register \
  --file ./tests/fixtures/extensions/valid-capability-mcp.json
```

**Resultat attendu :**
- la commande retourne `Capability enregistree: <capabilityId>`
- le statut vaut `registered` au premier chargement puis `unchanged` si on recharge le meme manifeste
- le registre runtime est persiste sous `.corp/capabilities/<capabilityId>/capability.json`
- une declaration `skill_pack` ou `execution_adapter` est rejetee explicitement dans ce flux

#### 6 â€” Verifier le preflight runtime et l'audit capability

Apres enregistrement, un ticket qui reference `--allow-capability shell.exec` peut etre lance normalement. La timeline `corp mission audit` doit alors contenir un evenement `capability.invoked`, sans fuite vendor ni secret.

#### 7 - Enregistrer puis consulter un skill pack local

```bash
# Skill pack local
corp extension skill-pack register \
  --root /tmp/corp-ext-register \
  --file ./tests/fixtures/extensions/valid-skill-pack.json

corp extension skill-pack show \
  --root /tmp/corp-ext-register \
  --pack-ref pack.triage.local
```

**Resultat attendu :**
- la commande `register` retourne `Skill pack enregistre: pack.triage.local`
- le statut vaut `registered` au premier chargement puis `unchanged` si on recharge le meme manifeste
- le registre runtime est persiste sous `.corp/skill-packs/pack.triage.local/skill-pack.json`
- la commande `show` affiche uniquement les metadonnees et les chemins resolus (`rootDir`, `references`, `metadataFile`, `scripts`, `sourceManifestPath`, `registeredAt`)
- la sortie ne contient ni le contenu de `README.md` (`Pack de triage local.`), ni celui du script (`echo "preflight"`)

---

## Valider un manifeste d'extension V1

La story 4.1 ajoute une surface auteur minimale, offline et en lecture seule pour verifier un manifeste local sans mission, sans reseau et sans creation de `.corp/` :

```bash
corp extension validate --file ./tests/fixtures/extensions/valid-capability-local.json
```

Points importants :
- le fichier doit etre un manifeste JSON `corp.extension.v1`
- la validation reste bornee a `execution_adapter`, `capability` ou `skill_pack`
- les refs locales sont resolues relativement au fichier de declaration
- seules des refs locales, des noms de variables d'environnement et, pour MCP, des noms `mcpServerName` / `mcpToolName` sont autorises
- toute tentative d'introduire `marketplace`, `pluginHost`, `controlPlane`, `distributionUrl`, `installUrl`, `webhook`, `.codex/config.toml` ou `.codex-plugin/plugin.json` echoue

Exemple de manifeste valide :

```json
{
  "schemaVersion": "corp.extension.v1",
  "seamType": "capability",
  "id": "ext.capability.shell.exec.local",
  "displayName": "Shell exec local",
  "version": "0.1.0",
  "permissions": ["shell.exec", "fs.read"],
  "constraints": ["local_only", "approval_sensitive", "workspace_scoped"],
  "metadata": {
    "description": "Expose une capability locale bornee au workspace.",
    "owner": "core-platform",
    "tags": ["capability", "local"]
  },
  "localRefs": {
    "rootDir": ".",
    "entrypoint": "./capabilities/shell-exec.ts",
    "references": ["./docs/capability-local.md"],
    "scripts": ["./scripts/validate-capability.ps1"]
  },
  "capability": {
    "capabilityId": "shell.exec",
    "provider": "local",
    "approvalSensitive": true,
    "requiredEnvNames": []
  }
}
```

Sortie attendue sur un manifeste valide :

```text
Validation extension: ok
Schema: corp.extension.v1
Type de seam: capability
Capability publique: shell.exec
```

Exemple de manifeste invalide hors scope :

```json
{
  "schemaVersion": "corp.extension.v1",
  "seamType": "capability",
  "id": "ext.capability.invalid.marketplace",
  "displayName": "Manifeste invalide",
  "version": "0.1.0",
  "permissions": ["docs.read"],
  "constraints": ["local_only"],
  "metadata": {
    "description": "Fixture invalide.",
    "owner": "core-platform",
    "tags": ["invalid"]
  },
  "localRefs": {
    "rootDir": ".",
    "entrypoint": "./capabilities/shell-exec.ts",
    "references": ["./docs/capability-local.md"],
    "scripts": []
  },
  "capability": {
    "capabilityId": "docs.read.local",
    "provider": "local",
    "approvalSensitive": false,
    "requiredEnvNames": []
  },
  "marketplace": {
    "catalog": "https://example.invalid/catalog"
  }
}
```

Sortie attendue sur un manifeste invalide :

```text
Validation extension: echec
Diagnostics:
  1. [out_of_scope_field] marketplace - Le contrat V1 refuse toute logique de marketplace ou catalogue distant.
```

## Enregistrer une capability dans un workspace

La story 4.2 ajoute un registre runtime workspace-scoped pour les capabilities. Le flux operateur recommande est :

```bash
# 1. Validation auteur read-only
corp extension validate --file ./tests/fixtures/extensions/valid-capability-local.json

# 2. Bootstrap workspace (une seule fois)
corp mission bootstrap --root ./workspace-demo

# 3. Enregistrement runtime capability-only
corp extension capability register \
  --root ./workspace-demo \
  --file ./tests/fixtures/extensions/valid-capability-local.json
```

Points importants :
- `validate` reste offline, read-only et ne cree jamais `.corp/`
- `register` exige un workspace deja initialise
- `register` accepte uniquement `seamType = "capability"` et rejette explicitement `execution_adapter` / `skill_pack`
- le registre persiste une entree vendor-neutre alignee sur `Ticket.allowedCapabilities[]`
- `corp mission ticket run` fait echouer proprement un ticket si une capability referencee n'est pas enregistree
- `corp mission audit` rend visible `capability.invoked` avec ses correlations mission/ticket/tentative

## Enregistrer et consulter un skill pack dans un workspace

La story 4.3 ajoute un registre runtime workspace-scoped pour les skill packs locaux. Le flux operateur recommande est :

```bash
# 1. Validation auteur read-only
corp extension validate --file ./tests/fixtures/extensions/valid-skill-pack.json

# 2. Bootstrap workspace (une seule fois)
corp mission bootstrap --root ./workspace-demo

# 3. Enregistrement runtime skill-pack
corp extension skill-pack register \
  --root ./workspace-demo \
  --file ./tests/fixtures/extensions/valid-skill-pack.json

# 4. Consultation metadata-first
corp extension skill-pack show \
  --root ./workspace-demo \
  --pack-ref pack.triage.local
```

Points importants :
- `register` exige un workspace deja initialise
- `show` lit le registre workspace sans charger le contenu des references, du `metadataFile` ou des scripts
- `corp mission ticket run` fait echouer proprement un ticket si un `skillPackRef` reference un pack inconnu ou hors frontiere locale
- l'adaptateur recoit un resume compact (`packRef`, nom, description, refs locales resolues) sans charger `README.md`, `pack.json` ou les scripts

## Selectionner les extensions autorisees d'une mission

La story 4.4 ajoute une gouvernance mission-scope: le workspace peut enregistrer plusieurs extensions, mais chaque mission choisit explicitement celles qu'elle autorise.

Flux operateur recommande :

```bash
# 1. Bootstrap workspace puis enregistrer les extensions voulues
corp mission bootstrap --root ./workspace-demo

corp extension capability register \
  --root ./workspace-demo \
  --file ./tests/fixtures/extensions/valid-capability-local.json

corp extension skill-pack register \
  --root ./workspace-demo \
  --file ./tests/fixtures/extensions/valid-skill-pack.json

# 2. Creer la mission
corp mission create \
  --root ./workspace-demo \
  --title "Mission extensions gouvernees" \
  --objective "Executer des tickets avec un perimetre d'extensions borne" \
  --success-criterion "Les refs ticket respectent la selection mission" \
  --policy-profile "policy_profile_local"

# 3. Selectionner les extensions autorisees
corp mission extension select \
  --root ./workspace-demo \
  --mission-id <MISSION_ID> \
  --allow-capability shell.exec \
  --skill-pack pack.triage.local

# 4. Verifier le plafond de gouvernance et l'usage
corp mission status --root ./workspace-demo --mission-id <MISSION_ID>
corp mission resume --root ./workspace-demo --mission-id <MISSION_ID>
corp mission audit --root ./workspace-demo --mission-id <MISSION_ID>
```

Points importants :
- `corp mission extension select` valide chaque `capabilityId` et `packRef` contre les registres locaux du workspace
- une mutation vide, une mission inconnue ou une ref absente du registre echoue avec un message deterministe
- `fs.read` et `cli.run` restent des built-ins V1: ils ne passent pas par `corp mission extension select` et conservent leur comportement historique
- `ticket create`, `ticket update`, `approval approve/reject/defer` et `ticket run` refusent toute ref hors selection mission
- si la mission retire ensuite une extension encore referencee par un ticket, `ticket run` echoue avant tout lancement adaptateur
- `mission status`, `mission resume`, `ticket board` et `mission audit` rendent visibles a la fois la selection courante et l'usage effectif (`capability.invoked`, `skill_pack.used`)

---

## Reference des commandes

### Mission

| Commande | Description |
|----------|-------------|
| `corp mission bootstrap` | Initialiser le workspace `.corp/` |
| `corp mission create` | Creer une nouvelle mission |
| `corp mission status --mission-id <id>` | Vue detaillee de la mission |
| `corp mission resume --mission-id <id>` | Vue compacte avec prochaine action |
| `corp mission compare --mission-id <id>` | Diagnostic attendu / observe et branche impactee |
| `corp mission audit --mission-id <id>` | Chronologie structuree mission-centrique |
| `corp mission audit show --mission-id <id> --event-id <id>` | Detail d'un evenement et de ses correlations |
| `corp mission pause --mission-id <id>` | Mettre la mission en pause |
| `corp mission relaunch --mission-id <id>` | Relance globale du cycle de vie mission |
| `corp mission compare relaunch --mission-id <id> --ticket-id <id>` | Relance ciblee de la racine impactee |
| `corp mission close --mission-id <id> --outcome <completed\|cancelled>` | Cloturer la mission |

### Extension

| Commande | Description |
|----------|-------------|
| `corp extension validate --file <path>` | Valider offline un manifeste `corp.extension.v1` sans bootstrap mission |
| `corp extension capability register --root <workspace> --file <path>` | Enregistrer une capability valide dans le registre local du workspace |
| `corp extension skill-pack register --root <workspace> --file <path>` | Enregistrer un skill pack valide dans le registre local du workspace |
| `corp extension skill-pack show --root <workspace> --pack-ref <ref>` | Afficher le resume metadata-first d'un skill pack enregistre |

### Ticket

| Commande | Description |
|----------|-------------|
| `corp mission ticket create` | Creer un ticket dans une mission |
| `corp mission ticket update` | Modifier un ticket existant |
| `corp mission ticket move` | Reprioriser un ticket dans le plan |
| `corp mission ticket cancel --mission-id <id> --ticket-id <id>` | Annuler un ticket |
| `corp mission ticket run --mission-id <id> --ticket-id <id>` | Executer un ticket |
| `corp mission ticket board --mission-id <id>` | Afficher le tableau des tickets |

### Artefact

| Commande | Description |
|----------|-------------|
| `corp mission artifact list --mission-id <id>` | Lister les artefacts |
| `corp mission artifact show --mission-id <id> --artifact-id <id>` | Detail d'un artefact |

### Options de ticket create

| Flag | Requis | Repetable | Description |
|------|--------|-----------|-------------|
| `--mission-id <id>` | Oui | Non | ID de la mission |
| `--kind <type>` | Oui | Non | `research`, `plan`, `implement`, `review`, `operate` |
| `--goal <texte>` | Oui | Non | Objectif du ticket |
| `--owner <owner>` | Oui | Non | Responsable de l'execution |
| `--success-criterion <texte>` | Oui | Oui | Critere de succes (au moins un) |
| `--depends-on <ticket_id>` | Non | Oui | Dependance vers un autre ticket |
| `--allow-capability <cap>` | Non | Oui | Capacite autorisee |
| `--skill-pack <ref>` | Non | Oui | Reference de skill pack |

### Options de ticket move

| Flag | Description |
|------|-------------|
| `--to-front` | Deplacer en tete du plan |
| `--to-back` | Deplacer en fin du plan |
| `--before-ticket <id>` | Placer avant un ticket reference |
| `--after-ticket <id>` | Placer apres un ticket reference |

---

## Variables d'environnement

| Variable | Requise | Defaut | Description |
|----------|---------|--------|-------------|
| `OPENAI_API_KEY` | Oui | — | Cle d'authentification API OpenAI |
| `CORP_CODEX_RESPONSES_MODEL` | Non | `gpt-5-codex` | Modele utilise par l'adaptateur |
| `OPENAI_BASE_URL` | Non | `https://api.openai.com/v1` | URL de base de l'API (pour proxy ou local) |
| `CORP_CODEX_RESPONSES_TIMEOUT_MS` | Non | `300000` (5 min) | Timeout de requete en millisecondes |

---

## Structure de stockage

Apres `bootstrap`, le repertoire `.corp/` contient :

```
.corp/
├── journal/
│   └── events.jsonl              # Journal append-only (source de verite)
├── projections/
│   ├── mission-status.json
│   ├── ticket-board.json
│   ├── resume-view.json
│   ├── artifact-index.json
│   ├── audit-log.json
│   └── approval-queue.json
├── missions/
│   └── <missionId>/
│       ├── mission.json           # Snapshot de la mission
│       └── tickets/
│           └── <ticketId>/
│               ├── ticket.json    # Snapshot du ticket
│               ├── attempts/
│               │   └── <attemptId>/
│               │       └── attempt.json
│               └── artifacts/
│                   └── <artifactId>/
│                       └── artifact.json
├── capabilities/
│   └── <capabilityId>/
│       └── capability.json        # Entree runtime vendor-neutre
├── skill-packs/
│   └── <packRef>/
│       └── skill-pack.json        # Entree runtime metadata-first
└── isolations/
    └── <isoId>/
        ├── isolation.json
        └── workspace/             # Worktree Git ou copie du workspace
```

---

## Depannage

### `OPENAI_API_KEY is not set` ou erreur d'authentification
Verifier que la variable est exportee dans le shell courant :
```bash
echo $OPENAI_API_KEY
```

### Timeout lors de `ticket run`
Augmenter le timeout :
```bash
export CORP_CODEX_RESPONSES_TIMEOUT_MS=600000   # 10 minutes
```

### Le ticket reste en `failed`
Consulter le detail :
```bash
corp mission status --mission-id <MISSION_ID>
corp mission ticket board --mission-id <MISSION_ID>
corp mission compare --mission-id <MISSION_ID>
```
Le motif d'echec apparait dans le ticket board. Verifier aussi le journal brut :
```bash
cat .corp/journal/events.jsonl | tail -20
```

### Aucun artefact detecte apres execution
- Si le ticket n'a pas produit de fichiers dans le workspace isole, c'est normal.
- Les artefacts de type `text_output` et `structured_output` sont aussi captures depuis les sorties de l'adaptateur.
- Verifier le contenu de `.corp/isolations/<isoId>/workspace/` pour voir ce que l'execution a produit.

### Le workspace n'est pas un repo Git
L'isolation bascule automatiquement en mode copie de fichiers. Le comportement est identique, mais la detection d'artefacts utilise une comparaison de fichiers au lieu de `git diff`.
