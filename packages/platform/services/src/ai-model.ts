import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';

import { env } from './env';

/** OpenRouter exposes an OpenAI-compatible API at this base URL. */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface SharedTextModelOptions {
  structuredOutputs?: boolean;
}

type SharedTextModel = ReturnType<ReturnType<typeof createOpenAI>['chat']>;

function getOpenRouterApiKey(): string {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required');
  }
  return apiKey;
}

function buildProviderClient(): ReturnType<typeof createOpenAI> {
  return createOpenAI({
    apiKey: getOpenRouterApiKey(),
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      'HTTP-Referer': 'https://hominem.app',
      'X-Title': 'Hominem',
    },
  });
}

export function getSharedTextModel(_options: SharedTextModelOptions = {}): SharedTextModel {
  const modelId = env.AI_MODEL;

  const client = buildProviderClient();
  return client.chat(modelId);
}

export function getSharedAiModelConfig() {
  return {
    provider: 'openrouter' as const,
    modelId: env.AI_MODEL,
  };
}

export function getSharedOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: getOpenRouterApiKey(),
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': 'https://hominem.app',
      'X-Title': 'Hominem',
    },
  });
}
