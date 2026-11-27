# Hominem build log

Chronological record of completed work. Every entry names its commit and
the acceptance evidence that proved it. Read alongside
[03-problems-and-solutions.md](03-problems-and-solutions.md), which holds
everything that went wrong on the way.

## Prehistory (context, outside this repo)

The engine's raw material was analyzed in the kernel repo: the 57 braniac
skills were tested per-skill (audit harness, graduation loop defined), two
were graduated into kernel (ponti-principles law 26; wide-research), and
the 2026-11-21 script archive (187 files, the old JARVIS/Muse workspace)
was deep-analyzed. That analysis became this repo's founding document:
[CONVERSION-ANALYSIS.md](CONVERSION-ANALYSIS.md). Along the way a Rex-pane
fan-out audited all 81 of the kernel test plan's entries — the mechanics
learned there (panes, workers, deadlocks) are reused throughout this log.

## Phase 0 — the skeleton (`1b98659`)

- `AGENTS.md` — the four laws, working rules, verification doctrine.
- `log/agent_log.py` (Python era) — the single schema owner: `events`
  (external calls) and `runs` (lifecycle), WAL + busy timeout, `HOMINEM_AGENT_DB`
  env authority. The `events` field set was lifted field-for-field from
  the original `gws_log.py` JSONL so no audit evidence would be lost in
  the move from log files to the database.
- `connectors/gws-log/gws_log.py` — the first port, with its three error
  detectors (Google error payload, `error` text prefix, nonzero exit).
- **Evidence**: 9 mock-backend tests green; one live smoke call wrote
  event row 1 into `~/.hominem/agent.db` and read it back by query.

## The plan (`8db72ca`)

- [ROADMAP.md](ROADMAP.md) — the v1 Muse-replacement plan: system map
  (each requested system → mechanism, evidence-grounded), phases P1–P7
  time-boxed, named risks, definition of done.

## Phase 1 — the brain (`a9ed8c6`)

- `brain/AGENT.md` — persona: systems-before-memory, every action audited,
  named errors, irreversible actions confirmed, and the learning loop.
- `hominem` launcher — headless pi session, cwd = her repo (AGENTS.md laws
  load as project context; context files load regardless of project
  trust), persona prefixed, `~/.hominem/env` sourced.
- **Evidence**: `./hominem "what are your laws?"` answered from AGENTS.md
  context in 7.5s — quoting the rows-not-files law and naming seme as her
  memory.

## Phase 2 — the connector ports (`1627655`, `7de8ba0`)

Fan-out attempt first: 4 Rex panes, one headless pi worker per connector
(notion, linear, ponti, youtube-music). The notion worker landed green
(7 tests); the other three died on provider 429 rate limits — the manager
ported them directly from the originals.

- `notion-log` — envelope parsing with both error styles (Linear-style
  `{error,...}` and Notion-style `APIResponseError`, including nested body
  message extraction); a bare `status` field is deliberately not an error.
  (`1627655`)
- `linear-log` — in-band error payloads keep `ok=true` with the payload's
  status; `tool`/arguments fold into `params`. (`1627655`)
- `ponti-log` — the `mcp`/`mcp2` client selector lands in `events.service`;
  full error chain (JSON-RPC, content payload, text prefix, nonzero exit,
  stderr containing "error"). (`1627655`)
- `youtube-music` — `bridge_client` on env (`YTM_BRIDGE_URL` /
  `YTM_BRIDGE_TOKEN`), `ytm.py` command surface, and the one deliberate
  improvement: `delete` refuses without an explicit `--yes` (exit 3, no
  bridge call, no event — nothing external happened). (`7de8ba0`)
- **Evidence**: 27 → 32 tests green across the suite.

## Phase 3 — MCP wiring (no commit; configuration)

- `seme` registered user-level (`pi mcp add seme -- node
  .../seme-monorepo/apps/api/dist/mcp/mcp-server.js`): **connected, 14
  tools**. Verified through her own brain: a recall query returned real
  memories with honest reporting ("memories exist, none about Hominem yet")
  and she proposed saving her identity to seme.
