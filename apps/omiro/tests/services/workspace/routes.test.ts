import { describe, expect, it } from 'vitest';

import {
  getLegacyArtifactRoute,
  getWorkspaceArchivedChatsRoute,
  getWorkspaceArtifactRoute,
  getWorkspaceHomeRoute,
  getWorkspaceSettingsRoute,
} from '~/services/workspace/routes';

describe('workspace routes', () => {
  it('builds the canonical workspace routes', () => {
    expect(getWorkspaceHomeRoute()).toBe('/(protected)/(tabs)');
    expect(getWorkspaceSettingsRoute()).toBe('/(protected)/(tabs)/settings');
    expect(getWorkspaceArchivedChatsRoute()).toBe('/(protected)/(tabs)/settings/archived-chats');
    expect(getWorkspaceArtifactRoute('chat', 'chat-1')).toBe(
      '/(protected)/(tabs)/inbox/chat/chat-1',
    );
    expect(getWorkspaceArtifactRoute('note', 'note-1')).toBe(
      '/(protected)/(tabs)/inbox/note/note-1',
    );
    expect(getWorkspaceArtifactRoute('chat', 'chat-1', { initialMessage: 'hello there' })).toBe(
      '/(protected)/(tabs)/inbox/chat/chat-1?initialMessage=hello+there',
    );
  });

  it('keeps legacy detail routes available for redirects', () => {
    expect(getLegacyArtifactRoute('chat', 'chat-1')).toBe('/(protected)/(tabs)/chat/chat-1');
    expect(getLegacyArtifactRoute('note', 'note-1')).toBe('/(protected)/(tabs)/notes/note-1');
  });
});
