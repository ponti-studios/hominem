# Finance

## Purpose

Represent personal financial activity accurately enough for trustworthy summaries, while retaining source and accounting context.

## Canonical entities and relationships

`app.finance_institutions` provide `app.finance_accounts` (optionally synced via `app.plaid_items`, one Plaid connection per institution link, tracking its own sync cursor/error state independent of the account). Accounts have `app.finance_transactions` and periodic `app.finance_statement_periods`. Transactions carry `app.finance_transaction_postings`, which classify money movement by account/category (`app.finance_categories`). `app.finance_merchants` normalize merchant identity.

## Lifecycle and invariants

Amounts are decimal (`numeric(14,2)`) plus ISO currency. Pending and posted transactions are distinct states (`finance_transactions.pending`). Statement periods are immutable documents with an opening/closing balance; balances are observations, not assumed ledger truth.

## Privacy, provenance, and AI evidence

Finance is highly sensitive. Default AI evidence is bounded date/amount/merchant/category context and source freshness; account identifiers, statement files, and raw descriptions require an explicit future grant.

## Rejected models

- Floating-point money.
- Exposing unrestricted transaction search through MCP.

## Divergences from the original design

Two places where production doesn't fully hold the original line, kept visible rather than smoothed over:

- **Amount duplication.** `finance_transactions.amount` carries a signed amount directly on the transaction, in addition to `finance_transaction_postings.amount`. The original design wanted postings to be the sole detail-carrying record; production keeps a redundant top-level amount, so the two can in principle disagree. Postings are optional (a transaction can exist with zero postings), unlike the original "one or more postings" invariant.
- **Provider payload inlined.** `finance_transactions.provider_payload jsonb` stores raw provider data directly on the canonical row — see the divergence note in [02-provenance-files-imports.md](02-provenance-files-imports.md).

`app.budgets` and `app.account_balances` (as separate observation tables) are **not implemented**; balance is read from `finance_accounts.current_balance`/`available_balance` directly rather than a time series of observations.

## Implementation readiness

- [ ] Finance repositories expose institutions, accounts, transactions, postings, categories, merchants, and statement reads.
- [ ] Services use integer/decimal money semantics and never float arithmetic.
- [ ] API DTOs separate public summaries from sensitive transaction detail.
- [ ] MCP finance capabilities require explicit scope, return capped summaries, and include freshness/evidence.
- [ ] Tests compare transaction totals, posting totals, category filters, merchant grouping, and sensitive-field redaction.
- [ ] Deferred: investment holdings, balance-observation history, budgets, and resolving the top-level amount/posting duplication.

## Open questions

None. Investment/security holdings remain a later additive finance domain — note `app.portfolios` in [18-career-portfolio.md](18-career-portfolio.md) is an unrelated public career-profile table, not an investment portfolio; the name collision is coincidental and worth avoiding in any future investing schema.
