---
title: 'Re-inventory web chat gap map and diff coverage'
status: 'Proposed'
priority: 'high'
labels: [web, chat]
depends_on: []
blocks: []
estimated_size: 'S'
---

## Outcome

The Part II gap map in chat.capabilities.md is corrected against current
`apps/web`, every present row maps to its tests, and the open questions below
are resolved. This matrix is the input the sibling tasks build on:
`web-chat-focused-coverage.md`, `web-chat-browser-topup.md`,
`web-chat-a11y-topup.md`, then `web-chat-gap-reconciliation.md`.

## Scope

In scope: re-checking each Part II gap-map row against current `apps/web`
code, mapping present rows to focused tests and playbook IDs in
`apps/web/tests/e2e/chat-playbook.spec.ts`, resolving the open questions,
and correcting the Part II rows in place.

Out of scope: writing new tests (sibling coverage task), running new browser
verification (sibling browser task), implementing missing behavior (new
tasks from the reconciliation sibling).

## Starting baseline (2026-09-15, to re-confirm, not re-prove)

Capabilities the gap map lists as missing that were implemented in
`apps/web`:

| Capability | Evidence |
| --- | --- |
| Edit user message | `app/components/chat/use-chat-message-edit.ts`, wired in `chat-message.tsx`; e2e `UI-03` |
| Delete user message | `deleteMessage` in `app/lib/hooks/use-chat-messages.ts`, `onDelete` in `routes/chat/chat.$chatId.tsx`; e2e `UI-03`; hook tests |
| Retry failed generation | `retry` / `retryOfGenerationId` in `app/lib/hooks/use-stream-message.ts`, `retryGeneration`; e2e `RECOVER-01` |
| Regenerate assistant response | `app/lib/hooks/use-regenerate-message.ts`, wired in `chat.$chatId.tsx`; e2e `SEND-05`, `UI-04`; hook tests, stories |
| Cancel generation | e2e `RECOVER-02`, `RECOVER-03`, `RECOVER-04` / `RECOVER-05` |
| Tool calls + approval | e2e `TOOL-01..04` |
| Message search | `app/lib/hooks/use-chat-message-search.ts`, `chat-message-search.tsx`; hook tests |
| Response settings | `app/lib/hooks/use-response-length.ts`, `chat-response-settings.tsx`; tests |
| Archive + archived list | `useArchiveChat` in `app/hooks/use-chats.ts`, `routes/chats.tsx`, `chat-conversation-actions.tsx`, `routes/settings.archived-chats.tsx`; tests |
| Chat title behavior | `useUpdateChatTitle` in `app/hooks/use-chats.ts`; tests |
| Task extraction dialog | `ChatTaskDialog` wired in `chat.$chatId.tsx`; `chat-task-review.test.tsx` |
| Keyboard + named controls | e2e `UI-06` |
| Smallest supported viewport | e2e `UI-05` |
| Reduced motion | e2e `UI-08` |
| Draft persistence | e2e `UI-07` |
| Copy / share / listen | e2e `UI-04` |

## Open inventory questions

- Chat-to-note from a web transcript: no `note-draft` / `chat-to-note` surface found in `apps/web` — confirm missing or locate it.
- Mixed All/inbox capture model: gap map says missing — confirm still true.
- Debug view, offline/recovery states: partially suggested (`You are offline…` in `chat.$chatId.tsx`) — confirm extent.
- Omiro-side Partial/Unverified items (delete passthrough, tool-call approval on Omiro, task-extraction acceptance) bound what "parity" can mean — record the Omiro ceiling per capability.

## Acceptance criteria

- [ ] AC-001: Every Part II row is marked present/partial/missing against current code.
- [ ] AC-002: Each present row maps to its focused tests and/or playbook IDs.
- [ ] AC-003: All four open questions above are resolved with evidence.
- [ ] AC-004: The Part II gap map is corrected in place to match the matrix.

## Exit gate

Close when the corrected matrix and coverage diff are reviewed. If the true
gap surface turns out large, upsize the sibling tasks before they start
rather than absorbing the work here.
