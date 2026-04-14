# Story 5.6: Borner la confidentialite et la securite du brief adaptateur

Status: ready-for-dev

## Story

As a mainteneur de `corp`,
I want qu'aucun chemin absolu local, aucun identifiant vendor brut et aucune metadonnee non echappee ne fuite dans un brief envoye a un adaptateur externe,
so that les artefacts envoyes a l'API externe restent defendables et que la surface d'attaque via metadonnees adversariales soit fermee.

## Context

Les code reviews Epic 3 et Epic 4 signalent plusieurs points de fuite ou de corruption potentielle du brief LLM envoye a l'adaptateur externe:

- `formatSkillPackSummary` inclut `rootDir`, `references[]`, `metadataFile` et `scripts[]` en chemins absolus dans le brief envoye a l'API OpenAI (D-42). Fuite de structure locale du filesystem.
- `displayName`, `description` et chemins `localRefs` sont concatenes sans echappement dans le brief (D-41). Un skill pack avec `displayName` contenant `\n` ou `|` peut corrompre le format.
- `toPublicSource` masque uniquement les noms contenant "openai" ou "codex" (D-13). Un futur adaptateur vendor (ex. `anthropic_api`, `azure_openai_proxy`) passerait en clair.
- `assertSkillPackLocalBoundary` utilise `path.resolve()` qui ne resout pas les symlinks (D-40). Un lien symbolique peut pointer hors du `rootDir` sans etre detecte.

## Acceptance Criteria

1. Given un `ExecutionAdapter` construit un brief destine a une API externe
   When ce brief est assemble via `formatSkillPackSummary` ou equivalent capability/mission
   Then aucun chemin absolu local (`rootDir`, `references[]`, `metadataFile`, `scripts[]`, `workspacePath`) n'est concatene en clair
   And les chemins sont exprimes en reference relative au `rootDir` de la mission ou remplaces par un placeholder non-revelateur

2. Given un skill pack, une capability ou une mission porte `displayName`, `description` ou un chemin contenant `\n`, `\r`, `|`, ou tout caractere de formatage du brief
   When le brief est assemble
   Then la valeur est echappee ou encodee (ex. JSON-stringify + guillemets) avant concatenation
   And le format du brief ne peut pas etre corrompu par une metadonnee adversariale

3. Given un adaptateur vendor porte un nom contenant `anthropic_api`, `azure_openai_proxy`, ou un futur identifiant vendor
   When `toPublicSource` est invoquee
   Then la normalisation suit une **allowlist explicite** des sources publiques documentees
   And toute source non-allowlistee est remplacee par `execution-adapter`
   And aucun identifiant vendor brut ne fuite dans la CLI ou les projections

4. Given `assertSkillPackLocalBoundary` compare un `rootDir` et une cible potentiellement symlinkee
   When la verification est effectuee
   Then `fs.realpath` est utilisee avant comparaison pour resoudre les symlinks
   And un lien symbolique sortant du `rootDir` est detecte et rejete avec un message deterministe

5. Given les changements sont appliques
   When un test adversarial fournit un `displayName = "pack\\n|malicious"`, un `rootDir` contenant un symlink sortant, ou un adaptateur `foo_openai_proxy`
   Then aucune de ces entrees ne produit une fuite dans le brief ou dans les projections

## Tasks / Subtasks

- [ ] Convertir les chemins absolus en chemins relatifs dans le brief (AC: 1)
  - [ ] Auditer `formatSkillPackSummary`, `formatCapabilityBrief`, `formatMissionBrief` et toute fonction envoyant du contenu vers l'adaptateur.
  - [ ] Remplacer `rootDir`, `references[]`, `metadataFile`, `scripts[]`, `workspacePath` absolus par leur variante relative au `rootDir` de la mission (ex. `./packs/pack-id/metadata.json`).
  - [ ] Si un chemin ne peut pas etre exprime en relatif (cas hors rootDir), utiliser un placeholder `<local-path>` et documenter ce choix.
  - [ ] Test: brief contient `./` ou `<local-path>` plutot que `C:\\Users\\...` ou `/home/...`.

- [ ] Echapper les metadonnees adversariales dans le brief (AC: 2)
  - [ ] Choisir un format d'echappement (JSON-stringify des champs textuels, ou encodage escape de `\n`, `\r`, `|`, `"`).
  - [ ] Appliquer l'echappement a `displayName`, `description`, chemins relatifs, titres de mission, goals de ticket.
  - [ ] Test: un skill pack avec `displayName = "pack\\n|malicious"` -> le brief contient `"pack\\\\n|malicious"` ou equivalent, le format n'est pas corrompu.

- [ ] Convertir `toPublicSource` en allowlist explicite (AC: 3)
  - [ ] Definir `PUBLIC_SOURCE_ALLOWLIST` comme constante dans `packages/contracts/` ou dans la couche projection.
  - [ ] La fonction retourne la valeur d'entree seulement si elle figure dans l'allowlist; sinon `"execution-adapter"`.
  - [ ] Documenter la liste initiale (ex. `operator`, `planner`, `execution-adapter`, `skill-pack`, `capability`).
  - [ ] Test: `"anthropic_api"` -> `"execution-adapter"`, `"foo_openai_proxy"` -> `"execution-adapter"`, `"operator"` -> `"operator"`.

- [ ] Utiliser `fs.realpath` dans `assertSkillPackLocalBoundary` (AC: 4)
  - [ ] Resoudre le `rootDir` et la cible via `fs.realpath` avant comparaison `startsWith`.
  - [ ] Traiter `ENOENT` / symlinks cycliques comme erreurs specifiques (cf. D-24 - partiellement Story 5.7).
  - [ ] Test: symlink sortant detecte; symlink interne accepte.

- [ ] Ajouter les tests adversariaux (AC: 5)
  - [ ] Test `displayName` avec caracteres de formatage -> brief non corrompu.
  - [ ] Test symlink sortant -> erreur deterministe.
  - [ ] Test adaptateur non-allowlist -> replacement par `execution-adapter`.
  - [ ] Test `rootDir` absolu dans le brief -> absent de la sortie.

## Dev Notes

### Story Intent

Focus confidentialite et integrite du brief envoye a un adaptateur externe. Aucun changement de contrat CLI ni de schema persistant. Les changements sont contenus dans la couche de formatage (`format*Summary`), dans `toPublicSource`, et dans `assertSkillPackLocalBoundary`.

### Items deferred-work.md absorbes

D-13, D-40, D-41, D-42.

### NFR cible

NFR20 (Confidentialite des briefs externes): 0 chemin absolu local et 0 identifiant vendor brut non allowliste ne doivent apparaitre dans les briefs envoyes a un adaptateur externe ou dans les projections publiques de test; 100% des metadonnees d'extension injectees dans ces briefs doivent etre echappees ou encodees de facon sure.

### Testing Requirements

- Test adversarial sur chaque vecteur (path, metadata injection, vendor source, symlink).
- Assertions de non-fuite etendues au brief complet assemble (pas seulement au journal `events.jsonl`).
- Baseline 246 tests verts preservee; assertions de non-fuite vendor renforcees.
