import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeNotesRowExit, requestNotesRowExit } from './notes-surface-events';

describe('notes surface events', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when a row exit completes', async () => {
    const pending = requestNotesRowExit('note-1');

    completeNotesRowExit('note-1');

    await expect(pending).resolves.toBeUndefined();
  });

  it('falls back after the exit timeout when no row responds', async () => {
    vi.useFakeTimers();

    const pending = requestNotesRowExit('note-2');

    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBeUndefined();
  });
});
