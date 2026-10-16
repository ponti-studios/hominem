import { describe, expect, it } from 'vitest';

import { createToolRegistry } from '../../tool-registry';
import { financeSlices } from './index';

describe('finance tool slices', () => {
  it('composes the account and transaction slices without duplicate names', () => {
    const registry = createToolRegistry(financeSlices);
    const names = registry.listTools().map((tool) => tool.name);

    expect(names).toHaveLength(10);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('finance_accounts');
    expect(names).toContain('finance_transactions_import');
  });
});
