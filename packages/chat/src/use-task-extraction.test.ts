import { describe, expect, it } from 'vitest';

import {
  buildExtractedTasksProposal,
  chunkCreateInput,
  regroupAcceptedItems,
  type TaskExtractionStrings,
} from './use-task-extraction';

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

describe('chunkCreateInput', () => {
  const task = (title: string) => ({ title });

  it('keeps a small input in one batch', () => {
    const input = {
      groups: [{ title: 'Trip', tasks: [task('A'), task('B')] }],
      tasks: [task('C')],
    };
    expect(chunkCreateInput(input)).toEqual([input]);
  });

  it('splits standalone tasks across batches at the endpoint cap', () => {
    const tasks = Array.from({ length: 21 }, (_, i) => task(`Task ${i}`));
    const chunks = chunkCreateInput({ groups: [], tasks });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.tasks).toHaveLength(20);
    expect(chunks[1]?.tasks).toHaveLength(1);
    expect(chunks.every((chunk) => chunk.groups.length === 0)).toBe(true);
  });

  it('keeps groups atomic while pairing them with standalone chunks', () => {
    const groups = Array.from({ length: 11 }, (_, i) => ({
      title: `Group ${i}`,
      tasks: [task(`A${i}`), task(`B${i}`)],
    }));
    const chunks = chunkCreateInput({ groups, tasks: [] });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.groups).toHaveLength(10);
    expect(chunks[1]?.groups).toHaveLength(1);
  });

  it('splits a runaway group and demotes a sub-2 tail to standalone', () => {
    const tasks = Array.from({ length: 21 }, (_, i) => task(`Task ${i}`));
    const chunks = chunkCreateInput({ groups: [{ title: 'Runaway', tasks }], tasks: [] });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.groups).toEqual([{ title: 'Runaway', tasks: tasks.slice(0, 20) }]);
    expect(chunks[0]?.tasks).toEqual([tasks[20]]);
  });
});

describe('regroupAcceptedItems', () => {
  it('keeps same-titled groups separate by extraction index', () => {
    const proposal = buildExtractedTasksProposal(
      'transcript',
      {
        groups: [
          { title: 'Prepare launch', tasks: [{ title: 'A' }, { title: 'B' }] },
          { title: 'Prepare launch', tasks: [{ title: 'C' }, { title: 'D' }] },
        ],
        tasks: [],
      },
      strings,
    );

    expect(regroupAcceptedItems(proposal.items)).toEqual({
      groups: [
        { title: 'Prepare launch', tasks: [{ title: 'A' }, { title: 'B' }] },
        { title: 'Prepare launch', tasks: [{ title: 'C' }, { title: 'D' }] },
      ],
      tasks: [],
    });
  });

  it('demotes a group left with one item after rejection to standalone', () => {
    const proposal = buildExtractedTasksProposal(
      'transcript',
      {
        groups: [{ title: 'Trip', tasks: [{ title: 'A' }, { title: 'B' }] }],
        tasks: [],
      },
      strings,
    );

    expect(regroupAcceptedItems([proposal.items[0]!])).toEqual({
      groups: [],
      tasks: [{ title: 'A' }],
    });
  });
});
