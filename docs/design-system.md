# Design system V5 : Production Twin

Ce document décrit la direction de Papers Empire 0.24.0. Les règles visuelles
servent la lisibilité, le plaisir de jeu et la cohérence du monde. Si elles
cessent de le faire, elles changent.

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

### Logos peints sur fond transparent

La source canonique de Papers Empire reste le lockup peint
`assets/brand/papers-empire-logo-v2.png`. Son fond navy fait partie du fichier
source. Les surfaces qui ont déjà leur propre fond utilisent les dérivés
`papers-empire-logo-v2-cutout.png` et `.webp`. Ces fichiers conservent les
pixels peints et retirent seulement le fond autour du signe.

Les favicons et les icônes installables restent opaques. Leur fond plein évite
les défauts de recadrage des icônes `maskable`. Une surface HTML ou une plaque
Three.js suit la règle inverse : elle affiche le dérivé détouré directement,
sans carte arrondie, bordure ou second fond sous l'image. Une ombre portée peut
séparer le signe de son support, mais elle ne doit pas recréer un cadre.

La Data Science Zone possède un emblème contextuel sans devenir une marque
indépendante. Il conserve la couronne dorée, la matière peinte, les rouleaux,
le papier ivoire, l'acier nuit et la lumière du lockup canonique. Une unique
courbe cyan signale la mesure sans introduire un autre vocabulaire graphique.

- master peint conservé :
  `assets/brand/sources/data-science-zone-emblem-v2-master.png` ;
- dérivés opaques conservés : `assets/brand/data-science-zone-emblem-v2.png`
  et `.webp` ;
- dérivés détourés pour l'interface :
  `assets/brand/data-science-zone-emblem-v2-cutout.png` et `.webp` ;
- exploration initiale conservée :
  `assets/brand/sources/data-science-zone-concept.png` ;
- les répertoires `sources/` restent versionnés dans le dépôt mais sont exclus
  de l'archive publique ; seuls les dérivés utilisés partent en production ;
- le nom « Data Science Zone » reste du texte HTML déterministe et localisable ;
- les headers, footers et liens de la Data Science Zone utilisent son emblème,
  pas le lockup Papers Empire répété dans un cadre ;
- pas de cerveau, atome, base de données ou histogramme générique : le signe
  raconte la mesure d'une production de papier.

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
