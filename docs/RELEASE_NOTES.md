# Release Notes

## 0.9 – Visual refresh & responsive signature (2026-04-24)
- Executed the website improvement plan with a new visual hero section in `index.html` (kicker/title/subtitle/CTA) plus a dedicated illustration asset (`assets/images/hero-press.svg`).
- Replaced key emoji-heavy UI elements with a cleaner icon direction: SVG icons for settings/print actions, neutral event banner status glyphs, and badge-style building icons.
- Updated core styling in `assets/css/style.css` to support a stronger art direction (hero gradients, icon system, improved card polish) while preserving mobile responsiveness.
- Extended all i18n bundles (FR/EN/DE/LB) with hero copy and removed emojis from primary structural labels to keep the interface visually consistent.
- Validated compatibility with existing unit test suites.

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
