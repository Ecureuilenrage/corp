# corp V1 - Guide operateur et playbook de missions

## Objet

Ce document explique simplement ce que `corp` sait faire en V1, comment le penser, et comment l'utiliser tout de suite sur de vraies taches.

Il complete:

- `guide-utilisation.md` pour le pas-a-pas CLI detaille
- `etat-v1-et-usage.md` pour une lecture plus narrative
- `_bmad-output/planning/prd.md` pour la vision produit

## Etat reel du projet

Au 2026-04-14, `corp` V1 est fonctionnellement livre:

- les stories 1.1 a 4.5 sont marquees `done`
- la CLI expose la surface mission, ticket, approval, audit, artifact et extension
- `npm test` passe avec 246 tests verts

Point a noter:

- `epic-4` est encore `in-progress` dans `sprint-status.yaml`, mais la retrospective de l'epic indique un V1 complet cote fonctionnalites

## Ce qu'est `corp`

`corp` est un noyau d'orchestration local-first pour piloter du travail IA dans la duree.

Ce n'est pas juste un prompt shell. Ce n'est pas non plus encore un systeme complet de multi-agents autonomes avec daemon, mobile, cloud et router multi-modeles.

En V1, `corp` te donne surtout:

- une mission persistante
- des tickets delegables
- une execution isolee par ticket
- un journal d'evenements et des artefacts relies
- des approvals humaines sur les actions sensibles
- une reprise exploitable sans relire tout l'historique
- une frontiere d'extensions locales gouvernees

## Le bon modele mental

Pense `corp` comme un mini OS de travail orchestre:

- `Mission`: l'objectif global a atteindre
- `Ticket`: une unite de travail bornée
- `ExecutionAttempt`: une tentative d'execution d'un ticket
- `Approval`: une validation humaine quand il y a risque
- `Artifact`: ce qui a ete produit
- `Audit`: la trace de ce qui s'est passe

En pratique:

1. tu crées une mission
2. tu la decoupes en tickets
3. tu lances les tickets un par un
4. tu regardes `resume`, `status`, `ticket board`, `audit`
5. tu arbitres les approvals si besoin
6. tu relances seulement la branche qui a casse

## Comment ca fonctionne techniquement

La logique V1 repose sur quelques choix tres clairs:

- la surface operateur V1 est la CLI `corp`
- le runtime externe prioritaire est Codex via la Responses API
- le modele par defaut est `gpt-5-codex`
- chaque ticket s'execute dans une isolation dediee
- le journal `.corp/journal/events.jsonl` est la source de verite
- les vues `resume`, `ticket board`, `audit`, `artifact index`, `approval queue` sont des projections reconstructibles

Autrement dit, la vraie promesse n'est pas "faire repondre une IA".
La promesse est plutot:

- garder l'etat du travail
- deleguer proprement
- tracer ce qui a ete fait
- reprendre sans te reperdre

## Ce que tu peux faire maintenant

Tu peux utiliser `corp` des aujourd'hui pour:

- piloter un chantier de refactor par etapes
- faire des audits de code avec historique exploitable
- organiser une recherche technique longue en plusieurs tickets
- mettre un deploiement ou une action shell sensible sous approval
- brancher une capability locale ou un skill pack borne a une mission
- diagnostiquer un echec sans fouiller manuellement tous les fichiers
- relancer seulement la partie impactee d'un plan

## Ce que la V1 ne fait pas encore

Il vaut mieux etre tres clair sur les limites actuelles:

- pas de daemon persistant type `KAIROS`
- pas de vraie couche `ULTRAPLAN` auto-planifiante
- pas de multi-agents autonomes persistants
- pas de routeur multi-modeles en production
- pas d'interface mobile ou Telegram
- pas de marketplace d'extensions
- pas de control plane cloud

La V1 est un noyau de controle. C'est deja utile, mais ce n'est pas encore toute la vision.

## Demarrage rapide PowerShell

Depuis Windows/PowerShell:

```powershell
cd C:\Dev\PRJET\corp
npm run build
$env:OPENAI_API_KEY="sk-..."

function corp {
  node "C:\Dev\PRJET\corp\dist\apps\corp-cli\src\index.js" @Args
}
```

