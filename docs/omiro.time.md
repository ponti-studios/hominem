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
and exposes permission checks, summaries, native-editor presentation, free-slot
search, and title matching. It contains no language model.

Calendar queries are enabled when the Time screen is focused and calendar
permission is authorized. Tasks remain available when Calendar permission is
denied or unavailable. Calendar permission status is `authorized`, `denied`,
or `notDetermined` at the JavaScript query boundary.

## Natural-language composer

`useTimeComposer` sends only the user's request text, the current time, and the
time zone to the server (`POST /api/tasks/parse`), which extracts one time
block with a cloud model. No calendar data, event titles, busy intervals, or
task data are sent. `resolveTimeRequest` then acts on the returned block
entirely on-device:

| Block intent                        | On-device result                                                            |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `add_task`                          | A reviewed task draft that needs explicit confirmation.                     |
| `add_event`, `add_recurring_event`  | Apple's event editor with the draft, including any recurrence rule. Without a start time, open slots are offered instead. |
| `edit_event`, `cancel_event`        | The event is matched by title in EventKit (`matchCalendarEvents`, next 90 days). One match opens Apple's editor; several offer a choice. |
| `schedule_gap_fill`                 | Free slots from `findCalendarOpenings`, computed in Swift from EventKit events and task busy intervals. |
| `search`                            | The EventKit events inside the block's scheduling window, listed as text.   |

For `search`, `schedule_gap_fill` and an `add_event` without a clock time, the extraction prompt sets the scheduling window to the period the user named ("tonight" is 18:00 to midnight, "Saturday morning" is 06:00 to 12:00); without a named period the app looks at the next seven days. UTC offsets are recomputed server-side from the user's time zone, so a date across a daylight-saving change is correct.

Natural-language Time input needs a network connection. Browsing the stream and
native event editing work offline. If parsing fails, the composer keeps the
submitted prompt and shows an inline error; nothing is created.

The implemented interaction states are:

| State          | Meaning                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `idle`         | Ready for a new request.                                                  |
| `parsing`      | A submitted prompt is being interpreted; duplicate submission is blocked. |
| `draft`        | A reviewed database-backed task is ready for explicit confirmation.       |
| `answer`       | A direct answer was found without a write action.                         |
| `availability` | Openings were found and can be selected.                                  |

The composer clears its visible prompt only after a non-error interpretation
result. Cancelling an answer, availability result, event choice, or the native
editor restores the submitted prompt. Parse errors restore the prompt and
surface an inline error; they do not create data.

Selecting an availability opening opens a native EventKit draft. Task drafts may
include a deadline, duration, exact schedule, scheduling window, and location.
The user must confirm task drafts before a database mutation runs.

The extraction prompt and its evals live in `services/api/src/rpc/prompts.ts`
(`TIME_BLOCK_EXTRACTION_PROMPT`) and `services/ori/data/time-block-extraction/`;
a test keeps the two aligned.

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
