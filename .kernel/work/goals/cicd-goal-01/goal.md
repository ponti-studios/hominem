---
id: cicd-goal-01
type: goal
title: Rock-solid CI/CD pipeline
status: active
created_at: 2026-05-15
updated_at: 2026-05-15
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Rock-solid CI/CD pipeline

## summary
Harden every layer of the hominem monorepo CI/CD pipeline so that a push to main results in deterministic builds, reliable deployments, and clear failure signals — with no silent breakage, version drift, or security gaps.

## problem / opportunity
The current pipeline works end-to-end but has several compounding fragility points: the web Dockerfile pins pnpm at `10.33.0` while the workspace requires `11.1.1`; there is no Dependabot config, no dependency-audit workflow, no release workflow, and no branch-protection enforcement in CI. The Railway deploy workflow uses a floating `:latest` container image. The `deploy-mobile` workflow bypasses the composite action and installs without `--frozen-lockfile`. The `deploy-db` workflow has no `permissions:` block and the goose version is hardcoded in two places. Turbo remote cache is not configured for GitHub Actions runs. These gaps mean a single bad day (stale cache, upstream image change, lockfile drift) can silently ship broken code or block an emergency deploy.

## success criteria
- Every workflow that runs `pnpm install` uses `--frozen-lockfile` and the composite action
- Both Dockerfiles install pnpm `11.1.1` (matching `packageManager` in root `package.json`)
- A `.dockerignore` exists at `apps/web/` that mirrors the thorough one at `services/api/`
- Railway CLI container is pinned to a specific digest or versioned tag, not `:latest`
- A `pnpm audit` workflow runs on push/PR and fails on high/critical vulnerabilities
- Dependabot is configured for GitHub Actions, npm, and Go dependencies
- A release workflow exists to tag and publish releases
- Turbo remote cache is wired up for CI runs via `TURBO_TOKEN` and `TURBO_TEAM`
- `deploy-db` has explicit `permissions: contents: read` and a `timeout-minutes`
- The goose version appears in exactly one place (composite action or justfile constant)
- All secrets referenced across workflows are documented and verified to exist
- The worker Railway config has a health check path (currently absent)

## scope
- `.github/workflows/*.yml` — all validate and deploy workflows
- `.github/actions/setup-pnpm-workspace/action.yml` — composite action
- `apps/web/Dockerfile` and `services/api/Dockerfile`
- `apps/web/.dockerignore` (new)
- `.github/dependabot.yml` (new)
- `.github/workflows/audit-deps.yml` (new)
- `.github/workflows/release.yml` (new)
- `turbo.json` remote cache configuration
- `services/api/worker/railway.json` — health check

## non-goals
- Changing the application code, business logic, or database schema
- Migrating away from Railway or pnpm
- Changing the Turbo task graph or adding new build targets

## task groups
### Docker hardening
- cicd-task-01: fix pnpm version drift in both Dockerfiles
- cicd-task-02: add .dockerignore for apps/web

### Workflow hardening
- cicd-task-03: fix deploy-mobile to use composite action + frozen-lockfile
- cicd-task-04: pin railway CLI container to versioned tag/digest
- cicd-task-05: add permissions + timeout to deploy-db workflow

### Observability and safety nets
- cicd-task-06: add dependency audit workflow (pnpm audit)
- cicd-task-07: add Dependabot configuration
- cicd-task-08: wire Turbo remote cache for CI

### Completeness
- cicd-task-09: add release workflow and worker health check

## linked knowledge
- `.kernel/knowledge/notes/cicd-note-01/note.md`

## journal
- 2026-05-15: Goal created from full audit of all workflows, Dockerfiles, Railway configs, and composite action.
