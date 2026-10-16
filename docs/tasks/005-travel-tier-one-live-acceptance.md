---
title: 'Verify Tier 1 travel tools against live data'
status: 'Implemented'
priority: 'high'
labels: [travel, mcp, verification]
depends_on: [004-travel-analytics-and-integrity-tools.md]
blocks: [006-travel-single-entity-write-tools.md]
estimated_size: 'L'
---

## Objective

**Task ID:** T-005

Reconcile the production registry availability gate before starting phase 2 travel writes. The complete production acceptance suite for §12 items 1–22 is tracked in T-008.

## Context

[travel MCP spec](../travel.mcp.md) §13 orders live acceptance items 1–9 before Tier 2 writes. This is an environment-dependent verification task, separate from implementation. It requires the deployed API, a scoped test token, and the imported dataset.

Owner boundary: operator-run MCP acceptance against the intended deployed Hominem API; implementation fixes remain owned by `services/api` / `packages/db` task owners.

The local MCP acceptance is recorded in the ignored artifact `docs/tasks/artifacts/travel-tier-one-acceptance.json` and covers the §12 read examples plus the currently runnable §20.5 read checks (items 18, 19, and 21) against a temporary synthetic identity on `hominem-test` (21 checks pass). It is a pre-gate only. All §20.5 items 18–22 are assigned to T-008 for acceptance against production; items 20 and 22 run after their T-006/T-007 capabilities land. Per §22, production acceptance uses `https://api.ponti.io/api/mcp`; credentials are supplied directly by the operator. The local test-database cleanup and its evidence are recorded in `docs/tasks/artifacts/travel-synthetic-cleanup.local.json`; production cleanup must be checked and completed before import counters are measured, preserving the §16 legacy tables and append-only audit history. Report source date-overlap findings as returned by `travel_validate`; do not create duplicate rows or change source dates to suppress them.

Production preflight on 2026-10-16 authenticated with the operator-provided credential, but `tools/list` returned no `travel_*` tools (133 total tools) and a read-only `travel_validate` probe returned `Tool travel_validate not found`. That was accurate before deployment. The operator subsequently verified the deployed registry at 12:06, 12:40, and 14:47 BST on 2026-10-16: 157 total tools, including 24 live `travel_*` tools, with `travel_import` and residence list/get available. This resolves the deployment blocker. No production writes were made. The remaining live acceptance checks are in T-008; the operator results above are supplied evidence and were not independently re-run in this workspace.

## Requirements

- Record the operator’s post-deployment `tools/list` results and verify that the production registry exposes Tier 1 travel tools and `travel:write` scope metadata.
- Preserve the original pre-deployment result as historical evidence; do not describe it as current production state.
- Run the full live acceptance items 1–22 through T-008 after implementation and deployment.

## Implementation Notes

- Run only after T-002 through T-004 are implemented, validated, and deployed to the intended environment.
- Use a read-scoped synthetic/test identity where available; do not expose personal token material in task artifacts.
- This task does not retire the source Sheet or authorize any data correction.

## Acceptance Criteria

- [x] Operator post-deployment checks confirm 157 total tools and 24 live travel tools, including import and residence reads.
- [x] T-005’s stale zero-tool snapshot is identified as pre-deployment evidence, not current state.
- [ ] The full §12 production acceptance suite is completed under T-008.

## Testing

- Operator verified production `tools/list` at 12:06, 12:40, and 14:47 BST on 2026-10-16. Full acceptance is intentionally not claimed here and remains with T-008.
