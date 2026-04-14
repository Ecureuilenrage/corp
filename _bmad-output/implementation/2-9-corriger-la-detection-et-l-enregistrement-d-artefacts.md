# Story 2.9: Corriger la detection et l'enregistrement d'artefacts

Status: review

## Story

As a operateur technique,
I want que tous les artefacts produits par un ticket soient detectes et enregistres de maniere fiable, y compris en cas d'echec d'adaptateur,
so that la trace d'audit reste complete et que les artefacts ne soient jamais perdus silencieusement.

## Acceptance Criteria

1. Given l'adaptateur echoue avec une exception pendant l'execution
   When le bloc catch persiste `execution.failed`
   Then les artefacts produits avant le crash (fichiers dans le workspace d'isolation) sont detectes et enregistres
   And les evenements `artifact.detected` et `artifact.registered` sont emis dans le journal avant que l'exception ne remonte

2. Given un workspace `git_worktree` contient uniquement des fichiers supprimes
   When la detection d'artefacts est lancee
   Then les suppressions sont reconnues comme des changements significatifs
   And un artefact de type `workspace_deletion` (ou equivalent) est cree pour chaque suppression

3. Given un adaptateur retourne un type d'output non reconnu (futur kind)
   When `detect-ticket-artifacts.ts` mappe les outputs vers des artefacts
   Then le mapping echoue explicitement ou logue un avertissement
   And le kind inconnu n'est pas silencieusement traite comme `diagnostic_pointer`

4. Given un lot de N artefacts doit etre enregistre
   When `registerArtifacts` est appele
   Then `mission.artifactIds` contient les N IDs avant que `artifact-index.json` ne soit reconstruit
   And `rewriteMissionReadModels` n'est appele qu'une seule fois pour le lot complet (pas 2xN fois)

5. Given un fichier de payload est volumineux (> 16000 bytes pour structured_output)
   When l'artefact est cree sans payload inline
   Then `sizeBytes` est quand meme renseigne dans la metadata de l'artefact
   And `readPayloadPreview` lit le fichier de maniere bornee (pas de chargement integral en memoire)

## Context

Cette story corrige les problemes de detection et d'enregistrement d'artefacts identifies dans la code review des Stories 2-3 et 2-5. Le probleme le plus grave est la perte silencieuse d'artefacts en cas d'echec d'adaptateur.

### Findings adresses

- **C12** (critical/bug): `detect-ticket-artifacts.ts:127`, `run-ticket.ts:297-348` - le chemin `catch` emet `execution.failed` puis leve l'exception; `detectTicketArtifacts` n'est jamais atteint; artefacts perdus silencieusement
- **H7** (high/bug): `workspace-artifact-detector.ts:28-34` - les suppressions de fichiers dans un workspace `git_worktree` ne generent jamais d'artefact (`D` filtre ligne 63, fallback copie ne detecte pas les suppressions)
- **H8** (high/bug): `detect-ticket-artifacts.ts:100-108` - union `ExecutionAdapterOutput` non exhaustive; tout futur kind est silencieusement traite comme `diagnostic_pointer`
- **H** (high/missing-test): aucun test pour `execution.failed` foreground avec outputs; aucun test unitaire pour `workspace-artifact-detector.ts` ni `register-artifacts.ts`
- **C** (critical/bug): `register-artifacts.ts:116-152` - double `rewriteMissionReadModels` par artefact; l'artefact est filtre hors de `artifact-index` a l'etape `detected` car `mission.artifactIds` ne contient pas encore l'ID
- **M** (medium/edge-case): `detect-ticket-artifacts.ts:75-97` - structured_output > 16000 bytes: ni `payload` ni `sizeBytes` dans l'artefact
- **M** (medium/edge-case): `workspace-artifact-detector.ts:169-178` - fichiers de taille 0 detectes comme artefacts
- **L** (low/edge-case): `workspace-artifact-detector.ts:57-60` - chemins avec espaces dans un repo git: guillemets inclus dans le path parse
- **L** (low/edge-case): `read-mission-artifacts.ts:204-222` - `readPayloadPreview` charge le fichier entier en memoire avant troncature
- **M** (medium/spec-deviation): `register-artifacts.ts:99-100` - champs `sourceEventType`/`sourceEventOccurredAt` dupliques dans le snapshot Artifact
- **I** (info): `detect-ticket-artifacts.ts:9` - import direct depuis `codex-responses-adapter` pour `ExecutionAdapterOutput`; couplage entre `ticket-runtime` et l'adaptateur specifique

## Tasks / Subtasks

- [x] Detecter les artefacts avant de propager l'exception dans le catch de run-ticket (AC: 1)
  - [x] Dans le bloc `catch` de `run-ticket.ts` (echec adaptateur), apres avoir persiste `execution.failed` et avant de lever l'exception, tenter `detectTicketArtifacts` + `registerArtifacts` si un `workspaceIsolation` existe.
  - [x] Envelopper cette detection dans un try/catch interne: si la detection echoue aussi, ne pas masquer l'erreur originale; logger un avertissement et continuer la propagation.
  - [x] Passer `adapterResult: null` puisqu'il n'y a pas de resultat adaptateur; la detection doit se baser uniquement sur les changements du workspace d'isolation.

- [x] Corriger la detection des suppressions dans `git_worktree` (AC: 2)
  - [x] Dans `workspace-artifact-detector.ts`, `detectGitWorkspaceArtifacts`: ne plus filtrer les lignes de statut commencant par `D` (ligne 63).
  - [x] Pour les fichiers supprimes, creer un artefact avec `kind: "workspace_change"`, `changeType: "deleted"` (ou un champ metadata equivalent) et `sizeBytes: 0`.
  - [x] Le `sha256` d'un fichier supprime peut etre `null` ou le hash du contenu avant suppression (si disponible via `git show HEAD:<path>`); preferer `null` pour eviter un I/O supplementaire.
  - [x] Mettre a jour `shouldTrackRelativePath` pour ne pas rejeter les fichiers supprimes (leur path est valide meme si le fichier n'existe plus).

- [x] Rendre le mapping des outputs exhaustif et explicite (AC: 3)
  - [x] Deplacer le type `ExecutionAdapterOutput` de `codex-responses-adapter.ts` vers `packages/contracts/src/execution-attempt/execution-attempt.ts` (ou un fichier dedie dans contracts) pour decoupler `ticket-runtime` de l'adaptateur specifique.
  - [x] Dans `detect-ticket-artifacts.ts`, remplacer le `else` implicite par un switch exhaustif sur `output.kind`. Ajouter un cas `default` qui leve une erreur: `"Kind d'output adaptateur non reconnu: ${output.kind}"`.
  - [x] Mettre a jour les imports dans tous les consommateurs.

- [x] Corriger le batching de `registerArtifacts` (AC: 4)
  - [x] Refactorer `registerArtifacts` pour accumuler tous les artefacts (detected + registered) dans une seule passe:
    1. Pour chaque artefact: persister le snapshot, emettre `artifact.detected`, ajouter l'ID au ticket, emettre `artifact.registered`, ajouter l'ID a la mission.
    2. Persister le ticket et la mission une seule fois en fin de lot (avec tous les `artifactIds` accumules).
    3. Appeler `rewriteMissionReadModels` une seule fois en fin de lot.
  - [x] Verifier que `mission.artifactIds` contient tous les IDs **avant** l'appel a `rewriteMissionReadModels`, afin que `artifact-index-projection` puisse filtrer correctement.
  - [x] Garder l'emission des evenements individuels (`artifact.detected`, `artifact.registered`) pour chaque artefact dans le journal - seule la reecriture des projections est batchee.

- [x] Renseigner `sizeBytes` meme sans payload inline et borner `readPayloadPreview` (AC: 5)
  - [x] Dans `detect-ticket-artifacts.ts`, pour les `structured_output` depassant `MAX_STORED_JSON_LENGTH`: calculer et inclure `sizeBytes: Buffer.byteLength(serializedData, "utf8")` meme si `payload` est omis. Ajouter egalement `payloadTruncated: true` comme metadata.
  - [x] Dans `read-mission-artifacts.ts`, `readPayloadPreview`: remplacer `readFile(path, "utf8")` par une lecture bornee via `fs.open()` + `read(buffer, 0, MAX_PREVIEW_BYTES)` avec `MAX_PREVIEW_BYTES = 1024`. Fermer le handle proprement.

- [x] Corriger le parsing des chemins git avec espaces (AC: 2)
  - [x] Dans `workspace-artifact-detector.ts`, `detectGitWorkspaceArtifacts`: apres extraction de `rawPath`, supprimer les guillemets englobants (`"path"` -> `path`) si presents.
  - [x] Utiliser une regex ou `path.startsWith('"') && path.endsWith('"')` pour detecter et nettoyer les guillemets.

- [x] Filtrer les fichiers de taille 0 sauf si explicitement significatifs (AC: 2)
  - [x] Ajouter un guard dans la boucle de detection de `detectCopiedWorkspaceArtifacts` et `detectGitWorkspaceArtifacts`: ignorer les fichiers avec `sizeBytes === 0` sauf si leur statut git est `D` (deletion) ou `R` (rename).
  - [x] Documenter cette decision: les fichiers vides accidentels (ex: `touch file`) ne generent pas d'artefact.

- [x] Ajouter la couverture de tests (AC: 1, 2, 3, 4, 5)
  - [x] Test d'integration: injecter un adaptateur qui throw apres avoir cree des fichiers dans le workspace -> verifier que les artefacts sont detectes et enregistres malgre l'echec.
  - [x] Test d'integration: simuler un adaptateur retournant `status: "failed"` (non-exception) avec des outputs -> verifier que les artefacts sont crees.
  - [x] Test unitaire: `workspace-artifact-detector.ts` - workspace git avec fichiers supprimes uniquement -> au moins un artefact avec `changeType: "deleted"`.
  - [x] Test unitaire: `workspace-artifact-detector.ts` - fichiers avec espaces dans le chemin -> path correct sans guillemets.
  - [x] Test unitaire: `workspace-artifact-detector.ts` - fichier de taille 0 -> pas d'artefact genere.
  - [x] Test unitaire: `detect-ticket-artifacts.ts` - output avec un kind inconnu (ex: `"video"`) -> erreur explicite.
  - [x] Test d'integration: `registerArtifacts` avec 3 artefacts -> `rewriteMissionReadModels` appele une seule fois; `artifact-index.json` contient les 3 artefacts.
  - [x] Test unitaire: `readPayloadPreview` sur un fichier de 10MB -> pas d'OOM, lecture bornee a ~1KB.

## Dev Notes

### Architecture Compliance

- L'architecture 4.1 exige que tout artefact reference l'evenement producteur. La correction du catch path (AC1) doit garder cette liaison.
- L'architecture 4.3 distingue `detected` et `registered` comme etapes du cycle de vie d'un artefact. Le batching (AC4) doit preserver cette semantique evenementielle.
- Le deplacement de `ExecutionAdapterOutput` vers `contracts/` respecte la frontiere d'architecture 5.2 (adapter boundary).

### Implementation Guardrails

- Ne pas modifier le contrat canonique `Artifact` (pas de nouveau champ obligatoire).
- Ne pas casser la compatibilite des artefacts deja enregistres.
- Le catch interne pour la detection en cas d'echec (AC1) ne doit jamais masquer l'erreur originale de l'adaptateur.
- Les tests unitaires du detector doivent fonctionner sans vrai depot git; utiliser des fixtures fichier simples.
- La lecture bornee de `readPayloadPreview` doit gerer correctement l'encodage UTF-8 (pas de coupure au milieu d'un caractere multi-byte).

### Dependencies

- Story 2-7 (rewriteMissionReadModels): le batching dans `registerArtifacts` depend de la possibilite de controler quand les projections sont ecrites. Si 2-7 introduit `skipProjectionRewrite`, cette story peut l'utiliser.
- Story 2-8 (flow execution): la correction du catch path (AC1) modifie le meme bloc que la correction de la verification des tentatives actives (H5 dans 2-8). Coordonner les modifications.

### Recommended File Touch Points

- `packages/ticket-runtime/src/ticket-service/run-ticket.ts` - catch block
- `packages/workspace-isolation/src/workspace-artifact-detector.ts` - suppressions, espaces, taille 0
- `packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts.ts` - switch exhaustif, sizeBytes
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts` - batching
- `packages/contracts/src/execution-attempt/execution-attempt.ts` - type ExecutionAdapterOutput
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts` - readPayloadPreview borne
- `tests/integration/artifact-index.test.ts` - etendre
- `tests/unit/workspace-artifact-detector.test.ts` - nouveau
- `tests/unit/detect-ticket-artifacts.test.ts` - nouveau
- `tests/unit/read-mission-artifacts.test.ts` - nouveau

### Testing Requirements

- Conserver le style de tests actuel: `node:test`, `assert/strict`, `mkdtemp`.
- Les tests unitaires du detector doivent creer des repertoires temporaires avec des fichiers de test (pas de mock fs).
- Les tests d'integration doivent verifier l'etat du fichier `artifact-index.json` sur disque apres chaque operation.

### Scope Exclusions

- Hors scope: detection d'artefacts pendant le polling background (sera gere par le mecanisme de polling futur).
- Hors scope: promotion d'artefacts (`detected -> registered -> promoted`); le cas `promoted` est post-MVP.
- Hors scope: indexation de contenu des artefacts (recherche full-text, etc.).

### References

- Code review adversariale Epic 2 (2026-04-10) - Findings C12, H7, H8, et findings medium/low associes
- `C:/Dev/PRJET/corp/_bmad-output/planning/architecture.md` - 3.3 Artifact, 4.1 Domain Consistency Rules, 4.3 Artifacts lifecycle, 5.2 Adapter boundary
- `C:/Dev/PRJET/corp/_bmad-output/implementation/2-5-enregistrer-les-artefacts-decisions-et-evenements-produits-par-un-ticket.md`

## Dev Agent Record

### Agent Model Used

- GPT-5 Codex

### Implementation Plan

- Corriger le chemin `catch` de `run-ticket` pour detecter/enregistrer les artefacts du workspace avant de relancer l'erreur adapteur originale.
- Rendre la detection workspace robuste aux suppressions Git, aux chemins quotes et aux fichiers zero-byte non significatifs.
- Decoupler `ExecutionAdapterOutput` vers `contracts`, rendre le mapping exhaustif, et borner la lecture des previews payload.
- Batcher `registerArtifacts`, puis verrouiller le tout avec tests d'integration et tests unitaires centres sur les regressions de la story.

### Debug Log References

- 2026-04-10: chargement complet du skill `bmad-dev-story`, de la story 2.9, du `sprint-status.yaml` et de la config BMAD, puis passage de la story en `in-progress`.
- 2026-04-10: analyse des seams existants (`run-ticket`, `detect-ticket-artifacts`, `register-artifacts`, `workspace-artifact-detector`, `read-mission-artifacts`, `artifact-index-projection`) et des tests d'integration artefacts/run-ticket deja en place.
- 2026-04-10: ajout des tests rouges pour le throw adapteur avec artefacts, le status `failed` avec outputs, le batch de 3 artefacts, les suppressions Git, les chemins avec espaces, les fichiers zero-byte, le kind inconnu et la lecture preview bornee.
- 2026-04-10: implementation des corrections de code, puis validations executees via `npm run build`, `node --test "dist/tests/unit/*.test.js" "dist/tests/integration/run-ticket.test.js" "dist/tests/integration/artifact-index.test.js"` et `npm test`.

### Completion Notes List

- Le chemin `catch` de `run-ticket` persiste `execution.failed`, tente ensuite la detection/enregistrement d'artefacts du workspace d'isolation, puis relance l'erreur adapteur originale sans la masquer; un echec secondaire de detection n'interrompt pas cette propagation.
- `ExecutionAdapterOutput` vit maintenant dans `packages/contracts`, `detect-ticket-artifacts` utilise un switch exhaustif qui echoue explicitement sur un kind inconnu, et les `structured_output` volumineux conservent `sizeBytes` tout en signalant la troncature dans le resume sans casser le schema `Artifact`.
- `workspace-artifact-detector` traite les suppressions Git comme des artefacts significatifs via une metadata equivalente (`label: "deleted"`, `sizeBytes: 0`), nettoie les chemins quotes et ignore les fichiers zero-byte sauf statuts `D`/`R`.
- `registerArtifacts` batch maintenant la persistance `mission`/`ticket` et la reecriture des projections, et les nouveaux snapshots d'artefacts ne dupliquent plus `sourceEventType`/`sourceEventOccurredAt`; ces champs sont derives du journal dans `artifact-index-projection`.
- La couverture a ete etendue avec deux tests d'integration artefacts/run-ticket et trois nouveaux fichiers de tests unitaires pour les regressions detector/detect/read-preview.

### File List

- `packages/contracts/src/execution-attempt/execution-attempt.ts`
- `packages/execution-adapters/codex-responses/src/codex-responses-adapter.ts`
- `packages/journal/src/projections/artifact-index-projection.ts`
- `packages/mission-kernel/src/resume-service/read-mission-artifacts.ts`
- `packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts.ts`
- `packages/ticket-runtime/src/artifact-service/register-artifacts.ts`
- `packages/ticket-runtime/src/ticket-service/run-ticket.ts`
- `packages/workspace-isolation/src/workspace-artifact-detector.ts`
- `tests/integration/artifact-index.test.ts`
- `tests/integration/run-ticket.test.ts`
- `tests/unit/detect-ticket-artifacts.test.ts`
- `tests/unit/read-mission-artifacts.test.ts`
- `tests/unit/workspace-artifact-detector.test.ts`

## Change Log

- 2026-04-10: story 2.9 implementee, validations ciblees + `npm test` executees avec succes (105 tests verts), puis statut passe a `review`.
