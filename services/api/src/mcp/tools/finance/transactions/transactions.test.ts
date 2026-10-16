import { describe, expect, it } from 'vitest';

import { createToolRegistry } from '../../../tool-registry';
import { financeTransactionsSlice } from './index';

describe('finance transactions slice', () => {
  it('loads transaction tools with read and write scopes in an isolated registry', () => {
    const registry = createToolRegistry([financeTransactionsSlice]);

    expect(registry.listTools().map((tool) => tool.name)).toEqual([
      'finance_recent_transactions',
      'finance_transaction_delete',
      'finance_transaction_move',
      'finance_transaction_search',
      'finance_transaction_upsert',
      'finance_transactions_import',
    ]);
    expect(registry.listToolsForScopes(['finance:read']).map((tool) => tool.name)).toEqual([
      'finance_recent_transactions',
      'finance_transaction_search',
    ]);
    expect(registry.listToolsForScopes(['finance:write']).map((tool) => tool.name)).toEqual([
      'finance_transaction_delete',
      'finance_transaction_move',
      'finance_transaction_upsert',
      'finance_transactions_import',
    ]);
  });

  it('preserves the explicit confirmation contract on destructive transaction tools', () => {
    const registry = createToolRegistry([financeTransactionsSlice]);

    expect(registry.getToolDefinition('finance_transaction_delete')).toMatchObject({
      requiresConfirmation: true,
      scopes: ['finance:write'],
    });
    expect(registry.getToolDefinition('finance_transactions_import')).toMatchObject({
      requiresConfirmation: true,
      scopes: ['finance:write'],
    });
  });

  it('validates write inputs before transaction handlers execute', async () => {
    const registry = createToolRegistry([financeTransactionsSlice]);

    await expect(
      registry.callTool('test-user', 'finance_transaction_upsert', {}),
    ).rejects.toThrow();
    await expect(
      registry.callTool('test-user', 'finance_transactions_import', {}),
    ).rejects.toThrow();
    await expect(
      registry.callTool('test-user', 'finance_transaction_delete', {}),
    ).rejects.toThrow();
  });
});
