# Tasks issue 2: wishes posing as tasks

Status: proposed. Frame: `K2Wishes`.

## The failure

"Learn Spanish" and "fix the garage" have no date. They never become real, they
sit in the list, and they make every real task look as unimportant as they are.

## Philosophy

A task without a date is a wish, not a task. A wish is fine; it belongs in a
note. It does not belong in the place where you look to decide what to do now.

## How Omiro solves it

- Omiro does not show a reminder that has no date. It stays in Reminders,
  untouched.
- A task created in chat must have a date before it exists. If the request
  already says when, the date is set. If it does not, the assistant asks "when?"
  once, with quick choices: Today, Tomorrow, a weekday, or Pick a date.
- If the person does not want to commit to a day, the same card offers "Keep as
  a note". The text becomes a note, not a dateless reminder.
- On first run, one line explains that only dated reminders show here, so
  people do not think Omiro lost their undated ones.

## Not doing

- No "Someday" or "Inbox" section for undated tasks.
- No default date. A task is dated because the person chose a day, not because
  the app guessed one silently.

## Today

A `task_create` tool call with no `dueAt` is still mirrored into Reminders as
an undated reminder (`apps/omiro/services/tasks/mirror-chat-tasks.ts`), and the
Tasks tab shows it. Nothing asks for a date.

## Open questions

- Does a date alone ("Saturday") count, or must a task also have a time?
- What happens to an existing dateless reminder if its date is cleared later?
