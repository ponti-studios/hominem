# Finance multi-currency redesign plan

**Status:** Product direction approved. Stage 7 review findings are resolved in
this revision for lines 1-395. The spec has not been re-reviewed yet. Current
behavior is described only where stated. Target behavior uses "must".

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

Users see their statement amounts first. Hominem handles the comparison,
historical rates, and explanation.

## Definitions

- **Account currency:** the one currency an account holds. Set at creation and
  immutable through ordinary editing. Ordinary editing means any account update
  through the account API or UI.
- **Original amount:** the amount in the currency the merchant or source document
  used.
- **Account amount:** the amount recorded against the account, in the account's
  currency.
- **Presentation currency:** the currency a report declares for comparison. This
  spec does not use "home currency," "preferred reporting currency," or "primary
  currency" for it.
- **Presentation amount:** a derived, estimated value in the presentation
  currency. It is never an accounting fact.
- **Transaction date:** the `date` the source records for the activity. Settlement
  date is stored separately and never re-rates a row.
- **Transaction-date rate:** the rate for the transaction date, or the latest prior
  valid working day when that date has no observation.
- **Valuation-date rate:** the rate used to value a holding as of a valuation date.
  Used for net worth.
- **Conversion snapshot:** the stored record of one converted figure. See
  "FX uses transaction-date rates."
- **Rate age:** days between the rate date and the date the figure was shown.
- **Calculation policy:** the named rule that turns snapshot inputs into a
  presentation amount: rounding mode, precision, and cross-rate route. Stored with
  each snapshot.
- **Rate policy:** the named rule for which observation a conversion uses:
  transaction-date or valuation-date, plus the maximum lookback.
- **Unrealized valuation movement:** the change in a holding's presentation value
  between two valuation dates. This is the only FX movement term the spec uses.

## Approved product decisions

### Accounts are single-currency

Each account has exactly one currency. The account currency is immutable through
ordinary editing because changing it would reinterpret every account amount.
Changing an account's currency requires an explicit correction or migration
flow.

An account's currency is not the same thing as the presentation currency of a
report. Account balances remain native to the account.

### Initial currency coverage is data-driven

Every active currency in the catalogue accepts original and account amounts.
USD, GBP, and EUR are the launch currencies with a rate backfill. Other currencies
are enabled as rate coverage is confirmed. A currency with no local observation
shows the data-quality state described under Availability policy. The
implementation must not contain currency-specific branches such as `if GBP`,
`if USD`, or custom formatting paths.

Currency behavior must come from a versioned currency catalogue, stored as a
database table (`app.currency_catalogue`, proposed name) and seeded by migration.
Validation reads that table. It does not use `Intl.supportedValuesOf`, which
depends on the runtime and carries no scale or status. Codes are normalized to
uppercase on parse. `XXX` (ISO "no currency") is rejected. The catalogue contains
at least:

- ISO 4217 alphabetic and numeric codes
- Display name
- Minor-unit scale
- Cash-rounding rules, when applicable
- Active, historical, and obsolete status
- Locale-aware display metadata

Adding another currency should be a catalogue/data change plus coverage tests,
not a feature rewrite.

### Presentation is contextual

There is no mandatory global presentation currency that rewrites the product.

- Account surfaces present balances in the account's native currency.
- Transaction surfaces present the original transaction amount and the account
  amount when they differ.
- Analytics and reports declare their presentation currency explicitly.
- Mixed-currency totals are grouped by currency unless a report explicitly
  requests conversion.

### FX uses transaction-date rates

Reporting conversions use the transaction-date rate: the rate for the
transaction's `date`. If that day has no observation, use the latest prior valid
working day. Settlement date is stored separately and never re-rates a row.

Every converted figure is stored as a conversion snapshot. A snapshot records the
exact rate, direction, rate date, source, precision, calculation policy, and
rate-set version used. Reports read the snapshot, not the live rate table. A
historical report therefore does not change after rates are corrected or new rates
are ingested. A new snapshot is created only when a user recalculates.

Two rate roles exist. Transaction-date rates are used for activity and budgets.
Valuation-date rates are used for holdings and net worth. Each report names the
role it uses.

### FX impact appears in both reporting dimensions

Hominem reports FX impact in both:

