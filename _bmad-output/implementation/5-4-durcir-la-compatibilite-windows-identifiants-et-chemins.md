# Story 5.4: Durcir la compatibilite Windows pour identifiants et chemins

Status: ready-for-dev

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

1. Given un identifiant de storage (mission, ticket, capability, skill-pack) contient un caractere interdit (`:`, `<`, `>`, `|`, `?`, `*`, `"`, `\0`) ou un nom reserve Windows (`CON`, `PRN`, `NUL`, `AUX`, `COM1-9`, `LPT1-9`, avec ou sans extension)
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

- [ ] Etendre `assertSafeStorageIdentifier` pour Windows (AC: 1)
  - [ ] Ajouter la liste des caracteres interdits (`:`, `<`, `>`, `|`, `?`, `*`, `"`, `\0`) et de l'espace/ponctuation terminale.
  - [ ] Ajouter la liste des noms reserves (case-insensitive) avec et sans extension : `CON`, `PRN`, `NUL`, `AUX`, `COM1`-`COM9`, `LPT1`-`LPT9`.
  - [ ] Messages d'erreur distincts et documentes par regle violee.
  - [ ] Tests unitaires: chaque caractere interdit, chaque nom reserve (avec et sans extension), casse mixte.

- [ ] Normaliser la casse pour les refs d'extension (AC: 2, 3)
  - [ ] Documenter le contrat de normalisation dans `packages/contracts/` (ex. casefold NFC).
  - [ ] Appliquer la normalisation dans `normalizeOpaqueReferences` (factoree en Story 5.3).
  - [ ] Detection de collision de casse lors d'un second register: si `pack.triage` existe deja et que l'operateur tente `Pack.Triage`, l'erreur est explicite.
  - [ ] `ensureTicketExtensionsAllowedByMission` utilise la meme normalisation avant `Set.has()`.

- [ ] Reconnaitre les chemins UNC sur POSIX (AC: 4)
  - [ ] Etendre la regex fallback dans `isAbsoluteReference` pour matcher `^\\\\\\\\[^\\\\]+\\\\[^\\\\]+` (chemin UNC).
  - [ ] Clarifier le comportement de `validateResolvedLocalRef` en cas de chemin UNC: tenter `statSync`, et si erreur specifique (ex. `ENOTFOUND`), produire un diagnostic `unc_unreachable` distinct de `missing_local_ref`.
  - [ ] Test: chemin UNC sur runtime POSIX -> `isAbsoluteReference` retourne true.

- [ ] Ajouter les tests cross-OS (AC: 5)
  - [ ] Marquer certains tests comme `@windows-only` ou les conditionner avec `process.platform`.
  - [ ] Pour les regles AC1/AC2, utiliser des tests unitaires independants de l'OS.
  - [ ] Documenter en commentaire de test les differences de comportement attendues entre Windows et POSIX.

## Dev Notes

### Story Intent

Aucun changement de contrat Mission/Ticket. Changements contenus dans `workspace-layout.ts`, `validate-extension.ts`, `normalizeOpaqueReferences` et leurs tests. Les regles Windows doivent etre appliquees meme sur runtime POSIX pour garantir la portabilite.

### Items deferred-work.md absorbes

D-22, D-37, D-45, D-46, D-52.

### NFR cible

NFR18 (Portabilite Windows): 100% des identifiants non portables sur Windows doivent etre rejetes avant ecriture disque, et 100% des collisions de casse sur les refs d'extension doivent etre detectees de maniere deterministe dans les tests cross-OS ou equivalents.

### Testing Requirements

- Tests unitaires exhaustifs sur `assertSafeStorageIdentifier` (chaque caractere interdit, chaque nom reserve).
- Tests unitaires sur la normalisation de casse (collision detectee, refs normalises coherents).
- Test d'integration UNC sur runtime POSIX.
- Si possible, pipeline CI Windows en complement.
