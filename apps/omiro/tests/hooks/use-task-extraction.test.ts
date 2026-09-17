import { describe, expect, it, vi } from 'vitest';

vi.mock('~/services/tasks/reminders-gateway', () => ({
  remindersGateway: { createReminder: vi.fn() },
}));

const { buildExtractedTasksProposal } = await import('~/hooks/use-task-extraction');

describe('buildExtractedTasksProposal', () => {
  it('uses the no-tasks copy when extraction finds nothing', () => {
    const proposal = buildExtractedTasksProposal('transcript', { groups: [], tasks: [] });

    expect(proposal).toEqual({
      proposedType: 'task_list',
      proposedTitle: 'No tasks found',
      proposedChanges: ['No actionable tasks found in this conversation.'],
      previewContent: 'transcript',
      items: [],
    });
  });

  it('uses the single task title when exactly one task is found', () => {
    const proposal = buildExtractedTasksProposal('transcript', {
      groups: [],
      tasks: [{ title: 'Write docs' }],
    });

    expect(proposal.proposedTitle).toBe('Write docs');
    expect(proposal.proposedChanges).toEqual(['Write docs']);
    expect(proposal.items).toEqual([{ id: 'task-proposal-standalone-0', title: 'Write docs' }]);
  });

  it('uses the plural count title when multiple standalone tasks are found', () => {
    const proposal = buildExtractedTasksProposal('transcript', {
      groups: [],
      tasks: [{ title: 'A' }, { title: 'B' }],
    });

    expect(proposal.proposedTitle).toBe('2 tasks');
    expect(proposal.proposedChanges).toEqual(['A', 'B']);
  });

  it('uses the group title when a single group with no standalone tasks is found', () => {
    const proposal = buildExtractedTasksProposal('transcript', {
      groups: [
        { title: 'Plan London trip', tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }] },
      ],
      tasks: [],
    });

    expect(proposal.proposedTitle).toBe('Plan London trip');
    expect(proposal.proposedChanges).toEqual(['Plan London trip (2 tasks)']);
    expect(proposal.items).toEqual([
      {
        id: 'task-proposal-group0-0',
        title: 'Book flight',
        groupTitle: 'Plan London trip',
        groupIndex: 0,
      },
      {
        id: 'task-proposal-group0-1',
        title: 'Book hotel',
        groupTitle: 'Plan London trip',
        groupIndex: 0,
      },
    ]);
  });

  it('mixes a group with standalone tasks', () => {
    const proposal = buildExtractedTasksProposal('transcript', {
      groups: [
        { title: 'Plan London trip', tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }] },
      ],
      tasks: [{ title: 'Cancel gym membership' }],
    });

    expect(proposal.proposedTitle).toBe('3 tasks');
    expect(proposal.proposedChanges).toEqual([
      'Plan London trip (2 tasks)',
      'Cancel gym membership',
    ]);
  });
});
