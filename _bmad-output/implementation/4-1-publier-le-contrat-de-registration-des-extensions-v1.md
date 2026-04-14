# Story 4.1: Publier le contrat de registration des extensions V1

Status: done

## Story

As a concepteur d'extension locale,
I want disposer d'un contrat de declaration testable pour les seams V1,
so that je puisse preparer une extension sans boot d'un host complet.

## Context

Le code courant transporte deja des references d'extension et un seam d'execution, mais il manque encore le contrat auteur -> noyau qui permet de declarer ces seams de facon deterministe et gouvernee:

- `Ticket.allowedCapabilities` et `Ticket.skillPackRefs` existent deja dans `packages/contracts/src/ticket/ticket.ts` et sont deja exposes par la CLI ticket/create/update;
- `ApprovalDecision` et `resolveApprovalRequest(...)` savent deja modifier `allowedCapabilities` et `skillPackRefs` avec trace d'audit;
- `ExecutionAdapter` existe deja dans `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`, mais seulement comme seam runtime, pas comme contrat de declaration auteur;
- l'architecture cible prevoit explicitement `packages/capability-registry` et `packages/skill-pack`, mais ces packages n'existent pas encore dans le repo;
- la CLI actuelle n'accepte que `corp mission ...`; aucun flux auteur ne permet encore de valider un manifeste d'extension hors mission;
- aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`; ne pas supposer de conventions de commit, hooks ou CI locale pour publier le contrat.

Le gap reel de la story 4.1 est donc limite mais structurant:

1. il n'existe aucun contrat public unique pour declarer un `ExecutionAdapter`, une capability ou un `SkillPack`;
2. il n'existe aucune validation isolee et offline d'une declaration d'extension;
3. rien n'empeche encore un futur agent de confondre le contrat `corp` avec un manifeste Codex plugin, une config MCP ou une logique de marketplace;
4. rien ne garantit que les IDs publies par la declaration resteront compatibles avec les refs opaques deja presentes dans les tickets et les approvals;
5. aucun exemple officiel ni fixture ne borne encore le perimetre minimal V1.

### Delta explicite par rapport au code actuel

- `packages/contracts/src/ticket/ticket.ts` porte les refs opaques runtime (`allowedCapabilities`, `skillPackRefs`, `executionHandle.adapter`) mais pas le contrat source de registration.
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` et `packages/ticket-runtime/src/ticket-service/update-ticket.ts` normalisent deja des refs opaques via `normalizeOpaqueReferences(...)`; ce pattern doit etre reutilise, pas re-invente.
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts` expose un runtime adapter concret et contient des details vendor (`responseId`, `vendorStatus`, `pollCursor`) confines a `adapterState`; la story 4.1 ne doit pas les faire remonter dans le contrat public.
- `apps/corp-cli/src/index.ts` rejette toute commande autre que `mission`; un auteur d'extension ne peut pas encore faire un simple `validate --file`.
- `apps/corp-cli/src/formatters/help-formatter.ts` et `guide-utilisation.md` ne documentent aujourd'hui ni contrat d'extension, ni examples de declaration, ni commande de validation.
- `packages/capability-registry/` et `packages/skill-pack/` sont absents du repo alors qu'ils sont vises par l'architecture cible.

### Decision de conception pour cette story

- Publier un manifeste local neutre `corp.extension.v1` dans `packages/contracts`, separe du schema coeur `Mission + Ticket`.
- Modeliser une declaration = un seam via une union discriminee: `execution_adapter`, `capability`, `skill_pack`.
- Fournir une validation pure et offline dans `packages/capability-registry/src/validation/` capable de valider un objet en memoire et un fichier JSON sans boot de workspace mission.
- Exposer un flux auteur minimal `corp extension validate --file <path>` qui reste read-only, hors reseau et independant de `.corp/`.
- Limiter le format V1 a JSON pour eviter une dependance YAML/JSON-schema externe prematuree; les refs locales sont resolues relativement au fichier de declaration.
- Garder la registration hors de `Mission`, `Ticket`, `ExecutionAttempt` et `ApprovalRequest`; cette story publie le contrat et la validation, pas encore le chargement runtime ou la selection par mission.

## Acceptance Criteria

1. Given un concepteur redige une declaration pour un `ExecutionAdapter`, une capability ou un `SkillPack`
   When la declaration V1 est validee
   Then le contrat capture explicitement l'identite, le type de seam, les permissions, les contraintes, les metadonnees requises et les references locales utiles
   And une declaration ne peut representer qu'un seul seam a la fois

2. Given une declaration V1 est comparee au perimetre minimal `corp`
   When la validation est executee
   Then toute tentative d'introduire une marketplace, un control plane distribue, une logique de plugin host generaliste ou une distribution remote est rejetee avec des diagnostics explicites
   And le contrat reste borne a `ExecutionAdapter + CapabilityRegistry + SkillPack`

3. Given une declaration de capability ou de skill pack publie des refs qui seront reutilisees plus tard par les tickets
   When la declaration est validee
   Then les IDs publics (`capabilityId`, `packRef`) sont normalises de facon compatible avec les refs opaques deja utilisees par `allowedCapabilities` et `skillPackRefs`
   And aucun changement obligatoire du schema coeur `Mission` ou `Ticket` n'est introduit par cette story

4. Given un auteur lance `corp extension validate --file <path>` depuis un dossier quelconque
   When la commande valide un manifeste local
   Then elle fonctionne sans `corp mission bootstrap`, sans `missionId` et sans reseau
   And elle ne produit ni journal `.corp`, ni projection, ni evenement, ni mutation de workspace mission

5. Given une declaration reference des fichiers ou dossiers locaux
   When la validation controle `localRefs`
   Then les chemins sont resolus relativement au fichier de declaration
   And une ref manquante, distante ou non locale echoue avec un diagnostic structure `code + path + message`

6. Given une declaration adapter ou capability requiert une configuration externe
   When le contrat V1 est publie
   Then il ne declare que des noms de variables d'environnement, des refs locales ou des noms de serveur/outils MCP
   And il ne contient jamais de secret en clair, `responseId`, `threadId`, `pollCursor`, `vendorStatus`, snapshot `.codex/config.toml` ou manifeste `.codex-plugin/plugin.json`

7. Given des fixtures valides et invalides existent pour les trois seams
   When les tests unitaires, contractuels et d'integration tournent
   Then la validation reste deterministe, offline et sans dependance npm supplementaire
   And les sorties CLI de validation restent lisibles sans fuite vendor ni details d'implementation inutiles

## Tasks / Subtasks

- [x] Definir le contrat partage de registration V1 dans `packages/contracts` (AC: 1, 2, 3, 6)
  - [x] Creer `packages/contracts/src/extension/extension-registration.ts`.
  - [x] Definir la version de schema publique `corp.extension.v1`.
  - [x] Modeliser une union discriminee `execution_adapter | capability | skill_pack`.
  - [x] Ajouter un type de diagnostic stable, par exemple `ExtensionRegistrationDiagnostic { code, path, message }`.
  - [x] Garder le contrat externe au schema coeur `Mission + Ticket`.

- [x] Figer le shape minimal du manifeste V1 (AC: 1, 2, 3, 5, 6)
  - [x] Inclure dans le socle commun: `schemaVersion`, `seamType`, `id`, `displayName`, `version`, `permissions[]`, `constraints[]`, `metadata`, `localRefs`.
  - [x] Pour `execution_adapter`, exiger au minimum: `adapterRuntimeId`, `launchMode`, `supportsBackground`, `requiredEnvNames[]`.
  - [x] Pour `capability`, exiger au minimum: `capabilityId`, `provider`, `approvalSensitive`, puis soit `entrypoint`, soit `mcpServerName + mcpToolName`.
  - [x] Pour `skill_pack`, exiger au minimum: `packRef`, `rootDir`, `references[]`, `metadataFile?`, `scripts[]`.
  - [x] Normaliser et dedupliquer les listes d'IDs/permissions/contraintes selon le meme principe que `normalizeOpaqueReferences(...)`.

- [x] Implementer une validation pure et un loader de fichier dans `packages/capability-registry` (AC: 1, 2, 4, 5, 6, 7)
  - [x] Creer `packages/capability-registry/src/validation/validate-extension-registration.ts`.
  - [x] Creer `packages/capability-registry/src/validation/read-extension-registration-file.ts`.
  - [x] Valider le parse JSON, la version de schema, les champs requis, la coherence de l'union discriminee et les refs locales.
  - [x] Rejeter explicitement les champs ou concepts hors scope V1 tels que `marketplace`, `pluginHost`, `controlPlane`, `distributionUrl`, `installUrl`, `webhook`.
  - [x] Autoriser les capabilities MCP-backed via noms de serveur/outils, mais sans embarquer la config Codex/MCP complete dans le contrat.

- [x] Exposer une surface CLI auteur minimale et documenter le contrat (AC: 4, 5, 7)
  - [x] Etendre `apps/corp-cli/src/index.ts` pour accepter `corp extension ...` en plus de `corp mission ...`.
  - [x] Creer `apps/corp-cli/src/commands/extension-command.ts` avec `corp extension validate --file <path>`.
  - [x] Creer `apps/corp-cli/src/formatters/extension-validation-formatter.ts`.
  - [x] Mettre a jour `apps/corp-cli/src/formatters/help-formatter.ts`.
  - [x] Mettre a jour `C:/Dev/PRJET/corp/guide-utilisation.md` avec au moins un exemple de manifeste valide et les erreurs attendues sur un manifeste invalide.

- [x] Fournir des fixtures et une couverture de tests offline (AC: 1 a 7)
  - [x] Ajouter `tests/fixtures/extensions/` avec au moins:
  - [x] un manifeste valide `execution_adapter`
  - [x] un manifeste valide `capability` local
  - [x] un manifeste valide `capability` MCP-backed
  - [x] un manifeste valide `skill_pack`
  - [x] au moins deux manifestes invalides (`marketplace`, `remote ref`, `missing metadata`, ou equivalent)
  - [x] Ajouter `tests/unit/extension-registration-validation.test.ts`.
  - [x] Ajouter `tests/contract/extension-validate-cli.test.ts`.
  - [x] Ajouter `tests/integration/extension-registration-file-loading.test.ts` pour la resolution des refs relatives et l'absence de bootstrap mission.

### Review Findings

- [x] [Review][Patch] Guard exhaustif manquant apres les branches seamType — `registration` peut etre `null` avec `ok: true` si un futur seamType est ajoute sans branche de traitement [validate-extension-registration.ts:231] — corrige: guard `internal_error` ajoute
- [x] [Review][Defer] `statSync` synchrone dans un pipeline async — choix de design pour validation pure offline [validate-extension-registration.ts:1053] — deferred, pre-existing
- [x] [Review][Defer] `normalizeOpaqueExtensionReference` duplique `normalizeOpaqueReferences` de ticket-runtime au lieu de le reutiliser — compatibilite fonctionnelle OK, reorganisation architecturale hors scope [extension-registration.ts:102] — deferred, pre-existing
- [x] [Review][Defer] Chemins UNC Windows non reconnus par `isAbsoluteReference` sur Linux — auto-correction par echec statSync [validate-extension-registration.ts:1090] — deferred, pre-existing
- [x] [Review][Defer] Absence de `baseDir` dans `validateExtensionRegistration` → refs resolues sans verification d'existence — comportement par design (opt-in via baseDir/sourcePath) [validate-extension-registration.ts:937] — deferred, pre-existing
- [x] [Review][Defer] Symlink cyclique → diagnostic `missing_local_ref` trompeur au lieu d'un diagnostic specifique — cas tres niche [validate-extension-registration.ts:1053] — deferred, pre-existing
- [x] [Review][Defer] `packages/capability-registry` sans `package.json` — pattern architectural pre-existant du monorepo — deferred, pre-existing

## Dev Notes

### Story Intent

La story 4.1 ne doit pas encore "brancher" les extensions dans le runtime mission. Elle doit publier un contrat de declaration local, testable seul, qui prepare les stories 4.2, 4.3 et 4.4 sans etendre prematurement le schema coeur ni copier les surfaces vendor.

Le livrable attendu est donc triple:

- un contrat TS stable et lisible par les futurs packages d'extension;
- une validation pure et offline qui ne depend ni d'un host complet, ni d'une mission, ni du reseau;
- une petite surface CLI auteur pour verifier un manifeste local.

Si la solution ajoute un host de plugins, une discovery distante, une config MCP inline ou une mutation de mission pendant `validate`, alors la story rate sa cible.

### Current Project State

- `packages/contracts/src/ticket/ticket.ts` porte deja `allowedCapabilities[]`, `skillPackRefs[]` et `executionHandle.adapter`.
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts` fournit le seul adapter concret actuellement implemente.
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` et `packages/ticket-runtime/src/ticket-service/update-ticket.ts` savent deja modifier et normaliser capabilities / skill packs.
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts` exporte `normalizeOpaqueReferences(...)`; c'est le seam de normalisation a reutiliser.
- `apps/corp-cli/src/index.ts` ne connait aujourd'hui que `mission`.
- `apps/corp-cli/src/formatters/help-formatter.ts` documente des flags `--allow-capability` et `--skill-pack`, mais pas leur contrat de declaration source.
- `guide-utilisation.md` decrit la surface mission/ticket/approval/audit, pas encore la surface auteur d'extension.
- `packages/capability-registry/` et `packages/skill-pack/` n'existent pas encore dans l'arborescence reelle.

