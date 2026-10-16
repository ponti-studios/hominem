---
title: 'Create travel entities and shared MCP plumbing'
status: 'Implemented'
priority: 'high'
labels: [travel, mcp, database]
depends_on: []
blocks: [002-travel-import-and-backfill.md]
estimated_size: 'XL'
---

## Objective

**Task ID:** T-001

Create the travel entities and shared persistence, audit, timestamp, and tagging plumbing required by the travel MCP specification, including Residence entities from the approved §20 decision.

## Context

[travel MCP spec](../travel.mcp.md) is the authoritative travel-domain contract. It defines Place, Journey, Segment, Transport, Stay, Airport, and Idea, along with required foreign keys, uniqueness constraints, audit history, and tag registration. The existing `app.travel_trips` and venue-oriented `app.places` / `app.place_visits` are distinct data models. Keep venue places separate from travel places.

Program outcome: migrate the Sheet-backed travel domain into Hominem and provide the specified `travel_*` read, write, import, and maintenance tools. The program does not modify or deprecate `trip_history`, add attendees/money/documents, access Google Sheets at runtime, repair source discrepancies automatically, or retire the Sheet without a later explicit operator decision. Residence periods are now in scope under §20.

Owner boundary: `packages/db` schema, migrations, repository/DTO boundary, and the generic tag entity-type plumbing used by MCP tools.

## Requirements

- Add the travel entities with the fields and semantics in [travel MCP spec](../travel.mcp.md) §2; preserve nullable legacy dates and the specified duplicate Transport legacy IDs.
- Add owner-scoped foreign keys and constraints that prevent invalid parent relationships, duplicate segment sequence numbers, and inverted date ranges where the specification requires prevention.
- Add `createdAt` / `updatedAt` fields and append-only, per-entity audit history usable after entity deletion. Travel writes and import rows must be auditable.
- Extend generic entity tagging with distinct types for every travel entity. The travel Place type must not alias the existing venue `places` type.
- Add the Residence table and its generic tag type under approved Option C (§20); use the final fields and period precision from §2.8.
- Do not add attendees, money, document attachments, geocoding, or automatic data repair. Residence records are required by the approved §20 decision.
- Stop and record the exact mismatch if the existing database conventions cannot express a specified constraint without a product decision; do not silently alter the data model.
- Preserve `app.travel_trips`, `app.travel_segments`, and `app.travel_trip_attendees` exactly as they are: no rename, writes, or data movement. The new stop table is `app.travel_journey_segments`; MCP tool names remain as specified.
- Before migration, collision-check every proposed table name and record the final physical names in §16's preflight addendum. Use a journey-/domain-prefixed name for any collision; never rename an existing table.
- Before the first schema change, snapshot `trip_history` both with its default limit and with `limit: 50`. Acceptance requires byte-identical output against both snapshots.
- Attendees remain legacy-only per §15: do not model them, drop them, or move them.

## Implementation Notes

- Load the `hominem-database` skill before database/schema/repository work and follow `docs/database.md`.
- Use Goose migrations and generated database types; keep mutations owner-scoped and consistent with existing repository/DTO boundaries.
- Run `just db migrate`, `just db migrate test` when the test database is running, and `just db codegen` against the supported local databases.
- Preserve existing `trip_history` and venue-place records and tools.
- Completion artifact: migration(s), generated types, repository/DTO code, and focused tests for schema constraints, ownership, audit persistence, and tag entity distinctions.
- Stop condition: do not begin import work until migrations and generated types are current and the database checks pass.
- Stop condition: do not create any travel table until the §16 preflight addendum and trip-history baselines are recorded.

## Acceptance Criteria

- [x] All travel entities match §2, including the non-unique Transport legacy ID behavior; archived flags follow §5.14.
- [x] Residence model, period precision, and relationships match approved §§2.8 and 20.
- [x] Foreign-key, ownership-consistent relationships, audit, timestamps, append-only history, and tag-type behavior are covered by tests.
- [x] Existing venue `places` and `place_visits` remain distinct from travel Place and Segment data.
- [x] `trip_history` remains registered and unchanged against both baseline snapshots.
- [x] Migrations and codegen complete in dev and test databases.
- [x] Full required package and dependent validation gate completed.

## Testing

- Add database tests for valid and invalid relationships, uniqueness, date constraints, owner isolation, audit append-only behavior, deleted-entity history, and distinct travel tagging types.
- Run `just db migrate`; run `just db migrate test` when a test database is running; run `just db codegen`.
- Run `pnpm --filter @hominem/db... check` and the applicable database test suite.

## Progress evidence

- New physical tables include `travel_journeys`, `travel_journey_segments`, `travel_places`, `travel_transport`, `travel_stays`, `travel_airports`, `travel_ideas`, `travel_residences`, and `travel_entity_history`.
- Residence periods are persisted as JSON arrays with nonempty-array validation; owner-scoped place relationships, audit events, and travel-specific timestamp updates are applied.
- The Residence CRUD integration test covers create, update, delete, period round-trip, and retained audit events. The travel import tests cover canonical Place mapping, residence-only Places, idempotent replay, and the single-current-home rule.
- Dev and test DBs are migrated through `20261016140000`; generated DB types include `AppTravelResidences`.
- Existing `travel_trips`, `travel_segments`, and `travel_trip_attendees` were preserved without rename, writes, or data movement.
- `pnpm --filter @hominem/db test`: 54 passed; database lint and typecheck passed.
- `pnpm --filter @hominem/api test -- src/mcp/tools/tags.test.ts`: 741 passed (the package script ran the full API suite).
- Dev and test DB migrations and dev DB codegen completed.
- `trip_history` default and limit-50 serialized outputs compare byte-for-byte with their pre-migration snapshots; both SHA-256 hashes are recorded in spec §16.
- `pnpm run check`, `pnpm format:check`, API build/lint/typecheck, and DB typecheck passed.
- The latest full `pnpm run check` and `pnpm format:check` passed after the Residence migration and tool registration changes.
