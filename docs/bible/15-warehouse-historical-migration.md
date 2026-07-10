# Warehouse historical migration

## Purpose

Move historical Warehouse data into Hominem once, with human review, without preserving Warehouse as an operational system.

## Canonical approach

Warehouse SQLite is a historical source snapshot. Its original bytes and normalized source rows may be retained as private artifacts. Hominem entities are created from approved canonical mappings; Warehouse tables never become runtime dependencies or compatibility tables.

## Lifecycle and invariants

Migration is manual, repeatable in a disposable environment, and accepted only after reconciliation. Ambiguous people, places, merchants, and records are held for review. After acceptance, Warehouse is archived and production reads only Hominem.

## Privacy and AI evidence

Raw Warehouse payloads remain storage-restricted. AI sees only migrated canonical evidence and source freshness.

## Rejected models

- Continuous bidirectional sync.
- A Warehouse MCP dependency.
- Automatically accepting every legacy field as canonical.

## Implementation readiness

- [ ] Warehouse import remains a manual historical runbook, not a live runtime dependency.
- [ ] Field mapping records every legacy field as canonical, retained raw payload, or human-review decision.
- [ ] Migration jobs are idempotent and accepted only after reconciliation reports pass.
- [ ] Product clients read only Hominem after migration acceptance.
- [ ] Tests use fixture snapshots to cover counts, checksums, malformed rows, duplicate candidates, and review queues.
- [ ] Deferred: any compatibility layer that preserves Warehouse table shape.

## Open questions

None. Field-level mapping begins only after SQL specifications are approved.
