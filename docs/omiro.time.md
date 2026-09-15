# Omiro Time

Time is the iOS task-and-calendar surface. It combines database-backed tasks
with device-only EventKit calendar summaries in one chronological stream.
EventKit is authoritative for calendar events; Hominem does not store or sync
calendar data.

## Routes and screen composition

- `/(protected)/time` renders `TimeScreen`.
- `/(protected)/time/unscheduled` renders the dedicated unscheduled task list.
- `/(protected)/time/task/[id]` opens the task detail surface. Event taps open
  Apple's native EventKit editor rather than an app-owned event detail screen.

`TimeScreen` contains `TimeStream`, an inline error surface, and the
bottom-docked `TimeComposer`. The header exposes unscheduled tasks. In
development builds, a preview menu can switch the stream to fixture scenarios;
real data remains the default.

## Data and native boundary

`TimeStream` renders a `TimeItem` union containing either a task or a compact
EventKit calendar summary. Tasks use `services/tasks/`; calendar access goes
through the iOS `on-device-ai` Expo module. The module owns one EventKit store
and exposes only permission checks, summaries, native-editor presentation, and
the typed on-device assistant result.

Calendar queries are enabled when the Time screen is focused and calendar
permission is authorized. Tasks remain available when Calendar permission is
denied or unavailable. Calendar permission status is `authorized`, `denied`,
or `notDetermined` at the JavaScript query boundary.

## Natural-language composer

`useTimeComposer` sends the prompt and compact task busy intervals to one
short-lived on-device Foundation Model session. Its native tools search EventKit,
open the Apple event editor for calendar changes, find availability, and propose
database-backed task drafts. No calendar context is sent over the network. If
Apple Intelligence is unavailable, manual browsing and native event editing
remain available while natural-language Time input explains that it is
unavailable.

The implemented interaction states are:

| State | Meaning |
| --- | --- |
| `idle` | Ready for a new request. |
| `parsing` | A submitted prompt is being interpreted; duplicate submission is blocked. |
| `draft` | A reviewed database-backed task is ready for explicit confirmation. |
| `answer` | A direct answer was found without a write action. |
| `availability` | Openings were found and can be selected. |

The composer clears its visible prompt only after a non-error interpretation
result. Cancelling an answer, availability result, or event choice restores the
submitted prompt. Parse errors restore the prompt and surface an inline error;
they do not create data.

Selecting an availability opening opens a native EventKit draft. Task drafts may
include a deadline, duration, exact schedule, scheduling window, and location.
The user must confirm task drafts before a database mutation runs.

## Time-block detail

Tasks use Omiro's `TimeBlockDetail`. Calendar events use Apple's editor:

- Tasks can be completed, edited, scheduled, unscheduled, or deleted through
  task mutations. Unscheduling removes the exact interval without deleting the
  task or its other scheduling information.
- `EKEventEditViewController` owns calendar create, edit, deletion, recurrence
  scope, calendar selection, attendees, alarms, save, and cancellation. It
  preserves native behavior for read-only calendars and recurring events.

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
