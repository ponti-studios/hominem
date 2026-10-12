import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AppContext, RpcUser } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';

const service = vi.hoisted(() => ({
  upsertPossession: vi.fn(),
  bulkUpsertPossessions: vi.fn(),
  upsertContainer: vi.fn(),
  getPossessionHistory: vi.fn(),
  vesselWeightReport: vi.fn(),
  validatePossessions: vi.fn(),
}));

vi.mock('../../application/possessions.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../application/possessions.service')>()),
  upsertPossession: service.upsertPossession,
  bulkUpsertPossessions: service.bulkUpsertPossessions,
  upsertContainer: service.upsertContainer,
  getPossessionHistory: service.getPossessionHistory,
  vesselWeightReport: service.vesselWeightReport,
  validatePossessions: service.validatePossessions,
}));

import { possessionsRoutes } from './possessions';

const testUser: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'possessions@example.com',
  name: 'Possessions Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp(authenticated: boolean) {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware);

  if (authenticated) {
    app.use('*', async (c, next) => {
      c.set('auth', {
        user: testUser,
        userId: testUser.id,
        credential: 'session',
        scopes: [],
      });
      await next();
    });
  }

  return app.route('/api/possessions', possessionsRoutes);
}

const post = async (app: Hono<AppContext>, path: string, body: unknown) =>
  (
    await app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json();

describe('possessions routes', () => {
  it('requires authentication', async () => {
    const response = await createApp(false).request('/api/possessions/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ externalId: 'ITM-1', name: 'Lamp' }),
    });
    expect(response.status).toBe(401);
    expect(service.upsertPossession).not.toHaveBeenCalled();
  });

  it('validates upsert input before calling the service', async () => {
    service.upsertPossession.mockClear();
    const response = await createApp(true).request('/api/possessions/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'No key' }),
    });
    expect(response.status).toBe(400);
    expect(service.upsertPossession).not.toHaveBeenCalled();
  });

  it('delegates upsert, bulk-upsert, and container upsert to the service', async () => {
    const app = createApp(true);
    service.upsertPossession.mockResolvedValue({ id: 'id-1', created: true });
    service.bulkUpsertPossessions.mockResolvedValue([
      { externalId: 'ITM-1', id: 'id-1', created: true, error: null },
    ]);
    service.upsertContainer.mockResolvedValue({ id: 'id-2', created: false });

    await expect(
      post(app, '/api/possessions/upsert', { externalId: 'ITM-1', name: 'Lamp' }),
    ).resolves.toEqual({ id: 'id-1', created: true });
    await expect(
      post(app, '/api/possessions/bulk-upsert', {
        items: [{ externalId: 'ITM-1', name: 'Lamp' }],
      }),
    ).resolves.toEqual({
      results: [{ externalId: 'ITM-1', id: 'id-1', created: true, error: null }],
    });
    await expect(
      post(app, '/api/possessions/containers/upsert', {
        externalId: 'CON-1',
        name: 'Crate',
      }),
    ).resolves.toEqual({ id: 'id-2', created: false });
  });

  it('rejects bulk payloads over 100 items', async () => {
    service.bulkUpsertPossessions.mockClear();
    const response = await createApp(true).request('/api/possessions/bulk-upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: Array.from({ length: 101 }, (_, i) => ({ externalId: `ITM-${i}`, name: 'x' })),
      }),
    });
    expect(response.status).toBe(400);
    expect(service.bulkUpsertPossessions).not.toHaveBeenCalled();
  });

  it('serves history, weight-report, and validate reads', async () => {
    const app = createApp(true);
    service.getPossessionHistory.mockResolvedValue([]);
    service.vesselWeightReport.mockResolvedValue({
      vessels: [],
      groups: [],
      unassigned: { count: 0, weightKg: 0 },
    });
    service.validatePossessions.mockResolvedValue([]);
    const get = async (path: string) => (await app.request(path)).json();

    const id = '22222222-2222-4222-8222-222222222222';
    await expect(get(`/api/possessions/${id}/history`)).resolves.toEqual({ events: [] });
    expect(service.getPossessionHistory).toHaveBeenCalledWith(testUser.id, id, 50);
    await expect(get('/api/possessions/weight-report')).resolves.toHaveProperty('report');
    await expect(get('/api/possessions/validate')).resolves.toEqual({
      findings: [],
    });
  });
});
