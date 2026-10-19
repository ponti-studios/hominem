# Personal-finance (`pfin`) merge into `@hominem/finance-services`

## Status

Accepted (2026-09-08)

## Decision

The standalone `personal finance` (`pfin`) SQLite pipeline is retired in favor
of `packages/finance` on the Postgres `app.finance_*` schema. Postgres is the
system of record; the `personal finance` checkout is read-only history with no
GitHub remote, archived by the local annotated tag `pfin-final-sqlite`.

`packages/finance` ported PF's unique domain logic, not its schema:

- **Copilot sign rules and description splits** — `income` rows are always a
  credit; `internal transfer`/unknown-type rows are default-negated **and**
  flagged `needsReview` rather than silently signed, surfaced in the import
  preflight preview (`src/import/copilot-sign.ts`, wired into
  `create-import-plan.ts`).
- **`recurring`** — restored as a column on `finance_transactions` (it had
  been dropped as write-never); PF's truthiness rule applies (non-empty and
  not the literal string `false`, so a series name like `Netflix` counts).
  Runway needs this column; without it the projection silently degrades.
- **Ledger-native reconciliation** (`src/reconcile.ts`, PF's `true-up`) —
  posts a dated `adjustment` plug transaction to close the ledger-vs-balance
  gap: sub-cent gaps no-op, a second same-day adjustment needs `force`, and a
  positive target on a `credit_card`/`loan` account warns (ledger convention
  is money-out-negative).
- **Live runway projection** (`src/runway.ts:computeLedgerRunway`) — liquid-
  type starting cash, trailing `recurring` average, budget-cap allowance,
  chained weekly projection. Assumptions are function arguments, not a config
  file (see deferred settings UI below).
- **Diagnostics** (`src/diagnostics.ts`) — `findTransferPairs` and
  `getValidationGates` reproduce PF's transfer-pair and gate output as pure
  Kysely queries.
- **Composite-key import dedup** — plan-time dedup flags matching rows
  (`ledgerDuplicate`) and deselects them by default; apply-time dedup still
  refuses to double-insert a re-selected row. Needed because backfilled rows
  carry `hominem`/`copilot-gap-import` sources that a source-only dedup check
  (`copilot-money`) would miss on a future Copilot export containing
  pre-migration transactions.

Deliberately **not** restored, and not to be restored without a named reader:
`finance_account_labels` (PF's `account_aliases` — mask/label matching in
`resolve-copilot-accounts.ts` already covers the live need), `finance_tax_*`,
`finance_statement_periods`, a `merchants` table, `categories.parent_id`
(hierarchy lives in `app.tags` instead), integer row IDs, the `UNLINKED`
placeholder account (unresolvable rows go to the import plan's
`unresolvedGroups`/`invalidRows` for user mapping instead), and a `pfin` CLI
binary (the reusable pipeline remains in the finance package, not a
package-level command-line tool).

The Finance browser import destination and its scoped API/WebSocket routes
were removed by explicit product direction. Shared import parsing and the
finance MCP import tool remain available to their existing internal callers,
but the Finance app does not expose an import flow. Restoring a browser import
destination requires explicit product approval and a reviewed replacement
flow.

Deferred by design, not forgotten: a settings UI for per-user description-
split rules (`docs/tasks/finance-copilot-description-splits.md`). Runway
budget caps are now an approved need: persist per-user monthly caps by
category and currency, expose their controls on Runway, and use them in
Analytics (`docs/tasks/finance-runway-budgets.md`). Forecasts remain
single-currency and disclose excluded currencies; conversion is out of scope.

## Consequences

Any future request to restore tax filings, statement periods, account
labels, merchants, or a `pfin`-style CLI must justify it with a concrete
consumer — these were removed as dead weight, not as an oversight, and PF's
full history (including ADRs 0001–0016 covering the original rules) remains
available via the `pfin-final-sqlite` tag if the reasoning needs to be
re-checked.

Import dedup must stay composite-key aware (account/date/amount/description),
not source-string aware, or a future Copilot export overlapping the
backfilled history will re-import rows.
