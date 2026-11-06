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

`apps/finance` and `apps/career` are gone, their hostnames permanently redirect to the platform, and
the monorepo, CI, and documentation describe only the platform app.

## Acceptance criteria

- [x] Permanent redirects for the retired hosts, implemented as request middleware on `apps/web`:
      `legacyHostRedirectMiddleware` + `legacyPathFor` (`apps/web/app/lib/legacy-redirects.ts`), driven
      by `LEGACY_FINANCE_HOSTS` / `LEGACY_CAREER_HOSTS`. Responses are `301` with `Cache-Control:
      no-store` and `Clear-Site-Data: "cache"` so a stale service worker cannot keep serving the old
      shell.
- [x] Redirect map covered by unit tests, including `/analytics/*`, `/accounts/:id`, `/work/*`,
      `/applications/*`, `/onboarding`, `/account`, `/auth*`, and the unchanged `/p/:slug`.
- [x] `apps/finance` and `apps/career` directories, Dockerfiles, `validate-*.yml` workflows, and
      `dev:finance` / `dev:career` scripts removed.
- [x] `just/ui.just` `ui_consumers`, `vitest.workspace.ts`, `knip.json`, `.github/dependabot.yml`,
      `.claude/launch.json`, `.vscode/launch.json`, and `scripts/sync-worktree-env.sh` updated.
- [x] `AGENTS.md`, `docs/architecture.md`, `docs/type-system.md`, and the auth ADR no longer describe
      the retired apps as current.
- [x] Full repo gate passes with neither app present.

## Operational step

Moving the `finance.*` / `career.*` custom domains onto the `web` Fly app and setting
`LEGACY_FINANCE_HOSTS` / `LEGACY_CAREER_HOSTS` is a deployment action, not a code change; the runbook
is in [web.sub-apps.md §6.4](../web.sub-apps.md#64-cutover-runbook). Until the hostnames move, the
middleware is inert (empty host lists) and the platform is unaffected.

## Evidence

`pnpm run check` (33/33 turbo tasks, with both apps removed), `pnpm format:check`, the redirect unit
tests, and the 17 browser journeys in `apps/web/tests/e2e/{career,finance}.spec.ts` still passing
against the platform.
