# Tasks issue 2: undated tasks piling up

Status: proposed. Frame: `K2Wishes`.

## The failure

"Learn Spanish" and "fix the garage" have no date. They never become real, they
sit in the list, and they make every real task look as unimportant as they are.
The longer the list gets, the less often it is opened.

## Philosophy

Capturing a thought must cost nothing, so a task does not need a date to exist.
The cost comes later: an undated task has to be placed. The inbox keeps those
tasks out of the place where you look to decide what to do now, and triage keeps
the inbox from growing without anyone noticing.

## How Omiro solves it

- Every path that creates a task (chat, quick add, extraction from a
  conversation, importing reminders) can create it without a date. It goes to
  the inbox.
- The Tasks tab shows the inbox as one row, "N to place". It never lists undated
  tasks and never shows them in Today or Upcoming.
- The row opens triage, one task at a time. Each card offers quick dates (Today,
  Tomorrow, This weekend, Next week, Pick a date), "Make it a note", and Drop.
- An undated task can be marked done without placing it.
- A task that has sat undated for 14 days comes up in triage as "Still want
  this?" with Keep, Date and Drop. Nothing is deleted without a choice.
- Alerts fire only for tasks with a date.

## Not doing

- No inbox list on the Tasks tab, only the count.
- No default date. A task is dated because the person chose a day, not because
  the app guessed one silently.
- No lists, tags or priorities to sort the inbox with.

## Today

The service allows undated tasks (`apps/omiro/services/tasks/sync/task-service.ts`)
and the store keeps them after dated ones. The Tasks tab still lists them with
the dated tasks; the "N to place" row, triage, and the 14-day prompt are not
built.

## Open questions

- Does a date alone ("Saturday") count, or must a task also have a time?
- Does "Keep" on the 14-day prompt restart the 14 days?
