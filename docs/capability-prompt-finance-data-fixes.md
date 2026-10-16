# Prompt for the coding agent — finance data-repair capabilities

```
Context: Hominem finance (MCP server at api.ponti.io). The operator (Wyatt)
maintains Charles's ledger: a full history port from the retired finance
sheet (Oct 13), a daily Plaid/Starling sync, balance normalization plugs
anchoring every active account to its real balance, and an ongoing
data-repair programme (Uncategorized remediation, misfiled-row recovery).
Full defect evidence is in finance-import/bug-log.md (B14, B15); everything
needed is also below. The asks are in priority order: 1 and 2 block
repairs that are scheduled; 3 and 4 make the scheduled repairs safe and
permanent; 5–7 are hardening with live incidents behind them.

 ASK 1 — PATCH semantics on update (bug-log B15). HIGHEST PRIORITY.
Today finance_transaction_upsert, and the matched-row path of
finance_transactions_import, REPLACE the stored row: any field absent
from the payload is reset to its default. Verified live 2026-10-15 with a
controlled probe (a row with every field populated, then a partial
upsert): tags -> [], notes -> null, orderNumber -> null, excluded
true -> false, recurring true -> false. Realized damage: the daily
sync's counterpart-linking pass upserted 42 rows with a partial payload
and silently un-excluded 17 transfer legs (repaired same day from ground
truth; the sync now resends full rows as a workaround — a discipline any
future client can violate unknowingly). A matched-row re-import without
a category can likewise wipe a category set by hand.
FIX: on update (matched row), preserve fields the payload omits; apply
fields the payload includes (explicit null/empty clears, as today).
Create behavior is unchanged. ACCEPTANCE: for a fully-populated test
row, a partial upsert sending only {identity fields + category} leaves
every other field byte-identical; the same holds for a matched row via
import; an explicit empty tags array still clears tags.

 ASK 2 — transactionType mutable on update (bug-log B14).
On a matched row, neither write path applies a transactionType change:
full-row and minimal upserts return success (created: false) while the
stored type persists (verified 2026-10-15, three attempts, debit stayed
debit). Consequence: 407 historical movement rows carry the category
"Transfers" but keep debit/credit types, and the analytics tools'
non-transfer filters key on type — so the ledger cannot be made
self-consistent from the client side.
FIX: allow transactionType to change on update, at minimum transitions
to and from "transfer". Keep creation-time inference as is.
ACCEPTANCE: upserting an existing debit row with transactionType
"transfer" persists; finance_spending_by_category then excludes it;
changing it back restores it.

 ASK 3 — Move a transaction to another account without delete+recreate.
Recovered-misfiled-row repair currently means: recreate the row on the
right account (new id, new createdAt), then delete the original. Any
counterpart link on the original would be severed. On 2026-10-15 this
was done for 41 Apple Card rows recovered from the "Unattributed -
Copilot legacy" account; ~306 further rows in that account (Capital
One / American Express payment legs) await the same repair.
FIX: a dedicated operation (e.g. finance_transaction_move {ids,
toAccount}) that changes accountId while preserving the row id and
every field; counterpartId references to a moved row must keep
resolving (and the mirror row's pointer must stay correct); refuse the
move when the target account's allowedCurrencies exclude the row's
currency (currency_mismatch, consistent with the write paths).
ACCEPTANCE: moving a linked, tagged, excluded row yields the same id
with all fields intact on the new account, the mirror still resolves,
and account summaries shift by exactly the moved sums.

 ASK 4 — A stable external id for deduplication.
Identity is the natural key (account, date, description, merchant,
amount, currency). Genuinely distinct transactions that share it are
merged and lost: 6 Apple Savings round-up deposits ($1.26) in the
2026-10-15 Copilot gap-fill, 13 Apple Card rows in the same day's
repair, and ~230 in the original sheet port. Meanwhile the daily sync
discards Plaid's transaction_id, a stable id the source already
provides.
FIX: accept an optional externalId on write rows (upsert + import
items); unique per (user, account, source); when present, identity is
the externalId (a re-import updates the same row even if description or
amount was corrected upstream); when absent, today's natural-key
behavior is unchanged. Expose externalId in the read model.
ACCEPTANCE: importing two rows that share the full natural key but
carry different externalIds creates two rows; re-importing the same
batch creates zero; a row re-imported with the same externalId and a
corrected amount updates in place.

 ASK 5 — Strict key validation inside import items (B11 parity).
Top-level unknown params hard-error since the B11 fix, but unknown keys
INSIDE finance_transactions_import items are silently stripped.
Verified 2026-10-15: items sent with "categoryName" (the write-schema
key is "category") reported updated: 1 while changing nothing — a
silent no-op indistinguishable from success in the result object.
FIX: an item carrying an undeclared key is rejected per-item (existing
rejected[] mechanics) with the offending key named. ACCEPTANCE: the
categoryName payload above yields a rejection naming the key; valid
items in the same batch still import.

 ASK 6 — Stop mutating notes in the read model.
When a row has an orderNumber, reads return its notes with
"\nOrder #: X" appended (verified 2026-10-15 on the B15 probe row).
orderNumber is already a first-class field; clients that resend
read-model notes (the correct full-resend discipline under today's
replace semantics) bake the suffix into stored notes permanently, once
per write. The sync's linker now strips the suffix defensively.
FIX: return notes verbatim as stored. ACCEPTANCE: a row written with
notes "N" and an orderNumber reads back notes exactly "N".

 ASK 7 — Deterministic, filterable search for audits.
finance_transaction_search caps limit at 50 and its ordering is not a
stable total order: over tied createdAt values, offset paging can
repeat or skip rows (observed during the Oct 14 ops checklist; every
audit since has paged whole accounts and deduped by id client-side —
a 2,003-row account costs 41 calls). There are also no category/type
filters, so class-wide questions require full scans.
FIX: stable ordering (postedOn, then id as tiebreak) guaranteed across
pages, plus optional filters categoryName and transactionType.
ACCEPTANCE: paging a >2,000-row account at limit 50 returns every row
exactly once, in the same order across repeated runs; a category
filter's filteredCount equals a client-side count over the full dump.

OUT OF SCOPE — do not change: the delete tool's confirmation contract
(iUnderstand); natural-key create behavior when externalId is absent;
currency validation and per-account allowedCurrencies (the B13 fix);
the accountsAutoProvisioned behavior of import.
```
