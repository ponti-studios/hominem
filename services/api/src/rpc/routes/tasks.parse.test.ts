import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  makeAIUsageMetrics,
  makeRpcUser,
  makeTimeBlock,
  TIME_BLOCK_TEST_USER_ID,
  VALID_TIME_BLOCK_PARSE_REQUEST,
} from '../../testkit/fixtures/time-block';
import { createRpcTestApp, postJson } from '../../testkit/rpc-test-app';
import { TIME_BLOCK_EXTRACTION_PROMPT } from '../prompts';

const mocks = vi.hoisted(() => ({
  assertUnderMonthlyUsageLimit: vi.fn(),
  extractTimeBlock: vi.fn(),
  recordAIUsageEvent: vi.fn(),
  startAIUsageTimer: vi.fn(() => () => 42),
  redisIncr: vi.fn().mockResolvedValue(1),
  redisExpire: vi.fn().mockResolvedValue(1),
}));

vi.mock('../../application/ai-usage.service', () => ({
  assertUnderMonthlyUsageLimit: mocks.assertUnderMonthlyUsageLimit,
  recordAIUsageEvent: mocks.recordAIUsageEvent,
  startAIUsageTimer: mocks.startAIUsageTimer,
}));

vi.mock('../../application/time-block-extraction.service', () => ({
  extractTimeBlock: mocks.extractTimeBlock,
}));

vi.mock('@hominem/services/redis', () => ({
  redis: {
    incr: mocks.redisIncr,
    expire: mocks.redisExpire,
  },
}));

import { timeBlockRoutes } from './tasks.parse';

const testUser = makeRpcUser();

function createApp(authenticated = true) {
  return createRpcTestApp(timeBlockRoutes, {
    authenticated,
    path: '/api/tasks',
    user: testUser,
  });
}

describe('tasks parse route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisIncr.mockResolvedValue(1);
    mocks.redisExpire.mockResolvedValue(1);
    mocks.startAIUsageTimer.mockReturnValue(() => 42);
    mocks.extractTimeBlock.mockResolvedValue({
      block: makeTimeBlock(),
      usage: makeAIUsageMetrics(),
    });
  });

  it('requires authentication', async () => {
    const response = await postJson(createApp(false), '/api/tasks/parse', {
      transcript: 'call the dentist',
    });

    expect(response.status).toBe(401);
    expect(mocks.extractTimeBlock).not.toHaveBeenCalled();
  });

  it('rejects an empty transcript', async () => {
    const response = await postJson(createApp(), '/api/tasks/parse', { transcript: '' });

    expect(response.status).toBe(400);
    expect(mocks.extractTimeBlock).not.toHaveBeenCalled();
  });

  it('rejects an invalid reference date', async () => {
    const response = await postJson(createApp(), '/api/tasks/parse', {
      ...VALID_TIME_BLOCK_PARSE_REQUEST,
      referenceDate: 'not-a-date',
    });

    expect(response.status).toBe(400);
    expect(mocks.extractTimeBlock).not.toHaveBeenCalled();
  });

  it('forwards the validated request and returns the parsed block', async () => {
    const response = await postJson(
      createApp(),
      '/api/tasks/parse',
      VALID_TIME_BLOCK_PARSE_REQUEST,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ block: makeTimeBlock() });
    expect(mocks.assertUnderMonthlyUsageLimit).toHaveBeenCalledWith(TIME_BLOCK_TEST_USER_ID);
    expect(mocks.extractTimeBlock).toHaveBeenCalledWith(
      VALID_TIME_BLOCK_PARSE_REQUEST,
      TIME_BLOCK_EXTRACTION_PROMPT,
    );
    expect(mocks.recordAIUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: expect.any(String),
        userId: TIME_BLOCK_TEST_USER_ID,
        feature: 'time_block_extract',
        operation: 'structured_output',
        usage: makeAIUsageMetrics(),
        status: 'succeeded',
        durationMs: 42,
      }),
    );
  });

  it('uses the current time when referenceDate is omitted', async () => {
    const response = await postJson(createApp(), '/api/tasks/parse', {
      transcript: 'call the dentist',
    });

    expect(response.status).toBe(200);
    expect(mocks.extractTimeBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: 'call the dentist',
        referenceDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
      expect.any(String),
    );
  });

  it('returns a generic failure and records failed usage', async () => {
    mocks.extractTimeBlock.mockRejectedValue(new Error('provider unavailable'));

    const response = await postJson(createApp(), '/api/tasks/parse', {
      transcript: 'call the dentist',
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Time block extraction failed' });
    expect(mocks.recordAIUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TIME_BLOCK_TEST_USER_ID,
        feature: 'time_block_extract',
        operation: 'structured_output',
        status: 'failed',
        error: expect.any(Error),
        durationMs: 42,
      }),
    );
  });

  it('allows the 30th request and rejects the 31st request', async () => {
    mocks.redisIncr.mockResolvedValueOnce(30).mockResolvedValueOnce(31);

    const allowed = await postJson(createApp(), '/api/tasks/parse', {
      transcript: 'call the dentist',
    });
    const rejected = await postJson(createApp(), '/api/tasks/parse', {
      transcript: 'call the dentist',
    });

    expect(allowed.status).toBe(200);
    expect(rejected.status).toBe(429);
    expect(await rejected.json()).toEqual({
      error: 'rate_limit_exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Retry later.',
    });
    expect(mocks.extractTimeBlock).toHaveBeenCalledTimes(1);
  });
});
