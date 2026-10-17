import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ info: vi.fn(), startActiveSpan: vi.fn() }));

vi.mock('@hominem/telemetry', () => ({
  getTelemetryTracer: () => ({ startActiveSpan: mocks.startActiveSpan }),
  logger: { info: mocks.info },
}));

import {
  recordGenerationDiagnostic,
  recordGenerationEventDeduplicated,
  recordGenerationEventDelivery,
  recordGenerationToolEffect,
  withChatGenerationSpan,
} from './chat-generation-telemetry';

describe('chat generation telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startActiveSpan.mockImplementation(async (_name, _options, callback) =>
      callback({
        setAttribute: vi.fn(),
        setAttributes: vi.fn(),
        setStatus: vi.fn(),
        end: vi.fn(),
      }),
    );
  });

  it('records bounded generation timings and outcomes in an active span', async () => {
    const span = {
      setAttribute: vi.fn(),
      setAttributes: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
    };
    mocks.startActiveSpan.mockImplementation(async (_name, _options, callback) => callback(span));

    await withChatGenerationSpan('send', async (metrics) => {
      metrics.firstToken();
      metrics.firstToken();
      metrics.firstToolCall();
      metrics.toolCount(2);
      metrics.usage({ promptTokens: 10, outputTokens: 4, totalTokens: 14 });
      metrics.outcome('committed');
    });

    expect(mocks.startActiveSpan).toHaveBeenCalledWith(
      'chat.generation',
      { attributes: { 'chat.generation.kind': 'send' } },
      expect.any(Function),
    );
    expect(span.setAttribute).toHaveBeenCalledWith('chat.generation.outcome', 'committed');
    expect(span.setAttribute).toHaveBeenCalledWith(
      'chat.generation.time_to_first_token_ms',
      expect.any(Number),
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      'chat.generation.time_to_first_tool_call_ms',
      expect.any(Number),
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      'chat.generation.duration_ms',
      expect.any(Number),
    );
    expect(span.setAttributes).toHaveBeenCalledWith({
      'chat.generation.prompt_tokens': 10,
      'chat.generation.output_tokens': 4,
      'chat.generation.total_tokens': 14,
    });
    expect(span.setAttribute).toHaveBeenCalledWith('chat.generation.tool_count', 2);
    expect(span.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(span)).not.toContain('generation-1');
  });

  it('marks generation failures and still ends the span', async () => {
    const span = {
      setAttribute: vi.fn(),
      setAttributes: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
    };
    mocks.startActiveSpan.mockImplementation(async (_name, _options, callback) => callback(span));

    await expect(
      withChatGenerationSpan('start', async () => {
        throw new Error('private provider details');
      }),
    ).rejects.toThrow('private provider details');

    expect(span.setAttribute).toHaveBeenCalledWith('chat.generation.outcome', 'failed');
    expect(span.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(span.setAttribute.mock.calls)).not.toContain('private provider details');
  });

  it('records correlation fields without accepting payload fields', () => {
    recordGenerationEventDelivery({ generationId: 'generation-1', sequence: 3, delivery: 'live' });
    recordGenerationEventDeduplicated({ generationId: 'generation-1', sequence: 3 });
    recordGenerationToolEffect({
      generationId: 'generation-1',
      toolName: 'write_memory',
      outcome: 'reused',
    });
    expect(mocks.info).toHaveBeenCalledWith('chat_generation_event_delivered', {
      generationId: 'generation-1',
      sequence: 3,
      delivery: 'live',
    });
    expect(mocks.info).toHaveBeenCalledWith('chat_generation_diagnostic', {
      generationId: 'generation-1',
      durableSequence: 3,
      replayCursor: 3,
      deliveryMode: 'live',
    });
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('arguments');
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('result');
  });

  it('records the complete scalar diagnostic contract without payload data', () => {
    recordGenerationDiagnostic({
      generationId: 'generation-1',
      attempt: 2,
      turnId: 'turn-1',
      durableSequence: 8,
      replayCursor: 7,
      deliveryMode: 'replayed',
      terminalOutcome: 'failed',
      errorCategory: 'provider',
      effectOutcome: 'failed',
    });

    expect(mocks.info).toHaveBeenCalledWith('chat_generation_diagnostic', {
      generationId: 'generation-1',
      attempt: 2,
      turnId: 'turn-1',
      durableSequence: 8,
      replayCursor: 7,
      deliveryMode: 'replayed',
      terminalOutcome: 'failed',
      errorCategory: 'provider',
      effectOutcome: 'failed',
    });
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('arguments');
    expect(JSON.stringify(mocks.info.mock.calls)).not.toContain('result');
  });
});
