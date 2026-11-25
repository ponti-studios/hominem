---
title: 'Finance CLI migration and core consolidation'
status: 'Proposed'
priority: 'high'
labels: [finance, cli, mcp, rpc]
depends_on: []
blocks: []
estimated_size: 'XL'
---

## Outcome

The owner directed implementation of the server-owned CLI finance migration.
The CLI keeps provider credentials and machine-local state; the API owns
ingest, classification, routing, writes, and reports. The broader architecture
and product decisions in the proposed (not accepted)
[finance core consolidation](../decisions/finance.core-consolidation.md) remain
open; the implementation uses reversible compatibility and data-safety
defaults rather than treating those decisions as settled.

The analysis considered these alternatives before the implementation direction:

- **Owner's draft:** reusable finance logic moves from the CLI wealth-manager
  into `@hominem/finance-services`, so any app or agent manages a user's
  finances through the same package contracts. The CLI keeps credentials,
  machine-local state, logging, argument parsing, and output.
- **Server-owned core (O2):** one server-side finance core. Every client,
  including the CLI, is a remote RPC or MCP client, and provider sync may run as
  a server job.
- **Kernel plus server core (O3, the analyst's recommendation):** a pure kernel
  with no database access, which any client can import, plus one server-side
  core that does every write.
- **Land as-is (O0):** the CLI lands as the owner's MCP client, its logic stays
  local, and only the E5 fix is made.

## Provenance and integration conflict

This file has **two versions**. Neither replaces the other:

- **The owner's draft:** an untracked file at this same path in the owner's main
  checkout, on `feature/web-perf-cleanup`, with uncommitted edits made on
  2026-11-25. It is the owner's current intent.
- **This revision:** written in a separate worktree based on `main` from an
  architecture analysis. It separates what has shipped from what has not, and
  turns draft requirements that depend on open decisions into decisions.

Bringing the two lines together will collide on this path: an untracked file
blocks checkout, and two committed versions give an add/add conflict. The owner
reconciles the two versions by hand (decision D12). Agent-session snapshot
commits `5d01d78ce` and `9b71619cd` are older copies of the owner's draft state.
They are not authoritative.

[finance.pfin-merge](../decisions/finance.pfin-merge.md) remains the historical
decision for the earlier pfin port. This task does not amend it.

## Directly stated decisions this task preserves

- Hominem is the system of record (pfin-merge).
- Browser upload of statements stays removed (pfin-merge, product direction).
- The full multi-currency schema and rate rollout is a **separate**
  implementation
  ([multi-currency plan](../finance-multi-currency-redesign-plan.md)). Its money
  model is examined, not implemented, here.
- No user identity, account, balance, transaction, merchant, rule, or provider
  credential is hard-coded in shared code or fixtures. Fixtures use synthetic
  identities.

## The owner's draft positions (uncommitted)

The owner's draft states the positions below. They are kept here as stated
intent. Where evidence challenges one, the decision document records the
challenge and an open decision. The challenge does not override the position.

| Draft position                                                                                  | Status in the analysis                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The CLI is a general finance adapter, not a routine for one person                              | Matches neither the S2 code nor any accepted decision yet (D2, D11) |
| Operations take an explicit owner identity; provider state is isolated per user                 | Goal kept; mechanism challenged for remote clients (A2, D2)         |
| `personal-finance-v1` 32-category seed for new users, categories only                           | Implemented and tested in S3; list and trigger open (D5)            |
| Merchant rules are suggestion-only; learned rules are owner-scoped, reversible, with provenance | Conflicts with CLI doctrine auto-categorization (A10, D4, D6)       |
| Plaid is ingest-only                                                                            | Kept as owner intent; scope across all users open (D3)              |
| Provider adapters, sync orchestration, and report math move into the package                    | Depends on D1 and D11                                               |
| Natural-key upserts and the cents contract are the write contract                               | Open (D13, D14)                                                     |

## Verified state

The three code states are S1, S2, and S3, as defined in E0 of the
[decision document](../decisions/finance.core-consolidation.md).

| Capability                                                                                  | S1 `main` (`34bf4a38c`)                                                               | S2 `feature/web-perf-cleanup` (committed)                 | S3 uncommitted (owner's checkout)                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Accounts, transactions, sheet import, runway, reconcile, diagnostics, taxonomy, rules CRUD  | yes, `packages/finance/src/*`                                                         | yes                                                       | yes                                                                               |
| Budgets, bills, rulings execution, transaction management in the API layer                  | yes, `services/api/src/application/finance*.ts`                                       | yes (missing #614's doctrine service)                     | same as S2                                                                        |
| Sync doctrine store, `finance_doctrine_get`, provider account identity (#614)               | yes, `services/api/src/mcp/tools/finance-doctrine.test.ts:79`                         | **no**                                                    | no                                                                                |
| CLI wealth-manager (14 files) and `wealth_*` tests                                          | no                                                                                    | yes, `packages/cli/src/agent/systems/wealth-manager/`     | yes; `types.ts` becomes a re-export                                               |
| `ingest/contracts.ts`, `money.ts` (moved `toCents`)                                         | no                                                                                    | no                                                        | yes, untracked, with `ingest/contracts.test.ts`                                   |
| `seedFinanceCategories` and `personal-finance-v1`                                           | no                                                                                    | no                                                        | yes, untracked, with `category-seed.integration.test.ts`; **no caller**           |
| CLI depends on `@hominem/finance-services` (`workspace:*`)                                  | no                                                                                    | no                                                        | yes, `packages/cli/package.json`                                                  |
| `docs/finance-transaction-categorization.md`, `docs/tasks/finance-transactions-redesign.md` | present (the redesign is `Implemented`)                                               | present                                                   | **deleted**; content moved to the new `docs/finance.{transactions,categories}.md` |
| Import keeps fields the caller omits                                                        | `packages/finance/src/sheet-import.ts:813-830`                                        | same                                                      | same                                                                              |
| Import accepts a provider `externalId`                                                      | `sheet-import.ts:61,349-350`; the CLI never sends it                                  | CLI: no `externalId` in `toTxn` (`daily_sync.ts:203-220`) | same                                                                              |
| Pending rows rejected (`pending_row`)                                                       | `sheet-import.ts:56,212`                                                              | same                                                      | same                                                                              |
| Unknown category names auto-created on import                                               | `sheet-import.ts:384` (`ensureFinanceCategoryId`)                                     | same                                                      | same                                                                              |
| `finance_rules` stored, **with no engine applying it**                                      | `packages/db/migrations/20261101100000_create_finance_rules.sql:4,14`                 | same                                                      | same                                                                              |
| MCP and RPC runway build budget input separately                                            | `services/api/src/mcp/tools/finance.ts:363-390`, `rpc/routes/finance.ledger.ts:72-84` | same                                                      | same                                                                              |
| Money conversion assumes two minor units                                                    | `packages/finance/src/utils.ts:5-7`                                                   | same                                                      | moved to `money.ts` unchanged; `naturalKey` keeps `* 100`                         |

How the S2 CLI behaves:

- It is a remote MCP client using a personal `hmt_` token (`hominem.ts:5`). The
  server derives the owner from the token.
- It evaluates the doctrine locally (`categorize.ts`), sends the computed
  `category` and `tags` on import (`daily_sync.ts:157,217-218`), and defaults a
  missing currency to `'USD'` (`daily_sync.ts:214`).
- `forward_look.ts:115` fetches a live Frankfurter USD→GBP rate and hard-codes
  GBP/USD timelines.

The draft marks W-002 and W-003 "Implemented". In this revision they count as
**written and tested locally in S3, not shipped**: they are uncommitted and
have never run in `main`'s CI. This analysis did not run them, so that the
owner's checkout stayed untouched.

## Original gaps and current work

The original inventory below remains evidence of the starting states, not a
claim that every gap still exists. The current worktree implements provider
sync and seed, live balances, shared runway orchestration, the four report
routines (`hominem wealth brief`, `look`, `close`, and `integrity` over the
`finance_wealth_*` tools), and the CLI OAuth adapter. Re-sync preserves user
annotations, and the sync keeps provider IDs. This branch merges the committed
S2 `feature/web-perf-cleanup` state and deletes
`packages/cli/src/agent/systems/wealth-manager/` and its `wealth_*` tests. The
Starling and Plaid REST clients moved to `packages/cli/src/agent/connectors/`
as local transport, without the superseded categorizing pull. The CLI env
loader is one module, `packages/cli/src/env.ts`. The owner's uncommitted S3
work, including their same-path draft of this task, stays untouched in their
checkout and needs manual integration. The task stays `Proposed` because D11
and the other open decisions are unresolved.

| Gap                                                                                                       | Why it matters                                                                                                               |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| G1 Three code states (S1, S2, S3) and two versions of this task                                           | S2 lacks #614, which the CLI needs. Full CLI integration requires reconciling S3 and the task versions (D12).                |
| G2 Four classification stores, and none applies rules to imported transactions on `main`                  | Surfaces can classify the same merchant differently. Stores that reference categories by name drift after a merge or rename. |
| G3 Sync sends no provider `externalId`                                                                    | Dedupe depends on the description, so a descriptor change creates a duplicate. The fix is decision D13.                      |
| G4 Overlap re-sync may overwrite a user's category or tag edits                                           | Reproduced on the baseline. Provider batches now preserve category, tags, and notes by default; D7 remains open.             |
| G5 Finance logic is split between `packages/finance` and `services/api/src/application`                   | "The package already owns finance behavior" is not true yet.                                                                 |
| G6 People and agents get different capabilities                                                           | Whether they must be equal is D10.                                                                                           |
| G7 Money is 2dp `* 100` with a `'USD'` default, `allowedCurrencies` buckets, and primary-currency budgets | Contradicts the multi-currency plan. When to address it is D14.                                                              |
| G8 Recorded intent says merchant rules are suggestion-only; the CLI auto-categorizes on import            | Recorded intent and behavior disagree (D6).                                                                                  |
| G9 The S3 doc move drops the `Implemented` redesign task's record and evidence                            | That history is lost unless the move keeps it (D12).                                                                         |

## Work sequence

### Reconciliation and safety work

| ID    | Work item                                                            | Depends on    | Validation               | Done when                                                                                          |
| ----- | -------------------------------------------------------------------- | ------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| W-000 | The product owner resolves, amends, or rejects the decision document | product owner | —                        | Each D1–D14 is recorded without assuming implementation accepted it                                |
| W-001 | Reconcile S1/S2/S3 and the two versions of this task                 | —             | `pnpm run tasks:check`   | One task version is the record. S3 is committed, revised, or discarded deliberately.               |
| W-002 | Prove or disprove re-sync overwrite (G4)                             | —             | finance integration test | Baseline test confirmed the overwrite; the provider-batch safeguard is covered by regression tests |
| W-003 | Inventory every wealth-manager behavior against S1                   | —             | inventory reviewed       | Each behavior maps to an existing function, a gap, or a personal routine                           |

### Later work: options that depend on decisions, not requirements

Each row lists broader options. Current compatibility defaults do not settle
them; each remains **OPEN — USER DECISION REQUIRED**.

| Area                       | Decision | Options                                                                                                                                                                        |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Classification rules       | D4, D6   | Keep separate stores; consolidate into `finance_rules` (category ids); consolidate into the doctrine; a new model. Plus: applied server-side, client-side, or suggestion-only. |
| Ingest identity            | D13      | Keep the pfin-merge natural key only; `externalId` primary with natural-key fallback                                                                                           |
| Money boundary             | D14      | A currency-aware minor-unit value at new boundaries now; keep `* 100` until the multi-currency rollout; do the rollout first                                                   |
| Surface parity             | D10      | Every capability on both RPC and MCP unless excluded; per-capability choices; leave as is                                                                                      |
| Adapter consolidation      | D10, D1  | MCP and RPC call one service per capability (runway first); the package becomes the core; the API application layer becomes the core                                           |
| Provider adapters and sync | D1       | Stay in the CLI; move into the package with injected credentials; move to a server job                                                                                         |
| CLI identity               | D2       | Token-derived owner at the server; an explicit owner argument for in-process callers                                                                                           |
| Category seed              | D5       | Ship `personal-finance-v1` as drafted; revise the list; no seed. Trigger: signup, first import, or explicit                                                                    |
| Reports                    | D11      | Stay owner routines in the CLI; become product features rebuilt without hard-coded currencies or live FX                                                                       |
| Pending rows               | D9       | Keep rejecting them; store them with a status                                                                                                                                  |

## Acceptance criteria

These criteria cover this migration without treating the broader open decisions
as accepted.

- [ ] Open decisions and reversible implementation assumptions are identified
      without claiming product approval.
- [ ] The same-path task conflict is identified and neither version silently
      replaces the other.
- [ ] CLI sync, seed, balances, and report capabilities use the server-owned
      implementation; provider secrets stay local.
- [x] A test establishes whether an overlap re-sync can overwrite a user's
      category or tag edit, and the result is recorded here.
- [ ] Synthetic fixtures with at least two users prove that cross-user reads and
      writes are denied for any finance path this task changes.
- [ ] No personal identity, account, merchant, rule, or credential is hard-coded
      in shared code or fixtures.
- [ ] If the CLI lands, its tests run in `main`'s CI.
- [ ] Full `pnpm run check` passes.

## Related

- [Finance core consolidation (proposed)](../decisions/finance.core-consolidation.md)
- [finance.pfin-merge](../decisions/finance.pfin-merge.md)
- [Finance sync doctrine](finance-sync-doctrine.md)
- [Finance runway budgets](finance-runway-budgets.md)
- [Finance transactions redesign](finance-transactions-redesign.md)
- [Finance transaction categorization](../finance-transaction-categorization.md)
- [Finance multi-currency redesign plan](../finance-multi-currency-redesign-plan.md)
- [Hominem finance tools spec](../hominem-finance-tools-spec.md)
