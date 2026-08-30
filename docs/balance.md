# Balance & Metrics — 0.26.0

Ce document recense les hypothèses de calcul et le contrat analytique de la
Data Science Zone. Il sépare les règles de jeu des projections d'aide à la
décision : afficher une métrique ne modifie jamais l'économie.

Les règles de carrière implémentent la spécification de l'issue GitHub
[#34](https://github.com/nclsppr/papersempire/issues/34). Les nombres ci-dessous
sont les valeurs livrées en 0.26.0 et devront être ajustés à partir de runs
observés, pas de projections présentées comme acquises.

## 1. Hypothèses actuelles

- **Production** :
  `DOCps = Σ(baseProduction × quantitéEffective) × multiplicateurs bâtiment × multiplicateurs globaux × prestige × modificateur du Plan`.
- **Clic** :
  `docPerClick = docPerClickBase × clickMult × prestigeMult`.
- **CC automatique** : dépend de la production directe, de la qualité, de
  l'image de marque et des modificateurs applicables.
- **Prestige** :
  `culture potentielle = floor(3 × log10(1 + ccTotal / 1 000))`. Un Plan prêt
  ajoute au reçu un bonus de Culture égal à son rang (`+1`, `+2` ou `+3`) ; un
  Plan incomplet n'ajoute rien. La Culture conservée applique
  `prestigeMult = 1 + 0,20 × √Culture`, et non plus un bonus linéaire.
- **Jauges par Culture** :
  `bonusQualité = min(0,20 ; 0,025 × √Culture)` et
  `bonusImage = min(0,25 ; 0,03 × √Culture)`. Les plafonds correspondent à
  +20 et +25 points avant le clamp final des jauges.
- **Coût suivant** :
  `baseCost × costMultiplier^quantity`, arrondi avec la même convention que
  l'achat réel.

Points de vigilance :

1. la croissance devient rapidement exponentielle après plusieurs machines ;
2. qualité et empreinte peuvent être moins visibles que leur importance
   narrative ;
3. DOC cumule deux sens — production et monnaie interne — qui ne doivent pas
   être traduits en argent réel ;
4. les contrats, événements, récompenses de succès et clics manuels créent des
   gains ponctuels qu'une projection à cadence automatique constante ne prédit
   pas ;
5. changer de Plan peut modifier production, confiance, coût ou dérive
   d'empreinte : le snapshot analytique doit donc transporter les modificateurs
   effectivement actifs.

### Paliers des unités

Toutes les contributions par exemplaire — production directe, multiplicateurs
et bonus de jauge — emploient une quantité effective :

```text
m(q) = 1,00 si q < 10 ; 1,10 si 10 ≤ q < 25 ; 1,25 si q ≥ 25
quantitéEffective = q × m(q)
```

Le palier ×25 remplace le multiplicateur ×10 ; les deux ne se cumulent pas. Les
événements de palier sont identifiés par `milestone:<buildingId>:<quantity>` et
ne sont émis qu'une fois par cycle, même si le rendu ou le calcul est répété.

### Plans de réorganisation

| Plan | Rang 1 | Rang 2 | Rang 3 | Bonus permanent par rang |
| --- | --- | --- | --- | --- |
| Cadence | DOC ×1,10 ; dérive empreinte ×1,20 | DOC ×1,15 ; dérive ×1,35 | DOC ×1,20 ; dérive ×1,50 | production DOC +2 % |
| Qualité | DOC ×0,95 ; cible qualité +4 pt | DOC ×0,925 ; cible +6 pt | DOC ×0,90 ; cible +8 pt | cible qualité +1 pt |
| Relation client | CC et contrats ×1,10 ; coûts ×1,05 | CC ×1,15, contrats ×1,20 ; coûts ×1,075 | CC ×1,20, contrats ×1,30 ; coûts ×1,10 | confiance +2 % |

Les bonus permanents des rangs terminés se cumulent par addition à l'intérieur
de leur orientation, puis sont combinés au modificateur du Plan actif. Ils ne
créent pas de monnaie supplémentaire.

Les rangs 3 matérialisent le dernier palier d'échelle : Cadence exige 25 presses
offset, 20 000 DOC/s puis 1 000 000 CC ; Qualité exige 25 Studios prépresse,
92 % de qualité puis trois clauses ; Relation client exige 25 ComBridge, quatre
contrats puis 10 000 000 CC. Les rangs 1 et 2 conservent leurs seuils
d'introduction et de milieu de partie.

### Contrats, clauses et Studio prépresse

- la récompense de base d'un contrat reste garantie une fois le contrat signé ;
- une clause suit pendant toute la production le minimum observé de qualité ou
  d'image, ou le maximum observé d'empreinte ; la franchir dans le mauvais sens
  rend uniquement le bonus de clause indisponible ;
- le Plan Relation client multiplie les récompenses de base et de clause selon
  son rang actif ; les termes calculés à la signature sont persistés ;
- chaque Studio prépresse retire 6 % de la durée nominale, sans bénéficier du
  multiplicateur de palier pour ce calcul et avec un plafond global de 30 % ;
  la durée finale reste d'au moins 15 secondes.

### Défis, grands dossiers et succès

- `budgetFrozen`, `zeroReturns` et `everyoneCopied` rapportent respectivement
  2, 3 et 4 points de Culture, une seule fois ;
- les grands dossiers ne donnent pas de ressource : ils attribuent les badges
  requis pour la conclusion et orientent les offres de contrat nécessaires ;
- les étapes d'un grand dossier sont strictement séquentielles. Dans
  `onboarding842`, la clause du Kit d'onboarding ne compte pas pour l'étape
  suivante : après avoir livré le Kit, il faut réussir une autre clause ;
- chaque succès expose un objectif chiffré et une récompense DOC, CC ou Culture
  attribuée exactement une fois grâce à `achievements.rewarded`.

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

- DOC automatiques, manuels, hors ligne, issus des contrats, nets des
  événements et attribués par les succès ;
- CC automatiques, issus des contrats, nets des événements et attribués par les
  succès ;
- Culture attribuée par les Plans, défis et succès ;
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
- prestige compréhensible avant confirmation, avec distinction entre Culture
  de base, bonus du Plan, tampon attribué ou reprise au dossier 1 ;
- aucun Plan ne devient dominant sur ses trois rangs ;
- les clauses restent un bonus lisible et ne transforment jamais une livraison
  réussie en échec caché.

## 6. Travaux futurs

- [ ] Constituer les snapshots de référence early/mid/late et publier les
  comparaisons.
- [x] Ajouter des tests Node sur des états synthétiques couvrant progression,
  paliers, contrats et migrations de sauvegarde.
- [ ] Évaluer la contribution manuelle avec un scénario explicitement nommé,
  sans l'intégrer par défaut aux horizons automatiques.
- [ ] Revoir les seuils des neuf rangs seulement après observation de cycles
  Cadence, Qualité et Relation client réels.
