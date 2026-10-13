---
title: 'Finance sheet mirror import tools'
status: 'Implemented'
priority: 'high'
labels: [finance, mcp]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Outcome

Hominem accepts the Sheets Transactions backfill and daily deltas over MCP:
`finance_transaction_upsert`, `finance_transactions_import` (append / replace /
dryRun), and `finance_categories`. Re-running any import over the same rows
yields `created: 0`.

## Decisions

- Transfer detection v1: case-insensitive substring `transfer` in the
  description → `transfer`; else sign (negative → debit, positive → credit,
  zero → `adjustment` — a zero-amount row has no direction). Credit-card
  autopay / bill-pay rows are NOT auto-marked transfers (v2 paired-transaction
  work).
- Categories: pre-create taxonomy on demand — unknown/blank names auto-create
  (case-insensitive), plus a guaranteed `Uncategorized`. No hardcoded 52-list;
  the backfill creates whatever the sheet holds.
- Replace gate: `mode: replace` requires `iUnderstand: true` and a payload in which every
  row validates; it wipes only once both hold, so it can never wipe and then discover
  rejections. No in-process dry-run "arm": that state lived in memory and silently made
  replace unusable after any restart (a deploy invalidated it).
- Recurring kept: sheet col K → `recurring` boolean (column already exists).
- Order # kept: sheet col H appended into `notes` as `Order #: <value>`,
  truncated to 2000 chars.
- Idempotency: `externalId = sheet:<sha1(postedOn|accountId|normalized
  description|amountCents|currencyCode)>` stored with the sheet `source`
  (plaid | starling | manual). Reuses the existing
  `(owner_userId, source, external_id)` unique index — no new column.
- Account resolution: explicit `accountMap` first, then uuid-owned, then exact
  name match (case-insensitive); else `unknown_account`. Currency mismatch →
  `currency_mismatch`. Never auto-provision.
- Tag resolution: sheet tags match case-insensitively and reuse an existing tag —
  `app.tags` is unique on `(owner, lower(name))` and on `(owner, slug)`, so a sheet tag
  that differs only in case must never create a duplicate or fail the write.

## Scope

In scope: Phase 0+1 — model delta (none needed; `notes`, `source`,
`externalId`, `categoryId`, `recurring` already exist), category ensure +
`finance_categories`, upsert + batch import tools, unit/integration tests.
Out of scope: checked-in 28-label account map JSON, VM `hominem_push.py`,
daily wiring, deletes, write-back (Phases 2–4).

## Work sequence

| ID    | Work item                                         | Owner boundary                          | Depends on | Validation / artifact              | Done when                                            |
| ----- | ------------------------------------------------- | --------------------------------------- | ---------- | ---------------------------------- | ---------------------------------------------------- |
| W-001 | Pure transforms + natural key (`sheet-import.ts`) | `packages/finance`                      | —          | unit tests                         | Key stable, transfer/category/tag/note rules covered |
| W-002 | DB upsert/batch + category/tag ensure             | `packages/finance`                      | W-001      | integration tests vs scratch store | Re-run yields created: 0; rejections per-row         |
| W-003 | Schemas + `finance:write` scope + tool wiring     | `services/api` schemas/scopes/mcp/tools | W-002      | `finance-import-crud.test.ts`      | 3 tools callable, cross-user isolated                |
| W-004 | Full gate                                         | repo                                    | W-003      | `pnpm run check:all` (exit 0)      | Gate green                                           |

## Acceptance criteria

- [x] AC-001: Single upsert creates then re-upsert returns `created: false` with no duplicate row.
- [x] AC-002: Batch append of N rows then re-run returns `created: 0, updated: 0` (unchanged rows).
- [x] AC-003: `dryRun: true` writes nothing and reports per-row rejections.
- [x] AC-004: `mode: replace` (confirmation) wipes only the caller's finance transactions then inserts; refused, with nothing wiped, if any row would be rejected.
- [x] AC-005: Unknown account → `unknown_account`; currency mismatch → `currency_mismatch`; batch continues.
- [x] AC-006: `transfer` substring in description → `transfer`; otherwise sign rule (negative → debit, positive → credit, zero → adjustment).
- [x] AC-007: Unknown/blank category auto-creates (case-insensitive); `finance_categories` lists it.
- [x] AC-008: Cross-user isolation — id-scoped reads/writes as another user return not-found, never rows.
- [x] AC-009: `pnpm run check:all` green (exit 0: lint 17/17, build 17/17, typecheck 33/33, test 29/29).

## Evidence (2026-10-11, full repo `pnpm run check:all` exit 0)

- `packages/finance`: `finance.sheet-import.test.ts` 7/7 pass; `tsc -p tsconfig.json`
  clean; `oxlint`, `oxfmt --check` clean.
- `services/api`: `src/mcp` 27 files / 229 tests pass (incl. new
  `finance-import-crud.test.ts` 9/9); `tsc --noEmit` clean; `oxlint`,
  `oxfmt --check` clean on touched files.
- Full gate: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4433/hominem-test
  pnpm run check:all` → exit 0 (lint 17/17, build 17/17, typecheck 33/33, test 29/29,
  0 `error TS`).
- `bash scripts/check-task-frontmatter.sh` → OK (20 tasks).
- AC-008 covered for upsert account resolution (other-user account id →
  `unknown_account`); no id-scoped read tool was added in this phase.
- Implementation note: the thin service first lived in a new
  `services/api/src/application/finance-import.service.ts`, but that broke
  `apps/finance` + `apps/career` typechecks — they resolve `@hominem/api/types`
  to api source through stale pnpm `file:` copies that miss new files (and
  neither plain nor frozen `pnpm install` refreshes them). Merged the three
  functions into the existing `services/api/src/application/finance.service.ts`
  (one service per domain, per the `hominem-mcp-tool` skill) and synced the two
  changed files plus `packages/finance/build/sheet-import.*` into the stale
  `.pnpm` copies locally. Fresh checkouts are unaffected. If a future change
  adds new files under `services/api/src` and app typechecks fail with TS2307
  on a file that exists, suspect the same staleness — `rm -rf node_modules &&
  pnpm install` is the definitive local fix.

## Exit gate

Close only when all acceptance criteria are recorded with test evidence.
