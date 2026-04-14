# Story 4.2: Enregistrer une capability locale avec permissions et contraintes explicites

Status: done

## Story

As a concepteur d'extension locale,
I want enregistrer une capability locale gouvernee par policy,
so that une mission puisse l'utiliser de maniere controlee et auditable.

## Context

Le contrat auteur `corp.extension.v1` et la validation offline existent deja, mais le noyau V1 ne sait toujours pas charger une capability dans un registre runtime ni relier son usage au journal mission/ticket:

- `packages/capability-registry/src/` contient uniquement `validation/`; aucun `registry/` ni `policies/` n'est implemente.
- `corp extension validate --file <path>` lit et valide un manifeste, mais ne persiste rien dans `.corp/` et ne rend aucune capability resolvable par le runtime.
- `Ticket.allowedCapabilities` et `resolveApprovalRequest(...)` manipulent deja des refs opaques stables, mais aucune verification ne garantit qu'une capability referencee est reellement enregistree.
- `runTicket(...)` et `codex-responses-adapter.ts` n'utilisent aujourd'hui que des listes textuelles (`Allowed capabilities`, `Skill packs`) sans resolution runtime, sans preflight registry, et sans emission d'un evenement `capability.invoked`.
- l'architecture V1 attend explicitement un seam `CapabilityRegistry`, un event `capability.invoked`, et une frontiere MCP bornee au registre/adapter config plutot qu'au schema coeur.
- `audit-log-projection.ts` et `read-mission-audit.ts` n'ont pas de traitement dedie pour `capability.invoked`.
- `packages/skill-pack/` est encore absent; le chargement des skill packs et la selection mission-scope des extensions restent des stories ulterieures.
- aucun depot Git n'est detecte sous `C:/Dev/PRJET/corp`; ne pas supposer hooks, CI locale ou conventions de commit pour cette story.

### Delta explicite par rapport au code actuel

