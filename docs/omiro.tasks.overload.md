# Tasks issue 1: overload

Status: proposed. Frame: `K1Overload`.

## The failure

Everything goes in and nothing comes out. The list grows without limit, and
opening the app starts to feel bad. People then stop opening it.

## Philosophy

The size of the list is never the headline. The screen shows only what is worth
acting on this week, and it stays short on purpose. A short list that is empty
by evening is the goal; a complete list is not.

## How Omiro solves it

- The Tasks tab shows Carried over, Today, and Upcoming for the next seven days,
  plus one "N to place" row for undated tasks. Nothing else is on the page.
- Upcoming is capped. If more tasks fall in the window, the section ends with a
  count ("+4 this week") instead of more rows.
- Finishing Today shows an empty state that says you are done. That is a win,
  not a blank screen.
- Tasks outside the window stay out of sight until their week.

## Not doing

- No "All tasks" list, no completed archive, no sort or filter controls.
- No total count of open tasks on the screen. A large number is the thing that
  makes people stop opening the app.

## Today

Built. `groupTasks` (`apps/omiro/components/tasks/task-time.ts`) splits open
dated tasks into the three sections; Upcoming shows three rows and a
"+N this week" count.

## Open questions

- How many days is "upcoming": 3, 7, or until the next weekend?
- What is the cap on Today? A hard number, or everything dated today?
