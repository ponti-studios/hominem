# Tasks issue 4: organizing instead of doing

Status: proposed. Frame: `K4Organizing`.

## The failure

Lists, tags, filters and views feel productive and are not. The people who enjoy
them are organizing, not finishing, and every control added to serve them
makes the app heavier for everyone else.

## Philosophy

Users have no interest in tagging, organizing or creating custom lists, and the
users who do are not the ones Omiro is built for. A task has a title and a day.
Anything else is a feature Omiro does not have.

## How Omiro solves it

- A task in Omiro has three things: a title, a day (and optionally a time), and
  notes.
- The task detail sheet offers only what moves the task forward: Done, Move,
  Delete.
- Omiro never shows lists, tags, flags, priority, subtasks or recurrence
  controls.

## Not doing

Custom lists, tags, flags, smart lists, sort and filter builders, subtasks, and
recurrence editing. Adding one means adding the next.

## Today

The detail sheet offers Done and Delete, and shows location and notes
(`apps/omiro/components/tasks/TaskDetailSheet.tsx`). Move lives on the
Carried over card. There are no organizing controls to remove.

## Open questions

- Does a recurring reminder show here at all, since each occurrence is a
  dated task?
- Is a task's time part of the philosophy, or only its day?
