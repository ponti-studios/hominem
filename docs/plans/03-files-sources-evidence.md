# Plan 03: Files, sources, and evidence

## Outcome

Keep user files private and make product answers explainable without turning source bookkeeping into an MVP platform.

## Implementation boundary

- **Schema:** [schema/03-files-sources-evidence.sql](schema/03-files-sources-evidence.sql)
- **Repository and service:** own file attachment checks and return redacted product evidence rather than storage/provider rows.
- **MCP:** has no direct v1 file tool; every future domain tool inherits this plan's redaction boundary.

## Canonical entities and relationships

`app.files` stores user-owned files with storage metadata, optional extracted text, and bounded `metadata`. Per-domain link tables attach files where the product needs them: `app.note_files` for notes and `app.application_files` for career applications. There is no generic polymorphic `file_links` table.

Domain tables may carry simple `source`, `external_id`, or `metadata` fields when a provider identity is useful for the product. Those fields are explanatory context, not a mandate to create source-run tables, raw-record tables, review queues, or legacy compatibility layers.

## Lifecycle and invariants

Files are owner-scoped and may be attached to product entities through explicit link tables. A file can exist without being attached yet. Extracted text is convenience data, not canonical truth. Domain records own their meaning directly; source labels are optional context, not a second shadow schema.

## Privacy and AI evidence

Storage keys, URLs, full file text, credentials, provider payloads, and raw external records never leave storage-facing services by default. AI-facing responses cite canonical record IDs, user-visible labels, and the small amount of context needed to understand the answer.

## Rejected models

- Legacy-database-specific tables in the canonical product schema.
- Source-run, raw-record, or review-queue tables as MVP foundation.
- Automated resolution of ambiguous people, places, or merchants.

## Divergence from current production

Some current production tables still contain provider-specific payload columns such as `finance_transactions.provider_payload` and `places.provider_payload`. Those columns are tolerated as existing implementation detail, not elevated into a broader source-processing architecture.

## Delivery acceptance

- [ ] File/object services never expose storage keys, absolute paths, credentials, provider payloads, or full extracted text to clients by default.
- [ ] Domain services return product DTOs with minimal evidence, not raw file or provider rows.
- [ ] Tests cover file access, attachment ownership, DTO redaction, and provider-payload exclusion.
- [ ] Deferred: dedicated ingestion infrastructure until a real product need appears.

## Deferred work

None for MVP.
