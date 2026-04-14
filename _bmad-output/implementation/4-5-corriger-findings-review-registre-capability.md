# Story 4.5: Corriger les findings de la code review du registre capability (story 4.2)

Status: done

## Story

As a operateur technique,
I want que les bugs, gaps de garde-fous, chemins non testes et ecarts aux acceptance criteria identifies par la code review adversariale de la story 4.2 soient corriges et couverts,
so that le registre capability soit fiable, auditablement complet et veritablement pret a servir de fondation aux stories 4.3 et 4.4.

## Context

Cette story regroupe les corrections issues de la code review a trois layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) conduite le 2026-04-12 sur la story 4.2 (`4-2-enregistrer-une-capability-locale-avec-permissions-et-contraintes-explicites`). La story 4.2 est fonctionnellement solide sur le fond : le registre workspace-scoped fonctionne, la CLI est correcte, l'audit `capability.invoked` est bien structure, la non-fuite vendor est verifiee et les garde-fous historiques `fs.read`/`cli.run` sont compatibles via `BUILT_IN_ALLOWED_CAPABILITIES`. Cependant, 12 findings et 6 gaps de tests empechent le passage en `done`.

### Findings adresses

**P0 — Bloquants fonctionnels:**
- **F1** (HIGH): `evaluate-capability-guardrails.ts:16-33` — `approvalSensitive=true` est enregistre et propage au payload de l'evenement et a l'audit, mais `evaluateCapabilityGuardrails` ne le consulte jamais. Aucun code ne declenche un flux approval specifique, n'ajoute un marqueur `approval_sensitive` aux guardrails, ni ne bloque une invocation approval-sensitive. Viole AC2 ("l'invocation reste soumise aux approvals et policies du coeur") et le Testing Requirement ("approvalSensitive path").
- **F2** (HIGH): `register-capability.ts:77-80` — `registration.capability.mcpServerName ?? ""` produit un binding MCP avec `serverName: ""` si le manifeste omet ce champ. Une capability MCP enregistree avec une cible vide sera irresoluble en aval. Viole AC1 (registration invalide acceptee).
- **F3** (HIGH): `file-capability-registry-repository.ts:34-66` — `findByCapabilityId` → verification → `mkdir` + `writeFile` sans lock/rename atomique. Deux `registerCapability` concurrents sur le meme `capabilityId` passent tous les deux le guard et le dernier ecrase le premier silencieusement.

**P1 — Bugs logiques et gaps de garde-fous:**
- **F4** (MEDIUM): `evaluate-capability-guardrails.ts` / `invoke-registered-capability.ts` — `requiredEnvNames` est stocke et surface dans l'audit, mais aucun code ne verifie que les variables d'environnement requises sont definies avant invocation. Gap AC1 (validation info non utilisee).
- **F5** (MEDIUM): `run-ticket.ts:1068-1089` + `:1091-1122` — `preflightRegisteredCapabilities` lit et evalue chaque capability, puis `buildCapabilityInvocationEvents` appelle `invokeRegisteredCapability` qui relit et reevalue en interne. Double lecture disque + double evaluation. Fenetre TOCTOU entre les deux.
- **F6** (MEDIUM): `audit-log-projection.ts:39-47` + `read-mission-audit.ts:59-67` — `CapabilityInvocationDetails` interface identique definie deux fois en prive. Risque de derive silencieuse.
- **F7** (MEDIUM): `extension-command.ts:185-199` — `ensureCapabilityWorkspaceInitialized` catch-all englobe `EACCES`, erreurs I/O, etc., toutes rapportees comme "workspace non initialise".
- **F8** (MEDIUM): `workspace-layout.ts:76` — le pattern `/[/\\]|\.\./` ne rejette pas `.` seul. `path.join(capabilitiesDir, ".")` resout vers `capabilitiesDir` lui-meme.
- **F9** (MEDIUM): `extension-command.ts:194` — un workspace bootstrappe avant 4.2 n'a pas `.corp/capabilities/`. `ensureCapabilityWorkspaceInitialized` le rejettera sans migration ni message clair.

