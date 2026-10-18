import { describe, expect, it } from 'vitest';

import { financeRoutes } from './finance';

describe('finance routes', () => {
  it('does not expose transaction import or progress endpoints', async () => {
    const jobs = await financeRoutes.request('/import/jobs');
    const progress = await financeRoutes.request('/import/ws');

    expect(jobs.status).toBe(404);
    expect(progress.status).toBe(404);
  });
});