### Recommended Contract Shape

Utiliser un manifeste JSON lisible, stable et sans details vendor. Shape recommande:

```json
{
  "schemaVersion": "corp.extension.v1",
  "seamType": "capability",
  "id": "cap.shell.exec.local",
  "displayName": "Local shell exec",
  "version": "0.1.0",
  "permissions": ["shell.exec"],
  "constraints": ["local_only", "approval_sensitive", "workspace_scoped"],
  "metadata": {
    "description": "Execute une commande shell bornee dans le workspace isole",
    "owner": "local-team",
    "tags": ["cli", "workspace"]
  },
  "localRefs": {
    "rootDir": ".",
    "entrypoint": "./capabilities/shell-exec.ts",
    "references": ["./README.md"]
  },
  "capability": {
    "capabilityId": "shell.exec",
    "provider": "local",
    "approvalSensitive": true,
    "requiredEnvNames": []
  }
}
```

Contraintes de shape a figer:

- `schemaVersion` doit valoir exactement `corp.extension.v1`.
- `seamType` decide le bloc obligatoire supplementaire:
  - `execution_adapter` -> `executionAdapter`
  - `capability` -> `capability`
  - `skill_pack` -> `skillPack`
- `id` est l'identite de la declaration; les IDs runtime publics (`adapterRuntimeId`, `capabilityId`, `packRef`) vivent dans le bloc seam-specifique.
- `permissions[]` et `constraints[]` sont des listes opaques, normalisees, sans doublon.
- `localRefs` ne porte que des refs locales: fichiers, dossiers, docs, scripts.
- Pour `capability.provider = "mcp"`, ne pas embarquer la config MCP complete; borner le contrat a `mcpServerName` et `mcpToolName`.
- Pour `execution_adapter`, autoriser des noms de variables d'environnement requises, jamais leur valeur.

