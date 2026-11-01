import { describe, expect, it } from 'vitest';

import { createToolRegistry } from '../../tool-registry';
import { financeSlices } from './index';

describe('finance tool slices', () => {
  it('composes the account, budget and transaction slices without duplicate names', () => {
    const registry = createToolRegistry(financeSlices);
    const names = registry.listTools().map((tool) => tool.name);

    expect(names).toHaveLength(17);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('finance_accounts');
    expect(names).toContain('finance_account_delete');
    expect(names).toContain('finance_transactions_import');
    expect(names).toContain('finance_budget_create');
    expect(names).toContain('finance_budget_list');
    expect(names).toContain('finance_budget_get');
    expect(names).toContain('finance_budget_update');
    expect(names).toContain('finance_budget_delete');
  });
});
