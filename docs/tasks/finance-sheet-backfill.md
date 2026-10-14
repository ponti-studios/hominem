---
title: 'Finance sheet backfill, verification, and daily push'
status: 'Implemented'
priority: 'high'
labels: [finance, mcp]
depends_on: [finance-sheet-import.md]
blocks: []
estimated_size: 'L'
---

## Outcome

The full 13-year sheet history (~16.4k rows, 17 batches) backfills idempotently
with zero dry-run rejections, §14 verification passes, and the VM daily push
step is specified, tested, and documented. Fail fast on first bad batch;
re-run idempotently to resume. No checkpointing.

## Decisions (all 14 resolved 2026-10-11, from live-data analysis)

- Backfill: full 13 years. No checkpointing — fail fast, resume by re-run.
- Dry run: zero rejections, no allowlist.
- Replace safety: both guards — refuse `replace` unless a dry run passed in the
  same session (server-side per-user flag, consumed on replace), plus explicit
  `iUnderstand: true`.
- Pending rows: reject loudly (`pending_row`). No pending state in v1.
- Identity: personal account (`ownerUserId` of the caller).
- Tags: plain names, no namespacing.
- Transfers: description contains `transfer`; autopays excluded.
- Multi-currency: strict `currency_mismatch` stands, with a one-account
  allowlist (a label declared as multi-currency) via `multiCurrencyAccounts`.
- Accounts: most labels map directly; the rest are created or flipped
  (a historical money-market account, an open savings account, a GBP account,
  a historical high-yield savings account, a legacy 2017 account kept
  USD-as-is, and a quarantined catch-all), with the legacy account's currency
  fixed USD → GBP.
- The sheet's generic "Savings" label (micro-deposit rows) is unidentifiable —
  quarantined as a historical account, remappable later. Never misattributed.
- The legacy 2017 account's rows say USD (Copilot quirk) — preserved as-is
  against a USD historical account, never "corrected" into a mismatch.

## Scope

In scope: sheet CSV parser (cols A–L), replace guards, `pending_row`,
`multiCurrencyAccounts`, 28-label map template + validator, account
ensure/flip/fix, backfill runner (chunk 1000, fail-fast, aggregate),
§14 verification comparators, daily-push payload + VM reference script.
Out of scope: executing the real backfill (needs live store + filled map),
the VM-side wiring itself, the 7-day soak observation.

## Work sequence

| ID    | Work item                                           | Owner boundary            | Depends on | Validation / artifact    | Done when                                        |
| ----- | --------------------------------------------------- | ------------------------- | ---------- | ------------------------ | ------------------------------------------------ |
| W-101 | Sheet CSV parser (A–L → payload)                    | `packages/finance`        | —          | `finance.sheet-csv`      | Accounting amounts, TRUE/FALSE, blanks covered   |
| W-102 | Replace guards + `pending_row` + allowlist          | `packages/finance` + api  | —          | import crud tests        | Guard matrix green, allowlist bypass scoped      |
| W-103 | 28-label map template + validator + ensure/flip/fix | `packages/finance`        | —          | `finance.sheet-accounts` | Gaps listed, specs validated, mutations scoped   |
| W-104 | Backfill runner (chunk/fail-fast/aggregate)         | `packages/finance`        | W-101      | `finance.backfill`       | Re-indexed rejections, resume-by-rerun proven    |
| W-105 | §14 verification comparators                        | `packages/finance`        | W-104      | `finance.verify`         | Count/monthly/category/tag checks with tolerance |
| W-106 | Daily push payload + VM reference script            | `packages/finance` + docs | W-101      | push tests + script doc  | Trailing-14-day re-push mapped, failures loud    |
| W-107 | Full gate                                           | repo                      | W-101–106  | `pnpm run check:all`     | Gate green                                       |

## Acceptance criteria

- [x] AC-101: CSV parser handles accounting amounts, comma tags, TRUE/FALSE, blanks, Order # → notes.
- [x] AC-102: `replace` without `iUnderstand: true` fails; without a prior session dry run fails; second `replace` without a fresh dry run fails.
- [x] AC-103: `pending: true` rows reject with `pending_row`, batch continues.
- [x] AC-104: Allowlisted account accepts either currency; non-allowlisted rejects mismatch.
- [x] AC-105: Map validator lists every gap (unmapped label, missing create-spec field, unknown flip target).
- [x] AC-106: Ensure creates the missing accounts with specified lifecycle/currency, flips the historical ones, fixes the legacy account currency — all owner-scoped, idempotent on re-run.
- [x] AC-107: Runner chunks at 1000, stops on first throwing batch, aggregates counts, re-indexes rejections; resume by re-run yields created: 0.
- [x] AC-108: Comparators verify count equality, monthly income/expense/net within $0.01, top-category and tag totals.
- [x] AC-109: Push payload covers appended + trailing-14-day rows; VM script never blocks the sheet write on push failure.
- [x] AC-110: `pnpm run check:all` green.

## Evidence (2026-10-11, full repo `pnpm run check:all` exit 0)

- TDD red→green per module: `finance.sheet-csv` (5), `finance-import-guards`
  (7), `finance.sheet-accounts` (8), `finance.backfill` (3), `finance.verify`
  (4), `finance.push` (3). Package suite 98/98; api `src/mcp` 28 files /
  236 tests.
- Full gate exit 0: lint 17/17, build 17/17, typecheck 33/33, test 29/29,
  0 `error TS`.
- VM runbook: `docs/finance.sheet-sync.md` (AC-109 procedure; the VM-side
  edit + 7-day soak remain user-side work).
- Env note: pnpm `file:` copies under `node_modules/.pnpm` go stale on new
  files (neither plain nor frozen install refreshes them); changed/new files
  were synced into the 7 `@hominem/api` + 1 `@hominem/finance-services`
  copies locally. Fresh checkouts are unaffected.

## Exit gate

Close only when all acceptance criteria are recorded with test evidence. The
live backfill execution, VM wiring, and 7-day soak remain user-side work.
