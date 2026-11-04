# Finance bills

A bill is reference data about a recurring obligation — who it is with, how it is paid, what
it should cost — plus the derivation rules that hang off it. It is never a payment mechanism:
Hominem syncs nothing, and a bill never creates, moves or edits a transaction.

The database row (`app.finance_bills`) stores the obligation and the rules for reading it.
Period bounds, last-paid, burn and run-out are all computed at read time from the bill's
schedule, the user's transactions and the balance log; nothing derived is stored.

## Entity

One row per bill:

| Field                  | Meaning                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `name`                 | Display name.                                                                               |
| `provider_name`        | Supplier name as billed.                                                                    |
| `kind`                 | `electricity`, `heating`, `water`, `broadband`, `council_tax`, `insurance`, `rent`, `other`. |
| `account_number`       | Stored and returned verbatim: account numbers, customer references, meter serials.          |
| `payment_method`       | `direct_debit`, `pay_as_you_go`, `card`, `manual`, `other`.                                  |
| `amount_model`         | `fixed` (carries an expected amount), `variable` (omits it), `top_up` (typical top-up).     |
| `expected_amount_cents`| NULL for a variable bill.                                                                   |
| `currency_code`        | The bill's own currency, unlike budgets which resolve the profile primary currency.         |
| `cadence`              | `weekly`, `monthly`, `quarterly`, `annual`, `one_off`, or NULL for no recurrence.            |
| `due_day`              | 1–31; a short month clamps the computed due date to its last day.                           |
| `due_date`             | The due date of a `one_off` bill.                                                           |
| `anchor_date`          | Reference point weekly, quarterly and annual cadences step from.                            |
| `status`               | `active`, `paused`, or `closed`. Closed is bookkeeping, not deletion.                       |
| `type`                 | Detection lifecycle: `suggested`, `confirmed`, or `cancelled` (terminal).                   |
| `merchant_match`       | Every string that identifies this supplier in a feed.                                       |
| `stale_after_hours`    | Top-up only: hours after the latest balance entry at which the balance reads stale.        |
| `payg_warn_days`       | Top-up only: low-balance threshold in days of credit remaining, not money.                  |
| `account_id`           | Optionally linked finance account; the bill never moves money on it.                        |

A recurrence needs a cadence, and a cadence needs something to be due on: a `one_off` bill
needs its `due_date`, other cadences need their `due_day`, and weekly, quarterly and annual
cadences additionally step from `anchor_date`. A top-up bill carries no cadence — its cadence
is effectively manual. The schedule check constraint enforces this so no writer can store a
half-schedule, and the repository validates the merged row with readable errors before the
database ever sees it.

## Detection lifecycle

One table carries the lifecycle: detection materialises the same row a user later confirms,
so there is no separate dismissals table.

- `suggested` → `confirmed` or `cancelled`. Confirming a suggestion clears its dismissal: the
  decision is made.
- `cancelled` is terminal and can never be left; a `confirmed` bill cannot return to
  `suggested`.
- Dismissal lives on the suggested row itself (`is_dismissed`, `last_dismissed_at`). Only a
  suggested bill can be dismissed.

## Last-paid claims

A transaction matches a bill when any one of the bill's `merchant_match` strings is a
case-insensitive substring of the transaction's merchant name or description. The match is a
plain substring (`strpos`, not `like`), so supplier codes containing `%` or `_` cannot escape
it. Empty match strings never match.

Each transaction is awarded to the earliest-created matching bill. Excluded and pending rows
are never claimed: they are not payments. The latest claimed transaction per bill reads back
as `lastPaid`.

## Next due date

Computed at read time from the cadence and due day with month-end clamping, never stored:

- `monthly` recurs on `due_day` (due on the 31st lands 28 February); the next date on or
  after today wins.
- `weekly` steps from `anchor_date` in exact 7-day increments; its stored `due_day` is not
  part of the computation.
- `quarterly` and `annual` step from `anchor_date` by 3 and 12 months, landing on `due_day`
  with month-end clamping.
- `one_off` returns its `due_date`; a bill with no cadence returns null.

## Pay-as-you-go

Only a top-up bill has a balance to observe. The log (`app.finance_bill_balance_entries`) is
append-only: one row per check, corrections are new rows, and an entry is only ever "balance
X as of checked_at". No currency column — the bill owns its currency. A reading is a
measurement, not money. Balance entries on bills that are not top-up are rejected.

The derivation reads the two latest entries:

- the daily burn is the balance drop per day between them; a single observation carries no
  burn, and a rising balance (a top-up landed between checks) carries no run-out projection;
- the run-out date projects the latest balance forward at the burn rate;
- the balance reads stale once the latest entry is older than `stale_after_hours`, and low
  once the remaining days reach `payg_warn_days`.

Deleting a bill deletes its balance log; the bill's transactions are untouched.

## Tools

- `finance_bill_create` — register a bill.
- `finance_bill_list` — every bill with its computed next due date, last-paid and
  pay-as-you-go state; filter by status, lifecycle type, or kind.
- `finance_bill_get` — one bill with its computed state and its recent balance log, most
  recent first. Null when the id is not the caller's bill.
- `finance_bill_update` — change reference data, the schedule, or the detection state.
  Schedule rules run on the merged row; unknown or foreign ids read as null.
- `finance_bill_delete` — delete a bill and its balance log (confirmation required).
  Set `dryRun` to preview the affected bill and its entry count without writing.
- `finance_bill_log_balance` — append a balance observation on a top-up bill and read back
  the updated derivation.
