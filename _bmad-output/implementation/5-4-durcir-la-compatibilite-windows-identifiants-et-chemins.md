# Story 5.4: Durcir la compatibilite Windows pour identifiants et chemins

Status: done

## Story

As a mainteneur de `corp`,
I want que les identifiants de stockage, les comparaisons d'extensions et la resolution de chemins soient deterministes entre Windows et POSIX,
so that la CLI produise un message clair plutot qu'une erreur filesystem opaque et qu'aucune collision silencieuse n'apparaisse sur un filesystem case-insensitive.

## Context

La baseline de developpement cible Node.js LTS multi-OS. Les retros Epic 3 et Epic 4 signalent plusieurs asymetries entre Windows NTFS (FS case-insensitive, reserved names, caracteres interdits, chemins UNC) et POSIX (case-sensitive, pas de reserved names). Actuellement:

- `assertSafeStorageIdentifier` n'interdit pas les caracteres reserves Windows (`:`, `<`, `>`, `|`, `?`, `*`, `"`) ni les noms reserves (`CON`, `NUL`, `PRN`, `AUX`, `COM1-9`, `LPT1-9`); sur Windows, `mkdir`/`writeFile` produisent des erreurs OS opaques.
- Les comparaisons de `packRef` et `capabilityRef` sont case-sensitive; sur un FS case-insensitive, `Pack.Triage` et `pack.triage` pointent vers le meme dossier mais sont enregistres comme packRefs distincts en memoire.
- `isAbsoluteReference` rejette les chemins UNC Windows (`\\\\server\\share`) quand execute en runtime POSIX de CI.

## Acceptance Criteria

1. Given un identifiant de storage (mission, ticket, capability, skill-pack) contient un caractere interdit (`:`, `<`, `>`, `|`, `?`, `*`, `"`, `\0`), un espace/point terminal, ou un nom reserve Windows (`CON`, `PRN`, `NUL`, `AUX`, `COM1-9`, `LPT1-9`, avec ou sans extension)
   When `assertSafeStorageIdentifier` est invoquee
   Then l'identifiant est rejete avec un message deterministe citant la raison
   And aucun `mkdir`/`writeFile` en aval ne produit plus une erreur OS opaque

2. Given deux `packRef` ou `capabilityRef` differant seulement par la casse sont enregistres sur un filesystem case-insensitive
   When le registre les compare
   Then la comparaison suit une regle documentee (casefold ou normalisation explicite documentee dans le contrat)
   And `Pack.Triage` et `pack.triage` ne peuvent coexister comme enregistrements distincts; un second register echoue avec un message explicite "collision de casse detectee"

3. Given `ensureTicketExtensionsAllowedByMission` compare les refs de ticket aux `authorizedExtensions` d'une mission
   When la comparaison est effectuee sur un FS case-insensitive
   Then la regle de normalisation est coherente avec AC2 et `Set.has()` ne produit plus de faux negatif dependant de la casse

4. Given un chemin UNC Windows (`\\\\server\\share\\...`) est passe a `isAbsoluteReference`
   When le code s'execute sur un runtime POSIX de CI
   Then la regex de secours reconnait le chemin comme absolu
   And `validateResolvedLocalRef` produit un diagnostic specifique plutot qu'un faux "ref manquante"

5. Given un test est execute sur Windows ou sur POSIX
   When les scenarios d'AC1, AC2, AC3, AC4 sont rejoues
   Then le comportement observable est identique sur les deux OS

## Tasks / Subtasks

- [x] Etendre `assertSafeStorageIdentifier` pour Windows (AC: 1)
  - [x] Ajouter la liste des caracteres interdits (`:`, `<`, `>`, `|`, `?`, `*`, `"`, `\0`) et de l'espace/ponctuation terminale.
  - [x] Ajouter la liste des noms reserves (case-insensitive) avec et sans extension : `CON`, `PRN`, `NUL`, `AUX`, `COM1`-`COM9`, `LPT1`-`LPT9`.
  - [x] Messages d'erreur distincts et documentes par regle violee.
  - [x] Tests unitaires: chaque caractere interdit, chaque nom reserve (avec et sans extension), casse mixte.

