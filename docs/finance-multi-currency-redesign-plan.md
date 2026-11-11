# Finance multi-currency redesign plan

**Status:** Product direction approved; implementation plan ready

**Scope:** Hominem Finance reporting surfaces, finance API contracts, data model,
exchange-rate ingestion, and user experience.

## Product promise

Hominem is a reporting layer for internationally mobile people. It explains a
user's financial activity across currencies without moving money or pretending
that unlike amounts can be added safely.

The interface should make every amount answer five questions:

1. What is this amount?
2. Which currency is it in?
3. What account does it belong to?
4. Was it converted for display?
5. Which rate and date produced the conversion?

The product should feel calm and intelligent: users should see the truth of
their statements first, while Hominem handles the complexity of comparison,
historical rates, and explanation.

## Approved product decisions

### Accounts are single-currency

Each account has exactly one currency. The account currency is immutable through
ordinary editing because changing it would reinterpret every stored amount.
Changing an account's currency requires an explicit correction or migration
flow.

An account's currency is not the same thing as a user's preferred reporting
currency. Account balances remain native to the account.

### Initial currency coverage is data-driven

USD, GBP, and EUR are the initial supported currencies. The implementation must
not contain currency-specific branches such as `if GBP`, `if USD`, or custom
formatting paths.

Currency behavior must come from a versioned currency catalogue containing at
least:

- ISO 4217 alphabetic and numeric codes
- Display name
- Minor-unit scale
- Cash-rounding rules, when applicable
- Active, historical, and obsolete status
- Locale-aware display metadata

Adding another currency should be a catalogue/data change plus coverage tests,
not a feature rewrite.

### Presentation is contextual

There is no mandatory global “home currency” that rewrites the product.

- Account surfaces present balances in the account's native currency.
- Transaction surfaces present the original transaction amount and the account
  amount when they differ.
- Analytics and reports declare their presentation currency explicitly.
- Mixed-currency totals are grouped by currency unless a report explicitly
  requests conversion.

### FX uses transaction-date rates

Reporting conversions use the applicable rate for the transaction date. The
conversion snapshot must preserve the exact rate, direction, date, source,
precision, and calculation policy used by the report.

Historical reports must remain reproducible after rates are corrected or new
rates are ingested.

### FX impact appears in both reporting dimensions

Hominem reports FX impact in both:

- **Net worth:** including valuation movement where applicable.
- **Cash flow and activity analysis:** clearly separating actual spending,
  income, realized FX impact, and unrealized valuation movement.

FX movement must never be presented as ordinary spending or income without an
explanation.

### Hominem never performs financial actions

Hominem is permanently reporting-only. It will never initiate:

- Bank transfers
- Currency exchanges
- Payments
- Withdrawals
- Remittances
- Provider-side quotes or execution

The product may explain an executed conversion found in imported data, but it
does not create or execute the conversion.

## Canonical money model

Every monetary value is a value object:

```text
amount_minor: signed integer
currency_code: ISO 4217 code
```

Never use binary floating point for stored monetary values. `Intl.NumberFormat`
formats values; the currency catalogue determines accounting precision.

### Currency roles

The system must distinguish these roles:

1. **Original amount** — the amount reported by the merchant, source document,
   or imported transaction.
2. **Account amount** — the amount recorded against the single-currency account.
3. **Presentation amount** — a derived value used to compare or report amounts in
   another currency.

Original and account amounts are accounting facts. Presentation amounts are
derived valuations and must never replace either fact.

Example:

```text
Original:       JPY 8,400
Account charged: GBP 43.12
Displayed in:   EUR 50.31 estimated
Rate date:      2026-11-07
Rate source:    Hominem historical reference rates
```

### Transfers and exchange records

Because accounts are single-currency, a cross-currency movement must not be
represented as an ordinary same-currency transfer. Since Hominem does not
execute financial actions, imported data should represent the observed facts:

- Source account and currency
- Destination account and currency, when known
- Original/source amount
- Destination/settled amount
- Observed exchange rate
- Fees or spread, when supplied by the source
- Import/source provenance

If the source does not provide both sides, preserve the known amount and mark
the other side as unavailable rather than inventing a 1:1 conversion.

## Local FX historical-rate system

Hominem should own a local historical FX dataset. External open-data providers
are ingestion sources, not runtime dependencies.

### Ingestion principles

- Pull daily reference rates on a scheduled job.
- Backfill the supported historical range.
- Store immutable observations in Hominem's database.
- Resolve transaction-date rates locally during reads and report generation.
- Never call an FX provider during a user request.
- Store the raw or normalized provider payload for auditability.
- Keep superseded observations rather than overwriting history.

The initial provider strategy should use open daily reference data, with EUR as
the source base where necessary and exact cross-rate/inverse calculations for
USD, GBP, EUR, and future currencies. Provider choice and licensing must be
verified before implementation, but the application must depend on the local
rate table rather than the provider's uptime.

### FX observation fields

Each observation should include:

