# Domain Docs

This is a single-context repository. Engineering skills should consume domain documentation from the following locations:

- `GLOSSARY.md` at the repository root, when present.
- `docs/adr/` for architecture decision records relevant to the work.

If these files do not exist, proceed silently. The domain-modeling workflow creates them lazily when terminology or decisions are resolved.

Use the glossary's vocabulary in issue titles, refactor proposals, hypotheses, and test names. If an output contradicts an existing ADR, surface the conflict explicitly rather than silently overriding it.
