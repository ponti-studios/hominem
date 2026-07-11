# Feature Specification: Communications and Social

**Feature Branch**: `11-communications-social`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent conversations while preserving the privacy of participants and message bodies.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Threads with Messages and Sender Identity (Priority: P1)

As a user, I want to record communication threads (email, SMS, Signal, social) with individual messages and sender identity so that I can search and reference past conversations.

**Why this priority**: Threads and messages are the core communication entities.

**Independent Test**: A thread can be created with a channel type and sensitivity classification; messages can be added with sender person reference, timestamp, and body.

**Acceptance Scenarios**:

1. **Given** a thread with `channel: email` and `sensitivity: sensitive`, **When** queried, **Then** the thread metadata (channel, sensitivity, date range) is returned.
2. **Given** a message is added to a thread with `sender_person_id`, **When** the thread's messages are queried, **Then** each message includes sender identity and timestamp.

### User Story 2 - Metadata-First Access with Excerpt Handling (Priority: P1)

As a secure system, I want communication access to default to metadata and excerpts so that full message bodies are not exposed without explicit need.

**Why this priority**: Communications are highly sensitive — body content must be protected by default.

**Independent Test**: A default query returns thread metadata and message excerpts but not full unrestricted message bodies.

**Acceptance Scenarios**:

1. **Given** a thread with multiple messages, **When** queried by a surface without explicit body-access scope, **Then** only thread metadata and message excerpts are returned.
2. **Given** a query specifying full body access with appropriate scope, **When** authorized, **Then** full message bodies are returned.

### User Story 3 - Sensitivity Classification (Priority: P2)

As a user, I want threads to carry a `sensitivity` classification (private/sensitive/restricted) layered on top of the plan-level "highly sensitive" default so that I can express gradations of privacy within the communications domain.

**Why this priority**: Different communication channels have different privacy expectations.

**Independent Test**: A thread with `sensitivity: restricted` enforces stricter access rules than one with `sensitivity: private`.

**Acceptance Scenarios**:

1. **Given** a thread with `sensitivity: restricted`, **When** a client without appropriate clearance attempts access, **Then** metadata-only is returned.
2. **Given** a thread with `sensitivity: private`, **When** the owner queries it, **Then** full metadata and excerpts are available.

### Edge Cases

- What happens when a sender's person identity is not yet resolved — can a message still be recorded?
- How does the system handle a thread where the `external_id` is duplicated across threads?
- What happens when a message body is stored as a private file reference rather than inline text?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.communication_threads` MUST record channel (email/sms/signal/social/other) and a `sensitivity` classification (private/sensitive/restricted).
- **FR-002**: `app.communication_messages` MUST belong to a thread and carry `sender_person_id`, timestamp, and body (optional file reference).
- **FR-003**: Message source identifiers (`external_id`) MUST be unique per thread.
- **FR-004**: Communications MUST be classified as highly sensitive and disabled for external AI by default.
- **FR-005**: API DTOs MUST default to metadata and excerpts rather than unrestricted conversation bodies.
- **FR-006**: Future AI access MUST minimize text and respect participant consent.
- **FR-007**: MCP communications access MUST remain disabled until explicit consent, participant boundaries, and safety rules exist.
- **FR-008**: Tests MUST cover thread search, sender mapping, excerpt limits, and disabled external AI access.

### Key Entities

- **app.communication_threads**: Conversation threads with channel, sensitivity, and optional source/external_id.
- **app.communication_messages**: Individual messages with sender person reference, timestamp, and body.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Communications repositories expose threads, messages, sender identity, timestamps, and source metadata.
- **SC-002**: Services minimize message text access and separate sender identity from resolved people.
- **SC-003**: API DTOs default to metadata and excerpts rather than unrestricted conversation bodies.
- **SC-004**: MCP communications access remains disabled until explicit consent, participant boundaries, and safety rules exist.
- **SC-005**: Tests cover thread search, sender mapping, excerpt limits, and disabled external AI access.

## Assumptions

- There is no `communication_accounts` table — only the sender is tracked structurally.
- There is no `communication_participants` roster — recipients/CCs are not enumerated.
- There is no `communication_message_files` attachment table.
- There is no `social_posts` table.
- Non-message social contact is covered in Plan 06 (people and organizations) via `social_interactions`.
- The sender identity (`sender_person_id`) resolves to a person record in `app.people`.
- Communications are highly sensitive — no external MCP access in v1.
