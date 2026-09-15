---
title: 'Add focused tests for true web chat gaps'
status: 'Proposed'
priority: 'high'
labels: [web, chat]
depends_on: [web-chat-reinventory-matrix.md]
blocks: []
estimated_size: 'S'
---

## Outcome

True coverage gaps named by the re-inventory matrix have focused
hook/component/unit tests. Rows the matrix confirms as already covered get
no new tests.

## Scope

In scope: focused tests for true gaps only, per the corrected matrix in
`web-chat-reinventory-matrix.md`. Sibling tasks: `web-chat-browser-topup.md`
and `web-chat-a11y-topup.md` (run in parallel off the same matrix),
`web-chat-gap-reconciliation.md` (consumes all three).

Out of scope: browser/e2e verification (sibling browser task),
accessibility artifacts (sibling a11y task), implementing missing product
behavior (new tasks from reconciliation).

## Already covered — do not re-prove

Per the 2026-09-15 baseline carried in the matrix task: edit
(`use-chat-message-edit.ts`, e2e `UI-03`), delete (`deleteMessage`, e2e
`UI-03`), retry (`use-stream-message.ts`, e2e `RECOVER-01`), regenerate
(`use-regenerate-message.ts`, e2e `SEND-05` / `UI-04`), search
(`use-chat-message-search.ts`), response settings (`use-response-length.ts`),
archive (`useArchiveChat`), title (`useUpdateChatTitle`), task dialog
(`ChatTaskDialog`, `chat-task-review.test.tsx`).

## Acceptance criteria

- [ ] AC-001: Every true gap from the matrix has a focused test.
- [ ] AC-002: No duplicate coverage was added for already-covered rows.
- [ ] AC-003: The web test suite is green.

## Exit gate

Close when the gap-to-test mapping and suite output are reviewed.
