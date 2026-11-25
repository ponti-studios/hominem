---
title: 'Finance CLI migration into the shared finance core'
status: 'Proposed'
priority: 'high'
labels: [finance, cli, mcp, rpc]
depends_on: []
blocks: []
estimated_size: 'XL'
---

## Outcome

Hominem finance behavior that the CLI wealth-manager needs (ingest,
categorization, transfer linking, reports) runs on one shared core. People
(Web, mobile, RPC) and agents (MCP, CLI agent runners) get the same contracts
and calculations, and the CLI keeps only machine-local concerns: credentials,
local state, logging, argument parsing, and output.

The architecture behind this outcome is **not settled**. The boundary,
sequencing, and product decisions are analyzed in the proposed (not accepted)
[finance core consolidation](../decisions/finance.core-consolidation.md)
decision. Each work item below that depends on an open decision there is
blocked until the product owner resolves it.

## Provenance

The first version of this task was written in an unmerged agent session
(`a2108450…`, checkpoint `9b71619cd`). That session's history has no common
ancestor with `main`. Its W-002 and W-003 were marked "Implemented" there, but
that code is not on `main` and has not run in `main`'s CI. This revision
replaces the earlier version, which is preserved in that checkpoint's history.

[finance.pfin-merge](../decisions/finance.pfin-merge.md) remains the historical
decision for the earlier pfin port. This task does not amend it.

## Directly stated decisions this task preserves

- Hominem is the system of record (pfin-merge).
- Browser upload of statements stays removed (pfin-merge, product direction).
- The full multi-currency schema and rate rollout is a **separate**
  implementation
  ([multi-currency plan](../finance-multi-currency-redesign-plan.md)). This
  task must not freeze a money contract that contradicts it.
- "Plaid is ingest-only" is the owner's ruling (recorded 2026-11-06 in CLI code
  comments). It holds for the owner's routines. Whether it is a product rule for
  everyone is decision D3.
- No user identity, account, balance, transaction, merchant, rule, or provider
  credential is hard-coded in shared code or fixtures. Fixtures use synthetic
  identities.

## Verified state

### On `main`

| Capability                                                                                                          | Evidence                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Accounts, transactions, sheet import, runway, reconcile, diagnostics, taxonomy merge, rules CRUD, rulings, reports  | `packages/finance/src/*`                                                                                      |
| Budgets, bills, rulings execution, doctrine, transaction management in the API layer (calls `@hominem/db` directly) | `services/api/src/application/finance*.ts`                                                                    |
| Import upsert preserves fields the caller omits                                                                     | `packages/finance/src/sheet-import.ts:813-830`                                                                |
| Import accepts a stable provider `externalId`                                                                       | `packages/finance/src/sheet-import.ts:61,349-350`                                                             |
| Pending rows rejected as `pending_row`                                                                              | `packages/finance/src/sheet-import.ts:56,212`                                                                 |
| Unknown category names are auto-created on import                                                                   | `packages/finance/src/sheet-import.ts:384` (`ensureFinanceCategoryId`)                                        |
| Sync doctrine store and provider account identity (MCP only)                                                        | [finance-sync-doctrine](finance-sync-doctrine.md), `services/api/src/application/finance.doctrine.service.ts` |
| `finance_rules` table and CRUD, with **no engine applying it**                                                      | `packages/db/migrations/20261101100000_create_finance_rules.sql:4,14`, `packages/finance/src/rules.ts`        |
| Runway adapters build budget input separately for MCP and RPC                                                       | `services/api/src/mcp/tools/finance.ts:363-390`, `services/api/src/rpc/routes/finance.ledger.ts:72-84`        |
| Money conversion assumes two minor units                                                                            | `packages/finance/src/utils.ts:5-7`                                                                           |
| CLI package                                                                                                         | `packages/cli/src` has no `agent/` or wealth-manager modules                                                  |

### Only in the unmerged checkpoints

- `packages/cli/src/agent/systems/wealth-manager/*` (13 modules, about 5,800
  lines) and `packages/cli/tests/agent/wealth_*.test.ts`.
- `packages/finance/src/ingest/contracts.ts`, `money.ts`, `category-seed.ts`
  (the earlier W-002 and W-003).
- `docs/finance.transactions.md`, `docs/finance.ingest.md`,
  `docs/finance.categories.md`.

How the CLI behaves in those checkpoints:

- It is a remote MCP client using a personal `hmt_` token. The server derives
  the owner from the token (`hominem.ts`).
- It evaluates the doctrine locally (`categorize.ts`). Its doctrine types are
  hand-copied from `services/api/src/schemas/finance.doctrine.schema.ts`.
- Its sync sends no `externalId`, and re-sends `category` and `tags` computed by
  the doctrine for the overlap window (`daily_sync.ts`, `toTxn`).
- `forward_look.ts` hard-codes GBP/USD timelines and a live Frankfurter FX rate.

## Real gaps

