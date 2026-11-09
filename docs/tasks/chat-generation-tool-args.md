---
title: 'Unify tool-argument parsing contract (F2)'
status: 'Implemented'
priority: 'medium'
labels: [chat, cleanup, refactor]
depends_on: [chat-generation-event-ownership.md]
blocks: []
estimated_size: 'S'
---

## Outcome

One tool-argument parsing contract across the runner
(`packages/chat/src/server.ts:151`, silent `{}`) and the engine
(`services/api/src/chat/chat-generation-engine.ts:32`, throws
`ToolInputError`). Same malformed input produces the same visible behavior
on every path.

## Decisions required

- **DECIDED:** strict everywhere (confirmed by user). Malformed JSON and
  schema-mismatched args surface as a visible validation error, since the bad
  argument string is already visible in the model transcript.

## Decided

Strict everywhere (confirmed by user). The runner's `parseArguments` now
throws `ToolInputError` on malformed JSON or schema-mismatched args,
matching the engine's contract. The execute adapter catches it and returns
a failed `ToolResult` (`{ error: 'Tool call failed' }`), matching the
engine's visible behavior. A named lenient wrapper (`parseArgumentsLenient`)
is retained for record-keeping paths (`toToolRecord`, `pendingToolCall.args`)
where a malformed string must not abort the generation.

## Scope

In scope: the two `parseArguments` functions, preview/execute/tool-result
paths that consume them, malformed-JSON + schema-mismatch test cases.

Out of scope: event ownership (previous task); effect persistence (next
task). If a path genuinely needs the other semantic, keep it as an
explicitly named wrapper (`parseStrict`/`parseLenient`) with a comment —
not a second default.

## Work sequence

| ID    | Work item                                                                | Owner boundary           | Depends on | Validation / artifact                                     | Done when                          |
| ----- | ------------------------------------------------------------------------ | ------------------------ | ---------- | --------------------------------------------------------- | ---------------------------------- |
| W-001 | Record the strict/lenient decision (here or `docs/decisions/`)           | user                     | —          | written decision                                          | No implementation starts undecided |
| W-002 | Unify to the chosen contract; named wrappers only where proven necessary | `packages/chat` + engine | W-001      | engine test output for malformed + schema-mismatch inputs | One contract per path              |
| W-003 | Run gates for touched packages                                           | repo                     | W-002      | `pnpm format`, package lint + typecheck                   | Green                              |

## Acceptance criteria

- [x] AC-001: The decision is written down.
- [x] AC-002: Malformed JSON and schema-mismatched args assert the chosen visible behavior in focused tests.
- [x] AC-003: No silent-`{}` path remains unless it is a named, commented wrapper.

## Exit gate

Close when AC-001–AC-003 hold. This task is a prerequisite for the
effect-store task — do not reorder.

## Evidence

- `pnpm run check` — full repo gate passed (31/31 tasks).
- `pnpm --filter @hominem/chat test` — 105 tests passed.
- `pnpm --filter @hominem/api test` — 1412 tests passed.
- `pnpm --filter @hominem/chat typecheck` and `@hominem/api typecheck` — clean.
- Decision recorded: strict everywhere (confirmed by user). Runner's `parseArguments` now
  throws `ToolInputError`, matching the engine. Execute adapter catches and returns a failed
  `ToolResult` (`{ error: 'Tool call failed' }`). Named lenient wrapper `parseArgumentsLenient`
  retained for `toToolRecord` and `pendingToolCall.args`.
- `ToolInputError` moved to `@hominem/chat/server` (re-exported from engine for backward compat).
