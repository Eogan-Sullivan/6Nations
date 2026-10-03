# Issue tracker: GitHub

Issues and specs for this repo live as GitHub Issues in `Eogan-Sullivan/6Nations`. Use the `gh` CLI for issue operations.

## Conventions

- Create an issue with `gh issue create --title "..." --body "..."`.
- Read an issue with `gh issue view <number> --comments`.
- List issues with `gh issue list`, adding appropriate state and label filters.
- Comment with `gh issue comment <number> --body "..."`.
- Apply or remove labels with `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close with `gh issue close <number> --comment "..."`.

Infer the repository from the GitHub remote; `gh` does this automatically inside this clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
