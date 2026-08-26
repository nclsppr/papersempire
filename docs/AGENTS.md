# Repository guidelines

Papers Empire is a static browser game. It has no application bundler or backend.

## Repository map

- `index.html` contains the landing page and the game.
- `dashboard/index.html` contains the Data Science Zone.
- `content/guides/index.mjs` is the single source for the four-language workshop guide catalog.
- `assets/css/style.css` contains the shared CSS foundations. `assets/css/experience-v4.css` contains the current interface layer.
- `assets/css/guides.css` contains the standalone long-form guide interface.
- `assets/js/` contains the game, dashboard, persistence, accessibility, events, tutorial, analytics, and Three.js modules.
- `assets/i18n/{fr,en,de,lb}.js` contains the translated game and dashboard interface strings.
- `assets/brand/` contains the active Papers Empire logo and Data Science Zone emblem. Source masters stay under `assets/brand/sources/`.
- `docs/` contains the Retype sources. Retype generates `docs-site/`; do not edit that directory.
- `scripts/` builds and validates the static release.
- `.github/workflows/` validates pull requests and publishes releases from `main`.

## Editing rules

- Keep runtime JavaScript in `assets/js/`. Do not move application logic back into `index.html`.
- Preserve the script order declared in the HTML entry points.
- When game or dashboard copy changes, update all four i18n catalogs and the matching static French fallback in the HTML. Keep all four guide translations together in `content/guides/index.mjs`.
- Do not rename building IDs, storage keys, or saved fields without a migration.
- Read `docs/design-system.md` before changing the interface or brand assets.
- Keep keyboard focus, reduced motion, high contrast, and 44 px touch targets working.
- Do not invent product claims, financial metrics, social proof, or future work.
- Write interface and documentation copy in direct, concrete sentences. Remove generic marketing language, decorative emoji, and filler headings.
- Keep image masters in a `sources/` directory. The public release excludes these directories.

## Local checks

Install the locked dependencies in a fresh checkout:

```sh
npm ci
```

Run the resilience and documentation checks:

```sh
npm run ui:check
npm run docs:build
git diff --check
```

Run `node --check` on each changed JavaScript file. For example:

```sh
node --check assets/js/app.js
```

Build and serve the complete release over HTTP for browser checks:

```sh
npm run cloudflare:build
python3 -m http.server 8000 --directory site
```

Test visual changes at desktop and mobile widths. Check normal and reduced motion, keyboard use, console errors, and horizontal overflow. The repository has no full browser suite.

## Documentation

- `docs/README.md` gives the current overview and release history.
- `docs/RELEASE_NOTES.md` is the canonical changelog.
- `docs/ROADMAP.md` contains current and planned product work.
- `docs/architecture.md` documents runtime behavior.
- `docs/game-design.md` documents mechanics.
- `docs/balance.md` documents the economy and Data Science Zone assumptions.
- `docs/design-system.md` documents interface and brand rules.

Write what the current code does. Put future work in the roadmap instead of copying speculative lists into several documents. Update the release notes and version history only for a release-sized change.

## Git and release rules

- `main` is protected. Work on a branch such as `codex/<topic>` and open a pull request to `main`.
- Follow the existing commit style: `feat:`, `fix:`, `docs:`, or `chore:` followed by a short imperative subject.
- Do not push directly to `main`.
- Merge only after `Validate Cloudflare Worker` passes and review comments are resolved.
- Cloudflare Workers Builds publishes the canonical `main` branch. Verify its build and the public domain before claiming that a release is active.
