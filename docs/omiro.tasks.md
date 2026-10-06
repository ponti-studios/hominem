# Omiro tasks

Status: proposed. The Tasks tab does not do most of this yet; each issue doc
lists what is built and what is not.

Omiro Tasks answers one question: what should I do now? It is not a task
manager. Tasks are Omiro's own: they live in a local database on the device and
sync with the server (`apps/omiro/services/tasks/sync/`), so every action works
offline. Omiro shows a short, dated view and the link back to the conversation
or note a task came from.

## Philosophy

Task apps die the same way. People put everything in, the list grows until it
is overwhelming, and nobody opens the app again. People who enjoy tags, custom
lists and views enjoy organizing, not finishing, and are not who Omiro is for.

Three rules follow from that and hold for every Tasks change:

- A task does not need a date to exist, but an undated task never sits in the
  list you act on. It waits in the inbox until you give it a date, turn it into
  a note, or drop it.
- No tagging, custom lists, or organizing features. Omiro does not chase
  Reminders views.
- The list must never grow into something overwhelming.

## The five issues

Each issue has one doc and one design frame. They are numbered in the order we
build them.

| #   | Issue                          | Doc                                                    | Design frame   |
| --- | ------------------------------ | ------------------------------------------------------ | -------------- |
| 1   | Overload: a list with no limit | [omiro.tasks.overload.md](omiro.tasks.overload.md)     | `K1Overload`   |
| 2   | Undated tasks piling up        | [omiro.tasks.wishes.md](omiro.tasks.wishes.md)         | `K2Wishes`     |
| 3   | The overdue pile               | [omiro.tasks.overdue.md](omiro.tasks.overdue.md)       | `K3Overdue`    |
| 4   | Organizing instead of doing    | [omiro.tasks.organizing.md](omiro.tasks.organizing.md) | `K4Organizing` |
| 5   | Tasks with no context          | [omiro.tasks.context.md](omiro.tasks.context.md)       | `K5Context`    |

## The screen

The Tasks tab has three sections, in this order: Carried over, Today, Upcoming,
and a single "N to place" row at the bottom that opens triage when the inbox is
not empty. The inbox itself is never listed on the tab. Frames are the `TS`
boards on the canvas, in the "Tasks — the screen" row.

| State       | Frame        | What it shows                                                                                       |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Busy day    | `TSToday`    | Carried over (Done, Move, Drop), Today, Upcoming capped at three with "+N this week" |
| Today clear | `TSClear`    | "All done for today" in place of the Today list; Upcoming still shows                               |
| First run   | `TSFirstRun` | Import your reminders or start fresh                                                                |
| Move        | `TSMove`     | A sheet: Tomorrow, Saturday, Next Monday, Pick a date                                               |

Tasks has its own composer, only for adding tasks. It makes an undated task, which lands in the inbox. Open decisions are listed on the canvas note beside these frames: what Drop does, and how many days Upcoming
covers. Upcoming looks seven days ahead; a task further out stays hidden until its week. All of these frames are built.

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
