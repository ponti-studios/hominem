import { describe, expect, it } from 'vitest';

import type { TimeBlock } from '~/components/time/time-types';
import { getAvailabilityRange } from '~/components/time/time-utils';

describe('Time availability', () => {
  it('uses the next seven local days when parsing does not provide a window', () => {
    const range = getAvailabilityRange(
      {
        primary_intent: 'schedule_gap_fill',
        title: null,
        target_title: null,
        participants: null,
        location: null,
        duration: null,
        start_time: null,
        end_time: null,
        scheduling_window_start: null,
        scheduling_window_end: null,
        deadline_fixed: null,
        recurrence_rule: null,
      } satisfies TimeBlock,
      new Date('2026-07-27T09:00:00.000Z'),
    );

    expect(range.start.toISOString()).toBe('2026-07-27T09:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-08-03T09:00:00.000Z');
  });
});
