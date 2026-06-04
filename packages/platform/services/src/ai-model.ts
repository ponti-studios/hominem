import { OpenRouter } from '@openrouter/sdk';
import { chat } from '@tanstack/ai';
import { createOpenRouterText, openRouterText } from '@tanstack/ai-openrouter';
import { webFetchTool, webSearchTool } from '@tanstack/ai-openrouter/tools';

import { env } from './env';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_HTTP_REFERER = 'https://hominem.app';
const DEFAULT_APP_TITLE = 'Hominem';

const DEFAULT_TEXT_MODEL = env.AI_MODEL;
const DEFAULT_IMAGE_MODEL = 'x-ai/grok-imagine-image-quality';
const DEFAULT_EMBEDDING_MODEL = 'google/gemini-embedding-2';
const DEFAULT_TRANSCRIPTION_MODEL = 'mistralai/voxtral-mini-transcribe';
const DEFAULT_ENHANCE_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_SPEECH_MODEL = 'openai/gpt-4o-audio-preview';

const ENHANCE_SYSTEM_PROMPT = `You are a text editor. You receive text and optionally a user instruction for how to modify it.

When no instruction is provided:
- Fix grammar, punctuation, and capitalization
- Remove filler words (um, uh, like, you know)
- Break run-on sentences into clear, readable sentences
- Preserve the user's meaning and voice exactly — do not paraphrase or add new content

When an instruction is provided, follow it precisely while still maintaining correct grammar and punctuation.

Rules:
- Return only the modified text with no commentary, no quotes, no prefix
- If the input is already clean and no instruction changes are needed, return it unchanged.`;

const TEST_ASSISTANT_REPLY = 'Test assistant reply';

export type OpenRouterClientOptions = {
  apiKey?: string;
  httpReferer?: string;
  appTitle?: string;
  appCategories?: string;
};

export type OpenRouterTextAdapterOptions = OpenRouterClientOptions & {
  model?: Parameters<typeof createOpenRouterText>[0];
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

function isTestEnvironment(): boolean {
  return env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test';
}

function resolveOpenRouterMetadata(options: OpenRouterClientOptions = {}) {
  return {
    httpReferer: options.httpReferer ?? DEFAULT_HTTP_REFERER,
    appTitle: options.appTitle ?? DEFAULT_APP_TITLE,
    appCategories: options.appCategories,
  };
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim());
}

function resolveOpenRouterApiKey(apiKey?: string) {
  const resolvedApiKey = apiKey ?? env.OPENROUTER_API_KEY?.trim();

  if (!resolvedApiKey) {
    throw new Error('OPENROUTER_API_KEY is required');
  }

  return resolvedApiKey;
}

