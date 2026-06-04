import { OpenRouter } from '@openrouter/sdk';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_HTTP_REFERER = 'https://hominem.app';
export const DEFAULT_APP_TITLE = 'Hominem';

export const DEFAULT_TEXT_MODEL = process.env.AI_MODEL ?? 'openai/gpt-4o';
export const DEFAULT_IMAGE_MODEL = 'x-ai/grok-imagine-image-quality';
export const DEFAULT_EMBEDDING_MODEL = 'google/gemini-embedding-2';
export const DEFAULT_TRANSCRIPTION_MODEL = 'mistralai/voxtral-mini-transcribe';
export const DEFAULT_ENHANCE_MODEL = 'google/gemini-2.5-flash-lite';
export const DEFAULT_SPEECH_MODEL = 'openai/gpt-4o-audio-preview';

export type OpenRouterClientOptions = {
  apiKey?: string;
  httpReferer?: string;
  appTitle?: string;
  appCategories?: string;
};

export type EmbeddingOptions = OpenRouterClientOptions & {
  model?: string;
  inputType?: string;
  dimensions?: number;
};

export type TranscriptionOptions = OpenRouterClientOptions & {
  model?: string;
  language?: string;
};

export type ImageGenerationOptions = OpenRouterClientOptions & {
  model?: string;
  imageModel?: string;
  aspectRatio?: string;
  background?: string;
  moderation?: string;
  outputCompression?: number;
  outputFormat?: string;
  partialImages?: number;
  quality?: string;
  size?: string;
};

type ResponseFormatOption = {
  type: string;
  [key: string]: unknown;
};

type ChatMessageContentPart = Record<string, unknown>;

export type SharedChatMessage = {
  role: string;
  content: string | ChatMessageContentPart[];
  [key: string]: unknown;
};

export type SharedChatCompletionBody = {
  model?: string;
  messages: SharedChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormatOption;
  modalities?: string[];
  audio?: Record<string, unknown>;
  stream?: boolean;
  [key: string]: unknown;
};

type SharedChatMessageOutput = {
  content?: string;
  images?: Array<{
    imageUrl?: { url?: string };
  }>;
};

type SharedChatDelta = {
  content?: string;
  audio?: {
    data?: string;
    transcript?: string;
  };
};

type SharedChatChoice = {
  message?: SharedChatMessageOutput;
  delta?: SharedChatDelta;
  finish_reason?: string | null;
};

export type SharedChatCompletionResponse = {
  choices?: SharedChatChoice[];
  [key: string]: unknown;
};

export type SharedChatCompletionStreamChunk = {
  choices?: SharedChatChoice[];
  [key: string]: unknown;
};

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

function resolveOpenRouterMetadata(options: OpenRouterClientOptions = {}) {
  return {
    httpReferer: options.httpReferer ?? DEFAULT_HTTP_REFERER,
    appTitle: options.appTitle ?? DEFAULT_APP_TITLE,
    appCategories: options.appCategories,
  };
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function resolveOpenRouterApiKey(apiKey?: string) {
  const resolvedApiKey = apiKey ?? process.env.OPENROUTER_API_KEY?.trim();

  if (!resolvedApiKey) {
    throw new Error('OPENROUTER_API_KEY is required');
  }

  return resolvedApiKey;
}

export function getOpenRouterHeaders(
  options: OpenRouterClientOptions = {},
): Record<string, string> {
  const metadata = resolveOpenRouterMetadata(options);

  return {
    Authorization: `Bearer ${resolveOpenRouterApiKey(options.apiKey)}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': metadata.httpReferer,
    'X-Title': metadata.appTitle,
  };
}

async function getOpenRouterErrorMessage(response: Response): Promise<string | undefined> {
  const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const error = errorBody.error;

  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' ? message : undefined;
}

export async function assertOpenRouterResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const message = await getOpenRouterErrorMessage(response);
  throw new Error(
    message ?? `OpenRouter request failed: ${response.status} ${response.statusText}`,
  );
}

export async function* parseSseJsonStream(
  response: Response,
): AsyncGenerator<SharedChatCompletionStreamChunk> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('No response body from streaming completion');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) {
          continue;
        }

        const data = line.slice('data: '.length).trim();

        if (!data || data === '[DONE]') {
          continue;
        }

        yield JSON.parse(data) as SharedChatCompletionStreamChunk;
      }
    }

    const finalChunk = decoder.decode();
    if (!finalChunk) {
      return;
    }

    buffer += finalChunk;
    const lines = buffer.split('\n');

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }

      const data = line.slice('data: '.length).trim();

      if (!data || data === '[DONE]') {
        continue;
      }

      yield JSON.parse(data) as SharedChatCompletionStreamChunk;
    }
  } finally {
    reader.releaseLock();
  }
}

export function createOpenRouterClient(options: OpenRouterClientOptions = {}) {
  const metadata = resolveOpenRouterMetadata(options);

  return new OpenRouter({
    apiKey: resolveOpenRouterApiKey(options.apiKey),
    httpReferer: metadata.httpReferer,
    appTitle: metadata.appTitle,
    appCategories: metadata.appCategories,
  });
}
