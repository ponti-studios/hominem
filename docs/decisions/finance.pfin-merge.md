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
binary (functionality is exposed through `apps/finance` app routes, not a
package-level command-line tool).

Deferred by design, not forgotten: a settings UI for per-user description-
split rules (`docs/tasks/finance-copilot-description-splits.md`) and for
runway budget caps (`docs/tasks/finance-runway-budgets.md`) — both ship only
when a real collision or budget need appears, rather than pre-building UI
around one user's data.

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