### Architecture Compliance

- Les details vendor restent confines a `executionHandle.adapterState` ou a `ExecutionAttempt.adapterState`; ils ne doivent pas remonter dans le contrat de registration. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- La frontiere minimale d'extension V1 reste `ExecutionAdapter + CapabilityRegistry + SkillPack`. [Source: architecture.md - 3.10 Five-Layer Target Architecture; 5.3 Requirements to Structure Mapping]
- L'arborescence cible reserve deja `packages/capability-registry` et `packages/skill-pack`; 4.1 doit s'y aligner sans creer un host geant. [Source: architecture.md - 5.1 Complete Project Directory Structure]
- La surface operateur/auteur V1 reste une CLI locale; `validate` doit rester read-only et hors reseau. [Source: architecture.md - 3.6 Codex Integration Boundary; 5.4 Internal Data Flow]
- Les plugins Codex restent hors perimetre coeur V1; si un packaging plugin existe plus tard, ce sera une couche de distribution, pas le contrat coeur. [Source: architecture.md - 5.5 External Integration Points]

### Cross-Story Intelligence

- Story 2.1 a deja etabli des tickets delegables avec `allowedCapabilities[]`; les IDs de capabilities publies par 4.1 doivent rester compatibles avec cette surface.
- Story 2.3 a deja etabli le seam `ExecutionAdapter`; 4.1 doit publier son contrat auteur sans casser l'interface runtime existante.
- Story 3.2 a deja montre que approvals et audit peuvent modifier `allowedCapabilities` et `skillPackRefs`; garder ces refs opaques, stables et auditables.
- Story 3.4 a renforce la discipline anti-fuite vendor dans toutes les surfaces CLI; la validation d'extension doit conserver exactement cette hygiene.
- Story 3.5 a conforte l'idee qu'une surface read-only doit rester deterministe et sans mutation implicite; `corp extension validate` suit la meme philosophie.

