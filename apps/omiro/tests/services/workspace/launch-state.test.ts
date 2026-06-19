import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/services/storage/mmkv', () => {
  const store = new Map<string, string>();

  return {
    storage: {
      getString: (key: string) => store.get(key),
      remove: (key: string) => {
        store.delete(key);
      },
      set: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  };
});

describe('workspace launch state', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('stores resume metadata independently from drafts', async () => {
    const launchState = await import('~/services/workspace/launch-state');

    launchState.writeFeedDraft('Follow up on notes');
    launchState.writeWorkspaceResumeArtifact({
      kind: 'note',
      id: 'note-1',
      title: 'Roadmap note',
      updatedAt: '2026-06-18T12:00:00.000Z',
    });

    expect(launchState.readFeedDraft()).toBe('Follow up on notes');
    expect(launchState.readWorkspaceResumeArtifact()).toEqual({
      kind: 'note',
      id: 'note-1',
      title: 'Roadmap note',
      updatedAt: '2026-06-18T12:00:00.000Z',
    });

    launchState.clearWorkspaceResumeArtifact();
    expect(launchState.readWorkspaceResumeArtifact()).toBeNull();
    expect(launchState.readFeedDraft()).toBe('Follow up on notes');
  });

  it('only consumes the workspace restore attempt once per module load', async () => {
    const launchState = await import('~/services/workspace/launch-state');

    expect(launchState.consumeWorkspaceRestoreAttempt()).toBe(true);
    expect(launchState.consumeWorkspaceRestoreAttempt()).toBe(false);
  });
});
