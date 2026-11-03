# WYA-261 plan

1. Migration `packages/db/migrations/*_create_finance_bills.sql`: `app.finance_bills` (one table for the suggested/confirmed/cancelled lifecycle, `merchant_match text[]`, schedule fields, PAYG `stale_after_hours`/`payg_warn_days`) plus append-only child `app.finance_bill_balance_entries` (cascade delete, index on `(bill_id, checked_at desc)`), then `just db migrate` + `just db codegen`.
2. Repository `packages/db/src/services/finance/bill.repository.ts`: DTO-only CRUD, balance-entry append/list, and one claim query that matches transactions by case-insensitive substring over `merchant_match` and awards each transaction to the earliest-created bill.
3. Application service `services/api/src/application/finance-bills.service.ts`: computed `nextDueDate` (cadence + dueDay with month-end clamping, never stored), `lastPaid`, PAYG usage/ burn / run-out / staleness derivation, and not-found → null.
4. Zod schemas in `services/api/src/schemas/finance.schema.ts` + six MCP tools (`finance_bill_create|list|get|update|delete|log_balance`) in `services/api/src/mcp/tools/finance/bills/`, wired into the existing `finance.budgets`-style slice.
5. Tests `services/api/src/mcp/tools/finance/bills/bills.test.ts` covering every acceptance case, `docs/finance-bills.md` for the durable rules, then the full `pnpm run check` + `pnpm format:check` gate.

Note: `services/api` has no RPC/UI surface in scope — MCP only, matching the ticket.
