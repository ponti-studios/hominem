# Feature Specification: Calendar and Time

**Feature Branch**: `04-calendar-time`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent planned and historical time-based commitments without losing recurrence, timezone, participant, or cancellation meaning.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Events with Occurrences and Recurrence (Priority: P1)

As a user, I want to create events with recurrence rules that produce concrete occurrences so that recurring commitments (meetings, appointments, birthdays) are represented correctly.

**Why this priority**: Recurrence and occurrence handling is the core calendar feature — without it, you just have a list of dates.

**Independent Test**: An event with a weekly recurrence rule produces correct concrete occurrences and each occurrence has its own start/end time and status.

**Acceptance Scenarios**:

1. **Given** an event with a `jsonb` recurrence rule, **When** occurrences are generated, **Then** they are stored in `app.event_occurrences` with `occurrence_key`, `starts_at`, and `ends_at`.
2. **Given** an occurrence is cancelled, **When** queried, **Then** it has `status: cancelled` and is not deleted.

### User Story 2 - All-Day and Timed Events (Priority: P1)

As a user, I want all-day events (birthdays, holidays) to use an occurrence date without timestamps and timed events to use `timestamptz` so that timezone semantics are preserved correctly.

**Why this priority**: All-day and timed events have fundamentally different time representations.

**Independent Test**: An all-day event uses `occurrence_date` (no timezone); a timed event uses `starts_at`/`ends_at` (`timestamptz`).

**Acceptance Scenarios**:

1. **Given** an all-day event, **When** stored, **Then** `occurrence_date` is set and `starts_at`/`ends_at` are null.
2. **Given** a timed event with explicit timezone, **When** stored, **Then** `starts_at`/`ends_at` are `timestamptz` and `occurrence_date` is null.

### User Story 3 - Event Attendees with RSVP (Priority: P2)

As a user, I want to record who is invited to an event (not per-occurrence) with an RSVP status so that I can track participant responses.

**Why this priority**: Attendees are needed for collaboration but are secondary to event creation.

**Independent Test**: An event has attendees recorded in `app.event_attendees` with status; an occurrence inherits the event's attendee list.

**Acceptance Scenarios**:

1. **Given** an event with attendees, **When** queried, **Then** `app.event_attendees` returns each attendee with their RSVP `status`.
2. **Given** an occurrence of that event, **When** attendee status is queried, **Then** it inherits from the event-level record.

### Edge Cases

- What happens when an event's end time precedes its start time?
- How does the system handle cancellation of a single occurrence in a recurring series?
- What happens when a timezone boundary is crossed (e.g., DST)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.events` MUST store recurrence rules as `jsonb` (not RFC 5545 text).
- **FR-002**: Events MUST produce concrete `app.event_occurrences` with a stable `occurrence_key`.
- **FR-003**: Occurrence cancellation MUST be a `status` value (`confirmed`/`cancelled`), not deletion.
- **FR-004**: End time MUST NOT precede start time — enforced at both `events` and `event_occurrences` levels.
- **FR-005**: All-day occurrences MUST use `occurrence_date`; timed occurrences MUST use `starts_at`/`ends_at` (`timestamptz`).
- **FR-006**: `app.event_attendees` MUST be recorded per event (not per occurrence) with RSVP `status`.
- **FR-007**: Calendar repositories MUST support upcoming, bounded search, and event detail reads.
- **FR-008**: Tests MUST cover cancellation, ordering, date windows, timezone/all-day behavior, result caps, evidence, and metadata redaction.

### Key Entities

- **app.calendars**: Calendar container.
- **app.events**: Base commitment with `jsonb` recurrence rule, optional `source` and `external_id`.
- **app.event_occurrences**: Concrete instances with `occurrence_key`, `starts_at`/`ends_at` or `occurrence_date`, and `status`.
- **app.event_attendees**: Per-event attendee list with RSVP `status`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Calendar schema is introduced by a dedicated migration and generated Kysely types.
- **SC-002**: Calendar repositories support upcoming, bounded search, and event detail reads.
- **SC-003**: Services preserve all-day semantics separately from timed timestamps.
- **SC-004**: RPC calendar endpoints validate input and return metadata-only DTOs.
- **SC-005**: MCP timeline and schedule tools use the calendar service with capped, structured evidence.
- **SC-006**: Tests cover cancellation, ordering, date windows, timezone/all-day behavior, result caps, evidence, and metadata redaction.

## Assumptions

- Calendar implementation is currently deferred — no calendar tables, repositories, RPC endpoints, or MCP tools exist in the MVP codebase.
- When implementation begins, the schema should be evaluated fresh instead of assuming the removed table shape is still production canon.
- Previous code implementing `events` → `event_occurrences` has been removed from the MVP.
- Event bodies, attendees, and organizer details are sensitive. Default AI evidence is title, time/date, location label, cancellation status, and optional source label.
- Per-occurrence attendee RSVP and recurrence-rule normalization decisions will be made during implementation.