- `hominem` registered (`${HOMINEM_API_URL}/api/mcp`) — **blocked**: the
  API was not running at the registered URL. Named, not solved; see
  [04-plans.md](04-plans.md).

## Phase 6 (early) — the laws (`a9ed8c6` follow-up edit)

- The three behavioral laws from the archive custom-skills were folded
  compactly into `brain/AGENT.md`, keeping their demonstrated failure
  modes: the zero-duplicates deletion, the mixed-up thread reads, the
  version-pin discipline.

## The TypeScript conversion (`4249add`)

Charles's call — her whole nervous system is Node (pi SDK, hominem's
pnpm monorepo, seme's MCP server), so the engine is too. Node 26 runs
`.ts` natively (type stripping, no build step).

- `package.json` / `tsconfig.json` — `npm test` (node:test over `.ts`),
  `npm run typecheck` (tsc strict, noEmit).
- **drizzle-orm** for the audit db: `log/schema.ts` holds typed
  `sqliteTable` definitions (`events`, `runs`, JSON-mode columns,
  indexes); `drizzle-kit generate` produced `migrations/0000_*.sql`;
  `log/agent_log.ts` applies migrations under a `hominem_migrations` ledger
  with legacy-db compat.
- All five connectors ported **from the tested Python**, not re-invented —
  semantics identical, `spawnSync` + the same error detection.
- `hominem` launcher audit row via the TS module; `remember` / `recall`
  modes added (prompt-routed to `seme_save` / `seme_recall`).
- Python deleted completely.
- **Evidence**: 30 node:test tests green; tsc clean; the Python-era row 1
  in the live db read back through drizzle; `./hominem` writes `runs` row 1
  (`brain-chat | invoked`) and her brain answered.

## The end-to-end proof (`e2e/proof.md`)

One live pass through the whole spine, with the transcript committed.

- `hominem remember` → `seme_save` stored the fact verbatim (memory
  `622bee4c…`). `hominem recall` in a fresh, ephemeral process read it
  back, and an independent `seme_recall` from outside Hominem confirmed it.
- A gws call against `e2e/mock-gws.mjs` was audited as `events` row 8
  (`calendar`, `ok=1`, 200). With `GWS_CLI` unset it fails with a named
  error and writes no row.
- Four problems were found and fixed along the way (see the problems
  doc):
  - pi `-c` is `--continue`;
  - brain MCP calls were unaudited, fixed by `brain/audit_stream.ts`;
  - runs were never closed, fixed by `finishRun`;
  - `remember` was not idempotent or verbatim.
- **Evidence**: `events` 4–7 were written by the wrapper, and `runs` 4–6
  are closed with their event ids. 33 tests green, tsc clean.

## The conversation-end memory routine (`systems/memory/reflect.ts`)

ROADMAP P4 / plans item 3 — the memory-mirror's sync, rebuilt seme-native:
no manifest, no Drive round-trip, one store.

- `hominem reflect < transcript`: her brain extracts the session's durable
  facts as JSONL (judgment only — she makes no tool calls); the
  deterministic routine upserts through the seme MCP stdio server
  (`SEME_MCP_CMD` from env, the same server her brain reads — not a
  second store).
- Dedup gate with **two anchors**, because one proved too narrow live:
  re-running the same conversation had her re-extract a fact reworded,
  which scored dice 0.714 against its stored copy — but
  `seme_recall`'s top-N never returned that copy, so a duplicate was
  saved. Since then every fact is compared against recall's results AND
  the recent window (one `seme_list_memories` call per run, newest 200
  active, plus everything saved earlier in the same run).
- Doctrine carried from the archived memory-mirror as code: saves
  verbatim, close variants flagged as conflicts and never written over,
  never delete on disappearance — `seme_correct` and `seme_forget` have
  no path in the routine.
