// Finance multi-currency plan checks.
//
// Each check encodes one claim from docs/finance-multi-currency-redesign-plan.md
// that was verified against code by hand. Two kinds:
//
//   current  The doc describes today's code. `holds` = code still matches the
//            doc. `changed` = code moved, so the doc's current-state text is stale.
//   target   The doc says what must be built. `open` = not built yet.
//            `done` = built. Counting `done` over time is the migration progress.
//
// A `changed` current check is not a test failure. It means the doc needs a
// reread. Evidence is the file path the check read.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { listMatching } from '../lib/repo.mjs';

// Text between the first `start` marker and the next `end` marker after it.
function slice(text, start, end) {
  const from = text.indexOf(start);
  if (from === -1) return '';
  const to = text.indexOf(end, from + start.length);
  return to === -1 ? text.slice(from) : text.slice(from, to + end.length);
}

export function financePlanChecks(root) {
  const read = (rel) => {
    const abs = join(root, rel);
    return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  };

  const schema = read('services/api/src/schemas/finance.schema.ts');
  const service = read('services/api/src/application/finance.service.ts');
  const txRoute = read('services/api/src/rpc/routes/finance.transactions.ts');
  const acctRoute = read('services/api/src/rpc/routes/finance.accounts.ts');
  const rpcFinance = read('packages/rpc/src/finance.ts');
  const sheetImport = read('packages/finance/src/sheet-import.ts');
  const calcs = read('packages/finance/src/calculations.ts');
  const diagnostics = read('packages/finance/src/diagnostics.ts');
  const airportSync = read('services/api/src/workers/airport-catalogue-sync.ts');
  const budgetMigration = read('packages/db/migrations/20261101120000_create_finance_budgets.sql');
  const baseTables = read('packages/db/migrations/20260326181100_create_app_finance_tables.sql');
  const txCurrencyMigration = read(
    'packages/db/migrations/20260804000006_add_finance_transactions_category_columns.sql',
  );

  const migrationFiles = listMatching(root, 'packages/db/migrations/*.sql');
  const migrationText = migrationFiles.map((f) => read(f)).join('\n');
  const apiSource = listMatching(root, 'services/api/src/**/*.ts')
    .filter((f) => !f.endsWith('.test.ts'))
    .map((f) => read(f))
    .join('\n');

  const createSchema = slice(txRoute, 'const transactionCreateSchema', '});');
  const createRoute = slice(txRoute, ".post('/create'", 'const created');
  const accountData = slice(rpcFinance, 'export type AccountData', '};');
  const runwayInput = slice(calcs, 'export const runwayScenarioInputSchema', '\nexport ');
  const pairMatcher = slice(diagnostics, 'export async function findTransferPairs', '\n}\n');
  const accountCreate = slice(schema, 'export const financeAccountCreateInputSchema', '\n});');

  return [
    // ---- current-state claims ----
    {
      id: 'C01',
      kind: 'current',
      claim: 'Currency validator uses Intl.supportedValuesOf',
      evidence: 'services/api/src/schemas/finance.schema.ts',
      holds: schema.includes('Intl.supportedValuesOf'),
    },
    {
      id: 'C02',
      kind: 'current',
      claim: 'invalid_currency error code exists',
      evidence: 'services/api/src/schemas/finance.schema.ts',
      holds: schema.includes("'invalid_currency'"),
    },
    {
      id: 'C03',
      kind: 'current',
      claim: 'toCurrency formats with a hard-coded $ and two decimals',
      evidence: 'services/api/src/application/finance.service.ts',
      holds: service.includes('`$${value.toFixed(2)}`'),
    },
    {
      id: 'C04',
      kind: 'current',
      claim: 'finance_accounts and finance_transactions default currency_code to USD',
      evidence: 'packages/db/migrations/20260326181100, 20260804000006',
      holds:
        baseTables.includes("currency_code text NOT NULL DEFAULT 'USD'") &&
        txCurrencyMigration.includes("currency_code text NOT NULL DEFAULT 'USD'") &&
        !/ALTER COLUMN currency_code DROP DEFAULT/i.test(migrationText),
    },
    {
      id: 'C05',
      kind: 'current',
      claim: '/transactions/create schema has no currencyCode',
      evidence: 'services/api/src/rpc/routes/finance.transactions.ts',
      holds: createSchema !== '' && !createSchema.includes('currencyCode'),
    },
    {
      id: 'C06',
      kind: 'current',
      claim: '/transactions/create insert does not set currency (DB default applies)',
      evidence: 'services/api/src/rpc/routes/finance.transactions.ts',
      holds: createRoute !== '' && !createRoute.includes('currency'),
    },
    {
      id: 'C07',
      kind: 'current',
      claim: 'account delete removes the account transactions first',
      evidence: 'services/api/src/rpc/routes/finance.accounts.ts',
      holds: acctRoute.includes("deleteFrom('app.financeTransactions').where('accountId'"),
    },
    {
      id: 'C08',
      kind: 'current',
      claim: 'allowedCurrencies is accepted on account create',
      evidence: 'services/api/src/schemas/finance.schema.ts',
      holds: accountCreate.includes('allowedCurrencies'),
    },
    {
      id: 'C09',
      kind: 'current',
      claim: 'shared AccountData type omits currencyCode',
      evidence: 'packages/rpc/src/finance.ts',
      holds: accountData !== '' && !accountData.includes('currencyCode'),
    },
    {
      id: 'C10',
      kind: 'current',
      claim: 'sheet import rejects pending rows',
      evidence: 'packages/finance/src/sheet-import.ts',
      holds: sheetImport.includes("if (input.pending) return 'pending_row'"),
    },
    {
      id: 'C11',
      kind: 'current',
      claim: 'budgets carry no currency; they use the profile primary_currency',
      evidence: 'packages/db/migrations/20261101120000_create_finance_budgets.sql',
      holds:
        budgetMigration.includes('primary_currency text NOT NULL') &&
        budgetMigration.includes('The budget has no currency of its own'),
    },
    {
      id: 'C12',
      kind: 'current',
      claim: 'runway calculator input has no currencyCode',
      evidence: 'packages/finance/src/calculations.ts',
      holds: runwayInput !== '' && !runwayInput.includes('currencyCode'),
    },
    {
      id: 'C13',
      kind: 'current',
      claim: 'findTransferPairs matches on equal absolute amount, not counterpartId',
      evidence: 'packages/finance/src/diagnostics.ts',
      holds:
        pairMatcher.includes('abs(t1.amount) = abs(t2.amount)') &&
        !pairMatcher.includes('counterpart'),
    },
    {
      id: 'C14',
      kind: 'current',
      claim: 'a nightly job scheduler precedent exists in the API worker',
      evidence: 'services/api/src/workers/airport-catalogue-sync.ts',
      holds: airportSync.includes('upsertJobScheduler'),
    },

    // ---- target gaps (the plan says these must be built) ----
    {
      id: 'T01',
      kind: 'target',
      claim: 'transactions create accepts currencyCode',
      evidence: 'services/api/src/rpc/routes/finance.transactions.ts',
      done: createSchema.includes('currencyCode'),
    },
    {
      id: 'T02',
      kind: 'target',
      claim: 'allowedCurrencies removed from account create',
      evidence: 'services/api/src/schemas/finance.schema.ts',
      done: accountCreate !== '' && !accountCreate.includes('allowedCurrencies'),
    },
    {
      id: 'T03',
      kind: 'target',
      claim: 'AccountData includes currencyCode',
      evidence: 'packages/rpc/src/finance.ts',
      done: accountData.includes('currencyCode'),
    },
    {
      id: 'T04',
      kind: 'target',
      claim: 'runway calculator input takes currencyCode',
      evidence: 'packages/finance/src/calculations.ts',
      done: runwayInput.includes('currencyCode'),
    },
    {
      id: 'T05',
      kind: 'target',
      claim: 'app.currency_catalogue table exists',
      evidence: 'packages/db/migrations',
      done: /CREATE TABLE[^;]*currency_catalogue/i.test(migrationText),
    },
    {
      id: 'T06',
      kind: 'target',
      claim: 'needs_currency_review column exists',
      evidence: 'packages/db/migrations',
      done: /needs_currency_review/.test(migrationText),
    },
    {
      id: 'T07',
      kind: 'target',
      claim: 'account_amount_minor storage column exists',
      evidence: 'packages/db/migrations',
      done: /account_amount_minor/.test(migrationText),
    },
    {
      id: 'T08',
      kind: 'target',
      claim: 'fx_rate_unavailable error code exists',
      evidence: 'services/api/src',
      done: /fx_rate_unavailable/.test(apiSource),
    },
    {
      id: 'T09',
      kind: 'target',
      claim: 'transfer matching uses counterpartId',
      evidence: 'packages/finance/src/diagnostics.ts',
      done: pairMatcher.includes('counterpart'),
    },
    {
      id: 'T10',
      kind: 'target',
      claim: 'transaction account move rejects currency_mismatch',
      evidence: 'services/api/src/rpc/routes/finance.transactions.ts',
      done: txRoute.includes('currency_mismatch'),
    },
  ].map((c) => {
    if (c.kind === 'current') {
      return {
        id: c.id,
        kind: c.kind,
        claim: c.claim,
        evidence: c.evidence,
        status: c.holds ? 'holds' : 'changed',
      };
    }
    return {
      id: c.id,
      kind: c.kind,
      claim: c.claim,
      evidence: c.evidence,
      status: c.done ? 'done' : 'open',
    };
  });
}
