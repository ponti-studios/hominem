---
title: 'Unify chat usage accumulators + remove dead context cache (F1)'
status: 'Implemented'
priority: 'medium'
labels: [chat, cleanup, refactor]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Outcome

Single ownership of usage accounting, as the interrogation required: the
engine's typed `addUsage` is the one accumulator per generation; the
runner's generic `addUsageTotals` is deleted and the runner forwards
`onUsage` untouched. The write-dead/read-dead Redis context-window cache
and its entire `recordCompletion` chain (runner option → engine
passthrough → execute wiring → Redis adapter) are removed. The
`provider: () => model` closure is annotated, not "fixed": with the runner
no longer overriding `onUsage`, the only discarded override is
`requiresConfirmation`, which duplicates the engine's own — benign.

Why not the original plan (one shared typed helper): the interrogation
showed the accumulators were never equivalent (the generic one reset
totals on partial payloads and dropped accumulated cost on null-cost
legs), and `@hominem/chat` deliberately holds no `@hominem/ai` edge, so a
typed helper could not live in the runner's layer without new coupling.
Deletion of the generic was the correct unification, not relocation.

## Scope

Touched: `packages/chat/src/server.ts` (deleted `addUsageTotals`, `usage`
var, `onUsage` override, `context` option, `recordCompletion` call),
`packages/chat/src/server.test.ts` (recordCompletion assertions replaced
with an `onUsage`-passthrough assertion),
`packages/chat/src/redis-adapters.ts` + test (deleted
`createRedisChatContextCache` and its test; effect store untouched),
`services/api/src/chat/chat-generation-engine.ts` (deleted `context`
passthrough, annotated prebuilt-model closure),
`services/api/src/chat/chat-generation-types.ts` (deleted
`GenerationEngineInput.context`),
`services/api/src/chat/chat-generation-execute.ts` (deleted cache import,
instance, wiring, and now-unused `redis` import).

Out of scope (unchanged): `CHAT_MODEL` usage ledger via
`recordAIUsageEvent` (still fed by engine usage — the live cost path);
effect-store duplication (F3 task); event-ownership split (F4 task).

## Work performed

| ID | Work item | Validation / artifact | Done when |
| --- | --- | --- | --- |
| W-001 | Delete runner accumulation + `recordCompletion`; forward `onUsage` untouched | `server.test.ts` passthrough assertion; chat suite 95 passed | Exactly one accumulator |
| W-002 | Delete Redis context cache + full chain | `rg recordCompletion\|ContextCache\|context-window\|addUsageTotals` clean in src (comment refs only) | No dead scaffolding |
| W-003 | Annotate `provider: () => model` bypass as benign-with-reason | read-through | Future readers don't re-litigate |
| W-004 | Gates: format, lint (warnings pre-existing only), `tsc --noEmit` both packages, focused suites | see Validation below | Green |

## Acceptance criteria

- [x] AC-001: `rg` for `addUsageTotals`/`recordCompletion`/`ContextCache` returns nothing in src (test files included). `context-window` is excluded from this check by design — two intentional comments in `chat-generation-engine.ts` reference the still-open context-window placeholder task; the check was originally written to also require zero `context-window` hits, but that's unsatisfiable without deleting those forward-references, so the criterion is narrowed to the three identifiers actually deleted here.
- [x] AC-002: Engine `addUsage` null-cost semantics preserved (no test change needed — accumulator untouched).
- [x] AC-003: Runner test asserts single-accumulator passthrough instead of the removed hook.
- [x] AC-004: `pnpm format` clean; lint + typecheck green for `packages/chat`, `@hominem/api`.

## Validation

- Scope: refactor (usage ownership) + safe deletion (dead cache chain).
- Commands: `pnpm --filter @hominem/chat format/lint/typecheck/test`;
  `pnpm --filter @hominem/api format/lint/typecheck`;
  `vitest run` engine/replay/store/provider (29 passed),
  generation.service/chats/chats.route-helpers (44 passed);
  `git diff --check` clean.
- Environment: local worktree, `DATABASE_URL` test DB env set (suites are
  faked, no live DB touched).
- Observed result: 13 chat test files / 95 tests passed; 7 API files / 73
  tests passed; both typechecks clean; lint shows pre-existing
  `consistent-type-assertions` warnings only.
- Artifacts: this task file; diff touches 7 files (+41/−150 across the
  whole worktree diff including task files).
- Unverified: full `pnpm run check` gate (heavier; scoped gates green —
  run the full gate pre-push per repo rules). Pre-existing user-owned
  uncommitted changes in `apps/omiro`/`apps/web` were left untouched.

## Exit gate

Closed: AC-001–AC-004 hold. Context-window tracking is redesigned under
`chat-context-window.md` (placeholder), not revived from these deletions.