Bootstrap d'un workspace de mission:

```powershell
corp mission bootstrap --root C:\Dev\demo\corp-workspace
```

Creation d'une mission:

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Mission pilote" `
  --objective "Prouver le workflow mission ticket audit de bout en bout" `
  --success-criterion "Au moins un ticket est execute avec succes" `
  --success-criterion "Les artefacts sont visibles depuis la mission" `
  --policy-profile default
```

## Les commandes a retenir

Les commandes les plus utiles au quotidien sont:

- `corp mission create`
- `corp mission status`
- `corp mission resume`
- `corp mission ticket create`
- `corp mission ticket board`
- `corp mission ticket run`
- `corp mission approval queue`
- `corp mission approval approve|reject|defer`
- `corp mission artifact list`
- `corp mission audit`
- `corp mission compare`
- `corp mission compare relaunch`
- `corp extension validate`
- `corp extension capability register`
- `corp extension skill-pack register`
- `corp mission extension select`

## Quand utiliser `corp` plutot qu'un simple chat IA

Utilise `corp` si:

- le travail dure plus d'une session
- tu veux garder une trace claire
- tu veux decomposer en sous-taches
- tu veux un audit ou une reprise propre
- tu veux borner des permissions ou extensions

Ne sors pas `corp` si:

- tu veux juste une reponse instantanee a une question simple
- il n'y a aucun besoin d'historique, d'audit ou de reprise

## Playbook ultra concret

Les missions ci-dessous sont pensees pour un operateur technique solo, sur machine locale, avec Codex comme moteur d'execution.

Convention recommandee:

- `--owner codex-agent`
- `--policy-profile default`
- `--kind research|plan|implement|review|operate`

Avant chaque mission:

```powershell
corp mission bootstrap --root C:\Dev\demo\corp-workspace
```

### Mission 1 - Audit express d'un repo avant de reprendre le travail

**Quand l'utiliser**

- tu reprends un repo que tu n'as pas touche depuis longtemps
- tu veux une cartographie rapide avant de coder

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Audit express du repo courant" `
  --objective "Comprendre rapidement la structure, les risques et la prochaine action utile" `
  --success-criterion "Une cartographie des modules majeurs est produite" `
  --success-criterion "Les 3 risques techniques principaux sont identifies" `
  --policy-profile default
```

**Tickets suggeres**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind research `
  --goal "Cartographier les dossiers, les points d'entree et les modules critiques du repo" `
  --owner codex-agent `
  --success-criterion "Une synthese des zones importantes est produite"

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind review `
  --goal "Identifier les zones a risque, la dette technique et les tests manquants" `
  --owner codex-agent `
  --success-criterion "Une liste priorisee de risques est produite"
```

### Mission 2 - Planifier un refactor sans casser l'existant

**Quand l'utiliser**

- tu veux changer un module fragile
- tu veux separer plan, implementation et review

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Refactor borne d'un module fragile" `
  --objective "Refactorer un module cible sans perdre la lisibilite ni casser les invariants" `
  --success-criterion "Le plan de refactor est explicite" `
  --success-criterion "Les changements sont isoles et audites" `
  --success-criterion "Les tests restent verts" `
  --policy-profile default
```

**Tickets suggeres**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind plan `
  --goal "Produire un plan de refactor incremental pour le module cible" `
  --owner codex-agent `
  --success-criterion "Un plan en etapes avec risques et points de verification est produit"

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind implement `
  --goal "Executer le refactor valide dans le module cible" `
  --owner codex-agent `
  --success-criterion "Le module est refactore sans regression evidente" `
  --depends-on <TICKET_PLAN_ID>

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind review `
  --goal "Verifier regressions, lisibilite et couverture de tests du refactor" `
  --owner codex-agent `
  --success-criterion "Un avis de review argumente est produit" `
  --depends-on <TICKET_IMPLEMENT_ID>
