---
name: hominem-workflow
description: >
  Hominem monorepo development workflow: pre-push validation via `pnpm run check`
  with failure triage, and the Conventional Commits message contract with the
  hominem scope list. Load the relevant reference below; use conventional-commit
  for the full generic commit spec. For starting local dev or choosing a
  validation command day-to-day, use hominem-development instead.
license: MIT
compatibility: Hominem monorepo.
metadata:
  author: project
  version: "1.0"
  category: Engineering
  tags:
    - hominem
    - build
    - validation
    - git
when:
  - running pre-push validation (pnpm run check) across the monorepo
  - triaging typecheck, lint, build, or test failures
  - crafting a commit message for the hominem monorepo
outputs:
  - Validation outcome or commit message per the loaded reference's workflow
termination:
  - Validation gates pass or the failure is triaged; commit message conforms to the spec
argumentHint: the validation or commit task in the hominem monorepo
---

# Kernel Hominem Workflow

One skill covering the hominem monorepo's development workflow — validation and
commit conventions. Pick the reference that matches the task and follow it
end-to-end.

## References

| Task | Reference |
| --- | --- |
| Pre-push validation across all workspaces (`pnpm run check`, per-package filters, triage order) | `references/validation.md` |
| Conventional Commits message format + hominem scope list | `references/commit.md` |

## Cross-cutting rules

- **Validate before commit.** The full validation suite gates pushing to main.
- **Follow the Conventional Commits spec.** For the generic message format and
  edge cases, defer to `conventional-commit`.
- **Scope from the list.** Use only the scopes in the commit reference; do not
  invent new ones.