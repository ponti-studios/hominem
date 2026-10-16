---
title: 'Implement travel single-entity write tools'
status: 'Proposed'
priority: 'high'
labels: [travel, mcp, writes]
depends_on: [005-travel-tier-one-live-acceptance.md]
blocks: [007-travel-atomic-and-maintenance-tools.md]
estimated_size: 'XL'
---

## Objective

**Task ID:** T-006

Implement the Tier 2 create and update tools, and the specified initial delete tools, with owner-scoped validation, dry-run, idempotency, auditing, and concurrency behavior.

## Context

The Tier 1 live gate must pass before write tools are built. [travel MCP spec](../travel.mcp.md) §§5 and 9 define the common write contract and entity-specific behavior. All writes use Hominem storage; the source Sheet is never accessed at runtime. Current `MCP_SCOPES` includes `travel:read` but not `travel:write`.

Owner boundary: `services/api` travel write tools/services plus `packages/db` owner-scoped mutation repositories as needed.

## Requirements

- Implement create/update for Journey, Segment, Transport, Stay, Place, Airport, and Idea; implement the §9 deletes available in this phase.
- Implement the Residence write operations from §20.3 with the same §5 validation, dry-run, idempotency, audit, and §17 authorization rules.
- Every mutation supports `dryRun`, idempotent retries, named errors, created/updated/unchanged counters where applicable, audit history, and optional `ifUpdatedAt` optimistic concurrency.
- Enforce parent and reference validation, including sequence uniqueness, segment-to-journey consistency, transport airport/segment links, and stay segment/journey consistency.
- Use case-insensitive return-existing rules for Place `(place, country)` and Airport `code`; do not auto-create referenced entities on writes.
- Allocate unique next-series legacy IDs when omitted. Do not extend duplicate Transport IDs.
- Do not auto-update stored Place status or first/last visited when segments change. Preserve all §3.3 and §4 discrepancy semantics.
- Do not implement pass-2 workflow tools or place/airport merges in this task.
- Require the approved `travel:write` scope for every write-mode tool, including dry-run calls; keep read-mode tools on `travel:read` per §17.
- Stop before any live mutation if dry-run counters, target rows, concurrency state, or confirmation behavior differs from the specified preview.

## Implementation Notes

- Follow `services/api/AGENTS.md`, existing `requiresConfirmation` / `iUnderstand` patterns, ownership checks, and error serialization.
- Every delete requires `iUnderstand: true`; journey delete refuses non-empty journeys unless `cascade: true`, and returns deleted snapshots.
- Completion artifact: tool definitions/services and deterministic integration tests for success, dry-run, retry, authorization, audit, conflicts, and recovery behavior.

## Acceptance Criteria

- [ ] Every §9 single-entity create/update/delete tool has the exact input/output contract and named validation errors.
- [ ] Wrong-owner/foreign references cannot be read or mutated; required scopes gate both discovery and calls.
- [ ] Repeating identical writes creates no duplicate rows and returns unchanged counters.
- [ ] Dry-run performs no mutation and projects the exact result; confirmed execution persists the same projection.
- [ ] Failed writes roll back, create no partial records, and do not append misleading audit events.
- [ ] `ifUpdatedAt` conflicts return the current row and preserve both the persisted row and audit trail.
- [ ] Segment writes do not silently change Place status/date fields.
- [ ] Write-scope behavior matches the operator’s recorded decision; `travel:read` alone cannot authorize a mutation unless the operator explicitly changes the security contract.

## Testing

- Add API integration tests for each entity write family, scope denial, owner isolation, retries, dry-run parity, confirmation, foreign keys, audit events, version conflicts, and rollback.
- Run the relevant API and database checks, including `pnpm --filter @hominem/api build` and `pnpm --filter @hominem/api... check`.
