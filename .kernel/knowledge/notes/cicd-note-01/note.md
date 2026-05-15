---
id: cicd-note-01
type: note
title: CI/CD audit findings — hominem monorepo (2026-05-15)
status: active
created_at: 2026-05-15
updated_at: 2026-05-15
linked_work:
  - .kernel/work/goals/cicd-goal-01/goal.md
---

# CI/CD audit findings — hominem monorepo (2026-05-15)

## summary
Full audit of all GitHub Actions workflows, the composite setup action, both Dockerfiles, all Railway configs, `.npmrc`, `pnpm-workspace.yaml`, `turbo.json`, and the root `package.json`. Findings are grouped by severity.

## what is already correct (do not re-plan)
- `pnpm/action-setup@v4` runs BEFORE `actions/setup-node@v4` in the composite action — required ordering for pnpm 11 self-installer
- pnpm pinned to `11.1.1` in composite action, all validate workflows, and root `package.json`
- `.npmrc` has `confirm-modules-purge=false` — fixes Railway no-TTY install failures
- Both Dockerfiles use multi-stage builds (builder + release/server stages)
- Both Dockerfiles run the application as a non-root user (`apiuser` / `webuser`, uid 1001)
- Both Dockerfiles copy `pnpm-lock.yaml` before source files — correct layer ordering for cache efficiency
- Both Dockerfiles have `HEALTHCHECK` instructions
- `services/api/Dockerfile` has a comprehensive `.dockerignore`
- All `validate-*.yml` workflows use the composite action and inherit `--frozen-lockfile` by default
- All deploy workflows have `concurrency:` groups with `cancel-in-progress: true`
- `deploy-api.yml`, `deploy-web.yml`, `deploy-workers.yml` use the reusable `railway-deploy-service.yml` pattern — DRY
- `validate-api.yml` and `validate-db.yml` have `permissions: contents: read`
- Railway configs for API and web have proper health checks, overlap/draining seconds, and restart policies
- pnpm-workspace.yaml has strong security settings: `verifyStoreIntegrity`, `strictStorePkgContentCheck`, `minimumReleaseAge`, `blockExoticSubdeps`, `strictDepBuilds`
- `turbo.json` properly defines `globalDependencies`, `globalEnv`, task `inputs`/`outputs`, and dependency graph
- `validate-api.yml` uses a matrix for node version (future-proof for multi-version testing)
- Health check in `services/api/Dockerfile` uses the correct `/api/status` path matching `railway.json`

## critical findings (high priority)

### C1 — pnpm version drift in Dockerfiles
Both `apps/web/Dockerfile` and `services/api/Dockerfile` install `pnpm@10.33.0` in all stages (builder and runtime). The workspace `packageManager` field requires `pnpm@11.1.1` and `engine-strict=true` is set in `.npmrc`. The Docker builds are using a different major version of pnpm than the lockfile was generated with.
- Affected files: `apps/web/Dockerfile` (lines 22, 36), `services/api/Dockerfile` (lines 19, 34)
- Task: cicd-task-01

### C2 — deploy-mobile bypasses composite action and frozen-lockfile
`deploy-mobile.yml` manually sets up pnpm and Node instead of using `.github/actions/setup-pnpm-workspace`. It runs `pnpm install` without `--frozen-lockfile`. This means: (a) no pnpm store cache is used, (b) the lockfile is not enforced, (c) the workflow is not covered by any future improvements to the composite action.
- Affected file: `.github/workflows/deploy-mobile.yml`
- Task: cicd-task-03

### C3 — Railway CLI container uses floating :latest tag
`railway-deploy-service.yml` runs jobs inside `container: ghcr.io/railwayapp/cli:latest`. Any upstream Railway CLI release silently changes which binary performs deploys.
- Affected file: `.github/workflows/railway-deploy-service.yml`
- Task: cicd-task-04

### C4 — No dependency audit workflow
No workflow runs `pnpm audit`. Known CVEs in transitive dependencies are not caught before they reach main.
- Task: cicd-task-06

## moderate findings (medium priority)

### M1 — apps/web has no .dockerignore
The root `.dockerignore` is minimal (9 lines). `apps/web/Dockerfile` has no sibling `.dockerignore`. The web build context includes test files, coverage, IDE config, storybook artifacts, and other noise.
- Affected: `apps/web/` (missing file)
- Task: cicd-task-02

