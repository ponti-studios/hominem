# Tool request: `finance_account_update` (MCP)

**Author:** the operator · **Date:** 2026-10-14
**Companion to:** `hominem-finance-tools-spec.md` — its §1 conventions
(named errors, case-insensitive identity, dryRun, idempotent counters,
structuredContent parity) apply in full and are not repeated here.

## Why

`finance_account_create` (shipped 2026-10-14) made account identity a
one-way door: name, institution, mask, and status are set at creation and
can never be corrected from the client. Two standing exhibits:

- **The registry contains a typo:** one account's name carries a misspelling
  (a single missing letter). It has carried the misspelling through the entire
  port because no tool can fix it.
- **Accounts have lifecycles the registry can't express after the fact.**
  During the port, accounts were created with the right status by luck of
  timing (a drained savings account created `closed`).
  The next account that gets drained, closed, reopened, or product-changed
  in reality will silently diverge from Hominem — the exact failure the
  sheet's Accounts tab (Open/Closed/Verify, maintained by hand) existed
  to prevent.

## Proposed tool

`finance_account_update`

Input:

| field | type | req | notes |
|---|---|---|---|
| `accountId` | string | ✓ | the stable handle — names are mutable, so updates address by id, never by name |
| `name` | string | | new display name |
| `institution` | string \| null | | null clears |
| `accountNumber` | string \| null | | mask/last digits; null clears |
| `accountType` | string | | matches `finance_account_create`'s field |
| `status` | enum | | see status semantics below |
| `allowedCurrencies` | string[] | | complete set accepted for transaction rows; primary `currencyCode` is always included |
| `dryRun` | boolean | | projects the change set, applies nothing |

Partial-update semantics: an omitted field is unchanged; an explicit
`null` clears a nullable field (`institution`, `accountNumber`). There is
no way to null `name`, `accountType`, or `status` — omitting is the only
"leave it" signal for those.

## Behavior

- **Rename** validates case-insensitive uniqueness against all *other*
  accounts (open and closed): a clash refuses with `name_conflict`.
  Re-casing the account's own name is allowed and is a real change.
- **Identity is untouched:** id, transactions, balances-by-history, and
  links survive every update. A rename must be observable as the same
  account in `finance_account_summary` before and after (same id, same
  counts/totals).
- **Status transitions** are unrestricted among the states the registry
  actually uses — observed live: `open`, `closed`, and `historical`
  (a legacy account carries `historical` today). Closing never
  deletes or hides history; `finance_accounts` visibility rules are
  unchanged. If the domain intends a restricted transition graph, the
  agent should name it in the implementation and refuse violations with
  `invalid_status_transition` rather than silently allowing them.
- **`currencyCode` is immutable through this tool.** Changing an
  account's currency reinterprets every stored amount; that is a
  migration, not an update. Attempts refuse with `currency_immutable`.
  (If currency correction is ever truly needed, it belongs in a guarded
  replace-style operation, specced separately.)
- **`allowedCurrencies` is mutable per-account policy.** When omitted it is
  unchanged; when supplied it replaces the account's additional allowances.
  `currencyCode` remains allowed automatically. Transaction writes on accounts
  without additional allowances must match `currencyCode` exactly.
- **Idempotence / no-op:** an update whose values equal the current state
  succeeds with `updated: false` and an empty change set.
- **Result:** `{ id, name, currencyCode, allowedCurrencies, status, updated, changes }`
  where `changes` maps each altered field to `[from, to]` — the
  operator's audit record, mirroring `finance_transaction_delete`'s
  snapshot philosophy.
- **Errors (named, per §1.1):** `unknown_account`, `name_conflict`,
  `currency_immutable`, `invalid_status_transition`, `invalid_name`
  (empty/whitespace).

## Acceptance (live, on deploy)

1. **The typo fix:** rename the misspelled account to its correct spelling.
   Verify: same id in `finance_accounts`, summary entry
   renamed with count/totals unchanged (0 / none).
2. **Collision:** attempt to rename one account to another's existing name
   (case-insensitively) → `name_conflict`; both accounts unchanged.
3. **Status round-trip:** create a probe account (closed) via
   `finance_account_create`; update → `open`; verify in
   `finance_accounts` default view; update → `closed`; verify it now
   appears only under `includeClosed`. (The probe account stays in the
   registry, closed — accounts have no delete, by design.)
4. **Dry run:** rename any account with `dryRun: true` →
   projected change set returned, name verifiably unchanged afterwards.
5. **Currency guard:** attempt `currencyCode` change on any account
   (if the field is accepted in the schema at all) →
   `currency_immutable`; omit it from the schema entirely and this test
   is satisfied by construction.

## Out of scope

Account delete/merge (unchanged from the master spec's non-goals);
transaction reassignment between accounts (a merge prerequisite, specced
only if account merge ever enters scope); bulk updates.
