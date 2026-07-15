import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createChatCompletion: vi.fn(),
  recordAIUsageEvent: vi.fn(),
}));

vi.mock('@hominem/ai', () => ({
  createChatCompletion: mocks.createChatCompletion,
  getChatCompletionText: vi.fn(
    (result: { choices?: Array<{ message?: { content?: string } }> }) =>
      result.choices?.[0]?.message?.content ?? '',
  ),
  getChatCompletionUsage: vi.fn((result: { model: string; usage?: Record<string, unknown> }) => ({
    provider: 'openrouter',
    model: result.model,
    promptTokens: Number(result.usage?.promptTokens ?? 0),
    completionTokens: Number(result.usage?.completionTokens ?? 0),
    totalTokens: Number(result.usage?.totalTokens ?? 0),
    reportedTotalTokens: null,
    costUsd: Number(result.usage?.cost ?? 0),
    cachedPromptTokens: null,
    reasoningTokens: null,
  })),
}));

vi.mock('./ai-usage', () => ({
  recordAIUsageEvent: mocks.recordAIUsageEvent,
  startAIUsageTimer: () => () => 0,
}));

vi.mock('@hominem/telemetry', () => ({
  LOG_MESSAGES: {
    IMAGE_ANALYZE_ERROR: 'IMAGE_ANALYZE_ERROR',
    FILE_PROCESS_ERROR: 'FILE_PROCESS_ERROR',
    DOCUMENT_PROCESS_ERROR: 'DOCUMENT_PROCESS_ERROR',
    DOCUMENT_SUMMARIZE_ERROR: 'DOCUMENT_SUMMARIZE_ERROR',
  },
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { FileProcessorService } from './files';

describe('FileProcessorService', () => {
  beforeEach(() => {
    mocks.recordAIUsageEvent.mockResolvedValue(undefined);
  });

  it('records image analysis usage immediately after the provider responds', async () => {
    mocks.createChatCompletion.mockResolvedValueOnce({
      model: 'vision-model',
      usage: { promptTokens: 6, completionTokens: 3, totalTokens: 9, cost: 0.09 },
      choices: [{ message: { content: 'image summary' } }],
    });

    const file = await FileProcessorService.processFile(
      new TextEncoder().encode('tiny-image').buffer,
      'image.png',
      'image/png',
      'file-id',
      'user-id',
    );

    expect(file.textContent).toBe('image summary');
    expect(mocks.recordAIUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'file_image_analyze',
        usage: expect.objectContaining({ totalTokens: 9, costUsd: 0.09 }),
      }),
    );
  });

  it('records failed image analysis attempts without provider usage', async () => {
    mocks.createChatCompletion.mockRejectedValueOnce(
      Object.assign(new Error('quota'), { code: 'quota_exceeded', status: 429 }),
    );

    await FileProcessorService.processFile(
      new TextEncoder().encode('tiny-image').buffer,
      'image.png',
      'image/png',
      'file-id',
      'user-id',
    );

    expect(mocks.recordAIUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'file_image_analyze',
        status: 'failed',
        error: expect.objectContaining({ code: 'quota_exceeded', status: 429 }),
      }),
    );
  });
});
