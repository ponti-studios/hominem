---
title: 'Finance tools extension (operator spec)'
status: 'Proposed'
priority: 'high'
labels: [finance, mcp]
depends_on: []
blocks: []
estimated_size: 'L'
---

## Outcome

Build the MCP finance extensions specified in
[`docs/hominem-finance-tools-spec.md`](../hominem-finance-tools-spec.md), in the spec's
own build order, applying its §1 cross-cutting conventions (named errors, case-insensitive
identity, closed-entity parity, `dryRun`, idempotent retries, `structuredContent` parity) to
every new tool.

## Work sequence

- [x] §2 `finance_account_create` — unblocks the staged 1,712-row parked import.
- [x] §3 `finance_account_summary` — the reconciliation primitive.
- [x] §4 `finance_transaction_delete`.
- [x] §5 `orderNumber` read parity (schema fix, not a new tool).
- [x] §6 `finance_tag_rename` + `finance_tag_merge`.
- [x] §7 `finance_category_create` + `finance_category_merge`.
- [x] §8 transfer linking (`counterpartId`) — data model change.

## Notes and deviations

- §2: the spec's `institution` input resolves to `institution_id`
  (`app.finance_institutions`) rather than a text column — the denormalized
  `institution` column was dropped in
  `20260903010000_drop_finance_accounts_balance_and_institution.sql`.
- §2: `accountType` is not in the spec's input; an optional `accountType` input was added
  (default `checking`) after user confirmation — it changes liquidity treatment in
  `finance_runway`, whose liquid types are cash/checking/savings/depository.
- §3: counts and totals cover **every** row (pending and excluded included), matching the
  §9 ground truth exactly (14,486 rows; 1,335 excluded; 0 pending). The post-port store has
  **33** accounts: the 23 §9 rows carry transactions, and 10 accounts report zero. The tool
  returns one entry per account, so 33 entries (23 matching §9 + 10 zeros).
- §1.1: MCP input-validation failures (Zod schema rejections) now surface a named reason
  instead of the generic "Unable to complete the MCP tool request", which previously hid
  client input mistakes behind the same text as a server fault.
- §5: there is no `order_number` column — the write path folds it into `notes` as an
  `Order #: <value>` line (`combineNotes`), so read parity derives it back out
  (`extractOrderNumber`) for search and recent. All 9 production rows carry that exact form.
- §6: tags are owner-wide, not finance-only, so both tools require **both** `finance:write`
  and `tags:write` (a finance-scoped client can mutate tags other domains display). Merge
  deletes the emptied tag — its remaining assignments go via the ON DELETE CASCADE — and
  skips assignments the target already holds (the active-assignment unique index).
- §7: `finance_categories` has no unique index on (user_id, lower(name)); create resolves
  case-insensitively in code (no duplicates exist in production today — 74 categories).
  Merge keeps the emptied category in place (budgets reference categories).
- §8: `counterpart_id` landed as its own migration PR (#431) ahead of the code that reads it
  (expand/contract), applied to production via `deploy-db-migrations` after a verified
  `pg_dump`. A counterpart must already exist and sit on a **different** account
  (`invalid_counterpart` otherwise); a link is mirrored on both rows, re-pointing clears the
  old side, and `ON DELETE SET NULL` clears the surviving leg when one is deleted. Same-batch
  pairs must therefore be linked in a second call.
- §1.4 `dryRun`: implemented on §2, §7 and §8's mutating tools. **OPEN — USER DECISION
  REQUIRED:** whether to retro-fit `dryRun` to §4 delete and §6 rename/merge, which shipped
  without it.
