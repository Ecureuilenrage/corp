# Plan d'usage BMAD pour le projet coeur

## Objet

Ce document donne:

1. un prompt maitre a coller dans une nouvelle fenetre de contexte,
2. les commandes utiles a lancer ou a faire lancer,
3. la meilleure sequence BMAD pour mener ce projet jusqu'a l'implementation,
4. les points de controle pour ne pas bruler les etapes.

Le projet coeur est dans `C:\Dev\PRJET\corp`.

Les sources brutes actuelles sont:

- `C:\Dev\PRJET\corp\ideation-projet.Md`
- `C:\Dev\PRJET\corp\besoins.md`

Les bases de connaissance de reuse sont:

- `C:\Dev\PRJET\claude-code-leak-03-2026\claude-code-leak-fork-main\analysis`
- `C:\Dev\PRJET\Openclaw\openclaw-main\analysis`
- `C:\Dev\PRJET\metagpt\MetaGPT-main\analysis`
- `C:\Dev\PRJET\chatdev\ChatDev-main\analysis`

Les sorties BMAD sont configurees dans:

- `C:\Dev\PRJET\corp\_bmad-output\planning`
- `C:\Dev\PRJET\corp\_bmad-output\project-knowledge`
- `C:\Dev\PRJET\corp\_bmad-output\implementation`

## Regles operatoires BMAD pour ce projet

1. Utiliser une nouvelle fenetre de contexte par workflow BMAD majeur.
2. Ne pas coder le coeur avant d'avoir au minimum:
   - un product brief,
   - une architecture,
   - un PRD,
   - des epics/stories.
3. Considerer `corp` comme la racine produit et les 4 autres repos comme des references externes.
4. Garder `ideation-projet.Md` et `besoins.md` comme sources brutes, non comme documents de travail finaux.
5. Produire d'abord les artefacts de decision, puis les artefacts de delivery.
6. Quand un workflow se termine, demander explicitement:
   - les fichiers crees,
   - les hypotheses prises,
   - le prompt exact pour la fenetre suivante.
7. Ne pas utiliser `bmad-document-project` tout de suite sur `corp` pour "scanner du code", car `corp` n'est pas encore le vrai repo d'implementation. L'utiliser plus tard quand le repo coeur existera.

## Etat actuel du projet

Au 2026-04-08, les artefacts suivants existent deja:

- `C:\Dev\PRJET\corp\_bmad-output\planning\product-brief-corp.md`
- `C:\Dev\PRJET\corp\_bmad-output\planning\prd.md`

Decisions deja prises:

- scenario pilote V1: une micro-entreprise locale fortement automatisee qui peut fonctionner avec quelques profits sous supervision humaine;
- surface operateur V1: `CLI`;
- runtime externe cible: `Codex`;
- ne pas supposer de dependance produit a `Claude Code`, meme si ses analyses restent utiles comme source de patterns.

Consequence pratique:

- la prochaine etape recommandee est `bmad-technical-research` si tu veux lever les inconnues autour de l'objet mission/ticket et de la frontiere minimale d'extension;
- sinon, tu peux aller directement a `bmad-create-architecture` si tu acceptes que ces arbitrages soient tranches pendant l'architecture.

## Commandes de preparation PowerShell

Lancer ces commandes si tu veux verifier rapidement le setup avant d'ouvrir une nouvelle fenetre:

```powershell
Get-Content -Raw C:\Dev\PRJET\corp\_bmad\bmm\config.yaml
Get-Content -Raw C:\Dev\PRJET\corp\_bmad-output\project-knowledge\index.md
Get-Content -Raw C:\Dev\PRJET\corp\_bmad-output\project-knowledge\project-overview.md
Get-Content -Raw C:\Dev\PRJET\corp\ideation-projet.Md
Get-Content -Raw C:\Dev\PRJET\corp\besoins.md
Get-Content -Raw C:\Dev\PRJET\claude-code-leak-03-2026\claude-code-leak-fork-main\analysis\index.md
Get-Content -Raw C:\Dev\PRJET\Openclaw\openclaw-main\analysis\index.md
Get-Content -Raw C:\Dev\PRJET\metagpt\MetaGPT-main\analysis\index.md
Get-Content -Raw C:\Dev\PRJET\chatdev\ChatDev-main\analysis\index.md
```

