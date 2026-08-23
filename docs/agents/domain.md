# Domain docs

This convention tells the engineering skills how to read domain documentation before exploring the code.

## Read before exploration

- Read `CONTEXT.md` at the repository root when it exists.
- Read the ADRs under `docs/adr/` that affect the area being changed.

If a file or glossary is missing, continue without flagging it or suggesting that it be created. The `/domain-modeling` skill creates these sources only when a term or decision needs to be recorded.

## Structure

This repository uses one context:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-example.md
│       └── 0002-example.md
└── assets/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test, use the term defined in `CONTEXT.md`. Do not replace it with a synonym that the glossary rejects.

If the concept is missing, first check that the product actually needs it. Report a real vocabulary gap to `/domain-modeling`.

## Flag conflicts with an ADR

If a proposal contradicts an accepted ADR, name the conflict instead of silently replacing the decision. For example:

> This proposal contradicts the accepted decision named above. Reopening it requires a new decision with its trade-offs recorded.
