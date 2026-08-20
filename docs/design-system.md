# Design system V5 — « Production Twin · Precision Pass »

Ce document formalise la direction de Papers Empire 0.23.1. Il remplace le
gel « Atelier tamponné » par un système **révocable et challengé** : une règle
visuelle est un choix de produit tant qu'elle améliore la lisibilité, le plaisir
de jeu et la cohérence du monde, jamais une vérité à préserver pour elle-même.

## Concept

Papers Empire est une **miniature industrielle illustrée et vivante**. Le même
atelier constitue l'affiche d'entrée, le terrain de jeu et la source des
analyses : c'est le **production twin**. Acier bleu nuit, émail orange, rouleaux
métalliques, papier ivoire et lumière chaude composent un monde de fabrication
précis, généreux et immédiatement identifiable.

La satire administrative demeure dans le ton et les situations. Elle n'oblige
plus chaque contrôle à ressembler à une fiche bristol ou à un tampon. Les
tampons, badges et papiers physiques sont réservés aux moments où leur sens est
réel : validation, succès, bon de commande, rapport ou archive.

## Contrat d'expérience

### La landing est un sas

La landing présente la promesse et permet d'entrer dans l'atelier. Elle n'est
pas une seconde interface conservée au-dessus du jeu.

- Avant la première entrée, l'affiche, sa navigation marketing et son rail
  narratif sont visibles ; la simulation, les événements, le tutoriel et
  l'autosauvegarde ne démarrent pas sur une sauvegarde vierge.
- « Entrer dans l'atelier » fait disparaître les surfaces marketing et révèle
  le jeu. L'intention de démarrage est persistée séparément de la vue courante.
- Une sauvegarde existante ouvre directement l'expérience de jeu. Un accès
  explicite à l'introduction peut réafficher le sas sans réinitialiser la partie.
- Dans le jeu, la scène reste présente sous une forme compacte : elle devient
  une carte de production interactive, pas une copie du hero.
- La navigation, le skip link et le focus suivent l'état visible ; aucun lien
  ou contrôle ne doit rester derrière une surface `hidden`, `inert` ou
  `aria-hidden`.

### Un monde, trois lectures

| Surface | Rôle | Densité |
| --- | --- | --- |
| Landing | Promesse, marque, spectacle | Cinématographique et éditoriale |
| Jeu | Décision, achat, progression | Compacte, tactile, orientée action |
| Data Science Zone | Explication et arbitrage | Analytique, traçable, sans décor gratuit |

La scène Three.js, les miniatures de machines et la Data Science Zone doivent
parler de la même usine. Une machine ne change pas arbitrairement de silhouette,
de palette ou de rôle entre ces trois lectures.

## Fondations visuelles

La source de vérité technique des tokens reste le CSS. Les noms exacts peuvent
évoluer avec l'implémentation, mais les rôles suivants doivent rester couverts :

| Rôle | Référence | Usage |
| --- | --- | --- |
| Nuit acier | `#07111f` à `#0c1b2d` | Chrome, plans profonds, Data Science Zone |
| Acier peint | `#28516a` | Châssis, panneaux, surfaces de contrôle |
| Orange sécurité | `#d7521b` | Action principale, tuyaux, signal de production |
| Papier ivoire | `#fdf8ec` | Feuilles, zones de lecture, contraste clair |
| Laiton chaud | `#d49a2a` | Détails premium et progression, avec parcimonie |
| Rendement positif | `#719746` | Gain, efficacité et état favorable uniquement |
| Encre | `#211b17` | Texte sur surfaces claires |

Principes :

- Les actions primaires sont orange, les gains mesurés sont verts et les
  surfaces analytiques sont acier/nuit. La couleur ne doit jamais être la seule
  porteuse d'information.
- Les nombres opérationnels utilisent une police à chasse fixe ; les titres de
  marque et de sections utilisent une graisse expressive, courte et lisible.
- Les cartes ne sont pas toutes équivalentes : échelle, rythme et hiérarchie
  suivent l'importance métier. Éviter les grilles de tuiles interchangeables.
- Les ombres, biseaux et reflets suggèrent une miniature peinte, sans produire
  de plastique générique ni de verre décoratif.
- Pas d'emoji dans le chrome d'action ou de structure. Les pictogrammes
  structurels restent vectoriels/code-native ; les illustrations raster portent
  les machines, les personnages et les scènes.
- Toute cible tactile structurante mesure au moins 44 × 44 px et consomme les
  safe areas iOS. Le focus visible, les modes fort contraste/grand texte et
  `prefers-reduced-motion` sont des invariants.
- Les transitions nomment leurs propriétés ; pas de `transition: all`. Les
  boucles décoratives s'arrêtent hors viewport, dans un onglet caché ou en
  mouvement réduit.

## Miniatures de machines

Les anciens stickers bristol ne sont plus la référence obligatoire. Les onze
bâtiments utilisent des miniatures isométriques illustrées sur fond alpha :
châssis acier bleu nuit, panneaux orange, rouleaux métal/laiton, papier
ivoire, lumière de studio chaude et détails CMJN discrets.

- Une miniature représente un seul sujet, avec silhouette nette à petite taille.
- Aucun texte, chiffre, watermark, carte ou ombre rectangulaire n'est cuit dans
  l'image ; les libellés et états restent en HTML traduisible.
