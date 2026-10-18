import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  mode: 'test' as 'off' | 'test' | 'live',
  testers: 'listed@work.com',
  flag: vi.fn(async (): Promise<boolean | undefined> => false),
}));

vi.mock('../env', () => ({
  env: {
    get CREDIT_MODE() {
      return state.mode;
    },
    get CREDIT_TESTERS() {
      return state.testers;
    },
    POSTHOG_API_KEY: 'phc_test',
    POSTHOG_HOST: 'https://posthog.test',
    CREDIT_USD_PER_POUND: 1.28,
    CREDIT_GRANT_PENCE: 100,
    CREDIT_GRANTS_PER_DAY: 50,
    NODE_ENV: 'test',
  },
}));
vi.mock('posthog-node', () => ({
  PostHog: class {
    isFeatureEnabled = state.flag;
  },
}));
vi.mock('@hominem/telemetry', () => ({ logger: { error: vi.fn() } }));
vi.mock('./credit.store', () => ({ dbCreditStore: {} }));
vi.mock('./provider-credentials.store', () => ({ dbCredentialStore: {} }));
vi.mock('./openrouter-keys', () => ({ createOpenRouterKeys: () => ({}) }));
vi.mock('./stripe', () => ({ createStripeClient: () => ({}) }));

import { personInCreditMode } from './credit.runtime';

let next = 0;
const person = (email: string) => ({ id: `user-${next++}`, email });

beforeEach(() => {
  vi.clearAllMocks();
  state.mode = 'test';
  state.testers = 'listed@work.com';
  state.flag.mockResolvedValue(false);
});

describe('personInCreditMode', () => {
  it('is nobody when off and everybody when live, without asking PostHog', async () => {
    state.mode = 'off';
    expect(await personInCreditMode(person('listed@work.com'))).toBe(false);
    state.mode = 'live';
    expect(await personInCreditMode(person('anyone@else.com'))).toBe(true);
    expect(state.flag).not.toHaveBeenCalled();
  });

  it('lets a listed tester in without asking PostHog', async () => {
    expect(await personInCreditMode(person('listed@work.com'))).toBe(true);
    expect(state.flag).not.toHaveBeenCalled();
  });

  it('lets someone in when the PostHog flag is on for them', async () => {
    state.flag.mockResolvedValue(true);
    expect(await personInCreditMode(person('flagged@else.com'))).toBe(true);
  });

  it('keeps everyone else out when the flag is off or PostHog fails', async () => {
    expect(await personInCreditMode(person('other@else.com'))).toBe(false);
    state.flag.mockRejectedValue(new Error('down'));
    expect(await personInCreditMode(person('another@else.com'))).toBe(false);
  });
});
