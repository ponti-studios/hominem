---
title: 'Shrink web chat lifecycle hook to shared ChatClient reducer (F5-web)'
status: 'Proposed'
priority: 'medium'
labels: [chat, cleanup, web, refactor]
depends_on: [chat-generation-effect-store.md]
blocks: []
estimated_size: 'L'
---

## Outcome

Web `use-stream-message.ts` (352 lines) owns no reducer, phase mapping, or
checkpoint logic of its own: `statusFromPhase` mapping and the
`localStorage` checkpoint go away in favor of the shared `ChatClient`
reducer + checkpoint store. The hook keeps cache-invalidation and
navigation only. Proves the F5 consolidation pattern that Omiro follows
next.

## Scope

In scope: `apps/web/app/lib/hooks/use-stream-message.ts` and its cluster
(`use-chat-messages`, composer, regenerate, tool-call-respond, start-chat
hooks where they duplicate lifecycle ownership).

Out of scope: server contract changes (previous tasks must be
`Implemented` first); new product behavior — if verification surfaces
missing behavior (e.g. edit/delete stubs in `useChatMessages`), file a
separate task, do not expand this one.

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Replace local text/reasoning/toolSteps/status state + `statusFromPhase` + `localStorage` checkpoint with the shared client reducer + checkpoint store | `apps/web` hooks | — | hook unit tests | No phase-mapping function remains in web hooks |
| W-002 | Focused hook coverage: resume-after-reload, failed-generation retry, cancel | `apps/web` hooks | W-001 | `use-stream-message.test.tsx`, `use-chat-messages` suites | Recovery paths covered |
| W-003 | Browser verification: send, streaming, stop, failure, retry, regenerate, tool-confirm | Playwright | W-002 | screenshots/DOM/console artifacts per `web-chat-browser-topup.md` evidence standard | Every named state observed in the target browser |

## Acceptance criteria

- [ ] AC-001: No `statusFromPhase`-style mapping or bespoke checkpoint code remains in web chat hooks.
- [ ] AC-002: Resume/retry/cancel have focused hook coverage.
- [ ] AC-003: Browser artifacts exist for all W-003 states; keyboard/focus behavior unchanged.
- [ ] AC-004: `pnpm format` clean; web lint + typecheck green.

## Exit gate

Close when AC-001–AC-004 hold and the pattern is documented well enough
for the Omiro task to copy. Depends on the effect-store task (server
contract final) — treat as locked until it is `Implemented`.
