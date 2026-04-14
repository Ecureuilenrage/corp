# Story 4.4: Selectionner les extensions autorisees par mission et tracer leur usage en CLI

Status: done

## Story

As a operateur technique,
I want choisir quelles extensions sont disponibles pour une mission et voir lesquelles ont ete utilisees,
so that l'extensibilite reste gouvernee et lisible.

## Context

Le V1 sait maintenant:

- publier et valider offline un manifeste `corp.extension.v1` (story 4.1);
- enregistrer une capability locale ou MCP-backed dans un registre workspace-scoped et tracer `capability.invoked` dans l'audit (stories 4.2 puis 4.5);
- enregistrer un skill pack local, le resoudre au runtime ticket et l'injecter dans le brief adaptateur en mode metadata-first (story 4.3).

Le gap restant pour 4.4 est net:

- le workspace sait quelles extensions existent, mais une mission ne sait toujours pas lesquelles elle autorise;
- `Mission` ne porte aujourd'hui qu'un `policyProfileId`, sans selection mission-scope des capabilities ou skill packs;
- `Ticket.allowedCapabilities[]` et `Ticket.skillPackRefs[]` restent libres au niveau create/update/approval, sans verification contre une selection de mission;
- `run-ticket.ts` preflight les capabilities enregistrees et resout les skill packs, mais ne borne pas ces refs par une gouvernance mission-scope;
- l'audit sait decrire `capability.invoked`, mais aucun evenement ne rend visible l'usage effectif d'un skill pack par ticket;
- `mission status`, `ticket board` et `mission resume` ne montrent ni la selection courante d'extensions d'une mission, ni un resume compact de leur usage par ticket;
- `apps/corp-cli/src/commands/extension-command.ts` couvre la registration workspace, mais il n'existe aucune commande `corp mission ...` pour selectionner des extensions sur une mission concrete;
- aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`; ne pas supposer hooks, CI locale ou conventions de commit pour cette story.

### Delta explicite par rapport au code actuel

- `packages/contracts/src/mission/mission.ts` ne porte aucune structure de type `authorizedExtensions`; l'etat mission durable ne sait donc pas governer les refs de ticket.
- `packages/mission-kernel/src/mission-service/create-mission.ts` initialise une mission sans selection d'extensions; tout ajout 4.4 devra definir une valeur par defaut stable et retro-compatible.
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts` et `update-ticket.ts` normalisent `allowedCapabilities[]` et `skillPackRefs[]`, mais ne verifient pas qu'ils sont autorises par la mission courante.
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` peut aussi modifier `allowedCapabilities` et `skillPackRefs` a chaud; 4.4 doit fermer ce trou de contournement.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` saute deja les built-ins `fs.read` et `cli.run`, journalise `capability.invoked`, resout les skill packs et lance l'adaptateur, mais n'emet aucun fait dedie a l'usage effectif des skill packs.
- `packages/journal/src/projections/ticket-board-projection.ts` transporte deja `allowedCapabilities` et `skillPackRefs` demandes par ticket, mais ne calcule aucun resume d'usage runtime et `apps/corp-cli/src/formatters/ticket-board-formatter.ts` ne les affiche pas.
- `packages/journal/src/projections/audit-log-projection.ts` et `packages/mission-kernel/src/resume-service/read-mission-audit.ts` ne savent formatter que `capability.invoked` cote extensions; il manque au minimum la mutation de selection mission et l'usage des skill packs.
- `packages/storage/src/repositories/file-capability-registry-repository.ts` et `file-skill-pack-registry-repository.ts` exposent deja `find...()` et `list()`; 4.4 doit les reutiliser pour valider la selection mission-scope au lieu d'inventer un second stockage.
- `guide-utilisation.md` s'arrete a la surface auteur/runtime des stories 4.1 a 4.3; aucun scenario operateur ne montre encore comment missionner, gouverner puis relire l'usage des extensions.

### Recommended slice for 4.4

