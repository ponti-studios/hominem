---
title: 'Retire the standalone Finance and Career apps'
status: 'Implemented'
priority: 'medium'
labels: [web, finance, career, deprecation]
depends_on: [web-subapp-finance, web-subapp-career-ai-flows]
blocks: []
estimated_size: 'M'
---

## Outcome

`apps/finance` and `apps/career` are gone, their custom domains are retired, and the monorepo, CI, and
documentation describe only the platform app.

## Acceptance criteria

- [x] `apps/finance` and `apps/career` directories, Dockerfiles, `validate-*.yml` workflows, and
      `dev:finance` / `dev:career` scripts removed.
- [x] `just/ui.just` `ui_consumers`, `vitest.workspace.ts`, `knip.json`, `.github/dependabot.yml`,
      `.claude/launch.json`, `.vscode/launch.json`, and `scripts/sync-worktree-env.sh` updated.
- [x] `AGENTS.md`, `docs/architecture.md`, `docs/type-system.md`, and the auth ADR no longer describe
      the retired apps as current.
- [x] Full repo gate passes with neither app present.
- [x] The old hostnames are retired: their custom domains were removed, so no redirect layer or
      service-worker migration is maintained.

## Decided

The custom domains were detached from the old deployments and retired, so there is nothing left to
redirect from. Compatibility is limited to `/p/:slug` (unchanged on the platform origin) and the auth
allowlist covering `/finance`, `/career`, and `/p`; everything else relies on the platform paths.

## Evidence

`pnpm run check` (31/31 turbo tasks, with both apps removed), `pnpm format:check`, `apps/web`'s 90 unit
tests, and the 17 browser journeys in `apps/web/tests/e2e/{career,finance}.spec.ts` passing against
the platform.
