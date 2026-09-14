---
title: 'Fix dead Retry after new-chat handoff on Omiro'
status: 'Proposed'
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

## Fix direction

Extend the checkpoint shape with the accepted user message ID (or full
`userMessage`), restore it into the new screen's generation state, and
cover the new-chat-then-fail-then-retry path with a hook test. Surfaced
by Codex review on PR #344 (misfiled — the code is main's, not the PR's).

## Acceptance criteria

- [ ] AC-001: New chat → generation fails → Retry regenerates in place
  without duplicating the user message.
- [ ] AC-002: Omiro chat generation tests green; no behavior change
  otherwise.
