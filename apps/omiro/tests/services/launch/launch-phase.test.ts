// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadStore(e2e: boolean) {
  vi.resetModules();
  vi.doMock('~/constants', () => ({ E2E_TESTING: e2e }));
  return import('~/services/launch/launch-phase');
}

afterEach(() => vi.doUnmock('~/constants'));

describe('launch phase', () => {
  it('starts covered by the launch overlay and follows the overlay through the hand-off', async () => {
    const { setLaunchPhase, useLaunchPhase } = await loadStore(false);
    const { result } = renderHook(() => useLaunchPhase());
    expect(result.current).toBe('splash');

    act(() => setLaunchPhase('travel'));
    expect(result.current).toBe('travel');

    act(() => setLaunchPhase('done'));
    expect(result.current).toBe('done');
  });

  it('is already done in E2E runs, which have no overlay', async () => {
    const { useLaunchPhase } = await loadStore(true);
    expect(renderHook(() => useLaunchPhase()).result.current).toBe('done');
  });
});
