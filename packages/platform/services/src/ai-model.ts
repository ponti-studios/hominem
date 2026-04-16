import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';
import OpenAI from 'openai';

import { env } from './env';

/** OpenRouter exposes an OpenAI-compatible API at this base URL. */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface SharedTextModelOptions {
  structuredOutputs?: boolean;
}

function buildProviderClient(): ReturnType<typeof createOpenAI> {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required');
  }
  return createOpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      'HTTP-Referer': 'https://hominem.app',
      'X-Title': 'Hominem',
    },
  });
}

export function getSharedTextModel(options: SharedTextModelOptions = {}): LanguageModelV1 {
  const modelId = env.AI_MODEL;

  const client = buildProviderClient();

  return options.structuredOutputs === undefined
    ? client.chat(modelId)
    : client.chat(modelId, { structuredOutputs: options.structuredOutputs });
}

export function getSharedAiModelConfig() {
  return {
    provider: 'openrouter' as const,
    modelId: env.AI_MODEL,
  };
}

export function getSharedOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://hominem.app',
      'X-Title': 'Hominem',
    },
  });
}