**P2 — Ameliorations:**
- **F10** (LOW): `extension-command.ts:76-78` — sous-commande `capability` inconnue (ex: `list`, typo) produit un `throw new Error(...)` au lieu d'un message CLI avec aide.
- **F11** (LOW): `file-capability-registry-repository.ts:73-90` — `findByCapabilityId` ne gere pas les JSON corrompus : un `SyntaxError` non attrape remonte comme crash runtime.
- **F12** (LOW): `workspace-layout.ts:76` — null byte dans `capabilityId` non rejete par le pattern regex.

**Gaps de tests:**
- **T1**: aucun test ne verifie le comportement `approvalSensitive=true` (Testing Requirement viole)
- **T2**: aucun test pour `fs.read`/`cli.run` dans `allowedCapabilities` (compatibilite garde-fous historiques non couverte)
- **T3**: test vendor-leak ne couvre pas le journal brut (`events.jsonl`)
- **T4**: aucun test de `capabilityId` avec caracteres limites (`.`, `..`, null byte, chaine vide, chaine longue)
- **T5**: aucun test de regression pour workspace pre-4.2 sans `capabilitiesDir`
- **T6**: aucun test de `requiredEnvNames` absent en runtime

## Acceptance Criteria

1. Given une capability enregistree avec `approvalSensitive=true` est invoquee
   When l'invocation se produit
   Then les garde-fous emis contiennent un marqueur `approval_sensitive: <capabilityId>` lisible par le noyau existant
   And le resultat d'invocation signale la sensibilite approval pour que le flux d'approbation du coeur puisse le traiter

2. Given une registration MCP est chargee avec `mcpServerName` ou `mcpToolName` absent ou vide
   When le manifeste est traite par `registerCapability`
   Then l'enregistrement echoue avec un message d'erreur deterministe
   And aucune entree n'est persistee dans le registre

3. Given deux appels `registerCapability` concurrents sur le meme `capabilityId`
   When les deux passent le guard d'existence
   Then au plus un seul persiste son entree sans corrompre le registre de l'autre
   And le perdant recoit une erreur deterministe

4. Given une capability enregistree avec `requiredEnvNames` non vide est invoquee
   When une ou plusieurs variables d'env requises sont absentes
   Then l'invocation emet un warning dans les garde-fous
   And le comportement reste non-bloquant pour garder la compatibilite V1

5. Given un ticket porte uniquement `fs.read` ou `cli.run` dans `allowedCapabilities`
   When le ticket est lance via `corp mission ticket run`
   Then aucune recherche registre n'est tentee pour ces built-ins
   And aucun evenement `capability.invoked` orphelin n'est journalise
   And l'execution se poursuit normalement

6. Given un workspace initialise avant 4.2 ne contient pas `.corp/capabilities/`
   When l'operateur tente `corp extension capability register`
   Then le message d'erreur distingue clairement "workspace ancien, capabilities non initialise" d'un workspace absent
   And le message suggere de re-lancer `corp mission bootstrap`

7. Given un `capabilityId` contient `.`, `\0`, une chaine vide ou depasse 255 caracteres
   When il est utilise pour resoudre un chemin de stockage
   Then `assertSafeStorageIdentifier` le rejette avec un message deterministe

## Tasks / Subtasks

- [x] Corriger F1: ajouter le marqueur `approval_sensitive` aux garde-fous (AC: 1)
  - [x] Dans `evaluate-capability-guardrails.ts`, quand `capability.approvalSensitive === true`, ajouter `approval_sensitive: <capabilityId>` dans le tableau des guardrails retourne.
  - [x] S'assurer que le marqueur est emis dans le payload `capability.invoked` via le champ `guardrails`.
  - [x] Ne PAS inventer un deuxieme systeme d'approvals; le marqueur doit etre lisible par `resolveApprovalRequest(...)` et le flux existant.
  - [x] Verifier que `buildApprovalGuardrailsSnapshot` n'ecrase pas le marqueur ajoute (utiliser `baseGuardrails` ou ajouter apres l'appel).

