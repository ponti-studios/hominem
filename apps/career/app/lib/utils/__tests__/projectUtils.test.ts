import { describe, expect, it } from 'vitest';

import { formatProjectStatus, getProjectStatusClasses } from '../projectUtils';

describe('projectUtils', () => {
  it('formats project statuses for display', () => {
    expect(formatProjectStatus('in-progress')).toBe('In Progress');
    expect(formatProjectStatus('on_hold')).toBe('On Hold');
  });

  it('returns project status classes by status', () => {
    expect(getProjectStatusClasses('completed')).toBe(
      'border-success/30 bg-success/10 text-foreground',
    );
    expect(getProjectStatusClasses('planned')).toBe('bg-amber-100 text-amber-800');
    expect(getProjectStatusClasses('unknown')).toBe('bg-muted text-foreground');
  });
});
