# Omiro Time

Time is the iOS task-and-calendar surface. It combines database-backed tasks
with EventKit calendar events in one chronological stream while keeping their
source-specific adapters and mutations separate.

## Routes and screen composition

- `/(protected)/time` renders `TimeScreen`.
- `/(protected)/time/unscheduled` renders the dedicated unscheduled task list.
- `/(protected)/time/task/[id]` and `/(protected)/time/event/[id]` open the
  shared `TimeBlockDetail` surface with a source discriminator.

`TimeScreen` contains `TimeStream`, an inline error surface, and the
bottom-docked `TimeComposer`. The header exposes unscheduled tasks. In
development builds, a preview menu can switch the stream to fixture scenarios;
real data remains the default.

## Data and native boundary

`TimeStream` renders a `TimeItem` union containing either a task or an EventKit
calendar event. Tasks use `services/tasks/`; calendar access goes through
`services/calendar/calendar-event-gateway.ts` and the iOS `on-device-ai` Expo
module. The gateway is replaced by a fixture gateway only for E2E testing.

Calendar queries are enabled when the Time screen is focused and calendar
permission is authorized. Tasks remain available when Calendar permission is
denied or unavailable. Calendar permission status is `authorized`, `denied`,
or `notDetermined` at the JavaScript query boundary.

## Natural-language composer

`useTimeComposer` builds context from current calendar events and tasks, then
passes the request to `resolveTimeRequest`. Parsing is performed through the
task time-block parse mutation; calendar lookup and writes use the calendar
gateway.

The implemented interaction states are:

| State | Meaning |
| --- | --- |
| `idle` | Ready for a new request. |
| `parsing` | A submitted prompt is being interpreted; duplicate submission is blocked. |
| `draft` | A reviewed task or event is ready for explicit confirmation. |
| `answer` | A direct answer was found without a write action. |
| `availability` | Openings were found and can be selected. |
| `event-choice` | Multiple calendar events match and the user must choose one. |

The composer clears its visible prompt only after a non-error interpretation
result. Cancelling an answer, availability result, or event choice restores the
submitted prompt. Parse errors restore the prompt and surface an inline error;
they do not create data.

Selecting an availability opening turns it into an event draft. Event drafts
require a title, authorized Calendar access, and both start and end times.
Task drafts may include a deadline, duration, exact schedule, scheduling window,
and location. The user must confirm the draft before a mutation runs.

## Time-block detail

Tasks and calendar events use the same `TimeBlockDetail` screen but retain
source-specific behavior:

- Tasks can be completed, edited, scheduled, unscheduled, or deleted through
  task mutations. Unscheduling removes the exact interval without deleting the
  task or its other scheduling information.
- Calendar events use EventKit create/update/delete operations. Recurrence
  edits carry an EventKit recurrence scope. Read-only events expose their data
  without enabling edits.
- Title, duration, location, notes, people, and date/time fields are edited on
  the shared detail surface. Unsaved local edits remain visible after a failed
  save, and leaving dirty state is guarded by discard confirmation.

The route source is part of the URL and must not be inferred from a generic
mixed-content ID.

## Errors and verification

Calendar-only actions explain when Calendar permission is needed. Network or
model parse errors preserve the original prompt. Calendar/task write failures
retain the reviewed draft and must not duplicate a retry.

Time tests are under `apps/omiro/tests/components/time/`,
`apps/omiro/tests/services/calendar/`, and `apps/omiro/tests/services/tasks/`.
Maestro coverage is under `apps/omiro/tests/e2e/time-*.yaml`. Verify idle,
parsing, draft, answer, availability, event-choice, permission, offline,
detail-edit, save, delete, and deep-link states on the iPhone simulator.
