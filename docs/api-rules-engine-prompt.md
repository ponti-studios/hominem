# Prompt for the coding agent — classification rules at the API layer

```
Context: Hominem finance (MCP server at api.ponti.io) is becoming a
product: a user creates a Hominem account, connects it to their own
Muse, and gets the finance features Charles gets (reconciled
transactions, balances, categories/tags, spending answers grounded in
their real ledger). This spec moves CLASSIFICATION — deciding a
transaction's category and tags — from client-side procedure into the
API layer as deterministic, per-user configuration.

THE PROBLEM (verified live, 2026-10-16)
Classification today lives in the operator's (Wyatt's) local tooling
and memory, not in the system:
- A 415-entry merchant->category map (merchant_category_rules.json,
  sha256 34ce1ec7...f5096fad, operator-supplied seed — see ASK 5), three
  manual substring rules, a set of transfer/income regexes
  (classify_row), and a coffee-tag rule — all inside one local sync
  script (daily_txn_sync_hominem.py) that only the operator runs.
- One-off corrections are full-row upserts the operator performs by
  hand, under a full-resend discipline the server nowhere enforces or
  documents: on 2026-10-16 alone, 11 October cafe rows were moved to
  Dining Out, 9 rows were given a Coffee tag, and 1 cinema ticket was
  moved to Entertainment — 21 manual writes to produce numbers any
  client of this API should have been able to rely on the system for.
- Any other client connected to the same MCP (the user's own Muse in
  the product scenario) sees raw Uncategorized rows and none of this
  knowledge. Correctness currently depends on one agent remembering
  procedure. It fails SILENTLY: nothing errors, the data just degrades.

DESIGN PRINCIPLE — MECHANICS ARE UNIVERSAL, PREFERENCES ARE DATA
Nothing in this spec may hardcode Charles's (or anyone's) preferences
into server code or shared seed data. Three layers, kept separate:
1. MECHANICS (code, same for everyone): merchant-name normalisation,
   the matching engine, precedence, application points (ASK 2),
   case-insensitive identity (ASK 4). No merchant names, no category
   names, no tag names in this layer.
2. PERSONAL RULES (per-owner data): each user's rule set is THEIR
   configuration — their "Bible". Charles's coffee rule (coffee/tea
   shops are Dining Out + a Coffee tag) is a row in HIS rule set. It
   must not exist in anyone else's account unless they write it or
   adopt it. Rules resolve category/tag names against the OWNER'S OWN
   registry.
3. TEMPLATES (opt-in copies, optional in v1): a shareable rule pack
   (e.g. "coffee lens", "transfer/income row classes") that a user may
   adopt. Adopting COPIES the rules into the adopter's set, binding
   category/tag names to the adopter's registry (creating entries that
   don't exist, or mapping to ones that do). After adoption the copy is
   theirs: editing or deleting it affects no one else, and later
   template changes never propagate into adopted copies.

ASK 1 — A per-owner classification rule store, with MCP tools.
Data model (owner-scoped like every other finance entity):
  rule: { id, name, enabled, priority (int; lower runs first),
          match: { description: { mode: exact|contains|regex,
                                 pattern: string },
                   accountId?: uuid, amountSign?: debit|credit,
                   currencyCode?: string },
          action: { setCategory?: string, addTags?: string[] },
          note?: string }
Matching runs against the NORMALISED description. Normalisation is
mechanics and must reproduce the client's existing function exactly,
so seeded rules behave identically on day one:
  lowercase, strip, replace [^a-z0-9 ] with space, collapse whitespace.
Tools (all owner-scoped; names may follow existing conventions):
  finance_rules_list {}
  finance_rules_create { ...rule fields, dryRun? }
  finance_rules_update { ruleId, ...partial fields, dryRun? }
  finance_rules_delete { ruleId, iUnderstand: true }
  finance_rules_test { description, accountId?, amountCents?,
                       currencyCode? }
    -> the classification a hypothetical row would receive: winning
       rule per field + every rule that matched, in priority order.
       This is the debugging surface; it changes nothing.
Create/update validate: referenced category/tag names resolve against
the owner's registry (unknown category -> named error
unknown_category; do NOT auto-create silently — the operator or user
creates vocabulary explicitly); an invalid regex is rejected with the
pattern named; rule names are unique per owner, case-insensitive
(return-existing semantics on create, per the tools spec section 1.2).

ASK 2 — The server applies rules on every write path.
Both finance_transaction_upsert and finance_transactions_import apply
the owner's enabled rules server-side, on create AND on matched-row
update, in this exact order per field (category; tags):
  1. A value explicitly present in the write payload wins.
  2. Otherwise, the highest-priority matching rule that sets that
     field supplies it.
  3. Otherwise the field keeps its current value (on update) or its
     default (on create: Uncategorized / no tags).
Tags are additive under rules: a rule can only ADD its tags, never
remove tags another rule or a human set. Two rules setting different
categories: the higher-priority (lower number) wins; the loser does
not partially apply. Row-class rules (transfers/income detection) are
ordinary rules with high priority — there is no special-cased code
path for them.
Interaction with the 2026-10-15 capability prompt: if its ASK 1
(PATCH semantics) has landed, "explicitly present" means present in
the PATCH payload. If it has not, this ordering still applies — the
server fills blanks from rules AFTER applying the payload, which also
removes today's hazard where a matched-row re-import without a
category silently wipes a hand-set category.

ASK 3 — Retroactive application, safely.
  finance_rules_apply { from?, to?, accountId?, onlyUnfilled?: bool
                        (default true), dryRun?: bool (default true) }
Default mode is FILL-BLANKS ONLY: for category, only rows currently
Uncategorized (or with no category) are eligible; tags are only ever
added. A dry run returns per-rule match counts, the number of rows
that would change, and a sample of row ids per rule. A live run
returns the same counters for what it did. dryRun defaults to TRUE
for this tool — the blast radius justifies the deviation from the
other write tools.
Why fill-only is the safe default — the override case (verified live
2026-10-16): merchant "Everyman Media Group" has two October charges
on Charles's Starling account: GBP 23.90 is a cinema TICKET (hand-set
to Entertainment) and GBP 28.70 is food & drink (hand-set to Dining
Out). No merchant rule can express that split. Fill-only application
can never clobber either, because neither row is Uncategorized.
An explicit force mode (onlyUnfilled: false) may re-derive fields on
all matched rows; it must be opt-in per call, never the default.

ASK 4 — Case-insensitive identity for tags and categories, everywhere.
Bug (verified live 2026-10-16): a tag written as "coffee" is stored
with display name "Coffee". finance_transaction_search with
tag="coffee" then returns 0 rows; tag="Coffee" returns the correct
9 rows. finance_tag_breakdown's tag parameter has the same behaviour.
The tools spec (section 1.2) already mandates case-insensitive
identity with return-existing semantics for names unique per owner —
extend it to every READ filter that takes a tag or category name:
finance_transaction_search (tag, categoryName),
finance_tag_breakdown (tag), and rule matching/action resolution in
ASK 1. Display casing is first-write-wins; comparisons never are.

ASK 5 — Seed Charles's rule set from his client files; touch no one
else's account.
The operator supplies merchant_category_rules.json (415 entries,
sha256 34ce1ec73f7b1a7e8db76abdc2bb82f862503b352c5aabf1d5003f1045096fad)
plus the three small rule sets in the appendix below. Seed them as
ordinary per-owner rules in Charles's account ONLY: each merchant-map
entry becomes an exact-match rule (priority band 100); the manual
substring rules become contains rules (band 50); the row-class
patterns become high-priority rules (band 10: setCategory Transfers /
Income per the appendix logic, including the amountSign=credit
condition on the income patterns); the coffee substrings become one
contains rule per substring (band 100, action: addTags ["Coffee"],
no category action — the category comes from the merchant rules).
Seeding is itself an import with dryRun: report rules created /
skipped-as-duplicates; re-running the seed creates zero duplicates.

ASK 6 — Client decommission (the point of all of the above).
After ASK 5 passes acceptance, the daily sync stops sending category
and tags entirely — it transports raw rows and the server classifies.
Acceptance for this ask is a raw-write proof (below). The sync script
keeps transporting; it no longer contains classification knowledge.

ACCEPTANCE (the operator will verify live after deploy, on Charles's
account unless stated)
1. Rules CRUD round-trip: create a probe rule, list shows it, update
   changes it, delete (with iUnderstand) removes it; create with an
   unknown category is refused with unknown_category; a duplicate
   name in different casing returns the existing rule.
2. Test tool: finance_rules_test on description "Fuckoffee" returns
   category Dining Out and tag Coffee, naming the winning rules.
3. Ingest: a NEW synthetic Starling row for merchant "Chapter 72"
   written via finance_transaction_upsert with NO category and NO
   tags is stored as Dining Out + Coffee. The same row re-written
   with an explicit category "Groceries" keeps Groceries (payload
   wins) and still gains the Coffee tag.
4. Retroactive parity, October 2026, Charles's Starling/GBP rows —
   after seeding + a fill-mode finance_rules_apply over
   2026-10-01..2026-10-16, a dry run first: the resulting totals must
   equal today's hand-built ground truth EXACTLY:
     Dining Out GBP 176.88 / 14 rows
     Coffee tag GBP 69.33 / 9 rows (finance_tag_breakdown)
     Groceries GBP 47.85 / 3 rows
     Entertainment GBP 23.90 / 1 row (the Everyman override survives)
     Uncategorized GBP 149.47 / 6 rows
     October monthly invariant: 61 transactions, GBP expenses 1300.62
   (To measure this cleanly the operator will first reset the 21
   hand-set October rows to Uncategorized/untagged, then apply.)
5. Case-insensitivity: search tag="coffee" and tag="Coffee" return
   identical counts; the same holds for finance_tag_breakdown.
6. Multi-user isolation: a second owner with a rule mapping the same
   merchant ("Chapter 72") to a different category and a different
   tag gets THEIR result on their rows; Charles's rows, rules and
   totals are byte-identical before and after. Charles's coffee rule
   does not exist in the second owner's rule list.
7. Template adoption (if templates are built in v1): the second owner
   adopts the coffee-lens pack; the rules appear in THEIR list as
   copies bound to their registry; Charles then edits his original —
   the adopter's copies do not change.
8. Decommission proof: a raw import (finance_transactions_import) of a
   new "Fuckoffee" row carrying no category/tags lands as Dining Out
   + Coffee with zero client-side classification.

OUT OF SCOPE — do not change: the delete tool's iUnderstand contract;
natural-key create behaviour when externalId is absent; currency
validation and per-account allowedCurrencies (the B13 fix); anything
in the 2026-10-15 capability prompt (PATCH semantics, mutable
transactionType, move operation, stable externalId, strict nested key
validation, notes verbatim, deterministic search) — those asks stand
as filed; this spec builds beside them, not over them. Do not seed,
suggest, or default ANY user's rules from another user's rule set.

APPENDIX — Charles's small rule sets (seed material for ASK 5; these
are HIS preferences, stored as HIS data, never as code defaults)
Manual category substrings (contains, band 50):
  medivet -> Pet; kaiser -> Healthcare;
  transportation train -> Public
Coffee tag substrings (contains, Dining Out rows only, band 100,
addTags ["Coffee"]): coffee; chapter 72; city baristas; luckytea;
  starbucks; fuckoffee
Row-class patterns (band 10; regexes match the normalised
description; setCategory as shown):
  Transfers: amex epayment; apple ?card|gsbank; withdrawal (to|from);
    ^deposit from; capital one.*(pymt|payment|online);
    mobile pymt|mobile payment|autopay; bill payment;
    transfer (->|to|from)\b; internet transfer; to gbp added|from gbp;
    ach credit returned|returned payment|payment returned;
    exact-match descriptions wise inc | wise us inc | wise | wise ltd
    (when the account is not a Wise account) -> Transfers;
    exact-match charles ponti | charles ponti sent | capital one
    -> Transfers
  Income (only when amountSign=credit): description contains
    "interest" or "peterson enterpr" -> Income; contains "cash back"
    or "cashback", or starts with "cash app" -> Income
  (Client provenance: classify_row in daily_txn_sync_hominem.py,
  validated 2026-10-15 against the prior 30 days: 23 agreements,
  0 conflicts.)
```