Si tu veux juste verifier les repertoires de sortie:

```powershell
Get-ChildItem C:\Dev\PRJET\corp\_bmad-output -Recurse
```

## Prompt maitre a coller dans une nouvelle fenetre

Utilise ce prompt pour lancer proprement le travail en BMAD dans une nouvelle fenetre. Il est volontairement strict pour forcer une bonne discipline de contexte.

```text
Tu travailles sur le projet situe dans C:\Dev\PRJET\corp.

Utilise la methode BMAD de maniere stricte, en francais, avec une logique de progression par artefacts. Ne saute pas directement a l'implementation.

Contexte projet:
- Le coeur produit est dans C:\Dev\PRJET\corp
- Les notes brutes sont dans:
  - C:\Dev\PRJET\corp\ideation-projet.Md
  - C:\Dev\PRJET\corp\besoins.md
- La base de connaissance BMAD est deja preparee dans:
  - C:\Dev\PRJET\corp\_bmad-output\project-knowledge\index.md
  - C:\Dev\PRJET\corp\_bmad-output\project-knowledge\project-overview.md
- Les 4 repos de reference analyses sont:
  - C:\Dev\PRJET\claude-code-leak-03-2026\claude-code-leak-fork-main\analysis
  - C:\Dev\PRJET\Openclaw\openclaw-main\analysis
  - C:\Dev\PRJET\metagpt\MetaGPT-main\analysis
  - C:\Dev\PRJET\chatdev\ChatDev-main\analysis

Regles:
- Une seule grande etape BMAD par fenetre de contexte.
- Commence par lire la config C:\Dev\PRJET\corp\_bmad\bmm\config.yaml.
- Lis ensuite les sources brutes et les indexes de connaissance utiles.
- Utilise le skill BMAD le plus adapte a l'etape courante.
- Cree les artefacts dans C:\Dev\PRJET\corp\_bmad-output.
- N'invente pas des details techniques si les analyses ne les soutiennent pas.
- Si tu prends des hypotheses, liste-les explicitement.
- A la fin de cette fenetre, arrete-toi et fournis:
  1. les fichiers crees ou modifies,
  2. un resume des decisions prises,
  3. les questions restantes,
  4. le prompt exact a utiliser dans la fenetre suivante.

Mission de cette fenetre:
- Demarre par le workflow BMAD adapte a l'etape suivante du projet.
- Si aucun artefact produit n'existe encore, commence par bmad-product-brief.
- Si le product brief existe deja, enchaine selon la logique BMAD la plus saine.
```

## Comment invoquer les workflows

Dans cet environnement, le plus simple est de demander explicitement le skill en langage naturel. Tu peux utiliser des commandes/messages comme ceux-ci.

### Commande 1: Product brief

```text
Utilise le skill bmad-product-brief.
Travaille a partir de C:\Dev\PRJET\corp\ideation-projet.Md, C:\Dev\PRJET\corp\besoins.md et des 4 dossiers analysis indexes references depuis C:\Dev\PRJET\corp\_bmad-output\project-knowledge\index.md.
Je veux un brief produit solide pour un orchestrateur multi-agents persistant, local-first, avec KAIROS, ULTRAPLAN et COORDINATOR MODE comme concepts a clarifier.
Reste en francais, produis le brief dans le dossier planning, et stoppe toi a la fin avec le prompt exact pour la fenetre suivante.
```

### Commande 2: Recherche technique

```text
Utilise le skill bmad-technical-research.
Sujet: architecture d'un orchestrateur multi-agents persistant local-first s'appuyant sur les analyses historiques Claude Code, OpenClaw, MetaGPT et ChatDev, avec Codex comme runtime externe cible.
Le but n'est pas une revue generale mais un document decisionnel pour preparer l'architecture cible du projet coeur.
Produis le document dans planning/research et termine par une liste de decisions techniques a porter dans architecture.md.
```

### Commande 3: Recherche marche ou domaine

Utiliser seulement si le projet vise un produit commercialisable. Ce n'est pas l'etape prioritaire pour avancer vers l'architecture V1.

```text
Utilise le skill bmad-market-research.
Sujet: positionnement d'un runtime multi-agents persistant pour builders solo, equipes IA natives et automations local-first.
Appuie-toi sur le brief produit existant et sors un document d'aide au positionnement, a la proposition de valeur et aux risques go-to-market.
```

