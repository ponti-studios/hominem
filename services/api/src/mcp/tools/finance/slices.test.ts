import { describe, expect, it } from 'vitest';

import { createToolRegistry } from '../../tool-registry';
import { financeSlices } from './index';

describe('finance tool slices', () => {
  it('composes the account, bill, budget and transaction slices without duplicate names', () => {
    const registry = createToolRegistry(financeSlices);
    const names = registry.listTools().map((tool) => tool.name);

    expect(names).toHaveLength(26);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('finance_accounts');
    expect(names).toContain('finance_rulings_queue');
    expect(names).toContain('finance_account_delete');
    expect(names).toContain('finance_transactions_import');
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
  });
});
