import { chat } from '@tanstack/ai';
import { z } from 'zod';

import {
  DEFAULT_VOICE_CLEANUP_MODEL,
  normalizeOpenRouterError,
  type OpenRouterClientOptions,
} from './shared';
import { createOpenRouterTextAdapter, type OpenRouterTextAdapterOptions } from './text';

export type VoiceTranscriptCleanupInput = OpenRouterClientOptions & {
  rawText: string;
  locale?: string;
  model?: string;
};

export type VoiceTranscriptCleanupOutput = {
  cleanedText: string;
};

const VOICE_TRANSCRIPT_CLEANUP_SYSTEM_PROMPT = [
  'You clean up raw on-device speech transcripts.',
  'Preserve the user meaning, names, numbers, dates, and intent.',
  'Fix casing, punctuation, spacing, repeated filler fragments, and obvious speech recognition artifacts.',
  'Do not summarize, expand, add facts, or heavily paraphrase.',
  'If you are uncertain, return the original transcript unchanged.',
  'Return only the JSON required by the schema.',
].join(' ');

const VoiceTranscriptCleanupOutputSchema = z.object({
  cleanedText: z.string(),
});

export function parseVoiceTranscriptCleanupOutput(value: unknown): VoiceTranscriptCleanupOutput {
  return VoiceTranscriptCleanupOutputSchema.parse(value);
}

export async function cleanupVoiceTranscript(
  input: VoiceTranscriptCleanupInput,
): Promise<VoiceTranscriptCleanupOutput> {
  const model = input.model ?? DEFAULT_VOICE_CLEANUP_MODEL;
  const adapterOptions: OpenRouterTextAdapterOptions = {
    ...input,
    model: model as OpenRouterTextAdapterOptions['model'],
  };

  try {
    const output = await chat({
      adapter: createOpenRouterTextAdapter(adapterOptions),
      systemPrompts: [VOICE_TRANSCRIPT_CLEANUP_SYSTEM_PROMPT],
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            rawText: input.rawText,
            ...(input.locale ? { locale: input.locale } : {}),
          }),
        },
      ],
      outputSchema: VoiceTranscriptCleanupOutputSchema,
    });
    return parseVoiceTranscriptCleanupOutput(output);
  } catch (error) {
    throw normalizeOpenRouterError(error);
  }
}