- `packages/contracts/src/extension/extension-registration.ts` publie deja le contrat auteur capability avec `capabilityId`, `provider`, `approvalSensitive`, `requiredEnvNames`, `mcpServerName` et `mcpToolName`.
- `packages/capability-registry/src/validation/read-extension-registration-file.ts` sait charger un manifeste et resoudre ses refs locales, mais ne produit aucun artefact runtime consumable.
- `packages/ticket-runtime/src/ticket-service/create-ticket.ts` et `update-ticket.ts` normalisent `allowedCapabilities[]` et `skillPackRefs[]` comme listes opaques sans verification registre.
- `packages/mission-kernel/src/approval-service/resolve-approval-request.ts` sait deja ajuster `allowedCapabilities` et `skillPackRefs` avec snapshot de garde-fous; ce pattern doit etre reutilise, pas double.
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` orchestre tickets, attempts, approvals, artefacts et projections; c'est le point d'integration naturel pour un preflight capability cote runtime.
- `packages/journal/src/projections/audit-log-projection.ts` degrade proprement sur des types d'evenements inconnus, mais ne rend pas encore `capability.invoked` lisible operateur.
- `packages/storage/src/fs-layout/workspace-layout.ts` ne reserve encore aucun emplacement pour un registre local de capabilities sous `.corp/`.

### Recommended slice for 4.2

1. Conserver `corp extension validate` comme surface auteur read-only de 4.1.
2. Ajouter un registre runtime workspace-scoped capable de charger uniquement des declarations `seamType = "capability"` deja validees.
3. Persister des entries vendor-neutres alignees sur `ticket.allowedCapabilities`.
4. Introduire une resolution/invocation capability cote runtime qui:
   - verifie que la capability est enregistree,
   - verifie qu'elle est autorisee pour le ticket courant,
   - respecte le `policyProfileId` mission + la sensibilite approval,
   - emet `capability.invoked` avec correlations mission/ticket/attempt.
5. Garder hors scope l'execution generique de plugins, le chargement de skill packs, la selection mission-scope globale et tout host d'extension riche.

## Acceptance Criteria

1. Given une capability locale ou MCP-backed doit etre exposee au noyau V1
   When sa registration est chargee
   Then `CapabilityRegistry` stocke ses permissions, ses contraintes d'usage et les informations de validation necessaires
   And toute registration incomplete ou invalide est rejetee avant usage mission

2. Given une capability enregistree est invoquee plus tard par un ticket
   When l'invocation se produit
   Then un evenement auditable relie l'usage de cette capability a la mission et au ticket concernes
   And l'invocation reste soumise aux approvals et policies du coeur

## Tasks / Subtasks

- [x] Definir le contrat runtime et le stockage local d'une capability enregistree (AC: 1)
  - [x] Creer un type runtime vendor-neutre pour une capability enregistree, aligne sur `ticket.allowedCapabilities` et distinct du manifeste auteur `corp.extension.v1`.
  - [x] Etendre `WorkspaceLayout` et le bootstrap pour reserver un emplacement dedie au registre local sous `.corp/`.
  - [x] Creer un repository fichier capable de `save/find/list` par `capabilityId`, sans etendre `Mission`, `Ticket`, `ExecutionAttempt` ni `ApprovalRequest`.
  - [x] Rendre la persistance deterministe et idempotente pour la meme capability; rejeter une collision ambigue sur un meme `capabilityId` si aucun workflow de remplacement explicite n'existe.

- [x] Charger une declaration capability valide dans `CapabilityRegistry` (AC: 1)
  - [x] Reutiliser `readExtensionRegistrationFile(...)` comme unique point de lecture/validation des manifestes.
  - [x] Accepter uniquement `seamType = "capability"` dans ce flux; rejeter explicitement `execution_adapter` et `skill_pack` comme hors scope de 4.2.
  - [x] Persister au minimum `capabilityId`, `registrationId`, `provider`, `permissions`, `constraints`, `approvalSensitive`, `requiredEnvNames`, les metadonnees utiles et les refs locales resolues.
  - [x] Conserver la compatibilite stricte entre `capabilityId` enregistre et les valeurs attendues dans `Ticket.allowedCapabilities`.

- [x] Exposer une surface operateur minimale pour enregistrer une capability dans un workspace (AC: 1)
  - [x] Etendre `corp extension` avec une commande explicite de type `corp extension capability register --root <workspace> --file <path>` ou equivalent capability-only.
  - [x] Exiger un workspace initialise plutot qu'un auto-bootstrap implicite; le flux `validate` doit rester read-only et sans creation de `.corp/`.
  - [x] Retourner des messages deterministes sur succes, collision, manifeste invalide, seam non supporte et workspace non initialise.
  - [x] Mettre a jour l'aide CLI et `guide-utilisation.md` avec le flux `validate -> register`.

- [x] Ajouter la resolution et l'invocation auditable d'une capability cote runtime ticket (AC: 2)
  - [x] Creer un service de resolution/invocation capability ou equivalent dans `packages/capability-registry/src/registry/`.
  - [x] Verifier avant usage qu'une capability referencee par `ticket.allowedCapabilities` existe dans le registre local.
  - [x] Ajouter un preflight dans `run-ticket.ts` ou une integration equivalente pour faire echouer proprement une capability inconnue ou non autorisee avant execution externe.
  - [x] Reutiliser la grammaire existante des garde-fous (`policy_profile`, `allowed_capabilities`, `skill_packs`) pour exprimer la sensibilite approval; ne pas inventer un deuxieme systeme d'approvals.
  - [x] Emettre `capability.invoked` avec au minimum `missionId`, `ticketId`, `attemptId` si disponible, `capabilityId`, `registrationId`, `provider`, `trigger` et les correlations d'audit utiles.

- [x] Rendre la trace lisible et couvrir les regressions (AC: 1, 2)
  - [x] Ajouter un traitement dedie de `capability.invoked` dans `audit-log-projection.ts` et `read-mission-audit.ts`.
  - [x] Verifier que les sorties d'audit n'exposent ni secret, ni valeur d'env, ni details vendor (`responseId`, `pollCursor`, `vendorStatus`, headers MCP, bearer token).
  - [x] Ajouter une couverture unitaire et d'integration pour: provider local, provider MCP, manifeste capability invalide, seam non supporte, collision de `capabilityId`, invocation inconnue, et chemin approval-sensitive.
  - [x] Conserver la regression 4.1: `corp extension validate` reste offline, hors reseau et sans creation de `.corp/`.

## Dev Notes

### Story Intent

La story 4.2 ne doit pas encore transformer `corp` en host de plugins ni en moteur generique d'outils. Elle doit combler le gap entre:

- le manifeste auteur valide de 4.1;
- les refs opaques deja presentes dans les tickets et approvals;
- le besoin runtime d'un registre concret, consultable par le noyau, et capable de tracer l'usage d'une capability.

Le livrable attendu est donc quadruple:

- un registre runtime workspace-scoped pour les capabilities;
- une commande operateur minimale pour y charger une declaration capability valide;
- un seam de resolution/invocation auditable pour le runtime ticket;
- une lecture d'audit lisible pour `capability.invoked`.

Si la solution ajoute un plugin host, une sync distante, un moteur de policies complet, un chargement de skill packs ou des details vendor dans le contrat coeur, alors la story rate sa cible.

### Current Project State

- `packages/capability-registry/` ne contient aujourd'hui que la validation offline de manifestes.
- `packages/skill-pack/` n'existe pas encore.
- `apps/corp-cli/src/commands/extension-command.ts` ne sait faire que `validate`.
- `Ticket.allowedCapabilities[]` et `Ticket.skillPackRefs[]` sont deja des refs publiques stables cote runtime ticket.
- `resolveApprovalRequest(...)` sait deja mettre a jour les refs de ticket et reconstruire les garde-fous persistants.
- `runTicket(...)` connait missions, tickets, attempts, approvals, artefacts et projections; c'est le meilleur point de jonction pour un preflight registry.
- `audit-log-projection.ts` et `read-mission-audit.ts` savent deja rendre visibles `approval.*`, `artifact.*`, `execution.*` et `workspace.*`.
- `package.json` n'introduit aucune dependance runtime externe; garder cette sobriete pour 4.2.

### Recommended Runtime Shape

Shape runtime recommande pour une capability enregistree:

```json
{
  "capabilityId": "shell.exec",
  "registrationId": "ext.capability.shell.exec.local",
  "schemaVersion": "corp.extension.v1",
  "provider": "local",
  "displayName": "Shell exec local",
  "version": "0.1.0",
  "permissions": ["shell.exec", "fs.read"],
  "constraints": ["local_only", "approval_sensitive", "workspace_scoped"],
  "approvalSensitive": true,
  "requiredEnvNames": [],
  "metadata": {
    "description": "Expose une capability locale bornee au workspace.",
    "owner": "core-platform",
    "tags": ["capability", "local"]
  },
  "localRefs": {
    "rootDir": "C:/.../capabilities",
    "entrypoint": "C:/.../capabilities/shell-exec.ts",
    "references": ["C:/.../docs/capability-local.md"],
    "scripts": ["C:/.../scripts/validate-capability.ps1"]
  },
  "mcp": null,
  "registeredAt": "2026-04-12T21:05:06.7947109+02:00",
  "sourceManifestPath": "C:/.../valid-capability-local.json"
}
```

Principes structurants:

- la cle de resolution runtime doit etre `capabilityId`, car c'est deja la surface publique cote ticket;
- `registrationId` sert a relier l'entree de registre au manifeste auteur;
- `permissions`, `constraints`, `approvalSensitive` et `requiredEnvNames` viennent du manifeste valide, pas d'une inference runtime;
- pour `provider = "local"`, garder `localRefs.entrypoint`;
- pour `provider = "mcp"`, garder `mcpServerName` + `mcpToolName`, sans recopier la config MCP complete;
- ne pas enregistrer de secrets, bearer tokens, headers dynamiques ou details vendor runtime dans le registre.

### Architecture Compliance

- Les details vendor OpenAI/Codex restent confines a `executionHandle.adapterState` ou a un `ExecutionAttempt`; ils ne remontent ni dans le registre public ni dans les events capability. [Source: architecture.md - 3.4 Architectural Rule About Vendor Data]
- La frontiere minimale d'extension V1 reste `ExecutionAdapter + CapabilityRegistry + SkillPack`; 4.2 doit remplir le seam `CapabilityRegistry`, pas creer un host plus large. [Source: architecture.md - 3.10 Five-Layer Target Architecture; 5.2 Architectural Boundaries]
- L'architecture cible reserve deja `packages/capability-registry/src/registry/` et `packages/capability-registry/src/policies/`; 4.2 doit s'y aligner. [Source: architecture.md - 5.1 Complete Project Directory Structure]
- `capability.invoked` fait deja partie de la taxonomie d'evenements attendue; ne pas inventer un nom concurrent. [Source: architecture.md - 3.3 Event and Audit Envelope]
- Les serveurs MCP sont un point d'integration externe via `CapabilityRegistry` / adapter config, pas une primitive coeur `Mission` ou `Ticket`. [Source: architecture.md - 5.5 External Integration Points]
- Toute extension reste soumise aux policies et approvals du coeur. [Source: architecture.md - 5.2 Architectural Boundaries]

### Previous Story Intelligence

- 4.1 a deja fige le contrat auteur `corp.extension.v1`; le reparser autrement dans 4.2 serait une regression.
- `readExtensionRegistrationFile(...)` resout deja les refs locales relativement au manifeste; 4.2 doit reutiliser ce comportement plutot qu'introduire un second resolver.
- 4.1 rejette deja les refs distantes, `.codex/config.toml`, `.codex-plugin/plugin.json`, les secrets inline et les champs vendor runtime; 4.2 ne doit pas contourner ces garde-fous en lisant ces fichiers plus tard.
- Les IDs publics sont deja normalises/trimmed dans le contrat d'extension; la compatibilite avec `allowedCapabilities[]` doit rester exacte.
- La CLI `extension validate` est aujourd'hui read-only, offline et sans `.corp/`; ce contrat utilisateur doit rester vrai apres 4.2.

### Implementation Guardrails

- Ne pas etendre `Mission`, `Ticket`, `ExecutionAttempt`, `ApprovalRequest` ou `MissionResume` pour y embarquer le registre complet.
- Ne pas ajouter de dependance npm externe pour YAML, TOML, JSON schema, ou un moteur de policy.
- Ne pas copier `~/.codex/config.toml`, `.codex/config.toml`, `.codex-plugin/plugin.json`, ni aucune config MCP/Codex complete dans le registre `corp`.
- Ne pas stocker de secret en clair, de bearer token, de header HTTP, de `responseId`, `threadId`, `pollCursor` ou `vendorStatus`.
- Ne pas charger automatiquement des skill packs, des adaptateurs ou des plugins hors `seamType = "capability"` dans ce flux.
- Ne pas auto-bootstrapper silencieusement un workspace lors de `register`; garder une erreur explicite si `.corp/` n'est pas initialise.
- Ne pas modifier `dist/` manuellement.
- Garder les nouveaux fichiers en ASCII et les modules en `kebab-case`.

### File Structure Requirements

**Contracts / runtime shape**
- `packages/contracts/src/extension/registered-capability.ts` (nouveau) ou equivalent co-localise a `extension/`
- `packages/contracts/src/extension/extension-registration.ts` uniquement si un petit export de type doit etre reutilise sans casser 4.1

**Capability registry**
- `packages/capability-registry/src/registry/` (nouveau dossier)
- `packages/capability-registry/src/registry/register-capability.ts` (nouveau)
- `packages/capability-registry/src/registry/read-registered-capability.ts` ou `capability-registry-service.ts` (nouveau)
- `packages/capability-registry/src/registry/invoke-registered-capability.ts` (nouveau)
- `packages/capability-registry/src/policies/` (nouveau dossier)
- `packages/capability-registry/src/policies/evaluate-capability-guardrails.ts` (nouveau)

**Storage / bootstrap**
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-capability-registry-repository.ts` (nouveau)
- `packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`