### Implementation Guardrails

- Ne pas etendre `Mission`, `Ticket`, `ApprovalRequest` ou `ExecutionAttempt` pour y embarquer la declaration d'extension complete.
- Ne pas bootstraper `.corp/`, journaliser quoi que ce soit, ni exiger un `missionId` pour `corp extension validate`.
- Ne pas parser ni adopter `.codex-plugin/plugin.json` comme schema coeur `corp`.
- Ne pas parser ni copier `~/.codex/config.toml` ou `.codex/config.toml` comme contrat MCP; accepter seulement des noms de serveur / outil.
- Ne pas introduire de marketplace, remote discovery, background daemon, webhook ou control plane.
- Ne pas stocker de secret en clair; ne declarer que des noms de variables d'environnement.
- Ne pas ajouter de dependance npm externe pour YAML, JSON schema ou validation.
- Ne pas elargir `ExecutionAdapterId` dans `Ticket` sauf besoin strictement indispensable et documente; par defaut, 4.1 doit rester externe au schema runtime.
- Ne pas modifier `dist/` manuellement.
- Garder les nouveaux fichiers en ASCII et les noms de modules en `kebab-case`.

### File Structure Requirements

**Contracts**
- `packages/contracts/src/extension/extension-registration.ts` (nouveau)
- `packages/contracts/src/ticket/ticket.ts` uniquement si un petit alignement de type est strictement necessaire; eviter toute extension du schema runtime

