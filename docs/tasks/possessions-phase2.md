---
title: 'Possessions Phase 2 — live-registry diff, backlog import, reconciliation'
status: 'Implemented'
priority: 'high'
labels: [possessions]
depends_on: [possessions-phase1.md]
blocks: []
estimated_size: 'S'
---

## Outcome

The verified backlog from the migration plan (§9) is imported into the live registry and
reconciled, with a read-only diff tool ("re-run both diffs, live data wins") as the
pre-import gate. Every container is addressable by externalId.

## Decisions

- Sheet exports are the incoming truth; existing Hominem-only records are kept (plan Q7).
- CON-024 (in Hominem, not in the sheet) is authoritative; item refs resolve against it.
- CON-036 (in neither system) imports unassigned; no container record is invented.
- "video game pouch" gets the next free CON-xxx (CON-042).
- Import events stay absent for bulk rows (plan pre-accepted trade-off; one event per row
  was not required).

## Scope

In scope: diff tool with field-level "will overwrite" reporting, importer live-container
resolution, backlog apply (ITM-0409→ITM-0440, CON-041), reconciliations (CON-024,
CON-036, ITM-0400/CON-040/pouch), idempotency + count verification, bot-review hardening,
full gate.
Out of scope: Phase 5 cutover, `move_plan`, `possession_merge`, finance links.

## Work sequence

| ID    | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| ----- | --------- | -------------- | ---------- | --------------------- | --------- |
| W-209 | Re-run §9 diffs against live data | api script | W-201–208 (phase 1) | possessions diff script output (one-off runner, since retired) | backlog = 32 items + CON-041, reconciliations confirmed |
| W-210 | Importer resolves live-container refs | api script | W-209 | dry run | CON-024 class links; CON-036 class left unassigned |
| W-211 | Backlog import apply + CON-042 | prod data | W-210 | backup + apply | 32 items + CON-041 live; pouch → CON-042 |
| W-212 | Count/idempotency verification | prod data | W-211 | re-run diff + re-apply | 460 possessions / 41 containers; 0 to import; 0 new rows on re-apply |
| W-213 | Diff tool hardening (bot findings) | api script | W-212 | A1 field deltas, null-externalId reporting, full JSON artifact | `diff-report.json` covers modified rows, CON-024 class, next CON |
| W-214 | Full gate | repo | W-209–213 | `pnpm run check` | Gate green |

## Evidence

- Pre-write prod backup `hominem_prod_20261013_093440_possessions-phase1.dump` (validated,
  SHA-256 `c30a78d2…c106bc`).
- Live diff re-runs (0 to import after apply); idempotent re-apply (counts unchanged).
- Post-apply: 460 possessions / 41 containers; ITM-0263 unassigned; CON-042 verified.
- Spot checks: `ITM-0409` moveAction, `ITM-0439` currency on the live rows.