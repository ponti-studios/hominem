import { describe, expect, it } from 'vitest';

import {
  DEFAULT_REPLY_MODEL,
  formatPrice,
  isReplyModelId,
  REPLY_MODELS,
  replyModelName,
} from './reply-models';

describe('reply models', () => {
  it('defaults to the first listed model', () => {
    expect(DEFAULT_REPLY_MODEL).toBe(REPLY_MODELS[0].id);
    expect(isReplyModelId(DEFAULT_REPLY_MODEL)).toBe(true);
  });

  it('accepts only listed model ids', () => {
    expect(isReplyModelId('openai/gpt-6-luna')).toBe(true);
    expect(isReplyModelId('made-up/model')).toBe(false);
    expect(isReplyModelId('')).toBe(false);
  });

  it('names a listed model, and falls back to the last path segment for unknown ids', () => {
    expect(replyModelName('openai/gpt-6-luna')).toBe('GPT-6 Luna');
    expect(replyModelName('vendor/unknown-model')).toBe('unknown-model');
  });
});

describe('formatPrice', () => {
  it('shows sub-dollar prices to cents and whole dollars without decimals', () => {
    expect(formatPrice(0.42)).toBe('$0.42');
    expect(formatPrice(3)).toBe('$3');
    expect(formatPrice(12.5)).toBe('$12.50');
  });
});