- **Evidence**: 51 tests green against a mock MCP stdio server (every
  branch: save/verify, already, conflict, dry-run, list-failure
  degradation, config gates). Live: a new fact saved + read-back
  verified; an exact duplicate recognized as ALREADY; a fresh rewording
  refused as CONFLICT; and a same-conversation re-run saved zero
  duplicate rows — the earlier test wordings had already been converged
  by seme's own ingest resolver (supersede chain read back from
  `~/.hominem/memory.db`: 5 superseded, one active copy per fact).
  `events` 9–39 and `runs` 7–14 in `~/.hominem/agent.db` carry the calls.

## The wealth-manager port — doctrine-driven, mocked-proven (2026-11-22)

ROADMAP P4 / plans item 4. Charles's ruling set the shape: **this repo
holds no personal financial data** — accounts, routing and doctrine
resolve from hominem at runtime, and hominem gains whatever the sync
needs.

- **Hominem, shipped on `feature/finance-sync-doctrine`** (worktree
  `~/Developer/hominem-sync-doctrine`, commit `91e749e19`, full gate +
  format green): migrations for `app.finance_accounts.provider_account_id`
  (unique per user with provider) and `app.finance_sync_doctrine` (RLS
  jsonb, one fingerprinted row per user); doctrine repository → schemas →
  service → MCP `finance_doctrine_get` / `finance_doctrine_import`;
  account identity across the service/RPC/MCP layers — identity-first
  create, a name-matched get never stamps identity, update owns it
  with `identity_conflict` / `identity_requires_provider` refusals.
  25 new tests (7 doctrine + 12 MCP identity + 6 integration), the
  finance surface at 28 tools, spec §8a/§8b written.
- **The dev seed ran and read-back verified** — through the service
  layer, so canonicalization, fingerprinting and the identity guard
  rails all executed: doctrine `created`, then `unchanged` on re-import
  (fingerprint idempotency proven live, `0402e68d…`), rule counts
  54 merchantRules / 33 tagRules / 2 amountRules / 7 transferMerchants /
  5 incomePatterns / 8 coffeePatterns / 7 lenses (245 matches). Eleven
  routing identities read back: 2 accounts by (provider,
  providerAccountId), 9 cards by mask — account and card names stay
  machine-local with the seed inputs, never in this log. Two seeder
  bugs were caught by the verification
  pass itself: the service input is `mask`, not `accountNumber` (tsx
  never typechecks, so the wrong key was a silent no-op), and a
  name-matched create-or-get doesn't stamp identity by design — the
  seed stamps explicitly after. Seed script + inputs live machine-local
  in `~/.hominem/wealth/seed/`, never committed.
- **Hominem modules, reworked doctrine-driven the same day**: the
  personal-data files (`accounts.ts`, `subcategory_lenses.ts`) are
  deleted — no hardcoded registry, no hardcoded rules. `daily_sync.ts`
  resolves the registry and the doctrine from hominem at runtime
  (`finance_accounts`, `finance_doctrine_get`, both audited `events`
  rows), routes rows by identity — Starling by
  (provider, providerAccountId), Plaid by mask; unknown or ambiguous
  identities held out with a named reason and banked in
  pending_unmapped.json — and imports rows carrying the account UUID
  (name-change-proof). `categorize.ts` is a pure doctrine engine with
  hominem's match modes (`exact` default for transfer rules,
  `contains` for the rest) and the engine order as law: row-class
  detection before categorization, amounts before merchants,
  first-match-wins. A missing doctrine is a named warning — ingest
  still runs, every merchant queues for a ruling; INTERNAL_TRANSFER
  stays engine-level Transfers (2026-10-31). Tests synthetic-only —
  no personal data even in the fixtures: three fake backends (Starling
  HTTP, Hominem MCP JSON-RPC, mock plaid CLI) prove windows, identity
  routing, doctrine categorization, holdout, idempotent re-runs, loud
  rejections and the B15 full-row transfer link — 65/65 green,
  typecheck clean. The verification pass caught one real wire bug: the
  in-process mock set Content-Length from UTF-16 string length, so
  the first multi-byte fixture truncated mid-JSON — fixed to
  byteLength (elipsis chars in account names travel the wire now).
