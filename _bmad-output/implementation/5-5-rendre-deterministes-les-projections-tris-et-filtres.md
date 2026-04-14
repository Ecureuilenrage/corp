# Story 5.5: Rendre deterministes les projections, tris et filtres de lecture

Status: ready-for-dev

## Story

As a operateur technique,
I want que les tris, filtres et bornes de lecture produisent le meme resultat quelle que soit la locale ou l'entree,
so that l'audit et les projections restent verifiables et qu'aucune dependance cachee a l'environnement runtime ne fasse varier la sortie.

## Context

Les code reviews Epic 3 et Epic 4 signalent plusieurs dependances cachees et edge cases dans les projections et les filtres de lecture:

- `localeCompare` locale-sensitive sur tris ISO-8601 (D-28): peut inverser l'ordre sous une locale non-standard.
- `filterMissionEntities` inclut les entites sans `missionId` (D-04): risque qu'une entite orpheline apparaisse dans le resume de toutes les missions.
- `--ticket-id T1` filtre exclut les evenements mission-level (D-14): AC2 de 3.4 demande une vue mission-centrique meme filtree.
- `--root "   "` whitespace-only passe la validation (D-09), `limit <= 0` passe le guard (D-32), `rootDir` undefined retombe sur CWD (D-33).
- `readSourceReferences` court-circuite sur le 1er objet imbrique contenant `approvalId` ou `decisionRef`, perdant les references reparties (D-12).
- `resolveEventKind` produit titre vide pour types edge-case (D-39).
- `resume-view` mis a jour indirectement par `readMissionResume` alors que `mission-status` est ecrit explicitement (D-02): asymetrie fragile.

## Acceptance Criteria

1. Given un tri chronologique est applique a des evenements datables en ISO-8601 dans `audit-log-projection.ts`, `read-mission-audit.ts` ou toute autre projection
   When le code s'execute sous une locale non-standard (ex. `tr-TR`, `de-DE-u-kf-upper`)
   Then la comparaison utilise `<`/`>` lexicographique direct ou `localeCompare(... , "en")` explicite
   And le resultat d'ordre est strictement identique quelle que soit la locale par defaut du runtime

2. Given une commande d'audit est appelee avec `--ticket-id T1`
   When la projection est filtree
   Then les evenements mission-level (`mission.created`, `mission.paused`, `mission.closed`, etc.) sont inclus comme contexte
   And la semantique "mission-centrique + filtree par ticket" est documentee dans l'aide CLI (`--help` de `mission audit`)

3. Given un appel CLI recoit une valeur invalide pour `limit` (≤ 0 ou non-entier), pour `--root` (whitespace-only, chaine vide) ou pour `rootDir` (`undefined`)
   When le parser CLI est execute
   Then la valeur est rejetee avant tout acces filesystem avec un message deterministe
   And `path.resolve(undefined)` ne retombe plus silencieusement sur `process.cwd()`

4. Given un payload audit contient plusieurs objets imbriques avec `approvalId` et `decisionRef` repartis (ex. `artifact.approvalId` et `artifact.decision.decisionRef`)
   When `readSourceReferences` scanne le payload
   Then toutes les references sont collectees et aucune n'est perdue par court-circuit sur le premier objet
   And un test couvre explicitement le cas payload multi-refs

5. Given `filterMissionEntities` est appele avec un `missionId` donne
   When la collection contient des entites sans champ `missionId`
   Then ces entites sont exclues du resultat
   And un test de regression couvre ce cas pour la preparation de l'introduction de nouveaux tickets

6. Given `resolveEventKind` recoit un type vide ou commencant par `.`
   When la fonction est invoquee
   Then un `title` non vide deterministe est produit (ex. `"Event inconnu"` ou le type brut) plutot qu'une chaine vide
   And le test couvre ce cas edge

