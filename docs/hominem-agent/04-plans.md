# Hominem — active plans and deferred work

Status as of the TypeScript conversion (`4249add`). Order matters: each
item names its blocker, so nothing waits silently.

## Next, in order

### 1. End-to-end proof (ROADMAP P7) — ✅ done 2026-11-22

Transcript in [`e2e/proof.md`](../e2e/proof.md). The proof found and
fixed four problems: the `-c` flag, unaudited brain MCP calls, unclosed
runs, and a non-idempotent `remember`; see the problems doc. Open item:
Charles to decide whether the paraphrased duplicate memory
`1929a303…` is forgotten. The original plan:


One live conversation exercising the whole spine, transcript committed as
`e2e/proof.md`:
1. `hominem remember "..."` — a durable fact through `seme_save`.
2. `hominem recall "..."` — read it back from seme in a fresh session.
3. One gws/linear mock or live call with its `events` row verified by
   query.
Acceptance: memory survives sessions; every external call visible in
`~/.hominem/agent.db`.

### 2. Hominem MCP unblock — ✅ unblocked 2026-11-22 (dev; prod still gated)

Charles chose dev-first. The hominem dev API (worktree
`feature/finance-sync-doctrine`, port 4538 behind portless
`https://finance-sync-doctrine.api.lvh.me`) came up, an MCP token was
minted for the dev test account into `~/.hominem/env` (with
`NODE_EXTRA_CA_CERTS` pinning the portless CA), and the whole wealth
spine ran live the same day — seed → sync → integrity → brief →
look → close → balances, runs 17–25 all ok, every call an events
row. Still open: the production seed (same `hominem wealth-seed`
command, prod token + machine-local doctrine file; Charles decides
when), `pi mcp login hominem` for her own brain, and the Hominem PR
for `feature/finance-sync-doctrine`.

### 3. Memory routine, properly (ROADMAP P4) — ✅ done 2026-11-22

`systems/memory/reflect.ts` plus the launcher's `reflect` mode
(`hominem reflect < transcript`). Her brain extracts the session's durable
facts as JSONL (judgment only, no tool calls); the deterministic routine
upserts them through the seme MCP stdio server. Dedup gate over two
anchors — `seme_recall`'s results plus a recent-window
`seme_list_memories` call per run — after the live re-run proof showed
recall's top-N can miss a stored near-dup (dice 0.714, never returned).
Saves are verbatim with a read-back verify; close variants are flagged
as conflicts and never written; `seme_correct`/`seme_forget` have no
path in it. Doctrine carried from the archived memory-mirror: Charles's
edits are authoritative, conflicts get eyes, never delete on
disappearance. Live-proven: new fact saved + verified; exact dup
ALREADY; rewording CONFLICT; a same-conversation re-run wrote zero
duplicate rows (seme's own ingest resolver had already converged the
earlier wordings — supersede chain read back from
`~/.hominem/memory.db`). 51 tests green.

### 4. wealth-manager port (ROADMAP P4) — 🟨 sync + Layers 1–4 + live balances done; hominem-backed live runs pending

The crown jewels of the archive: Starling+Plaid → hominem txn sync
(idempotent natural-key upserts, state-anchored windows), then the four
finance-agent layers (integrity / brief / forward look / close).
**Charles's ruling (2026-11-22): the Hominem repo holds no personal
financial data** — accounts, routing and doctrine resolve from
hominem at runtime, and hominem gained the features the sync needs
(`feature/finance-sync-doctrine`, commit `91e749e19`, gate green):

- `app.finance_sync_doctrine` — the deterministic ingest doctrine
  (ordered merchant/tag/amount rules, transfer/income detection, coffee
  patterns, tag lenses) as one fingerprinted row per user behind
  `finance_doctrine_get` / `finance_doctrine_import`.
- provider identity on `app.finance_accounts` — `(provider,
  provider_account_id)` unique per user; Starling routes by UID,
  Plaid-fed accounts by mask; identity-first create, a name match never
  stamps, update owns the identity with named refusals.
