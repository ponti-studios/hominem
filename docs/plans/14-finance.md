# Plan 14: Finance

## Outcome

Extend the personal financial activity already served by `apps/finance` with
trustworthy, bounded read models for summaries, while retaining source and
accounting context. The MCP vertical uses the production finance schema and
does not create a second ledger.

## Implementation boundary

- **Schema:** [schema/14-finance.sql](schema/14-finance.sql)
- **Repository and service:** assemble institution, account, transaction, posting, category, merchant, and statement read models with decimal money handling.
- **MCP:** after Plan 00 and a finance security review, expose only a capped monthly summary; unrestricted transaction search is prohibited.

## Canonical entities and relationships

`app.finance_institutions` provide `app.finance_accounts` (optionally synced via `app.plaid_items`, one Plaid connection per institution link, tracking its own sync cursor/error state independent of the account). Accounts have `app.finance_transactions` and periodic `app.finance_statement_periods`. Transactions carry `app.finance_transaction_postings`, which classify money movement by account/category (`app.finance_categories`). `app.finance_merchants` normalize merchant identity.

## Lifecycle and invariants

Amounts are decimal (`numeric(14,2)`) plus ISO currency. Pending and posted transactions are distinct states (`finance_transactions.pending`). Statement periods are immutable documents with an opening/closing balance; balances are observations, not assumed ledger truth.

## Privacy and AI evidence

Finance is highly sensitive. Default AI evidence is bounded date/amount/merchant/category context; account identifiers, statement files, provider payloads, and raw descriptions require an explicit future grant.

## Rejected models

- Floating-point money.
- Exposing unrestricted transaction search through MCP.

## Divergences from the original design

Two places where production doesn't fully hold the original line, kept visible rather than smoothed over:

- **Amount duplication.** `finance_transactions.amount` carries a signed amount directly on the transaction, in addition to `finance_transaction_postings.amount`. The original design wanted postings to be the sole detail-carrying record; production keeps a redundant top-level amount, so the two can in principle disagree. Postings are optional (a transaction can exist with zero postings), unlike the original "one or more postings" invariant.
- **Provider payload inlined.** `finance_transactions.provider_payload jsonb` stores provider data directly on the canonical row. This is tolerated as implementation detail, not a model to spread.

`app.budgets` and `app.account_balances` (as separate observation tables) are **not implemented**; balance is read from `finance_accounts.current_balance`/`available_balance` directly rather than a time series of observations.

## Delivery acceptance

- [ ] Finance repositories expose institutions, accounts, transactions, postings, categories, merchants, and statement reads.
- [ ] Services use integer/decimal money semantics and never float arithmetic.
- [x] RPC finance summary endpoint uses sensitive-field DTO boundaries.
- [x] MCP finance summary requires explicit finance scope and returns capped summaries with minimal evidence.
- [x] Tests cover monthly money math, merchant grouping, caps, bounded transaction evidence, no unrestricted search, and sensitive-field redaction.
- [ ] Repository and service coverage includes postings, categories, statements, and account status.
- [ ] Deferred: investment holdings, balance-observation history, budgets, and resolving the top-level amount/posting duplication.

## Deferred work

None. Investment/security holdings remain a later additive finance domain — note `app.portfolios` in [01-career-portfolio.md](01-career-portfolio.md) is an unrelated public career-profile table, not an investment portfolio; the name collision is coincidental and worth avoiding in any future investing schema.
