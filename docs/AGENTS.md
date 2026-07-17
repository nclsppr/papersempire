# Repository Guidelines

## Project Structure & Module Organization

- `index.html`: Main game entry point (HTML, CSS, JS in one file).
- `game-design.md`: Design notes, mechanics, and future ideas.
- `README.md`: High‑level overview and setup notes (now housed in `docs/`).
- Keep any new assets (images, audio, data) in a clearly named folder at the repo root (e.g., `assets/`, `data/`).

## Work Log & Versioning Expectations

- Each time you work on the project, record what you did and bump the version in the "Versioned Change History" section of `docs/README.md` when the change is meaningful.
- Use short, clear entries (e.g., `0.2 – add new character events`, `0.3 – balance printing jobs and rewards`).
- If you touch multiple areas, summarize them together in one version entry instead of creating many tiny versions.
- When a change represents a proper release (e.g., multiple features, major UX updates, or refactors), add a matching entry in `RELEASE_NOTES.md`. Document the release number, date, and a concise bullet list of highlights. Keep `README.md`’s history in sync with the same release number for quick reference.

## Build, Test, and Development Commands

- Open `index.html` directly in a browser for quick manual testing.
- For local static hosting, use any simple HTTP server (for example: `python -m http.server` from the repo root).
- Prefer testing in at least two browsers (e.g., Chrome + Firefox) when changing core gameplay or layout.

## Coding Style & Naming Conventions

- Use 2‑space indentation for HTML, CSS, and JavaScript.
- Favor descriptive names: `feedAnimalButton`, `habitatGrid`, `scoreDisplay` rather than `btn1` or `x`.
- Group related functions and logic together inside `index.html`; keep DOM queries near the top of the script section.
- When adding external files (e.g., `script.js`, `styles.css`), mirror the existing inline style and structure.

## Testing Guidelines

- There is no automated test suite, by choice: rely on quick manual checks in the browser.
- Before committing, verify: page loads without console errors, interactions respond as expected, and layout works at common viewport sizes.

## Commit Guidelines

- Use short, imperative commit messages (e.g., `feat: add habitat selector`, `fix: prevent negative food count`).
- Commit and push directly to `master` — no pull requests.
- Link to any relevant design notes in `game-design.md` and include screenshots or short clips for UI changes when possible.

## Understand the game design

- Each time you work on the project, if you need more details about the game design and its principles you can find it in `game-design.md` 
- If you have to change the principles of the game or you want to work on it, always document it there in `game-design.md` 
