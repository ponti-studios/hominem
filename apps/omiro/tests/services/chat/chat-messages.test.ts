import { getReferencedNoteLabel } from '@hominem/chat';
import { describe, expect, it } from 'vitest';

import { createOptimisticMessage } from '~/services/chat/chatMessages';
import { CHAT_MESSAGES_LIMIT } from '~/services/chat/use-chat-messages';

describe('chat messages', () => {
  it('preserves referenced notes on optimistic user messages', () => {
    const message = createOptimisticMessage(
      'chat-1',
      'Tell me more',
      [{ id: 'note-1', title: 'Project plan' }],
      'msg-1',
    );

    expect(message.referencedNotes).toEqual([{ id: 'note-1', title: 'Project plan' }]);
  });

  it('falls back to the note id when a referenced note has no title', () => {
    expect(getReferencedNoteLabel({ id: 'note-1', title: null })).toBe('note-1');
    expect(getReferencedNoteLabel({ id: 'note-2', title: 'Inbox' })).toBe('Inbox');
  });

  it('keeps the mobile fetch limit aligned with the shared query key default', () => {
    expect(CHAT_MESSAGES_LIMIT).toBe(50);
  });
});