```

### Mission 3 - Chasser une regression difficile a reproduire

**Quand l'utiliser**

- un bug existe mais sa cause n'est pas claire
- tu veux documenter hypotheses, preuves et correctif

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Diagnostic de regression" `
  --objective "Identifier la cause racine d'une regression et proposer un correctif borne" `
  --success-criterion "La cause racine est formulee clairement" `
  --success-criterion "Le correctif cible est propose ou implemente" `
  --policy-profile default
```

**Tickets suggeres**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind research `
  --goal "Collecter symptomes, chemins d'execution et hypotheses de regression" `
  --owner codex-agent `
  --success-criterion "Trois hypotheses testables sont listees"

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind implement `
  --goal "Appliquer un correctif borne sur la cause racine confirmee" `
  --owner codex-agent `
  --success-criterion "Le correctif elimine la regression cible" `
  --depends-on <TICKET_RESEARCH_ID>
```

### Mission 4 - Revue de securite locale avant exposition externe

**Quand l'utiliser**

- avant une ouverture reseau, un deploiement, ou une demo importante

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Revue de securite locale" `
  --objective "Identifier les surfaces d'attaque et les faiblesses evidentes avant exposition" `
  --success-criterion "Les points d'entree sensibles sont cartographies" `
  --success-criterion "Les findings sont classes par severite" `
  --policy-profile default
```

**Tickets suggeres**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind research `
  --goal "Cartographier authentification, secrets, endpoints et surfaces shell/filesystem" `
  --owner codex-agent `
  --success-criterion "Une cartographie de la surface sensible est produite"

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind review `
  --goal "Auditer validation des inputs, droits et fuite de secrets" `
  --owner codex-agent `
  --success-criterion "Une liste priorisee de findings est produite"
```

### Mission 5 - Produire une note d'architecture exploitable

**Quand l'utiliser**

- tu veux transformer un systeme flou en plan technique partageable

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Note d architecture exploitable" `
  --objective "Produire une synthese d architecture claire, orientee decisions et implementation" `
  --success-criterion "Les composants majeurs sont identifies" `
  --success-criterion "Les dependances et flux sont expliques" `
  --success-criterion "Les questions ouvertes sont listees" `
  --policy-profile default
```

**Tickets suggeres**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind research `
  --goal "Lire le code et la doc pour reconstruire les decisions d architecture actuelles" `
  --owner codex-agent `
  --success-criterion "Une synthese d architecture actuelle est produite"

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind plan `
  --goal "Formuler une cible d architecture plus propre avec tradeoffs et etapes" `
  --owner codex-agent `
  --success-criterion "Une cible d architecture et ses compromis sont decrits" `
  --depends-on <TICKET_RESEARCH_ID>
```

### Mission 6 - Triage de backlog technique

**Quand l'utiliser**

- tu as trop de TODO, bugs, notes, findings
- tu veux remettre de l'ordre

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Triage backlog technique" `
  --objective "Classer la dette et les bugs pour decider quoi traiter ensuite" `
  --success-criterion "Les items sont regroupes et priorises" `
  --success-criterion "Une proposition de sequence de travail est produite" `
  --policy-profile default
```

**Tickets suggeres**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind research `
  --goal "Recenser la dette technique, les TODO, les findings de review et les tests manquants" `
  --owner codex-agent `
  --success-criterion "Un inventaire consolide est produit"

corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind plan `
  --goal "Prioriser les items par impact, risque et cout" `
  --owner codex-agent `
  --success-criterion "Une proposition de backlog ordonne est produite" `
  --depends-on <TICKET_RESEARCH_ID>
```

### Mission 7 - Ajouter une capability locale gouvernee

**Quand l'utiliser**

- tu veux brancher une action locale bornee et auditée

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Capability locale gouvernee" `
  --objective "Enregistrer et utiliser une capability locale avec permissions explicites" `
  --success-criterion "La capability est validee puis enregistree" `
  --success-criterion "Son invocation apparait dans l audit mission" `
  --policy-profile default
```

**Flux recommande**

