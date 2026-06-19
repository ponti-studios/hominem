import { describe, expect, it } from 'vitest';

import {
  getWorkspaceArchivedChatsRoute,
  getWorkspaceArtifactRoute,
  getWorkspaceHomeRoute,
  getWorkspaceSettingsRoute,
} from '~/services/workspace/routes';

describe('workspace routes', () => {
  it('builds the canonical workspace routes', () => {
    expect(getWorkspaceHomeRoute()).toBe('/(protected)');
    expect(getWorkspaceSettingsRoute()).toBe('/(protected)/settings');
    expect(getWorkspaceArchivedChatsRoute()).toBe('/(protected)/settings/archived-chats');
    expect(getWorkspaceArtifactRoute('chat', 'chat-1')).toBe('/(protected)/inbox/chat/chat-1');
    expect(getWorkspaceArtifactRoute('note', 'note-1')).toBe('/(protected)/inbox/note/note-1');
    expect(getWorkspaceArtifactRoute('chat', 'chat-1', { initialMessage: 'hello there' })).toBe(
      '/(protected)/inbox/chat/chat-1?initialMessage=hello+there',
    );
  });
});
