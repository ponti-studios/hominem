import { describe, expect, it } from 'vitest';

import { getMaxTokens, getReasoningConfig } from './chat-generation-input';

describe('getReasoningConfig', () => {
  it('lets Muse Spark 1.3 models use their native reasoning mode', () => {
    expect(getReasoningConfig('meta/muse-spark-1.3')).toBeUndefined();
    expect(getReasoningConfig('meta/muse-spark-1.3-contributor')).toBeUndefined();
  });

  it('keeps reasoning disabled for models without that requirement', () => {
    expect(getReasoningConfig('openai/gpt-4o-mini')).toEqual({ effort: 'none' });
  });

  it('uses minimal reasoning for GPT-5 mini', () => {
    expect(getReasoningConfig('openai/gpt-5-mini')).toEqual({ effort: 'minimal' });
  });

  it('caps Muse generations to a provider-compatible completion budget', () => {
    expect(getMaxTokens('meta/muse-spark-1.3-contributor', 'long')).toBe(1600);
    expect(getMaxTokens('openai/gpt-4o-mini', 'long')).toBe(6000);
  });
});
