import { describe, expect, it } from 'vitest';

import { normalizeOpenRouterChatUsage, normalizeOpenRouterEmbeddingUsage } from './shared';

describe('normalizeOpenRouterChatUsage', () => {
  it('returns null when usage is missing', () => {
    expect(normalizeOpenRouterChatUsage('model', null)).toBeNull();
  });

  it('uses canonical prompt plus completion tokens when provider total differs', () => {
    expect(
      normalizeOpenRouterChatUsage('model', {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 99,
        cost: 0.12,
      }),
    ).toMatchObject({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      reportedTotalTokens: 99,
      costUsd: 0.12,
    });
  });

  it('preserves zero-cost usage', () => {
    expect(
      normalizeOpenRouterChatUsage('model', {
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
        cost: 0,
      }),
    ).toMatchObject({
      totalTokens: 3,
      reportedTotalTokens: null,
      costUsd: 0,
    });
  });

  it('preserves null cost usage', () => {
    expect(
      normalizeOpenRouterChatUsage('model', {
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
        cost: null,
      }),
    ).toMatchObject({
      totalTokens: 3,
      costUsd: null,
    });
  });
});

describe('normalizeOpenRouterEmbeddingUsage', () => {
  it('uses prompt tokens as the canonical total when the provider total is missing', () => {
    expect(
      normalizeOpenRouterEmbeddingUsage('embed-model', {
        promptTokens: 12,
        cost: 0.01,
      }),
    ).toMatchObject({
      promptTokens: 12,
      completionTokens: 0,
      totalTokens: 12,
      reportedTotalTokens: null,
    });
  });

  it('records a divergent provider total in metadata-friendly form', () => {
    expect(
      normalizeOpenRouterEmbeddingUsage('embed-model', {
        promptTokens: 12,
        totalTokens: 18,
        cost: 0.01,
      }),
    ).toMatchObject({
      totalTokens: 12,
      reportedTotalTokens: 18,
    });
  });
});
