# Feature Specification: Omiro Workspace

**Feature Branch**: `02-omiro-workspace`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Build the notes, chats, tasks, and AI-assisted workspace used by `apps/omiro`, keeping authored content and AI-derived material distinct. The MCP vertical reads production records through the same service boundary.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Versioned Notes with Draft/Publish/Archive Lifecycle (Priority: P1)

As a user, I want to create and edit versioned notes that support draft/published/archived states so that I can iterate on content before publishing and retain history.

**Why this priority**: Notes are the core authored content entity — all other workspace features depend on the note model.

**Independent Test**: A note with multiple versions, each with distinct `status` (draft/published/archived), can be created, updated (creating a new version), and queried by version.

**Acceptance Scenarios**:

1. **Given** a note with a `current_version_id` pointing into `note_versions`, **When** a new version is created, **Then** the `current_version_id` is updated and the old version remains accessible.
2. **Given** a note version with `status: published`, **When** queried by a reader, **Then** the published version is returned.
3. **Given** a note version with `status: archived`, **When** queried, **Then** it is excluded from default read queries.

### User Story 2 - AI Notebook with Anchored Chats (Priority: P1)

As a user, I want to anchor an AI chat thread to a note so that I can discuss a specific document with AI assistance and keep the conversation in context.

**Why this priority**: Chat-anchored-to-note is the core AI-assisted workspace pattern.

**Independent Test**: A chat with `chats.note_id` referencing a note can be created, messages added, and the chat retrieved in the context of that note.

**Acceptance Scenarios**:

1. **Given** a note exists, **When** a chat is created with `note_id` referencing that note, **Then** messages can be added to the chat and retrieved.
2. **Given** a chat anchored to a note, **When** the note's context is queried, **Then** associated chats are listed without dumping all message bodies.

### User Story 3 - Tasks with Nesting, Status, and Assignments (Priority: P2)

As a user, I want to create tasks with explicit status, priority, nesting (`parent_task_id`), and optional space/assignment so that I can organize work independently of notes and chats.

**Why this priority**: Tasks are a separate organizational dimension — they exist alongside notes, not inside them.

**Independent Test**: A task tree with parent/child relationships can be created, status updated, and assigned to a space member.

**Acceptance Scenarios**:

1. **Given** a parent task exists, **When** a child task is created with `parent_task_id`, **Then** querying the parent returns the child in the hierarchy.
2. **Given** a task assigned to a space member via `app.task_assignments`, **When** the assignee queries their tasks, **Then** the assigned task appears.

### User Story 4 - MCP Knowledge Retrieval (Priority: P2)

As an AI assistant with `knowledge:read` scope, I want to retrieve scoped note, chat, and extracted-fact context with evidence and confidence so that I can answer knowledge questions without unrestricted content dumps.

**Why this priority**: This is the second MCP pilot vertical after Plan 00.

**Independent Test**: An MCP tool with `knowledge:read` scope returns bounded note excerpts, chat metadata, and extracted facts with evidence and confidence.

**Acceptance Scenarios**:

1. **Given** an MCP tool with `knowledge:read` scope, **When** it searches notes, **Then** it returns excerpts (not full dumps) with note identity, source timestamp, and confidence.
2. **Given** an MCP tool queries extracted facts, **When** a subject entity is specified, **Then** it returns predicate/value pairs with bounded evidence JSON and confidence.

### Edge Cases

- What happens when a note is shared via `note_shares` and also belongs to a space — which sharing mechanism takes precedence?
- How does the system handle a chat that references a deleted note?
- How does vector embedding freshness interact with note versioning?
- What happens when a task's `parent_task_id` creates a cycle?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.notes` MUST point to a `current_version_id` in `app.note_versions`.
- **FR-002**: Each note version MUST carry `status` (`draft`/`published`/`archived`), `note_type` (`note`/`document`/`template`), and optional `published_at`/`scheduled_for`.
- **FR-003**: `app.chats` MAY anchor to a note via `chats.note_id`.
- **FR-004**: `app.chat_messages` MUST belong to a chat and be ordered.
- **FR-005**: `app.tasks` MUST support nesting via `parent_task_id` and assignments via `app.task_assignments`.
- **FR-006**: `app.extracted_facts` MUST cite a subject entity, predicate/value, source label, bounded evidence JSON, and confidence.
- **FR-007**: `app.vector_documents` MUST store embeddings for notes and chats only — not arbitrary entities.
- **FR-008**: Derived content (embeddings, facts) MUST be replaceable and MUST NOT become authored truth.
- **FR-009**: API DTOs MUST apply excerpt policies and MUST NOT return unrestricted note/chat dumps by default.
- **FR-010**: MCP knowledge tools MUST support scoped retrieval with evidence, confidence, and no-data responses.
- **FR-011**: Tests MUST cover note sharing, tag sharing, version selection, embedding lookup, fact confidence, and excerpt redaction.

### Key Entities

- **app.notes**: Versioned document with pointer to `current_version_id`.
- **app.note_versions**: Individual versions with status, type, and scheduling.
- **app.chats**: Chat threads, optionally anchored to a note.
- **app.chat_messages**: Messages within a chat.
- **app.tasks**: Tasks with optional nesting and assignments.
- **app.task_assignments**: Task-to-space-member assignments.
- **app.extracted_facts**: AI-derived facts with subject, predicate/value, evidence, and confidence.
- **app.vector_documents**: Embeddings for notes and chats.
- **app.bookmarks**: User-saved links, optionally tied to a place.
- **app.note_files / app.note_shares**: File attachments and per-note sharing grants.
- **app.tags / tag_aliases / tag_assignments**: Tagging system with two-tier sharing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Knowledge repositories expose notes, note versions, chats, messages, tags, links, embeddings, and extracted facts through typed methods.
- **SC-002**: Services distinguish user-authored content, externally sourced content labels, and AI-derived facts without relying on import infrastructure.
- **SC-003**: API DTOs apply excerpt policies and never return unrestricted note/chat dumps by default.
- **SC-004**: MCP knowledge tools support scoped retrieval with evidence, confidence, and no-data responses.
- **SC-005**: Tests cover note sharing, tag sharing, version selection, embedding lookup, fact confidence, and excerpt redaction.

## Assumptions

- There is no distinct `app.documents` entity — documents are a `note_versions.note_type` value, not a separate table.
- `note_shares` and space-level sharing coexist and are not reconciled at the schema level — both are RLS-enforced.
- Tags have a two-tier pattern: read access via `auth.can_read_tag()` and write access via `auth.is_tag_owner()`.
- MCP is not enabled until Plan 00 passes its acceptance criteria.
- Deferred: reconciling note-scoped sharing with space sharing and splitting first-class documents from notes.