**CLI**
- `apps/corp-cli/src/commands/extension-command.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `apps/corp-cli/src/formatters/extension-capability-registration-formatter.ts` (nouveau) ou equivalent
- `guide-utilisation.md`

**Runtime / audit**
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/journal/src/projections/audit-log-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`

**Tests**
- `tests/unit/capability-registry-registration.test.ts` (nouveau)
- `tests/integration/capability-register-cli.test.ts` (nouveau)
- `tests/integration/capability-invocation-audit.test.ts` (nouveau)
- etendre `tests/integration/run-ticket.test.ts` si le preflight capability y est branche

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.
- Verifier qu'une capability locale valide peut etre enregistree dans un workspace initialise.
- Verifier qu'une capability MCP-backed valide peut etre enregistree sans recopier la config MCP complete.
- Verifier qu'un manifeste valide mais `seamType != capability` est refuse par la commande/flow d'enregistrement 4.2.
- Verifier qu'un meme manifeste capability peut etre recharge de facon idempotente, et qu'une collision ambigue sur `capabilityId` echoue proprement.
- Verifier qu'une invocation capability inconnue ou absente du registre echoue avant execution externe.
- Verifier qu'une capability non autorisee par `ticket.allowedCapabilities` echoue deterministiquement.
- Verifier qu'une capability `approvalSensitive=true` suit un chemin garde-fous/approval coherent avec le noyau existant; si la conception choisie retourne un resultat `approval_required` plutot qu'une ouverture immediate de queue, couvrir ce resultat explicitement.
- Verifier que `capability.invoked` est present dans la projection d'audit avec `missionId`, `ticketId`, `attemptId` si disponible, `capabilityId` et `provider`.
- Verifier l'absence de fuite vendor ou secret dans les sorties CLI, le journal et la projection d'audit.
- Rejouer la regression 4.1: `corp extension validate --file <path>` ne cree jamais `.corp/`.

