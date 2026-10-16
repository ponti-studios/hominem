---
title: 'Verify Tier 1 travel tools against live data'
status: 'Blocked'
priority: 'high'
labels: [travel, mcp, verification]
depends_on: [004-travel-analytics-and-integrity-tools.md]
blocks: [006-travel-single-entity-write-tools.md]
estimated_size: 'L'
---

## Objective

**Task ID:** T-005

Complete the operator’s live-data acceptance gate for schema, import, Tier 1 reads, aggregates, integrity, and distance before starting travel writes.

## Context

[travel MCP spec](../travel.mcp.md) §13 orders live acceptance items 1–9 before Tier 2 writes. This is an environment-dependent verification task, separate from implementation. It requires the deployed API, a scoped test token, and the imported dataset.

Owner boundary: operator-run MCP acceptance against the intended deployed Hominem API; implementation fixes remain owned by `services/api` / `packages/db` task owners.

The local MCP acceptance is recorded in the ignored artifact `docs/tasks/artifacts/travel-tier-one-acceptance.json` and covers the §12 read examples plus the currently runnable §20.5 read checks (items 18, 19, and 21) against a temporary synthetic identity on `hominem-test` (21 checks pass). It is a pre-gate only. All §20.5 items 18–22 are assigned to T-008 for acceptance against production; items 20 and 22 run after their T-006/T-007 capabilities land. Per §22, production acceptance uses `https://api.ponti.io/api/mcp`; credentials are supplied directly by the operator. The local test-database cleanup and its evidence are recorded in `docs/tasks/artifacts/travel-synthetic-cleanup.local.json`; production cleanup must be checked and completed before import counters are measured, preserving the §16 legacy tables and append-only audit history. Report source date-overlap findings as returned by `travel_validate`; do not create duplicate rows or change source dates to suppress them.

Production preflight on 2026-10-16 authenticated with the operator-provided credential, but `tools/list` returned no `travel_*` tools (133 total tools) and a read-only `travel_validate` probe returned `Tool travel_validate not found`. Public OAuth metadata advertises `travel:read` but not `travel:write`. The safe result is recorded in `docs/tasks/artifacts/travel-production-preflight.json`; no production writes were made. T-005 remains blocked until the deployed production MCP registry exposes the T-001–T-004 travel tools and the required scope metadata, after which the operator acceptance gate can run.

## Requirements

- Verify the seven imported row counts and worked examples 1–9 in §12 against live MCP responses.
- Confirm the known validation findings and distance values exactly; do not repair or delete Reykjavik, the layover leg, or duplicate legacy IDs.
- Verify `trip_history` remains available and unchanged, and that venue `place_visit_history` remains separate.
- Before measuring production import counters, list and remove synthetic/test entities left by earlier tasks in the target new travel tables; retain the cleanup evidence and do not touch §16 legacy tables or append-only history.
- Record tool name, request, result summary, pass/fail, and safe evidence reference for each acceptance item. Store raw volatile details in `docs/tasks/artifacts/travel-tier-one-acceptance.json`.
- Stop Tier 2 work if any unexpected validation finding or acceptance mismatch remains unresolved; assign the evidence to an implementation defect or operator data decision.

## Implementation Notes

- Run only after T-002 through T-004 are implemented, validated, and deployed to the intended environment.
- Use a read-scoped synthetic/test identity where available; do not expose personal token material in task artifacts.
- This task does not retire the source Sheet or authorize any data correction.

## Acceptance Criteria

- [ ] All initial live acceptance items 1–9 in §12 are marked pass with evidence in the artifact manifest.
- [ ] Every unexpected finding is either fixed and re-verified or recorded as an operator-owned data decision; none is silently waived.
- [ ] `docs/tasks/artifacts/travel-tier-one-acceptance.json` identifies the environment and evidence for each check without storing secrets.
- [ ] Tier 2 work is unblocked only after the complete read acceptance gate passes.

## Testing

- Run the operator’s MCP acceptance script/flow against live data using the deployed API.
- No code tests are added in this verification-only task; any failure returns to the relevant implementation task and must pass its automated checks before this gate is rerun.
