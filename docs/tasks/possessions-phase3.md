---
title: 'Possessions Phase 3 — verification of the imported registry'
status: 'Proposed'
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

## Evidence

- Script smoke run (synthetic post-import state): counts 8/8, zero missing/dupes, spot
  items resolved (created_from_existing_item, leading-zero serial, CON-024).
- Live run + triage notes once the prod tunnel is reachable (or run by the user via
  `verify-possessions-phase3.ts --email ... --dir ...`).