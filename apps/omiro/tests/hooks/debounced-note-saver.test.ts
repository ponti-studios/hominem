import type { Note } from '@hominem/rpc/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDebouncedNoteSaver, type NoteSavePayload } from '~/hooks/debounced-note-saver';

import { makeNote } from '../fixtures';

function createNote(content: string): Note {
  return makeNote({ id: `note-${content}`, content });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
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

  it('sends one save at a time, so a slow earlier save cannot land after a later one', async () => {
    vi.useFakeTimers();
    const first = createDeferred<Note>();
    const persist = vi.fn((payload: NoteSavePayload) =>
      Promise.resolve(createNote(payload.content)),
    );
    persist.mockReturnValueOnce(first.promise);
    const commit = vi.fn();
    const saver = createDebouncedNoteSaver({ commit, delayMs: 600, persist });

    saver.schedule({ title: null, content: 'first', fileIds: [] });
    vi.advanceTimersByTime(600);
    saver.schedule({ title: null, content: 'second', fileIds: [] });
    vi.advanceTimersByTime(600);

    // The second is waiting for the first.
    expect(persist).toHaveBeenCalledTimes(1);

    first.resolve(createNote('first'));
    await vi.advanceTimersByTimeAsync(0);

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({ title: null, content: 'second', fileIds: [] });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(createNote('second'));
  });

  it('does not send an empty note, and says so', async () => {
    const persist = vi.fn((payload: NoteSavePayload) =>
      Promise.resolve(createNote(payload.content)),
    );
    const onSkip = vi.fn();
    const saver = createDebouncedNoteSaver({ commit: vi.fn(), delayMs: 600, onSkip, persist });

    await saver.persistNow({ title: null, content: '  \n ', fileIds: [] });

    expect(persist).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('persistNow waits for an earlier save and then sends its own', async () => {
    const first = createDeferred<Note>();
    const persist = vi.fn((payload: NoteSavePayload) =>
      Promise.resolve(createNote(payload.content)),
    );
    persist.mockReturnValueOnce(first.promise);
    const saver = createDebouncedNoteSaver({ commit: vi.fn(), delayMs: 600, persist });

    saver.schedule({ title: null, content: 'a', fileIds: [] });
    saver.flush();
    const done = saver.persistNow({ title: null, content: 'b', fileIds: [] });
    first.resolve(createNote('a'));
    await done;

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({ title: null, content: 'b', fileIds: [] });
  });

  it('rejects an explicit save when persistence fails', async () => {
    const error = Object.assign(new Error('Note not found'), { status: 404 });
    const persist = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const saver = createDebouncedNoteSaver({
      commit: vi.fn(),
      delayMs: 600,
      onError,
      persist,
    });

    await expect(saver.persistNow({ title: null, content: 'note', fileIds: [] })).rejects.toBe(
      error,
    );
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('continues draining pending explicit saves after a failure', async () => {
    const first = createDeferred<Note>();
    const second = createDeferred<Note>();
    const persist = vi.fn((_payload: NoteSavePayload) => Promise.resolve(createNote('unused')));
    persist.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const saver = createDebouncedNoteSaver({ commit: vi.fn(), delayMs: 600, persist });

    const firstSave = saver.persistNow({ title: null, content: 'first', fileIds: [] });
    const secondSave = saver.persistNow({ title: null, content: 'second', fileIds: [] });
    const firstError = new Error('first failed');
    const secondError = new Error('second failed');
    first.reject(firstError);

    await expect(firstSave).rejects.toBe(firstError);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith({ title: null, content: 'second', fileIds: [] });

    second.reject(secondError);
    await expect(secondSave).rejects.toBe(secondError);
  });
});
