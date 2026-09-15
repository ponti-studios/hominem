import type { AIUsageMetrics } from '@hominem/ai';

import type { RpcUser } from '../../rpc/middleware/auth';

export const TIME_BLOCK_TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

export function makeRpcUser(overrides: Partial<RpcUser> = {}): RpcUser {
  return {
    id: TIME_BLOCK_TEST_USER_ID,
    email: 'parse@example.com',
    name: 'Parse Test User',
    emailVerified: true,
    image: null,
    isAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export type TimeBlockFixture = {
  primary_intent:
    | 'add_task'
    | 'add_event'
    | 'add_recurring_event'
    | 'edit_event'
    | 'cancel_event'
    | 'search'
    | 'schedule_gap_fill';
  title: string | null;
  target_title: string | null;
  participants: string[] | null;
  location: string | null;
  duration: number | null;
  start_time: string | null;
  end_time: string | null;
  scheduling_window_start: string | null;
  scheduling_window_end: string | null;
  deadline_fixed: string | null;
  recurrence_rule: string | null;
};

export function makeTimeBlock(overrides: Partial<TimeBlockFixture> = {}): TimeBlockFixture {
  return {
    primary_intent: 'add_task',
    title: 'Call the dentist',
    target_title: null,
    participants: null,
    location: null,
    duration: 30,
    start_time: null,
    end_time: null,
    scheduling_window_start: null,
    scheduling_window_end: null,
    deadline_fixed: '2026-09-15',
    recurrence_rule: null,
    ...overrides,
  };
}

export function makeAIUsageMetrics(overrides: Partial<AIUsageMetrics> = {}): AIUsageMetrics {
  return {
    provider: 'openrouter',
    model: 'test-model',
    promptTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    reportedTotalTokens: null,
    costUsd: 0.01,
    cachedPromptTokens: null,
    reasoningTokens: null,
    ...overrides,
  };
}

export const VALID_TIME_BLOCK_PARSE_REQUEST = {
  transcript: 'call the dentist tomorrow for 30 minutes',
  referenceDate: '2026-09-14T09:00:00-07:00',
  timezone: 'America/Los_Angeles',
  conversationContext: 'The user is planning their week.',
  calendarContext: 'Tuesday 10:00-11:00 is busy.',
} as const;
