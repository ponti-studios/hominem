---
title: 'Finance sync doctrine and provider account identity'
status: 'Implemented'
priority: 'high'
labels: [finance, mcp, ingest]
depends_on: []
blocks: []
estimated_size: 'M'
---

## Outcome

External transaction syncs (Siera's wealth-manager) resolve their configuration from Hominem at
runtime instead of hardcoding it. The deterministic ingest doctrine — ordered merchant, tag and
amount rules, row-class transfer and income detection, coffee patterns, and category tag lenses —
lives in one fingerprinted jsonb row per user behind `finance_doctrine_get` / `finance_doctrine_import`,
and finance accounts carry provider identity (`provider` + `provider_account_id`, unique per user)
plus their mask (`account_number`) so sync rows route by identity instead of a label table in
sync code.

## Acceptance criteria

- [x] `app.finance_sync_doctrine` stores one fingerprinted doctrine row per user, RLS-scoped,
      schema-versioned (literal `version: 1`) and canonicalized on write (matchMode defaults:
      contains for rules, exact for transfer merchants).
- [x] `finance_doctrine_get` (finance:read) returns the stored doctrine with its fingerprint;
      `finance_doctrine_import` (finance:write) replaces it wholesale, is idempotent by the
      server-computed SHA-256 fingerprint, echoes `dryRun`, and reports `ruleCounts`.
- [x] `app.finance_accounts` gains `provider_account_id`; `(user_id, provider, provider_account_id)`
      is unique. `finance_account_create` routes by identity before the name, never stamps identity
      onto a name-matched account, and returns provider/providerAccountId/accountNumber;
      `finance_accounts` lists the same fields; `finance_account_update` owns identity changes,
      refusing `identity_conflict` and `identity_requires_provider`, audited in `changes`.
- [x] Doctrine and identity semantics are covered by DB-backed MCP tests
      (`finance-doctrine.test.ts`, `finance-account-identity.test.ts`) and the finance integration
      suite; `pnpm run check` and `pnpm format:check` pass.

## Progress

Implemented on `feature/finance-sync-doctrine`: migrations (provider_account_id column with its
unique identity index; finance_sync_doctrine table with RLS), doctrine repository / schemas /
service / MCP slice, account identity across the service, RPC and MCP layers, and the test
coverage above. `pnpm run check` and `pnpm format:check` pass end to end.

The dev DB is seeded through the service layer and read-back verified (2026-11-22): doctrine
status `created`, then `unchanged` on re-import — fingerprint idempotency proven live — with
rule counts merchantRules 54 / tagRules 33 / amountRules 2 / transferMerchants 7 /
incomePatterns 5 / coffeePatterns 8 / lenses 7 (245 lens matches over 7 categories), and eleven
routing identities verified on read-back (Starling current + Easy Saver by provider identity,
Amex Platinum + five Capital One accounts + Wise GBP by mask). The seeder and its
personal-data inputs are machine-local on the operator's Mac (`~/.siera/wealth/seed/`) and
deliberately not committed with the branch.

## Notes

- The doctrine is a dedicated store, not `finance_rules` (category-only) and not the rulings
  rulebooks (suggestions-only, untouched). Ordering is law: merchant, tag and transfer lists are
  first-match-wins by design (train operators before the generic 'railway' hosting rule).
- `finance_doctrine_import` is full-replace, no merge. The fingerprint is computed server-side and
  never client-supplied, so a re-import of identical contents is a no-op.
- The archived sync's exact-merchant layer (425 rules in `merchant_category_rules.json`) was never
  salvaged onto this Mac; the doctrine's merchantRules therefore carry only the ordered substring
  rulings that survived inline. Rows the exact layer used to catch now queue for a ruling instead
  of being guessed.

## Evidence

`services/api/src/mcp/tools/finance-doctrine.test.ts` (7 tests: empty read, created with
canonicalized defaults, unchanged fingerprint, replaced, dryRun projection, shape rejection,
per-user isolation) and `finance-account-identity.test.ts` (12 tests: identity create/normalize,
identity-before-name routing, no stamping on name match, routing fields in the list, per-owner
uniqueness, stamping audit, identity_conflict, identity_requires_provider both ways, clean clear,
dryRun projection), both against the test DB; `packages/finance/src/finance.accounts.integration.test.ts`
gains the identity create-or-get / update-audit block (6 tests passing); `slices.test.ts` asserts
the 28-tool finance surface including both doctrine tools.

Live read-back (dev DB, 2026-11-22): doctrine fingerprint
`0402e68dd51174ff09226c73a35dac8c6b1fcd0c1386a14a8433f08c0a86edca` with the rule counts above;
all eleven routing identities present on the accounts after the seed run.
