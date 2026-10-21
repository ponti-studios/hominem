import { describe, expect, it } from 'vitest';

import { redirectSystemPath } from '~/app/+native-intent';

describe('native Time intents', () => {
  it('rewrites task deep links to the Tasks list route', () => {
    expect(redirectSystemPath({ initial: true, path: 'time/task/task-1' })).toBe(
      '/(protected)/(tabs)/tasks',
    );
  });

  it('rewrites the old unscheduled-tasks link to the Tasks tab', () => {
    expect(redirectSystemPath({ initial: true, path: 'time/unscheduled' })).toBe(
      '/(protected)/(tabs)/tasks',
    );
  });

  it('rewrites a seeded chat deep link to the blank New Chat route', () => {
    expect(redirectSystemPath({ initial: true, path: 'chat?seed=Hello' })).toBe(
      '/(protected)/new-chat?seed=Hello',
    );
  });

  it('rewrites event deep links to the canonical Time workspace route', () => {
    expect(redirectSystemPath({ initial: true, path: '/time/event/event-1' })).toBe(
      '/(protected)/time/event/event-1',
    );
  });

  it('rewrites an emailed code link to the login screen, keeping its query', () => {
    expect(redirectSystemPath({ initial: false, path: 'verify?email=a%40b.co&token=123456' })).toBe(
      '/(auth)?email=a%40b.co&token=123456',
    );
  });
});