### M2 — deploy-db missing permissions block and timeout; goose version duplicated
`deploy-db.yml` has no `permissions:` block (every other deploy workflow has `permissions: contents: read`). The job has no `timeout-minutes`. The goose version `v3.27.0` appears in `deploy-db.yml` AND `justfiles/db.just` as separate hardcoded strings.
- Affected: `.github/workflows/deploy-db.yml`, `justfiles/db.just`
- Task: cicd-task-05

### M3 — No Dependabot configuration
No `.github/dependabot.yml`. GitHub Actions versions, npm packages, and Docker base images drift without automated PRs.
- Task: cicd-task-07

### M4 — Turbo remote cache not configured for CI
`turbo.json` is complete, but `TURBO_TOKEN` and `TURBO_TEAM` are not passed in any `validate-*.yml` workflow. Every CI run rebuilds all affected packages from scratch.
- Task: cicd-task-08

## low-priority / missing features

### L1 — No release workflow
There is no `.github/workflows/release.yml`. Deploys happen continuously but there is no versioned GitHub Release, tag, or changelog.
- Task: cicd-task-09 (part 1)

### L2 — Worker Railway config has no health check
`services/api/worker/railway.json` uses `restartPolicyType: ALWAYS` but has no `healthcheckPath`. Railway cannot verify the worker started successfully after a deploy.
- Task: cicd-task-09 (part 2)

### L3 — validate-api.yml uses a custom postgres image
`validate-api.yml` and `validate-db.yml` use `ghcr.io/${{ github.repository }}/postgres:latest` as the service container. This requires a custom Postgres image to be published to the repo's GHCR. If that image is not published or is also floating `:latest`, test DB setup will silently fail or use stale schema. Consider using `postgres:16-alpine` from Docker Hub directly, or ensure the custom image publication is tested separately.
- Not assigned a task — investigate whether the custom image is intentional (e.g. includes extensions) before acting.

### L4 — validate-web.yml has no build step before typecheck
`validate-web.yml` runs `just typecheck` which invokes `pnpm exec turbo run typecheck`. Turbo's typecheck task `dependsOn: ["^build"]` — so it will build workspace packages first. This is correct by design, but means the validate-web job builds packages even when only checking types. If remote cache is enabled (cicd-task-08), this becomes a non-issue.

### L5 — No branch protection enforcement in CI
There is no workflow or CODEOWNERS file enforcing branch protection rules. Branch protection settings exist only in the GitHub UI and are not codified or audited in the repository.

### L6 — eas-cli installed as global npm package without version pin
`deploy-mobile.yml` runs `npm install -g eas-cli` without a version pin. EAS CLI breaking changes could silently affect iOS builds.
- Fixed as part of cicd-task-03.

## architecture observations
- The `workflow_run` trigger pattern (deploy runs only after validate succeeds) is solid — avoids deploying from failed tests
- The `checkout_ref: ${{ github.event.workflow_run.head_sha || github.sha }}` pattern is correct — ensures deploy uses the exact SHA that validated, not a newer commit that may have arrived
- `railway-deploy-service.yml` as a reusable workflow is the right abstraction — three deploy workflows share it cleanly
- The pnpm store cache key `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}` with restore-key fallback `${{ runner.os }}-pnpm-store-` is correct — hits on lockfile match, partial hit on OS match
- Both Dockerfiles correctly use `--filter @hominem/<service>...` (with `...` suffix) so pnpm only installs the dependency tree needed for that service

## secret inventory
Secrets referenced across all workflows:
- `RAILWAY_TOKEN` — Railway deployment token (deploy-api, deploy-web, deploy-workers via railway-deploy-service)
- `RAILWAY_SERVICE_API` — Railway service ID for the API (deploy-api)
- `RAILWAY_SERVICE_WEB` — Railway service ID for the web app (deploy-web)
- `RAILWAY_SERVICE_WORKERS` — Railway service ID for workers (deploy-workers)
- `DATABASE_URL` — Production database URL (deploy-db)
- `EXPO_TOKEN` — Expo/EAS authentication token (deploy-mobile)
- `GITHUB_TOKEN` — Implicit, available automatically

No hardcoded secrets or credentials were found in any workflow file.

## linked work
- `.kernel/work/goals/cicd-goal-01/goal.md`
- Tasks: cicd-task-01 through cicd-task-09
