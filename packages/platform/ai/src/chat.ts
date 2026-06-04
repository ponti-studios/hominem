import { chat } from '@tanstack/ai';
import { createOpenRouterText, openRouterText } from '@tanstack/ai-openrouter';
import { webFetchTool, webSearchTool } from '@tanstack/ai-openrouter/tools';

import {
  assertOpenRouterResponse,
  DEFAULT_APP_TITLE,
  DEFAULT_ENHANCE_MODEL,
  DEFAULT_HTTP_REFERER,
  DEFAULT_SPEECH_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
  OPENROUTER_BASE_URL,
  getOpenRouterHeaders,
  isTestEnvironment,
  parseSseJsonStream,
  resolveOpenRouterApiKey,
  type OpenRouterClientOptions,
  type SharedChatCompletionBody,
  type SharedChatCompletionResponse,
  type SharedChatCompletionStreamChunk,
} from './shared';

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

export type OpenRouterTextAdapterOptions = OpenRouterClientOptions & {
  model?: Parameters<typeof createOpenRouterText>[0];
};

function resolveOpenRouterMetadata(options: OpenRouterClientOptions = {}) {
  return {
    httpReferer: options.httpReferer ?? DEFAULT_HTTP_REFERER,
    appTitle: options.appTitle ?? DEFAULT_APP_TITLE,
    appCategories: options.appCategories,
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

export function createOpenRouterTextAdapter(options: OpenRouterTextAdapterOptions = {}) {
  const metadata = resolveOpenRouterMetadata(options);
  const model = (options.model ?? DEFAULT_TEXT_MODEL) as Parameters<typeof createOpenRouterText>[0];

  return createOpenRouterText(model, resolveOpenRouterApiKey(options.apiKey), {
    httpReferer: metadata.httpReferer,
    appTitle: metadata.appTitle,
    appCategories: metadata.appCategories,
  });
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
    return body.stream
      ? createTestChatCompletionStreamResponse()
      : Response.json(createTestChatCompletionResponse());
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

export { chat, openRouterText, webFetchTool, webSearchTool };
