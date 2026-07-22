import { describe, expect, it } from 'vitest';

import {
  ARCHIVED_CHATS_ROUTE,
  INBOX_ROUTE,
  SETTINGS_ROUTE,
  getContentRoute,
} from '~/services/navigation/routes';

describe('inbox routes', () => {
  it('builds the canonical inbox routes', () => {
    expect(INBOX_ROUTE).toBe('/(protected)');
    expect(SETTINGS_ROUTE).toBe('/(protected)/settings');
    expect(ARCHIVED_CHATS_ROUTE).toBe('/(protected)/settings/archived-chats');
    expect(getContentRoute('chat', 'chat-1')).toBe('/(protected)/inbox/chat/chat-1');
    expect(getContentRoute('note', 'note-1')).toBe('/(protected)/inbox/note/note-1');
  });

  it('rejects an empty content id', () => {
    expect(() => getContentRoute('chat', '')).toThrow('Content route requires an id');
  });
});
