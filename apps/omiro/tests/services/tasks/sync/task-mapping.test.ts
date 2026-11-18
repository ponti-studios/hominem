import { describe, expect, it } from 'vitest';

import { toServerFields } from '~/services/tasks/sync/task-mapping';

const base = { title: 'Buy oat milk', notes: null, location: null };

describe('toServerFields', () => {
  it('sends a scheduled block when the end is after the start', () => {
    expect(
      toServerFields({
        ...base,
        startAt: '2026-11-17T09:00:00.000Z',
        dueAt: '2026-11-17T10:00:00.000Z',
      }),
    ).toMatchObject({
      dueAt: '2026-11-17T10:00:00.000Z',
      scheduledStartAt: '2026-11-17T09:00:00.000Z',
      scheduledEndAt: '2026-11-17T10:00:00.000Z',
    });
  });

  it('does not send a block when the end is before the start', () => {
    expect(
      toServerFields({
        ...base,
        startAt: '2026-11-17T10:00:00.000Z',
        dueAt: '2026-11-17T09:00:00.000Z',
      }),
    ).toMatchObject({
      dueAt: '2026-11-17T09:00:00.000Z',
      scheduledStartAt: null,
      scheduledEndAt: null,
    });
  });

  it('does not send a block when start equals end', () => {
    expect(
      toServerFields({
        ...base,
        startAt: '2026-11-17T09:00:00.000Z',
        dueAt: '2026-11-17T09:00:00.000Z',
      }),
    ).toMatchObject({ scheduledStartAt: null, scheduledEndAt: null });
  });

  it('treats a lone start as a due time', () => {
    expect(
      toServerFields({ ...base, startAt: '2026-11-17T09:00:00.000Z', dueAt: null }),
    ).toMatchObject({
      dueAt: '2026-11-17T09:00:00.000Z',
      scheduledStartAt: null,
      scheduledEndAt: null,
    });
  });
});