```powershell
corp extension validate --file .\tests\fixtures\extensions\valid-capability-local.json

corp extension capability register `
  --root C:\Dev\demo\corp-workspace `
  --file .\tests\fixtures\extensions\valid-capability-local.json

corp mission extension select `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --allow-capability shell.exec
```

**Ticket suggere**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind operate `
  --goal "Executer une action locale bornee en utilisant la capability enregistree" `
  --owner codex-agent `
  --success-criterion "L usage de la capability est trace dans l audit" `
  --allow-capability shell.exec
```

### Mission 8 - Ajouter un skill pack local pour specialiser les briefs

**Quand l'utiliser**

- tu veux injecter une expertise locale dans l'execution d'un ticket

**Creation**

```powershell
corp mission create `
  --root C:\Dev\demo\corp-workspace `
  --title "Skill pack local de specialisation" `
  --objective "Enregistrer un skill pack local et l'utiliser dans une mission bornee" `
  --success-criterion "Le skill pack est enregistre" `
  --success-criterion "Il est autorise pour la mission" `
  --success-criterion "Son usage apparait dans l audit" `
  --policy-profile default
```

**Flux recommande**

```powershell
corp extension validate --file .\tests\fixtures\extensions\valid-skill-pack.json

corp extension skill-pack register `
  --root C:\Dev\demo\corp-workspace `
  --file .\tests\fixtures\extensions\valid-skill-pack.json

corp mission extension select `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --skill-pack pack.triage.local
```

**Ticket suggere**

```powershell
corp mission ticket create `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --kind review `
  --goal "Analyser un incident ou une dette en s appuyant sur le skill pack local" `
  --owner codex-agent `
  --success-criterion "Le ticket exploite le skill pack autorise" `
  --skill-pack pack.triage.local
```

### Mission 9 - Reprendre une mission ancienne sans te reperdre

**Quand l'utiliser**

- tu reviens sur un chantier interrompu
- tu veux retrouver l'etat utile tres vite

**Creation**

Tu peux la lancer sur une mission existante, sans recreer tout le contexte.

**Commandes utiles**

```powershell
corp mission status --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission resume --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission ticket board --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission audit --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission compare --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
```

**Bonne utilisation**

- commence par `resume`
- ouvre `status` si tu veux le detail
- utilise `audit` pour comprendre un echec ou une decision
- utilise `compare` si tu veux relancer proprement

### Mission 10 - Relancer proprement une branche echouee

**Quand l'utiliser**

- une mission a partiellement reussi
- tu ne veux pas tout rejouer

**Flux recommande**

```powershell
corp mission compare `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID>

corp mission compare relaunch `
  --root C:\Dev\demo\corp-workspace `
  --mission-id <MISSION_ID> `
  --ticket-id <ROOT_TICKET_ID>
```

**Bonne utilisation**

- regarde l'ecart attendu/observe
- identifie la vraie racine impactee
- relance seulement cette racine
- conserve les artefacts valides deja produits

## Routine operateur recommandee

Si tu veux une routine simple et efficace:

1. cree une mission pour tout chantier qui dure plus de 30 minutes
2. cree 2 a 5 tickets maximum au debut
3. lance un ticket a la fois tant que tu calibres le flux
4. consulte `resume` apres chaque execution
5. consulte `audit` des qu'un comportement te semble flou
6. utilise `compare` des qu'un ticket echoue ou qu'une mission se bloque
7. ferme la mission quand l'objectif est atteint ou explicitement abandonne

## Commandes de supervision a garder sous la main

```powershell
corp mission status --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission resume --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission ticket board --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission artifact list --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission audit --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission approval queue --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
corp mission compare --root C:\Dev\demo\corp-workspace --mission-id <MISSION_ID>
```

## Conclusion

La meilleure facon de voir `corp` V1 est celle-ci:

- pas encore un assistant autonome total
- deja un excellent noyau de controle pour le travail IA long

Si tu t'en sers sur des chantiers reels, sa valeur apparait quand tu dois:

- reprendre
- auditer
- relancer proprement
- gouverner les extensions

Pour la suite, le vrai choix produit n'est plus "est-ce que V1 marche ?"
Le vrai choix est plutot:

- declarer V1 suffisante pour usage reel
- ou ouvrir un lot de hardening avant une V2 plus ambitieuse
