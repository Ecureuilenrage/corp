# Story 4.3: Charger un skill pack local dans le cadre d'une mission

Status: done

## Story

As a concepteur d'extension locale,
I want charger un skill pack local avec metadonnees et references optionnelles,
so that l'expertise soit activable a la demande sans agrandir le coeur V1.

## Context

Le contrat auteur `corp.extension.v1` sait deja decrire un `skill_pack` et les tickets portent deja `skillPackRefs[]`, mais le noyau V1 ne sait toujours pas enregistrer, consulter ni resoudre un skill pack local pour une execution mission/ticket:

- `packages/contracts/src/extension/extension-registration.ts` modele deja `seamType = "skill_pack"` avec `packRef`.
- `packages/capability-registry/src/validation/validate-extension-registration.ts` et `read-extension-registration-file.ts` valident deja les manifests `skill_pack` et resolvent leurs refs locales.
- `tests/fixtures/extensions/valid-skill-pack.json` et `tests/fixtures/extensions/skill-packs/triage-pack/` fournissent deja un exemple canonique de manifeste + dossier local.
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts`, `update-ticket.ts` et `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` traitent deja `skillPackRefs[]` comme des refs opaques stables, avec snapshot `skill_packs: ...` dans les garde-fous.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` et `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts` ne font aujourd'hui que transporter les refs sous forme de texte brut (`Skill packs: ...`) sans resolution runtime, sans validation d'existence et sans contexte exploitable par l'adaptateur.
- `apps/corp-cli/src/commands/extension-command.ts` n'expose aujourd'hui qu'un flux `capability register`; aucune surface `skill-pack register` ni `skill-pack show` n'existe.
- `packages/storage/src/fs-layout/workspace-layout.ts` sait reserver `.corp/capabilities`, mais pas un registre `.corp/skill-packs`.
- `packages/skill-pack/` n'existe pas encore dans l'arborescence reelle alors qu'il est cible par l'architecture.
- aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`; ne pas supposer hooks, worktrees Git, CI locale ou conventions de commit pour cette story.

### Delta explicite par rapport au code actuel

- La story 4.1 a deja publie le contrat public `skill_pack` et normalise `packRef`; 4.3 ne doit pas reinventer de second format auteur.
- Les stories 4.2 puis 4.5 ont deja etabli un pattern reussi de registre workspace-scoped, de CLI `register`, d'idempotence, de collisions explicites et de preflight runtime pour les capabilities; 4.3 doit le reutiliser la ou il s'applique.
- `buildApprovalGuardrailsSnapshot(...)` porte deja `skill_packs:` dans les snapshots; 4.3 ne doit pas creer un nouveau canal de propagation des refs de skill pack.
- `codex-responses-adapter.ts` possede deja une ligne `Skill packs: ...` dans le brief d'execution; 4.3 doit enrichir cette surface avec un contexte compact et utile, pas creer un second adaptateur ou un contournement vendor.
- `audit-log-projection.ts` et `read-mission-audit.ts` ne connaissent aujourd'hui aucun evenement de chargement de skill pack; si 4.3 introduit un fait de ce type pour le debug, il doit rester minimal et ne pas se transformer en vue CLI globale d'usage des extensions, qui appartient a 4.4.

### Recommended slice for 4.3

1. Conserver `corp extension validate` et le contrat 4.1 comme source unique de validation auteur.
2. Ajouter un registre runtime workspace-scoped sous `.corp/skill-packs` qui stocke uniquement les metadonnees manifestes et les refs locales resolues pour `seamType = "skill_pack"`.
3. Exposer une surface operateur minimale `corp extension skill-pack register` et `corp extension skill-pack show` pour rendre le pack consultable sans charger le contenu complet de ses references.
4. Ajouter un resolver runtime de skill packs qui preflight `ticket.skillPackRefs[]`, rejette les refs inconnues ou hors frontiere locale, et fournit a l'adaptateur un resume compact du pack pour execution. `run-ticket.ts` est le premier point d'integration concret; le service doit rester reusable plus tard par un planner sans changer le contrat coeur.
5. Garder hors scope l'execution automatique de scripts, le chargement eager des fichiers `references[]`, la selection mission-scope globale des extensions, le tracing CLI global d'usage, la distribution plugin et toute gestion de `.codex/config.toml`.

## Acceptance Criteria

1. Given un dossier local de skill pack respecte le format retenu
   When il est discoverable par `corp`
   Then ses metadonnees deviennent consultables sans charger prematurement tous les contenus associes
   And les references ou scripts optionnels restent lies au skill pack local

2. Given un ticket autorise un `SkillPackRef`
   When l'operateur ou le planner y fait appel
   Then le skill pack peut etre mobilise sans modifier le contrat coeur `Mission + Ticket`
   And son usage reste borne au contexte local et repo-scoped du V1

## Tasks / Subtasks

- [x] Definir le contrat runtime et le stockage local d'un skill pack enregistre (AC: 1, 2)
  - [x] Creer un type runtime vendor-neutre `RegisteredSkillPack` ou equivalent, aligne sur `ticket.skillPackRefs[]` via `packRef` et distinct du manifeste auteur `corp.extension.v1`.
  - [x] Etendre `WorkspaceLayout` et le bootstrap pour reserver un emplacement dedie au registre skill packs sous `.corp/skill-packs/`.
  - [x] Creer un repository fichier capable de `save/find/list` par `packRef`, avec idempotence sur le meme manifeste et erreur deterministe en cas de collision ambigue.
  - [x] Garder la cle publique de resolution a `packRef`; ne pas etendre `Mission`, `Ticket`, `ExecutionAttempt` ni `ApprovalRequest` avec des objets skill pack embarques.

- [x] Enregistrer un skill pack valide et faire respecter sa frontiere locale (AC: 1)
  - [x] Reutiliser `readExtensionRegistrationFile(...)` comme unique point de lecture/validation du manifeste.
  - [x] Accepter uniquement `seamType = "skill_pack"` dans ce flux et rejeter explicitement `capability` / `execution_adapter`.
  - [x] Persister au minimum `packRef`, `registrationId`, `schemaVersion`, `displayName`, `version`, `permissions`, `constraints`, `metadata`, les refs locales resolues, `registeredAt` et `sourceManifestPath`.
  - [x] Ajouter un garde-fou skill-pack-specifique: `references[]`, `metadataFile` et `scripts[]` doivent rester sous `localRefs.rootDir`; si une ref locale s'echappe du dossier de pack, l'enregistrement echoue proprement.
  - [x] Ne pas lire le contenu de `references[]` ni executer `scripts[]` durant `register`; seules les metadonnees et les chemins resolus doivent etre stockes.

- [x] Exposer une surface operateur minimale pour consulter un skill pack enregistre (AC: 1)
  - [x] Etendre `corp extension` avec `corp extension skill-pack register --root <workspace> --file <path>`.
  - [x] Ajouter `corp extension skill-pack show --root <workspace> --pack-ref <ref>` ou equivalent pour afficher un resume du pack depuis le registre workspace.
  - [x] La commande `show` doit rendre visibles: `packRef`, `displayName`, `description`, `owner`, `tags`, `rootDir`, `references[]`, `metadataFile?`, `scripts[]`, `sourceManifestPath` et `registeredAt`.
  - [x] `show` ne doit pas injecter le contenu des fichiers de reference, du `metadataFile` ni des scripts; seuls les chemins et metadonnees doivent apparaitre.
  - [x] Mettre a jour l'aide CLI et `guide-utilisation.md` avec le flux `validate -> skill-pack register -> skill-pack show`.

- [x] Resoudre et mobiliser les skill packs depuis le runtime ticket sans changer le schema coeur (AC: 2)
  - [x] Creer un service dans `packages/skill-pack/src/loader/` capable de resoudre `ticket.skillPackRefs[]` en resumes compacts depuis le registre workspace.
  - [x] Brancher un preflight skill pack dans `run-ticket.ts` pour faire echouer proprement un `packRef` inconnu ou hors frontiere locale avant l'appel adaptateur.
  - [x] Etendre la frontiere `ExecutionAdapterLaunchOptions` avec un contexte `resolvedSkillPacks` ou equivalent, sans modifier `Mission`, `Ticket`, `ExecutionAttempt` ni `ApprovalRequest`.
  - [x] Enrichir `codex-responses-adapter.ts` pour injecter dans le brief d'execution un resume utile par pack (`packRef`, nom, description, refs locales resolues), et pas seulement la liste brute des refs.
  - [x] Ne pas auto-executer les scripts du pack, ne pas parser `.codex/config.toml`, et ne pas transformer 4.3 en host plugin ou en moteur de skills vendor-specifique.

- [x] Couvrir les regressions et les chemins limites sans chargement eager (AC: 1, 2)
  - [x] Ajouter une couverture unitaire et d'integration pour: manifeste skill pack valide, seam non supporte, collision de `packRef`, ref locale qui sort de `rootDir`, `packRef` inconnu au runtime, et chemin `show`.
  - [x] Verifier qu'un ticket avec `skillPackRefs[]` vides garde son comportement actuel.
  - [x] Verifier qu'un ticket avec un `packRef` resolu enrichit bien le brief adaptateur sans embarquer le contenu de `README.md` ni des scripts.
  - [x] Rejouer la regression 4.1: `corp extension validate --file <path>` reste offline, sans reseau et sans creation de `.corp/`.

### Review Findings

- [x] [Review][Patch] Deduplication des `skillPackRefs` en double dans `resolveTicketSkillPacks` [resolve-ticket-skill-packs.ts:21]
- [x] [Review][Patch] `list()` plante sur les entrees de repertoire invalides dans le registre [file-skill-pack-registry-repository.ts:132]
- [x] [Review][Patch] Repertoire `skillPackDir` orphelin si `rename` echoue dans `save()` [file-skill-pack-registry-repository.ts:84]
- [x] [Review][Patch] `packRef` compose uniquement d'espaces passe `assertSafeStorageIdentifier` [workspace-layout.ts:193]
- [x] [Review][Patch] Aucun test de collision ambigue pour le registre skill-pack [skill-pack-registration.test.ts]
- [x] [Review][Patch] Aucun test CLI d'integration pour le rejet de ref hors rootDir [skill-pack-register-cli.test.ts]
- [x] [Review][Defer] Bypass symlink dans `assertSkillPackLocalBoundary` — deferred, pre-existing pattern across all registries
- [x] [Review][Defer] Injection via metadonnees dans le brief LLM — deferred, pre-existing pattern in adapter
- [x] [Review][Defer] Chemins absolus exposes dans le brief API externe — deferred, pre-existing pattern
- [x] [Review][Defer] Race condition TOCTOU dans `save()` — deferred, handled by EEXIST on mkdir
- [x] [Review][Defer] JSON deserialise sans validation de schema — deferred, pre-existing across all repositories
- [x] [Review][Defer] Sensibilite a la casse du `packRef` sur macOS/Windows — deferred, pre-existing
- [x] [Review][Defer] Noms reserves Windows non bloques par `assertSafeStorageIdentifier` — deferred, pre-existing
- [x] [Review][Defer] `deepStrictEqualForComparison` peut boucler sur refs circulaires — deferred, pre-existing utility
- [x] [Review][Defer] `statSync` dans validate-extension masque les erreurs EACCES — deferred, pre-existing

## Dev Notes

### Story Intent

La story 4.3 doit combler le gap entre:

- le manifeste auteur `skill_pack` publie en 4.1;
- les refs opaques `ticket.skillPackRefs[]` deja presentes partout dans le coeur;
- le besoin runtime d'un chargement local, consultable et suffisamment riche pour fournir de l'expertise a la demande a un ticket.

Le livrable attendu est donc triple:

- un registre workspace-scoped de skill packs enregistres;
- une surface operateur minimale pour enregistrer puis consulter un pack;
- un resolver runtime qui transforme `skillPackRefs[]` en contexte compact pour l'execution.

Si la solution ajoute un moteur de workflow, execute automatiquement des scripts, lit tout le contenu des refs, scanne tout le filesystem a la recherche de skills ou introduit une semantique plugin/marketplace, alors elle rate sa cible.

### Current Project State

- `packages/skill-pack/` est absent.
- `packages/contracts/src/extension/extension-registration.ts` sait deja decrire `skill_pack` et normaliser `packRef`.
- `packages/capability-registry/src/validation/validate-extension-registration.ts` valide deja les manifests `skill_pack`.
- `tests/fixtures/extensions/valid-skill-pack.json` pointe vers un vrai dossier local avec `README.md`, `pack.json` et `scripts/preflight.sh`.
- `apps/corp-cli/src/commands/extension-command.ts` ne propose aujourd'hui que `validate` et `capability register`.
- `packages/storage/src/fs-layout/workspace-layout.ts` et `bootstrap-mission-workspace.ts` n'initialisent pas encore de repertoire `.corp/skill-packs`.
- `run-ticket.ts` sait deja faire un preflight `allowedCapabilities[]`, mais pas `skillPackRefs[]`.
- `codex-responses-adapter.ts` sait deja transporter une ligne `Skill packs: ...`, mais sans resolution ni metadonnees.
- `resolveApprovalRequest(...)` et `buildApprovalGuardrailsSnapshot(...)` savent deja garder `skill_packs:` coherents dans les garde-fous; ce mecanisme doit etre respecte, pas remplace.
- `package.json` n'introduit toujours aucune dependance runtime externe; garder cette sobriete pour 4.3.

### Recommended Runtime Shape

Shape runtime recommande pour un skill pack enregistre:

```json
{
  "packRef": "pack.triage.local",
  "registrationId": "ext.skill-pack.triage.local",
  "schemaVersion": "corp.extension.v1",
  "displayName": "Pack de triage local",
  "version": "0.1.0",
  "permissions": ["docs.read"],
  "constraints": ["local_only", "workspace_scoped"],
  "metadata": {
    "description": "Declare un skill pack local pret a etre charge plus tard par le runtime.",
    "owner": "core-platform",
    "tags": ["skill-pack", "local"]
  },
  "localRefs": {
    "rootDir": "C:/.../skill-packs/triage-pack",
    "references": ["C:/.../skill-packs/triage-pack/README.md"],
    "metadataFile": "C:/.../skill-packs/triage-pack/pack.json",
    "scripts": ["C:/.../skill-packs/triage-pack/scripts/preflight.sh"]
  },
  "registeredAt": "2026-04-13T21:12:53.6050962+02:00",
  "sourceManifestPath": "C:/.../valid-skill-pack.json"
}
```

Principes structurants:

- la cle de resolution runtime doit etre `packRef`, car c'est deja la surface publique cote ticket;
- `registrationId` sert a relier l'entree de registre au manifeste auteur;
- les metadonnees consultables viennent du manifeste valide et des refs resolues; ne pas charger le contenu des fichiers associes par defaut;
- `rootDir`, `references[]`, `metadataFile?` et `scripts[]` doivent rester lies au dossier du pack local;
- les scripts restent des refs declaratives pour V1; ils ne doivent pas etre executes implicitement par `register`, `show` ou `ticket run`.

### Architecture Compliance

- La frontiere minimale d'extension V1 reste `ExecutionAdapter + CapabilityRegistry + SkillPack`; 4.3 doit remplir le seam `SkillPack`, pas creer un host plus large. [Source: architecture.md - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- `CapabilityRegistry` et `SkillPack` declarent l'utilisable; toute extension reste soumise aux policies et approvals du coeur. [Source: architecture.md - 5.2 Architectural Boundaries]
- Les skill packs locaux sont explicitement un point d'integration externe du V1. [Source: architecture.md - 5.5 External Integration Points]
- Le contrat coeur recommande garde `skillPackRefs[]` sur `Ticket`; 4.3 doit reutiliser cette ref opaque, pas changer le schema `Mission + Ticket`. [Source: architecture.md - 3.3 Canonical Domain Contract]
- Aucun detail vendor OpenAI/Codex ne doit sortir du seam adaptateur; 4.3 ne doit pas copier `config.toml`, des IDs vendor ou des payloads tool dans le registre de skill packs. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- Si un evenement `skill_pack.loaded` ou equivalent est introduit pour faciliter le debug, il doit rester un fait normalise du journal, sans nouvelle vue globale de selection/usage en CLI dans cette story. [Source: architecture.md - 4.3 Format Patterns; 4.4 Process Patterns]

### Previous Story Intelligence

- 4.1 a deja fige le contrat auteur `corp.extension.v1`; 4.3 doit reutiliser `readExtensionRegistrationFile(...)` et la validation existante au lieu de reparsed autrement les manifests.
- 4.1 a deja etabli que `packRef` est la bonne frontiere publique pour les skill packs, comme `capabilityId` l'est pour les capabilities.
- 4.2 a deja montre comment construire un registre workspace-scoped, une commande `register`, des erreurs deterministes, une persistance idempotente et un preflight runtime sans etendre le schema coeur.
- 4.5 a corrige les angles morts du registre capability: collision, path traversal, workspace legacy, erreurs CLI deterministes, no deps, tests hors reseau. Ces apprentissages doivent etre repris pour 4.3.
- `codex-responses-adapter.ts` a deja un emplacement simple et suffisant pour enrichir le brief d'execution; 4.3 doit l'etendre au lieu d'introduire un second canal de prompt.
- `guide-utilisation.md` et `help-formatter.ts` documentent deja `validate` puis `capability register`; l'ergonomie 4.3 doit rester symetrique.

### Implementation Guardrails

- Ne pas etendre `Mission`, `Ticket`, `ExecutionAttempt`, `ApprovalRequest` ou `MissionResume` pour y embarquer des skill packs resolves.
- Ne pas ajouter de dependance npm externe.
- Ne pas modifier `dist/` manuellement.
- Ne pas parser ni copier `~/.codex/config.toml`, `.codex/config.toml`, `.codex-plugin/plugin.json` ou des skill folders `.agents/skills` dans `.corp/`.
- Ne pas scanner recursivement tout le repo pour "detecter" des skill packs; pour 4.3, la discoverabilite doit venir d'un enregistrement explicite dans le workspace.
- Ne pas charger le contenu des fichiers de `references[]`, du `metadataFile` ou des scripts pour `register` / `show`; garder un mode metadata-first.
- Ne pas auto-executer les scripts du pack a l'enregistrement, a la consultation ou au `ticket run`.
- Ne pas creer de host plugin, de marketplace, de distribution automatique, ni de workflow engine declaratif.
- Garder les nouveaux fichiers en ASCII et les modules en `kebab-case`.
- Garder `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.