- **Honest losses:** the exact-merchant layer (425 rules in
  `merchant_category_rules.json`) was never salvaged — those rows now
  queue for rulings, never guessed; the archived `MULTI_CURRENCY`
  account list is dead (today's import schema has no such field).
- **Blockers, named:** hominem dev services down (MCP URL unreachable)
  + `pi mcp login hominem` outstanding; the live run and the prod seed
  both wait on Charles present — the prod seed additionally on the db
  backup/approval gate.

### Layer 1 — integrity checks, ported same day (2026-11-22)

`hominem wealth-integrity` (WYA-227), the archived
`layer1_integrity_check.py` contract. Read-only, runs after the sync,
prints `{ok, date, flags, info, run_id}` — empty flags is a quiet day,
each flag carries `severity: "flag"` (look) or `"info"` (a check was
skipped and why — never silence).

- Six checks: feed_health (watermarks present, <4 days stale),
  balance_drift (per Plaid account: ledger sum vs feed balance with
  the gap window — feed transactions after the ledger's max date —
  `$1` residual tolerance; the 2026-10-28 Amex lesson carried),
  starling_reconciliation (SETTLED feed vs ledger over the watermark
  window, per account identity — the archive checked the one account
  its label map knew), anchor_freshness, cancellation_watches (keeps
  the archived `SWEEP_FROM = 2026-10-21` wide net), and
  payment_verification (statement window anchored on the issue date,
  ALL payments counted, grace = due + 3d, "normalization" exclusion
  verbatim, per-credential liabilities reads so the Wise
  `NO_LIABILITY_ACCOUNTS` failure skips one institution instead of
  killing the check).
- Same ruling, same shape: no personal data in the repo — the registry
  resolves from `finance_accounts` at runtime; manual-anchor
  thresholds and cancellation watches are machine-local inputs under
  `$HOMINEM_AGENT_WEALTH_DIR` (`manual_anchors.json`,
  `cancellation_watches.json`), absent = named info note, never
  guessed. Optional legs degrade by name: no `PLAID_CLI` (hatch-only
  binary) or no `STARLING_API_TOKEN` skips exactly its checks; a
  missing `HOMINEM_MCP_TOKEN` fails the run by name (law 4).
- Plumbing that made it: `plaid.ts` rebuilt on one exported
  `plaidCommand` bridge (`plaidAccounts` / `plaidLiabilities` /
  `plaidTransactionsWindow`, one events row per invocation);
  `hominem.ts` gained `finance_account_summary`, `finance_net_worth`
  and typed `finance_transaction_search` wrappers;
  `finance_transaction_search` pages at 50, so the archived recursive
  date-window split came along (split at the midpoint, read both
  halves — no offset guessing).
- **Evidence:** 12 synthetic tests (`tests/wealth_integrity.test.ts`)
  over the same three fake backends — quiet day, stale/missing
  watermarks, drift residual with the gap math, Starling mismatch,
  stale anchor, cancellation charge + blown deadline, short
  statement, the >50-row window split, both unset-leg degradations,
  the named-backbone failure, a failing check staying a flag — full
  suite 77/77, typecheck clean. The run itself caught three of my
  own fixture bugs (unquoted dotted object keys, `env()` stomping a
  caller's wealth dir on call order, and an off-by-30-days age in an
  assertion) — details in 03-problems-and-solutions.
- **Not run live** (same blockers as the sync): hominem dev services
  down; the one live pass waits on Charles present.

### Layer 2 — the morning brief, same day again (2026-11-22)

`hominem wealth-brief` (WYA-228), the archived `morning_brief.py`
contract: the exception-led daily read, Hominem-only (the data rule
verbatim — Plaid is INGEST ONLY and is never a source for analysis,
so this routine reads no feed data at all). Prints
`{ok, date, sections, silent, run_id}`; sections with nothing to
report are omitted, and `silent` means no anomalies, no bill flags,
no >£50/$50 items, no pacing entries.

- money_in_out: yesterday's net per currency, never blended; Income
  counts as in, Transfers/Adjustment excluded as plumbing; items over
  £50/$50 named with their own richer shape.
- budget_pacing: the archived month math verbatim for monthly budgets,
  MTD from `finance_spending_by_category` over the month window —
  pacing reconciles to Hominem's own report by construction. Budget
  amounts are Hominem data now (`finance_budget_list` storedBudgets,
  primary-currency cents; unset primary currency → the server's own
  warning carried, pacing skipped). The server's breach list surfaces
  every cadence the month math can't (weekly/quarterly/annual), so a
  breach always earns its entry. WYA-271 tag composition is
  client-side disjoint priority (Coffee > Dining Out > Groceries, a
  row counts once) because the server's tagBudgets bucket each tag
  independently — composition is a mix note, never a breach.
- anomalies: the archived four — median/MAD amount anomaly (2x median
  when MAD is 0, median+3×1.4826×MAD otherwise), first-seen merchant
  over the threshold, FX by token or by non-GBP/USD currency,
  duplicate-looking charges — with the ≤8 merchant-history call cap
  and yesterday's rows from `finance_transaction_search` (a >50-row
  day is surfaced as `yesterday_truncated`, never silently capped).
