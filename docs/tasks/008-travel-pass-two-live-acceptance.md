---
title: 'Verify pass-2 travel workflows against live data'
status: 'Proposed'
priority: 'high'
labels: [travel, mcp, verification]
depends_on: [007-travel-atomic-and-maintenance-tools.md]
blocks: []
estimated_size: 'L'
---

## Objective

**Task ID:** T-008

Complete the live production acceptance suite after the operator-verified deployment that exposed 24 Tier-1 travel tools. Cover the initial read gate and all pass-2 capabilities, including atomic saves, export/import parity, audit history, guarded deletes, reorder/merge, refresh, timeline/insights, tagging, and Residence behavior.

## Context

This environment-dependent gate covers §12 items 1–17 and §20.5 items 18–22 and must follow T-007 implementation and deployment. The initial registry availability check was reconciled in T-005 using the operator’s 2026-10-16 checks (157 tools total, 24 travel tools). Per §22, acceptance runs against production data at `https://api.ponti.io/api/mcp`; credentials come directly from the operator. It is separate from tool implementation. Sheet retirement remains a separate operator decision after this gate.

Owner boundary: operator-run MCP acceptance against the intended deployed API; failures return to the implementation owner of the corresponding tool.

## Requirements

- Run each pass-2 acceptance item 10–17 in [travel MCP spec](../travel.mcp.md) using synthetic records for mutations, export/import against the imported dataset, and read-only verification for analytics.
- Run initial read acceptance items 1–9 against production, including import counts and worked examples, distance checks, validation findings, and `trip_history` continuity.
- Run §20.5 items 18–22: verify all six canonical Place resolutions and both relationships objects; Residence create/get/update/delete, audit history, and `multiple_current_homes`; the four timeline home labels; and sheet-format export parity.
- Assert full rollback for invalid journey saves, idempotent re-save, export/import counters, durable history after deletion, guarded delete behavior, atomic reorder/merge, refresh dry-run preservation, timeline/insight consistency, and distinct tagging types.
- Never delete or alter Reykjavik, the layover leg, or source rows to force acceptance.
- Use synthetic records only for the mutations specified by acceptance; delete those records through the tested confirmed tool paths, and preserve their append-only audit history and all §16 legacy tables.
- Record per-check inputs, result summaries, pass/fail, and safe evidence references in `docs/tasks/artifacts/travel-pass-two-acceptance.json`; keep secrets and disposable identifiers out of the task document.
- Record the production baseline entity counts (79 Places, 2 Residences, 53 Journeys, 62 Segments, 41 Transport, 53 Stays, 30 Airports, 16 Ideas), import convergence counters, full place-refresh dry-run diff, and read/write scope outcomes. Do not apply a refresh or run a live import.
- Do not retire, freeze, or delete the Google Sheet as part of this task. Stop after evidence is complete and report that operator decision separately.
- Stop and return a failed check to its implementation task; do not waive or reinterpret the specification.
- Produce the §14 completion report: tool names and behaviors, import counters, full `travel_validate` output, pass/fail for acceptance items 1–22, and any spec/codebase divergence supported by evidence.

## Implementation Notes

- Use unique synthetic fixtures and clean them up only through tested, confirmed tool paths. Record cleanup success/failure in the manifest.
- Confirm the target environment and authenticated test identity before any write. Do not expose personal-token material.
- Completion artifact: pass/fail manifest for §12 items 10–17 and §20.5 items 18–22, plus a cleanup record for all synthetic rows.

## Acceptance Criteria

- [ ] Every §12 item 1–17 is marked pass with evidence, or has a named blocker and owner; no item is silently skipped.
- [ ] Every §20.5 item 18–22 is marked pass with evidence, or has a named blocker and owner; no item is silently skipped.
- [ ] Synthetic test records are cleaned up, and their audit/history evidence remains available where required.
- [ ] The §12 import/export parity and tag-type distinction are demonstrated against the deployed API.
- [ ] The manifest identifies environment, actor class, check, and evidence reference without storing credentials.
- [ ] Sheet retirement is left pending explicit operator direction.

## Testing

- Run the operator’s deployed MCP acceptance flow for §12 items 1–17.
- No code tests are added in this verification-only task; failures must be fixed and revalidated in T-001–T-007 before this gate closes.
