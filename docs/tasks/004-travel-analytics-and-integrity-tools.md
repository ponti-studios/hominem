---
title: 'Implement travel analytics and integrity tools'
status: 'Implemented'
priority: 'high'
labels: [travel, mcp, analytics]
depends_on: [003-travel-tier-one-read-tools.md]
blocks: [005-travel-tier-one-live-acceptance.md]
estimated_size: 'XL'
---

## Objective

**Task ID:** T-004

Implement the aggregate, global-search, integrity, timeline, insight, and distance tools in [travel MCP spec](../travel.mcp.md) §6.12 and §§7.1–7.6.

## Context

These tools combine data across the Tier 1 reads and must follow the segment-derived semantics in §§3.2–3.3. They depend on T-003’s entity query/service layer and imported records.

Owner boundary: `services/api` travel application services, MCP tool definitions, schemas, and integration tests.

## Requirements

- Implement `travel_unresolved`, `travel_stats`, `travel_search`, `travel_validate`, `travel_timeline`, `travel_insights`, and `travel_distance` with the exact inputs and payload semantics in §6.12 and §§7.1–7.6.
- Compute visited places/countries and all relevant aggregates from Segments, not stored Place status. Surface discrepancies; never repair them automatically.
- Implement haversine distance with R = 6371 km, whole-kilometer rounding, null for missing coordinates, and resolved endpoint places.
- Include every specified `travel_validate` check, offender references, and current-data expected findings; report findings without modifying source data.
- Return home gaps and place/country duration metrics as defined; label recorded-leg distance as a floor and include top-N truncation metadata.
- Add Residence periods to the timeline and Residence-aware home measures to insights, preserving source date precision and required labels from §§2.8 and 20.5.
- Cover all Residence timeline labels, including the `multiple_current_homes` refusal, using the exact acceptance cases in §20.5.
- Preserve the exact distinction between wishlist/venue visits and travel place/segment data.
- Stop and report any unexpected integrity finding with evidence before treating it as a source-data correction.

## Implementation Notes

- Treat [travel MCP spec](../travel.mcp.md) §§3.2–3.3, 4, §§7.1–7.6, and 8 as normative; do not normalize known discrepancies.
- Completion artifact: tool definitions/services and a deterministic fixture-based integration suite covering aggregates, integrity findings, date boundaries, and distance sanity anchors.
- Record live verification outputs in `docs/tasks/artifacts/`; keep raw run IDs and records out of this task file.

## Acceptance Criteria

- [x] Segment-derived country count is 10 and `excludedByMethod` names Iceland; Places-derived 11 is not presented as the headline.
- [x] `travel_validate` reports exactly the two Transport legacy-ID collisions, includes Reykjavik, reports three thin-evidence stays, and has the §12 expected zero counts.
- [x] Haversine values for LAX→SYD, JFK→LHR, and DFW→LAX fall within the specified tolerances; total recorded-leg distance is within 1% of 125,700 km.
- [x] Timeline, `daysPerCountry`, Sydney/Melbourne/Byron Bay night counts, and `nextTrip` match §12.
- [x] `travel_search`, `travel_unresolved`, and every aggregate obey result caps and explicit truncation metadata.
- [x] All tools are read-only, owner-scoped, and return structured/text payload parity.

## Testing

- Add deterministic unit tests for pure analytics, date overlap, segment-derived aggregates, and haversine calculations.
- Add MCP integration tests for `travel_validate`, global search, timeline, insights, unresolved summary, and distance.
- Use §12 ground-truth examples as fixtures; run `pnpm --filter @hominem/api build` and affected API checks.
