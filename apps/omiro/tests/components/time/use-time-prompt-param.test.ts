// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTimePromptParam } from '~/components/time/use-time-prompt-param';

describe('useTimePromptParam', () => {
  it('prefills the prompt from the link and clears the param', () => {
    const setPrompt = vi.fn();
    const clear = vi.fn();

    renderHook(() => useTimePromptParam({ clear, prompt: '  Buy oat milk ', setPrompt }));

    expect(setPrompt).toHaveBeenCalledWith('Buy oat milk');
    expect(clear).toHaveBeenCalledOnce();
  });

  it('does nothing without a prompt', () => {
    const setPrompt = vi.fn();
    const clear = vi.fn();

    renderHook(() => useTimePromptParam({ clear, prompt: undefined, setPrompt }));
    renderHook(() => useTimePromptParam({ clear, prompt: '   ', setPrompt }));

    expect(setPrompt).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });
});
