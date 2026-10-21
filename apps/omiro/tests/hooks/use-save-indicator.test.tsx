// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NoteSaveStatus } from '~/hooks/use-note-editor';
import {
  SAVE_INDICATOR_GRACE_MS,
  SAVE_INDICATOR_LINGER_MS,
  useSaveIndicator,
} from '~/hooks/use-save-indicator';

function setup(initial: NoteSaveStatus = 'saved', online = true) {
  return renderHook(
    ({ status, isOnline }: { status: NoteSaveStatus; isOnline: boolean }) =>
      useSaveIndicator(status, isOnline),
    { initialProps: { status: initial, isOnline: online } },
  );
}

describe('useSaveIndicator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing when saved', () => {
    expect(setup().result.current).toBe('none');
  });

  it('stays quiet for a save that finishes inside the grace period', () => {
    const { result, rerender } = setup();
    rerender({ status: 'saving', isOnline: true });
    act(() => vi.advanceTimersByTime(SAVE_INDICATOR_GRACE_MS - 100));
    expect(result.current).toBe('none');
    rerender({ status: 'saved', isOnline: true });
    act(() => vi.advanceTimersByTime(SAVE_INDICATOR_GRACE_MS * 2));
    expect(result.current).toBe('none');
  });

  it('shows the saving dot once a save runs past the grace period', () => {
    const { result, rerender } = setup();
    rerender({ status: 'saving', isOnline: true });
    act(() => vi.advanceTimersByTime(SAVE_INDICATOR_GRACE_MS));
    expect(result.current).toBe('saving');
  });

  it('confirms a visible save with a saved dot, then clears it', () => {
    const { result, rerender } = setup();
    rerender({ status: 'saving', isOnline: true });
    act(() => vi.advanceTimersByTime(SAVE_INDICATOR_GRACE_MS));
    rerender({ status: 'saved', isOnline: true });
    expect(result.current).toBe('saved');
    act(() => vi.advanceTimersByTime(SAVE_INDICATOR_LINGER_MS));
    expect(result.current).toBe('none');
  });

  it('holds the error dot until the note saves', () => {
    const { result, rerender } = setup();
    rerender({ status: 'error', isOnline: true });
    expect(result.current).toBe('error');
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe('error');
    rerender({ status: 'saved', isOnline: true });
    expect(result.current).toBe('saved');
  });

  it('shows offline while edits are waiting and there is no connection', () => {
    const { result, rerender } = setup('saved', false);
    expect(result.current).toBe('none');
    rerender({ status: 'saving', isOnline: false });
    expect(result.current).toBe('offline');
    rerender({ status: 'error', isOnline: false });
    expect(result.current).toBe('offline');
  });

  it('drops the offline dot when the connection returns and the edit is saved', () => {
    const { result, rerender } = setup('error', false);
    expect(result.current).toBe('offline');
    rerender({ status: 'saved', isOnline: true });
    expect(result.current).toBe('saved');
  });

  it('does not restart the grace clock while a save stays in progress', () => {
    const { result, rerender } = setup();
    rerender({ status: 'saving', isOnline: true });
    act(() => vi.advanceTimersByTime(800));
    rerender({ status: 'saving', isOnline: true });
    act(() => vi.advanceTimersByTime(SAVE_INDICATOR_GRACE_MS - 800));
    expect(result.current).toBe('saving');
  });
});
