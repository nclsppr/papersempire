# TODO — assets images à générer

Checklist des images à produire pour « Atelier tamponné ». Chaque prompt se
compose ainsi : **prompt-maître** (voir [design-system.md](design-system.md))
**+ le prompt spécifique ci-dessous**. Jamais de texte dans les images.
Destination : `assets/images/` avec le nom de fichier indiqué.

## Priorité 1 — matière du design system

- [ ] `paper-grain-tile.webp` (512×512, tuile parfaitement raccordable)
      Seamless tileable paper texture, cream ivory cardstock #fdf8ec, subtle cotton fiber grain, very low contrast, flat top-down scan look, no creases, no stains, the texture must tile perfectly on all four edges
- [ ] `kraft-tile.webp` (512×512, tuile raccordable)
      Seamless tileable kraft paper texture, warm tan #d9c29a, fine recycled paper fibers with tiny darker specks, matte, low contrast, flat scan, no folds, perfectly tileable edges
- [ ] `ink-splat-sprites.png` (planche 2×2, cellules 128×128, alpha)
      Sprite sheet of 4 different ink stamp splats on a fully transparent background, dark sepia brown ink #2a1a03, flat vector style, slightly distressed rubber stamp texture with tiny uneven edges and small satellite droplets, no gradients, no shadows, 4 splats arranged in a 2x2 grid
- [ ] `seal-crest.webp` (256×256, alpha — célébration de prestige)
      Round rubber stamp seal, distressed red ink #b3251e on fully transparent background, ornate double circle border with small typographic stars, in the center a minimalist paper stack icon with a crown, vintage bureaucratic office stamp style, slightly uneven ink coverage, flat 2D

## Priorité 2 — illustrations des bâtiments (stickers 128×128, alpha)

Style commun : `flat stationery sticker illustration of [SUJET], sepia ink
linework on a small cream cardstock die-cut sticker shape with a thin kraft
border, subtle paper grain, one gold accent maximum, transparent background`.

- [ ] `building-reproOperator.png` — SUJET : a friendly print-shop worker beside a small photocopier
- [ ] `building-reproWorkshop.png` — SUJET : a row of three aligned photocopiers with a binding machine
- [ ] `building-digitalPress.png` — SUJET : a large industrial digital printing press
- [ ] `building-offsetPress.png` — SUJET : a massive offset printing press with big paper rolls
- [ ] `building-finishingWorkshop.png` — SUJET : an industrial paper cutter and folding machine
- [ ] `building-insertingLine.png` — SUJET : an automated envelope inserting line conveyor
- [ ] `building-logistics.png` — SUJET : a delivery van loaded with parcel boxes
- [ ] `building-clientPortal.png` — SUJET : a secure server rack with a glowing document slot
- [ ] `building-comBridge.png` — SUJET : a communication hub with antennas linking two paper documents
- [ ] `building-factory40.png` — SUJET : a smart factory building with a subtle robotic arm holding a sheet of paper
- [ ] `building-pampyAI.png` — SUJET : a cute round robot assistant holding a stamped document

## Priorité 3 — hauts faits (tampons-badges 96×96, alpha)

Style commun : `small round rubber stamp badge, distressed sepia ink #33261a on
transparent background, simple pictogram in the center, thin double border,
flat 2D, slightly uneven ink coverage`. Le visa rouge « débloqué » reste en CSS.

- [ ] `achievement-firstDoc.png` — pictogramme : a single sheet of paper
- [ ] `achievement-hundredDocs.png` — pictogramme : a small stack of paper sheets
- [ ] `achievement-thousandDocs.png` — pictogramme : a tall pile of paper reaching upward
- [ ] `achievement-firstBuilding.png` — pictogramme : a tiny factory silhouette
- [ ] `achievement-firstPrestige.png` — pictogramme : a crown over a swirling arrow

## Priorité 4 — headers et key art

- [ ] `key-art.webp` (1200×630 — future carte sociale illustrée, remplacera la capture)
      Wide key art: the lowpoly printing campus diorama at dusk seen from above, purple night sky #271c40 fading to #0b0617, warm golden windows, in the foreground a giant cream paper sheet and a red rubber stamp mid-air about to stamp, dramatic but playful, no characters' faces, flat lowpoly 3D style matching a three.js diorama
- [ ] `docs-header.webp` (1600×400 — bandeau du site de docs)
      Wide banner: a flat lay of cream and kraft paper sheets, a rubber stamp, paper clips and a golden coin scattered on a dusk-purple desk surface #271c40, top-down scan aesthetic, calm composition with empty space in the middle for overlaid text

## Plus tard (si la feature arrive)

- [ ] Icônes de compétences (arbre de compétences pas encore dans le jeu) —
      même style que les hauts faits, pictogrammes à définir avec la feature.
- [ ] Illustrations d'événements (les événements utilisent des emojis pour
      l'instant) — stickers 96×96, un par type d'événement.
