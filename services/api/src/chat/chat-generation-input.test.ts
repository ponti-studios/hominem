import { describe, expect, it } from 'vitest';

import { buildMessages, getReasoningConfig } from './chat-generation-input';

describe('getReasoningConfig', () => {
  it('lets Muse Spark 1.3 models use their native reasoning mode', () => {
    expect(getReasoningConfig('meta/muse-spark-1.3')).toBeUndefined();
    expect(getReasoningConfig('meta/muse-spark-1.3-contributor')).toBeUndefined();
  });

  it('keeps reasoning disabled for models without that requirement', () => {
    expect(getReasoningConfig('openai/gpt-6-luna')).toEqual({ effort: 'none' });
  });

  it('uses minimal reasoning for GPT-5 mini', () => {
    expect(getReasoningConfig('openai/gpt-5-mini')).toEqual({ effort: 'minimal' });
  });
});

describe('buildMessages', () => {
  it('adds the length reminder to the request-only last user turn', () => {
    const messages = buildMessages([], 'Hello', 'system prompt', 'short');
    expect(messages.at(-1)?.content).toContain('Hello');
    expect(messages.at(-1)?.content).toContain('under sixty words');
    expect(messages[0]).toEqual({ role: 'system', content: 'system prompt' });
  });

  it('leaves the user turn untouched without a response length', () => {
    expect(buildMessages([], 'Hello', 'system prompt').at(-1)).toEqual({
      role: 'user',
      content: 'Hello',
    });
  });
});
