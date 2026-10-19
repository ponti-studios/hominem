import { describe, expect, it } from 'vitest';

import { createToolRegistry, defineMcpSlice } from '../../../tool-registry';
import { financeAccountsSlice } from './index';

describe('finance account tool modules', () => {
  it('loads only account tools into an isolated registry', () => {
    const registry = createToolRegistry([financeAccountsSlice]);

    expect(registry.listTools().map((tool) => tool.name)).toEqual([
      'finance_account_create',
      'finance_account_delete',
      'finance_account_summary',
      'finance_account_update',
      'finance_accounts',
    ]);
    expect(registry.listToolsForScopes(['finance:read']).map((tool) => tool.name)).toEqual([
      'finance_account_summary',
      'finance_accounts',
    ]);
    expect(registry.listToolsForScopes(['finance:write']).map((tool) => tool.name)).toEqual([
      'finance_account_create',
      'finance_account_delete',
      'finance_account_update',
    ]);
  });

  it('validates account inputs through the isolated registry before running handlers', async () => {
    const registry = createToolRegistry([financeAccountsSlice]);

    await expect(registry.callTool('test-user', 'finance_account_create', {})).rejects.toThrow();
    await expect(registry.callTool('test-user', 'finance_account_delete', {})).rejects.toThrow();
    await expect(registry.callTool('test-user', 'finance_account_update', {})).rejects.toThrow();
  });

  it('rejects empty or duplicate tool definitions in a slice', () => {
    expect(() => defineMcpSlice({ name: 'finance.empty', tools: [] })).toThrow(
      'MCP slice cannot be empty',
    );
    expect(() =>
      defineMcpSlice({
        name: 'finance.accounts.duplicate',
        tools: [...financeAccountsSlice.tools, financeAccountsSlice.tools[0]!],
      }),
    ).toThrow('MCP slice contains duplicate tools');
  });

  it('rejects registering a slice twice without partially adding its tools', () => {
    const registry = createToolRegistry([financeAccountsSlice]);

    expect(() => registry.registerSlice(financeAccountsSlice)).toThrow(
      'MCP slice is already registered: finance.accounts',
    );
    expect(registry.listTools()).toHaveLength(financeAccountsSlice.tools.length);
  });
});
