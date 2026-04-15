# Journal as Source of Truth (JSoT)

> Invariant architectural consolide le 2026-04-15 a l'issue de la review adversariale triplee de la Story 5.1 (Blind Hunter + Edge Case Hunter + Acceptance Auditor).
> Decisions referencees : D1, D2, D4 (voir `_bmad-output/implementation/5-1-1-durcir-atomicite-findings-review-5-1-critiques.md`).

## Enonce de l'invariant

Dans le workspace `.corp/`, **le journal d'evenements `events.jsonl` est l'unique source de verite** sur l'etat intentionnel de chaque mission. Les snapshots persistes (`mission.json`, `ticket.json`, `attempt.json`, `approval.json`, projections `projections/*.json`) sont des **vues de lecture best-effort** : ils accelerent les lectures mais ne sont jamais requis pour la correction.

Corollaire : toute commande de lecture mission-centrique (`mission resume`, `mission approval queue`, `ticket board`, `artifact index`, `mission audit`) **DOIT** pouvoir reconstruire l'etat complet a partir du seul journal, meme si les snapshots sont absents, incoherents ou obsoletes.

## Motivation

Les sequences `appendEvent -> repository.save -> rewriteMissionReadModels` executees par les services de mutation (`create-mission`, `update-mission-lifecycle`, `select-mission-extensions`, `resolve-approval-request`, `run-ticket`) ne sont **pas atomiques** a travers le filesystem. Un crash, un `ENOSPC`/`EPERM` sur `writeJsonAtomic`, ou une defaillance d'adaptateur peut survenir entre l'append au journal et la persistance des snapshots.

Plutot que d'introduire un two-phase commit filesystem (cout V1 prohibitif) ou un rollback transactionnel (non garanti sous SIGKILL/OOM), la V1 accepte que les snapshots puissent diverger temporairement du journal. Le contrat est alors :

- **Ecriture** : l'append au journal est la decision d'autorite. Tout ce qui vient apres (saves de snapshots, projections) est une optimisation de lecture. Une defaillance post-append ne necessite pas de rollback du journal.
- **Lecture** : chaque reader detecte la divergence (comparaison `resumeCursor` vs `lastEventId`, hash de projection, absence de snapshot) et reconstruit depuis `reconstructMissionFromJournal` quand necessaire.

## Regles contraignantes

1. **Ordre event-before-state**. Dans chaque service de mutation, `appendEvent` precede strictement toute operation `repository.save` ou `rewriteMissionReadModels`. L'inverse est un bug.

2. **Snapshot embarque dans l'event.payload**. Chaque event doit inclure le snapshot complet de la mission (et des entites reliees : ticket, attempt, approval) dans `payload` au moment de son emission. C'est ce snapshot qui est utilise par `reconstructMissionFromJournal` pour hydrater l'etat.

3. **Fallback obligatoire dans les readers**. Les 4 readers critiques (`readMissionResume`, `readApprovalQueue`, `readMissionArtifacts`, `readTicketBoard`) implementent une detection de divergence et un chemin de reconstruction via `reconstructMissionFromJournal` (ou `readMissionFromJournal` qui le wrappe). Tout nouveau reader mission-centrique doit suivre le meme contrat.

4. **Pas d'assertion de presence de snapshot**. Les readers ne doivent jamais faire l'hypothese `mission.json existe` ; la reconstruction doit etre une route normale, pas une gestion d'erreur exceptionnelle.

5. **Saves sous verrou quand possible**. Quand un service utilise `saveIfUnchanged` (lock optimiste), toute operation de projection qui observe le snapshot **doit** etre executee dans la callback `beforeSave` (sous lock) pour eviter qu'un writer concurrent ne mute la mission entre la release du lock et le rewrite (voir Story 5.1.1 AC2).

## Services et points de divergence connus

| Service | Sequence critique | Commentaire d'intention attendu |
|---------|------------------|----------------------------------|
| `createMission` | `appendEvent -> repository.save -> rewriteMissionReadModels` | JSoT : mission reconstructible via `payload.mission` de `mission.created` |
| `updateMissionLifecycle` | `appendEvent -> repository.save -> rewriteMissionReadModels` | JSoT : derniere mission reconstructible depuis les events lifecycle |
| `selectMissionExtensions` | `saveIfUnchanged({ beforeSave: appendEvent + rewrite })` | JSoT + lock : rewrite execute sous lock pour eviter fenetre intermediaire |
| `persistApprovalTransition` (4 saves sequentiels) | `appendEvent -> mission.save -> ticket.save -> attempt.save -> rewrite` | JSoT : chaque save est une optim de lecture ; reader reconstruit si divergence |
| `persistRunTransition` | `appendEvent -> ticket.save -> mission.save -> attempt.save -> rewrite?` | JSoT : idem. `skipProjectionRewrite` a ete retire du catch adaptateur (Story 5.1.1 AC7) |

## Cas limite documentes

- **Echec `writeJsonAtomic` apres appendEvent (ENOSPC, EPERM, EACCES)** : le journal conserve la decision. Le prochain reader detecte la divergence (resumeCursor absent ou different dans `mission.json`) et reconstruit. Voir tests `tests/integration/read-model-rewrite-idempotency.test.ts` (`mission.created`, `update-mission-lifecycle`, `run-ticket`, `resolve-approval-request`).
- **Crash SIGKILL/OOM entre `appendEvent` et `repository.save`** : identique au precedent. Le lock peut rester stale (voir D-64 dans `deferred-work.md`) ; en V1 mono-operateur c'est accepte.
- **Echec adaptateur dans `run-ticket` apres emission `artifact.registered`** : les projections sont recalculees dans le catch via `rewriteMissionReadModels` (plus de `skipProjectionRewrite: true`) pour garantir que `audit-log.json` et `resume-view.json` refletent `execution.failed` + `artifact.registered`.

## Tests garde-fous

| Test | Fichier | Role |
|------|---------|------|
| `mission resume reconstruit une mission creee si le crash survient apres appendEvent avant save` | `tests/integration/read-model-rewrite-idempotency.test.ts` | Valide reconstruction JSoT pour `create-mission` |
| `mission resume reconstruit une mission pausee si le crash survient apres appendEvent avant save` | idem | Valide JSoT pour `update-mission-lifecycle` |
| `ticket board reconstruit un ticket en cours si le crash survient apres appendEvent avant save` | idem | Valide JSoT pour `run-ticket` |
| `approval queue reconstruit la transition si le crash survient apres appendEvent avant save` | idem | Valide JSoT pour `resolve-approval-request` |
| `two-concurrent-extension-select-produces-no-intermediate-projection` | idem | Valide AC2 (rewrite sous lock) |
| `writeJsonAtomic fallback UUID + cleanup tmp` | `tests/unit/write-json-atomic.test.ts` | Valide AC3 (pas d'orphelin tmp) |
| `areMissionSnapshotsEqual egalite via forme canonique` | `tests/unit/mission-snapshot-equality.test.ts` | Valide AC4 |
| `appendEvent serialise 10 appends concurrents sans tronquer` | `tests/unit/append-event-concurrency.test.ts` | Valide AC5 (D-35) |

Toute evolution future qui introduit un nouveau service de mutation, un nouveau reader, ou un nouveau format de snapshot **doit referencer ce document** et maintenir les regles ci-dessus.
