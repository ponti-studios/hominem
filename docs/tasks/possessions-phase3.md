---
title: 'Possessions Phase 3 — verification of the imported registry'
status: 'Implemented'
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
| W-219 | Vessel config import (owner data, not code) | db + api script | W-217 | migrate + `configure-possessions-vessels.ts` dry run/apply | tare/limit/group/tokens live; config row set |
| W-220 | Token→vessel resolution in report + validate | api service | W-219 | tests + live verify | weights tab reconciled ≤0.05kg; unknown_vessel 0 |

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
- **Weights (W-217)**: **reconciles with the weights tab to ≤0.05 kg** after the vessel
  config import and token resolution (below): small carry-on 5.305 vs 5.31, medium 5.65,
  large 9.076 vs 9.08, backpack 1.59, shopper 0, boxes 20.125 / 4.54 / 13.75, Cyndi
  crate 0.5; groups cabin 6.895 vs 6.90 and checked 14.726 vs 14.73 with the configured
  allowances (12 / 46). Unknown-vessel findings: **0**.

## Vessel configuration (2026-10-13)

- Migration adds `possession_containers.vessel_tokens text[]` and a per-owner
  `app.possession_vessel_config` (marker tokens + group allowances). All values are owner
  data — nothing owner-specific in code.
- `configure-possessions-vessels.ts` applies the frozen weights tab's formulas, driven by
  a config JSON (`~/Downloads/possessions-vessel-config.json`); dry run by default,
  idempotent.
- Applied live: 9 vessels configured (tare/limit/group/tokens); `CON-036` created as
  "Cyndi crate" and `ITM-0263` linked to it; markers `carry/kelsey/dispose/sell`;
  allowances `{cabin: 12, checked: 46}`.
- The report and `possession_validate` resolve tokens through the declared membership;
  markers are counted separately (`markers`), never as vessels; group limits use the
  configured allowances. The earlier `unknown_vessel` gating premise was already true —
  `dispose`/`sell` were already excluded as archived; no code change needed there.

## Validate triage (486 findings, all data-quality classes, none import defects)

- `unplaced_item` 138 — active items with no container and no moveAction; packing
  workflow input (the report exists for this), not a defect.
- `missing_weight` 252 — active items without weightKg; the rollup undercounts them by
  design and the class exists to surface that; fill weights over time.
- `archived_in_container` 11 — archived items still linked to a container; disposal
  hygiene, actionable per row.
- `zero_price` 56 — price 0; correct for gifts (the finding message says so).
- `missing_currency` 29 — price present, currency absent/uninferable; sheet data gap.
- (`unknown_vessel` is now 0; `disposed_not_archived` and `unknown_vessel_group` absent
  on this registry.)

## Evidence

- Script smoke run (synthetic post-import state): counts 8/8, zero missing/dupes, spot
  items resolved (created_from_existing_item, leading-zero serial, CON-024).
- Live run 2026-10-13 against production (via the database TCP proxy): results in the
  Run results section above; `~/Downloads/verify-report.json` and
  `~/Downloads/diff-report.json` are the artifacts.