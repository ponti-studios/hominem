---
title: 'Redesign Finance Transactions as a full ledger'
status: 'Implemented'
priority: 'high'
labels: [finance, web, transactions]
depends_on: [web-subapp-finance, web-api-finance-ledger]
blocks: []
estimated_size: 'L'
---

## Outcome

People can browse and manage their Finance transactions from a single, paginated ledger with a
single-line shared row, contextual bulk actions, and a detail drawer.

## Acceptance criteria

- [x] `/finance/transactions` is the Finance ledger; `/finance/rulings` redirects to it and the
      Finance navigation uses the Transactions label.
- [x] The shared `FinanceTransaction` row remains one line and is reused by Finance transaction lists.
- [x] Search, account/date/category/tag/type/status filters, cursor paging, visible selection, and
      select-all-results operate on the matching set.
- [x] Category changes update selected rows immediately and save suggestion-only merchant rules.
- [x] Details, tags, notes, merchant, account, exclusion, restoration, transfer linking, and deletion
      are owner-scoped and validated.
- [x] Queued rulings remain visible and filterable in Transactions; splits remain deferred.
- [x] API and web integration/component coverage and the full repository validation pass.

## Evidence

- `pnpm run check --filter=@hominem/api... --filter=@hominem/web...` — passed, including API build before web typecheck, lint, tests, and dependent package checks.
- `pnpm format --filter=@hominem/api... --filter=@hominem/web...` and `pnpm format:check` — passed.
- API integration tests cover ownership rejection, immediate category assignment and suggestion-only merchant rules, transfer pair/unlink, and detail edits using stored debit/credit types.
- Web component/route tests cover the single-line row, redirect, and bulk category flow.
- Authenticated browser pass at `/finance/transactions` verified the ledger, 21-result merchant search, compact selection bar and its More actions menu, two-row transfer action, transaction detail drawer, queued filter empty state, and redirect from `/finance/rulings`.
- Existing local test data had no queued rulings, so the empty queued state was observed; actual queued-row rendering is covered by the row’s queued indicator but was not observed with a queued record in the browser.
- Dark theme, reduced-motion behavior, and screen-reader/keyboard navigation were not manually exercised in the browser.
