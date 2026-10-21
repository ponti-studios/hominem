// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { NoteSaveStatus } from '~/hooks/use-note-editor';
import { useRetrySaveOnReconnect } from '~/hooks/use-save-retry';

function setup(initial: { status: NoteSaveStatus; isOnline: boolean }) {
  const retry = vi.fn();
  const rendered = renderHook(
    ({ status, isOnline }: { status: NoteSaveStatus; isOnline: boolean }) =>
      useRetrySaveOnReconnect(status, isOnline, retry),
    { initialProps: initial },
  );
  return { retry, ...rendered };
}

describe('useRetrySaveOnReconnect', () => {
  it('retries when the connection returns and the offline save had already failed', () => {
    const { retry, rerender } = setup({ status: 'saving', isOnline: false });
    rerender({ status: 'error', isOnline: false });
    expect(retry).not.toHaveBeenCalled();

    rerender({ status: 'error', isOnline: true });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('retries when the offline save only fails after the connection is back', () => {
    const { retry, rerender } = setup({ status: 'saving', isOnline: false });
    rerender({ status: 'saving', isOnline: true });
    expect(retry).not.toHaveBeenCalled();

    rerender({ status: 'error', isOnline: true });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('retries only once, so a retry that fails again does not loop', () => {
    const { retry, rerender } = setup({ status: 'error', isOnline: false });
    rerender({ status: 'error', isOnline: true });
    rerender({ status: 'saving', isOnline: true });
    rerender({ status: 'error', isOnline: true });

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does not retry a failure that happened online with nothing waiting offline', () => {
    const { retry, rerender } = setup({ status: 'saved', isOnline: true });
    rerender({ status: 'saving', isOnline: true });
    rerender({ status: 'error', isOnline: true });

    expect(retry).not.toHaveBeenCalled();
  });

  it('forgets edits that saved before the connection returned', () => {
    const { retry, rerender } = setup({ status: 'saving', isOnline: false });
    rerender({ status: 'saved', isOnline: false });
    rerender({ status: 'saved', isOnline: true });
    rerender({ status: 'error', isOnline: true });

    expect(retry).not.toHaveBeenCalled();
  });
});
