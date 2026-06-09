import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_BOOT_TIMEOUT_MS, createAuthBootAbortController } from '~/services/auth/boot-abort';

describe('createAuthBootAbortController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts its signal after the boot timeout even with an external signal', () => {
    vi.useFakeTimers();
    const external = new AbortController();
    const bootAbort = createAuthBootAbortController(external.signal);

    expect(bootAbort.signal.aborted).toBe(false);

    vi.advanceTimersByTime(AUTH_BOOT_TIMEOUT_MS);

    expect(bootAbort.signal.aborted).toBe(true);
    bootAbort.cleanup();
  });

  it('bridges an external abort into the boot signal', () => {
    vi.useFakeTimers();
    const external = new AbortController();
    const bootAbort = createAuthBootAbortController(external.signal);

    external.abort();

    expect(bootAbort.signal.aborted).toBe(true);
    bootAbort.cleanup();
  });
});
