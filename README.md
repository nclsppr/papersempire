# Papers Empire

All project documentation now lives inside the `docs/` directory and is published via Retype. Start with `docs/README.md` for the overview, and see `docs/AGENTS.md` for repo guidelines.

Current version: **0.26.0**.

[Play Papers Empire](https://papersempire.com/) — free in the browser, with no account required.

## Quick Links
- [Play the game](https://papersempire.com/)
- [Workshop Guides](https://papersempire.com/guides/)
- [Docs Overview](docs/README.md)
- [Developer Guide](docs/DOCUMENTATION.md)
- [Release Notes](docs/RELEASE_NOTES.md)
- [Game Design](docs/game-design.md)

## Deploy to Cloudflare Workers

Cloudflare is the only production delivery platform. The Worker serves the generated static
site on `papersempire.com`; `www.papersempire.com` returns a permanent redirect to the
canonical hostname.

1. create a branch and open a pull request to `main`;
2. wait for `Validate Cloudflare Worker`, then merge the pull request;
3. verify the Cloudflare build for the merged commit;
4. probe the canonical domain and a versioned asset before declaring the release active.

`wrangler.jsonc` is the source of truth for assets, custom domains, observability and Worker
compatibility. Cloudflare Workers Builds listens to `main`, runs
`npm run cloudflare:check`, then `npm exec wrangler deploy`.

## Development
- `npm run cloudflare:build && python3 -m http.server 8000 --directory site` – build and serve the complete static site locally.
- `npm ci` – install the locked documentation and Cloudflare tools.
- `npm run ui:check` – validate Safari/WebGL/cache and interaction resilience contracts.
- `npm run i18n:check` – validate exact key and placeholder parity across FR, EN, DE and LB.
- `npm run gameplay:check` – exercise progression, milestones, contracts and save migrations with pure Node tests.
- `npm run worker:check` – validate canonical redirects and security headers.
- `npm run seo:check` – validate the built multilingual metadata, canonicals, hreflang, sitemap and JSON-LD.
- `npm run docs:build` – build the static docs site with Retype (output in `docs-site/`).
- `npm run cloudflare:check` – run all release checks and a local Wrangler dry run.
- `npm run cloudflare:deploy` – build and deploy the current commit with Wrangler.

The repository has a focused Node resilience gate but no full browser suite;
also validate visual changes in a browser and run `node --check` on modified
JavaScript files.