- Dev DB seeded through the service layer and read-back verified
  (fingerprint idempotency, 54/33/2/7/5/8/7 rules, 245 lens matches,
  11 routing identities); seed script + inputs stay machine-local in
  `~/.hominem/wealth/seed/`, never committed.

Hominem side, code-complete mocked-first:
`systems/wealth-manager/{env,types,starling,plaid,hominem,categorize,daily_sync}.ts`
plus the `hominem wealth-sync` launcher mode (repo-root `.env` sourced
with `set -a`; real env wins). The doctrine-driven rework landed
2026-11-22: `daily_sync.ts` resolves the account registry and the
doctrine from hominem at runtime (`finance_accounts`,
`finance_doctrine_get`, each an audited call) and routes rows by
identity — Starling by (provider, providerAccountId), Plaid by mask;
unknown or ambiguous identities are held out with a named reason and
banked in pending_unmapped.json, never guessed. `categorize.ts` is a
pure doctrine engine with hominem's match modes (exact for transfer
rules, contains for the rest; engine order law: row-class detection
before categorization, amounts before merchants, first-match-wins),
and the personal-data files (`accounts.ts`,
`subcategory_lenses.ts`) are deleted — this repo holds none. Tests
are synthetic-only: three fake backends prove windows, identity
routing, doctrine categorization, holdout, idempotent re-runs, loud
rejections and the B15 full-row transfer link (65/65 green,
typecheck clean).
**Blockers, named:** the live run only happens with Charles present;
hominem dev services are down + `pi mcp login hominem` is outstanding;
the prod seed waits on the same plus the db backup/approval gate.
**Honest loss:** the archived exact-merchant layer (425 rules in
`merchant_category_rules.json`) was never salvaged — unmatched rows
queue for rulings, never guessed.

**Layer 1 landed 2026-11-22 (same doctrine, mocked-proven):**
`systems/wealth-manager/integrity_check.ts` + the `hominem
wealth-integrity` launcher mode. Six read-only checks after the sync —
feed health, Plaid balance drift (ledger vs feed with the gap window,
the 2026-10-28 Amex lesson carried), Starling window reconciliation
(generalized to every Starling account by identity — the archive
checked the one account its label map knew), manual-anchor freshness,
cancellation watches, statement payment verification (per-credential
liabilities reads, the Wise NO_LIABILITY_ACCOUNTS skip carried).
Prints `{ok, flags, info}`; empty flags is a quiet day. Personal
inputs are machine-local (`manual_anchors.json`,
`cancellation_watches.json` under `$HOMINEM_AGENT_WEALTH_DIR`) — absent means
the check skips with a named note. An unset optional leg (PLAID_CLI,
STARLING_API_TOKEN) degrades exactly its checks to named info notes; a
missing hominem token fails the run by name. `plaid.ts` grew the
shared `plaidCommand` bridge (accounts / liabilities /
transactions-get), `hominem.ts` gained `finance_account_summary`,
`finance_net_worth` and a typed `finance_transaction_search` (with the
archived recursive window split for >50-row windows). 12 synthetic
tests, full suite 77/77, typecheck clean.

