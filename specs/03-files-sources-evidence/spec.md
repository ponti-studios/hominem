# Feature Specification: Files, Sources, and Evidence

**Feature Branch**: `03-files-sources-evidence`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Keep user files private and make product answers explainable without turning source bookkeeping into an MVP platform.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Private File Storage with Domain-Specific Attachments (Priority: P1)

As a user, I want to upload and store files that are private by default and can be attached to specific product entities (notes, job applications) so that my files are accessible where needed but never broadly exposed.

**Why this priority**: File storage is a cross-cutting dependency — notes, career, and other domains all need attachments.

**Independent Test**: A file can be uploaded, exists in storage without being attached to any entity, and is later attached to a specific domain record via an explicit link table.

**Acceptance Scenarios**:

1. **Given** a user uploads a file, **When** queried, **Then** the file record exists with storage metadata and is owner-scoped — no other user can access it.
2. **Given** a file is attached to a note via `app.note_files`, **When** the note is queried, **Then** the file reference is present but storage keys and full file text are not exposed by default.

### User Story 2 - Redacted Evidence for AI Responses (Priority: P2)

As an AI system, I want to return bounded evidence (record IDs, user-visible labels, minimal context) when answering questions so that I ground responses without leaking raw storage or provider data.

**Why this priority**: Every domain MCP tool inherits this redaction boundary — it's the foundation for safe AI answers.

**Independent Test**: A domain service returns a product DTO with minimal evidence instead of raw storage rows, provider payloads, or file contents.

**Acceptance Scenarios**:

1. **Given** a domain service retrieves a record that references a file or provider payload, **When** the DTO is constructed, **Then** storage keys, URLs, credentials, provider payloads, and full extracted text are excluded.
2. **Given** an AI-facing response, **When** evidence is included, **Then** it contains only canonical record IDs, user-visible labels, and bounded context needed to understand the answer.

### Edge Cases

- What happens when a file is attached to multiple domain entities and one is deleted?
- How does the system handle extracted text that is outdated relative to the current file version?
- What happens when a domain table's `provider_payload` column contains data that should never be exposed — can the application layer reliably exclude it?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.files` MUST store user-owned files with storage metadata, optional extracted text, and bounded metadata.
- **FR-002**: Per-domain link tables (e.g., `app.note_files`, `app.application_files`) MUST attach files where needed — no generic polymorphic `file_links` table.
- **FR-003**: Storage keys, URLs, full file text, credentials, provider payloads, and raw external records MUST NOT leave storage-facing services by default.
- **FR-004**: AI-facing responses MUST cite canonical record IDs, user-visible labels, and the minimum context needed — not raw file or provider rows.
- **FR-005**: Domain tables MAY carry simple `source`, `external_id`, or `metadata` fields as explanatory context — this is not a mandate for source-run or raw-record tables.
- **FR-006**: Tests MUST cover file access, attachment ownership, DTO redaction, and provider-payload exclusion.

### Key Entities

- **app.files**: User-owned files with storage metadata, optional extracted text, and bounded metadata.
- **app.note_files**: Link table attaching files to notes.
- **app.application_files**: Link table attaching files to job applications.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: File/object services never expose storage keys, absolute paths, credentials, provider payloads, or full extracted text to clients by default.
- **SC-002**: Domain services return product DTOs with minimal evidence, not raw file or provider rows.
- **SC-003**: Tests cover file access, attachment ownership, DTO redaction, and provider-payload exclusion.
- **SC-004**: Dedicated ingestion infrastructure is deferred until a real product need appears.

## Assumptions

- Files can exist without being attached to any domain entity.
- Extracted text is convenience data, not canonical truth.
- There is no content-addressed storage — files are identified by their record ID.
- Some existing production tables contain `provider_payload` columns (e.g., `finance_transactions.provider_payload`, `places.provider_payload`) — these are tolerated implementation detail, not elevated into a broader architecture.
- MCP has no direct v1 file tool — every future domain tool inherits this plan's redaction boundary.
