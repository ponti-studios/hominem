import { describe, expect, it } from 'vitest';

import {
  getArchivedChatsRoute,
  getContentRoute,
  getInboxRoute,
  getSettingsRoute,
} from '~/services/navigation/routes';

describe('inbox routes', () => {
  it('builds the canonical inbox routes', () => {
    expect(getInboxRoute()).toBe('/(protected)');
    expect(getSettingsRoute()).toBe('/(protected)/settings');
    expect(getArchivedChatsRoute()).toBe('/(protected)/settings/archived-chats');
    expect(getContentRoute('chat', 'chat-1')).toBe('/(protected)/inbox/chat/chat-1');
    expect(getContentRoute('note', 'note-1')).toBe('/(protected)/inbox/note/note-1');
    expect(getContentRoute('chat', 'chat-1', { initialMessage: 'hello there' })).toBe(
      '/(protected)/inbox/chat/chat-1?initialMessage=hello+there',
    );
  });
});
