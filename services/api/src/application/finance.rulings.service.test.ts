import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  save: vi.fn(),
  latest: vi.fn(),
  find: vi.fn(),
  list: vi.fn(),
  events: vi.fn(),
  verdict: vi.fn(),
  options: vi.fn(),
  latestRulebook: vi.fn(),
  saveRulebook: vi.fn(),
  saveLiveRulebook: vi.fn(),
}));
vi.mock('@hominem/db/core', () => ({
  db: {},
  runInTransaction: (fn: (trx: object) => unknown) => fn({}),
  sql: () => ({ execute: vi.fn() }),
}));
vi.mock('@hominem/db/finance', () => ({
  FinanceRulingRepository: {
    createPreparation: mocks.save,
    latestPreparation: mocks.latest,
    findPreparation: mocks.find,
    listVerdicts: mocks.list,
    listEvents: mocks.events,
    createVerdict: mocks.verdict,
    listOptions: mocks.options,
    latestRulebook: mocks.latestRulebook,
    saveReferenceRulebook: mocks.saveRulebook,
    saveLiveRulebook: mocks.saveLiveRulebook,
  },
}));
vi.mock('./finance.service', () => ({ searchTransactions: mocks.search }));

import {
  importReferenceRulebook,
  listRulingQueue,
  prepareRulings,
  queueRulingVerdict,
} from './finance.rulings.service';

const row = {
  id: 'transaction-1',
  externalId: 'external-1',
  description: 'SQ *Coffee House',
  merchantName: null,
  postedOn: '2026-10-01',
  amount: -4.25,
  currencyCode: 'GBP',
  excluded: false,
  accountId: 'account-1',
  accountName: 'Checking',
  categoryId: 'category-1',
  categoryName: 'Uncategorized',
  tags: [],
  source: 'starling',
  pending: false,
};

