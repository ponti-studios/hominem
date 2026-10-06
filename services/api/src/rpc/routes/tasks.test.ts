import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeRpcUser } from '../../testkit/fixtures/time-block';
import { createRpcTestApp } from '../../testkit/rpc-test-app';

const mocks = vi.hoisted(() => ({
  listTaskChanges: vi.fn(),
  getTaskDetail: vi.fn(),
}));

vi.mock('../../application/task.service', () => ({
  completeTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTaskDetail: mocks.getTaskDetail,
  listTaskChanges: mocks.listTaskChanges,
  listTasks: vi.fn(),
  persistExtractedTasks: vi.fn(),
  updateTask: vi.fn(),
}));

import { tasksRoutes } from './tasks';

const user = makeRpcUser();

function createApp() {
  return createRpcTestApp(tasksRoutes, { path: '/api/tasks', user });
}

describe('GET /api/tasks/changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTaskChanges.mockResolvedValue({ tasks: [], cursor: null, hasMore: false });
  });

  it('is routed to the sync endpoint, not parsed as a task id', async () => {
    const res = await createApp().request('/api/tasks/changes');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tasks: [], cursor: null, hasMore: false });
    expect(mocks.getTaskDetail).not.toHaveBeenCalled();
  });

  it('passes the cursor and a default limit for the caller', async () => {
    const since = '2026-10-06T10:00:00.000Z_6f1f0e0e-0000-4000-8000-000000000001';
    await createApp().request(`/api/tasks/changes?since=${encodeURIComponent(since)}`);

    expect(mocks.listTaskChanges).toHaveBeenCalledWith(user.id, { since, limit: 500 });
  });

  it('rejects an out-of-range limit', async () => {
    const res = await createApp().request('/api/tasks/changes?limit=5000');

    expect(res.status).toBe(400);
    expect(mocks.listTaskChanges).not.toHaveBeenCalled();
  });
});