- Les masters sont conservés. Les dérivés web utilisent PNG ou WebP alpha et un
  nom de version explicite ; ils ne détruisent pas les assets historiques.
- Les anciens stickers restent des fallbacks temporaires tant que leur
  remplacement n'est pas intégré et vérifié. Un mélange durable de deux styles
  dans une même liste n'est pas une destination acceptable.
- Les badges tamponnés restent pertinents pour les hauts faits et validations,
  pas comme langage universel de navigation.

Prompt de direction commun :

```text
Papers Empire production twin, premium illustrated industrial miniature,
isometric three-quarter view, deep navy painted steel chassis, safety-orange
enamel panels and pipes, warm brass and brushed-metal rollers, ivory paper,
subtle CMYK mechanical details, warm studio key light, readable silhouette,
transparent background, no base card, no text, no letters, no numbers, no
watermark, no photorealism, no pixel art.
```

La liste de production et l'état de chaque asset vivent dans
[images-todo.md](images-todo.md).

## Scène Three.js

La scène n'a plus pour cible un rendu « pixel art » ou low-poly volontairement
rudimentaire. Elle vise la même miniature industrielle que les illustrations,
avec géométries procédurales biseautées, cylindres suffisamment lisses,
matériaux PBR partagés, métal/roughness cohérents et éclairage chaud contrôlé.

Contrat technique :

- lecture seule de l'état du jeu ; une interaction canvas passe par les mêmes
  règles d'achat que le DOM et n'est active qu'en mode jeu ;
- enrichissement progressif et fallback DOM/CSS complet sans WebGL ;
- pas de double horizon procédural devant le matte painting du hero ;
- géométries et matériaux partagés ou mis en cache ; décor répétitif instancié ;
- budget iPhone cible : au plus 50 draw calls, 80 000 triangles et environ
  16 Mo de textures ; DPR 1 et 30 fps acceptés, sans ombres temps réel ni
  post-traitement mobile ;
- rendu suspendu hors viewport/onglet caché et rendu à la demande en mouvement
  réduit.

Ces chiffres sont des budgets de conception à mesurer pendant la validation ;
ils ne constituent pas, à eux seuls, une preuve de performance obtenue.

## Data Science Zone

La page historiquement nommée Dashboard devient **Data Science Zone**. Son
esthétique est celle d'une salle de contrôle du production twin, et sa fonction
est d'aider à décider :

- cadence DOC/s et confiance CC/s ;
- coût du prochain exemplaire et temps d'accessibilité à cadence constante ;
- gain marginal DOC/s et CC/s simulé à quantité +1 ;
- délai de retour exprimé en DOC, jamais en argent réel ;
- contribution observée des sources de production ;
- évolution locale des jauges et perspective de prestige ;
- archive bornée des runs et couverture de mesure clairement indiquée.

Chaque projection expose ses hypothèses. `DOC` est à la fois production et
monnaie interne : il ne s'agit ni de chiffre d'affaires, ni de marge, ni de
rentabilité comptable. La télémétrie reste locale au navigateur, partielle après
migration ou effacement du stockage, et ne permet aucune comparaison entre
joueurs. Aucun indicateur synthétique ne doit masquer ces limites.

### Sous-marque « Crown Analyzer »

La Data Science Zone possède une signature propre sans devenir une marque
indépendante. Son emblème conserve la couronne de feuilles de Papers Empire et
la monte sur un analyseur de production : rouleaux, feuille alimentée et une
unique courbe cyan. Le cyan signale la mesure ; le laiton, l'ivoire, l'orange
sécurité et l'acier nuit maintiennent la filiation avec l'usine.

- source vectorielle livrée : `assets/brand/data-science-zone-mark.svg` ;
- exploration peinte conservée :
  `assets/brand/sources/data-science-zone-concept.png` ;
- les répertoires `sources/` restent versionnés dans le dépôt mais sont exclus
  de l'archive publique ; seuls les dérivés utilisés partent en production ;
- le nom « Data Science Zone » reste du texte HTML déterministe et le sous-titre
  reste localisable ;
- le favicon et la marque produit globale restent Papers Empire ;
- pas de cerveau, atome, base de données ou histogramme générique : le signe
  doit raconter la mesure d'une production de papier.

## Ce qui est invariant, ce qui est révocable

Invariants produit :

- vérité des données et absence de métriques sociales ou financières inventées ;
- identifiants de bâtiments et compatibilité des sauvegardes ;
- scène en lecture seule, amélioration progressive et fallback fonctionnel ;
- accessibilité clavier/tactile, i18n HTML et préférences utilisateur ;
- conservation des sources canoniques lors d'une exploration de marque.

Décisions révocables :

- palette précise, typographies, profondeur des biseaux et niveau de grain ;
- composition de la landing et densité de la carte de production ;
- traitement d'une miniature, d'un badge ou d'un effet ;
- toute métaphore décorative, y compris fiches, stickers et tampons.

Une évolution de ces décisions doit être documentée, testée dans les états
landing/jeu/Data Science Zone et comparée à l'objectif produit, sans devoir
obtenir une exception à une ancienne « zone gelée ».
