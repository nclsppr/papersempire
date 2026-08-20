# Balance & Metrics — 0.23.2

Ce document recense les hypothèses de calcul et le contrat analytique de la
Data Science Zone. Il sépare les règles de jeu des projections d'aide à la
décision : afficher une métrique ne modifie jamais l'économie.

## 1. Hypothèses actuelles

- **Production** :
  `DOCps = Σ(baseProduction × quantity × multiplicateurs bâtiment) × multiplicateurs globaux × prestige`.
- **Clic** :
  `docPerClick = docPerClickBase × clickMult × prestigeMult`.
- **CC automatique** : dépend de la production directe, de la qualité, de
  l'image de marque et des modificateurs applicables.
- **Prestige** :
  `culture potentielle = floor(√(ccTotal / prestigeCcDivisor))` selon les règles
  métier courantes.
- **Coût suivant** :
  `baseCost × costMultiplier^quantity`, arrondi avec la même convention que
  l'achat réel.

Points de vigilance :

1. la croissance devient rapidement exponentielle après plusieurs machines ;
2. qualité et empreinte peuvent être moins visibles que leur importance
   narrative ;
3. DOC cumule deux sens — production et monnaie interne — qui ne doivent pas
   être traduits en argent réel ;
4. les contrats, événements et clics manuels créent des gains ponctuels qu'une
   projection à cadence automatique constante ne prédit pas.

## 2. Analyses de la Data Science Zone

Le module analytique travaille sur une copie de l'état et simule l'achat d'un
exemplaire supplémentaire sans muter la partie.

| Métrique | Calcul | Interprétation et limite |
| --- | --- | --- |
| Coût suivant | formule de coût à `quantity` | Coût exact de l'action suivante |
| Gain marginal DOC/s | `DOCps(q+1) - DOCps(q)` | Inclut les multiplicateurs connus |
| Gain marginal CC/s | `CCps(q+1) - CCps(q)` | Dépend des jauges au moment du snapshot |
| Temps d'accès | `max(0, coût - docBank) / DOCps` | Cadence automatique constante ; pas de clic, contrat ou événement futur |
| Retour DOC | `coût / gain marginal DOCps` | Temps nécessaire pour reproduire le coût en DOC ; pas une rentabilité financière |
| Part de production | contribution directe / production automatique | Un modificateur global peut avoir une valeur réelle sans part directe |
| Perspective prestige | règle de culture appliquée au CC courant | Aperçu instantané, pas une prévision temporelle |

Quand le dénominateur est nul, inconnu ou non attribuable, la valeur doit être
affichée comme indisponible plutôt que remplacée par zéro ou une approximation
silencieuse.

## 3. Flux observés

La V4 peut distinguer localement, pendant le cycle de prestige courant :

- DOC automatiques, manuels, hors ligne, issus des contrats et nets des
  événements ;
- CC automatiques, issus des contrats et nets des événements ;
- DOC investis dans les bâtiments et améliorations ;
- clics, contrats terminés, événements résolus et réorganisations observées.

Ces compteurs commencent avec l'instrumentation V4. Les cycles terminés sont
résumés dans l'archive locale, mais le panneau de flux ne les additionne pas au
cycle actif. Une ancienne sauvegarde conserve sa progression totale, sans
reconstruire son historique antérieur : la zone doit alors afficher une
couverture partielle.

## 4. Historique et projections

Les échantillons sont bornés et stockés dans le navigateur. Leur horodatage réel
sert à tracer les tendances ; une absence d'échantillon n'est pas comblée par
des données fictives. Changer d'appareil, utiliser un autre profil, effacer le
stockage ou importer une sauvegarde peut interrompre ou réinitialiser cette
couverture.

Les projections interactives utilisent un horizon choisi et une cadence
constante :

```text
DOC automatiques projetés = DOCps actuel × horizon
```

Elles servent à comparer des scénarios courts. Elles ne modélisent pas les
achats intermédiaires, déblocages, événements, contrats, clics futurs ou
changements de jauges.

## 5. Protocole de validation d'équilibrage

Avant de modifier `BUILDING_DEFS`, les multiplicateurs ou le prestige :

1. conserver trois snapshots représentatifs (début, milieu et fin de run) ;
2. vérifier, pour chaque machine débloquée, coût, gain marginal DOC/s et CC/s
   contre un calcul indépendant ;
3. comparer temps d'accès et retour DOC avant/après ;
4. jouer un run court pour observer les effets ponctuels non couverts par le
   modèle ;
5. documenter les résultats et les limites, puis seulement ajuster les règles.

Objectifs à surveiller, sans les traiter comme contraintes déjà validées :

- run complet atteignable en moins de deux heures dans le scénario cible ;
- aucun achat débloqué durablement dominé par tous les autres ;
- qualité, empreinte et image de marque visibles dans au moins une décision ;
- prestige compréhensible avant confirmation.

## 6. Travaux futurs

- [ ] Constituer les snapshots de référence early/mid/late et publier les
  comparaisons.
- [ ] Ajouter un test Node sur des états synthétiques couvrant coût, simulation
  quantité +1 et cas à dénominateur nul.
- [ ] Évaluer la contribution manuelle avec un scénario explicitement nommé,
  sans l'intégrer par défaut aux horizons automatiques.
- [ ] Revoir les seuils seulement après observation de runs réels.
