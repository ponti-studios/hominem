---
title: 'Mount Finance as a web sub-app'
status: 'Implemented'
priority: 'high'
labels: [web, finance, migration]
depends_on: [web-platform-shell, web-api-finance-ledger]
blocks: []
estimated_size: 'L'
---

## Outcome

Every Finance screen renders under the platform shell at `/finance/*`, using only the RPC client, with
parity for the dashboard, analytics, accounts, runway, affordability, reconcile, and transfers views.

## Acceptance criteria

- [x] Components, hooks, and view helpers live under `apps/web/app/modules/finance`; route modules are
      `routes/finance/*` mounted at `/finance`, `/finance/analytics`, `/finance/accounts`,
      `/finance/accounts/:id`, `/finance/runway`, `/finance/affordability`, `/finance/reconcile`,
      `/finance/transfers`.
- [x] The three `ledger.server` call sites call `/api/finance/ledger/*` instead; the services import is
      gone from the app.
- [x] The Finance account screen is dropped in favor of platform `/settings`. The latent
      `DELETE /api/finance` bug disappears with it; the API's confirmation-guarded
      `POST /api/finance/data` remains the deletion surface.
- [x] `apps/web/package.json` gains no `@hominem/finance-services` dependency.
- [x] Finance is `enabled: true` in `apps/web/app/domains.tsx`, and `/finance` is in the auth redirect
      allowlist.
- [x] Internal links use the new paths (`/finance/accounts/:id`, `/finance/analytics/*`).
- [x] The finance search and parsed-input tests run in `apps/web` (37 web tests pass, including the
      migrated search suite).
- [ ] Port the remaining route/view tests (accounts list, account detail, reconcile, monthly analytics)
      over MSW. Ledger behavior already lives in the API, so these are presentation tests only.
- [ ] Record old/new screenshots per screen once the app runs locally with data.
- [ ] Redirects from the old finance origin are tracked in
      [web-deprecate-standalone-apps.md](web-deprecate-standalone-apps.md), not here.

## Progress

Implemented the module move, route tree, sub-navigation, server-client seam, and the API-backed ledger
flows. The remaining work is test coverage and visual parity evidence; it does not block starting the
Career API gaps.

## Notes

`recharts`, `date-fns`, `@radix-ui/react-dialog`, and `@testing-library/jest-dom` were added to
`apps/web`; `zustand` was not — the selected-account filter is now a small `useSyncExternalStore`
module store. Do not port `finance.globals.css`; the finance accent is still the old palette scoped to
its screens and should be reconciled with the platform tokens (decision D4) during the visual pass.

## Evidence

All seven Finance surfaces render under the platform shell, driven only by `/api/finance/*`.
Browser evidence: `apps/web/tests/e2e/finance.spec.ts` (4 tests: every surface, search dialog,
cross-domain navigation, navigation budget). The stale `DELETE /api/finance` call disappeared with the
old account screen. Screenshots for the visual-parity pass have not been captured; the shell, nav,
and page content are asserted instead.

