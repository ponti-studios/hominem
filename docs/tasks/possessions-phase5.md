---
title: 'Possessions Phase 5 — cutover (sheet frozen, Hominem canonical)'
status: 'Proposed'
priority: 'high'
labels: [possessions]
depends_on: [possessions-phase3.md]
blocks: []
estimated_size: 'S'
---

## Outcome

The Google Sheet stops being a living registry: it becomes a frozen, dated backup, and
Hominem is the single source of truth for inventory work. The column-position map is
retired and every inventory workflow points at Hominem tools.

## Decisions — OPEN, USER DECISION REQUIRED

- **Q3 cutover style** (plan §10): hard-freeze one evening, or rolling dual-write with a
  final diff before freezing. Deferred to cutover in Phase 1.
- **Q4 frozen backup location** (plan §10): keep the frozen sheet in Drive, or also export
  a dated CSV into the repo. Deferred to cutover in Phase 1.
- **Packing list home** (plan §9 Phase 4 residue): the `luggage` tab's 3 rows become a
  note or a container description in Hominem — which one, and under what name.

## Scope

In scope: freeze the sheet; a final live-data diff if Q3 is dual-write; fold the luggage
packing list into Hominem; retire the column-position map and repoint operating notes;
record the frozen backup.
Out of scope: Phase 6 long-term ops (`move_plan`, scheduled validate) — tracked in the
plan.

## Work sequence

| ID    | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| ----- | --------- | -------------- | ---------- | --------------------- | --------- |
| W-221 | Resolve Q3/Q4 + packing-list home | user | — | recorded decision | decisions recorded in this task |
| W-222 | Fold the luggage packing list into Hominem | api data | W-221 | the note/description live | content present, sheet row count matches |
| W-223 | Final live-data diff (if dual-write) | api script | W-221 | `diff-possessions.ts` output | 0 unexplained deltas before freeze |
| W-224 | Freeze the sheet (read-only / dated copy) | user (Drive) | W-223 | frozen sheet exists | sheet no longer accepts edits |
| W-225 | Retire the column-position map; repoint workflows | user + repo docs | W-224 | operating notes updated | no workflow reads the sheet |

## Evidence

- Frozen sheet reference (URL/date) and, if chosen, the dated CSV.
- Final diff output (if Q3 dual-write).
- The packing-list content in Hominem (id/location).
- Repo doc sweep: no durable doc treats the sheet as source of truth (only the possessions
  migration task docs + plan PDF reference it, as history).