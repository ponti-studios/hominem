# Hominem Finance Tools — Extension Spec

**Author:** the operator, for the coding agent · **Date:** 2026-10-13
**Status:** Ready to build · **Scope:** MCP finance domain at api.ponti.io
**Evidence base:** the 2026-10-13 finance port (16,426 sheet rows → 14,486
reconciled transactions) and bug log B1–B6 (`finance-import/bug-log.md`).

Every item below exists because a concrete operation on 2026-10-13 was
impossible, unverifiable, or absurdly expensive without it. Acceptance tests
are live and runnable by the operator against production data; §9 ships with
ground-truth numbers from the completed reconciliation.

---

## 0. Verified current state (do not re-litigate)

- 13 finance tools exist: `finance_accounts`, `finance_budget_breakdown`,
  `finance_categories` (list-only, no inputs), `finance_monthly_stats`,
  `finance_net_worth`, `finance_recent_transactions`,
  `finance_runway`, `finance_spending_by_category`, `finance_tag_breakdown`,
  `finance_top_merchants`, `finance_transaction_search`,
  `finance_transaction_upsert`, `finance_transactions_import`.
- Generic tag plumbing exists (`entity_tags`, `tag_entity`, `untag_entity`)
  but there is no tag rename/merge anywhere.
- Transaction write DTO (upsert + import item) fields: `postedOn, account,
  description, amountCents, currencyCode, category, tags, notes, orderNumber,
  source, excluded, recurring, transactionType, pending`.
- Transaction read model (search/recent) fields: `id, accountId, accountName,
  postedOn, description, merchantName, amountCents, currencyCode,
  transactionType, categoryId, categoryName, tags, notes, source, recurring,
  pending, excluded`. **Note: `orderNumber` is accepted on write and absent
  on read — verified live 2026-10-13 (§5).**
- `finance_transaction_search` caps `limit` at 50.
- `finance_accounts` hides closed accounts unless `includeClosed: true`
  (this default caused a false "account doesn't exist" report during the
  port — see §1.3 for the parity rule).
- Natural key for transaction upsert: `(postedOn, accountId, description,
  amountCents, currencyCode)`. Upserts are idempotent; import batches are
  safe to re-run.
- Transaction currency validation is account-scoped: rows must match
  `currencyCode` or an account's stored `allowedCurrencies`; callers cannot
  grant themselves currency exemptions. The account currency is included in
  the effective list returned by account tools. Starling Bank is GBP, and
  American Express Platinum permits USD and GBP.
- `finance_transaction_upsert` accepts all persisted transaction types,
  including `adjustment`.

## 1. Cross-cutting conventions (apply to every tool in this spec)

1. **Named errors, never opaque 500s.** Every rejection carries a stable
   machine-readable `reason` (the import's per-row `reason` field is the
   model: `unknown_account`, …). A service exception that reaches the MCP
   layer as "Unable to complete the MCP tool request" is a spec violation —
   this failure mode hid B1, B5's residue, and B6's root cause from the
   operator for hours.
2. **Case-insensitive identity with return-existing semantics.** Names that
   are unique per owner (accounts, tags, categories) resolve
   case-insensitively; a create that matches an existing entity returns it
   with `created: false` instead of erroring or duplicating (the PR #426 tag
   pattern, generalized).
3. **Closed-entity visibility parity.** Any list/summary tool either includes
   closed entities or takes `includeClosed` — and read paths that other
   tools' results feed into must not silently disagree about what exists.
