import type { ChatMessages } from '@openrouter/sdk/models';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  getMaxOutputTokens,
  hitOutputCap,
  REPLY_LENGTHS,
  trimToLastSentence,
  withLengthReminder,
} from './reply-profile';

describe('withLengthReminder', () => {
  const messages: ChatMessages[] = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'Hello' },
  ];

  it('appends the reminder to the last user message without mutating the input', () => {
    const result = withLengthReminder(messages, 'short');
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: `Hello\n\n${REPLY_LENGTHS.short.reminder}`,
    });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Hello' });
  });

  it('leaves the conversation alone with no length or no trailing user turn', () => {
    expect(withLengthReminder(messages, undefined)).toBe(messages);
    const endsOnAssistant: ChatMessages[] = [...messages, { role: 'assistant', content: 'Hi' }];
    expect(withLengthReminder(endsOnAssistant, 'long')).toBe(endsOnAssistant);
  });
});

describe('getMaxOutputTokens', () => {
  it('is generous by default so reasoning has room', () => {
    expect(getMaxOutputTokens('openai/gpt-6-luna')).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(16_000);
  });

  it('applies provider overrides by model prefix', () => {
    expect(getMaxOutputTokens('meta/muse-spark-1.3-contributor')).toBe(1_600);
  });
});

describe('hitOutputCap', () => {
  it('recognises both providers spellings of a cap hit', () => {
    expect(hitOutputCap(['length'])).toBe(true);
    expect(hitOutputCap(['max_output_tokens'])).toBe(true);
    expect(hitOutputCap(['stop'])).toBe(false);
    expect(hitOutputCap([])).toBe(false);
  });
});

describe('trimToLastSentence', () => {
  it('cuts back to the last complete sentence', () => {
    expect(trimToLastSentence('One. Two! Three is half wri')).toBe('One. Two!');
  });

  it('keeps closing quotes and brackets with the sentence', () => {
    expect(trimToLastSentence('He said "stop." Then he le')).toBe('He said "stop."');
  });

  it('does not treat a decimal point as a sentence end', () => {
    expect(trimToLastSentence('Version 3.5 is out')).toBe('');
  });

  it('returns an empty string when nothing complete is left', () => {
    expect(trimToLastSentence('no end in sight')).toBe('');
  });

  it('returns a complete reply unchanged', () => {
    expect(trimToLastSentence('Done. ')).toBe('Done.');
  });
});
