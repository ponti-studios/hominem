---
title: 'Possessions Phase 3 — verification of the imported registry'
status: 'Blocked'
priority: 'medium'
labels: [possessions]
depends_on: [possessions-phase2.md]
blocks: []
estimated_size: 'S'
---

## Outcome

The live registry is verified to mirror the imported sheet per the plan's Phase 3 gate
(§9): counts/exactly-once, field parity, spot samples, validate triage, finance-summary
comparison, and the vessel-weight report vs the weights tab.

## Scope

In scope: `verify-possessions-phase3.ts` (read-only runner), the Phase 3 checks against
live production data, triage of `possession_validate` findings, finance-sheet comparison,
weights-tab row-by-row comparison.
Out of scope: Phase 5 cutover, `move_plan`, `possession_merge`.

## Work sequence

| ID    | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| ----- | --------- | -------------- | ---------- | --------------------- | --------- |
| W-215 | Verify runner (counts, exactly-once, validate, summary, vessel report, spot samples) | api script | W-209–214 (phase 2) | local smoke | script runs read-only; full gate green |
| W-216 | Run against live production | prod data | W-215 | `verify-report.json` | all checks reported; no untriaged findings |
| W-217 | Weights-tab row-by-row vs vessel report | prod data + sheet | W-216 | weights tab export | no >0.05kg unexplained diffs |
| W-218 | Finance-sheet value comparison | prod data + finance sheet | W-216 | summary vs finance | value totals reconciled |

## Run results (2026-10-13, live production)

- **Counts / exactly-once (W-216)**: 460 live possessions / 41 containers vs 352 sheet
  items / 38 sheet containers; **0 missing, 0 duplicate ids** on either side; **0 to
  import** on both (idempotent).
- **Field parity**: **0 item + 0 container deltas** (after fixing a key-order false
  positive in the diff's metadata comparison — commit on `fix/possessions-diff-metadata-order`).
- **Spot samples**: `created_from_existing_item` (ITM-0395) match; CON-024 (ITM-0202 →
  live container id) match; 20 highest-value items: 0 mismatched fields. Leading-zero
  serial: no such item exists in the sheet (reported `n/a`, not a failure).
- **Finance (W-218)**: **exact** — live ITM sums USD 43477.27 / GBP 373.15 purchase and
  USD 9846.00 sale match `finance-expectations.json` master aggregates to the cent.
- **Weights (W-217)**: not yet reproducible — see below.

## Open findings from the run

1. **Vessel config never imported.** `limitKg`/`tareKg`/`vesselGroup`/notes are all
   absent from the container records, so the report shows tare 0 / no limits / no groups
   and cannot match the weights tab's per-vessel totals. Needs a config import (plan Q5).
2. **moveAction tokens don't resolve to containers.** 73 `unknown_vessel` findings: the
   sheet's vessel tokens are short nicknames (`luggage_medium`, `carry`, `jewelry pouch`,
   `cyndi crate`, `pouch_video_games`…) that don't equal any container name, so items get
   their own vessel row instead of rolling into the case container the weights tab used.
   Needs a token→container alias mapping (or container name alignment).
3. **`dispose`/`sell` are in `move_action`.** 30 of those 73 `unknown_vessel` findings are
   archived rows annotated `dispose`/`sell` — disposition markers, not vessels, and
   validate's `unknown_vessel` (unlike `unplaced_item`/`missing_weight`) is not gated to
   active items. Likely a false-positive class to gate.
4. **`Send My Bag Box 2` off by 0.90 kg** (tab 4.54 vs report 3.64) and **small carry-on**
   (tab 1.81 vs tokens 1.655 / 2.84) — the ghost-bag class; investigate once (1)/(2) land.
5. `possession_validate` at 559 findings (unplaced 138, missing_weight 252, zero_price 56,
   missing_currency 29, archived_in_container 11, unknown_vessel 73) — triage pending;
   several classes look like inherent sheet/registry data-quality, not import defects.

## Evidence

- Script smoke run (synthetic post-import state): counts 8/8, zero missing/dupes, spot
  items resolved (created_from_existing_item, leading-zero serial, CON-024).
- Live run + triage notes once the prod tunnel is reachable (or run by the user via
  `verify-possessions-phase3.ts --email ... --dir ...`).