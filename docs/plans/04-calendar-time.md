# Plan 04: Calendar and time

## Outcome

Represent planned and historical time-based commitments without losing recurrence, timezone, participant, or cancellation meaning.

## Implementation boundary

- **Schema:** [schema/04-calendar-time.sql](schema/04-calendar-time.sql)
- **Repository and service:** provide upcoming, bounded search, and event-detail reads while preserving time semantics.
- **MCP:** after Plan 00, expose only scope-checked schedule/search summaries through the calendar service.

## Canonical entities and relationships

`app.calendars` contain `app.events` (the base commitment, holding a recurrence rule as `jsonb` rather than an RFC5545 text string); events produce `app.event_occurrences` (concrete instances). Occurrences may reference a place. `app.event_attendees` record who is invited to an **event** (not per-occurrence) with an RSVP `status`. Calendar rows may store a simple `source` and `external_id` when connected to another system.

## Lifecycle and invariants

Events and occurrences may be revised; `occurrence_key` remains stable within an event. End time cannot precede start time (`event_occurrences` and `events` both enforce this). All-day occurrences use `occurrence_date`; timed occurrences use `starts_at`/`ends_at` (`timestamptz`). Occurrence cancellation is a `status` value (`confirmed`/`cancelled`), never deletion.

## Privacy and AI evidence

Event bodies, attendees, and organizer details are sensitive. Default AI evidence is title, time/date, location label, cancellation status, and optional source label.

## Rejected models

- One event row per recurrence without an event/occurrence relationship.
- Converting all-day events to midnight timestamps.
- Treating cancellation as hard deletion.

## Divergence from the original design

The original design modeled recurrence as `event_series` → `event_occurrences` with a text `recurrence_rule`. Production's real shape is `events` → `event_occurrences`, where `events` plays the series role but stores the rule as a `jsonb` blob rather than an iCal `RRULE` string, and attendees are tracked on the event, not per-occurrence — so a single RSVP applies to the whole series, not one instance. If an attendee needs to accept one occurrence and decline another, that is not representable today.

## Delivery acceptance

- [x] Calendar repositories support upcoming, bounded search, and event detail reads.
- [x] Services preserve all-day semantics separately from timed timestamps.
- [x] RPC calendar endpoints validate input and return metadata-only DTOs.
- [x] MCP timeline and schedule tools use the calendar service with capped, structured evidence.
- [x] Tests cover cancellation, ordering, date windows, timezone/all-day behavior, result caps, evidence, and metadata redaction.
- [ ] Deferred: per-occurrence attendee RSVP and recurrence-rule normalization beyond the existing `jsonb` shape.

## Deferred work

None.