```text
base_currency
quote_currency
rate
effective_date
published_at
retrieved_at
source
source_reference
precision
status
supersedes_observation_id
```

Use exact decimal arithmetic or a rational representation for rates. Store the
quote convention explicitly so `GBP → EUR` and `EUR → GBP` cannot be confused.

### Import validation

The ingestion job must validate:

- Currency codes against the versioned catalogue
- Positive, finite rates
- Duplicate effective dates
- Missing expected currencies
- Unexpected rate movements
- Provider schema changes
- Publication lateness
- Checksum or payload integrity, where available

Failed ingestion should retry with backoff and alert. It must not delete the
last valid local dataset.

### Availability policy

The product should always provide a rate for supported currencies through local
data:

1. Exact transaction-date rate when available.
2. Latest prior valid working-day rate for weekends and holidays.
3. Most recent locally stored observation during a provider outage.

The UI must show the rate date and age. “Always available” means “resolved from
our retained data,” not “fabricated when no observation exists.” If the local
dataset has no valid observation for a currency/date, preserve native amounts
and show an explicit data-quality state.

## Interface redesign

### Finance navigation

The finance area should organize around:

- Overview
- Accounts
- Transactions
- Budgets
- Insights
- Transfers
- Settings

The interface should not expose a global currency selector that silently changes
the meaning of all screens. Reports can expose a presentation-currency control
with a visible label such as:

```text
Viewing in EUR · transaction-date rates
```

### Account list and detail

Account cards show native balances with unambiguous code and name:

```text
Wise GBP
£12,420.55 GBP
```

If a report includes several accounts, show grouped totals:

```text
Balances by currency
GBP 12,420.55
USD 3,100.00
EUR 850.00
```

A converted consolidated value must include presentation currency, rate policy,
and valuation date. Never show one converted number without that context.

### Transaction list

Transactions use native truth first:

```text
Dinner in Tokyo
Original       ¥8,400 JPY
Account amount £43.12 GBP
7 Nov · Card · Settled
```

Support filters for currency, account, original/settled state, pending/settled
state, conversion status, and FX fees.

### Transaction detail

Add a dedicated Money details section containing:

- Original amount and currency
- Account amount and currency
- Presentation amount, when requested
- Rate direction and value
- Rate date
- Rate source
- Rate age
- Fees and spread, when imported
- Pending-to-settled history
- Import/source provenance

### Transfers and imported exchanges

Same-currency transfers can be shown simply. Cross-currency imported activity
must make both currencies visible and explain whether the rate was supplied by
the bank/card/provider or calculated by Hominem for reporting.

Hominem must not include buttons or flows that imply it can initiate an
exchange, transfer, or payment.

### Overview

The overview should answer:

- What do I own and owe by account currency?
- What changed from actual activity?
- What changed from FX valuation?
- Which imported records need attention?

Recommended modules:

1. Net worth with valuation date and rate policy.
2. Balances grouped by currency.
3. Recent activity with native and account amounts.
4. Realized and unrealized FX movement.
5. A data-quality attention queue.

### Budgets and runway

Budgets have an explicit currency and period. Foreign activity must not silently
disappear or become overspending due only to rate movement.

Show:

```text
Travel budget · EUR 2,000
Native EUR spending: EUR 1,420
Foreign account activity: GBP 210
Converted reporting value: EUR 1,665
FX movement: +EUR 34
```

Runway must declare currency, rate date, included accounts, and assumptions in
the result itself.

### Formatting and accessibility

Use currency codes and full names where ambiguity matters. Do not rely on `$`,
`£`, `¥`, color, hover, or chart position alone.

Test zero-decimal, three-decimal, negative, refund, cash-rounding, and obsolete
currency cases. Every amount must be accessible with its currency identity.

## API and database convergence

### P0 contract changes

- Require `currencyCode` on all transaction create, update, and import writes.
- Return account `currencyCode` in every account DTO.
- Remove silent USD defaults from write paths and formatting helpers.
- Enforce transaction/account currency compatibility.
- Block incompatible account moves.
- Group all balances and aggregates by currency.
- Route legacy RPC mutations through the shared finance service/repository.
- Add stable errors:
  - `invalid_currency`
  - `currency_mismatch`
  - `mixed_currency_aggregate`
  - `fx_rate_unavailable`

### Additive migration

Existing rows that rely on a historical USD default must not be silently
reinterpreted. Classify them as `needs_currency_review` where their currency is
ambiguous. Backfill only when the source is trustworthy and record the reason
and provenance.

During the compatibility window:

- Reject new currency-less writes.
- Instrument old-client calls.
- Provide a repair queue for ambiguous historical data.
- Preserve existing original amounts and currency codes.

### Existing specifications to reconcile

The following existing documents describe currency behavior that must be
reviewed against this plan before implementation:

- `docs/finance-account-update-spec.md`
- `docs/hominem-finance-tools-spec.md`
- `docs/finance-budgets.md`
- `docs/decisions/finance.pfin-merge.md`
- `docs/tasks/finance-runway-budgets.md`

