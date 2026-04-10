# Migration Notes

## What Changed

- `NoteService` and repository passthrough methods were reduced to keep only real orchestration.
- Env parsing moved to shared config packages.
- Shared hook logic moved into `packages/platform/hooks`.
- Archive now sets `archived_at` instead of deleting rows.
- Storybook/Vitest harnesses were tightened for the UI package.

## What To Check

- Update imports if you were reaching into deleted passthrough helpers.
- Expect archived notes to remain in the database but disappear from normal queries.
- Use the canonical `just` commands in `README.md` for local verification.

## Notes

This cleanup is structure-focused. Product behavior should remain the same unless the old code was buggy.