- bills: `finance_bill_list` → snapshot at
  `$HOMINEM_AGENT_WEALTH_DIR/morning_brief_bills.json`, diffed next run
  (new / inactive / expected-amount change / overdue — 3-day grace,
  merchant-match bills only, never a due date before registration,
  archived flag keys `bill`/`provider`/`previous_amount`/`due_date`
  kept verbatim; due-within-3-days rides as due_soon). Archived CLI
  flags became env pins: `WEALTH_SYNC_TODAY`, `WEALTH_BRIEF_BILLS_ONLY`,
  `WEALTH_BRIEF_NO_WRITE_SNAPSHOT`.
- Per-merchant history failures land as named `source_errors` and the
  run still counts `ok` when it produced a money or bills section —
  the archived contract: partial data beats no data.
- `hominem.ts` gained `spendingByCategory` / `budgetList` / `billList`
  wrappers + their row types.
- **Evidence:** 16 synthetic tests (`tests/wealth_brief.test.ts`) over
  an in-process Hominem MCP mock — silent quiet day (with a recurring
  Space move so the archived transfer-in-anomalies semantics stays
  exercised), per-currency in/out with large items, month pacing
  reconciling to the report, server breaches for a non-monthly
  cadence, the WYA-271 disjoint composition, all four anomaly rules
  with both MAD branches, the 8-call cap, the bills baseline + full
  diff (created-on guard included), no-write-snapshot and bills-only
  modes, truncation surfacing, no-primary-currency skip, the failing
  history call, and the named-backbone failure — full suite 93/93,
  typecheck clean. Two port-fidelity catches from the verification
  pass are in 03-problems-and-solutions.
- **Not run live** (same blockers as the sync + Layer 1): the live
  brief waits on Charles present and hominem dev services up.

### Layer 3 — the forward look (2026-11-22)

`hominem wealth-look` (WYA-229), the archived `forward_look.py`
contract: the weekly 30-day forward cash view, `[as_of+1, as_of+30]`.
Reads Hominem plus one public FX reference rate; writes nothing —
not even a snapshot. Prints `{ok, as_of, horizon_days, horizon,
sections}`.

- timeline_gbp / timeline_usd (never blended): registered fixed bills
  at their expected amount on cadence-stepped dates (anchored on the
  server-computed nextDueDate; weekly +7 days; one_off by stored
  dueDate, in-horizon only), variable bills listed in diagnostics
  (due dates known, amounts never guessed), top-up bills watched by
  balance not date; salary projected monthly from ledger history per
  the inputs-file rule, with single-observation dependence named when
  that is the case.
