import { describe, expect, it, vi } from 'vitest';

import { CREDIT_FLAG, createCreditFlag, type FlagClient } from './credit-flag';

const dana = { id: 'u1', email: 'dana@work.com' };

function client(answer: boolean | undefined | Error): FlagClient & {
  isFeatureEnabled: ReturnType<typeof vi.fn>;
} {
  return {
    isFeatureEnabled: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
}

describe('the credit flag', () => {
  it('asks PostHog by the opaque id, with the email only as a property', async () => {
    const posthog = client(true);
    const flag = createCreditFlag({ client: posthog });
    expect(await flag(dana)).toBe(true);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledWith(CREDIT_FLAG, 'u1', {
      personProperties: { email: 'dana@work.com' },
      sendFeatureFlagEvents: false,
    });
  });

  it('is off when PostHog says off', async () => {
    expect(await createCreditFlag({ client: client(false) })(dana)).toBe(false);
  });

  it('treats no answer as a failed lookup: logged, and remembered only briefly', async () => {
    let clock = 0;
    const log = vi.fn();
    const posthog = client(undefined);
    const flag = createCreditFlag({
      client: posthog,
      now: () => clock,
      ttlMs: 60_000,
      failureTtlMs: 15_000,
      log,
    });
    expect(await flag(dana)).toBe(false);
    expect(log).toHaveBeenCalledWith('credit_flag_lookup_failed', {
      error: 'flag could not be evaluated',
    });
    clock = 16_000;
    await flag(dana);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledTimes(2);
  });

  it('is off when PostHog is not configured', async () => {
    expect(await createCreditFlag({ client: null })(dana)).toBe(false);
  });

  it('keeps an answer for a while, then asks again', async () => {
    let clock = 0;
    const posthog = client(true);
    const flag = createCreditFlag({ client: posthog, now: () => clock, ttlMs: 60_000 });
    await flag(dana);
    clock = 59_000;
    await flag(dana);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledTimes(1);
    clock = 61_000;
    await flag(dana);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledTimes(2);
  });

  it('fails closed, logs, and does not hammer PostHog while it is down', async () => {
    let clock = 0;
    const log = vi.fn();
    const posthog = client(new Error('down'));
    const flag = createCreditFlag({ client: posthog, now: () => clock, failureTtlMs: 15_000, log });
    expect(await flag(dana)).toBe(false);
    clock = 5_000;
    expect(await flag(dana)).toBe(false);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('credit_flag_lookup_failed', { error: 'down' });
  });

  it('gives up on a slow lookup', async () => {
    const slow: FlagClient = { isFeatureEnabled: () => new Promise(() => undefined) };
    const log = vi.fn();
    expect(await createCreditFlag({ client: slow, timeoutMs: 20, log })(dana)).toBe(false);
    expect(log).toHaveBeenCalledWith('credit_flag_lookup_failed', {
      error: 'flag lookup timed out',
    });
  });
});
