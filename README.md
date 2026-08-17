# Papers Empire

All project documentation now lives inside the `docs/` directory and is published via Retype. Start with `docs/README.md` for the overview, and see `docs/AGENTS.md` for repo guidelines.

## Quick Links
- [Docs Overview](docs/README.md)
- [Developer Guide](docs/DOCUMENTATION.md)
- [Release Notes](docs/RELEASE_NOTES.md)
- [Game Design](docs/game-design.md)

## Development
- `python3 -m http.server 8000` – serve the static game locally.
- `npm install` – install the Retype documentation tool.
- `npm run docs:build` – build the static docs site with Retype (output in `docs-site/`).

There is currently no automated test suite in the repository; validate UI
changes in the browser and run `node --check` on modified JavaScript files.