- pinch_points: per-currency day-by-day projection of open
  checking+savings balances — below-floor days, >1,000 outflow days,
  the minimum, the ending balance.
- runway: `finance_runway` called once, raw output recorded verbatim,
  reconciled against the port's own liquid balances. The tool accepts
  no currency or account-set parameter; an all-zero return (no
  forecast currency selected server-side) is named — "the pinch_points
  projection is the operative runway" — never fabricated.
  monthlyBudgets are monthly category-level `finance_budget_list`
  rows only; tag budgets are sub-caps, non-monthly cadences are named
  in diagnostics (the archived projection is month math).
- utilisation: open cards, owed = −balance, limits machine-local
  (exact-name then normalized lookup; a card without one is
  balance-only with its reason).
- fx_runway: USD liquid × live rate over the average of the last
  three complete months' GBP spend (Transfers/Adjustment excluded).
  The archived plain-urllib fetch moved under the logging wrapper: one
  `fx-rate` events row (law 1); unreachable → the section is omitted
  with a named note.
- Personal inputs moved to
  `$HOMINEM_AGENT_WEALTH_DIR/forward_look_inputs.json` (archived key names
  kept: `balance_floors`, `credit_limits_usd`, plus the new `salary`
  rule block) — the archived inputs file was never salvaged, so the
  port defines the format; a missing file degrades with named notes
  where the archive crashed. `--date` became `WEALTH_SYNC_TODAY`;
  `WEALTH_FX_URL` pins the FX endpoint (default Frankfurter ECB). The
  archived unused 92-day fx window variable and the personal
  payslip/bill history strings were dropped as history, not engine
  logic.
- `ok` semantics deliberately differ from Layer 2 (the archived look
  contract): any source error → ok:false but exit 0 with every other
  section still printed; only the accounts fetch or a missing
  backbone env fails the run (exit 1).
- `hominem.ts` gained `runway()` + `dueDate`/`payg` on the bill row
  type; `types.ts` gained account `balance` + `isoAddMonths`.
- **Evidence:** 13 synthetic tests (`tests/wealth_forward_look.test.ts`)
  over an in-process Hominem MCP mock plus a GET /fx route — the full
  run (timeline math, pinch flags, raw runway, utilisation, fx, 8 MCP
  events + 1 fx events row + 1 runs row), the zero-runway verdict, fx
  omission with its failure events row, no-USD-liquid, inputs-file
  degradation, no-history salary, payday roll-forward, a USD floor, a
  registered limit of 0, tag/non-monthly budget exclusion, an
  out-of-horizon one_off, the source-error-not-ok contract, and the
  named-backbone failure — full suite 106/106, typecheck clean. The
  gate earned its keep twice (see 03-problems-and-solutions).
- **Not run live** (same blockers as the sync + Layers 1–2).

### Layer 4 — the monthly close (2026-11-22)

`hominem wealth-close` (WYA-230), the archived `monthly_close.py`
contract: the complete monthly statement, read-only from Hominem. The
one layer whose deliverable is the markdown statement itself, not a
JSON envelope — the strings are the contract and are kept verbatim
(em dashes, →, − and all).

