// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const mockMutateAsync = vi.fn();
const mockDonateAddNoteIntent = vi.fn();

vi.mock('~/services/notes/use-create-note', () => ({
  useCreateNote: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock('~/services/intent-donation', () => ({
  donateAddNoteIntent: mockDonateAddNoteIntent,
}));

const { useNoteSubmission } = await import('~/components/composer/useNoteSubmission');

describe('useNoteSubmission', () => {
  beforeEach(() => {
    mockMutateAsync.mockResolvedValue({ id: 'note-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clears the composer right away, without waiting for the request', async () => {
    const { result } = renderHookWithQueryClient(() => useNoteSubmission());
    const clearComposer = vi.fn();
    const restoreMessage = vi.fn();
    let finishRequest: (note: { id: string }) => void = () => {};
    mockMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve;
      }),
    );

    let submission: Promise<void> = Promise.resolve();
    act(() => {
      submission = result.current.submitNote({
        clearComposer,
        fileIds: ['file-1'],
        message: '  hello world  ',
        restoreMessage,
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ text: 'hello world', fileIds: ['file-1'] });
    expect(clearComposer).toHaveBeenCalledTimes(1);
    expect(mockDonateAddNoteIntent).not.toHaveBeenCalled();

    await act(async () => {
      finishRequest({ id: 'note-1' });
      await submission;
    });

    expect(mockDonateAddNoteIntent).toHaveBeenCalledTimes(1);
    expect(restoreMessage).not.toHaveBeenCalled();
  });

  it('puts the text back and skips the donation when note creation fails', async () => {
    const { result } = renderHookWithQueryClient(() => useNoteSubmission());
    const clearComposer = vi.fn();
    const restoreMessage = vi.fn();
    mockMutateAsync.mockRejectedValue(new Error('network down'));

    await act(async () => {
      await result.current.submitNote({
        clearComposer,
        fileIds: [],
        message: 'hi there',
        restoreMessage,
      });
    });

    await waitFor(() => expect(restoreMessage).toHaveBeenCalledWith('hi there'));
    expect(clearComposer).toHaveBeenCalledTimes(1);
    expect(mockDonateAddNoteIntent).not.toHaveBeenCalled();
  });

  it('does not report a saving state, so the send button never spins for notes', () => {
    const { result } = renderHookWithQueryClient(() => useNoteSubmission());
    expect(result.current).not.toHaveProperty('isSaving');
  });
});
