import { describe, expect, it } from 'vitest';

import { buildConversationActionsModel } from './conversation-actions.model';

describe('buildConversationActionsModel', () => {
  it('builds grouped actions with destructive archive styling', () => {
    const sections = buildConversationActionsModel({
      canTransform: true,
      isArchiving: false,
      showDebug: false,
      transformTypes: ['note', 'task', 'task_list'],
    });

    expect(sections).toMatchObject([
      {
        title: 'Conversation',
        items: [
          { kind: 'search', label: 'Search messages' },
          { kind: 'toggle-debug', label: 'Show debug metadata' },
        ],
      },
      {
        title: 'Transform',
        items: [
          { kind: 'transform', label: 'Transform to note', type: 'note' },
          { kind: 'transform', label: 'Transform to task', type: 'task' },
          { kind: 'transform', label: 'Transform to task list', type: 'task_list' },
        ],
      },
      {
        title: 'Danger',
        items: [{ kind: 'archive', label: 'Archive chat' }],
      },
    ]);
  });

  it('omits transform actions when the lifecycle is blocked', () => {
    const sections = buildConversationActionsModel({
      canTransform: false,
      isArchiving: true,
      showDebug: true,
      transformTypes: ['note'],
    });

    expect(sections).toMatchObject([
      {
        title: 'Conversation',
        items: [
          { kind: 'search', label: 'Search messages' },
          { kind: 'toggle-debug', label: 'Hide debug metadata' },
        ],
      },
      {
        title: 'Danger',
        items: [{ kind: 'archive', label: 'Archiving…' }],
      },
    ]);
  });
});
