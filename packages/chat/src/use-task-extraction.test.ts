import { describe, expect, it } from 'vitest';

import { buildExtractedTasksProposal, type TaskExtractionStrings } from './use-task-extraction';

const strings: TaskExtractionStrings = {
  noTasksFoundTitle: 'No tasks found',
  noTasksFoundDescription: 'No actionable tasks found in this conversation.',
  tasksFoundTitle: (count: number) => `${count} tasks`,
  prepareReviewErrorTitle: 'Could not prepare review',
  saveContentErrorTitle: 'Could not save content',
  errorMessage: 'Please try again.',
};

describe('buildExtractedTasksProposal', () => {
  it('uses the no-tasks copy when extraction finds nothing', () => {
    expect(buildExtractedTasksProposal('transcript', { groups: [], tasks: [] }, strings)).toEqual({
      proposedType: 'task_list',
      proposedTitle: 'No tasks found',
      proposedChanges: ['No actionable tasks found in this conversation.'],
      previewContent: 'transcript',
      items: [],
    });
  });

  it('uses the single task title when exactly one standalone task is found', () => {
    const proposal = buildExtractedTasksProposal(
      'transcript',
      { groups: [], tasks: [{ title: 'Write docs' }] },
      strings,
    );

    expect(proposal.proposedTitle).toBe('Write docs');
    expect(proposal.proposedChanges).toEqual(['Write docs']);
    expect(proposal.items).toEqual([{ id: 'task-proposal-standalone-0', title: 'Write docs' }]);
  });

  it('uses the plural count title when multiple standalone tasks are found', () => {
    const proposal = buildExtractedTasksProposal(
      'transcript',
      { groups: [], tasks: [{ title: 'A' }, { title: 'B' }] },
      strings,
    );

    expect(proposal.proposedTitle).toBe('2 tasks');
    expect(proposal.proposedChanges).toEqual(['A', 'B']);
    expect(proposal.items.map((task) => task.id)).toEqual([
      'task-proposal-standalone-0',
      'task-proposal-standalone-1',
    ]);
  });

  it('uses the group title when exactly one group and no standalone tasks are found', () => {
    const proposal = buildExtractedTasksProposal(
      'transcript',
      {
        groups: [
          { title: 'Plan London trip', tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }] },
        ],
        tasks: [],
      },
      strings,
    );

    expect(proposal.proposedTitle).toBe('Plan London trip');
    expect(proposal.proposedChanges).toEqual(['Plan London trip (2 tasks)']);
    expect(proposal.items).toEqual([
      { id: 'task-proposal-group0-0', title: 'Book flight', groupTitle: 'Plan London trip' },
      { id: 'task-proposal-group0-1', title: 'Book hotel', groupTitle: 'Plan London trip' },
    ]);
  });

  it('falls back to a count title when a group is mixed with standalone tasks', () => {
    const proposal = buildExtractedTasksProposal(
      'transcript',
      {
        groups: [
          { title: 'Plan London trip', tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }] },
        ],
        tasks: [{ title: 'Cancel gym membership' }],
      },
      strings,
    );

    expect(proposal.proposedTitle).toBe('3 tasks');
    expect(proposal.proposedChanges).toEqual([
      'Plan London trip (2 tasks)',
      'Cancel gym membership',
    ]);
    expect(proposal.items.map((task) => task.id)).toEqual([
      'task-proposal-group0-0',
      'task-proposal-group0-1',
      'task-proposal-standalone-0',
    ]);
  });
});
