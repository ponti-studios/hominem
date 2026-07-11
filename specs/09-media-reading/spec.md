# Feature Specification: Media and Reading

**Feature Branch**: `09-media-reading`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent cultural works and a person's relationship to them across reading, listening, viewing, and play — for domains that don't warrant their own dedicated tables. Music and video have their own plans (12 and 13).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Media Works with Creators (Priority: P1)

As a user, I want to record abstract creative works (books, articles, podcasts, films, shows, games) with a creator array so that I can track what I've engaged with across media types.

**Why this priority**: Media works are the core entity — everything else depends on them.

**Independent Test**: A media work can be created with type (book/article/podcast/film/show/game/other) and creators as a `jsonb` array; querying returns the work.

**Acceptance Scenarios**:

1. **Given** a media work of type `book` with creators `["Jane Austen"]`, **When** queried, **Then** the work and its creators are returned.
2. **Given** a media work of type `podcast`, **When** stored, **Then** it uses the same table structure with the appropriate type.

### User Story 2 - Consumptions with Status, Progress, and Rating (Priority: P1)

As a user, I want to record my relationship to a media work — status (reading/watching/planning/completed/abandoned), progress, and optional rating — so that I can track what I'm engaging with.

**Why this priority**: Consumption is the core user-to-work relationship.

**Independent Test**: A consumption record can be created for a work with status, progress (numeric), and rating; querying returns the consumption state.

**Acceptance Scenarios**:

1. **Given** a user starts reading a book, **When** a consumption record is created with `status: reading`, **Then** the consumption is returned with the correct status.
2. **Given** a user completes a work, **When** status is updated to `completed` and a rating is added, **Then** both the status and rating are persisted.

### User Story 3 - MCP Media Context (Priority: P2)

As an AI assistant, I want to query bounded media consumption context (title, creator, progress, status) so that I can answer questions about reading/watching/listening without accessing complete activity history.

**Why this priority**: MCP media context is needed for AI-assisted personal knowledge queries.

**Independent Test**: An MCP query returns bounded consumption summaries with work title, creator, progress, and status — not full history.

**Acceptance Scenarios**:

1. **Given** an MCP tool queries media context, **When** recent works are returned, **Then** each result includes title, creator, progress, and status.
2. **Given** a work that the user has not interacted with is queried, **When** no consumption exists, **Then** no-data is returned.

### Edge Cases

- What happens when progress is updated to a lower value than previously recorded?
- How does the system handle a work with unknown creator(s)?
- What happens when a consumption status changes from `completed` back to `reading`?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.media_works` MUST represent abstract creative works with type (book/article/podcast/film/show/game/other) and creators stored as a `jsonb` array.
- **FR-002**: `app.media_consumptions` MUST capture a user's relationship to a work: status (reading/watching/planning/completed/abandoned), progress (numeric), and optional rating.
- **FR-003**: Completion MUST be a consumption `status` value — not a property of a work.
- **FR-004**: Progress MUST be tracked as a bare `numeric` (no unit/total bounds).
- **FR-005**: API DTOs MUST NOT imply inferred ratings or ownership.
- **FR-006**: MCP media context MUST return bounded summaries with evidence.
- **FR-007**: Tests MUST cover work lookup, progress updates, rating absence, and sensitive-interest handling.

### Key Entities

- **app.media_works**: Abstract creative works (book/article/podcast/film/show/game/other) with `jsonb` creators array.
- **app.media_consumptions**: User's relationship to a work — status, progress, rating.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Media repositories expose works and consumption/progress records.
- **SC-002**: Services distinguish work identity, progress, status, and rating.
- **SC-003**: API DTOs avoid implying inferred ratings or ownership.
- **SC-004**: MCP media context returns bounded summaries of reading/watching/listening progress with evidence.
- **SC-005**: Tests cover work lookup, progress updates, rating absence, and sensitive-interest handling.

## Assumptions

- Creators are denormalized as a `jsonb` array — there is no normalized `media_creators`/`media_work_creators` structure.
- There is no edition/release concept distinct from the work itself — a work's "edition" (hardcover vs. audiobook) is not separately representable.
- There are no collections or per-session consumption tracking — only one `media_consumptions` row per work, updated in place.
- Music and video have their own dedicated domains (Plans 12 and 13) because their access patterns don't fit the generic work/consumption shape.
- Media history is standard sensitivity unless it reveals sensitive interests.