| Gap                                                                                                                                             | Why it matters                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| G1 The code states are split (`main` vs unmerged checkpoints)                                                                                   | Nothing can be migrated until one base is chosen (D12)                                                                        |
| G2 Four classification stores (`finance_rules`, rulebooks, doctrine, the CLI engine), and none applies rules to imported transactions on `main` | Different surfaces can classify the same merchant differently. Name-referenced stores drift after a category merge or rename. |
| G3 Sync sends no provider `externalId`                                                                                                          | Dedupe depends on the description. A descriptor change creates a duplicate.                                                   |
| G4 Overlap re-sync may overwrite user category or tag edits                                                                                     | Untested. Needs a test before any behavior change (D7).                                                                       |
| G5 Finance logic is split between `packages/finance` and `services/api/src/application`                                                         | "The package is the authority" is not true yet                                                                                |
| G6 People and agents get different capabilities (rules, doctrine, category merge, and bills mostly MCP-only; affordability RPC-only)            | Needs a parity rule (D10)                                                                                                     |
| G7 Money is 2dp `* 100` with a `'USD'` default, `allowedCurrencies`, and primary-currency budgets                                               | Contradicts the approved multi-currency plan. Must not be frozen into new shared contracts.                                   |
| G8 CLI reports are written for one owner                                                                                                        | Not general until D11 is decided                                                                                              |

## Requirements removed pending decisions

These were acceptance criteria in the earlier version. They depend on product
decisions nobody has made, so they are now open decisions in the
[consolidation proposal](../decisions/finance.core-consolidation.md). Each is
**OPEN — USER DECISION REQUIRED**.

- The 32-category `personal-finance-v1` seed, and when to apply it (D5).
- "Learned rules" as a new owner-scoped store (D6, after D4 picks one rule
  model).
- "The CLI passes an explicit user identity through every finance operation."
  For a remote MCP client, the server derives identity from the token. An
  explicit owner ID applies only to in-process server calls. Whether the CLI
  serves one owner or many is D2.
- Starling and Plaid adapters inside the DB-bound package. This depends on where
  sync runs and who holds credentials (D1).
- Moving morning-brief, integrity, close, and forward-look math into the package
  (D11).
- Treating the natural-key and cents contract as the shared ingest contract
  (conflicts with G3 and G7).

## Work sequence

| ID    | Work item                                                                     | Depends on                 | Validation               | Done when                                                                                            |
| ----- | ----------------------------------------------------------------------------- | -------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| W-000 | Resolve the consolidation proposal's open decisions D1, D2, D4, D12           | product owner              | —                        | The decision doc is accepted, amended, or rejected                                                   |
| W-001 | Choose the code base and inventory parity against `main`                      | W-000 (D12)                | inventory reviewed       | Every wealth-manager behavior is mapped to an existing `main` function, a gap, or a personal routine |
| W-002 | Prove or disprove re-sync overwrite (G4)                                      | —                          | finance integration test | A test shows whether re-sent `category`/`tags` replace a user edit                                   |
| W-003 | Send provider `externalId` from sync (G3)                                     | W-001                      | CLI and import tests     | Rerun after a descriptor change creates no duplicate                                                 |
| W-004 | Consolidate to one rule model applied server-side on every write path (G2)    | W-000 (D4)                 | DB and integration tests | One store, id-referenced, one engine; merge and rename keep rules valid                              |
| W-005 | Add a currency-aware minor-unit money value at new shared boundaries (G7)     | —                          | unit tests               | No new `* 100`; scale comes from currency data; no schema change                                     |
| W-006 | Make finance surfaces thin adapters over one core, runway first (G5, G6)      | W-000 (D10)                | API, RPC, and MCP tests  | MCP and RPC runway share one service call                                                            |
| W-007 | Land or rework the CLI as a remote client with no DB-bound runtime dependency | W-001, W-003, W-004        | CLI tests in CI          | CLI owns auth, env, state, log, and output only                                                      |
| W-008 | Decide seed, learning, and reports                                            | W-000 (D5, D6, D11), W-004 | per decision             | Only after the owner decides                                                                         |

## Acceptance criteria

- [ ] Every open decision this task depends on is resolved and recorded in the
      consolidation decision doc.
- [ ] One code base is chosen. No "Implemented" claim refers to code that is not
      on `main`.
- [ ] A test establishes whether re-sync can overwrite a user's edits, and the
      behavior matches D7.
- [ ] Sync dedupes by provider `externalId` when one exists, with the
      pfin-merge natural key as the fallback.
- [ ] Exactly one classification rule model is applied on every finance write
      path, and it survives category merge and rename.
- [ ] No new shared contract assumes two minor units or defaults the currency.
- [ ] MCP and RPC call one implementation for each shared capability.
- [ ] Remote clients never supply an owner ID. Two synthetic users prove
      cross-user reads and writes are denied.
- [ ] CLI tests run in `main`'s CI if the CLI lands.
- [ ] Full `pnpm run check` passes.

## Related

- [Finance core consolidation (proposed)](../decisions/finance.core-consolidation.md)
- [finance.pfin-merge](../decisions/finance.pfin-merge.md)
- [Finance sync doctrine](finance-sync-doctrine.md)
- [Finance runway budgets](finance-runway-budgets.md)
- [Finance multi-currency redesign plan](../finance-multi-currency-redesign-plan.md)
- [Hominem finance tools spec](../hominem-finance-tools-spec.md)
