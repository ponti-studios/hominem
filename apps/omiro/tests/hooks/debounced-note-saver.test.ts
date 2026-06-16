import type { Note } from '@hominem/rpc/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDebouncedNoteSaver, type NoteSavePayload } from '~/hooks/debounced-note-saver';

function createNote(content: string): Note {
  return { id: `note-${content}`, content } as Note;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('createDebouncedNoteSaver', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists only the latest pending save when edits are superseded', () => {
    vi.useFakeTimers();
    const persist = vi.fn((payload: NoteSavePayload) =>
      Promise.resolve(createNote(payload.content)),
    );
    const commit = vi.fn();
    const saver = createDebouncedNoteSaver({ commit, delayMs: 600, persist });

    saver.schedule({ title: null, content: 'first', fileIds: [] });
    saver.schedule({ title: null, content: 'second', fileIds: [] });
    vi.advanceTimersByTime(600);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ title: null, content: 'second', fileIds: [] });
  });

  it('flushes the latest pending save immediately', () => {
    vi.useFakeTimers();
    const persist = vi.fn((payload: NoteSavePayload) =>
      Promise.resolve(createNote(payload.content)),
    );
    const commit = vi.fn();
    const saver = createDebouncedNoteSaver({ commit, delayMs: 600, persist });

    saver.schedule({ title: null, content: 'latest', fileIds: [] });
    saver.flush();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ title: null, content: 'latest', fileIds: [] });
  });

  it('does not commit stale responses after a newer save is scheduled', async () => {
    vi.useFakeTimers();
    const first = createDeferred<Note>();
    const second = createDeferred<Note>();
    const persist = vi.fn((_payload: NoteSavePayload) => Promise.resolve(createNote('unused')));
    persist.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const commit = vi.fn();
    const saver = createDebouncedNoteSaver({ commit, delayMs: 600, persist });

    saver.schedule({ title: null, content: 'first', fileIds: [] });
    vi.advanceTimersByTime(600);
    saver.schedule({ title: null, content: 'second', fileIds: [] });

    first.resolve(createNote('first'));
    await first.promise;
    await Promise.resolve();

    expect(commit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    second.resolve(createNote('second'));
    await second.promise;
    await Promise.resolve();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(createNote('second'));
  });
});
