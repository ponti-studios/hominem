# Provenance, files, and historical imports

## Purpose

Make every imported or derived fact explainable without making historical source systems part of runtime architecture.

## Canonical entities and relationships

`app.import_sources` contain `app.import_runs`; runs produce `app.import_records` (one per source row); `app.import_record_payloads` link a record to the `app.import_artifacts` byte range holding its raw content. `app.entity_source_records` maps a source record to the canonical entity it produced. `app.import_review_items` hold ambiguous mappings. `app.import_reconciliations` record the per-run match/warning/failed count that gates a cutover.

Files are **not** built on the same content-addressed artifact model as imports: `app.files` is a flat, directly-referenced table (`storage_key`, `url`, optional inline `content`/`text_content`) with no content-addressing or immutability guarantee. Per-domain link tables attach a file to its owner: `app.note_files` (notes), `app.application_files` (career applications). There is no generic polymorphic `file_links` table.

## Lifecycle and invariants

Import artifacts are content-addressed (`content_hash`) and immutable. A source record (`import_records`) is never edited; a corrected observation creates a new record. Canonical data may outlive an import run, while its provenance remains traceable via `entity_source_records`. Reconciliation (`import_reconciliations`) is required before a historical migration is accepted — a non-matching count is `warning`/`failed`, never a silent success.

`app.files`, by contrast, has no import-adjacent lifecycle: it is mutable, has no content hash, and is not scoped to a `data_source`/`import_run`. A file can exist with no provenance at all (e.g. a user-uploaded resume).

## Privacy and AI evidence

Object keys, source paths, credentials, and full raw payloads never leave storage-facing services. AI sees source label, import time, confidence, and canonical evidence only.

## Rejected models

- Warehouse as a live federated data source.
- Automated resolution of ambiguous people, places, or merchants.

## Divergence: provider payload inlined on canonical tables

The original design rejected "provider payload copied into every canonical table." Production does not fully hold this line: `app.finance_transactions.provider_payload`, `app.places.provider_payload`, and similar `jsonb` columns exist on canonical tables today, storing raw provider data inline rather than only through `import_record_payloads`. This chapter does not retroactively bless the pattern — it flags it as a live gap between principle and practice so a future migration can decide whether to strip these columns or formally adopt the exception.

## Implementation readiness

- [ ] Import repositories preserve source, run, artifact, record, payload, mapping, and review state.
- [ ] File/object services never expose storage keys, absolute paths, credentials, or raw payloads to clients.
- [ ] Domain services attach source freshness and confidence to imported read models.
- [ ] Import jobs are idempotent by source identifiers and content hashes where available.
- [ ] Tests cover duplicate imports, malformed payloads, review items, and redaction of object-storage details.
- [ ] Deferred: migrating `app.files` into the content-addressed artifact model.

## Open questions

None. Warehouse is a one-time manually reviewed historical migration. Whether `app.files` should be migrated onto the content-addressed artifact model used by imports is open and unresolved by this reconciliation pass.