**Layer 2 landed 2026-11-22 (Hominem-only reads, mocked-proven):**
`systems/wealth-manager/morning_brief.ts` + the `hominem wealth-brief`
launcher mode (WYA-228). The exception-led brief reads Hominem only —
Plaid ingest-only, verbatim — and prints
`{ok, date, sections, silent, run_id}`. money_in_out is per currency
(never blended; Income counts as in, Transfers/Adjustment excluded as
plumbing; items over £50/$50 named). budget_pacing anchors to
yesterday's month with the archived math verbatim for monthly budgets;
MTD comes from `finance_spending_by_category` over the month window,
so pacing reconciles to Hominem's own report by construction. Budgets
themselves are Hominem data now (`finance_budget_list` storedBudgets,
primary-currency cents; when the server reports no primary currency
its own warning is carried and pacing is skipped — never guessed),
and the server's breach list surfaces every cadence the month math
can't pace (weekly/quarterly/annual). WYA-271 tag composition stays
client-side with the disjoint priority rule (Coffee > Dining Out >
Groceries — a row counts once) because the server buckets each tag
independently; composition never breaches on its own. Anomalies are
the archived four (median/MAD with the 2x rule when MAD is 0,
first-seen >threshold, FX by token and by currency, duplicate
charges) with the ≤8 merchant-history cap. Bills come from
`finance_bill_list`, snapshotted to
`$HOMINEM_AGENT_WEALTH_DIR/morning_brief_bills.json` and diffed (new /
inactive / expected-amount change / overdue with the 3-day grace,
merchant-match bills only, and the created-on guard; due-within-3
rides along as due_soon) — archived flag keys (`bill`, `provider`,
`previous_amount`, `due_date`) kept verbatim. The archived CLI flags
became env pins: `WEALTH_SYNC_TODAY` (--date),
`WEALTH_BRIEF_BILLS_ONLY`, `WEALTH_BRIEF_NO_WRITE_SNAPSHOT`.
`hominem.ts` gained `spendingByCategory` / `budgetList` / `billList`.
16 synthetic tests, full suite 93/93, typecheck clean. One semantics
note carried from the archive: anomaly rules filter on `excluded`
only, and the sync writes transfers as excluded=false — a big
first-time Space move legitimately flags as first-seen.

**Layer 3 landed 2026-11-22 (Hominem reads + one FX call,
mocked-proven):** `systems/wealth-manager/forward_look.ts` + the
`hominem wealth-look` launcher mode (WYA-229). The weekly forward cash
view over the 30 days after as_of ([as_of+1, as_of+30]); reads
Hominem plus one public FX reference rate and writes nothing at all.
timeline_gbp / timeline_usd (never blended): registered fixed bills
projected at their expected amount on cadence-stepped due dates
(anchored on the server-computed nextDueDate; weekly steps 7 days,
one_off by stored dueDate in-horizon only), variable bills carry
their due dates in diagnostics — amounts never guessed — top-up bills
watched by balance not date, salary projected monthly from ledger
history per the machine-local rule (single-observation dependence
named when that is the case). pinch_points projects each currency's
open checking+savings balance day by day: below-floor days,
>1,000-outflow days, the minimum, the ending balance. runway calls
`finance_runway` once (asOf + projectionWeeks + monthlyBudgets from
monthly category-level `finance_budget_list` rows only — tag budgets
are sub-caps, non-monthly cadences named in diagnostics) and records
its raw output verbatim, reconciled against the port's own liquid
balances; an all-zero return means no forecast currency is selected
server-side, and the section says so instead of fabricating (the tool
accepts no currency or account-set parameter). utilisation is per
open card (owed = −balance) against machine-local limits. fx_runway is
months of GBP cover from USD liquid at the live rate over the last
three complete months' GBP spend (Transfers/Adjustment excluded).
Personal inputs moved to
`$HOMINEM_AGENT_WEALTH_DIR/forward_look_inputs.json` (archived key names
kept: `balance_floors`, `credit_limits_usd`, plus the new `salary`
rule block) — absent degrades to a floorless, salary-less look with
named notes where the archive crashed. `ok` is false on any source
error but exit stays 0 with every other section still printed (the
archived look contract, deliberately unlike Layer 2's partial-ok
rule); only the accounts fetch or a missing backbone env exits 1.
The FX fetch moved under the logging wrapper (law 1): one `fx-rate`
events row; unreachable → section omitted with a named note. `--date`
became `WEALTH_SYNC_TODAY`; `WEALTH_FX_URL` pins the FX endpoint
(default Frankfurter ECB). The archived personal specifics — payroll
query, floors, payslip history strings — all became inputs or dropped
history. `hominem.ts` gained `runway()` + bill `dueDate`/`payg`
types; `types.ts` gained account `balance` + `isoAddMonths`. 13
synthetic tests, full suite 106/106, typecheck clean.

