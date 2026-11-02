# Finance budgets

A budget is a spending limit for one Finance **category**, with **its own cadence**. A category
has at most one budget, and the budget's period comes from its cadence — never from a global
monthly assumption and never from a user-set start date.

The database row (`app.finance_budgets`) stores only the limit and the cadence. Period bounds,
spent, remaining, rollover and pace are all computed at read time from the user's transactions;
nothing about spend is stored.

## Entity

One row per `(user_id, category_id)`:

| Field          | Meaning                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| `amount_cents` | The limit for one period, in integer cents of the primary currency.     |
| `cadence`      | `weekly`, `monthly`, `quarterly` or `annual`. Fixed set for V1.          |
| `created_at`   | The period containing this timestamp is the budget's tracking start.     |

Changing the amount or cadence updates the row. Creating a budget for a category that already
has one returns the updated budget (`created: false`) and never creates a second row.

Tag-level and merchant-level budgets do not exist. Tags are the drill-down layer; the category
is the decision layer.

## Cadence and calendar periods

Every cadence maps to a calendar period (UTC dates, inclusive bound):

| Cadence     | Period                |
| ----------- | --------------------- |
| `weekly`    | Monday–Sunday         |
| `monthly`   | 1st–last day of month |
| `quarterly` | Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec |
| `annual`    | 1 January–31 December |

Custom periods (every 45 days, every 6 months, every 2 weeks) are rejected by both the tool
schema and a database check constraint.

## Rollover is asymmetric

- **Overspend always carries** as a deficit into the next period, on every cadence. Dining Out
  £300/month spent £340 in March opens April at £260 available.
- **Underspend on weekly/monthly/quarterly is swept to savings.** It is reported as
  `sweptToSavingsCents` for the closed period and does not raise the next period's available
  amount. Dining Out spent £250 in March → £50 swept, April starts at the full £300.
- **Underspend on annual carries forward in full.** Travel £4,000/year spent £1,000 in year one
  opens year two at £7,000. An annual overspend still carries as a deficit.

A budget never moves money. "Swept to savings" is a computed figure for the closed period, not
a transaction.

## Pace

Pace is projected at read time against the budget's **available** amount (`amount_cents +
opening balance`):

- `periodElapsedFraction` — elapsed time / period length.
- `spentFraction` — spent / available.
- `projectedSpendCents` — spent projected to period end at the current rate.
- `projectedExhaustionDate` — when the current rate reaches the limit, `null` if it never does
  inside the period.
- `paceStatus` — `insufficient_data` until **20%** of the period has elapsed (on every cadence,
  because a single early purchase would make a projection nonsense), then `on_track`
  (projected ≤ available) or `ahead` (projected > available).

Hominem computes; agents notify. Budget alerts are a separate concern.

## Currency

Budgets store **no currency**. Every read resolves the currency from the user profile's
`primary_currency` (`app.user_profiles`), and `finance_budget_create` accepts no currency
argument. Setting it is an explicit profile action (`finance_primary_currency_set`), never a
side effect of creating a budget.

Spent counts **every transaction in the category**, whatever currency it was spent in:

- A primary-currency transaction counts at its own amount.
- A foreign-currency transaction counts at its **settled primary-currency amount** — the amount
  actually charged to the card or account (`finance_transactions.settled_amount` in
  `settled_currency_code`). The exchange rate is the issuer's and is already in that amount.
- No exchange rate is looked up, stored or applied anywhere. A foreign transaction with no
  settled primary-currency amount cannot be counted and is surfaced in budget status as an
  uncounted foreign transaction, never converted at an invented rate or silently dropped.

If the user changes their primary currency, budgets re-denominate: each transaction is counted
at its settled amount in the new currency where the record carries one.

Excluded rows, pending rows and transfers are not spending. Future-dated rows inside the
current period are not counted until the day arrives.

## Tools

- `finance_budget_create` — create (or replace) the single budget for a category.
- `finance_budget_list` — every budget with its current period status.
- `finance_budget_get` — one budget's status.
- `finance_budget_update` — change the amount and/or cadence.
- `finance_budget_delete` — delete the budget (confirmation required; transactions untouched).
- `finance_primary_currency_set` — set the profile primary currency budgets are denominated in.

## Seeding the budgets of record

`just db seed-budgets` seeds the two budgets of record for the local test user (override with
`BUDGET_SEED_USER_EMAIL` / `BUDGET_SEED_PRIMARY_CURRENCY`):

| Category   | Amount     | Cadence |
| ---------- | ---------- | ------- |
| Groceries  | 25000 cents (£250) | monthly |
| Dining Out | 30000 cents (£300) | monthly |

The legacy `app.finance_monthly_budgets` table is the finance app's runway-planner monthly
configuration, not this entity. Budgets of record live in `app.finance_budgets`.
