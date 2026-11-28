# Finance core consolidation for humans and agents

## Status

Proposed (2026-11-25). **Not accepted.** This is an evidence-backed
recommendation for the product owner to accept, amend, or reject. It does not
supersede [finance.pfin-merge](finance.pfin-merge.md), which stays the
historical record of the 2026-09-08 decision. The owner directed implementation
of the server-owned CLI migration; that direction does not accept the broader
open decisions below.

## Implementation in this worktree

The current worktree shares runway orchestration between MCP and RPC in
`services/api/src/application/finance.runway.service.ts`, preserving each
surface's existing budget inputs and response shape.

As a reversible safety default, batch imports preserve category, tags, and
notes on existing `plaid` and `starling` rows. New rows still receive the
incoming values. Callers that deliberately want to overwrite those fields may
set `overwriteAnnotations: true`; manual-source batches, single upserts, and
confirmed replacements keep their existing behavior. This is not a decision on
D7: there is no provenance to distinguish a user edit from an earlier import.
Provider corrections still update the transaction itself.

The baseline overlap test reproduced the overwrite. The migrated sync now
normalizes and classifies provider data on the server, routes it against the
authenticated owner's accounts, and retains provider transaction IDs. A
matching older provider row with the same natural key can adopt its stable ID;
a changed historical description without an earlier ID cannot be matched
safely. Transfers link only for mutually unique, opposite-amount matches, and
the two owner-scoped rows are updated together without rewriting annotations.

The CLI keeps provider credentials and file state locally and uses Hominem
OAuth instead of a personal MCP token. Seed and live-balance processing call
server tools. Held transactions are kept in a private, OAuth-client-scoped
local file and their checkpoints are rewound for retry. Legacy unscoped state
files are not silently attributed to an OAuth client. These are compatibility
and data-safety defaults, not a resolution of the remaining product decisions.
The full currency schema/rate rollout remains separate.

This branch merges the committed S2 `feature/web-perf-cleanup` state and
deletes the CLI `wealth-manager` directory; no CLI copy of sync, categorization,
or report logic remains. The owner's uncommitted S3 changes are not merged.

The four owner routines (morning brief, forward look, monthly close, and
integrity check) now run as owner-scoped, read-only `finance_wealth_*` server
tools. The CLI supplies only local inputs: the bill snapshot, look inputs,
close anchors and cache, manual anchors, cancellation watches, the sync
checkpoint, a live USD-to-GBP rate, and raw Plaid and Starling reads. Starling
feeds are normalized on the server with the shared ingest code. Moving the
math server-side removes the duplicated CLI copy; it does not decide D11. The
reports keep the routines' current GBP/USD assumptions and stay personal
routines until D11 is decided.

## Question

Should Hominem consolidate its finance logic into one core that people (Web,
mobile, RPC) and agents (MCP, CLI agent runners, third-party clients) use
through the same contracts? If so, where should that core's boundary sit, and
what must be settled first?

