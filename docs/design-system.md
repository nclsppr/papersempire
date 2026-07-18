# Design system — « Atelier tamponné »

Le design system officiel de Papers Empire, choisi le 2026-07-17. Toute évolution
visuelle (CSS, assets, images générées) doit respecter ce document.

## Concept

Le décor reste la nuit de l'atelier : ciel crépusculaire violet, diorama three.js,
wordmark letterpress — intouchables. Tout ce qui se **manipule** devient un objet
de papeterie physique : fiches bristol crème opaques, boutons-tampons épais qui
s'écrasent au clic, étiquettes kraft, listings perforés, visas « APPROUVÉ ».
La parodie vient de la bureaucratie matérielle prise au sérieux.

## Tokens

La source de vérité est la couche `:root` de `assets/css/style.css`
(primitives historiques + couche sémantique + surcharges « Atelier tamponné »).
Ne jamais coder une couleur en dur dans un composant : consommer les tokens.

Palette de référence :

| Rôle | Token | Valeur |
|---|---|---|
| Bristol (faces des fiches) | `--paper-bright` | `#fdf8ec` |
| Papier ombré (plis, trames) | `--paper-shade` | `#eee3c9` |
| Kraft (étiquettes, onglets) | `--kraft` | `#d9c29a` |
| Encre principale | `--ink-strong` | `#33261a` |
| Encre diluée | `--ink-soft` | `#6b5b45` |
| Rouge tampon | `--stamp-red` | `#b3251e` |
| Or (monnaie, premium) | `--accent` | `#fbbf24` |
| Nuit de l'atelier | `--bg-sky` / `--bg-deep` | `#271c40` / `#0b0617` |

Règles clés :
- **Pas d'emoji dans le chrome d'action et de structure** (boutons, footer,
  navigation, titres de colonnes, jauges, hauts faits) : l'iconographie y
  passe par les stickers, tampons et SVG encrés générés (`images-todo.md`).
  **Exception : les surfaces de données** — les compteurs du panneau de stats
  et le tableau de bord (titre + tuiles KPI) gardent leurs emojis, qui y
  apportent de la lisibilité ludique sans casser la hiérarchie. Les emojis
  dynamiques des événements sont tolérés en attendant leurs illustrations.
- **Le kraft est un accent, jamais un fond de contrôle** : liserés
  (`--kraft-deep`), bordures, étiquettes. Les contrôles secondaires (onglets,
  navigation) vivent en `--paper-shade` ; seuls les boutons d'ACTION portent
  les couleurs fortes (or, vert, indigo, rouge).
- Les boutons sont GROS et assumés : socle 3D en `box-shadow` dur, écrasement
  au `:active` par `translateY` qui consomme la tranche. Jamais de bouton plat.
- Ombres toujours en 2 couches : tranche dure sans flou + portée douce.
- Chiffres et KPIs en chasse fixe (`--font-mono`), façon dactylographie.
- Motion : max 5 animations infinies simultanées, `prefers-reduced-motion` respecté.
- Contrastes AA minimum (encre/bristol ≈ 12,8:1) ; focus ring adapté au fond clair.
- Modes `pref-high-contrast` et `pref-large-text` toujours fonctionnels.

## Génération d'images — LE prompt-maître

Toute image générée pour le jeu (bâtiments, hauts faits, headers, textures,
compétences futures) DOIT composer avec ce prompt-maître pour garder la
cohérence. Structure : `[PROMPT-MAÎTRE] + [description spécifique de l'asset]`.

```
Papers Empire art style: vintage bureaucratic stationery aesthetic for a
satirical printing-factory idle game. Cream ivory cardstock (#fdf8ec) and warm
kraft paper (#d9c29a) surfaces, dark sepia ink (#33261a) linework,
administrative rubber-stamp red (#b3251e) accents, amber gold (#fbbf24)
highlights used sparingly. When a background or environment is needed, a
dusk-purple print-works night (#271c40 to #0b0617). Flat 2D scanned-paper
look, subtle cotton fiber grain, slightly distressed rubber-stamp edges,
clean simple shapes, soft even lighting, no photorealism, no gloss, no neon.
Strictly no letters, no words, no numbers in the image.
```

Contraintes non négociables :
1. **Jamais de texte dans les images** (l'i18n 4 langues passe par le HTML).
2. La palette ci-dessus, rien d'autre (pas de bleus/verts saturés hors tokens).
3. Fond transparent pour tout ce qui se pose sur une fiche ou le ciel ;
   fond nuit violette uniquement pour les headers/key art.
4. Style « objet scanné à plat » pour les éléments d'UI ; le rendu 3D lowpoly
   est réservé à la scène three.js (et au key art qui la met en scène).
5. Formats : WebP pour les opaques, PNG pour les transparents ; tailles en
   puissances de 2 quand c'est une tuile.

La liste des assets à générer vit dans [images-todo.md](images-todo.md).

## Stickers de bâtiments vs 3D (décision 2026-07-18)

Les 11 stickers de bâtiments restent les **illustrations dessinées** à la main
(caractère, personnalité) : décision de Nicolas. La cohérence avec le diorama
three.js passe par la **palette partagée** (crème/sépia/or, cf. 0.18.2), pas
par une identité pixel-à-pixel. Un pipeline de régénération existe (rendu
isométrique par bâtiment → API OpenAI edits) et fonctionne, mais n'est PAS
utilisé — ne pas remplacer les stickers dessinés sans nouvelle décision.

## Zones gelées

- Wordmark letterpress `.header-title` (pile de text-shadows violets).
- Scène three.js et ses recettes de bâtiments lowpoly.
- Overrides `.sky-dawn/.sky-day/.sky-night` et scrims figés.
- Bloc `.pref-high-contrast` (stylé à part, jamais routé par les tokens).