7. Given `updateMissionLifecycle` ou un service equivalent modifie l'etat mission
   When les read-models sont rafraichis
   Then `resume-view.json` est ecrit par la meme voie explicite que `mission-status.json` (plus d'asymetrie indirecte via `readMissionResume`)
   And un test verifie que l'ecriture directe reste synchronisee avec la reconstruction

## Tasks / Subtasks

- [ ] Remplacer `localeCompare` par comparaison lexicographique ou locale forcee (AC: 1)
  - [ ] Auditer tous les usages de `localeCompare` dans `packages/journal/` et `packages/mission-kernel/`.
  - [ ] Remplacer par `a < b ? -1 : a > b ? 1 : 0` pour les ISO-8601.
  - [ ] Si un tri textuel est intentionnel (rare), utiliser `localeCompare(b, "en")` et documenter.
  - [ ] Test: executer le tri sous `process.env.LANG = "tr_TR.UTF-8"` simule -> ordre inchange.

- [ ] Inclure les evenements mission-level quand filtre par ticket (AC: 2)
  - [ ] Dans `read-mission-audit.ts`, modifier le filtre `--ticket-id` pour accepter les entries `entry.ticketId === options.ticketId || entry.ticketId === undefined`.
  - [ ] Documenter le contrat dans l'aide CLI de `mission audit`.
  - [ ] Test: projection filtree avec `--ticket-id T1` contient `mission.created`, `mission.paused` et `ticket.*` pour T1.

- [ ] Valider strictement les entrees CLI (AC: 3)
  - [ ] `resolveRootDir` trim la valeur et rejette whitespace-only, chaine vide, `undefined`.
  - [ ] `limit` rejete si non-entier ou ≤ 0.
  - [ ] `resolveWorkspaceLayout` rejette `rootDir: undefined` avec message explicite.
  - [ ] Tests: chaque entree invalide -> erreur CLI deterministe avant filesystem.

- [ ] Collecter toutes les refs imbriquees dans `readSourceReferences` (AC: 4)
  - [ ] Reecrire l'algorithme pour parcourir recursivement sans court-circuit.
  - [ ] Conserver l'ordre de decouverte pour la lisibilite.
  - [ ] Test: payload avec `artifact.approvalId = "A1"` ET `artifact.decision.decisionRef = "D1"` -> les deux sont collectees.

- [ ] Exclure les entites sans `missionId` dans `filterMissionEntities` (AC: 5)
  - [ ] Modifier le filtre pour rejeter explicitement `entity.missionId === undefined`.
  - [ ] Test: collection mixte -> seuls les elements avec `missionId === filter` sont retenus.

- [ ] Produire un title deterministe dans `resolveEventKind` (AC: 6)
  - [ ] Fallback sur `event.type || "event"` et `title` construit a partir du type brut plutot que vide.
  - [ ] Test: type `""`, `"."`, `".foo"` -> titre non vide.

- [ ] Symetriser l'ecriture de `resume-view.json` (AC: 7)
  - [ ] Dans `updateMissionLifecycle`, ecrire explicitement `resume-view.json` par la meme voie que `mission-status.json`.
  - [ ] `readMissionResume` peut toujours reconstruire si le fichier est absent, mais ne doit plus etre la voie d'ecriture primaire.
  - [ ] Test: apres `mission pause`, `resume-view.json` contient l'etat attendu sans avoir lance `mission status` entre-temps.

## Dev Notes

### Story Intent

Aucun changement de contrat ni de CLI en dehors de la semantique explicite de `--ticket-id` et des validations strictes. Les corrections visent a enlever les dependances a la locale, les bornes manquantes et les asymetries silencieuses qui rendent le diagnostic difficile.

### Items deferred-work.md absorbes

D-02, D-04, D-09, D-12, D-14, D-28, D-32, D-33, D-39.

### NFR cible

NFR19 (Determinisme des lectures): sous les locales supportees et avec des entrees invalides, 100% des projections et commandes de lecture ciblees par Epic 5 doivent conserver le meme ordre, le meme filtrage documente et le meme rejet des bornes invalides avant acces au journal.

### Testing Requirements

- Test de tri sous locale simulee non-standard.
- Test `--ticket-id` avec events mission-level.
- Tests CLI: `--root "   "`, `--limit 0`, `--limit -1`, `rootDir: undefined`.
- Test payload multi-refs dans `readSourceReferences`.
- Test `filterMissionEntities` mixte.
- Test `resolveEventKind` edge cases.
- Test symmetry `resume-view.json` / `mission-status.json`.
