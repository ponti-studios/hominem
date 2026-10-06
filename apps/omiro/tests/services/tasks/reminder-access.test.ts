import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensure = vi.fn();
vi.mock('~/services/tasks/notifications/expo-reminder-scheduler', () => ({
  ensureNotificationPermission: ensure,
}));

const { askForReminders, onReminderAccessGranted } =
  await import('~/services/tasks/notifications/reminder-access');

const future = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

describe('askForReminders', () => {
  beforeEach(() => {
    ensure.mockReset();
  });

  it('asks when a task is placed on a future time and tells listeners once granted', async () => {
    ensure.mockResolvedValue(true);
    const granted = vi.fn();
    const stop = onReminderAccessGranted(granted);
    await askForReminders({ startAt: null, dueAt: future() });
    expect(ensure).toHaveBeenCalledOnce();
    expect(granted).toHaveBeenCalledOnce();
    stop();
  });

  it('does not ask for an undated or past task', async () => {
    await askForReminders({ startAt: null, dueAt: null });
    await askForReminders({ startAt: null, dueAt: new Date(2020, 0, 1, 10).toISOString() });
    expect(ensure).not.toHaveBeenCalled();
  });

  it('stays quiet when access is declined or unavailable', async () => {
    const granted = vi.fn();
    const stop = onReminderAccessGranted(granted);
    ensure.mockResolvedValueOnce(false);
    await askForReminders({ startAt: null, dueAt: future() });
    ensure.mockRejectedValueOnce(new Error('unavailable'));
    await askForReminders({ startAt: null, dueAt: future() });
    expect(granted).not.toHaveBeenCalled();
    stop();
  });
});
