import { describe, expect, it } from 'vitest';

import { createGenerationState, reduceGeneration } from './index';
import { trimToLastSentence } from './truncation';

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

describe('provider-turn-completed with outputTruncated', () => {
  const withText = (assistantText: string) => ({
    ...createGenerationState('g1'),
    phase: 'streaming' as const,
    assistantText,
  });
  const completed = (outputTruncated?: boolean) => ({
    type: 'provider-turn-completed' as const,
    requiredToolCall: false,
    confirmationCallIds: [],
    outputTruncated,
  });

  it('trims a text-only reply to its last complete sentence before saving', () => {
    const step = reduceGeneration(withText('Fine. Cut off mid sen'), completed(true));
    expect(step.state.assistantText).toBe('Fine.');
    expect(step.state.phase).toBe('saving');
  });

  it('keeps the text when there is no complete sentence to fall back to', () => {
    const step = reduceGeneration(withText('no end in sight'), completed(true));
    expect(step.state.assistantText).toBe('no end in sight');
  });

  it('leaves a normally finished reply alone', () => {
    const step = reduceGeneration(withText('Fine. Cut off mid sen'), completed());
    expect(step.state.assistantText).toBe('Fine. Cut off mid sen');
  });
});