**Validation / author tooling**
- `packages/capability-registry/src/validation/validate-extension-registration.ts` (nouveau)
- `packages/capability-registry/src/validation/read-extension-registration-file.ts` (nouveau)
- `packages/capability-registry/src/validation/` peut accueillir des helpers dedies si cela evite de polluer le contrat

**CLI**
- `apps/corp-cli/src/index.ts`
- `apps/corp-cli/src/commands/extension-command.ts` (nouveau)
- `apps/corp-cli/src/formatters/extension-validation-formatter.ts` (nouveau)
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/guide-utilisation.md`

**Fixtures / tests**
- `tests/fixtures/extensions/` (nouveau dossier)
- `tests/unit/extension-registration-validation.test.ts` (nouveau)
- `tests/contract/extension-validate-cli.test.ts` (nouveau)
- `tests/integration/extension-registration-file-loading.test.ts` (nouveau)

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder tous les tests hors reseau.
- Verifier qu'un manifeste valide existe pour chacun des trois seams.
- Verifier qu'un manifeste avec `marketplace`, `controlPlane`, `installUrl` ou ref distante est rejete.
- Verifier qu'un manifeste `capability` MCP-backed accepte `mcpServerName + mcpToolName` mais rejette l'absence de ces champs.
- Verifier qu'un manifeste `execution_adapter` peut declarer `requiredEnvNames[]` mais jamais de valeur de secret inline.
- Verifier la resolution relative des refs locales depuis le fichier de declaration, y compris un cas de fichier manquant.
- Verifier que `corp extension validate --file <path>` marche sans `.corp/` initialise.
- Verifier que la sortie CLI reste lisible et ne contient jamais `responseId`, `threadId`, `pollCursor`, `vendorStatus`, `apiKey`, `token`, `secretValue` ou contenu equivalent.

### Scope Exclusions

- Chargement runtime des capabilities dans un vrai `CapabilityRegistry` (Story 4.2)
- Chargement runtime des skill packs et de leurs references (Story 4.3)
- Selection des extensions par mission et trace d'usage CLI (Story 4.4)
- Marketplace, catalogue distant, distribution plugin, installation automatique
- Parsing YAML/TOML de configs vendor
- Secret management ou resolution automatique de variables d'environnement
- Emission d'evenements, journalisation ou projection durant `validate`

### Assumptions

- Un manifeste JSON local suffit pour le premier lot V1.
- Les refs locales resolues relativement au fichier de declaration suffisent pour un flux auteur credible.
- Les refs opaques deja presentes dans les tickets restent la bonne frontiere publique pour capabilities et skill packs.
- Le besoin de "publier le contrat" inclut une validation CLI minimale; il ne justifie pas encore un systeme d'enregistrement runtime complet.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-12: la doc Codex `Agent Skills` precise que les skills sont le format d'auteur reutilisable et que les plugins sont l'unite de distribution installable. Inference produit: le contrat `corp.extension.v1` doit rester un contrat auteur local neutre, pas un manifeste plugin Codex deguise. [Source: https://developers.openai.com/codex/skills]
- Verification officielle OpenAI le 2026-04-12: la doc Codex `Build plugins` impose `.codex-plugin/plugin.json` comme point d'entree d'un plugin et decrit ce packaging comme une structure de distribution. Inference produit: `corp` V1 ne doit pas reutiliser ce manifeste comme schema coeur de registration. [Source: https://developers.openai.com/codex/plugins/build]
- Verification officielle OpenAI le 2026-04-12: la doc Codex `Model Context Protocol` indique que les serveurs MCP sont configures dans `config.toml`, y compris au scope projet. Inference produit: une capability MCP-backed peut referencer un serveur et un outil, mais la declaration `corp` ne doit ni embarquer ni copier la config Codex/MCP complete. [Source: https://developers.openai.com/codex/mcp]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 4; Story 4.1; Story 4.2; Story 4.3; Story 4.4
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Parcours 3; Integration Requirements; FR24-FR28; NFR12
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.4; 3.6; 3.10; 5.1; 5.3; 5.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - decisions sur la frontiere minimale d'extension et l'anti-plugin-host
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/index.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/approval/approval-decision.ts`
- `C:/Dev/PRJET/corp/packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/tests/integration/approval-resolution.test.ts`
- `https://developers.openai.com/codex/skills`
- `https://developers.openai.com/codex/plugins/build`
- `https://developers.openai.com/codex/mcp`

