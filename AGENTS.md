# Repository guidelines

## Agent skills

### Issue tracker

Issues and specs live in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical labels without local aliases. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single context, with `CONTEXT.md` at the root and ADRs under `docs/adr/`. See `docs/agents/domain.md`.

## Atlas secrets

- Any task that plans or requires deploying, rotating, or revoking a secret on Atlas must also update `nclsppr/vps-infra` before completion. Add or update the secret in `secrets/registry.json`, the canonical registry required to rebuild Atlas from a fresh host. Commit only the contract and non-secret metadata, never the value, a value-derived digest, a decrypted file, or a private source path. If the task does not authorize the `vps-infra` change, report the blocker and do not claim completion.