1. Introduire une selection mission-scope explicite et durable des extensions autorisees, stockee sur `Mission` dans un shape minimal et vendor-neutre.
2. Exposer une commande operateur `corp mission extension select` pour mettre a jour cette selection de maniere auditable, avec verification contre les registres workspace existants.
3. Faire de cette selection un upper bound strict des refs de ticket:
   - `ticket create`, `ticket update`, `approval approve/reject/defer` et `ticket run` doivent tous la respecter;
   - aucun ref capability ou skill pack hors selection mission ne doit etre accepte ou invoque silencieusement.
4. Garder les built-ins `fs.read` et `cli.run` hors du perimetre "extension locale enregistree"; 4.4 ne doit pas casser leur bypass historique ni les forcer dans les registres.
5. Journaliser deux faits distincts et lisibles:
   - la mutation de selection mission (`mission.extensions_selected` ou equivalent canonique);
   - l'usage effectif d'un skill pack au runtime (`skill_pack.used` ou equivalent canonique), en complement de `capability.invoked`.
6. Rendre cette gouvernance visible sur les surfaces operateur deja legitimement centrales du V1:
   - lecture mission-centrique via `mission status` / `ticket board`;
   - chronologie et detail via `mission audit` / `mission audit show`.
7. Garder hors scope toute selection d'`execution_adapter`, toute marketplace, toute sync distante, toute auto-discovery de `.agents/skills` et toute execution implicite de scripts de skill pack.

## Acceptance Criteria

1. Given une mission dispose d'extensions locales enregistrees
   When l'operateur selectionne les extensions autorisees pour cette mission
   Then seules ces extensions deviennent disponibles pour les tickets de la mission
   And une extension non autorisee ne peut pas etre invoquee par l'execution

2. Given des tickets ont utilise des extensions au cours d'une mission
   When l'operateur consulte la CLI de mission ou d'audit
   Then il voit quelles extensions, capabilities ou skills ont ete mobilises par ticket
   And la logique de mission, de delegation, d'approbation et d'audit reste coherente sur toute la surface operateur V1

## Tasks / Subtasks

- [x] Definir le contrat mission-scope de selection des extensions (AC: 1, 2)
  - [x] Ajouter a `Mission` une structure durable de type `authorizedExtensions` ou equivalent, avec au minimum `allowedCapabilities[]` et `skillPackRefs[]`.
  - [x] Initialiser cette structure a des listes vides dans `create-mission.ts` pour garder un schema complet et stable des la creation.
  - [x] Propager la lecture de cette selection dans `MissionResume`, `mission-status` et toute validation/type guard associee.
  - [x] Ne pas etendre `Ticket` ni `ExecutionAttempt` avec un miroir complet de la selection mission; le ticket garde ses refs demandees, la mission porte le plafond de gouvernance.
  - [x] Ajouter un evenement normalise `mission.extensions_selected` (ou nom equivalent documente) avec `missionId`, `eventId`, `actor`, `source`, `previousAuthorizedExtensions`, `authorizedExtensions`, `changedFields` et `trigger`.

- [x] Exposer une surface CLI operateur pour selectionner les extensions d'une mission (AC: 1)
  - [x] Ajouter une sous-commande `corp mission extension select --root <workspace> --mission-id <id> [--allow-capability <cap>|--clear-allow-capability] [--skill-pack <ref>|--clear-skill-pack]`.
  - [x] Retourner des erreurs deterministes si la mission n'existe pas, si la mutation est vide, ou si une ref demandee n'est pas enregistree dans le registre local du workspace.
  - [x] Verifier les capabilities via `FileCapabilityRegistryRepository.findByCapabilityId/list()` et les skill packs via `FileSkillPackRegistryRepository.findByPackRef/list()`.
  - [x] Garder `fs.read` et `cli.run` hors de cette commande: ce sont des built-ins V1, pas des extensions locales enregistrees.
  - [x] Mettre a jour l'aide CLI et `guide-utilisation.md` avec le flux `extension register -> mission extension select -> mission status/audit`.

