---
title: 'Fix dead Retry after new-chat handoff on Omiro'
status: 'Implemented'
priority: 'medium'
labels: [omiro, chat, bug]
depends_on: []
blocks: []
estimated_size: 'S'
---

## Problem

When a newly created chat is accepted and its generation later fails,
the chat screen's Retry button silently does nothing.

## Cause (verified, not assumed)

- `use-start-chat.ts` seeds the MMKV checkpoint on `generation.accepted`
  with `{ id, stage, lastDurableSequence }` only —
  `persistGenerationCheckpoint` (`use-chat-generation.ts:38`) has no
  `userMessageId` field at all.
- `retryLastGeneration` (`use-send-message.ts:224`) regenerates only when
  `failed?.stage === 'failed' && failed.userMessageId`, else falls back to
  `lastInputRef` — which is empty on a freshly mounted screen. Both paths
  miss, so Retry is a no-op.
- The accepted `userMessage` is available at the seed site
  (`event.payload.userMessage`, used two lines above the seed call), so
  the fix is to carry it through the checkpoint and restore it.

**Reconciled against the handoff rework (2026-11-22).** The recorded
cause predates `onAccepted`: the new-chat path no longer seeds an MMKV
checkpoint, it hands the live controller to the next screen and
`userMessageId` travels as a plain property (`use-start-chat.ts`, read
back in `use-chat-generation.ts`'s handoff restore), so the accepted
server id was already present on a fresh chat. The real remaining defect
was same-screen: `generation.accepted` swapped the optimistic user
message for the persisted one in the query cache but left
`generation.userMessageId` pointing at the optimistic id, so the
failed-banner Edit action (`ChatScreen`'s `messages.find`) missed and
found nothing to restore. Fixed by adopting the persisted id in
`use-chat-generation`'s event handler on `generation.accepted`.

## Acceptance criteria

- [x] AC-001: New chat → generation fails → Retry regenerates in place
      without duplicating the user message.
- [x] AC-002: Omiro chat generation tests green; no behavior change
      otherwise.

## Evidence

- `use-chat-generation.ts` subscribe handler adopts
  `toMessageOutput(event.payload.userMessage).id` into the generation
  state on `generation.accepted`, after the cache swap, so Edit and
  Retry keep targeting the persisted message. New-chat handoff already
  carried the server id (`use-start-chat.ts` → `use-chat-generation.ts`
  handoff restore).
- Regression test: `tests/services/chat/use-send-message.test.tsx` —
  "adopts the persisted user message id on generation.accepted so retry
  and edit target it" (accepted id survives the failed state; no
  `retryInput`, so Retry regenerates instead of resending).
- `pnpm --filter @hominem/omiro exec vitest run tests/services/chat/` —
  82 tests passed (15 files).
- `pnpm run check` — full repo gate (see the check log; run on the same
  tree).
