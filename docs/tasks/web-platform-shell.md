---
title: 'Web platform shell and domain registry'
status: 'Implemented'
priority: 'high'
labels: [web, platform, navigation]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Outcome

`apps/web` renders every page inside one platform shell with a domain registry that drives
navigation, replacing the per-page `RouteHeader` and giving the future Finance and Career sub-apps a
place to mount.

## Acceptance criteria

- [x] A single registry (`apps/web/app/domains.tsx`) lists platform domains with `path`, `icon`, and
      an `enabled` flag; only enabled domains appear in navigation.
- [x] `routes/layout.tsx` renders an `AppHeader` (wordmark, domain nav, account menu) above a
      scrollable outlet; pages no longer render their own header.
- [x] `RouteHeader` is removed; Tasks and Collections routes render only their page component.
- [x] The account menu stops duplicating domain links and points at `/usage` and `/settings`.
- [x] Finance and Career are listed with `enabled: false` until their sub-apps land; no dead links.
- [x] `/` still redirects to `/tasks` (decision D3).

## Evidence

`pnpm --filter @hominem/web typecheck` passed after the change, and `pnpm --filter @hominem/web format`
reported no remaining diffs. The shell is exercised by the existing Tasks and Collections pages, which
continue to render under the new header. Full repo gate recorded in
[web-api-finance-ledger.md](web-api-finance-ledger.md).
