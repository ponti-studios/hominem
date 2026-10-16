---
title: 'Implement atomic travel workflows and maintenance tools'
status: 'Proposed'
priority: 'high'
labels: [travel, mcp, writes]
depends_on: [006-travel-single-entity-write-tools.md]
blocks: [008-travel-pass-two-live-acceptance.md]
estimated_size: 'XL'
---

## Objective

**Task ID:** T-007

Implement the pass-2 history/export reads, atomic journey workflows, missing entity access/maintenance operations, reparenting behavior, and Tier 3 merge tools specified in [travel MCP spec](../travel.mcp.md) §§7.7–7.8 and §§9.1–10.

## Context

These tools depend on the validated single-entity write layer in T-006. They make the domain operable without multi-call partial writes while keeping repairs explicit and auditable.

Owner boundary: `services/api` travel MCP tools and transactional application services; `packages/db` transaction/repository support only where required.

## Requirements

- Implement `travel_journey_save` as an atomic upsert of a journey dossier, with full dry-run projection, per-section counters, named row/section errors, and rollback on any invalid reference.
- Implement `travel_journey_clone`; shift journey/segment/leg/stay dates by the specified delta and clear booking references.
- Implement `travel_segment_reorder` and `travel_segment_merge` atomically, including stay and leg repointing, without silently renumbering surviving segments.
- Implement `travel_place_delete`, `travel_airport_delete`, and `travel_idea_delete` with exact in-use/refusal and snapshot semantics.
- Implement `travel_place_refresh` with default dry-run, full diff, explicit apply, and audit; never trigger it from another tool.
- Implement `travel_transport_get` and `travel_stay_get`; support the specified reparenting through update with consistency validation and old/new parent audit records.
- Implement `travel_place_merge` and `travel_airport_merge` as explicit operations; do not invoke either from import or another write.
- Implement `travel_entity_history` and `travel_export`, including deleted-entity history and native/sheet export parity.
- Make sheet-format export reconstruct `PLC-047` and `PLC-048` as source Places rows, preserving Residence period precision and ongoing semantics per §§2.8 and 20.4.
- Stop on any operation that cannot guarantee all-or-nothing persistence or an auditable before/after snapshot.

## Implementation Notes

- Preserve the exact contract and constraints in §§5.9, 5.11–5.14, 9.1, and 10.
- Use database transactions for multi-record operations; make failure behavior and recovery behavior explicit in tests.
- Completion artifact: registered tools/services plus integration coverage for atomic rollback, idempotent replay, authorization, persistence, audit history, and recovery.

## Acceptance Criteria

- [ ] Invalid journey-save references leave zero rows from the attempted save; a valid save and identical retry produce the expected counters.
- [ ] Clone clears booking references and shifts all dates consistently.
- [ ] Reorder cannot produce duplicate sequence values; merge repoints stays/legs and widens dates as specified.
- [ ] Delete refusal/success paths and snapshots match §§9.1 and 10.
- [ ] Place refresh dry-run reports Reykjavik without changing the record; explicit apply is separately auditable.
- [ ] Reparent operations validate parent consistency and audit the prior and new parent.
- [ ] Place/airport merges update references transactionally and return deleted snapshots.
- [ ] `travel_entity_history` remains readable after entity deletion, and native/sheet `travel_export` matches the documented entity shapes and columns.

## Testing

- Add integration tests for valid and invalid journey saves, identical replay, rollback, clone date shifts, booking-reference clearing, reorder, merge, delete in-use, refresh dry-run/apply, history reads after delete, reparenting, and airport/place merges.
- Test native and sheet export output, then test export-to-import append parity against the imported dataset.
- Test with synthetic records only for delete/merge operations; never use Reykjavik as a delete fixture.
- Run relevant API/database checks and `pnpm --filter @hominem/api build`.
