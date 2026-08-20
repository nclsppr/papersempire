# Papers Empire

All project documentation now lives inside the `docs/` directory and is published via Retype. Start with `docs/README.md` for the overview, and see `docs/AGENTS.md` for repo guidelines.

Current release contract: **0.23.2 — Canonical Brand Pass V5**.

## Quick Links
- [Docs Overview](docs/README.md)
- [Developer Guide](docs/DOCUMENTATION.md)
- [Release Notes](docs/RELEASE_NOTES.md)
- [Game Design](docs/game-design.md)

## Deploy to Atlas

A normal game or documentation release does not require a `vps-infra` code or contract
change:

1. create a branch in this repository and open a pull request to `main`;
2. wait for `Validate VPS release`, then merge the pull request;
3. verify that the merged commit's
   [`VPS release`](https://github.com/nclsppr/papersempire/actions/workflows/vps-release.yml)
   run succeeds;
4. wait for the next central reconciliation. It is scheduled every ten minutes, but GitHub
   Actions can delay scheduled runs. Atlas activates the new digest only while the canonical
   HEAD, required checks, attestations, and probes remain valid.

After the producer release is green, request an immediate reconciliation without changing a
file or supplying a SHA or digest:

```sh
gh workflow run deploy-static-releases.yml \
  --repo nclsppr/vps-infra \
  --ref main
```

That dispatch checks Papers Empire, Personal, and the static Parkventory demo. Unchanged
tuples are no-ops. Edit `vps-infra` only to change deployment policy, required checks, Caddy
integration, or a profile's enablement, never for a normal content release. See the
[central runbook](https://github.com/nclsppr/vps-infra/blob/main/docs/operations/static-release-reconciliation.md)
for incident diagnosis, rollback, quarantine, and key rotation.

## Development
- `python3 -m http.server 8000` – serve the static game locally.
- `npm install` – install the Retype documentation tool.
- `npm run ui:check` – validate Safari/WebGL/cache and interaction resilience contracts.
- `npm run docs:build` – build the static docs site with Retype (output in `docs-site/`).

The repository has a focused Node resilience gate but no full browser suite;
also validate visual changes in a browser and run `node --check` on modified
JavaScript files.
