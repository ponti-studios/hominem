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

describe('inbox launch state', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('stores resume metadata independently from drafts', async () => {
    const launchState = await import('~/services/navigation/launch-state');

    launchState.writeInboxDraft('Follow up on notes');
    launchState.writeResumeTarget({
      kind: 'note',
      id: 'note-1',
      title: 'Roadmap note',
      updatedAt: '2026-06-18T12:00:00.000Z',
    });

    expect(launchState.readInboxDraft()).toBe('Follow up on notes');
    expect(launchState.readResumeTarget()).toEqual({
      kind: 'note',
      id: 'note-1',
      title: 'Roadmap note',
      updatedAt: '2026-06-18T12:00:00.000Z',
    });

    launchState.clearResumeTarget();
    expect(launchState.readResumeTarget()).toBeNull();
    expect(launchState.readInboxDraft()).toBe('Follow up on notes');
  });

  it('consumes inbox resume metadata once', async () => {
    const launchState = await import('~/services/navigation/launch-state');

    launchState.writeResumeTarget({
      kind: 'chat',
      id: 'chat-1',
      title: 'Follow up',
      updatedAt: '2026-06-18T12:00:00.000Z',
    });

    expect(launchState.consumeResumeTarget()).toEqual({
      kind: 'chat',
      id: 'chat-1',
      title: 'Follow up',
      updatedAt: '2026-06-18T12:00:00.000Z',
    });
    expect(launchState.consumeResumeTarget()).toBeNull();
    expect(launchState.readResumeTarget()).toBeNull();
  });

  it('only consumes the inbox restore attempt once per module load', async () => {
    const launchState = await import('~/services/navigation/launch-state');

    expect(launchState.consumeRestoreAttempt()).toBe(true);
    expect(launchState.consumeRestoreAttempt()).toBe(false);
  });

  it('round-trips and consumes chat composer handoff state', async () => {
    const launchState = await import('~/services/navigation/launch-state');

    launchState.writeChatComposerHandoff('chat-1', {
      message: 'Follow up with context',
      attachments: [
        {
          id: 'file-1',
          localUri: 'file:///tmp/file-1.png',
          name: 'file-1.png',
          type: 'image',
          uploadedFile: {
            id: 'uploaded-file-1',
            originalName: 'file-1.png',
            type: 'image',
            mimetype: 'image/png',
            size: 128,
            url: 'https://example.com/file-1.png',
            uploadedAt: new Date('2026-06-21T12:00:00.000Z'),
            vectorIds: [],
          },
        },
      ],
    });

    const handoff = launchState.readChatComposerHandoff('chat-1');
    expect(handoff).not.toBeNull();
    expect(handoff?.message).toBe('Follow up with context');
    expect(handoff?.attachments).toHaveLength(1);
    expect(handoff?.attachments[0]?.uploadedFile?.uploadedAt).toBeInstanceOf(Date);
    expect(launchState.consumeChatComposerHandoff('chat-1')?.attachments[0]?.uploadedFile?.id).toBe(
      'uploaded-file-1',
    );
    expect(launchState.readChatComposerHandoff('chat-1')).toBeNull();
  });
});
