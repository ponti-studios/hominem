import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseVoiceTranscriptCleanupOutput } from './voice-cleanup';

describe('parseVoiceTranscriptCleanupOutput', () => {
  it('accepts a valid structured output payload', () => {
    expect(parseVoiceTranscriptCleanupOutput({ cleanedText: 'Hello there.' })).toEqual({
      cleanedText: 'Hello there.',
    });
  });

  it('rejects when choices are missing from a raw provider-style payload', () => {
    expect(() => parseVoiceTranscriptCleanupOutput({})).toThrow(z.ZodError);
  });

  it('rejects when message content is missing', () => {
    expect(() => parseVoiceTranscriptCleanupOutput({ choices: [{ message: {} }] })).toThrow(
      z.ZodError,
    );
  });

  it('rejects invalid json content strings', () => {
    expect(() => parseVoiceTranscriptCleanupOutput('{not-valid-json')).toThrow(z.ZodError);
  });

  it('rejects invalid schema shapes', () => {
    expect(() => parseVoiceTranscriptCleanupOutput({ cleanedText: 123 })).toThrow(z.ZodError);
  });
});
