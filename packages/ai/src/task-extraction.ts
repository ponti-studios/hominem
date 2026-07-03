import { chat } from '@tanstack/ai';
import { z } from 'zod';

import {
  DEFAULT_TASK_EXTRACTION_MODEL,
  normalizeOpenRouterError,
  type OpenRouterClientOptions,
} from './shared';
import { createOpenRouterTextAdapter, type OpenRouterTextAdapterOptions } from './text';

export type TaskExtractionInput = OpenRouterClientOptions & {
  transcript: string;
  model?: string;
};

export type ExtractedTask = {
  title: string;
  description?: string;
};

export type TaskExtractionOutput = {
  tasks: ExtractedTask[];
};

// OpenRouter's structured-output mode marks optional fields nullable rather than
// omitting them, so the model returns `description: null` instead of leaving it
// out — accept both and normalize to `undefined` for callers.
const RawTaskExtractionOutputSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
      }),
    )
    .max(10),
});

export function parseTaskExtractionOutput(value: unknown): TaskExtractionOutput {
  const parsed = RawTaskExtractionOutputSchema.parse(value);
  return {
    tasks: parsed.tasks.map((task) => ({
      title: task.title,
      ...(task.description ? { description: task.description } : {}),
    })),
  };
}

export async function extractTasks(
  input: TaskExtractionInput,
  systemPrompt: string,
): Promise<TaskExtractionOutput> {
  const model = input.model ?? DEFAULT_TASK_EXTRACTION_MODEL;
  const adapterOptions: OpenRouterTextAdapterOptions = {
    ...input,
    model: model as OpenRouterTextAdapterOptions['model'],
  };

  try {
    const output = await chat({
      adapter: createOpenRouterTextAdapter(adapterOptions),
      systemPrompts: [systemPrompt],
      messages: [{ role: 'user', content: input.transcript }],
      outputSchema: RawTaskExtractionOutputSchema,
    });
    return parseTaskExtractionOutput(output);
  } catch (error) {
    throw normalizeOpenRouterError(error);
  }
}
