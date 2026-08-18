# TODO — production d'images

Ce document distingue la production V4 active des lots historiques « Atelier
tamponné ». Le prompt courant vit dans
[`design-system.md`](design-system.md). Jamais de texte dans les images
d'interface ; les libellés restent en HTML et dans l'i18n.

## V4 — miniatures du Production Twin (actif)

Chaque machine est un objet isométrique unique sur **fond alpha réel**, sans
carte, sans contour de sticker et sans ombre rectangulaire cuite. Les masters
générés sont conservés ; un dérivé web est validé à la taille d'affichage avant
de remplacer le fallback historique.

Direction commune : acier peint bleu nuit, émail orange sécurité, rouleaux
métalliques/laiton, papier ivoire, accents CMJN mécaniques discrets, lumière
chaude, finition de miniature industrielle premium, pas de pixel art.

- [x] `building-reproOperator-v4.png` — opérateur repro et copieur compact
- [x] `building-reproWorkshop-v4.png` — atelier de reprographie multi-machines
- [x] `building-digitalPress-v4.png` — presse numérique industrielle
- [x] `building-offsetPress-v4.png` — presse offset et grandes bobines
- [x] `building-finishingWorkshop-v4.png` — massicot et plieuse industriels
- [x] `building-insertingLine-v4.png` — ligne automatisée de mise sous pli
- [x] `building-logistics-v4.png` — véhicule de livraison et bacs papier
- [x] `building-clientPortal-v4.png` — baie sécurisée et passage de document
- [x] `building-comBridge-v4.png` — hub omnicanal reliant des flux papier
- [x] `building-factory40-v4.png` — usine intelligente et bras robotisé
- [x] `building-pampyAI-v4.png` — assistant industriel IA et document contrôlé

Pour cocher un asset : vérifier le sujet, le détourage, l'absence de texte et de
watermark, le profil couleur, le poids du dérivé, puis son rendu sur fond nuit
et papier. Si WebP alpha est retenu, garder le PNG master et documenter le nom
du dérivé plutôt que d'écraser l'asset historique.

Lot V4 produit et contrôlé le 2026-08-18 : masters PNG alpha 512×512 dans
`assets/images/buildings-v4/sources/`, dérivés WebP alpha 512×512
`assets/images/building-<id>-v4.webp`, rendus vérifiés sur fond papier et fond
nuit. Le manifeste de production et le prompt-maître sont conservés avec les
masters.

## Lots historiques — « Atelier tamponné »

Les éléments ci-dessous restent disponibles comme fallbacks et archive de
production. Leur style bristol/sticker n'est plus le prompt-maître V4.

## Priorité 1 — matière du design system

- [x] `paper-grain-tile.webp` (512×512, tuile parfaitement raccordable)
      Seamless tileable paper texture, cream ivory cardstock #fdf8ec, subtle cotton fiber grain, very low contrast, flat top-down scan look, no creases, no stains, the texture must tile perfectly on all four edges
- [x] `kraft-tile.webp` (512×512, tuile raccordable)
      Seamless tileable kraft paper texture, warm tan #d9c29a, fine recycled paper fibers with tiny darker specks, matte, low contrast, flat scan, no folds, perfectly tileable edges
- [x] `ink-splat-sprites.png` (généré sur blanc puis détouré — gpt-image-2 ne fait pas de fond transparent) (planche 2×2, cellules 128×128, alpha)
      Sprite sheet of 4 different ink stamp splats on a fully transparent background, dark sepia brown ink #2a1a03, flat vector style, slightly distressed rubber stamp texture with tiny uneven edges and small satellite droplets, no gradients, no shadows, 4 splats arranged in a 2x2 grid
- [x] `seal-crest.png` (PNG alpha, détouré ; câblage prestige à faire en 0.18) (256×256, alpha — célébration de prestige)
      Round rubber stamp seal, distressed red ink #b3251e on fully transparent background, ornate double circle border with small typographic stars, in the center a minimalist paper stack icon with a crown, vintage bureaucratic office stamp style, slightly uneven ink coverage, flat 2D

## Priorité 2 historique — illustrations des bâtiments (stickers 128×128)

Style commun : `flat stationery sticker illustration of [SUJET], sepia ink
linework on a small cream cardstock die-cut sticker shape with a thin kraft
border, subtle paper grain, one gold accent maximum, transparent background`.

