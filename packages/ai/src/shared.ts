import { OpenRouter } from '@openrouter/sdk';

export const DEFAULT_HTTP_REFERER = 'https://hominem.app';
export const DEFAULT_APP_TITLE = 'Hominem';

export const DEFAULT_TEXT_MODEL = process.env.AI_MODEL ?? 'openai/gpt-4o';
export const DEFAULT_IMAGE_MODEL = 'x-ai/grok-imagine-image-quality';
export const DEFAULT_EMBEDDING_MODEL = 'google/gemini-embedding-2';
export const DEFAULT_TRANSCRIPTION_MODEL = 'mistralai/voxtral-mini-transcribe';
export const DEFAULT_ENHANCE_MODEL = 'google/gemini-2.5-flash-lite';
export const DEFAULT_SPEECH_MODEL = 'openai/gpt-4o-audio-preview';
export const DEFAULT_VOICE_CLEANUP_MODEL =
  process.env.OPENROUTER_VOICE_CLEANUP_MODEL ?? 'openai/gpt-4o-mini';
export const DEFAULT_TASK_EXTRACTION_MODEL =
  process.env.OPENROUTER_TASK_EXTRACTION_MODEL ?? 'google/gemini-2.5-flash-lite';

export type OpenRouterClientOptions = {
  httpReferer?: string;
  appTitle?: string;
  appCategories?: string;
  client?: OpenRouterClientLike;
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

export type JsonObject = Record<string, unknown>;
export type OpenRouterClientLike = Pick<OpenRouter, 'chat' | 'embeddings'>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class OpenRouterRequestError extends Error {
  status?: number;
  statusText?: string;
  code?: string;
  providerMessage?: string;
  details?: JsonObject;

  constructor(
    message: string,
    options: {
      status?: number;
      statusText?: string;
      code?: string;
      providerMessage?: string;
      details?: JsonObject;
    } = {},
  ) {
    super(message);
    this.name = 'OpenRouterRequestError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.code = options.code;
    this.providerMessage = options.providerMessage;
    this.details = options.details;
  }
}

function parseOpenRouterErrorDetails(body: unknown) {
  if (!body) {
    return undefined;
  }

  if (isJsonObject(body)) {
    return body;
  }

  if (typeof body !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    return isJsonObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeOpenRouterError(error: unknown): OpenRouterRequestError {
  if (error instanceof OpenRouterRequestError) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      message?: unknown;
      status?: unknown;
      statusCode?: unknown;
      body?: unknown;
    };
    const details = parseOpenRouterErrorDetails(candidate.body);
    const nestedError = details?.error;
    const providerError =
      isJsonObject(nestedError) && typeof nestedError.message === 'string'
        ? nestedError
        : undefined;
    const providerMessage =
      providerError && typeof providerError.message === 'string'
        ? providerError.message
        : undefined;
    const status =
      typeof candidate.status === 'number'
        ? candidate.status
        : typeof candidate.statusCode === 'number'
          ? candidate.statusCode
          : undefined;

    return new OpenRouterRequestError(
      providerMessage ??
        (typeof candidate.message === 'string' ? candidate.message : 'OpenRouter request failed'),
      {
        status,
        code:
          providerError && typeof providerError.code === 'string' ? providerError.code : undefined,
        providerMessage,
        details: providerError ?? details,
      },
    );
  }

  return new OpenRouterRequestError('OpenRouter request failed');
}

export function createOpenRouterClient(options: OpenRouterClientOptions = {}) {
  if (options.client) {
    return options.client;
  }

  return new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    httpReferer: options.httpReferer ?? DEFAULT_HTTP_REFERER,
    appTitle: options.appTitle ?? DEFAULT_APP_TITLE,
    appCategories: options.appCategories,
  });
}