### File Structure Requirements

**Contracts / runtime shape**
- `packages/contracts/src/extension/registered-skill-pack.ts` (nouveau)
- Y placer eventuellement un type de resume adaptateur (`ResolvedSkillPackSummary`) si cela evite les duplications entre runtime et adaptateur

**Skill pack package**
- `packages/skill-pack/src/loader/register-skill-pack.ts` (nouveau)
- `packages/skill-pack/src/loader/read-registered-skill-pack.ts` (nouveau)
- `packages/skill-pack/src/loader/resolve-ticket-skill-packs.ts` (nouveau)
- `packages/skill-pack/src/metadata/build-skill-pack-summary.ts` ou equivalent (nouveau)
- `packages/skill-pack/src/references/assert-skill-pack-local-boundary.ts` ou equivalent (nouveau)

**Storage / bootstrap**
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-skill-pack-registry-repository.ts` (nouveau)
- `packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`

**CLI**
- `apps/corp-cli/src/commands/extension-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/extension-skill-pack-registration-formatter.ts` (nouveau)
- `apps/corp-cli/src/formatters/extension-skill-pack-show-formatter.ts` (nouveau)
- `guide-utilisation.md`

**Runtime**
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`

**Tests**
- `tests/unit/skill-pack-registration.test.ts` (nouveau)
- `tests/integration/skill-pack-register-cli.test.ts` (nouveau)
- `tests/integration/run-ticket-skill-pack-loading.test.ts` (nouveau) ou extension de `tests/integration/run-ticket.test.ts`
- `tests/unit/codex-responses-adapter.test.ts`

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.
- Verifier qu'un manifeste `skill_pack` valide peut etre enregistre dans un workspace initialise.
- Verifier qu'un manifeste valide mais `seamType != skill_pack` est rejete par `corp extension skill-pack register`.
- Verifier qu'un meme manifeste peut etre recharge de facon idempotente, et qu'une collision ambigue sur `packRef` echoue proprement.
- Verifier qu'une ref locale `references[]`, `metadataFile` ou `scripts[]` qui sort de `rootDir` est rejetee a l'enregistrement.
- Verifier que `corp extension skill-pack show --pack-ref <ref>` retourne les metadonnees et chemins resolus, sans inclure le contenu de `README.md` (`Pack de triage local.`) ni du script (`echo "preflight"`).
- Verifier qu'un ticket avec `skillPackRefs[] = []` garde le comportement actuel.
- Verifier qu'un ticket avec un `packRef` inconnu echoue avant execution adaptateur avec un message deterministe.
- Verifier qu'un ticket avec un `packRef` resolu enrichit le brief `codex-responses` avec le resume du pack et ses refs locales, sans embarquer le contenu des fichiers.
- Rejouer la regression 4.1: `corp extension validate --file <path>` accepte toujours `skill_pack`, reste offline, et ne cree jamais `.corp/`.