- [x] `building-reproOperator.webp` — SUJET : a friendly print-shop worker beside a small photocopier
- [x] `building-reproWorkshop.webp` — SUJET : a row of three aligned photocopiers with a binding machine
- [x] `building-digitalPress.webp` — SUJET : a large industrial digital printing press
- [x] `building-offsetPress.webp` — SUJET : a massive offset printing press with big paper rolls
- [x] `building-finishingWorkshop.webp` — SUJET : an industrial paper cutter and folding machine
- [x] `building-insertingLine.webp` — SUJET : an automated envelope inserting line conveyor
- [x] `building-logistics.webp` — SUJET : a delivery van loaded with parcel boxes
- [x] `building-clientPortal.webp` — SUJET : a secure server rack with a glowing document slot
- [x] `building-comBridge.webp` — SUJET : a communication hub with antennas linking two paper documents
- [x] `building-factory40.webp` — SUJET : a smart factory building with a subtle robotic arm holding a sheet of paper
- [x] `building-pampyAI.webp` — SUJET : a cute round robot assistant holding a stamped document


Note de production (2026-07-18) : lots P1 et P2 générés via gpt-image-2. Le
modèle ne supporte pas le fond transparent : les stickers embarquent le fond
bristol (affichés en vignettes bordées kraft), les éléments détourés (taches,
blason) sont générés sur blanc pur puis passés au chroma-key PIL.

## Priorité 3 — hauts faits (tampons-badges 96×96, alpha)

Style commun : `small round rubber stamp badge, distressed sepia ink #33261a on
transparent background, simple pictogram in the center, thin double border,
flat 2D, slightly uneven ink coverage`. Le visa rouge « débloqué » reste en CSS.
Étendu aux 16 hauts faits (les 11 de la 0.15 inclus) — tous générés et installés.

- [x] `achievement-firstDoc.png` — pictogramme : a single sheet of paper
- [x] `achievement-hundredDocs.png` — pictogramme : a small stack of paper sheets
- [x] `achievement-thousandDocs.png` — pictogramme : a tall pile of paper reaching upward
- [x] `achievement-firstBuilding.png` — pictogramme : a tiny factory silhouette
- [x] `achievement-firstPrestige.png` — pictogramme : a crown over a swirling arrow

## Priorité 4 — headers et key art

- [x] `key-art` — livré : recadré en 1200×630 et installé comme `social-card.jpg` (les balises og/JSON-LD pointaient déjà dessus)
      Wide key art: the lowpoly printing campus diorama at dusk seen from above, purple night sky #271c40 fading to #0b0617, warm golden windows, in the foreground a giant cream paper sheet and a red rubber stamp mid-air about to stamp, dramatic but playful, no characters' faces, flat lowpoly 3D style matching a three.js diorama
- [x] `docs-header.webp` (1600×400, stocké dans assets/images/ — intégration au site docs à faire)
      Wide banner: a flat lay of cream and kraft paper sheets, a rubber stamp, paper clips and a golden coin scattered on a dusk-purple desk surface #271c40, top-down scan aesthetic, calm composition with empty space in the middle for overlaid text

## Factory Key Art — 0.20

Assets générés avec le skill ImageGen intégré, puis convertis en WebP sans
réinterprétation locale :

- [x] `assets/brand/papers-empire-logo-v2.png` + `.webp` — lockup exact
      « PAPERS EMPIRE / IDLE GAME », plaque d'usine bleu nuit, lettres crème
      extrudées, tuyaux, couronne de papier dorée et ruban orange, fond navy.
- [x] `assets/images/hero-horizon-wide.webp` — horizon panoramique peint,
      lumière matinale à gauche, ville européenne distante, cour industrielle
      libre pour accueillir la scène Three.js.
- [x] `assets/images/hero-horizon-mobile.webp` — composition verticale dédiée,
      davantage de ciel et une zone centrale libre ; ce n'est pas un recadrage.
- [x] `assets/images/progression/step-{print,automate,research,produce,expand,prestige}.webp`
      — six objets industriels peints, détourés visuellement sur le même navy,
      sans libellé afin de garder l'i18n en HTML.

Direction de prompt commune : key art premium d'idle game, illustration peinte
isométrique, acier bleu, tuyaux orange, papier crème, or industriel, lumière
matinale chaude, texture imprimée subtile, lisible à petite taille, sans
watermark ni faux élément d'interface. Pour les horizons : espace calme à
gauche et cour vide au premier plan. Pour les étapes : un seul objet centré,
silhouette nette et fond navy uniforme.

## Plus tard (si la feature arrive)

- [ ] Icônes de compétences (arbre de compétences pas encore dans le jeu) —
      style à définir avec la feature, sans hériter automatiquement des tampons.
- [ ] Illustrations d'événements (les événements utilisent des emojis pour
      l'instant) — scènes/objets du production twin, un par type d'événement.
