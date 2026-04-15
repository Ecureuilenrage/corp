# Politique BMAD - Cloture d'epic

## Objet

Cette politique mecanise la cloture d'un epic BMAD dans `corp`.
Un epic ne peut passer a `done` dans `_bmad-output/implementation/sprint-status.yaml` que si les artefacts suivants sont synchronises:

- l'entree `epic-N` du tracker,
- toutes les stories `N-*` rattachees a cet epic,
- l'entree `epic-N-retrospective`.

## Cartographie actuelle des transitions protegees

- `epic-1` -> `1-1-initialiser-la-cli-v1-et-le-stockage-local-de-mission`, `1-2-creer-une-mission-persistante-avec-objectif-et-criteres-de-succes`, `1-3-consulter-l-etat-courant-et-le-resume-de-reprise-d-une-mission`, `1-4-mettre-en-pause-relancer-ou-cloturer-une-mission-sans-perdre-l-historique` -> `epic-1-retrospective`
- `epic-2` -> `2-1-creer-un-ticket-delegable-avec-owner-dependances-et-contraintes-explicites`, `2-2-reprioriser-modifier-et-annuler-un-ticket-en-cours-de-mission`, `2-3-lancer-une-tentative-d-execution-isolee-via-l-adaptateur-prioritaire`, `2-4-suivre-l-avancement-et-les-blocages-d-un-ticket-depuis-la-mission`, `2-5-enregistrer-les-artefacts-decisions-et-evenements-produits-par-un-ticket`, `2-6-corriger-les-guards-de-statuts-terminaux-et-le-filtre-des-tickets-ouverts`, `2-7-fiabiliser-le-mecanisme-central-de-projection-rewritemissionreadmodels`, `2-8-corriger-le-flow-d-execution-ticket-transitions-adaptateur-et-atomicite`, `2-9-corriger-la-detection-et-l-enregistrement-d-artefacts`, `2-10-combler-les-gaps-de-tests-et-corriger-les-bugs-edge-case-restants`, `2-11-corriger-bugs-tests-et-ecarts-epic-2` -> `epic-2-retrospective`
- `epic-3` -> `3-1-ouvrir-une-file-d-approbation-pour-les-actions-sensibles`, `3-2-approuver-refuser-ou-differer-une-demande-avec-garde-fous-auditablement`, `3-3-reprendre-une-mission-interrompue-a-partir-d-un-resume-fiable`, `3-4-consulter-un-journal-d-audit-structure-et-l-origine-de-chaque-sortie`, `3-5-comparer-l-etat-courant-aux-criteres-de-succes-et-relancer-uniquement-la-partie-impactee` -> `epic-3-retrospective`
- `epic-4` -> `4-1-publier-le-contrat-de-registration-des-extensions-v1`, `4-2-enregistrer-une-capability-locale-avec-permissions-et-contraintes-explicites`, `4-5-corriger-findings-review-registre-capability`, `4-3-charger-un-skill-pack-local-dans-le-cadre-d-une-mission`, `4-4-selectionner-les-extensions-autorisees-par-mission-et-tracer-leur-usage-en-cli` -> `epic-4-retrospective`
- `epic-5` -> `5-0-mecaniser-la-gouvernance-de-cloture-d-epic-bmad`, `5-1-rendre-atomiques-les-ecritures-journal-projections-registres`, `5-2-durcir-la-lecture-defensive-et-la-validation-de-schema`, `5-3-factoriser-type-guards-et-helpers-workspace-partages`, `5-4-durcir-la-compatibilite-windows-identifiants-et-chemins`, `5-5-rendre-deterministes-les-projections-tris-et-filtres`, `5-6-borner-la-confidentialite-et-la-securite-du-brief-adaptateur`, `5-7-stabiliser-la-gouvernance-des-registres-test-seams-et-restants` -> `epic-5-retrospective`

## Contrat de cloture

Le gate de cloture d'epic applique les regles suivantes:

1. Une entree `epic-N: done` implique que toutes les stories `N-*` du tracker sont `done`.
2. Une entree `epic-N: done` implique que chaque story file `_bmad-output/implementation/N-*.md` declare `Status: done`.
3. Une story file en `Status: review`, `ready-for-dev` ou `in-progress` interdit `epic-N: done`, meme si le tracker indique deja `done` pour cette story.
4. Une entree `epic-N: done` implique `epic-N-retrospective: done`.
5. Le controle est deterministe, en francais, et retourne un code de sortie non nul au premier commit ou script qui tente de fermer un epic avec des artefacts desynchronises.
6. Le gate inspecte tous les epics deja en statut `done`; il remonte donc aussi les desynchronisations historiques encore presentes dans le repository.
7. Le gate inspecte aussi tout epic `in-progress` dont toutes les stories `N-*` sont deja `done` dans le tracker: si un story file ou la retrospective n'est pas `done`, il echoue avant l'ecriture fautive avec le message distinct `epic pret a clore mais desynchronise`.
8. Le parser `development_status` retire les commentaires inline, unwrappe les scalaires quotes, dedoublonne les cles en mode "last wins" avec warning explicite, et rejette toute indentation differente de 2 espaces.

## Regle retrospective

La valeur initiale d'une entree `epic-N-retrospective` est `required`.
La seule transition autorisee apres la tenue effective de la retrospective est `required -> done`.
La valeur `optional` n'est plus admise pour un epic clos ni comme valeur par defaut pour un nouvel epic.

## Utilisation

Commande locale de verification:

```bash
npm run check:epic-closure
```

Commande sur un autre root de travail:

```bash
npm run check:epic-closure -- --root C:/Dev/PRJET/corp
```

Commande directe sur le build deja compile:

```bash
node dist/scripts/check-epic-closure.js --root=C:/Dev/PRJET/corp
```

## Hook git optionnel

Le repository fournit un hook opt-in sous `.githooks/pre-commit`.
Pour l'activer:

```bash
git config core.hooksPath .githooks
```

Ce hook appelle directement `node dist/scripts/check-epic-closure.js --root=<repo>` pour eviter un `npm run build` a chaque commit.
Il suppose donc que `dist/` est deja a jour; si besoin, relancer `npm run build` avant le commit.
Le hook est volontairement optionnel pour ne pas imposer de rupture a la CI existante.

### Compatibilite Windows (CRLF)

Le shebang `#!/bin/sh` et l'executabilite msys du hook sont fragiles si Git applique `core.autocrlf=true` a l'extraction. Le fichier `.gitattributes` a la racine du repo force `eol=lf` pour `.githooks/**` et `scripts/**.sh`, ce qui preserve le shebang sur un poste Windows avec `core.autocrlf=true`. Toute nouvelle script shell dans `.githooks/` ou `scripts/` herite automatiquement de cette regle.