- [x] Corriger F2: valider `mcpServerName`/`mcpToolName` pour le provider MCP (AC: 2)
  - [x] Dans `register-capability.ts`, dans `buildRegisteredCapability`, quand `provider === "mcp"`, verifier que `mcpServerName` et `mcpToolName` sont des chaines non vides apres trim.
  - [x] Si l'une est absente ou vide, throw une erreur explicite : "Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP."
  - [x] Ajouter le test unitaire correspondant dans `capability-registry-registration.test.ts`.

- [x] Corriger F3: ecriture atomique dans le repository fichier (AC: 3)
  - [x] Dans `FileCapabilityRegistryRepository.save()`, ecrire dans un fichier temporaire `capability.json.tmp` puis `rename()` vers `capability.json` pour rendre l'ecriture atomique.
  - [x] Si `rename` echoue, supprimer le fichier temporaire et remonter l'erreur.
  - [x] Documenter en commentaire que cette approche ne protege pas contre la concurrence multi-processus (acceptable en V1 CLI mono-utilisateur) mais protege contre les ecritures partielles.

- [x] Corriger F4: warning pour `requiredEnvNames` absentes (AC: 4)
  - [x] Dans `evaluate-capability-guardrails.ts`, apres la verification `allowedCapabilities`, iterer `capability.requiredEnvNames` et verifier la presence dans `process.env`.
  - [x] Pour chaque variable absente, ajouter un guardrail `missing_env: <envName>` dans le tableau retourne.
  - [x] Ne PAS bloquer l'invocation : le warning dans les guardrails suffit pour le V1. Documenter ce choix.

- [x] Corriger F5: eliminer la double lecture/evaluation des capabilities (AC: 1)
  - [x] Fusionner `preflightRegisteredCapabilities` et `buildCapabilityInvocationEvents` dans `run-ticket.ts` en un seul pass qui lit chaque capability une seule fois, evalue les guardrails, et produit les evenements d'invocation.
  - [x] Supprimer l'appel redondant a `readRegisteredCapability` dans `invokeRegisteredCapability`; accepter un parametre `capability: RegisteredCapability` deja resolu.
  - [x] Conserver le short-circuit `isBuiltInAllowedCapability` dans le pass unique.

- [x] Corriger F6: extraire `CapabilityInvocationDetails` dans les contrats (AC: 1, 2)
  - [x] Creer ou ajouter l'interface `CapabilityInvocationDetails` dans `packages/contracts/src/extension/registered-capability.ts` (ou un fichier dedie `capability-invocation.ts`).
  - [x] Remplacer les definitions privees dans `audit-log-projection.ts` et `read-mission-audit.ts` par un import unique.

- [x] Corriger F7: differencier les erreurs dans `ensureCapabilityWorkspaceInitialized` (AC: 6)
  - [x] Dans `extension-command.ts`, attraper l'erreur de `access()` et verifier `error.code` :
    - `ENOENT` → message "workspace non initialise" comme aujourd'hui.
    - `EACCES` → message "permissions insuffisantes sur le workspace".
    - Autre → propager l'erreur d'origine.

- [x] Corriger F8: rejeter `.` et null byte dans `assertSafeStorageIdentifier` (AC: 7)
  - [x] Etendre `UNSAFE_STORAGE_ID_PATTERN` dans `workspace-layout.ts` pour rejeter : `.` seul (`/^\\.$/`), null byte (`/\x00/`), et longueur > 255.
  - [x] Pattern recommande : `/[/\\]|\.\.|^\\.?$|\x00/` avec un guard `value.length > 255`.

