# Tasks issue 3: the overdue pile

Status: proposed. Frame: `K3Overdue`.

## The failure

Missed tasks turn into a red number that grows until you stop looking. The
overdue list is where task apps go to be ignored.

## Philosophy

An overdue task is a decision you have not made yet. It is never allowed to sit
there. Every task is always one of three things: done, moved to a new day, or
dropped.

## How Omiro solves it

- There is no separate Overdue section and no overdue count.
- A missed task rolls into Today under "Carried over", with three one-tap
  actions: Done, Move (to tomorrow or a picked day), Drop.
- A task carried over more than a few times asks "Still real?" instead of
  carrying on a fourth time. The answer is Move or Drop; there is no "keep".
- Drop deletes the task.

## Not doing

- No red styling, no badge on the tab for overdue tasks.
- No bulk "reschedule everything" button. It hides the decision the person has
  to make for each task.

## Today

Built. A task from an earlier day shows under Carried over with Done, Move
(`MoveSheet`) and Drop. The "Still real?" prompt after repeated carry-overs is
not built.

## Open questions

- How many carry-overs before "Still real?": 2 or 3?
- Does Drop delete the task, or keep it as dropped? Deleting loses history.