function getOpenRouterHeaders(options: OpenRouterClientOptions = {}): Record<string, string> {
  const metadata = resolveOpenRouterMetadata(options);

  return {
    Authorization: `Bearer ${resolveOpenRouterApiKey(options.apiKey)}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': metadata.httpReferer,
    'X-Title': metadata.appTitle,
  };
}

function createTestChatCompletionResponse(
  content = TEST_ASSISTANT_REPLY,
): SharedChatCompletionResponse {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

function createTestChatCompletionStreamResponse(): Response {
  return new Response(
    `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            content: TEST_ASSISTANT_REPLY,
          },
        },
      ],
    })}\n\n` + 'data: [DONE]\n\n',
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
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

async function assertOpenRouterResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const message = await getOpenRouterErrorMessage(response);
  throw new Error(message ?? `OpenRouter request failed: ${response.status} ${response.statusText}`);
}

async function* parseSseJsonStream(
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

export function createOpenRouterTextAdapter(options: OpenRouterTextAdapterOptions = {}) {
  const metadata = resolveOpenRouterMetadata(options);
  const model = (options.model ?? DEFAULT_TEXT_MODEL) as Parameters<typeof createOpenRouterText>[0];

  return createOpenRouterText(
    model,
    resolveOpenRouterApiKey(options.apiKey),
    {
      httpReferer: metadata.httpReferer,
      appTitle: metadata.appTitle,
      appCategories: metadata.appCategories,
    },
  );
}

export function getSharedTextModel() {
  return createOpenRouterTextAdapter();
}

export function getSharedAiModelConfig() {
  return {
    provider: 'openrouter' as const,
    modelId: DEFAULT_TEXT_MODEL,
    enhanceModel: DEFAULT_ENHANCE_MODEL,
    transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
    speechModel: DEFAULT_SPEECH_MODEL,
  };
}

export async function postChatCompletion(
  body: SharedChatCompletionBody,
  options: OpenRouterClientOptions = {},
): Promise<Response> {
  if (isTestEnvironment()) {
    return body.stream ? createTestChatCompletionStreamResponse() : Response.json(createTestChatCompletionResponse());
  }

  return fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getOpenRouterHeaders(options),
    body: JSON.stringify({
      ...body,
      model: body.model ?? DEFAULT_TEXT_MODEL,
    }),
  });
}

export async function createChatCompletion(
  body: SharedChatCompletionBody,
  options: OpenRouterClientOptions = {},
): Promise<SharedChatCompletionResponse> {
  const response = await postChatCompletion({ ...body, stream: false }, options);
  await assertOpenRouterResponse(response);

  return (await response.json()) as SharedChatCompletionResponse;
}

export async function* streamChatCompletion(
  body: SharedChatCompletionBody,
  options: OpenRouterClientOptions = {},
): AsyncGenerator<SharedChatCompletionStreamChunk> {
  const response = await postChatCompletion({ ...body, stream: true }, options);
  await assertOpenRouterResponse(response);

  yield* parseSseJsonStream(response);
}

export function getChatCompletionText(
  response: SharedChatCompletionResponse,
  fallback = '',
): string {
  const content = response.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : fallback;
}

export async function enhanceText(input: { text: string; instruction?: string }) {
  const response = await createChatCompletion({
    model: DEFAULT_ENHANCE_MODEL,
    messages: [
      { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: input.instruction
          ? `Instruction: ${input.instruction}\n\nText:\n${input.text}`
          : input.text,
      },
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  return getChatCompletionText(response, input.text).trim() || input.text;
}

export async function generateEmbedding(content: string, options: EmbeddingOptions = {}) {
  if (isTestEnvironment()) {
    return [] as number[];
  }

  const client = createOpenRouterClient(options);
  const response = await client.embeddings.generate({
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
    requestBody: {
      model: options.model ?? DEFAULT_EMBEDDING_MODEL,
      input: content,
      inputType: options.inputType ?? 'search_document',
      dimensions: options.dimensions,
      encodingFormat: 'float',
    },
  });

  const embeddingResponse =
    typeof response === 'string' ? (JSON.parse(response) as { data?: Array<{ embedding?: unknown }> }) : response;
  const embedding = embeddingResponse.data?.[0]?.embedding;

  return Array.isArray(embedding) ? embedding.filter((item): item is number => typeof item === 'number') : [];
}

export function toAudioFormat(mimeType: string) {
  if (mimeType.includes('webm')) {
    return 'webm';
  }

  if (mimeType.includes('mp4')) {
    return 'mp4';
  }

  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return 'mp3';
  }

  if (mimeType.includes('wav')) {
    return 'wav';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  if (mimeType.includes('aac')) {
    return 'aac';
  }

  if (mimeType.includes('flac')) {
    return 'flac';
  }

  return mimeType;
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  options: TranscriptionOptions = {},
) {
  if (isTestEnvironment()) {
    return TEST_ASSISTANT_REPLY;
  }

  const client = createOpenRouterClient(options);
  const response = await client.stt.createTranscription({
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
    sttRequest: {
      model: options.model ?? DEFAULT_TRANSCRIPTION_MODEL,
      inputAudio: {
        data: audioBase64,
        format: toAudioFormat(mimeType),
      },
      language: options.language,
    },
  });

  return response.text;
}

export async function generateImageFromPrompt(
  prompt: string,
  options: ImageGenerationOptions = {},
) {
  if (isTestEnvironment()) {
    return 'https://example.com/test-image.png';
  }

  const client = createOpenRouterClient(options);
  const imageConfig: Record<string, string | number> = {};

  if (options.aspectRatio) {
    imageConfig.aspect_ratio = options.aspectRatio;
  }

  if (options.background) {
    imageConfig.background = options.background;
  }

  if (options.moderation) {
    imageConfig.moderation = options.moderation;
  }

  if (options.outputCompression !== undefined) {
    imageConfig.output_compression = options.outputCompression;
  }

  if (options.outputFormat) {
    imageConfig.output_format = options.outputFormat;
  }

  if (options.partialImages !== undefined) {
    imageConfig.partial_images = options.partialImages;
  }

  if (options.quality) {
    imageConfig.quality = options.quality;
  }

  if (options.size) {
    imageConfig.size = options.size;
  }

  const response = await client.chat.send({
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
    chatRequest: {
      model: options.imageModel ?? options.model ?? DEFAULT_IMAGE_MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
      stream: false,
      ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
    },
  });

  const imageUrl = response.choices?.[0]?.message.images?.[0]?.imageUrl.url;

  if (imageUrl) {
    return imageUrl;
  }

  const content = response.choices?.[0]?.message.content;

  if (
    typeof content === 'string' &&
    (content.startsWith('data:image/') || content.startsWith('http'))
  ) {
    return content;
  }

  const imageItem = Array.isArray(content)
    ? (
        content as Array<{
          type?: string;
          imageUrl?: { url?: string };
          image_url?: { url?: string };
          url?: string;
        }>
      ).find((item) => item.type === 'image_url' || item.imageUrl || item.image_url || item.url)
    : null;
  const contentImageUrl = imageItem?.imageUrl?.url ?? imageItem?.image_url?.url ?? imageItem?.url;

  if (contentImageUrl) {
    return contentImageUrl;
  }

  throw new Error('No image data received from OpenRouter');
}

export { chat, openRouterText, webFetchTool, webSearchTool };
export {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SPEECH_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
};
