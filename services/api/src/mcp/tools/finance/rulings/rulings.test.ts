import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ importRulebook: vi.fn(), listQueue: vi.fn() }));
vi.mock('../../../../application/finance.rulings.service', () => ({
  importReferenceRulebook: mocks.importRulebook,
  listRulingQueue: mocks.listQueue,
}));

import { createToolRegistry } from '../../../tool-registry';
import { financeRulingsSlice } from './index';

describe('finance rulings MCP slice', () => {
  it('exports only the caller’s queue using the finance read scope', async () => {
    mocks.listQueue.mockResolvedValue({ total: 0, verdicts: [] });
    const registry = createToolRegistry([financeRulingsSlice]);
    expect(registry.listToolsForScopes(['finance:read']).map((tool) => tool.name)).toEqual([
      'finance_rulings_queue',
    ]);
    expect(registry.listToolsForScopes(['finance:write']).map((tool) => tool.name)).toEqual([
      'finance_rulings_import_reference_rulebook',
    ]);
    await expect(registry.callTool('owner-1', 'finance_rulings_queue', {})).resolves.toMatchObject({
      structuredContent: { total: 0, verdicts: [] },
    });
    expect(mocks.listQueue).toHaveBeenCalledWith('owner-1', 0, 20);
  });

  it('imports a reference rulebook for the caller with finance write scope', async () => {
    mocks.importRulebook.mockResolvedValue({ id: 'rulebook-1', fingerprint: 'reference-v1' });
    const registry = createToolRegistry([financeRulingsSlice]);
    const input = {
      fingerprint: 'reference-v1',
      rulebook: {
        categories: ['Food'],
        tags: ['Coffee'],
        merchantRules: [],
        categoryRules: [],
        tagRules: [],
        coffeePatterns: ['coffee'],
      },
    };

    await expect(
      registry.callTool('owner-1', 'finance_rulings_import_reference_rulebook', input),
    ).resolves.toMatchObject({
      structuredContent: { id: 'rulebook-1', fingerprint: 'reference-v1' },
    });
    expect(mocks.importRulebook).toHaveBeenCalledWith('owner-1', input);
  });
});
