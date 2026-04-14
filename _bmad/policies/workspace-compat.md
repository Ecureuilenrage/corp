# Politique BMAD - Compatibilite workspace pour nouveau registre

## Objet

Toute story qui introduit un nouveau registre runtime ou une nouvelle projection workspace-scoped doit rester compatible avec les workspaces crees par un lot precedent.

## Contrat

Avant tout acces en lecture a un nouveau registre runtime, l'implementation doit distinguer deux cas:

1. Le workspace n'existe pas du tout.
   Le message doit indiquer que le workspace mission n'est pas initialise et recommander explicitement `corp mission bootstrap --root <workspace>`.
2. Le workspace existe deja, mais il provient d'un lot anterieur et le nouveau registre n'est pas initialise.
   Le message doit indiquer que le workspace est ancien ou incomplet, nommer precisement le repertoire ou la projection manquante, et recommander le meme re-bootstrap deterministe.

La regle de merge est la suivante: tout nouveau registre runtime applique cette politique avant acces en lecture, et la story qui introduit ce registre doit inclure un test de regression pour le workspace legacy correspondant.

## Message attendu

Le message d'erreur doit:

- distinguer explicitement "workspace mission non initialise" de "workspace existant mais registre/projection non initialise(e)",
- citer le registre ou la projection manquante,
- proposer `corp mission bootstrap --root <workspace>` comme remediation unique et deterministe,
- rester stable en francais pour etre testable.

## Cas historiques a reutiliser

- Story 4.5: workspace pre-4.2 sans `capabilitiesDir` -> erreur specifique sur le repertoire `capabilities`, puis re-bootstrap.
- Story 4.3: workspace existant sans registre `.corp/skill-packs` -> meme pattern sur `skill-packs`.
- Story 4.4: workspace pre-4.4 sans projection mission-scope `.corp/projections/ticket-board.json` coherente avec `authorizedExtensions` -> `corp mission ticket board` reconstruit depuis le journal; si la projection reste irreconciliable, le message stable cite `ticket-board` (`Projection ticket-board irreconciliable pour <missionId>. Impossible d'afficher le board des tickets.`), puis le mainteneur re-bootstrap le workspace si l'etat legacy est trop incomplet.

## Checklist de merge

Une story future qui ajoute un registre runtime n'est pas mergeable tant que:

- le comportement workspace absent est couvert,
- le comportement workspace legacy incomplet est couvert,
- le message cite exactement le registre/projection manquant,
- la remediation `corp mission bootstrap --root <workspace>` est documentee et testee.