### Commande 4: Architecture

```text
Utilise le skill bmad-create-architecture.
Appuie-toi sur le product brief, les recherches eventuelles et la base de connaissance projet dans C:\Dev\PRJET\corp\_bmad-output\project-knowledge.
Je veux une architecture cible concrete pour le projet coeur, en distinguant:
- ce qui vient du coeur proprietaire,
- ce qui peut etre inspire des analyses historiques Claude Code, sans en faire une dependance produit,
- ce qui peut etre inspire de OpenClaw,
- ce qui peut etre inspire de MetaGPT,
- ce qui peut etre inspire de ChatDev.
Le resultat doit rester oriente implementation V1.
```

### Commande 5: Project context

Cette etape devient tres utile juste apres l'architecture, surtout avant de lancer des agents code.

```text
Utilise le skill bmad-generate-project-context.
Base-toi sur l'architecture, le brief, les conventions deja decidees et les contraintes du projet coeur.
Je veux un project-context.md concis, optimise pour des agents de code, avec les regles de structure, les conventions, les garde-fous et les interdits.
```

### Commande 6: PRD

```text
Utilise le skill bmad-create-prd.
Base-toi sur le product brief, l'architecture et les recherches deja produites.
Je veux un PRD concentre sur une V1 controlable d'orchestrateur multi-agents persistant, pas une vision totale trop large.
Le PRD doit fixer le premier noyau livrable avant de penser aux extensions.
```

### Commande 7: Validation PRD

```text
Utilise le skill bmad-validate-prd.
Valide le PRD courant et remonte les trous critiques, les ambiguities, les dependances oubliees et les risques de build.
```

### Commande 8: Epics et stories

```text
Utilise le skill bmad-create-epics-and-stories.
Genere les epics et stories a partir du PRD, de l'architecture et du project-context.
Je veux un decoupage oriente build iteratif, avec une premiere tranche qui livre le socle:
- daemon,
- etat durable,
- bus d'evenements,
- approvals,
- routage de modeles,
- une seule boucle venture active.
```

### Commande 9: Implementation readiness

```text
Utilise le skill bmad-check-implementation-readiness.
Je veux savoir si le package PRD + architecture + epics + UX ou contexte projet est assez solide pour passer a l'execution sans gaspiller des cycles de dev.
```

### Commande 10: Sprint planning

```text
Utilise le skill bmad-sprint-planning.
Prends les epics/stories actuels et produis le suivi de sprint pour attaquer la premiere story.
```

### Commande 11: Creation d'une story executable

```text
Utilise le skill bmad-create-story.
Prepare la prochaine story backlog dans sprint-status.yaml en contexte complet pour l'agent de dev.
Les artefacts BMAD sont dans C:\Dev\PRJET\corp
Je veux un fichier de story pret pour implementation, avec guardrails, references et contraintes.
à la fin, donne moi le prompt exact a utiliser dans la fenetre suivante.

```

### Commande 12: Dev

Si tu veux un cadre tres BMAD:

```text
Utilise le skill bmad-dev-story pour implementer la story preparee.
```

Si tu veux aller plus vite sur une story claire et bornee:

```text
Utilise le skill bmad-quick-dev pour transformer la story en spec de travail puis implementation.
Les artefacts BMAD sont dans C:\Dev\PRJET\corp
```

### Commande 13: Review

```text
Utilise le skill bmad-code-review.
Je veux une review orientee bugs, regressions, manques de tests et ecarts par rapport au PRD, a l'architecture et a la story.
Les artefacts BMAD sont dans C:\Dev\PRJET\corp
```

### Commande 14: Correct course

```text
Utilise le skill bmad-correct-course.
Je veux proposer une correction de trajectoire sur la base des ecarts observes pendant l'implementation.
Les artefacts BMAD sont dans C:\Dev\PRJET\corp
```

### Commande 15: Retrospective

```text
Utilise le skill bmad-retrospective.
Fais une retrospective de l'epic courant en extrayant les bonnes decisions, les erreurs de decoupage et les ajustements a faire avant l'epic suivant.
Les artefacts BMAD sont dans C:\Dev\PRJET\corp
```