**Layer 4 landed 2026-11-22 (mocked-proven):**
`systems/wealth-manager/monthly_close.ts` + the `hominem wealth-close`
launcher mode (WYA-230). The complete monthly statement, read-only
from Hominem — and the one layer whose deliverable is the markdown
statement itself, so the render strings are the contract (em dashes,
→, − kept verbatim). Month summary: income vs spend vs budget by
category, savings rate, per currency and never blended (budgets from
`finance_budget_list` status rows — monthly cadence, category rows
only, amounts only, the tool's own spent figures describe its current
period — with nested tag budgets as composition, Coffee > Dining Out
> Groceries). Net-worth position: labelled anchors stated, never
implied (Hominem keeps no snapshots; current `finance_net_worth`
plus the month's net cash flow as movement). Tax flags in one place:
Business-tagged spend, Taxes & Fees, income sources, standing
tax-status lines. Uncategorized residue named row by row, excluded
plugs counted separately. Cross-checks reported, never reconciled
away: `finance_monthly_stats` (transfer-inclusive by design) and the
hygiene-check cache diff (`monthly_check_<month>_data.json` under
`$HOMINEM_AGENT_WEALTH_DIR`; present → per-category diff against the live
pull, absent → a named skip note). Nine tool calls a run, every search paging
at 50 up to 20 pages, one events row each. Any tool failure fails the
whole close — `{ok:false, error}`, exit 1, a statement with a hole in
it is worse than none; an invalid month is exit 2 before any audit
row. CLI flags became env pins: `WEALTH_CLOSE_MONTH` (default the
last complete month before `WEALTH_SYNC_TODAY`, stated in the
header), `WEALTH_CLOSE_OUT` (optional file; set writes it and prints
`wrote <path> (<N> calls)`). Anchors + tax lines moved to
`$HOMINEM_AGENT_WEALTH_DIR/monthly_close_anchors.json` — absent degrades
with a named note (the archive silently skipped), malformed is a
named note where the archive crashed. Money renders en-US 2dp,
`£`/`$` symbols, unknown currencies carry their code prefix, minus
before the symbol (`-EUR 12.00`); the statement ends with exactly one
trailing newline and stdout prints it as-is. `hominem.ts` gained
`monthlyStats`, `tagBreakdown`, `budgetList`, `netWorth`,
`spendingByCategory`, `searchTransactions` + `HominemMcpError`;
`types.ts` gained `monthBounds`. 11 synthetic tests, full suite
122/122, typecheck clean.

**Live Starling balances landed 2026-11-22 (ran live, verified):**
`starlingBalances()` in `starling.ts` + `balance_check.ts` + the
`hominem wealth-balances` launcher mode. Not a port — the archived
system never had a balances routine, and it's the first thing
Charles actually asked the port for. "What have I got right now",
straight from the bank, no Hominem, no sync state: cleared /
effective / pending / overdraft per account, Spaces with targets,
per-currency totals labelled for what they add up (`Cleared +
Spaces:`), never a guessed grand total. The accounts call is the
backbone — failing it is `{ok:false, error}` exit 1, never a
half-empty answer; per-account and savings-goals failures are named
notes. Ran live once with Charles present and worked first shot;
law 1 held (one `starling` events row per call + the runs row).
Per the 2026-11-22 ruling the figures stay machine-local — the
audit db and his hands, never this repo. 5 synthetic tests, full
suite 122/122.

**Wealth seed landed 2026-11-22 (ran live, verified, idempotent):**
`starlingAccounts()` in `starling.ts` + `seed.ts` + the `hominem
wealth-seed` launcher mode. The one-time provisioning of the two
things the sync resolves at runtime — and the same command is the
prod seed. Account identity comes from the bank (one GET on the
accounts backbone, each row created through `finance_account_create`
with (provider `starling`, providerAccountId = the bank-side UID));
the ingest doctrine comes from a machine-local file named by
`WEALTH_SEED_DOCTRINE`, imported wholesale through
`finance_doctrine_import` (fingerprint computed server-side,
identical contents a no-op). Unset doctrine skips its leg with a
named note; unreadable or malformed fails loudly before any external
call. A failed create fails the whole run — no half-seeded
registry. PRIMARY→checking, saver→savings, everything else checking
(the type feeds the runway's liquid set — never guessed). Ran live
twice with Charles present: the first run created the doctrine and
both accounts; the re-run came back `unchanged` + `created:false`
with the same ids (law 3), and the sync after it imported 18 rows
with zero holdouts. 10 synthetic tests, full suite 132/132,
typecheck clean.

**Remaining in this item, in port order (all mocked-first, all
read-Hominem-only for analysis — Plaid ingest-only verbatim):**

- **Layer 1** — `layer1_integrity_check.py` (WYA-227): ✅ ported 2026-11-22
  as `integrity_check.ts` (see above; the archived script's
  `accounts.py` import and hatch paths became the runtime registry and
  env).
- **Layer 2** — `morning_brief.py` (WYA-228): ✅ ported 2026-11-22 as
  `morning_brief.ts` + `hominem wealth-brief` (see above; budgets resolved
  from `finance_budget_list` instead of the archived `taxonomy.json`,
  the snapshot moved under `$HOMINEM_AGENT_WEALTH_DIR`, the CLI flags became
  env pins).
- **Layer 3** — `forward_look.py` (WYA-229): ✅ ported 2026-11-22 as
  `forward_look.ts` + `hominem wealth-look` (see above; the archived
  `forward_look_inputs.json` was never salvaged, so the port defines
  the inputs format on the archived key names, the FX fetch moved
  under the logging wrapper, and the unused 92-day fx window variable
  was dropped as dead code).
- **Layer 4** — `monthly_close.py` (WYA-230): ✅ ported 2026-11-22 as
  `monthly_close.ts` + `hominem wealth-close` (see above; the CLI pair
  became env pins, the dated anchors + tax-status lines moved under
  `$HOMINEM_AGENT_WEALTH_DIR`, the ponti_log subprocess became the HominemMcp
  client with one events row per call).
- **Sheet-era one-offs** (`migration_driver.py`,
  `refresh_category_dashboard.py`, `category_migration_plan.md`):
  worked examples of the sheet→Hominem migration, kept as history —
  the sheet is retired, they never port as live routines.

### 5. Spotify connector (ROADMAP P5) — RESOLVED 2026-11-22

Built in `connectors/spotify/`: official Web API over OAuth PKCE, a
standalone CLI, no daemon and no vendored code (the vendored
`save-to-spotify` in the kernel braniac inbox was the approach
reference only — its PKCE route is the one taken). Every external
call (token refresh included) is an events row; token values never
reach the audit trail. 14 mock-backend tests. The salvage-era app
credentials turned up in this Mac's ambient agent env (client ID
32-hex + secret) and moved into `~/.hominem/env`; `hominem spotify auth`
is the one-time browser flow — done 2026-11-22, the listener storing
the refresh token in `~/.hominem/env`, then live reads (me premium, 43
playlists; token rows 148–150 carry grant_type only, never values).

### 6. Instagram connector (ROADMAP P5) — RESOLVED 2026-11-22

Built in `connectors/instagram/`: no official personal API and an
HttpOnly session cookie, so reads run in-page through the browser
transport — the Mac-local `~/ig-tools/ig` toolkit speaks MCP stdio to
the Browser MCP daemon, which drives the signed-in Chrome (the
retired playwright-extension route died with its Chrome extension and
is not the transport). The durable read surface is the SSR meta
description: the classic `web_profile_info` REST endpoint is dead
(404 in every header variant) and the app now serves everything from
`/api/graphql` with rotating doc ids. `hominem instagram profile
<handle>` / `hominem instagram me`, every invocation an events row
(in-band `{ok:false}` marks errors at exit 0), live-verified
2026-11-22. 5 mock-CLI tests.

### 7. Cadence regeneration routine (ROADMAP P6) — RESOLVED 2026-11-24

Ported `routines/cadence_regen.py` as `routines/cadence_regen.ts` plus
`routines/cadence_templates.json` and the `hominem cadence
weekly|monthly` launcher mode. The archived inline templates are now
data; task-list ids resolve by exact title through a from-scratch
Google Tasks API client using the existing Hominem OAuth token file.
Every list/insert and token refresh therefore lands one `events` row,
while the routine owns one closed `cadence-regen` row. The client
rejects a token without the Tasks scope by name. Mock coverage proves
creation plus a zero-write second run, template failures, in-band
Google errors, and one event per external call. A live run still
requires the one-time Tasks-scope reauthorization.

## Deferred, with reasons

| Item | Reason |
| --- | --- |
| `transport/` (bmcp.py, shot.py) | Needed only once Instagram or VM-side work starts; ports with them. |
| `systems/calendar-analysis` | Small; ports after wealth-manager sets the systems/ pattern. |
| `routines/` (food-orders, trakt-sync, media-drive-sync, drive-empty-folders, sub-scan) | Cadence regeneration is ported; the remaining mechanical pipelines follow the same `runs`/mock-backend pattern. |
| `knowledge/` (bateman-regime + doctrine docs) | Private content — copies unchanged, never kernel; do when the repo gains a privacy review habit. |
| `~/.hominem/env` template | Document the required variables in `docs/05-runbook.md` first; the file is Charles's to fill. |

## Feeding queues (outside this repo)

- The kernel braniac graduation continues one by one in
  `~/Developer/kernel` (54 skills in the inbox at last count; two
  graduated, one retired). Her behavioral skills grow from that loop's
  output.
- **Nothing is pruned — Charles's ruling (2026-11-22): all of it is
  used.** The former "dead weight" category now has named dispositions:
  | Material | Disposition |
  | --- | --- |
  | `.jarvis/workflow-runs/*/workflow.js` | Mine the workflow definitions — orchestration recipes from the old engine feed Hominem's generation routines (pattern: fan out workers, finalize, patch, residue-check). |
  | `.jarvis/*/work/*.py` (gen/make/cluster/fix/patch/residue) | Keep as worked examples of the generation ladder; consult when porting a generation routine so the pattern's failure modes carry over. |
  | `space-versions/daily-physique-logger` v1–v9 | **Revive candidate**: v9 is the final build; port the app as a `systems/` citizen (health/physique logging against hominem or Google Sheets). The version ladder stays as evolution history. |
  | `file-versions/legendary-cut` + `goals/god-like-physique` | Goal content: the OUTLINE and chart script port into `knowledge/` as the physique goal's doctrine, deduplicated into one copy. |
  | `audits/.../dedupe.py` | Port as a `tools/` utility (the workspace-cleanup lineage). |
  | `.pylibs/zxingcpp` | Keep vendored as a pinned dependency; becomes a declared dependency of whichever consumer (idea-card/barcode generation) ports first. |
  The archive stays machine-local under `archive/2026-11-21/` as the
  permanent source of record for all of it.

### 8. Jarvis workflow migration — Phase 1 resolved 2026-11-25

The first `.jarvis` slice is now native Hominem code:

- The workflow runtime persists stable worker keys, attempts, results,
  and failures in the agent database. Concurrency is bounded, completed
  workers are skipped on resume, and failed workers can be retried.
- `hominem workflow status <run-id>` reads persisted progress.
- `hominem knowledge validate <batch-dir>` implements the archived
  extraction invariants with schema-first JSONL validation: exact file
  coverage, unique sequential claim IDs, per-file counts, and verbatim
  best sentences checked against local bodies.
- Synthetic tests cover concurrency, resume, failed-worker retry,
  duplicate keys, malformed JSONL, ID sequencing, count drift, and
  non-verbatim sentences.

The historical `gen`/`make`, cluster, finalize, residue, repair, image,
and Printify scripts remain archive references until a real model
worker and a specific studio consumer are ported. No live vault or
Printify run was attempted in this phase.

### 9. Jarvis image nameplates — resolved 2026-11-25

`build_name_abril.py` and `build_name_abril_gold.py` now share one
deterministic compositor behind `hominem studio nameplate`. The command
provides `platinum` and `gold` presets, explicit word/font/texture/output
inputs, optional JPEG preview output, and closed audit runs. The Python
renderer is embedded into the compiled CLI and uses pinned Pillow 13.0.0.

Synthetic renders prove repeatability, distinct presets, preview output,
missing-input refusal, and named subprocess failure. The original
Abril font and diamond texture were not present in the archive, so a
live DAKOTA render remains an asset blocker rather than a code blocker.
Both migrated source scripts were deleted after the Hominem port passed
its render and audit tests.