### Scope Exclusions

- Selection mission-scope des extensions et trace CLI globale de leur usage (Story 4.4)
- Execution automatique des scripts d'un skill pack
- Chargement eager du contenu de `README.md`, `pack.json` ou des fichiers `references[]` dans le prompt runtime
- Scanning implicite de `.agents/skills` ou d'un arbre repo complet pour importer des skills sans enregistrement explicite
- Marketplace, plugin packaging, distribution automatique, sync distante ou installation d'extensions
- Gestion ou synchronisation de `.codex/config.toml`, `enabled_tools`, `disabled_tools`, `tool_timeout_sec`, `required` ou d'autres details MCP vendor
- Nouveau moteur de policy, sandbox ou approvals cote `corp`

### Assumptions

- Un registre workspace-scoped sous `.corp/skill-packs` est acceptable pour le V1.
- `packRef` reste la seule surface publique de liaison entre ticket et skill pack registry pour cette iteration.
- La "discoverabilite" demandee par l'AC 1 peut etre satisfaite par un enregistrement explicite dans le workspace puis une consultation `show`, sans auto-scan global du filesystem.
- Le premier usage concret "operateur ou planner y fait appel" sera le `ticket run`; le service de resolution doit cependant rester reusable sans changer le schema coeur.
- Aucun `project-context.md` n'est present dans `C:/Dev/PRJET/corp/_bmad-output`; ne pas inventer de regles supplementaires non soutenues par les artefacts existants.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-13: la doc Codex `Agent Skills` precise qu'un skill est un dossier avec `SKILL.md` et des `scripts/` / `references/` optionnels, et que Codex fonctionne en progressive disclosure: il commence par les metadonnees puis ne charge le `SKILL.md` complet que lorsqu'il decide d'utiliser le skill. Inference produit: 4.3 doit rester metadata-first et ne pas lire eager le contenu des refs locales. [Source: https://developers.openai.com/codex/skills]
- Verification officielle OpenAI le 2026-04-13: la meme doc distingue clairement les skills (format auteur) des plugins (unite de distribution) et documente les emplacements repo/user/admin/system pour la decouverte locale. Inference produit: 4.3 doit rester local-first et repo-scoped, sans introduire de packaging plugin ni de marketplace. [Source: https://developers.openai.com/codex/skills]
- Verification officielle OpenAI le 2026-04-13: la doc Codex `Model Context Protocol` indique que la configuration MCP vit dans `~/.codex/config.toml` ou, pour un projet de confiance, dans `.codex/config.toml`, avec des options comme `enabled_tools`, `disabled_tools`, `tool_timeout_sec` et `required`. Inference produit: un skill pack `corp` ne doit pas copier ni posseder cette configuration vendor; il peut seulement referencer son contexte local. [Source: https://developers.openai.com/codex/mcp]
- Verification officielle OpenAI le 2026-04-13: la doc Codex `Agent approvals & security` separe `sandbox mode` et `approval policy`, et mentionne des categories de prompts incluant les skill-script approvals. Inference produit: enregistrer ou resoudre un skill pack n'autorise pas a executer ses scripts automatiquement; toute execution a effet de bord doit rester derriere les garde-fous coeur existants ou une story ulterieure. [Source: https://developers.openai.com/codex/agent-approvals-security]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 4; Story 4.1; Story 4.2; Story 4.3; Story 4.4
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - FR24-FR28; NFR liees aux extensions locales; surface d'extension et d'integration
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Canonical Domain Contract; 3.4 Architectural Rule About Vendor Data; 3.10 Five-Layer Target Architecture; 4.3 Format Patterns; 4.4 Process Patterns; 5.1 Complete Project Directory Structure; 5.2 Architectural Boundaries; 5.5 External Integration Points
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 4. Frontiere minimale d'extension; 5. Niveau de dependance acceptable vis-a-vis de Codex API/CLI
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-1-publier-le-contrat-de-registration-des-extensions-v1.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-2-enregistrer-une-capability-locale-avec-permissions-et-contraintes-explicites.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-5-corriger-findings-review-registre-capability.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/sprint-status.yaml`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/packages/contracts/src/extension/extension-registration.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/extension/registered-capability.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/validation/validate-extension-registration.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/validation/read-extension-registration-file.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/registry/register-capability.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-capability-registry-repository.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `C:/Dev/PRJET/corp/packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/extension-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/tests/fixtures/extensions/valid-skill-pack.json`
- `C:/Dev/PRJET/corp/tests/fixtures/extensions/skill-packs/triage-pack/README.md`
- `C:/Dev/PRJET/corp/tests/fixtures/extensions/skill-packs/triage-pack/pack.json`
- `C:/Dev/PRJET/corp/tests/fixtures/extensions/skill-packs/triage-pack/scripts/preflight.sh`
- `C:/Dev/PRJET/corp/tests/unit/extension-registration-validation.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/capability-register-cli.test.ts`
- `https://developers.openai.com/codex/skills`
- `https://developers.openai.com/codex/mcp`
- `https://developers.openai.com/codex/agent-approvals-security`

## Change Log

- 2026-04-13: story creee via `bmad-create-story`, contexte complet ajoute, guardrails, references et contraintes formalises, statut passe a `ready-for-dev`.
- 2026-04-13: implementation completee avec registre `.corp/skill-packs`, CLI `skill-pack register/show`, resolution runtime des `skillPackRefs[]`, enrichissement `codex-responses`, documentation et regression complete verte.
- 2026-04-13: code review completee (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 6 patches appliques, 9 deferred, 6 dismissed. 238 tests verts.

## Dev Agent Record

### Agent Model Used

- `Codex (GPT-5)`

### Debug Log References

- `npm run build`
- `node --test "dist/tests/unit/skill-pack-registration.test.js"`
- `node --test "dist/tests/integration/skill-pack-register-cli.test.js"`
- `node --test "dist/tests/integration/run-ticket-skill-pack-loading.test.js"`
- `node --test "dist/tests/unit/codex-responses-adapter.test.js"`
- `node --test "dist/tests/integration/bootstrap-workspace.test.js"`
- `node --test "dist/tests/integration/approval-queue.test.js"`
- `node --test "dist/tests/integration/approval-resolution.test.js"`
- `npm test`
- `Aucun script lint n'est configure dans package.json.`

### Completion Notes List

- `Ajout du registre workspace-scoped .corp/skill-packs, du contrat runtime RegisteredSkillPack/ResolvedSkillPackSummary et du repository fichier avec idempotence et collision deterministe.`
- `Ajout des commandes CLI corp extension skill-pack register/show, de l'aide associee et de la documentation metadata-first dans guide-utilisation.md.`
- `Ajout du resolver runtime des skill packs dans run-ticket.ts et enrichissement du brief codex-responses avec des resumes compacts sans chargement eager ni execution de scripts.`
- `Ajout et ajustement des tests unitaires et d'integration pour register/show, preflight runtime, adaptateur, bootstrap et flows approval dependants de skillPackRefs.`
- `Regression complete validee via npm test: 235 tests passes.`
- `Code review: deduplication des skillPackRefs en double dans resolveTicketSkillPacks.`
- `Code review: list() du registre skill-pack resilient aux entrees de repertoire invalides.`
- `Code review: nettoyage du repertoire orphelin en cas d'echec rename dans le repository.`
- `Code review: rejet des packRef composes uniquement d'espaces par assertSafeStorageIdentifier.`
- `Code review: test de collision ambigue ajoute pour le registre skill-pack.`
- `Code review: test CLI integration pour le rejet de ref hors rootDir du pack.`
- `Code review: assertions contractuelles ajoutees pour skill-pack register et show dans la surface CLI.`
- `Regression complete validee via npm test: 238 tests passes.`

### File List

- `_bmad-output/implementation/4-3-charger-un-skill-pack-local-dans-le-cadre-d-une-mission.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `apps/corp-cli/src/commands/extension-command.ts`
- `apps/corp-cli/src/formatters/extension-skill-pack-registration-formatter.ts`
- `apps/corp-cli/src/formatters/extension-skill-pack-show-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `guide-utilisation.md`
- `packages/contracts/src/extension/registered-skill-pack.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/skill-pack/src/loader/read-registered-skill-pack.ts`
- `packages/skill-pack/src/loader/register-skill-pack.ts`
- `packages/skill-pack/src/loader/resolve-ticket-skill-packs.ts`
- `packages/skill-pack/src/metadata/build-skill-pack-summary.ts`
- `packages/skill-pack/src/references/assert-skill-pack-local-boundary.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-skill-pack-registry-repository.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `tests/integration/approval-queue.test.ts`
- `tests/integration/approval-resolution.test.ts`
- `tests/integration/bootstrap-workspace.test.ts`
- `tests/integration/run-ticket-skill-pack-loading.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/integration/skill-pack-register-cli.test.ts`
- `tests/unit/codex-responses-adapter.test.ts`
- `tests/unit/skill-pack-registration.test.ts`
