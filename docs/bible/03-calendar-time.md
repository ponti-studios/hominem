# Calendar and time

## Purpose

Represent planned and historical time-based commitments without losing recurrence, timezone, participant, or cancellation meaning.

## Canonical entities and relationships

`app.calendars` contain `app.events` (the base commitment, holding a recurrence rule as `jsonb` rather than an RFC5545 text string); events produce `app.event_occurrences` (concrete instances). Occurrences may reference a place. `app.event_attendees` record who is invited to an **event** (not per-occurrence) with an RSVP `status`. `app.calendar_event_sources` maps an external calendar's UID back to the imported event for sync reconciliation.

## Lifecycle and invariants

Events and occurrences may be revised; `occurrence_key` remains stable within an event. End time cannot precede start time (`event_occurrences` and `events` both enforce this). All-day occurrences use `occurrence_date`; timed occurrences use `starts_at`/`ends_at` (`timestamptz`). Occurrence cancellation is a `status` value (`confirmed`/`cancelled`), never deletion.

## Privacy, provenance, and AI evidence

Event bodies, attendees, and organizer details are sensitive. Default AI evidence is title, time/date, location label, cancellation status, source label, and freshness.

## Rejected models

- One event row per recurrence without an event/occurrence relationship.
- Converting all-day events to midnight timestamps.
- Treating cancellation as hard deletion.

## Divergence from the original design

The original design modeled recurrence as `event_series` → `event_occurrences` with a text `recurrence_rule`. Production's real shape is `events` → `event_occurrences`, where `events` plays the series role but stores the rule as a `jsonb` blob rather than an iCal `RRULE` string, and attendees are tracked on the event, not per-occurrence — so a single RSVP applies to the whole series, not one instance. If an attendee needs to accept one occurrence and decline another, that is not representable today.

## Implementation readiness

- [ ] Calendar repository supports upcoming, bounded search, event detail, and source-freshness reads.
- [ ] Services preserve all-day semantics separately from timed timestamps.
- [ ] API DTOs exclude event bodies, attendee details, organizer details, and raw import payloads by default.
- [ ] MCP tools answer timeline and schedule questions with capped results and structured evidence.
- [ ] Tests cover cancellation, ordering, date windows, timezone/all-day behavior, and metadata redaction.
- [ ] Deferred: per-occurrence attendee RSVP and recurrence-rule normalization beyond the existing `jsonb` shape.

## Open questions

None.
