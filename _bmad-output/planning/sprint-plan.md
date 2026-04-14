---
title: "Sprint Plan: corp V1"
status: complete
created: 2026-04-08
updated: 2026-04-08
projectName: corp
sourceEpicFile: C:/Dev/PRJET/corp/_bmad-output/planning/epics.md
sourceStatusFile: C:/Dev/PRJET/corp/_bmad-output/implementation/sprint-status.yaml
---

# Sprint Plan - corp V1

## Objectif du sprint courant

Fermer proprement la Story `1.1` en passant par une revue formelle, puis ouvrir la Story `1.2` comme prochain lot de developpement de l'Epic 1.

## Etat de depart

- L'Epic 1 est `in-progress` car une story d'implementation existe deja.
- La Story `1.1` est conservee en `review` car son fichier d'implementation existe deja et elle n'a pas encore ete revue.
- Toutes les autres stories restent en `backlog`.
- Aucune retrospective d'epic n'est requise a ce stade; elles restent `optional`.

## Ordre de traitement recommande

1. Revoir la Story `1.1` et verifier son implementation face aux AC et aux tests.
2. Si la revue est validee, passer `1.1` a `done`.
3. Creer ensuite la story d'implementation `1.2` et la faire passer a `ready-for-dev`.
4. Implementer `1.2`, puis enchainer `1.3` et `1.4` pour terminer l'Epic 1.
5. N'ouvrir l'Epic 2 qu'apres stabilisation de l'Epic 1, sauf decision explicite de parallelisation.

## Planification des stories

### Epic 1 - Mission persistante pilotable en CLI

- `1.1` Initialiser la CLI V1 et le stockage local de mission - `review`
- `1.2` Creer une mission persistante avec objectif et criteres de succes - `backlog`
- `1.3` Consulter l'etat courant et le resume de reprise d'une mission - `backlog`
- `1.4` Mettre en pause, relancer ou cloturer une mission sans perdre l'historique - `backlog`

### Epic 2 - Delegation et execution isolees par ticket

- `2.1` Creer un ticket delegable avec owner, dependances et contraintes explicites - `backlog`
- `2.2` Reprioriser, modifier et annuler un ticket en cours de mission - `backlog`
- `2.3` Lancer une tentative d'execution isolee via l'adaptateur prioritaire - `backlog`
- `2.4` Suivre l'avancement et les blocages d'un ticket depuis la mission - `backlog`
- `2.5` Enregistrer les artefacts, decisions et evenements produits par un ticket - `backlog`

### Epic 3 - Supervision humaine, reprise ciblee et audit

- `3.1` Ouvrir une file d'approbation pour les actions sensibles - `backlog`
- `3.2` Approuver, refuser ou differer une demande avec garde-fous auditablement - `backlog`
- `3.3` Reprendre une mission interrompue a partir d'un resume fiable - `backlog`
- `3.4` Consulter un journal d'audit structure et l'origine de chaque sortie - `backlog`
- `3.5` Comparer l'etat courant aux criteres de succes et relancer uniquement la partie impactee - `backlog`

### Epic 4 - Extensions locales gouvernees pour la boucle V1

- `4.1` Publier le contrat de registration des extensions V1 - `backlog`
- `4.2` Enregistrer une capability locale avec permissions et contraintes explicites - `backlog`
- `4.3` Charger un skill pack local dans le cadre d'une mission - `backlog`
- `4.4` Selectionner les extensions autorisees par mission et tracer leur usage en CLI - `backlog`

## Point d'attention

La story `1.1` ne doit pas passer a `done` tant qu'une revue explicite n'a pas ete executee. Dans l'etat actuel, le flux recommande est donc `review -> done`, puis creation de la story `1.2`.
