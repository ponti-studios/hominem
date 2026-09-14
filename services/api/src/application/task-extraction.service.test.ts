import { describe, expect, it } from 'vitest';

import {
  formatVoiceTaskReferenceDate,
  normalizeVoiceTaskDueAt,
  parseTaskExtractionOutput,
  parseVoiceTaskExtractionOutput,
} from './task-extraction.service';

describe('formatVoiceTaskReferenceDate', () => {
  it('formats the reference date in the caller timezone with an explicit offset', () => {
    expect(formatVoiceTaskReferenceDate('2026-07-08T03:30:00.000Z', 'America/Los_Angeles')).toBe(
      '2026-07-07T20:30:00-07:00',
    );
  });
});

describe('normalizeVoiceTaskDueAt', () => {
  it('moves date-only UTC midnight values to local noon so the visible day stays stable', () => {
    expect(normalizeVoiceTaskDueAt('2026-07-09T00:00:00.000Z', 'America/Los_Angeles')).toBe(
      '2026-07-09T19:00:00.000Z',
    );
  });

  it('converts bare dates to local noon', () => {
    expect(normalizeVoiceTaskDueAt('2026-12-15', 'America/Los_Angeles')).toBe(
      '2026-12-15T20:00:00.000Z',
    );
  });

  it('leaves explicit clock times unchanged', () => {
    expect(normalizeVoiceTaskDueAt('2026-07-09T15:30:00-07:00', 'America/Los_Angeles')).toBe(
      '2026-07-09T15:30:00-07:00',
    );
  });
});

describe('parseVoiceTaskExtractionOutput', () => {
  it('normalizes due dates for date-only task intent', () => {
    expect(
      parseVoiceTaskExtractionOutput(
        {
          tasks: [
            {
              title: 'Schedule doctor appointment',
              dueAt: '2026-07-09T00:00:00.000Z',
            },
          ],
        },
        'America/Los_Angeles',
      ),
    ).toEqual({
      tasks: [
        {
          title: 'Schedule doctor appointment',
          dueAt: '2026-07-09T19:00:00.000Z',
        },
      ],
    });
  });
});

describe('parseTaskExtractionOutput', () => {
  it('keeps valid groups and standalone tasks', () => {
    expect(
      parseTaskExtractionOutput({
        groups: [
          {
            title: 'Plan London trip',
            tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }],
          },
        ],
        tasks: [{ title: 'Cancel gym membership' }],
      }),
    ).toEqual({
      groups: [
        {
          title: 'Plan London trip',
          tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }],
        },
      ],
      tasks: [{ title: 'Cancel gym membership' }],
    });
  });

  it('demotes a one-item group to standalone instead of failing', () => {
    expect(
      parseTaskExtractionOutput({
        groups: [{ title: 'Almost a group', tasks: [{ title: 'Lone task' }] }],
        tasks: [],
      }),
    ).toEqual({ groups: [], tasks: [{ title: 'Lone task' }] });
  });

  it('treats null arrays as empty', () => {
    expect(parseTaskExtractionOutput({ groups: null, tasks: null })).toEqual({
      groups: [],
      tasks: [],
    });
  });
});
