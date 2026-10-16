---
title: 'Implement the travel Tier 1 read tools'
status: 'Implemented'
priority: 'high'
labels: [travel, mcp]
depends_on: [002-travel-import-and-backfill.md]
blocks: [004-travel-analytics-and-integrity-tools.md]
estimated_size: 'XL'
---

## Objective

**Task ID:** T-003

Implement the Tier 1 entity and lookup tools in [travel MCP spec](../travel.mcp.md) §§6.1–6.11 over the imported Hominem travel records.

## Context

This task follows the imported dataset and schema. Its tool contracts are specified in [travel MCP spec](../travel.mcp.md); the reference CLI behavior is `~/workspace/travel/travel.py` when available. Keep the existing `trip_history` tool unchanged throughout this work.

Owner boundary: `services/api/src/mcp/tools` travel tool modules, travel schemas, application services, and their API-local tests.

## Requirements

- Implement `travel_journey_list`, `travel_journey_get`, `travel_segment_list`, `travel_segment_get`, `travel_place_list`, and `travel_place_get` with the specified filters, ordering, stable IDs, derived fields, dossiers, and visit history.
- Implement `travel_countries` with the segment-derived method and transparency fields specified in §6.5.
- Implement `travel_transport_list`, `travel_airport_list`, `travel_airport_get`, `travel_stay_list`, `travel_booking_lookup`, `travel_wishlist`, and `travel_idea_list` as specified.
- Implement the §5 pagination contract for list results: `limit`, `offset`, `total`, and `truncated`; do not silently truncate.
- Resolve transport endpoints through Airport `servesPlace` and match place name, city, and code as specified. Boundary legs with one segment link remain valid; legs with no segment links do not count as visits.
- Return `id` and `legacyId` on every applicable entity read and preserve exact source fields without adding attendee data or linking venue visits to trips.
- Include canonical Place-to-Residence relationships in the documented `relationships` object, including London's residence link (§20.5).
- Use the `travel:read` scope for travel tools. Keep `place_visit_history` under its existing `places:read` scope and keep it separate.
- Stop if implementation requires changing the reserved compatibility behavior of `trip_history` or inventing a travel/place association.

## Implementation Notes

- Follow `services/api/AGENTS.md` and existing MCP tool registration, Zod schema, named-error, structuredContent, result-cap, and read authorization conventions.
- Document tool descriptions in the §5.7 house style: mode, when to use, when not to use, prerequisites, and produced IDs.
- Completion artifact: registered tool definitions, schemas/services, and focused MCP integration tests for tool payloads, sorting, filtering, and scope visibility.

## Acceptance Criteria

- [x] Each tool in §§6.1–6.11 returns the documented fields, order, and filters against imported data.
- [x] `travel_countries` returns the segment-derived country set and explains the difference from stored Place status.
- [x] `travel_journey_get` returns the complete dossier without follow-up reads, including resolved legs, distances, and stays.
- [x] JRN-042, JRN-048, HA6FQZ, YQUQ9J, BNK, and KEF match the §12 worked examples.
- [x] Booking lookup disambiguates the shared T-004/T-005 legacy IDs using the booking reference.
- [x] List pagination and `structuredContent` / text-body parity are tested.
- [x] `trip_history` behavior is unchanged, and venue visit tools remain separate and independently scoped.

## Testing

- Add MCP integration tests for each tool’s core filters, empty results, pagination, named errors, structured output, and authorization scope.
- Assert the JRN-042 dossier and endpoint resolution through BNK → Byron Bay.
- Run `pnpm --filter @hominem/api build` before any consumer changes, then the affected API checks.
