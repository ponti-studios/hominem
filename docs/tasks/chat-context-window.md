---
title: 'Design chat context-window tracking (deferred feature)'
status: 'Proposed'
priority: 'low'
labels: [chat, telemetry, context]
depends_on: [chat-generation-usage-accumulator.md, chat-generation-event-ownership.md, chat-generation-tool-args.md, chat-generation-effect-store.md, chat-generation-commit-extraction.md, web-chat-lifecycle-consolidation.md, omiro-chat-lifecycle-consolidation.md]
blocks: []
estimated_size: 'M'
---

## Outcome

A deliberate design for per-chat context-window tracking (e.g. what the
removed `chat:context-window:*` Redis keys gestured at: latest model,
token totals, cost, timestamp per chat) — with a named reader, a retention
policy, and a consumer. No write path without a reader; no reader without
an owner.

## Context

The 2026-09-14 cleanup deleted `createRedisChatContextCache` and its full
`recordCompletion` chain (`packages/chat` runner option → engine
passthrough → execute wiring → Redis). Reason: the runner's usage total
was always `null` in production (the `provider: () => model` bypass
discarded its accumulator), so the cache was write-dead — and nothing
anywhere read the keys, so it was read-dead too. Do not revive that shape.
The live cost path (`recordAIUsageEvent` from engine usage) was unaffected
and stays the system of record for spend.

## Scope

Deliberately unscoped until the cleanup chain is `Implemented` — this task
is locked behind all of it so the design starts from the final ownership
shape (engine owns the usage total; runner forwards `onUsage` untouched).

Questions the design must answer:

- Who reads per-chat context state, and what decision does it drive
  (model routing? pre-emptive compaction? UI budget meter?)?
- Write path: engine usage → what store, what TTL, what keying?
- Retention and cardinality bounds for the keyspace.
- Why Redis vs. the existing Postgres usage ledger (`ai-usage.ts`).

## Work sequence

| ID | Work item | Owner boundary | Depends on | Validation / artifact | Done when |
| --- | --- | --- | --- | --- | --- |
| W-001 | Name the reader and the decision it drives | product | cleanup chain `Implemented` | written decision | No write path designed without a reader |
| W-002 | Design store, keys, TTL, bounds | `packages/chat` + `services/api` | W-001 | design note | Reviewable contract |
| W-003 | Implement with reader-first tests | same | W-002 | focused tests + evidence per `hominem-evidence` | Reader observed consuming fresh writes |

## Acceptance criteria

- [ ] AC-001: Every written key has a reader asserted in tests.
- [ ] AC-002: Retention/TTL and cardinality bounds are explicit.
- [ ] AC-003: Relationship to the `recordAIUsageEvent` spend ledger is documented (no double-system-of-record).

## Exit gate

Close only when the reader exists and is observed, not when the write
path lands.
