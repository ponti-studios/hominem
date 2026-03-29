import { describe, expect, it, vi } from 'vitest';

type SingleflightRef<T> = {
  current: Promise<T> | null;
};

function runSingleflight<T>(ref: SingleflightRef<T>, factory: () => Promise<T>) {
  if (ref.current) {
    return ref.current;
  }

  const inFlight = factory().finally(() => {
    ref.current = null;
  });

  ref.current = inFlight;
  return inFlight;
}

describe('runSingleflight', () => {
  it('reuses one in-flight promise for concurrent callers and resets after resolution', async () => {
    let resolveValue: ((value: string) => void) | null = null;
    const ref: SingleflightRef<string> = { current: null };
    const factory = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveValue = resolve;
        }),
    );

    const first = runSingleflight(ref, factory);
    const second = runSingleflight(ref, factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    resolveValue?.('token-1');
    await expect(first).resolves.toBe('token-1');
    expect(ref.current).toBeNull();

    const third = runSingleflight(ref, factory);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(third).not.toBe(first);
  });
});
