---
title: 'Retire the standalone Finance and Career apps'
status: 'Proposed'
priority: 'medium'
labels: [web, finance, career, deprecation]
depends_on: [web-subapp-finance, web-subapp-career-ai-flows]
blocks: []
estimated_size: 'M'
---

## Outcome

`apps/finance` and `apps/career` are gone, their routes permanently redirect to the platform, and the
monorepo, CI, and documentation describe only the platform app.

## Acceptance criteria

- [ ] Permanent redirects serve the full map in [web.sub-apps.md](../web.sub-apps.md) from the old
      origins, including `/p/:slug`.
- [ ] Old service workers unregister themselves and clear caches before the redirect soak ends.
- [ ] Auth return URLs work from every redirect target (`allowedPrefixes` includes `/finance` and
      `/career`).
- [ ] `apps/finance` and `apps/career` directories, Dockerfiles, `validate-*.yml` workflows, and
      `dev:finance` / `dev:career` scripts are removed.
- [ ] `just/ui.just` `ui_consumers`, turbo config, and `.env.example` references are updated.
- [ ] `docs/architecture.md` no longer describes Career reading the database from loaders.
- [ ] The full repo gate passes with neither app present.

## Notes

Keep `packages/finance` and `packages/career`: they are the domain logic the API and MCP tools adapt.