- Four sections per the WYA-230 spec: month summary (income vs spend
  vs budget by category, savings rate, per currency — never blended;
  budgets are `finance_budget_list` status rows, monthly cadence,
  category rows only, amounts only — that tool's spent figures
  describe its current period, so month actuals always come from
  `finance_spending_by_category`; nested tag budgets are composition
  with the Morning Brief priority), net-worth position (labelled
  anchors from `monthly_close_anchors.json` stated, never implied —
  Hominem keeps no snapshots; current `finance_net_worth` plus the
  month's net cash flow as a movement figure), tax flags
  (Business-tagged spend, Taxes & Fees, income sources, standing
  tax-status lines), Uncategorized residue (posted, non-excluded
  rows; excluded plugs counted separately, never residue).
- Cross-checks every run: `finance_monthly_stats` (transfer-inclusive
  by design — the difference is reported, not reconciled away) and
  the hygiene-check cache diff (per-category, so recategorisation
  since that check is named, never smoothed over). Nine tool calls in
  order: spending_by_category → monthly_stats → search(Income) →
  search(Uncategorized) → tag_breakdown → search(Business) →
  budget_list → net_worth → search(Food); every search pages at 50
  rows up to 20 pages, one call + one events row per page.
- Unlike Layers 2 and 3 (partial-ok), ANY tool failure fails the
  whole close — a statement with a hole in it is worse than none.
  Failures print `{ok:false, error}` and exit 1; an invalid month is
  exit 2 (`month must be YYYY-MM` on stderr) before any audit row.
- Env pins (Layers 2/3 precedent): `WEALTH_CLOSE_MONTH` (default:
  the last complete month before `WEALTH_SYNC_TODAY`, stated in the
  header when the default is used) and `WEALTH_CLOSE_OUT` (optional
  file; set writes it and prints `wrote <path> (<N> calls)`, unset
  prints to stdout only).
- The output contract, pinned: money renders en-US 2dp with
  `£`/`$`, unknown currencies carry their code prefix (`EUR 12.00`)
  and negatives put the minus before the symbol (`-EUR 12.00`, same
  as the USD row's `-$290.00`); the statement ends with exactly one
  trailing newline — every render section closes with a blank
  element, so the join carries it — and stdout prints the markdown
  as-is, never doubling it. (The original "no trailing newline" pin
  was mis-derived from the join mechanism and corrected; the tests
  now assert `endsWith("\n") && !endsWith("\n\n")`.)
- `hominem.ts` gained `monthlyStats`, `tagBreakdown`, `budgetList`,
  `netWorth`, `spendingByCategory`, `searchTransactions` and
  `HominemMcpError`; `types.ts` gained `monthBounds`.
- **Evidence:** 11 synthetic tests
  (`tests/wealth_monthly_close.test.ts`) over the in-process Hominem
  MCP mock — the full run (9 calls, 11 events rows, 1 runs row with
  the counted message), the default-month header sentence, invalid
  month exit 2 with no audit rows, `WEALTH_CLOSE_OUT` with the
  receipt and the trailing-newline contract, a differing hygiene
  cache naming its diffs, >50 residue rows paging at 50, absent
  anchors/cache degrading with named notes, malformed anchors/cache
  as named notes never crashes, tool warnings in their own counted
  section, any tool failure failing the whole close, and a
  spend-only currency rendering `n/m (no income)` with no note —
  full suite 122/122, typecheck clean.
- **Not run live** (same blockers as the sync + Layers 1–3).

### Live Starling balances — a new capability (2026-11-22)

`hominem wealth-balances`: "what have I got right now", straight from
the bank — the live answer between syncs, touching no Hominem and no
sync state. Not a port: the archived wealth system never had this as
a routine, and it closes the gap Charles actually hit first when
validating the port.

- `starlingBalances()` in `starling.ts` (accounts backbone call,
  then `/balance` + savings goals per account), rendered by
  `balance_check.ts`: cleared / effective / pending / overdraft per
  account, Spaces with their targets, and per-currency totals
  labelled for what they add up (`Cleared + Spaces:`) — never a
  guessed grand total.
- Failure contract: the accounts call is the backbone — failing it
  prints `{ok:false, error}` and exits 1, never a half-empty answer
  presented as complete; a per-account balance failure skips that
  account with a named note; a savings-goals failure is a named
  note, never silence. The token resolves from env and is never
  echoed into any events row.
- **Run live once, 2026-11-22, and it worked first shot** — every
  account, its Spaces and the totals read back, with law 1 holding:
  one `starling` events row per HTTP call plus the
  `wealth-balances | ok` runs row. Per the 2026-11-22 ruling the
  figures live in the audit db and Charles's hands only — nothing
  personal lands in this repo, this log included.
- **Evidence:** 5 synthetic tests (`tests/wealth_balances.test.ts`)
  over the in-process Starling mock — full run with one events row
  per call, a Spaces failure as a named note, a per-account skip
  with its note, the failed backbone call failing the whole
  routine, and the missing token failing by name before any call.

### The wealth seed + the live spine proof (2026-11-22)

`hominem wealth-seed` — the one-time provisioning, built as a routine
from the start (no ad-hoc curls, law 1). Two legs, both idempotent:

- **Accounts** — identity straight from the bank: one GET on
  Starling's accounts backbone, each account created through
  `finance_account_create` with (provider `starling`,
  providerAccountId = the bank-side UID) — the identity the sync
  routes by. A failed create fails the whole run: a half-seeded
  registry must never present itself as done.
- **Doctrine** — a machine-local file named by `WEALTH_SEED_DOCTRINE`,
  imported wholesale through `finance_doctrine_import` (server-side
  fingerprint; identical contents come back `unchanged`). Unset
  skips the leg with a named note; unreadable or malformed fails
  loudly before any external call.

Ran live with Charles present, twice. First run: doctrine created
(54 merchant rules, fingerprint on record) + both Starling accounts
provisioned. Re-run: `unchanged`, `created:false`, same ids — law 3
proven on live data. Then the whole spine, live, in one sitting —
sync (18 added, 0 held), integrity (feed==ledger on both accounts),
brief (3 anomalies from yesterday's rows), look, close (October, 9
calls) and balances. Runs 17–25 all ok, every call an events row,
read back through the audit db. The dev environment is
`finance-sync-doctrine.api.lvh.me`; the prod seed is the same
command with the prod token, gated on Charles's go. Per the ruling,
no personal figures land in this repo — the counts above are
routine outputs, not balances.

### Spotify live: the one-time auth and the read-back (2026-11-22)

`hominem spotify auth` ran the PKCE flow through the browser (consent
on Chase's own app "hollywood"), the listener stored the refresh
token in `~/.hominem/env` — values never echoed, the events rows carry
`grant_type` only (rows 148–149). Live reads followed: `me`
(premium) and 43 playlists through `hominem spotify playlists`
(row 150). The flow lives in `connectors/spotify/CONNECTOR.md`.

### Google Workspace: the live surface and the Docs API unlock (2026-11-22)

Google auth re-established through `hominem auth google` (the
consent gotcha: the scope list defaults to NOTHING checked — a bare
Continue returns "You did not allow any access"; go back, Select
all, Continue). The gws passthrough then verified live through
`hominem gws`: drive search (spreadsheets + documents), a sheets read
and a docs read on real files — events rows 153–155. The docs read
first failed honestly (row 156, 403 SERVICE_DISABLED: the Docs API
had never been enabled on the hominem GCP project) and went green
after one Enable click in Cloud Console — the row stays as the
failure record. File titles and contents live in the audit db and
Charles's hands, not this log.

### Instagram: the browser transport, live (2026-11-22)

No official personal API and an HttpOnly session cookie: the YTM
cookie-harvest route is impossible. The route hunt went REST →
graphql → capture → meta: `web_profile_info` 404s in every header
variant (dead), the app serves everything from `/api/graphql` with
rotating doc ids (not a contract), monkey-patch capture dies on full
page loads, and the winner is the SSR meta description —
machine-shaped for a decade, parsed Node-side. The Mac-local
`~/ig-tools/ig` toolkit speaks MCP stdio to the Browser MCP daemon
(port 9010, the one behind browsermcp): one automation tab per run,
evals in-page where the HttpOnly cookies ride along, tab closed on
exit — success or failure. `hominem instagram profile <handle>` /
`hominem instagram me`, every invocation one events row;
live-verified same evening (rows 159/160, ok). 5 mock-CLI tests, the
suite at 153/153, typecheck clean.
`connectors/instagram/CONNECTOR.md` holds the whole route record.
