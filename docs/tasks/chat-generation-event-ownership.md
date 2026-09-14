---
title: 'Test-enforce generation event ownership (F4)'
status: 'Implemented'
priority: 'medium'
labels: [chat, cleanup, refactor]
depends_on: []
blocks: [chat-generation-effect-store]
estimated_size: 'S'
---

## Outcome

The engine/execute event-ownership split is explicit and test-enforced.
`chat-generation-engine.ts` drops the machine's copies of
started/committed/cancelled/failed + running/saving-phase events because
`chat-generation-execute.ts` persists those same types in its own
transactional path. The `UNSOPPORTED_EVENT_TYPES` typo is fixed. Two
failure modes are test-enforced, not just documented:

- **double-write** — a removed filter arm would persist the machine's copy
  alongside execute's copy (duplicate durable rows, broken projections);
- **loss** — execute stopping a boundary write while the filter still drops
  the machine's copy would erase the type from the log entirely.

## Scope

In scope: hoisting the drop list to module scope with the typo fixed and
an ownership comment stating the transactional why, an exported predicate
covering both filter arms, a union-exhaustiveness test (new payload variant
fails until classified), and a behavioral exactly-once test through the
full path.

Out of scope: changing which side owns what (behavior freeze); tool-arg
semantics (next task); effect persistence (later task).

## Background (verified against code, not assumed)

- The machine emits started/committed/cancelled/failed + phase_changed
  through the single `persist` funnel (`packages/chat/src/server.ts`), and
  `executeGenerationTurn` has exactly one caller — so the filter is
  load-bearing dedup, not dead defense. Fresh starts pass no
  `initialState`, and the machine emits `generation.started` on start
  (`generation-machine/lifecycle.ts`), so the main path exercises the
  filter; the behavioral test below is genuine coverage.
- The split is three classes, not two: execute-only (`accepted` — the
  machine never emits it), machine-emits-but-engine-drops (boundary),
  machine-emits-passthrough (mid-run: `tool.*`, `confirmation.*`,
  `retry_scheduled`, other phases).
- The reason for the split is transactional atomicity: boundary events
  share execute's commit transaction with the message snapshot, while
  mid-run events go through per-event transactions (with tool-lifecycle
  side effects). The comment must state this, not just name writers.

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Hoist drop list to module scope, fix typo, export `isExecuteOwnedEvent` predicate covering both arms; ownership comment states the transactional why | engine `store.appendEvent` | — | read-through | Comment names both writers + why; predicate exported |
| W-002 | Predicate unit test + union-exhaustiveness test: every `GenerationHistoryEventPayloadSchema` option classified execute/engine; fails on new variant or unilateral filter change | `services/api` engine tests | W-001 | new test output | Split is test-enforced at type level |
| W-003 | Behavioral exactly-once test: full generation asserts started/accepted/running/saving/committed appear exactly once in the durable log | testkit route tests | W-001 | new test output | Double-write/loss caught in reality |
| W-004 | Run gates for touched packages | repo | W-002, W-003 | `pnpm format`, package lint + typecheck, engine + testkit suites | Green |

## Acceptance criteria

- [ ] AC-001: `rg -n "UNSOPPORTED" packages services` returns nothing.
- [ ] AC-002: Exhaustiveness test covers every `GenerationHistoryEventPayload` variant and fails if a variant is added unclassified.
- [ ] AC-003: Behavioral test fails if any filter arm is removed (double-write) or any boundary write is lost.
- [ ] AC-004: Engine + testkit suites green; no behavior change.

## Exit gate

Close when AC-001–AC-004 hold. Prerequisite for the effect-store task —
do not reorder.