- [x] Corriger F9: workspace pre-4.2 sans `capabilitiesDir` (AC: 6)
  - [x] Dans `ensureCapabilityWorkspaceInitialized`, si les chemins historiques (journal, projections, missions) sont presents mais `capabilitiesDir` est absent, produire un message d'erreur specifique : "Le workspace existe mais le repertoire capabilities n'est pas initialise. Lancez `corp mission bootstrap --root <workspace>` pour le mettre a jour."
  - [x] Verifier que `bootstrapMissionWorkspace` (via `ensureWorkspaceLayout`) cree bien `capabilitiesDir` sur un workspace existant sans le detruire.

- [x] Corriger F10: message CLI pour sous-commande capability inconnue (AC: 6)
  - [x] Dans `runCapabilityExtensionCommand`, si `subcommand` n'est pas `register`, afficher l'aide extension via `writeHelp(output)` et retourner `1` au lieu de `throw new Error(...)`.

- [x] Corriger F11: gerer `SyntaxError` dans `findByCapabilityId` (AC: 3)
  - [x] Dans `file-capability-registry-repository.ts`, ajouter un catch pour `SyntaxError` dans `findByCapabilityId`, retourner `null` ou throw une erreur domaine explicite ("fichier de registre corrompu pour la capability X").

- [x] Corriger F12: rejeter null byte (AC: 7)
  - [x] Deja traite dans la tache F8 ci-dessus. Verifier que le test couvre le cas.

- [x] Ajouter les tests manquants (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] **T1**: test `approvalSensitive=true` comportemental dans `capability-registry-registration.test.ts` — verifier que les guardrails contiennent `approval_sensitive: shell.exec` quand `approvalSensitive=true` et ne le contiennent pas quand `approvalSensitive=false`.
  - [x] **T2**: test `fs.read`/`cli.run` dans `capability-invocation-audit.test.ts` ou nouveau fichier — creer un ticket avec `allowedCapabilities: ["fs.read", "cli.run"]`, lancer `ticket run`, verifier qu'aucun `capability.invoked` n'est emis et que l'execution reussit.
  - [x] **T3**: etendre `capability-invocation-audit.test.ts` pour appeler `doesNotMatch` sur `JSON.stringify(journal)` avec les patterns vendor (`responseId`, `pollCursor`, `vendorStatus`).
  - [x] **T4**: test edge-case `capabilityId` dans `capability-registry-registration.test.ts` — verifier que `.`, `..`, `\x00`, `""`, et une chaine de 300 caracteres sont rejetes par `resolveCapabilityStoragePaths`.
  - [x] **T5**: test workspace pre-4.2 dans `capability-register-cli.test.ts` — creer un workspace sans `capabilitiesDir`, tenter `register`, verifier le message d'erreur specifique.
  - [x] **T6**: test `requiredEnvNames` dans `capability-registry-registration.test.ts` — enregistrer une capability avec `requiredEnvNames: ["MY_API_KEY"]`, invoquer sans definir la variable, verifier que les guardrails contiennent `missing_env: MY_API_KEY`.

## Dev Notes

### Story Intent

La story 4.5 ne modifie pas la surface fonctionnelle du registre capability. Elle solidifie l'implementation existante en :