- [x] Normaliser la casse pour les refs d'extension (AC: 2, 3)
  - [x] Documenter le contrat de normalisation dans `packages/contracts/src/extension/extension-registration.ts` (forme canonique de comparaison, preservation de l'ordre, dedupe stable).
  - [x] Appliquer la normalisation dans `normalizeOpaqueReferences` (factoree en Story 5.3).
  - [x] Appliquer la meme normalisation aux refs de mission (`authorizedExtensions.allowedCapabilities` et `authorizedExtensions.skillPackRefs`) pour que la lecture, l'hydratation et `Set.has()` restent coherents.
  - [x] Detection de collision de casse lors d'un second register dans les repositories capability / skill-pack: si `pack.triage` existe deja et que l'operateur tente `Pack.Triage`, l'erreur est explicite (`collision de casse detectee`).
  - [x] `ensureTicketExtensionsAllowedByMission` utilise la meme normalisation avant `Set.has()` sur les refs du ticket et sur les refs autorisees de mission.

- [x] Reconnaitre les chemins UNC sur POSIX (AC: 4)
  - [x] Etendre la regex fallback dans `isAbsoluteReference` pour matcher `^\\\\\\\\[^\\\\]+\\\\[^\\\\]+` (chemin UNC).
  - [x] Clarifier le comportement de `validateResolvedLocalRef` en cas de chemin UNC: tenter `statSync`, et si erreur specifique (ex. `ENOTFOUND`), produire un diagnostic `unc_unreachable` distinct de `missing_local_ref`.
  - [x] Test: chemin UNC sur runtime POSIX -> `isAbsoluteReference` retourne true.

- [x] Ajouter les tests cross-OS (AC: 5)
  - [x] Marquer certains tests comme `@windows-only` ou les conditionner avec `process.platform`.
  - [x] Pour les regles AC1/AC2, utiliser des tests unitaires independants de l'OS.
  - [x] Documenter en commentaire de test les differences de comportement attendues entre Windows et POSIX.

### Review Findings

Revue adversariale 3 couches (Blind Hunter, Edge Case Hunter, Acceptance Auditor) executee le 2026-04-23.
Bilan: 5 patches HIGH/MEDIUM appliques en ligne, 2 LOW corriges, 9 items defer (deferred-work.md), ~13 dismissed (faux positifs / hors scope / doublons).

- [x] [Review][Patch] `validateResolvedLocalRef` discrimine les codes reseau (ENOTFOUND/EHOSTUNREACH/ENETUNREACH/ETIMEDOUT/ECONNREFUSED/EHOSTDOWN) avant de produire `unc_unreachable`; tout autre code retombe sur `missing_local_ref`. [packages/capability-registry/src/validation/validate-extension-registration.ts:1057]
- [x] [Review][Patch] `assertSafeStorageIdentifier` rejette les caracteres de controle ASCII `\x01-\x1F` avec un message citant le code point, en amont des verifications de reserved names. [packages/storage/src/fs-layout/workspace-layout.ts:199]
- [x] [Review][Patch] `normalizeOpaqueExtensionReference` elargit le trim pour enlever BOM `U+FEFF`, NBSP `U+00A0`, ZWSP/ZWJ/ZWNJ `U+200B-U+200F` et separateurs de ligne `U+2028/2029` en tete/queue. [packages/contracts/src/extension/extension-registration.ts:106]
- [x] [Review][Patch] Test unitaire `UNC_UNREACHABLE_ERROR_CODES contient les codes reseau specifiques ...` verifie la matrice de discrimination des codes d'erreur independamment de l'OS. [tests/unit/extension-registration-validation.test.ts]
- [x] [Review][Patch] `UNSAFE_STORAGE_ID_PATTERN` resserre la detection de `..` au segment pur (`^\.{1,2}$`) pour ne plus confondre `a..b` avec un segment relatif; message d'erreur reste deterministe. [packages/storage/src/fs-layout/workspace-layout.ts:88]
- [x] [Review][Patch] JSDoc de `normalizeOpaqueReferenceKey` documente le casefold `toLocaleLowerCase("en-US")`, la normalisation NFC, et le trim Unicode elargi; explicite le choix de locale `en-US` pour eviter la transformation `I -> ı` d'une locale `tr-TR`. [packages/contracts/src/extension/extension-registration.ts:110]
- [x] [Review][Patch] Indentation rectifiee dans `resolveNextAuthorizedExtensions` (4 espaces -> 2) pour aligner la fonction avec le reste du module. [packages/mission-kernel/src/mission-service/select-mission-extensions.ts:140]
- [x] [Review][Defer] Regex UNC matche aussi `\\?\` et `\\.\` (device/long-path) en les classifiant `non_local_ref` [packages/capability-registry/src/validation/validate-extension-registration.ts:99] — deferred, comportement acceptable (les device paths sont bien refuses comme non-locaux) mais discrimination fine pourrait etre ajoutee en phase ulterieure.
- [x] [Review][Defer] `normalizeOpaqueReferenceKey` n'offre pas un vrai casefold Unicode; `toLocaleLowerCase("en-US")` diverge du comportement NTFS pour `ß`, ligatures, et le turc dotless I (`İ`). [packages/contracts/src/extension/extension-registration.ts:123] — deferred, impact theorique sur identifiants non-ASCII; choix V1 = casefold ASCII deterministe.
- [x] [Review][Defer] `FileSkillPackRegistryRepository.list()` (deprecated) jette la premiere erreur invalide au lieu de skipper [packages/storage/src/repositories/file-skill-pack-registry-repository.ts:193] — deferred, l'alternative `listAll()` existe; migration des call-sites en 5-7.
- [x] [Review][Defer] Le chemin UNC resolu est recrache tel quel dans le diagnostic `unc_unreachable: ... ${resolvedPath}` [packages/capability-registry/src/validation/validate-extension-registration.ts:1073] — deferred, l'info est utile au debug et il n'y a pas de log sensible dans ce flux aujourd'hui.
- [x] [Review][Defer] Le test UNC fallback monkey-patche `path.isAbsolute` globalement sans isolation `t.mock.method` [tests/unit/extension-registration-validation.test.ts:109] — deferred, `node:test` concurrency=1 par defaut.
- [x] [Review][Defer] `ensureTicketExtensionsAllowedByMission` affiche la cle normalisee (lowercase) dans les messages d'erreur au lieu de la valeur source [packages/ticket-runtime/src/ticket-service/ticket-service-support.ts:132] — deferred, choix documente aligne avec la persistance normalisee.
- [x] [Review][Defer] `resolveNormalizedReferenceList` dans `resolve-approval-request` remplace la liste complete quand `nextValues.length > 0` (pas d'union); perte silencieuse possible [packages/mission-kernel/src/approval-service/resolve-approval-request.ts:297] — deferred, semantique pre-existante a 5-4 (hors scope).
- [x] [Review][Defer] Workspaces legacy crees avant 5-4 avec dossiers en casse mixte deviennent invisibles a `list()` (`resolveCapabilityStoragePaths` lowercase le chemin) [packages/storage/src/repositories/file-capability-registry-repository.ts:102] — deferred, script de migration a planifier.
- [x] [Review][Defer] Identifiants mission/ticket/attempt/artifact ne beneficient PAS de la normalisation case-insensitive (seuls capability/skill-pack) [packages/storage/src/fs-layout/workspace-layout.ts:92] — deferred, divergence potentielle FS sensible/insensible sur workspaces synchronises cross-OS; hors scope AC 5-4.
- [x] [Review][Defer] macOS HFS+/APFS stocke les noms en NFD; `listAll()` peut manquer des skill-packs avec diacritiques [packages/storage/src/repositories/file-skill-pack-registry-repository.ts:150] — deferred, WSL/macOS hors cible NFR18 V1.

## Dev Notes

### Story Intent

Aucun changement de contrat Mission/Ticket public. Les changements attendus vivent principalement dans:

- `packages/storage/src/fs-layout/workspace-layout.ts`
- `packages/contracts/src/extension/extension-registration.ts`
- `packages/contracts/src/mission/mission.ts`
- `packages/ticket-runtime/src/ticket-service/ticket-service-support.ts`
- `packages/storage/src/repositories/file-capability-registry-repository.ts`
- `packages/storage/src/repositories/file-skill-pack-registry-repository.ts`
- `packages/capability-registry/src/validation/validate-extension-registration.ts`

Les regles Windows doivent etre appliquees meme sur runtime POSIX pour garantir la portabilite. La normalisation de casse sert a la comparaison et a la detection de collision; l'affichage operateur peut conserver la valeur source tant qu'aucune ambiguite n'est possible.

### Items deferred-work.md absorbes

D-22, D-37, D-45, D-46, D-52.

### NFR cible

NFR18 (Portabilite Windows): 100% des identifiants non portables sur Windows doivent etre rejetes avant ecriture disque, et 100% des collisions de casse sur les refs d'extension doivent etre detectees de maniere deterministe dans les tests cross-OS ou equivalents.

### Testing Requirements

- Tests unitaires exhaustifs sur `assertSafeStorageIdentifier` (chaque caractere interdit, chaque nom reserve).
- Tests unitaires sur la normalisation de casse (collision detectee, refs normalisees coherentes entre registre, mission et ticket).
- Test d'integration UNC sur runtime POSIX.
- Couvrir au minimum `tests/unit/capability-registry-registration.test.ts`, `tests/unit/skill-pack-registration.test.ts`, `tests/unit/extension-registration-validation.test.ts` et les tests ticket/mission impactes par `authorizedExtensions`.
- Si possible, pipeline CI Windows en complement.

## Dev Agent Record

### Implementation Plan

- Etendre la validation des identifiants de stockage avec les contraintes Windows explicites et des messages par cause.
- Introduire une cle canonique de comparaison partagee pour les refs capability / skill pack, puis l'appliquer a la mission, au ticket et aux repositories.
- Rendre les collisions de casse explicites dans les registres capability / skill-pack et reconnaitre les chemins UNC meme sous un fallback POSIX.
- Ajouter une couverture de tests unitaire et d'integration avant regression complete.

### Debug Log

- 2026-04-20: Readiness ciblee executee, story clarifiee avant implementation (fichiers cibles reellement impactes, AC1 aligne sur les espaces/points terminaux, normalisation mission/ticket explicitee).
- 2026-04-20: Phase RED ajoutee sur les identifiants Windows, les collisions de casse, la selection mission/ticket en casse mixte et le fallback UNC sous `path.isAbsolute` de type POSIX.
- 2026-04-20: Phase GREEN appliquee dans `workspace-layout.ts`, `extension-registration.ts`, `mission.ts`, `ticket-service-support.ts`, `select-mission-extensions.ts`, `resolve-approval-request.ts`, `file-capability-registry-repository.ts`, `file-skill-pack-registry-repository.ts` et `validate-extension-registration.ts`.
- 2026-04-20: Validation finale verte sur ciblage story puis regression complete `npm test` (`377/377`).

### Completion Notes

- `assertSafeStorageIdentifier` rejette maintenant les caracteres interdits Windows, les espaces/points terminaux et tous les noms reserves (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) avec un motif explicite par regle.
- Les refs capability / skill pack utilisent une cle canonique partagee (trim + NFC + casefold `en-US`) pour la mission, le ticket, la selection d'extensions et les comparaisons `Set.has()`, ce qui supprime les faux negatifs dependants de la casse.
- Les repositories capability / skill-pack resolvent leurs chemins de stockage via cette cle canonique et refusent explicitement les seconds enregistrements differant seulement par la casse (`collision de casse detectee`).
- `isAbsoluteReference` reconnait desormais les chemins UNC via regex fallback et `validateResolvedLocalRef` classe les UNC injoignables en `unc_unreachable` au lieu d'un faux `missing_local_ref`.
- Couverture ajoutee pour les identifiants Windows, les collisions de casse capability / skill-pack, le fallback UNC et le flux mission/ticket avec refs en casse mixte.

## File List

- _bmad-output/implementation/5-4-durcir-la-compatibilite-windows-identifiants-et-chemins.md
- _bmad-output/implementation/sprint-status.yaml
- _bmad-output/planning/implementation-readiness-report-2026-04-20.md
- packages/capability-registry/src/validation/validate-extension-registration.ts
- packages/contracts/src/extension/extension-registration.ts
- packages/contracts/src/mission/mission.ts
- packages/mission-kernel/src/approval-service/resolve-approval-request.ts
- packages/mission-kernel/src/mission-service/select-mission-extensions.ts
- packages/storage/src/fs-layout/workspace-layout.ts
- packages/storage/src/repositories/file-capability-registry-repository.ts
- packages/storage/src/repositories/file-skill-pack-registry-repository.ts
- packages/ticket-runtime/src/ticket-service/create-ticket.ts
- packages/ticket-runtime/src/ticket-service/ticket-service-support.ts
- packages/ticket-runtime/src/ticket-service/update-ticket.ts
- tests/integration/mission-extension-selection.test.ts
- tests/unit/capability-registry-registration.test.ts
- tests/unit/extension-registration-validation.test.ts
- tests/unit/skill-pack-registration.test.ts
- tests/unit/windows-compatibility-hardening.test.ts
- dist/packages/capability-registry/src/validation/validate-extension-registration.js
- dist/packages/contracts/src/extension/extension-registration.js
- dist/packages/contracts/src/mission/mission.js
- dist/packages/mission-kernel/src/approval-service/resolve-approval-request.js
- dist/packages/mission-kernel/src/mission-service/select-mission-extensions.js
- dist/packages/storage/src/fs-layout/workspace-layout.js
- dist/packages/storage/src/repositories/file-capability-registry-repository.js
- dist/packages/storage/src/repositories/file-skill-pack-registry-repository.js
- dist/packages/ticket-runtime/src/ticket-service/create-ticket.js
- dist/packages/ticket-runtime/src/ticket-service/ticket-service-support.js
- dist/packages/ticket-runtime/src/ticket-service/update-ticket.js
- dist/tests/integration/mission-extension-selection.test.js
- dist/tests/unit/capability-registry-registration.test.js
- dist/tests/unit/extension-registration-validation.test.js
- dist/tests/unit/skill-pack-registration.test.js
- dist/tests/unit/windows-compatibility-hardening.test.js

## Change Log

- 2026-04-20: Readiness BMAD ciblee executee pour la story 5.4, avec correction immediate des ecarts de specification non bloquants.
- 2026-04-20: Compatibilite Windows durcie pour les identifiants de stockage, la normalisation des refs d'extension et la reconnaissance des chemins UNC.
- 2026-04-20: Validation complete executee avec succes via `npm test` (`377/377`).
- 2026-04-23: Revue adversariale 3 couches; 5 patches HIGH/MEDIUM appliques (ENOTFOUND discrimination, controle ASCII, trim Unicode elargi, UNSAFE_STORAGE_ID_PATTERN resserre, tests unitaires UNC_UNREACHABLE_ERROR_CODES) + 2 LOW (indentation, JSDoc); 9 defers listes dans deferred-work.md; tests `380/380`.
