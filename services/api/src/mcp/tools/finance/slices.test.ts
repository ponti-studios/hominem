import { describe, expect, it } from 'vitest';

import { createToolRegistry } from '../../tool-registry';
import { financeSlices } from './index';

describe('finance tool slices', () => {
  it('composes the account, bill, budget and transaction slices without duplicate names', () => {
    const registry = createToolRegistry(financeSlices);
    const names = registry.listTools().map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('finance_accounts');
    expect(names).toContain('finance_rulings_queue');
    expect(names).toContain('finance_account_delete');
    expect(names).toContain('finance_transactions_import');
    expect(names).toContain('finance_doctrine_get');
    expect(names).toContain('finance_doctrine_import');
    expect(names).toContain('finance_budget_create');
    expect(names).toContain('finance_budget_list');
    expect(names).toContain('finance_budget_get');
    expect(names).toContain('finance_budget_update');
    expect(names).toContain('finance_budget_delete');
    expect(names).toContain('finance_bill_create');
    expect(names).toContain('finance_bill_list');
    expect(names).toContain('finance_bill_get');
    expect(names).toContain('finance_bill_update');
    expect(names).toContain('finance_bill_delete');
    expect(names).toContain('finance_bill_log_balance');
    expect(names).toContain('finance_wealth_brief');
    expect(names).toContain('finance_wealth_look');
    expect(names).toContain('finance_wealth_close');
    expect(names).toContain('finance_wealth_integrity');
    expect(names).toContain('finance_seed');
    expect(names).toContain('finance_balances');
    expect(names).toContain('finance_sync');
  });
});
