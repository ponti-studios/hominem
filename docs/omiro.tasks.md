# Omiro tasks

Status: proposed. The Tasks tab does not do most of this yet; each issue doc
lists what is built and what is not.

Omiro Tasks answers one question: what should I do now? It is not a task
manager. Tasks are Apple Reminders records read through EventKit
(`apps/omiro/services/tasks/task-types.ts`); Omiro adds a short, dated view and
the link back to the conversation or note a task came from. Everything else
belongs to Reminders.

## Philosophy

Task apps die the same way. People put everything in, the list grows until it
is overwhelming, and nobody opens the app again. People who enjoy tags, custom
lists and views enjoy organizing, not finishing, and are not who Omiro is for.

Three rules follow from that and hold for every Tasks change:

- A task without a date is a wish, not a task. Omiro does not show or design
  for undated tasks.
- No tagging, custom lists, or organizing features. Omiro does not chase
  Reminders views.
- The list must never grow into something overwhelming.

## The five issues

Each issue has one doc and one design frame. They are numbered in the order we
build them.

| #   | Issue                          | Doc                                                    | Design frame   |
| --- | ------------------------------ | ------------------------------------------------------ | -------------- |
| 1   | Overload: a list with no limit | [omiro.tasks.overload.md](omiro.tasks.overload.md)     | `K1Overload`   |
| 2   | Wishes posing as tasks         | [omiro.tasks.wishes.md](omiro.tasks.wishes.md)         | `K2Wishes`     |
| 3   | The overdue pile               | [omiro.tasks.overdue.md](omiro.tasks.overdue.md)       | `K3Overdue`    |
| 4   | Organizing instead of doing    | [omiro.tasks.organizing.md](omiro.tasks.organizing.md) | `K4Organizing` |
| 5   | Tasks with no context          | [omiro.tasks.context.md](omiro.tasks.context.md)       | `K5Context`    |

## Keeping docs and designs in sync

The design canvas is "Omiro — Chat, Notes & Tasks"
(https://claude.ai/artifact/3EhYBkWjisXh7fnzEgpi8D). Its five issue frames are
the `K1`–`K5` boards, each with a note that names its doc.

- A change to a rule in a doc updates its frame in the same change, and the
  reverse.
- A frame's title carries its build state only while it is not built:
  `[Not built]`, `[Partial]` or `[In PR]`. A frame that is built and deployed
  has no label. The doc's Status line says the same. When it ships, delete the
  label and update the Status line.
- A doc never describes a screen that no frame shows, and a frame never shows
  behavior that no doc states.
