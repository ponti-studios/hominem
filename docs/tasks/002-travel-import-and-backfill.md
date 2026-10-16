---
title: 'Build the travel import and backfill the source data'
status: 'Implemented'
priority: 'high'
labels: [travel, mcp, import]
depends_on: [001-travel-schema-and-capability-plumbing.md]
blocks: [003-travel-tier-one-read-tools.md]
estimated_size: 'XL'
---

## Objective

**Task ID:** T-002

Implement the permanent, idempotent `travel_import` tool and load the source travel data into Hominem with the specified row counts and integrity findings.

## Context

[travel MCP spec](../travel.mcp.md) §11 defines the import contract and §12 provides ground-truth counts and examples. The Google Sheet is migration input only; no runtime tool may read it. This task depends on the travel schema and audit plumbing in T-001.

Owner boundary: `services/api` travel import tool, application service, source-data mapping, and import integration tests; `packages/db` repositories only where required by the import contract.

## Requirements

- Accept sheet-shaped rows grouped as places, residences, journeys, segments, transport, stays, airports, and ideas; support `append` / `replace` and `dryRun`.
- Resolve references in the specified order: airports, places, residences, journeys, segments, transport, stays, ideas. Reject unresolvable rows with named per-row reasons while continuing the batch.
- Use `legacyId` as the idempotency key except Transport, which uses `(legacyId, journeyLegacyId, date, origin, destination)`.
- Require `iUnderstand: true` for `replace`; return pre-delete counts and make dry-run project the same counters and payload as execution.
- Report dropped `segments.destinations` and `journeys.segments` columns. Preserve sparse/null source values without inventing dates or repairing known discrepancies.
- Append audit events for imported rows. A second identical append must report all rows unchanged.
- Import the full source dataset only after a clean dry-run. Keep the source Sheet out of runtime tool execution.
- Require the approved `travel:write` scope for `travel_import` even when `dryRun` is true. The operator's scope decision and current finance/possessions grant-flow preflight are recorded in [§17](../travel.mcp.md).
- Stop before a live write if the source export/reference CLI is unavailable, the dry-run differs from §12, or the pre-delete snapshot is unexpected; preserve evidence and report the blocker.

## Implementation Notes

- Read [travel MCP spec](../travel.mcp.md) §§2–5 and §11–12; retain the special Transport composite key and the Reykjavik/Iceland discrepancy exactly as specified.
- Follow the import conventions of `finance_transactions_import` without copying finance-specific behavior.
- Completion artifact: `travel_import` implementation/tests plus an import manifest containing dry-run and applied per-entity counters, rejected rows, dropped columns, and source identity. Keep volatile run identifiers in `docs/tasks/artifacts/`, not this task narrative.
- A production import is an external database write. The import spec authorizes the migration outcome, but only run it against the intended environment and authenticated user after the verified dry-run.
- Use only the verified source archive and extracted JSON documented in [§18](../travel.mcp.md); do not read the live sheet or invent source rows.

## Progress evidence

- Residence-aware import now diverts `Lived in` source rows, creates 79 canonical Places and 2 Residence records, and reports `residenceOnlyPlaces`.
- Dry-run manifest at `docs/tasks/artifacts/travel-import-manifest.json` records source hashes and counters. It reports 79 Places, 2 Residences, 53 Journeys, 62 Segments, 41 Transport, 53 Stays, 30 Airports, and 16 Ideas, all with zero rejections.
- A real append and identical replay ran in `hominem-test` against a temporary synthetic owner. The post-import counts matched the source, replay created/updated zero rows, and the fixture owner was removed in `finally`. Evidence: `docs/tasks/artifacts/travel-import-test-apply.json`.
- The test import preserved the six London/Los Angeles canonical segment references, Reykjavik's visited-without-segment inconsistency, the unlinked T-026 layover, and duplicate T-004/T-005 transport rows.
- No production or persistent operator dataset was written. Deployed live-data acceptance remains assigned to T-005 after T-001–T-004 are implemented and deployed.

## Acceptance Criteria

- [x] Dry-run and append results match the required result schema and named-error behavior.
- [x] Identical append replay creates and updates zero rows and reports all imported rows unchanged.
- [x] The initial import matches all source counts: 79 Places + 2 Residences derived from the 81 Places rows, 53 Journeys, 62 Segments, 41 Transport rows, 53 Stays, 30 Airports, and 16 Ideas.
- [x] The two known dropped columns are reported; the duplicate Transport IDs remain distinct under the composite key.
- [x] Imported data preserves the Reykjavik/Iceland inconsistency and the T-026 layover without silent repair.
- [x] Import counters and source evidence are recorded in generated manifests.
- [x] `travel:write` is registered and enforced for `travel_import`, including dry-run calls.

## Testing

- Add import unit and integration coverage for reference resolution, per-row rejection, row ordering, duplicate Transport IDs, dry-run parity, replace confirmation, idempotent retry, audit events, and dropped columns.
- Run a dry-run against the actual source export and compare all counters to §12 before applying the import.
- After import, verify all seven row counts and the worked examples in §12. Run the affected API/database checks and `pnpm --filter @hominem/api build`.
