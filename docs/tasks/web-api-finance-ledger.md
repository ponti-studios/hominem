---
title: 'Expose the finance ledger over RPC'
status: 'Implemented'
priority: 'high'
labels: [api, finance, rpc]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Outcome

The ledger operations that `apps/finance` performed by importing `@hominem/finance-services` directly
are available over `/api/finance/ledger`, so a browser app can read and reconcile the books without a
services dependency.

## Acceptance criteria

- [x] `GET /api/finance/ledger/reconcile` returns reconciliation staleness and validation gates.
- [x] `GET /api/finance/ledger/accounts/:id` returns the per-description ledger breakdown, or 404 when
      the account is not owned by the caller.
- [x] `POST /api/finance/ledger/adjustment` posts a dated true-up and is scoped to the caller.
- [x] `GET /api/finance/ledger/transfers` returns candidate transfer pairs with coerced filters.
- [x] `GET /api/finance/ledger/runway` derives runway from the stored settings and the current ledger.
- [x] Routes are thin adapters over `@hominem/finance-services`; validation rejects non-finite and
      malformed input.
- [x] Route tests cover the composition, the 404 path, and the invalid-input path.

## Evidence

`pnpm run check` passed the full repo gate on 2026-11-05 (33/33 turbo tasks; `@hominem/api` 154 test
files / 1397 tests, `@hominem/career` 26 files / 150 tests). `pnpm --filter @hominem/api build` emitted
the updated `build/rpc/app.d.ts` contract, so clients see the new routes. Ledger behavior itself remains
covered by `packages/finance/src/finance.reconcile.integration.test.ts` and
`finance.runway.integration.test.ts`.