4. **`dryRun` on every mutating tool**, projecting the same counters the real
   call returns (the import's post-B3 behavior is the model).
5. **Idempotent retries.** Repeating any call with identical arguments has
   the same effect as calling it once; counters distinguish `created` /
   `updated` / no-change so an operator can verify convergence.
6. **structuredContent parity.** The structured result and the text body
   carry the same payload (several tools still return text-only JSON; the
   operator's clienting depends on structuredContent).

## 2. `finance_account_create` — Tier 1, build first

**Problem.** No client path can provision an account: the import rejects
unknown accounts and `accountsAutoProvisioned` never fires for an external
MCP client (probed 2026-10-13). 1,712 staged historical rows wait on four
accounts; the daily provider sync will keep surfacing new accounts
(it already stages rows for an institution it cannot create).

**Input**

| field               | type                  | req | notes                                                                           |
| ------------------- | --------------------- | --- | ------------------------------------------------------------------------------- |
| `name`              | string                | ✓   | display name, non-empty                                                         |
| `currencyCode`      | string                | ✓   | ISO 4217                                                                        |
| `allowedCurrencies` | string[]              |     | additional accepted transaction currencies; primary currency is always included |
| `institution`       | string                |     | e.g. "Acme Bank"                                                                |
| `accountNumber`     | string                |     | mask/last digits as displayed elsewhere                                         |
| `status`            | enum `open`\|`closed` |     | default `open`                                                                  |

**Behavior.** §1.2 applies (open and closed accounts both match). Returns
`{ id, name, currencyCode, allowedCurrencies, status, created }`.

**Errors.** `invalid_currency`, `invalid_name` — named, per §1.1.

**Acceptance (live).** (a) Create the four parked accounts named in the
parked-rows register (one GBP, one legacy, one savings, one catch-all) →
all `created: true`. (b) Re-create one with different casing →
`created: false`, same id. (c) The four appear in
`finance_accounts` (closed ones under `includeClosed`). (d) The staged
1,712-row parked pack imports with zero `unknown_account` rejections.

## 3. `finance_account_summary` — Tier 1

**Problem.** Reconciliation — the acceptance ritual for every import — has
no primitive. Verifying the port required ~300 search calls at the 50-row
cap, paging 14,486 transactions out to add them up client-side (~10 min).

**Input.** `accountId` (string, optional — omit for all accounts),
`includeClosed` (bool, default true for this tool: reconciliation must see
everything).

**Result.** One entry per account:
`{ accountId, accountName, allowedCurrencies, status, transactionCount, excludedCount,
totals: [{ currencyCode, sumCents }], minPostedOn, maxPostedOn }`.
Totals are grouped **by currency** — a single mixed-currency sum is
arithmetically meaningless and must not be the only output.

**Acceptance (live).** Run with no `accountId` against the post-port store:
per-account counts must equal the ground truth in §9 exactly (23 accounts,
14,486 total), and each account's grouped totals must sum to the §9 figure.

## 4. `finance_transaction_delete` — Tier 1

**Problem.** There is no way to remove a transaction. Test/synthetic rows
written during B1/B6 bug-hunting could only be eliminated by a full
replace (purge + reimport of everything). One bad row from the daily sync
currently has the same cure. That is not an operating model for a system
of record.

**Input.** `ids` (string[], 1–200), `iUnderstand` (bool, required true) —
the replace-mode guard pattern; no elicitation (B5's lesson: the flag is
the contract, the server must not ask again).

**Behavior.** Hard delete by id. Returns
`{ deleted: [{ id, postedOn, accountId, description, amountCents,
currencyCode }], notFound: [ids] }` — the deleted-row snapshot is the
operator's audit record. Deleting a transaction that is one leg of a
linked transfer (§8) clears the counterpart's link.

**Errors.** Missing/false `iUnderstand` → `confirmation_required`.
Unknown ids are reported in `notFound`, never fatal.

**Acceptance (live).** (a) Upsert a synthetic row, delete it, search
returns 0 for it, `finance_account_summary` count decremented by 1.
(b) Delete without `iUnderstand` → named refusal, row intact.
(c) Re-delete the same id → `notFound`, no error.

## 5. `orderNumber` read parity — Tier 2 (schema fix, not a new tool)

**Problem.** `orderNumber` is in the write DTO but absent from every read
model — a write-only field (B2 class). Verified live 2026-10-13: upsert
with `orderNumber` succeeds (`created: false` on the existing row); the
subsequent search returns 17 fields, none of them `orderNumber`.
The owner's standing data rule is a transaction → order → item chain; the
chain is unverifiable while the field can't be read back. Scope is small
(9 sheet rows carry order numbers) but the fix is smaller.

**Change.** Add `orderNumber` to the transaction read DTO everywhere it
is returned (search, recent, and any by-id read).

**Acceptance (live).** Repeat tonight's probe: upsert the target row
with its order numbers → search returns
the row **with** `orderNumber` equal to what was written. The operator then
populates the remaining 8 rows and verifies each.

## 6. `finance_tag_rename` + `finance_tag_merge` — Tier 2

**Problem.** Tags are user-facing vocabulary with no maintenance path:
the port left a lowercase `art` tag (12+ assignments) that can only be
re-cased by direct database edits. Generic entity tag tools exist
(`entity_tags`, `tag_entity`, `untag_entity`); rename/merge exist nowhere.

**Input (rename).** `from` (string), `to` (string).
**Input (merge).** `from` (string), `into` (string).
Names resolve case-insensitively (§1.2).

**Behavior.** Rename changes the tag's display name, preserving its id and
all assignments; if `to` already exists as a different tag, rename refuses
with `target_exists` (that's what merge is for). Merge moves all
assignments from `from` to `into`, then removes the emptied tag. Both
return `{ assignmentsMoved, tag: { id, name } }`. Operating on a
nonexistent tag → `unknown_tag`.

**Acceptance (live).** Rename `art` → `Art`: `finance_tag_breakdown` and
search read-backs show `Art`; assignment count unchanged (12 from the
port's re-upsert, plus any the daily flow added); exactly one art-ish tag
exists afterwards.

## 7. `finance_category_create` + `finance_category_merge` — Tier 3

**Problem.** `finance_categories` is list-only (74 categories). The port
had to collapse blank and junk source values into `Uncategorized` because
no correct bucket could be created, and a wrong category can never be
folded into a right one.

**Input (create).** `name` (string). §1.2 applies.
**Input (merge).** `from` (name or id), `into` (name or id).

**Behavior.** Merge reassigns all transactions from `from` to `into` and
returns `{ transactionsReassigned }`; the emptied category remains but
unused (no destructive delete — mirrors §4's caution, categories are
referenced by budgets). `Uncategorized` may be a merge **target**, never
a merge source (refuse with `protected_category`).

**Acceptance (live).** Create a probe category → `created: true`; re-create
with different casing → `created: false`. Merge probe into `Uncategorized`
→ reassigned count matches a pre-merge search count for the probe.

## 8. Transfer linking (`counterpartId`) — Tier 3 (data model)

**Problem.** Transfers between the owner's own accounts are two unlinked
rows. A transfer identification hinged on one description
happening to name its destination ("Transfer -> <account>"); nothing
in the data model records the pairing, so any cross-account aggregation
double-counts internal movement (cf. `finance_net_worth`).

**Change.** Add nullable `counterpartId` to the transaction write DTO
(upsert + import item) and to all read models. Semantics:

- Setting `counterpartId` on row A pointing at row B mirrors the link on B.
- Re-pointing or nulling updates both sides symmetrically.
- Deleting a row (§4) clears the link on its counterpart.
- The target must exist and belong to a different account; violations →
  `invalid_counterpart`.
- **No auto-detection in v1.** Pairing heuristics are a client concern
  (the operator proved the manual workflow tonight); the model's job is
  to hold the link once known.

**Acceptance (live).** Link a real pair — the two legs of a dated internal
transfer (one on each account) — read both back, link
present on both sides; delete-probe on a synthetic pair clears the
survivor's link.

## 9. Appendix — reconciliation ground truth

Verified by full enumeration after the backfill. §3's acceptance compares against it:
per-account counts must match, and each account's grouped totals must sum to the same figure.

**The table itself is deliberately not committed.** It is the owner's per-account transaction
counts and sums — personal financial data — so it lives outside the repository. Regenerate it
at acceptance time by running `finance_account_summary` with no `accountId` against the
post-port store and comparing per-account `transactionCount` and `totals` against the same
figures read directly from the database. The store held **14,486** transactions on 2026-10-13;
that total is the invariant §3 must reproduce.

## 10. Build order & non-goals

**Order:** §2 (unblocks the staged 1,712-row import) → §3 (makes every
later acceptance cheap) → §4 → §5 → §6 → §7 → §8.

**Non-goals:** account delete/merge (destructive, no current need);
automatic transfer detection (v1 stores links, clients propose them);
raising the search `limit` cap (superseded by §3 for reconciliation;
fine to raise independently if trivial); any change to natural-key or
import semantics.
