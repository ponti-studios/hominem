---
title: 'Per-user runway budget caps'
status: 'Proposed'
priority: 'high'
labels: [finance]
depends_on: []
estimated_size: 'S'
---

## Outcome

The live ledger runway uses saved, per-user monthly category caps and a
user-selected forecast currency. Matching-currency balances, recurring
debits, and caps feed the forecast; excluded currencies are disclosed.

## Scope

In scope: persisted per-user monthly category caps and forecast currency,
management controls on the Runway page, and Analytics budget totals based on
saved caps. Also fix the separate manual scenario and affordability math/API
contracts so all displayed outcomes follow their inputs.

## Work sequence

| ID    | Work item                                         | Owner boundary                    | Depends on   | Validation / artifact  | Done when                                                    |
| ----- | ------------------------------------------------- | --------------------------------- | ------------ | ---------------------- | ------------------------------------------------------------ |
| W-001 | Persist user-scoped currency and caps             | `packages/db`, `packages/finance` | —            | migration and DB tests | Users can only read and mutate their own settings            |
| W-002 | Filter live forecast by selected currency         | `packages/finance`                | W-001        | DB-backed tests        | Balances, recurring debits, and caps use one currency        |
| W-003 | Add Runway settings controls and Analytics totals | `apps/finance`                    | W-001, W-002 | UI tests               | Currency and caps persist; budget summary uses saved caps    |
| W-004 | Repair manual scenario calculation and JSON API   | finance packages/API/app          | —            | unit/API/UI tests      | Purchases affect projection, depletion, end date, and danger |
| W-005 | Repair affordability JSON API and UI states       | finance packages/API/app          | —            | unit/API/UI tests      | Finite inputs and unbounded/depleted states render safely    |

## Acceptance criteria

- [ ] AC-001: Live forecast sums only the selected currency and warns about currencies excluded.
- [ ] AC-002: User-owned monthly caps affect Runway and Analytics summaries.
- [ ] AC-003: Manual purchases affect all scenario results using calendar-month buckets over 12 months.
- [ ] AC-004: Affordability handles zero expenses, depleted balances, and unbounded runway safely.
- [ ] AC-005: Full gates and authenticated browser verification pass.

## Exit gate

Close only when the settings home decision and all acceptance
criteria are recorded.