- [x] Faire respecter la selection mission-scope sur tout le cycle de vie ticket (AC: 1)
  - [x] Dans `create-ticket.ts`, refuser toute capability non built-in ou tout skill pack absent de la selection mission courante.
  - [x] Dans `update-ticket.ts`, appliquer la meme validation aux mutations de `allowedCapabilities[]` et `skillPackRefs[]`.
  - [x] Dans `resolve-approval-request.ts`, empecher qu'une decision d'approbation injecte des refs hors selection mission.
  - [x] Dans `run-ticket.ts`, revalider la conformite mission-scope juste avant le preflight registry et avant le `adapter.launch(...)` pour fermer les derives entre create/update et execution.
  - [x] Si la selection mission a ete restreinte apres creation d'un ticket, faire echouer le `ticket run` avant execution externe avec un message deterministe; ne pas filtrer silencieusement ni reecrire implicitement le ticket.

- [x] Tracer l'usage effectif des extensions et le rendre lisible en CLI (AC: 2)
  - [x] Conserver `capability.invoked` comme fait canonique pour les capabilities enregistrees.
  - [x] Ajouter un fait journalise pour l'usage effectif d'un skill pack (`skill_pack.used` ou equivalent), emis uniquement quand un pack resolu est reellement transmis a l'adaptateur.
  - [x] Definir un payload vendor-neutre de type `SkillPackUsageDetails` ou equivalent avec au minimum `packRef`, `registrationId`, `displayName`, `permissions`, `constraints`, `owner`, `tags`.
  - [x] Etendre `audit-log-projection.ts` pour decrire `mission.extensions_selected` et `skill_pack.used` avec titres, resumes et correlations ticket/tentative.
  - [x] Etendre `read-mission-audit.ts` et `audit-entry-detail-formatter.ts` pour rendre les details lisibles: selection courante, deltas de selection, pack utilise, trigger, garde-fous ou refs utiles sans charger le contenu des fichiers.
  - [x] Etendre `ticket-board-projection.ts` puis `ticket-board-formatter.ts` ou `mission-status-formatter.ts` afin qu'un operateur voie au moins un resume compact des extensions mobilisees par ticket, sans devoir lire `events.jsonl`.

- [x] Couvrir les regressions et les chemins limites 4.4 (AC: 1, 2)
  - [x] Tester qu'une selection mission ne peut referencer qu'une capability/skill pack deja enregistre dans le workspace.
  - [x] Tester qu'un ticket ne peut pas etre cree, mis a jour ou approuve avec une ref hors selection mission.
  - [x] Tester qu'un ticket deja cree devient non runnable si la mission retire ensuite une extension qu'il reference encore, avec echec avant `adapter.launch`.
  - [x] Tester que `fs.read` et `cli.run` gardent leur comportement actuel sans passer par la selection mission ni le registre.
  - [x] Tester que `capability.invoked` et `skill_pack.used` apparaissent dans `mission audit` avec `ticketId` et `attemptId`, sans fuite vendor (`responseId`, `pollCursor`, `vendorStatus`, contenu des refs de skill pack).
  - [x] Tester que `mission status` ou `ticket board` expose un resume lisible des extensions selectionnees et mobilisees par ticket.

### Review Findings

- [x] [Review][Patch] Garde statut terminal manquante dans `selectMissionExtensions` — un operateur pouvait modifier la selection d'extensions d'une mission completed/cancelled/failed [select-mission-extensions.ts]
- [x] [Review][Patch] Couverture manquante `skill_pack.used` et `mission.extensions_selected` dans audit-log-projection.test.ts — aucun test unitaire ne validait le rendu de ces deux evenements [audit-log-projection.test.ts]
- [x] [Review][Defer] Race condition TOCTOU dans selectMissionExtensions (read-validate-write sans verrou) — pattern pre-existant sur tout le codebase, non introduit par 4.4
- [x] [Review][Defer] TOCTOU dans run-ticket.ts entre les deux ensureTicketExtensionsAllowedByMission — pattern pre-existant, fenetre etroite
- [x] [Review][Defer] Approbation sans re-validation registre — l'approbation ne revalide pas les refs contre le registre workspace, mais run-ticket le fait au preflight
- [x] [Review][Defer] Sensibilite a la casse des identifiants capability/skill pack — design pre-existant, coherent sur tout le pipeline
- [x] [Review][Defer] Type-guards dupliques entre audit-log-projection.ts et read-mission-audit.ts — pattern pre-existant des stories 3.x/4.2/4.5

