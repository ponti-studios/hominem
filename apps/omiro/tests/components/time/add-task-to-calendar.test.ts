import { describe, expect, it, vi } from 'vitest';

import { addScheduledTaskToCalendar } from '~/components/time/add-task-to-calendar';

function gateway(permission: 'authorized' | 'denied' | 'notDetermined', granted = permission) {
  return {
    createEvent: vi.fn().mockResolvedValue({ id: 'event-1' }),
    getPermission: vi.fn().mockResolvedValue(permission),
    requestPermission: vi.fn().mockResolvedValue(granted),
  };
}

const block = {
  duration: null,
  end_time: null,
  location: 'Cafe',
  start_time: '2026-07-28T10:00:00.000Z',
};

describe('addScheduledTaskToCalendar', () => {
  it('creates an event for a task with a start time, defaulting to one hour', async () => {
    const calendar = gateway('authorized');

    await expect(addScheduledTaskToCalendar(calendar, block, 'Coffee')).resolves.toBe(true);

    expect(calendar.createEvent).toHaveBeenCalledWith(
      'Coffee',
      '2026-07-28T10:00:00.000Z',
      '2026-07-28T11:00:00.000Z',
      'Cafe',
      null,
    );
  });

  it('uses the end time or duration when there is one', async () => {
    const withEnd = gateway('authorized');
    await addScheduledTaskToCalendar(
      withEnd,
      { ...block, end_time: '2026-07-28T10:30:00.000Z' },
      'Coffee',
    );
    expect(withEnd.createEvent.mock.calls[0]?.[2]).toBe('2026-07-28T10:30:00.000Z');

    const withDuration = gateway('authorized');
    await addScheduledTaskToCalendar(withDuration, { ...block, duration: 15 }, 'Coffee');
    expect(withDuration.createEvent.mock.calls[0]?.[2]).toBe('2026-07-28T10:15:00.000Z');
  });

  it('skips a deadline-only task', async () => {
    const calendar = gateway('authorized');
    await expect(
      addScheduledTaskToCalendar(calendar, { ...block, start_time: null }, 'Pay rent'),
    ).resolves.toBe(false);
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });

  it('asks for access once and respects a refusal', async () => {
    const asked = gateway('notDetermined', 'authorized');
    await expect(addScheduledTaskToCalendar(asked, block, 'Coffee')).resolves.toBe(true);
    expect(asked.requestPermission).toHaveBeenCalledTimes(1);

    const denied = gateway('denied');
    await expect(addScheduledTaskToCalendar(denied, block, 'Coffee')).resolves.toBe(false);
    expect(denied.requestPermission).not.toHaveBeenCalled();
    expect(denied.createEvent).not.toHaveBeenCalled();
  });

  it('never throws when the calendar write fails', async () => {
    const calendar = gateway('authorized');
    calendar.createEvent.mockRejectedValue(new Error('read-only calendar'));
    await expect(addScheduledTaskToCalendar(calendar, block, 'Coffee')).resolves.toBe(false);
  });
});