## Parcours recommande

## Parcours minimal

Utilise cette sequence si tu veux aller vite mais proprement:

1. `bmad-product-brief`
2. `bmad-create-architecture`
3. `bmad-generate-project-context`
4. `bmad-create-prd`
5. `bmad-validate-prd`
6. `bmad-create-epics-and-stories`
7. `bmad-sprint-planning`
8. `bmad-create-story`
9. `bmad-dev-story` ou `bmad-quick-dev`
10. `bmad-code-review`

## Parcours recommande "meilleur de BMAD"

Utilise cette sequence si tu veux tirer le meilleur du cadre BMAD sur ce projet complexe:

1. `bmad-product-brief`
2. `bmad-technical-research`
3. `bmad-market-research` ou `bmad-domain-research` si necessaire
4. `bmad-create-architecture`
5. `bmad-generate-project-context`
6. `bmad-create-prd`
7. `bmad-validate-prd`
8. `bmad-create-epics-and-stories`
9. `bmad-check-implementation-readiness`
10. `bmad-sprint-planning`
11. `bmad-create-story`
12. `bmad-dev-story`
13. `bmad-code-review`
14. `bmad-correct-course` si besoin
15. `bmad-retrospective`

## Etapes detaillees

## Etape 0 - Stabiliser la vision

But:
- Transformer les notes brutes en vision produit nette.

Workflow:
- `bmad-product-brief`

Sortie attendue:
- `C:\Dev\PRJET\corp\_bmad-output\planning\product-brief-corp.md`

Gate:
- Le brief doit trancher le coeur V1, la proposition de valeur et ce qui reste hors scope.

## Etape 1 - Lever les inconnues critiques

But:
- Sortir de l'intuition pure sur la partie architecture agentique.

Workflows:
- `bmad-technical-research`
- `bmad-market-research` si produit commercial
- `bmad-domain-research` si besoin de clarifier le probleme utilisateur

Sorties attendues:
- un ou plusieurs fichiers dans `planning/research`

Gate:
- Avoir une liste claire de decisions techniques et de non-objectifs.

## Etape 2 - Fixer l'architecture cible

But:
- Decider la forme du systeme avant le PRD.

Workflow:
- `bmad-create-architecture`

Sortie attendue:
- `C:\Dev\PRJET\corp\_bmad-output\planning\architecture.md`

Gate:
- L'architecture doit distinguer le noyau proprietaire, les surfaces de reuse et les limites de la V1.

## Etape 3 - Coder les regles pour les futurs agents

But:
- Creer une memoire operative pour les futures fenetres de code.

Workflow:
- `bmad-generate-project-context`

Sortie attendue:
- `C:\Dev\PRJET\corp\_bmad-output\project-context.md`

Gate:
- Le document doit fixer conventions, interdits, patterns de structure, garde-fous et principes de delivery.

## Etape 4 - Transformer la strategie en exigences produit

But:
- Convertir vision + architecture en produit executable.

Workflow:
- `bmad-create-prd`

Sortie attendue:
- `C:\Dev\PRJET\corp\_bmad-output\planning\prd.md`

Gate:
- Le PRD doit couvrir une V1 bornee, pas un mega-systeme indefini.

## Etape 5 - Valider le PRD avant decoupage

But:
- Detecter les trous avant de creer les epics.

Workflow:
- `bmad-validate-prd`

Sortie attendue:
- rapport de validation ou corrections dans le PRD

Gate:
- Les risques majeurs doivent etre corriges ou assumes explicitement.

## Etape 6 - Transformer le PRD en backlog realiste

But:
- Convertir le produit en plan de build.

Workflow:
- `bmad-create-epics-and-stories`

Sortie attendue:
- `C:\Dev\PRJET\corp\_bmad-output\planning\epics.md`

Gate:
- Les stories doivent etre sequentielles, testables et orientees livraison.

## Etape 7 - Verifier la readiness avant implementation

But:
- Eviter de lancer des agents de dev sur une spec encore floue.

Workflow:
- `bmad-check-implementation-readiness`

Gate:
- PRD, architecture, epics et contextes doivent etre suffisants.

## Etape 8 - Passer en sprint execution

But:
- Ordonner le backlog pour le run courant.

Workflow:
- `bmad-sprint-planning`

