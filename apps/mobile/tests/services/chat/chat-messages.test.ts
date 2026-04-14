import { getReferencedNoteLabel } from '@hominem/ui/chat/referenced-notes';
import { describe, expect, it } from 'vitest';

import { createOptimisticMessage } from '~/services/chat/chatMessages';

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
});
