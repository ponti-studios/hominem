// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setSignInHold } from '~/services/auth/sign-in-hold';
import {
  RESEND_COOLDOWN_SECONDS,
  SUCCESS_HOLD_MS,
  useLoginFlow,
} from '~/services/auth/use-login-flow';

function setup(overrides: Partial<Parameters<typeof useLoginFlow>[0]> = {}) {
  const requestEmailOtp = vi.fn().mockResolvedValue(undefined);
  const verifyEmailOtp = vi.fn().mockResolvedValue(undefined);
  const rendered = renderHook(() =>
    useLoginFlow({ requestEmailOtp, verifyEmailOtp, ...overrides }),
  );
  return { requestEmailOtp, verifyEmailOtp, ...rendered };
}

async function sendCodeTo(result: ReturnType<typeof setup>['result'], email: string) {
  act(() => result.current.setEmail(email));
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.sendCode();
  });
  return outcome;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  setSignInHold(false);
  vi.useRealTimers();
});

describe('useLoginFlow', () => {
  it('starts on the email step and says why an empty or invalid address is not sent', async () => {
    const { requestEmailOtp, result } = setup();
    expect(result.current.step).toBe('email');

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.sendCode();
    });
    expect(outcome).toBe('empty');
    expect(result.current.emailError).toBe('Email is required.');

    expect(await sendCodeTo(result, 'not-an-email')).toBe('invalid');
    expect(result.current.emailError).toBe('Enter a valid email address.');
    expect(requestEmailOtp).not.toHaveBeenCalled();
  });

  it('marks a valid address ready and clears the error as the address changes', async () => {
    const { result } = setup();
    await sendCodeTo(result, 'nope');
    expect(result.current.isEmailReady).toBe(false);

    act(() => result.current.setEmail('  You@Example.com '));
    expect(result.current.emailError).toBeNull();
    expect(result.current.isEmailReady).toBe(true);
    expect(result.current.normalizedEmail).toBe('you@example.com');
  });

  it('sends the code, moves to the code step, and starts the resend cooldown', async () => {
    const { requestEmailOtp, result } = setup();

    expect(await sendCodeTo(result, 'you@example.com')).toBe('sent');

    expect(requestEmailOtp).toHaveBeenCalledWith('you@example.com');
    expect(result.current.step).toBe('code');
    expect(result.current.resendSecondsLeft).toBe(RESEND_COOLDOWN_SECONDS);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.resendSecondsLeft).toBe(RESEND_COOLDOWN_SECONDS - 1);
  });

  it('stays on the email step and shows the server message when sending fails', async () => {
    const requestEmailOtp = vi.fn().mockRejectedValue(new Error('Too many requests'));
    const { result } = setup({ requestEmailOtp });

    expect(await sendCodeTo(result, 'you@example.com')).toBe('failed');

    expect(result.current.step).toBe('email');
    expect(result.current.emailError).toBe('Too many requests');
  });

  it('only fills the pebbles until the sixth digit, then submits the code', async () => {
    const { verifyEmailOtp, result } = setup();
    await sendCodeTo(result, 'you@example.com');

    act(() => result.current.setCode('12a34'));
    expect(result.current.code).toBe('1234');
    expect(verifyEmailOtp).not.toHaveBeenCalled();

    await act(async () => result.current.setCode('123456'));
    expect(verifyEmailOtp).toHaveBeenCalledWith({ email: 'you@example.com', otp: '123456' });
  });

  it('holds the route guards through the success moment, then releases them', async () => {
    const { result } = setup();
    await sendCodeTo(result, 'you@example.com');
    const { useSignInHold } = await import('~/services/auth/sign-in-hold');
    const hold = renderHook(() => useSignInHold());

    await act(async () => result.current.setCode('123456'));
    expect(result.current.succeeded).toBe(true);
    expect(hold.result.current).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUCCESS_HOLD_MS);
    });
    expect(hold.result.current).toBe(false);
  });

  it('releases the hold and keeps the step when the code is wrong', async () => {
    const verifyEmailOtp = vi.fn().mockRejectedValue(new Error('Invalid code'));
    const { result } = setup({ verifyEmailOtp });
    await sendCodeTo(result, 'you@example.com');
    const { useSignInHold } = await import('~/services/auth/sign-in-hold');
    const hold = renderHook(() => useSignInHold());

    await act(async () => result.current.setCode('000000'));

    expect(result.current.succeeded).toBe(false);
    expect(result.current.codeError).toBe('Invalid code');
    expect(result.current.code).toBe('');
    expect(result.current.step).toBe('code');
    expect(hold.result.current).toBe(false);
  });

  it('goes back to the email step and drops the code and cooldown', async () => {
    const { result } = setup();
    await sendCodeTo(result, 'you@example.com');
    act(() => result.current.setCode('123'));

    act(() => result.current.changeEmail());

    expect(result.current.step).toBe('email');
    expect(result.current.code).toBe('');
    expect(result.current.resendSecondsLeft).toBe(0);
  });

  it('resends to the same address and restarts the cooldown', async () => {
    const { requestEmailOtp, result } = setup();
    await sendCodeTo(result, 'you@example.com');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    await act(async () => result.current.resend());

    expect(requestEmailOtp).toHaveBeenCalledTimes(2);
    expect(result.current.resendSecondsLeft).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it('opens on the code step and submits the code from an emailed link', async () => {
    const onLinkOpened = vi.fn();
    const { verifyEmailOtp, result } = setup({
      linkEmail: 'You@Example.com',
      linkToken: '654321',
      onLinkOpened,
    });

    expect(result.current.step).toBe('code');
    expect(result.current.email).toBe('you@example.com');
    await act(async () => {
      await Promise.resolve();
    });

    expect(onLinkOpened).toHaveBeenCalledTimes(1);
    expect(verifyEmailOtp).toHaveBeenCalledTimes(1);
    expect(verifyEmailOtp).toHaveBeenCalledWith({ email: 'you@example.com', otp: '654321' });
  });

  it('ignores a link without a full code', () => {
    const { result } = setup({ linkEmail: 'you@example.com', linkToken: '123' });
    expect(result.current.step).toBe('email');
  });
});
