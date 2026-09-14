---
title: 'Shrink Omiro chat lifecycle hooks to shared ChatClient reducer (F5-omiro)'
status: 'Proposed'
priority: 'medium'
labels: [chat, cleanup, omiro, refactor]
depends_on: [web-chat-lifecycle-consolidation.md]
blocks: []
estimated_size: 'L'
---

## Outcome

Omiro `services/chat/use-chat-generation.ts` (199 lines) +
`use-send-message.ts` (275 lines, `driveGeneration` subscription +
optimistic cache) follow the web-proven F5 pattern: terminal handling +
`invalidateChatQueries` only, over the shared `ChatClient` reducer. MMKV
checkpoint survives solely as the `ChatCheckpointStore` implementation.
Apple-only; no Android fallbacks.

## Scope

In scope: `apps/omiro/services/chat/` cluster (`use-chat-generation`,
`use-send-message`, regenerate/respond/start where they duplicate
lifecycle ownership).

Out of scope: server changes; web changes; new product behavior (file
separately if found). Copy the web task's pattern — do not re-derive it.

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Reduce to terminal handling + cache invalidation over the shared reducer; MMKV kept only as checkpoint-store impl | `apps/omiro` chat services | — | hook unit tests | No `toStage`-style mapping remains in mobile hooks |
| W-002 | Focused coverage: retry of failed generations, cancel/stop delivery, regenerate | `apps/omiro` tests | W-001 | `use-chat-generation.test.tsx`, `use-send-message.test.tsx`, regenerate/respond suites | Recovery paths covered |
| W-003 | Simulator verification: send, streaming, stop, failure, retry, regenerate, tool-confirm | Maestro/simulator | W-002 | artifacts per `apps/omiro/AGENTS.md` evidence rules | Every named state observed on simulator |

## Acceptance criteria

- [ ] AC-001: No phase-mapping function remains in Omiro chat hooks.
- [ ] AC-002: Retry/cancel/regenerate have focused coverage.
- [ ] AC-003: Simulator artifacts exist for all W-003 states.
- [ ] AC-004: `pnpm format` clean; Omiro lint + typecheck green.

## Exit gate

Close when AC-001–AC-004 hold. Depends on the web consolidation task
(pattern proven first) — treat as locked until it is `Implemented`. If
this surfaces the known generation-cancellation delivery issue (see
`omiro-generation-cancellation.md`), link it; do not absorb it.
