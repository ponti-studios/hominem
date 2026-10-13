# Task creation from chat

Chat no longer extracts tasks from the conversation. There is no
"Create tasks" transform, no `POST /api/tasks/extract`, and no review
overlay: mining a free-form transcript for commitments is not how the
models should work, so the whole extract → review → batch-create flow
was removed.

## Remaining creation paths

- `POST /api/tasks/voice` — structured tasks from a spoken quick-capture
  (`extractVoiceTasks` in
  `services/api/src/application/task-extraction.service.ts`), with its own
  rate-limit bucket (`ai-task-voice`). Unlike the removed chat flow, the
  speaker already intends each item as a task; the model only structures,
  prioritizes, and dates them.
- `POST /api/tasks/batch` — persists caller-built `{ groups, tasks }`
  via `persistExtractedTasks`
  (`services/api/src/application/tasks.service.ts`).
- `POST /api/tasks` — direct single-task creation with the full scheduling
  field set (`dueAt`, `schedulingWindowStartAt`, `scheduledStartAt`,
  `participants`, ...) and an explicit `parentTaskId`/`artifactType`.
- `POST /api/tasks/parse` — server time-block parsing retained as a supported
  surface for web task management, older Omiro builds, and Omiro's
  natural-language Time input
  (`extractTimeBlock` in
  `services/api/src/application/time-block-extraction.service.ts`, routed by
  `services/api/src/rpc/routes/tasks.parse.ts`); unrelated to task creation.

## Current limitations

`task_list` is an application-level distinction, not a separate relational
family: a "list" is just a task row (`artifactType: 'task_list'`) with child
tasks pointing at it via `parentTaskId` on the shared `app.tasks` table. There
is no dedicated `task_lists` table, explicit ordering, or list-editing
workflow.
