# Guides de l’atelier — illustrations

Les trois images de production sont des WebP de 1200 × 630 px. Les masters
ImageGen restent dans ce répertoire `sources/` et sont exclus de l’archive
Cloudflare par le build.

## Direction commune

Références : logo peint Papers Empire, horizon de l’atelier, étape Recherche et
presse offset v4. Les références servent uniquement à retrouver le vocabulaire
visuel du jeu : miniature industrielle isométrique, acier émaillé bleu nuit,
orange de sécurité, laiton chaud, papier ivoire et voyants vert acide. Aucun
texte, logo, élément d’interface ou marque concurrente n’est intégré à l’image.

## Prompts

- `idle-clicker-incremental.webp` : progression cohérente de gauche à droite,
  d’une presse manuelle à une chaîne automatique puis à un réseau de production
  et des piles de papier grandissantes.
- `browser-idle-games.webp` : plusieurs ateliers génériques reliés sur un même
  sol d’usine, chacun évoquant un type de gestion différent sans reprendre
  l’image d’un jeu cité.
- `papers-empire-vs-paperclips.webp` : diptyque relié par un ruban de papier,
  avec une imprimerie chaleureuse à gauche et une machine abstraite faite de fil
  et de trombones à droite.

Génération : OpenAI ImageGen, 26 août 2026. Conversion WebP : `cwebp -q 84 -m 6
-resize 1200 630`.
