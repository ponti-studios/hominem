---
title: 'Remove duplicated effect persistence from engine tools.execute (F3)'
status: 'Proposed'
priority: 'medium'
labels: [chat, cleanup, refactor]
depends_on: [chat-generation-event-ownership.md, chat-generation-tool-args.md]
blocks: []
estimated_size: 'S'
---

## Outcome

Effect idempotency has one owner: the runner's store adapters
(`createEffectStore` via `getEffect`/`saveEffect`). Engine
`tools.execute` keeps only pure `callTool` + result mapping; the
`effectStore.get`/`save` calls inside it are deleted. Replay proven with
the runner layer alone.

## Scope

In scope: engine `tools.execute` (`chat-generation-engine.ts:158`),
runner `tools.execute` (`server.ts:228`), replay tests.

Out of scope: event ownership and arg semantics (previous tasks — this
task assumes both are settled); `commitGeneration` extraction (next task).

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Strip get/save from engine `tools.execute`; keep `callTool` + `ToolResult` mapping | engine | — | read-through + engine tests | Engine holds no persistence logic |
| W-002 | Prove replay: stored-effect short-circuit + fresh-execution save-through cases via runner adapters only | `services/api` chat tests | W-001 | `chat-generation-replay.test.ts` + engine suite output | Idempotent replay green without engine-level store |
| W-003 | Run gates for touched packages | repo | W-002 | `pnpm format`, package lint + typecheck | Green |

## Acceptance criteria

- [ ] AC-001: Engine `tools.execute` contains no `effectStore.get`/`save` calls.
- [ ] AC-002: A replay-with-stored-effect test passes with the runner layer alone (~30 lines deleted).
- [ ] AC-003: Replay + engine suites green; no behavior change on fresh (non-replay) turns.

## Exit gate

Close when AC-001–AC-003 hold. Depends on the event-ownership and
tool-args tasks — treat as locked until both are `Implemented`.