In particular, existing `allowedCurrencies` behavior and profile-primary-
currency budget behavior should not remain as hidden alternatives to the
single-currency-account and transaction-date-rate model.

## Phased delivery plan

### Phase 0 — Contract freeze — P0

- Publish the currency roles and invariants.
- Approve launch currencies: USD, GBP, EUR.
- Approve the reporting-only boundary.
- Define transaction-date rate semantics.
- Inventory every finance write, aggregate, formatter, and money renderer.
- Reconcile the existing finance specifications.

**Exit evidence:** approved product contract, route inventory, migration plan,
and no unresolved ownership conflict between current docs.

### Phase 1 — Stop corruption — P0

- Require currency on all writes.
- Remove USD defaults.
- Return currency on all DTOs.
- Enforce account/transaction compatibility.
- Group balances by currency.
- Replace hard-coded dollar formatting.
- Add currency value objects and catalogue validation.

**Exit evidence:** API, repository, and UI tests prove no currency-blind writes
or mixed-currency arithmetic remain.

### Phase 2 — Native-first interface — P0

- Redesign account list/detail.
- Redesign transaction list/detail.
- Redesign imported transfers and exchange records.
- Add currency and settlement filters.
- Redesign analytics, budgets, runway, and exports.
- Add shared accessible money components.

**Exit evidence:** Playwright journeys cover an international user paid in GBP,
spending in EUR, and holding USD assets.

### Phase 3 — Local FX dataset — P1

- Add currency catalogue tables.
- Add immutable FX observation tables.
- Build daily ingestion and historical backfill.
- Add provider payload retention and validation.
- Add retry, lateness, freshness, and anomaly monitoring.
- Resolve transaction-date rates locally.

**Exit evidence:** reports work with external providers unavailable; historical
reports reproduce under a fixed rate-set version.

### Phase 4 — FX-aware reporting — P1

- Add presentation-currency reporting where appropriate.
- Add valuation dates and rate-age disclosures.
- Separate realized and unrealized FX impact.
- Add budget and runway conversion snapshots.
- Add missing/ambiguous-data attention queue.

**Exit evidence:** net worth, cash flow, budgets, runway, and charts explain
currency and FX behavior without hidden assumptions.

### Phase 5 — Delight and intelligence — P2

- Country-aware onboarding.
- Favorite and recently used currencies.
- Travel-oriented insights.
- “What changed?” explanations.
- Smart detection of stale, missing, or suspicious imported currency data.
- Personalized views without changing accounting truth.

**Exit evidence:** usability research shows users can explain the amount,
currency, rate date, and reason for any converted total.

## Testing and telemetry

### Required test cases

- USD, GBP, EUR, JPY, and KWD formatting.
- Zero- and three-decimal currencies.
- Negative values, refunds, and reversals.
- Same-currency transfers.
- Cross-currency imported activity.
- Pending-to-settled revisions.
- Weekend and holiday rate fallback.
- Provider outage with local data available.
- Missing local rate data.
- Historical rate correction without report drift.
- Mixed-currency aggregate rejection/grouping.
- Account currency mismatch.
- Currency-less legacy write rejection.
- Accessible currency names and codes.

### Telemetry

Track:

- `currency_missing_on_write`
- `currency_defaulted`
- `currency_mismatch`
- `mixed_currency_aggregate_blocked`
- `fx_rate_age`
- `fx_rate_unavailable`
- `fx_ingestion_late`
- `fx_ingestion_failed`
- `foreign_amount_unsettled`
- `pending_revised_at_settlement`
- `format_currency_fallback`
- `historical_currency_needs_review`

Do not log transaction descriptions or unnecessary personal data. Rate metrics
should use currency pairs, dates, provider metadata, and operational IDs.

## Success metrics

### Correctness

- Zero new currency-blind finance writes.
- Zero raw mixed-currency aggregates.
- 100% of rendered monetary values include a currency identity.
- 100% of converted reports expose rate date and source.

### Reliability

- User-facing FX reports do not depend on provider request-time availability.
- Daily ingestion freshness is observable.
- Historical reports reproduce after later rate updates.

### User trust and delight

- Users can identify original amount, account amount, and displayed amount.
- Users understand why net worth changed.
- Users can find and repair ambiguous currency records.
- International-user workflows complete without manual spreadsheet conversion.
- Usability testing reports confidence rather than surprise when currencies differ.

## Explicit non-goals

- Executing FX or payments
- Bank-transfer initiation
- Live trading or remittance quotes
- Provider-side conversion guarantees
- A global currency that silently reinterprets native account data
- Currency-specific UI branches

## Recommended implementation default

Proceed with **single-currency accounts, generic ISO currency metadata,
transaction-date local FX observations, native-first presentation, explicit
converted reporting, and reporting-only behavior**.

The first engineering milestone should be Phase 0 plus the Phase 1 contract
work. Do not begin with a visual currency selector: the existing write paths,
aggregates, and formatters must become currency-safe first.