describe('rulings preparation', () => {
  beforeEach(() => {
    mocks.search.mockReset().mockResolvedValue({ data: [], filteredCount: 0, nextCursor: null });
    mocks.save.mockReset().mockResolvedValue('preparation-1');
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.events.mockReset().mockResolvedValue([]);
    mocks.find.mockReset();
    mocks.verdict.mockReset().mockResolvedValue('verdict-1');
    mocks.options.mockReset().mockResolvedValue({
      categories: [{ id: 'category-food', name: 'Food' }],
      tags: [{ id: 'tag-coffee', name: 'Coffee' }],
    });
    mocks.latestRulebook.mockReset().mockResolvedValue(null);
    mocks.saveRulebook.mockReset().mockResolvedValue('rulebook-1');
    mocks.saveLiveRulebook.mockReset().mockResolvedValue('rulebook-live-1');
  });

  it('imports a validated reference rulebook for the caller', async () => {
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

    await expect(importReferenceRulebook('owner-1', input)).resolves.toEqual({
      id: 'rulebook-1',
      fingerprint: 'reference-v1',
    });
    expect(mocks.saveRulebook).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      'reference-v1',
      input.rulebook,
    );
  });

  it('pages owner-scoped Uncategorized rows and saves a snapshot with before-state', async () => {
    mocks.search
      .mockResolvedValueOnce({ data: [row], filteredCount: 2, nextCursor: 'next' })
      .mockResolvedValueOnce({
        data: [{ ...row, id: 'transaction-2', externalId: 'external-2', amount: -3 }],
        filteredCount: 2,
        nextCursor: null,
      });

    const result = await prepareRulings('owner-1');

    expect(mocks.search).toHaveBeenNthCalledWith(1, 'owner-1', {
      uncategorizedOnly: true,
      limit: 50,
    });
    expect(mocks.search).toHaveBeenNthCalledWith(2, 'owner-1', {
      uncategorizedOnly: true,
      limit: 50,
      cursor: 'next',
    });
    expect(result).toMatchObject({
      preparationId: 'preparation-1',
      clusters: [{ merchant: 'coffee house', totals: { GBP: -725 } }],
    });
    expect(mocks.save).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      expect.objectContaining({ clusters: result.clusters, rulebook: null }),
    );
    expect(result.clusters[0]?.rows[0]?.before).toMatchObject({
      categoryName: 'Uncategorized',
      accountId: 'account-1',
      source: 'starling',
    });
  });

  it('does not save a preparation when the underlying count changes during paging', async () => {
    mocks.search
      .mockResolvedValueOnce({ data: [row], filteredCount: 2, nextCursor: 'next' })
      .mockResolvedValueOnce({ data: [], filteredCount: 1, nextCursor: null });

    await expect(prepareRulings('owner-1')).rejects.toThrow('changed during preparation');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('queues only the reviewed rows after confirming their current state', async () => {
    mocks.search.mockResolvedValue({ data: [row], filteredCount: 1, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    mocks.find.mockResolvedValue({
      id: prepared.preparationId,
      snapshot: { clusters: prepared.clusters },
    });

    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: prepared.clusters[0]!.id,
        rowIds: [prepared.clusters[0]!.rows[0]!.id],
        verdict: 'kill',
      }),
    ).resolves.toEqual({ id: 'verdict-1', status: 'queued' });
    expect(mocks.verdict).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      expect.objectContaining({
        verdict: 'kill',
        rows: prepared.clusters[0]!.rows,
      }),
    );
  });

  it('freezes only selected transaction IDs when a cluster has multiple rows', async () => {
    const secondRow = { ...row, id: 'transaction-2', externalId: 'external-2', amount: -3.5 };
    mocks.search.mockResolvedValue({ data: [row, secondRow], filteredCount: 2, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    const cluster = prepared.clusters[0]!;
    expect(cluster.rows).toHaveLength(2);
    mocks.find.mockResolvedValue({
      id: prepared.preparationId,
      snapshot: { clusters: prepared.clusters },
    });

    await queueRulingVerdict('owner-1', {
      preparationId: prepared.preparationId,
      clusterId: cluster.id,
      rowIds: [cluster.rows[1]!.id],
      verdict: 'kill',
    });

    expect(mocks.verdict).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      expect.objectContaining({ rows: [cluster.rows[1]] }),
    );
  });

  it('refuses to queue a verdict if a reviewed row has changed', async () => {
    mocks.search.mockResolvedValue({ data: [row], filteredCount: 1, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    mocks.find.mockResolvedValue({
      id: prepared.preparationId,
      snapshot: { clusters: prepared.clusters },
    });
    mocks.search.mockResolvedValue({
      data: [{ ...row, amount: -9 }],
      filteredCount: 1,
      nextCursor: null,
    });

    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: prepared.clusters[0]!.id,
        rowIds: [prepared.clusters[0]!.rows[0]!.id],
        verdict: 'kill',
      }),
    ).rejects.toThrow('changed since preparation');
    expect(mocks.verdict).not.toHaveBeenCalled();
  });

  it('returns the existing verdict when the same request is retried', async () => {
    mocks.search.mockResolvedValue({ data: [row], filteredCount: 1, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    const cluster = prepared.clusters[0]!;
    mocks.find.mockResolvedValue({
      id: prepared.preparationId,
      snapshot: { clusters: prepared.clusters },
    });
    mocks.list.mockResolvedValue([
      {
        id: 'verdict-1',
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        rowIds: [cluster.rows[0]!.id],
        verdict: 'kill',
        category: null,
        tags: [],
        rows: cluster.rows,
        createdAt: '2026-11-12T00:00:00Z',
      },
    ]);

    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        rowIds: [cluster.rows[0]!.id],
        verdict: 'kill',
      }),
    ).resolves.toEqual({
      id: 'verdict-1',
      status: 'queued',
    });
    expect(mocks.verdict).not.toHaveBeenCalled();
  });

  it('freezes a history suggestion and validates against current Finance options', async () => {
    mocks.search.mockResolvedValue({ data: [row], filteredCount: 1, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    const cluster = {
      ...prepared.clusters[0]!,
      proposal: {
        category: 'Food',
        tags: ['Coffee'],
        reason: 'Previous transactions match.',
        source: 'history',
      },
    };
    mocks.find.mockResolvedValue({
      id: prepared.preparationId,
      snapshot: { clusters: [cluster] },
    });
    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        rowIds: [cluster.rows[0]!.id],
        verdict: 'change',
        category: 'Missing',
        tags: [],
      }),
    ).rejects.toThrow('Choose an existing Finance category.');
    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        rowIds: [cluster.rows[0]!.id],
        verdict: 'change',
        category: 'Food',
        tags: ['Missing'],
      }),
    ).rejects.toThrow('Choose existing Finance tags.');
    expect(mocks.verdict).not.toHaveBeenCalled();
    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        rowIds: [cluster.rows[0]!.id],
        verdict: 'file',
      }),
    ).resolves.toEqual({ id: 'verdict-1', status: 'queued' });
    expect(mocks.verdict).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      expect.objectContaining({
        verdict: 'file',
        category: 'Food',
        tags: ['Coffee'],
        rows: cluster.rows,
      }),
    );
  });

  it('learns a merchant category rule when a category is selected', async () => {
    mocks.search.mockResolvedValue({ data: [row], filteredCount: 1, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    const cluster = prepared.clusters[0]!;
    mocks.find.mockResolvedValue({
      id: prepared.preparationId,
      snapshot: { clusters: prepared.clusters, rulebook: null },
    });

    await expect(
      queueRulingVerdict('owner-1', {
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        rowIds: [cluster.rows[0]!.id],
        verdict: 'change',
        category: 'Food',
        tags: ['Coffee'],
      }),
    ).resolves.toMatchObject({ id: 'verdict-1', status: 'queued' });
    expect(mocks.saveLiveRulebook).toHaveBeenCalledWith(
      expect.anything(),
      'owner-1',
      expect.any(String),
      expect.objectContaining({
        categories: ['Food'],
        tags: ['Coffee'],
        merchantRules: [{ merchant: 'coffee house', category: 'Food', tags: ['Coffee'] }],
      }),
    );
  });

  it('exports the caller’s recorded verdict and before-state', async () => {
    mocks.search.mockResolvedValue({ data: [row], filteredCount: 1, nextCursor: null });
    const prepared = await prepareRulings('owner-1');
    const cluster = prepared.clusters[0]!;
    mocks.list.mockResolvedValue([
      {
        id: 'verdict-1',
        preparationId: prepared.preparationId,
        clusterId: cluster.id,
        merchant: cluster.merchant,
        verdict: 'kill',
        category: null,
        tags: [],
        rows: cluster.rows,
        createdAt: '2026-11-12T00:00:00Z',
      },
    ]);

    mocks.events.mockResolvedValue([
      {
        verdictId: 'verdict-1',
        eventType: 'queued',
        details: {},
        createdAt: '2026-11-12T00:00:00Z',
      },
      {
        verdictId: 'verdict-1',
        eventType: 'row_applied',
        details: { rowId: 'transaction-1' },
        createdAt: '2026-11-12T00:01:00Z',
      },
      { verdictId: 'other', eventType: 'failed', details: {}, createdAt: '2026-11-12T00:02:00Z' },
    ]);

    const result = await listRulingQueue('owner-1', 0, 20);
    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), 'owner-1');
    expect(result).toMatchObject({
      total: 1,
      verdicts: [
        {
          id: 'verdict-1',
          status: 'filing',
          events: [
            { eventType: 'queued' },
            { eventType: 'row_applied', details: { rowId: 'transaction-1' } },
          ],
          rows: [{ externalId: 'external-1', before: { categoryName: 'Uncategorized' } }],
        },
      ],
    });
  });

  it.each([
    [['queued'], 'queued'],
    [['queued', 'filing'], 'filing'],
    [['queued', 'filing', 'failed'], 'failed'],
    [['queued', 'filing', 'failed', 'filing', 'filed'], 'filed'],
  ] as const)('derives %s as %s', async (types, status) => {
    mocks.list.mockResolvedValue([
      {
        id: 'verdict-1',
        preparationId: 'preparation-1',
        clusterId: 'cluster-1',
        merchant: 'example',
        verdict: 'kill',
        category: null,
        tags: [],
        rows: [],
        createdAt: '2026-11-12T00:00:00Z',
      },
    ]);
    mocks.events.mockResolvedValue(
      types.map((eventType) => ({
        verdictId: 'verdict-1',
        eventType,
        details: {},
        createdAt: '2026-11-12T00:00:00Z',
      })),
    );
    expect((await listRulingQueue('owner-1', 0, 20)).verdicts[0]?.status).toBe(status);
  });
});