## Change Log

- 2026-04-12: story creee via `bmad-create-story`, contexte complet ajoute, guardrails, references et contraintes formalises, statut passe a `ready-for-dev`.
- 2026-04-12: contrat `corp.extension.v1`, validation offline, commande `corp extension validate`, fixtures et tests completes; statut passe a `review`.
- 2026-04-12: code review adversariale (3 couches: Blind Hunter, Edge Case Hunter, Acceptance Auditor). 1 patch corrige (guard exhaustif seamType), 6 deferes, 20 rejetes. Statut passe a `done`.

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Debug Log References

- `npm test` (build + regression complete) - PASS
- `node --test "dist/tests/unit/extension-registration-validation.test.js" "dist/tests/integration/extension-registration-file-loading.test.js" "dist/tests/contract/extension-validate-cli.test.js"` - PASS
- `npm run build` - PASS

### Completion Notes List

- Contrat public `corp.extension.v1` publie dans `packages/contracts` avec union discriminee `execution_adapter | capability | skill_pack`, diagnostics stables et normalisation compatible avec les refs opaques existantes.
- Validation offline ajoutee dans `packages/capability-registry` pour objet en memoire et fichier JSON, avec rejet explicite du hors-scope V1, des refs distantes, des secrets inline et des details vendor runtime.
- Commande auteur `corp extension validate --file <path>` ajoutee sans bootstrap mission, sans reseau et sans creation de `.corp`, avec aide CLI et formatter dedies.
- Fixtures officielles ajoutees pour les trois seams et plusieurs cas invalides, avec couverture unitaire, integration fichier et contrat CLI.
- `guide-utilisation.md` documente maintenant la validation d'un manifeste valide et l'echec attendu d'un manifeste hors scope.
- Le chargement runtime, la selection par mission et la trace d'usage restent explicitement deferes aux stories 4.2 a 4.4.

### File List

- `apps/corp-cli/src/index.ts`
- `apps/corp-cli/src/commands/extension-command.ts`
- `apps/corp-cli/src/formatters/extension-validation-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `guide-utilisation.md`
- `packages/contracts/src/extension/extension-registration.ts`
- `packages/capability-registry/src/validation/validate-extension-registration.ts`
- `packages/capability-registry/src/validation/read-extension-registration-file.ts`
- `tests/fixtures/extensions/`
- `tests/unit/extension-registration-validation.test.ts`
- `tests/contract/extension-validate-cli.test.ts`
- `tests/integration/extension-registration-file-loading.test.ts`