Sortie attendue:
- artefacts de sprint et suivi des statuts

Gate:
- Une premiere story doit etre clairement "backlog" puis "ready-for-dev".

## Etape 9 - Fabriquer la story de dev complete

But:
- Donner a l'agent de dev tout ce qu'il faut sans re-decouverte hasardeuse.

Workflow:
- `bmad-create-story`

Sortie attendue:
- un fichier de story dans `implementation`

Gate:
- La story doit etre complete, bornee et reliee a l'architecture.

## Etape 10 - Implementer

But:
- Transformer la story en code.

Workflow:
- `bmad-dev-story` si tu veux suivre la discipline BMAD forte
- `bmad-quick-dev` si la story est deja ultra claire et que tu veux accelerer

Gate:
- L'implementation doit renvoyer vers les tests et la review.

## Etape 11 - Review et correction

But:
- Fermer la boucle qualite.

Workflows:
- `bmad-code-review`
- `bmad-correct-course` si besoin

Gate:
- Pas de fermeture d'epic sans review exploitable.

## Etape 12 - Retrospective

But:
- Ameliorer les prochains epics.

Workflow:
- `bmad-retrospective`

Gate:
- Une retrospective courte mais concrete doit alimenter le sprint suivant.

## Strategie specifique a TON projet

Pour ce projet, la meilleure approche n'est pas de vouloir tout capturer d'un coup. Il faut cadrer un noyau V1.

Le noyau V1 recommande dans les artefacts BMAD doit ressembler a ceci:

1. un daemon local persistant,
2. un etat durable minimal,
3. un journal d'evenements,
4. un systeme d'approbations,
5. un routeur simple de modeles,
6. une seule venture active,
7. un canal de notification,
8. une capacite minimale de delegation structuree.

Ce qui doit rester hors scope V1 sauf si les artefacts le justifient explicitement:

1. achat automatique de domaines,
2. outbound autonome,
3. publication juridique autonome,
4. trop de roles agents persistants,
5. une plate-forme multi-tenant complete,
6. la totalite des integrations de paiement et de growth des la premiere iteration.

## Bon usage des 4 repos analyses

Utilise-les comme sources de design, pas comme obligations de copie.

Analyses historiques Claude Code:
- session loop,
- tools,
- permissions,
- memoire,
- orchestration,
- integration IDE.

OpenClaw:
- gateway,
- channels,
- plugins,
- skills,
- surfaces de controle.

MetaGPT:
- roles,
- team orchestration,
- planner,
- action system,
- abstraction de providers.

ChatDev:
- runtime de workflow,
- surfaces declaratives,
- fonctions/outils/MCP,
- topologie d'execution.

## Anti-patterns a eviter

1. Ecrire le PRD avant le brief et l'architecture.
2. Vouloir coder avant d'avoir borne la V1.
3. Fusionner plusieurs grands workflows BMAD dans la meme fenetre.
4. Traiter les 4 repos comme des choses a fusionner integralement.
5. Lancer des agents de dev sans project-context ou sans story complete.
6. Utiliser BMAD comme simple generateur de documents sans gates de decision.

## Ordre concret recommande pour la prochaine session

Fenetre 1:
- lancer `bmad-product-brief`

Fenetre 2:
- lancer `bmad-technical-research`

Fenetre 3:
- lancer `bmad-create-architecture`

Fenetre 4:
- lancer `bmad-generate-project-context`

Fenetre 5:
- lancer `bmad-create-prd`

Fenetre 6:
- lancer `bmad-validate-prd`

Fenetre 7:
- lancer `bmad-create-epics-and-stories`

Fenetre 8:
- lancer `bmad-check-implementation-readiness`

Fenetre 9:
- lancer `bmad-sprint-planning`

Fenetre 10:
- lancer `bmad-create-story`

Fenetre 11+:
- execution,
- review,
- correction,
- retrospective.

## Ce que je ferais tout de suite

1. Ouvrir une nouvelle fenetre.
2. Coller le prompt maitre.
3. Si tu veux lever les inconnues encore ouvertes, envoyer directement la commande `bmad-technical-research`.
4. Sinon, ouvrir une autre fenetre pour `bmad-create-architecture`.
5. Ne passer a l'implementation qu'une fois architecture, PRD valide et epics stabilises.