### Scope Exclusions

- Execution generique d'un entrypoint local arbitraire ou d'un appel MCP live si cela n'est pas strictement necessaire pour satisfaire les AC
- Chargement runtime des skill packs et de leurs references (Story 4.3)
- Selection mission-scope des extensions et surfacing CLI global de leur usage (Story 4.4)
- Registration runtime des `execution_adapter`
- Marketplace, discovery distante, installation automatique, plugin host generaliste
- Nouveau moteur de policy, budget ou sandbox complet cote `corp`

### Assumptions

- Un registre workspace-scoped sous `.corp/` est acceptable pour le V1.
- `Ticket.allowedCapabilities[]` reste la seule surface publique de liaison entre ticket et capability registry pour cette iteration.
- Une capability peut etre consideree "utilisable" en 4.2 des lors que le noyau sait la charger, la resoudre, la garder sous garde-fous et tracer son invocation; l'execution generique complete peut rester dans les couches adapteur/outils.
- Si l'equipe prefere `corp extension register` a `corp extension capability register`, le comportement externe doit rester capability-only et rejeter explicitement les autres seams.
- Aucun `project-context.md` n'est present dans `C:/Dev/PRJET/corp/_bmad-output` au moment de cette story; ne pas inventer de regles supplementaires non soutenues par les artefacts existants.

