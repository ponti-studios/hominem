# Finance sheet → Hominem daily push

VM-side runbook for the Phase 4 delta sync. The sheet is the system of
record; Hominem is a read mirror. One direction: sheet → Hominem.

## Push step (`hominem_push.py`, new, thin)

Runs after `daily_txn_sync.py` commits the sheet append, on the VM that
already holds the bank credentials and the `custom.ponti-api` connector.
No new credentials. The sheet ID is config, not a secret.

1. Take the in-memory `new_rows` from the sync (already deduped by the
   sheet's own `existing_keys()`).
2. Re-read the trailing 14 days of the Transactions tab so sheet-side edits
   (category corrections, notes) flow downstream. Upsert idempotency makes
   the re-push free. Sheet-side deletes do not flow (no delete tool in v1).
3. Map each row with the column contract in `parseSheetTransactionsCsv`
   (`packages/finance/src/sheet-csv.ts`): accounting amounts, TRUE/FALSE
   flags, comma tags, Order # into notes.
4. Call `finance_transactions_import` with `mode: "append"` (never
   `"replace"` here), the checked-in account map, and
   `multiCurrencyAccounts: ["Amex Platinum …4009"]`.
5. On push failure: log loudly (row counts, batch index, tool error) but
   never block or roll back the sheet write. Re-push any morning by
   re-running over the trailing window.

## Backfill (one-time, before the daily push goes live)

1. `ensureSheetAccounts` (6 creates, 3 historical flips, 1 Starling
   currency fix) against live `finance_accounts`.
2. Full dry run over all ~16,424 rows: expect zero rejections.
3. Clean dry run arms one `mode: "replace"` call, which additionally
   requires `iUnderstand: true`. Batches of 1000 (≈17 calls), fail fast
   on the first throwing batch, resume by re-running.
4. Verify with the §14 comparators (`sheet-verify.ts`): exact row count,
   monthly income/expense/net within $0.01, top-category set equality,
   tag total within $0.01. Re-run yields `created: 0, updated: 0`.

## Soak check (7 consecutive clean mornings)

Every morning Hominem count == sheet count. Any drift: re-push the
trailing 14 days; idempotency absorbs it.
