---
title: 'Possessions Phase 1 — sheet-parity fields, upserts, history, weight report, validate'
status: 'In progress'
priority: 'high'
labels: [possessions, mcp]
depends_on: []
blocks: []
estimated_size: 'XL'
---

## Outcome

Hominem models what the possessions sheet means: first-class weight/volume/vessel/lifecycle
fields on possessions, `donated`/`sold` statuses, container tracking + vessel config, idempotent
upserts over `externalId`, append-only history, a computed vessel weight report replacing the
weights tab, and an integrity audit replacing manual sheet audits. TDD throughout.

## Decisions (resolved with Charles 2026-10-12)

- Q1: `donated`/`sold` are first-class statuses (extend enum).
- Q2: acquisition/purchase-currency/retirement/ownership are first-class fields, not metadata.
- Q5: vessel limits/tares/notes live on the container records (`limitKg`, `tareKg`, notes via
  existing `description`).
- Q6: SHOP-xxx shares the registry; validate + weight report include it.
- Q7: keep Hominem-native records (ITM-0400, CON-040, video game pouch gets a CON-xxx).
- Deferred to cutover: Q3 (freeze style), Q4 (frozen backup location).

## Scope

In scope: migration + codegen, repository/DTOs, Zod schemas + record schemas, upsert tools +
REST endpoints, stable-pagination verification, history + event emission, weight report,
validate, import-mapper cutover to first-class fields, full gate.
Out of scope: Phase 2 backlog import execution, Phase 5 cutover, `move_plan`, `possession_merge`,
`possession_search_advanced` (decide: extend query vs semantic_search), finance links.

## Work sequence

| ID    | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| ----- | --------- | -------------- | ---------- | --------------------- | --------- |
| W-201 | Schema migration + codegen | `packages/db` | — | `just db migrate` + `codegen` | columns + checks live, types regen |
| W-202 | Repository DTOs + schemas + record schemas | `packages/db` + api schemas | W-201 | unit tests | new fields round-trip, donated/sold accepted |
| W-203 | Upsert tools + REST endpoints | api service/mcp/rpc | W-202 | crud + route tests | idempotent re-import proven |
| W-204 | History + event emission | `packages/db` + api | W-202 | history tests | every write emits an event |
| W-205 | Vessel weight report | api service/mcp | W-202 | report tests | dual convention + ghost-token warning |
| W-206 | Validate audit | api service/mcp | W-202 | validate tests | CON-036 class caught, triaged flags |
| W-207 | Import mapper to first-class fields | api import | W-202 | import tests | no lifecycle data left in metadata |
| W-208 | Full gate | repo | W-201–207 | `pnpm run check` | Gate green |

## Evidence

- Migration file + codegen diff.
- Test runs per work item (targeted vitest), then full gate.
- Live-data diffs re-run in Phase 2 before any import (plan §9: live data wins).