### Latest Technical Notes

- Verification officielle OpenAI le 2026-04-12: la doc Codex `Model Context Protocol` indique que la configuration MCP vit dans `~/.codex/config.toml` ou, pour un projet de confiance, dans `.codex/config.toml`, avec des options comme `enabled_tools`, `disabled_tools`, `tool_timeout_sec` et `required`. Inference produit: une capability MCP-backed `corp` doit stocker des identifiants stables (`mcpServerName`, `mcpToolName`, contraintes corp) sans recopier ni posseder la configuration MCP complete. [Source: https://developers.openai.com/codex/mcp]
- Verification officielle OpenAI le 2026-04-12: la doc Codex `Agent approvals & security` separe `sandbox mode` et `approval policy`, et montre aussi une configuration granulaire qui inclut `mcp_elicitations`. Inference produit: `approvalSensitive` doit se raccorder aux approvals/garde-fous du coeur `corp`, pas les contourner ni les doubler avec un mini-systeme vendor-specifique. [Source: https://developers.openai.com/codex/agent-approvals-security]

### References

- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` - Epic 4; Story 4.1; Story 4.2; Story 4.3; Story 4.4
- `C:/Dev/PRJET/corp/_bmad-output/planning/prd.md` - Parcours 3; Integration Requirements; Surface d'Extension et d'Integration; FR24-FR28; NFR12-NFR14
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3; 3.4; 3.10; 5.1; 5.2; 5.5
- `C:/Dev/PRJET/corp/_bmad-output/planning/technical-research-v1-architecture-foundation.md` - 4. Frontiere minimale d'extension; 5. Niveau de dependance acceptable vis-a-vis de Codex API/CLI
- `C:/Dev/PRJET/corp/_bmad-output/project-knowledge/project-overview.md`
- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-1-publier-le-contrat-de-registration-des-extensions-v1.md`
- `C:/Dev/PRJET/corp/guide-utilisation.md`
- `C:/Dev/PRJET/corp/package.json`
- `C:/Dev/PRJET/corp/packages/contracts/src/extension/extension-registration.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/ticket/ticket.ts`
- `C:/Dev/PRJET/corp/packages/contracts/src/mission/mission.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/validation/validate-extension-registration.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/validation/read-extension-registration-file.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/create-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/update-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/audit-log-projection.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/extension-command.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/help-formatter.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/formatters/extension-validation-formatter.ts`
- `C:/Dev/PRJET/corp/packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `C:/Dev/PRJET/corp/tests/unit/extension-registration-validation.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/extension-registration-file-loading.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/approval-resolution.test.ts`
- `https://developers.openai.com/codex/mcp`
- `https://developers.openai.com/codex/agent-approvals-security`

## Change Log

- 2026-04-12: story creee via `bmad-create-story`, contexte complet ajoute, guardrails, references et contraintes formalises, statut passe a `ready-for-dev`.
- 2026-04-12: implementation 4.2 completee; registre workspace-scoped, CLI `extension capability register`, preflight runtime, audit `capability.invoked` et couverture de tests ajoutes; statut passe a `review`.

## Dev Agent Record

### Agent Model Used

- Codex (GPT-5)

### Debug Log References

- `npm run build`
- `node --test "dist/tests/unit/capability-registry-registration.test.js" "dist/tests/integration/capability-register-cli.test.js" "dist/tests/integration/capability-invocation-audit.test.js" "dist/tests/unit/audit-log-projection.test.js" "dist/tests/integration/bootstrap-workspace.test.js" "dist/tests/contract/extension-validate-cli.test.js"`
- `node --test "dist/tests/integration/approval-queue.test.js" "dist/tests/integration/approval-resolution.test.js"`
- `npm test`

### Completion Notes List

- Registre runtime workspace-scoped ajoute sous `.corp/capabilities` avec contrat vendor-neutre `RegisteredCapability`, repository fichier idempotent et detection explicite des collisions ambiguës.
- Nouvelle commande `corp extension capability register --root <workspace> --file <path>` ajoutee; elle reutilise `readExtensionRegistrationFile(...)`, refuse les seams hors `capability`, exige un workspace initialise et preserve le contrat read-only de `validate`.
- `run-ticket.ts` effectue desormais un preflight capability pour les capabilities enregistrees, journalise `capability.invoked` avant execution externe et conserve la compatibilite des garde-fous coeur historiques (`fs.read`, `cli.run`).
- `audit-log-projection.ts`, `read-mission-audit.ts` et `guide-utilisation.md` ont ete etendus pour rendre `capability.invoked` lisible sans fuite vendor ni secret.
- Toute la suite `npm test` passe au vert (216 tests).

### File List

- `_bmad-output/implementation/4-2-enregistrer-une-capability-locale-avec-permissions-et-contraintes-explicites.md`
- `_bmad-output/implementation/sprint-status.yaml`
- `apps/corp-cli/src/commands/extension-command.ts`
- `apps/corp-cli/src/formatters/extension-capability-registration-formatter.ts`
- `apps/corp-cli/src/formatters/help-formatter.ts`
- `guide-utilisation.md`
- `packages/capability-registry/src/policies/evaluate-capability-guardrails.ts`
- `packages/capability-registry/src/registry/invoke-registered-capability.ts`
- `packages/capability-registry/src/registry/read-registered-capability.ts`
- `packages/capability-registry/src/registry/register-capability.ts`
- `packages/contracts/src/extension/registered-capability.ts`
- `packages/journal/src/projections/audit-log-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/storage/src/repositories/file-capability-registry-repository.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `tests/contract/extension-validate-cli.test.ts`
- `tests/integration/bootstrap-workspace.test.ts`
- `tests/integration/capability-invocation-audit.test.ts`
- `tests/integration/capability-register-cli.test.ts`
- `tests/unit/audit-log-projection.test.ts`
- `tests/unit/capability-registry-registration.test.ts`
