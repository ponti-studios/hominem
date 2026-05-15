---
id: cicd-task-05
type: task
title: Harden deploy-db workflow and centralise goose version
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Harden deploy-db workflow and centralise goose version

## summary
`deploy-db.yml` is missing a `permissions:` block (it should be `contents: read` like `validate-db.yml` has), has no `timeout-minutes` on the job, and hardcodes `goose@v3.27.0`. The same goose version is also hardcoded in `justfile/db.just` as a default argument. A single source of truth should exist for the goose version — ideally a constant in `db.just` that both `db.just` and the CI workflow can reference, or an env var at the top of the workflow.

Additionally, the `validate-api.yml` workflow uses `just db-setup` which internally calls `just goose-install`, but the workflow also sets up Go separately. The goose install in `validate-api.yml` does not use the `goose-install` just target — it calls Go directly via the workflow step in `deploy-db.yml`. This creates a third copy of the goose version.

## context
- `deploy-db.yml` line 35: `go install github.com/pressly/goose/v3/cmd/goose@v3.27.0`
- `justfiles/db.just` line 3: `goose-install goose-version="v3.27.0":` (default arg)
- `deploy-db.yml` has no `permissions:` block (all other deploy workflows have it)
- `deploy-db.yml` has no `timeout-minutes` on the job
- The `validate-db.yml` workflow has `permissions: contents: read` (correctly)
- `validate-api.yml` uses `just db-setup` which calls `just goose-install` — this is the correct pattern

## acceptance criteria
- [ ] `deploy-db.yml` has `permissions: contents: read` at the workflow or job level
- [ ] `deploy-db.yml` has `timeout-minutes: 30` on the `deploy-db-migrations` job
- [ ] The goose version appears in exactly one authoritative location; `deploy-db.yml` reads from it via an env var or just target
- [ ] The `deploy-db.yml` workflow uses `just db-setup` (or the equivalent just target) instead of raw `go install` + manual goose invocation, to stay in sync with how `validate-api.yml` runs migrations
- [ ] After the change, a `workflow_dispatch` on `deploy-db` succeeds against a real DATABASE_URL

## steps
1. Open `.github/workflows/deploy-db.yml`.
2. Add at the top level (after `on:`):
   ```yaml
   permissions:
     contents: read
   ```
3. Add `timeout-minutes: 30` to the `deploy-db-migrations` job.
4. Replace the `setup-go` + `install-goose` + `apply-database-migrations` steps with the composite action + just pattern already used in `validate-api.yml`:
   ```yaml
   - name: setup-pnpm-workspace
     uses: ./.github/actions/setup-pnpm-workspace
     with:
       node-version: '24.14.1'

   - name: setup-go
     uses: actions/setup-go@v5
     with:
       go-version: '1.22'

   - name: run-database-migrations
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL }}
     run: just db-setup production
   ```
   (The `db-setup` just target already handles goose install internally with the canonical version from `db.just`.)
5. Ensure `justfiles/db.just` `goose-install` default version is the single source of truth. Remove the hardcoded version from the workflow.
6. Commit: `fix(ci): harden deploy-db permissions, timeout, and goose version`

## dependencies
- `justfiles/db.just` `db-setup` target must accept `production` as environment arg and handle non-test DATABASE_URL (it already does — the `environment` param controls the fallback URL, not the actual URL used when DATABASE_URL is set).

## journal
- 2026-05-15: Created from audit. Three copies of goose version string and missing permissions block identified.