1. Rendant `approvalSensitive` observable dans les garde-fous (pas un second systeme d'approbation, juste un marqueur lisible par le noyau).
2. Fermant les chemins d'entree invalides (MCP binding vide, capabilityId pathologiques).
3. Ajoutant les garde-fous manquants (requiredEnvNames, ecriture atomique).
4. Eliminant le code duplique et les doubles lectures.
5. Couvrant les chemins non testes identifies par la review.

Si la solution ajoute un nouveau systeme d'approbation, un moteur de policy, ou modifie le contrat coeur `Mission`/`Ticket`, elle rate sa cible.

### Current Project State

- La story 4.2 est en statut `review` avec 216 tests au vert.
- Les fichiers cibles sont ceux listes dans la File List de 4.2 (voir References).
- `packages/contracts/src/extension/registered-capability.ts` est le type runtime principal.
- `packages/capability-registry/src/policies/evaluate-capability-guardrails.ts` est le point d'intervention principal pour F1 et F4.
- `packages/storage/src/repositories/file-capability-registry-repository.ts` est le point d'intervention pour F3 et F11.
- `packages/storage/src/fs-layout/workspace-layout.ts` est le point d'intervention pour F8 et F12.
- `apps/corp-cli/src/commands/extension-command.ts` est le point d'intervention pour F7, F9 et F10.

### Implementation Guardrails

- Ne pas etendre `Mission`, `Ticket`, `ExecutionAttempt`, `ApprovalRequest` ou `MissionResume` pour y embarquer des corrections registre.
- Ne pas ajouter de dependance npm externe.
- Ne pas modifier le contrat public de `RegisteredCapability` (ajouter des champs optionnels est acceptable si justifie).
- Garder `evaluate-capability-guardrails.ts` comme une evaluation pure sans effet de bord I/O (sauf `process.env` pour F4).
- Le marqueur `approval_sensitive` doit etre une chaine dans le tableau `guardrails`, pas un nouveau champ structurel.
- L'ecriture atomique via `rename()` est un best-effort V1; ne pas ajouter un systeme de locks fichier complet.
- Garder `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.

### File Structure Requirements

**Fichiers modifies (pas de nouveau fichier sauf si extraction de type):**
- `packages/capability-registry/src/policies/evaluate-capability-guardrails.ts` (F1, F4)
- `packages/capability-registry/src/registry/register-capability.ts` (F2)
- `packages/capability-registry/src/registry/invoke-registered-capability.ts` (F5)
- `packages/storage/src/repositories/file-capability-registry-repository.ts` (F3, F11)
- `packages/storage/src/fs-layout/workspace-layout.ts` (F8, F12)
- `apps/corp-cli/src/commands/extension-command.ts` (F7, F9, F10)
- `packages/journal/src/projections/audit-log-projection.ts` (F6)
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts` (F6)
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` (F5)

**Fichier optionnel nouveau (F6):**
- `packages/contracts/src/extension/capability-invocation.ts` — si l'extraction du type justifie un fichier dedie; sinon, ajouter dans `registered-capability.ts`.

**Tests:**
- `tests/unit/capability-registry-registration.test.ts` (T1, T4, T6)
- `tests/integration/capability-invocation-audit.test.ts` (T2, T3)
- `tests/integration/capability-register-cli.test.ts` (T5)

### Testing Requirements

- Conserver `node:test` et `assert/strict`; pas de Jest/Vitest.
- Garder toute la suite hors reseau.
- **T1**: invoquer une capability `approvalSensitive=true`, verifier que `guardrails` contient `approval_sensitive: <capabilityId>`. Invoquer une capability `approvalSensitive=false`, verifier que `guardrails` ne contient pas `approval_sensitive`.
- **T2**: creer un ticket avec `allowedCapabilities: ["fs.read"]`, lancer `ticket run` (mock adapter), verifier : zero `capability.invoked` dans le journal, exit code 0.
- **T3**: dans le test d'audit integration existant, ajouter `assert.doesNotMatch(JSON.stringify(journal), /responseId|pollCursor|vendorStatus/)`.
- **T4**: pour chaque `capabilityId` invalide (`.`, `..`, `\x00foo`, `""`, `"a".repeat(300)`), appeler `resolveCapabilityStoragePaths` et verifier `assert.throws`.
- **T5**: creer un workspace avec `journalPath` + `projectionsDir` + `missionsDir` mais sans `capabilitiesDir`, appeler `register`, verifier le message d'erreur mentionne "capabilities non initialise" ou "bootstrap".
- **T6**: enregistrer une capability avec `requiredEnvNames: ["MISSING_VAR"]`, invoquer, verifier que `guardrails` contient `missing_env: MISSING_VAR`.

### Scope Exclusions

- Pas de nouveau systeme d'approbation; `approval_sensitive` est un marqueur guardrail, pas un workflow.
- Pas de locks fichier multi-processus; `rename()` atomique suffit en V1.
- Pas de migration automatique des workspaces pre-4.2; le message d'erreur suffit.
- Pas de validation structurelle complete du JSON lu depuis le registre (schema runtime); acceptable en V1.
- Pas de modification de la CLI `extension validate` (deja correcte).

### Assumptions

- `resolveApprovalRequest(...)` sait deja lire et router les guardrails sous forme de chaines; ajouter `approval_sensitive: <id>` est suffisant pour que le noyau puisse le traiter.
- `fs.rename()` est atomique sur le meme volume pour NTFS/ext4/APFS; c'est une garantie OS standard.
- Un workspace initialise avant 4.2 peut etre mis a jour par un simple re-`bootstrap` qui cree le repertoire manquant sans detruire les donnees existantes.

## References

- `C:/Dev/PRJET/corp/_bmad-output/implementation/4-2-enregistrer-une-capability-locale-avec-permissions-et-contraintes-explicites.md` — story source et file list
- `C:/Dev/PRJET/corp/_bmad-output/planning/epics.md` — Epic 4; AC de la story 4.2
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` — 3.3 Event and Audit Envelope; 3.4 Vendor Data; 5.2 Architectural Boundaries
- `C:/Dev/PRJET/corp/packages/capability-registry/src/policies/evaluate-capability-guardrails.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/registry/register-capability.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/registry/invoke-registered-capability.ts`
- `C:/Dev/PRJET/corp/packages/capability-registry/src/registry/read-registered-capability.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/repositories/file-capability-registry-repository.ts`
- `C:/Dev/PRJET/corp/packages/storage/src/fs-layout/workspace-layout.ts`
- `C:/Dev/PRJET/corp/apps/corp-cli/src/commands/extension-command.ts`
- `C:/Dev/PRJET/corp/packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `C:/Dev/PRJET/corp/packages/journal/src/projections/audit-log-projection.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `C:/Dev/PRJET/corp/packages/mission-kernel/src/approval-service/resolve-approval-request.ts`
- `C:/Dev/PRJET/corp/tests/unit/capability-registry-registration.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/capability-invocation-audit.test.ts`
- `C:/Dev/PRJET/corp/tests/integration/capability-register-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/contract/extension-validate-cli.test.ts`
- `C:/Dev/PRJET/corp/tests/unit/audit-log-projection.test.ts`

## Dev Agent Record

### Implementation Plan

- Ajouter des tests rouges pour les garde-fous approval/env, les built-ins, le workspace legacy, les identifiants pathologiques, le registre corrompu et la concurrence.
- Corriger les guardrails capability et la validation explicite des bindings MCP.
- Fiabiliser le repository fichier avec revendication du dossier capability, ecriture temporaire et `rename()`.
- Supprimer la double lecture des capabilities dans `run-ticket`, extraire `CapabilityInvocationDetails` et rediger le journal brut pour retirer les details vendor.
- Executer la regression complete avant passage en review.

### Debug Log

- `2026-04-13`: ajout des tests rouges T1-T6 et de la couverture supplementaire pour collision concurrente, registre corrompu et sous-commande CLI inconnue.
- `2026-04-13`: implementation des guardrails `approval_sensitive` et `missing_env`, de la validation MCP explicite, du durcissement `assertSafeStorageIdentifier` et de la gestion differenciee du workspace capability.
- `2026-04-13`: refactor `run-ticket` en pass unique pour les capabilities, extraction `CapabilityInvocationDetails`, et redaction du journal `events.jsonl` pour supprimer `responseId`, `pollCursor`, `vendorStatus` et vider `adapterState`.
- `2026-04-13`: validation complete par `npm test` avec 224 tests verts.

### Completion Notes

- Les garde-fous capability attendus par le coeur existant sont maintenant emis sans introduire de nouveau workflow d'approbation.
- Le registre capability rejette les bindings MCP incomplets, les identifiants pathologiques, les fichiers corrompus et les collisions concurrentes detectees apres le guard initial.
- `run-ticket` ne relit plus les capabilities deux fois et conserve le short-circuit pour `fs.read` / `cli.run`.
- Le journal brut masque maintenant les details vendor connus tout en preservant les snapshots mission/ticket/attempt complets pour le runtime.
- Regression complete validee par `npm test`.

## File List

- `packages/contracts/src/extension/registered-capability.ts`
- `packages/capability-registry/src/policies/evaluate-capability-guardrails.ts`
- `packages/capability-registry/src/registry/register-capability.ts`
- `packages/capability-registry/src/registry/invoke-registered-capability.ts`
- `packages/storage/src/repositories/file-capability-registry-repository.ts`
- `packages/storage/src/fs-layout/workspace-layout.ts`
- `apps/corp-cli/src/commands/extension-command.ts`
- `packages/journal/src/event-log/append-event.ts`
- `packages/journal/src/projections/audit-log-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-audit.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `tests/unit/capability-registry-registration.test.ts`
- `tests/integration/capability-invocation-audit.test.ts`
- `tests/integration/capability-register-cli.test.ts`

### Review Findings

- [x] [Review][Patch] `resolveRegistrationErrorMessage` avale les diagnostics non-MCP quand un champ MCP echoue [`register-capability.ts:106-118`] — corrige
- [x] [Review][Patch] L'erreur de cleanup masque l'erreur originale dans `save()` et le repertoire capability orphelin bloque les tentatives suivantes [`file-capability-registry-repository.ts:83-86`] — corrige
- [x] [Review][Defer] `localRefs` obligatoire meme pour les capabilities MCP [`registered-capability.ts:31`] — deferred, pre-existing
- [x] [Review][Defer] TOCTOU entre `access()` et l'ecriture effective [`extension-command.ts:185-235`] — deferred, pre-existing
- [x] [Review][Defer] `localeCompare` locale-sensitive sur timestamps ISO [`audit-log-projection.ts:63-65`] — deferred, pre-existing
- [x] [Review][Defer] Ecritures projection concurrentes non-atomiques [`read-mission-audit.ts:156`, `file-projection-store.ts`] — deferred, pre-existing
- [x] [Review][Defer] Test seam mutable au niveau module [`run-ticket.ts:78-89`] — deferred, pre-existing
- [x] [Review][Defer] Type guards dupliques entre `audit-log-projection.ts:749` et `read-mission-audit.ts:596` — deferred, pre-existing
- [x] [Review][Defer] `limit` negatif retourne tous les entries [`read-mission-audit.ts:80-82`] — deferred, pre-existing
- [x] [Review][Defer] `rootDir` undefined resolu silencieusement vers CWD [`run-ticket.ts:94`] — deferred, pre-existing
- [x] [Review][Defer] `readEventLog` sans guard ENOENT [`file-event-log.ts:16`] — deferred, pre-existing
- [x] [Review][Defer] `appendFile` concurrent peut corrompre le JSONL sur Windows [`append-event.ts:19`] — deferred, pre-existing
- [x] [Review][Defer] Divergence journal/read-model pour les artifacts dans le catch block [`run-ticket.ts:483-503`] — deferred, pre-existing
- [x] [Review][Defer] `assertSafeStorageIdentifier` n'interdit pas les caracteres reserves Windows [`workspace-layout.ts:77`] — deferred, pre-existing
- [x] [Review][Defer] Bare catch dans `ensureMissionAuditWorkspaceInitialized` (meme pattern que F7) [`read-mission-audit.ts:177-190`] — deferred, pre-existing
- [x] [Review][Defer] `resolveEventKind` produit titre vide pour types edge-case [`audit-log-projection.ts:453`] — deferred, pre-existing

## Change Log

- `2026-04-13`: correction des findings 4.5 sur le registre capability, durcissement du workspace/stockage, elimination de la double lecture runtime, redaction du journal brut et ajout de la couverture de tests associee.
- `2026-04-13`: code review adversariale a trois layers; 2 patchs appliques (diagnostics MCP non avales, cleanup error non masquee), 14 deferred, 6 dismissed. 224 tests verts. Story passee en done.
