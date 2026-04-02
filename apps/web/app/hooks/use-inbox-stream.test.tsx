import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInboxStream, type InboxStreamItem } from './use-inbox-stream';

const mocks = vi.hoisted(() => ({
  chatsList: vi.fn(),
  notesList: vi.fn(),
}));

vi.mock('./use-chats', () => ({
  useChatsList: () => ({
    data: mocks.chatsList(),
    isLoading: false,
  }),
}));

vi.mock('./use-notes', () => ({
  useNotesList: () => ({
    data: mocks.notesList(),
    isLoading: false,
  }),
}));

function HookProbe({ onValue }: { onValue: (items: InboxStreamItem[]) => void }) {
  const { items } = useInboxStream();
  useEffect(() => {
    onValue(items);
  }, [onValue, items]);
  return null;
}

describe('useInboxStream', () => {
  beforeEach(() => {
    mocks.chatsList.mockReset();
    mocks.notesList.mockReset();
  });

  it('returns merged notes and chats sorted by latest activity', async () => {
    mocks.notesList.mockReturnValue([
      {
        id: 'note-1',
        title: 'Captured note',
        excerpt: 'Draft excerpt',
        content: 'Draft body',
        updatedAt: '2026-03-20T09:00:00.000Z',
      },
    ]);
    mocks.chatsList.mockReturnValue([
      {
        id: 'chat-1',
        title: 'Untitled session',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
    ]);

    let captured: InboxStreamItem[] = [];
    render(
      <HookProbe
        onValue={(v) => {
          captured = v;
        }}
      />,
    );

    await waitFor(() => expect(captured).toHaveLength(2));

    expect(captured[0]).toMatchObject({
      kind: 'chat',
      id: 'chat-1',
    });
    expect(captured.find((i) => i.kind === 'chat')?.title).toBe('Untitled session');
    expect(captured.find((i) => i.kind === 'note')?.preview).toBe('Draft excerpt');
  });
});