- **Net worth:** at valuation-date rates, including unrealized valuation movement.
- **Cash flow and activity analysis:** clearly separating actual spending and
  income from unrealized valuation movement. Realized FX impact is out of scope
  for the first release. It needs a cost-basis method, which the schema does not
  have.

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
Rate used:      1 GBP = 1.16667 EUR (illustrative)
Rate source:    Hominem historical reference rates
```

### Storage model

Each transaction stores these fields. Names are snake_case in the database and
the value object, and camelCase in API DTOs.

```text
original_amount_minor    signed integer, in original_currency's minor units
original_currency        ISO 4217 code
account_amount_minor     signed integer, in the account's currency
account_currency         ISO 4217 code, must equal the account's currency
```

- Balances and account totals sum `account_amount_minor` only.
- Presentation amounts are computed from snapshots when a report runs. They are not
  stored on the transaction.
- The existing `amount` maps to `account_amount_minor` in the migration (see
  Additive migration). The existing `settled*` fields are mapped in the Phase 0
  inventory. Until then, balances do not use them.

### Cross-currency legs

Because accounts are single-currency, a cross-currency movement is two
transactions, one in each account. Each leg keeps its own account, currency, and
amount. The two legs are linked with the existing `counterpartId` field.
`findTransferPairs` already finds them. No new exchange entity is created.

Hominem does not execute financial actions, so imported data records only the
observed facts:

- Source account and currency
- Destination account and currency, when known
- Original/source amount
- Destination/settled amount
- Observed exchange rate, stored on the link, with `rate_origin` set to the bank,
  card, or provider, or to `hominem` when Hominem calculated it for reporting
- Fees or spread, when supplied by the source
- Import/source provenance

If the source provides only one side, store the known leg and set
`destination_amount_status` to `unavailable`. Do not invent a 1:1 conversion.

## Local FX historical-rate system

Hominem should own a local historical FX dataset. External open-data providers
are ingestion sources, not runtime dependencies.

### Ingestion principles

- Pull daily reference rates on a scheduled job in the existing API worker
  (`services/api/worker`). A failed run does not affect API requests.
- Backfill the range set in the catalogue. Start date: TBD before Phase 3.
- Sizing (expected rows, rate volume, and the lookup index on `base_currency`,
  `quote_currency`, `effective_date`): TBD before Phase 3.
- Store immutable observations in Hominem's database.
- Resolve transaction-date rates locally when a conversion snapshot is created.
  Reads use the snapshot.
- Never call an FX provider during a user request.
- Store the raw provider payload for auditability.
- Keep superseded observations rather than overwriting history.

The initial provider strategy should use open daily reference data. When a pair
has no direct published rate, it is derived through EUR. A derived cross rate is a
computed value, not an observation. It is computed exactly from the rounded
published inputs and labeled `derived` in its snapshot. Provider choice and
licensing must be
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

Field notes:

- `rate`: an exact decimal string, in storage and on the wire. It is units of
  `quote_currency` per one unit of `base_currency`. Example: base GBP, quote EUR,
  rate `1.16667` means 1 GBP = 1.16667 EUR. The inverse (`EUR → GBP`) is a separate
  observation or a derived value, never a silent flip.
- `precision`: the number of decimal places the provider publishes for this rate.
  It is stored, not computed.
- `status`: `published` (valid, used for lookup), `superseded` (replaced by a later
  correction, kept for history), or `rejected` (failed validation, kept for audit,
  never used for lookup).
- Provenance fields: `source`, `source_reference` (the provider's dataset and
  release identifier), `retrieved_at`, `payload_checksum` (when the provider
  supplies one), and `payload_ref` (a pointer to the stored raw payload).

### Import validation

The ingestion job must validate:

- Currency codes against the versioned catalogue
- Positive, finite rates
- Duplicate effective dates
- Missing expected currencies
- Unexpected rate movements (threshold TBD)
- Provider schema changes
- Publication lateness (threshold TBD)
- Checksum or payload integrity, where available

Failed ingestion should retry with backoff and alert. It must not delete the
last valid local dataset. The alert channel and owner are TBD before Phase 3.

### Availability policy

Rates resolve from local data only. For each conversion, the resolver applies the
first rule that matches:

1. An exact transaction-date observation with status `published`.
2. The latest prior `published` observation within the currency's maximum
   lookback, which is set in the catalogue (TBD before Phase 3). This covers
   weekends and holidays.
3. None. The figure is not converted. The product shows a data-quality state and
   hides the presentation amount for that figure. The API returns
   `fx_rate_unavailable` for requests that ask for a conversion.

During a provider outage, rules 1 and 2 still work from retained data. Existing
snapshots never change. New conversions use the same rules, so their rate date
gets older, but the rules do not change.

The UI shows the rate date and rate age for every converted figure. "Always
available" means "resolved from retained data, within the lookback." It never means
"fabricated."

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

A converted presentation value must include the presentation currency, rate policy,
and valuation date. Never show one converted number without that context.

### Transaction list

Transactions use native truth first:

```text
Dinner in Tokyo
Original       ¥8,400 JPY
Account amount £43.12 GBP
7 Nov · Card · Settled
```

Support filters for currency, account, settlement state (pending or settled),
conversion status, and FX fees. "Original/settled" is not a separate filter.

Pending rows are stored with `status = pending` and a `settled_at` value once they
settle. Balances and reports count settled rows by default. Pending rows appear
with a pending label.

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
- Import/source provenance: source system, source reference, retrieved time, and a
  link to the stored raw payload.

Until Phase 3 ships the local FX dataset, the rate fields show "not converted," and
presentation amounts are hidden. The overview FX modules are hidden until then too.

### Imported exchange display

Same-currency transfers can be shown simply. Cross-currency imported activity
must make both currencies visible and explain whether the rate was supplied by
the bank/card/provider or calculated by Hominem for reporting.

Hominem must not include buttons or flows that imply it can initiate an
exchange, transfer, or payment. The Transfers screen is read-only.

### Overview

The overview should answer:

- What do I own and owe by account currency?
- What changed from actual activity?
- What changed from FX valuation?
- Which imported records need attention?

Recommended modules:

1. Net worth at valuation-date rates, showing the valuation date and rate policy.
2. Balances grouped by currency.
3. Recent activity with native and account amounts.
4. Unrealized valuation movement. Realized FX is out of scope for the first release.
5. A repair queue for records that need attention.

### Budgets and runway

Budgets must store an explicit `currency_code` and period. Budgets that exist today
have no currency column. Their currency comes from the profile's primary currency,
and the migration copies that value into `currency_code` (see Additive migration).
Foreign activity must not silently
disappear or become overspending due only to rate movement.

Show:

```text
Travel budget · EUR 2,000 (currency_code EUR, period Nov 2026)
Native EUR spending:                 EUR 1,420.00
Foreign account activity:            GBP 210.00
Converted at transaction-date rates: EUR 245.00  (1 GBP = 1.16667 EUR)
Presentation value:                  EUR 1,665.00  (1,420.00 + 245.00)
Planning baseline:                   EUR 241.50  (210.00 × 1 GBP = 1.15000 EUR)
FX movement vs baseline:             +EUR 3.50  (245.00 − 241.50)
```

Runway must declare currency, rate date, included accounts, and assumptions in
the result itself. Runway paths in scope are the runway calculator input and the
per-budget ledger runway. The calculator input must take `currencyCode` and map it
to the stored per-budget currency. The assumptions field lists the included account
IDs, the rate date, the rate policy, and the opening-balance source.

### Formatting and accessibility

Show the currency code on every amount in reports and transaction detail. Show the
full currency name in tooltips and in grouped totals. Do not rely on `$`,
`£`, `¥`, color, hover, or chart position alone.

Test zero-decimal, three-decimal, negative, refund, cash-rounding, and obsolete
currency cases. Every amount must be accessible with its currency identity.

## API and database convergence

### P0 contract changes

- Require `currencyCode` on all transaction create, update, and import writes.
  Enforcement follows the compatibility window (see Additive migration).
- Return account `currencyCode` in every account DTO. The critic report says the
  shared `AccountData` type omits it. This was not re-verified, so check each
  account route.
- Remove silent USD defaults from write paths and from the `toCurrency` helper in
  `services/api/src/application/finance.service.ts`, which hard-codes `$` and two
  decimals.
- Name the affected routes and their defects. `/transactions/create` and
  `/transactions/update` have no `currencyCode` in their schemas, so Zod drops a
  client-sent value with no error. The database defaults `currency_code` to `'USD'`
  on transactions and accounts, so a currency-less write becomes USD. Each route
  gets a test that an unknown or missing currency returns 400 after the window.
- Enforce that a transaction's `currency_code` equals its account's currency.
- Define "account move" as changing a transaction's `accountId`. A move between
  accounts with different currencies is blocked with `currency_mismatch`.
- Group all balances and aggregates by currency.
- Route legacy RPC mutations through `FinanceService`
  (`services/api/src/application/finance.service.ts`).
- Error codes. "Stable" means the code string is versioned and documented, and
  changing it is a breaking change.
  - `invalid_currency`: already exists (`services/api/src/schemas/finance.schema.ts`).
    Keep it.
  - `currency_mismatch`: new.
  - `mixed_currency_aggregate`: new. Used only on endpoints that need one scalar.
    Grouping is the default. Named endpoints: runway starting cash.
  - `fx_rate_unavailable`: new. Used when the availability policy finds no
    observation.

### Wire format

- Money in DTOs is `{ amountMinor, currencyCode }`.
- `*Cents` and `formatted*` fields are deprecated for one release, then removed.
- Rates serialize as strings.
- These are breaking changes for web and MCP clients. They are listed in Phase 1.

### Additive migration

Existing rows that rely on a historical USD default must not be silently
reinterpreted. Classify them as `needs_currency_review` where their currency is
ambiguous. A row is ambiguous when neither its import file nor its source record
states a currency. Backfill only when the source states the currency explicitly.
Record the reason and provenance.

The compatibility window starts when Phase 1 is released and lasts 90 days. During
it:

- Accept currency-less writes, log a warning, and set `needs_currency_review` on
  the row. The storage column and its type are proposed here and confirmed at
  Phase 1 design.
- After the window, reject currency-less writes with 400.
- Instrument old-client calls. Identify a client by its API credential or
  user-agent. Log every request that has no `currencyCode`.
- Provide a repair queue for ambiguous historical data.
- Preserve existing original amounts and currency codes.

### Existing specifications to reconcile

The following documents and records describe currency behavior that must be
reconciled before Phase 1. Owners and due dates are TBD.

| Document | Topic to check against this plan | Owner | Due |
| --- | --- | --- | --- |
| `docs/finance-account-update-spec.md` | Account update rules for currency changes | TBD | TBD |
| `docs/hominem-finance-tools-spec.md` | Tool contracts that may omit currency | TBD | TBD |
| `docs/finance-budgets.md` | Profile-primary-currency budgets | TBD | TBD |
| `docs/decisions/finance.pfin-merge.md` | Merge decisions that touch currency | TBD | TBD |
| `docs/tasks/finance-runway-budgets.md` | Runway currency input | TBD | TBD |
| `packages/db/migrations/20261014120000_finance_account_allowed_currencies.sql` | Changes an account's currency. Add to the Phase 0 inventory as a documented repair. | TBD | TBD |

`allowedCurrencies` is removed (decision B5). Phase 0 defines its API removal and
migration path. Profile-primary-currency budget behavior is replaced by the budget
`currency_code`. Neither remains as an alternative to the single-currency account
and transaction-date-rate model.

## Alternatives considered

| Decision | Chosen | Rejected | Why rejected |
| --- | --- | --- | --- |
| Account currency model | One currency per account | `allowedCurrencies` side-buckets (current code) | Balances and reports need per-bucket rules. A currency change silently reinterprets stored amounts. |
| Runtime rate source | Local rate table | Provider call per request | Depends on provider uptime and rate limits. Reports change when the provider changes. |
| Report reproducibility | Snapshot per converted figure | Pinned rate-set version with an as-of cutoff | Version sets must be kept forever, and each correction creates a new set. Snapshots cost more storage but are simpler to check. |
| Cross-currency transfers | Two legs linked by `counterpartId` | New exchange entity | Duplicates existing counterpart logic. Needs a new API and screen. |
| Pending rows | Stored with status and settled timestamp | Keep rejecting pending rows | Loses pending-to-settled history. Imports drop information. |
| Realized FX | Deferred | Cost-basis model now | Needs lot tracking the schema lacks. Blocks the first release. |
| FX job host | Existing API worker | External scheduler | Adds a deployment and a new thing to monitor. |
| Currency coverage | Every active catalogue currency accepts entries | USD, GBP, EUR only | Product decision. Cost: rate gaps for some currencies, shown as data-quality states. |
| Stored amounts | Original and account pairs | Original amount plus rate only | A rate correction would need a data migration. |

## Risks and mitigations

| Risk | Trigger | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Provider outage | Ingestion run fails | No new rates | Retain the last valid dataset. Retry with backoff. Alert (channel TBD). Snapshots do not change. | TBD |
| Bad or corrupt rate | Provider error or payload change | Wrong reports | Validation rules under Import validation. Keep superseded observations. Snapshots record source. | TBD |
| Partial backfill | Job stops mid-range | Missing history | Resumable backfill. Coverage check per currency. | TBD |
| Migration misclassifies currency | USD default on old rows | Wrong balances | `needs_currency_review`. Backfill only from explicit sources. Repair queue. | TBD |
| Client breakage | Currency-less writes after the window | Failing integrations | 90-day warning window. Old-client logs. | TBD |
| Stored provider payloads | Raw payload kept for audit | Unexpected data stored | Payloads come from public reference-rate feeds. The app sends no user data to providers. Retention period TBD. | TBD |
| Unscoped report or FX access | Missing `userId` filter | Data exposure | Filter every report route by `userId`. Reference-rate tables are read-only to app users. | TBD |

### Scale limits

- Backfill range: TBD before Phase 3.
- Lookups: indexed on (`base_currency`, `quote_currency`, `effective_date`). Volumes
  TBD (see Local FX ingestion principles).
- Snapshot storage grows with every converted figure. Volume TBD.

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
