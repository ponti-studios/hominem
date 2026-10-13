---
title: 'Possessions Phase 5 — cutover (sheet frozen, Hominem canonical)'
status: 'Blocked'
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

## Decisions

- **Q3 cutover style**: **hard freeze one evening** (2026-10-13) — Charles stops editing
  the sheet for one evening; the final diff runs against that quiet state, then the sheet
  is frozen. No rolling dual-write.
- **Q4 frozen backup location**: **keep the frozen sheet in Drive** (2026-10-13) — a
  dated, read-only copy; no inventory CSV enters the repo.
- **Packing list home**: **the notes domain, as one note** (2026-10-13) — the list spans
  five bags, so no single container description holds it; the Vessels sentence can ride
  with the LEVEL8 containers separately. Folded as note
  `01a13639-7a29-7e0b-b347-326f5bddaa2c` ("Luggage — packing list", kind `note`): the
  vessel sentence plus the 26-slot packing skeleton in verbatim order (Osprey ×12,
  LEVEL8 28in ×7, Container ×5, John Lewis ×1, carry-on ×1).

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
| W-222 | Fold the luggage packing list into Hominem | api data | W-221 | note `01a13639…` | content present, 26 slots match the tab |
| W-223 | Final live-data diff on the freeze evening | api script | W-221 | `diff-possessions.ts` output | 0 unexplained deltas before freeze |
| W-224 | Freeze the sheet (read-only / dated Drive copy) | user (Drive) | W-223 | frozen sheet exists | sheet no longer accepts edits |
| W-225 | Retire the column-position map; repoint workflows | user + repo docs | W-224 | operating notes updated | no workflow reads the sheet |

## Evidence

- **W-221**: Q3 hard freeze, Q4 Drive-only, packing list → notes domain (recorded above).
- **W-222**: note `01a13639-7a29-7e0b-b347-326f5bddaa2c` in `app.notes` (kind `note`),
  content verified against the tab: 26 slots, verbatim order, counts Osprey ×12 /
  LEVEL8 28in ×7 / Container ×5 / John Lewis ×1 / carry-on ×1.
- **Cutover readiness (pre-freeze)**: `diff-possessions.ts` against the 2026-10-13
  exports — 0 to import, 0 possession deltas, 0 container deltas; live 460 possessions /
  42 containers (incl. CON-036); Hominem-only records as expected (CON-024, CON-040,
  CON-042, CON-036).
- **Blocker**: W-223–W-225 await the chosen freeze evening (user action in Drive + notes).
- Repo doc sweep: no durable doc treats the sheet as source of truth (only the possessions
  migration task docs + plan PDF reference it, as history).