## Dev Notes

### Story Intent

La story 4.4 ne doit pas transformer `corp` en plugin host ou en control plane d'extensions. Elle doit simplement combler le dernier gap de gouvernance entre:

- des extensions workspace-scoped deja enregistrees;
- des tickets qui portent deja des refs capabilities / skill packs;
- la necessite operateur de borner ces refs a une mission concrete et d'en relire l'usage sans fouille manuelle.

Le livrable attendu est donc quadruple:

- une selection mission-scope durable et auditable;
- une commande operateur pour la modifier proprement;
- un gate de validation applique a create/update/approval/run;
- une lecture CLI lisible de la selection et de l'usage reel des extensions par ticket.

Si la solution ajoute une marketplace, une selection d'adaptateur vendor, une auto-discovery de skills, ou une execution implicite de scripts de pack, elle rate sa cible.

### Current Project State

- `packages/contracts/src/mission/mission.ts` ne porte aujourd'hui que `policyProfileId` pour la gouvernance mission.
- `packages/contracts/src/ticket/ticket.ts` porte deja `allowedCapabilities[]` et `skillPackRefs[]`.
- `packages/mission-kernel/src/mission-service/create-mission.ts` cree une mission `ready` sans aucune selection d'extensions.
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts` et `update-ticket.ts` acceptent librement les refs d'extensions apres normalisation.
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` peut encore muter ces refs sans garde mission-scope.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`:
  - bypass `fs.read` et `cli.run` comme built-ins;
  - journalise `capability.invoked`;
  - resout les skill packs et les transmet a `adapter.launch(...)`;
  - ne journalise pas l'usage des skill packs;
  - ne revalide pas les refs contre une selection mission.
- `packages/storage/src/repositories/file-capability-registry-repository.ts` et `file-skill-pack-registry-repository.ts` savent deja `find...()` et `list()`.
- `packages/journal/src/projections/ticket-board-projection.ts` garde deja la demande ticket (`allowedCapabilities`, `skillPackRefs`) mais pas l'usage effectif.
- `apps/corp-cli/src/formatters/ticket-board-formatter.ts` n'affiche aujourd'hui ni refs demandees, ni refs utilisees.
- `packages/journal/src/projections/audit-log-projection.ts` et `packages/mission-kernel/src/resume-service/read-mission-audit.ts` savent decrire `capability.invoked`, pas `skill_pack.used` ni une mutation mission-scope de selection.
- `guide-utilisation.md` documente 4.1 a 4.3, mais pas la gouvernance mission-scope des extensions.
- la baseline effective pour 4.4 doit etre le code reel des stories 4.2, 4.3 et 4.5, meme si `sprint-status.yaml` garde 4.2 en `review`.

### Recommended Contract Shape

Shape mission recommande:

```json
{
  "id": "mission_...",
  "title": "string",
  "objective": "string",
  "status": "ready",
  "successCriteria": ["string"],
  "policyProfileId": "policy_profile_local",
  "authorizedExtensions": {
    "allowedCapabilities": ["shell.exec"],
    "skillPackRefs": ["pack.triage.local"]
  },
  "ticketIds": ["ticket_..."],
  "artifactIds": ["artifact_..."],
  "eventIds": ["event_..."],
  "resumeCursor": "event_...",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Principes structurants:

- la selection mission est un upper bound sur les refs demandees par ticket;
- `Ticket.allowedCapabilities[]` et `Ticket.skillPackRefs[]` restent la demande locale d'un ticket, pas la source de gouvernance globale;
- 4.4 ne doit pas appliquer un "intersection silencieux" a l'execution: une ref hors selection mission doit produire une erreur claire, pas disparaitre discretement;
- les built-ins `fs.read` et `cli.run` restent hors de `authorizedExtensions`, car ils ne sont pas des extensions locales enregistrees;
- la selection mission ne doit pas embarquer le manifeste complet ni des details vendor runtime.

Shape evenement recommande pour la mutation de selection:

```json
{
  "eventId": "event_...",
  "type": "mission.extensions_selected",
  "missionId": "mission_...",
  "occurredAt": "timestamp",
  "actor": "operator",
  "source": "corp-cli",
  "payload": {
    "mission": { "...": "mission mise a jour" },
    "previousAuthorizedExtensions": {
      "allowedCapabilities": ["shell.exec"],
      "skillPackRefs": []
    },
    "authorizedExtensions": {
      "allowedCapabilities": ["shell.exec", "docs.read.local"],
      "skillPackRefs": ["pack.triage.local"]
    },
    "changedFields": ["allowedCapabilities", "skillPackRefs"],
    "trigger": "operator"
  }
}
```

Shape evenement recommande pour l'usage effectif d'un skill pack:

```json
{
  "eventId": "event_...",
  "type": "skill_pack.used",
  "missionId": "mission_...",
  "ticketId": "ticket_...",
  "attemptId": "attempt_...",
  "occurredAt": "timestamp",
  "actor": "system",
  "source": "ticket-runtime",
  "payload": {
    "skillPack": {
      "packRef": "pack.triage.local",
      "registrationId": "ext.skill-pack.triage.local",
      "displayName": "Pack de triage local",
      "permissions": ["docs.read"],
      "constraints": ["local_only", "workspace_scoped"],
      "owner": "core-platform",
      "tags": ["skill-pack", "local"]
    },
    "trigger": "ticket_run_launch"
  }
}
```

### Architecture Compliance

- `Mission` peut porter une selection mission-scope minimale car l'architecture lui attribue deja les policies par defaut et le point de reprise operateur. [Source: architecture.md - 3.3 Canonical Domain Contract]
- `Ticket` reste l'unite de travail delegable; 4.4 ne doit pas supprimer `allowedCapabilities[]` ni `skillPackRefs[]`, seulement les borner. [Source: architecture.md - 3.3 Canonical Domain Contract]
- Tout nouveau fait doit rester un evenement normalise, append-only, correle a `missionId`, `ticketId` et `attemptId` si pertinent. [Source: architecture.md - 3.3 Event and Audit Envelope; 4.3 Format Patterns]
- La CLI ne parle qu'aux services applicatifs; elle ne doit pas lire directement les JSON des registres ni les details vendor de l'adaptateur. [Source: architecture.md - 5.2 Architectural Boundaries]
- `CapabilityRegistry` et `SkillPack` restent les seams d'extension a reutiliser; 4.4 ne doit pas introduire un quatrieme host d'extensions. [Source: architecture.md - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- Aucun identifiant OpenAI/Codex ne doit sortir de `adapterState` ou d'un `ExecutionAttempt`; les nouveaux evenements d'usage doivent rester vendor-neutres. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]

### Previous Story Intelligence

- 4.1 a deja borne le contrat auteur `corp.extension.v1` et interdit marketplace, control plane et config vendor inline.
- 4.2 a deja etabli `capability.invoked` comme evenement canonique pour l'usage d'une capability enregistree.
- 4.3 a deja etabli le registre workspace-scoped des skill packs et un resolver runtime metadata-first; 4.4 doit reutiliser ces resumes, pas relire le contenu des fichiers ni executer des scripts.
- 4.5 a deja durci les built-ins `fs.read` / `cli.run`, les garde-fous capability et la lecture d'audit; 4.4 ne doit pas casser ce bypass ni l'hygiene anti-fuite vendor.
- `ticket-board-projection.ts` transporte deja les refs demandees par ticket; 4.4 peut s'appuyer sur cette projection pour montrer la selection/usage plutot que creer une vue concurrente.
- `buildApprovalGuardrailsSnapshot(...)` capture deja `policy_profile`, `allowed_capabilities` et `skill_packs`; 4.4 doit rester coherent avec cette grammaire existante.

### Implementation Guardrails

- Ne pas selectionner ou gouverner `execution_adapter` dans cette story; la selection 4.4 concerne uniquement capabilities locales/MCP-backed enregistrees et skill packs.
- Ne pas auto-enregistrer ni auto-decouvrir des extensions depuis `.agents/skills`, `.codex/`, `.codex-plugin/` ou tout arbre repo.
- Ne pas lire le contenu des `references[]`, `metadataFile` ou `scripts[]` d'un skill pack pour tracer son usage; ne transporter que des metadonnees compactes.
- Ne pas executer automatiquement un script de skill pack du simple fait qu'il a ete selectionne ou utilise.
- Ne pas stocker de resume d'usage comme source de verite sur `Ticket` ou `Mission`; le journal doit rester la source de verite et les vues de lecture doivent etre reconstructibles.
- Ne pas casser `fs.read` et `cli.run`; ils restent des built-ins hors registre et hors selection mission.
- Ne pas silencieusement nettoyer un ticket quand la selection mission change; preferer un echec explicite et auditable.
- Ne pas ajouter de dependance npm externe.
- Ne pas modifier `dist/` manuellement.
- Garder les nouveaux fichiers en ASCII et les modules en `kebab-case`.
- Garder `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.

### File Structure Requirements

**Contracts / mission selection**

- `packages/contracts/src/mission/mission.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/contracts/src/extension/registered-skill-pack.ts` si un type `SkillPackUsageDetails` y est extrait

**Mission services / resume**

- `packages/mission-kernel/src/mission-service/create-mission.ts`
- `packages/mission-kernel/src/mission-service/select-mission-extensions.ts` (nouveau)
- `packages/mission-kernel/src/resume-service/read-mission-status.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts` si des champs de resume sont ajoutes
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts`

**Ticket runtime / planner**

- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts` si la reconstruction du board doit inclure l'usage runtime

**Journal / projections**

- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/journal/src/projections/audit-log-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts` si le resume expose la selection mission

**CLI / formatters / docs**

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `apps/corp-cli/src/formatters/ticket-board-formatter.ts`
- `apps/corp-cli/src/formatters/audit-log-formatter.ts`
- `apps/corp-cli/src/formatters/audit-entry-detail-formatter.ts`
- `apps/corp-cli/src/formatters/mission-extension-selection-formatter.ts` (nouveau) si la commande `select` merite un formatter dedie
- `guide-utilisation.md`

**Tests**

- `tests/integration/mission-extension-selection.test.ts` (nouveau)
- `tests/integration/create-ticket.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/integration/approval-resolution.test.ts`
- `tests/integration/capability-invocation-audit.test.ts`
- `tests/integration/run-ticket-skill-pack-loading.test.ts`
- `tests/unit/formatters.test.ts`
- `tests/unit/audit-log-projection.test.ts` si besoin
- `tests/contract/mission-extension-cli.test.ts` (nouveau) si la surface CLI 4.4 est contractuelle

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.
- Verifier qu'une mission creee initialise `authorizedExtensions.allowedCapabilities = []` et `authorizedExtensions.skillPackRefs = []`.
- Verifier que `corp mission extension select` rejette une capability ou un pack introuvable dans les registres du workspace.
- Verifier que `ticket create`, `ticket update` et `approval approve` rejettent une ref hors selection mission avec un message deterministe.
- Verifier qu'une mission peut selectionner plusieurs capabilities/skill packs sans doublons et que l'ordre des listes reste stable/apres normalisation.
- Verifier qu'un ticket deja cree echoue sur `ticket run` si la mission retire ensuite une extension qu'il reference encore, avant tout `adapter.launch`.
- Verifier que `fs.read` et `cli.run` restent launchables comme avant, sans `mission.extensions_selected`, sans registre et sans evenement parasite.
- Verifier que `capability.invoked` continue d'apparaitre pour une capability selectionnee et utilisee.
- Verifier qu'un skill pack resolu et effectivement passe a l'adaptateur emet `skill_pack.used` avec `missionId`, `ticketId`, `attemptId`, `packRef`, `registrationId`, `owner` et `tags`.
- Verifier que `mission audit` et `mission audit show` rendent lisibles `mission.extensions_selected` et `skill_pack.used`.
- Verifier que `mission status` ou `ticket board` expose un resume compact des extensions mobilisees par ticket.
- Verifier l'absence de fuite vendor et de contenu de fichiers dans le journal, les projections et la sortie CLI:
  - pas de `responseId`, `pollCursor`, `vendorStatus`;
  - pas du contenu de `README.md`, `pack.json` ou des scripts de skill pack.

### Scope Exclusions

- Selection mission-scope des `execution_adapter`
- Marketplace, discovery distante, sync cloud ou plugin host generaliste
- Auto-import de skills depuis `.agents/skills` ou `.codex`
- Execution automatique de scripts de skill pack
- Copie ou possession de `config.toml`, `enabled_tools`, `disabled_tools`, `required`, `tool_timeout_sec` ou autre config MCP vendor dans l'etat mission
- Nouveau moteur de policy/budget/approval distinct du coeur existant
- Reecriture silencieuse des tickets existants lors d'un changement de selection mission

### Assumptions

- La selection mission-scope agit comme plafond de gouvernance sur les refs ticket, pas comme remplacement de `Ticket.allowedCapabilities[]` / `Ticket.skillPackRefs[]`.
- Les built-ins `fs.read` et `cli.run` restent hors perimetre "extension locale enregistree" pour le V1.
- Tracer un skill pack comme "used" au moment ou il est effectivement passe a `adapter.launch(...)` suffit pour l'AC 2.
- Les surfaces de lecture principales restent `mission status`, `ticket board`, `mission audit` et `mission audit show`; un tableau dedie supplementaire n'est pas requis.
- Aucun `project-context.md` n'est present dans `C:/Dev/PRJET/corp/_bmad-output`; ne pas inventer de regles supplementaires non soutenues par les artefacts existants.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-14: la doc Codex `Model Context Protocol` documente une configuration `config.toml` incluant notamment `tool_timeout_sec`, `enabled`, `required`, `enabled_tools` et `disabled_tools`. Inference produit: la selection mission 4.4 doit rester bornee a des identifiants registry-stables (`capabilityId`, `packRef`) et ne doit ni recopier ni posseder la configuration MCP vendor. [Source: https://developers.openai.com/codex/mcp]
- Verification officielle OpenAI le 2026-04-14: la doc Codex `Agent approvals & security` precise que la granularite d'approbation couvre aussi les prompts MCP et les `skill-script approvals`. Inference produit: selectionner ou utiliser un skill pack dans `corp` ne doit jamais etre interprete comme une autorisation implicite d'executer ses scripts; toute action a effet de bord reste derriere les garde-fous existants ou une story ulterieure. [Source: https://developers.openai.com/codex/agent-approvals-security]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 4; Story 4.1; Story 4.2; Story 4.3; Story 4.4
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - FR24-FR28; exigences de gouvernance et de tracabilite des extensions
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.10 Five-Layer Target Architecture; 4.3 Format Patterns; 5.2 Architectural Boundaries; 5.5 External Integration Points
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - frontiere minimale d'extension et dependance Codex acceptable
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-1-publier-le-contrat-de-registration-des-extensions-v1.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-2-enregistrer-une-capability-locale-avec-permissions-et-contraintes-explicites.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-3-charger-un-skill-pack-local-dans-le-cadre-d-une-mission.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-5-corriger-findings-review-registre-capability.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/sprint-status.yaml`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/mission-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/extension-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/mission-status-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/ticket-board-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/audit-log-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/audit-entry-detail-formatter.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/extension/registered-capability.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/extension/registered-skill-pack.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/mission-service/create-mission.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-status.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/ticket-board-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/audit-log-projection.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/resume-view-projection.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-capability-registry-repository.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-skill-pack-registry-repository.ts`
- `C:/Dev/PRJET/corp/tests/integration/create-ticket.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/update-ticket.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/approval-resolution.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/capability-invocation-audit.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/run-ticket-skill-pack-loading.test.ts`
- `C:/Dev/PRJET/corp/tests/unit/formatters.test.ts`
- `https://developers.openai.com/codex/mcp`
- `https://developers.openai.com/codex/agent-approvals-security`

## Change Log

- 2026-04-14: story creee via `bmad-create-story`, contexte complet ajoute, guardrails, references et contraintes formalises, statut passe a `ready-for-dev`.
- 2026-04-14: implementation 4.4 terminee, gouvernance mission-scope des extensions ajoutee, CLI/audit/board documentes, regressions alignees et suite `npm test` verifiee.

## Dev Agent Record

### Agent Model Used

- Codex (GPT-5)

### Debug Log References

- `npm run build`
- `node --test "dist/tests/integration/approval-queue.test.js" "dist/tests/integration/create-ticket.test.js" "dist/tests/integration/update-ticket.test.js" "dist/tests/integration/ticket-board.test.js"`
- `node --test "dist/tests/integration/mission-extension-selection.test.js" "dist/tests/contract/mission-extension-cli.test.js" "dist/tests/unit/formatters.test.js" "dist/tests/unit/audit-log-projection.test.js" "dist/tests/integration/create-ticket.test.js" "dist/tests/integration/update-ticket.test.js" "dist/tests/integration/approval-resolution.test.js" "dist/tests/integration/approval-queue.test.js" "dist/tests/integration/capability-invocation-audit.test.js" "dist/tests/integration/run-ticket-skill-pack-loading.test.js" "dist/tests/integration/ticket-board.test.js"`
- `npm test`

### Completion Notes List

- Ajout de `Mission.authorizedExtensions` avec hydratation retro-compatible, propagation dans `MissionResume` et selection auditable via `mission.extensions_selected`.
- Ajout de la commande `corp mission extension select`, de son formatter dedie, de l'aide CLI et d'une documentation operateur couvrant le flux `register -> mission extension select -> mission status/audit`.
- Durcissement mission-scope des refs d'extensions sur `ticket create`, `ticket update`, `approval resolve` et `ticket run`, sans changer le bypass des built-ins `fs.read` et `cli.run`.
- Ajout du fait `skill_pack.used`, extension des projections audit/board/resume, et affichage CLI du resume des extensions selectionnees et utilisees par ticket.
- Ajout et alignement des tests d'integration, contractuels et unitaires 4.4; suite complete `npm test` verte.

### File List

- `apps/corp-cli/src/commands/mission-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/mission-extension-selection-formatter.ts`
- `apps/corp-cli/src/formatters/mission-resume-formatter.ts`
- `apps/corp-cli/src/formatters/ticket-board-formatter.ts`
- `guide-utilisation.md`
- `packages/contracts/src/extension/registered-skill-pack.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/contracts/src/mission/mission-resume.ts`
- `packages/journal/src/projections/audit-log-projection.ts`
- `packages/journal/src/projections/resume-view-projection.ts`
- `packages/journal/src/projections/ticket-board-projection.ts`
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `packages/mission-kernel/src/mission-service/create-mission.ts`
- `packages/mission-kernel/src/mission-service/select-mission-extensions.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `packages/mission-kernel/src/resume-service/read-mission-resume.ts`
- `packages/skill-pack/src/metadata/build-skill-pack-summary.ts`
- `packages/storage/src/repositories/file-mission-repository.ts`
- `packages/ticket-runtime/src/planner/build-ticket-board.ts`
- `packages/ticket-runtime/src/planner/read-ticket-board.ts`
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `tests/contract/mission-extension-cli.test.ts`
- `tests/integration/approval-queue.test.ts`
- `tests/integration/approval-resolution.test.ts`
- `tests/integration/cancel-ticket.test.ts`
- `tests/integration/capability-invocation-audit.test.ts`
- `tests/integration/create-mission.test.ts`
- `tests/integration/create-ticket.test.ts`
- `tests/integration/mission-extension-selection.test.ts`
- `tests/integration/mission-resume.test.ts`
- `tests/integration/run-ticket-skill-pack-loading.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/integration/ticket-board.test.ts`
- `tests/integration/update-ticket.test.ts`
- `tests/unit/audit-log-projection.test.ts`
- `tests/unit/capability-registry-registration.test.ts`
- `tests/unit/codex-responses-adapter.test.ts`
- `tests/unit/formatters.test.ts`
- `tests/unit/skill-pack-registration.test.ts`
