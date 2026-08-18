# Release Notes

## 0.20 – « Factory Key Art » : le monde devient l'affiche

- Nouveau lockup illustré généré pour Papers Empire : plaque industrielle bleu
  nuit, lettres crème, couronne de papier et ruban orange, avec PNG master et
  WebP de production.
- Hero hybride : horizon peint desktop/mobile derrière un campus Three.js
  transparent, usine centrale agrandie, lumière plus cinématographique et HUD
  vertical toujours relié aux vraies données du jeu.
- Nouveau rail narratif en papier déchiré avec six illustrations originales,
  catalogue de progression et preuves produit honnêtes avant l'interface de jeu.
- Composition resserrée pour faire apparaître la progression dès le premier
  écran desktop, tout en conservant les variantes mobile, contraste élevé,
  mouvement réduit et fallback sans WebGL.
- Textes du nouveau rail disponibles en français, anglais, allemand et
  luxembourgeois ; aucun chiffre social ou classement fictif n'a été ajouté.

## 0.19 – « Empire World » : l'affiche devient jouable

- Nouveau système de marque vectoriel : couronne de ramette, lockup tracé,
  favicon et icônes installables issus du même symbole.
- Hero plein cadre inspiré des affiches d'idle games, mais alimenté par les
  vraies données : CTA d'impression, documents, DOC/s, prestige et culture.
- Campus three.js visible dès une sauvegarde vierge grâce à un printworks
  décoratif non productif, skyline, nuages, routes, lampadaires, palettes,
  piles de papier et véhicules de service.
- Canvas transparent, éclairage PBR léger, brouillard et ACES sans dépendance
  ni post-traitement lourd ; état vierge mesuré à 27 appels et 4 388 triangles.
- Responsive 390 px sans débordement, quatre langues, contraste élevé,
  mouvement réduit et désactivation de la scène revérifiés.

## 0.12 – « Atelier tamponné » : le re-skin parodique
- Nouveau design system complet : le décor crépusculaire et le diorama three.js restent la nuit de l'atelier, tout ce qui se manipule devient papeterie physique (fiches bristol à coin corné, boutons-tampons avec socle 3D et écrasement au clic, étiquettes kraft, réglettes, post-its).
- Visas « APPROUVÉ » tamponnés sur les succès débloqués, traduits en 4 langues (GUTTGEHEESCHT inclus).
- Dashboard façon rapport dactylographié : tuiles KPI en chasse fixe, courbe encre, barres kraft, baromètres.
- Accessibilité vérifiée par calcul : contrastes AA partout (encre/bristol 13,8:1), focus ring brun sur papier, prefers-reduced-motion, mode high-contrast re-testé ; budget motion : 1 seule animation infinie.
- Toute référence VBS / Victor Buck Services / VPlatform retirée du jeu et des docs ; identifiants renommés (`brandImage`, `clientPortal`) avec migration automatique des sauvegardes.
- Nouveaux documents : `design-system.md` (règles + prompt-maître de génération d'images), `images-todo.md` (backlog d'assets), `ROADMAP.md` (mandat produit, multi-pages désormais permis).

## 0.7 – UX polish & Accessibility
- Added a full settings modal (Accessibility, Audio, Interface, Save tabs) with persisted toggles, gear shortcut, and Playwright coverage.
- Implemented guided tutorial overlay (`tutorial.js`) that highlights print → buildings → journal → settings and records completion in preferences.
- Wired `ui-effects.js` to provide click/purchase particles plus Web Audio cues, including a confetti celebration for the priciest building.
- Extended i18n dictionaries with the new labels in FR/EN/DE/LB and added `tests/settings.test.js` + `tests/playwright/tutorial.spec.ts` to keep the UX regression-free.
- Refreshed the accessibility documentation with the new flow (including Mermaid diagram) and documented the module architecture in `DOCUMENTATION.md`.

## 0.6 – Multilingual Mobile Refresh
- Externalised the i18n catalog into individual language bundles and added German + Luxembourgish translations alongside French and English.
- Rebuilt the layout for mobile devices: sticky header, centred grid, ripple feedback on the print button, and Playwright layout tests targeting iPhone 15 Pro Max ensure alignment.
- Added Playwright + Node test scripts via `package.json` and configured CI-ready commands for both unit and layout checks.

Refer to previous versions in `README.md` for earlier milestones. Create a new section below for each future release.