This goes beyond the narrower plan in
[finance-cli-migration (PON-348)](https://linear.app/ponti-studios/issue/PON-348/finance-cli-migration-and-core-consolidation), which is to move the
CLI wealth-manager modules into `@hominem/finance-services`.

### Directly stated user decisions this document preserves

- The analysis covers a real consolidation of core finance logic for humans and
  agents, not only a CLI migration.
- The full multi-currency schema and rate rollout
  ([finance-multi-currency-redesign-plan](../finance-multi-currency-redesign-plan.md))
  **stays a separate implementation**. Its money model is still examined here,
  because a consolidated core must not block that rollout.
- No document or piece of code is treated as settled truth. Code shows how the
  system behaves now. Documents and ADRs show what was intended. Neither proves
  what should be built.

### The owner's draft positions (S3, uncommitted)

The owner's working draft of `docs/tasks/finance-cli-migration.md`, plus
`docs/finance.{transactions,ingest,categories}.md` in the main checkout (see
E0), states these positions. They are the owner's current intent and carry
more weight than agent output. They are still drafts, so this document records
them, tests them against evidence, and does not count them as accepted:

- The CLI is a general finance adapter for agent runners, not a routine built
  for one person.
- Operations take an explicit owner identity, and provider state is isolated
  per user.
- New users get the 32-category `personal-finance-v1` seed. It contains only
  categories: no rules, tags, budgets, or assignments.
- Merchant rules stay suggestion-only. Classification is learned from
  corrections and confirmations, and learned rules are owner-scoped,
  reversible, and carry provenance.
- Plaid is ingest-only.
- No personal data is hard-coded, and fixtures use synthetic identities.
- `@hominem/finance-services` becomes the one implementation of ingest,
  categorization, routing, dedupe, and transfer linking.

## Evidence base

### E0. Three states of the code, not one

Observed 2026-11-25. The owner's main checkout is on the branch
`feature/web-perf-cleanup` and has uncommitted work in progress. This document
was written in a separate worktree based on `main`, and it read that checkout
without changing it.

| State                                   | Where                                                                                   | Finance-relevant contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 committed `main`                     | `origin/main` `34bf4a38c`                                                               | `packages/finance`, the API finance services, RPC, MCP, Web, and the sync doctrine store and provider account identity (#614, `aae72fdc3`). **No CLI wealth-manager**: `packages/cli/src` has only Google/auth/rclone/launchd modules.                                                                                                                                                                                                                                                                                                                                                                                            |
| S2 committed `feature/web-perf-cleanup` | `31d203107`. It forks from `main` at `16142f43e` (#612), 44 commits ahead and 5 behind. | The `wealth-manager` (14 files under `packages/cli/src/agent/systems/wealth-manager/`, starting at `6049ab6e4` "integrate personal agent runtime"), `packages/cli/tests/agent/wealth_*.test.ts`, and renamed finance integration tests. It does **not** contain #614, yet the CLI calls `finance_doctrine_get` (`hominem.ts:614`), a tool only `main` defines (`services/api/src/mcp/tools/finance-doctrine.test.ts:79`). Neither committed state can run the CLI's doctrine path by itself.                                                                                                                                      |
| S3 uncommitted working tree of S2       | the main checkout, files changed 2026-11-25 20:21–20:29                                 | Untracked: `packages/finance/src/ingest/{contracts,contracts.test,index}.ts`, `money.ts`, `category-seed.ts` and `category-seed.integration.test.ts`, `docs/finance.{transactions,ingest,categories}.md`, and the owner's `docs/tasks/finance-cli-migration.md` draft. Modified: `packages/finance/src/{index,utils}.ts`, the CLI `types.ts` (now re-exports `@hominem/finance-services/ingest/contracts`), `packages/cli/package.json` (adds a `workspace:*` dependency), and `pnpm-lock.yaml`. Deleted: `docs/finance-transaction-categorization.md` and `docs/tasks/finance-transactions-redesign.md` (an `Implemented` task). |

Agent-session snapshot commits `5d01d78ce` and `9b71619cd` (session
`a2108450…`) capture states close to S2 and S3. They have no common ancestor
with `main`. They are **not** the source of truth: S3 has edits made after the
last snapshot. For example, the owner's draft task and
`docs/finance.transactions.md` dropped "disable" from the category lifecycle,
and `docs/finance.categories.md` gained a "Transaction classification" section.
This analysis treats S3 as the owner's current intent.

Consequences:

- Nothing in S2 or S3 has **shipped**. The draft's "Implemented" W-002 and W-003
  describe code in S3: it exists and has tests, but it is uncommitted and has
  never run in `main`'s CI. This analysis did not run those tests, so that the
  owner's checkout stayed untouched.
- Combining S2/S3 with S1 is a merge of two diverged lines. S2 needs #614 from
  `main` before the CLI's doctrine path works end to end.
- S3 deletes two docs that `main` still links to and relies on. It moves their
  content into the new `docs/finance.{transactions,categories}.md`, but
  `finance.transactions.md` lists the redesign's acceptance criteria as
  unchecked. The `Implemented` record and its evidence would be lost unless the
  move keeps them.
- This worktree's revision of the task (now Linear PON-348, formerly `docs/tasks/finance-cli-migration.md`) sits at the
  same path as the owner's untracked draft. It is a **proposed alternative for
  review**, not a replacement. Bringing the two lines together will collide on
  that path: an untracked file blocks checkout, and two committed versions give
  an add/add conflict. The owner has to reconcile them by hand, and neither
  version should silently win.

### E1. Finance logic already lives in three places

1. `packages/finance/src`: accounts, transactions, sheet import (the actual
   write path for imports), runway, reconcile, diagnostics, taxonomy merge,
   rules CRUD, rulings clustering, and reports.
2. `services/api/src/application/finance*.ts` (about 4,000 lines). This code
   calls `@hominem/db` directly. It covers bills (`finance-bills.service.ts`,
   359 lines), budgets with periods, pacing, and nesting
   (`finance-budgets.service.ts`, 722 lines), rulings execution
   (`finance.rulings.service.ts`, 429 lines), the sync doctrine
   (`finance.doctrine.service.ts`), transaction management, and
   `finance.service.ts` (612 lines).
3. The CLI committed on `feature/web-perf-cleanup` (S2,
   `wealth-manager/*.ts`): sync, categorization, transfer
   linking, and four report routines (`morning_brief` 793, `integrity_check`
   594, `monthly_close` 779, `forward_look` 820 lines). These read Hominem
   over MCP.

So the claim that the shared package "already owns" finance behavior, made in
the task, is only partly true. Budgets, bills, rulings execution, and the
doctrine live in the API application layer, not in `packages/finance`.

### E2. People and agents get different capabilities

Grepping the RPC routes (`services/api/src/rpc/routes/finance*.ts`) against the
MCP tools (`services/api/src/mcp/tools/finance*`) shows:

| Capability                    | RPC (Web)                                                              | MCP (agents) |
| ----------------------------- | ---------------------------------------------------------------------- | ------------ |
| Rules CRUD (`finance_rule_*`) | none                                                                   | yes          |
| Sync doctrine get/import      | none                                                                   | yes          |
| Category merge                | none                                                                   | yes          |
| Transaction batch import      | none (browser import was removed by product direction, per pfin-merge) | yes          |
| Bills                         | 1 route file                                                           | 8 tool files |
| Affordability                 | yes                                                                    | none         |
| Rulings                       | yes                                                                    | yes          |

In S1, the MCP and RPC runway adapters called `computeLedgerRunway` directly
but built different budget inputs: MCP filtered by forecast currency and
merged per-call overrides; RPC passed every saved budget. The calculation
filters by currency, but RPC also returns its full supplied budget list. The
current worktree moves orchestration into one application service while
preserving both contracts.

### E3. Four ways to store classification rules, none applied to transactions on `main`

| Store                                                           | Shape                                                                                                      | Category reference                                                    | Applied to transactions on `main`?                                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.finance_rules` (`20261101100000_create_finance_rules.sql`) | rows: priority, `exact`/`contains`/`regex`                                                                 | **by id**, FK `RESTRICT`, repointed by category merge (`taxonomy.ts`) | **No.** The migration says "the engine that consumes it is a separate change" (lines 4, 14). No caller outside `rules.ts` reads `matchPattern`. |
| `app.finance_ruling_rulebooks` (`20261114100000_…`)             | JSON: merchantRules, categoryRules, tagRules, coffeePatterns                                               | by name                                                               | Only as suggestions (`rulings.ts:53` `proposeRuling`)                                                                                           |
| `app.finance_sync_doctrine` (`20261122100100_…`, #614)          | one JSON blob per user: merchant/tag/amount/transfer/income/coffee/lenses, `exact`/`contains`/`startsWith` | **by name**                                                           | **No** on `main`. Only the S2 CLI evaluates it (`categorize.ts`).                                                                               |
| Proposed "owner-scoped learned rules" (S3 draft)                | not designed                                                                                               | —                                                                     | —                                                                                                                                               |

The [finance-sync-doctrine task](../tasks/finance-sync-doctrine.md) Notes chose
a dedicated store over `finance_rules` and the rulebooks on purpose. That was a
reasonable call at the time, but it has a consequence. A category merge or
rename repoints `finance_rules` but leaves doctrine and rulebook name references
stale: `taxonomy.ts` has no reference to the doctrine. The rule semantics also
differ (the match modes and ordering are not the same), so one merchant can be
classified differently depending on which store a surface reads.

There is also a conflict between recorded intent and how the CLI behaves.
`docs/finance-transaction-categorization.md:9-10` on `main` says merchant rules
"provide suggestions for future matching transactions. They do not categorize
new transactions automatically." The owner's S3 drafts keep that rule
(`docs/finance.categories.md`, "Transaction classification", and
`docs/finance.transactions.md`, "Category changes"). The S2 CLI does the
opposite: it computes a category from the doctrine and sends it on import
(`daily_sync.ts:157,217-218`). That **is** automatic categorization, carried out
by a client. Either doctrine rules are a deliberate exception (rules the owner
wrote, not learned suggestions), or the CLI breaks the recorded rule. Nothing
on record says which (D6).

### E4. The money representation changes at every boundary

- Storage: `numeric(14,2)` for transaction amount and balances
  (`20260326181100_create_app_finance_tables.sql`) and for
  `finance_monthly_budgets.monthly_amount`. `finance_budgets.amount_cents` is an
  `integer` with no currency: "denominated in the user profile's primary
  currency … resolved at read time"
  (`20261101120000_create_finance_budgets.sql:5-11,38-43`).
- Conversion: `toCents = Math.round(Number(x) * 100)`
  (`packages/finance/src/utils.ts:5-7`). The S3 draft moves it unchanged into
  `packages/finance/src/money.ts`, and its `naturalKey` keeps
  `Math.round(amount * 100)` (`ingest/contracts.ts`).
  That hard-codes two minor units. JPY (0 minor units) and KWD/BHD (3) would be
  stored or rounded incorrectly.
- DTOs: write models use `amountCents`. The MCP search read model returns a
  decimal `amount` (CLI `hominem.ts` header comment). The CLI keeps float
  `amount` on `SyncRow` and converts at the edge.
- Currency: `currency_code` defaults to `'USD'` on accounts and transactions.
  The CLI falls back to `'USD'` for a row with no currency (`toTxn` in
  `daily_sync.ts`). Accounts accept `allowedCurrencies` side buckets
  (`20261014120000_…`, `finance.service.ts:556-573`).
- Two budget models with opposite currency rules exist side by side: runway
  budgets are per category **and currency**, while `finance_budgets` uses the
  profile primary currency (`finance_primary_currency_set` MCP tool).

The multi-currency plan, which is marked "Product direction approved", rejects
several of these in its "Canonical money model" and "Alternatives considered"
sections: no binary floats, minor units from a currency catalogue, a
single-currency account, `allowedCurrencies` removed (B5), primary-currency
budgets replaced by an explicit `currency_code`, pending rows stored rather than
rejected, and a local rate table instead of a per-request provider call.

### E5. Ingest identity and re-sync behavior

- The CLI talks to Hominem as a remote MCP client authenticated by a personal
  `hmt_` token (`hominem.ts` header). The server derives the owner from that
  token. The CLI never needs to send a user ID, and must not be trusted to.
- `toTxn` sends no `externalId`, even though Starling and Plaid both have stable
  provider transaction IDs and `sheet-import.ts:61` accepts one ("Stable
  provider identity"). Deduplication therefore falls back to the natural key
  `(postedOn, account, description, amountCents, currency)`. When a provider
  changes its descriptor (for example from pending to posted), the row gets a
  new key.
- On `main`, an upsert keeps fields the caller leaves out
  (`sheet-import.ts:813-830`). The CLI's assumption that "upsert REPLACES"
  (B15, dated 2026-10-15) is out of date. But the CLI **does** send `category`
  and `tags` that the doctrine computed again (`daily_sync.ts:157-160,217-218`)
  for the overlap window it re-sends. This may overwrite a correction the user
  made in Web for that row. A baseline integration test confirmed the
  overwrite; the interim batch safeguard above now protects those fields.
- `ensureFinanceCategoryId` creates a category automatically from any unknown
  name on import (`sheet-import.ts:384-413`). A doctrine typo, or a seeded
  versus unseeded name, therefore creates a new category without telling anyone.

### E6. The CLI analytics are written for one owner

`forward_look.ts` hard-codes `timeline_gbp` and `timeline_usd` sections and an
`fx_runway` that converts at a live Frankfurter USD→GBP rate
(`FX_URL`, line 115). It reads card limits and salary rules from a
machine-local JSON file. `daily_sync.ts` and `forward_look.ts` cite dated owner
rulings, such as "Plaid is INGEST ONLY … (Charlie, 2026-11-06)". These are
personal routines. Calling them a "general finance adapter", as the task does,
is a goal, not a description of the code.

## Assumptions challenged

"Draft" means the owner's S3 draft task (E0). Challenging an assumption does not
overrule it. It only means the evidence does not yet support treating it as
settled.

| #   | Assumption (source)                                                                                                      | Evidence                                                                                                                                                                          | Assessment                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `@hominem/finance-services` already owns finance behavior and is the single authority (draft)                            | E1                                                                                                                                                                                | Not true today. Consolidation has to decide whether the API application layer or the package is the core. A third home (the CLI) makes the split worse.                                                                                                                                                                                                                                |
| A2  | The CLI must "require or accept an explicit user identity" and pass it to every operation (draft)                        | E5                                                                                                                                                                                | The S2 CLI is a remote MCP client, and the server derives the owner from its token. For a remote client, an explicit owner ID adds nothing and cannot be trusted. It only fits in-process callers, and a CLI importing DB-bound package code would need database credentials and would bypass API auth. The intent of isolating each user is sound. Which mechanism delivers it is D2. |
| A3  | One shared "cents / natural key" contract (draft W-002, implemented in S3)                                               | E4                                                                                                                                                                                | S3 moves the 2dp `* 100` conversion and the description-based key into the package unchanged. Treating that as the shared contract raises the cost of the multi-currency rollout (D14).                                                                                                                                                                                                |
| A4  | The `personal-finance-v1` 32-category seed for new users (draft W-003, implemented and tested in S3)                     | `category-seed.ts` and `category-seed.integration.test.ts` exist in S3, but **no caller** invokes `seedFinanceCategories`. Import still auto-creates unknown category names (E5). | This is the owner's draft intent, not an agent invention. Still open: confirming the list, what triggers the seed (signup, first import, or explicit), and how it interacts with auto-creation (D5).                                                                                                                                                                                   |
| A5  | A new owner-scoped "learned rules" store with provenance (draft)                                                         | E3                                                                                                                                                                                | This would be the fifth classification mechanism. Consolidating the existing ones first is cheaper (D4, D6).                                                                                                                                                                                                                                                                           |
| A6  | Provider adapters (Starling, Plaid) belong in `packages/finance` (draft)                                                 | `packages/finance` imports `@hominem/db/core` throughout. Providers bring OAuth secrets.                                                                                          | Depends on where sync runs (D1). In-package adapters help only if the server runs sync. A local-only CLI does not need them in a DB-bound package.                                                                                                                                                                                                                                     |
| A7  | Report math (brief, close, integrity, forward look) should move to the package (draft W-007)                             | E6                                                                                                                                                                                | It is general only once the currency and personal-input assumptions are removed. Otherwise the package just holds personal routines (D11).                                                                                                                                                                                                                                             |
| A8  | The doctrine store as a separate table is settled (finance-sync-doctrine Notes; tools spec §0 says "do not re-litigate") | E3                                                                                                                                                                                | A reasonable local decision. It is still open for consolidation because names drift after merges and the rule semantics differ.                                                                                                                                                                                                                                                        |
| A9  | "Plaid is ingest-only" (CLI comments, draft)                                                                             | An owner ruling recorded in code comments and the draft                                                                                                                           | Preserved as stated owner intent. Whether it is a product rule for all users is D3.                                                                                                                                                                                                                                                                                                    |
| A10 | Merchant rules are suggestion-only (`main` doc, S3 drafts)                                                               | E3: the S2 CLI auto-assigns doctrine categories on import                                                                                                                         | Recorded intent and current CLI behavior conflict (D6).                                                                                                                                                                                                                                                                                                                                |

## Options

### O0. Status quo: land the CLI as is

Merge the wealth-manager as a remote MCP client. Keep its categorization,
transfer linking, and reports local.

- Cost: lowest.
- Risks: a third finance home. Doctrine evaluation runs only on one machine, so
  Web and other agents never see the same categorization. Re-sync may overwrite
  edits (E5). Personal analytics stay outside CI.
- Falsifier: if the CLI is meant to stay a single-owner operator tool forever
  (D2 = owner tool), O0 may be good enough once E5 has a test.

### O1. Task plan: extract into `@hominem/finance-services`; the CLI imports it

- Cost: XL (task estimate).
- Benefits: one implementation of pure helpers. Mock-first provider adapters.
- Risks: the CLI starts depending at runtime on a DB-bound package. The
  S3 `types.ts` re-exports `@hominem/finance-services/ingest/contracts`
  and adds a `workspace:*` dependency, and only keeps database modules out of
  its runtime imports by careful subpath choice. It freezes the 2dp money
  contract (A3) and adds a fourth rule store (A5). It does nothing about API
  application-layer logic (E1) or about human/agent parity (E2).
- Falsifier: if the API application finance services were moved into the
  package anyway, and sync stayed local, O1 would collapse into O3.

### O2. Server-owned finance core; every client is remote

Merge `packages/finance` and `services/api/src/application/finance*` into one
application core called only by the RPC and MCP adapters. Run provider sync as
a server job (BullMQ worker already exists), so credentials are held
server-side. The CLI becomes a thin MCP/RPC client, or only a trigger.

- Benefits: one place for writes, authorization, idempotency, and
  classification. People and agents get the same behavior because there is
  only one implementation. Fits the "thin adapter" rule.
- Costs: provider OAuth and secret custody move into the hosted service, which
  is a security and compliance change. Offline and local-first agent use is
  lost.
- Falsifier: if the product owner wants provider credentials to never leave the
  user's machine (D1), O2 is ruled out.

### O3. Pure kernel plus server application core (hybrid)

Two layers:

1. **Kernel**: no DB, no I/O, no secrets. A money value object (minor units +
   currency), date/period math, one rule-evaluation engine over a single rule
   model, transfer-pair matching, runway/projection math, and provider-row
   normalization. Any client can import it, including a local CLI, without
   database credentials.
2. **Application core**: DB orchestration, authorization, idempotent writes,
   and rule persistence. It is the only writer. RPC and MCP are thin adapters
   over it (A1 resolved by moving the API finance services and the package's DB
   code into one place).

Sync can run on either side (D1), because the kernel does the same
normalization and classification wherever it runs. The server re-validates
every write.

- Benefits: makes the "same contracts and calculations" goal true without
  forcing credential custody. Isolates the money model so the multi-currency
  rollout changes one value type rather than every call site.
- Costs: the largest design effort up front. The kernel API must be designed,
  not copied from the CLI. Classification can still drift if clients send
  categories they computed themselves, so the server must either recompute or
  record provenance.
- Falsifier: if no second consumer of the kernel appears (no local runner, no
  mobile on-device evaluation), the kernel is speculative and O2 is simpler.
  That would violate YAGNI.

## Recommendation (proposed, not accepted)

**O3, built in stages and gated by consumers.** This is the analyst's
recommendation. It is not a requirement. Steps 2–6 each take a position on an
open decision (named in brackets), and the product owner may resolve that
decision differently.

1. **Phase 0: reconcile before moving code. This step does not depend on any
   open decision.** Decide how S2 and S3 come together with `main` (D12): S2 is
   missing #614, S3 is uncommitted, and the task file exists at two paths in two
   versions (E0). Record S3's W-002 and W-003 as written and tested locally, but
   not shipped. Add a test that settles E5 (does an overlap re-sync overwrite a
   user's category or tag edit?) before building anything on top of it.
2. **[D4, D6] One rule model before any learning.** Pick one store and one
   semantics (D4), keyed by category **id**, so merges and renames stay
   consistent. Migrate the other stores into it. Run one engine server-side
   on every write path (import, upsert, CLI sync). Only then add learning from
   corrections (D6). Rulings already provide the "propose, then confirm" loop.
   The seed (D5) does not depend on this step: it creates category rows only.
3. **[D14] Money as a value object in the kernel, with no schema change here.** Add a
   currency-aware minor-unit type and conversion that takes the minor-unit
   scale from data. Use it at the new kernel boundaries only. This honors the
   user's choice to keep the schema and rate rollout separate, while making sure
   the consolidation does not freeze the `* 100` contract.
4. **[D10] Every capability defined once and exposed to both people and agents**
   unless a product decision excludes it (D10). For example, browser import
   stays removed per pfin-merge until a product decision restores it.
5. **[D11] Personal routines stay local adapters** (morning brief, forward look,
   close) until D11 decides they are product features. If they become features,
   they are rebuilt on the kernel without hard-coded currencies or live FX.
6. **[D2] Remote identity.** Remote clients never pass an owner ID. Only
   in-process callers do, and only behind the API's auth boundary. This
   challenges the draft's wording (A2) but keeps its goal of isolating each
   user.

What would change this recommendation:

- D1 = server-side sync and D2 = no local runner → choose O2.
- D2 = owner-only tool and no multi-user agent requirement → O0 plus the E5 fix.
- The multi-currency rollout is scheduled first → do Phase 0 and step 2, but
  build the money type to match that plan's `amount_minor` model exactly.

## Money model scrutiny

This is an analysis of the money model only. The multi-currency rollout remains
separate.

- **Precision:** `numeric(14,2)` and `* 100` assume two decimal places. That is
  wrong for zero- and three-decimal currencies and caps values at about 10^12.
  The plan's `amount_minor` plus a catalogue scale fixes this. A kernel value
  type should be written so it can be adopted before the column migration.
- **Floats:** the CLI and MCP read models carry decimal `number` amounts.
  Equality, sums, and the natural key then depend on rounding at each hop.
  Integer minor units end to end would remove that whole class of bug.
- **Default currency `'USD'`:** a silent default puts a currency on rows whose
  currency is unknown. A missing currency should be a named rejection, not a
  default.
- **Side-bucket accounts vs single-currency accounts:** shipped behavior
  (`allowedCurrencies`) contradicts the approved plan (B5). A consolidated core
  must not add new readers of `allowedCurrencies` beyond the existing ones.
- **Primary-currency budgets:** `finance_budgets` amounts change meaning when
  the profile currency changes, which is the exact failure the plan's
  account-currency rule exists to prevent. Two budget tables also mean two
  budget truths (D8).
- **Live FX in reports:** `forward_look`'s live rate gives answers that cannot
  be reproduced, which the plan rejects. Report math moved into a shared core
  must not include it.
- **Natural key includes the description:** this is fragile across provider
  descriptor changes. One option is to make the provider `externalId` the
  primary identity when one exists and fall back to the composite key that
  pfin-merge requires. Choosing it changes the pfin-merge identity contract, so
  it is D13 and not settled here.

## Open product decisions

Each item is **OPEN — USER DECISION REQUIRED**.

- **D1 Where provider sync runs.** Options: on the user's machine (the CLI), as
  a Hominem worker, or both. This decides who holds credentials.
- **D2 Who the CLI is for, and how it proves identity.** Options: a general
  multi-user agent runner, or the owner's operator tool. The owner's draft says
  general; the S2 code is personal (E6). Then: does each user's identity come
  from their token at the server (the S2 behavior), or from an explicit owner
  argument (the draft's wording)?
- **D3 Plaid ingest-only.** Is this a product rule for all users, or the
  owner's personal policy?
- **D4 One classification model.** Which of `finance_rules`, rulebooks, and
  doctrine survives? Which match modes and ordering? Are categories referenced
  by id or by name?
- **D5 Default category seed.** The owner's draft proposes the 32-category
  `personal-finance-v1` seed, and S3 implements and tests it. Still to decide:
  confirm or revise the list, choose what triggers it (signup, first import, or
  an explicit action; nothing calls it today), and decide how it interacts with
  categories auto-created on import.
- **D6 Learning and automatic classification.** Should corrections turn into
  rules automatically, or only become proposals confirmed through rulings? Are
  rules the owner wrote (the doctrine) allowed to categorize on import, which
  the S2 CLI already does, even though recorded intent says merchant rules are
  suggestion-only (A10)?
- **D7 Re-sync vs user edits.** On a re-sync, should a user's manual category,
  tag, or notes always win over values computed by ingest?
- **D8 Budget model.** Keep `finance_budgets` (primary currency, periods,
  pacing) or `finance_monthly_budgets` (per currency, runway), or merge them.
  Is "primary currency" a product concept at all, given that the plan says
  there is no primary currency?
- **D9 Pending rows.** Keep rejecting them (current code, CLI, task) or store
  them with a status (the plan's chosen alternative).
- **D10 Parity rule.** Must every finance capability be available to both
  people and agents? Which exceptions are deliberate (for example, browser
  import was removed)?
- **D11 Personal routines.** Should the morning brief, integrity check, monthly
  close, and forward look become product features, or stay owner routines?
- **D12 Code state and integration.** Should S2 be merged with `main` (bringing
  in #614) and S3 committed on top, or should the work be redone against
  `main`? Which version of `docs/tasks/finance-cli-migration.md` (the owner's
  S3 draft, this worktree's revision, or a merge of the two) becomes the
  record? Do the S3 deletions of `docs/finance-transaction-categorization.md`
  and the `Implemented` `docs/tasks/finance-transactions-redesign.md` stand?
- **D13 Ingest identity.** Keep the pfin-merge natural key as the only dedupe
  identity, or make the provider `externalId` primary with the natural key as
  the fallback?
- **D14 Money boundary timing.** Introduce a currency-aware minor-unit value
  now, at new shared boundaries only; keep `* 100` until the multi-currency
  rollout; or put that rollout ahead of the consolidation?

## Migration implications

- **No schema change** is implied by accepting O3's staging itself. Steps 2 and
  3 of the recommendation create migrations later (rule-store consolidation,
  then money columns under the separate multi-currency plan). Each follows the
  `hominem-database` skill and the RLS rules.
- Consolidating rule stores needs a data migration from name references to id
  references. Any name that cannot be resolved is held for the user to rule on,
  never guessed.
- Moving the API finance services into one core changes import paths for MCP
  and RPC, but not their wire contracts. The MCP tool catalog
  (`services/evals/lib/mcp-tool-catalog.generated.json`) and the RPC `AppType`
  must stay stable or be versioned deliberately.
- The CLI wealth-manager should land, if it lands, as an MCP client with no
  `workspace:*` runtime dependency on DB-bound packages. S3 adds exactly that
  dependency (`packages/cli/package.json`), so D12 decides whether to keep it.
- **Integration conflict.** This worktree (based on `main`) and the owner's
  checkout (S2 plus S3) both have `docs/tasks/finance-cli-migration.md`, with
  different content. Whoever brings the two lines together must compare them
  by hand. Neither version should overwrite the other automatically.
- S3's new `docs/finance.{transactions,ingest,categories}.md` are not on `main`.
  This document names them by path rather than linking to them, so its links
  still resolve on `main`.

## Related

- [finance.pfin-merge](finance.pfin-merge.md): historical decision (accepted
  2026-09-08)
- [finance-cli-migration task (PON-348)](https://linear.app/ponti-studios/issue/PON-348/finance-cli-migration-and-core-consolidation)
- [finance-sync-doctrine task](../tasks/finance-sync-doctrine.md)
- [Finance multi-currency redesign plan](../finance-multi-currency-redesign-plan.md)
- [Hominem finance tools spec](../hominem-finance-tools-spec.md)
- [Finance transaction categorization](../finance-transaction-categorization.md)
- [Finance budgets](../finance-budgets.md)
- [Web sub-apps](../web.sub-apps.md)
