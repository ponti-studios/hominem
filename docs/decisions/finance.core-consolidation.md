# Finance core consolidation for humans and agents

## Status

Proposed (2026-11-25). **Not accepted.** This is an evidence-backed
recommendation for the product owner to accept, amend, or reject. It does not
supersede [finance.pfin-merge](finance.pfin-merge.md), which stays the
historical record of the 2026-09-08 decision. Nothing here is approved until the
open decisions below are resolved and this status changes.

## Question

Should Hominem consolidate its finance logic into one core that people (Web,
mobile, RPC) and agents (MCP, CLI agent runners, third-party clients) use
through the same contracts? If so, where should that core's boundary sit, and
what must be settled first?

This goes beyond the narrower plan in
[finance-cli-migration](../tasks/finance-cli-migration.md), which is to move the
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

## Evidence base

### E0. Three states of the code, not one

| State                     | Where                                            | Contents                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`                    | `34bf4a38c` (this branch's base)                 | `packages/finance`, the API finance services, RPC, MCP, Web, the sync doctrine store and provider account identity (#614). **No CLI wealth-manager**: `packages/cli/src` has only Google/auth/rclone/launchd modules. |
| Unmerged session baseline | agent session `a2108450…` checkpoint `5d01d78ce` | Adds `packages/cli/src/agent/**` with the `wealth-manager` system (about 5,800 lines in 13 modules) and `packages/cli/tests/agent/wealth_*.test.ts`. It does **not** include #614's doctrine store.                   |
| Unmerged session tip      | checkpoint `9b71619cd`                           | Adds `packages/finance/src/ingest/contracts.ts`, `money.ts`, `category-seed.ts` and its test, plus `docs/finance.{transactions,ingest,categories}.md` and the original `docs/tasks/finance-cli-migration.md`.         |

These checkpoint refs have no common ancestor with `main`
(`git merge-base 34bf4a38c 9b71619cd` returns nothing). Anything that exists
only in the checkpoints has **not shipped**. That includes the task's
"Implemented" W-002 and W-003. It was also never run against `main`'s CI.

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
3. The unmerged CLI (`wealth-manager/*.ts`): sync, categorization, transfer
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

Runway shows that duplication happens in the adapters. Both
`services/api/src/mcp/tools/finance.ts:363-390` and
`services/api/src/rpc/routes/finance.ledger.ts:72-84` call
`computeLedgerRunway` directly. Each builds the budget input differently: MCP
merges per-call overrides and filters by the forecast currency, while RPC
passes every saved budget. They return the same result today only because
`runway.ts:443-445` filters again. This breaks the rule in
`services/api/AGENTS.md:22` that each surface is a thin adapter over one
application service.

### E3. Four ways to store classification rules, none applied to transactions on `main`

| Store                                                           | Shape                                                                                                      | Category reference                                                    | Applied to transactions on `main`?                                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.finance_rules` (`20261101100000_create_finance_rules.sql`) | rows: priority, `exact`/`contains`/`regex`                                                                 | **by id**, FK `RESTRICT`, repointed by category merge (`taxonomy.ts`) | **No.** The migration says "the engine that consumes it is a separate change" (lines 4, 14). No caller outside `rules.ts` reads `matchPattern`. |
| `app.finance_ruling_rulebooks` (`20261114100000_…`)             | JSON: merchantRules, categoryRules, tagRules, coffeePatterns                                               | by name                                                               | Only as suggestions (`rulings.ts:53` `proposeRuling`)                                                                                           |
| `app.finance_sync_doctrine` (`20261122100100_…`, #614)          | one JSON blob per user: merchant/tag/amount/transfer/income/coffee/lenses, `exact`/`contains`/`startsWith` | **by name**                                                           | **No** on `main`. Only the unmerged CLI evaluates it (`categorize.ts`).                                                                         |
| Proposed "owner-scoped learned rules" (task)                    | not designed                                                                                               | —                                                                     | —                                                                                                                                               |

The [finance-sync-doctrine task](../tasks/finance-sync-doctrine.md) Notes chose
a dedicated store over `finance_rules` and the rulebooks on purpose. That was a
reasonable call at the time, but it has a consequence. A category merge or
rename repoints `finance_rules` but leaves doctrine and rulebook name references
stale: `taxonomy.ts` has no reference to the doctrine. The rule semantics also
differ (the match modes and ordering are not the same), so one merchant can be
classified differently depending on which store a surface reads.

### E4. The money representation changes at every boundary

- Storage: `numeric(14,2)` for transaction amount and balances
  (`20260326181100_create_app_finance_tables.sql`) and for
  `finance_monthly_budgets.monthly_amount`. `finance_budgets.amount_cents` is an
  `integer` with no currency: "denominated in the user profile's primary
  currency … resolved at read time"
  (`20261101120000_create_finance_budgets.sql:5-11,38-43`).
- Conversion: `toCents = Math.round(Number(x) * 100)`
  (`packages/finance/src/utils.ts:5-7`). The snapshot's `money.ts` copies it.
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
  made in Web for that row. **No test proves or disproves this.**
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

| #   | Assumption (source)                                                                                                      | Evidence                                                                                 | Assessment                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `@hominem/finance-services` is the single write/read authority (task)                                                    | E1                                                                                       | False today. Consolidation has to decide whether the API application layer or the package is the core. Adding a third home (the CLI) makes it worse.                                                                                                                                                             |
| A2  | The CLI must "require or accept an explicit user identity" and pass it to every operation (task)                         | E5                                                                                       | Wrong frame for a remote client. Identity belongs at the server's auth boundary. An explicit `userId` argument makes sense only for in-process callers, which today means the server. A CLI that imports DB-bound package code would need database credentials and would bypass RLS policy context and API auth. |
| A3  | One shared "cents / natural key" contract (task W-002)                                                                   | E4                                                                                       | It hard-codes two minor units and the description-based key. Freezing it as a shared contract now raises the cost of the multi-currency rollout.                                                                                                                                                                 |
| A4  | A 32-category seed is a requirement (task W-003)                                                                         | No product doc approves a seed or its list. Import already auto-creates categories (E5). | Product decision, not a requirement. See D5.                                                                                                                                                                                                                                                                     |
| A5  | A new owner-scoped "learned rules" store with provenance (task)                                                          | E3                                                                                       | This would be the fifth classification mechanism (the four stores in E3 plus this one). Consolidate first.                                                                                                                                                                                                       |
| A6  | Provider adapters (Starling, Plaid) belong in `packages/finance` (task)                                                  | `packages/finance` imports `@hominem/db/core` throughout. Providers bring OAuth secrets. | That depends on where sync runs (D1). In-package adapters are useful only if the server runs sync. A local-only CLI does not need them in a DB-bound package.                                                                                                                                                    |
| A7  | Report math (brief, close, integrity, forward look) should move to the package (task W-007)                              | E6                                                                                       | It is general only once the currency and personal-input assumptions are removed. Otherwise you get personal routines with a shared package's name on them.                                                                                                                                                       |
| A8  | The doctrine store as a separate table is settled (finance-sync-doctrine Notes; tools spec §0 says "do not re-litigate") | E3                                                                                       | That was a reasonable local decision. It is still open for consolidation because of the name-reference drift and the split in semantics.                                                                                                                                                                         |
| A9  | "Plaid is ingest-only" (CLI comments, task)                                                                              | Recorded as an owner ruling in code comments only                                        | Preserved as stated user intent. It needs confirmation as a product rule for all users, not only the owner (D3).                                                                                                                                                                                                 |

## Options

### O0. Status quo: land the CLI as is

Merge the wealth-manager as a remote MCP client. Keep its categorization,
transfer linking, and reports local.

- Cost: lowest.
- Risks: a third finance home. Doctrine evaluation runs only on one machine, so
  Web and other agents never see the same categorization. Re-sync can overwrite
  edits (E5). Personal analytics stay outside CI.
- Falsifier: if the CLI is meant to stay a single-owner operator tool forever
  (D2 = owner tool), O0 may be good enough once E5 has a test.

### O1. Task plan: extract into `@hominem/finance-services`; the CLI imports it

- Cost: XL (task estimate).
- Benefits: one implementation of pure helpers. Mock-first provider adapters.
- Risks: the CLI starts depending at runtime on a DB-bound package. The
  snapshot's `types.ts` re-exports `@hominem/finance-services/ingest/contracts`
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

**O3, built in stages and gated by consumers**, with these conditions:

1. **Phase 0: reconcile before moving code.** Decide which code state is
   authoritative (E0). Mark the task's W-002 and W-003 as not shipped. Add a
   test that resolves E5 (does an overlap re-sync overwrite a user's category or
   tag edit?) before building anything on top of it.
2. **One rule model before any seed or learning.** Pick one store and one
   semantics (D4), keyed by category **id**, so merges and renames stay
   consistent. Migrate the other stores into it. Run one engine server-side
   on every write path (import, upsert, CLI sync). Only then consider the seed
   (D5) and learning from corrections (D6). Rulings already provide the
   "propose, then confirm" loop.
3. **Money as a value object in the kernel, with no schema change here.** Add a
   currency-aware minor-unit type and conversion that takes the minor-unit
   scale from data. Use it at the new kernel boundaries only. This honors the
   user's choice to keep the schema and rate rollout separate, while making sure
   the consolidation does not freeze the `* 100` contract.
4. **Every capability defined once and exposed to both people and agents**
   unless a product decision excludes it (D10). For example, browser import
   stays removed per pfin-merge until a product decision restores it.
5. **Personal routines stay local adapters** (morning brief, forward look,
   close) until D11 decides they are product features. If they become features,
   they are rebuilt on the kernel without hard-coded currencies or live FX.
6. **Remote identity.** Remote clients never pass an owner ID. Only in-process
   callers do, and only behind the API's auth boundary.

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
  descriptor changes. Provider `externalId` should be the primary identity when
  one exists, with the composite key (required by pfin-merge) as the fallback.

## Open product decisions

Each item is **OPEN — USER DECISION REQUIRED**.

- **D1 Where provider sync runs.** Options: on the user's machine (the CLI), as
  a Hominem worker, or both. This decides who holds credentials.
- **D2 Who the CLI is for.** Options: a general multi-user agent runner, or the
  owner's operator tool. The task says general; the code is personal (E6).
- **D3 Plaid ingest-only.** Is this a product rule for all users, or the
  owner's personal policy?
- **D4 One classification model.** Which of `finance_rules`, rulebooks, and
  doctrine survives? Which match modes and ordering? Are categories referenced
  by id or by name?
- **D5 Default category seed.** Whether to have one, which list (the task's 32
  categories are unreviewed), when to apply it (signup or first import), and how
  it interacts with categories auto-created on import.
- **D6 Learning from corrections.** Should corrections turn into rules
  automatically, or only become proposals confirmed through rulings?
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
- **D12 Code state.** Is the unmerged agent-session work (E0) the base for this
  effort, or should it be redone against `main`?

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
  `workspace:*` runtime dependency on DB-bound packages.

## Related

- [finance.pfin-merge](finance.pfin-merge.md): historical decision (accepted
  2026-09-08)
- [finance-cli-migration task](../tasks/finance-cli-migration.md)
- [finance-sync-doctrine task](../tasks/finance-sync-doctrine.md)
- [Finance multi-currency redesign plan](../finance-multi-currency-redesign-plan.md)
- [Hominem finance tools spec](../hominem-finance-tools-spec.md)
- [Finance transaction categorization](../finance-transaction-categorization.md)
- [Finance budgets](../finance-budgets.md)
- [Web sub-apps](../web.sub-apps.md)
