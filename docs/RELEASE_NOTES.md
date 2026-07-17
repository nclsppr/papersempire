# Release Notes

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
