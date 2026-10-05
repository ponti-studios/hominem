---
name: hominem-workflow
description: Hominem monorepo workflow. Pre-push validation with `pnpm run check` and failure triage, and the Conventional Commits contract with the repo's scope conventions. Load the relevant reference below; use conventional-commit for the full generic commit spec. For starting local dev or choosing a validation command day to day, use hominem-development instead.
---

# Hominem Workflow

One skill covering the hominem monorepo's development workflow — validation and
commit conventions. Pick the reference that matches the task and follow it
end-to-end.

## References

| Task                                                                                            | Reference                  |
| ----------------------------------------------------------------------------------------------- | -------------------------- |
| Pre-push validation across all workspaces (`pnpm run check`, per-package filters, triage order) | `references/validation.md` |
| Conventional Commits message format + hominem scope list                                        | `references/commit.md`     |

## Cross-cutting rules

- **Validate before commit.** The full validation suite gates pushing to main.
- **Follow the Conventional Commits spec.** For the generic message format and
  edge cases, defer to `conventional-commit`.
- **Reuse the existing scope.** Take the scope for the area from recent history
  (`git log --oneline -20`); introduce a new one only when none fits.
