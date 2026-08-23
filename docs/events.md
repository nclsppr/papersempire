# Events & Mini-games

Pour casser la monotonie, Papers Empire introduit des événements contextuels
générés aléatoirement. Un événement propose un choix ou un mini-jeu, mais ne
bloque jamais la partie : il peut être ignoré sans conséquence.

## Système

- **Génération** : le premier événement ne peut pas apparaître avant 2 min 30.
  Après une résolution ou une fermeture, le suivant attend au moins 4 min 30.
  Sa probabilité augmente avec la production, sur le temps réel plutôt que sur
  le nombre d'images ou l'accélération du mode test.
- **Types** : `choice` (boutons avec conséquences immédiates) et `minigame` (interaction spéciale).
- **Contrôle** : la croix et `Échap` annulent l'incident sans appliquer de
  choix. « Stopper ces interruptions » désactive durablement leur apparition ;
  le réglage Interface permet de les réactiver.
- **Intégration** : les événements s’affichent dans une modale. Leur apparition
  et leur résultat sont consignés dans le journal d'activité avec `log.event`
  et `log.eventResult`. Le bandeau de résultat se ferme automatiquement après
  six secondes.
- **Debug** : `window.__PE_DEBUG.spawnEvent("machineBreakdown")` permet de forcer un événement (utilisé par les tests Playwright).

## Catalogue (v1)

| ID | Type | Effet | Notes |
| --- | --- | --- | --- |
| paperShortage | choice | DOC/qualité vs empreinte/qualité | choix de papier |
| influencerVisit | choice | DOC/image vs image/qualité | visite LinkedIn |
| greenAudit | choice | DOC/empreinte vs empreinte/image | audit carbone |
| machineBreakdown | choice | Réparer vs ignorer (DOC/qualité) | perte de DOC mais qualité ++ |
| auditQuality | choice | Contrôle complet vs superficiel | confiance +/- |
| newContract | choice | +DOC vs confiance | augmente l’empreinte |
| cyberAttack | choice | Débrancher (perte DOC) vs payer (perte CC) | | 
| sabotage | choice | Enquêter (image +) vs ignorer (image -) | |
| calibrationChallenge | minigame | Faire correspondre le code au bouton | mini-jeu de calibrage |

## Mini-jeu : calibrage

1. L’événement `calibrationChallenge` génère un code (1,2,3).
2. L’utilisateur doit cliquer sur le bouton correspondant.
3. Succès = +DOC / +qualité, échec = baisse qualité.

```mermaid
sequenceDiagram
    actor Player
    participant Modal
    participant Events
    participant GameState

    Player->>Modal: clique sur code
    Modal->>Events: resolveMinigame(code)
    Events-->>GameState: applique buff/nerf
    Events-->>Modal: renvoie resultKey
    Modal->>Player: affiche résultat
    Modal->>News: ajoute entrée
```

## TODO futurs

- Ajouter des événements conditionnés par les stats (ex: si footprint trop haut, visite des autorités).
- Introduire une file d’attente d’événements pour créer des scénarios.
- Mini-jeux supplémentaires (tri des colis, puzzle triage, etc.).
- Support audio/graphique pour rendre les événements plus immersifs.
