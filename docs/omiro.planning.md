# Omiro Planning

Omiro does not manage time. The user's calendar is the iOS Calendar app and
their reminders are in Reminders; Omiro never draws a calendar, a day list or
an agenda of its own. What it adds is natural-language planning from the Stream
composer, and it hands everything that is really a calendar job to the system.

## Where it lives

- Stream and Tasks are the two native bottom tabs (`NativeTabs` in
  `app/(protected)/(tabs)/_layout.tsx`).
- The Stream composer shows a **Plan** action (`calendar.badge.plus`) once there
  is text. It hands the text to `usePlanner` (`components/time/use-planner.ts`),
  empties the composer, and puts the words back if the request fails or is
  cancelled. The send button shows a spinner while a request is being
  interpreted.
- Results appear in `PlannerSheets`: a `BottomSheet` (`TimeResultSheet`) for the
  draft, availability, event choice or answer, and a toast (`TimeToast`) for
  success or an error with Retry.
- `/(protected)/(tabs)/tasks` renders `TasksScreen`: every open task as a card,
  with an in-app detail sheet (`components/tasks/`). `time/unscheduled` and
  `time/task/<id>` deep links are rewritten to it.
- `/(protected)/time/event/<id>` is a deep link that presents Apple's native
  event editor and returns to the Stream.

## Data and native boundary

Tasks use `services/tasks/`. Calendar access goes through the iOS
`on-device-ai` Expo module, which owns one EventKit store and exposes
permission checks, event summaries, native-editor presentation, free-slot
search, title matching and event creation. It contains no language model.
EventKit is authoritative for calendar events; Omiro does not store or sync
calendar data.

## Natural-language requests

`useTimeComposer` sends only the user's request text, the current time and the
time zone to the server (`POST /api/tasks/parse`), which extracts one time block
with a cloud model. No calendar data, event titles, busy intervals or task data
are sent. `resolveTimeRequest` then acts on the returned block on-device:

| Block intent                       | Result                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `add_task`                         | A reviewed task draft that needs explicit confirmation.                   |
| `add_event`, `add_recurring_event` | Apple's event editor with the draft, including any recurrence rule. Without a start time, open slots are offered instead. |
| `edit_event`, `cancel_event`       | The event is matched by title in EventKit (next 90 days). One match opens Apple's editor; several offer a choice. |
| `schedule_gap_fill`                | Free slots from `findCalendarOpenings`, computed in Swift from EventKit events and task busy intervals. |
| `search`                           | The EventKit events inside the block's window, listed as text.            |

For `search`, `schedule_gap_fill` and an `add_event` without a clock time, the
scheduling window is the period the user named ("tonight" is 18:00 to
midnight); without one the app looks at the next seven days. UTC offsets are
recomputed server-side from the user's time zone.

### Scheduled tasks go on the calendar

Confirming a task draft that has a start time also creates an event on the
user's calendar (`addScheduledTaskToCalendar`): the end is the block's end time,
else start plus its duration, else one hour. It asks for Calendar access once
if it has not been decided, and it is best effort: a refusal, a read-only
calendar or a failure leaves the task saved and skips the event. A task with
only a deadline is not an event. The event is created once at save time; later
edits to the task do not update it.

Natural-language planning needs a network connection. If parsing fails, the
words go back into the composer and a toast offers Retry; nothing is created.
Calendar-only requests explain when Calendar permission is needed, and tasks
stay available without it.

The extraction prompt and its evals live in `services/api/src/rpc/prompts.ts`
(`TIME_BLOCK_EXTRACTION_PROMPT`) and `services/ori/data/time-block-extraction/`;
a test keeps the two aligned.

## Verification

Tests are under `apps/omiro/tests/components/time/`,
`apps/omiro/tests/components/tasks/` and `apps/omiro/tests/services/tasks/`.
Verify on the iPhone simulator: plan with a task, an event, a gap and a
question; cancel and fail a request (the words return); Calendar permission
denied; and a scheduled task appearing in Calendar.app.
