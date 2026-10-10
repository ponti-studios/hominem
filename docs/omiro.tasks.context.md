# Tasks issue 5: tasks with no context

Status: proposed. Frame: `K5Context`.

## The failure

"Call Sam" and "send the draft" lose their meaning within a week. Without the
reason a task exists, it feels stale and gets ignored or deleted unread.

## Philosophy

A task is a promise made somewhere. Omiro keeps the somewhere: the chat or note
it came from. Apple Reminders cannot do this, which is why Omiro owns its tasks.

## How Omiro solves it

- A task created from chat or a note records where it came from: the chat or
  note, and the line that produced it.
- A task row shows a quiet origin glyph (chat or note). Its detail sheet shows
  the origin card: the title of the chat or note, how long ago, and the line
  that produced the task. Tapping it opens that chat or note.
- A task made by hand has no origin. Omiro shows nothing for it instead of a
  placeholder.

## Not doing

- No separate "Sources" screen or filter by origin. The link is for context, not
  for organizing (see [issue 4](omiro.tasks.organizing.md)).
- No origin text in list rows. The row stays one line.

## Today

Nothing keeps the origin. Chat no longer extracts tasks — tasks are created
by voice capture, batch create, or direct creation, and the link to any
source chat is lost. Tasks are our own records now, so the origin can
be a field on the task.

## Open questions

- Where is the origin stored: MMKV keyed by reminder id, or a server row?
  MMKV is lost when the app is reinstalled.
- What does the origin card show when the source chat or note was deleted?
