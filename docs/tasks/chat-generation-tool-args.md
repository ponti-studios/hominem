---
title: 'Unify tool-argument parsing contract (F2)'
status: 'Proposed'
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

- **OPEN — USER DECISION REQUIRED:** strict (`ToolInputError` → visible
  validation error) or lenient (silent `{}` → generic result)? Proposal:
  strict everywhere — the bad argument string is already visible in the
  model transcript. Confirm before implementing.

## Scope

In scope: the two `parseArguments` functions, preview/execute/tool-result
paths that consume them, malformed-JSON + schema-mismatch test cases.

Out of scope: event ownership (previous task); effect persistence (next
task). If a path genuinely needs the other semantic, keep it as an
explicitly named wrapper (`parseStrict`/`parseLenient`) with a comment —
not a second default.

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Record the strict/lenient decision (here or `docs/decisions/`) | user | — | written decision | No implementation starts undecided |
| W-002 | Unify to the chosen contract; named wrappers only where proven necessary | `packages/chat` + engine | W-001 | engine test output for malformed + schema-mismatch inputs | One contract per path |
| W-003 | Run gates for touched packages | repo | W-002 | `pnpm format`, package lint + typecheck | Green |

## Acceptance criteria

- [ ] AC-001: The decision is written down.
- [ ] AC-002: Malformed JSON and schema-mismatched args assert the chosen visible behavior in focused tests.
- [ ] AC-003: No silent-`{}` path remains unless it is a named, commented wrapper.

## Exit gate

Close when AC-001–AC-003 hold. This task is a prerequisite for the
effect-store task — do not reorder.
