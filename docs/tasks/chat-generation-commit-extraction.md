---
title: 'Extract commitGeneration into named ordered steps (F8)'
status: 'Proposed'
priority: 'medium'
labels: [chat, cleanup, refactor]
depends_on: [chat-generation-effect-store.md]
blocks: []
estimated_size: 'M'
---

## Outcome

`commitGeneration` (`chat-generation-execute.ts`, ~120 lines, 6 interleaved
jobs) becomes named steps with the ordering constraint test-enforced —
stale run/message deletion only after the replacement commits — while the
transaction boundary stays exactly where it is.

## Scope

In scope: `commitGeneration` decomposition in the same file:
synthesize-audio → insert/replace message → supersede-stale → lifecycle
update → append-commit-events → enqueue-embedding → persist-speech.
A step-ordering test.

Out of scope: moving side effects across the transaction boundary;
changing commit/checkpoint event semantics; embedding or speech product
behavior. Extraction only — not a deletion target.

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Extract named steps, same file, same transaction boundary | execute | — | read-through | Each step has one job |
| W-002 | Add ordering test: stale delete happens only after replacement commit; embedding/speech fan-out still fires post-commit | `services/api` chat tests | W-001 | new test + execute suite output | Ordering test-enforced |
| W-003 | Run gates: execute + `chats.$chatId.generation.test.ts` + `chats.test.ts` | repo | W-002 | `pnpm format`, package lint + typecheck | Green, no behavior change |

## Acceptance criteria

- [ ] AC-001: `commitGeneration` reads as a sequence of named steps; no step mixes transactional and non-transactional work without a comment.
- [ ] AC-002: Ordering test fails if stale deletion moves ahead of the replacement commit.
- [ ] AC-003: Generation route + chats suites green.

## Exit gate

Close when AC-001–AC-003 hold. Depends on the effect-store task — treat as
locked until it is `Implemented`.
