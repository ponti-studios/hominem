import { expect, test } from 'bun:test';

import { addPricedUsage, pricedUsageFromOpenRouter } from './openrouter-usage';

test('accumulates multi-turn token and dollar usage', () => {
  const first = pricedUsageFromOpenRouter({
    id: 'first',
    usage: { cost: 0.002, total_tokens: 100 },
  });
  const second = pricedUsageFromOpenRouter({
    id: 'second',
    usage: { cost: 0.003, total_tokens: 50 },
  });

  expect(addPricedUsage(first, second)).toEqual({
    contextTokens: 150,
    costUsd: 0.005,
    generationId: 'second',
  });
});

test('keeps unknown usage absent instead of reporting zero cost', () => {
  const usage = addPricedUsage({}, pricedUsageFromOpenRouter({ id: null, usage: null }));

  expect(usage.contextTokens).toEqual(undefined);
  expect(usage.costUsd).toEqual(undefined);
  expect(usage.generationId).toEqual(undefined);
});
